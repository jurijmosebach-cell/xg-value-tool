import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

if (!ODDS_API_KEY) console.error("⚠️ FEHLER: ODDS_API_KEY fehlt!");
if (!API_FOOTBALL_KEY) console.error("⚠️ FEHLER: API_FOOTBALL_KEY fehlt!");

const PORT = process.env.PORT || 10000;

// -----------------------------
// LEAGUES
// -----------------------------
const LEAGUES = [
  { key: "soccer_epl", id: 39, name: "Premier League", baseXG: [1.55, 1.25] },
  { key: "soccer_germany_bundesliga", id: 78, name: "Bundesliga", baseXG: [1.60, 1.35] },
  { key: "soccer_germany_2_bundesliga", id: 79, name: "2. Bundesliga", baseXG: [1.55, 1.45] },
  { key: "soccer_spain_la_liga", id: 140, name: "La Liga", baseXG: [1.45, 1.20] },
  { key: "soccer_italy_serie_a", id: 135, name: "Serie A", baseXG: [1.45, 1.25] },
  { key: "soccer_france_ligue_one", id: 61, name: "Ligue 1", baseXG: [1.55, 1.35] },
  { key: "soccer_netherlands_eredivisie", id: 88, name: "Eredivisie", baseXG: [1.70, 1.45] },
  { key: "soccer_turkey_super_league", id: 203, name: "Süper Lig", baseXG: [1.50, 1.40] },
  { key: "soccer_usa_mls", id: 253, name: "MLS", baseXG: [1.50, 1.40] },
  { key: "soccer_uefa_champs_league", id: 2, name: "Champions League", baseXG: [1.50, 1.35] },
];

// -----------------------------
// CACHE
// -----------------------------
const CACHE = {};
function cacheKey(date, leagues) {
  return `${date}_${leagues.sort().join(",")}`;
}

// -----------------------------
// MATHEMATIK
// -----------------------------
const FACT_CACHE = [1];
function factorial(n) {
  if (FACT_CACHE[n] !== undefined) return FACT_CACHE[n];
  let val = FACT_CACHE[FACT_CACHE.length - 1];
  for (let i = FACT_CACHE.length; i <= n; i++) {
    val *= i;
    FACT_CACHE[i] = val;
  }
  return FACT_CACHE[n];
}

function poisson(k, lambda) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function computeMatchProb(homeXG, awayXG, maxGoals = 6) {
  let pHome = 0, pDraw = 0, pAway = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = poisson(h, homeXG) * poisson(a, awayXG);
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
    }
  }
  return { home: pHome, draw: pDraw, away: pAway };
}

function probOver25(homeXG, awayXG, maxGoals = 6) {
  let p = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      if (h + a > 2) p += poisson(h, homeXG) * poisson(a, awayXG);
    }
  }
  return p;
}

function bttsProbExact(homeXG, awayXG, maxGoals = 6) {
  let p = 0;
  for (let h = 1; h <= maxGoals; h++) {
    for (let a = 1; a <= maxGoals; a++) {
      p += poisson(h, homeXG) * poisson(a, awayXG);
    }
  }
  return p;
}

