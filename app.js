const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");

const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

refreshBtn.addEventListener("click", loadMatches);
loadMatches();

async function loadMatches() {
  const date = dateInput.value;
  if (!date) {
    statusDiv.textContent = "Bitte Datum wählen!";
    return;
  }

  statusDiv.textContent = "Lade aktuelle Spiele...";
  matchList.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const { response: gamesRaw } = await res.json();
    if (!gamesRaw || gamesRaw.length === 0) {
      statusDiv.textContent = "Keine Spiele für heute (Quoten noch nicht verfügbar)";
      return;
    }

    // Nur Spiele mit vollständigen Daten
    const games = gamesRaw.filter(g => g && g.home && g.away && g.value && g.prob);

    if (games.length === 0) {
      statusDiv.textContent = "Keine vollständigen Spiele-Daten verfügbar";
      return;
    }

    // Top 7 Value Tipps
    const topValue = [...games].sort((a,b)=>Math.max(b.value.home,b.value.draw,b.value.away)-Math.max(a.value.home,a.value.draw,a.value.away)).slice(0,7);
    let topValueHtml = "<strong>Top 7 Value Tipps</strong><br>";
    topValue.forEach(g=>{
      const bestValue = Math.max(g.value.home,g.value.draw,g.value.away);
      const market = bestValue===g.value.home?"1":bestValue===g.value.draw?"X":"2";
      const perc = (bestValue*100).toFixed(1);
      topValueHtml += `${g.home} vs ${g.away} → ${market} ${perc}% Value<br>`;
    });

    // Top 3 xG Favoriten
    const topXG = [...games].sort((a,b)=>(b.homeXG+b.awayXG)-(a.homeXG+a.awayXG)).slice(0,3);
    let topXGHtml = "<strong>Top 3 Favoriten (xG)</strong><br>";
    topXG.forEach(g=>{
      const totalXG = (g.homeXG+g.awayXG).toFixed(2);
      topXGHtml += `${g.home} vs ${g.away} → ${totalXG} xG<br>`;
    });

    document.getElementById("statbox").innerHTML = topValueHtml + "<br>" + topXGHtml;

    // Spiele rendern
    games.forEach(g=>{
      const bestValue = Math.max(g.value.home,g.value.draw,g.value.away);
      const valueClass = bestValue>0.12?"green":bestValue>0.05?"yellow":"red";
      const valuePercent = (bestValue*100).toFixed(1);
      const market = bestValue===g.value.home?"1":bestValue===g.value.draw?"X":"2";

      // Balken nur wenn Wahrscheinlichkeiten existieren
      const homePerc = g.prob.home ? (g.prob.home*100).toFixed(1) : 0;
      const drawPerc = g.prob.draw ? (g.prob.draw*100).toFixed(1) : 0;
      const awayPerc = g.prob.away ? (g.prob.away*100).toFixed(1) : 0;
      const overPerc = g.prob.over25 ? (g.prob.over25*100).toFixed(1) : 0;
      const underPerc = g.prob.over25 ? ((1-g.prob.over25)*100).toFixed(1) : 0;

      const card = document.createElement("div");
      card.className = "bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700 mb-4";
      card.innerHTML = `
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-3">
            <img src="${g.homeLogo}" class="w-10 h-10 rounded-full" alt="${g.home}"/>
            <div><div class="font-bold text-lg">${g.home}</div><div class="text-xs text-gray-400">${g.homeXG} xG</div></div>
          </div>
          <span class="text-xs bg-cyan-900 text-cyan-300 px-3 py-1 rounded-full">${g.league}</span>
          <div class="flex items-center gap-3 text-right">
            <div><div class="font-bold text-lg">${g.away}</div><div class="text-xs text-gray-400">${g.awayXG} xG</div></div>
            <img src="${g.awayLogo}" class="w-10 h-10 rounded-full" alt="${g.away}"/>
          </div>
        </div>

        <div class="text-amber-300 text-sm mb-2">
          1: ${g.odds.home?.toFixed(2)||"-"} | X: ${g.odds.draw?.toFixed(2)||"-"} | 2: ${g.odds.away?.toFixed(2)||"-"}
        </div>

        <!-- Value Balken -->
        <div class="valuebar mb-2" title="${market} ${valuePercent}% Value">
          <div class="valuefill ${valueClass}" style="width:${Math.min(bestValue*120+40,100)}%"></div>
          <span class="valuetxt">${market} ${valuePercent}% Value</span>
        </div>

        <!-- Sieg/Unentschieden Balken -->
        <div class="valuebar mb-2" title="1:${homePerc}% X:${drawPerc}% 2:${awayPerc}%">
          <div class="valuefill green" style="width:${homePerc}%"></div>
          <div class="valuefill yellow" style="width:${drawPerc}%"></div>
          <div class="valuefill red" style="width:${awayPerc}%"></div>
          <span class="valuetxt">1:${homePerc}% X:${drawPerc}% 2:${awayPerc}%</span>
        </div>

        <!-- Over/Under Balken -->
        <div class="valuebar" title="Over:${overPerc}% Under:${underPerc}%">
          <div class="oufill green" style="width:${overPerc}%"></div>
          <div class="oufill red" style="width:${underPerc}%"></div>
          <span class="outxt">Over:${overPerc}% Under:${underPerc}%</span>
        </div>
      `;
      matchList.appendChild(card);
    });

    statusDiv.textContent = `${games.length} aktuelle Spiele geladen!`;
  } catch(err) {
    statusDiv.textContent = "Fehler: "+err.message;
    console.error(err);
  }
}
