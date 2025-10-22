// app.js – ECHTER VALUE mit xG & Quoten

const API_BASE = "/";
const ODDS_API_KEY = "cfbf3f676af48fd8de8e099792bf1485"; // ← Später eintragen!

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
  toggleSampleBtn.textContent =.textContent = useSample ? "API-Daten" : "Beispieldaten";
  loadMatches();
});

async function loadMatches() {
  matchList.innerHTML = "";
  const date = dateInput.value;
  const minValue = parseFloat(filterValue.value) || 0;
  const league = leagueSelect.value;

  statusDiv.textContent = useSample ? "Lade Beispieldaten..." : "Lade xG & Quoten...";

  try {
    let fixtures;
    if (useSample) {
      fixtures = await fetch("./sample-fixtures.json").then(r => r.json());
    } else {
      const res = await fetch(`${API_BASE}fixtures?date=${date}`);
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

    // Lade Quoten (TheOddsAPI)
    const oddsData = await fetchOdds(date);

    for (const game of games) {
      const home = game.teams.home.name;
      const away = game.teams.away.name;
      const leagueName = game.league.name;

      // Simulierte xG-Werte (später echte API)
      const homeXG = 1.2 + Math.random() * 1.5;
      const awayXG = 0.8 + Math.random() * 1.2;

      // Poisson-Wahrscheinlichkeiten
      const homeWinProb = calculatePoissonProbability(homeXG, awayXG, "home");
      const awayWinProb = calculatePoissonProbability(homeXG, awayXG, "away");

      // Quoten holen
      const odds = oddsData[home + " vs " + away] || { home: 2.5, away: 3.0, draw: 3.4 };

      // Value berechnen
      const homeValue = (homeWinProb * odds.home) - 1;
      const awayValue = (awayWinProb * odds.away) - 1;

      const bestValue = Math.max(homeValue, awayValue);
      const bestTeam = bestValue === homeValue ? home : away;

      if (bestValue < minValue) continue;

      const valueClass = bestValue > 0.5 ? "value-high" : bestValue > 0.2 ? "value-mid" : "value-low";

      const card = document.createElement("div");
      card.className = "match-card";
      card.innerHTML = `
        <div class="match-header">
          <div class="teams">
            <img src="${game.teams.home.logo}" alt="${home}">
            ${home} vs ${away}
            <img src="${game.teams.away.logo}" alt="${away}">
          </div>
          <div class="league">${leagueName}</div>
        </div>
        <div class="xg-info ${valueClass}">
          <strong>${bestTeam}</strong>: Value <strong>${bestValue.toFixed(2)}</strong>
          <small>(xG: ${homeXG.toFixed(1)} – ${awayXG.toFixed(1)})</small>
        </div>
      `;
      matchList.appendChild(card);
    }

    statusDiv.textContent = games.length ? `${games.length} Spiele analysiert` : "Keine Value-Bets";
  } catch (err) {
    console.error(err);
    statusDiv.textContent = "Fehler beim Laden der Daten";
  }
}

// Poisson-Wahrscheinlichkeit
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

// Quoten laden (TheOddsAPI)
async function fetchOdds(date) {
  if (!ODDS_API_KEY || ODDS_API_KEY === "YOUR_ODDS_API_KEY_HERE") {
    return {}; // Fallback: keine Quoten
  }
  try {
    const res = await fetch(`https://api.the-odds-api.com/v4/sports/soccer_epl/odds/?apiKey=${ODDS_API_KEY}®ions=eu&date=${date}&markets=h2h`);
    const data = await res.json();
    const oddsMap = {};
    data.forEach(game => {
      const key = `${game.home_team} vs ${game.away_team}`;
      const site = game.bookmakers[0];
      oddsMap[key] = {
        home: site.markets[0].outcomes[0].price,
        away: site.markets[0].outcomes[1].price,
        draw: site.markets[0].outcomes[2]?.price || 3.4
      };
    });
    return oddsMap;
  } catch {
    return {};
  }
}

loadMatches();
