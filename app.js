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

  if (!date) return (statusDiv.textContent = "Bitte Datum wählen!");
  if (leagues.length === 0) return (statusDiv.textContent = "Bitte mindestens eine Liga wählen!");

  statusDiv.textContent = "Lade Spiele...";
  matchList.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}&leagues=${leagues.join(",")}`);
    const { response: games } = await res.json();

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele gefunden.";
      return;
    }

    // Top-7 nach Trefferwahrscheinlichkeit
    const top7 = [...games]
      .map(g => {
        const best =
          g.prob.home > g.prob.away && g.prob.home > g.prob.draw
            ? { type: "1", val: g.prob.home }
            : g.prob.away > g.prob.home && g.prob.away > g.prob.draw
            ? { type: "2", val: g.prob.away }
            : { type: "X", val: g.prob.draw };
        return { ...g, best };
      })
      .sort((a, b) => b.best.val - a.best.val)
      .slice(0, 7);

    const topSection = document.createElement("div");
    topSection.className = "top-section mb-4";
    topSection.innerHTML = `<h2>🏅 Top 7 Siegwahrscheinlichkeiten</h2>
      <ul>${top7
        .map(g => `<li>${g.home} vs ${g.away} → Tipp <b>${g.best.type}</b> mit ${(g.best.val*100).toFixed(1)}%</li>`)
        .join("")}</ul>`;
    matchList.appendChild(topSection);

    // Top-5 nach Value
    const top5ValueGames = [...games]
      .map(g => {
        const maxValue = Math.max(g.value.home, g.value.draw, g.value.away, g.value.over25, g.value.btts);
        return { ...g, maxValue };
      })
      .sort((a, b) => b.maxValue - a.maxValue)
      .slice(0, 5);

    games.forEach(g => {
      const card = document.createElement("div");
      card.className = "match-card p-4 mb-4 rounded shadow";

      if (top5ValueGames.includes(g)) {
        card.style.borderLeft = "5px solid #e1b12c";
        card.style.boxShadow = "0 4px 20px rgba(225,177,44,0.3)";
      }

      const homeVal = g.prob.home * 100;
      const drawVal = g.prob.draw * 100;
      const awayVal = g.prob.away * 100;
      const overVal = g.prob.over25 * 100;
      const bttsVal = g.prob.btts * 100;

      let trend =
        homeVal > awayVal && homeVal > drawVal ? "Heimsieg" :
        awayVal > homeVal && awayVal > drawVal ? "Auswärtssieg" : "Unentschieden";
      const trendOver = overVal > 50 ? "Over 2.5" : "Under 2.5";
      const trendBTTS = bttsVal > 50 ? "BTTS: JA" : "BTTS: NEIN";

      const bestChance = Math.max(homeVal, drawVal, awayVal, overVal, bttsVal);
      const bestMarket =
        bestChance === homeVal ? "1" :
        bestChance === drawVal ? "X" :
        bestChance === awayVal ? "2" :
        bestChance === overVal ? "Over 2.5" : "BTTS Ja";

      card.innerHTML = `
        <div class="flex justify-between items-center mb-2">
          <div class="flex items-center gap-2">
            <img src="${g.homeLogo}" alt="${g.home}" class="w-8 h-8 rounded-full"/>
            <div>
              <div class="font-bold">${g.home}</div>
              <div class="text-xs text-gray-500">${g.homeXG} xG</div>
            </div>
          </div>
          <span class="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">${g.league}</span>
          <div class="flex items-center gap-2 text-right">
            <div>
              <div class="font-bold">${g.away}</div>
              <div class="text-xs text-gray-500">${g.awayXG} xG</div>
            </div>
            <img src="${g.awayLogo}" alt="${g.away}" class="w-8 h-8 rounded-full"/>
          </div>
        </div>

        <div class="text-amber-700 text-sm mb-2">
          1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}
        </div>

        <div class="bar-container mb-2 relative h-5 bg-gray-300 rounded overflow-hidden">
          <div class="absolute left-0 top-0 h-full bg-green-500" style="width:${homeVal}%"></div>
          <div class="absolute left-0 top-0 h-full bg-yellow-400" style="width:${drawVal}%"></div>
          <div class="absolute left-0 top-0 h-full bg-red-500" style="width:${awayVal}%"></div>
          <span class="absolute inset-0 flex justify-center items-center text-xs font-bold text-white">
            1:${homeVal.toFixed(1)}% | X:${drawVal.toFixed(1)}% | 2:${awayVal.toFixed(1)}%
          </span>
        </div>

        <div class="bar-container mb-2 relative h-5 bg-gray-300 rounded overflow-hidden">
          <div class="absolute left-0 top-0 h-full bg-green-500" style="width:${overVal}%"></div>
          <span class="absolute inset-0 flex justify-center items-center text-xs font-bold text-white">
            Over:${overVal.toFixed(1)}% | Under:${(100-overVal).toFixed(1)}%
          </span>
        </div>

        <div class="bar-container mb-2 relative h-5 bg-gray-300 rounded overflow-hidden">
          <div class="absolute left-0 top-0 h-full bg-green-500" style="width:${bttsVal}%"></div>
          <span class="absolute inset-0 flex justify-center items-center text-xs font-bold text-white">
            BTTS Ja:${bttsVal.toFixed(1)}% | Nein:${(100-bttsVal).toFixed(1)}%
          </span>
        </div>

        <div class="flex gap-2 mb-1 text-sm">
          <span class="font-semibold">Trend:</span>
          <span>${trend}</span>
          <span>${trendOver}</span>
          <span>${trendBTTS}</span>
        </div>

        <div class="text-center font-semibold text-blue-600">
          ${top5ValueGames.includes(g) ? "🏆 " : ""}Empfehlung: <span class="underline">${bestMarket}</span> (${bestChance.toFixed(1)}% Trefferchance)
        </div>
      `;

      matchList.appendChild(card);
    });

    statusDiv.textContent = `${games.length} Spiele geladen!`;
  } catch (err) {
    statusDiv.textContent = "Fehler: " + err.message;
    console.error(err);
  }
}
