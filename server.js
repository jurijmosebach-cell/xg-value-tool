// server.js - ERWEITERTE VERSION mit historischen Daten & KI
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

if (!ODDS_API_KEY) console.error("FEHLER: ODDS_API_KEY fehlt!");
if (!API_FOOTBALL_KEY) console.error("FEHLER: API_FOOTBALL_KEY fehlt – Teamform deaktiviert.");

const PORT = process.env.PORT || 10000;
const DATA_DIR = path.join(__dirname, "data");
const TEAMS_FILE = path.join(DATA_DIR, "teams.json");
const HISTORICAL_FILE = path.join(DATA_DIR, "historical_stats.json");
const PERFORMANCE_FILE = path.join(DATA_DIR, "performance.json");

// Ligen-Daten (wie vorher)
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", id: 39, baseXG: [1.65, 1.30], avgGoals: 2.85 },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", id: 78, baseXG: [1.75, 1.45], avgGoals: 3.20 },
  { key: "soccer_germany_2_bundesliga", name: "2. Bundesliga", id: 79, baseXG: [1.60, 1.50], avgGoals: 3.10 },
  { key: "soccer_spain_la_liga", name: "La Liga", id: 140, baseXG: [1.50, 1.25], avgGoals: 2.75 },
  { key: "soccer_italy_serie_a", name: "Serie A", id: 135, baseXG: [1.55, 1.30], avgGoals: 2.85 },
  { key: "soccer_france_ligue_one", name: "Ligue 1", id: 61, baseXG: [1.50, 1.25], avgGoals: 2.75 },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", id: 88, baseXG: [1.70, 1.55], avgGoals: 3.25 },
  { key: "soccer_portugal_primeira_liga", name: "Primeira Liga", id: 94, baseXG: [1.55, 1.35], avgGoals: 2.90 },
  { key: "soccer_belgium_first_div", name: "Jupiler Pro League", id: 144, baseXG: [1.60, 1.45], avgGoals: 3.05 },
  { key: "soccer_uefa_champs_league", name: "Champions League", id: 2, baseXG: [1.60, 1.40], avgGoals: 3.00 },
];

const CACHE = {};
const TEAM_CACHE = {};
let TEAM_IDS = {};
let HISTORICAL_STATS = {};
let PERFORMANCE_DATA = {};

// NEUE FUNKTION: Lade historische Daten
async function loadHistoricalData() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

    // Historische Team-Stats
    if (fs.existsSync(HISTORICAL_FILE)) {
        HISTORICAL_STATS = JSON.parse(fs.readFileSync(HISTORICAL_FILE, "utf-8"));
        console.log(`✅ Historische Daten geladen: ${Object.keys(HISTORICAL_STATS).length} Teams`);
    } else {
        // Initialisiere mit Basis-Daten
        HISTORICAL_STATS = {};
        console.log("ℹ️  Keine historischen Daten gefunden - starte mit Basis-Werten");
    }

    // Performance-Daten
    if (fs.existsSync(PERFORMANCE_FILE)) {
        PERFORMANCE_DATA = JSON.parse(fs.readFileSync(PERFORMANCE_FILE, "utf-8"));
        console.log(`✅ Performance-Daten geladen: ${Object.keys(PERFORMANCE_DATA.predictions || {}).length} Tage`);
    } else {
        PERFORMANCE_DATA = {
            predictions: {},
            overall: { total: 0, correct: 0, accuracy: 0 }
        };
    }
}

