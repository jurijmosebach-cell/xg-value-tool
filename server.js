// server.js - COMMONJS VERSION (FUNKTIONIERT AUF RENDER) - TEIL 1/4
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.static(__dirname));

// KEINE API KEY PRÜFUNG - alles optional
const ODDS_API_KEY = process.env.ODDS_API_KEY || "demo_key";
const SPORTDATA_API_KEY = process.env.SPORTDATA_API_KEY || process.env.FOOTBALL_DATA_API_KEY || "demo_key";

const PORT = process.env.PORT || 10000;
const DATA_DIR = path.join(__dirname, "data");
const PERFORMANCE_FILE = path.join(DATA_DIR, "performance.json");

// Ligen Konfiguration
const LEAGUES = [
    { 
        key: "soccer_epl", 
        name: "Premier League", 
        baseXG: [1.65, 1.30], 
        avgGoals: 2.85 
    },
    { 
        key: "soccer_germany_bundesliga", 
        name: "Bundesliga", 
        baseXG: [1.75, 1.45], 
        avgGoals: 3.20 
    },
    { 
        key: "soccer_spain_la_liga", 
        name: "La Liga", 
        baseXG: [1.50, 1.25], 
        avgGoals: 2.75 
    },
    { 
        key: "soccer_italy_serie_a", 
        name: "Serie A", 
        baseXG: [1.55, 1.30], 
        avgGoals: 2.85 
    },
    { 
        key: "soccer_france_ligue_one", 
        name: "Ligue 1", 
        baseXG: [1.50, 1.25], 
        avgGoals: 2.75 
    },
    { 
        key: "soccer_uefa_champs_league", 
        name: "Champions League", 
        baseXG: [1.60, 1.40], 
        avgGoals: 3.00 
    }
];

const CACHE = {};
let PERFORMANCE_DATA = {};

// Team-Mapping für realistischere Daten
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
    if (TEAM_MAPPINGS[teamName]) return TEAM_MAPPINGS[teamName];
    for (const [key, value] of Object.entries(TEAM_MAPPINGS)) {
        if (teamName.includes(key) || key.includes(teamName)) return value;
    }
    return teamName;
}

// OPTIMIERTES ENSEMBLE KI-MODELL (funktioniert immer)
class RobustEnsemblePredictor {
    constructor() {
        this.models = {
            xg: this.xgPrediction.bind(this),
            form: this.formPrediction.bind(this),
            value: this.valuePrediction.bind(this)
        };
    }
    
    predict(game, leagueName) {
        try {
            const weights = this.getWeights(leagueName);
            const predictions = {};
            
            for (const [modelName, modelFn] of Object.entries(this.models)) {
                predictions[modelName] = modelFn(game);
            }
            
            const marketScores = this.calculateMarketScores(predictions, weights);
            const bestMarket = this.findBestMarket(marketScores);
            const ensembleScore = marketScores[bestMarket];
            
            return {
                ensembleScore: Math.min(0.95, Math.max(0.05, ensembleScore)),
                bestMarket,
                predictions,
                weights,
                confidence: this.calculateConfidence(predictions, game),
                marketScores
            };
            
        } catch (error) {
            console.error("Ensemble Fehler:", error);
            return this.getFallbackPrediction(game);
        }
    }
    
    getWeights(leagueName) {
        return { xg: 0.4, form: 0.35, value: 0.25 };
    }
    
    xgPrediction(game) {
        const { prob, value } = game;
        const markets = [
            { type: "1", score: prob.home * (1 + Math.max(0, value.home)) },
            { type: "X", score: prob.draw * (1 + Math.max(0, value.draw)) },
            { type: "2", score: prob.away * (1 + Math.max(0, value.away)) },
            { type: "Over 2.5", score: prob.over25 * (1 + Math.max(0, value.over25)) },
            { type: "BTTS Ja", score: prob.btts * (1 + Math.max(0, value.btts)) }
        ];
        
        const best = markets.reduce((a, b) => b.score > a.score ? b : a);
        return { score: best.score, bestMarket: best.type, confidence: 0.7 };
    }
    
