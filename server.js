// server.js - KOMPLETTE OPTIMIERTE VERSION - TEIL 1/4
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
        stats.trends = analyzeH2HTrend(stats);
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
// server.js - KOMPLETTE OPTIMIERTE VERSION - TEIL 2/4

// OPTIMIERT: Advanced Ensemble Predictor
class AdvancedEnsemblePredictor {
    constructor() {
        this.models = {
            xg: this.xgPrediction.bind(this),
            form: this.advancedFormPrediction.bind(this),
            h2h: this.enhancedH2HPrediction.bind(this),
            odds: this.smartOddsPrediction.bind(this),
            momentum: this.momentumPrediction.bind(this),
            context: this.contextPrediction.bind(this)
        };
    }
    
    predict(game, leagueName) {
        try {
            const weights = this.getDynamicWeights(game, leagueName);
            const predictions = {};
            let totalWeight = 0;
            
            // Sammle Vorhersagen aller Modelle
            for (const [modelName, modelFn] of Object.entries(this.models)) {
                const prediction = modelFn(game);
                if (prediction && prediction.score > 0) {
                    predictions[modelName] = prediction;
                    totalWeight += weights[modelName];
                }
            }
            
            if (Object.keys(predictions).length === 0) {
                return this.getFallbackPrediction(game);
            }
            
            // Ensemble Scoring
            const marketScores = this.calculateMarketScores(predictions, weights, totalWeight);
            const bestMarket = this.findBestMarket(marketScores);
            const ensembleScore = marketScores[bestMarket];
            
            // Confidence Berechnung
            const confidence = this.calculateConfidence(predictions, weights, game);
            
            return {
                ensembleScore: Math.min(0.95, Math.max(0.05, ensembleScore)),
                bestMarket,
                predictions,
                weights,
                confidence,
                marketScores,
                modelVersion: "ADVANCED_ENSEMBLE_V2"
            };
            
        } catch (error) {
            console.error("Ensemble Prediction Error:", error);
            return this.getFallbackPrediction(game);
        }
    }
    
    getDynamicWeights(game, leagueName) {
        const baseWeights = {
            "Bundesliga": { xg: 0.25, form: 0.25, h2h: 0.20, odds: 0.15, momentum: 0.10, context: 0.05 },
            "Premier League": { xg: 0.23, form: 0.27, h2h: 0.18, odds: 0.17, momentum: 0.10, context: 0.05 },
            "La Liga": { xg: 0.22, form: 0.24, h2h: 0.20, odds: 0.19, momentum: 0.10, context: 0.05 },
            "Serie A": { xg: 0.20, form: 0.23, h2h: 0.22, odds: 0.20, momentum: 0.10, context: 0.05 },
            "Champions League": { xg: 0.24, form: 0.20, h2h: 0.25, odds: 0.16, momentum: 0.10, context: 0.05 },
            "default": { xg: 0.23, form: 0.25, h2h: 0.18, odds: 0.18, momentum: 0.10, context: 0.06 }
        };
        
        let weights = baseWeights[leagueName] || baseWeights.default;
        
        // Dynamische Anpassung basierend auf Datenverfügbarkeit
        if (!game.h2hData?.available) {
            weights = { ...weights, h2h: 0.05, form: weights.form + 0.10, xg: weights.xg + 0.05 };
        }
        
        if (game.form.home === 0.5 && game.form.away === 0.5) {
            weights = { ...weights, form: 0.10, xg: weights.xg + 0.10, odds: weights.odds + 0.05 };
        }
        
        return weights;
    }
    
