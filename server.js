// server.js — xG + TheOddsAPI Version (kein API-Football mehr)
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

const ODDS_API_KEY = process.env.ODDS_API_KEY;

const LEAGUE_MAP = {
  "soccer_epl": "Premier League",
  "soccer_germany_bundesliga": "Bundesliga",
  "soccer_spain_la_liga": "La Liga",
  "soccer_italy_serie_a": "Serie A",
  "soccer_france_ligue_one": "Ligue 1"
};

// einfache xG-Erwartung pro Liga
function getXGForLeague(league) {
  switch (league) {
    case "Premier League":
      return { home: 1.7, away: 1.3 };
    case "Bundesliga":
      return { home: 1.8, away: 1.4 };
    case "La Liga":
      return { home: 1.5, away: 1.1 };
    case "Serie A":
      return { home: 1.6, away: 1.2 };
    case "Ligue 1":
      return { home: 1.7, away: 1.3 };
    default:
      return { home: 1.6, away: 1.3 };
  }
}

function value(prob, odds) {
  return prob * odds - 1;
}

app.get("/odds", async (req, res) => {
  const date = req.query.date;
  if (!ODDS_API_KEY) {
    return res.status(500).json({ error: "ODDS_API_KEY fehlt" });
  }

  const oddsMap = {};
  try {
    for (const [sportKey, leagueName] of Object.entries(LEAGUE_MAP)) {
      console.log(`📡 ${leagueName} abrufen...`);

      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;

      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`❌ ${leagueName} Fehler: ${resp.status}`);
        continue;
      }

      const events = await resp.json();

      for (const e of events) {
        const gameDate = new Date(e.commence_time).toISOString().slice(0, 10);
        if (gameDate !== date) continue;

        const bookmaker = e.bookmakers?.[0];
        if (!bookmaker) continue;

        const markets = {};
        for (const m of bookmaker.markets) {
          markets[m.key] = m;
        }

        const h2h = markets["h2h"] || {};
        const totals = markets["totals"] || {};

        const home = e.home_team;
        const away = e.away_team;
        const h2hHome = h2h.outcomes?.find(o => o.name === home)?.price;
        const h2hAway = h2h.outcomes?.find(o => o.name === away)?.price;
        const h2hDraw = h2h.outcomes?.find(o => o.name === "Draw")?.price;

        const ou = { over15: 0, over25: 0, over35: 0 };
        totals.outcomes?.forEach(o => {
          if (o.point === 1.5 && o.name === "Over") ou.over15 = o.price;
          if (o.point === 2.5 && o.name === "Over") ou.over25 = o.price;
          if (o.point === 3.5 && o.name === "Over") ou.over35 = o.price;
        });

        const xg = getXGForLeague(leagueName);
        const totalXG = xg.home + xg.away;

        const prob = {
          home: xg.home / totalXG,
          draw: 0.25,
          away: xg.away / totalXG,
          over15: Math.min(1, totalXG / 1.5),
          over25: Math.min(1, totalXG / 2.5),
          over35: Math.min(1, totalXG / 3.5)
        };

        const val = {
          home: value(prob.home, h2hHome || 0),
          draw: value(prob.draw, h2hDraw || 0),
          away: value(prob.away, h2hAway || 0),
          over15: value(prob.over15, ou.over15 || 0),
          over25: value(prob.over25, ou.over25 || 0),
          over35: value(prob.over35, ou.over35 || 0)
        };

        oddsMap[`${home} vs ${away}`] = {
          league: leagueName,
          date: gameDate,
          home,
          away,
          homeOdds: h2hHome,
          drawOdds: h2hDraw,
          awayOdds: h2hAway,
          ...ou,
          value: val,
          homeXG: xg.home,
          awayXG: xg.away
        };
      }
    }

    res.json(oddsMap);
  } catch (err) {
    console.error("🔥 Fehler:", err);
    res.status(500).json({ error: err.message });
  }
});

// static frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});