    formPrediction(game) {
        const formDiff = game.form.home - game.form.away;
        let bestMarket, score;
        
        if (formDiff > 0.2) {
            bestMarket = "1";
            score = 0.6 + (formDiff * 0.5) + 0.1; // Heimvorteil
        } else if (formDiff < -0.2) {
            bestMarket = "2";
            score = 0.6 + (Math.abs(formDiff) * 0.5) - 0.05;
        } else {
            bestMarket = "X";
            score = 0.4 + (0.2 - Math.abs(formDiff)) * 0.7;
        }
        
        return { score: Math.min(0.85, score), bestMarket, confidence: 0.6 };
    }
    
    valuePrediction(game) {
        const { odds, prob } = game;
        const markets = [
            { type: "1", value: prob.home * odds.home - 1 },
            { type: "X", value: prob.draw * odds.draw - 1 },
            { type: "2", value: prob.away * odds.away - 1 },
            { type: "Over 2.5", value: prob.over25 * odds.over25 - 1 }
        ].filter(m => m.value > 0);
        
        if (markets.length === 0) {
            return { score: 0.5, bestMarket: "1", confidence: 0.3 };
        }
        
        const bestValue = markets.reduce((a, b) => b.value > a.value ? b : a);
        const score = 0.5 + (bestValue.value * 2);
        
        return { 
            score: Math.min(0.9, score), 
            bestMarket: bestValue.type, 
            confidence: 0.5 + (bestValue.value * 0.5) 
        };
    }
    
    calculateMarketScores(predictions, weights) {
        const marketScores = {};
        for (const [modelName, prediction] of Object.entries(predictions)) {
            const weight = weights[modelName];
            const market = prediction.bestMarket;
            if (!marketScores[market]) marketScores[market] = 0;
            marketScores[market] += prediction.score * weight;
        }
        return marketScores;
    }
    
    calculateConfidence(predictions, game) {
        let totalConfidence = 0;
        let count = 0;
        for (const prediction of Object.values(predictions)) {
            totalConfidence += prediction.confidence;
            count++;
        }
        return count > 0 ? totalConfidence / count : 0.5;
    }
    
    findBestMarket(marketScores) {
        return Object.keys(marketScores).reduce((a, b) => 
            marketScores[b] > marketScores[a] ? b : a
        );
    }
    