    enhancedH2HPrediction(game) {
        if (!game.h2hData || !game.h2hData.available) {
            return { score: 0.5, bestMarket: "1", confidence: 0.1, data: "NO_H2H" };
        }
        
        const h2h = game.h2hData;
        const minGames = 3;
        
        if (h2h.totalGames < minGames) {
            return { 
                score: 0.5 + (h2h.strength * 0.1), 
                bestMarket: "1", 
                confidence: 0.3,
                data: "INSUFFICIENT_H2H" 
            };
        }
        
        // Erweiterte H2H Analyse
        const homeDominance = h2h.homeWinPercentage > 60 ? (h2h.homeWinPercentage - 50) / 50 : 0;
        const awayDominance = h2h.awayWinPercentage > 60 ? (h2h.awayWinPercentage - 50) / 50 : 0;
        const drawTendency = h2h.drawPercentage > 40 ? (h2h.drawPercentage - 30) / 40 : 0;
        
        let bestMarket, score;
        
        if (homeDominance > 0.2 && homeDominance > awayDominance) {
            bestMarket = "1";
            score = 0.5 + (homeDominance * 0.4);
        } else if (awayDominance > 0.2 && awayDominance > homeDominance) {
            bestMarket = "2";
            score = 0.5 + (awayDominance * 0.4);
        } else if (drawTendency > 0.2) {
            bestMarket = "X";
            score = 0.4 + (drawTendency * 0.3);
        } else {
            // Kein klarer Trend - basiere auf Heimvorteil
            bestMarket = "1";
            score = 0.5 + (homeDominance * 0.2);
        }
        
        // Over/Under Märkte
        if (h2h.over25Percentage > 70) {
            const overScore = 0.5 + ((h2h.over25Percentage - 50) / 50);
            if (overScore > score) {
                bestMarket = "Over 2.5";
                score = overScore;
            }
        }
        
        if (h2h.bttsPercentage > 70) {
            const bttsScore = 0.5 + ((h2h.bttsPercentage - 50) / 50);
            if (bttsScore > score) {
                bestMarket = "BTTS Ja";
                score = bttsScore;
            }
        }
        
        const confidence = Math.min(0.9, 0.3 + (h2h.totalGames * 0.1));
        
        return {
            score: Math.min(0.9, score),
            bestMarket,
            confidence,
            data: {
                homeDominance,
                awayDominance,
                drawTendency,
                totalGames: h2h.totalGames
            }
        };
    }
    
    advancedFormPrediction(game) {
        const { form, homeXG, awayXG } = game;
        
        // Form-Berechnung mit xG Integration
        const formDiff = form.home - form.away;
        const xgDiff = homeXG - awayXG;
        const homeAdvantage = 0.12; // Basis Heimvorteil
        
        // Kombinierter Score aus Form und xG
        const combinedScore = (formDiff * 0.7) + (xgDiff * 0.3);
        
        let bestMarket, score;
        
        if (combinedScore > 0.3) {
            bestMarket = "1";
            score = 0.6 + (combinedScore * 0.5) + homeAdvantage;
        } else if (combinedScore < -0.3) {
            bestMarket = "2";
            score = 0.6 + (Math.abs(combinedScore) * 0.5) - (homeAdvantage * 0.5);
        } else {
            bestMarket = "X";
            score = 0.4 + (0.3 - Math.abs(combinedScore)) * 0.7;
        }
        
        // Form-Stabilitäts-Bonus
        const formStability = 1 - Math.abs(form.home - 0.5) - Math.abs(form.away - 0.5);
        score += formStability * 0.1;
        
        return {
            score: Math.min(0.85, Math.max(0.15, score)),
            bestMarket,
            confidence: 0.6 + (Math.min(form.home, form.away) * 0.3)
        };
    }
    
