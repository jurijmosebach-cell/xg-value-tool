// server.js — STABIL FINAL V5 | FREE-TIER-KOMPATIBEL + TORSCHÜTZEN NUR BEI PREMIUM

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

// === GÜLTIGE MÄRKTE ===
const FREE_MARKETS = "h2h,totals,btts";
const PREMIUM_MARKETS = "player_goalscorer";

// === SAMPLE DATEN (nur bei echtem Totalausfall) ===
const SAMPLE_ODDS = {
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

// === /fixtures ===
app.get("/fixtures", async (req, res) => {
  const { date } = req.query;
  if (!API_FOOTBALL_KEY) return res.status(500).json({ error: "API_FOOTBALL_KEY fehlt" });
  if (!date) return res.status(400).json({ error: "Datum erforderlich" });

  try {
    console.log(`Hole Fixtures für ${date}...`);
00
    const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
      headers: { "x-apisports-key": API_FOOTBALL_KEY }
    });

    if (!resp.ok) {
      const msg = await resp.text();
      console.error(`Fixtures Fehler [${resp.status}]: ${msg}`);
      return res.status(resp.status).json({ error: msg });
    }

    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error("Fixtures Crash:", err);
    res.status(500).json({ error: err.message });
  }
});

// === /odds — ROBUST & FREE-TIER-SICHER ===
app.get("/odds", async (req, res) => {
  const { date } = req.query;
  if (!ODDS_API_KEY) return res.status(500).json({ error: "ODDS_API_KEY fehlt" });
  if (!date) return res.status(400).json({ error: "Datum erforderlich" });

  const oddsMap = {};

  // === 1. Versuch: Free Märkte (immer verfügbar) ===
  let hasFreeData = false;

  for (const [league, sportKey] of Object.entries(LEAGUE_TO_SPORT)) {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`
      + `?apiKey=${ODDS_API_KEY}`
      + `&regions=eu,uk`
      + `&markets=${FREE_MARKETS}`
      + `&dateFormat=iso`
      + `&oddsFormat=decimal`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        const msg = await resp.text();
        console.warn(`Free Markets [${resp.status}] ${sportKey}: ${msg}`);
        continue;
      }

      const events = await resp.json();
      console.log(`${events.length} Events (Free) für ${sportKey}`);

      for (const event of events) {
        if (!event.commence_time.startsWith(date)) continue;

        const home = event.home_team?.trim();
        const away = event.away_team?.trim();
        if (!home || !away) continue;

        const bookmaker = event.bookmakers?.find(b => b.key === "pinnacle") || event.bookmakers?.[0];
        if (!bookmaker) continue;

        const marketMap = Object.fromEntries(bookmaker.markets.map(m => [m.key, m]));

        const h2h = marketMap["h2h"];
        const totals = marketMap["totals"];
        const btts = marketMap["btts"];

        const homeOdds = h2h?.outcomes?.find(o => o.name === home)?.price || 0;
        const awayOdds = h2h?.outcomes?.find(o => o.name === away)?.price || 0;

        const over25 = totals?.outcomes?.find(o => o.point === 2.5 && o.name === "Over")?.price || 0;
        const under25 = totals?.outcomes?.find(o => o.point === 2.5 && o.name === "Under")?.price || 0;

        const bttsYes = btts?.outcomes?.find(o => o.name === "Yes")?.price || 0;
        const bttsNo = btts?.outcomes?.find(o => o.name === "No")?.price || 0;

        if (homeOdds > 1 || awayOdds > 1) {
          hasFreeData = true;
          const key = `${home} vs ${away}`;
          oddsMap[key] = oddsMap[key] || {
            home: homeOdds,
            away: awayOdds,
            over25,
            under25,
            bttsYes,
            bttsNo,
            topScorers: []
          };
        }
      }
    } catch (err) {
      console.error(`Free Markets Crash ${sportKey}:`, err.message);
    }
  }

  // === 2. Versuch: Torschützen NUR bei Premium-Key ===
  if (ODDS_API_KEY && ODDS_API_KEY.length > 20) { // Hinweis: Premium-Keys sind länger
    console.log("Premium-Key erkannt → lade Torschützen...");
    for (const [league, sportKey] of Object.entries(LEAGUE_TO_SPORT)) {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`
        + `?apiKey=${ODDS_API_KEY}`
        + `&regions=eu,uk`
        + `&markets=${PREMIUM_MARKETS}`
        + `&dateFormat=iso`
        + `&oddsFormat=decimal`;

      try {
        const resp = await fetch(url);
        if (resp.status === 422) {
          console.log(`Torschützen nicht verfügbar für ${sportKey} (Free Tier)`);
          continue;
        }
        if (!resp.ok) {
          const msg = await resp.text();
          console.warn(`Premium Markets [${resp.status}] ${sportKey}: ${msg}`);
          continue;
        }

        const events = await resp.json();
        for (const event of events) {
          if (!event.commence_time.startsWith(date)) continue;

          const home = event.home_team?.trim();
          const away = event.away_team?.trim();
          const key = `${home} vs ${away}`;
          if (!oddsMap[key]) continue;

          const bookmaker = event.bookmakers?.[0];
          if (!bookmaker) continue;

          const scorers = bookmaker.markets.find(m => m.key === "player_goalscorer");
          if (scorers?.outcomes?.length) {
            const top3 = scorers.outcomes
              .filter(o => o.price > 1)
              .sort((a, b) => a.price - b.price)
              .slice(0, 3)
              .map(o => ({ player: o.name, odds: o.price }));

            oddsMap[key].topScorers = top3;
          }
        }
      } catch (err) {
        console.error(`Premium Crash ${sportKey}:`, err.message);
      }
    }
  }

  // === Rückgabe ===
  if (Object.keys(oddsMap).length === 0) {
    console.warn("Kein einziges Spiel gefunden → Fallback auf Sample-Daten");
    return res.json(SAMPLE_ODDS);
  }

  res.json(oddsMap);
});

// === STATIC FALLBACK ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// === START ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`\nServer läuft auf http://localhost:${PORT}`);
  console.log(`Free Tier: h2h, totals, btts`);
  console.log(`Premium: + Torschützen (nur bei gültigem Key)`);
});
