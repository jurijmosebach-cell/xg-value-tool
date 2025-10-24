// server.js — FINAL MIT AKTIVER TheOddsAPI (alle Ligen)

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// === API KEYS ===
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY; // Dein Key: cfbf3f676af48fd8de8e099792bf1485

// === Liga-Mapping für TheOddsAPI ===
const LEAGUE_TO_SPORT = {
  "Premier_League": "soccer_epl",
  "Bundesliga": "soccer_germany_bundesliga",
  "La_Liga": "soccer_spain_la_liga",
  "Serie_A": "soccer_italy_serie_a",
  "Ligue_1": "soccer_france_ligue_one",
  "UEFA_Champions_League": "soccer_uefa_champions_league",
  "UEFA_Europa_League": "soccer_uefa_europa_league",
  "UEFA_Conference_League": "soccer_uefa_conference_league"
};

// === /fixtures → API-Football ===
app.get("/fixtures", async (req, res) => {
  const date = req.query.date;
  if (!API_FOOTBALL_KEY) return res.status(500).json({ error: "API_FOOTBALL_KEY fehlt" });

  try {
    const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
      headers: { "x-apisports-key": API_FOOTBALL_KEY }
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === /odds → TheOddsAPI (alle Ligen, live!) ===
app.get("/odds", async (req, res) => {
  const date = req.query.date;
  if (!ODDS_API_KEY) return res.status(500).json({ error: "ODDS_API_KEY fehlt" });

  const oddsMap = {};

  try {
    for (const [leagueValue, sportKey] of Object.entries(LEAGUE_TO_SPORT)) {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&dateFormat=iso&oddsFormat=decimal`;
      
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const events = await resp.json();

      for (const event of events) {
        const home = event.home_team;
        const away = event.away_team;
        const key = `${home} vs ${away}`;

        const pinnacle = event.bookmakers.find(b => b.key === "pinnacle") ||
                         event.bookmakers.find(b => b.key === "bet365") ||
                         event.bookmakers[0];
        if (!pinnacle) continue;

        const h2h = pinnacle.markets.find(m => m.key === "h2h");
        if (!h2h) continue;

        const homeOdds = h2h.outcomes.find(o => o.name === home)?.price;
        const awayOdds = h2h.outcomes.find(o => o.name === away)?.price;

        if (homeOdds && awayOdds) {
          oddsMap[key] = { home: homeOdds, away: awayOdds };
        }
      }
    }
    res.json(oddsMap);
  } catch (err) {
    console.error("Odds API Fehler:", err);
    res.status(500).json({ error: err.message });
  }
});

// Fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
  console.log(`TheOddsAPI AKTIV mit Key: ${ODDS_API_KEY ? "Ja" : "Nein"}`);
});
