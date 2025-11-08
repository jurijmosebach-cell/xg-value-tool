// server.js - KOMPLETTE VERSION MIT PERFORMANCE-TRACKING - TEIL 1/4
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
const SPORTDATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;

if (!ODDS_API_KEY) console.error("❌ FEHLER: ODDS_API_KEY fehlt!");
if (!SPORTDATA_API_KEY) console.error("❌ FEHLER: SPORTDATA_API_KEY fehlt!");

const PORT = process.env.PORT || 10000;
const DATA_DIR = path.join(__dirname, "data");
const PERFORMANCE_FILE = path.join(DATA_DIR, "performance.json");

// SportData.org Konfiguration
const SPORTDATA_CONFIG = {
    baseURL: "https://api.sportdataapi.com/v1/soccer",
    seasonId: 1980,
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
let PERFORMANCE_DATA = {};

// Team-Mapping
const TEAM_MAPPINGS = {
    "Manchester United": "Manchester United",
    "Man United": "Manchester United",
    "Manchester City": "Manchester City", 
    "Man City": "Manchester City",
    "Liverpool": "Liverpool",
    "Chelsea": "Chelsea",
    "Arsenal": "Arsenal",
    "Tottenham": "Tottenham Hotspur",
    "Spurs": "Tottenham Hotspur",
    "Bayern Munich": "Bayern Munich",
    "Bayern": "Bayern Munich", 
    "Dortmund": "Borussia Dortmund",
    "Leipzig": "RB Leipzig",
    "Leverkusen": "Bayer Leverkusen",
    "Real Madrid": "Real Madrid",
    "Barcelona": "Barcelona",
    "Atletico Madrid": "Atletico Madrid",
    "Sevilla": "Sevilla",
    "Juventus": "Juventus",
    "Inter": "Inter Milan",
    "Milan": "AC Milan",
    "Napoli": "Napoli",
    "Roma": "Roma"
};

function findBestTeamMatch(teamName) {
    if (TEAM_MAPPINGS[teamName]) {
        return TEAM_MAPPINGS[teamName];
    }
    
    for (const [key, value] of Object.entries(TEAM_MAPPINGS)) {
        if (teamName.includes(key) || key.includes(teamName)) {
            return value;
        }
    }
    
    return teamName;
}

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

        const teamMatches = matchesData.data.filter(match => {
            const homeMatch = match.home_team && match.home_team.name && 
                            match.home_team.name.toLowerCase().includes(mappedTeam.toLowerCase());
            const awayMatch = match.away_team && match.away_team.name && 
                            match.away_team.name.toLowerCase().includes(mappedTeam.toLowerCase());
            return homeMatch || awayMatch;
        }).slice(0, 8);

        if (teamMatches.length === 0) {
            console.log(`❌ Keine Spiele gefunden für: ${mappedTeam}`);
            return 0.5;
        }

        console.log(`✅ Gefunden ${teamMatches.length} Spiele für ${mappedTeam}`);

        let formScore = 0;
        let totalWeight = 0;

        teamMatches.forEach((match, index) => {
            const weight = 1 - (index * 0.1);
            const isHome = match.home_team.name.toLowerCase().includes(mappedTeam.toLowerCase());
            const goalsFor = isHome ? match.stats.home_score : match.stats.away_score;
            const goalsAgainst = isHome ? match.stats.away_score : match.stats.home_score;
            
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
        return 0.5;
    }
}

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

        const headToHeadMatches = h2hData.data.filter(match => {
            if (!match.home_team || !match.away_team) return false;
            
            const homeInHome = match.home_team.name.toLowerCase().includes(mappedHome.toLowerCase());
            const awayInAway = match.away_team.name.toLowerCase().includes(mappedAway.toLowerCase());
            const homeInAway = match.away_team.name.toLowerCase().includes(mappedHome.toLowerCase());
            const awayInHome = match.home_team.name.toLowerCase().includes(mappedAway.toLowerCase());
            
            return (homeInHome && awayInAway) || (homeInAway && awayInHome);
        }).slice(0, 10);

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
            stats.homeWinPercentage = 40;
            stats.drawPercentage = 30;
            stats.awayWinPercentage = 30;
            stats.avgGoals = 2.6;
            stats.bttsPercentage = 50;
            stats.over25Percentage = 55;
            stats.avgHomeGoals = 1.3;
            stats.avgAwayGoals = 1.3;
        }

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
// server.js - KOMPLETTE VERSION MIT PERFORMANCE-TRACKING - TEIL 2/4

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
            
            const marketScores = this.calculateMarketScores(predictions, weights, totalWeight);
            const bestMarket = this.findBestMarket(marketScores);
            const ensembleScore = marketScores[bestMarket];
            
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
            bestMarket = "1";
            score = 0.5 + (homeDominance * 0.2);
        }
        
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
        
        const formDiff = form.home - form.away;
        const xgDiff = homeXG - awayXG;
        const homeAdvantage = 0.12;
        
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
        
        const bestValue = markets.reduce((a, b) => 
            (b.kelly > a.kelly) ? b : a
        );
        
        const valueScore = Math.max(0, bestValue.kelly * 2);
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
        const context = this.analyzeGameContext(game);
        let scoreModifier = 0;
        let confidenceModifier = 0;
        
        if (context.isTopGame) {
            scoreModifier -= 0.1;
            confidenceModifier -= 0.2;
        }
        
        if (context.isDerby) {
            scoreModifier -= 0.05;
        }
        
        if (context.hasMotivationFactors) {
            confidenceModifier -= 0.1;
        }
        
        return {
            score: 0.5 + scoreModifier,
            bestMarket: "1",
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
        
        if (game.h2hData?.available && game.h2hData.totalGames >= 5) {
            baseConfidence += 0.15;
        }
        
        if (game.form.home !== 0.5 && game.form.away !== 0.5) {
            baseConfidence += 0.1;
        }
        
        return Math.min(0.95, Math.max(0.1, baseConfidence));
    }
    
    getFallbackPrediction(game) {
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
// server.js - KOMPLETTE VERSION MIT PERFORMANCE-TRACKING - TEIL 4/4

// PERFORMANCE TRACKING SYSTEM
async function fetchMatchResults(date) {
    try {
        console.log(`📅 Lade Ergebnisse für: ${date}`);
        
        const resultsUrl = `${SPORTDATA_CONFIG.baseURL}/matches?apikey=${SPORTDATA_API_KEY}&date_from=${date}&date_to=${date}`;
        const resultsRes = await fetch(resultsUrl);
        const resultsData = await resultsRes.json();
        
        if (!resultsData.data) {
            console.log(`❌ Keine Ergebnis-Daten für ${date}`);
            return [];
        }

        const results = resultsData.data
            .filter(match => match.stats && match.stats.home_score !== null && match.stats.away_score !== null)
            .map(match => {
                const homeScore = match.stats.home_score;
                const awayScore = match.stats.away_score;
                
                let winner = "X";
                if (homeScore > awayScore) winner = "1";
                else if (homeScore < awayScore) winner = "2";
                
                const totalGoals = homeScore + awayScore;
                const over25 = totalGoals > 2.5 ? "Over 2.5" : "Under 2.5";
                const btts = homeScore > 0 && awayScore > 0 ? "BTTS Ja" : "BTTS Nein";
                
                return {
                    home: match.home_team?.name || "Unbekannt",
                    away: match.away_team?.name || "Unbekannt",
                    league: match.league?.name || "Unbekannt",
                    result: `${homeScore}-${awayScore}`,
                    winner: winner,
                    over25: over25,
                    btts: btts,
                    timestamp: match.match_start,
                    dataSource: "SPORTDATA_ORG"
                };
            });

        console.log(`✅ ${results.length} Ergebnisse geladen für ${date}`);
        return results;
        
    } catch (error) {
        console.error(`❌ Fehler beim Laden der Ergebnisse für ${date}:`, error.message);
        return [];
    }
}

function comparePredictionWithResult(prediction, actualResult) {
    if (!actualResult) return null;
    
    const comparisons = [];
    
    const correctWinner = prediction.predicted === actualResult.winner;
    comparisons.push({
        market: "1X2",
        predicted: prediction.predicted,
        actual: actualResult.winner,
        correct: correctWinner
    });
    
    if (prediction.predicted.includes("Over") || prediction.predicted.includes("Under")) {
        const correctOverUnder = prediction.predicted === actualResult.over25;
        comparisons.push({
            market: "Over/Under",
            predicted: prediction.predicted,
            actual: actualResult.over25,
            correct: correctOverUnder
        });
    }
    
    if (prediction.predicted.includes("BTTS")) {
        const correctBTTS = prediction.predicted === actualResult.btts;
        comparisons.push({
            market: "BTTS",
            predicted: prediction.predicted,
            actual: actualResult.btts,
            correct: correctBTTS
        });
    }
    
    return {
        game: `${prediction.home} vs ${prediction.away}`,
        league: prediction.league,
        date: prediction.timestamp?.split('T')[0],
        overallCorrect: comparisons.some(comp => comp.correct),
        comparisons: comparisons,
        confidence: prediction.aiRecommendation?.confidence || "UNBEKANNT",
        risk: prediction.aiRecommendation?.risk?.level || "UNBEKANNT"
    };
}

function calculatePerformanceStats(performanceData) {
    const allPredictions = Object.values(performanceData.predictions || {})
        .flat()
        .filter(p => p.actualResult);
    
    const totalGames = allPredictions.length;
    const correctPredictions = allPredictions.filter(p => p.actualResult.overallCorrect).length;
    const accuracy = totalGames > 0 ? (correctPredictions / totalGames) * 100 : 0;
    
    const marketStats = {};
    allPredictions.forEach(prediction => {
        prediction.actualResult.comparisons.forEach(comparison => {
            const market = comparison.market;
            if (!marketStats[market]) {
                marketStats[market] = { total: 0, correct: 0 };
            }
            marketStats[market].total++;
            if (comparison.correct) {
                marketStats[market].correct++;
            }
        });
    });
    
    const confidenceStats = {};
    allPredictions.forEach(prediction => {
        const confidence = prediction.actualResult.confidence;
        if (!confidenceStats[confidence]) {
            confidenceStats[confidence] = { total: 0, correct: 0 };
        }
        confidenceStats[confidence].total++;
        if (prediction.actualResult.overallCorrect) {
            confidenceStats[confidence].correct++;
        }
    });
    
    const riskStats = {};
    allPredictions.forEach(prediction => {
        const risk = prediction.actualResult.risk;
        if (!riskStats[risk]) {
            riskStats[risk] = { total: 0, correct: 0 };
        }
        riskStats[risk].total++;
        if (prediction.actualResult.overallCorrect) {
            riskStats[risk].correct++;
        }
    });
    
    return {
        overall: {
            total: totalGames,
            correct: correctPredictions,
            accuracy: Math.round(accuracy * 100) / 100
        },
        byMarket: Object.entries(marketStats).reduce((acc, [market, stats]) => {
            acc[market] = {
                ...stats,
                accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100 * 100) / 100 : 0
            };
            return acc;
        }, {}),
        byConfidence: Object.entries(confidenceStats).reduce((acc, [confidence, stats]) => {
            acc[confidence] = {
                ...stats,
                accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100 * 100) / 100 : 0
            };
            return acc;
        }, {}),
        byRisk: Object.entries(riskStats).reduce((acc, [risk, stats]) => {
            acc[risk] = {
                ...stats,
                accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100 * 100) / 100 : 0
            };
            return acc;
        }, {}),
        analyzedDays: Object.keys(performanceData.predictions || {}).length,
        lastUpdated: new Date().toISOString()
    };
}

