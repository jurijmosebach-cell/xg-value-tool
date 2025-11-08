// server.js - KOMPLETTE SportData.org Integration
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
const SPORTDATA_API_KEY = process.env.SPORTDATA_API_KEY;

if (!ODDS_API_KEY) console.error("❌ FEHLER: ODDS_API_KEY fehlt!");
if (!SPORTDATA_API_KEY) console.error("❌ FEHLER: SPORTDATA_API_KEY fehlt!");

const PORT = process.env.PORT || 10000;
const DATA_DIR = path.join(__dirname, "data");
const PERFORMANCE_FILE = path.join(DATA_DIR, "performance.json");

// SportData.org Konfiguration
const SPORTDATA_CONFIG = {
    baseURL: "https://api.sportdataapi.com/v1/soccer",
    seasonId: 1980, // Aktuelle Saison 2024
    leagues: {
        premier_league: 237,
        bundesliga: 314, 
        la_liga: 538,
        serie_a: 392,
        ligue_1: 301,
        champions_league: 813
    }
};

// Ligen mit SportData.org IDs
const LEAGUES = [
    { 
        key: "soccer_epl", 
        name: "Premier League", 
        sportdataId: 237,
        baseXG: [1.65, 1.30], 
        avgGoals: 2.85 
    },
    { 
        key: "soccer_germany_bundesliga", 
        name: "Bundesliga", 
        sportdataId: 314,
        baseXG: [1.75, 1.45], 
        avgGoals: 3.20 
    },
    { 
        key: "soccer_spain_la_liga", 
        name: "La Liga", 
        sportdataId: 538,
        baseXG: [1.50, 1.25], 
        avgGoals: 2.75 
    },
    { 
        key: "soccer_italy_serie_a", 
        name: "Serie A", 
        sportdataId: 392,
        baseXG: [1.55, 1.30], 
        avgGoals: 2.85 
    },
    { 
        key: "soccer_france_ligue_one", 
        name: "Ligue 1", 
        sportdataId: 301,
        baseXG: [1.50, 1.25], 
        avgGoals: 2.75 
    },
    { 
        key: "soccer_uefa_champs_league", 
        name: "Champions League", 
        sportdataId: 813,
        baseXG: [1.60, 1.40], 
        avgGoals: 3.00 
    }
];

const CACHE = {};
const TEAM_CACHE = {};
const H2H_CACHE = {};
const STANDINGS_CACHE = {};
let PERFORMANCE_DATA = {};

// NEU: Team-Mapping für bessere Trefferquote
const TEAM_MAPPINGS = {
    // Premier League
    "Manchester United": "Manchester United",
    "Man United": "Manchester United",
    "Manchester City": "Manchester City", 
    "Man City": "Manchester City",
    "Liverpool": "Liverpool",
    "Chelsea": "Chelsea",
    "Arsenal": "Arsenal",
    "Tottenham": "Tottenham Hotspur",
    "Spurs": "Tottenham Hotspur",
    
    // Bundesliga
    "Bayern Munich": "Bayern Munich",
    "Bayern": "Bayern Munich", 
    "Dortmund": "Borussia Dortmund",
    "Leipzig": "RB Leipzig",
    "Leverkusen": "Bayer Leverkusen",
    
    // La Liga
    "Real Madrid": "Real Madrid",
    "Barcelona": "Barcelona",
    "Atletico Madrid": "Atletico Madrid",
    "Sevilla": "Sevilla",
    
    // Serie A
    "Juventus": "Juventus",
    "Inter": "Inter Milan",
    "Milan": "AC Milan",
    "Napoli": "Napoli",
    "Roma": "Roma"
};

