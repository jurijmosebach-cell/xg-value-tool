const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const statBox = document.getElementById("statbox");
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
  statBox.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const { response: games } = await res.json();

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele für heute.";
      return;
    }

    // --- Top 7 Value Tipps ---
    const topValue = [...games]
      .sort((a,b) => Math.max(...Object.values(b.value)) - Math.max(...Object.values(a.value)))
      .slice(0,7);

    const topValueHtml = `<div class="mb-4">
      <h2 class="font-bold text-lg mb-2">Top 7 Value Tipps</h2>
      <ul class="list-disc ml-5">
        ${topValue.map(g => {
          const bestMarket = Object.entries(g.value).reduce((a,b) => a[1] > b[1]? a:b);
          return `<li>${g.home} vs ${g.away} → ${bestMarket[0]} ${(bestMarket[1]*100).toFixed(1)}% Value</li>`;
        }).join("")}
      </ul>
    </div>`;
    statBox.innerHTML += topValueHtml;

    // --- Top 5 xG Favoriten ---
    const topXG = [...games]
      .sort((a,b) => (b.homeXG + b.awayXG) - (a.homeXG + a.awayXG))
      .slice(0,5);

    const topXGHtml = `<div class="mb-6">
      <h2 class="font-bold text-lg mb-2">Top 5 Favoriten (xG)</h2>
      <ul class="list-disc ml-5">
        ${topXG.map(g => `<li>${g.home} vs ${g.away} → ${(g.homeXG+g.awayXG).toFixed(2)} xG</li>`).join("")}
      </ul>
    </div>`;
    statBox.innerHTML += topXGHtml;

    // --- Spiele anzeigen ---
    games.forEach(g => {
      const homeVal = g.value.home * 100;
      const drawVal = g.value.draw * 100;
      const awayVal = g.value.away * 100;
      const overVal = g.value.over25 * 100;
      const underVal = g.value.under25 * 100;

      // Dynamische Farbintensität basierend auf Value
      const maxVal = Math.max(homeVal, drawVal, awayVal);
      const homeColor = `rgba(34,197,94,${homeVal/maxVal})`; // grün
      const drawColor = `rgba(234,179,8,${drawVal/maxVal})`; // gelb
      const awayColor = `rgba(239,68,68,${awayVal/maxVal})`; // rot

      const overColor = `rgba(34,197,94,${overVal})`; 
      const underColor = `rgba(239,68,68,${underVal})`;

      const card = document.createElement("div");
      card.className = "bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700 mb-6";

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
        <div class="relative h-6 bg-gray-700 rounded-full overflow-hidden mb-2 group">
          <div class="absolute h-full left-0 top-0" style="width:${homeVal}%;background-color:${homeColor}" title="1: ${homeVal.toFixed(1)}%"></div>
          <div class="absolute h-full left:${homeVal}% top-0" style="width:${drawVal}%;background-color:${drawColor}" title="X: ${drawVal.toFixed(1)}%"></div>
          <div class="absolute h-full left:${homeVal+drawVal}% top-0" style="width:${awayVal}%;background-color:${awayColor}" title="2: ${awayVal.toFixed(1)}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
            Hover für Details
          </span>
        </div>

        <!-- Balken Over/Under -->
        <div class="relative h-6 bg-gray-700 rounded-full overflow-hidden group">
          <div class="absolute h-full left-0 top-0" style="width:${overVal}%;background-color:${overColor}" title="Over: ${overVal.toFixed(1)}%"></div>
          <div class="absolute h-full left:${overVal}% top-0" style="width:${underVal}%;background-color:${underColor}" title="Under: ${underVal.toFixed(1)}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
            Hover für Details
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