async function updateHistoricalResults() {
    try {
        console.log("🕐 Aktualisiere historische Ergebnisse...");
        
        if (!PERFORMANCE_DATA.predictions) {
            console.log("❌ Keine Performance-Daten vorhanden");
            return;
        }
        
        let updatedCount = 0;
        const today = new Date().toISOString().slice(0, 10);
        
        for (const [date, predictions] of Object.entries(PERFORMANCE_DATA.predictions)) {
            if (date === today) continue;
            
            const needsUpdate = predictions.some(p => !p.actualResult);
            if (!needsUpdate) continue;
            
            const results = await fetchMatchResults(date);
            if (results.length === 0) continue;
            
            for (const prediction of predictions) {
                if (prediction.actualResult) continue;
                
                const actualResult = results.find(result => 
                    result.home.toLowerCase().includes(prediction.home.toLowerCase()) &&
                    result.away.toLowerCase().includes(prediction.away.toLowerCase())
                );
                
                if (actualResult) {
                    const comparison = comparePredictionWithResult(prediction, actualResult);
                    if (comparison) {
                        prediction.actualResult = comparison;
                        prediction.resultUpdatedAt = new Date().toISOString();
                        updatedCount++;
                        
                        console.log(`✅ Ergebnis aktualisiert: ${prediction.home} vs ${prediction.away} - ${comparison.overallCorrect ? '✅ RICHTIG' : '❌ FALSCH'}`);
                    }
                }
            }
        }
        
        if (updatedCount > 0) {
            fs.writeFileSync(PERFORMANCE_FILE, JSON.stringify(PERFORMANCE_DATA, null, 2));
            console.log(`📊 ${updatedCount} Ergebnisse aktualisiert`);
        }
        
    } catch (error) {
        console.error("❌ Fehler beim Aktualisieren historischer Ergebnisse:", error);
    }
}

