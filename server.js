// -----------------------------
// xG Odds Dashboard Backend (v2)
// -----------------------------
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
if (!ODDS_API_KEY) console.error("❌ FEHLER: ODDS_API_KEY fehlt!");

const PORT = process.env.PORT || 10000;

// -----------------------------
// Ligen-Definitionen
// -----------------------------
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", baseXG: [1.55, 1.25] },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", baseXG: [1.60, 1.35] },
  { key: "soccer_germany_2_bundesliga", name: "2. Bundesliga", baseXG: [1.55, 1.45] },
  { key: "soccer_spain_la_liga", name: "La Liga", baseXG: [1.45, 1.20] },
  { key: "soccer_italy_serie_a", name: "Serie A", baseXG: [1.45, 1.25] },
  { key: "soccer_france_ligue_one", name: "Ligue 1", baseXG: [1.55, 1.35] },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", baseXG: [1.70, 1.45] },
  { key: "soccer_sweden_allsvenskan", name: "Allsvenskan", baseXG: [1.55, 1.45] },
  { key: "soccer_turkey_super_league", name: "Turkey Super League", baseXG: [1.55, 1.35] },
  { key: "soccer_uefa_champs_league", name: "UEFA Champions League", baseXG: [1.60, 1.40] },
  { key: "soccer_uefa_europa_conference_league", name: "UEFA Europa Conference League", baseXG: [1.55, 1.35] },
  { key: "soccer_usa_mls", name: "MLS (USA)", baseXG: [1.70, 1.50] },
];

// -----------------------------
// Cache-System
// -----------------------------
const CACHE = {};
const cacheKey = (date, leagues) => `${date}_${leagues.sort().join(",")}`;

// -----------------------------
// Mathematische Hilfsfunktionen
// -----------------------------
function factorial(n) {
  if (n < 0) return NaN;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

function poisson(k, lambda) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/**
 * Berechnet Wahrscheinlichkeiten auf Basis der Poissonverteilung
 */
function matchProbs(lambdaHome, lambdaAway) {
  const maxGoals = 6; // bis 6 Tore abdecken
  let pHome = 0,
    pDraw = 0,
    pAway = 0,
    pOver25 = 0,
    pBTTS = 0;

  for (let home = 0; home <= maxGoals; home++) {
    for (let away = 0; away <= maxGoals; away++) {
      const p = poisson(home, lambdaHome) * poisson(away, lambdaAway);

      // 1X2
      if (home > away) pHome += p;
      else if (home === away) pDraw += p;
      else pAway += p;

      // Over 2.5
      if (home + away > 2) pOver25 += p;

      // BTTS
      if (home > 0 && away > 0) pBTTS += p;
    }
  }

  const sum = pHome + pDraw + pAway;
  return {
    home: pHome / sum,
    draw: pDraw / sum,
    away: pAway / sum,
    over25: pOver25,
    btts: pBTTS,
  };
}

// -----------------------------
// API Endpoint: /api/games
// -----------------------------
app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  const leaguesParam = req.query.leagues
    ? req.query.leagues.split(",")
    : LEAGUES.map((l) => l.key);

  const cacheId = cacheKey(date, leaguesParam);
  if (CACHE[cacheId]) {
    console.log("⚡ Cache-Treffer:", cacheId);
    return res.json(CACHE[cacheId]);
  }

  console.log("📅 Lade neue Daten für:", date);

  const games = [];

  // Parallel alle Ligen abrufen
  const leaguePromises = LEAGUES.filter((l) =>
    leaguesParam.includes(l.key)
  ).map(async (league) => {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${league.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Fehler beim Abruf von ${league.name}: ${response.status}`);
        return;
      }

      const data = await response.json();
      if (!Array.isArray(data)) return;

      for (const g of data) {
        if (!g.commence_time?.startsWith(date)) continue;

        const home = g.home_team;
        const away = g.away_team;
        const book = g.bookmakers?.[0];
        if (!book) continue;

        const h2h = book.markets?.find((m) => m.key === "h2h")?.outcomes || [];
        const totals =
          book.markets?.find((m) => m.key === "totals")?.outcomes || [];

        const odds = {
          home: h2h.find((o) => o.name === home)?.price || 0,
          draw: h2h.find((o) => o.name === "Draw")?.price || 0,
          away: h2h.find((o) => o.name === away)?.price || 0,
          over25: totals.find((o) => o.name === "Over" && o.point === 2.5)
            ?.price || 0,
        };

        if (!odds.home || !odds.away || !odds.draw) continue;

        // -----------------------------
        // xG Berechnung
        // -----------------------------
        const impliedHome = 1 / odds.home;
        const impliedAway = 1 / odds.away;
        const ratio = impliedHome / (impliedHome + impliedAway);

        const homeXG = Math.max(
          0.1,
          league.baseXG[0] + (ratio - 0.5) * 0.8
        );
        const awayXG = Math.max(
          0.05,
          league.baseXG[1] - (ratio - 0.5) * 0.8
        );

        // -----------------------------
        // Wahrscheinlichkeiten
        // -----------------------------
        const prob = matchProbs(homeXG, awayXG);

        // -----------------------------
        // Value-Berechnung
        // -----------------------------
        const value = {
          home: prob.home * odds.home - 1,
          draw: prob.draw * odds.draw - 1,
          away: prob.away * odds.away - 1,
          over25: prob.over25 * odds.over25 - 1,
          btts: prob.btts * 2.0 - 1, // angenommen Quote ~2.0
        };

        games.push({
          home,
          away,
          league: league.name,
          homeLogo: `https://placehold.co/48x36?text=${home[0]}`,
          awayLogo: `https://placehold.co/48x36?text=${away[0]}`,
          odds,
          prob,
          value,
          homeXG: +homeXG.toFixed(2),
          awayXG: +awayXG.toFixed(2),
          totalXG: +(homeXG + awayXG).toFixed(2),
        });
      }
    } catch (err) {
      console.error(`❌ Fehler ${league.name}:`, err.message);
    }
  });

  await Promise.all(leaguePromises);

  CACHE[cacheId] = { response: games };
  res.json({ response: games });
});

// -----------------------------
// Static Files + Start
// -----------------------------
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

app.listen(PORT, () =>
  console.log(`✅ Server läuft auf Port ${PORT}`)
);
