// app.js — Frontend für Fixtures + Odds + Torschützen
const apiBase = ""; // Render oder lokal: leer lassen (gleiche Domain)

document.addEventListener("DOMContentLoaded", async () => {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("dateInput").value = today;
  await loadData(today);
});

document.getElementById("dateInput").addEventListener("change", (e) => {
  loadData(e.target.value);
});

async function loadData(date) {
  const container = document.getElementById("fixturesContainer");
  container.innerHTML = "<p>⏳ Lade Spiele und Quoten...</p>";

  try {
    const [fixturesRes, oddsRes] = await Promise.all([
      fetch(`${apiBase}/fixtures?date=${date}`),
      fetch(`${apiBase}/odds?date=${date}`)
    ]);

    const fixturesData = await fixturesRes.json();
    const oddsData = await oddsRes.json();

    if (!fixturesData.response || fixturesData.response.length === 0) {
      container.innerHTML = "<p>❌ Keine Spiele gefunden.</p>";
      return;
    }

    container.innerHTML = "";

    fixturesData.response.forEach(fix => {
      const home = fix.teams.home.name;
      const away = fix.teams.away.name;
      const matchKey = `${home} vs ${away}`;
      const odds = oddsData[matchKey] || null;

      const matchEl = document.createElement("div");
      matchEl.className = "match-card";

      const date = new Date(fix.fixture.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      matchEl.innerHTML = `
        <h3>${home} vs ${away}</h3>
        <p class="time">🕒 ${date}</p>
        ${renderOdds(odds)}
      `;

      container.appendChild(matchEl);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = `<p>🔥 Fehler beim Laden: ${err.message}</p>`;
  }
}

function renderOdds(odds) {
  if (!odds) return `<p class="no-odds">Keine Quoten verfügbar</p>`;

  const valueCheck = (odd) => odd > 2.0 ? "value" : "";

  const topScorersHtml = odds.topScorers?.length
    ? `
      <div class="scorers">
        <h4>⚽ Torschützen-Wetten:</h4>
        <ul>
          ${odds.topScorers.map(s => `
            <li><b>${s.player}</b>: <span class="${valueCheck(s.odds)}">${s.odds.toFixed(2)}</span></li>
          `).join("")}
        </ul>
      </div>
    `
    : "";

  return `
    <div class="odds">
      <div>🏠 Sieg Heim: <span class="${valueCheck(odds.home)}">${odds.home?.toFixed(2) || "-"}</span></div>
      <div>🚗 Sieg Auswärts: <span class="${valueCheck(odds.away)}">${odds.away?.toFixed(2) || "-"}</span></div>
      <div>⬆️ Über 2.5: <span class="${valueCheck(odds.over25)}">${odds.over25?.toFixed(2) || "-"}</span></div>
      <div>⬇️ Unter 2.5: <span class="${valueCheck(odds.under25)}">${odds.under25?.toFixed(2) || "-"}</span></div>
      <div>🤝 Beide treffen (Ja): <span class="${valueCheck(odds.bttsYes)}">${odds.bttsYes?.toFixed(2) || "-"}</span></div>
      <div>🚫 Beide treffen (Nein): <span class="${valueCheck(odds.bttsNo)}">${odds.bttsNo?.toFixed(2) || "-"}</span></div>
      ${topScorersHtml}
    </div>
  `;
}
