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
if (!ODDS_API_KEY) console.error("⚠️ FEHLER: ODDS_API_KEY fehlt!");

const PORT = process.env.PORT || 10000;

// -----------------------------
// ⚽ LEAGUES
// -----------------------------
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", baseXG: [1.55, 1.25] },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", baseXG: [1.60, 1.35] },
  { key: "soccer_germany_2_bundesliga", name: "2. Bundesliga", baseXG: [1.55, 1.45] },
  { key: "soccer_spain_la_liga", name: "La Liga", baseXG: [1.45, 1.20] },
  { key: "soccer_italy_serie_a", name: "Serie A", baseXG: [1.45, 1.25] },
  { key: "soccer_france_ligue_one", name: "Ligue 1", baseXG: [1.55, 1.35] },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", baseXG: [1.70, 1.45] },
  { key: "soccer_turkey_super_league", name: "Turkey Super League", baseXG: [1.55, 1.40] },
  { key: "soccer_uefa_champs_league", name: "Champions League", baseXG: [1.65, 1.45] },
  { key: "soccer_uefa_europa_conference_league", name: "Europa Conference League", baseXG: [1.55, 1.40] },
  { key: "soccer_uefa_champs_league_qualification", name: "Champions League Qualification", baseXG: [1.55, 1.40] },
  { key: "soccer_usa_mls", name: "Major League Soccer", baseXG: [1.70, 1.50] },
];

// -----------------------------
// Cache
// -----------------------------
const CACHE = {};
const cacheKey = (date, leagues) => `${date}_${leagues.sort().join(",")}`;

// -----------------------------
// Mathematische Hilfsfunktionen
// -----------------------------
const MAX_GOALS = 6;
const factorials = [1];
for (let i = 1; i <= 20; i++) factorials[i] = factorials[i - 1] * i;

const poissonPMF = (k, λ) => Math.exp(-λ) * Math.pow(λ, k) / factorials[k];

function scoreMatrix(homeXG, awayXG) {
  const mat = [];
  let sum = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    mat[i] = [];
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poissonPMF(i, homeXG) * poissonPMF(j, awayXG);
      mat[i][j] = p;
      sum += p;
    }
  }
  return { mat, sum };
}

function probsFromMatrix(mat) {
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      if (i > j) home += mat[i][j];
      else if (i === j) draw += mat[i][j];
      else away += mat[i][j];
    }
  }
  const total = home + draw + away;
  return { home: home / total, draw: draw / total, away: away / total };
}

function calcBTTS(homeXG, awayXG) {
  const p0h = Math.exp(-homeXG);
  const p0a = Math.exp(-awayXG);
  const p00 = Math.exp(-(homeXG + awayXG));
  return 1 - p0h - p0a + p00;
}

const probTotalLeK = (mat, k) => {
  let s = 0;
  for (let i = 0; i <= MAX_GOALS; i++)
    for (let j = 0; j <= MAX_GOALS; j++)
      if (i + j <= k) s += mat[i][j];
  return s;
};

// -----------------------------
// API Endpoint
// -----------------------------
app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  const leagues = req.query.leagues
    ? req.query.leagues.split(",")
    : LEAGUES.map(l => l.key);

  const cacheId = cacheKey(date, leagues);
  if (CACHE[cacheId]) {
    console.log("Cache-Treffer:", cacheId);
    return res.json(CACHE[cacheId]);
  }

  const games = [];

  for (const league of LEAGUES.filter(l => leagues.includes(l.key))) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${league.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals,bothteams_to_score&oddsFormat=decimal&dateFormat=iso`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const data = await r.json();
      if (!Array.isArray(data)) continue;

      for (const g of data) {
        if (!g.commence_time?.startsWith(date)) continue;

        const book = g.bookmakers?.[0];
        if (!book) continue;

        const home = g.home_team;
        const away = g.away_team;
        const h2h = book.markets.find(m => m.key === "h2h")?.outcomes || [];
        const totals = book.markets.find(m => m.key === "totals")?.outcomes || [];
        const bttsMarket = book.markets.find(m => m.key === "bothteams_to_score")?.outcomes || [];

        const odds = {
          home: h2h.find(o => o.name === home)?.price || 0,
          draw: h2h.find(o => o.name === "Draw")?.price || 0,
          away: h2h.find(o => o.name === away)?.price || 0,
          over25: totals.find(o => o.name === "Over" && o.point === 2.5)?.price || 0,
          under25: totals.find(o => o.name === "Under" && o.point === 2.5)?.price || 0,
          bttsYes: bttsMarket.find(o => /yes/i.test(o.name))?.price || 0,
          bttsNo: bttsMarket.find(o => /no/i.test(o.name))?.price || 0,
        };

        if (!odds.home || !odds.away) continue;

        const impliedHome = 1 / odds.home;
        const impliedAway = 1 / odds.away;
        const ratio = impliedHome / (impliedHome + impliedAway);

        const homeXG = league.baseXG[0] + (ratio - 0.5) * 0.9;
        const awayXG = league.baseXG[1] - (ratio - 0.5) * 0.9;

        const { mat } = scoreMatrix(homeXG, awayXG);
        const probs = probsFromMatrix(mat);
        const over25 = 1 - probTotalLeK(mat, 2);
        const btts = calcBTTS(homeXG, awayXG);

        const value = {
          home: probs.home * odds.home - 1,
          draw: probs.draw * odds.draw - 1,
          away: probs.away * odds.away - 1,
          over25: over25 * odds.over25 - 1,
          btts: btts * odds.bttsYes - 1,
        };

        const best = Object.entries(value).sort((a, b) => b[1] - a[1])[0];
        const tendenz =
          probs.home > probs.away && probs.home > probs.draw
            ? "Heimsieg"
            : probs.away > probs.home && probs.away > probs.draw
            ? "Auswärtssieg"
            : probs.draw > probs.home && probs.draw > probs.away
            ? "Unentschieden"
            : over25 > 0.55
            ? "Over 2.5"
            : btts > 0.55
            ? "BTTS"
            : "Ausgeglichen";

        games.push({
          home,
          away,
          league: league.name,
          commence_time: g.commence_time,
          odds,
          probs,
          over25,
          btts,
          value,
          bestMarket: best[0],
          bestValue: best[1],
          homeXG: +homeXG.toFixed(2),
          awayXG: +awayXG.toFixed(2),
          tendenz,
        });
      }
    } catch (e) {
      console.warn(`Fehler ${league.name}:`, e.message);
    }
  }

  const top = (key, n = 5) =>
    [...games].sort((a, b) => b[key] - a[key]).slice(0, n);

  const result = {
    response: games,
    top7: [...games].sort((a, b) => (b.probs.home + b.probs.draw + b.probs.away) - (a.probs.home + a.probs.draw + a.probs.away)).slice(0, 7),
    topByValue: {
      home: top("value.home"),
      draw: top("value.draw"),
      away: top("value.away"),
      over25: top("value.over25"),
      btts: top("value.btts"),
    },
    topOver25: top("over25", 5),
    topBTTS: top("btts", 5),
  };

  CACHE[cacheId] = result;
  res.json(result);
});

// -----------------------------
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);
app.listen(PORT, () =>
  console.log(`✅ Server läuft auf Port ${PORT}`)
);
