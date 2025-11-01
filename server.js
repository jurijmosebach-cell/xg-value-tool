// server.js (Plug & Play) - TheOddsAPI + SoccerDataAPI integration
import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(__dirname));

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const SOCCERDATA_API_KEY = process.env.SOCCERDATA_API_KEY;
const PORT = process.env.PORT || 10000;

if (!ODDS_API_KEY) console.warn("WARN: ODDS_API_KEY not set in .env");
if (!SOCCERDATA_API_KEY) console.warn("WARN: SOCCERDATA_API_KEY not set in .env");

// -----------------------------
// Your leagues (keep as before) + soccerdata league_id mapping
// -----------------------------
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", baseXG: [1.55, 1.25], sd_id: 228 },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", baseXG: [1.60, 1.35], sd_id: 195 },
  { key: "soccer_germany_2_bundesliga", name: "2. Bundesliga", baseXG: [1.55, 1.45], sd_id: 196 },
  { key: "soccer_spain_la_liga", name: "La Liga", baseXG: [1.45, 1.20], sd_id: 140 },
  { key: "soccer_italy_serie_a", name: "Serie A", baseXG: [1.45, 1.25], sd_id: 135 },
  { key: "soccer_france_ligue_one", name: "Ligue 1", baseXG: [1.55, 1.35], sd_id: 61 },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", baseXG: [1.70, 1.45], sd_id: 88 },
  { key: "soccer_sweden_allsvenskan", name: "Allsvenskan", baseXG: [1.55, 1.45], sd_id: 113 },
  { key: "soccer_turkey_super_league", name: "Turkey Süper Lig", baseXG: [1.55,1.35], sd_id: 203 },
  { key: "soccer_uefa_europa_conference_league", name: "UEFA Europa Conference League", baseXG: [1.35,1.15], sd_id: 198 },
  { key: "soccer_uefa_champs_league", name: "UEFA Champions League", baseXG: [1.45,1.25], sd_id: 310 },
  { key: "soccer_uefa_champs_league_qualification", name: "Champions League Qualification", baseXG: [1.30,1.10], sd_id: 3 },
  { key: "soccer_usa_mls", name: "Major League Soccer (USA)", baseXG: [1.40,1.25], sd_id: 168 },
];

// -----------------------------
// Simple in-memory cache
// -----------------------------
const CACHE = {};
function cacheKey(date, leagues) {
  return `${date}::${leagues.sort().join(",")}`;
}
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

// -----------------------------
// Math helpers (Poisson, score matrix, BTTS)
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
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      if (i + j <= k) s += mat[i][j];
    }
  }
  return s;
}

function probsFromMatrix(mat) {
  let ph = 0, pd = 0, pa = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      if (i > j) ph += mat[i][j];
      else if (i === j) pd += mat[i][j];
      else pa += mat[i][j];
    }
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
// SoccerData helpers
// -----------------------------
const SD_BASE = "https://api.soccerdataapi.com";

