// server.js - ERWEITERTE VERSION mit 40+ Ligen
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

if (!ODDS_API_KEY) console.error("❌ FEHLER: ODDS_API_KEY fehlt!");
if (!API_FOOTBALL_KEY) console.error("⚠️ FEHLER: API_FOOTBALL_KEY fehlt – Teamform deaktiviert.");

const PORT = process.env.PORT || 10000;
const DATA_DIR = path.join(__dirname, "data");
const TEAMS_FILE = path.join(DATA_DIR, "teams.json");

// ERWEITERTE Ligen-Daten mit 40+ Ligen
const LEAGUES = [
  // EUROPÄISCHE TOP-LIGEN
  { key: "soccer_epl", name: "Premier League", id: 39, baseXG: [1.65, 1.30], avgGoals: 2.85 },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", id: 78, baseXG: [1.75, 1.45], avgGoals: 3.20 },
  { key: "soccer_germany_2_bundesliga", name: "2. Bundesliga", id: 79, baseXG: [1.60, 1.50], avgGoals: 3.10 },
  { key: "soccer_spain_la_liga", name: "La Liga", id: 140, baseXG: [1.50, 1.25], avgGoals: 2.75 },
  { key: "soccer_italy_serie_a", name: "Serie A", id: 135, baseXG: [1.55, 1.30], avgGoals: 2.85 },
  { key: "soccer_france_ligue_one", name: "Ligue 1", id: 61, baseXG: [1.50, 1.25], avgGoals: 2.75 },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", id: 88, baseXG: [1.70, 1.55], avgGoals: 3.25 },
  { key: "soccer_portugal_primeira_liga", name: "Primeira Liga", id: 94, baseXG: [1.55, 1.35], avgGoals: 2.90 },
  { key: "soccer_belgium_first_div", name: "Jupiler Pro League", id: 144, baseXG: [1.60, 1.45], avgGoals: 3.05 },
  
  // EUROPÄISCHE MITTELKLASSE
  { key: "soccer_russia_premier_league", name: "Russian Premier League", id: 235, baseXG: [1.45, 1.25], avgGoals: 2.70 },
  { key: "soccer_switzerland_superleague", name: "Swiss Super League", id: 207, baseXG: [1.60, 1.50], avgGoals: 3.10 },
  { key: "soccer_austria_bundesliga", name: "Austrian Bundesliga", id: 218, baseXG: [1.65, 1.55], avgGoals: 3.20 },
  { key: "soccer_denmark_superliga", name: "Danish Superliga", id: 119, baseXG: [1.55, 1.45], avgGoals: 3.00 },
  { key: "soccer_norway_eliteserien", name: "Eliteserien", id: 103, baseXG: [1.60, 1.50], avgGoals: 3.10 },
  { key: "soccer_sweden_allsvenskan", name: "Allsvenskan", id: 113, baseXG: [1.55, 1.45], avgGoals: 3.00 },
  { key: "soccer_finland_veikkausliiga", name: "Veikkausliiga", id: 322, baseXG: [1.50, 1.40], avgGoals: 2.90 },
  { key: "soccer_poland_ekstraklasa", name: "Ekstraklasa", id: 106, baseXG: [1.45, 1.35], avgGoals: 2.80 },
  { key: "soccer_czech_liga", name: "Czech First League", id: 345, baseXG: [1.50, 1.40], avgGoals: 2.90 },
  { key: "soccer_greece_super_league", name: "Super League Greece", id: 197, baseXG: [1.40, 1.25], avgGoals: 2.65 },
  { key: "soccer_turkey_super_league", name: "Süper Lig", id: 203, baseXG: [1.55, 1.40], avgGoals: 2.95 },
  
  // UK & IRELAND
  { key: "soccer_efl_champ", name: "Championship", id: 40, baseXG: [1.50, 1.35], avgGoals: 2.85 },
  { key: "soccer_england_league1", name: "League One", id: 41, baseXG: [1.45, 1.30], avgGoals: 2.75 },
  { key: "soccer_england_league2", name: "League Two", id: 42, baseXG: [1.40, 1.25], avgGoals: 2.65 },
  { key: "soccer_scotland_premier_league", name: "Scottish Premiership", id: 179, baseXG: [1.55, 1.35], avgGoals: 2.90 },
  { key: "soccer_ireland_premier_division", name: "League of Ireland", id: 382, baseXG: [1.45, 1.35], avgGoals: 2.80 },
  
  // SÜDAMERIKA
  { key: "soccer_brazil_campeonato", name: "Brasileirão", id: 71, baseXG: [1.45, 1.30], avgGoals: 2.75 },
  { key: "soccer_argentina_primera_division", name: "Liga Profesional", id: 128, baseXG: [1.40, 1.25], avgGoals: 2.65 },
  { key: "soccer_colombia_primera_a", name: "Liga Dimayor", id: 239, baseXG: [1.35, 1.20], avgGoals: 2.55 },
  { key: "soccer_mexico_ligamx", name: "Liga MX", id: 262, baseXG: [1.50, 1.35], avgGoals: 2.85 },
  { key: "soccer_usa_mls", name: "MLS", id: 253, baseXG: [1.60, 1.45], avgGoals: 3.05 },
  
  // ASIEN & ANDERE
  { key: "soccer_japan_j1_league", name: "J1 League", id: 98, baseXG: [1.55, 1.40], avgGoals: 2.95 },
  { key: "soccer_korea_kleague1", name: "K League 1", id: 292, baseXG: [1.45, 1.35], avgGoals: 2.80 },
  { key: "soccer_australia_aleague", name: "A-League", id: 203, baseXG: [1.60, 1.50], avgGoals: 3.10 },
  { key: "soccer_saudi_arabia_pro_league", name: "Saudi Pro League", id: 307, baseXG: [1.50, 1.40], avgGoals: 2.90 },
  { key: "soccer_uae_pro_league", name: "UAE Pro League", id: 348, baseXG: [1.45, 1.35], avgGoals: 2.80 },
  
  // EUROPAPOKAL & WETTBEWERBE
  { key: "soccer_uefa_champs_league", name: "Champions League", id: 2, baseXG: [1.60, 1.40], avgGoals: 3.00 },
  { key: "soccer_uefa_europa_league", name: "Europa League", id: 3, baseXG: [1.55, 1.35], avgGoals: 2.90 },
  { key: "soccer_uefa_europa_conference_league", name: "Conference League", id: 848, baseXG: [1.50, 1.30], avgGoals: 2.80 },
  { key: "soccer_uefa_champs_league_qualification", name: "CL Qualification", id: 17, baseXG: [1.45, 1.25], avgGoals: 2.70 },
  { key: "soccer_fifa_world_cup", name: "World Cup", id: 15, baseXG: [1.40, 1.20], avgGoals: 2.60 },
  { key: "soccer_euro", name: "European Championship", id: 10, baseXG: [1.45, 1.25], avgGoals: 2.70 },
  { key: "soccer_copa_america", name: "Copa America", id: 9, baseXG: [1.40, 1.20], avgGoals: 2.60 },
];