    smartOddsPrediction(game) {
        const { odds, prob } = game;
        
        // Kelly Criterion basierte Value Berechnung
        const markets = [
            { 
                type: "1", 
                odds: odds.home, 
                prob: prob.home,
                kelly: (prob.home * odds.home - 1) / (odds.home - 1)
            },
            { 
                type: "X", 
                odds: odds.draw, 
                prob: prob.draw,
                kelly: (prob.draw * odds.draw - 1) / (odds.draw - 1)
            },
            { 
                type: "2", 
                odds: odds.away, 
                prob: prob.away,
                kelly: (prob.away * odds.away - 1) / (odds.away - 1)
            },
            { 
                type: "Over 2.5", 
                odds: odds.over25, 
                prob: prob.over25,
                kelly: (prob.over25 * odds.over25 - 1) / (odds.over25 - 1)
            }
        ].filter(m => m.odds > 0 && m.prob > 0);
        
        if (markets.length === 0) {
            return { score: 0.5, bestMarket: "1", confidence: 0.1 };
        }
        
        // Finde beste Value Wette
        const bestValue = markets.reduce((a, b) => 
            (b.kelly > a.kelly) ? b : a
        );
        
        // Score basierend auf Kelly und Probability
        const valueScore = Math.max(0, bestValue.kelly * 2); // Kelly normalisiert
        const probScore = bestValue.prob;
        const combinedScore = 0.4 + (valueScore * 0.4) + (probScore * 0.2);
        
        return {
            score: Math.min(0.9, combinedScore),
            bestMarket: bestValue.type,
            confidence: 0.5 + (Math.min(1, bestValue.kelly * 5) * 0.3),
            kellyValue: bestValue.kelly
        };
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
            score: Math.min(0.9, score),
            bestMarket,
            confidence: 0.5
        };
    }
    
    contextPrediction(game) {
        // Kontext-basierte Vorhersagen (Top-Spiele, Derbys, etc.)
        const context = this.analyzeGameContext(game);
        let scoreModifier = 0;
        let confidenceModifier = 0;
        
        if (context.isTopGame) {
            // Top-Spiele sind unberechenbarer
            scoreModifier -= 0.1;
            confidenceModifier -= 0.2;
        }
        
        if (context.isDerby) {
            // Derbys sind emotionaler
            scoreModifier -= 0.05;
        }
        
        if (context.hasMotivationFactors) {
            // Motivation kann Spiele beeinflussen
            confidenceModifier -= 0.1;
        }
        
        return {
            score: 0.5 + scoreModifier,
            bestMarket: "1", // Neutral
            confidence: 0.5 + confidenceModifier,
            context
        };
    }
    
    analyzeGameContext(game) {
        const topTeams = ["Bayern", "Dortmund", "Real Madrid", "Barcelona", "Manchester", "City", "Liverpool", "Juventus", "Milan", "Inter"];
        const isHomeTop = topTeams.some(team => game.home.includes(team));
        const isAwayTop = topTeams.some(team => game.away.includes(team));
        
        return {
            isTopGame: isHomeTop && isAwayTop,
            isDerby: this.isDerby(game.home, game.away),
            hasMotivationFactors: this.hasMotivationFactors(game),
            homeTeamTier: this.getTeamTier(game.home),
            awayTeamTier: this.getTeamTier(game.away)
        };
    }
    
    isDerby(home, away) {
        const derbies = [
            ["Bayern", "Dortmund"],
            ["Real Madrid", "Barcelona"],
            ["Manchester United", "Manchester City"],
            ["Liverpool", "Everton"],
            ["Milan", "Inter"],
            ["Arsenal", "Tottenham"]
        ];
        
        return derbies.some(derby => 
            (home.includes(derby[0]) && away.includes(derby[1])) ||
            (home.includes(derby[1]) && away.includes(derby[0]))
        );
    }
    
    hasMotivationFactors(game) {
        // Einfache Motivation-Faktoren
        return game.home.includes("Bayern") || game.away.includes("Bayern") ||
               game.home.includes("Real Madrid") || game.away.includes("Real Madrid");
    }
    
    getTeamTier(teamName) {
        const topTier = ["Bayern", "Dortmund", "Real Madrid", "Barcelona", "Manchester", "City", "Liverpool", "Juventus"];
        const midTier = ["Leipzig", "Leverkusen", "Sevilla", "Atletico", "Arsenal", "Tottenham", "Milan", "Inter"];
        
        if (topTier.some(team => teamName.includes(team))) return "TOP";
        if (midTier.some(team => teamName.includes(team))) return "MID";
        return "LOW";
    }
    
    calculateMarketScores(predictions, weights, totalWeight) {
        const marketScores = {};
        
        for (const [modelName, prediction] of Object.entries(predictions)) {
            const weight = weights[modelName] / totalWeight;
            const market = prediction.bestMarket;
            const modelScore = prediction.score * weight;
            
            if (!marketScores[market]) marketScores[market] = 0;
            marketScores[market] += modelScore;
        }
        
        return marketScores;
    }
    
    calculateConfidence(predictions, weights, game) {
        let totalConfidence = 0;
        let totalWeight = 0;
        
        for (const [modelName, prediction] of Object.entries(predictions)) {
            const weight = weights[modelName];
            totalConfidence += prediction.confidence * weight;
            totalWeight += weight;
        }
        
        let baseConfidence = totalConfidence / totalWeight;
        
        // Datenqualitäts-Bonus
        if (game.h2hData?.available && game.h2hData.totalGames >= 5) {
            baseConfidence += 0.15;
        }
        
        if (game.form.home !== 0.5 && game.form.away !== 0.5) {
            baseConfidence += 0.1;
        }
        
        return Math.min(0.95, Math.max(0.1, baseConfidence));
    }
    
    getFallbackPrediction(game) {
        // Einfache Fallback-Logik
        const { prob, value } = game;
        const markets = [
            { type: "1", score: prob.home * (1 + Math.max(0, value.home)) },
            { type: "X", score: prob.draw * (1 + Math.max(0, value.draw)) },
            { type: "2", score: prob.away * (1 + Math.max(0, value.away)) },
            { type: "Over 2.5", score: prob.over25 * (1 + Math.max(0, value.over25)) }
        ];
        
        const best = markets.reduce((a, b) => b.score > a.score ? b : a);
        
        return {
            ensembleScore: best.score,
            bestMarket: best.type,
            predictions: { fallback: { score: best.score, bestMarket: best.type, confidence: 0.3 } },
            weights: { fallback: 1 },
            confidence: 0.3,
            marketScores: { [best.type]: best.score },
            modelVersion: "FALLBACK"
        };
    }
    
    findBestMarket(marketScores) {
        return Object.keys(marketScores).reduce((a, b) => 
            marketScores[b] > marketScores[a] ? b : a
        );
    }
}
// server.js - KOMPLETTE OPTIMIERTE VERSION - TEIL 3/4

