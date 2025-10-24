// app.js — V3 mit Logos, Value-Balken & Hit/Save-Statistik

const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");

dateInput.value = new Date().toISOString().slice(0, 10);

refreshBtn.addEventListener("click", loadMatches);

function calcValue(prob, odd) {
  // Beispiel, falls keine Value vom Backend kommt:
  return (prob * odd) - 1; // z.B. 0.18 = 18% Value (Falls Probabilität bekannt!)
}

function showStatBox() {
  let stored = JSON.parse(localStorage.getItem('myValues') || "[]");
  if (!stored.length) {
    if (document.getElementById("statbox"))
      document.getElementById("statbox").remove();
    return;
  }
  let n = stored.length;
  // Optional: Trefferquoten-Auswertung, später mit echten Ergebnissen
  let statDiv = document.getElementById("statbox");
  if (!statDiv) {
    statDiv = document.createElement("div");
    statDiv.id = "statbox";
    statDiv.style = "margin:9px 0 0 0;font-weight:500;color:#99e";
    statusDiv.parentNode.insertBefore(statDiv, statusDiv.nextSibling);
  }
  statDiv.textContent = `🔖 Du hast ${n} Value-Tipps gespeichert!`;
}

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
      const homeLogo = g.teams.home.logo;
      const awayLogo = g.teams.away.logo;
      const key = `${home} vs ${away}`;
      const gameOdds = odds[key];

      if (!gameOdds) continue;

      // Value aus Backend
      const value = gameOdds.value ?? 0; // Wenn nicht vorhanden, 0
      const valuePercent = (value * 100).toFixed(1);
      const valueClass = value > 0.12 ? "green" :
                         value > 0.04 ? "yellow" : "red";
      const valueIcon = value > 0 ? "✅" : "❌";

      const card = document.createElement("div");
      card.className = "match-card";
      card.innerHTML = `
        <div class="match-header">
          <img src="${homeLogo}" class="teamlogo" alt="${home}" title="${home}" />
          <strong>${home}</strong>
          vs
          <img src="${awayLogo}" class="teamlogo" alt="${away}" title="${away}" />
          <strong>${away}</strong>
          <div class="league">${g.league.name}</div>
        </div>
        <div class="odds">
          <div>🏠 ${gameOdds.home?.toFixed(2) || "-"} | 🤝 ${gameOdds.draw?.toFixed(2) || "-"} | 🚗 ${gameOdds.away?.toFixed(2) || "-"}</div>
          <div>Over 2.5: ${gameOdds.over25?.toFixed(2) || "-"} | BTTS: ${gameOdds.bttsYes?.toFixed(2) || "-"}</div>
        </div>
        <div class="valuebar" style="margin-top:8px; position:relative; height:20px; background:#232b22; border-radius:9px;">
          <div class="valuefill ${valueClass}" style="height:100%; border-radius:9px; background:${valueClass === "green" ? "#19e378" : valueClass === "yellow" ? "#ffe56c" : "#ff4a58"}; width:${Math.min(value*100+50,100)}%"></div>
          <span class="valueicon" style="position:absolute; left:8px; top:2px;">${valueIcon}</span>
          <span class="valuetxt" style="position:absolute; right:12px; top:2px; font-weight:bold;">${valuePercent}% Value</span>
        </div>
        <button class="save-value-btn" style="margin-top:8px;">Value merken</button>
      `;

      // Value speichern (localStorage)
      card.querySelector('.save-value-btn').onclick = () => {
        let stored = JSON.parse(localStorage.getItem('myValues') || "[]");
        stored.push({ date: dateInput.value, home, away, value, odd: gameOdds.home, league: g.league.name });
        localStorage.setItem('myValues', JSON.stringify(stored));
        alert("Value-Tipp gespeichert!");
        showStatBox();
      };

      matchList.appendChild(card);
      count++;
    }

    statusDiv.textContent = count > 0 ? `${count} Spiele geladen ✅` : "Keine Spiele gefunden 😕";
    showStatBox();
  } catch (err) {
    console.error(err);
    statusDiv.textContent = "Fehler beim Laden!";
  }
}

loadMatches();
