const API_BASE = "/api/games";

const leagueSelect = document.getElementById("leagueSelect");
const gamesContainer = document.getElementById("games");
const topContainer = document.getElementById("topContainer");
const loader = document.getElementById("loader");

async function loadGames() {
  loader.style.display = "block";
  gamesContainer.innerHTML = "";
  topContainer.innerHTML = "";

  const selected = Array.from(leagueSelect.selectedOptions).map(o => o.value);
  const leagueParam = selected.length ? `?leagues=${selected.join(",")}` : "";
  const url = `${API_BASE}${leagueParam}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("API Fehler");
    const data = await res.json();
    renderGames(data.response);
    renderTopLists(data);
  } catch (e) {
    gamesContainer.innerHTML = `<div class='error'>Fehler: ${e.message}</div>`;
  } finally {
    loader.style.display = "none";
  }
}

function renderGames(games) {
  if (!games || !games.length) {
    gamesContainer.innerHTML = "<p>Keine Spiele gefunden.</p>";
    return;
  }

  gamesContainer.innerHTML = games.map(g => {
    const valueClass = g.bestValue > 0.1 ? "bg-green-100 border-green-400" : "";
    const probHome = (g.probs.home * 100).toFixed(1);
    const probDraw = (g.probs.draw * 100).toFixed(1);
    const probAway = (g.probs.away * 100).toFixed(1);
    const bttsYes = (g.btts * 100).toFixed(1);
    const over25 = (g.over25 * 100).toFixed(1);

    return `
      <div class="game-card p-4 rounded-2xl shadow-md mb-3 bg-white/80 border ${valueClass}">
        <div class="flex justify-between items-center mb-1">
          <div class="font-semibold">${g.home} vs ${g.away}</div>
          <div class="text-sm text-gray-500">${g.league}</div>
        </div>
        <div class="text-xs text-gray-500 mb-1">Start: ${new Date(g.commence_time).toLocaleString()}</div>
        <div class="grid grid-cols-3 gap-1 text-sm">
          <div>🏠 <b>${probHome}%</b> (${g.odds.home.toFixed(2)})</div>
          <div>🤝 <b>${probDraw}%</b> (${g.odds.draw.toFixed(2)})</div>
          <div>🚀 <b>${probAway}%</b> (${g.odds.away.toFixed(2)})</div>
        </div>
        <div class="grid grid-cols-2 gap-1 text-xs mt-1">
          <div>Over 2.5: <b>${over25}%</b> (${g.odds.over25})</div>
          <div>BTTS: <b>${bttsYes}%</b> (${g.odds.bttsYes || "-"})</div>
        </div>
        <div class="text-sm mt-1"><b>Tendenz:</b> ${g.tendenz}</div>
        <div class="text-xs text-gray-600 mt-1">
          XG: ${g.homeXG} – ${g.awayXG}
        </div>
        <div class="text-xs mt-1">
          <b>Value:</b> ${g.bestMarket.toUpperCase()} 
          (${(g.bestValue * 100).toFixed(1)}%)
        </div>
      </div>
    `;
  }).join("");
}

function renderTopLists(data) {
  const { top7, topOver25, topBTTS } = data;

  const section = (title, items, key) => `
    <div class="bg-white/90 rounded-2xl shadow-md p-3 mb-3">
      <h2 class="font-bold text-base mb-2">${title}</h2>
      ${!items?.length ? "<p class='text-sm text-gray-400'>Keine Daten</p>" :
        items.map((g, i) => `
          <div class="text-sm border-b border-gray-200 py-1">
            <span class="font-semibold">${i + 1}. ${g.home} – ${g.away}</span>
            <span class="block text-xs text-gray-600">
              ${key === "over25" ? `Over 2.5: ${(g.over25 * 100).toFixed(1)}%` :
              key === "btts" ? `BTTS Ja: ${(g.btts * 100).toFixed(1)}%` :
              `${g.tendenz}`}
            </span>
          </div>
        `).join("")
      }
    </div>
  `;

  topContainer.innerHTML = `
    ${section("Top 7 – höchste Wahrscheinlichkeit", top7)}
    ${section("Top 5 Over 2.5", topOver25, "over25")}
    ${section("Top 5 BTTS", topBTTS, "btts")}
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  loadGames();
  leagueSelect.addEventListener("change", loadGames);
});