    getFallbackPrediction(game) {
        const { prob } = game;
        const bestProb = Math.max(prob.home, prob.draw, prob.away);
        const bestMarket = bestProb === prob.home ? "1" : bestProb === prob.draw ? "X" : "2";
        
        return {
            ensembleScore: bestProb,
            bestMarket,
            predictions: { fallback: { score: bestProb, bestMarket, confidence: 0.3 } },
            weights: { fallback: 1 },
            confidence: 0.3,
            marketScores: { [bestMarket]: bestProb }
        };
    }
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
// server.js - COMMONJS VERSION (FUNKTIONIERT AUF RENDER) - TEIL 2/4

// HAUPT-API ROUTE - FUNKTIONIERT IMMER
app.get("/api/games", async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const date = req.query.date || today;
    const leaguesParam = req.query.leagues
        ? req.query.leagues.split(",")
        : LEAGUES.map(l => l.key);

    const cacheId = `${date}_${leaguesParam.sort().join(",")}`;
    if (CACHE[cacheId]) {
        console.log("📦 Verwende Cache für:", date);
        return res.json(CACHE[cacheId]);
    }

    console.log("🎯 Lade Spiele für:", date, leaguesParam);
    const games = [];
    let apiDataAvailable = false;

    // VERSUCHE: Echte Odds API Daten zu laden
    for (const league of LEAGUES.filter(l => leaguesParam.includes(l.key))) {
        try {
            if (ODDS_API_KEY && ODDS_API_KEY !== "demo_key") {
                const oddsUrl = `https://api.the-odds-api.com/v4/sports/${league.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso`;
                console.log(`📡 Versuche echte Daten für ${league.name}...`);
                
                const resOdds = await fetch(oddsUrl);
                if (resOdds.ok) {
                    const data = await resOdds.json();
                    
                    if (data && data.length > 0) {
                        console.log(`✅ Echte Daten für ${league.name}: ${data.length} Spiele`);
                        processRealGames(data, games, league, date);
                        apiDataAvailable = true;
                        continue; // Erfolg - nächste Liga
                    }
                }
            }
            
            // FALLBACK: Demo-Daten
            console.log(`🔄 Verwende Demo-Daten für ${league.name}`);
            generateDemoGames(games, league, date);
            
        } catch (err) {
            console.log(`❌ Fehler bei ${league.name}:`, err.message);
            generateDemoGames(games, league, date);
        }
    }

    // Verarbeite echte Spiele
    function processRealGames(data, games, league, date) {
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
                home: h2h.find(o => o.name === home)?.price || 2.0,
                draw: h2h.find(o => o.name === "Draw")?.price || 3.4,
                away: h2h.find(o => o.name === away)?.price || 3.2,
                over25: totals.find(o => o.name === "Over" && o.point === 2.5)?.price || 2.1,
            };

            createGameAnalysis(home, away, league, odds, games, "REAL_DATA");
        }
    }

    // Generiere Demo-Spiele
    function generateDemoGames(games, league, date) {
        const demoTeams = getDemoTeams(league.name);
        
        demoTeams.forEach((match, index) => {
            const home = match.home;
            const away = match.away;
            
            // Realistische Odds basierend auf Team-Stärke
            const isTopGame = home.includes("Bayern") || home.includes("Real") || home.includes("Manchester");
            const isDerby = (home.includes("Bayern") && away.includes("Dortmund")) || 
                           (home.includes("Real") && away.includes("Barcelona"));
            
            const odds = {
                home: isTopGame ? (isDerby ? 1.9 : 1.8) : 2.1,
                draw: isDerby ? 3.8 : 3.4,
                away: isTopGame ? (isDerby ? 4.0 : 4.2) : 3.6,
                over25: isTopGame ? 1.8 : 2.0
            };

            createGameAnalysis(home, away, league, odds, games, "DEMO_DATA");
        });
    }

    // Demo-Teams für verschiedene Ligen
    function getDemoTeams(leagueName) {
        const teams = {
            "Premier League": [
                { home: "Manchester United", away: "Liverpool" },
                { home: "Arsenal", away: "Chelsea" },
                { home: "Manchester City", away: "Tottenham" }
            ],
            "Bundesliga": [
                { home: "Bayern Munich", away: "Borussia Dortmund" },
                { home: "RB Leipzig", away: "Bayer Leverkusen" },
                { home: "Borussia Mönchengladbach", away: "Eintracht Frankfurt" }
            ],
            "La Liga": [
                { home: "Real Madrid", away: "Barcelona" },
                { home: "Atletico Madrid", away: "Sevilla" },
                { home: "Valencia", away: "Villarreal" }
            ],
            "Serie A": [
                { home: "Juventus", away: "Inter Milan" },
                { home: "AC Milan", away: "Napoli" },
                { home: "Roma", away: "Lazio" }
            ],
            "Ligue 1": [
                { home: "PSG", away: "Marseille" },
                { home: "Lyon", away: "Monaco" },
                { home: "Lille", away: "Nice" }
            ],
            "Champions League": [
                { home: "Bayern Munich", away: "Real Madrid" },
                { home: "Manchester City", away: "Barcelona" },
                { home: "Liverpool", away: "Juventus" }
            ]
        };
        
        return teams[leagueName] || [
            { home: "Heimteam", away: "Auswärtsteam" },
            { home: "Team A", away: "Team B" }
        ];
    }

    // Erstelle Spielanalyse (für echte und Demo-Daten)
    function createGameAnalysis(home, away, league, odds, games, dataQuality) {
        // Realistische Form basierend auf Team-Stärke
        const homeStrength = getTeamStrength(home);
        const awayStrength = getTeamStrength(away);
        
        const homeForm = 0.5 + (homeStrength * 0.3) + (Math.random() * 0.2 - 0.1);
        const awayForm = 0.5 + (awayStrength * 0.3) + (Math.random() * 0.2 - 0.1);

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

        // H2H Daten (intelligent simuliert)
        const h2hData = generateSmartH2H(home, away);

        // OPTIMIERTE KI-EMPFEHLUNG
        const aiRecommendation = getOptimizedAIRecommendation(
            { 
                home, away, league: league.name, odds, prob, value, 
                homeXG, awayXG, 
                form: { home: homeForm, away: awayForm },
                h2hData 
            },
            league.name
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
            form: { home: +homeForm.toFixed(2), away: +awayForm.toFixed(2) },
            aiRecommendation,
            h2hData,
            dataQuality,
            isTopGame: homeStrength > 0.7 && awayStrength > 0.7
        });
    }

    // Team-Stärke für realistischere Form
    function getTeamStrength(teamName) {
        const topTeams = ["Bayern", "Real Madrid", "Barcelona", "Manchester City", "Liverpool", "PSG", "Juventus"];
        const strongTeams = ["Dortmund", "Chelsea", "Arsenal", "Atletico", "Inter", "Milan", "Leipzig"];
        
        if (topTeams.some(team => teamName.includes(team))) return 0.8;
        if (strongTeams.some(team => teamName.includes(team))) return 0.6;
        return 0.4;
    }

    // Intelligente H2H Generierung
    function generateSmartH2H(home, away) {
        const isTopGame = getTeamStrength(home) > 0.7 && getTeamStrength(away) > 0.7;
        const isDerby = (home.includes("Bayern") && away.includes("Dortmund")) || 
                       (home.includes("Real") && away.includes("Barcelona")) ||
                       (home.includes("Manchester") && away.includes("Liverpool"));
        
        if (isDerby) {
            return {
                available: true,
                totalGames: 12,
                homeWinPercentage: 45,
                drawPercentage: 25,
                awayWinPercentage: 30,
                avgGoals: 3.4,
                bttsPercentage: 70,
                over25Percentage: 80,
                trends: ["Torreiche Duelle", "Häufig beide Teams treffen"],
                strength: 0,
                dataSource: "SIMULATED_DERBY"
            };
        }
        
        if (isTopGame) {
            return {
                available: true,
                totalGames: 8,
                homeWinPercentage: 40,
                drawPercentage: 30,
                awayWinPercentage: 30,
                avgGoals: 2.8,
                bttsPercentage: 60,
                over25Percentage: 65,
                trends: ["Ausgeglichene Bilanz"],
                strength: 0,
                dataSource: "SIMULATED_TOP"
            };
        }
        
        // Normales Spiel
        return {
            available: true,
            totalGames: 5,
            homeWinPercentage: 50,
            drawPercentage: 25,
            awayWinPercentage: 25,
            avgGoals: 2.5,
            bttsPercentage: 55,
            over25Percentage: 50,
            trends: ["Heimvorteil erkennbar"],
            strength: 0.5,
            dataSource: "SIMULATED_NORMAL"
        };
    }

    console.log(`📊 ${games.length} Spiele analysiert (${apiDataAvailable ? 'Echte Daten' : 'Demo-Daten'})`);

    // Cache für 10 Minuten
    CACHE[cacheId] = { 
        response: games,
        meta: {
            total: games.length,
            dataQuality: apiDataAvailable ? "REAL" : "DEMO",
            cachedUntil: Date.now() + 600000
        }
    };

    res.json({ 
        response: games,
        message: apiDataAvailable ? 
            "✅ Echte Odds-Daten geladen" : 
            "🧪 Demo-Daten - Füge ODDS_API_KEY für echte Daten hinzu"
    });
});
// server.js - COMMONJS VERSION (FUNKTIONIERT AUF RENDER) - TEIL 3/4

