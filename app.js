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

  statusDiv.textContent = "⏳ Lade Spiele...";
  matchList.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}&leagues=${leagues.join(",")}`);
    const data = await res.json();
    const games = data.response || [];

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele gefunden.";
      return;
    }

    // ============= TOP LISTEN =============
    const topSection = document.createElement("div");
    topSection.className = "top-section mb-6 p-4 bg-white/70 rounded-xl shadow";

    function renderTopList(title, list, key) {
      return `
        <div class="mb-4">
          <h3 class="font-semibold text-blue-800 mb-1">${title}</h3>
          <ul class="list-disc list-inside text-sm">
            ${list
              .map(
                g =>
                  `<li><b>${g.home}</b> vs <b>${g.away}</b> – ${(
                    g.prob
                  ).toFixed(1)}% (${g.league}) ${
                    g.isValue ? "<span class='text-green-600 font-semibold'>🔥 Value</span>" : ""
                  }</li>`
              )
              .join("")}
          </ul>
        </div>`;
    }

    const tp = data.topByProb;
    const tv = data.topByValue;
    topSection.innerHTML = `
      <h2 class="text-xl font-bold text-center mb-3">🏅 Top 5 Spiele</h2>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="bg-blue-50 p-3 rounded-xl">
          <h3 class="text-blue-700 font-semibold mb-2">Nach Wahrscheinlichkeit</h3>
          ${renderTopList("🏠 Heimsieg", tp.home, "prob.home")}
          ${renderTopList("⚽ Over 2.5", tp.over25, "prob.over25")}
          ${renderTopList("🤝 BTTS", tp.btts, "prob.btts")}
        </div>
        <div class="bg-green-50 p-3 rounded-xl">
          <h3 class="text-green-700 font-semibold mb-2">Nach Value</h3>
          ${renderTopList("🏠 Heimsieg", tv.home, "value.home")}
          ${renderTopList("⚽ Over 2.5", tv.over25, "value.over25")}
          ${renderTopList("🤝 BTTS", tv.btts, "value.btts")}
        </div>
      </div>`;
    matchList.appendChild(topSection);

    // ============= SPIELKARTEN =============
    games.forEach(g => {
      const card = document.createElement("div");
      card.className =
        "match-card bg-white/80 border rounded-2xl shadow p-4 mb-4 hover:shadow-md transition " +
        (g.isValue ? "border-green-500 ring-2 ring-green-300" : "border-gray-300");

      const homeVal = (g.prob.home * 100).toFixed(1);
      const drawVal = (g.prob.draw * 100).toFixed(1);
      const awayVal = (g.prob.away * 100).toFixed(1);
      const overVal = (g.prob.over25 * 100).toFixed(1);
      const bttsVal = (g.prob.btts * 100).toFixed(1);

      const bestValueText = g.isValue
        ? `<div class="text-center mt-2 font-semibold text-green-600">🔥 Value auf <span class="underline">${g.bestValueMarket.toUpperCase()}</span> (+${(
            g.bestValueAmount * 100
          ).toFixed(1)}%)</div>`
        : "";

      card.innerHTML = `
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-2">
            <img src="${g.homeLogo}" alt="${g.home}" class="w-10 h-8 rounded" />
            <div>
              <div class="font-semibold">${g.home}</div>
              <div class="text-xs text-gray-600">${g.homeXG} xG</div>
            </div>
          </div>

          <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">${g.league}</span>

          <div class="flex items-center gap-2 text-right">
            <div>
              <div class="font-semibold">${g.away}</div>
              <div class="text-xs text-gray-600">${g.awayXG} xG</div>
            </div>
            <img src="${g.awayLogo}" alt="${g.away}" class="w-10 h-8 rounded" />
          </div>
        </div>

        <div class="text-sm text-gray-700 mb-1">1: ${g.odds.home.toFixed(
          2
        )} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}</div>

        <div class="w-full bg-gray-200 h-4 rounded mb-2 relative">
          <div class="absolute left-0 top-0 h-4 bg-blue-400 rounded-l" style="width:${homeVal}%;"></div>
          <div class="absolute right-0 top-0 h-4 bg-red-400 rounded-r" style="width:${awayVal}%;"></div>
          <div class="absolute inset-0 flex items-center justify-center text-xs text-white font-semibold">
            1:${homeVal}% | X:${drawVal}% | 2:${awayVal}%
          </div>
        </div>

        <div class="text-xs text-gray-600">Over 2.5: ${overVal}% | BTTS: ${bttsVal}%</div>
        ${bestValueText}
      `;

      matchList.appendChild(card);
    });

    statusDiv.textContent = `${games.length} Spiele geladen ✅`;
  } catch (err) {
    statusDiv.textContent = "Fehler: " + err.message;
    console.error(err);
  }
}
