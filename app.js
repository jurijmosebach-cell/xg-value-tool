const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");

const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

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

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const { response: games } = await res.json();

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele für heute.";
      return;
    }

    // Berechne Top 7 Value
    const sortedValue = [...games].sort((a, b) => {
      const aMax = Math.max(a.value.home, a.value.draw, a.value.away);
      const bMax = Math.max(b.value.home, b.value.draw, b.value.away);
      return bMax - aMax;
    }).slice(0, 7);

    // Berechne Top 3 xG
    const sortedXG = [...games].sort((a, b) => (b.totalXG || 0) - (a.totalXG || 0)).slice(0, 3);

    let topHTML = `<h2 class="text-lg font-bold mb-2">Top 7 Value Tipps</h2>`;
    sortedValue.forEach(g => {
      const maxVal = Math.max(g.value.home, g.value.draw, g.value.away);
      const market = maxVal === g.value.home ? "1" : maxVal === g.value.draw ? "X" : "2";
      topHTML += `<div class="mb-1">${g.home} vs ${g.away} → ${market} ${(maxVal*100).toFixed(1)}% Value</div>`;
    });

    topHTML += `<h2 class="text-lg font-bold mt-4 mb-2">Top 3 Favoriten (xG)</h2>`;
    sortedXG.forEach(g => {
      topHTML += `<div class="mb-1">${g.home} vs ${g.away} → ${g.totalXG.toFixed(2)} xG</div>`;
    });

    document.getElementById("statbox").innerHTML = topHTML;

    // Spiele rendern
    games.forEach(g => {
      const card = document.createElement("div");
      card.className = "bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700 mb-6";

      const homeVal = g.value.home * 100;
      const drawVal = g.value.draw * 100;
      const awayVal = g.value.away * 100;
      const overVal = g.value.over25 * 100;
      const underVal = g.value.under25 ? g.value.under25*100 : 0;

      const maxVal = Math.max(homeVal, drawVal, awayVal);

      card.innerHTML = `
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-3">
            <img src="${g.homeLogo}" class="w-10 h-10 rounded-full" alt="${g.home}"/>
            <div>
              <div class="font-bold text-lg">${g.home}</div>
              <div class="text-xs text-gray-400">${g.homeXG} xG</div>
            </div>
          </div>
          <span class="text-xs bg-cyan-900 text-cyan-300 px-3 py-1 rounded-full">${g.league}</span>
          <div class="flex items-center gap-3 text-right">
            <div>
              <div class="font-bold text-lg">${g.away}</div>
              <div class="text-xs text-gray-400">${g.awayXG} xG</div>
            </div>
            <img src="${g.awayLogo}" class="w-10 h-10 rounded-full" alt="${g.away}"/>
          </div>
        </div>

        <div class="text-amber-300 text-sm mb-2">
          1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}
        </div>
        <div class="text-sm mb-2 text-gray-300">
          Over 2.5: ${g.odds.over25 ? g.odds.over25.toFixed(2) : "-"} | Under 2.5: ${g.odds.under25 ? g.odds.under25.toFixed(2) : "-"}
        </div>

        <!-- Balken Sieg/Unentschieden -->
        <div class="flex gap-2 mb-2">
          <div class="flex-1 bg-gray-700 rounded-full relative h-6 overflow-hidden">
            <div class="absolute h-full left-0 top-0 bg-green-500 transition-all duration-1000"
                 style="width: ${homeVal}%"></div>
            ${homeVal === maxVal ? '<span class="absolute right-1 top-0 text-xs text-white font-bold">▲</span>' : ''}
          </div>
          <div class="flex-1 bg-gray-700 rounded-full relative h-6 overflow-hidden">
            <div class="absolute h-full left-0 top-0 bg-yellow-500 transition-all duration-1000"
                 style="width: ${drawVal}%"></div>
            ${drawVal === maxVal ? '<span class="absolute right-1 top-0 text-xs text-white font-bold">▲</span>' : ''}
          </div>
          <div class="flex-1 bg-gray-700 rounded-full relative h-6 overflow-hidden">
            <div class="absolute h-full left-0 top-0 bg-red-500 transition-all duration-1000"
                 style="width: ${awayVal}%"></div>
            ${awayVal === maxVal ? '<span class="absolute right-1 top-0 text-xs text-white font-bold">▲</span>' : ''}
          </div>
        </div>
        <div class="flex justify-between text-xs text-white mb-2">
          <span>1: ${homeVal.toFixed(1)}%</span>
          <span>X: ${drawVal.toFixed(1)}%</span>
          <span>2: ${awayVal.toFixed(1)}%</span>
        </div>

        <!-- Balken Over/Under -->
        <div class="relative h-6 bg-gray-700 rounded-full overflow-hidden">
          <div class="absolute h-full left-0 top-0 bg-green-500 transition-all duration-1000" style="width: ${overVal}%"></div>
          <div class="absolute h-full left-${overVal}% top-0 bg-red-500 transition-all duration-1000" style="width: ${underVal}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
            Over:${overVal.toFixed(1)}% | Under:${underVal.toFixed(1)}%
          </span>
        </div>
      `;

      matchList.appendChild(card);
    });

    statusDiv.textContent = `${games.length} aktuelle Spiele geladen!`;

  } catch (err) {
    statusDiv.textContent = "Fehler: " + err.message;
    console.error(err);
  }
}
