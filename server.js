// server.js — ULTIMATE xG VALUE TOOL V6 | xG + VALUE + TORSCHÜTZEN + FREE TIER

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

// === KEYS ===
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;

// === LIGA MAPPING ===
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

// === UNDERSTAT LEAGUE MAPPING ===
const UNDERSTAT_LEAGUES = {
  "Premier_League": "EPL",
  "Bundesliga": "Bundesliga",
  "La_Liga": "La_liga",
  "Serie_A": "Serie_A",
  "Ligue_1": "Ligue_1"
};

// === SAMPLE xG DATA ===
const SAMPLE_XG = {
  "Manchester City vs Arsenal": { home_xg: 2.1, away_xg: 1.3 },
  "Bayern Munich vs Real Madrid": { home_xg: 2.8, away_xg: 1.9 }
};

// === /fixtures ===
app.get("/fixtures", async (req, res) => {
  const { date } = req.query;
  if (!API_FOOTBALL_KEY || !date) return res.status(400).json({ error: "Key oder Datum fehlt" });

  try {
    const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
      headers: { "x-apisports-key": API_FOOTBALL_KEY }
    });
    if (!resp.ok) throw new Error(`Fixtures ${resp.status}`);
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === /odds + xG + Value Bets ===
app.get("/odds", async (req, res) => {
  const { date } = req.query;
  if (!ODDS_API_KEY || !date) return res.status(400).json({ error: "Key oder Datum fehlt" });

  const oddsMap = {};
  const xgMap = {};

  // === 1. xG von Understat ===
  for (const [league, code] of Object.entries(UNDERSTAT_LEAGUES)) {
    try {
      const year = date.split("-")[0];
      const url = `https://understat.com/league/${code}/${year}`;
      const html = await (await fetch(url)).text();
      const xgRegex = /teamsData\s*=\s*JSON\.parse\('([^']+)'\)/;
      const match = html.match(xgRegex);
      if (!match) continue;

      const teamsData = JSON.parse(decodeURIComponent(match[1].replace(/\\x/g, '%')));
      Object.values(teamsData).forEach(team => {
        team.history.forEach(game => {
          const gameDate = game.date.split(" ")[0];
          if (gameDate !== date) return;

          const key1 = `${team.title} vs ${game.opponent.title}`;
          const key2 = `${game.opponent.title} vs ${team.title}`;
          const xg = { home_xg: 0, away_xg: 0 };
          if (game.h_a === "h") {
            xg.home_xg = parseFloat(game.xG);
            xg.away_xg = parseFloat(game.xGA);
          } else {
            xg.home_xg = parseFloat(game.xGA);
            xg.away_xg = parseFloat(game.xG);
          }
          xgMap[key1] = xg;
          xgMap[key2] = xg;
        });
      });
    } catch (err) {
      console.warn(`xG Fehler ${league}:`, err.message);
    }
  }

  // === 2. Odds (Free Tier) ===
  for (const [league, sportKey] of Object.entries(LEAGUE_TO_SPORT)) {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`
      + `?apiKey=${ODDS_API_KEY}&regions=eu,uk&markets=h2h,totals,btts&dateFormat=iso&oddsFormat=decimal`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const events = await resp.json();

      for (const event of events) {
        if (!event.commence_time.startsWith(date)) continue;
        const home = event.home_team.trim();
        const away = event.away_team.trim();
        const key = `${home} vs ${away}`;
        const bookmaker = event.bookmakers?.find(b => b.key === "pinnacle") || event.bookmakers?.[0];
        if (!bookmaker) continue;

        const m = Object.fromEntries(bookmaker.markets.map(m => [m.key, m]));
        const h2h = m.h2h;
        const totals = m.totals;
        const btts = m.btts;

        const homeOdds = h2h?.outcomes?.find(o => o.name === home)?.price || 0;
        const awayOdds = h2h?.outcomes?.find(o => o.name === away)?.price || 0;
        const over25 = totals?.outcomes?.find(o => o.point === 2.5 && o.name === "Over")?.price || 0;
        const under25 = totals?.outcomes?.find(o => o.point === 2.5 && o.name === "Under")?.price || 0;
        const bttsYes = btts?.outcomes?.find(o => o.name === "Yes")?.price || 0;

        if (homeOdds > 1 || awayOdds > 1) {
          oddsMap[key] = {
            home: homeOdds,
            away: awayOdds,
            over25,
            under25,
            bttsYes,
            topScorers: []
          };
        }
      }
    } catch (err) {
      console.warn(`Odds Fehler ${sportKey}`);
    }
  }

  // === 3. Torschützen (Premium) ===
  if (ODDS_API_KEY && ODDS_API_KEY.length > 20) {
    for (const [league, sportKey] of Object.entries(LEAGUE_TO_SPORT)) {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds`
        + `?apiKey=${ODDS_API_KEY}&regions=eu,uk&markets=player_goalscorer&dateFormat=iso`;

      try {
        const resp = await fetch(url);
        if (resp.status === 422) continue;
        if (!resp.ok) continue;
        const events = await resp.json();

        for (const event of events) {
          if (!event.commence_time.startsWith(date)) continue;
          const key = `${event.home_team.trim()} vs ${event.away_team.trim()}`;
          if (!oddsMap[key]) continue;

          const scorerMarket = event.bookmakers?.[0]?.markets.find(m => m.key === "player_goalscorer");
          if (scorerMarket?.outcomes?.length) {
            oddsMap[key].topScorers = scorerMarket.outcomes
              .filter(o => o.price > 1)
              .sort((a, b) => a.price - b.price)
              .slice(0, 3)
              .map(o => ({ player: o.name, odds: o.price }));
          }
        }
      } catch (err) { /* ignore */ }
    }
  }

  // === 4. Value Bet Berechnung ===
  const result = {};
  for (const [key, odds] of Object.entries(oddsMap)) {
    const xg = xgMap[key] || SAMPLE_XG[key] || { home_xg: 1.5, away_xg: 1.2 };
    const total_xg = xg.home_xg + xg.away_xg;

    // Fair Odds (Poisson)
    const lambdaHome = xg.home_xg;
    const lambdaAway = xg.away_xg;
    const probHome = Math.exp(-lambdaHome) * Math.pow(lambdaHome, 2) / 2; // ~2 Tore
    const probAway = Math.exp(-lambdaAway) * Math.pow(lambdaAway, 2) / 2;
    const probDraw = 0.26; // ~26%
    const total = probHome + probAway + probDraw;
    const fairHome = 1 / (probHome / total);
    const fairAway = 1 / (probAway / total);

    const valueHome = odds.home > fairHome * 1.05 ? "Value" : "";
    const valueAway = odds.away > fairAway * 1.05 ? "Value" : "";
    const valueOver = total_xg > 2.7 && odds.over25 > 1.8 ? "Value" : "";

    result[key] = {
      ...odds,
      xg: { home: xg.home_xg.toFixed(2), away: xg.away_xg.toFixed(2), total: total_xg.toFixed(2) },
      fair: { home: fairHome.toFixed(2), away: fairAway.toFixed(2) },
      value: { home: valueHome, away: valueAway, over: valueOver }
    };
  }

  res.json(Object.keys(result).length ? result : SAMPLE_XG);
});

// === STATIC ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`xG Value Tool PRO läuft auf http://localhost:${PORT}`);
});
