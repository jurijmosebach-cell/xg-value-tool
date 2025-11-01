const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");
const leagueSelect = document.getElementById("league-select");

const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

refreshBtn.addEventListener("click", loadMatches);

function renderTop5Section(title, games, marketKey, trendFunc) {
  if (!games || games.length === 0) return '';
  return `
    <div class="top-section mb-4 p-3 bg-green-50 rounded">
      <h2 class="text-lg font-bold mb-2">${title}</h2>
      <ul class="list-disc pl-5">
        ${games
          .map(g => {
            const trend = trendFunc(g);
            const valueTag = g.isValue ? "💎" : "";
            return `<li>${g.home} vs ${g.away} (${g.league}) → ${trend} | ${(g.prob).toFixed(1)}% ${valueTag}</li>`;
          })
          .join('')}
      </ul>
    </div>
  `;
}

async function loadMatches() {
  const date = dateInput.value;
  const leagues = Array.from(leagueSelect.selectedOptions).map(o => o.value);

  if (!date) return (statusDiv.textContent = "Bitte Datum wählen!");
  if (leagues.length === 0) return (statusDiv.textContent = "Bitte mindestens eine Liga wählen!");

  statusDiv.textContent = "Lade Spiele...";
  matchList.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}&leagues=${leagues.join(",")}`);
    const { response: games, topByValue } = await res.json();

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele gefunden.";
      return;
    }

    // Top-5 Value Sections
    const top1X2 = [
      ...topByValue.home,
      ...topByValue.draw,
      ...topByValue.away
    ].sort((a,b) => b.value - a.value).slice(0,5);
    const topOver25 = topByValue.over25.slice(0,5);
    const topBTTS = topByValue.btts.slice(0,5);

    const topSectionsHTML = `
      ${renderTop5Section("🏆 Top 5 Value 1/X/2", top1X2, null, g => {
        if (g.bestValueMarket === "home") return "Heimsieg";
        if (g.bestValueMarket === "draw") return "Unentschieden";
        if (g.bestValueMarket === "away") return "Auswärtssieg";
        return "";
      })}
      ${renderTop5Section("⚡ Top 5 Value Over 2,5", topOver25, "over25", g => g.prob>50 ? "Over 2,5" : "Under 2,5")}
      ${renderTop5Section("🔥 Top 5 Value BTTS", topBTTS, "btts", g => g.prob>50 ? "BTTS Ja" : "BTTS Nein")}
    `;
    matchList.innerHTML = topSectionsHTML;

    // Spielekarten
    games.forEach(g => {
      const card = document.createElement("div");
      card.className = "match-card bg-white shadow-md p-3 rounded mb-4";

      const homeVal = g.prob.home * 100;
      const drawVal = g.prob.draw * 100;
      const awayVal = g.prob.away * 100;
      const overVal = g.prob.over25 * 100;
      const bttsVal = g.prob.btts * 100;

      let trend =
        homeVal > awayVal && homeVal > drawVal
          ? "Heimsieg"
          : awayVal > homeVal && awayVal > drawVal
          ? "Auswärtssieg"
          : "Unentschieden";
      const trendOver = overVal > 50 ? "Over 2.5" : "Under 2.5";
      const trendBTTS = bttsVal > 50 ? "BTTS: JA" : "BTTS: NEIN";

      const bestChance = Math.max(homeVal, drawVal, awayVal, overVal, bttsVal);
      const bestMarket =
        bestChance === homeVal
          ? "1"
          : bestChance === drawVal
          ? "X"
          : bestChance === awayVal
          ? "2"
          : bestChance === overVal
          ? "Over 2.5"
          : "BTTS Ja";

      const valueTag = g.isValue ? "💎 Höchstes Value!" : "";

      card.innerHTML = `
        <div class="flex justify-between items-center mb-2">
          <div class="flex items-center gap-2">
            <img src="${g.homeLogo}" alt="${g.home}" class="w-10 h-8" />
            <span class="font-semibold">${g.home}</span>
          </div>
          <span class="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">${g.league}</span>
          <div class="flex items-center gap-2">
            <span class="font-semibold">${g.away}</span>
            <img src="${g.awayLogo}" alt="${g.away}" class="w-10 h-8" />
          </div>
        </div>

        <div class="text-sm mb-2">
          1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}
        </div>

        <div class="mb-2">
          <div class="w-full bg-gray-200 h-4 rounded relative">
            <div class="absolute left-0 top-0 h-4 bg-green-400" style="width:${homeVal}%"></div>
            <div class="absolute left-0 top-0 h-4 w-full flex justify-between text-xs px-1">
              <span>1:${homeVal.toFixed(1)}%</span>
              <span>X:${drawVal.toFixed(1)}%</span>
              <span>2:${awayVal.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div class="mb-2">
          <div class="w-full bg-gray-200 h-4 rounded relative">
            <div class="absolute left-0 top-0 h-4 bg-yellow-400" style="width:${overVal}%"></div>
            <div class="absolute left-0 top-0 h-4 w-full flex justify-between text-xs px-1">
              <span>Over:${overVal.toFixed(1)}%</span>
              <span>Under:${(100-overVal).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div class="mb-2">
          <div class="w-full bg-gray-200 h-4 rounded relative">
            <div class="absolute left-0 top-0 h-4 bg-pink-400" style="width:${bttsVal}%"></div>
            <div class="absolute left-0 top-0 h-4 w-full flex justify-between text-xs px-1">
              <span>BTTS Ja:${bttsVal.toFixed(1)}%</span>
              <span>Nein:${(100-bttsVal).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div class="flex gap-2 mt-2">
          <span class="px-2 py-1 bg-green-100 rounded">${trend}</span>
          <span class="px-2 py-1 bg-yellow-100 rounded">${trendOver}</span>
          <span class="px-2 py-1 bg-pink-100 rounded">${trendBTTS}</span>
        </div>

        <div class="text-center mt-2 font-semibold text-blue-600">
          👉 Empfehlung: <span class="underline">${bestMarket}</span> (${bestChance.toFixed(1)}% Trefferchance) ${valueTag}
        </div>
      `;
      matchList.appendChild(card);
    });

    statusDiv.textContent = `${games.length} Spiele geladen!`;
  } catch (err) {
    statusDiv.textContent = "Fehler: " + err.message;
    console.error(err);
  }
}