// NEU: Finde besten Team-Namen Match
function findBestTeamMatch(teamName) {
    // Direkter Match
    if (TEAM_MAPPINGS[teamName]) {
        return TEAM_MAPPINGS[teamName];
    }
    
    // Teil-String Match
    for (const [key, value] of Object.entries(TEAM_MAPPINGS)) {
        if (teamName.includes(key) || key.includes(teamName)) {
            return value;
        }
    }
    
    return teamName; // Fallback zu originalem Namen
}
// NEU: Echte Team-Form von SportData.org
async function getRealTeamForm(teamName, leagueId) {
    const mappedTeam = findBestTeamMatch(teamName);
    const cacheKey = `form_${mappedTeam}_${leagueId}`;
    if (TEAM_CACHE[cacheKey]) return TEAM_CACHE[cacheKey];

    try {
        console.log(`📊 Lade echte Form für: ${mappedTeam} (Liga: ${leagueId})`);
        
        const matchesUrl = `${SPORTDATA_CONFIG.baseURL}/matches?apikey=${SPORTDATA_API_KEY}&season_id=${SPORTDATA_CONFIG.seasonId}&league_id=${leagueId}`;
        const matchesRes = await fetch(matchesUrl);
        const matchesData = await matchesRes.json();
        
        if (!matchesData.data) {
            console.log(`❌ Keine Spieldaten für ${mappedTeam}`);
            return 0.5;
        }

        // Filtere Spiele des spezifischen Teams
        const teamMatches = matchesData.data.filter(match => {
            const homeMatch = match.home_team && match.home_team.name && 
                            match.home_team.name.toLowerCase().includes(mappedTeam.toLowerCase());
            const awayMatch = match.away_team && match.away_team.name && 
                            match.away_team.name.toLowerCase().includes(mappedTeam.toLowerCase());
            return homeMatch || awayMatch;
        }).slice(0, 8); // Letzte 8 Spiele

        if (teamMatches.length === 0) {
            console.log(`❌ Keine Spiele gefunden für: ${mappedTeam}`);
            return 0.5;
        }

        console.log(`✅ Gefunden ${teamMatches.length} Spiele für ${mappedTeam}`);

        let formScore = 0;
        let totalWeight = 0;

        teamMatches.forEach((match, index) => {
            const weight = 1 - (index * 0.1); // Neuere Spiele stärker gewichtet
            const isHome = match.home_team.name.toLowerCase().includes(mappedTeam.toLowerCase());
            const goalsFor = isHome ? match.stats.home_score : match.stats.away_score;
            const goalsAgainst = isHome ? match.stats.away_score : match.stats.home_score;
            
            // Sicherstellen dass wir valide Zahlen haben
            if (goalsFor === null || goalsAgainst === null) return;
            
            let points = 0;
            if (goalsFor > goalsAgainst) points = 1.0;
            else if (goalsFor === goalsAgainst) points = 0.5;
            
            const goalDiffBonus = Math.min(0.2, (goalsFor - goalsAgainst) * 0.05);
            
            formScore += (points + goalDiffBonus) * weight;
            totalWeight += weight;
        });

        const normalizedScore = totalWeight > 0 ? formScore / totalWeight : 0.5;
        const finalScore = Math.max(0.1, Math.min(0.9, normalizedScore));
        
        TEAM_CACHE[cacheKey] = finalScore;
        console.log(`📈 Form für ${mappedTeam}: ${(finalScore * 100).toFixed(1)}%`);
        return finalScore;
        
    } catch (err) {
        console.error(`❌ SportData Form Fehler für ${mappedTeam}:`, err.message);
        return 0.5; // Fallback
    }
}

