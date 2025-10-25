const matchList = document.getElementById("match-list");
const topValueList = document.getElementById("top-value-list");
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
  topValueList.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const { response: games } = await res.json();

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele für heute.";
      return;
    }

    // Top 7 Value Tipps
    const top7 = [...games].sort((a, b) => {
      const aVal = Math.max(a.value?.home || 0, a.value?.draw || 0, a.value?.away || 0);
      const bVal = Math.max(b.value?.home || 0, b.value?.draw || 0, b.value?.away || 0);
      return bVal - aVal;
    }).slice(0, 7);

    top7.forEach(g => {
      const bestValue = Math.max(g.value?.home || 0, g.value?.draw || 0, g.value?.away || 0);
      const valuePercent = (bestValue * 100).toFixed(1);
      const valueClass = bestValue > 0.12 ? "bg-green-500" : bestValue > 0.05 ? "bg-yellow-500" : "bg-red-500";
      const market = bestValue === (g.value?.home || 0) ? "1" : bestValue === (g.value?.draw || 0) ? "X" : "2";

      const topCard = document.createElement("div");
      topCard.className = "mb-2 p-2 bg-gray-800 rounded-md shadow";
      topCard.innerHTML = `
        <div class="flex justify-between items-center text-white font-bold">
          <span>${g.home || "-"} vs ${g.away || "-"} → ${market} ${valuePercent}% Value</span>
        </div>
        <div class="relative h-4 bg-gray-700 rounded-full overflow-hidden mt-1">
          <div class="${valueClass} h-full transition-all duration-1000" style="width: ${Math.min(bestValue*120, 100)}%"></div>
        </div>
      `;
      topValueList.appendChild(topCard);
    });

    games.forEach(g => {
      const card = document.createElement("div");
      card.className = "bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700 mb-6";

      const homeVal = ((g.value?.home || 0) * 100).toFixed(1);
      const drawVal = ((g.value?.draw || 0) * 100).toFixed(1);
      const awayVal = ((g.value?.away || 0) * 100).toFixed(1);
      const overVal = ((g.value?.over25 || 0.5) * 100).toFixed(1);
      const underVal = (100 - overVal).toFixed(1);

      card.innerHTML = `
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-3">
            <img src="${g.homeLogo || ''}" class="w-10 h-10 rounded-full" alt="${g.home || '-'}"/>
            <div>
              <div class="font-bold text-lg">${g.home || "-"}</div>
              <div class="text-xs text-gray-400">${g.homeXG || "-"} xG</div>
            </div>
          </div>
          <span class="text-xs bg-cyan-900 text-cyan-300 px-3 py-1 rounded-full">${g.league || "-"}</span>
          <div class="flex items-center gap-3 text-right">
            <div>
              <div class="font-bold text-lg">${g.away || "-"}</div>
              <div class="text-xs text-gray-400">${g.awayXG || "-"} xG</div>
            </div>
            <img src="${g.awayLogo || ''}" class="w-10 h-10 rounded-full" alt="${g.away || '-'}"/>
          </div>
        </div>

        <div class="text-amber-300 text-sm mb-2">
          1: ${(g.odds?.home || 0).toFixed(2)} | X: ${(g.odds?.draw || 0).toFixed(2)} | 2: ${(g.odds?.away || 0).toFixed(2)}
        </div>
        <div class="text-sm mb-2 text-gray-300">
          Over 2.5: ${(g.odds?.over25 || 0).toFixed(2)} | Under 2.5: ${(g.odds?.under25 || 0).toFixed(2)}
        </div>

        <!-- Sieg/Unentschieden/Niederlage Balken -->
        <div class="relative h-6 bg-gray-700 rounded-full overflow-hidden mb-2">
          <div class="absolute left-0 top-0 h-full bg-green-500" style="width: ${homeVal}%">
            <span class="absolute left-2 text-white font-bold text-sm">${g.home || "-"} ${homeVal}%</span>
          </div>
          <div class="absolute left-${homeVal}% top-0 h-full bg-yellow-500" style="width: ${drawVal}%">
            <span class="absolute left-2 text-white font-bold text-sm">Draw ${drawVal}%</span>
          </div>
          <div class="absolute left-${+homeVal + +drawVal}% top-0 h-full bg-red-500" style="width: ${awayVal}%">
            <span class="absolute left-2 text-white font-bold text-sm">${g.away || "-"} ${awayVal}%</span>
          </div>
        </div>

        <!-- Over/Under Balken -->
        <div class="relative h-6 bg-gray-700 rounded-full overflow-hidden">
          <div class="absolute left-0 top-0 h-full bg-green-500" style="width: ${overVal}%">
            <span class="absolute left-2 text-white font-bold text-sm">Over ${overVal}%</span>
          </div>
          <div class="absolute left-${overVal}% top-0 h-full bg-red-500" style="width: ${underVal}%">
            <span class="absolute left-2 text-white font-bold text-sm">Under ${underVal}%</span>
          </div>
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
