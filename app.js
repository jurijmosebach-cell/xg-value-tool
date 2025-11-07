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

// NEUE FUNKTION: KI-Recommendation Styles
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

// NEUE FUNKTION: Risk Badge
function getRiskBadge(riskLevel) {
    const riskStyles = {
        "SEHR HOCH": "bg-red-100 text-red-800 border border-red-300",
        "HOCH": "bg-orange-100 text-orange-800 border border-orange-300", 
        "MEDIUM": "bg-yellow-100 text-yellow-800 border border-yellow-300",
        "NIEDRIG": "bg-green-100 text-green-800 border border-green-300"
    };
    return riskStyles[riskLevel] || riskStyles["MEDIUM"];
}

// NEUE FUNKTION: Lade Performance-Daten
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

// NEUE FUNKTION: Zeige Performance-Übersicht
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
    
    // Berechne letzte 7 Tage Performance
    const last7Days = Object.keys(performanceData.predictions || {})
        .sort()
        .slice(-7)
        .reduce((acc, date) => {
            const dayPredictions = performanceData.predictions[date];
            const correct = dayPredictions.filter(p => p.actual && p.actual.correct).length;
            return {
                total: acc.total + dayPredictions.length,
                correct: acc.correct + correct
            };
        }, { total: 0, correct: 0 });

    const last7Accuracy = last7Days.total > 0 ? Math.round((last7Days.correct / last7Days.total) * 100) : 0;

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
                <div class="text-2xl font-bold text-purple-600">${last7Accuracy}%</div>
                <div class="text-sm text-gray-600">Letzte 7 Tage</div>
            </div>
            <div class="bg-white p-4 rounded-lg text-center shadow-sm">
                <div class="text-2xl font-bold text-orange-600">${overall.correct}</div>
                <div class="text-sm text-gray-600">Korrekte Vorhersagen</div>
            </div>
        </div>
        
        <div class="bg-white rounded-lg p-4 shadow-sm">
            <h3 class="font-semibold text-gray-800 mb-3">Performance-Verlauf</h3>
            <div class="text-sm text-gray-600">
                ${overall.total > 0 
                    ? `Die KI-Empfehlungen waren in ${accuracy}% der Fälle korrekt.`
                    : 'Starte mit der Analyse um Performance-Daten zu sammeln.'
                }
            </div>
        </div>
    `;
    
    return performanceSection;
}

// NEUE FUNKTION: Zeige KI-Empfehlungen
function showAIRecommendations(games) {
    // Filtere nur Spiele mit starken Empfehlungen
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
                
                return `
                    <div class="bg-white rounded-xl shadow-lg border ${style.border} overflow-hidden">
                        <div class="${style.bg} ${style.text} p-4">
                            <div class="flex justify-between items-center">
                                <div class="flex items-center space-x-2">
                                    <span class="text-lg">${style.icon}</span>
                                    <span class="font-bold">${style.label}</span>
                                </div>
                                <span class="text-sm px-3 py-1 bg-white bg-opacity-20 rounded-full">
                                    Risiko: <span class="${riskStyle} px-2 py-1 rounded-full text-xs">${rec.risk.level}</span>
                                </span>
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
                            
                            <div class="grid grid-cols-2 gap-4 text-sm">
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
                            
                            ${rec.alternative ? `
                                <div class="mt-3 text-center text-sm text-gray-600">
                                    Alternative: <span class="font-semibold">${rec.alternative}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    return recommendationsSection;
}

// NEUE FUNKTION: Erweiterte Match-Karten mit KI-Daten
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

    card.innerHTML = `
        <div class="match-header mb-4">
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-gray-500">${game.league}</span>
                <div class="flex space-x-2">
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">xG: ${game.totalXG}</span>
                    <span class="text-xs ${riskStyle} px-2 py-1 rounded">Risiko: ${aiRec.risk.level}</span>
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
            </div>
        </div>
    `;
    
    return card;
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

    statusDiv.textContent = "Lade Spiele und KI-Analysen...";
    matchList.innerHTML = "";

    try {
        // Lade Performance-Daten parallel
        const performancePromise = loadPerformanceStats();
        
        // Lade Spiele
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

        // Zeige KI Top-Empfehlungen
        const aiSection = showAIRecommendations(games);
        if (aiSection) {
            matchList.appendChild(aiSection);
        }

        // Top 10 Wahrscheinlichkeit (angepasst)
        const top10 = [...games]
            .map(g => {
                const best =
                    g.prob.home > g.prob.away && g.prob.home > g.prob.draw
                        ? { type: "1", val: g.prob.home, value: g.value.home }
                        : g.prob.away > g.prob.home && g.prob.away > g.prob.draw
                        ? { type: "2", val: g.prob.away, value: g.value.away }
                        : { type: "X", val: g.prob.draw, value: g.value.draw };
                return { ...g, best };
            })
            .filter(g => g.best.val > 0.4)
            .sort((a, b) => (b.best.val + b.best.value) - (a.best.val + a.best.value))
            .slice(0, 10);

        if (top10.length > 0) {
            const top10Section = document.createElement("div");
            top10Section.className = "top-section bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-500 p-6";
            top10Section.innerHTML = `<h2 class="text-xl font-bold text-gray-800 mb-4">Top 10 Wahrscheinlichkeit</h2>
                <div class="space-y-2">${top10.map(g => {
                    const aiRec = g.aiRecommendation;
                    const recStyle = getRecommendationStyle(aiRec.recommendation);
                    
                    return `<div class="flex justify-between items-center p-3 bg-white rounded-lg border">
                        <div>
                            <span class="font-semibold">${g.home} vs ${g.away}</span>
                            <br><span class="text-sm text-gray-600">Tipp <b class="text-blue-600">${g.best.type}</b> - ${(g.best.val * 100).toFixed(1)}%</span>
                        </div>
                        <div class="text-right">
                            <span class="text-sm ${recStyle.text} ${recStyle.bg} px-2 py-1 rounded">${recStyle.icon} ${aiRec.recommendation.replace('_', ' ')}</span>
                        </div>
                    </div>`;
                }).join("")}</div>`;
            matchList.appendChild(top10Section);
        }

        // Weitere Spiele mit erweiterten Karten
        const otherGames = games.filter(g => 
            !top10.some(t => t.home === g.home && t.away === g.away)
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

        statusDiv.textContent = `${games.length} Spiele geladen - KI-Analyse abgeschlossen!`;

    } catch(err) {
        statusDiv.textContent = "Fehler: " + err.message;
        console.error(err);
    }
}