// NEU: Echte H2H Daten von SportData.org
async function getRealH2H(homeTeam, awayTeam, leagueId) {
    const mappedHome = findBestTeamMatch(homeTeam);
    const mappedAway = findBestTeamMatch(awayTeam);
    const cacheKey = `h2h_${mappedHome}_${mappedAway}_${leagueId}`;
    
    if (H2H_CACHE[cacheKey]) return H2H_CACHE[cacheKey];

    try {
        console.log(`📊 Lade echte H2H für: ${mappedHome} vs ${mappedAway}`);
        
        const h2hUrl = `${SPORTDATA_CONFIG.baseURL}/matches?apikey=${SPORTDATA_API_KEY}&season_id=${SPORTDATA_CONFIG.seasonId}&league_id=${leagueId}`;
        const h2hRes = await fetch(h2hUrl);
        const h2hData = await h2hRes.json();
        
        if (!h2hData.data) {
            console.log(`❌ Keine H2H Daten verfügbar`);
            return getSimulatedH2H(mappedHome, mappedAway);
        }

        // Filtere Direktvergleiche
        const headToHeadMatches = h2hData.data.filter(match => {
            if (!match.home_team || !match.away_team) return false;
            
            const homeInHome = match.home_team.name.toLowerCase().includes(mappedHome.toLowerCase());
            const awayInAway = match.away_team.name.toLowerCase().includes(mappedAway.toLowerCase());
            const homeInAway = match.away_team.name.toLowerCase().includes(mappedHome.toLowerCase());
            const awayInHome = match.home_team.name.toLowerCase().includes(mappedAway.toLowerCase());
            
            return (homeInHome && awayInAway) || (homeInAway && awayInHome);
        }).slice(0, 10); // Letzte 10 Duelle

        if (headToHeadMatches.length === 0) {
            console.log(`❌ Keine Direktvergleiche gefunden`);
            return getSimulatedH2H(mappedHome, mappedAway);
        }

        console.log(`✅ Gefunden ${headToHeadMatches.length} H2H Spiele`);

        const stats = {
            available: true,
            totalGames: headToHeadMatches.length,
            homeWins: 0,
            draws: 0,
            awayWins: 0,
            totalGoals: 0,
            homeGoals: 0,
            awayGoals: 0,
            bttsGames: 0,
            over25Games: 0,
            recentGames: [],
            dataSource: "SPORTDATA_ORG"
        };

        headToHeadMatches.forEach(match => {
            const homeGoals = match.stats.home_score;
            const awayGoals = match.stats.away_score;
            
            if (homeGoals === null || awayGoals === null) return;
            
            const totalGoals = homeGoals + awayGoals;
            
            // Bestimme welches Team in diesem Spiel "Home" war
            const isHomeTeamHome = match.home_team.name.toLowerCase().includes(mappedHome.toLowerCase());
            const actualHomeGoals = isHomeTeamHome ? homeGoals : awayGoals;
            const actualAwayGoals = isHomeTeamHome ? awayGoals : homeGoals;
            
            if (actualHomeGoals > actualAwayGoals) stats.homeWins++;
            else if (actualHomeGoals === actualAwayGoals) stats.draws++;
            else stats.awayWins++;
            
            stats.totalGoals += totalGoals;
            stats.homeGoals += actualHomeGoals;
            stats.awayGoals += actualAwayGoals;
            
            if (actualHomeGoals > 0 && actualAwayGoals > 0) stats.bttsGames++;
            if (totalGoals > 2.5) stats.over25Games++;
            
            stats.recentGames.push({
                date: match.match_start?.slice(0, 10) || "Unbekannt",
                result: `${actualHomeGoals}-${actualAwayGoals}`,
                competition: match.league?.name || "Unbekannt",
                homeTeam: isHomeTeamHome ? mappedHome : mappedAway,
                awayTeam: isHomeTeamHome ? mappedAway : mappedHome
            });
        });

        // Berechne Prozente
        if (stats.totalGames > 0) {
            stats.homeWinPercentage = (stats.homeWins / stats.totalGames) * 100;
            stats.drawPercentage = (stats.draws / stats.totalGames) * 100;
            stats.awayWinPercentage = (stats.awayWins / stats.totalGames) * 100;
            stats.avgGoals = stats.totalGoals / stats.totalGames;
            stats.bttsPercentage = (stats.bttsGames / stats.totalGames) * 100;
            stats.over25Percentage = (stats.over25Games / stats.totalGames) * 100;
            stats.avgHomeGoals = stats.homeGoals / stats.totalGames;
            stats.avgAwayGoals = stats.awayGoals / stats.totalGames;
        } else {
            // Fallback Werte
            stats.homeWinPercentage = 40;
            stats.drawPercentage = 30;
            stats.awayWinPercentage = 30;
            stats.avgGoals = 2.6;
            stats.bttsPercentage = 50;
            stats.over25Percentage = 55;
            stats.avgHomeGoals = 1.3;
            stats.avgAwayGoals = 1.3;
        }

        // Trend-Analyse
        stats.trend = analyzeH2HTrend(stats);
        stats.strength = calculateH2HStrength(stats);

        H2H_CACHE[cacheKey] = stats;
        console.log(`📈 H2H Analyse: ${mappedHome} ${stats.homeWinPercentage.toFixed(0)}% - ${mappedAway} ${stats.awayWinPercentage.toFixed(0)}%`);
        return stats;
        
    } catch (err) {
        console.error(`❌ SportData H2H Fehler für ${mappedHome}-${mappedAway}:`, err.message);
        return getSimulatedH2H(mappedHome, mappedAway);
    }
}