const CACHE = {};
const TEAM_CACHE = {};
let TEAM_IDS = {};

// VERBESSERTE Mathefunktionen
function factorial(n) { 
  if (n === 0) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function poisson(k, λ) { 
  return (Math.pow(λ, k) * Math.exp(-λ)) / factorial(k); 
}

// VERBESSERTE Wahrscheinlichkeitsberechnung
function computeMatchProb(homeXG, awayXG, homeForm = 0.5, awayForm = 0.5, max = 8) {
  let pHome = 0, pDraw = 0, pAway = 0;
  
  const homeAdj = homeXG * (0.8 + homeForm * 0.4);
  const awayAdj = awayXG * (0.8 + awayForm * 0.4);
  
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      const p = poisson(h, homeAdj) * poisson(a, awayAdj);
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
    }
  }
  
  const total = pHome + pDraw + pAway;
  return { 
    home: pHome / total, 
    draw: pDraw / total, 
    away: pAway / total 
  };
}

// VERBESSERTE Over/Under Berechnung
function probOver25(homeXG, awayXG, homeForm = 0.5, awayForm = 0.5, max = 8) {
  let p = 0;
  const homeAdj = homeXG * (0.9 + homeForm * 0.2);
  const awayAdj = awayXG * (0.9 + awayForm * 0.2);
  
  for (let h = 0; h <= max; h++) {
    for (let a = 0; a <= max; a++) {
      if (h + a > 2.5) p += poisson(h, homeAdj) * poisson(a, awayAdj);
    }
  }
  return Math.min(p, 0.95);
}