// NEUE FUNKTION: KI-Risiko-Analyse
function analyzeRisk(game) {
    const { prob, value, homeXG, awayXG, form } = game;
    
    // Risiko-Faktoren berechnen
    const factors = {
        // Hohes Risiko bei nahen Wahrscheinlichkeiten
        closeProb: Math.abs(prob.home - prob.away) < 0.2 ? 0.8 : 0.2,
        
        // Hohes Risiko bei niedrigen xG-Werten
        lowXG: (homeXG + awayXG) < 2.0 ? 0.7 : 0.1,
        
        // Risiko bei schlechter Form
        poorForm: (form.home < 0.3 || form.away < 0.3) ? 0.6 : 0.1,
        
        // Risiko bei negativer Value
        negativeValue: Object.values(value).some(v => v < -0.3) ? 0.9 : 0.1
    };
    
    // Gesamt-Risiko-Score (0-1, 1 = hohes Risiko)
    const riskScore = (factors.closeProb + factors.lowXG + factors.poorForm + factors.negativeValue) / 4;
    
    return {
        score: riskScore,
        level: riskScore > 0.7 ? "SEHR HOCH" : riskScore > 0.5 ? "HOCH" : riskScore > 0.3 ? "MEDIUM" : "NIEDRIG",
        factors: factors
    };
}

// NEUE FUNKTION: KI-Empfehlungen
function getAIRecommendation(game) {
    const risk = analyzeRisk(game);
    const { prob, value } = game;
    
    // Finde beste Wetten basierend auf Value + Wahrscheinlichkeit
    const markets = [
        { type: "1", prob: prob.home, value: value.home },
        { type: "X", prob: prob.draw, value: value.draw },
        { type: "2", prob: prob.away, value: value.away },
        { type: "Over 2.5", prob: prob.over25, value: value.over25 },
        { type: "BTTS Ja", prob: prob.btts, value: value.btts }
    ];
    
    // Bewertungssystem: Probability * (1 + Value)
    const ratedMarkets = markets.map(market => ({
        ...market,
        score: market.prob * (1 + Math.max(0, market.value))
    })).sort((a, b) => b.score - a.score);
    
    const bestMarket = ratedMarkets[0];
    const secondBest = ratedMarkets[1];
    
    // KI-Entscheidungslogik
    let recommendation, reasoning, confidence;
    
    if (risk.score < 0.3 && bestMarket.score > 0.6) {
        recommendation = "STRONG_BET";
        confidence = "SEHR HOCH";
        reasoning = `Klare Kante: ${bestMarket.type} mit hoher Wahrscheinlichkeit (${(bestMarket.prob * 100).toFixed(1)}%) und guter Value`;
    } 
    else if (risk.score < 0.5 && bestMarket.score > 0.45 && bestMarket.value > 0.1) {
        recommendation = "VALUE_BET";
        confidence = "HOCH";
        reasoning = `Gute Value Chance: ${bestMarket.type} bietet ${(bestMarket.value * 100).toFixed(1)}% Value bei solider Wahrscheinlichkeit`;
    }
    else if (risk.score < 0.6 && bestMarket.score > 0.35) {
        recommendation = "CAUTIOUS_BET";
        confidence = "MEDIUM";
        reasoning = `Vorsichtige Empfehlung: ${bestMarket.type} - beobachte die Quotenentwicklung`;
    }
    else {
        recommendation = "AVOID";
        confidence = "NIEDRIG";
        reasoning = `Risiko zu hoch: Keine klare Kante erkennbar (Risiko: ${risk.level})`;
    }
    
    // Alternative Empfehlung falls verfügbar
    const alternative = secondBest && secondBest.score > 0.4 ? secondBest.type : null;
    
    return {
        recommendation,
        confidence,
        reasoning,
        bestMarket: bestMarket.type,
        bestScore: bestMarket.score,
        risk: risk,
        alternative,
        timestamp: new Date().toISOString()
    };
}

// NEUE FUNKTION: Verbesserte xG-Berechnung mit historischen Daten
function enhancedXGCalculation(odds, league, homeForm, awayForm, homeTeam, awayTeam) {
    const baseExpected = expectedGoals(odds.home, odds.away, league.avgGoals, homeForm, awayForm);
    
    // HISTORISCHE ANPASSUNGEN
    let historicalAdjustment = 0;
    
    // Prüfe ob historische Daten für Teams verfügbar
    if (HISTORICAL_STATS[homeTeam]) {
        historicalAdjustment += HISTORICAL_STATS[homeTeam].homeAdvantage || 0;
    }
    if (HISTORICAL_STATS[awayTeam]) {
        historicalAdjustment -= HISTORICAL_STATS[awayTeam].awayDisadvantage || 0;
    }
    
    const homeAdvantage = 0.2 + (historicalAdjustment * 0.1);
    const formImpact = (homeForm - 0.5) * 0.6;
    
    return {
        home: Math.max(0.3, baseExpected.home + homeAdvantage + formImpact),
        away: Math.max(0.2, baseExpected.away - (homeAdvantage * 0.5) + ((awayForm - 0.5) * 0.6))
    };
}