async function initializePerformanceTracking() {
    try {
        console.log("🚀 Initialisiere Performance-Tracking...");
        
        if (fs.existsSync(PERFORMANCE_FILE)) {
            PERFORMANCE_DATA = JSON.parse(fs.readFileSync(PERFORMANCE_FILE, "utf-8"));
            console.log(`📊 Geladene Performance-Daten: ${Object.keys(PERFORMANCE_DATA.predictions || {}).length} Tage`);
        }
        
        // Starte erstes Update
        setTimeout(updateHistoricalResults, 5000);
        
        // Regelmäßige Updates (alle 6 Stunden)
        setInterval(updateHistoricalResults, 6 * 60 * 60 * 1000);
        
    } catch (error) {
        console.error("Fehler beim Initialisieren des Performance-Trackings:", error);
    }
}

// PERFORMANCE API ROUTES
app.get("/api/performance/stats", (req, res) => {
    try {
        if (!fs.existsSync(PERFORMANCE_FILE)) {
            return res.json({
                overall: { total: 0, correct: 0, accuracy: 0 },
                byMarket: {},
                byConfidence: {},
                byRisk: {},
                analyzedDays: 0,
                lastUpdated: new Date().toISOString(),
                status: "NO_DATA"
            });
        }
        
        const performanceData = JSON.parse(fs.readFileSync(PERFORMANCE_FILE, "utf-8"));
        const stats = calculatePerformanceStats(performanceData);
        
        res.json({
            ...stats,
            status: "SUCCESS"
        });
        
    } catch (error) {
        console.error("Fehler in Performance API:", error);
        res.status(500).json({
            overall: { total: 0, correct: 0, accuracy: 0 },
            byMarket: {},
            byConfidence: {},
            byRisk: {},
            analyzedDays: 0,
            lastUpdated: new Date().toISOString(),
            status: "ERROR",
            error: error.message
        });
    }
});