// -----------------------------
// TEAM FORM VIA API-FOOTBALL
// -----------------------------
async function getTeamForm(teamId, leagueId) {
  const cacheId = `form_${teamId}_${leagueId}`;
  if (CACHE[cacheId]) return CACHE[cacheId];

  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&league=${leagueId}&last=10`,
      { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
    );

    if (!res.ok) throw new Error(`API-Football error: ${res.status}`);
    const data = await res.json();
    const fixtures = data.response || [];

    const wins = fixtures.filter(f => f.teams.home.id === teamId && f.teams.home.winner ||
                                       f.teams.away.id === teamId && f.teams.away.winner).length;

    const formFactor = 0.8 + (wins / 10) * 0.4; // zwischen 0.8 und 1.2
    CACHE[cacheId] = formFactor;
    return formFactor;
  } catch (err) {
    console.warn("⚠️ Teamform-Fehler:", err.message);
    return 1.0; // neutral
  }
}

// -----------------------------
// API /api/games
// -----------------------------
app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  const leaguesParam = req.query.leagues ? req.query.leagues.split(",") : LEAGUES.map(l => l.key);
  const cacheId = cacheKey(date, leaguesParam);

  if (CACHE[cacheId]) {
    console.log("🟢 Cache-Treffer:", cacheId);
    return res.json(CACHE[cacheId]);
  }

  const games = [];
  const EPS = 1e-6;

  for (const league of LEAGUES.filter(l => leaguesParam.includes(l.key))) {
    try {
      // ODDS abrufen
      const oddsUrl = `https://api.the-odds-api.com/v4/sports/${league.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
      const response = await fetch(oddsUrl);
      if (!response.ok) continue;
      const data = await response.json();
      if (!Array.isArray(data)) continue;

      for (const g of data) {
        if (!g.commence_time?.startsWith(date)) continue;
        const home = g.home_team;
        const away = g.away_team;
        const book = g.bookmakers?.[0];
        if (!book) continue;

        const h2h = book.markets?.find(m => m.key === "h2h")?.outcomes || [];
        const totals = book.markets?.find(m => m.key === "totals")?.outcomes || [];

        const odds = {
          home: h2h.find(o => o.name === home)?.price || 0,
          draw: h2h.find(o => o.name === "Draw")?.price || 0,
          away: h2h.find(o => o.name === away)?.price || 0,
          over25: totals.find(o => o.name === "Over" && o.point === 2.5)?.price || 0,
        };
        if (!odds.home || !odds.away) continue;

        // Faire Wahrscheinlichkeiten
        const invHome = 1 / (odds.home || EPS);
        const invDraw = 1 / (odds.draw || (odds.home + odds.away) / 2 || EPS);
        const invAway = 1 / (odds.away || EPS);
        const sumInv = invHome + invDraw + invAway;
        const fair = {
          home: invHome / sumInv,
          draw: invDraw / sumInv,
          away: invAway / sumInv,
        };

        // Team-IDs abrufen (API-Football)
        const teamSearch = async name => {
          const res = await fetch(
            `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(name)}&league=${league.id}`,
            { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
          );
          const json = await res.json();
          return json.response?.[0]?.team?.id || null;
        };

        const homeId = await teamSearch(home);
        const awayId = await teamSearch(away);

        const homeForm = homeId ? await getTeamForm(homeId, league.id) : 1.0;
        const awayForm = awayId ? await getTeamForm(awayId, league.id) : 1.0;

        // xG-Schätzung
        const baseHome = league.baseXG[0];
        const baseAway = league.baseXG[1];
        const ratio = fair.home - fair.away;
        const homeXG = Math.max(0.2, baseHome * homeForm + ratio * 0.9);
        const awayXG = Math.max(0.1, baseAway * awayForm - ratio * 0.9);

        // Wahrscheinlichkeiten
        const prob = computeMatchProb(homeXG, awayXG);
        prob.over25 = probOver25(homeXG, awayXG);
        prob.btts = bttsProbExact(homeXG, awayXG);

        // Value
        const value = {
          home: prob.home * odds.home - 1,
          draw: prob.draw * (odds.draw || (odds.home + odds.away) / 2) - 1,
          away: prob.away * odds.away - 1,
          over25: prob.over25 * (odds.over25 || 2) - 1,
          btts: prob.btts * (odds.over25 || 2) - 1,
        };

        games.push({
          home,
          away,
          league: league.name,
          odds,
          prob,
          value,
          homeForm,
          awayForm,
          homeXG: +homeXG.toFixed(2),
          awayXG: +awayXG.toFixed(2),
          totalXG: +(homeXG + awayXG).toFixed(2),
        });
      }
    } catch (err) {
      console.error(`❌ Fehler ${league.name}:`, err.message);
    }
  }

  CACHE[cacheId] = { response: games };
  res.json({ response: games });
});

// -----------------------------
// Static + Start
// -----------------------------
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
