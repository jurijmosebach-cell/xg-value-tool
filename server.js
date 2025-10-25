// server.js — xG Value Tool mit Logos + echter Value
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

// Liga → xG Durchschnitt (realistisch)
const XG_AVG = {
  "Premier League": { home: 1.65, away: 1.25 },
  "Bundesliga": { home: 1.80, away: 1.40 },
  "La Liga": { home: 1.50, away: 1.10 },
  "Serie A": { home: 1.60, away: 1.20 },
  "Ligue 1": { home: 1.70, away: 1.30 },
};

// Team → Logo (via API-Football oder Placeholder)
const TEAM_LOGOS = {};

// Value berechnen: (Wahrscheinlichkeit × Quote) - 1
function calculateValue(prob, odds) {
  return odds ? (prob * odds - 1) : 0;
}

// Poisson-Wahrscheinlichkeit für Over/Under
function poissonProb(lambda, k) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}
function factorial(n) {
  let f = 1; for (let i = 2; i <= n; i++) f *= i; return f;
}
function overProb(totalXG, line) {
  let prob = 0;
  for (let i = Math.ceil(line) + 1; i <= 10; i++) {
    prob += poissonProb(totalXG, i);
  }
  return Math.min(prob, 1);
}

app.get("/api/fixtures", async (req, res) => {
  const date = req.query.date;
  const url = `https://api.the-odds-api.com/v4/sports/soccer_epl/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&dateFormat=iso&oddsFormat=decimal`;
  try {
    const data = await fetch(url).then(r => r.json());
    const games = data
      .filter(g => g.commence_time.startsWith(date))
      .map(g => {
        const home = g.home_team;
        const away = g.away_team;
        const league = "Premier League"; // Erweitere später
        const xg = XG_AVG[league];
        const totalXG = xg.home + xg.away;

        const market = g.bookmakers[0]?.markets;
        const h2h = market?.find(m => m.key === "h2h")?.outcomes || [];
        const totals = market?.find(m => m.key === "totals")?.outcomes || [];

        const odds = {
          home: h2h.find(o => o.name === home)?.price || 0,
          draw: h2h.find(o => o.name === "Draw")?.price || 0,
          away: h2h.find(o => o.name === away)?.price || 0,
          over25: totals.find(o => o.name === "Over" && o.point === 2.5)?.price || 0,
        };

        const prob = {
          home: xg.home / totalXG,
          draw: 0.25,
          away: xg.away / totalXG,
          over25: overProb(totalXG, 2.5),
        };

        const value = {
          home: calculateValue(prob.home, odds.home),
          draw: calculateValue(prob.draw, odds.draw),
          away: calculateValue(prob.away, odds.away),
          over25: calculateValue(prob.over25, odds.over25),
        };

        return {
          home,
          away,
          league,
          homeLogo: `https://flagcdn.com/48x36/gb.png`, // Placeholder
          awayLogo: `https://flagcdn.com/48x36/de.png`,
          odds,
          value,
          totalXG: +totalXG.toFixed(2),
        };
      });
    res.json({ response: games });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