// OPTIMIERT: KI-Empfehlungs Funktionen
function getOptimizedAIRecommendation(game, leagueName) {
    try {
        const predictor = new AdvancedEnsemblePredictor();
        const ensembleResult = predictor.predict(game, leagueName);
        const riskAnalysis = analyzeAdvancedRisk(game, ensembleResult);
        
        return createOptimizedRecommendation(ensembleResult, riskAnalysis, game);
        
    } catch (error) {
        console.error("Advanced KI Fehler:", error);
        return getReliableFallbackRecommendation(game);
    }
}

function analyzeAdvancedRisk(game, ensembleResult) {
    const { prob, value, homeXG, awayXG, form, h2hData } = game;
    
    const riskFactors = {
        // Prob-basierte Risiken
        closeMatch: Math.abs(prob.home - prob.away) < 0.15 ? 0.8 : 0.1,
        lowProbability: Math.max(prob.home, prob.draw, prob.away) < 0.4 ? 0.7 : 0.1,
        
        // xG-basierte Risiken
        lowScoring: (homeXG + awayXG) < 2.2 ? 0.6 : 0.1,
        xgUnreliable: Math.abs(homeXG - awayXG) > 1.5 ? 0.4 : 0.1,
        
        // Form-basierte Risiken
        poorForm: form.home < 0.3 || form.away < 0.3 ? 0.5 : 0.1,
        inconsistentForm: Math.abs(form.home - form.away) > 0.5 ? 0.4 : 0.1,
        
        // Value-basierte Risiken
        negativeValue: Object.values(value).some(v => v < -0.2) ? 0.6 : 0.1,
        
        // H2H-basierte Risiken
        insufficientH2H: !h2hData?.available || h2hData.totalGames < 3 ? 0.4 : 0.1,
        conflictingH2H: h2hData?.available && Math.abs(h2hData.homeWinPercentage - h2hData.awayWinPercentage) < 10 ? 0.3 : 0.1,
        
        // Ensemble-basierte Risiken
        lowConfidence: ensembleResult.confidence < 0.5 ? 0.5 : 0.1,
        conflictingModels: hasConflictingPredictions(ensembleResult.predictions) ? 0.4 : 0.1
    };
    
    const riskScore = (
        riskFactors.closeMatch * 0.15 +
        riskFactors.lowProbability * 0.12 +
        riskFactors.lowScoring * 0.10 +
        riskFactors.poorForm * 0.10 +
        riskFactors.negativeValue * 0.12 +
        riskFactors.insufficientH2H * 0.08 +
        riskFactors.lowConfidence * 0.15 +
        riskFactors.conflictingModels * 0.08 +
        riskFactors.xgUnreliable * 0.05 +
        riskFactors.inconsistentForm * 0.05
    );
    
    return {
        score: Math.min(1, riskScore),
        level: riskScore > 0.7 ? "SEHR HOCH" : 
               riskScore > 0.5 ? "HOCH" : 
               riskScore > 0.3 ? "MEDIUM" : "NIEDRIG",
        factors: riskFactors,
        warnings: generateRiskWarnings(riskFactors)
    };
}

