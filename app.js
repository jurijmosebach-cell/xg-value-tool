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
    const { response: games, topByProb, topByValue } = await res.json();

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele gefunden.";
      return;
    }

    // -----------------------------
    // Top 7 nach Trefferwahrscheinlichkeit
    // -----------------------------
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
    topSection.className = "top-section mb-6";
    topSection.innerHTML = `<h2 class="text-xl font-bold mb-2">🏅 Top 7 Siegwahrscheinlichkeiten</h2>
      <ul>${top7
        .map(
          g =>
            `<li>${g.home} vs ${g.away} → Tipp <b>${g.best.type}</b> mit ${(g.best.val * 100).toFixed(1)}%</li>`
        )
        .join("")}</ul>`;
    matchList.appendChild(topSection);

    // -----------------------------
    // Top 5 Value-Listen
    // -----------------------------
    const createTopValueSection = (title, arr) => {
      const section = document.createElement("div");
      section.className = "top-value-section mb-6";
      section.innerHTML = `<h2 class="text-lg font-semibold mb-1">${title}</h2>
        <ul>${arr
          .map(
            g =>
              `<li>${g.home} vs ${g.away} → Markt: <b>${g.bestValueMarket}</b>, Value: ${g.bestValueAmount.toFixed(
                2
              )}, Trefferwahrscheinlichkeit: ${g.prob.toFixed(1)}%</li>`
          )
          .join("")}</ul>`;
      return section;
    };

    matchList.appendChild(createTopValueSection("💰 Top 5 Value 1X2", [
      ...topByValue.home,
      ...topByValue.draw,
      ...topByValue.away,
    ].sort((a,b)=>b.value-a.value).slice(0,5)));

    matchList.appendChild(createTopValueSection("💰 Top 5 Value Over 2.5", topByValue.over25));
    matchList.appendChild(createTopValueSection("💰 Top 5 Value BTTS", topByValue.btts));

    // -----------------------------
    // Spiele-Karten
    // -----------------------------
    games.forEach(g => {
      const card = document.createElement("div");
      card.className = "match-card p-4 mb-4 bg-white rounded shadow";

      const homeVal = g.prob.home * 100;
      const drawVal = g.prob.draw * 100;
      const awayVal = g.prob.away * 100;
      const overVal = g.prob.over25 * 100;
      const bttsVal = g.prob.btts * 100;

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
        <div class="match-header flex justify-between items-center mb-3">
          <div class="team flex items-center gap-2">
            <img src="${g.homeLogo}" alt="${g.home}" class="w-10 h-8"/>
            <div>
              <div class="font-semibold">${g.home}</div>
              <div class="text-sm text-gray-500">${g.homeXG} xG</div>
            </div>
          </div>

          <span class="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">${g.league}</span>

          <div class="team flex items-center gap-2">
            <div class="text-right">
              <div class="font-semibold">${g.away}</div>
              <div class="text-sm text-gray-500">${g.awayXG} xG</div>
            </div>
            <img src="${g.awayLogo}" alt="${g.away}" class="w-10 h-8"/>
          </div>
        </div>

        <div class="mb-2 text-sm text-amber-700">
          1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}
        </div>

        <div class="bar-container mb-2 flex gap-1">
          <div class="bar-fill bg-green-400 flex-1" style="height:10px; width:${homeVal}%"></div>
          <div class="bar-fill bg-yellow-300 flex-1" style="height:10px; width:${drawVal}%"></div>
          <div class="bar-fill bg-red-400 flex-1" style="height:10px; width:${awayVal}%"></div>
        </div>
        <div class="bar-text text-xs mb-2">1:${homeVal.toFixed(1)}% | X:${drawVal.toFixed(1)}% | 2:${awayVal.toFixed(1)}%</div>

        <div class="bar-container mb-2">
          <div class="bar-fill bg-blue-400" style="width:${overVal}%"></div>
          <div class="bar-text text-xs">Over:${overVal.toFixed(1)}% | Under:${(100-overVal).toFixed(1)}%</div>
        </div>

        <div class="bar-container mb-2">
          <div class="bar-fill bg-purple-400" style="width:${bttsVal}%"></div>
          <div class="bar-text text-xs">BTTS Ja:${bttsVal.toFixed(1)}% | Nein:${(100-bttsVal).toFixed(1)}%</div>
        </div>

        <div class="trend flex gap-2 mt-2">
          <span class="px-2 py-1 rounded bg-green-200">${trend}</span>
          <span class="px-2 py-1 rounded bg-blue-200">${trendOver}</span>
          <span class="px-2 py-1 rounded bg-purple-200">${trendBTTS}</span>
        </div>

        <div class="text-center mt-2 font-semibold text-blue-600">
          Empfehlung: <span class="underline">${bestMarket}</span> (${bestChance.toFixed(1)}% Trefferchance)
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
