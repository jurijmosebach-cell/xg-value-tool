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

// ✅ ENV Variablen
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const API_SPORTS_KEY = process.env.API_FOOTBALL_KEY;

if (!ODDS_API_KEY) console.error("⚠️ FEHLER: ODDS_API_KEY fehlt!");
if (!API_SPORTS_KEY) console.error("⚠️ FEHLER: API_FOOTBALL_KEY fehlt!");

const PORT = process.env.PORT || 10000;
const CACHE_FILE = path.join(__dirname, "cache.json");

// -----------------------------
// Ligen & Basis-xG
// -----------------------------
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", apiSportsId: 39, baseXG: [1.55, 1.25] },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", apiSportsId: 78, baseXG: [1.60, 1.35] },
  { key: "soccer_germany_2_bundesliga", name: "2. Bundesliga", apiSportsId: 79, baseXG: [1.55, 1.45] },
  { key: "soccer_spain_la_liga", name: "La Liga", apiSportsId: 140, baseXG: [1.45, 1.20] },
  { key: "soccer_italy_serie_a", name: "Serie A", apiSportsId: 135, baseXG: [1.45, 1.25] },
  { key: "soccer_france_ligue_one", name: "Ligue 1", apiSportsId: 61, baseXG: [1.55, 1.35] },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", apiSportsId: 88, baseXG: [1.70, 1.45] },
  { key: "soccer_turkey_super_league", name: "Turkish Süper Lig", apiSportsId: 203, baseXG: [1.50, 1.40] },
  { key: "soccer_uefa_champs_league", name: "Champions League", apiSportsId: 2, baseXG: [1.50, 1.35] },
];

// -----------------------------
// In-Memory Cache + Persistenz
// -----------------------------
let CACHE = {};
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 Stunden

// 🧠 Cache aus Datei laden
if (fs.existsSync(CACHE_FILE)) {
  try {
    CACHE = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    console.log("💾 Cache aus Datei geladen:", Object.keys(CACHE).length, "Einträge");
  } catch {
    console.warn("⚠️ Konnte Cache-Datei nicht laden, starte frisch.");
  }
}

// 🔒 Cache schreiben (debounced)
let cacheWriteTimeout;
function saveCacheToFile() {
  clearTimeout(cacheWriteTimeout);
  cacheWriteTimeout = setTimeout(() => {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(CACHE, null, 2));
    console.log("💾 Cache gespeichert:", CACHE_FILE);
  }, 2000);
}

function setCache(key, value) {
  CACHE[key] = { data: value, timestamp: Date.now() };
  saveCacheToFile();
}
function getCache(key) {
  const entry = CACHE[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    delete CACHE[key];
    return null;
  }
  return entry.data;
}

// -----------------------------
// Mathematische Hilfsfunktionen
// -----------------------------
function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}
function poisson(k, lambda) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}
function computeMatchProb(homeXG, awayXG, maxGoals = 5) {
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
function bttsProbExact(homeXG, awayXG, maxGoals = 5) {
  let p = 0;
  for (let h = 1; h <= maxGoals; h++) {
    for (let a = 1; a <= maxGoals; a++) {
      p += poisson(h, homeXG) * poisson(a, awayXG);
    }
  }
  return p;
}

// -----------------------------
// API-Football (mit persistierendem Cache)
// -----------------------------
async function getTeamIdByName(teamName) {
  const key = `teamid_${teamName.toLowerCase()}`;
  const cached = getCache(key);
  if (cached) return cached;

  const url = `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(teamName)}`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_SPORTS_KEY } });
  if (!res.ok) return null;
  const data = await res.json();
  const team = data.response?.[0];
  if (team) setCache(key, team.team.id);
  return team?.team?.id;
}

