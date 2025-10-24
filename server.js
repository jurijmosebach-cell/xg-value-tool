// server.js — FINAL V5 | BTTS FIX + EXAKTER DATUMSVERGLEICH + STABIL

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
  if (!API_FOOTBALL_KEY) {
    console.error("API_FOOTBALL_KEY fehlt!");
    return res.status(500).json({ error: "API_FOOTBALL_KEY fehlt" });
  }

  try {
    console.log(`Hole Fixtures für ${date}...`);
    const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
      headers: { "x-apisports-key": API_FOOTBALL_KEY }
    });

    console.log("Status Fixtures:", resp.status);
    if (!resp.ok) {
      const msg = await resp.text();
      console.error(`Fixtures API Fehler [${resp.status}]: ${msg}`);
      return res.status(500).json({ error: msg });
    }

    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error("Fixtures Fehler:", err);
    res.status(500).json({ error: err.message });
  }
});

// === /odds — FINAL FIX: btts_yes_no + exakter Datumsvergleich ===
app.get("/odds", async (req, res) => {
  const date = req.query.date;
  if (!ODDS_API_KEY) {
    console.error("ODDS_API_KEY fehlt!");
    return res.status(500).json({ error: "ODDS_API_KEY fehlt" });
  }

  const oddsMap = {};
  const sampleOdds = {
    "Manchester City vs Arsenal": {
      home: 1.95,
      away: 3.80,
      over25: 1.75,
      under25: 2.10,
      homeMinus05: 1.90,
      awayPlus05: 1.95,
      bttsYes: 1.72,
      bttsNo: 2.15
    },
    "Bayern Munich vs Real Madrid": {
      home: 2.10,
      away: 3.30,
      over25: 1.68,
      under25: 2.25,
      homeMinus05: 1.95,
      awayPlus05: 1.90,
      bttsYes: 1.65,
      bttsNo: 2.30
    }
  };

  try {
    for (const [leagueValue, sportKey] of Object.entries(LEAGUE_TO_SPORT)) {
      // FIX: btts → btts_yes_no
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu,uk,us&markets=h2h,totals,spreads,btts_yes_no&dateFormat=iso&oddsFormat=decimal`;

      console.log("\nAnfrage an:", sportKey);
      console.log("Datum:", date);

      const resp = await fetch(url);
      console.log("Status:", resp.status);

      if (!resp.ok) {
        const msg = await resp.text();
        console.error(`API-Fehler [${resp.status}] ${sportKey}: ${msg}`);
        continue;
      }

      const events = await resp.json();
      console.log(`${events.length} Events empfangen für ${sportKey}`);

      for (const event of events) {
        // Exakter Datumsvergleich: YYYY-MM-DD
        const eventDate = new Date(event.commence_time).toISOString().slice(0, 10);

        // DEBUG: Zeige jedes Spiel
        console.log(`Event: ${event.home_team} vs ${event.away_team} → ${eventDate}`);

        if (eventDate !== date) continue;

        const home = event.home_team?.trim();
        const away = event.away_team?.trim();
        if (!home || !away) continue;

        const bookmaker =
          event.bookmakers?.find(b => b.key === "pinnacle") || event.bookmakers?.[0];
        if (!bookmaker) continue;

        // Marktzuordnung tolerant
        const marketMap = {};
        bookmaker.markets.forEach(m => (marketMap[m.key] = m));

        function findMarket(maps, keyPart) {
          return Object.values(maps).find(m => m.key.includes(keyPart)) || {};
        }

        // Märkte finden – FIX: btts_yes_no
        const h2h = findMarket(marketMap, "h2h");
        const totals = findMarket(marketMap, "totals");
        const spreads = findMarket(marketMap, "spreads") || findMarket(marketMap, "handicap");
        const btts = findMarket(marketMap, "btts_yes_no"); // FIX

        // 1X2
        const homeOdds = h2h.outcomes?.find(o => o.name === home)?.price || 0;
        const awayOdds = h2h.outcomes?.find(o => o.name === away)?.price || 0;

        // Over/Under 2.5
        const overUnder = { over25: 0, under25: 0 };
        totals.outcomes?.forEach(o => {
          if (o.point === 2.5) {
            if (o.name === "Over") overUnder.over25 = o.price;
            if (o.name === "Under") overUnder.under25 = o.price;
          }
        });

        // Asian Handicap: Home -0.5 / Away +0.5
        const ah = { homeMinus05: 0, awayPlus05: 0 };
        spreads.outcomes?.forEach(o => {
          if (o.point === -0.5 && o.name === home) ah.homeMinus05 = o.price;
          if (o.point === 0.5 && o.name === away) ah.awayPlus05 = o.price;
        });

        // BTTS
        const bttsYes = btts.outcomes?.find(o => o.name === "Yes")?.price || 0;
        const bttsNo = btts.outcomes?.find(o => o.name === "No")?.price || 0;

        // Nur speichern, wenn sinnvolle Quoten vorhanden
        if (homeOdds > 1 && awayOdds > 1) {
          const oddsObj = {
            home: homeOdds,
            away: awayOdds,
            ...overUnder,
            ...ah,
            bttsYes,
            bttsNo
          };
          const key1 = `${home} vs ${away}`;
          const key2 = `${away} vs ${home}`;
          oddsMap[key1] = oddsObj;
          oddsMap[key2] = oddsObj;
        }
      }
    }

    // Fallback nur bei API-Fehler oder leerem Tag
    if (Object.keys(oddsMap).length === 0) {
      console.warn(`Keine Spiele mit Quoten für ${date} gefunden.`);
      return res.json(sampleOdds); // oder {} für leeres Ergebnis
    }

    res.json(oddsMap);
  } catch (err) {
    console.error("Odds-Fehler:", err);
    res.status(500).json({ error: err.message });
  }
});

// === STATIC FILES (SPA) ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// === START SERVER ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`\nServer läuft auf http://localhost:${PORT}`);
  console.log(`TheOddsAPI aktiv: 1X2 + O/U + AH + BTTS + Fallback`);
});
