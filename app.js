const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");

dateInput.value = new Date().toISOString().slice(0, 10);
refreshBtn.addEventListener("click", loadMatches);

function showStatBox() {
  const stored = JSON.parse(localStorage.getItem('myValues') || "[]");
  const box = document.getElementById("statbox");
  box.textContent = stored.length ? ` ${stored.length} Value-Tipps gespeichert!` : "";
  box.className = stored.length ? "bg-purple-900 text-purple-300 px-3 py-1 rounded text-sm inline-block" : "";
}

async function loadMatches() {
  const date = dateInput.value;
  statusDiv.textContent = "Lade Top-Ligen...";

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const { response: games } = await res.json();

    matchList.innerHTML = "";
    let count = 0;

    for (const g of games) {
      const bestValue = Math.max(g.value.home, g.value.draw, g.value.away, g.value.over25, g.value.bttsYes);
      if (bestValue < 0.03) continue; // Nur echte Value

      const valuePercent = (bestValue * 100).toFixed(1);
      const valueClass = bestValue > 0.12 ? "bg-green-500" : bestValue > 0.05 ? "bg-yellow-500" : "bg-red-500";
      const market = bestValue === g.value.home ? "1" : bestValue === g.value.draw ? "X" : bestValue === g.value.away ? "2" : bestValue === g.value.over25 ? "O2.5" : "BTTS";

      const card = document.createElement("div");
      card.className = "bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700 hover:border-cyan-500 transition";
      card.innerHTML = `
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-3">
            <img src="${g.homeLogo}" class="w-10 h-10 rounded-full border-2 border-gray-600" alt="${g.home}"/>
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
            <img src="${g.awayLogo}" class="w-10 h-10 rounded-full border-2 border-gray-600" alt="${g.away}"/>
          </div>
        </div>

        <div class="text-amber-300 text-sm space-y-1 mb-3">
          <div>1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}</div>
          <div>Over 2.5: ${g.odds.over25.toFixed(2)} | BTTS: ${g.odds.bttsYes.toFixed(2)} | Gesamt xG: ${g.totalXG}</div>
        </div>

        <div class="relative h-8 bg-gray-700 rounded-full overflow-hidden mb-3">
          <div class="${valueClass}" style="width: ${Math.min(bestValue * 120 + 40, 100)}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white">
            ${market} ${valuePercent}% Value
          </span>
        </div>

        <button class="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-black font-bold py-2 rounded-lg hover:from-purple-600 hover:to-pink-600 hover:text-white transition">
          Tipp speichern
        </button>
      `;

      card.querySelector("button").onclick = () => {
        const stored = JSON.parse(localStorage.getItem('myValues') || "[]");
        stored.push({ date, ...g, bestValue, market });
        localStorage.setItem('myValues', JSON.stringify(stored));
        alert(`${g.home} vs ${g.away} – ${market} ${valuePercent}% gespeichert!`);
        showStatBox();
      };

      matchList.appendChild(card);
      count++;
    }

    statusDiv.textContent = count ? `${count} Value-Spiele gefunden` : "Keine Value heute";
    showStatBox();
  } catch (err) {
    statusDiv.textContent = "Fehler beim Laden";
    console.error(err);
  }
}

loadMatches();