// Fallback: Simulierte H2H Daten
function getSimulatedH2H(homeTeam, awayTeam) {
    const sameCountry = (homeTeam.includes("Munich") && awayTeam.includes("Dortmund")) ||
                       (homeTeam.includes("Real") && awayTeam.includes("Barcelona")) ||
                       (homeTeam.includes("Man") && awayTeam.includes("Liverpool"));
    
    return {
        available: true,
        totalGames: sameCountry ? 8 : 3,
        homeWinPercentage: sameCountry ? 45 : 40,
        drawPercentage: sameCountry ? 25 : 30, 
        awayWinPercentage: sameCountry ? 30 : 30,
        avgGoals: sameCountry ? 3.2 : 2.6,
        bttsPercentage: sameCountry ? 65 : 50,
        over25Percentage: sameCountry ? 75 : 55,
        trends: sameCountry ? 
            ["Torreiche Duelle in der Vergangenheit", "Häufig beide Teams treffen"] : 
            ["Ausgeglichene historische Bilanz"],
        strength: sameCountry ? 1 : 0,
        dataSource: "SIMULATED"
    };
}

// H2H Hilfsfunktionen
function analyzeH2HTrend(stats) {
    const trends = [];
    
    if (stats.homeWinPercentage > 60) trends.push("Starker Heimvorteil in Direktvergleichen");
    if (stats.awayWinPercentage > 60) trends.push("Auswärtsstärke in Direktvergleichen");
    if (stats.drawPercentage > 40) trends.push("Häufige Unentschieden in Direktvergleichen");
    if (stats.over25Percentage > 70) trends.push("Torreiche Duelle in der Vergangenheit");
    if (stats.bttsPercentage > 70) trends.push("Beide Teams treffen häufig");
    if (stats.avgGoals > 3.5) trends.push("Sehr torreiche Historie");
    
    return trends.length > 0 ? trends : ["Keine klaren Trends in Direktvergleichen"];
}

function calculateH2HStrength(stats) {
    let strength = 0;
    
    if (stats.homeWinPercentage > 70) strength += 2;
    else if (stats.homeWinPercentage > 50) strength += 1;
    
    if (stats.awayWinPercentage > 70) strength -= 2;
    else if (stats.awayWinPercentage > 50) strength -= 1;
    
    if (stats.avgGoals > 3.0) strength += 1;
    if (stats.over25Percentage > 80) strength += 1;
    
    return strength;
}
// Ensemble Predictor (angepasst für echte Daten)
class EnsemblePredictor {
    constructor() {
        this.models = {
            xg: this.xgPrediction.bind(this),
            form: this.formPrediction.bind(this),
            h2h: this.h2hPrediction.bind(this),
            odds: this.oddsPrediction.bind(this),
            momentum: this.momentumPrediction.bind(this)
        };
    }
    
    predict(game, leagueName) {
        const weights = this.getLeagueWeights(leagueName);
        
        const predictions = {};
        for (const [modelName, modelFn] of Object.entries(this.models)) {
            predictions[modelName] = modelFn(game);
        }
        
        let ensembleScore = 0;
        for (const [modelName, prediction] of Object.entries(predictions)) {
            ensembleScore += prediction.score * weights[modelName];
        }
        
        const bestMarket = this.findBestMarket(predictions, weights);
        
        return {
            ensembleScore,
            predictions,
            weights,
            bestMarket,
            modelConfidence: this.calculateModelConfidence(predictions)
        };
    }
    
    getLeagueWeights(leagueName) {
        const weights = {
            "Bundesliga": { xg: 0.35, form: 0.30, h2h: 0.15, odds: 0.20 },
            "Premier League": { xg: 0.32, form: 0.28, h2h: 0.18, odds: 0.22 },
            "La Liga": { xg: 0.30, form: 0.25, h2h: 0.20, odds: 0.25 },
            "Serie A": { xg: 0.28, form: 0.25, h2h: 0.22, odds: 0.25 },
            "Ligue 1": { xg: 0.33, form: 0.27, h2h: 0.17, odds: 0.23 },
            "Champions League": { xg: 0.30, form: 0.20, h2h: 0.25, odds: 0.25 },
            "default": { xg: 0.32, form: 0.26, h2h: 0.18, odds: 0.24 }
        };
        
        return weights[leagueName] || weights.default;
    }
    
