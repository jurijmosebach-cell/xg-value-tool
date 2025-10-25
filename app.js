const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");

// Heute als Standard
const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

// Events
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

    // Top 7 Value Tipps
    const topValue = [...games]
      .map(g => {
        const bestValue = Math.max(g.value.home, g.value.draw, g.value.away, g.value.over25, g.value.under25);
        const market = bestValue === g.value.home ? "1" :
                       bestValue === g.value.draw ? "X" :
                       bestValue === g.value.away ? "2" :
                       bestValue === g.value.over25 ? "O2.5" : "U2.5";
        return { ...g, bestValue, market };
      })
      .sort((a, b) => b.bestValue - a.bestValue)
      .slice(0, 7);

    const topValueDiv = document.createElement("div");
    topValueDiv.className = "mb-6 p-4 bg-gray-900 rounded-xl";
    topValueDiv.innerHTML = "<h2 class='text-lg font-bold text-cyan-400 mb-2'>Top 7 Value Tipps</h2>" +
      topValue.map(g => `${g.home} vs ${g.away} → ${g.market} ${(g.bestValue*100).toFixed(1)}% Value`).join("<br>");
    matchList.appendChild(topValueDiv);

    // Top 3 xG Favoriten
    const topXG = [...games]
      .map(g => ({ ...g, totalXG: g.homeXG + g.awayXG }))
      .sort((a, b) => b.totalXG - a.totalXG)
      .slice(0, 3);

    const topXGDiv = document.createElement("div");
    topXGDiv.className = "mb-6 p-4 bg-gray-900 rounded-xl";
    topXGDiv.innerHTML = "<h2 class='text-lg font-bold text-green-400 mb-2'>Top 3 Favoriten (xG)</h2>" +
      topXG.map(g => `${g.home} vs ${g.away} → ${(g.totalXG).toFixed(2)} xG`).join("<br>");
    matchList.appendChild(topXGDiv);

    // Spiele
    games.forEach(g => {
      const card = document.createElement("div");
      card.className = "bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700 mb-6";

      const homeVal = g.value.home * 100;
      const drawVal = g.value.draw * 100;
      const awayVal = g.value.away * 100;
      const overVal = g.value.over25 * 100;
      const underVal = g.value.under25 * 100;

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
          1: ${g.odds.home ? g.odds.home.toFixed(2) : "-"} | X: ${g.odds.draw ? g.odds.draw.toFixed(2) : "-"} | 2: ${g.odds.away ? g.odds.away.toFixed(2) : "-"}
        </div>
        <div class="text-sm mb-2 text-gray-300">
          Over 2.5: ${g.odds.over25 ? g.odds.over25.toFixed(2) : "-"} | Under 2.5: ${g.odds.under25 ? g.odds.under25.toFixed(2) : "-"}
        </div>

        <!-- Balken Sieg/Unentschieden -->
        <div class="relative h-6 bg-gray-700 rounded-full overflow-hidden mb-2">
          <div class="absolute h-full left-0 top-0 bg-green-500 transition-all duration-1000" style="width: ${homeVal}%"></div>
          <div class="absolute h-full left-${homeVal}% top-0 bg-yellow-500 transition-all duration-1000" style="width: ${drawVal}%"></div>
          <div class="absolute h-full left-${homeVal + drawVal}% top-0 bg-red-500 transition-all duration-1000" style="width: ${awayVal}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
            1:${homeVal.toFixed(1)}% | X:${drawVal.toFixed(1)}% | 2:${awayVal.toFixed(1)}%
          </span>
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
