const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");
const leagueSelect = document.getElementById("league-select");

const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

refreshBtn.addEventListener("click", loadMatches);

async function loadMatches() {
  const date = dateInput.value;
  const leagues = Array.from(leagueSelect.selectedOptions).map(o => o.value);

  if (!date) return (statusDiv.textContent = "Bitte Datum wählen!");
  if (leagues.length === 0) return (statusDiv.textContent = "Bitte mindestens eine Liga wählen!");

  statusDiv.textContent = "Lade Spiele...";
  matchList.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}&leagues=${leagues.join(",")}`);
    const data = await res.json();
    const games = data.response;

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele gefunden.";
      return;
    }

    // -----------------------
    // Top 7 nach Wahrscheinlichkeit
    // -----------------------
    const top7 = [...games]
      .map(g => {
        const best =
          g.prob.home > g.prob.away && g.prob.home > g.prob.draw
            ? { type: "1", val: g.prob.home }
            : g.prob.away > g.prob.home && g.prob.away > g.prob.draw
            ? { type: "2", val: g.prob.away }
            : { type: "X", val: g.prob.draw };
        return { ...g, best };
      })
      .sort((a, b) => b.best.val - a.best.val)
      .slice(0, 7);

    const topSection = document.createElement("div");
    topSection.className = "top-section";
    topSection.innerHTML = `<h2>🏅 Top 7 Siegwahrscheinlichkeiten</h2>
      <ul>${top7
        .map(
          g =>
            `<li>${g.home} vs ${g.away} → Tipp <b>${g.best.type}</b> mit ${(g.best.val * 100).toFixed(1)}%</li>`
        )
        .join("")}</ul>`;
    matchList.appendChild(topSection);

    // -----------------------
    // Top 5 Value / Over / BTTS
    // -----------------------
    const createTopList = (title, arr) => {
      const div = document.createElement("div");
      div.className = "top-section";
      div.innerHTML = `<h2>${title}</h2>
        <ul>${arr
          .map(
            g =>
              `<li>${g.home} vs ${g.away} → ${g.bestValueMarket.toUpperCase()} (${g.prob.toFixed(1)}%, Value: ${g.value.toFixed(2)})</li>`
          )
          .join("")}</ul>`;
      return div;
    };

    matchList.appendChild(createTopList("🔥 Top 5 Value", [
      ...data.topByValue.home,
      ...data.topByValue.draw,
      ...data.topByValue.over25,
      ...data.topByValue.btts
    ].sort((a,b)=>b.value-a.value).slice(0,5)));

    matchList.appendChild(createTopList("⚡ Top 5 Over 2,5", data.topByProb.over25));
    matchList.appendChild(createTopList("💥 Top 5 BTTS", data.topByProb.btts));

    // -----------------------
    // Spiele-Karten
    // -----------------------
    games.forEach(g => {
      const card = document.createElement("div");
      card.className = "match-card";

      const homeVal = g.prob.home * 100;
      const drawVal = g.prob.draw * 100;
      const awayVal = g.prob.away * 100;
      const overVal = g.prob.over25 * 100;
      const bttsVal = g.prob.btts * 100;

      const trend =
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

      card.innerHTML = `
        <div class="match-header mb-3">
          <div class="team">
            <img src="${g.homeLogo}" alt="${g.home}" />
            <div>
              <div class="team-name">${g.home}</div>
              <div class="team-xg">${g.homeXG} xG</div>
            </div>
          </div>

          <span class="text-xs bg-blue-200 text-blue-800 px-3 py-1 rounded-full">${g.league}</span>

          <div class="team text-right">
            <div>
              <div class="team-name">${g.away}</div>
              <div class="team-xg">${g.awayXG} xG</div>
            </div>
            <img src="${g.awayLogo}" alt="${g.away}" />
          </div>
        </div>

        <div class="text-amber-700 text-sm mb-2">
          1: ${g.odds.home.toFixed(2)} | X: ${g.odds.draw.toFixed(2)} | 2: ${g.odds.away.toFixed(2)}
        </div>

        <div class="bar-container mb-2">
          <div class="bar-fill bar-home" style="width:${homeVal}%"></div>
          <div class="bar-text">1:${homeVal.toFixed(1)}% | X:${drawVal.toFixed(1)}% | 2:${awayVal.toFixed(1)}%</div>
        </div>

        <div class="bar-container mb-2">
          <div class="bar-fill bar-over" style="width:${overVal}%"></div>
          <div class="bar-text">Over:${overVal.toFixed(1)}% | Under:${(100 - overVal).toFixed(1)}%</div>
        </div>

        <div class="bar-container">
          <div class="bar-fill bar-btts-yes" style="width:${bttsVal}%"></div>
          <div class="bar-text">BTTS Ja:${bttsVal.toFixed(1)}% | Nein:${(100 - bttsVal).toFixed(1)}%</div>
        </div>

        <div class="trend mt-2">
          <span class="trend-${trend === "Heimsieg" ? "home" : trend === "Auswärtssieg" ? "away" : "draw"}">${trend}</span>
          <span class="trend-${trendOver.includes("Over") ? "over" : "under"}">${trendOver}</span>
          <span class="trend-${trendBTTS.includes("JA") ? "btts-yes" : "btts-no"}">${trendBTTS}</span>
        </div>

        <div class="text-center mt-3 font-semibold text-blue-600">
          👉 Empfehlung: <span class="underline">${bestMarket}</span> (${bestChance.toFixed(1)}% Trefferchance)
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
