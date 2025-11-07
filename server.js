// server.js - ERWEITERTE VERSION mit Head-to-Head & Live-Statistiken
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
if (!API_FOOTBALL_KEY) console.error("FEHLER: API_FOOTBALL_KEY fehlt – Erweiterte Features deaktiviert.");

const PORT = process.env.PORT || 10000;
const DATA_DIR = path.join(__dirname, "data");
const TEAMS_FILE = path.join(DATA_DIR, "teams.json");
const HISTORICAL_FILE = path.join(DATA_DIR, "historical_stats.json");
const PERFORMANCE_FILE = path.join(DATA_DIR, "performance.json");

// Ligen-Daten
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", id: 39, baseXG: [1.65, 1.30], avgGoals: 2.85 },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", id: 78, baseXG: [1.75, 1.45], avgGoals: 3.20 },
  { key: "soccer_germany_2_bundesliga", name: "2. Bundesliga", id: 79, baseXG: [1.60, 1.50], avgGoals: 3.10 },
  { key: "soccer_spain_la_liga", name: "La Liga", id: 140, baseXG: [1.50, 1.25], avgGoals: 2.75 },
  { key: "soccer_italy_serie_a", name: "Serie A", id: 135, baseXG: [1.55, 1.30], avgGoals: 2.85 },
  { key: "soccer_france_ligue_one", name: "Ligue 1", id: 61, baseXG: [1.50, 1.25], avgGoals: 2.75 },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", id: 88, baseXG: [1.70, 1.55], avgGoals: 3.25 },
  { key: "soccer_uefa_champs_league", name: "Champions League", id: 2, baseXG: [1.60, 1.40], avgGoals: 3.00 },
];

const CACHE = {};
const TEAM_CACHE = {};
const H2H_CACHE = {};
let TEAM_IDS = {};
let HISTORICAL_STATS = {};
let PERFORMANCE_DATA = {};