// VERBESSERTE BTTS Berechnung
function bttsProbExact(homeXG, awayXG, homeForm = 0.5, awayForm = 0.5, max = 6) {
  let p = 0;
  const homeAdj = homeXG * (0.85 + homeForm * 0.3);
  const awayAdj = awayXG * (0.85 + awayForm * 0.3);
  
  for (let h = 1; h <= max; h++) {
    for (let a = 1; a <= max; a++) {
      p += poisson(h, homeAdj) * poisson(a, awayAdj);
    }
  }
  return Math.min(p, 0.90);
}

// NEUE Funktion: Erwartete Tore berechnen
function expectedGoals(homeOdds, awayOdds, leagueAvgGoals, homeForm, awayForm) {
  const impliedHome = 1 / homeOdds;
  const impliedAway = 1 / awayOdds;
  const totalImplied = impliedHome + impliedAway;
  
  const homeShare = impliedHome / totalImplied;
  const awayShare = impliedAway / totalImplied;
  
  const baseHomeXG = (leagueAvgGoals * homeShare) * (0.9 + homeForm * 0.2);
  const baseAwayXG = (leagueAvgGoals * awayShare) * (0.9 + awayForm * 0.2);
  
  return {
    home: Math.max(0.3, Math.min(3.5, baseHomeXG)),
    away: Math.max(0.2, Math.min(3.0, baseAwayXG))
  };
}

// Teams speichern/laden
async function loadOrFetchTeams(forceReload = false) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  if (fs.existsSync(TEAMS_FILE) && !forceReload) {
    console.log("📂 Lade gespeicherte teams.json ...");
    TEAM_IDS = JSON.parse(fs.readFileSync(TEAMS_FILE, "utf-8"));
    console.log(`✅ ${Object.keys(TEAM_IDS).length} Teams aus Datei geladen.`);
    return;
  }

  if (!API_FOOTBALL_KEY) return;

  console.log("📡 Lade Teamdaten aus API-Football ...");
  const headers = { "x-apisports-key": API_FOOTBALL_KEY };
  const allTeams = {};

  for (const league of LEAGUES) {
    try {
      const res = await fetch(
        `https://v3.football.api-sports.io/teams?league=${league.id}&season=2024`,
        { headers }
      );
      const data = await res.json();
      const teams = data?.response || [];
      teams.forEach(t => {
        const name = t.team.name.trim();
        allTeams[name] = t.team.id;
      });
      console.log(`✅ ${league.name}: ${teams.length} Teams geladen.`);
    } catch (err) {
      console.error(`❌ Fehler beim Laden ${league.name}:`, err.message);
    }
  }

  TEAM_IDS = allTeams;
  fs.writeFileSync(TEAMS_FILE, JSON.stringify(allTeams, null, 2));
  console.log(`💾 Gespeichert unter data/teams.json (${Object.keys(allTeams).length} Teams).`);
}

