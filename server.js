// server.js — PRO VERSION
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
const PORT = process.env.PORT || 10000;

const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", flag: "gb" },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", flag: "de" },
  { key: "soccer_spain_la_liga", name: "La Liga", flag: "es" },
  { key: "soccer_italy_serie_a", name: "Serie A", flag: "it" },
  { key: "soccer_france_ligue_one", name: "Ligue 1", flag: "fr" },
];

const TEAM_LOGOS = {
  "Chelsea": "https://crests.football-data.org/61.svg",
  "Sunderland": "https://crests.football-data.org/746.svg",
  "Newcastle United": "https://crests.football-data.org/67.svg",
  "Fulham": "https://crests.football-data.org/63.svg",
  "Manchester United": "https://crests.football-data.org/66.svg",
  "Brighton and Hove Albion": "https://crests.football-data.org/397.svg",
  "Brentford": "https://crests.football-data.org/402.svg",
  "Liverpool": "https://crests.football-data.org/64.svg",
  // Füge nach Bedarf hinzu oder nutze API
};

function getLogo(team) {
  return TEAM_LOGOS[team] || `https://flagcdn.com/48x36/${getFlag(team)}.png`;
}
function getFlag(team) {
  for (const l of LEAGUES) if (team.includes(l.name.split(" ")[0])) return l.flag;
  return "eu";
}

// Poisson
function poisson(lambda, k) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}
function factorial(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
function overUnderProb(homeXG, awayXG, line) {
  let over = 0;
  for (let i = Math.ceil(line) + 1; i <= 12; i++) {
    for (let h = 0; h <= i; h++) {
      const a = i - h;
      over += poisson(homeXG, h) * poisson(awayXG, a);
    }
  }
  return Math.min(over, 1);
}

app.get("/api/games", async (req, res) => {
  const date = req.query.date;
  const games = [];

  for (const league of LEAGUES) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${league.key}/odds`;
      const data = await fetch(`${url}?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals,btts&dateFormat=iso&oddsFormat=decimal`).then(r => r.json());

      for (const g of data) {
        if (!g.commence_time.startsWith(date)) continue;

        const home = g.home_team;
        const away = g.away_team;
        const book = g.bookmakers[0];
        if (!book) continue;

        const h2h = book.markets.find(m => m.key === "h2h")?.outcomes || [];
        const totals = book.markets.find(m => m.key === "totals")?.outcomes || [];
        const btts = book.markets.find(m => m.key === "btts")?.outcomes || [];

        const odds = {
          home: h2h.find(o => o.name === home)?.price || 0,
          draw: h2h.find(o => o.name === "Draw")?.price || 0,
          away: h2h.find(o => o.name === away)?.price || 0,
          over25: totals.find(o => o.name === "Over" && o.point === 2.5)?.price || 0,
          bttsYes: btts.find(o => o.name === "Yes")?.price || 0,
        };

        const homeXG = 1.6 + Math.random() * 0.6;
        const awayXG = 1.3 + Math.random() * 0.5;
        const totalXG = homeXG + awayXG;

        const prob = {
          home: homeXG / totalXG,
          away: awayXG / totalXG,
          draw: 1 - (homeXG / totalXG + awayXG / totalXG),
          over25: overUnderProb(homeXG, awayXG, 2.5),
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
          homeLogo: getLogo(home), awayLogo: getLogo(away),
          odds, value, totalXG: +totalXG.toFixed(2),
          homeXG: +homeXG.toFixed(2), awayXG: +awayXG.toFixed(2)
        });
      }
    } catch (err) {
      console.error("Liga-Fehler:", league.name, err.message);
    }
  }

  res.json({ response: games });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`LIVE: https://xg-value-tool.onrender.com`);
});