// NEUE FUNKTION: Head-to-Head Daten abrufen
async function getHeadToHead(homeTeamId, awayTeamId) {
    const cacheKey = `${homeTeamId}-${awayTeamId}`;
    if (H2H_CACHE[cacheKey]) return H2H_CACHE[cacheKey];

    if (!API_FOOTBALL_KEY) return null;

    try {
        const res = await fetch(
            `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=10`,
            { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
        );
        const data = await res.json();
        const h2hData = data.response || [];
        
        H2H_CACHE[cacheKey] = h2hData;
        return h2hData;
    } catch (err) {
        console.error("Fehler beim H2H Abruf:", err.message);
        return null;
    }
}

// NEUE FUNKTION: Head-to-Head Analyse
function analyzeHeadToHead(headToHeadGames, homeTeam, awayTeam) {
    if (!headToHeadGames || headToHeadGames.length === 0) {
        return {
            available: false,
            message: "Keine historischen Direktvergleiche verfügbar"
        };
    }

    const stats = {
        available: true,
        totalGames: headToHeadGames.length,
        homeWins: 0,
        draws: 0,
        awayWins: 0,
        totalGoals: 0,
        homeGoals: 0,
        awayGoals: 0,
        bttsGames: 0,
        over25Games: 0,
        recentGames: []
    };

    // Analysiere die letzten 5 Spiele für Trends
    const recentGames = headToHeadGames.slice(0, 5);
    
    recentGames.forEach(game => {
        const homeGoals = game.goals.home;
        const awayGoals = game.goals.away;
        const totalGoals = homeGoals + awayGoals;
        
        // Sieg/Unentschieden/Niederlage
        if (homeGoals > awayGoals) stats.homeWins++;
        else if (homeGoals === awayGoals) stats.draws++;
        else stats.awayWins++;
        
        // Tore
        stats.totalGoals += totalGoals;
        stats.homeGoals += homeGoals;
        stats.awayGoals += awayGoals;
        
        // BTTS und Over 2.5
        if (homeGoals > 0 && awayGoals > 0) stats.bttsGames++;
        if (totalGoals > 2.5) stats.over25Games++;
        
        // Speichere letzte Spiele für Details
        stats.recentGames.push({
            date: game.fixture.date.slice(0, 10),
            result: `${homeGoals}-${awayGoals}`,
            competition: game.league.name,
            homeTeam: game.teams.home.name,
            awayTeam: game.teams.away.name
        });
    });

    // Berechne Prozente
    stats.homeWinPercentage = (stats.homeWins / recentGames.length) * 100;
    stats.drawPercentage = (stats.draws / recentGames.length) * 100;
    stats.awayWinPercentage = (stats.awayWins / recentGames.length) * 100;
    stats.avgGoals = stats.totalGoals / recentGames.length;
    stats.bttsPercentage = (stats.bttsGames / recentGames.length) * 100;
    stats.over25Percentage = (stats.over25Games / recentGames.length) * 100;
    stats.avgHomeGoals = stats.homeGoals / recentGames.length;
    stats.avgAwayGoals = stats.awayGoals / recentGames.length;

    // Trend-Analyse
    stats.trend = analyzeH2HTrend(stats);
    stats.strength = calculateH2HStrength(stats);

    return stats;
}

// NEUE FUNKTION: H2H Trend-Analyse
function analyzeH2HTrend(stats) {
    const trends = [];
    
    if (stats.homeWinPercentage > 60) {
        trends.push("Starker Heimvorteil in Direktvergleichen");
    }
    if (stats.awayWinPercentage > 60) {
        trends.push("Auswärtsstärke in Direktvergleichen");
    }
    if (stats.drawPercentage > 40) {
        trends.push("Häufige Unentschieden in Direktvergleichen");
    }
    if (stats.over25Percentage > 70) {
        trends.push("Torreiche Duelle in der Vergangenheit");
    }
    if (stats.bttsPercentage > 70) {
        trends.push("Beide Teams treffen häufig");
    }
    if (stats.avgGoals > 3.5) {
        trends.push("Sehr torreiche Historie");
    }
    
    return trends.length > 0 ? trends : ["Keine klaren Trends in Direktvergleichen"];
}

// NEUE FUNKTION: H2H Stärke berechnen
function calculateH2HStrength(stats) {
    let strength = 0;
    
    // Heimstärke
    if (stats.homeWinPercentage > 70) strength += 2;
    else if (stats.homeWinPercentage > 50) strength += 1;
    
    // Auswärtsstärke  
    if (stats.awayWinPercentage > 70) strength -= 2;
    else if (stats.awayWinPercentage > 50) strength -= 1;
    
    // Torreich
    if (stats.avgGoals > 3.0) strength += 1;
    if (stats.over25Percentage > 80) strength += 1;
    
    return strength;
}

// NEUE FUNKTION: Live-Statistiken abrufen
async function getLiveStatistics(fixtureId) {
    if (!API_FOOTBALL_KEY || !fixtureId) return null;

    try {
        const res = await fetch(
            `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`,
            { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
        );
        const data = await res.json();
        
        if (!data.response || data.response.length === 0) return null;
        
        const stats = data.response[0];
        return {
            shots: {
                total: stats.statistics.find(s => s.type === "Total Shots")?.value || 0,
                onTarget: stats.statistics.find(s => s.type === "Shots on Goal")?.value || 0
            },
            possession: stats.statistics.find(s => s.type === "Ball Possession")?.value || "0%",
            passes: stats.statistics.find(s => s.type === "Total passes")?.value || 0,
            accuracy: stats.statistics.find(s => s.type === "Passes accurate")?.value || "0%",
            fouls: stats.statistics.find(s => s.type === "Fouls")?.value || 0,
            cards: {
                yellow: stats.statistics.find(s => s.type === "Yellow Cards")?.value || 0,
                red: stats.statistics.find(s => s.type === "Red Cards")?.value || 0
            }
        };
    } catch (err) {
        console.error("Fehler bei Live-Statistiken:", err.message);
        return null;
    }
}

// NEUE FUNKTION: API Predictions abrufen
async function getAPIPredictions(fixtureId) {
    if (!API_FOOTBALL_KEY || !fixtureId) return null;

    try {
        const res = await fetch(
            `https://v3.football.api-sports.io/predictions?fixture=${fixtureId}`,
            { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
        );
        const data = await res.json();
        return data.response?.[0] || null;
    } catch (err) {
        console.error("Fehler bei Predictions:", err.message);
        return null;
    }
}

// NEUE FUNKTION: Verbesserte KI-Analyse mit H2H Daten
function getEnhancedAIRecommendation(game, h2hData) {
    const baseRecommendation = getAIRecommendation(game);
    
    // Füge H2H Einflüsse hinzu
    if (h2hData && h2hData.available) {
        let h2hBoost = 0;
        let reasoningAdditions = [];
        
        // H2H Stärke-Boost
        if (h2hData.strength > 0) {
            h2hBoost += 0.1;
            reasoningAdditions.push("Starke H2H Historie für Heimteam");
        } else if (h2hData.strength < 0) {
            h2hBoost -= 0.1;
            reasoningAdditions.push("Starke H2H Historie für Auswärtsteam");
        }
        
        // Torreiche Historie Boost für Over/BTTS
        if (h2hData.over25Percentage > 70) {
            reasoningAdditions.push("Torreiche H2H Historie");
        }
        if (h2hData.bttsPercentage > 70) {
            reasoningAdditions.push("Häufig beide Teams treffen in H2H");
        }
        
        // Verbessere die Empfehlung basierend auf H2H
        if (reasoningAdditions.length > 0) {
            baseRecommendation.reasoning += " | " + reasoningAdditions.join(" | ");
            baseRecommendation.bestScore += h2hBoost;
            
            // Upgrade Confidence bei starken H2H Signalen
            if (h2hBoost > 0.15 && baseRecommendation.confidence === "MEDIUM") {
                baseRecommendation.confidence = "HOCH";
            }
        }
        
        baseRecommendation.h2hStats = {
            homeWinPercent: h2hData.homeWinPercentage,
            drawPercent: h2hData.drawPercentage,
            awayWinPercent: h2hData.awayWinPercentage,
            avgGoals: h2hData.avgGoals,
            trends: h2hData.trend
        };
    }
    
    return baseRecommendation;
    }
// Bestehende Funktionen (angepasst)
async function loadHistoricalData() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

    if (fs.existsSync(HISTORICAL_FILE)) {
        HISTORICAL_STATS = JSON.parse(fs.readFileSync(HISTORICAL_FILE, "utf-8"));
    } else {
        HISTORICAL_STATS = {};
    }

    if (fs.existsSync(PERFORMANCE_FILE)) {
        PERFORMANCE_DATA = JSON.parse(fs.readFileSync(PERFORMANCE_FILE, "utf-8"));
    } else {
        PERFORMANCE_DATA = { predictions: {}, overall: { total: 0, correct: 0, accuracy: 0 } };
    }
}

function getAIRecommendation(game) {
    const risk = analyzeRisk(game);
    const { prob, value } = game;
    
    const markets = [
        { type: "1", prob: prob.home, value: value.home },
        { type: "X", prob: prob.draw, value: value.draw },
        { type: "2", prob: prob.away, value: value.away },
        { type: "Over 2.5", prob: prob.over25, value: value.over25 },
        { type: "BTTS Ja", prob: prob.btts, value: value.btts }
    ];
    
    const ratedMarkets = markets.map(market => ({
        ...market,
        score: market.prob * (1 + Math.max(0, market.value))
    })).sort((a, b) => b.score - a.score);
    
    const bestMarket = ratedMarkets[0];
    
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
    
    const alternative = ratedMarkets[1] && ratedMarkets[1].score > 0.4 ? ratedMarkets[1].type : null;
    
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

function analyzeRisk(game) {
    const { prob, value, homeXG, awayXG, form } = game;
    
    const factors = {
        closeProb: Math.abs(prob.home - prob.away) < 0.2 ? 0.8 : 0.2,
        lowXG: (homeXG + awayXG) < 2.0 ? 0.7 : 0.1,
        poorForm: (form.home < 0.3 || form.away < 0.3) ? 0.6 : 0.1,
        negativeValue: Object.values(value).some(v => v < -0.3) ? 0.9 : 0.1
    };
    
    const riskScore = (factors.closeProb + factors.lowXG + factors.poorForm + factors.negativeValue) / 4;
    
    return {
        score: riskScore,
        level: riskScore > 0.7 ? "SEHR HOCH" : riskScore > 0.5 ? "HOCH" : riskScore > 0.3 ? "MEDIUM" : "NIEDRIG",
        factors: factors
    };
}

// Teams und Form Funktionen (wie vorher)
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

// Haupt-API Route (ERWEITERT mit H2H)
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

                // NEU: Head-to-Head Daten abrufen
                const homeTeamId = TEAM_IDS[home];
                const awayTeamId = TEAM_IDS[away];
                let h2hData = null;
                
                if (homeTeamId && awayTeamId) {
                    const h2hGames = await getHeadToHead(homeTeamId, awayTeamId);
                    h2hData = analyzeHeadToHead(h2hGames, home, away);
                }

                // NEU: Verbesserte KI-Empfehlung mit H2H
                const aiRecommendation = getEnhancedAIRecommendation(
                    { home, away, league: league.name, odds, prob, value, homeXG, awayXG, form: { home: homeForm, away: awayForm } },
                    h2hData
                );

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
                    aiRecommendation,
                    h2hData // NEU: Head-to-Head Daten
                });
            }
        } catch (err) {
            console.error(`Fehler in ${league.name}:`, err.message);
        }
    }

    // Performance speichern
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
    fs.writeFileSync(PERFORMANCE_FILE, JSON.stringify(PERFORMANCE_DATA, null, 2));

    CACHE[cacheId] = { response: games };
    res.json({ response: games });
});

// NEUE ROUTE: Live-Statistiken für ein Spiel
app.get("/api/live-stats/:fixtureId", async (req, res) => {
    const { fixtureId } = req.params;
    
    try {
        const stats = await getLiveStatistics(fixtureId);
        res.json({ success: true, stats });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Bestehende Performance Route
app.get("/api/performance", (req, res) => {
    res.json(PERFORMANCE_DATA);
});

// Start
await loadOrFetchTeams();
await loadHistoricalData();
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT} (mit H2H & Live-Daten)`));
