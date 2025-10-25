const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const topValueDiv = document.getElementById("top-value");
const topXGDiv = document.getElementById("top-xg");
const dateInput = document.getElementById("match-date");

const today = new Date().toISOString().slice(0,10);
dateInput.value = today;

refreshBtn.addEventListener("click", loadMatches);
loadMatches();

async function loadMatches(){
  const date = dateInput.value;
  if(!date){statusDiv.textContent="Bitte Datum wählen!"; return;}

  statusDiv.textContent="Lade aktuelle Spiele...";
  matchList.innerHTML=""; topValueDiv.innerHTML=""; topXGDiv.innerHTML="";

  try{
    const res = await fetch(`/api/games?date=${date}`);
    const data = await res.json();
    const {response: games, top7Value, top3xG} = data;

    if(!games || games.length===0){
      statusDiv.textContent="Keine Spiele gefunden.";
      return;
    }

    statusDiv.textContent=`${games.length} Spiele geladen!`;

    // ===== Top 7 Value =====
    top7Value.forEach(g=>{
      const div = document.createElement("div");
      div.textContent=`${g.home} vs ${g.away} → ${g.market} ${Math.round(g.bestValue*1000)/10}% Value`;
      topValueDiv.appendChild(div);
    });

    // ===== Top 3 xG =====
    top3xG.forEach(g=>{
      const div = document.createElement("div");
      div.textContent=`${g.home} vs ${g.away} → ${(g.homeXG+g.awayXG).toFixed(2)} xG`;
      topXGDiv.appendChild(div);
    });

    // ===== Alle Spiele =====
    games.forEach(g=>{
      const bestValue = Math.max(g.value.home,g.value.draw,g.value.away,g.value.over25);
      const valueClass = bestValue>0.12?"green":bestValue>0.05?"yellow":"red";
      const market = bestValue===g.value.home?"1":bestValue===g.value.draw?"X":bestValue===g.value.away?"2":"O2.5";

      const card = document.createElement("div");
      card.className="match-card";
      card.innerHTML=`
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
          1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}
        </div>
        <div class="text-sm mb-2 text-gray-300">
          Over 2.5: ${g.odds.over25>0?g.odds.over25.toFixed(2):"-"}
        </div>
        <div class="valuebar">
          <div class="valuefill ${valueClass}" style="width:${Math.min(bestValue*120+40,100)}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
            ${market} ${Math.round(bestValue*1000)/10}% Value
          </span>
        </div>
      `;
      matchList.appendChild(card);
    });

  }catch(err){statusDiv.textContent="Fehler: "+err.message; console.error(err);}
}