async function sdFetchJson(endpoint, params = {}) {
  // params -> include auth_token
  params.auth_token = SOCCERDATA_API_KEY;
  const url = new URL(`${SD_BASE}${endpoint}`);
  Object.entries(params).forEach(([k,v]) => url.searchParams.append(k,v));
  const res = await fetch(url.toString(), {
    headers: { "Accept-Encoding": "gzip", "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`SoccerData ${res.status} ${res.statusText}`);
  return res.json();
}

// Fetch matches for a league & date (SoccerData)
async function fetchSoccerDataMatches(league_sd_id, date) {
  // endpoint: /matches/?league_id=...&date=...
  try {
    const json = await sdFetchJson("/matches/", { league_id: league_sd_id, date });
    // response shape: array with objects { league_id, league_name, matches: [...] }
    return json?.[0]?.matches || [];
  } catch (err) {
    console.warn("SoccerData matches error:", err.message);
    return [];
  }
}

// Fetch detailed match info by match_id (SoccerData) to get stats/xG if present
async function fetchSoccerMatchDetail(match_id) {
  try {
    const json = await sdFetchJson("/match/", { match_id });
    return json || null;
  } catch (err) {
    console.warn("SoccerData match detail error:", err.message);
    return null;
  }
}

// -----------------------------
// TheOddsAPI helpers
// -----------------------------
const ODDS_BASE = "https://api.the-odds-api.com/v4";

async function fetchOddsForLeague(leagueKey) {
  try {
    const url = `${ODDS_BASE}/sports/${leagueKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("OddsAPI status", res.status);
      return [];
    }
    return res.json();
  } catch (err) {
    console.warn("Odds API error:", err.message);
    return [];
  }
}

// -----------------------------
// Main API: /api/games?date=YYYY-MM-DD&leagues=comma,separated,keys
// Returns: { response: games, topByProb, topByValue }
// -----------------------------
app.get("/api/games", async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0,10);
    const date = req.query.date || today;
    const leaguesParam = req.query.leagues ? req.query.leagues.split(",") : LEAGUES.map(l=>l.key);
    const key = cacheKey(date, leaguesParam);

    // cache hit (fresh)
    if (CACHE[key] && (Date.now() - CACHE[key].ts < CACHE_TTL)) {
      // return cached object
      return res.json(CACHE[key].value);
    }

    const allGames = [];

    // For each requested league: pull soccerdata matches + odds
    for (const leagueKey of leaguesParam) {
      const league = LEAGUES.find(l => l.key === leagueKey);
      if (!league) continue;

      const sdMatches = await fetchSoccerDataMatches(league.sd_id, date); // array of matches
      const oddsData = await fetchOddsForLeague(league.key); // array from odds api

      // Build lookup by teams or kickoff
      for (const m of sdMatches) {
        // m typically contains id, date, time, teams: { home:{id,name}, away:{id,name} }
        const homeName = m.teams?.home?.name || m.home?.name || m.home_team?.name;
        const awayName = m.teams?.away?.name || m.away?.name || m.away_team?.name;

        // Try to find corresponding odds entry (match by team names, case-insensitive contains)
        const oddsMatch = oddsData.find(o => {
          const h = (o.home_team || "").toString().toLowerCase();
          const a = (o.away_team || "").toString().toLowerCase();
          return (homeName && h.includes(homeName.toLowerCase())) || (awayName && a.includes(awayName.toLowerCase()))
            || (homeName && a.includes(homeName.toLowerCase())) || (awayName && h.includes(awayName.toLowerCase()));
        });

        // If no odds found, skip (we rely on odds for value calc)
        if (!oddsMatch) continue;

        const book = oddsMatch.bookmakers?.[0] || {};
        const h2h = book.markets?.find(x=>x.key==="h2h") || { outcomes: [] };
        const totals = book.markets?.find(x=>x.key==="totals") || { outcomes: [] };

        const odds = {
          home: h2h.outcomes?.find(o=>o.name === (homeName) )?.price || h2h.outcomes?.[0]?.price || 0,
          draw: h2h.outcomes?.find(o=>/draw/i.test(o.name))?.price || h2h.outcomes?.[1]?.price || 0,
          away: h2h.outcomes?.find(o=>o.name === (awayName) )?.price || h2h.outcomes?.[2]?.price || 0,
          over25: totals.outcomes?.find(o=>o.name==="Over" && o.point===2.5)?.price || 0,
          under25: totals.outcomes?.find(o=>o.name==="Under" && o.point===2.5)?.price || 0,
        };

        // Try to fetch match detail from soccerdata (gives richer stats)
        let homeXG = null, awayXG = null;
        const matchId = m.id || m.match_id || m.id_match;
        if (matchId) {
          const detail = await fetchSoccerMatchDetail(matchId);
          // Attempt several common paths where xG might be present
          // 1) detail.match_data.stats.home.xg or similar
          // 2) detail.teams.home.stats.xg
          // 3) detail.teams.home.xg
          try {
            homeXG = detail?.match_data?.stats?.home?.xg ?? detail?.teams?.home?.stats?.xg ?? detail?.teams?.home?.xg ?? null;
            awayXG = detail?.match_data?.stats?.away?.xg ?? detail?.teams?.away?.stats?.xg ?? detail?.teams?.away?.xg ?? null;
          } catch(e){ /* ignore */ }
        }

        // If xG not available, fallback to league base + odds implied
        if (homeXG == null || awayXG == null) {
          const impliedHome = odds.home ? 1/odds.home : 0.5;
          const impliedAway = odds.away ? 1/odds.away : 0.5;
          const ratio = (impliedHome) / (impliedHome + impliedAway || 1);
          const baseHome = league.baseXG[0];
          const baseAway = league.baseXG[1];
          homeXG = Math.max(0.1, baseHome + (ratio - 0.5) * 0.9);
          awayXG = Math.max(0.05, baseAway - (ratio - 0.5) * 0.9);
        }

        // Score matrix / probabilities (Poisson)
        const { mat, coveredProb } = scoreMatrix(homeXG, awayXG);
        const scoreProbs = probsFromMatrix(mat);
        const sum1x2 = scoreProbs.home + scoreProbs.draw + scoreProbs.away || 1;
        const prob = {
          home: scoreProbs.home / sum1x2,
          draw: scoreProbs.draw / sum1x2,
          away: scoreProbs.away / sum1x2,
          over25: 1 - probTotalLeK(mat,2),
          under25: probTotalLeK(mat,2),
          btts: calcBTTS(homeXG, awayXG),
        };

        // Value calculation
        const value = {
          home: odds.home ? prob.home * odds.home - 1 : 0,
          draw: odds.draw ? prob.draw * odds.draw - 1 : 0,
          away: odds.away ? prob.away * odds.away - 1 : 0,
          over25: odds.over25 ? prob.over25 * odds.over25 - 1 : 0,
          under25: odds.under25 ? prob.under25 * odds.under25 - 1 : 0,
          btts: 0,
        };

        // try to extract bothteams_to_score market if present
        const bttsMarket = book.markets?.find(mk => mk.key === "bothteams_to_score" || mk.key === "btts");
        if (bttsMarket) {
          const yes = bttsMarket.outcomes?.find(o => /yes/i.test(o.name));
          if (yes && yes.price) value.btts = prob.btts * yes.price - 1;
        }

        // best value
        const entries = [
          {key:'home', val:value.home},
          {key:'draw', val:value.draw},
          {key:'away', val:value.away},
          {key:'over25', val:value.over25},
          {key:'under25', val:value.under25},
          {key:'btts', val:value.btts},
        ].sort((a,b)=> b.val - a.val);

        const best = entries[0];

        const gameObj = {
          home: homeName,
          away: awayName,
          league: league.name,
          commence_time: m.date ? `${m.date} ${m.time||''}` : (m.date || null),
          homeLogo: m.teams?.home?.logo || null,
          awayLogo: m.teams?.away?.logo || null,
          odds,
          prob,
          value,
          bestValueMarket: best.key,
          bestValueAmount: +best.val.toFixed(4),
          isValue: best.val > 0,
          homeXG: +parseFloat(homeXG).toFixed(2),
          awayXG: +parseFloat(awayXG).toFixed(2),
          totalXG: +(parseFloat(homeXG)+parseFloat(awayXG)).toFixed(2),
          coveredProb: +coveredProb.toFixed(4),
        };

        allGames.push(gameObj);
      } // end for matches
    } // end for leagues

    // Build top lists
    const topByProb = {
      home: topNByProb(allGames, "prob.home"),
      draw: topNByProb(allGames, "prob.draw"),
      over25: topNByProb(allGames, "prob.over25"),
      btts: topNByProb(allGames, "prob.btts"),
    };
    const topByValue = {
      home: topNByValue(allGames, "home"),
      draw: topNByValue(allGames, "draw"),
      over25: topNByValue(allGames, "over25"),
      btts: topNByValue(allGames, "btts"),
    };

    const payload = {
      response: allGames,
      topByProb,
      topByValue,
    };

    // cache and return
    CACHE[key] = { ts: Date.now(), value: payload };
    return res.json(payload);

  } catch (err) {
    console.error("Server /api/games error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// Helper: top lists
// -----------------------------
function topNByProb(arr, path, n=5) {
  // path e.g. "prob.home" or "prob.over25"
  const [root, sub] = path.split(".");
  return [...arr]
    .filter(g => g[root] && typeof g[root][sub] === "number")
    .sort((a,b) => (b[root][sub] - a[root][sub]))
    .slice(0,n)
    .map(g => ({
      home: g.home,
      away: g.away,
      league: g.league,
      commence_time: g.commence_time,
      prob: +(g[root][sub]*100).toFixed(2),
      odds: g.odds,
      bestValueMarket: g.bestValueMarket,
      bestValueAmount: g.bestValueAmount,
      isValue: g.isValue,
    }));
}

function topNByValue(arr, marketKey, n=5) {
  return [...arr]
    .filter(g => typeof g.value[marketKey] === "number")
    .sort((a,b)=> b.value[marketKey] - a.value[marketKey])
    .slice(0,n)
    .map(g => ({
      home: g.home,
      away: g.away,
      league: g.league,
      commence_time: g.commence_time,
      value: +g.value[marketKey].toFixed(4),
      prob: +( (marketKey === "btts") ? g.prob.btts : g.prob[marketKey] ) * 100 .toFixed(2),
      odds: g.odds,
      bestValueMarket: g.bestValueMarket,
      bestValueAmount: g.bestValueAmount,
      isValue: g.isValue,
    }));
}

// -----------------------------
// Static catch-all + start
// -----------------------------
app.get("*", (req, res) => res.sendFile(path.join(__dirname,"index.html")));

app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
