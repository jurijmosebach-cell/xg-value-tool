// server.js — FINAL OHNE BOT | 1X2 + O/U + AH + BTTS

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
const ODDS_API_KEY = process.env.ODDS_API_KEY;

// === Liga-Mapping ===
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

// === /fixtures ===
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

// === /odds → ALLE MÄRKTE ===
app.get("/odds", async (req, res) => {
  const date = req.query.date;
  if (!ODDS_API_KEY) return res.status(500).json({ error: "ODDS_API_KEY fehlt" });

  const oddsMap = {};

  try {
    for (const [leagueValue, sportKey] of Object.entries(LEAGUE_TO_SPORT)) {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals,handicap,btts&dateFormat=iso&oddsFormat=decimal`;
      
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const events = await resp.json();

      for (const event of events) {
        const eventDate = new Date(event.commence_time).toISOString().slice(0, 10);
        if (eventDate !== date) continue;

        const home = event.home_team;
        const away = event.away_team;
        const key = `${home} vs ${away}`;

        const bookmaker = event.bookmakers?.find(b => b.key === "pinnacle") || event.bookmakers?.[0];
        if (!bookmaker) continue;

        const marketMap = {};
        bookmaker.markets.forEach(m => { marketMap[m.key] = m; });

        // 1X2
        const h2h = marketMap["h2h"] || {};
        const homeOdds = h2h.outcomes?.find(o => o.name === home)?.price || 0;
        const awayOdds = h2h.outcomes?.find(o => o.name === away)?.price || 0;

        // Over/Under
        const totals = marketMap["totals"] || {};
        const overUnder = { over15: 0, under15: 0, over25: 0, under25: 0, over35: 0, under35: 0 };
        totals.outcomes?.forEach(o => {
          if (o.point === 1.5) { if (o.name === "Over") overUnder.over15 = o.price; else if (o.name === "Under") overUnder.under15 = o.price; }
          if (o.point === 2.5) { if (o.name === "Over") overUnder.over25 = o.price; else if (o.name === "Under") overUnder.under25 = o.price; }
          if (o.point === 3.5) { if (o.name === "Over") overUnder.over35 = o.price; else if (o.name === "Under") overUnder.under35 = o.price; }
        });

        // Asian Handicap
        const handicap = marketMap["handicap"] || {};
        const ah = { home0: 0, away0: 0, homeMinus05: 0, awayPlus05: 0 };
        handicap.outcomes?.forEach(o => {
          if (o.point === 0 && o.name === home) ah.home0 = o.price;
          if (o.point === 0 && o.name === away) ah.away0 = o.price;
          if (o.point === -0.5 && o.name === home) ah.homeMinus05 = o.price;
          if (o.point === 0.5 && o.name === away) ah.awayPlus05 = o.price;
        });

        // BTTS
        const btts = marketMap["btts"] || {};
        const bttsYes = btts.outcomes?.find(o => o.name === "Yes")?.price || 0;
        const bttsNo = btts.outcomes?.find(o => o.name === "No")?.price || 0;

        if (homeOdds > 1 && awayOdds > 1) {
          oddsMap[key] = {
            home: homeOdds, away: awayOdds,
            ...overUnder, ...ah,
            bttsYes, bttsNo
          };
        }
      }
    }
    res.json(oddsMap);
  } catch (err) {
    console.error("Odds-Fehler:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
  console.log(`TheOddsAPI AKTIV: 1X2 + O/U + AH + BTTS`);
});
