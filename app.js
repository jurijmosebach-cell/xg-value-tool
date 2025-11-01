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
    const data = await res.json();
    const games = data.response; // alle Spiele

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele gefunden.";
      return;
    }

    // --------------------------
    // Top 7 nach Siegwahrscheinlichkeit
    // --------------------------
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
        .map(
          g => `<li>${g.home} vs ${g.away} → Tipp <b>${g.best.type}</b> (${(g.best.val * 100).toFixed(1)}%)</li>`
        )
        .join("")}</ul>`;
    matchList.appendChild(topSection);

    // --------------------------
    // Top 5 Value / Over 2.5 / BTTS
    // --------------------------
    function renderTop5(title, list) {
      if (!list || list.length === 0) return "";
      return `<h3>${title}</h3><ul>${list
        .map(
          g => `<li>${g.home} vs ${g.away} → ${g.bestValueMarket} (${(g.prob).toFixed(1)}% Trefferchance, Value: ${g.value.toFixed(2)})</li>`
        )
        .join("")}</ul>`;
    }

    const topValueHome = data.topByValue.home || [];
    const topValueDraw = data.topByValue.draw || [];
    const topValueOver = data.topByValue.over25 || [];
    const topValueBTTS = data.topByValue.btts || [];

    const topValueSection = document.createElement("div");
    topValueSection.className = "top-value-section mb-4";
    topValueSection.innerHTML =
      renderTop5("🔥 Top 5 Value Heimsieg", topValueHome) +
      renderTop5("🔥 Top 5 Value Unentschieden", topValueDraw) +
      renderTop5("🔥 Top 5 Value Over 2.5", topValueOver) +
      renderTop5("🔥 Top 5 Value BTTS", topValueBTTS);
    matchList.appendChild(topValueSection);

    // --------------------------
    // Alle Spiele rendern
    // --------------------------
    games.forEach(g => {
      const card = document.createElement("div");
      card.className = "match-card mb-4 p-3 border rounded bg-white shadow-sm";

      const homeVal = g.prob.home * 100;
      const drawVal = g.prob.draw * 100;
      const awayVal = g.prob.away * 100;
      const overVal = g.prob.over25 * 100;
      const bttsVal = g.prob.btts * 100;

      // Tendenz
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
        <div class="match-header flex justify-between items-center mb-2">
          <div class="team flex items-center gap-2">
            <img src="${g.homeLogo}" alt="${g.home}" class="w-10 h-8" />
            <div>
              <div class="team-name font-semibold">${g.home}</div>
              <div class="team-xg text-xs text-gray-600">${g.homeXG} xG</div>
            </div>
          </div>
          <span class="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">${g.league}</span>
          <div class="team flex items-center gap-2">
            <div>
              <div class="team-name font-semibold text-right">${g.away}</div>
              <div class="team-xg text-xs text-gray-600 text-right">${g.awayXG} xG</div>
            </div>
            <img src="${g.awayLogo}" alt="${g.away}" class="w-10 h-8" />
          </div>
        </div>

        <div class="text-amber-700 text-sm mb-2">
          1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}
        </div>

        <div class="bar-container mb-2 relative h-4 bg-gray-200 rounded">
          <div class="bar-fill bg-green-500 h-4" style="width:${homeVal}%"></div>
          <div class="bar-fill bg-yellow-500 h-4 absolute left-0" style="width:${drawVal}%"></div>
          <div class="bar-fill bg-red-500 h-4 absolute left-0" style="width:${awayVal}%"></div>
          <div class="bar-text text-xs absolute top-0 left-2">${homeVal.toFixed(1)}% | ${drawVal.toFixed(1)}% | ${awayVal.toFixed(1)}%</div>
        </div>

        <div class="bar-container mb-2 relative h-4 bg-gray-200 rounded">
          <div class="bar-fill bg-blue-500 h-4" style="width:${overVal}%"></div>
          <div class="bar-text text-xs absolute top-0 left-2">Over:${overVal.toFixed(1)}% | Under:${(100 - overVal).toFixed(1)}%</div>
        </div>

        <div class="bar-container mb-2 relative h-4 bg-gray-200 rounded">
          <div class="bar-fill bg-purple-500 h-4" style="width:${bttsVal}%"></div>
          <div class="bar-text text-xs absolute top-0 left-2">BTTS Ja:${bttsVal.toFixed(1)}% | Nein:${(100 - bttsVal).toFixed(1)}%</div>
        </div>

        <div class="trend flex gap-2 mt-2">
          <span class="trend-home text-green-700 font-semibold">${trend}</span>
          <span class="trend-over text-blue-700 font-semibold">${trendOver}</span>
          <span class="trend-btts text-purple-700 font-semibold">${trendBTTS}</span>
        </div>

        <div class="text-center mt-3 font-semibold text-blue-600">
          👉 Empfehlung: <span class="underline">${bestMarket}</span> (${bestChance.toFixed(1)}% Trefferchance)
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
