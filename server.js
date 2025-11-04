// server.js
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

if (!ODDS_API_KEY) console.error("❌ FEHLER: ODDS_API_KEY fehlt!");
if (!API_FOOTBALL_KEY) console.error("⚠️ FEHLER: API_FOOTBALL_KEY fehlt – Teamform deaktiviert.");

const PORT = process.env.PORT || 10000;
const DATA_DIR = path.join(__dirname, "data");
const TEAMS_FILE = path.join(DATA_DIR, "teams.json");

// ------------------------------------------------------
// Ligen (alle vorherigen + IDs für API-Football)
// ------------------------------------------------------
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", id: 39, baseXG: [1.55, 1.25] },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", id: 78, baseXG: [1.60, 1.35] },
  { key: "soccer_germany_2_bundesliga", name: "2. Bundesliga", id: 79, baseXG: [1.55, 1.45] },
  { key: "soccer_spain_la_liga", name: "La Liga", id: 140, baseXG: [1.45, 1.20] },
  { key: "soccer_italy_serie_a", name: "Serie A", id: 135, baseXG: [1.45, 1.25] },
  { key: "soccer_france_ligue_one", name: "Ligue 1", id: 61, baseXG: [1.55, 1.35] },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", id: 88, baseXG: [1.70, 1.45] },
  { key: "soccer_sweden_allsvenskan", name: "Allsvenskan", id: 113, baseXG: [1.55, 1.45] },
  { key: "soccer_turkey_super_league", name: "Turkish Süper Lig", id: 203, baseXG: [1.50, 1.40] },
  { key: "soccer_usa_mls", name: "MLS (USA)", id: 253, baseXG: [1.50, 1.40] },
  { key: "soccer_uefa_champs_league", name: "UEFA Champions League", id: 2, baseXG: [1.50, 1.35] },
  { key: "soccer_uefa_europa_conference_league", name: "UEFA Europa Conference League", id: 848, baseXG: [1.45, 1.25] },
  { key: "soccer_uefa_champs_league_qualification", name: "Champions League Qualification", id: 17, baseXG: [1.40, 1.25] },
];

const CACHE = {};
const TEAM_CACHE = {};
let TEAM_IDS = {};

// ------------------------------------------------------
// Mathefunktionen
// ------------------------------------------------------
function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }
function poisson(k, λ) { return (Math.pow(λ, k) * Math.exp(-λ)) / factorial(k); }

function computeMatchProb(homeXG, awayXG, max = 6) {
  let pHome = 0, pDraw = 0, pAway = 0;
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      const p = poisson(h, homeXG) * poisson(a, awayXG);
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
    }
  }
  return { home: pHome, draw: pDraw, away: pAway };
}

function probOver25(homeXG, awayXG, max = 6) {
  let p = 0;
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      if (h + a > 2) p += poisson(h, homeXG) * poisson(a, awayXG);
    }
  }
  return p;
}

function bttsProbExact(homeXG, awayXG, max = 6) {
  let p = 0;
  for (let h = 1; h <= max; h++) {
    for (let a = 1; a <= max; a++) {
      p += poisson(h, homeXG) * poisson(a, awayXG);
    }
  }
  return p;
}

// ------------------------------------------------------
// Teams speichern/laden
// ------------------------------------------------------
async function loadOrFetchTeams(forceReload = false) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  if (fs.existsSync(TEAMS_FILE) && !forceReload) {
    console.log("📂 Lade gespeicherte teams.json ...");
    TEAM_IDS = JSON.parse(fs.readFileSync(TEAMS_FILE, "utf-8"));
    console.log(`✅ ${Object.keys(TEAM_IDS).length} Teams aus Datei geladen.`);
    return;
  }

  if (!API_FOOTBALL_KEY) return;

  console.log("📡 Lade Teamdaten aus API-Football ...");
  const headers = { "x-apisports-key": API_FOOTBALL_KEY };
  const allTeams = {};

  for (const league of LEAGUES) {
    try {
      const res = await fetch(
        `https://v3.football.api-sports.io/teams?league=${league.id}&season=2024`,
        { headers }
      );
      const data = await res.json();
      const teams = data?.response || [];
      teams.forEach(t => {
        const name = t.team.name.trim();
        allTeams[name] = t.team.id;
      });
      console.log(`✅ ${league.name}: ${teams.length} Teams geladen.`);
    } catch (err) {
      console.error(`❌ Fehler beim Laden ${league.name}:`, err.message);
    }
  }

  TEAM_IDS = allTeams;
  fs.writeFileSync(TEAMS_FILE, JSON.stringify(allTeams, null, 2));
  console.log(`💾 Gespeichert unter data/teams.json (${Object.keys(allTeams).length} Teams).`);
}

