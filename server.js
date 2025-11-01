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

const SOCCERDATA_KEY = process.env.SOCCERDATA_KEY || "4edc0535a5304abcfd3999fad3e6293d0b02e1a0";
const PORT = process.env.PORT || 10000;

const LEAGUES = [
  { name: "Premier League", oldKey: "soccer_epl" },
  { name: "Bundesliga", oldKey: "soccer_germany_bundesliga" },
  { name: "2. Bundesliga", oldKey: "soccer_germany_2_bundesliga" },
  { name: "La Liga", oldKey: "soccer_spain_la_liga" },
  { name: "Serie A", oldKey: "soccer_italy_serie_a" },
  { name: "Ligue 1", oldKey: "soccer_france_ligue_one" },
  { name: "Eredivisie", oldKey: "soccer_netherlands_eredivisie" },
  { name: "Allsvenskan", oldKey: "soccer_sweden_allsvenskan" },
  { name: "MLS", oldKey: "soccer_usa_mls" },
  { name: "UEFA Europa Conference League", oldKey: "soccer_uefa_europa_conference_league" },
  { name: "UEFA Champions League", oldKey: "soccer_uefa_champs_league" },
  { name: "UEFA Champions League Qualification", oldKey: "soccer_uefa_champs_league_qualification" },
  { name: "Turkey Super League", oldKey: "soccer_turkey_super_league" }
];

// Cache
const CACHE = {};
function cacheKey(date, leagues) {
  return `${date}_${leagues.sort().join(",")}`;
}

// -----------------------------
// Math-Hilfen (Poisson, xG, Score-Matrix, BTTS)
// -----------------------------
const MAX_GOALS = 6;
const factorials = [1];
for (let i = 1; i <= 20; i++) factorials[i] = factorials[i - 1] * i;

function poissonPMF(k, lambda) {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorials[k];
}

function scoreMatrix(lambdaHome, lambdaAway) {
  const mat = [];
  let sum = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    mat[i] = [];
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poissonPMF(i, lambdaHome) * poissonPMF(j, lambdaAway);
      mat[i][j] = p;
      sum += p;
    }
  }
  return { mat, coveredProb: sum };
}

function probTotalLeK(mat, k) {
  let s = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      if (i + j <= k) s += mat[i][j];
    }
  }
  return s;
}

function probsFromMatrix(mat) {
  let ph = 0, pd = 0, pa = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      if (i > j) ph += mat[i][j];
      else if (i === j) pd += mat[i][j];
      else pa += mat[i][j];
    }
  }
  return { home: ph, draw: pd, away: pa };
}

function calcBTTS(lambdaHome, lambdaAway) {
  const p0h = Math.exp(-lambdaHome);
  const p0a = Math.exp(-lambdaAway);
  const p00 = Math.exp(-(lambdaHome + lambdaAway));
  return 1 - p0h - p0a + p00;
}

// -----------------------------
// Hilfsfunktionen SoccerData API
// -----------------------------
async function getAllLeagues() {
  const res = await fetch(`https://api.soccerdataapi.com/league/?auth_token=${SOCCERDATA_KEY}`, {
    headers: { "Accept-Encoding": "gzip", "Content-Type": "application/json" }
  });
  const data = await res.json();
  return data.results || [];
}

async function getMatches(leagueId, date) {
  const res = await fetch(`https://api.soccerdataapi.com/matches/?auth_token=${SOCCERDATA_KEY}&league_id=${leagueId}&date=${date}`, {
    headers: { "Accept-Encoding": "gzip", "Content-Type": "application/json" }
  });
  const data = await res.json();
  return data.results || [];
}

// -----------------------------
// API: /api/games
// -----------------------------
app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  const selectedLeagues = req.query.leagues
    ? req.query.leagues.split(",")
    : LEAGUES.map(l => l.oldKey);

  const cacheId = cacheKey(date, selectedLeagues);
  if (CACHE[cacheId]) return res.json(CACHE[cacheId]);

  const allLeagues = await getAllLeagues();
  const games = [];

  for (const l of LEAGUES.filter(lg => selectedLeagues.includes(lg.oldKey))) {
    const leagueData = allLeagues.find(a => a.name.toLowerCase() === l.name.toLowerCase());
    if (!leagueData) continue;

    const matches = await getMatches(leagueData.id, date);
    for (const g of matches) {
      const home = g.home_team.name;
      const away = g.away_team.name;

      // Simple xG estimate: 1.5 / 1.2 as baseline (can be improved with SoccerData AI predictions)
      const homeXG = g.prediction?.home_xg || 1.5;
      const awayXG = g.prediction?.away_xg || 1.2;

      const { mat } = scoreMatrix(homeXG, awayXG);
      const scoreProbs = probsFromMatrix(mat);
      const probHome = scoreProbs.home;
      const probDraw = scoreProbs.draw;
      const probAway = scoreProbs.away;
      const over25Prob = 1 - probTotalLeK(mat, 2);
      const bttsProb = calcBTTS(homeXG, awayXG);

      games.push({
        home,
        away,
        league: l.name,
        commence_time: g.match_start,
        homeLogo: `https://placehold.co/48x36?text=${encodeURIComponent(home[0] || "H")}`,
        awayLogo: `https://placehold.co/48x36?text=${encodeURIComponent(away[0] || "A")}`,
        prob: {
          home: probHome,
          draw: probDraw,
          away: probAway,
          over25: over25Prob,
          under25: 1 - over25Prob,
          btts: bttsProb
        },
        value: {}, // keine Odds von SoccerData Free, kann leer bleiben
        homeXG: +homeXG.toFixed(2),
        awayXG: +awayXG.toFixed(2),
        totalXG: +(homeXG + awayXG).toFixed(2)
      });
    }
  }

  const result = { response: games };
  CACHE[cacheId] = result;
  res.json(result);
});

// -----------------------------
// Static + Start
// -----------------------------
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