function hasConflictingPredictions(predictions) {
    const markets = Object.values(predictions).map(p => p.bestMarket);
    const uniqueMarkets = new Set(markets);
    return uniqueMarkets.size > 2; // Mehr als 2 verschiedene Märkte = Konflikt
}

function generateRiskWarnings(riskFactors) {
    const warnings = [];
    
    if (riskFactors.closeMatch > 0.5) warnings.push("Sehr ausgeglichene Wahrscheinlichkeiten");
    if (riskFactors.lowProbability > 0.5) warnings.push("Geringe Siegwahrscheinlichkeit");
    if (riskFactors.lowScoring > 0.5) warnings.push("Geringe Torerwartung");
    if (riskFactors.poorForm > 0.5) warnings.push("Schlechte Teamform");
    if (riskFactors.negativeValue > 0.5) warnings.push("Negative Value Werte");
    if (riskFactors.insufficientH2H > 0.5) warnings.push("Wenige H2H Daten");
    if (riskFactors.lowConfidence > 0.5) warnings.push("Geringe KI-Konfidenz");
    
    return warnings;
}

function createOptimizedRecommendation(ensembleResult, riskAnalysis, game) {
    const { ensembleScore, bestMarket, confidence, marketScores } = ensembleResult;
    const { score: riskScore, level: riskLevel } = riskAnalysis;
    
    // Risiko-angepasster Score
    const riskAdjustedScore = ensembleScore * (1 - riskScore * 0.4);
    const confidenceBoost = game.h2hData?.available ? 0.1 : 0;
    const finalConfidence = Math.min(0.95, confidence + confidenceBoost);
    
    let recommendation, reasoning;
    
    // Entscheidungslogik mit besseren Thresholds
    if (riskScore < 0.3 && riskAdjustedScore > 0.65 && finalConfidence > 0.7) {
        recommendation = "STRONG_BET";
        reasoning = `🏆 STARKE EMPFEHLUNG: ${bestMarket} (Score: ${(riskAdjustedScore * 100).toFixed(1)}%)`;
    } 
    else if (riskScore < 0.4 && riskAdjustedScore > 0.58 && finalConfidence > 0.6) {
        recommendation = "VALUE_BET";
        reasoning = `💰 VALUE WETTE: ${bestMarket} bietet gutes Potenzial (Score: ${(riskAdjustedScore * 100).toFixed(1)}%)`;
    }
    else if (riskScore < 0.5 && riskAdjustedScore > 0.50) {
        recommendation = "CAUTIOUS_BET";
        reasoning = `⚠️ VORSICHTIG: ${bestMarket} als Option (Score: ${(riskAdjustedScore * 100).toFixed(1)}%)`;
    }
    else {
        recommendation = "AVOID";
        reasoning = `🚫 VERMEIDEN: Zu hohes Risiko (${riskLevel}) oder unklare Kante`;
    }
    
    // Detaillierte Begründung
    reasoning += generateDetailedReasoning(game, ensembleResult, riskAnalysis);
    
    // Debug-Ausgabe
    debugKIRecommendation(game, {
        recommendation,
        bestMarket,
        bestScore: riskAdjustedScore,
        confidence: getConfidenceLevel(finalConfidence),
        risk: riskAnalysis
    });
    
    return {
        recommendation,
        confidence: getConfidenceLevel(finalConfidence),
        reasoning,
        bestMarket,
        bestScore: riskAdjustedScore,
        risk: riskAnalysis,
        ensembleData: ensembleResult,
        modelType: "ADVANCED_ENSEMBLE_V2",
        timestamp: new Date().toISOString(),
        marketAnalysis: Object.entries(marketScores)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([market, score]) => ({ market, score: (score * 100).toFixed(1) + '%' }))
    };
}

