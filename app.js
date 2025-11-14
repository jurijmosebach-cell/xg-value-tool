// app.js - PROFESSIONELLE VERSION MIT PERFORMANCE-TRACKING - TEIL 1/4
const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");
const leagueSelect = document.getElementById("league-select");

// Professionelles Standard-Datum
const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

// Professioneller Klick-Handler
refreshBtn.addEventListener("click", loadProfessionalMatches);

// PROFESSIONELLE PERFORMANCE-DATEN LADEN
async function loadProfessionalPerformanceStats() {
    try {
        const res = await fetch('/api/performance/stats');
        const data = await res.json();
        return data;
    } catch (err) {
        console.error('Professioneller Fehler beim Laden der Performance-Daten:', err);
        return null;
    }
}

// PROFESSIONELLE PERFORMANCE-ÜBERSICHT
function showProfessionalPerformanceOverview(performanceData) {
    const performanceSection = document.createElement('div');
    performanceSection.className = 'top-section bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 p-6 rounded-2xl shadow-lg';
    
    if (!performanceData || performanceData.status === "NO_DATA") {
        performanceSection.innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <span class="text-2xl mr-2">📈</span>
                Professional Performance Tracking
            </h2>
            <div class="text-center text-gray-600 py-8">
                <div class="text-5xl mb-4">📊</div>
                <p class="text-lg font-semibold">Noch keine Performance-Daten verfügbar</p>
                <p class="text-sm mt-2">Starte eine professionelle Analyse um Statistiken zu sammeln</p>
                <p class="text-xs mt-1 text-gray-500">Ergebnisse werden automatisch nach Spielende aktualisiert</p>
            </div>
        `;
        return performanceSection;
    }

    const overall = performanceData.overall;
    const accuracy = overall.accuracy;
    
    performanceSection.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span class="text-2xl mr-2">📈</span>
            Professional Performance Tracking
        </h2>
        
        <!-- Professionelle Haupt-KPIs -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-white p-5 rounded-xl text-center shadow-lg border border-gray-100">
                <div class="text-3xl font-bold ${accuracy > 65 ? 'text-green-600' : accuracy > 55 ? 'text-yellow-600' : 'text-red-600'}">${accuracy}%</div>
                <div class="text-sm text-gray-600 font-medium">Gesamt Genauigkeit</div>
                <div class="text-xs text-gray-400 mt-1">Professional KI</div>
            </div>
            <div class="bg-white p-5 rounded-xl text-center shadow-lg border border-gray-100">
                <div class="text-3xl font-bold text-blue-600">${overall.total}</div>
                <div class="text-sm text-gray-600 font-medium">Analysierte Spiele</div>
                <div class="text-xs text-gray-400 mt-1">Multi-Liga</div>
            </div>
            <div class="bg-white p-5 rounded-xl text-center shadow-lg border border-gray-100">
                <div class="text-3xl font-bold text-purple-600">${overall.correct}</div>
                <div class="text-sm text-gray-600 font-medium">Korrekte Vorhersagen</div>
                <div class="text-xs text-gray-400 mt-1">Ensemble KI</div>
            </div>
            <div class="bg-white p-5 rounded-xl text-center shadow-lg border border-gray-100">
                <div class="text-3xl font-bold text-orange-600">${performanceData.analyzedDays}</div>
                <div class="text-sm text-gray-600 font-medium">Analysierte Tage</div>
                <div class="text-xs text-gray-400 mt-1">Historie</div>
            </div>
        </div>
        
        <!-- Professionelle Zusätzliche Metriken -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white p-5 rounded-xl shadow-lg border border-gray-100">
                <h3 class="font-semibold text-gray-800 mb-4 flex items-center">
                    <span class="text-lg mr-2">🎯</span>
                    Beste Märkte
                </h3>
                ${performanceData.byMarket && Object.keys(performanceData.byMarket).length > 0 ? 
                    Object.entries(performanceData.byMarket)
                        .sort(([,a], [,b]) => b.accuracy - a.accuracy)
                        .slice(0, 3)
                        .map(([market, stats]) => `
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                                <div>
                                    <span class="font-semibold text-gray-700">${market}</span>
                                    <div class="text-xs text-gray-500">${stats.total} Spiele</div>
                                </div>
                                <span class="text-lg font-bold ${stats.accuracy > 60 ? 'text-green-600' : stats.accuracy > 50 ? 'text-yellow-600' : 'text-red-600'}">
                                    ${stats.accuracy}%
                                </span>
                            </div>
                        `).join('') 
                    : '<p class="text-sm text-gray-500 text-center py-4">Noch nicht genug Daten für Marktanalyse</p>'
                }
            </div>
            
            <div class="bg-white p-5 rounded-xl shadow-lg border border-gray-100">
                <h3 class="font-semibold text-gray-800 mb-4 flex items-center">
                    <span class="text-lg mr-2">🎚️</span>
                    Confidence Genauigkeit
                </h3>
                ${performanceData.byConfidence && Object.keys(performanceData.byConfidence).length > 0 ? 
                    Object.entries(performanceData.byConfidence)
                        .map(([confidence, stats]) => `
                            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                                <div>
                                    <span class="font-semibold text-gray-700">${confidence}</span>
                                    <div class="text-xs text-gray-500">${stats.total} Spiele</div>
                                </div>
                                <span class="text-lg font-bold ${stats.accuracy > 60 ? 'text-green-600' : stats.accuracy > 50 ? 'text-yellow-600' : 'text-red-600'}">
                                    ${stats.accuracy}%
                                </span>
                            </div>
                        `).join('')
                    : '<p class="text-sm text-gray-500 text-center py-4">Noch nicht genug Daten für Confidence-Analyse</p>'
                }
            </div>
        </div>
        
        <!-- Professionelle Fußzeile -->
        <div class="mt-6 text-center text-sm text-gray-500 bg-white p-4 rounded-lg border border-gray-200">
            <div class="flex items-center justify-center space-x-4">
                <span>Letzte Aktualisierung: ${new Date(performanceData.lastUpdated).toLocaleString('de-DE')}</span>
                <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    ${performanceData.model || 'PROFESSIONAL_ENSEMBLE_V3'}
                </span>
            </div>
            ${performanceData.dataQuality === "HIGH" ? 
                '<div class="mt-2 text-green-600 text-xs font-medium">✅ Hohe Datenqualität</div>' : 
                '<div class="mt-2 text-yellow-600 text-xs font-medium">🔄 Daten sammeln...</div>'
            }
        </div>
    `;
    
    return performanceSection;
}

// PROFESSIONELLE H2H BADGE STYLES
function getProfessionalH2HBadgeStyle(h2hData) {
    if (!h2hData || !h2hData.available) {
        return { 
            bg: "bg-gray-100", 
            text: "text-gray-600", 
            border: "border-gray-300", 
            icon: "📊", 
            label: "Keine H2H Daten",
            quality: "LOW"
        };
    }
    
    const strength = h2hData.strength || 0;
    const quality = h2hData.dataQuality || "MEDIUM";
    
    if (strength > 1.5) return { bg: "bg-green-100", text: "text-green-800", border: "border-green-300", icon: "📈", label: "Starke H2H Historie", quality };
    if (strength > 0.5) return { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300", icon: "📊", label: "Positive H2H Historie", quality };
    if (strength < -1.5) return { bg: "bg-red-100", text: "text-red-800", border: "border-red-300", icon: "📉", label: "Schwierige H2H Historie", quality };
    
    return { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300", icon: "⚖️", label: "Ausgeglichene H2H Historie", quality };
}

// PROFESSIONELLE H2H ÜBERSICHT
function showProfessionalH2HOverview(games) {
    const gamesWithH2H = games.filter(g => g.h2hData && g.h2hData.available);
    
    if (gamesWithH2H.length === 0) return null;

    const h2hSection = document.createElement('div');
    h2hSection.className = 'top-section bg-gradient-to-r from-orange-50 to-amber-100 border-l-4 border-orange-500 p-6 rounded-2xl shadow-lg';
    
    const interestingH2H = gamesWithH2H.filter(g => 
        Math.abs(g.h2hData.strength) > 1 || 
        g.h2hData.over25Percentage > 70 || 
        g.h2hData.homeWinPercentage > 70
    ).slice(0, 6);

    h2hSection.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span class="text-2xl mr-2">📊</span>
            Professional Head-to-Head Insights
        </h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            ${interestingH2H.map(game => {
                const h2h = game.h2hData;
                const badgeStyle = getProfessionalH2HBadgeStyle(h2h);
                
                return `
                    <div class="bg-white rounded-2xl shadow-lg border ${badgeStyle.border} p-5 hover:shadow-xl transition duration-300">
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex-1">
                                <div class="font-bold text-lg text-gray-800 mb-1">${game.home} vs ${game.away}</div>
                                <div class="text-sm text-gray-600 flex items-center">
                                    <span class="mr-2">${game.league}</span>
                                    <span class="text-xs px-2 py-1 ${badgeStyle.bg} ${badgeStyle.text} rounded-full">
                                        ${badgeStyle.icon} ${badgeStyle.label}
                                    </span>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-xs text-gray-500">Datenqualität</div>
                                <div class="text-sm font-semibold ${badgeStyle.quality === 'HIGH' ? 'text-green-600' : badgeStyle.quality === 'MEDIUM' ? 'text-yellow-600' : 'text-red-600'}">
                                    ${badgeStyle.quality}
                                </div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-3 gap-3 text-center mb-4">
                            <div class="bg-green-50 p-3 rounded-lg">
                                <div class="font-bold text-green-600 text-lg">${h2h.homeWinPercentage.toFixed(0)}%</div>
                                <div class="text-xs text-gray-600 font-medium">Heimsiege</div>
                            </div>
                            <div class="bg-yellow-50 p-3 rounded-lg">
                                <div class="font-bold text-yellow-600 text-lg">${h2h.drawPercentage.toFixed(0)}%</div>
                                <div class="text-xs text-gray-600 font-medium">Unentschieden</div>
                            </div>
                            <div class="bg-red-50 p-3 rounded-lg">
                                <div class="font-bold text-red-600 text-lg">${h2h.awayWinPercentage.toFixed(0)}%</div>
                                <div class="text-xs text-gray-600 font-medium">Auswärtssiege</div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-3 text-center">
                            <div class="bg-purple-50 p-3 rounded-lg">
                                <div class="font-bold text-purple-600 text-lg">${h2h.avgGoals.toFixed(1)}</div>
                                <div class="text-xs text-gray-600 font-medium">Ø Tore/Spiel</div>
                            </div>
                            <div class="bg-orange-50 p-3 rounded-lg">
                                <div class="font-bold text-orange-600 text-lg">${h2h.over25Percentage.toFixed(0)}%</div>
                                <div class="text-xs text-gray-600 font-medium">Over 2.5</div>
                            </div>
                        </div>
                        
                        ${h2h.trends && h2h.trends.length > 0 ? `
                            <div class="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div class="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                    <span class="mr-2">🎯</span>
                                    H2H Trends:
                                </div>
                                <div class="text-sm text-gray-600">${h2h.trends.slice(0, 2).join(' • ')}</div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
        
        <div class="mt-6 text-center text-sm text-gray-600 bg-white p-4 rounded-lg border border-gray-200">
            <div class="flex items-center justify-center space-x-2">
                <span class="font-semibold">${gamesWithH2H.length}</span>
                <span>von</span>
                <span class="font-semibold">${games.length}</span>
                <span>Spielen mit professionellen H2H Daten verfügbar</span>
            </div>
            <div class="text-xs text-gray-500 mt-1">Datenquelle: SportData.org & Professionelle Analyse</div>
        </div>
    `;
    
    return h2hSection;
} 
// app.js - PROFESSIONELLE VERSION MIT PERFORMANCE-TRACKING - TEIL 2/4

// PROFESSIONELLE MATCH-KARTE MIT ERWEITERTER ANALYSE
function createProfessionalMatchCard(game) {
    const card = document.createElement("div");
    card.className = "match-card bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition duration-300";
    
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

    // PROFESSIONELLE KI-EMPFEHLUNG
    const aiRec = game.aiRecommendation;
    const recStyle = getProfessionalRecommendationStyle(aiRec.recommendation);
    const riskStyle = getProfessionalRiskBadge(aiRec.risk.level);
    
    // PROFESSIONELLE H2H BADGE
    const h2hBadge = getProfessionalH2HBadgeStyle(game.h2hData);

    // PROFESSIONELLE PERFORMANCE BADGE
    const performanceBadge = game.performance ? 
        `<span class="text-xs ${game.performance.wasCorrect ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'} px-3 py-1 rounded-full ml-2 font-medium">
            ${game.performance.result}
        </span>` : '';

    card.innerHTML = `
        <!-- PROFESSIONELLER HEADER -->
        <div class="match-header mb-6">
            <div class="flex justify-between items-center mb-3">
                <span class="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">${game.league}</span>
                <div class="flex space-x-2">
                    <span class="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full border border-blue-300 font-medium">xG: ${game.totalXG}</span>
                    <span class="text-xs ${riskStyle} px-3 py-1 rounded-full font-medium">Risiko: ${aiRec.risk.level}</span>
                    ${game.h2hData && game.h2hData.available ? 
                        `<span class="text-xs ${h2hBadge.bg} ${h2hBadge.text} px-3 py-1 rounded-full border ${h2hBadge.border} font-medium">
                            H2H: ${game.h2hData.totalGames} Spiele
                        </span>` : 
                        ''
                    }
                    ${performanceBadge}
                </div>
            </div>
            <div class="flex justify-between items-center bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-xl border border-gray-200">
                <div class="text-center flex-1">
                    <div class="font-bold text-lg text-gray-800">${game.home}</div>
                    <div class="text-sm text-gray-600 mt-1">${game.homeXG} xG • ${(game.form.home * 100).toFixed(0)}% Form</div>
                </div>
                <div class="text-gray-400 mx-4 text-xl font-bold">vs</div>
                <div class="text-center flex-1">
                    <div class="font-bold text-lg text-gray-800">${game.away}</div>
                    <div class="text-sm text-gray-600 mt-1">${game.awayXG} xG • ${(game.form.away * 100).toFixed(0)}% Form</div>
                </div>
            </div>
        </div>

        <!-- PROFESSIONELLE H2H SECTION -->
        ${game.h2hData && game.h2hData.available ? `
            <div class="mb-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-300 rounded-xl">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-3">
                        <span class="text-blue-600 text-xl">📊</span>
                        <span class="font-bold text-blue-800 text-lg">Professional Head-to-Head</span>
                    </div>
                    <span class="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium border border-blue-300">
                        ${game.h2hData.totalGames} historische Spiele
                    </span>
                </div>
                
                <div class="grid grid-cols-3 gap-3 text-center mb-3">
                    <div class="bg-white p-3 rounded-lg border border-green-200">
                        <div class="font-bold text-green-600 text-lg">${game.h2hData.homeWinPercentage.toFixed(0)}%</div>
                        <div class="text-xs text-gray-600 font-medium">Heimsiege</div>
                    </div>
                    <div class="bg-white p-3 rounded-lg border border-yellow-200">
                        <div class="font-bold text-yellow-600 text-lg">${game.h2hData.drawPercentage.toFixed(0)}%</div>
                        <div class="text-xs text-gray-600 font-medium">Unentschieden</div>
                    </div>
                    <div class="bg-white p-3 rounded-lg border border-red-200">
                        <div class="font-bold text-red-600 text-lg">${game.h2hData.awayWinPercentage.toFixed(0)}%</div>
                        <div class="text-xs text-gray-600 font-medium">Auswärtssiege</div>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-3 text-center">
                    <div class="bg-white p-3 rounded-lg border border-purple-200">
                        <div class="font-bold text-purple-600 text-lg">${game.h2hData.avgGoals.toFixed(1)}</div>
                        <div class="text-xs text-gray-600 font-medium">Ø Tore/Spiel</div>
                    </div>
                    <div class="bg-white p-3 rounded-lg border border-orange-200">
                        <div class="font-bold text-orange-600 text-lg">${game.h2hData.over25Percentage.toFixed(0)}%</div>
                        <div class="text-xs text-gray-600 font-medium">Over 2.5</div>
                    </div>
                </div>
                
                ${game.h2hData.trends && game.h2hData.trends.length > 0 ? `
                    <div class="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                        <div class="text-sm font-semibold text-gray-700 mb-1 flex items-center">
                            <span class="mr-2">🎯</span>
                            Professionelle Trends:
                        </div>
                        <div class="text-sm text-gray-600">${game.h2hData.trends[0]}</div>
                    </div>
                ` : ''}
                
                <div class="mt-2 text-right">
                    <span class="text-xs text-gray-500">Datenqualität: 
                        <span class="font-medium ${game.h2hData.dataQuality === 'HIGH' ? 'text-green-600' : game.h2hData.dataQuality === 'MEDIUM' ? 'text-yellow-600' : 'text-red-600'}">
                            ${game.h2hData.dataQuality}
                        </span>
                    </span>
                </div>
            </div>
        ` : ''}

        <!-- PROFESSIONELLE KI-EMPFEHLUNG -->
        <div class="${recStyle.bg} ${recStyle.text} rounded-xl p-4 mb-6 border ${recStyle.border} shadow-sm">
            <div class="flex justify-between items-center mb-2">
                <div class="flex items-center space-x-3">
                    <span class="text-xl">${recStyle.icon}</span>
                    <span class="font-bold text-lg">${recStyle.label}</span>
                </div>
                <span class="text-lg font-bold bg-white bg-opacity-20 px-4 py-1 rounded-full">${aiRec.bestMarket}</span>
            </div>
            <div class="text-sm opacity-90 leading-relaxed">${aiRec.reasoning}</div>
        </div>

        <!-- PROFESSIONELLE WAHRSCHEINLICHKEITEN -->
        <div class="space-y-4 mb-6">
            <div>
                <div class="flex justify-between text-sm mb-2">
                    <span class="font-medium text-gray-700">Heimsieg</span>
                    <span class="font-bold ${homeVal > 50 ? 'text-green-600' : 'text-gray-600'}">${homeVal.toFixed(1)}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                    <div class="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500" style="width: ${homeVal}%"></div>
                </div>
            </div>
            
            <div>
                <div class="flex justify-between text-sm mb-2">
                    <span class="font-medium text-gray-700">Unentschieden</span>
                    <span class="font-bold ${drawVal > 30 ? 'text-yellow-600' : 'text-gray-600'}">${drawVal.toFixed(1)}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                    <div class="bg-gradient-to-r from-yellow-500 to-yellow-600 h-3 rounded-full transition-all duration-500" style="width: ${drawVal}%"></div>
                </div>
            </div>
            
            <div>
                <div class="flex justify-between text-sm mb-2">
                    <span class="font-medium text-gray-700">Auswärtssieg</span>
                    <span class="font-bold ${awayVal > 50 ? 'text-red-600' : 'text-gray-600'}">${awayVal.toFixed(1)}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                    <div class="bg-gradient-to-r from-red-500 to-red-600 h-3 rounded-full transition-all duration-500" style="width: ${awayVal}%"></div>
                </div>
            </div>
        </div>

        <!-- PROFESSIONELLE ZUSÄTZLICHE MÄRKTE -->
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="text-center bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
                <div class="text-sm text-gray-600 font-medium mb-2">Over 2.5</div>
                <div class="text-2xl font-bold ${overVal > 50 ? 'text-green-600' : 'text-red-600'}">
                    ${overVal.toFixed(1)}%
                </div>
                <div class="text-xs text-gray-500 mt-1">Torreich</div>
            </div>
            <div class="text-center bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-200">
                <div class="text-sm text-gray-600 font-medium mb-2">BTTS Ja</div>
                <div class="text-2xl font-bold ${bttsVal > 50 ? 'text-green-600' : 'text-red-600'}">
                    ${bttsVal.toFixed(1)}%
                </div>
                <div class="text-xs text-gray-500 mt-1">Beide treffen</div>
            </div>
        </div>

        <!-- PROFESSIONELLE KI-CONFIDENCE -->
        <div class="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-gray-300">
            <div class="text-center font-bold text-blue-600 text-lg mb-2">
                🤖 Professional KI Confidence: ${aiRec.confidence}
            </div>
            <div class="text-center text-sm text-gray-600 space-y-1">
                <div>Score: <span class="font-bold text-purple-600">${(aiRec.bestScore * 100).toFixed(1)}%</span></div>
                <div class="flex items-center justify-center space-x-4 text-xs">
                    ${game.h2hData && game.h2hData.available ? 
                        '<span class="text-green-600">✅ Mit H2H Daten</span>' : 
                        '<span class="text-yellow-600">⚠️ Keine H2H Daten</span>'
                    }
                    ${game.dataQuality === "REAL_DATA" ? 
                        '<span class="text-blue-600">📊 Echte Daten</span>' : 
                        '<span class="text-orange-600">🧪 Simulierte Daten</span>'
                    }
                    <span class="text-gray-500">${aiRec.modelType}</span>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

// PROFESSIONELLE ENSEMBLE BADGE STYLES
function getProfessionalEnsembleBadgeStyle(aiRecommendation) {
    if (!aiRecommendation.ensembleData) {
        return { bg: "bg-gray-100", text: "text-gray-600", icon: "🤖", label: "Basic KI" };
    }
    
    const score = aiRecommendation.bestScore;
    
    if (score > 0.75) return { bg: "bg-gradient-to-r from-purple-500 to-pink-600", text: "text-white", icon: "🧠", label: "Elite Ensemble KI" };
    if (score > 0.65) return { bg: "bg-gradient-to-r from-blue-500 to-cyan-600", text: "text-white", icon: "🧠", label: "Advanced Ensemble KI" };
    if (score > 0.55) return { bg: "bg-gradient-to-r from-green-500 to-emerald-600", text: "text-white", icon: "🧠", label: "Professional Ensemble KI" };
    return { bg: "bg-gradient-to-r from-gray-500 to-gray-700", text: "text-white", icon: "🤖", label: "Standard KI" };
}

// PROFESSIONELLE TOP 5 WAHRSCHEINLICHKEITEN
function showProfessionalTop5Probabilities(games) {
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
        .filter(game => game.bestProbability > 0.45)
        .sort((a, b) => b.bestProbability - a.bestProbability)
        .slice(0, 5);

    if (topProbabilities.length === 0) return null;

    const section = document.createElement('div');
    section.className = 'top-section bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-500 p-6 rounded-2xl shadow-lg';
    
    section.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span class="text-2xl mr-2">🎯</span>
            Professional Top 5 Wahrscheinlichkeiten
        </h2>
        <div class="space-y-4">
            ${topProbabilities.map(game => `
                <div class="bg-white rounded-2xl shadow-lg border border-blue-200 p-5 hover:shadow-xl transition duration-300">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex-1">
                            <div class="font-bold text-lg text-gray-800 mb-1">${game.home} vs ${game.away}</div>
                            <div class="text-sm text-gray-600 flex items-center space-x-2">
                                <span>${game.league}</span>
                                ${game.aiRecommendation ? `
                                    <span class="text-xs px-2 py-1 rounded-full ${
                                        game.aiRecommendation.recommendation === 'STRONG_BET' ? 'bg-green-100 text-green-800 border border-green-300' :
                                        game.aiRecommendation.recommendation === 'VALUE_BET' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                                        'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                    }">
                                        ${game.aiRecommendation.recommendation === 'STRONG_BET' ? '🎯 STARKE EMPFEHLUNG' :
                                          game.aiRecommendation.recommendation === 'VALUE_BET' ? '💰 VALUE WETTE' : '⚠️ VORSICHTIG'}
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                        <span class="bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-4 py-2 rounded-full text-lg font-bold shadow-lg">
                            ${(game.bestProbability * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-700 font-medium">
                            Beste Wette: <span class="font-bold text-blue-600">${game.bestType}</span>
                        </span>
                        <div class="flex space-x-2 text-xs">
                            <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full border border-green-300 font-medium">1: ${(game.prob.home * 100).toFixed(1)}%</span>
                            <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full border border-yellow-300 font-medium">X: ${(game.prob.draw * 100).toFixed(1)}%</span>
                            <span class="bg-red-100 text-red-800 px-3 py-1 rounded-full border border-red-300 font-medium">2: ${(game.prob.away * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                    ${game.aiRecommendation ? `
                        <div class="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <span class="font-medium">Professional KI:</span> ${game.aiRecommendation.bestMarket} 
                            (Confidence: ${game.aiRecommendation.confidence})
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
    
    return section;
}

// PROFESSIONELLE TOP 5 OVER/UNDER
function showProfessionalTop5OverUnder(games) {
    const topOverUnder = [...games]
        .map(game => ({
            ...game,
            over25Prob: game.prob.over25,
            under25Prob: 1 - game.prob.over25
        }))
        .filter(game => game.over25Prob > 0.72 || game.under25Prob > 0.72)
        .sort((a, b) => {
            const aTendency = Math.max(a.over25Prob, a.under25Prob);
            const bTendency = Math.max(b.over25Prob, b.under25Prob);
            return bTendency - aTendency;
        })
        .slice(0, 5);

    if (topOverUnder.length === 0) return null;

    const section = document.createElement('div');
    section.className = 'top-section bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-2xl shadow-lg';
    
    section.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span class="text-2xl mr-2">⚽</span>
            Professional Top 5 Over/Under 2.5
        </h2>
        <div class="space-y-4">
            ${topOverUnder.map(game => {
                const isOver = game.over25Prob > 0.5;
                const probability = isOver ? game.over25Prob : game.under25Prob;
                const type = isOver ? "Over 2.5" : "Under 2.5";
                const barColor = isOver ? "bg-green-500" : "bg-red-500";
                const textColor = isOver ? "text-green-700" : "text-red-700";
                const bgColor = isOver ? "bg-green-100" : "bg-red-100";
                const borderColor = isOver ? "border-green-300" : "border-red-300";
                
                return `
                    <div class="bg-white rounded-2xl shadow-lg border ${borderColor} p-5 hover:shadow-xl transition duration-300">
                        <div class="flex justify-between items-start mb-3">
                            <div class="flex-1">
                                <div class="font-bold text-lg text-gray-800 mb-1">${game.home} vs ${game.away}</div>
                                <div class="text-sm text-gray-600">${game.league}</div>
                            </div>
                            <span class="${bgColor} ${textColor} px-4 py-2 rounded-full text-lg font-bold border ${borderColor} shadow-sm">
                                ${type}: ${(probability * 100).toFixed(1)}%
                            </span>
                        </div>
                        
                        <div class="mb-4">
                            <div class="flex justify-between text-sm text-gray-600 mb-2 font-medium">
                                <span>Over 2.5: ${(game.over25Prob * 100).toFixed(1)}%</span>
                                <span>Under 2.5: ${(game.under25Prob * 100).toFixed(1)}%</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                                <div class="h-4 rounded-full flex">
                                    <div class="${barColor} rounded-l-full transition-all duration-500" style="width: ${game.over25Prob * 100}%"></div>
                                    <div class="bg-red-500 rounded-r-full transition-all duration-500" style="width: ${game.under25Prob * 100}%"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <span class="font-medium">Professional Analyse:</span> 
                            Ø xG: <b>${game.totalXG}</b> | 
                            ${game.h2hData && game.h2hData.available ? 
                                `H2H Over: ${game.h2hData.over25Percentage.toFixed(0)}%` : 
                                'Keine professionellen H2H Daten'
                            }
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    return section;
} 

// app.js - PROFESSIONELLE VERSION MIT PERFORMANCE-TRACKING - TEIL 3/4

// PROFESSIONELLE TOP 5 BTTS (BOTH TEAMS TO SCORE)
function showProfessionalTop5BTTS(games) {
    const topBTTS = [...games]
        .map(game => ({
            ...game,
            bttsYes: game.prob.btts,
            bttsNo: 1 - game.prob.btts
        }))
        .filter(game => game.bttsYes > 0.65 || game.bttsNo > 0.72)
        .sort((a, b) => {
            const aTendency = Math.max(a.bttsYes, a.bttsNo);
            const bTendency = Math.max(b.bttsYes, b.bttsNo);
            return bTendency - aTendency;
        })
        .slice(0, 5);

    if (topBTTS.length === 0) return null;

    const section = document.createElement('div');
    section.className = 'top-section bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 p-6 rounded-2xl shadow-lg';
    
    section.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span class="text-2xl mr-2">🎪</span>
            Professional Top 5 BTTS (Both Teams To Score)
        </h2>
        <div class="space-y-4">
            ${topBTTS.map(game => {
                const isBTTSYes = game.bttsYes > 0.5;
                const probability = isBTTSYes ? game.bttsYes : game.bttsNo;
                const type = isBTTSYes ? "BTTS Ja" : "BTTS Nein";
                const barColor = isBTTSYes ? "bg-orange-500" : "bg-gray-500";
                const textColor = isBTTSYes ? "text-orange-700" : "text-gray-700";
                const bgColor = isBTTSYes ? "bg-orange-100" : "bg-gray-100";
                const borderColor = isBTTSYes ? "border-orange-300" : "border-gray-300";
                
                return `
                    <div class="bg-white rounded-2xl shadow-lg border ${borderColor} p-5 hover:shadow-xl transition duration-300">
                        <div class="flex justify-between items-start mb-3">
                            <div class="flex-1">
                                <div class="font-bold text-lg text-gray-800 mb-1">${game.home} vs ${game.away}</div>
                                <div class="text-sm text-gray-600">${game.league}</div>
                            </div>
                            <span class="${bgColor} ${textColor} px-4 py-2 rounded-full text-lg font-bold border ${borderColor} shadow-sm">
                                ${type}: ${(probability * 100).toFixed(1)}%
                            </span>
                        </div>
                        
                        <div class="mb-4">
                            <div class="flex justify-between text-sm text-gray-600 mb-2 font-medium">
                                <span>BTTS Ja: ${(game.bttsYes * 100).toFixed(1)}%</span>
                                <span>BTTS Nein: ${(game.bttsNo * 100).toFixed(1)}%</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                                <div class="h-4 rounded-full flex">
                                    <div class="${barColor} rounded-l-full transition-all duration-500" style="width: ${game.bttsYes * 100}%"></div>
                                    <div class="bg-gray-500 rounded-r-full transition-all duration-500" style="width: ${game.bttsNo * 100}%"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <span class="font-medium">Professional Analyse:</span> 
                            Heim xG: <b>${game.homeXG}</b> | Auswärts xG: <b>${game.awayXG}</b>
                            ${game.h2hData && game.h2hData.available ? 
                                `| H2H BTTS: ${game.h2hData.bttsPercentage.toFixed(0)}%` : 
                                ''
                            }
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    return section;
}

// PROFESSIONELLE ENSEMBLE INSIGHTS
function showProfessionalEnsembleInsights(games) {
    const ensembleGames = games.filter(g => 
        g.aiRecommendation && 
        g.aiRecommendation.modelType && 
        g.aiRecommendation.modelType.includes("ENSEMBLE")
    );
    
    if (ensembleGames.length === 0) return null;

    const insightsSection = document.createElement('div');
    insightsSection.className = 'top-section bg-gradient-to-r from-purple-50 to-pink-100 border-l-4 border-purple-500 p-6 rounded-2xl shadow-lg';
    
    const topEnsemble = ensembleGames
        .filter(g => g.aiRecommendation.bestScore > 0.62)
        .sort((a, b) => b.aiRecommendation.bestScore - a.aiRecommendation.bestScore)
        .slice(0, 3);

    insightsSection.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span class="text-2xl mr-2">🧠</span>
            Professional Ensemble KI Insights
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-white rounded-xl p-5 text-center shadow-lg border border-purple-200">
                <div class="text-3xl font-bold text-purple-600">${ensembleGames.length}</div>
                <div class="text-sm text-gray-600 font-medium">Ensemble Analysen</div>
                <div class="text-xs text-gray-400 mt-1">Professional KI</div>
            </div>
            <div class="bg-white rounded-xl p-5 text-center shadow-lg border border-green-200">
                <div class="text-3xl font-bold text-green-600">${topEnsemble.length}</div>
                <div class="text-sm text-gray-600 font-medium">Starke Empfehlungen</div>
                <div class="text-xs text-gray-400 mt-1">Score > 62%</div>
            </div>
            <div class="bg-white rounded-xl p-5 text-center shadow-lg border border-blue-200">
                <div class="text-3xl font-bold text-blue-600">${topEnsemble.length > 0 ? (topEnsemble.reduce((acc, g) => acc + g.aiRecommendation.bestScore, 0) / topEnsemble.length * 100).toFixed(1) : '0'}%</div>
                <div class="text-sm text-gray-600 font-medium">Ø Ensemble Score</div>
                <div class="text-xs text-gray-400 mt-1">Professional Rating</div>
            </div>
        </div>
        
        ${topEnsemble.length > 0 ? `
            <div class="space-y-4">
                <h3 class="font-semibold text-gray-800 text-lg mb-4 flex items-center">
                    <span class="mr-2">🏆</span>
                    Top Ensemble Empfehlungen
                </h3>
                ${topEnsemble.map(game => {
                    const aiRec = game.aiRecommendation;
                    const ensembleBadge = getProfessionalEnsembleBadgeStyle(aiRec);
                    
                    return `
                        <div class="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 hover:shadow-xl transition duration-300">
                            <div class="flex justify-between items-center mb-3">
                                <div class="font-bold text-gray-800 text-lg">${game.home} vs ${game.away}</div>
                                <span class="text-xs ${ensembleBadge.bg} ${ensembleBadge.text} px-3 py-2 rounded-full font-bold shadow-sm">
                                    ${ensembleBadge.icon} ${ensembleBadge.label}
                                </span>
                            </div>
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-sm text-gray-600 font-medium">
                                    Empfohlen: <span class="font-bold text-purple-600">${aiRec.bestMarket}</span>
                                </span>
                                <span class="text-xl font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-lg">
                                    ${(aiRec.bestScore * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div class="font-medium mb-1">Professional Reasoning:</div>
                                <div class="text-xs leading-relaxed">${aiRec.reasoning.split('\n\n')[0]}</div>
                            </div>
                            <div class="mt-3 flex items-center justify-between text-xs text-gray-500">
                                <span>Confidence: <span class="font-medium ${aiRec.confidence === 'SEHR HOCH' ? 'text-green-600' : aiRec.confidence === 'HOCH' ? 'text-blue-600' : 'text-yellow-600'}">${aiRec.confidence}</span></span>
                                <span>Risiko: <span class="font-medium ${aiRec.risk.level === 'NIEDRIG' ? 'text-green-600' : aiRec.risk.level === 'MEDIUM' ? 'text-yellow-600' : 'text-red-600'}">${aiRec.risk.level}</span></span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : `
            <div class="text-center text-gray-500 py-8">
                <div class="text-4xl mb-4">🤖</div>
                <p class="text-lg font-semibold">Noch keine starken Ensemble-Empfehlungen</p>
                <p class="text-sm mt-2">Die KI sucht nach den besten Wetten mit hohem Score</p>
            </div>
        `}
    `;
    
    return insightsSection;
}

// PROFESSIONELLE EMPFEHLUNGS-STYLES
function getProfessionalRecommendationStyle(recommendation) {
    const professionalStyles = {
        "STRONG_BET": { 
            bg: "bg-gradient-to-r from-green-500 to-emerald-600",
            text: "text-white",
            border: "border-green-600",
            icon: "🎯",
            label: "PROFESSIONAL STARKE EMPFEHLUNG"
        },
        "VALUE_BET": { 
            bg: "bg-gradient-to-r from-blue-500 to-cyan-600", 
            text: "text-white",
            border: "border-blue-600",
            icon: "💰", 
            label: "PROFESSIONAL VALUE WETTE"
        },
        "CAUTIOUS_BET": { 
            bg: "bg-gradient-to-r from-yellow-400 to-orange-500",
            text: "text-white",
            border: "border-yellow-500",
            icon: "⚠️",
            label: "PROFESSIONAL VORSICHTIG"
        },
        "SPECULATIVE": { 
            bg: "bg-gradient-to-r from-orange-400 to-red-500",
            text: "text-white",
            border: "border-orange-500",
            icon: "🎯",
            label: "PROFESSIONAL SPEKULATIV"
        },
        "AVOID": { 
            bg: "bg-gradient-to-r from-gray-400 to-gray-600",
            text: "text-white",
            border: "border-gray-500",
            icon: "🚫",
            label: "PROFESSIONAL VERMEIDEN"
        }
    };
    return professionalStyles[recommendation] || professionalStyles["AVOID"];
}

function getProfessionalRiskBadge(riskLevel) {
    const professionalRiskStyles = {
        "SEHR HOCH": "bg-red-100 text-red-800 border border-red-300",
        "HOCH": "bg-orange-100 text-orange-800 border border-orange-300", 
        "MEDIUM": "bg-yellow-100 text-yellow-800 border border-yellow-300",
        "NIEDRIG": "bg-green-100 text-green-800 border border-green-300"
    };
    return professionalRiskStyles[riskLevel] || professionalRiskStyles["MEDIUM"];
}

// PROFESSIONELLE KI-EMPFEHLUNGEN
function showProfessionalAIRecommendations(games) {
    const strongRecommendations = games.filter(g => 
        g.aiRecommendation && 
        ['STRONG_BET', 'VALUE_BET'].includes(g.aiRecommendation.recommendation)
    ).sort((a, b) => b.aiRecommendation.bestScore - a.aiRecommendation.bestScore);

    if (strongRecommendations.length === 0) return null;

    const recommendationsSection = document.createElement('div');
    recommendationsSection.className = 'top-section bg-gradient-to-r from-green-50 to-emerald-100 border-l-4 border-green-500 p-6 rounded-2xl shadow-lg';
    
    recommendationsSection.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span class="text-2xl mr-2">🤖</span>
            Professional KI Top Empfehlungen
        </h2>
        <div class="space-y-6">
            ${strongRecommendations.map(game => {
                const rec = game.aiRecommendation;
                const style = getProfessionalRecommendationStyle(rec.recommendation);
                const riskStyle = getProfessionalRiskBadge(rec.risk.level);
                const h2hBadge = getProfessionalH2HBadgeStyle(game.h2hData);
                const ensembleBadge = getProfessionalEnsembleBadgeStyle(rec);
                
                return `
                    <div class="bg-white rounded-2xl shadow-2xl border ${style.border} overflow-hidden hover:shadow-3xl transition duration-300">
                        <!-- PROFESSIONELLER HEADER -->
                        <div class="${style.bg} ${style.text} p-5">
                            <div class="flex justify-between items-center">
                                <div class="flex items-center space-x-3">
                                    <span class="text-2xl">${style.icon}</span>
                                    <span class="font-bold text-xl">${style.label}</span>
                                </div>
                                <div class="flex space-x-2">
                                    <span class="text-sm px-4 py-2 bg-white bg-opacity-20 rounded-full font-medium">
                                        Risiko: <span class="${riskStyle} px-2 py-1 rounded-full text-xs font-bold">${rec.risk.level}</span>
                                    </span>
                                    ${game.h2hData && game.h2hData.available ? 
                                        `<span class="text-sm ${h2hBadge.bg} ${h2hBadge.text} px-3 py-2 rounded-full font-medium border ${h2hBadge.border}">
                                            H2H: ${h2hBadge.quality}
                                        </span>` : 
                                        ''
                                    }
                                    <span class="text-sm ${ensembleBadge.bg} ${ensembleBadge.text} px-3 py-2 rounded-full font-medium">
                                        ${ensembleBadge.icon} ${ensembleBadge.label}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- PROFESSIONELLER INHALT -->
                        <div class="p-6">
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex-1">
                                    <div class="font-bold text-2xl text-gray-800 mb-2">${game.home} vs ${game.away}</div>
                                    <div class="text-sm text-gray-600 flex items-center space-x-3">
                                        <span class="bg-gray-100 px-3 py-1 rounded-full">${game.league}</span>
                                        <span class="text-xs text-gray-500">Professional Analyse</span>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-3xl font-bold text-blue-600 bg-blue-50 px-4 py-3 rounded-xl">${rec.bestMarket}</div>
                                    <div class="text-sm text-gray-600 mt-1 font-medium">Empfohlene Wette</div>
                                </div>
                            </div>
                            
                            <!-- PROFESSIONELLE BEGRÜNDUNG -->
                            <div class="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                                <div class="text-sm text-gray-700 leading-relaxed">${rec.reasoning}</div>
                            </div>
                            
                            <!-- PROFESSIONELLE METRIKEN -->
                            <div class="grid grid-cols-2 gap-6 text-center">
                                <div class="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-200">
                                    <div class="font-semibold text-gray-800 text-sm mb-2">KI Confidence</div>
                                    <div class="text-2xl font-bold ${
                                        rec.confidence === 'SEHR HOCH' ? 'text-green-600' : 
                                        rec.confidence === 'HOCH' ? 'text-blue-600' : 
                                        'text-yellow-600'
                                    }">
                                        ${rec.confidence}
                                    </div>
                                    <div class="text-xs text-gray-500 mt-1">Professional Rating</div>
                                </div>
                                <div class="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-200">
                                    <div class="font-semibold text-gray-800 text-sm mb-2">Ensemble Score</div>
                                    <div class="text-2xl font-bold text-purple-600">
                                        ${(rec.bestScore * 100).toFixed(1)}%
                                    </div>
                                    <div class="text-xs text-gray-500 mt-1">KI Stärke</div>
                                </div>
                            </div>
                            
                            <!-- PROFESSIONELLE DATENQUALITÄT -->
                            <div class="mt-4 flex items-center justify-between text-xs text-gray-500">
                                <div class="flex items-center space-x-4">
                                    <span>Datenqualität: 
                                        <span class="font-medium ${
                                            rec.dataQuality?.overall === 'HIGH' ? 'text-green-600' :
                                            rec.dataQuality?.overall === 'MEDIUM' ? 'text-yellow-600' : 
                                            'text-red-600'
                                        }">
                                            ${rec.dataQuality?.overall || 'MEDIUM'}
                                        </span>
                                    </span>
                                    <span>Model: <span class="font-medium text-blue-600">${rec.modelType}</span></span>
                                </div>
                                <span>Analyse: ${new Date(rec.timestamp).toLocaleTimeString('de-DE')}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        
        <!-- PROFESSIONELLE FOOTER -->
        <div class="mt-6 text-center text-sm text-gray-600 bg-white p-4 rounded-xl border border-gray-200">
            <div class="flex items-center justify-center space-x-4">
                <span class="font-semibold">${strongRecommendations.length}</span>
                <span>professionelle KI-Empfehlungen gefunden</span>
            </div>
            <div class="text-xs text-gray-500 mt-1">
                Basierend auf Ensemble KI, xG-Analyse und historischen H2H-Daten
            </div>
        </div>
    `;
    
    return recommendationsSection;
} 
// app.js - PROFESSIONELLE VERSION MIT PERFORMANCE-TRACKING - TEIL 4/4

// PROFESSIONELLE HAUPTFUNKTION: SPIELE LADEN
async function loadProfessionalMatches() {
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

    statusDiv.textContent = "Starte professionelle KI-Analyse...";
    matchList.innerHTML = "";

    // PROFESSIONELLER LOADING STATE
    const button = document.getElementById('refresh');
    const buttonText = button.querySelector('#button-text');
    const spinner = button.querySelector('#loading-spinner');
    spinner.classList.remove('hidden');
    buttonText.textContent = '🧠 Professionelle Analyse läuft...';
    button.disabled = true;

    try {
        console.log("🚀 Starte professionelle Analyse für:", date, leagues);
        
        // Lade Performance-Daten parallel
        const performancePromise = loadProfessionalPerformanceStats();
        
        // PROFESSIONELLE API-ANFRAGE
        const apiUrl = `/api/games?date=${date}&leagues=${leagues.join(",")}`;
        console.log("📡 Professionelle API URL:", apiUrl);
        
        const res = await fetch(apiUrl);
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        
        const data = await res.json();
        console.log("✅ Professionelle API Response erhalten:", data);

        if (!data.response || data.response.length === 0) {
            statusDiv.textContent = "Keine Spiele gefunden für das ausgewählte Datum.";
            
            // Zeige Performance-Daten trotzdem an
            const performanceData = await performancePromise;
            const performanceSection = showProfessionalPerformanceOverview(performanceData);
            matchList.appendChild(performanceSection);
            return;
        }

        const games = data.response;
        console.log(`📊 ${games.length} professionelle Spiele geladen`);

        // Warte auf Performance-Daten
        const performanceData = await performancePromise;

        // PROFESSIONELLE ÜBERSICHTEN ANZEIGEN
        const performanceSection = showProfessionalPerformanceOverview(performanceData);
        matchList.appendChild(performanceSection);

        // PROFESSIONELLE H2H ÜBERSICHT
        const h2hSection = showProfessionalH2HOverview(games);
        if (h2hSection) {
            matchList.appendChild(h2hSection);
        }

        // PROFESSIONELLE KI TOP-EMPFEHLUNGEN
        const aiSection = showProfessionalAIRecommendations(games);
        if (aiSection) {
            matchList.appendChild(aiSection);
        }

        // PROFESSIONELLE ENSEMBLE INSIGHTS
        const ensembleSection = showProfessionalEnsembleInsights(games);
        if (ensembleSection) {
            matchList.appendChild(ensembleSection);
        }

        // PROFESSIONELLE TOP 5 SEKTIONEN
        const top5Probabilities = showProfessionalTop5Probabilities(games);
        if (top5Probabilities) {
            matchList.appendChild(top5Probabilities);
        }

        const top5OverUnder = showProfessionalTop5OverUnder(games);
        if (top5OverUnder) {
            matchList.appendChild(top5OverUnder);
        }

        const top5BTTS = showProfessionalTop5BTTS(games);
        if (top5BTTS) {
            matchList.appendChild(top5BTTS);
        }

        // PROFESSIONELLE WEITERE SPIELE
        const shownInTopSections = new Set();
        
        // Sammle Spiele die bereits in Top-Sektionen gezeigt wurden
        if (aiSection) {
            const strongRecommendations = games.filter(g => 
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
                <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                    <span class="text-2xl mr-2">📋</span>
                    Weitere Professionelle Analysen
                </h2>
                <div class="grid gap-6 md:grid-cols-2" id="other-games-grid">
                </div>
            `;
            
            const grid = restSection.querySelector("#other-games-grid");
            otherGames.forEach(g => {
                const card = createProfessionalMatchCard(g);
                grid.appendChild(card);
            });
            
            matchList.appendChild(restSection);
        }

        // PROFESSIONELLE STATISTIK
        const gamesWithH2H = games.filter(g => g.h2hData && g.h2hData.available).length;
        const realDataGames = games.filter(g => g.dataQuality === "REAL_DATA").length;
        const highQualityH2H = games.filter(g => g.h2hData?.dataQuality === "HIGH").length;
        
        let statusMessage = `✅ ${games.length} professionelle Analysen abgeschlossen`;
        if (gamesWithH2H > 0) statusMessage += ` • ${gamesWithH2H} mit H2H Daten`;
        if (highQualityH2H > 0) statusMessage += ` • ${highQualityH2H} hochwertige H2H`;
        if (realDataGames > 0) statusMessage += ` • ${realDataGames} echte Daten`;
        statusMessage += " • 🧠 Professional KI-Analyse erfolgreich!";
        
        statusDiv.textContent = statusMessage;

    } catch(err) {
        console.error("❌ Professioneller Fehler in loadProfessionalMatches:", err);
        statusDiv.textContent = "Professioneller Fehler: " + (err.message || "Unbekannter Fehler");
        
        // PROFESSIONELLE FEHLER-SECTION
        const errorSection = document.createElement('div');
        errorSection.className = 'top-section bg-gradient-to-r from-red-50 to-pink-100 border-l-4 border-red-500 p-6 rounded-2xl shadow-lg';
        errorSection.innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <span class="text-2xl mr-2">❌</span>
                Professioneller Analyse-Fehler
            </h2>
            <div class="bg-white rounded-xl p-5 border border-red-200">
                <p class="text-red-600 font-semibold text-lg mb-3">${err.message || "Unbekannter Fehler"}</p>
                <p class="text-sm text-gray-600 mb-4">Bitte überprüfe folgende Punkte:</p>
                <ul class="text-sm text-gray-600 list-disc list-inside space-y-2 mb-4">
                    <li>Internetverbindung und API Keys</li>
                    <li>Datum und Liga Auswahl</li>
                    <li>SportData.org API Zugriff</li>
                    <li>Server Status und Logs</li>
                </ul>
                <div class="flex space-x-3">
                    <button onclick="loadProfessionalMatches()" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl transition duration-200 font-semibold shadow-lg">
                        🔄 Erneut versuchen
                    </button>
                    <button onclick="checkProfessionalHealth()" class="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl transition duration-200 font-semibold shadow-lg">
                        🩺 System Check
                    </button>
                </div>
            </div>
        `;
        matchList.appendChild(errorSection);
    } finally {
        // PROFESSIONELLE BUTTON-ZURÜCKSETZUNG
        spinner.classList.add('hidden');
        buttonText.textContent = '🤖 Professional KI-Analyse starten';
        button.disabled = false;
    }
}

// PROFESSIONELLE HEALTH CHECK FUNKTION
async function checkProfessionalHealth() {
    try {
        const res = await fetch('/api/health');
        const health = await res.json();
        
        alert(`🧠 Professional System Status:\n\n` +
              `Status: ${health.status}\n` +
              `Model: ${health.model}\n` +
              `Cache: ${health.cache.games} Spiele\n` +
              `Teams: ${health.cache.teams}\n` +
              `H2H: ${health.cache.h2h}\n` +
              `Features: ${health.features.join(', ')}`);
    } catch (error) {
        alert('❌ Health Check fehlgeschlagen: ' + error.message);
    }
}

// PROFESSIONELLE INITIALISIERUNG
document.addEventListener('DOMContentLoaded', function() {
    console.log("🔧 Professionelle App initialisiert");
    
    // PROFESSIONELLE QUICK-SELECT EVENT LISTENER
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
            updateProfessionalActiveLeaguesCount();
        });
    });

    // PROFESSIONELLE AKTIVE LIGEN ZÄHLER
    function updateProfessionalActiveLeaguesCount() {
        const selectedLeagues = Array.from(document.getElementById('league-select').selectedOptions);
        document.getElementById('active-leagues').textContent = selectedLeagues.length;
    }

    // PROFESSIONELLE HEADER STATS LADEN
    async function loadProfessionalHeaderStats() {
        try {
            const response = await fetch('/api/performance/stats');
            const data = await response.json();
            
            if (data && data.overall) {
                const accuracy = data.overall.accuracy || 0;
                
                document.getElementById('ai-accuracy').textContent = accuracy + '%';
                document.getElementById('total-games').textContent = data.overall.total;
                
                // Entferne Loading Animation
                document.getElementById('ai-accuracy').classList.remove('loading-pulse');
                
                // Füge Quality Badge hinzu
                if (data.dataQuality === "HIGH") {
                    document.getElementById('ai-accuracy').classList.add('text-green-600');
                }
            }
        } catch (error) {
            console.log('Professionelle Performance-Daten noch nicht verfügbar');
        }
    }

    // PROFESSIONELLE LOADING STATE FÜR BUTTON
    document.getElementById('refresh').addEventListener('click', function() {
        const button = this;
        const originalText = button.querySelector('#button-text').textContent;
        const spinner = button.querySelector('#loading-spinner');
        
        // PROFESSIONELLER LOADING STATE
        spinner.classList.remove('hidden');
        button.querySelector('#button-text').textContent = '🧠 Professionelle Analyse...';
        button.disabled = true;
        
        // PROFESSIONELLE TIMEOUT-HANDLING
        setTimeout(() => {
            if (!button.disabled) return;
            spinner.classList.add('hidden');
            button.querySelector('#button-text').textContent = originalText;
            button.disabled = false;
            statusDiv.textContent = "Timeout - Bitte professionell erneut versuchen";
        }, 45000); // 45s Timeout für professionelle Analyse
    });

    // PROFESSIONELLE INITIALISIERUNG
    updateProfessionalActiveLeaguesCount();
    loadProfessionalHeaderStats();
    
    // PROFESSIONELLE LIGA-ÄNDERUNGEN
    document.getElementById('league-select').addEventListener('change', updateProfessionalActiveLeaguesCount);
    
    // PROFESSIONELLE AUTO-LOAD FÜR HEUTE
    const today = new Date().toISOString().slice(0, 10);
    if (dateInput.value === today) {
        // Auto-load nur wenn heute ausgewählt ist
        setTimeout(() => {
            console.log("🔄 Professionelle Auto-Load für heute");
        }, 2000);
    }
    
    console.log("✅ Professionelle App ready - KI-Analyse kann gestartet werden");
    console.log("🧠 Model: PROFESSIONAL_ENSEMBLE_V3");
    console.log("📊 Features: xG-Analyse, H2H-Daten, Risiko-Assessment");
});

// PROFESSIONELLE GLOBALE FUNKTIONEN FÜR HTML
window.loadProfessionalMatches = loadProfessionalMatches;
window.checkProfessionalHealth = checkProfessionalHealth;
    
