// app.js — Frontend zur Anzeige der Odds + Values
const apiBase = window.location.origin;

async function loadOdds() {
  const date = document.getElementById("date").value;
  const body = document.getElementById("oddsTableBody");
  body.innerHTML = "<tr><td colspan='16'>⏳ Lade Daten...</td></tr>";

  try {
    const res = await fetch(`${apiBase}/odds?date=${date}`);
    const data = await res.json();
    body.innerHTML = "";

    if (!data || Object.keys(data).length === 0) {
      body.innerHTML = "<tr><td colspan='16'>❌ Keine Spiele gefunden.</td></tr>";
      return;
    }

    Object.values(data).forEach(g => {
      const v = g.value || {};
      const color = val =>
        val > 0.1 ? "text-green-600 font-bold" : val < -0.05 ? "text-red-600" : "text-gray-700";

      const row = `
        <tr class="border-b hover:bg-gray-50">
          <td class="p-2">${g.league}</td>
          <td class="p-2">${g.date}</td>
          <td class="p-2">${g.home}</td>
          <td class="p-2">${g.away}</td>
          <td class="p-2">${g.homeOdds?.toFixed?.(2) || "-"}</td>
          <td class="p-2 ${color(v.home)}">${(v.home * 100).toFixed(1)}%</td>
          <td class="p-2">${g.drawOdds?.toFixed?.(2) || "-"}</td>
          <td class="p-2 ${color(v.draw)}">${(v.draw * 100).toFixed(1)}%</td>
          <td class="p-2">${g.awayOdds?.toFixed?.(2) || "-"}</td>
          <td class="p-2 ${color(v.away)}">${(v.away * 100).toFixed(1)}%</td>
          <td class="p-2">${g.over15?.toFixed?.(2) || "-"}</td>
          <td class="p-2 ${color(v.over15)}">${(v.over15 * 100).toFixed(1)}%</td>
          <td class="p-2">${g.over25?.toFixed?.(2) || "-"}</td>
          <td class="p-2 ${color(v.over25)}">${(v.over25 * 100).toFixed(1)}%</td>
          <td class="p-2">${g.over35?.toFixed?.(2) || "-"}</td>
          <td class="p-2 ${color(v.over35)}">${(v.over35 * 100).toFixed(1)}%</td>
        </tr>`;
      body.insertAdjacentHTML("beforeend", row);
    });
  } catch (err) {
    console.error(err);
    body.innerHTML = "<tr><td colspan='16'>❌ Fehler beim Laden.</td></tr>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("date").value = today;
  loadOdds();
});
