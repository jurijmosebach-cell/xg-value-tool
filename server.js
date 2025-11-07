// server.js - ERWEITERTE VERSION mit Advanced KI & Ensemble Learning
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
const MODEL_WEIGHTS_FILE = path.join(DATA_DIR, "model_weights.json");

// NEU: Liga-spezifische Gewichtungen für Ensemble Learning
const LEAGUE_WEIGHTS = {
    "Bundesliga": { 
        xg: 0.35,      // Hohe xG-Gewichtung für offensive Liga
        form: 0.30,    // Aktuelle Form wichtig
        h2h: 0.15,     // Historische Daten weniger wichtig
        odds: 0.20     // Markt-Quoten
    },
    "Premier League": { 
        xg: 0.32, 
        form: 0.28, 
        h2h: 0.18, 
        odds: 0.22 
    },
    "La Liga": { 
        xg: 0.30, 
        form: 0.25, 
        h2h: 0.20, 
        odds: 0.25 
    },
    "Serie A": { 
        xg: 0.28,      // Weniger xG-Gewichtung für defensivere Liga
        form: 0.25, 
        h2h: 0.22,     // Mehr Gewicht auf historische Daten
        odds: 0.25 
    },
    "Ligue 1": { 
        xg: 0.33, 
        form: 0.27, 
        h2h: 0.17, 
        odds: 0.23 
    },
    "Eredivisie": { 
        xg: 0.38,      // Sehr hohe xG-Gewichtung für offensive Liga
        form: 0.25, 
        h2h: 0.12, 
        odds: 0.25 
    },
    "Champions League": { 
        xg: 0.30, 
        form: 0.20,    // Weniger Form-Gewichtung (andere Motivation)
        h2h: 0.25,     // Mehr H2H-Gewichtung (Erfahrung wichtig)
        odds: 0.25 
    },
    "default": { 
        xg: 0.32, 
        form: 0.26, 
        h2h: 0.18, 
        odds: 0.24 
    }
};

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
const MOMENTUM_CACHE = {};
let TEAM_IDS = {};
let HISTORICAL_STATS = {};
let PERFORMANCE_DATA = {};
let MODEL_WEIGHTS = {};

