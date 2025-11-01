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

const SOCCERDATA_KEY = "4edc0535a5304abcfd3999fad3e6293d0b02e1a0"; // dein Key
const PORT = process.env.PORT || 10000;

// -----------------------------
// Ligen mit SoccerData league_id
// -----------------------------
const LEAGUES = [
  { name: "Premier League", league_id: 39, baseXG: [1.55, 1.25] },
  { name: "Bundesliga", league_id: 78, baseXG: [1.60, 1.35] },
  { name: "2. Bundesliga", league_id: 79, baseXG: [1.55, 1.45] },
  { name: "La Liga", league_id: 140, baseXG: [1.45, 1.20] },
  { name: "Serie A", league_id: 135, baseXG: [1.45, 1.25] },
  { name: "Ligue 1", league_id: 61, baseXG: [1.55, 1.35] },
  { name: "Eredivisie", league_id: 88, baseXG: [1.70, 1.45] },
  { name: "Allsvenskan", league_id: 132, baseXG: [1.55, 1.45] },
  { name: "MLS", league_id: 168, baseXG: [1.45, 1.25] },
  { name: "Europa Conference League", league_id: 198, baseXG: [1.35, 1.35] },
  { name: "UEFA Champions League", league_id: 196, baseXG: [1.45, 1.45] },
  { name: "UEFA Champions League Qualification", league_id: 195, baseXG: [1.20, 1.20] },
  { name: "Turkey Super League", league_id: 130, baseXG: [1.55, 1.35] },
];

// -----------------------------
// Cache
// -----------------------------
const CACHE = {};
function cacheKey(date, leagues) {
  return `${date}_${leagues.map(l => l.league_id).sort().join(",")}`;
}

// -----------------------------
// Helper: fetch JSON safely
// -----------------------------
async function fetchJSON(url) {
  try {
    const res = await fetch(url, {
      headers: { "Accept-Encoding": "gzip", "Content-Type": "application/json" },
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error("Fehler: Response kein JSON, URL:", url);
      console.log("Response Vorschau:", text.slice(0, 500));
      return null;
    }
  } catch (err) {
    console.error("Fetch-Fehler:", err.message, "URL:", url);
    return null;
  }
}

// -----------------------------
// API: /api/games
// -----------------------------
app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  const leaguesParam = req.query.leagues
    ? req.query.leagues.split(",").map(l => LEAGUES.find(ll => ll.name === l)).filter(Boolean)
    : LEAGUES;

  const cacheId = cacheKey(date, leaguesParam);
  if (CACHE[cacheId]) return res.json(CACHE[cacheId]);

  const games = [];

  for (const league of leaguesParam) {
    const url = `https://api.soccerdataapi.com/matches/?league_id=${league.league_id}&date=${date}&auth_token=${SOCCERDATA_KEY}`;
    const data = await fetchJSON(url);
    if (!data || !data.results) continue;

    for (const g of data.results) {
      const home = g.home_team?.name || g.home_team;
      const away = g.away_team?.name || g.away_team;
      if (!home || !away) continue;

      const homeXG = league.baseXG[0];
      const awayXG = league.baseXG[1];
      const totalXG = homeXG + awayXG;

      // einfache Poisson-Berechnung
      const probHome = homeXG / totalXG;
      const probAway = awayXG / totalXG;
      const probDraw = 1 - (probHome + probAway);
      const probOver25 = totalXG > 2.5 ? 0.7 : 0.3; // Dummy Over/Under
      const probBTTS = 0.6; // Dummy BTTS

      const odds = { home: 2, draw: 3, away: 2.5, over25: 1.9, under25: 1.9 }; // Dummy Odds
      const value = {
        home: probHome * odds.home - 1,
        draw: probDraw * odds.draw - 1,
        away: probAway * odds.away - 1,
        over25: probOver25 * odds.over25 - 1,
        under25: (1 - probOver25) * odds.under25 - 1,
        btts: probBTTS * 1.9 - 1,
      };

      const bestValue = Object.entries(value).sort((a, b) => b[1] - a[1])[0];

      games.push({
        home,
        away,
        league: league.name,
        commence_time: g.commence_time,
        homeLogo: `https://placehold.co/48x36?text=${home[0]}`,
        awayLogo: `https://placehold.co/48x36?text=${away[0]}`,
        odds,
        prob: { home: probHome, draw: probDraw, away: probAway, over25: probOver25, under25: 1 - probOver25, btts: probBTTS },
        value,
        bestValueMarket: bestValue[0],
        bestValueAmount: +bestValue[1].toFixed(2),
        isValue: bestValue[1] > 0,
        homeXG,
        awayXG,
        totalXG,
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
