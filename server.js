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
// Ligen
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
  { key: "soccer_turkey_super_league", name: "Turkish Süper Lig", baseXG: [1.50, 1.40] },
  { key: "soccer_usa_mls", name: "MLS", baseXG: [1.50, 1.40] },
  { key: "soccer_uefa_champs_league", name: "UEFA Champions League", baseXG: [1.50, 1.35] },
  { key: "soccer_uefa_europa_conference_league", name: "UEFA Europa Conference League", baseXG: [1.45, 1.25] },
  { key: "soccer_uefa_champs_league_qualification", name: "Champions League Qualification", baseXG: [1.40, 1.25] },
];

// -----------------------------
// Cache
// -----------------------------
const CACHE = {};
function cacheKey(date, leagues) {
  return `${date}_${leagues.sort().join(",")}`;
}

// -----------------------------
// Hilfsfunktionen
// -----------------------------
function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

// Poisson Wahrscheinlichkeit für k Tore
function poisson(k, lambda) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// Exakte Match-Wahrscheinlichkeit für 1X2
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

// Exakte BTTS Wahrscheinlichkeit
function bttsProbExact(homeXG, awayXG, maxGoals = 5) {
  let p = 0;
  for (let h = 1; h <= maxGoals; h++) {
    for (let a = 1; a <= maxGoals; a++) {
      p += poisson(h, homeXG) * poisson(a, awayXG);
    }
  }
  return p;
}

// Poisson Wahrscheinlichkeit für Over 2.5 Tore
function probOver25(homeXG, awayXG, maxGoals = 5) {
  let p = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      if (h + a > 2) p += poisson(h, homeXG) * poisson(a, awayXG);
    }
  }
  return p;
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
    console.log("Cache-Treffer:", cacheId);
    return res.json(CACHE[cacheId]);
  }

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
        };
        if (!odds.home || !odds.away) continue;

        // xG Berechnung
        const baseHome = league.baseXG[0];
        const baseAway = league.baseXG[1];
        const impliedHome = 1 / odds.home;
        const impliedAway = 1 / odds.away;
        const ratio = impliedHome / (impliedHome + impliedAway);
        const homeXG = Math.max(0.1, baseHome + (ratio - 0.5) * 0.8);
        const awayXG = Math.max(0.05, baseAway - (ratio - 0.5) * 0.8);

        // Exakte Wahrscheinlichkeiten
        const prob = computeMatchProb(homeXG, awayXG);
        prob.over25 = probOver25(homeXG, awayXG);
        prob.btts = bttsProbExact(homeXG, awayXG);

        // Value-Berechnung
        const value = {
          home: prob.home * odds.home - 1,
          draw: prob.draw * odds.draw - 1,
          away: prob.away * odds.away - 1,
          over25: prob.over25 * odds.over25 - 1,
          btts: prob.btts * odds.over25 - 1, // optional: korrigieren nach Wettmarkt
        };

        games.push({
          home,
          away,
          league: league.name,
          homeLogo: `https://placehold.co/48x36?text=${home[0]}`,
          awayLogo: `https://placehold.co/48x36?text=${away[0]}`,
          odds,
          prob,
          value,
          homeXG: +homeXG.toFixed(2),
          awayXG: +awayXG.toFixed(2),
          totalXG: +(homeXG + awayXG).toFixed(2),
        });
      }
    } catch (err) {
      console.error(`Fehler ${league.name}:`, err.message);
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