// NEUE FUNKTION: Speichere Vorhersagen für Tracking
function savePrediction(date, games) {
    const predictions = games.map(g => ({
        home: g.home,
        away: g.away,
        league: g.league,
        predicted: {
            winner: g.prob.home > g.prob.away && g.prob.home > g.prob.draw ? 'home' : 
                    g.prob.away > g.prob.home && g.prob.away > g.prob.draw ? 'away' : 'draw',
            over25: g.prob.over25 > 0.5,
            btts: g.prob.btts > 0.5
        },
        probabilities: g.prob,
        aiRecommendation: g.aiRecommendation,
        timestamp: new Date().toISOString()
    }));
    
    PERFORMANCE_DATA.predictions[date] = predictions;
    
    // Speichere Performance-Daten
    fs.writeFileSync(PERFORMANCE_FILE, JSON.stringify(PERFORMANCE_DATA, null, 2));
}

// NEUE ROUTE: Performance-Daten abrufen
app.get("/api/performance", (req, res) => {
    res.json(PERFORMANCE_DATA);
});

// NEUE ROUTE: Historische Daten aktualisieren
app.post("/api/update-stats", express.json(), (req, res) => {
    const { team, stats } = req.body;
    
    if (!HISTORICAL_STATS[team]) {
        HISTORICAL_STATS[team] = {};
    }
    
    Object.assign(HISTORICAL_STATS[team], stats);
    fs.writeFileSync(HISTORICAL_FILE, JSON.stringify(HISTORICAL_STATS, null, 2));
    
    res.json({ success: true, message: `Stats für ${team} aktualisiert` });
});

// Mathefunktionen (wie vorher)
function factorial(n) { 
    if (n === 0) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

function poisson(k, λ) { 
    return (Math.pow(λ, k) * Math.exp(-λ)) / factorial(k); 
}

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

// Teams speichern/laden (wie vorher)
async function loadOrFetchTeams(forceReload = false) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

    if (fs.existsSync(TEAMS_FILE) && !forceReload) {
        TEAM_IDS = JSON.parse(fs.readFileSync(TEAMS_FILE, "utf-8"));
        return;
    }

    if (!API_FOOTBALL_KEY) return;

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
        } catch (err) {
            console.error(`Fehler beim Laden ${league.name}:`, err.message);
        }
    }

    TEAM_IDS = allTeams;
    fs.writeFileSync(TEAMS_FILE, JSON.stringify(allTeams, null, 2));
}

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
        console.error("Fehler getTeamForm:", err.message);
        return 0.5;
    }
}

// Haupt-API Route (erweitert)
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

                // VERBESSERT: Enhanced xG mit historischen Daten
                const expected = enhancedXGCalculation(odds, league, homeForm, awayForm, home, away);
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

                // NEU: KI-Empfehlung hinzufügen
                const aiRecommendation = getAIRecommendation({
                    home, away, league: league.name, odds, prob, value, homeXG, awayXG, form: { home: homeForm, away: awayForm }
                });

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
                    aiRecommendation // NEU: KI-Empfehlung
                });
            }
        } catch (err) {
            console.error(`Fehler in ${league.name}:`, err.message);
        }
    }

    // NEU: Speichere Vorhersagen für Tracking
    savePrediction(date, games);

    CACHE[cacheId] = { response: games };
    res.json({ response: games });
});

// Start
await loadOrFetchTeams();
await loadHistoricalData();
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT} (mit KI & historischen Daten)`));