    xgPrediction(game) {
        const { prob, value } = game;
        const markets = [
            { type: "1", prob: prob.home, value: value.home },
            { type: "X", prob: prob.draw, value: value.draw },
            { type: "2", prob: prob.away, value: value.away },
            { type: "Over 2.5", prob: prob.over25, value: value.over25 },
            { type: "BTTS Ja", prob: prob.btts, value: value.btts }
        ];
        
        const best = markets.reduce((a, b) => 
            (b.prob * (1 + Math.max(0, b.value))) > (a.prob * (1 + Math.max(0, a.value))) ? b : a
        );
        
        return {
            score: best.prob * (1 + Math.max(0, best.value)),
            bestMarket: best.type,
            confidence: 0.8
        };
    }
    
    formPrediction(game) {
        const formDiff = game.form.home - game.form.away;
        const homeAdvantage = 0.15;
        
        let bestMarket, score;
        
        if (formDiff > 0.3) {
            bestMarket = "1";
            score = 0.6 + (formDiff * 0.5);
        } else if (formDiff < -0.3) {
            bestMarket = "2";
            score = 0.6 + (Math.abs(formDiff) * 0.5);
        } else {
            bestMarket = "X";
            score = 0.4 + (0.3 - Math.abs(formDiff)) * 0.5;
        }
        
        if (bestMarket === "1") score += homeAdvantage;
        if (bestMarket === "2") score -= homeAdvantage * 0.5;
        
        return {
            score: Math.min(score, 0.95),
            bestMarket,
            confidence: 0.7
        };
    }
    
    h2hPrediction(game) {
        if (!game.h2hData || !game.h2hData.available) {
            return { score: 0.5, bestMarket: "1", confidence: 0.1 };
        }
        
        const h2h = game.h2hData;
        let bestMarket, score;
        
        if (h2h.homeWinPercentage > 60) {
            bestMarket = "1";
            score = h2h.homeWinPercentage / 100;
        } else if (h2h.awayWinPercentage > 60) {
            bestMarket = "2";
            score = h2h.awayWinPercentage / 100;
        } else if (h2h.drawPercentage > 40) {
            bestMarket = "X";
            score = h2h.drawPercentage / 100;
        } else {
            bestMarket = "1";
            score = 0.5;
        }
        
        if (h2h.over25Percentage > 70) score += 0.1;
        if (h2h.bttsPercentage > 70) score += 0.05;
        
        return {
            score: Math.min(score, 0.9),
            bestMarket,
            confidence: h2h.totalGames >= 5 ? 0.8 : 0.5
        };
    }
    
    oddsPrediction(game) {
        const { odds, prob } = game;
        const markets = [
            { type: "1", odds: odds.home, prob: prob.home },
            { type: "X", odds: odds.draw, prob: prob.draw },
            { type: "2", odds: odds.away, prob: prob.away },
            { type: "Over 2.5", odds: odds.over25, prob: prob.over25 }
        ];
        
        const bestValue = markets.reduce((a, b) => {
            const valueA = a.prob * a.odds - 1;
            const valueB = b.prob * b.odds - 1;
            return valueB > valueA ? b : a;
        });
        
        const valueScore = Math.max(0, bestValue.prob * bestValue.odds - 1);
        
        return {
            score: 0.5 + (valueScore * 2),
            bestMarket: bestValue.type,
            confidence: 0.6
        };
    }
    
    momentumPrediction(game) {
        // Vereinfachte Momentum-Berechnung
        const momentumDiff = (game.form.home - 0.5) - (game.form.away - 0.5);
        
        let bestMarket, score;
        
        if (momentumDiff > 0.2) {
            bestMarket = "1";
            score = 0.6 + (momentumDiff * 0.8);
        } else if (momentumDiff < -0.2) {
            bestMarket = "2";
            score = 0.6 + (Math.abs(momentumDiff) * 0.8);
        } else {
            bestMarket = "X";
            score = 0.5;
        }
        
        return {
            score: Math.min(score, 0.9),
            bestMarket,
            confidence: 0.5
        };
    }
    