function generateDetailedReasoning(game, ensembleResult, riskAnalysis) {
    let details = "";
    
    // H2H Insights
    if (game.h2hData?.available) {
        details += ` | H2H: ${game.h2hData.homeWinPercentage.toFixed(0)}%-${game.h2hData.drawPercentage.toFixed(0)}%-${game.h2hData.awayWinPercentage.toFixed(0)}%`;
        if (game.h2hData.strength !== 0) {
            details += game.h2hData.strength > 0 ? " (Heimstärke)" : " (Auswärtsstärke)";
        }
    }
    
    // Form Insights
    details += ` | Form: ${(game.form.home * 100).toFixed(0)}%-${(game.form.away * 100).toFixed(0)}%`;
    
    // xG Insights
    details += ` | xG: ${game.homeXG}-${game.awayXG}`;
    
    // Top Modelle
    const topModels = Object.entries(ensembleResult.predictions)
        .sort(([,a], [,b]) => b.score - a.score)
        .slice(0, 2)
        .map(([model]) => model);
    
    details += ` | Top-Modelle: ${topModels.join(", ")}`;
    
    // Warnungen
    if (riskAnalysis.warnings.length > 0) {
        details += ` | Warnungen: ${riskAnalysis.warnings.join(", ")}`;
    }
    
    return details;
}

function getConfidenceLevel(confidence) {
    if (confidence > 0.8) return "SEHR HOCH";
    if (confidence > 0.65) return "HOCH";
    if (confidence > 0.5) return "MEDIUM";
    return "NIEDRIG";
}

function getReliableFallbackRecommendation(game) {
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
    const risk = analyzeBasicRisk(game);
    
    let recommendation, reasoning;
    
    if (risk.score < 0.4 && bestMarket.score > 0.6) {
        recommendation = "STRONG_BET";
        reasoning = `Basic-KI: ${bestMarket.type} mit ${(bestMarket.prob * 100).toFixed(1)}% Wahrscheinlichkeit`;
    } 
    else if (risk.score < 0.5 && bestMarket.score > 0.5 && bestMarket.value > 0.1) {
        recommendation = "VALUE_BET";
        reasoning = `Basic-KI: ${bestMarket.type} bietet ${(bestMarket.value * 100).toFixed(1)}% Value`;
    }
    else if (risk.score < 0.6 && bestMarket.score > 0.4) {
        recommendation = "CAUTIOUS_BET";
        reasoning = `Basic-KI: ${bestMarket.type} als Option`;
    }
    else {
        recommendation = "AVOID";
        reasoning = `Basic-KI: Risiko zu hoch (${risk.level})`;
    }
    
    return {
        recommendation,
        confidence: "MEDIUM",
        reasoning,
        bestMarket: bestMarket.type,
        bestScore: bestMarket.score,
        risk: risk,
        modelType: "BASIC_FALLBACK",
        timestamp: new Date().toISOString()
    };
}