// VERBESSERTE Teamform Berechnung
async function getTeamForm(teamName) {
  const teamId = TEAM_IDS[teamName];
  if (!teamId || !API_FOOTBALL_KEY) return 0.5;
  if (TEAM_CACHE[teamId]) return TEAM_CACHE[teamId];

  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&last=8&status=ft`,
      { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
    );
    const data = await res.json();
    const fixtures = data?.response || [];
    if (!fixtures.length) return 0.5;

    let formScore = 0;
    let totalWeight = 0;

    fixtures.forEach((f, index) => {
      const weight = 1 - (index * 0.1);
      const isHome = f.teams.home.id === teamId;
      const goalsFor = isHome ? f.goals.home : f.goals.away;
      const goalsAgainst = isHome ? f.goals.away : f.goals.home;
      
      let points = 0;
      if (goalsFor > goalsAgainst) points = 1.0;
      else if (goalsFor === goalsAgainst) points = 0.5;
      
      const goalDiffBonus = Math.min(0.2, (goalsFor - goalsAgainst) * 0.05);
      
      formScore += (points + goalDiffBonus) * weight;
      totalWeight += weight;
    });

    const normalizedScore = formScore / (totalWeight || 1);
    TEAM_CACHE[teamId] = Math.max(0.1, Math.min(0.9, normalizedScore));
    return TEAM_CACHE[teamId];
  } catch (err) {
    console.error("⚠️ Fehler getTeamForm:", err.message);
    return 0.5;
  }
}

// VERBESSERTE /api/games Route
app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  const leaguesParam = req.query.leagues
    ? req.query.leagues.split(",")
    : LEAGUES.map(l => l.key);

  const cacheId = `${date}_${leaguesParam.sort().join(",")}`;
  if (CACHE[cacheId]) return res.json(CACHE[cacheId]);

  const games = [];

  for (const league of LEAGUES.filter(l => leaguesParam.includes(l.key))) {
    try {
      const oddsUrl = `https://api.the-odds-api.com/v4/sports/${league.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
      const resOdds = await fetch(oddsUrl);
      if (!resOdds.ok) continue;
      const data = await resOdds.json();

      for (const g of data) {
        const gameDate = new Date(g.commence_time).toISOString().slice(0, 10);
        if (gameDate !== date) continue;

        const home = g.home_team;
        const away = g.away_team;
        const book = g.bookmakers?.[0];
        if (!book) continue;

        const h2h = book.markets?.find(m => m.key === "h2h")?.outcomes || [];
        const totals = book.markets?.find(m => m.key === "totals")?.outcomes || [];

        const odds = {
          home: h2h.find(o => o.name === home)?.price || 0,
          draw: h2h.find(o => o.name === "Draw")?.price || 0,
          away: h2h.find(o => o.name === away)?.price || 0,
          over25: totals.find(o => o.name === "Over" && o.point === 2.5)?.price || 0,
        };
        if (!odds.home || !odds.away) continue;

        const homeForm = await getTeamForm(home);
        const awayForm = await getTeamForm(away);

        const expected = expectedGoals(odds.home, odds.away, league.avgGoals, homeForm, awayForm);
        const homeXG = expected.home;
        const awayXG = expected.away;

        const prob = computeMatchProb(homeXG, awayXG, homeForm, awayForm);
        prob.over25 = probOver25(homeXG, awayXG, homeForm, awayForm);
        prob.btts = bttsProbExact(homeXG, awayXG, homeForm, awayForm);

        const value = {
          home: prob.home * odds.home - 1,
          draw: prob.draw * odds.draw - 1,
          away: prob.away * odds.away - 1,
          over25: prob.over25 * odds.over25 - 1,
          btts: prob.btts * odds.over25 - 1,
        };

        games.push({
          home,
          away,
          league: league.name,
          odds,
          prob,
          value,
          homeXG: +homeXG.toFixed(2),
          awayXG: +awayXG.toFixed(2),
          totalXG: +(homeXG + awayXG).toFixed(2),
          form: { home: homeForm, away: awayForm },
        });
      }
    } catch (err) {
      console.error(`❌ Fehler in ${league.name}:`, err.message);
    }
  }

  CACHE[cacheId] = { response: games };
  res.json({ response: games });
});

// Start
await loadOrFetchTeams();
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
