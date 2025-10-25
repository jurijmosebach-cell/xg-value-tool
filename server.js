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
if (!ODDS_API_KEY) console.error("❌ ODDS_API_KEY fehlt!");

const PORT = process.env.PORT || 10000;

const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", flag: "gb" },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", flag: "de" },
  { key: "soccer_spain_la_liga", name: "La Liga", flag: "es" },
  { key: "soccer_italy_serie_a", name: "Serie A", flag: "it" },
  { key: "soccer_france_ligue_one", name: "Ligue 1", flag: "fr" },
  { key: "soccer_usa_mls", name: "MLS", flag: "us" },
];

function getFlag(team) {
  const flags = { England: "gb", Germany: "de", Spain: "es", Italy: "it", France: "fr", USA: "us" };
  for (const [country, flag] of Object.entries(flags)) if (team.includes(country)) return flag;
  return "eu";
}

app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  const games = [];

  for (const league of LEAGUES) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${league.key}/odds`;
      const fullUrl = `${url}?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&dateFormat=iso&oddsFormat=decimal`;

      const response = await fetch(fullUrl);
      if (!response.ok) continue;

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

        const odds = {
          home: h2h.find(o => o.name === home)?.price || 1,
          draw: h2h.find(o => o.name === "Draw")?.price || 1,
          away: h2h.find(o => o.name === away)?.price || 1,
          over25: totals.find(o => o.name === "Over" && o.point === 2.5)?.price || 1,
        };

        const homeXG = 1.6 + Math.random() * 0.6;
        const awayXG = 1.3 + Math.random() * 0.5;
        const totalXG = homeXG + awayXG;

        const prob = {
          home: homeXG / totalXG,
          away: awayXG / totalXG,
          draw: 1 - (homeXG / totalXG + awayXG / totalXG),
          over25: 0.55 + Math.random() * 0.15,
        };

        const value = {
          home: odds.home ? (prob.home * odds.home - 1) : 0,
          draw: odds.draw ? (prob.draw * odds.draw - 1) : 0,
          away: odds.away ? (prob.away * odds.away - 1) : 0,
          over25: odds.over25 ? (prob.over25 * odds.over25 - 1) : 0,
        };

        games.push({
          home,
          away,
          league: league.name,
          homeLogo: `https://flagcdn.com/48x36/${getFlag(home)}.png`,
          awayLogo: `https://flagcdn.com/48x36/${getFlag(away)}.png`,
          odds,
          value,
          totalXG: +totalXG.toFixed(2),
          homeXG: +homeXG.toFixed(2),
          awayXG: +awayXG.toFixed(2),
        });
      }
    } catch (err) {
      console.error(`Fehler ${league.name}:`, err.message);
    }
  }

  const topGames = games
    .map(g => ({ ...g, maxValue: Math.max(g.value.home, g.value.draw, g.value.away, g.value.over25) }))
    .sort((a,b) => b.maxValue - a.maxValue)
    .slice(0,7);

  const topFavorites = games
    .map(g => {
      const diff = g.homeXG - g.awayXG;
      const fav = diff > 0.2 ? g.home : diff < -0.2 ? g.away : "Unentschieden";
      const prob = diff > 0.2 ? g.homeXG : diff < -0.2 ? g.awayXG : 0;
      return { ...g, favorite: fav, prob: +prob.toFixed(2) };
    })
    .sort((a,b) => b.prob - a.prob)
    .slice(0,3);

  res.json({ response: games, topGames, topFavorites });
});

app.get("*", (req,res) => res.sendFile(path.join(__dirname,"index.html")));

app.listen(PORT,()=> {
  console.log(`LIVE: https://xg-value-tool.onrender.com`);
  console.log(`Heute: ${new Date().toISOString().slice(0,10)}`);
});
