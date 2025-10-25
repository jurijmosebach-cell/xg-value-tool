// app.js — vollständig, farbige Value Balken + Top Tipps + Top Favoriten
const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");
const topList = document.getElementById("top-list");
const topFavoritesDiv = document.getElementById("top-favorites");

// Heute als Standard
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
  topList.innerHTML = "";
  topFavoritesDiv.innerHTML = '<h2 class="text-xl font-bold text-green-400 mb-2">Top 3 Favoriten (xG)</h2>';

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const { response: games, top7, top3Fav } = await res.json();

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele für dieses Datum!";
      return;
    }

    // ----- TOP 7 Value Tipps -----
    top7.forEach(t => {
      const li = document.createElement("li");
      const valPercent = (t.value * 100).toFixed(1);
      let color = "text-red-400";
      if (valPercent > 15) color = "text-green-400";
      else if (valPercent > 5) color = "text-yellow-400";
      li.className = color;
      li.textContent = `${t.home} vs ${t.away} → ${t.market.toUpperCase()} ${valPercent}% Value`;
      topList.appendChild(li);
    });

    // ----- TOP 3 Favoriten -----
    top3Fav.forEach(f => {
      const div = document.createElement("div");
      div.className = "text-gray-200 mb-1";
      div.textContent = `${f.home} (${f.homeXG} xG) vs ${f.away} (${f.awayXG} xG)`;
      topFavoritesDiv.appendChild(div);
    });

    // ----- MATCH LIST -----
    games.forEach(g => {
      const bestValue = Math.max(g.value.home, g.value.draw, g.value.away, g.value.over25 || 0, g.value.bttsYes || 0);
      const valuePercent = (bestValue * 100).toFixed(1);
      const valueClass = bestValue > 0.12 ? "bg-green-500" : bestValue > 0.05 ? "bg-yellow-500" : "bg-red-500";
      const market = bestValue === g.value.home ? "1" :
                     bestValue === g.value.draw ? "X" :
                     bestValue === g.value.away ? "2" :
                     bestValue === g.value.over25 ? "O2.5" :
                     bestValue === g.value.bttsYes ? "BTTS" : "";

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
          1: ${g.odds.home?.toFixed(2) || "-"} | X: ${g.odds.draw?.toFixed(2) || "-"} | 2: ${g.odds.away?.toFixed(2) || "-"}
        </div>
        <div class="text-sm mb-2 text-gray-300">
          ${g.odds.over25 ? `Over 2.5: ${g.odds.over25.toFixed(2)}` : ""} 
          ${g.odds.bttsYes ? `| BTTS: ${g.odds.bttsYes.toFixed(2)}` : ""}
        </div>
        <div class="relative h-10 bg-gray-700 rounded-full overflow-hidden">
          <div class="${valueClass} h-full transition-all duration-500" style="width: ${Math.min(bestValue * 120 + 40, 100)}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
            ${market} ${valuePercent}% Value
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
