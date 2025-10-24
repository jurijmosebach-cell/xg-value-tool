// server.js — STABIL FINAL V4 | FIXTURES + ODDS + TORSCHÜTZEN + FALLBACK

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// === Pfade korrekt setzen ===
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
    console.error("❌ API_FOOTBALL_KEY fehlt!");
    return res.status(500).json({ error: "API_FOOTBALL_KEY fehlt" });
  }

  try {
    console.log(`📅 Hole Fixtures für ${date}...`);
    const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
      headers: { "x-apisports-key": API_FOOTBALL_KEY }
    });

    console.log("🔁 Status Fixtures:", resp.status);

    if (!resp.ok) {
      const msg = await resp.text();
      console.error(`⚠️ Fixtures API Fehler [${resp.status}]: ${msg}`);
      return res.status(500).json({ error: msg });
    }

    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error("🔥 Fixtures Fehler:", err);
    res.status(500).json({ error: err.message });
  }
});

// === /odds — stabil + Torschützen + Fallback ===
app.get("/odds", async (req, res) => {
  const date = req.query.date;
  if (!ODDS_API_KEY) {
    console.error("❌ ODDS_API_KEY fehlt!");
    return res.status(500).json({ error: "ODDS_API_KEY fehlt" });
  }

  const oddsMap = {};
  const sampleOdds = {
    "Manchester City vs Arsenal": {
      home: 1.95,
      away: 3.80,
      over25: 1.75,
      under25: 2.10,
      bttsYes: 1.72,
      bttsNo: 2.15,
      topScorers: [
        { player: "Haaland", odds: 1.85 },
        { player: "Saka", odds: 2.60 }
      ]
    },
    "Bayern Munich vs Real Madrid": {
      home: 2.10,
      away: 3.30,
      over25: 1.68,
      under25: 2.25,
      bttsYes: 1.65,
      bttsNo: 2.30,
      topScorers: [
        { player: "Kane", odds: 1.90 },
        { player: "Vinícius Júnior", odds: 2.50 }
      ]
    }
  };

  try {
    for (const [leagueValue, sportKey] of Object.entries(LEAGUE_TO_SPORT)) {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu,uk,us&markets=h2h,totals,btts,player_goalscorer&dateFormat=iso&oddsFormat=decimal`;

      console.log("\n📡 Anfrage an:", sportKey);
      console.log("📅 Datum:", date);

      const resp = await fetch(url);
      console.log("🔁 Status:", resp.status);

      if (!resp.ok) {
        const msg = await resp.text();
        console.error(`⚠️ API-Fehler [${resp.status}] ${sportKey}: ${msg}`);
        continue;
      }

      const events = await resp.json();
      console.log(`✅ ${events.length} Events empfangen für ${sportKey}`);

      for (const event of events) {
        const eventDate = new Date(event.commence_time).toISOString().slice(0, 10);
        if (!eventDate.startsWith(date)) continue;

        const home = event.home_team?.trim();
        const away = event.away_team?.trim();
        if (!home || !away) continue;

        const bookmaker =
          event.bookmakers?.find(b => b.key === "pinnacle") || event.bookmakers?.[0];
        if (!bookmaker) continue;

        // --- Marktzuordnung tolerant ---
        const marketMap = {};
        bookmaker.markets.forEach(m => (marketMap[m.key] = m));

        function findMarket(maps, keyPart) {
          return Object.values(maps).find(m => m.key.includes(keyPart)) || {};
        }

        // 1X2
        const h2h = findMarket(marketMap, "h2h");

        // Over/Under
        const totals = findMarket(marketMap, "totals");

        // BTTS
        const btts = findMarket(marketMap, "btts");

        // Torschützen (Anytime Goalscorer)
        const scorers = findMarket(marketMap, "player_goalscorer");

        // --- Quoten extrahieren ---
        const homeOdds = h2h.outcomes?.find(o => o.name === home)?.price || 0;
        const awayOdds = h2h.outcomes?.find(o => o.name === away)?.price || 0;

        const overUnder = { over25: 0, under25: 0 };
        totals.outcomes?.forEach(o => {
          if (o.point === 2.5) {
            if (o.name === "Over") overUnder.over25 = o.price;
            if (o.name === "Under") overUnder.under25 = o.price;
          }
        });

        const bttsYes = btts.outcomes?.find(o => o.name === "Yes")?.price || 0;
        const bttsNo = btts.outcomes?.find(o => o.name === "No")?.price || 0;

        // --- Top-3 Torschützen extrahieren ---
        const topScorers = [];
        if (scorers?.outcomes?.length) {
          const sorted = scorers.outcomes
            .filter(o => o.price > 1)
            .sort((a, b) => a.price - b.price)
            .slice(0, 3)
            .map(o => ({ player: o.name, odds: o.price }));
          topScorers.push(...sorted);
        }

        if (homeOdds > 1 && awayOdds > 1) {
          const oddsObj = {
            home: homeOdds,
            away: awayOdds,
            ...overUnder,
            bttsYes,
            bttsNo,
            topScorers
          };
          const key1 = `${home} vs ${away}`;
          const key2 = `${away} vs ${home}`;
          oddsMap[key1] = oddsObj;
          oddsMap[key2] = oddsObj;
        }
      }
    }

    if (Object.keys(oddsMap).length === 0) {
      console.warn("⚠️ Keine Odds gefunden — Fallback auf Beispiel-Daten.");
      return res.json(sampleOdds);
    }

    res.json(oddsMap);
  } catch (err) {
    console.error("🔥 Odds-Fehler:", err);
    res.status(500).json({ error: err.message });
  }
});

// === STATIC ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// === START ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server läuft auf http://localhost:${PORT}`);
  console.log(`⚽ Odds + Fixtures + Torschützen aktiv!`);
});
