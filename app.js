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

function getDiffColor(diff) {
  if (diff > 0.5) return "text-green-400";
  if (diff < -0.5) return "text-red-400";
  return "text-yellow-400";
}

function getValueColor(value) {
  if (value > 0.12) return "bg-green-500";
  if (value > 0.05) return "bg-yellow-500";
  return "bg-red-500";
}

async function loadMatches() {
  const date = dateInput.value;
  if (!date) return statusDiv.textContent = "Bitte Datum wählen!";

  statusDiv.textContent = "Lade aktuelle Spiele...";
  matchList.innerHTML = "";
  if(topList) topList.innerHTML = "";
  if(favDiv) favDiv.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const { response: games, topGames, topFavorites } = await res.json();
    if(!games || games.length === 0) return statusDiv.textContent="Keine Spiele für heute";

    // Top 7 Value Tipps
    topGames.forEach((g,i)=>{
      const bestValue = Math.max(g.value.home, g.value.draw, g.value.away, g.value.over25);
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
      const bestValue=Math.max(g.value.home,g.value.draw,g.value.away,g.value.over25);
      const valuePercent=Math.min(bestValue*100,100).toFixed(1);
      const valueClass=getValueColor(bestValue);

      const market=bestValue===g.value.home?"1":
                   bestValue===g.value.draw?"X":
                   bestValue===g.value.away?"2":
                   bestValue===g.value.over25?"O2.5":"-";

      const overPercent=Math.min((g.value.over25||0)*100,100).toFixed(1);
      const overClass=getValueColor(g.value.over25||0);

      const diff=g.homeXG-g.awayXG;
      const diffColor=getDiffColor(diff);

      const card=document.createElement("div");
      card.className="bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700 mb-4";
      card.innerHTML=`
        <div class="flex justify-between items-center mb-2">
          <div class="flex items-center gap-3">
            <img src="${g.homeLogo}" class="w-10 h-10 rounded-full" alt