    findBestMarket(predictions, weights) {
        const marketScores = {};
        
        for (const [modelName, prediction] of Object.entries(predictions)) {
            const weight = weights[modelName];
            const market = prediction.bestMarket;
            
            if (!marketScores[market]) marketScores[market] = 0;
            marketScores[market] += prediction.score * weight;
        }
        
        return Object.keys(marketScores).reduce((a, b) => 
            marketScores[b] > marketScores[a] ? b : a
        );
    }
    
    calculateModelConfidence(predictions) {
        const scores = Object.values(predictions).map(p => p.confidence);
        return scores.reduce((a, b) => a + b, 0) / scores.length;
    }
}

// KI-Empfehlungs Funktionen
function getAdvancedAIRecommendation(game, leagueName) {
    const predictor = new EnsemblePredictor();
    const ensembleResult = predictor.predict(game, leagueName);
    const baseRisk = analyzeRisk(game);
    
    const contextAdjusted = applyContextAdjustments(ensembleResult, game);
    const gameType = getGameType(game);
    
    return createFinalRecommendation(contextAdjusted, baseRisk, game, gameType);
}

function applyContextAdjustments(ensembleResult, game) {
    let adjusted = { ...ensembleResult };
    
    if (getGameType(game) === "TOP_GAME") {
        adjusted.ensembleScore *= 0.9;
    }
    
    if (adjusted.bestMarket === "1" && adjusted.ensembleScore < 0.7) {
        adjusted.ensembleScore += 0.05;
    }
    
    return adjusted;
}

function getGameType(game) {
    const isTopGame = game.home.includes("Bayern") || game.home.includes("Dortmund") || 
                     game.away.includes("Bayern") || game.away.includes("Dortmund") ||
                     game.home.includes("Real") || game.home.includes("Barcelona") ||
                     game.away.includes("Real") || game.away.includes("Barcelona");
    
    return isTopGame ? "TOP_GAME" : "NORMAL";
}

function createFinalRecommendation(ensembleResult, risk, game, gameType) {
    const { ensembleScore, bestMarket, modelConfidence } = ensembleResult;
    const riskAdjustedConfidence = modelConfidence * (1 - risk.score * 0.5);
    
    let recommendation, reasoning, confidence;
    
    if (risk.score < 0.3 && ensembleScore > 0.65 && riskAdjustedConfidence > 0.7) {
        recommendation = "STRONG_BET";
        confidence = "SEHR HOCH";
        reasoning = `Ensemble-KI: ${bestMarket} mit Score ${(ensembleScore * 100).toFixed(1)}% - Klare Kante`;
    } 
    else if (risk.score < 0.5 && ensembleScore > 0.55 && riskAdjustedConfidence > 0.6) {
        recommendation = "VALUE_BET";
        confidence = "HOCH";
        reasoning = `Ensemble-KI: ${bestMarket} bietet starke Value (Score: ${(ensembleScore * 100).toFixed(1)}%)`;
    }
    else if (risk.score < 0.6 && ensembleScore > 0.45) {
        recommendation = "CAUTIOUS_BET";
        confidence = "MEDIUM";
        reasoning = `Ensemble-KI: ${bestMarket} als vorsichtige Option (Score: ${(ensembleScore * 100).toFixed(1)}%)`;
    }
    else {
        recommendation = "AVOID";
        confidence = "NIEDRIG";
        reasoning = `Ensemble-KI: Keine klare Kante (Score: ${(ensembleScore * 100).toFixed(1)}%, Risiko: ${risk.level})`;
    }
    
    if (gameType === "TOP_GAME") {
        reasoning += " | Achtung: Top-Spiel - erhöhte Unberechenbarkeit";
    }
    
    // Datenquelle hinzufügen
    if (game.h2hData?.dataSource === "SPORTDATA_ORG") {
        reasoning += " | 📊 Mit echten H2H Daten";
    }
    
    return {
        recommendation,
        confidence,
        reasoning,
        bestMarket,
        bestScore: ensembleScore,
        risk: risk,
        ensembleData: ensembleResult,
        gameType,
        modelConfidence: riskAdjustedConfidence,
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
    
    const riskScore = (
        factors.closeProb * 0.3 +
        factors.lowXG * 0.25 +
        factors.poorForm * 0.2 +
        factors.negativeValue * 0.25
    );
    
    return {
        score: riskScore,
        level: riskScore > 0.7 ? "SEHR HOCH" : riskScore > 0.5 ? "HOCH" : riskScore > 0.3 ? "MEDIUM" : "NIEDRIG",
        factors: factors
    };
}

function getBasicAIRecommendation(game) {
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
        reasoning = `Basic-KI: ${bestMarket.type} mit ${(bestMarket.prob * 100).toFixed(1)}% Wahrscheinlichkeit`;
    } 
    else if (risk.score < 0.5 && bestMarket.score > 0.45 && bestMarket.value > 0.1) {
        recommendation = "VALUE_BET";
        confidence = "HOCH";
        reasoning = `Basic-KI: ${bestMarket.type} bietet ${(bestMarket.value * 100).toFixed(1)}% Value`;
    }
    else if (risk.score < 0.6 && bestMarket.score > 0.35) {
        recommendation = "CAUTIOUS_BET";
        confidence = "MEDIUM";
        reasoning = `Basic-KI: ${bestMarket.type} als Option`;
    }
    else {
        recommendation = "AVOID";
        confidence = "NIEDRIG";
        reasoning = `Basic-KI: Risiko zu hoch (${risk.level})`;
    }
    
    return {
        recommendation,
        confidence,
        reasoning,
        bestMarket: bestMarket.type,
        bestScore: bestMarket.score,
        risk: risk,
        modelType: "BASIC",
        timestamp: new Date().toISOString()
    };
}

