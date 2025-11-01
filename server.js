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
const SOCCERDATA_KEY = "4edc0535a5304abcfd3999fad3e6293d0b02e1a0";

const PORT = process.env.PORT || 10000;

// -------------------------------------------------
// LEAGUES
// -------------------------------------------------
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", baseXG: [1.55, 1.25] },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", baseXG: [1.60, 1.35] },
  { key: "soccer_spain_la_liga", name: "La Liga", baseXG: [1.45, 1.20] },
  { key: "soccer_italy_serie_a", name: "Serie A", baseXG: [1.45, 1.25] },
  { key: "soccer_france_ligue_one", name: "Ligue 1", baseXG: [1.55, 1.35] },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", baseXG: [1.70, 1.45] },
  { key: "soccer_usa_mls", name: "MLS", baseXG: [1.60, 1.45] },
];

// -------------------------------------------------
// Mathematische Hilfsfunktionen
// -------------------------------------------------
const MAX_GOALS = 6;
const factorials = [1];
for (let i = 1; i <= 20; i++) factorials[i] = factorials[i - 1] * i;

function poissonPMF(k, lambda) {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorials[k];
}

function scoreMatrix(lambdaHome, lambdaAway) {
  const mat = [];
  for (let i = 0; i <= MAX_GOALS; i++) {
    mat[i] = [];
    for (let j = 0; j <= MAX_GOALS; j++) {
      mat[i][j] = poissonPMF(i, lambdaHome) * poissonPMF(j, lambdaAway);
    }
  }
  return mat;
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
  let pHome = 0, pDraw = 0, pAway = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      if (i > j) pHome += mat[i][j];
      else if (i === j) pDraw += mat[i][j];
      else pAway += mat[i][j];
    }
  }
  const sum = pHome + pDraw + pAway;
  return { home: pHome / sum, draw: pDraw / sum, away: pAway / sum };
}

function calcBTTS(lambdaHome, lambdaAway) {
  const p0h = Math.exp(-lambdaHome);
  const p0a = Math.exp(-lambdaAway);
  return 1 - p0h - p0a + Math.exp(-(lambdaHome + lambdaAway));
}

// -------------------------------------------------
// 1️⃣ Hole Spiele aus SoccerData
// -------------------------------------------------
async function getSoccerDataMatches() {
  try {
    const res = await fetch(
      `https://api.soccerdataapi.com/livescores/?auth_token=${SOCCERDATA_KEY}`,
      { headers: { "Content-Type": "application/json", "Accept-Encoding": "gzip" } }
    );
    const data = await res.json();
    if (!data.results || data.results.length === 0) return [];

    return data.results
      .filter(m => m.home && m.away)
      .map(m => ({
        home: m.home?.name || "Home",
        away: m.away?.name || "Away",
        league: m.competition?.name || "Unknown",
        commence_time: m.time?.starting_at || new Date().toISOString(),
      }));
  } catch (err) {
    console.warn("⚠️ SoccerData fehlgeschlagen:", err.message);
    return [];
  }
}

// -------------------------------------------------
// 2️⃣ Hole Spiele aus TheOddsAPI (Fallback)
// -------------------------------------------------
async function getOddsAPIMatches() {
  const today = new Date().toISOString().slice(0, 10);
  const games = [];

  for (const league of LEAGUES) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${league.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();

      for (const g of data) {
        if (!g.commence_time?.startsWith(today)) continue;
        const homeTeam = g.home_team;
        const awayTeam = g.away_team;
        const book = g.bookmakers?.[0];
        if (!book) continue;

        const h2h = book.markets?.find(m => m.key === "h2h")?.outcomes || [];
        const totals = book.markets?.find(m => m.key === "totals")?.outcomes || [];

        const odds = {
          home: h2h.find(o => o.name === homeTeam)?.price || 0,
          draw: h2h.find(o => o.name === "Draw")?.price || 0,
          away: h2h.find(o => o.name === awayTeam)?.price || 0,
          over25: totals.find(o => o.name === "Over" && o.point === 2.5)?.price || 0,
          under25: totals.find(o => o.name === "Under" && o.point === 2.5)?.price || 0,
        };
        if (!odds.home || !odds.away) continue;

        const impliedHome = 1 / odds.home;
        const impliedAway = 1 / odds.away;
        const ratio = impliedHome / (impliedHome + impliedAway);

        const baseHome = league.baseXG[0];
        const baseAway = league.baseXG[1];
        const homeXG = Math.max(0.1, baseHome + (ratio - 0.5) * 0.8);
        const awayXG = Math.max(0.1, baseAway - (ratio - 0.5) * 0.8);

        const mat = scoreMatrix(homeXG, awayXG);
        const { home, draw, away } = probsFromMatrix(mat);
        const over25 = 1 - probTotalLeK(mat, 2);
        const btts = calcBTTS(homeXG, awayXG);

        const value = {
          home: odds.home * home - 1,
          draw: odds.draw * draw - 1,
          away: odds.away * away - 1,
          over25: odds.over25 * over25 - 1,
          under25: odds.under25 * (1 - over25) - 1,
          btts,
        };

        games.push({
          home: homeTeam,
          away: awayTeam,
          league: league.name,
          commence_time: g.commence_time,
          odds,
          prob: { home, draw, away, over25, btts },
          value,
          homeXG,
          awayXG,
        });
      }
    } catch (e) {
      console.warn(`⚠️ Fehler bei ${league.name}:`, e.message);
    }
  }

  return games;
}

// -------------------------------------------------
// 3️⃣ API-Endpoint
// -------------------------------------------------
app.get("/api/games", async (req, res) => {
  let games = await getSoccerDataMatches();
  if (games.length === 0) {
    console.log("ℹ️ Keine Spiele bei SoccerData – wechsle zu TheOddsAPI");
    games = await getOddsAPIMatches();
  }

  if (!games.length) {
    return res.json({ response: [], message: "Keine Spiele gefunden." });
  }

  const top7 = games.slice(0, 7);
  const topOver = [...games].sort((a, b) => (b.prob?.over25 || 0) - (a.prob?.over25 || 0)).slice(0, 5);
  const topBTTS = [...games].sort((a, b) => (b.prob?.btts || 0) - (a.prob?.btts || 0)).slice(0, 5);

  res.json({ response: games, top7, topOver, topBTTS });
});

// -------------------------------------------------
// Static + Start
// -------------------------------------------------
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
