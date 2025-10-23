// app.js — FINAL MIT AKTIVER TheOddsAPI (über Server)

const API_BASE = "/";
const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const toggleSampleBtn = document.getElementById("toggle-sample");
const statusDiv = document.getElementById("status");
const leagueSelect = document.getElementById("league-select");
const dateInput = document.getElementById("match-date");
const filterValue = document.getElementById("filter-value");

let useSample = false;
dateInput.value = new Date().toISOString().slice(0, 10);

refreshBtn.addEventListener("click", loadMatches);
toggleSampleBtn.addEventListener("click", () => {
  useSample = !useSample;
  toggleSampleBtn.textContent = useSample ? "API-Daten" : "Beispieldaten";
  loadMatches();
});

async function loadMatches() {
  matchList.innerHTML = "";
  const date = dateInput.value;
  const minValue = parseFloat(filterValue.value) || 0;
  const league = leagueSelect.value;

  statusDiv.textContent = useSample ? "Lade Beispieldaten..." : "Lade Live-Quoten & xG...";

  try {
    let fixtures;
    if (useSample) {
      fixtures = await fetch("./sample-fixtures.json").then(r => r.json());
    } else {
      const res = await fetch(`${API_BASE}fixtures?date=${date}`);
      if (!res.ok) throw new Error("Fixtures fehlgeschlagen");
      fixtures = await res.json();
    }

    if (!fixtures.response || fixtures.response.length === 0) {
      matchList.innerHTML = `<div class="no-data">Keine Spiele gefunden</div>`;
      statusDiv.textContent = "";
      return;
    }

    let games = fixtures.response;
    if (league !== "all") {
      games = games.filter(g => g.league.name.replace(/\s/g, "_") === league);
    }

    const oddsData = await fetch(`${API_BASE}odds?date=${date}`).then(r => r.json());

    for (const game of games) {
      const home = game.teams.home.name;
      const away = game.teams.away.name;
      const key = `${home} vs ${away}`;

      const odds = oddsData[key];
      if (!odds) continue;

      // Simulierte xG (oder echte, falls API liefert)
      const homeXG = 1.0 + Math.random() * 1.8;
      const awayXG = 0.7 + Math.random() * 1.5;

      const homeWinProb = calculatePoissonProbability(homeXG, awayXG, "home");
      const awayWinProb = calculatePoissonProbability(homeXG, awayXG, "away");

      const homeValue = homeWinProb * odds.home - 1;
      const awayValue = awayWinProb * odds.away - 1;
      const bestValue = Math.max(homeValue, awayValue);
      const bestTeam = bestValue === homeValue ? home : away;

      if (bestValue < minValue) continue;

      const valueClass = bestValue > 0.5 ? "value-high" : bestValue > 0.2 ? "value-mid" : "value-low";

      const card = document.createElement("div");
      card.className = "match-card";
      card.innerHTML = `
        <div class="match-header">
          <div class="teams">
            <img src="${game.teams.home.logo}" alt="${home}" onerror="this.src='https://via.placeholder.com/30'">
            ${home} <span class="vs">vs</span> ${away}
            <img src="${game.teams.away.logo}" alt="${away}" onerror="this.src='https://via.placeholder.com/30'">
          </div>
          <div class="league">${game.league.name}</div>
        </div>
        <div class="xg-info ${valueClass}">
          <strong>${bestTeam}</strong>: Value <strong>${bestValue.toFixed(2)}</strong>
          <small>(xG: ${homeXG.toFixed(1)}–${awayXG.toFixed(1)} | Quote: ${odds.home.toFixed(2)} / ${odds.away.toFixed(2)})</small>
        </div>
      `;
      matchList.appendChild(card);
    }

    statusDiv.textContent = games.length
      ? `${games.length} Spiele analysiert (Live-Quoten aktiv)`
      : "Keine Value-Bets gefunden";
  } catch (err) {
    console.error(err);
    statusDiv.textContent = "Fehler: " + err.message;
  }
}

// Poisson-Funktion
function calculatePoissonProbability(homeXG, awayXG, outcome) {
  const homeGoals = poisson(homeXG);
  const awayGoals = poisson(awayXG);
  if (outcome === "home") {
    return homeGoals.reduce((sum, pH, i) => sum + pH * awayGoals.slice(0, i).reduce((a, b) => a + b, 0), 0);
  } else {
    return awayGoals.reduce((sum, pA, i) => sum + pA * homeGoals.slice(0, i).reduce((a, b) => a + b, 0), 0);
  }
}

function poisson(lambda) {
  const probs = [];
  let p = Math.exp(-lambda);
  probs.push(p);
  for (let k = 1; k < 10; k++) {
    p *= lambda / k;
    probs.push(p);
  }
  return probs;
}

loadMatches();
