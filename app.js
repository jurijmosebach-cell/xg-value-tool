// app.js - KOMPLETTE VERSION MIT PERFORMANCE-TRACKING - TEIL 1/4
const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");
const leagueSelect = document.getElementById("league-select");

// Standard-Datum = heute
const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

// Klick auf "Spiele laden"
refreshBtn.addEventListener("click", loadMatches);

// NEUE FUNKTION: Performance-Daten laden
async function loadPerformanceStats() {
    try {
        const res = await fetch('/api/performance/stats');
        const data = await res.json();
        return data;
    } catch (err) {
        console.error('Fehler beim Laden der Performance-Daten:', err);
        return null;
    }
}

// NEUE FUNKTION: Erweiterte Performance-Anzeige
function showEnhancedPerformanceOverview(performanceData) {
    const performanceSection = document.createElement('div');
    performanceSection.className = 'top-section bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 p-6';
    
    if (!performanceData || performanceData.status === "NO_DATA") {
        performanceSection.innerHTML = `
            <h2 class="text-xl font-bold text-gray-800 mb-4">📈 Performance Tracking</h2>
            <div class="text-center text-gray-600 py-8">
                <div class="text-4xl mb-2">📊</div>
                <p>Noch keine Performance-Daten verfügbar</p>
                <p class="text-sm mt-2">Analysiere Spiele um Statistiken zu sammeln</p>
                <p class="text-xs mt-1">Ergebnisse werden automatisch nach Spielende aktualisiert</p>
            </div>
        `;
        return performanceSection;
    }

    const overall = performanceData.overall;
    const accuracy = overall.accuracy;
    
    performanceSection.innerHTML = `
        <h2 class="text-xl font-bold text-gray-800 mb-4">📈 Performance Tracking</h2>
        
        <!-- Haupt-KPIs -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-white p-4 rounded-lg text-center shadow-sm">
                <div class="text-2xl font-bold ${accuracy > 60 ? 'text-green-600' : accuracy > 50 ? 'text-yellow-600' : 'text-red-600'}">${accuracy}%</div>
                <div class="text-sm text-gray-600">Gesamt Genauigkeit</div>
            </div>
            <div class="bg-white p-4 rounded-lg text-center shadow-sm">
                <div class="text-2xl font-bold text-blue-600">${overall.total}</div>
                <div class="text-sm text-gray-600">Analysierte Spiele</div>
            </div>
            <div class="bg-white p-4 rounded-lg text-center shadow-sm">
                <div class="text-2xl font-bold text-purple-600">${overall.correct}</div>
                <div class="text-sm text-gray-600">Korrekte Vorhersagen</div>
            </div>
            <div class="bg-white p-4 rounded-lg text-center shadow-sm">
                <div class="text-2xl font-bold text-orange-600">${performanceData.analyzedDays}</div>
                <div class="text-sm text-gray-600">Analysierte Tage</div>
            </div>
        </div>
        
        <!-- Zusätzliche Metriken -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white p-4 rounded-lg shadow-sm">
                <h3 class="font-semibold text-gray-800 mb-2">Beste Märkte</h3>
                ${performanceData.byMarket && Object.keys(performanceData.byMarket).length > 0 ? 
                    Object.entries(performanceData.byMarket)
                        .sort(([,a], [,b]) => b.accuracy - a.accuracy)
                        .slice(0, 2)
                        .map(([market, stats]) => `
                            <div class="text-sm mb-2">
                                <div class="flex justify-between">
                                    <span>${market}</span>
                                    <span class="font-bold text-green-600">${stats.accuracy}%</span>
                                </div>
                                <div class="text-xs text-gray-500">${stats.total} Spiele</div>
                            </div>
                        `).join('') 
                    : '<p class="text-sm text-gray-500">Noch nicht genug Daten</p>'
                }
            </div>
            
            <div class="bg-white p-4 rounded-lg shadow-sm">
                <h3 class="font-semibold text-gray-800 mb-2">Confidence Genauigkeit</h3>
                ${performanceData.byConfidence && Object.keys(performanceData.byConfidence).length > 0 ? 
                    Object.entries(performanceData.byConfidence)
                        .map(([confidence, stats]) => `
                            <div class="text-sm mb-1">
                                <div class="flex justify-between">
                                    <span>${confidence}</span>
                                    <span class="font-bold ${stats.accuracy > 50 ? 'text-green-600' : 'text-red-600'}">${stats.accuracy}%</span>
                                </div>
                                <div class="text-xs text-gray-500">${stats.total} Spiele</div>
                            </div>
                        `).join('')
                    : '<p class="text-sm text-gray-500">Noch nicht genug Daten</p>'
                }
            </div>
        </div>
        
        <!-- Letzte Aktualisierung -->
        <div class="mt-4 text-center text-xs text-gray-500">
            Letzte Aktualisierung: ${new Date(performanceData.lastUpdated).toLocaleString('de-DE')}
            ${performanceData.status === "DEMO" ? '<br><span class="text-orange-600">⚠️ Demo-Modus aktiv</span>' : ''}
        </div>
    `;
    
    return performanceSection;
}