// NEU: Ensemble Learning Klasse
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
    
    // Haupt-Vorhersage-Methode
    predict(game, leagueName) {
        const weights = LEAGUE_WEIGHTS[leagueName] || LEAGUE_WEIGHTS.default;
        
        // Berechne Vorhersagen aller Modelle
        const predictions = {};
        for (const [modelName, modelFn] of Object.entries(this.models)) {
            predictions[modelName] = modelFn(game);
        }
        
        // Ensemble-Vorhersage (gewichteter Durchschnitt)
        let ensembleScore = 0;
        for (const [modelName, prediction] of Object.entries(predictions)) {
            ensembleScore += prediction.score * weights[modelName];
        }
        
        // Bestes Market finden
        const bestMarket = this.findBestMarket(predictions, weights);
        
        return {
            ensembleScore,
            predictions,
            weights,
            bestMarket,
            modelConfidence: this.calculateModelConfidence(predictions)
        };
    }
    
    // xG-basierte Vorhersage
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
            confidence: this.calculateXGConfidence(game)
        };
    }
    
    // Form-basierte Vorhersage
    formPrediction(game) {
        const formDiff = game.form.home - game.form.away;
        const homeAdvantage = 0.15; // Basis-Heimvorteil
        
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
        
        // Heimvorteil anwenden
        if (bestMarket === "1") score += homeAdvantage;
        if (bestMarket === "2") score -= homeAdvantage * 0.5;
        
        return {
            score: Math.min(score, 0.95),
            bestMarket,
            confidence: this.calculateFormConfidence(game)
        };
    }
    
    // H2H-basierte Vorhersage
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
            // Kein klarer Favorit
            bestMarket = "1";
            score = 0.5;
        }
        
        // BTTS/Over Anpassungen
        if (h2h.over25Percentage > 70) {
            score += 0.1;
        }
        if (h2h.bttsPercentage > 70) {
            score += 0.05;
        }
        
        return {
            score: Math.min(score, 0.9),
            bestMarket,
            confidence: h2h.totalGames >= 5 ? 0.8 : 0.5
        };
    }
    
    // Odds-basierte Vorhersage
    oddsPrediction(game) {
        const { odds, prob } = game;
        
        // Value Berechnung
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
            score: 0.5 + (valueScore * 2), // Transformiere Value zu Score
            bestMarket: bestValue.type,
            confidence: this.calculateOddsConfidence(game)
        };
    }
    
    // Momentum-basierte Vorhersage
    momentumPrediction(game) {
        const homeMomentum = calculateTeamMomentum(game.home);
        const awayMomentum = calculateTeamMomentum(game.away);
        const momentumDiff = homeMomentum - awayMomentum;
        
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
            confidence: Math.abs(momentumDiff) > 0.3 ? 0.8 : 0.5
        };
    }
    
    // Hilfsmethoden
    findBestMarket(predictions, weights) {
        const marketScores = {};
        
        for (const [modelName, prediction] of Object.entries(predictions)) {
            const weight = weights[modelName];
            const market = prediction.bestMarket;
            
            if (!marketScores[market]) marketScores[market] = 0;
            marketScores[market] += prediction.score * weight;
        }
        
        // Finde Market mit höchstem gewichtetem Score
        return Object.keys(marketScores).reduce((a, b) => 
            marketScores[b] > marketScores[a] ? b : a
        );
    }
    
    calculateModelConfidence(predictions) {
        const scores = Object.values(predictions).map(p => p.confidence);
        return scores.reduce((a, b) => a + b, 0) / scores.length;
    }
    
    calculateXGConfidence(game) {
        const xgTotal = game.homeXG + game.awayXG;
        // Höhere Confidence bei klaren xG-Unterschieden
        const xgDiff = Math.abs(game.homeXG - game.awayXG);
        return Math.min(0.3 + (xgDiff * 0.4) + (xgTotal * 0.1), 0.9);
    }
    
    calculateFormConfidence(game) {
        const formDiff = Math.abs(game.form.home - game.form.away);
        return Math.min(0.4 + (formDiff * 0.6), 0.9);
    }
    
    calculateOddsConfidence(game) {
        // Confidence basierend auf Markt-Volumen und Konsistenz
        const oddsArray = Object.values(game.odds).filter(o => o > 0);
        const oddsRange = Math.max(...oddsArray) - Math.min(...oddsArray);
        return Math.max(0.3, 0.7 - (oddsRange * 0.5));
    }
}

// NEU: Momentum Berechnung
async function calculateTeamMomentum(teamName) {
    const cacheKey = `momentum_${teamName}`;
    if (MOMENTUM_CACHE[cacheKey]) return MOMENTUM_CACHE[cacheKey];
    
    const teamId = TEAM_IDS[teamName];
    if (!teamId || !API_FOOTBALL_KEY) return 0.5;
    
    try {
        const res = await fetch(
            `https://v3.football.api-sports.io/fixtures?team=${teamId}&last=6&status=ft`,
            { headers: { "x-apisports-key": API_FOOTBALL_KEY } }
        );
        const data = await res.json();
        const fixtures = data?.response || [];
        
        if (fixtures.length === 0) return 0.5;
        
        let momentum = 0;
        let weight = 1.0;
        
        // Gewichtete Momentum-Berechnung (neuere Spiele stärker gewichtet)
        for (const fixture of fixtures.slice(0, 5)) {
            const isHome = fixture.teams.home.id === teamId;
            const goalsFor = isHome ? fixture.goals.home : fixture.goals.away;
            const goalsAgainst = isHome ? fixture.goals.away : fixture.goals.home;
            
            let points = 0;
            if (goalsFor > goalsAgainst) points = 1.0;
            else if (goalsFor === goalsAgainst) points = 0.5;
            
            // Tordifferenz-Bonus
            const goalDiffBonus = Math.min(0.2, (goalsFor - goalsAgainst) * 0.05);
            
            momentum += (points + goalDiffBonus) * weight;
            weight *= 0.8; // Exponentiell abnehmende Gewichtung
        }
        
        const totalWeight = (1 - Math.pow(0.8, fixtures.length)) / (1 - 0.8);
        const normalizedMomentum = momentum / totalWeight;
        
        MOMENTUM_CACHE[cacheKey] = Math.max(0.1, Math.min(0.9, normalizedMomentum));
        return MOMENTUM_CACHE[cacheKey];
    } catch (err) {
        console.error("Fehler bei Momentum-Berechnung:", err.message);
        return 0.5;
    }
}

