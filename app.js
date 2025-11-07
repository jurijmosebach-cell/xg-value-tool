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

// NEUE FUNKTION: H2H Badge Style
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

// NEUE FUNKTION: Zeige H2H Übersicht
function showH2HOverview(games) {
    const gamesWithH2H = games.filter(g => g.h2hData && g.h2hData.available);
    
    if (gamesWithH2H.length === 0) return null;

    const h2hSection = document.createElement('div');
    h2hSection.className = 'top-section bg-gradient-to-r from-orange-50 to-amber-100 border-l-4 border-orange-500 p-6';
    
    // Finde interessante H2H Statistiken
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

// NEUE FUNKTION: Erweiterte Match-Karte mit H2H
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
            </div>
        </div>
    `;
    
    return card;
}

// NEUE FUNKTION: Detailierte H2H Ansicht
function showH2HDetails(game) {
    if (!game.h2hData || !game.h2hData.available) return '';
    
    const h2h = game.h2hData;
    
    return `
        <div class="mt-4 border-t pt-4">
            <h4 class="font-semibold text-gray-800 mb-3">📈 Detaillierte H2H Analyse</h4>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div class="text-center p-3 bg-green-50 rounded-lg">
                    <div class="text-2xl font-bold text-green-600">${h2h.homeWinPercentage.toFixed(0)}%</div>
                    <div class="text-sm text-green-800">Heimsiege</div>
                </div>
                <div class="text-center p-3 bg-yellow-50 rounded-lg">
                    <div class="text-2xl font-bold text-yellow-600">${h2h.drawPercentage.toFixed(0)}%</div>
                    <div class="text-sm text-yellow-800">Unentschieden</div>
                </div>
                <div class="text-center p-3 bg-red-50 rounded-lg">
                    <div class="text-2xl font-bold text-red-600">${h2h.awayWinPercentage.toFixed(0)}%</div>
                    <div class="text-sm text-red-800">Auswärtssiege</div>
                </div>
                <div class="text-center p-3 bg-purple-50 rounded-lg">
                    <div class="text-2xl font-bold text-purple-600">${h2h.avgGoals.toFixed(1)}</div>
                    <div class="text-sm text-purple-800">Ø Tore/Spiel</div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="text-center p-3 bg-orange-50 rounded-lg">
                    <div class="text-xl font-bold text-orange-600">${h2h.over25Percentage.toFixed(0)}%</div>
                    <div class="text-sm text-orange-800">Over 2.5 Spiele</div>
                </div>
                <div class="text-center p-3 bg-blue-50 rounded-lg">
                    <div class="text-xl font-bold text-blue-600">${h2h.bttsPercentage.toFixed(0)}%</div>
                    <div class="text-sm text-blue-800">BTTS Spiele</div>
                </div>
            </div>
            
            ${h2h.trends && h2h.trends.length > 0 ? `
                <div class="bg-gray-50 rounded-lg p-3">
                    <div class="font-semibold text-gray-700 mb-2">H2H Trends:</div>
                    <ul class="text-sm text-gray-600 list-disc list-inside space-y-1">
                        ${h2h.trends.map(trend => `<li>${trend}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            ${h2h.recentGames && h2h.recentGames.length > 0 ? `
                <div class="mt-3">
                    <div class="font-semibold text-gray-700 mb-2">Letzte Begegnungen:</div>
                    <div class="space-y-2 text-sm">
                        ${h2h.recentGames.slice(0, 3).map(game => `
                            <div class="flex justify-between items-center bg-white border rounded-lg p-2">
                                <span class="text-gray-600">${game.date}</span>
                                <span class="font-semibold">${game.result}</span>
                                <span class="text-gray-500 text-xs">${game.competition}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}
// Bestehende Hilfsfunktionen (behalten)
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

async function loadPerformanceStats() {
    try {
        const res = await fetch('/api/performance');
        const data = await res.json();
        return data;
    } catch (err) {
        console.error('Fehler beim Laden der Performance-Daten:', err);
        return null;
    }
}

function showPerformanceOverview(performanceData) {
    const performanceSection = document.createElement('div');
    performanceSection.className = 'top-section bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 p-6';
    
    if (!performanceData || !performanceData.overall) {
        performanceSection.innerHTML = `
            <h2 class="text-xl font-bold text-gray-800 mb-4">Performance Tracking</h2>
            <div class="text-center text-gray-600 py-8">
                <div class="text-4xl mb-2">📊</div>
                <p>Noch keine Performance-Daten verfügbar</p>
                <p class="text-sm mt-2">Analysiere Spiele um Statistiken zu sammeln</p>
            </div>
        `;
        return performanceSection;
    }

    const overall = performanceData.overall;
    const accuracy = overall.total > 0 ? Math.round((overall.correct / overall.total) * 100) : 0;
    
    performanceSection.innerHTML = `
        <h2 class="text-xl font-bold text-gray-800 mb-4">Performance Tracking</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-white p-4 rounded-lg text-center shadow-sm">
                <div class="text-2xl font-bold text-green-600">${accuracy}%</div>
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
                <div class="text-2xl font-bold text-orange-600">${Object.keys(performanceData.predictions || {}).length}</div>
                <div class="text-sm text-gray-600">Analysierte Tage</div>
            </div>
        </div>
    `;
    
    return performanceSection;
}

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
                            
                            ${showH2HDetails(game)}
                            
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

// HAUPTFUNKTION: Spiele laden (erweitert)
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

    statusDiv.textContent = "Lade Spiele, H2H Daten und KI-Analysen...";
    matchList.innerHTML = "";

    // Loading State für Button
    const button = document.getElementById('refresh');
    const buttonText = button.querySelector('#button-text');
    const spinner = button.querySelector('#loading-spinner');
    spinner.classList.remove('hidden');
    buttonText.textContent = 'Analysiere...';
    button.disabled = true;

    try {
        // Lade Performance-Daten parallel
        const performancePromise = loadPerformanceStats();
        
        // Lade Spiele mit H2H Daten
        const res = await fetch(`/api/games?date=${date}&leagues=${leagues.join(",")}`);
        const data = await res.json();
        const games = data.response;

        if (!games || games.length === 0) {
            statusDiv.textContent = "Keine Spiele gefunden.";
            return;
        }

        // Warte auf Performance-Daten
        const performanceData = await performancePromise;

        // Zeige Performance-Übersicht
        const performanceSection = showPerformanceOverview(performanceData);
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

        // Weitere Spiele mit erweiterten Karten
        const otherGames = games.filter(g => 
            !(aiSection && games.filter(ag => 
                ag.aiRecommendation && 
                ['STRONG_BET', 'VALUE_BET'].includes(ag.aiRecommendation.recommendation)
            ).some(ag => ag.home === g.home && g.away === ag.away))
        );

        if (otherGames.length > 0) {
            const restSection = document.createElement("div");
            restSection.className = "top-section p-6";
            restSection.innerHTML = `<h2 class="text-xl font-bold text-gray-800 mb-4">Weitere Spiele</h2>
                <div class="grid gap-4 md:grid-cols-2">`;
            
            otherGames.forEach(g => {
                const card = createEnhancedMatchCard(g);
                restSection.appendChild(card);
            });
            
            restSection.innerHTML += `</div>`;
            matchList.appendChild(restSection);
        }

        // Statistik für H2H Daten
        const gamesWithH2H = games.filter(g => g.h2hData && g.h2hData.available).length;
        statusDiv.textContent = `${games.length} Spiele geladen - ${gamesWithH2H} mit H2H Daten - KI-Analyse abgeschlossen!`;

    } catch(err) {
        statusDiv.textContent = "Fehler: " + err.message;
        console.error(err);
    } finally {
        // Button zurücksetzen
        spinner.classList.add('hidden');
        buttonText.textContent = '🤖 KI-Analyse starten';
        button.disabled = false;
    }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', function() {
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
        });
    });
});

