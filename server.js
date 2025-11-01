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
if (!ODDS_API_KEY) console.error("FEHLER: ODDS_API_KEY fehlt!");

const PORT = process.env.PORT || 10000;

// -----------------------------
// Ligen mit Basis-xG
// -----------------------------
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", baseXG: [1.55, 1.25] },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", baseXG: [1.60, 1.35] },
  { key: "soccer_germany_2_bundesliga", name: "2. Bundesliga", baseXG: [1.55, 1.45] },
  { key: "soccer_spain_la_liga", name: "La Liga", baseXG: [1.45, 1.20] },
  { key: "soccer_italy_serie_a", name: "Serie A", baseXG: [1.45, 1.25] },
  { key: "soccer_france_ligue_one", name: "Ligue 1", baseXG: [1.55, 1.35] },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", baseXG: [1.70, 1.45] },
  { key: "soccer_sweden_allsvenskan", name: "Allsvenskan", baseXG: [1.55, 1.45] },
  { key: "soccer_turkey_super_league", name: "Turkey Super League", baseXG: [1.55, 1.35] },
  { key: "soccer_uefa_europa_conference_league", name: "UEFA Europa Conference League", baseXG: [1.40, 1.20] },
  { key: "soccer_uefa_champs_league", name: "UEFA Champions League", baseXG: [1.50, 1.30] },
  { key: "soccer_uefa_champs_league_qualification", name: "Champions League Qualification", baseXG: [1.45, 1.25] },
  { key: "soccer_usa_mls", name: "Major League Soccer (MLS)", baseXG: [1.55, 1.40] },
];

// -----------------------------
// Cache
// -----------------------------
const CACHE = {};
function cacheKey(date, leagues) {
  return `${date}_${leagues.sort().join(",")}`;
}

// -----------------------------
// Poisson & xG Hilfen
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
// API: /api/games
// -----------------------------
app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  const leaguesParam = req.query.leagues
    ? req.query.leagues.split(",")
    : LEAGUES.map(l => l.key);

  const cacheId = cacheKey(date, leaguesParam);
  if (CACHE[cacheId]) return res.json(CACHE[cacheId]);

  const games = [];

  for (const league of LEAGUES.filter(l => leaguesParam.includes(l.key))) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${league.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
      const response = await fetch(url);
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
          under25: totals.find(o => o.name === "Under" && o.point === 2.5)?.price || 0,
        };
        if (!odds.home || !odds.away) continue;

        const baseHome = league.baseXG[0];
        const baseAway = league.baseXG[1];

        const impliedHome = 1 / odds.home;
        const impliedAway = 1 / odds.away;
        const ratio = impliedHome / (impliedHome + impliedAway);

        const homeXG = Math.max(0.1, baseHome + (ratio - 0.5) * 0.9);
        const awayXG = Math.max(0.05, baseAway - (ratio - 0.5) * 0.9);

        const { mat } = scoreMatrix(homeXG, awayXG);
        const scoreProbs = probsFromMatrix(mat);
        const homeProb = scoreProbs.home;
        const drawProb = scoreProbs.draw;
        const awayProb = scoreProbs.away;
        const over25Prob = 1 - probTotalLeK(mat, 2);
        const bttsProb = calcBTTS(homeXG, awayXG);

        const sum1x2 = homeProb + drawProb + awayProb;
        const prob = {
          home: homeProb / sum1x2,
          draw: drawProb / sum1x2,
          away: awayProb / sum1x2,
          over25: over25Prob,
          under25: 1 - over25Prob,
          btts: bttsProb,
        };

        const value = {
          home: prob.home * odds.home - 1,
          draw: prob.draw * odds.draw - 1,
          away: prob.away * odds.away - 1,
          over25: prob.over25 * odds.over25 - 1,
          under25: prob.under25 * odds.under25 - 1,
          btts: 0,
        };

        const bttsMarket = book.markets?.find(m => m.key === "bothteams_to_score");
        if (bttsMarket) {
          const outcomeYes = bttsMarket.outcomes.find(o => /yes/i.test(o.name));
          if (outcomeYes && outcomeYes.price) value.btts = prob.btts * outcomeYes.price - 1;
        }

        const valueEntries = [
          { key: "home", val: value.home },
          { key: "draw", val: value.draw },
          { key: "away", val: value.away },
          { key: "over25", val: value.over25 },
          { key: "under25", val: value.under25 },
          { key: "btts", val: value.btts },
        ].sort((a, b) => b.val - a.val);
        const bestValue = valueEntries[0];
        const isValue = bestValue.val > 0;

        games.push({
          home,
          away,
          league: league.name,
          commence_time: g.commence_time,
          homeLogo: `https://placehold.co/48x36?text=${encodeURIComponent(home[0]||"H")}`,
          awayLogo: `https://placehold.co/48x36?text=${encodeURIComponent(away[0]||"A")}`,
          odds,
          prob,
          value,
          bestValueMarket: bestValue.key,
          bestValueAmount: +bestValue.val.toFixed(4),
          isValue,
          homeXG: +homeXG.toFixed(2),
          awayXG: +awayXG.toFixed(2),
          totalXG: +(homeXG + awayXG).toFixed(2),
        });
      }
    } catch (err) {
      console.error(`Fehler ${league.name}:`, err.message);
    }
  }

  // -----------------------------
  // Top-Listen
  // -----------------------------
  function topNByProb(arr, keyPath, n = 5) {
    const [root, sub] = keyPath.split(".");
    return [...arr]
      .filter(g => g[root] && typeof g[root][sub] === "number")
      .sort((a, b) => b[root][sub] - a[root][sub])
      .slice(0, n);
  }

  function topNByValue(arr, marketKey, n = 5) {
    return [...arr]
      .filter(g => typeof g.value[marketKey] === "number")
      .sort((a, b) => b.value[marketKey] - a.value[marketKey])
      .slice(0, n);
  }

  const result = {
    response: games,
    topByProb: {
      home: topNByProb(games, "prob.home"),
      draw: topNByProb(games, "prob.draw"),
      over25: topNByProb(games, "prob.over25"),
      btts: topNByProb(games, "prob.btts"),
    },
    topByValue: {
      home: topNByValue(games, "home"),
      draw: topNByValue(games, "draw"),
      over25: topNByValue(games, "over25"),
      btts: topNByValue(games, "btts"),
    },
  };

  CACHE[cacheId] = result;
  res.json(result);
});

// -----------------------------
// Static + Start
// -----------------------------
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
