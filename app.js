// app.js — Stable Frontend v2 (Echte Quoten via Server.js)

const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");

dateInput.value = new Date().toISOString().slice(0, 10);

refreshBtn.addEventListener("click", loadMatches);

async function loadMatches() {
  const date = dateInput.value;
  statusDiv.textContent = "Lade Spiele & Quoten...";

  try {
    const [fixturesRes, oddsRes] = await Promise.all([
      fetch(`/fixtures?date=${date}`),
      fetch(`/odds?date=${date}`)
    ]);

    const fixtures = await fixturesRes.json();
    const odds = await oddsRes.json();

    matchList.innerHTML = "";
    let count = 0;

    for (const g of fixtures.response) {
      const home = g.teams.home.name;
      const away = g.teams.away.name;
      const key = `${home} vs ${away}`;
      const gameOdds = odds[key];

      if (!gameOdds) continue;

      const card = document.createElement("div");
      card.className = "match-card";
      card.innerHTML = `
        <div class="match-header">
          <strong>${home}</strong> vs <strong>${away}</strong>
          <div class="league">${g.league.name}</div>
        </div>
        <div class="odds">
          <div>🏠 ${gameOdds.home?.toFixed(2) || "-"} | 🤝 ${gameOdds.draw?.toFixed(2) || "-"} | 🚗 ${gameOdds.away?.toFixed(2) || "-"}</div>
          <div>Over 2.5: ${gameOdds.over25?.toFixed(2) || "-"} | BTTS: ${gameOdds.bttsYes?.toFixed(2) || "-"}</div>
        </div>
      `;
      matchList.appendChild(card);
      count++;
    }

    statusDiv.textContent = count > 0 ? `${count} Spiele geladen ✅` : "Keine Spiele gefunden 😕";
  } catch (err) {
    console.error(err);
    statusDiv.textContent = "Fehler beim Laden!";
  }
}

loadMatches();
