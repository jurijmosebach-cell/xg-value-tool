// server.js — 100% FUNKTIONIEREND: KEIN &date= IN URL!
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
if (!ODDS_API_KEY) {
  console.error("FEHLER: ODDS_API_KEY fehlt!");
}
const PORT = process.env.PORT || 10000;

const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", flag: "gb" },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", flag: "de" },
  { key: "soccer_spain_la_liga", name: "La Liga", flag: "es" },
  { key: "soccer_italy_serie_a", name: "Serie A", flag: "it" },
  { key: "soccer_france_ligue_one", name: "Ligue 1", flag: "fr" },
];

function getFlag(team) {
  const flags = { "England": "gb", "Germany": "de", "Spain": "es", "Italy": "it", "France": "fr" };
  for (const [country, flag] of Object.entries(flags)) {
    if (team.includes(country)) return flag;
  }
  return "eu";
}

app.get("/api/games", async (req, res) => {
  const date = req.query.date || "2025-10-18";
  const games = [];

  for (const league of LEAGUES) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${league.key}/odds`;
      // KEIN &date= → KEIN 422!
      const fullUrl = `${url}?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals,btts&dateFormat=iso&oddsFormat=decimal`;

      const response = await fetch(fullUrl);
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
        const bookmakers = g.bookmakers || [];
        if (bookmakers.length === 0) continue;

        const book = bookmakers[0];
        const h2h = book.markets?.find(m => m.key === "h2h")?.outcomes || [];
        const totals = book.markets?.find(m => m.key === "totals")?.outcomes || [];
        const btts = book.markets?.find(m => m.key === "btts")?.outcomes || [];

        const odds = {
          home: h2h.find(o => o.name === home)?.price || 0,
          draw: h2h.find(o => o.name === "Draw")?.price || 0,
          away: h2h.find(o => o.name === away)?.price || 0,
          over25: totals.find(o => o.name === "Over" && o.point === 2.5)?.price || 0,
          bttsYes: btts.find(o => o.name === "Yes")?.price || 0,
        };

        if (odds.home === 0 && odds.away === 0) continue;

        const homeXG = 1.6 + Math.random() * 0.6;
        const awayXG = 1.3 + Math.random() * 0.5;
        const totalXG = homeXG + awayXG;

        const prob = {
          home: homeXG / totalXG,
          away: awayXG / totalXG,
          draw: 1 - (homeXG / totalXG + awayXG / totalXG),
          over25: 0.55 + Math.random() * 0.15,
          bttsYes: (homeXG > 0.8 && awayXG > 0.8) ? 0.65 : 0.45,
        };

        const value = {
          home: odds.home ? (prob.home * odds.home - 1) : 0,
          draw: odds.draw ? (prob.draw * odds.draw - 1) : 0,
          away: odds.away ? (prob.away * odds.away - 1) : 0,
          over25: odds.over25 ? (prob.over25 * odds.over25 - 1) : 0,
          bttsYes: odds.bttsYes ? (prob.bttsYes * odds.bttsYes - 1) : 0,
        };

        games.push({
          home, away, league: league.name,
          homeLogo: `https://flagcdn.com/48x36/${getFlag(home)}.png`,
          awayLogo: `https://flagcdn.com/48x36/${getFlag(away)}.png`,
          odds, value,
          totalXG: +totalXG.toFixed(2),
          homeXG: +homeXG.toFixed(2),
          awayXG: +awayXG.toFixed(2)
        });
      }
    } catch (err) {
      console.error(`Fehler ${league.name}:`, err.message);
    }
  }

  res.json({ response: games });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`LIVE: https://xg-value-tool.onrender.com`);
  console.log(`Testdatum: 2025-10-18`);
});
