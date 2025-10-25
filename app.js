const matchList = document.getElementById("match-list");
const topList = document.getElementById("top-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");

const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

refreshBtn.addEventListener("click", loadMatches);
loadMatches();

function getDiffColor(diff) {
  if (diff > 0.5) return "text-green-400";
  if (diff < -0.5) return "text-red-400";
  return "text-yellow-400";
}

async function loadMatches() {
  const date = dateInput.value;
  if (!date) return statusDiv.textContent = "Bitte Datum wählen!";

  statusDiv.textContent = "Lade aktuelle Spiele...";
  matchList.innerHTML = "";
  if (topList) topList.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const { response: games, topGames } = await res.json();
    if (!games || games.length === 0) return statusDiv.textContent = "Keine Spiele für heute";

    let count = 0;
    for (const g of games) {
      const bestValue = Math.max(g.value.home, g.value.draw, g.value.away, g.value.over25);
      const valuePercent = Math.min(bestValue * 100, 100).toFixed(1);
      const valueClass = bestValue > 0.12 ? "bg-green-500" :
                         bestValue > 0.05 ? "bg-yellow-500" : "bg-red-500";

      const market = bestValue === g.value.home ? "1" :
                     bestValue === g.value.draw ? "X" :
                     bestValue === g.value.away ? "2" :
                     bestValue === g.value.over25 ? "O2.5" : "-";

      const overValueClass = g.value.over25 > 0.12 ? "bg-green-500" :
                             g.value.over25 > 0.05 ? "bg-yellow-500" : "bg-red-500";
      const overPercent = Math.min((g.value.over25 || 0) * 100, 100).toFixed(1);

      const diff = g.homeXG - g.awayXG;
      const diffColor = getDiffColor(diff);

      const card = document.createElement("div");
      card.className = "bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700 mb-4";
      card.innerHTML = `
        <div class="flex justify-between items-center mb-2">
          <div class="flex items-center gap-3">
            <img src="${g.homeLogo}" class="w-10 h-10 rounded-full" alt="${g.home}"/>
            <div>
              <div class="font-bold text-lg">${g.home}</div>
              <div class="text-xs text-gray-400">${g.homeXG} xG</div>
            </div>
          </div>
          <span class="text-xs bg-cyan-900 text-cyan-300 px-3 py-1 rounded-full">${g.league}</span>
          <div class="flex items-center gap-3 text-right">
            <div>
              <div class="font-bold text-lg">${g.away}</div>
              <div class="text-xs text-gray-400">${g.awayXG} xG</div>
            </div>
            <img src="${g.awayLogo}" class="w-10 h-10 rounded-full" alt="${g.away}"/>
          </div>
        </div>

        <div class="text-sm mb-1 ${diffColor} font-semibold">xG Diff: ${diff.toFixed(2)}</div>

        <div class="text-amber-300 text-sm mb-1">
          1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}
        </div>

        <div class="text-sm mb-2 text-gray-300">
          Over 2.5: ${g.odds.over25 ? g.odds.over25.toFixed(2) : "-"}
          <div class="relative h-4 bg-gray-700 rounded-full overflow-hidden mt-1">
            <div class="${overValueClass} h-full transition-all duration-500" style="width:${over