// HAUPTPERFORMANCE ROUTE (bleibt kompatibel)
app.get("/api/performance", (req, res) => {
    if (!fs.existsSync(PERFORMANCE_FILE)) {
        return res.json({ predictions: {}, overall: { total: 0, correct: 0, accuracy: 0 } });
    }
    const data = JSON.parse(fs.readFileSync(PERFORMANCE_FILE, "utf-8"));
    
    // Berechne Gesamtstatistik für Kompatibilität
    const allPredictions = Object.values(data.predictions || {}).flat();
    const gamesWithResults = allPredictions.filter(p => p.actualResult);
    const correctPredictions = gamesWithResults.filter(p => p.actualResult.overallCorrect).length;
    
    res.json({
        predictions: data.predictions,
        overall: {
            total: gamesWithResults.length,
            correct: correctPredictions,
            accuracy: gamesWithResults.length > 0 ? Math.round((correctPredictions / gamesWithResults.length) * 100) : 0
        }
    });
});

// START SERVER
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Initialisiere Performance-Tracking
initializePerformanceTracking();

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
    console.log(`📊 KI-Modell: ADVANCED_ENSEMBLE_V2 aktiviert`);
    console.log(`🎯 Performance-Tracking: AKTIVIERT`);
    console.log(`📈 Performance-Statistiken: /api/performance/stats`);
    console.log(`🔄 Automatische Ergebnis-Updates: AKTIVIERT`);
});
