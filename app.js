const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");

// HEUTE als Standard
const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

// Sofort laden
refreshBtn.addEventListener("click", loadMatches);
loadMatches();

async function loadMatches() {
  const date = dateInput.value;
  if (!date) {
    statusDiv.textContent = "Bitte Datum wählen!";
    return;
  }

  statusDiv.textContent = "Lade aktuelle Spiele...";
  matchList.innerHTML = "";

  // ---- Legende automatisch einfügen (nur einmal) ----
  if (!document.getElementById("legend-bar")) {
    const legend = document.createElement("div");
    legend.id = "legend-bar";
    legend.className = "flex flex-wrap items-center justify-start gap-3 mb-4 p-3 bg-gray-800 rounded-xl border border-gray-700 text-sm text-gray-200 shadow-md";
    legend.innerHTML = `
      <span class="font-bold text-gray-100 mr-2">Legende:</span>
      <span class="flex items-center gap-1"><span class="inline-block w-4 h-4 bg-green-500 rounded"></span> Over / hoher Value</span>
      <span class="flex items-center gap-1"><span class="inline-block w-4 h-4 bg-yellow-500 rounded"></span> Neutral / mittlerer Value</span>
      <span class="flex items-center gap-1"><span class="inline-block w-4 h-4 bg-red-500 rounded"></span> Under / geringer Value</span>
      <span class="flex items-center gap-1"><span class="inline-block w-4 h-4 bg-blue-500 rounded"></span> Heim-Wahrscheinlichkeit</span>
      <span class="flex items-center gap-1"><span class="inline-block w-4 h-4 bg-orange-500 rounded"></span> Auswärts-Wahrscheinlichkeit</span>
      <span class="flex items-center gap-1"><span class="inline-block w-4 h-4 bg-gray-500 rounded"></span> Unentschieden-Wahrscheinlichkeit</span>
    `;
    const appRoot = document.getElementById("app") || document.body;
    appRoot.insertBefore(legend, matchList);
  }

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const { response: games } = await res.json();

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele für heute (Quoten noch nicht verfügbar)";
      return;
    }

    // --- Top 7 Value Tipps + Top 3 xG ---
    const sortedByValue = [...games].sort((a,b) => Math.max(b.value.home,b.value.draw,b.value.away) - Math.max(a.value.home,a.value.draw,a.value.away));
    const top7 = sortedByValue.slice(0,7);
    const sortedByXG = [...games].sort((a,b) => (b.homeXG+b.awayXG)-(a.homeXG+a.awayXG));
    const top3XG = sortedByXG.slice(0,3);

    let tipHtml = `<div class="mb-4 text-yellow-300 font-semibold">Top 7 Value Tipps</div>`;
    top7.forEach(g => {
      const bestVal = Math.max(g.value.home, g.value.draw, g.value.away);
      const market = bestVal === g.value.home ? "1" : bestVal === g.value.draw ? "X" : "2";
      tipHtml += `<div>${g.home} vs ${g.away} → ${market} ${Math.round(bestVal*1000)/10}% Value</div>`;
    });

    tipHtml += `<div class="mt-2 mb-4 text-cyan-300 font-semibold">Top 3 Favoriten (xG)</div>`;
    top3XG.forEach(g => {
      tipHtml += `<div>${g.home} vs ${g.away} → ${(g.homeXG+g.awayXG).toFixed(2)} xG</div>`;
    });

    const statBox = document.getElementById("statbox");
    statBox.innerHTML = tipHtml;

    // --- Spiele rendern ---
    let count = 0;
    for (const g of games) {
      const bestValue = Math.max(g.value.home, g.value.draw, g.value.away);
      const valuePercent = (bestValue * 100).toFixed(1);
      const valueClass = bestValue > 0.12 ? "bg-green-500" : bestValue > 0.05 ? "bg-yellow-500" : "bg-red-500";
      const market = bestValue === g.value.home ? "1" : bestValue === g.value.draw ? "X" : "2";

      const overUnder = g.odds.over25 ? (g.odds.over25>2 ? "Over" : "Under") : "-";
      const ouValue = g.odds.over25 ? g.odds.over25 : 0;
      const ouClass = overUnder==="Over"?"bg-green-500":"bg-red-500";

      const card = document.createElement("div");
      card.className = "bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700 mb-4";
      card.innerHTML = `
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-3">
            <img src="${g.homeLogo}" class="w-10 h-10 rounded-full" alt="${g.home}"/>
            <div><div class="font-bold text-lg">${g.home}</div><div class="text-xs text-gray-400">${g.homeXG} xG</div></div>
          </div>
          <span class="text-xs bg-cyan-900 text-cyan-300 px-3 py-1 rounded-full">${g.league}</span>
          <div class="flex items-center gap-3 text-right">
            <div><div class="font-bold text-lg">${g.away}</div><div class="text-xs text-gray-400">${g.awayXG} xG</div></div>
            <img src="${g.awayLogo}" class="w-10 h-10 rounded-full" alt="${g.away}"/>
          </div>
        </div>

        <div class="text-amber-300 text-sm mb-2">
          1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}
        </div>
        <div class="text-sm mb-2 text-gray-300">
          Over 2.5: ${g.odds.over25 ? g.odds.over25.toFixed(2) : "-"}
        </div>

        <div class="relative h-6 bg-gray-700 rounded-full overflow-hidden mb-2">
          <div class="${valueClass} h-full transition-all duration-700" style="width: ${Math.min(bestValue*120+40,100)}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">${market} ${valuePercent}% Value</span>
        </div>

        <div class="relative h-4 bg-gray-700 rounded-full overflow-hidden mb-2">
          <div class="${ouClass} h-full transition-all duration-700" style="width: ${Math.min(ouValue*40,100)}%"></div>
          <span class="absolute inset-0 flex items-center justify-center text-xs text-white">${overUnder}</span>
        </div>
      `;
      matchList.appendChild(card);
      count++;
    }

    statusDiv.textContent = `${count} aktuelle Spiele geladen!`;

  } catch (err) {
    statusDiv.textContent = "Fehler: " + err.message;
    console.error(err);
  }
}
