const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");
const leagueSelect = document.getElementById("league-select");

const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

refreshBtn.addEventListener("click", loadMatches);

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

  statusDiv.textContent = "Lade aktuelle Spiele...";
  matchList.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}&leagues=${leagues.join(",")}`);
    const { response: games } = await res.json();

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele für heute.";
      return;
    }

    statusDiv.innerHTML = `${games.length} aktuelle Spiele geladen!`;

    games.forEach(g => {
      const card = document.createElement("div");
      card.className = "bg-gray-100 rounded-xl p-5 shadow-xl border border-gray-300 mb-6";

      const homeVal = g.prob.home * 100;
      const drawVal = g.prob.draw * 100;
      const awayVal = g.prob.away * 100;
      const overVal = g.prob.over25 * 100;
      const bttsVal = g.prob.btts * 100;

      // Trend-Tendenzen bestimmen
      let trend =
        homeVal > awayVal && homeVal > drawVal
          ? "Heimsieg"
          : awayVal > homeVal && awayVal > drawVal
          ? "Auswärtssieg"
          : "Unentschieden";
      const trendOver = overVal > 50 ? "Over 2.5" : "Under 2.5";
      const trendBTTS = bttsVal > 50 ? "BTTS: JA" : "BTTS: NEIN";

      const bestChance = Math.max(homeVal, drawVal, awayVal, overVal, bttsVal);
      const bestMarket =
        bestChance === homeVal
          ? "1"
          : bestChance === drawVal
          ? "X"
          : bestChance === awayVal
          ? "2"
          : bestChance === overVal
          ? "Over 2.5"
          : "BTTS Ja";

      card.innerHTML = `
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-3">
            <img src="${g.homeLogo}" class="w-10 h-10 rounded-full" alt="${g.home}" />
            <div>
              <div class="font-bold text-lg">${g.home}</div>
              <div class="text-xs text-gray-500">${g.homeXG} xG</div>
            </div>
          </div>
          <span class="text-xs bg-blue-200 text-blue-800 px-3 py-1 rounded-full">${g.league}</span>
          <div class="flex items-center gap-3 text-right">
            <div>
              <div class="font-bold text-lg">${g.away}</div>
              <div class="text-xs text-gray-500">${g.awayXG} xG</div>
            </div>
            <img src="${g.awayLogo}" class="w-10 h-10 rounded-full" alt="${g.away}" />
          </div>
        </div>

        <div class="text-sm mb-2 text-gray-700">
          Gesamt-xG: ${g.totalXG.toFixed(2)}
        </div>

        <div class="text-amber-700 text-sm mb-2">
          1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}
        </div>

        <div class="text-sm mb-2 text-gray-600">
          Over 2.5: ${g.odds.over25 ? g.odds.over25.toFixed(2) : "-"} | BTTS: ${g.prob.btts ? bttsVal.toFixed(1) + "%" : "-"}
        </div>

        <div class="relative h-6 rounded-full overflow-hidden mb-2 bg-gray-300">
          <div class="absolute h-full left-0 top-0 transition-all duration-1000 bg-green-500" style="width: ${homeVal}%"></div>
          <div class="absolute h-full left-${homeVal}% top-0 transition-all duration-1000 bg-yellow-400" style="width: ${drawVal}%"></div>
          <div class="absolute h-full left-${homeVal + drawVal}% top-0 transition-all duration-1000 bg-red-500" style="width: ${awayVal}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
            1:${homeVal.toFixed(1)}% | X:${drawVal.toFixed(1)}% | 2:${awayVal.toFixed(1)}%
          </span>
        </div>

        <div class="relative h-6 rounded-full overflow-hidden mb-2 bg-gray-300">
          <div class="absolute h-full left-0 top-0 transition-all duration-1000 bg-blue-500" style="width: ${overVal}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
            Over:${overVal.toFixed(1)}% | Under:${(100 - overVal).toFixed(1)}%
          </span>
        </div>

        <div class="relative h-6 rounded-full overflow-hidden mb-2 bg-gray-300">
          <div class="absolute h-full left-0 top-0 transition-all duration-1000 bg-pink-500" style="width: ${bttsVal}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
            BTTS Ja:${bttsVal.toFixed(1)}% | Nein:${(100 - bttsVal).toFixed(1)}%
          </span>
        </div>

        <div class="flex gap-3 mt-2 text-sm">
          <span class="px-2 py-1 bg-green-100 rounded">${trend}</span>
          <span class="px-2 py-1 bg-blue-100 rounded">${trendOver}</span>
          <span class="px-2 py-1 bg-pink-100 rounded">${trendBTTS}</span>
        </div>

        <div class="text-center mt-3 font-semibold text-blue-600">
          👉 Empfehlung: <span class="underline">${bestMarket}</span> (${bestChance.toFixed(1)}% Trefferchance)
        </div>
      `;

      matchList.appendChild(card);
    });
  } catch (err) {
    statusDiv.textContent = "Fehler: " + err.message;
    console.error(err);
  }
}
