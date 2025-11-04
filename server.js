import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const PORT = process.env.PORT || 10000;

if (!ODDS_API_KEY || !API_FOOTBALL_KEY) {
  console.error("⚠️  FEHLER: ODDS_API_KEY oder API_FOOTBALL_KEY fehlt in .env!");
  process.exit(1);
}

// -----------------------------
// Ligen-Konfiguration
// -----------------------------
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", baseXG: [1.55, 1.25], id: 39 },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", baseXG: [1.60, 1.35], id: 78 },
  { key: "soccer_spain_la_liga", name: "La Liga", baseXG: [1.45, 1.20], id: 140 },
  { key: "soccer_italy_serie_a", name: "Serie A", baseXG: [1.45, 1.25], id: 135 },
  { key: "soccer_france_ligue_one", name: "Ligue 1", baseXG: [1.55, 1.35], id: 61 },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", baseXG: [1.70, 1.45], id: 88 },
  { key: "soccer_turkey_super_league", name: "Süper Lig", baseXG: [1.50, 1.40], id: 203 },
  { key: "soccer_usa_mls", name: "MLS", baseXG: [1.50, 1.40], id: 253 },
];

// -----------------------------
// Cache
// -----------------------------
const CACHE_FILE = path.join(__dirname, "cache.json");
let CACHE = {};

if (fs.existsSync(CACHE_FILE)) {
  try {
    CACHE = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    console.log("💾 Cache geladen:", Object.keys(CACHE).length, "Einträge");
  } catch {
    CACHE = {};
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(CACHE, null, 2));
}

function cacheKey(date, leagues) {
  return `${date}_${leagues.sort().join(",")}`;
}

// -----------------------------
// Mathe-Helfer
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
  let pHome = 0,
    pDraw = 0,
    pAway = 0;
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
// Teamform abrufen
// -----------------------------
async function getTeamForm(teamId, leagueId) {
  const url = `https://v3.football.api-sports.io/teams/statistics?league=${leagueId}&season=2024&team=${teamId}`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_FOOTBALL_KEY } });
  const data = await res.json();
  if (!data.response) return null;

  const formStr = data.response.form || "";
  const formArr = formStr.split("");
  const weights = [1, 0.9, 0.8, 0.7, 0.6];
  let score = 0,
    total = 0;

  for (let i = 0; i < Math.min(formArr.length, 5); i++) {
    const f = formArr[i];
    const w = weights[i];
    total += w;
    if (f === "W") score += 1 * w;
    else if (f === "D") score += 0.5 * w;
  }

  const formFactor = score / total;
  const homeForm = 1 + (formFactor - 0.5) * 0.3;
  const awayForm = 1 - (0.5 - formFactor) * 0.3;

  return { homeForm, awayForm, data: data.response };
}

// -----------------------------
// Haupt-Endpoint
// -----------------------------
app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  const leaguesParam = req.query.leagues ? req.query.leagues.split(",") : LEAGUES.map(l => l.key);

  const cacheId = cacheKey(date, leaguesParam);
  if (CACHE[cacheId] && Date.now() - CACHE[cacheId].timestamp < 12 * 60 * 60 * 1000) {
    console.log("📦 Cache-Treffer:", cacheId);
    return res.json(CACHE[cacheId].data);
  }

  const games = [];

  for (const league of LEAGUES.filter(l => leaguesParam.includes(l.key))) {
    try {
      const oddsUrl = `https://api.the-odds-api.com/v4/sports/${league.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
      const oddsRes = await fetch(oddsUrl);
      if (!oddsRes.ok) continue;
      const oddsData = await oddsRes.json();

      for (const g of oddsData) {
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
          over25: totals.find(o => o.name === "Over" && o.point === 2.5)?.price || 2,
        };

        if (!odds.home || !odds.away) continue;

        const EPS = 1e-6;
        const invHome = 1 / (odds.home || EPS);
        const invDraw = 1 / (odds.draw || (odds.home + odds.away) / 2 || EPS);
        const invAway = 1 / (odds.away || EPS);
        const sumInv = invHome + invDraw + invAway;
        const fair = { home: invHome / sumInv, draw: invDraw / sumInv, away: invAway / sumInv };

        const baseHome = league.baseXG[0];
        const baseAway = league.baseXG[1];
        const ratio = fair.home / (fair.home + fair.away);

        let homeXG = Math.max(0.3, baseHome + (ratio - 0.5) * 0.8);
        let awayXG = Math.max(0.2, baseAway - (ratio - 0.5) * 0.8);

        const homeTeamSearch = await fetch(
          `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(home)}&league=${league.id}`,
          { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
        );
        const awayTeamSearch = await fetch(
          `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(away)}&league=${league.id}`,
          { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
        );

        const homeTeamData = await homeTeamSearch.json();
        const awayTeamData = await awayTeamSearch.json();

        const homeId = homeTeamData.response?.[0]?.team?.id;
        const awayId = awayTeamData.response?.[0]?.team?.id;

        let homeFormFactor = 1,
          awayFormFactor = 1;

        if (homeId && awayId) {
          const homeStats = await getTeamForm(homeId, league.id);
          const awayStats = await getTeamForm(awayId, league.id);

          homeFormFactor = homeStats?.homeForm || 1;
          awayFormFactor = awayStats?.awayForm || 1;
        }

        homeXG *= homeFormFactor;
        awayXG *= awayFormFactor;

        const prob = computeMatchProb(homeXG, awayXG);
        prob.over25 = probOver25(homeXG, awayXG);
        prob.btts = bttsProbExact(homeXG, awayXG);

        const value = {
          home: prob.home * odds.home - 1,
          draw: prob.draw * (odds.draw || 3) - 1,
          away: prob.away * odds.away - 1,
          over25: prob.over25 * odds.over25 - 1,
          btts: prob.btts * odds.over25 - 1,
        };

        games.push({
          home,
          away,
          league: league.name,
          odds,
          prob,
          value,
          homeXG: +homeXG.toFixed(2),
          awayXG: +awayXG.toFixed(2),
          totalXG: +(homeXG + awayXG).toFixed(2),
        });
      }
    } catch (err) {
      console.error(`❌ Fehler bei ${league.name}:`, err.message);
    }
  }

  CACHE[cacheId] = { timestamp: Date.now(), data: { response: games } };
  saveCache();

  // 🔍 Logging
  const avgXG = (games.reduce((a, g) => a + g.totalXG, 0) / games.length).toFixed(2);
  const avgProb = (
    (games.reduce((a, g) => a + Math.max(g.prob.home, g.prob.draw, g.prob.away), 0) / games.length) *
    100
  ).toFixed(1);
  const topValue = games.filter(g =>
    Object.values(g.value).some(v => v > 0)
  );

  console.log(`📊 ${games.length} Spiele geladen. ØxG: ${avgXG}, ØTop-Prog: ${avgProb}%`);
  console.log(`💰 Spiele mit positivem Value: ${topValue.length}`);

  res.json({ response: games });
});

// -----------------------------
// Static + Start
// -----------------------------
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
