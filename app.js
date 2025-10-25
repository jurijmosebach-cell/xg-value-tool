const matchList = document.getElementById("match-list");
const topList = document.getElementById("top-list");
const favDiv = document.getElementById("top-favorites");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");

const today = new Date().toISOString().slice(0,10);
dateInput.value = today;

refreshBtn.addEventListener("click", loadMatches);
loadMatches();

function getValueColor(value){
  if(value>0.12) return "bg-green-500";
  if(value>0.05) return "bg-yellow-500";
  return "bg-red-500";
}

async function loadMatches(){
  const date=dateInput.value;
  if(!date) return statusDiv.textContent="Bitte Datum wählen!";

  statusDiv.textContent="Lade aktuelle Spiele...";
  matchList.innerHTML="";
  topList.innerHTML="";
  favDiv.innerHTML="";

  try{
    const res=await fetch(`/api/games?date=${date}`);
    const { response: games, topGames, topFavorites } = await res.json();
    if(!games || games.length===0) return statusDiv.textContent="Keine Spiele für dieses Datum!";

    // Top 7 Value Tipps
    topGames.forEach((g,i)=>{
      const bestValue = Math.max(g.value.home,g.value.draw,g.value.away,g.value.over25);
      const market = bestValue===g.value.home?"1":bestValue===g.value.draw?"X":bestValue===g.value.away?"2":"O2.5";
      const li=document.createElement("li");
      li.textContent=`${g.home} vs ${g.away} → ${market} ${Math.round(bestValue*100)}% Value`;
      topList.appendChild(li);
    });

    // Top 3 Favoriten
    topFavorites.forEach((g,i)=>{
      const div=document.createElement("div");
      div.className="text-gray-200 mb-1";
      div.textContent=`${i+1}. ${g.home} vs ${g.away} → Favorit: ${g.favorite} (xG: ${g.prob})`;
      favDiv.appendChild(div);
    });

    let count=0;
    for(const g of games){
      const bestValue=Math.max(g.value.home||0,g.value.draw||0,g.value.away||0,g.value.over25||0);
      const valuePercent=(bestValue*100).toFixed(1);
      const valueClass=getValueColor(bestValue);
      const market=bestValue===g.value.home?"1":bestValue===g.value.draw?"X":bestValue===g.value.away?"2":"O2.5";

      const card=document.createElement("div");
      card.className="bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700 mb-4";
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
          Over 2.5: ${g.odds.over25 ? g.odds.over25.toFixed(2) : "-"}
        </div>
        <div class="relative h-10 bg-gray-700 rounded-full overflow-hidden">
          <div class="${valueClass} h-full transition-all duration-500" style="width: ${Math.min(bestValue*120+40,100)}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
            ${market} ${valuePercent}% Value
          </span>
        </div>
      `;
      matchList.appendChild(card);
      count++;
    }
    statusDiv.textContent=`${count} aktuelle Spiele geladen!`;
  }catch(err){
    statusDiv.textContent="Fehler: "+err.message;
    console.error(err);
  }
}
