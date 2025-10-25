const matchList = document.getElementById("match-list");
const topList = document.getElementById("top-list");
const topFav = document.getElementById("top-favorites");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");

const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

refreshBtn.addEventListener("click", loadMatches);
loadMatches();

function getFlag(team) {
  const flags = { "Chelsea": "gb", "Manchester United": "gb", "Liverpool": "gb", "Arsenal": "gb",
                  "Borussia Dortmund": "de", "Bayern": "de", "1. FC Köln": "de", "Valencia": "es",
                  "Villarreal": "es", "Barcelona": "es", "Juventus": "it", "Napoli": "it", "Inter": "it",
                  "AS Monaco": "fr", "Paris Saint-Germain": "fr", "MLS": "us" };
  for (const [name, flag] of Object.entries(flags)) {
    if (team.includes(name)) return flag;
  }
  return "eu";
}

async function loadMatches() {
  const date = dateInput.value;
  if (!date) {
    statusDiv.textContent = "Bitte Datum wählen!";
    return;
  }

  statusDiv.textContent = "Lade aktuelle Spiele...";
  matchList.innerHTML = "";
  topList.innerHTML = "";
  topFav.innerHTML = "<h2 class='text-xl font-bold text-green-400 mb-2'>Top 3 Favoriten (xG)</h2>";

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const { response: games } = await res.json();

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele für heute verfügbar";
      return;
    }

    // Top 7 Value Tipps
    const topValue = [...games].sort((a, b) => {
      const aBest = Math.max(a.value.home, a.value.draw, a.value.away, a.value.over25);
      const bBest = Math.max(b.value.home, b.value.draw, b.value.away, b.value.over25);
      return bBest - aBest;
    }).slice(0, 7);

    topValue.forEach(g => {
      const bestValue = Math.max(g.value.home, g.value.draw, g.value.away, g.value.over25);
      const market = bestValue === g.value.home ? "1" : bestValue === g.value.draw ? "X" : bestValue === g.value.away ? "2" : "O2.5";
      const valuePercent = (bestValue*100).toFixed(1);
      const odds = market === "1" ? g.odds.home : market==="X" ? g.odds.draw : market==="2" ? g.odds.away : g.odds.over25;
      const barColor = bestValue>0.12 ? "bg-green-500" : bestValue>0.05 ? "bg-yellow-500" : "bg-red-500";

      const li = document.createElement("li");
      li.className = "mb-2 relative group cursor-pointer";
      li.innerHTML = `
        <div class="flex justify-between items-center">
          <span>${g.home} vs ${g.away} → ${market} ${valuePercent}% Value</span>
          <div class="relative w-32 h-4 bg-gray-700 rounded-full overflow-hidden ml-2">
            <div class="${barColor} h-full transition-all duration-1000" style="width:${Math.min(bestValue*120+40,100)}%"></div>
          </div>
        </div>
        <div class="absolute left-0 top-6 w-80 p-3 bg-gray-800 border border-gray-600 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity text-sm z-50">
          <strong>Markt:</strong> ${market} <br/>
          <strong>Quote:</strong> ${odds} <br/>
          <strong>Berechneter Value:</strong> ${valuePercent}% <br/>
          <strong>xG Heim:</strong> ${g.homeXG} | <strong>xG Auswärts:</strong> ${g.awayXG}
        </div>
      `;
      topList.appendChild(li);
    });

    // Top 3 Favoriten nach xG
    const topXG = [...games].sort((a,b) => (b.homeXG + b.awayXG) - (a.homeXG + a.awayXG)).slice(0,3);
    topXG.forEach(g => {
      const div = document.createElement("div");
      div.textContent = `${g.home} vs ${g.away} → ${g.totalXG} xG`;
      topFav.appendChild(div);
    });

    // Spiele anzeigen
    games.forEach(g => {
      const bestValue = Math.max(g.value.home, g.value.draw, g.value.away, g.value.over25);
      const valuePercent = (bestValue*100).toFixed(1);
      const valueClass = bestValue>0.12 ? "bg-green-500" : bestValue>0.05 ? "bg-yellow-500" : "bg-red-500";
      const market = bestValue === g.value.home ? "1" : bestValue === g.value.draw ? "X" : bestValue === g.value.away ? "2" : "O2.5";

      const card = document.createElement("div");
      card.className = "bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700 mb-4";
      card.innerHTML = `
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-3">
            <img src="https://flagcdn.com/48x36/${getFlag(g.home)}.png" class="w-10 h-10 rounded-full" alt="${g.home}"/>
            <div><div class="font-bold text-lg">${g.home}</div><div class="text-xs text-gray-400">${g.homeXG} xG</div></div>
          </div>
          <span class="text-xs bg-cyan-900 text-cyan-300 px-3 py-1 rounded-full">${g.league}</span>
          <div class="flex items-center gap-3 text-right">
            <div><div class="font-bold text-lg">${g.away}</div><div class="text-xs text-gray-400">${g.awayXG} xG</div></div>
            <img src="https://flagcdn.com/48x36/${getFlag(g.away)}.png" class="w-10 h-10 rounded-full" alt="${g.away}"/>
          </div>
        </div>
        <div class="text-amber-300 text-sm mb-2">
          1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}
        </div>
        <div class="text-sm mb-2 text-gray-300">
          Over 2.5: ${g.odds.over25 ? g.odds.over25.toFixed(2) : "-"}
        </div>
        <div class="relative h-10 bg-gray-700 rounded-full overflow-hidden">
          <div class="${valueClass} h-full transition-all duration-1000" style="width: ${Math.min(bestValue*120+40,100)}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
            ${market} ${valuePercent}% Value
          </span>
        </div>
      `;
      matchList.appendChild(card);
    });

    statusDiv.textContent = `${games.length} aktuelle Spiele geladen!`;

  } catch(err) {
    statusDiv.textContent = "Fehler: " + err.message;
    console.error(err);
  }
}