// NEU: Spieltyp-Erkennung
function getGameType(game) {
    // Hier könnten wir später echte Derbys, Abstiegskämpfe etc. erkennen
    // Für jetzt: Einfache Heuristik basierend auf Tabellenposition etc.
    
    const isTopGame = game.home.includes("Bayern") || game.home.includes("Dortmund") || 
                     game.away.includes("Bayern") || game.away.includes("Dortmund") ||
                     game.home.includes("Real") || game.home.includes("Barcelona") ||
                     game.away.includes("Real") || game.away.includes("Barcelona");
    
    if (isTopGame) return "TOP_GAME";
    return "NORMAL";
}

// NEU: Erweiterte KI-Empfehlung mit Ensemble Learning
function getAdvancedAIRecommendation(game, leagueName) {
    const predictor = new EnsemblePredictor();
    const ensembleResult = predictor.predict(game, leagueName);
    const baseRisk = analyzeRisk(game);
    
    // Kontext-bewusste Anpassungen
    const contextAdjusted = applyContextAdjustments(ensembleResult, game);
    const gameType = getGameType(game);
    
    // Finale Empfehlung erstellen
    return createFinalRecommendation(contextAdjusted, baseRisk, game, gameType);
}

// NEU: Kontext-Anpassungen
function applyContextAdjustments(ensembleResult, game) {
    let adjusted = { ...ensembleResult };
    
    // Big Game Anpassung
    if (getGameType(game) === "TOP_GAME") {
        adjusted.ensembleScore *= 0.9; // Reduziere Confidence bei Top-Spielen
    }
    
    // Heimvorteil verstärken bei ausgeglichenen Vorhersagen
    if (adjusted.bestMarket === "1" && adjusted.ensembleScore < 0.7) {
        adjusted.ensembleScore += 0.05;
    }
    
    return adjusted;
}

// NEU: Finale Empfehlung erstellen
function createFinalRecommendation(ensembleResult, risk, game, gameType) {
    const { ensembleScore, bestMarket, modelConfidence } = ensembleResult;
    
    // Risk-basierte Confidence-Anpassung
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
    
    // Game-Type Info hinzufügen
    if (gameType === "TOP_GAME") {
        reasoning += " | Achtung: Top-Spiel - erhöhte Unberechenbarkeit";
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
// Bestehende Funktionen (angepasst mit neuer KI)
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

    // NEU: Lade ML Model Weights
    if (fs.existsSync(MODEL_WEIGHTS_FILE)) {
        MODEL_WEIGHTS = JSON.parse(fs.readFileSync(MODEL_WEIGHTS_FILE, "utf-8"));
        console.log("✅ ML Model Weights geladen");
    } else {
        MODEL_WEIGHTS = {};
    }
}

// NEU: Alte KI-Funktion als Fallback
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
        timestamp: new Date().toISOString(),
        modelType: "BASIC" // NEU: Kennzeichnung des Modelltyps
    };
}

// Risiko-Analyse (erweitert)
function analyzeRisk(game) {
    const { prob, value, homeXG, awayXG, form } = game;
    
    const factors = {
        closeProb: Math.abs(prob.home - prob.away) < 0.2 ? 0.8 : 0.2,
        lowXG: (homeXG + awayXG) < 2.0 ? 0.7 : 0.1,
        poorForm: (form.home < 0.3 || form.away < 0.3) ? 0.6 : 0.1,
        negativeValue: Object.values(value).some(v => v < -0.3) ? 0.9 : 0.1,
        // NEU: Ensemble-spezifische Risiken
        modelDisagreement: calculateModelDisagreement(game)
    };
    
    const riskScore = (
        factors.closeProb * 0.3 +
        factors.lowXG * 0.25 +
        factors.poorForm * 0.2 +
        factors.negativeValue * 0.2 +
        factors.modelDisagreement * 0.05
    );
    
    return {
        score: riskScore,
        level: riskScore > 0.7 ? "SEHR HOCH" : riskScore > 0.5 ? "HOCH" : riskScore > 0.3 ? "MEDIUM" : "NIEDRIG",
        factors: factors
    };
}

