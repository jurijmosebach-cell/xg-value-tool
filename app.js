// app.js – Version für Render Deployment

const API_KEY = "c6a1d2120c71b17cca24284ab8a9873b4"; // ← TEST-KEY DIREKT IM CODE

const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const toggleSampleBtn = document.getElementById("toggle-sample");
const statusDiv = document.getElementById("status");
const leagueSelect = document.getElementById("league-select");
const dateInput = document.getElementById("match-date");
const filterValue = document.getElementById("filter-value");

let useSample = false;

// Standarddatum = Heute
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

  statusDiv.textContent = useSample
    ? "📁 Lade Beispieldaten..."
    : "⏳ Lade Spieldaten...";

  try {
    let fixtures;
    if (useSample) {
      fixtures = await fetch("./sample-fixtures.json").then((r) => r.json());
    } else {
      const res = await fetch(`${API_BASE}/fixtures?date=${date}`);
      fixtures = await res.json();
    }

    if (!fixtures.response || fixtures.response.length === 0) {
      matchList.innerHTML = `<div class="no-data">Keine Spiele gefunden</div>`;
      statusDiv.textContent = "";
      return;
    }

    // League filter
    let games = fixtures.response;
    if (league !== "all") {
      games = games.filter((g) => g.league.name.replace(/\s/g, "_") === league);
    }

    for (const g of games) {
      const home = g.teams.home;
      const away = g.teams.away;
      const leagueName = g.league.name;

      // Beispielhafte Value-Berechnung (xG-Simulation)
      const value = Math.random() * 2 - 1; // von -1 bis +1
      if (value < minValue) continue;

      const valueClass =
        value > 0.5
          ? "value-high"
          : value > 0.2
          ? "value-mid"
          : "value-low";

      const card = document.createElement("div");
      card.className = "match-card";
      card.innerHTML = `
        <div class="match-header">
          <div class="teams">
            <img src="${home.logo}" alt="${home.name}">
            ${home.name} vs ${away.name}
            <img src="${away.logo}" alt="${away.name}">
          </div>
          <div class="league">${leagueName}</div>
        </div>
        <div class="xg-info ${valueClass}">
          Value: ${(value).toFixed(2)}
        </div>
      `;
      matchList.appendChild(card);
    }

    statusDiv.textContent = games.length
      ? `✅ ${games.length} Spiele geladen`
      : "Keine Spiele mit passendem Value gefunden";
  } catch (err) {
    console.error(err);
    statusDiv.textContent = "❌ Fehler beim Laden der Daten";
  }
}

// Initial laden
loadMatches();
