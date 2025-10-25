// app.js — Frontend mit Value-Balken + Speichern
const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");

dateInput.value = new Date().toISOString().slice(0, 10);
refreshBtn.addEventListener("click", loadMatches);

function showStatBox() {
  const stored = JSON.parse(localStorage.getItem('myValues') || "[]");
  const statbox = document.getElementById("statbox");
  if (stored.length === 0) {
    statbox.textContent = "";
    return;
  }
  statbox.textContent = `Du hast ${stored.length} Value-Tipps gespeichert!`;
  statbox.className = "bg-gray-800 text-purple-400 text-sm px-3 py-1 rounded";
}

async function loadMatches() {
  const date = dateInput.value;
  statusDiv.textContent = "Lade Spiele & Quoten...";

  try {
    const [fixturesRes, oddsRes] = await Promise.all([
      fetch(`/api/fixtures?date=${date}`),
      fetch(`https://api.the-odds-api.com/v4/sports/soccer_epl/odds?apiKey=${"YOUR_KEY"}&regions=eu&markets=h2h&date=${date}`)
    ]);

    const fixtures = await fixturesRes.json();
    matchList.innerHTML = "";
    let count = 0;

    for (const g of fixtures.response) {
      const key = `${g.home} vs ${g.away}`;
      const value = g.value.over25 || 0;
      const valuePercent = (value * 100).toFixed(1);
      const valueClass = value > 0.12 ? "bg-green-500" : value > 0.04 ? "bg-yellow-500" : "bg-red-500";
      const valueIcon = value > 0 ? "Check" : "Cross";

      const card = document.createElement("div");
      card.className = "bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-700";
      card.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <img src="${g.homeLogo}" class="w-8 h-8 rounded-full" alt="${g.home}"/>
            <strong>${g.home}</strong>
          </div>
          <span class="text-cyan-400 text-sm bg-gray-700 px-2 py-1 rounded">${g.league}</span>
          <div class="flex items-center gap-2">
            <strong>${g.away}</strong>
            <img src="${g.awayLogo}" class="w-8 h-8 rounded-full" alt="${g.away}"/>
          </div>
        </div>

        <div class="text-amber-400 text-sm space-y-1">
          <div>1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}</div>
          <div>Over 2.5: ${g.odds.over25.toFixed(2)} | xG: ${g.totalXG}</div>
        </div>

        <div class="relative h-6 bg-gray-700 rounded-full mt-3 overflow-hidden">
          <div class="${valueClass}" style="width: ${Math.min(value * 100 + 50, 100)}%"></div>
          <span class="absolute left-2 top-1 text-lg">${valueIcon}</span>
          <span class="absolute right-2 top-1 font-bold text-white text-sm">${valuePercent}% Value</span>
        </div>

        <button class="save-value-btn mt-3 w-full bg-gradient-to-r from-cyan-500 to-yellow-500 text-black font-bold py-2 rounded hover:from-yellow-500 hover:to-red-500 hover:text-white transition">
          Value merken
        </button>
      `;

      card.querySelector('.save-value-btn').onclick = () => {
        const stored = JSON.parse(localStorage.getItem('myValues') || "[]");
        stored.push({ date, home: g.home, away: g.away, value, league: g.league });
        localStorage.setItem('myValues', JSON.stringify(stored));
        alert("Value-Tipp gespeichert!");
        showStatBox();
      };

      matchList.appendChild(card);
      count++;
    }

    statusDiv.textContent = count > 0 ? `${count} Spiele geladen` : "Keine Spiele gefunden";
    showStatBox();
  } catch (err) {
    console.error(err);
    statusDiv.textContent = "Fehler beim Laden!";
  }
}

loadMatches();
