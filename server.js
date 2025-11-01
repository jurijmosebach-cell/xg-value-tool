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
const SOCCERDATA_KEY = process.env.SOCCERDATA_KEY || "4edc0535a5304abcfd3999fad3e6293d0b02e1a0";

if (!ODDS_API_KEY) console.error("FEHLER: ODDS_API_KEY fehlt!");
if (!SOCCERDATA_KEY) console.error("FEHLER: SOCCERDATA_KEY fehlt!");

const PORT = process.env.PORT || 10000;

// -----------------------------
// LEAGUES
// -----------------------------
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", country_id: 1 },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", country_id: 2 },
  { key: "soccer_germany_2_bundesliga", name: "2. Bundesliga", country_id: 2 },
  { key: "soccer_spain_la_liga", name: "La Liga", country_id: 3 },
  { key: "soccer_italy_serie_a", name: "Serie A", country_id: 4 },
  { key: "soccer_france_ligue_one", name: "Ligue 1", country_id: 5 },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", country_id: 6 },
  { key: "soccer_sweden_allsvenskan", name: "Allsvenskan", country_id: 7 },
  // Neue Ligen
  { key: "soccer_turkey_super_league", name: "Turkey Super League", country_id: 8 },
  { key: "soccer_uefa_europa_conference_league", name: "Europa Conference League", country_id: 9 },
  { key: "soccer_uefa_champs_league", name: "Champions League", country_id: 9 },
  { key: "soccer_uefa_champs_league_qualification", name: "Champions League Qualification", country_id: 9 },
  { key: "soccer_usa_mls", name: "MLS", country_id: 10 },
];

// -----------------------------
// Cache
// -----------------------------
const CACHE = {};
function cacheKey(date, leagues) {
  return `${date}_${leagues.sort().join(",")}`;
}

// -----------------------------
// Hilfsfunktionen
// -----------------------------
const MAX_GOALS = 6;
const factorials = [1];
for (let i = 1; i <= 20; i++) factorials[i] = factorials[i - 1] * i;

function poissonPMF(k, lambda) {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorials[k];
}

function scoreMatrix(lambdaHome, lambdaAway) {
  const mat = [];
  let sum = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    mat[i] = [];
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poissonPMF(i, lambdaHome) * poissonPMF(j, lambdaAway);
      mat[i][j] = p;
      sum += p;
    }
  }
  return { mat, coveredProb: sum };
}

function probTotalLeK(mat, k) {
  let s = 0;
  for (let i = 0; i <= MAX_GOALS; i++)
    for (let j = 0; j <= MAX_GOALS; j++)
      if (i + j <= k) s += mat[i][j];
  return s;
}

function probsFromMatrix(mat) {
  let ph = 0, pd = 0, pa = 0;
  for (let i = 0; i <= MAX_GOALS; i++)
    for (let j = 0; j <= MAX_GOALS; j++) {
      if (i > j) ph += mat[i][j];
      else if (i === j) pd += mat[i][j];
      else pa += mat[i][j];
    }
  return { home: ph, draw: pd, away: pa };
}

function calcBTTS(lambdaHome, lambdaAway) {
  const p0h = Math.exp(-lambdaHome);
  const p0a = Math.exp(-lambdaAway);
  const p00 = Math.exp(-(lambdaHome + lambdaAway));
  return 1 - p0h - p0a + p00;
}

