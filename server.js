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

const LEAGUES = [
  { key: "soccer_epl", name: "Premier League" },
  { key: "soccer_germany_bundesliga", name: "Bundesliga" },
  { key: "soccer_spain_la_liga", name: "La Liga" },
  { key: "soccer_italy_serie_a", name: "Serie A" },
  { key: "soccer_france_ligue_one", name: "Ligue 1" },
  { key: "soccer_usa_mls", name: "MLS" }
];

function getFlag(team) {
  const flags = { "England": "gb", "Germany": "de", "Spain": "es", "Italy": "it", "France": "fr", "USA": "us" };
  for (const [country, flag] of Object.entries(flags)) if (team.includes(country)) return flag;
  return "eu";
}

app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  let games = [];

  for (const league of LEAGUES) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${league.key}/odds`;
      const fullUrl = `${url}?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals,btts,dnb&dateFormat=iso&oddsFormat=decimal`;

      const response = await fetch(fullUrl);
      if (!response.ok) {
        console.warn(`HTTP ${response.status} für ${league.name}`);
        continue;
      }

      const data = await response.json();
      if (!Array.isArray(data)) continue;

      for (const g of data) {
        const gameDate = new Date(g.commence_time).toISOString().slice(0,10);
        if (gameDate !== date) continue;

        const home = g.home_team;
        const away = g.away_team;
        const bookmakers = g.bookmakers || [];
        if (!bookmakers.length) continue;

        const book = bookmakers[0];
        const odds = {};

        book.markets?.forEach(market => {
          if (market.key === "h2h") {
            market.outcomes.forEach(o => {
              if (o.name === home) odds.home = o.price;
              else if (o.name === away) odds.away = o.price;
              else if (o.name === "Draw") odds.draw = o.price;
            });
          } else if (market.key === "totals") {
            market.outcomes.forEach(o => {
              if (o.name === "Over" && o.point === 2.5) odds.over25 = o.price;
            });
          } else if (market.key === "btts") {
            market.outcomes.forEach(o => {
              if (o.name === "Yes") odds.bttsYes = o.price;
            });
          }
        });

        if (!odds.home && !odds.away && !odds.draw) continue;

        const homeXG = 1.3 + Math.random() * 0.8;
        const awayXG = 1.2 + Math.random() * 0.7;
        const totalXG = homeXG + awayXG;

        const prob = {
          home: homeXG / totalXG,
          away: awayXG / totalXG,
          draw: 1 - (homeXG / totalXG + awayXG / totalXG),
          over25: 0.55 + Math.random() * 0.15,
          bttsYes: (homeXG > 0.8 && awayXG > 0.8) ? 0.65 : 0.45
        };

        const value = {
          home: odds.home ? (prob.home * odds.home - 1) : 0,
          draw: odds.draw ? (prob.draw * odds.draw - 1) : 0,
          away: odds.away ? (prob.away * odds.away - 1) : 0,
          over25: odds.over25 ? (prob.over25 * odds.over25 - 1) : 0,
          bttsYes: odds.bttsYes ? (prob.bttsYes * odds.bttsYes - 1) : 0
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

  const top7 = [...games]
    .map(g => {
      const bestKey = Object.entries(g.value).reduce((a, b) => b[1] > a[1] ? b : a, ["", -Infinity])[0];
      return { home: g.home, away: g.away, market: bestKey, value: g.value[bestKey] };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const top3Fav = [...games]
    .map(g => {
      const diff = g.homeXG - g.awayXG;
      return { home: g.home, away: g.away, homeXG: g.homeXG, awayXG: g.awayXG, diff };
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 3);

  res.json({ response: games, top7, top3Fav });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`LIVE: https://xg-value-tool.onrender.com`);
  console.log(`Heute: ${new Date().toISOString().slice(0, 10)}`);
});
