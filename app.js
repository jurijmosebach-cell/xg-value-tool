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

// NEUE Funktion: Confidence Level berechnen
function getConfidenceLevel(probability, value) {
    const baseConfidence = probability * 100;
    const valueBonus = Math.max(0, value) * 50;
    const total = baseConfidence + valueBonus;
    
    if (total > 80) return { level: "SEHR HOCH", color: "text-green-600", emoji: "🎯" };
    if (total > 65) return { level: "HOCH", color: "text-blue-600", emoji: "🔥" };
    if (total > 50) return { level: "MEDIUM", color: "text-yellow-600", emoji: "⚡" };
    return { level: "NIEDRIG", color: "text-gray-500", emoji: "💡" };
}

// NEUE Funktion: Starke Trends identifizieren
function getStrongTrends(game) {
    const trends = [];
    const { prob, value } = game;
    
    // Sieg/Unentschieden Trends
    if (prob.home > 0.6 && value.home > 0.1) trends.push({ type: "1", confidence: "HOCH" });
    if (prob.away > 0.6 && value.away > 0.1) trends.push({ type: "2", confidence: "HOCH" });
    if (prob.draw > 0.35 && value.draw > 0.15) trends.push({ type: "X", confidence: "HOCH" });
    
    // Over/Under Trends
    if (prob.over25 > 0.7 && value.over25 > 0.1) trends.push({ type: "OVER", confidence: "HOCH" });
    if (prob.over25 < 0.3 && value.over25 < -0.2) trends.push({ type: "UNDER", confidence: "MEDIUM" });
    
    // BTTS Trends
    if (prob.btts > 0.65 && value.btts > 0.1) trends.push({ type: "BTTS_JA", confidence: "HOCH" });
    if (prob.btts < 0.35 && value.btts < -0.2) trends.push({ type: "BTTS_NEIN", confidence: "MEDIUM" });
    
    return trends;
}

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

    statusDiv.textContent = "Lade Spiele...";
    matchList.innerHTML = "";

    try {
        const res = await fetch(`/api/games?date=${date}&leagues=${leagues.join(",")}`);
        const data = await res.json();
        const games = data.response;

        if (!games || games.length === 0) {
            statusDiv.textContent = "Keine Spiele gefunden.";
            return;
        }

        // Top 10 Wahrscheinlichkeit
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
            top10Section.className = "top-section bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-500";
            top10Section.innerHTML = `<h2 class="text-xl font-bold text-gray-800">🏅 Top 10 Wahrscheinlichkeit</h2>
                <div class="space-y-2 mt-3">${top10.map(g => {
                    const confidence = getConfidenceLevel(g.best.val, g.best.value);
                    return `<div class="flex justify-between items-center p-2 bg-white rounded-lg border">
                        <div>
                            <span class="font-semibold">${g.home} vs ${g.away}</span>
                            <br><span class="text-sm text-gray-600">Tipp <b class="text-blue-600">${g.best.type}</b> - ${(g.best.val * 100).toFixed(1)}%</span>
                        </div>
                        <span class="${confidence.color} font-bold text-sm">${confidence.emoji} ${confidence.level}</span>
                    </div>`;
                }).join("")}</div>`;
            matchList.appendChild(top10Section);
        }

        // Top 5 Value
        const topValue = [...games]
            .map(g => {
                const markets = [
                    { type: "1", val: g.value.home, prob: g.prob.home },
                    { type: "X", val: g.value.draw, prob: g.prob.draw },
                    { type: "2", val: g.value.away, prob: g.prob.away },
                    { type: "Over 2.5", val: g.value.over25, prob: g.prob.over25 },
                    { type: "BTTS Ja", val: g.value.btts, prob: g.prob.btts }
                ];
                const best = markets.reduce((a, b) => b.val > a.val ? b : a);
                return { ...g, bestValue: best };
            })
            .filter(g => g.bestValue.val > 0.1 && g.bestValue.prob > 0.3)
            .sort((a, b) => b.bestValue.val - a.bestValue.val)
            .slice(0, 5);

        if (topValue.length > 0) {
            const topValueSection = document.createElement("div");
            topValueSection.className = "top-section bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500";
            topValueSection.innerHTML = `<h2 class="text-xl font-bold text-gray-800">💰 Top 5 Value Wetten</h2>
                <div class="space-y-2 mt-3">${topValue.map(g => {
                    const confidence = getConfidenceLevel(g.bestValue.prob, g.bestValue.val);
                    return `<div class="flex justify-between items-center p-2 bg-white rounded-lg border">
                        <div>
                            <span class="font-semibold">${g.home} vs ${g.away}</span>
                            <br><span class="text-sm text-gray-600"><b class="text-green-600">${g.bestValue.type}</b> - Value: ${(g.bestValue.val * 100).toFixed(1)}%</span>
                        </div>
                        <span class="${confidence.color} font-bold text-sm">${confidence.emoji}</span>
                    </div>`;
                }).join("")}</div>`;
            matchList.appendChild(topValueSection);
        }

        // STARKE TRENDS Sektion
        const strongTrendGames = games
            .map(g => {
                const trends = getStrongTrends(g);
                return { ...g, strongTrends: trends };
            })
            .filter(g => g.strongTrends.length > 0);

        if (strongTrendGames.length > 0) {
            const trendsSection = document.createElement("div");
            trendsSection.className = "top-section bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500";
            trendsSection.innerHTML = `<h2 class="text-xl font-bold text-gray-800">📈 Starke Trends</h2>
                <div class="space-y-3 mt-3">${strongTrendGames.map(g => `
                    <div class="p-3 bg-white rounded-lg border">
                        <div class="font-semibold text-lg">${g.home} vs ${g.away}</div>
                        <div class="flex flex-wrap gap-2 mt-2">
                            ${g.strongTrends.map(t => 
                                `<span class="px-3 py-1 rounded-full text-sm font-medium ${
                                    t.confidence === 'HOCH' 
                                        ? 'bg-red-100 text-red-800 border border-red-300'
                                        : 'bg-orange-100 text-orange-800 border border-orange-300'
                                }">${t.type}</span>`
                            ).join('')}
                        </div>
                    </div>
                `).join('')}</div>`;
            matchList.appendChild(trendsSection);
        }

        // Restliche Spiele
        const restGames = games.filter(g => 
            !top10.some(t => t.home === g.home && t.away === g.away) &&
            !topValue.some(t => t.home === g.home && t.away === g.away) &&
            !strongTrendGames.some(t => t.home === g.home && t.away === g.away)
        );

        if (restGames.length > 0) {
            const restSection = document.createElement("div");
            restSection.className = "top-section";
            restSection.innerHTML = `<h2 class="text-xl font-bold text-gray-800 mb-4">🗂 Weitere Spiele</h2>
                <div class="grid gap-4 md:grid-cols-2">`;
            
            restGames.forEach(g => {
                const card = document.createElement("div");
                card.className = "match-card bg-white rounded-xl shadow-lg border p-4";
                
                const homeVal = g.prob.home * 100;
                const drawVal = g.prob.draw * 100;
                const awayVal = g.prob.away * 100;
                const overVal = g.prob.over25 * 100;
                const bttsVal = g.prob.btts * 100;

                const markets = [
                    { type: "1", prob: g.prob.home, value: g.value.home },
                    { type: "X", prob: g.prob.draw, value: g.value.draw },
                    { type: "2", prob: g.prob.away, value: g.value.away },
                    { type: "Over 2.5", prob: g.prob.over25, value: g.value.over25 },
                    { type: "BTTS Ja", prob: g.prob.btts, value: g.value.btts }
                ];
                
                const bestMarket = markets.reduce((a, b) => 
                    (b.prob + b.value) > (a.prob + a.value) ? b : a
                );
                const confidence = getConfidenceLevel(bestMarket.prob, bestMarket.value);

                card.innerHTML = `
                    <div class="match-header mb-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-sm font-medium text-gray-500">${g.league}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">xG: ${g.totalXG}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <div class="text-center">
                                <div class="font-semibold">${g.home}</div>
                                <div class="text-sm text-gray-600">${g.homeXG} xG</div>
                            </div>
                            <div class="text-gray-400 mx-2">vs</div>
                            <div class="text-center">
                                <div class="font-semibold">${g.away}</div>
                                <div class="text-sm text-gray-600">${g.awayXG} xG</div>
                            </div>
                        </div>
                    </div>

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

                    <div class="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div class="text-center font-semibold ${confidence.color}">
                            ${confidence.emoji} Empfehlung: ${bestMarket.type}
                        </div>
                        <div class="text-center text-sm text-gray-600 mt-1">
                            Confidence: ${confidence.level}
                        </div>
                    </div>
                `;
                restSection.appendChild(card);
            });
            
            restSection.innerHTML += `</div>`;
            matchList.appendChild(restSection);
        }

        statusDiv.textContent = `${games.length} Spiele geladen!`;

    } catch(err) {
        statusDiv.textContent = "Fehler: " + err.message;
        console.error(err);
    }
}
