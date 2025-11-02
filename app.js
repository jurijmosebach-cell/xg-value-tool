// -----------------------------
// xG Odds Dashboard Frontend (v2)
// -----------------------------

const API_URL = "/api/games";

// Initialer Abruf
document.addEventListener("DOMContentLoaded", async () => {
  await loadGames();
});

async function loadGames() {
  const matchList = document.getElementById("match-list");
  matchList.innerHTML = `<div class="loading">⚽ Daten werden geladen...</div>`;

  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    const games = data.response || [];

    if (!games.length) {
      matchList.innerHTML = `<p>Keine Spiele gefunden 😢</p>`;
      return;
    }

    renderGames(matchList, games);
  } catch (err) {
    console.error(err);
    matchList.innerHTML = `<p>❌ Fehler beim Laden der Daten.</p>`;
  }
}

function renderGames(matchList, games) {
  matchList.innerHTML = "";

  // -----------------------------
  // Tabellenüberschrift
  // -----------------------------
  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML = `
    <h1>📊 xG & Value Dashboard</h1>
    <p>Daten: <b>${new Date().toLocaleDateString()}</b></p>
  `;
  matchList.appendChild(header);

  // -----------------------------
  // Spieleliste
  // -----------------------------
  const gameContainer = document.createElement("div");
  gameContainer.className = "game-container";

  games.forEach((g) => {
    const el = document.createElement("div");
    el.className = "game-card";
    el.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="team">
          <img src="${g.homeLogo}" alt="${g.home}" />
          <span>${g.home}</span>
        </div>
        <div class="vs">vs</div>
        <div class="team">
          <img src="${g.awayLogo}" alt="${g.away}" />
          <span>${g.away}</span>
        </div>
      </div>

      <div class="league">${g.league}</div>

      <div class="xg-line">
        <small>xG (H/A):</small>
        <b>${g.homeXG} / ${g.awayXG}</b> — <small>Total:</small> <b>${g.totalXG}</b>
      </div>

      <div class="odds">
        <div><b>1</b> ${g.odds.home.toFixed(2)}</div>
        <div><b>X</b> ${g.odds.draw.toFixed(2)}</div>
        <div><b>2</b> ${g.odds.away.toFixed(2)}</div>
        <div><b>O2.5</b> ${g.odds.over25.toFixed(2)}</div>
      </div>

      <div class="prob">
        <small>1:</small> ${(g.prob.home * 100).toFixed(1)}% &nbsp;
        <small>X:</small> ${(g.prob.draw * 100).toFixed(1)}% &nbsp;
        <small>2:</small> ${(g.prob.away * 100).toFixed(1)}%<br>
        <small>O2.5:</small> ${(g.prob.over25 * 100).toFixed(1)}% &nbsp;
        <small>BTTS:</small> ${(g.prob.btts * 100).toFixed(1)}%
      </div>

      <div class="value">
        <small>Value:</small>
        1: ${formatValue(g.value.home)} |
        X: ${formatValue(g.value.draw)} |
        2: ${formatValue(g.value.away)} |
        O2.5: ${formatValue(g.value.over25)} |
        BTTS: ${formatValue(g.value.btts)}
      </div>
    `;
    gameContainer.appendChild(el);
  });

  matchList.appendChild(gameContainer);

  // -----------------------------
  // Top 5 Value Bets
  // -----------------------------
  const allValues = games
    .flatMap((g) => [
      { home: g.home, away: g.away, league: g.league, market: "1", val: g.value.home },
      { home: g.home, away: g.away, league: g.league, market: "X", val: g.value.draw },
      { home: g.home, away: g.away, league: g.league, market: "2", val: g.value.away },
      { home: g.home, away: g.away, league: g.league, market: "Over 2.5", val: g.value.over25 },
      { home: g.home, away: g.away, league: g.league, market: "BTTS", val: g.value.btts },
    ])
    .filter((v) => v.val > 0.03) // nur echte Value Bets
    .sort((a, b) => b.val - a.val)
    .slice(0, 5);

  const valueSection = document.createElement("div");
  valueSection.className = "top-section";
  valueSection.innerHTML = `
    <h2>💰 Top 5 Value Bets</h2>
    ${
      allValues.length
        ? `<ul>${allValues
            .map(
              (v) =>
                `<li><b>${v.market}</b> (${(v.val * 100).toFixed(1)}%) — ${v.home} vs ${v.away} <small>(${v.league})</small></li>`
            )
            .join("")}</ul>`
        : `<p>Keine Value Bets gefunden 🔍</p>`
    }
  `;
  matchList.appendChild(valueSection);
}

// -----------------------------
// Helfer
// -----------------------------
function formatValue(val) {
  const pct = (val * 100).toFixed(1);
  if (val > 0.03) return `<b class="text-green-600">+${pct}%</b>`;
  if (val < -0.05) return `<span class="text-red-500">${pct}%</span>`;
  return `${pct}%`;
}
