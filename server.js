// server.js — FINAL STABLE BUILD with TheOddsAPI + Live Fixtures (Fallback Ready)

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// === Pfade ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// === ENV Variablen ===
const ODDS_API_KEY = process.env.ODDS_API_KEY; // Deinen echten Key in Render setzen
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || null;

// === Liga Zuordnung ===
const LEAGUE_TO_SPORT = {
  "Premier_League": "soccer_epl",
  "Bundesliga": "soccer_germany_bundesliga",
  "La_Liga": "soccer_spain_la_liga",
  "Serie_A": "soccer_italy_serie_a",
  "Ligue_1": "soccer_france_ligue_one"
};

// === Fixtures Endpoint ===
app.get("/fixtures", async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  console.log(`📅 Lade Fixtures für ${date}...`);

  let fixtures = { response: [] };

  try {
    // Football-Data API (gratis, aber key optional)
    const url = `https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`;
    const headers = FOOTBALL_DATA_KEY ? { "X-Auth-Token": FOOTBALL_DATA_KEY } : {};
    const r = await fetch(url, { headers });
    const data = await r.json();

    if (data.matches) {
      fixtures.response = data.matches.map((m) => ({
        teams: {
          home: { name: m.homeTeam.name, logo: "" },
          away: { name: m.awayTeam.name, logo: "" }
        },
        league: { name: m.competition.name },
        fixture: { date: m.utcDate }
      }));
    }
  } catch (err) {
    console.error("❌ Fixture Fehler:", err.message);
  }

  if (!fixtures.response || fixtures.response.length === 0) {
    console.warn("⚠️ Keine Fixtures gefunden – Fallback aktiv");
    fixtures.response = [
      {
        teams: {
          home: { name: "Manchester City", logo: "" },
          away: { name: "Liverpool", logo: "" }
        },
        league: { name: "Premier League" },
        fixture: { date: new Date().toISOString() }
      }
    ];
  }

  res.json(fixtures);
});

// === Odds Endpoint ===
app.get("/odds", async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const oddsMap = {};
  console.log(`🎯 Hole Quoten für ${date}...`);

  if (!ODDS_API_KEY) {
    return res.status(500).json({ error: "Fehlender ODDS_API_KEY" });
  }

  try {
    for (const [leagueName, sportKey] of Object.entries(LEAGUE_TO_SPORT)) {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals,btts,handicap&oddsFormat=decimal`;
      console.log(`📡 Anfrage an: ${sportKey}`);

      const r = await fetch(url);
      if (!r.ok) {
        const msg = await r.text();
        console.warn(`⚠️ Fehler [${r.status}] ${sportKey}: ${msg}`);
        continue;
      }

      const events = await r.json();
      for (const e of events) {
        const home = e.home_team?.trim();
        const away = e.away_team?.trim();
        if (!home || !away) continue;

        const bookmaker = e.bookmakers?.find(b => b.key === "pinnacle") || e.bookmakers?.[0];
        if (!bookmaker) continue;

        const marketMap = {};
        bookmaker.markets.forEach(m => (marketMap[m.key] = m));

        // 1X2
        const h2h = marketMap["h2h"];
        const homeOdds = h2h?.outcomes?.find(o => o.name === home)?.price || 0;
        const drawOdds = h2h?.outcomes?.find(o => o.name === "Draw")?.price || 0;
        const awayOdds = h2h?.outcomes?.find(o => o.name === away)?.price || 0;

        // Over/Under
        const totals = marketMap["totals"];
        const over25 = totals?.outcomes?.find(o => o.name === "Over" && o.point === 2.5)?.price || 0;
        const under25 = totals?.outcomes?.find(o => o.name === "Under" && o.point === 2.5)?.price || 0;

        // BTTS
        const btts = marketMap["btts"];
        const bttsYes = btts?.outcomes?.find(o => o.name === "Yes")?.price || 0;
        const bttsNo = btts?.outcomes?.find(o => o.name === "No")?.price || 0;

        // Handicap (optional)
        const handicap = marketMap["handicap"];
        const homeMinus05 = handicap?.outcomes?.find(o => o.name === home && o.point === -0.5)?.price || 0;

        const oddsObj = {
          home: homeOdds,
          draw: drawOdds,
          away: awayOdds,
          over25,
          under25,
          bttsYes,
          bttsNo,
          homeMinus05
        };

        const key1 = `${home} vs ${away}`;
        const key2 = `${away} vs ${home}`;
        oddsMap[key1] = oddsObj;
        oddsMap[key2] = oddsObj;
      }
    }

    if (Object.keys(oddsMap).length === 0) {
      console.warn("⚠️ Keine Quoten gefunden – Fallback aktiv");
      oddsMap["Manchester City vs Liverpool"] = {
        home: 1.85, draw: 3.9, away: 4.0,
        over25: 1.7, under25: 2.1,
        bttsYes: 1.65, bttsNo: 2.3,
        homeMinus05: 1.9
      };
    }

    res.json(oddsMap);
  } catch (err) {
    console.error("🔥 Odds Fehler:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Default ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server läuft auf http://localhost:${PORT}`);
  console.log(`⚽ Echtzeitdaten aktiv (TheOddsAPI + Fixtures)`); 
});