// Mathefunktionen
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

// Haupt-API Route
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

                // ECKTE Form-Berechnung mit SportData.org
                const [homeForm, awayForm] = await Promise.all([
                    getRealTeamForm(home, league.sportdataId),
                    getRealTeamForm(away, league.sportdataId)
                ]);

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

                // ECKTE H2H Daten mit SportData.org
                const h2hData = await getRealH2H(home, away, league.sportdataId);

                // Ensemble KI mit echten Daten
                let aiRecommendation;
                try {
                    aiRecommendation = getAdvancedAIRecommendation(
                        { 
                            home, away, league: league.name, odds, prob, value, 
                            homeXG, awayXG, 
                            form: { home: homeForm, away: awayForm },
                            h2hData 
                        },
                        league.name
                    );
                    aiRecommendation.modelType = "ENSEMBLE_PRO";
                    aiRecommendation.dataSource = "REAL_DATA";
                    
                } catch (error) {
                    console.error("Advanced KI Fehler:", error);
                    aiRecommendation = getBasicAIRecommendation(
                        { home, away, league: league.name, odds, prob, value, homeXG, awayXG, form: { home: homeForm, away: awayForm }, h2hData }
                    );
                }

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
                    h2hData,
                    dataQuality: h2hData.dataSource === "SPORTDATA_ORG" ? "REAL_DATA" : "SIMULATED_DATA"
                });
            }
        } catch (err) {
            console.error(`Fehler in ${league.name}:`, err.message);
        }
    }

    // Performance speichern
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    PERFORMANCE_DATA.predictions = PERFORMANCE_DATA.predictions || {};
    PERFORMANCE_DATA.predictions[date] = games.map(g => ({
        home: g.home,
        away: g.away,
        league: g.league,
        predicted: g.aiRecommendation.bestMarket,
        probabilities: g.prob,
        aiRecommendation: g.aiRecommendation,
        dataQuality: g.dataQuality,
        timestamp: new Date().toISOString()
    }));
    
    fs.writeFileSync(PERFORMANCE_FILE, JSON.stringify(PERFORMANCE_DATA, null, 2));

    CACHE[cacheId] = { response: games };
    res.json({ response: games });
});

// Performance Route
app.get("/api/performance", (req, res) => {
    if (!fs.existsSync(PERFORMANCE_FILE)) {
        return res.json({ predictions: {}, overall: { total: 0, correct: 0, accuracy: 0 } });
    }
    const data = JSON.parse(fs.readFileSync(PERFORMANCE_FILE, "utf-8"));
    res.json(data);
});

// Start
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT} (MIT ECHTEN SportData.org DATEN)`));