// -----------------------------
// API: /api/games
// -----------------------------
app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  const leaguesParam = req.query.leagues
    ? req.query.leagues.split(",")
    : LEAGUES.map(l => l.key);

  const cacheId = cacheKey(date, leaguesParam);
  if (CACHE[cacheId]) return res.json(CACHE[cacheId]);

  const games = [];

  for (const league of LEAGUES.filter(l => leaguesParam.includes(l.key))) {
    try {
      // -----------------------------
      // Spiele von SoccerData API abrufen
      // -----------------------------
      const matchesUrl = `https://api.soccerdataapi.com/matches/?auth_token=${SOCCERDATA_KEY}&league_id=${league.key}&date=${date}`;
      const matchResp = await fetch(matchesUrl, { headers: { "Accept-Encoding": "gzip" } });
      if (!matchResp.ok) continue;
      const matchData = await matchResp.json();
      if (!Array.isArray(matchData.results)) continue;

      for (const g of matchData.results) {
        const home = g.home_team;
        const away = g.away_team;

        // -----------------------------
        // Team xG & Stats aus SoccerData
        // -----------------------------
        const homeStatsUrl = `https://api.soccerdataapi.com/teams/statistics/?auth_token=${SOCCERDATA_KEY}&team_id=${g.home_team_id}&league_id=${g.league_id}`;
        const awayStatsUrl = `https://api.soccerdataapi.com/teams/statistics/?auth_token=${SOCCERDATA_KEY}&team_id=${g.away_team_id}&league_id=${g.league_id}`;

        const [homeStatsResp, awayStatsResp] = await Promise.all([
          fetch(homeStatsUrl, { headers: { "Accept-Encoding": "gzip" } }),
          fetch(awayStatsUrl, { headers: { "Accept-Encoding": "gzip" } })
        ]);
        const homeStats = await homeStatsResp.json();
        const awayStats = await awayStatsResp.json();

        // Realistische xG schätzen (z.B. avg_goals_scored + weighted opponent defense)
        const homeXG = homeStats.avg_goals_scored || 1.4;
        const awayXG = awayStats.avg_goals_scored || 1.2;

        // -----------------------------
        // Odds von TheOddsAPI abrufen
        // -----------------------------
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/${league.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
        const oddsResp = await fetch(oddsUrl);
        if (!oddsResp.ok) continue;
        const oddsData = await oddsResp.json();
        const book = oddsData.find(o => o.home_team === home && o.away_team === away)?.bookmakers?.[0];
        if (!book) continue;

        const h2h = book.markets?.find(m => m.key === "h2h")?.outcomes || [];
        const totals = book.markets?.find(m => m.key === "totals")?.outcomes || [];

        const odds = {
          home: h2h.find(o => o.name === home)?.price || 0,
          draw: h2h.find(o => o.name === "Draw")?.price || 0,
          away: h2h.find(o => o.name === away)?.price || 0,
          over25: totals.find(o => o.name === "Over" && o.point === 2.5)?.price || 0,
          under25: totals.find(o => o.name === "Under" && o.point === 2.5)?.price || 0,
        };

        // -----------------------------
        // Score-Matrix & Wahrscheinlichkeiten
        // -----------------------------
        const { mat } = scoreMatrix(homeXG, awayXG);
        const scoreProbs = probsFromMatrix(mat);

        const homeProb = scoreProbs.home;
        const drawProb = scoreProbs.draw;
        const awayProb = scoreProbs.away;
        const over25Prob = 1 - probTotalLeK(mat, 2);
        const bttsProb = calcBTTS(homeXG, awayXG);

        const sum1x2 = homeProb + drawProb + awayProb;
        const normHome = homeProb / sum1x2;
        const normDraw = drawProb / sum1x2;
        const normAway = awayProb / sum1x2;

        const prob = {
          home: normHome,
          draw: normDraw,
          away: normAway,
          over25: over25Prob,
          under25: 1 - over25Prob,
          btts: bttsProb
        };

        const value = {
          home: odds.home ? prob.home * odds.home - 1 : 0,
          draw: odds.draw ? prob.draw * odds.draw - 1 : 0,
          away: odds.away ? prob.away * odds.away - 1 : 0,
          over25: odds.over25 ? prob.over25 * odds.over25 - 1 : 0,
          under25: odds.under25 ? prob.under25 * odds.under25 - 1 : 0,
          btts: 0
        };

        games.push({
          home,
          away,
          league: league.name,
          commence_time: g.commence_time,
          homeLogo: `https://placehold.co/48x36?text=${home[0]}`,
          awayLogo: `https://placehold.co/48x36?text=${away[0]}`,
          odds,
          prob,
          value,
          homeXG: +homeXG.toFixed(2),
          awayXG: +awayXG.toFixed(2),
          totalXG: +(homeXG + awayXG).toFixed(2)
        });
      }
    } catch (err) {
      console.error(`Fehler ${league.name}:`, err.message);
    }
  }

  CACHE[cacheId] = { response: games };
  res.json({ response: games });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