// OPTIMIERTE KI-EMPFEHLUNGS FUNKTION
function getOptimizedAIRecommendation(game, leagueName) {
    try {
        const predictor = new RobustEnsemblePredictor();
        const ensembleResult = predictor.predict(game, leagueName);
        const riskAnalysis = analyzeRisk(game);
        
        return createAIRecommendation(ensembleResult, riskAnalysis, game);
        
    } catch (error) {
        console.error("KI Fehler:", error);
        return getFallbackRecommendation(game);
    }
}

function analyzeRisk(game) {
    const { prob, value, homeXG, awayXG, form } = game;
    
    const riskFactors = {
        closeMatch: Math.abs(prob.home - prob.away) < 0.15 ? 0.8 : 0.1,
        lowProbability: Math.max(prob.home, prob.draw, prob.away) < 0.4 ? 0.7 : 0.1,
        lowScoring: (homeXG + awayXG) < 2.0 ? 0.6 : 0.1,
        poorForm: (form.home < 0.3 || form.away < 0.3) ? 0.5 : 0.1,
        negativeValue: Object.values(value).some(v => v < -0.2) ? 0.6 : 0.1
    };
    
    const riskScore = (
        riskFactors.closeMatch * 0.3 +
        riskFactors.lowProbability * 0.2 +
        riskFactors.lowScoring * 0.2 +
        riskFactors.poorForm * 0.15 +
        riskFactors.negativeValue * 0.15
    );
    
    return {
        score: Math.min(1, riskScore),
        level: riskScore > 0.7 ? "SEHR HOCH" : 
               riskScore > 0.5 ? "HOCH" : 
               riskScore > 0.3 ? "MEDIUM" : "NIEDRIG",
        factors: riskFactors
    };
}