// H2H Badge Style
function getH2HBadgeStyle(h2hData) {
    if (!h2hData || !h2hData.available) {
        return { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-300", icon: "📊", label: "Keine H2H Daten" };
    }
    
    const strength = h2hData.strength || 0;
    
    if (strength > 1) return { bg: "bg-green-100", text: "text-green-800", border: "border-green-300", icon: "📈", label: "Starke H2H Historie" };
    if (strength > 0) return { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300", icon: "📊", label: "Positive H2H Historie" };
    if (strength < -1) return { bg: "bg-red-100", text: "text-red-800", border: "border-red-300", icon: "📉", label: "Schwierige H2H Historie" };
    
    return { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300", icon: "⚖️", label: "Ausgeglichene H2H Historie" };
}

// Zeige H2H Übersicht
function showH2HOverview(games) {
    const gamesWithH2H = games.filter(g => g.h2hData && g.h2hData.available);
    
    if (gamesWithH2H.length === 0) return null;

    const h2hSection = document.createElement('div');
    h2hSection.className = 'top-section bg-gradient-to-r from-orange-50 to-amber-100 border-l-4 border-orange-500 p-6';
    
    const interestingH2H = gamesWithH2H.filter(g => 
        Math.abs(g.h2hData.strength) > 1 || 
        g.h2hData.over25Percentage > 70 || 
        g.h2hData.homeWinPercentage > 70
    ).slice(0, 5);

    h2hSection.innerHTML = `
        <h2 class="text-xl font-bold text-gray-800 mb-4">📊 Head-to-Head Insights</h2>
        <div class="space-y-4">
            ${interestingH2H.map(game => {
                const h2h = game.h2hData;
                const badgeStyle = getH2HBadgeStyle(h2h);
                
                return `
                    <div class="bg-white rounded-xl shadow-lg border ${badgeStyle.border} p-4">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <div class="font-bold text-lg">${game.home} vs ${game.away}</div>
                                <div class="text-sm text-gray-600">${game.league}</div>
                            </div>
                            <span class="${badgeStyle.bg} ${badgeStyle.text} px-3 py-1 rounded-full text-sm font-medium">
                                ${badgeStyle.icon} ${badgeStyle.label}
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div class="text-center">
                                <div class="font-semibold text-gray-600">Heimsiege</div>
                                <div class="text-lg font-bold text-green-600">${h2h.homeWinPercentage.toFixed(0)}%</div>
                            </div>
                            <div class="text-center">
                                <div class="font-semibold text-gray-600">Unentschieden</div>
                                <div class="text-lg font-bold text-yellow-600">${h2h.drawPercentage.toFixed(0)}%</div>
                            </div>
                            <div class="text-center">
                                <div class="font-semibold text-gray-600">Auswärtssiege</div>
                                <div class="text-lg font-bold text-red-600">${h2h.awayWinPercentage.toFixed(0)}%</div>
                            </div>
                            <div class="text-center">
                                <div class="font-semibold text-gray-600">Ø Tore</div>
                                <div class="text-lg font-bold text-purple-600">${h2h.avgGoals.toFixed(1)}</div>
                            </div>
                        </div>
                        
                        ${h2h.trends && h2h.trends.length > 0 ? `
                            <div class="mt-3 p-3 bg-gray-50 rounded-lg">
                                <div class="text-sm font-semibold text-gray-700 mb-1">H2H Trends:</div>
                                <div class="text-sm text-gray-600">${h2h.trends.slice(0, 2).join(' • ')}</div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
        
        <div class="mt-4 text-center text-sm text-gray-600">
            ${gamesWithH2H.length} von ${games.length} Spielen mit H2H Daten verfügbar
        </div>
    `;
    
    return h2hSection;
}
// app.js - KOMPLETTE VERSION MIT PERFORMANCE-TRACKING - TEIL 2/4

// Erweiterte Match-Karte mit H2H
function createEnhancedMatchCard(game) {
    const card = document.createElement("div");
    card.className = "match-card bg-white rounded-xl shadow-lg border p-4";
    
    const homeVal = game.prob.home * 100;
    const drawVal = game.prob.draw * 100;
    const awayVal = game.prob.away * 100;
    const overVal = game.prob.over25 * 100;
    const bttsVal = game.prob.btts * 100;

    const markets = [
        { type: "1", prob: game.prob.home, value: game.value.home },
        { type: "X", prob: game.prob.draw, value: game.value.draw },
        { type: "2", prob: game.prob.away, value: game.value.away },
        { type: "Over 2.5", prob: game.prob.over25, value: game.value.over25 },
        { type: "BTTS Ja", prob: game.prob.btts, value: game.value.btts }
    ];
    
    const bestMarket = markets.reduce((a, b) => 
        (b.prob + b.value) > (a.prob + a.value) ? b : a
    );

    // KI-Empfehlung
    const aiRec = game.aiRecommendation;
    const recStyle = getRecommendationStyle(aiRec.recommendation);
    const riskStyle = getRiskBadge(aiRec.risk.level);
    
    // H2H Badge
    const h2hBadge = getH2HBadgeStyle(game.h2hData);

    // Performance Badge (falls Ergebnis bekannt)
    const performanceBadge = game.performance ? 
        `<span class="text-xs ${game.performance.wasCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} px-2 py-1 rounded ml-2">
            ${game.performance.result}
        </span>` : '';

    card.innerHTML = `
        <div class="match-header mb-4">
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-gray-500">${game.league}</span>
                <div class="flex space-x-2">
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">xG: ${game.totalXG}</span>
                    <span class="text-xs ${riskStyle} px-2 py-1 rounded">Risiko: ${aiRec.risk.level}</span>
                    ${game.h2hData && game.h2hData.available ? 
                        `<span class="text-xs ${h2hBadge.bg} ${h2hBadge.text} px-2 py-1 rounded">H2H: ${game.h2hData.totalGames} Spiele</span>` : 
                        ''
                    }
                    ${performanceBadge}
                </div>
            </div>
            <div class="flex justify-between items-center">
                <div class="text-center">
                    <div class="font-semibold">${game.home}</div>
                    <div class="text-sm text-gray-600">${game.homeXG} xG • ${(game.form.home * 100).toFixed(0)}% Form</div>
                </div>
                <div class="text-gray-400 mx-2">vs</div>
                <div class="text-center">
                    <div class="font-semibold">${game.away}</div>
                    <div class="text-sm text-gray-600">${game.awayXG} xG • ${(game.form.away * 100).toFixed(0)}% Form</div>
                </div>
            </div>
        </div>

        <!-- H2H Section wenn verfügbar -->
        ${game.h2hData && game.h2hData.available ? `
            <div class="mb-4 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center space-x-2">
                        <span class="text-blue-600">📊</span>
                        <span class="font-semibold text-blue-800">Head-to-Head</span>
                    </div>
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        ${game.h2hData.totalGames} historische Spiele
                    </span>
                </div>
                
                <div class="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                        <div class="font-bold text-green-600">${game.h2hData.homeWinPercentage.toFixed(0)}%</div>
                        <div class="text-gray-600">Heimsiege</div>
                    </div>
                    <div>
                        <div class="font-bold text-yellow-600">${game.h2hData.drawPercentage.toFixed(0)}%</div>
                        <div class="text-gray-600">Unentschieden</div>
                    </div>
                    <div>
                        <div class="font-bold text-red-600">${game.h2hData.awayWinPercentage.toFixed(0)}%</div>
                        <div class="text-gray-600">Auswärtssiege</div>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-2 mt-2 text-center text-xs">
                    <div>
                        <div class="font-bold text-purple-600">${game.h2hData.avgGoals.toFixed(1)}</div>
                        <div class="text-gray-600">Ø Tore/Spiel</div>
                    </div>
                    <div>
                        <div class="font-bold text-orange-600">${game.h2hData.over25Percentage.toFixed(0)}%</div>
                        <div class="text-gray-600">Over 2.5</div>
                    </div>
                </div>
                
                ${game.h2hData.trends && game.h2hData.trends.length > 0 ? `
                    <div class="mt-2 text-xs text-gray-600">
                        <span class="font-semibold">Trend:</span> ${game.h2hData.trends[0]}
                    </div>
                ` : ''}
            </div>
        ` : ''}

        <!-- KI-Empfehlung -->
        <div class="${recStyle.bg} ${recStyle.text} rounded-lg p-3 mb-4">
            <div class="flex justify-between items-center">
                <div class="flex items-center space-x-2">
                    <span>${recStyle.icon}</span>
                    <span class="font-bold text-sm">${recStyle.label}</span>
                </div>
                <span class="text-sm font-semibold">${aiRec.bestMarket}</span>
            </div>
            <div class="text-sm mt-1 opacity-90">${aiRec.reasoning}</div>
        </div>

        <!-- Wahrscheinlichkeiten -->
        <div class="space-y-3">
            <div>
                <div class="flex justify-between text-sm mb-1">
                    <span>Heimsieg</span>
                    <span>${homeVal.toFixed(1)}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-green-500 h-2 rounded-full" style="width: ${homeVal}%"></div>
                </div>
            </div>
            
            <div>
                <div class="flex justify-between text-sm mb-1">
                    <span>Unentschieden</span>
                    <span>${drawVal.toFixed(1)}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-yellow-500 h-2 rounded-full" style="width: ${drawVal}%"></div>
                </div>
            </div>
            
            <div>
                <div class="flex justify-between text-sm mb-1">
                    <span>Auswärtssieg</span>
                    <span>${awayVal.toFixed(1)}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-red-500 h-2 rounded-full" style="width: ${awayVal}%"></div>
                </div>
            </div>
        </div>

        <!-- Additional Markets -->
        <div class="grid grid-cols-2 gap-4 mt-4">
            <div class="text-center">
                <div class="text-sm text-gray-600">Over 2.5</div>
                <div class="text-lg font-bold ${overVal > 50 ? 'text-green-600' : 'text-red-600'}">
                    ${overVal.toFixed(1)}%
                </div>
            </div>
            <div class="text-center">
                <div class="text-sm text-gray-600">BTTS Ja</div>
                <div class="text-lg font-bold ${bttsVal > 50 ? 'text-green-600' : 'text-red-600'}">
                    ${bttsVal.toFixed(1)}%
                </div>
            </div>
        </div>

        <div class="mt-4 p-3 bg-gray-50 rounded-lg">
            <div class="text-center font-semibold text-blue-600">
                🤖 KI Confidence: ${aiRec.confidence}
            </div>
            <div class="text-center text-sm text-gray-600 mt-1">
                Score: ${(aiRec.bestScore * 100).toFixed(1)}%
                ${game.h2hData && game.h2hData.available ? ' • Mit H2H Daten' : ''}
                ${game.dataQuality === "DEMO_DATA" ? ' • 🧪 Demo-Daten' : ''}
            </div>
        </div>
    `;
    
    return card;
}

// Ensemble Badge Style
function getEnsembleBadgeStyle(aiRecommendation) {
    if (!aiRecommendation.ensembleData) {
        return { bg: "bg-gray-100", text: "text-gray-600", icon: "🤖", label: "Basic KI" };
    }
    
    const score = aiRecommendation.bestScore;
    
    if (score > 0.7) return { bg: "bg-gradient-to-r from-purple-500 to-pink-600", text: "text-white", icon: "🧠", label: "Ensemble KI" };
    if (score > 0.6) return { bg: "bg-gradient-to-r from-blue-500 to-cyan-600", text: "text-white", icon: "🧠", label: "Ensemble KI" };
    return { bg: "bg-gradient-to-r from-green-500 to-emerald-600", text: "text-white", icon: "🧠", label: "Ensemble KI" };
}

// Top 5 Wahrscheinlichkeiten
function showTop5Probabilities(games) {
    const topProbabilities = [...games]
        .map(game => {
            const bestProb = Math.max(
                game.prob.home, 
                game.prob.draw, 
                game.prob.away
            );
            const bestType = 
                bestProb === game.prob.home ? "1" :
                bestProb === game.prob.draw ? "X" : "2";
            
            return {
                ...game,
                bestProbability: bestProb,
                bestType: bestType
            };
        })
        .filter(game => game.bestProbability > 0.4)
        .sort((a, b) => b.bestProbability - a.bestProbability)
        .slice(0, 5);

    if (topProbabilities.length === 0) return null;

    const section = document.createElement('div');
    section.className = 'top-section bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-500 p-6';
    
    section.innerHTML = `
        <h2 class="text-xl font-bold text-gray-800 mb-4">🎯 Top 5 Wahrscheinlichkeiten</h2>
        <div class="space-y-3">
            ${topProbabilities.map(game => `
                <div class="bg-white rounded-xl shadow-lg border border-blue-200 p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <div class="font-semibold text-gray-800">${game.home} vs ${game.away}</div>
                            <div class="text-sm text-gray-600">${game.league}</div>
                        </div>
                        <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                            ${(game.bestProbability * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-700">Beste Wette: <b>${game.bestType}</b></span>
                        <div class="flex space-x-2 text-xs">
                            <span class="bg-green-100 text-green-800 px-2 py-1 rounded">1: ${(game.prob.home * 100).toFixed(1)}%</span>
                            <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">X: ${(game.prob.draw * 100).toFixed(1)}%</span>
                            <span class="bg-red-100 text-red-800 px-2 py-1 rounded">2: ${(game.prob.away * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                    ${game.aiRecommendation ? `
                        <div class="mt-2 text-xs text-gray-600">
                            KI: ${game.aiRecommendation.recommendation === 'STRONG_BET' ? '🎯' : '💰'} ${game.aiRecommendation.bestMarket}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
    
    return section;
}

// Top 5 Over/Under
function showTop5OverUnder(games) {
    const topOverUnder = [...games]
        .map(game => ({
            ...game,
            over25Prob: game.prob.over25,
            under25Prob: 1 - game.prob.over25
        }))
        .filter(game => game.over25Prob > 0.7 || game.under25Prob > 0.7)
        .sort((a, b) => {
            const aTendency = Math.max(a.over25Prob, a.under25Prob);
            const bTendency = Math.max(b.over25Prob, b.under25Prob);
            return bTendency - aTendency;
        })
        .slice(0, 5);

    if (topOverUnder.length === 0) return null;

    const section = document.createElement('div');
    section.className = 'top-section bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6';
    
    section.innerHTML = `
        <h2 class="text-xl font-bold text-gray-800 mb-4">⚽ Top 5 Over/Under 2.5</h2>
        <div class="space-y-3">
            ${topOverUnder.map(game => {
                const isOver = game.over25Prob > 0.5;
                const probability = isOver ? game.over25Prob : game.under25Prob;
                const type = isOver ? "Over 2.5" : "Under 2.5";
                const barColor = isOver ? "bg-green-500" : "bg-red-500";
                const textColor = isOver ? "text-green-700" : "text-red-700";
                const bgColor = isOver ? "bg-green-100" : "bg-red-100";
                
                return `
                    <div class="bg-white rounded-xl shadow-lg border border-green-200 p-4">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <div class="font-semibold text-gray-800">${game.home} vs ${game.away}</div>
                                <div class="text-sm text-gray-600">${game.league}</div>
                            </div>
                            <span class="${bgColor} ${textColor} px-3 py-1 rounded-full text-sm font-semibold">
                                ${type}: ${(probability * 100).toFixed(1)}%
                            </span>
                        </div>
                        
                        <div class="mb-2">
                            <div class="flex justify-between text-sm text-gray-600 mb-1">
                                <span>Over 2.5: ${(game.over25Prob * 100).toFixed(1)}%</span>
                                <span>Under 2.5: ${(game.under25Prob * 100).toFixed(1)}%</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-3">
                                <div class="h-3 rounded-full flex">
                                    <div class="${barColor} rounded-l-full" style="width: ${game.over25Prob * 100}%"></div>
                                    <div class="bg-red-500 rounded-r-full" style="width: ${game.under25Prob * 100}%"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="text-xs text-gray-600">
                            Ø xG: <b>${game.totalXG}</b> | 
                            ${game.h2hData && game.h2hData.available ? `H2H Over: ${game.h2hData.over25Percentage.toFixed(0)}%` : 'Keine H2H Daten'}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    return section;
}
// app.js - KOMPLETTE VERSION MIT PERFORMANCE-TRACKING - TEIL 3/4

// Top 5 BTTS (Both Teams To Score)
function showTop5BTTS(games) {
    const topBTTS = [...games]
        .map(game => ({
            ...game,
            bttsYes: game.prob.btts,
            bttsNo: 1 - game.prob.btts
        }))
        .filter(game => game.bttsYes > 0.6 || game.bttsNo > 0.7)
        .sort((a, b) => {
            const aTendency = Math.max(a.bttsYes, a.bttsNo);
            const bTendency = Math.max(b.bttsYes, b.bttsNo);
            return bTendency - aTendency;
        })
        .slice(0, 5);

    if (topBTTS.length === 0) return null;

    const section = document.createElement('div');
    section.className = 'top-section bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 p-6';
    
    section.innerHTML = `
        <h2 class="text-xl font-bold text-gray-800 mb-4">🎪 Top 5 BTTS (Both Teams To Score)</h2>
        <div class="space-y-3">
            ${topBTTS.map(game => {
                const isBTTSYes = game.bttsYes > 0.5;
                const probability = isBTTSYes ? game.bttsYes : game.bttsNo;
                const type = isBTTSYes ? "BTTS Ja" : "BTTS Nein";
                const barColor = isBTTSYes ? "bg-orange-500" : "bg-gray-500";
                const textColor = isBTTSYes ? "text-orange-700" : "text-gray-700";
                const bgColor = isBTTSYes ? "bg-orange-100" : "bg-gray-100";
                
                return `
                    <div class="bg-white rounded-xl shadow-lg border border-orange-200 p-4">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <div class="font-semibold text-gray-800">${game.home} vs ${game.away}</div>
                                <div class="text-sm text-gray-600">${game.league}</div>
                            </div>
                            <span class="${bgColor} ${textColor} px-3 py-1 rounded-full text-sm font-semibold">
                                ${type}: ${(probability * 100).toFixed(1)}%
                            </span>
                        </div>
                        
                        <div class="mb-2">
                            <div class="flex justify-between text-sm text-gray-600 mb-1">
                                <span>BTTS Ja: ${(game.bttsYes * 100).toFixed(1)}%</span>
                                <span>BTTS Nein: ${(game.bttsNo * 100).toFixed(1)}%</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-3">
                                <div class="h-3 rounded-full flex">
                                    <div class="${barColor} rounded-l-full" style="width: ${game.bttsYes * 100}%"></div>
                                    <div class="bg-gray-500 rounded-r-full" style="width: ${game.bttsNo * 100}%"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="text-xs text-gray-600">
                            Heim xG: <b>${game.homeXG}</b> | Auswärts xG: <b>${game.awayXG}</b>
                            ${game.h2hData && game.h2hData.available ? `| H2H BTTS: ${game.h2hData.bttsPercentage.toFixed(0)}%` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    return section;
}

// Zeige Ensemble Insights
function showEnsembleInsights(games) {
    const ensembleGames = games.filter(g => g.aiRecommendation.modelType === "ENSEMBLE");
    
    if (ensembleGames.length === 0) return null;

    const insightsSection = document.createElement('div');
    insightsSection.className = 'top-section bg-gradient-to-r from-purple-50 to-pink-100 border-l-4 border-purple-500 p-6';
    
    const topEnsemble = ensembleGames
        .filter(g => g.aiRecommendation.bestScore > 0.6)
        .sort((a, b) => b.aiRecommendation.bestScore - a.aiRecommendation.bestScore)
        .slice(0, 3);

    insightsSection.innerHTML = `
        <h2 class="text-xl font-bold text-gray-800 mb-4">🧠 Ensemble KI Insights</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                <div class="text-2xl font-bold text-purple-600">${ensembleGames.length}</div>
                <div class="text-sm text-gray-600">Ensemble Analysen</div>
            </div>
            <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                <div class="text-2xl font-bold text-green-600">${topEnsemble.length}</div>
                <div class="text-sm text-gray-600">Starke Empfehlungen</div>
            </div>
            <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                <div class="text-2xl font-bold text-blue-600">${topEnsemble.length > 0 ? (topEnsemble.reduce((acc, g) => acc + g.aiRecommendation.bestScore, 0) / topEnsemble.length * 100).toFixed(1) : '0'}%</div>
                <div class="text-sm text-gray-600">Ø Ensemble Score</div>
            </div>
        </div>
        
        ${topEnsemble.length > 0 ? `
            <div class="space-y-3">
                <h3 class="font-semibold text-gray-800">Top Ensemble Empfehlungen</h3>
                ${topEnsemble.map(game => {
                    const aiRec = game.aiRecommendation;
                    const ensembleBadge = getEnsembleBadgeStyle(aiRec);
                    
                    return `
                        <div class="bg-white rounded-xl shadow-lg border p-4">
                            <div class="flex justify-between items-center mb-2">
                                <div class="font-semibold">${game.home} vs ${game.away}</div>
                                <span class="text-xs ${ensembleBadge.bg} ${ensembleBadge.text} px-2 py-1 rounded-full">
                                    ${ensembleBadge.icon} ${ensembleBadge.label}
                                </span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-gray-600">Empfohlen: <b>${aiRec.bestMarket}</b></span>
                                <span class="text-lg font-bold text-purple-600">${(aiRec.bestScore * 100).toFixed(1)}%</span>
                            </div>
                            <div class="text-xs text-gray-500 mt-1">${aiRec.reasoning}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : ''}
    `;
    
    return insightsSection;
}

// Bestehende Hilfsfunktionen
function getRecommendationStyle(recommendation) {
    const styles = {
        "STRONG_BET": { 
            bg: "bg-gradient-to-r from-green-500 to-emerald-600",
            text: "text-white",
            border: "border-green-600",
            icon: "🎯",
            label: "STARKE EMPFEHLUNG"
        },
        "VALUE_BET": { 
            bg: "bg-gradient-to-r from-blue-500 to-cyan-600", 
            text: "text-white",
            border: "border-blue-600",
            icon: "💰", 
            label: "VALUE WETTE"
        },
        "CAUTIOUS_BET": { 
            bg: "bg-gradient-to-r from-yellow-400 to-orange-500",
            text: "text-white",
            border: "border-yellow-500",
            icon: "⚠️",
            label: "VORSICHTIG"
        },
        "AVOID": { 
            bg: "bg-gradient-to-r from-gray-400 to-gray-600",
            text: "text-white",
            border: "border-gray-500",
            icon: "🚫",
            label: "VERMEIDEN"
        }
    };
    return styles[recommendation] || styles["AVOID"];
}

function getRiskBadge(riskLevel) {
    const riskStyles = {
        "SEHR HOCH": "bg-red-100 text-red-800 border border-red-300",
        "HOCH": "bg-orange-100 text-orange-800 border border-orange-300", 
        "MEDIUM": "bg-yellow-100 text-yellow-800 border border-yellow-300",
        "NIEDRIG": "bg-green-100 text-green-800 border border-green-300"
    };
    return riskStyles[riskLevel] || riskStyles["MEDIUM"];
}

// Zeige AI Recommendations
function showAIRecommendations(games) {
    const strongRecommendations = games.filter(g => 
        g.aiRecommendation && 
        ['STRONG_BET', 'VALUE_BET'].includes(g.aiRecommendation.recommendation)
    ).sort((a, b) => b.aiRecommendation.bestScore - a.aiRecommendation.bestScore);

    if (strongRecommendations.length === 0) return null;

    const recommendationsSection = document.createElement('div');
    recommendationsSection.className = 'top-section bg-gradient-to-r from-green-50 to-emerald-100 border-l-4 border-green-500 p-6';
    
    recommendationsSection.innerHTML = `
        <h2 class="text-xl font-bold text-gray-800 mb-4">🤖 KI Top Empfehlungen</h2>
        <div class="space-y-4">
            ${strongRecommendations.map(game => {
                const rec = game.aiRecommendation;
                const style = getRecommendationStyle(rec.recommendation);
                const riskStyle = getRiskBadge(rec.risk.level);
                const h2hBadge = getH2HBadgeStyle(game.h2hData);
                
                return `
                    <div class="bg-white rounded-xl shadow-lg border ${style.border} overflow-hidden">
                        <div class="${style.bg} ${style.text} p-4">
                            <div class="flex justify-between items-center">
                                <div class="flex items-center space-x-2">
                                    <span class="text-lg">${style.icon}</span>
                                    <span class="font-bold">${style.label}</span>
                                </div>
                                <div class="flex space-x-2">
                                    <span class="text-sm px-3 py-1 bg-white bg-opacity-20 rounded-full">
                                        Risiko: <span class="${riskStyle} px-2 py-1 rounded-full text-xs">${rec.risk.level}</span>
                                    </span>
                                    ${game.h2hData && game.h2hData.available ? 
                                        `<span class="text-sm ${h2hBadge.bg} ${h2hBadge.text} px-2 py-1 rounded-full text-xs">H2H</span>` : 
                                        ''
                                    }
                                </div>
                            </div>
                        </div>
                        
                        <div class="p-4">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <div class="font-bold text-lg">${game.home} vs ${game.away}</div>
                                    <div class="text-sm text-gray-600">${game.league}</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-2xl font-bold text-blue-600">${rec.bestMarket}</div>
                                    <div class="text-sm text-gray-600">Empfohlene Wette</div>
                                </div>
                            </div>
                            
                            <div class="bg-gray-50 rounded-lg p-3 mb-3">
                                <div class="text-sm text-gray-700">${rec.reasoning}</div>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4 text-sm mt-3">
                                <div class="text-center">
                                    <div class="font-semibold text-gray-800">KI Confidence</div>
                                    <div class="text-lg font-bold ${rec.confidence === 'SEHR HOCH' ? 'text-green-600' : rec.confidence === 'HOCH' ? 'text-blue-600' : 'text-yellow-600'}">
                                        ${rec.confidence}
                                    </div>
                                </div>
                                <div class="text-center">
                                    <div class="font-semibold text-gray-800">Score</div>
                                    <div class="text-lg font-bold text-purple-600">
                                        ${(rec.bestScore * 100).toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    return recommendationsSection;
}
// app.js - KOMPLETTE VERSION MIT PERFORMANCE-TRACKING - TEIL 4/4

// HAUPTFUNKTION: Spiele laden (optimiert)
async function loadMatches() {
    const date = dateInput.value;
    const leagues = Array.from(leagueSelect.selectedOptions).map(o => o.value);

    if (!date) {
        statusDiv.textContent = "Bitte Datum wählen!";
        return;
    }
    if (leagues.length === 0) {
        statusDiv.textContent = "Bitte mindestens eine Liga wählen!";
        return;
    }

    statusDiv.textContent = "Lade Spiele und KI-Analysen...";
    matchList.innerHTML = "";

    // Loading State für Button
    const button = document.getElementById('refresh');
    const buttonText = button.querySelector('#button-text');
    const spinner = button.querySelector('#loading-spinner');
    spinner.classList.remove('hidden');
    buttonText.textContent = 'Analysiere...';
    button.disabled = true;

    try {
        console.log("🚀 Starte Analyse für:", date, leagues);
        
        // Lade Performance-Daten parallel
        const performancePromise = loadPerformanceStats();
        
        // Lade Spiele
        const apiUrl = `/api/games?date=${date}&leagues=${leagues.join(",")}`;
        console.log("📡 API URL:", apiUrl);
        
        const res = await fetch(apiUrl);
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        
        const data = await res.json();
        console.log("✅ API Response erhalten:", data);

        if (!data.response || data.response.length === 0) {
            statusDiv.textContent = "Keine Spiele gefunden für das ausgewählte Datum.";
            
            // Zeige Performance-Daten trotzdem an
            const performanceData = await performancePromise;
            const performanceSection = showEnhancedPerformanceOverview(performanceData);
            matchList.appendChild(performanceSection);
            return;
        }

        const games = data.response;
        console.log(`📊 ${games.length} Spiele geladen`);

        // Warte auf Performance-Daten
        const performanceData = await performancePromise;

        // Zeige Performance-Übersicht
        const performanceSection = showEnhancedPerformanceOverview(performanceData);
        matchList.appendChild(performanceSection);

        // Zeige H2H Übersicht
        const h2hSection = showH2HOverview(games);
        if (h2hSection) {
            matchList.appendChild(h2hSection);
        }

        // Zeige KI Top-Empfehlungen
        const aiSection = showAIRecommendations(games);
        if (aiSection) {
            matchList.appendChild(aiSection);
        }

        // Zeige Ensemble Insights
        const ensembleSection = showEnsembleInsights(games);
        if (ensembleSection) {
            matchList.appendChild(ensembleSection);
        }

        // Zeige Top 5 Sektionen
        const top5Probabilities = showTop5Probabilities(games);
        if (top5Probabilities) {
            matchList.appendChild(top5Probabilities);
        }

        const top5OverUnder = showTop5OverUnder(games);
        if (top5OverUnder) {
            matchList.appendChild(top5OverUnder);
        }

        const top5BTTS = showTop5BTTS(games);
        if (top5BTTS) {
            matchList.appendChild(top5BTTS);
        }

        // Weitere Spiele mit erweiterten Karten
        const shownInTopSections = new Set();
        
        // Sammle Spiele die bereits in Top-Sektionen gezeigt wurden
        if (aiSection) {
            strongRecommendations = games.filter(g => 
                g.aiRecommendation && 
                ['STRONG_BET', 'VALUE_BET'].includes(g.aiRecommendation.recommendation)
            );
            strongRecommendations.forEach(g => {
                shownInTopSections.add(`${g.home}-${g.away}`);
            });
        }

        const otherGames = games.filter(g => 
            !shownInTopSections.has(`${g.home}-${g.away}`)
        );

        if (otherGames.length > 0) {
            const restSection = document.createElement("div");
            restSection.className = "top-section p-6";
            restSection.innerHTML = `
                <h2 class="text-xl font-bold text-gray-800 mb-4">Weitere Spiele</h2>
                <div class="grid gap-4 md:grid-cols-2" id="other-games-grid">
                </div>
            `;
            
            const grid = restSection.querySelector("#other-games-grid");
            otherGames.forEach(g => {
                const card = createEnhancedMatchCard(g);
                grid.appendChild(card);
            });
            
            matchList.appendChild(restSection);
        }

        // Statistik
        const gamesWithH2H = games.filter(g => g.h2hData && g.h2hData.available).length;
        const demoGames = games.filter(g => g.dataQuality === "DEMO_DATA").length;
        
        let statusMessage = `${games.length} Spiele geladen`;
        if (gamesWithH2H > 0) statusMessage += ` - ${gamesWithH2H} mit H2H Daten`;
        if (demoGames > 0) statusMessage += ` - ${demoGames} Demo-Spiele`;
        statusMessage += " - KI-Analyse abgeschlossen!";
        
        statusDiv.textContent = statusMessage;

    } catch(err) {
        console.error("❌ Fehler in loadMatches:", err);
        statusDiv.textContent = "Fehler: " + (err.message || "Unbekannter Fehler");
        
        // Zeige Fehler-Section
        const errorSection = document.createElement('div');
        errorSection.className = 'top-section bg-gradient-to-r from-red-50 to-pink-100 border-l-4 border-red-500 p-6';
        errorSection.innerHTML = `
            <h2 class="text-xl font-bold text-gray-800 mb-4">❌ Fehler beim Laden</h2>
            <div class="bg-white rounded-lg p-4">
                <p class="text-red-600 font-semibold">${err.message || "Unbekannter Fehler"}</p>
                <p class="text-sm text-gray-600 mt-2">Bitte überprüfe:</p>
                <ul class="text-sm text-gray-600 list-disc list-inside mt-1">
                    <li>Internetverbindung</li>
                    <li>API Keys in den Environment Variables</li>
                    <li>Datum und Liga Auswahl</li>
                </ul>
                <button onclick="loadMatches()" class="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition duration-200">
                    🔄 Erneut versuchen
                </button>
            </div>
        `;
        matchList.appendChild(errorSection);
    } finally {
        // Button zurücksetzen
        spinner.classList.add('hidden');
        buttonText.textContent = '🤖 KI-Analyse starten';
        button.disabled = false;
    }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', function() {
    console.log("🔧 App initialisiert");
    
    // Event Listener für Quick-Select Buttons
    document.querySelectorAll('.quick-select').forEach(button => {
        button.addEventListener('click', function() {
            const leagues = this.getAttribute('data-leagues').split(',');
            const leagueSelect = document.getElementById('league-select');
            
            // Alle Optionen deselecten
            Array.from(leagueSelect.options).forEach(option => {
                option.selected = false;
            });
            
            // Gewünschte Ligen selecten
            leagues.forEach(leagueKey => {
                const option = Array.from(leagueSelect.options).find(opt => opt.value === leagueKey);
                if (option) option.selected = true;
            });
            
            // Update Active Leagues Anzeige
            updateActiveLeaguesCount();
        });
    });

    // Aktive Ligen Zähler
    function updateActiveLeaguesCount() {
        const selectedLeagues = Array.from(document.getElementById('league-select').selectedOptions);
        document.getElementById('active-leagues').textContent = selectedLeagues.length;
    }

    // Lade Performance-Daten für Header
    async function loadHeaderStats() {
        try {
            const response = await fetch('/api/performance/stats');
            const data = await response.json();
            
            if (data && data.overall) {
                const accuracy = data.overall.accuracy || 0;
                
                document.getElementById('ai-accuracy').textContent = accuracy + '%';
                document.getElementById('total-games').textContent = data.overall.total;
                
                // Entferne Loading Animation
                document.getElementById('ai-accuracy').classList.remove('loading-pulse');
            }
        } catch (error) {
            console.log('Performance-Daten noch nicht verfügbar');
        }
    }

    // Loading State für Button
    document.getElementById('refresh').addEventListener('click', function() {
        const button = this;
        const originalText = button.querySelector('#button-text').textContent;
        const spinner = button.querySelector('#loading-spinner');
        
        // Loading State
        spinner.classList.remove('hidden');
        button.querySelector('#button-text').textContent = 'Analysiere...';
        button.disabled = true;
        
        // Reset nach 30s falls etwas schief geht
        setTimeout(() => {
            if (!button.disabled) return;
            spinner.classList.add('hidden');
            button.querySelector('#button-text').textContent = originalText;
            button.disabled = false;
            statusDiv.textContent = "Timeout - Bitte erneut versuchen";
        }, 30000);
    });

    // Initialisierung
    updateActiveLeaguesCount();
    loadHeaderStats();
    
    // Update bei Liga-Änderungen
    document.getElementById('league-select').addEventListener('change', updateActiveLeaguesCount);
    
    console.log("✅ App ready - KI-Analyse kann gestartet werden");
});