// NEU: Modell-Disagreement berechnen
function calculateModelDisagreement(game) {
    // Simuliere verschiedene Modell-Vorhersagen
    // In der echten Implementierung würden wir die Ensemble-Ergebnisse nutzen
    const predictions = [
        game.prob.home,  // Modell 1: Heim
        game.prob.away,  // Modell 2: Auswärts  
        game.prob.draw,  // Modell 3: Unentschieden
        game.prob.over25 // Modell 4: Over
    ];
    
    const variance = calculateVariance(predictions);
    return Math.min(variance * 2, 1); // Normalisiere auf 0-1
}

// NEU: Varianz berechnen
function calculateVariance(numbers) {
    const mean = numbers.reduce((a, b) => a + b) / numbers.length;
    const squareDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squareDiffs.reduce((a, b) => a + b) / numbers.length;
}

// Head-to-Head Funktionen (wie vorher)
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

    const recentGames = headToHeadGames.slice(0, 5);
    
    recentGames.forEach(game => {
        const homeGoals = game.goals.home;
        const awayGoals = game.goals.away;
        const totalGoals = homeGoals + awayGoals;
        
        if (homeGoals > awayGoals) stats.homeWins++;
        else if (homeGoals === awayGoals) stats.draws++;
        else stats.awayWins++;
        
        stats.totalGoals += totalGoals;
        stats.homeGoals += homeGoals;
        stats.awayGoals += awayGoals;
        
        if (homeGoals > 0 && awayGoals > 0) stats.bttsGames++;
        if (totalGoals > 2.5) stats.over25Games++;
        
        stats.recentGames.push({
            date: game.fixture.date.slice(0, 10),
            result: `${homeGoals}-${awayGoals}`,
            competition: game.league.name,
            homeTeam: game.teams.home.name,
            awayTeam: game.teams.away.name
        });
    });

    stats.homeWinPercentage = (stats.homeWins / recentGames.length) * 100;
    stats.drawPercentage = (stats.draws / recentGames.length) * 100;
    stats.awayWinPercentage = (stats.awayWins / recentGames.length) * 100;
    stats.avgGoals = stats.totalGoals / recentGames.length;
    stats.bttsPercentage = (stats.bttsGames / recentGames.length) * 100;
    stats.over25Percentage = (stats.over25Games / recentGames.length) * 100;
    stats.avgHomeGoals = stats.homeGoals / recentGames.length;
    stats.avgAwayGoals = stats.awayGoals / recentGames.length;

    stats.trend = analyzeH2HTrend(stats);
    stats.strength = calculateH2HStrength(stats);

    return stats;
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

// Teams und Form Funktionen
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

// Haupt-API Route (ERWEITERT mit Advanced KI)
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

                // H2H Daten abrufen
                const homeTeamId = TEAM_IDS[home];
                const awayTeamId = TEAM_IDS[away];
                let h2hData = null;
                
                if (homeTeamId && awayTeamId) {
                    const h2hGames = await getHeadToHead(homeTeamId, awayTeamId);
                    h2hData = analyzeHeadToHead(h2hGames, home, away);
                }

                // NEU: Advanced KI mit Ensemble Learning
                let aiRecommendation;
                try {
                    aiRecommendation = getAdvancedAIRecommendation(
                        { home, away, league: league.name, odds, prob, value, homeXG, awayXG, form: { home: homeForm, away: awayForm }, h2hData },
                        league.name
                    );
                    aiRecommendation.modelType = "ENSEMBLE"; // Kennzeichnung
                } catch (error) {
                    console.error("Advanced KI Fehler, fallback zu Basic:", error);
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
                    h2hData
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

// NEUE ROUTE: Ensemble Model Info
app.get("/api/model-info", (req, res) => {
    res.json({
        ensembleWeights: LEAGUE_WEIGHTS,
        modelTypes: ["ENSEMBLE", "BASIC"],
        features: ["xg", "form", "h2h", "odds", "momentum"],
        version: "2.0.0"
    });
});

// Bestehende Routen
app.get("/api/live-stats/:fixtureId", async (req, res) => {
    const { fixtureId } = req.params;
    
    try {
        const stats = await getLiveStatistics(fixtureId);
        res.json({ success: true, stats });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.get("/api/performance", (req, res) => {
    res.json(PERFORMANCE_DATA);
});

// Start
await loadOrFetchTeams();
await loadHistoricalData();
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT} (mit Advanced Ensemble KI)`));