function createAIRecommendation(ensembleResult, riskAnalysis, game) {
    const { ensembleScore, bestMarket, confidence, marketScores } = ensembleResult;
    const { score: riskScore, level: riskLevel } = riskAnalysis;
    
    // Risiko-angepasster Score
    const riskAdjustedScore = ensembleScore * (1 - riskScore * 0.3);
    
    let recommendation, reasoning;
    
    // ENTSCHEIDUNGSLOGIK
    if (riskScore < 0.3 && riskAdjustedScore > 0.65 && confidence > 0.6) {
        recommendation = "STRONG_BET";
        reasoning = `🏆 STARKE EMPFEHLUNG: ${bestMarket} (Score: ${(riskAdjustedScore * 100).toFixed(1)}%)`;
    } 
    else if (riskScore < 0.4 && riskAdjustedScore > 0.55 && confidence > 0.5) {
        recommendation = "VALUE_BET";
        reasoning = `💰 VALUE WETTE: ${bestMarket} bietet gutes Potenzial (Score: ${(riskAdjustedScore * 100).toFixed(1)}%)`;
    }
    else if (riskScore < 0.5 && riskAdjustedScore > 0.45) {
        recommendation = "CAUTIOUS_BET";
        reasoning = `⚠️ VORSICHTIG: ${bestMarket} als Option (Score: ${(riskAdjustedScore * 100).toFixed(1)}%)`;
    }
    else {
        recommendation = "AVOID";
        reasoning = `🚫 VERMEIDEN: Zu hohes Risiko (${riskLevel}) oder unklare Kante`;
    }
    
    // Detaillierte Begründung
    reasoning += generateReasoning(game, ensembleResult, riskAnalysis);
    
    return {
        recommendation,
        confidence: getConfidenceLevel(confidence),
        reasoning,
        bestMarket,
        bestScore: riskAdjustedScore,
        risk: riskAnalysis,
        ensembleData: ensembleResult,
        modelType: "ROBUST_ENSEMBLE",
        timestamp: new Date().toISOString()
    };
}

