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
// LEAGUES
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
];

// -----------------------------
// Cache (um API-Aufrufe zu sparen)
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

// Wahrscheinlichkeit, dass ≤k Tore fallen
function poissonProb(k, λ1, λ2) {
  const e = Math.exp(-(λ1 + λ2));
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    for (let j = 0; j <= k - i; j++) {
      sum += (Math.pow(λ1, i) * Math.pow(λ2, j)) / (factorial(i) * factorial(j));
    }
  }
  return e * sum;
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
  if (CACHE[cacheId]) {
    console.log("Cache-Treffer:", cacheId);
    return res.json({ response: CACHE[cacheId] });
  }

  const games = [];
  for (const league of LEAGUES.filter(l => leaguesParam.includes(l.key))) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${league.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`HTTP ${response.status} für ${league.name}`);
        continue;
      }
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

        // Realistischere xG-Berechnung basierend auf Quoten
        const baseHome = league.baseXG[0];
        const baseAway = league.baseXG[1];
        const impliedHome = 1 / odds.home;
        const impliedAway = 1 / odds.away;
        const ratio = impliedHome / (impliedHome + impliedAway);
        const homeXG = baseHome + (ratio - 0.5) * 0.8;
        const awayXG = baseAway - (ratio - 0.5) * 0.8;

        // Wahrscheinlichkeiten (Poisson-basiert)
        const probOver25 = 1 - poissonProb(2, homeXG, awayXG);
        const probUnder25 = 1 - probOver25;
        const probBTTS = 1 - (Math.exp(-homeXG) + Math.exp(-awayXG) - Math.exp(-(homeXG + awayXG)));

        const totalXG = homeXG + awayXG;
        const probHome = homeXG / totalXG;
        const probAway = awayXG / totalXG;
        const probDraw = 1 - (probHome + probAway);

        const prob = { home: probHome, draw: probDraw, away: probAway, over25: probOver25, under25: probUnder25, btts: probBTTS };
        const value = {
          home: odds.home ? prob.home * odds.home - 1 : 0,
          draw: odds.draw ? prob.draw * odds.draw - 1 : 0,
          away: odds.away ? prob.away * odds.away - 1 : 0,
          over25: odds.over25 ? prob.over25 * odds.over25 - 1 : 0,
          under25: odds.under25 ? prob.under25 * odds.under25 - 1 : 0,
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
          totalXG: +totalXG.toFixed(2),
        });
      }
    } catch (err) {
      console.error(`Fehler ${league.name}:`, err.message);
    }
  }

  CACHE[cacheId] = games; // Cache speichern
  res.json({ response: games });
});

// -----------------------------
// Static + Start
// -----------------------------
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