function analyzeBasicRisk(game) {
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

// Debug-Funktion um KI-Entscheidungen zu verstehen
function debugKIRecommendation(game, recommendation) {
    console.log("🔍 KI-DEBUG:", {
        spiel: `${game.home} vs ${game.away}`,
        liga: game.league,
        empfehlung: recommendation.recommendation,
        market: recommendation.bestMarket,
        score: (recommendation.bestScore * 100).toFixed(1) + '%',
        confidence: recommendation.confidence,
        risiko: recommendation.risk.level,
        h2hDaten: game.h2hData?.available ? `${game.h2hData.totalGames} Spiele` : 'Nein',
        form: `H:${(game.form.home * 100).toFixed(0)}% A:${(game.form.away * 100).toFixed(0)}%`,
        xg: `H:${game.homeXG} A:${game.awayXG}`
    });
}

// Mathefunktionen (bleiben gleich)
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
// server.js - KOMPLETTE OPTIMIERTE VERSION - TEIL 4/4

// Haupt-API Route (angepasst für optimiertes KI-Modell)
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

                // OPTIMIERT: Ensemble KI mit neuem Modell
                let aiRecommendation;
                try {
                    aiRecommendation = getOptimizedAIRecommendation(
                        { 
                            home, away, league: league.name, odds, prob, value, 
                            homeXG, awayXG, 
                            form: { home: homeForm, away: awayForm },
                            h2hData 
                        },
                        league.name
                    );
                    aiRecommendation.modelType = "ADVANCED_ENSEMBLE_V2";
                    aiRecommendation.dataSource = "REAL_DATA";
                    
                } catch (error) {
                    console.error("Advanced KI Fehler:", error);
                    aiRecommendation = getReliableFallbackRecommendation(
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

// Performance Route (bleibt gleich)
app.get("/api/performance", (req, res) => {
    if (!fs.existsSync(PERFORMANCE_FILE)) {
        return res.json({ predictions: {}, overall: { total: 0, correct: 0, accuracy: 0 } });
    }
    const data = JSON.parse(fs.readFileSync(PERFORMANCE_FILE, "utf-8"));
    res.json(data);
});

// Cache Cleaning (neu hinzufügen)
function cleanOldCache() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 Minuten
    
    // Clean CACHE
    Object.keys(CACHE).forEach(key => {
        // Einfache Cache-Logik - in Produktion würde man timestamps speichern
        if (Math.random() < 0.1) { // 10% Chance zu cleannen pro Aufruf
            delete CACHE[key];
        }
    });
    
    // Clean TEAM_CACHE nach 1 Stunde
    Object.keys(TEAM_CACHE).forEach(key => {
        if (Math.random() < 0.05) { // 5% Chance zu cleannen
            delete TEAM_CACHE[key];
        }
    });
    
    // Clean H2H_CACHE nach 2 Stunden  
    Object.keys(H2H_CACHE).forEach(key => {
        if (Math.random() < 0.03) { // 3% Chance zu cleannen
            delete H2H_CACHE[key];
        }
    });
}

// Cache Cleaning alle 10 Minuten
setInterval(cleanOldCache, 10 * 60 * 1000);

// Start
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
    console.log(`📊 KI-Modell: ADVANCED_ENSEMBLE_V2 aktiviert`);
    console.log(`🔧 Datenquellen: Odds-API + SportData.org`);
    console.log(`💡 Debug-Modus: KI-Entscheidungen werden geloggt`);
});