function generateReasoning(game, ensembleResult, riskAnalysis) {
    let details = "";
    
    // H2H Insights
    if (game.h2hData?.available) {
        details += ` | H2H: ${game.h2hData.homeWinPercentage.toFixed(0)}%-${game.h2hData.drawPercentage.toFixed(0)}%-${game.h2hData.awayWinPercentage.toFixed(0)}%`;
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
    
    details += ` | Modelle: ${topModels.join("+")}`;
    
    return details;
}

function getConfidenceLevel(confidence) {
    if (confidence > 0.75) return "SEHR HOCH";
    if (confidence > 0.6) return "HOCH";
    if (confidence > 0.45) return "MEDIUM";
    return "NIEDRIG";
}

function getFallbackRecommendation(game) {
    const { prob, value } = game;
    
    const markets = [
        { type: "1", score: prob.home * (1 + Math.max(0, value.home)) },
        { type: "X", score: prob.draw * (1 + Math.max(0, value.draw)) },
        { type: "2", score: prob.away * (1 + Math.max(0, value.away)) },
        { type: "Over 2.5", score: prob.over25 * (1 + Math.max(0, value.over25)) }
    ];
    
    const best = markets.reduce((a, b) => b.score > a.score ? b : a);
    const risk = analyzeRisk(game);
    
    let recommendation, reasoning;
    
    if (risk.score < 0.4 && best.score > 0.6) {
        recommendation = "STRONG_BET";
        reasoning = `Basic-KI: ${best.type} mit ${(best.score * 100).toFixed(1)}% Score`;
    } 
    else if (risk.score < 0.5 && best.score > 0.5) {
        recommendation = "VALUE_BET";
        reasoning = `Basic-KI: ${best.type} als Value Wette`;
    }
    else {
        recommendation = "CAUTIOUS_BET";
        reasoning = `Basic-KI: ${best.type} mit Vorsicht`;
    }
    
    return {
        recommendation,
        confidence: "MEDIUM",
        reasoning,
        bestMarket: best.type,
        bestScore: best.score,
        risk: risk,
        modelType: "BASIC_FALLBACK",
        timestamp: new Date().toISOString()
    };
}

// PERFORMANCE-TRACKING (vereinfacht)
function initializePerformanceTracking() {
    console.log("📊 Performance-Tracking initialisiert");
    // Keine automatischen Updates - nur manuell
}

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
                status: "READY",
                message: "Performance-Tracking bereit - analysiere Spiele!"
            });
        }
        
        const performanceData = JSON.parse(fs.readFileSync(PERFORMANCE_FILE, "utf-8"));
        const stats = calculatePerformanceStats(performanceData);
        
        res.json({
            ...stats,
            status: "ACTIVE"
        });
        
    } catch (error) {
        console.error("Performance API Fehler:", error);
        res.json({
            overall: { total: 0, correct: 0, accuracy: 0 },
            byMarket: {},
            byConfidence: {},
            byRisk: {},
            analyzedDays: 0,
            lastUpdated: new Date().toISOString(),
            status: "ERROR",
            message: "Performance-Daten temporär nicht verfügbar"
        });
    }
});

function calculatePerformanceStats(performanceData) {
    const allPredictions = Object.values(performanceData.predictions || {})
        .flat()
        .filter(p => p.actualResult);
    
    const totalGames = allPredictions.length;
    const correctPredictions = allPredictions.filter(p => p.actualResult.overallCorrect).length;
    const accuracy = totalGames > 0 ? (correctPredictions / totalGames) * 100 : 0;
    
    return {
        overall: {
            total: totalGames,
            correct: correctPredictions,
            accuracy: Math.round(accuracy * 100) / 100
        },
        byMarket: {},
        byConfidence: {},
        byRisk: {},
        analyzedDays: Object.keys(performanceData.predictions || {}).length,
        lastUpdated: new Date().toISOString()
    };
}

app.get("/api/performance", (req, res) => {
    if (!fs.existsSync(PERFORMANCE_FILE)) {
        return res.json({ 
            predictions: {}, 
            overall: { total: 0, correct: 0, accuracy: 0 } 
        });
    }
    
    try {
        const data = JSON.parse(fs.readFileSync(PERFORMANCE_FILE, "utf-8"));
        res.json(data);
    } catch (error) {
        res.json({ 
            predictions: {}, 
            overall: { total: 0, correct: 0, accuracy: 0 } 
        });
    }
});