async function fetchTeamStats(teamId, leagueId, season = 2024) {
  const key = `teamstats_${teamId}_${leagueId}_${season}`;
  const cached = getCache(key);
  if (cached) return cached;

  const url = `https://v3.football.api-sports.io/teams/statistics?league=${leagueId}&season=${season}&team=${teamId}`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_SPORTS_KEY } });
  if (!res.ok) return { xGFor: 1.5, xGAgainst: 1.3, played: 1 };
  const data = await res.json();

  const stats = {
    xGFor: data.response?.expected?.goals?.for?.total || 0,
    xGAgainst: data.response?.expected?.goals?.against?.total || 0,
    played: data.response?.fixtures?.played?.total || 1,
  };
  setCache(key, stats);
  return stats;
}

async function fetchTeamFormFactor(teamId, leagueId, season = 2024, n = 10) {
  const key = `form_${teamId}_${leagueId}_${n}`;
  const cached = getCache(key);
  if (cached) return cached;

  const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&team=${teamId}&last=${n}`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_SPORTS_KEY } });
  if (!res.ok) return 1.0;

  const data = await res.json();
  const matches = data.response || [];
  if (!matches.length) return 1.0;

  let points = 0;
  for (const m of matches) {
    const isHome = m.teams.home.id === teamId;
    const goalsFor = isHome ? m.goals.home : m.goals.away;
    const goalsAgainst = isHome ? m.goals.away : m.goals.home;
    if (goalsFor > goalsAgainst) points += 3;
    else if (goalsFor === goalsAgainst) points += 1;
  }

  const formPoints = points / (matches.length * 3);
  const formFactor = 0.9 + formPoints * 0.2;
  setCache(key, formFactor);
  return formFactor;
}

// -----------------------------
// API /api/games
// -----------------------------
app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  const leaguesParam = req.query.leagues ? req.query.leagues.split(",") : LEAGUES.map(l => l.key);
  const cacheKey = `games_${date}_${leaguesParam.join(",")}`;

  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  const games = [];

  for (const league of LEAGUES.filter(l => leaguesParam.includes(l.key))) {
    try {
      const oddsUrl = `https://api.the-odds-api.com/v4/sports/${league.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
      const response = await fetch(oddsUrl);
      if (!response.ok) continue;
      const data = await response.json();

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
        const inv = { home: 1 / odds.home, draw: 1 / odds.draw, away: 1 / odds.away };
        const sumInv = inv.home + inv.draw + inv.away;
        const fair = { home: inv.home / sumInv, draw: inv.draw / sumInv, away: inv.away / sumInv };

        // xG Berechnung
        const homeId = await getTeamIdByName(home);
        const awayId = await getTeamIdByName(away);

        let homeXG = league.baseXG[0];
        let awayXG = league.baseXG[1];

        if (homeId && awayId) {
          const [homeStats, awayStats, homeForm, awayForm] = await Promise.all([
            fetchTeamStats(homeId, league.apiSportsId),
            fetchTeamStats(awayId, league.apiSportsId),
            fetchTeamFormFactor(homeId, league.apiSportsId),
            fetchTeamFormFactor(awayId, league.apiSportsId),
          ]);

          homeXG = ((homeStats.xGFor / homeStats.played + awayStats.xGAgainst / awayStats.played) / 2) * 1.05 * homeForm;
          awayXG = ((awayStats.xGFor / awayStats.played + homeStats.xGAgainst / homeStats.played) / 2) * 0.95 * awayForm;
        }

        const prob = computeMatchProb(homeXG, awayXG);
        prob.over25 = probOver25(homeXG, awayXG);
        prob.btts = bttsProbExact(homeXG, awayXG);

        const value = {
          home: prob.home * odds.home - 1,
          draw: prob.draw * odds.draw - 1,
          away: prob.away * odds.away - 1,
          over25: prob.over25 * odds.over25 - 1,
        };

        games.push({
          home,
          away,
          league: league.name,
          commence_time: g.commence_time,
          odds,
          prob,
          value,
          homeXG: +homeXG.toFixed(2),
          awayXG: +awayXG.toFixed(2),
        });
      }
    } catch (err) {
      console.error(`❌ Fehler in ${league.name}:`, err.message);
    }
  }

  const response = { response: games };
  setCache(cacheKey, response);
  res.json(response);
});

// -----------------------------
// Static + Start
// -----------------------------
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