// ------------------------------------------------------
// Teamform (letzte 10 Spiele)
// ------------------------------------------------------
async function getTeamForm(teamName) {
  const teamId = TEAM_IDS[teamName];
  if (!teamId || !API_FOOTBALL_KEY) return 0.5;
  if (TEAM_CACHE[teamId]) return TEAM_CACHE[teamId];

  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&last=10`,
      { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
    );
    const data = await res.json();
    const fixtures = data?.response || [];
    if (!fixtures.length) return 0.5;

    let wins = 0, draws = 0, losses = 0;
    fixtures.forEach(f => {
      const isHome = f.teams.home.id === teamId;
      const result =
        f.teams.home.winner === true ? "H" :
        f.teams.away.winner === true ? "A" : "D";
      if ((result === "H" && isHome) || (result === "A" && !isHome)) wins++;
      else if (result === "D") draws++;
      else losses++;
    });

    const score = (wins + 0.5 * draws) / (wins + draws + losses || 1);
    TEAM_CACHE[teamId] = score;
    return score;
  } catch (err) {
    console.error("⚠️ Fehler getTeamForm:", err.message);
    return 0.5;
  }
}

// ------------------------------------------------------
// /api/games
// ------------------------------------------------------
app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  const leaguesParam = req.query.leagues
    ? req.query.leagues.split(",")
    : LEAGUES.map(l => l.key);

  const cacheId = `${date}_${leaguesParam.sort().join(",")}`;
  if (CACHE[cacheId]) return res.json(CACHE[cacheId]);

  const games = [];

  for (const league of LEAGUES.filter(l => leaguesParam.includes(l.key))) {
    try {
      const oddsUrl = `https://api.the-odds-api.com/v4/sports/${league.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
      const resOdds = await fetch(oddsUrl);
      if (!resOdds.ok) continue;
      const data = await resOdds.json();

      for (const g of data) {
        const gameDate = new Date(g.commence_time).toISOString().slice(0, 10);
        if (gameDate !== date) continue;

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

        const homeForm = await getTeamForm(home);
        const awayForm = await getTeamForm(away);

        const baseHome = league.baseXG[0];
        const baseAway = league.baseXG[1];
        const impliedHome = 1 / odds.home;
        const impliedAway = 1 / odds.away;
        const ratio = impliedHome / (impliedHome + impliedAway);

        const homeXG = Math.max(0.3, baseHome + (ratio - 0.5) * 0.8 + (homeForm - 0.5) * 0.4);
        const awayXG = Math.max(0.2, baseAway - (ratio - 0.5) * 0.8 + (awayForm - 0.5) * 0.4);

        const prob = computeMatchProb(homeXG, awayXG);
        prob.over25 = probOver25(homeXG, awayXG);
        prob.btts = bttsProbExact(homeXG, awayXG);

        const value = {
          home: prob.home * odds.home - 1,
          draw: prob.draw * odds.draw - 1,
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
          form: { home: homeForm, away: awayForm },
        });
      }
    } catch (err) {
      console.error(`❌ Fehler in ${league.name}:`, err.message);
    }
  }

  CACHE[cacheId] = { response: games };
  res.json({ response: games });
});

// ------------------------------------------------------
// Start
// ------------------------------------------------------
await loadOrFetchTeams();
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