// MANUELLE ERGEBNIS-EINGABE
app.post("/api/performance/update-result", express.json(), (req, res) => {
    try {
        const { date, home, away, homeScore, awayScore } = req.body;
        
        if (!PERFORMANCE_DATA.predictions) {
            PERFORMANCE_DATA.predictions = {};
        }
        
        if (!PERFORMANCE_DATA.predictions[date]) {
            return res.status(404).json({ error: "Keine Vorhersagen für dieses Datum" });
        }
        
        // Finde Vorhersage
        const prediction = PERFORMANCE_DATA.predictions[date].find(p => 
            p.home === home && p.away === away
        );
        
        if (!prediction) {
            return res.status(404).json({ error: "Spiel nicht gefunden" });
        }
        
        // Berechne Ergebnis
        let winner = "X";
        if (homeScore > awayScore) winner = "1";
        else if (homeScore < awayScore) winner = "2";
        
        const wasCorrect = prediction.predicted === winner;
        
        prediction.actualResult = {
            overallCorrect: wasCorrect,
            comparisons: [{
                market: "1X2",
                predicted: prediction.predicted,
                actual: winner,
                correct: wasCorrect
            }],
            result: `${homeScore}-${awayScore}`,
            timestamp: new Date().toISOString()
        };
        
        // Speichere Daten
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
        fs.writeFileSync(PERFORMANCE_FILE, JSON.stringify(PERFORMANCE_DATA, null, 2));
        
        res.json({
            success: true,
            wasCorrect,
            message: wasCorrect ? "✅ Vorhersage war richtig!" : "❌ Vorhersage war falsch"
        });
        
    } catch (error) {
        console.error("Ergebnis Update Fehler:", error);
        res.status(500).json({ error: error.message });
    }
});
// server.js - COMMONJS VERSION (FUNKTIONIERT AUF RENDER) - TEIL 4/4

// CACHE CLEANING
function cleanOldCache() {
    const now = Date.now();
    const cacheKeys = Object.keys(CACHE);
    
    for (const key of cacheKeys) {
        const cacheEntry = CACHE[key];
        if (cacheEntry.meta && cacheEntry.meta.cachedUntil < now) {
            delete CACHE[key];
            console.log("🗑️ Alten Cache gelöscht:", key);
        }
    }
    
    // Behalte nur die letzten 50 Cache-Einträge
    if (cacheKeys.length > 50) {
        const keysToDelete = cacheKeys.slice(0, cacheKeys.length - 50);
        keysToDelete.forEach(key => delete CACHE[key]);
        console.log(`🗑️ ${keysToDelete.length} alte Cache-Einträge gelöscht`);
    }
}

// HEALTH CHECK API
app.get("/api/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        cacheSize: Object.keys(CACHE).length,
        performanceData: !!PERFORMANCE_DATA.predictions,
        environment: {
            hasOddsKey: !!(ODDS_API_KEY && ODDS_API_KEY !== "demo_key"),
            hasSportDataKey: !!(SPORTDATA_API_KEY && SPORTDATA_API_KEY !== "demo_key"),
            port: PORT
        }
    });
});

// DEMO DATA API für Tests
app.get("/api/demo-games", (req, res) => {
    const games = [];
    const league = LEAGUES[0]; // Premier League
    
    const demoMatches = [
        { home: "Manchester United", away: "Liverpool" },
        { home: "Arsenal", away: "Chelsea" },
        { home: "Manchester City", away: "Tottenham" }
    ];
    
    demoMatches.forEach(match => {
        const odds = {
            home: 2.1,
            draw: 3.4,
            away: 3.2,
            over25: 2.0
        };
        
        const homeForm = 0.6;
        const awayForm = 0.55;
        
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

        const h2hData = {
            available: true,
            totalGames: 8,
            homeWinPercentage: 45,
            drawPercentage: 25,
            awayWinPercentage: 30,
            avgGoals: 3.2,
            bttsPercentage: 65,
            over25Percentage: 75,
            trends: ["Torreiche Duelle in der Vergangenheit"],
            strength: 0.5,
            dataSource: "DEMO"
        };

        const aiRecommendation = getOptimizedAIRecommendation(
            { 
                home: match.home, 
                away: match.away, 
                league: league.name, 
                odds, prob, value, 
                homeXG, awayXG, 
                form: { home: homeForm, away: awayForm },
                h2hData 
            },
            league.name
        );

        games.push({
            home: match.home,
            away: match.away,
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
            dataQuality: "DEMO_DATA",
            isDemo: true
        });
    });
    
    res.json({ 
        response: games,
        message: "Demo-Daten für Testzwecke"
    });
});

// STATISCHE ROUTEN
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/leagues", (req, res) => {
    res.json(LEAGUES.map(league => ({
        key: league.key,
        name: league.name,
        avgGoals: league.avgGoals
    })));
});

// ERROR HANDLING MIDDLEWARE
app.use((error, req, res, next) => {
    console.error("❌ Unbehandelter Fehler:", error);
    res.status(500).json({
        error: "Interner Serverfehler",
        message: "Bitte versuche es später erneut"
    });
});

// 404 HANDLER
app.use((req, res) => {
    res.status(404).json({
        error: "Endpoint nicht gefunden",
        availableEndpoints: [
            "GET /api/games",
            "GET /api/performance/stats", 
            "GET /api/health",
            "GET /api/demo-games",
            "GET /api/leagues"
        ]
    });
});

// INITIALISIERUNG
function initializeServer() {
    console.log("🔧 Initialisiere Server...");
    
    // Datenverzeichnis erstellen
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR);
        console.log("📁 Datenverzeichnis erstellt");
    }
    
    // Performance-Daten laden
    if (fs.existsSync(PERFORMANCE_FILE)) {
        try {
            PERFORMANCE_DATA = JSON.parse(fs.readFileSync(PERFORMANCE_FILE, "utf-8"));
            console.log(`📊 Performance-Daten geladen: ${Object.keys(PERFORMANCE_DATA.predictions || {}).length} Tage`);
        } catch (error) {
            console.log("❌ Fehler beim Laden der Performance-Daten:", error.message);
            PERFORMANCE_DATA = {};
        }
    }
    
    // Performance-Tracking initialisieren
    initializePerformanceTracking();
    
    // Cache Cleaning starten (alle 15 Minuten)
    setInterval(cleanOldCache, 15 * 60 * 1000);
    
    console.log("✅ Server initialisiert");
}

// SERVER START
initializeServer();

app.listen(PORT, () => {
    console.log("\n" + "=".repeat(50));
    console.log("🚀 FOOTBALL xG ANALYZER PRO - GESTARTET");
    console.log("=".repeat(50));
    console.log(`📍 Port: ${PORT}`);
    console.log(`🎯 KI-Modell: ROBUST ENSEMBLE V2`);
    console.log(`📊 Performance-Tracking: ✅ AKTIV`);
    console.log(`🔄 Cache-System: ✅ AKTIV`);
    console.log(`🌐 Demo-Modus: ${(!ODDS_API_KEY || ODDS_API_KEY === "demo_key") ? '✅ AKTIV' : '❌ INAKTIV'}`);
    console.log("");
    console.log("📡 Verfügbare Endpoints:");
    console.log("   GET /api/games          - Spiele analysieren");
    console.log("   GET /api/performance/stats - Performance Statistiken");
    console.log("   GET /api/health         - System Status");
    console.log("   GET /api/demo-games     - Demo Daten");
    console.log("");
    console.log("💡 Tipp: Füge ODDS_API_KEY zu .env hinzu für echte Daten!");
    console.log("=".repeat(50) + "\n");
});

// Export für Tests (falls benötigt)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = app;
}
