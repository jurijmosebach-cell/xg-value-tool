const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");
const leagueSelect = document.getElementById("league-select");

// Standard-Datum = heute
const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

// Klick auf "Spiele laden"
refreshBtn.addEventListener("click", loadMatches);

async function loadMatches() {
  const date = dateInput.value;
  const leagues = Array.from(leagueSelect.selectedOptions).map(o => o.value);

  if (!date) {
    statusDiv.textContent = "Bitte Datum wählen!";
    return;
  }
  if (leagues.length === 0) {
    statusDiv.textContent = "Bitte mindestens eine Liga wählen!";
    return;
  }

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

    // -----------------------------
    // Top 10 Wahrscheinlichkeit
    // -----------------------------
    const top10 = [...games]
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
      .slice(0, 10);

    const top10Section = document.createElement("div");
    top10Section.className = "top-section";
    top10Section.innerHTML = `<h2>🏅 Top 10 Wahrscheinlichkeit</h2>
      <ul>${top10.map(g=>`<li>${g.home} vs ${g.away} → Tipp <b>${g.best.type}</b> ${(g.best.val*100).toFixed(1)}%</li>`).join("")}</ul>`;
    matchList.appendChild(top10Section);

    // -----------------------------
    // Top 5 Value
    // -----------------------------
    const topValue = [...games]
      .sort((a,b)=>{
        const maxA = Math.max(a.value.home, a.value.draw, a.value.away, a.value.over25, a.value.btts);
        const maxB = Math.max(b.value.home, b.value.draw, b.value.away, b.value.over25, b.value.btts);
        return maxB - maxA;
      })
      .slice(0,5);

    const topValueSection = document.createElement("div");
    topValueSection.className="top-section";
    topValueSection.innerHTML=`<h2>💰 Top 5 Value</h2>
      <ul>${topValue.map(g=>{
        const vals=[{type:"1",val:g.value.home},{type:"X",val:g.value.draw},{type:"2",val:g.value.away},{type:"Over 2.5",val:g.value.over25},{type:"BTTS",val:g.value.btts}];
        const bestVal=vals.reduce((a,b)=>b.val>a.val?b:a);
        return `<li>${g.home} vs ${g.away} → Beste Value: <b>${bestVal.type}</b> ${(bestVal.val*100).toFixed(1)}%</li>`;
      }).join("")}</ul>`;
    matchList.appendChild(topValueSection);

    // -----------------------------
    // Top 5 Over 2.5
    // -----------------------------
    const topOver = [...games].sort((a,b)=>b.prob.over25 - a.prob.over25).slice(0,5);
    const topOverSection = document.createElement("div");
    topOverSection.className="top-section";
    topOverSection.innerHTML=`<h2>🔝 Top 5 Over 2.5</h2>
      <ul>${topOver.map(g=>`<li>${g.home} vs ${g.away} → ${(g.prob.over25*100).toFixed(1)}%</li>`).join("")}</ul>`;
    matchList.appendChild(topOverSection);

    // -----------------------------
    // Top 5 BTTS
    // -----------------------------
    const topBTTS = [...games].sort((a,b)=>b.prob.btts - a.prob.btts).slice(0,5);
    const topBTTSSection = document.createElement("div");
    topBTTSSection.className="top-section";
    topBTTSSection.innerHTML=`<h2>⚡ Top 5 BTTS</h2>
      <ul>${topBTTS.map(g=>`<li>${g.home} vs ${g.away} → BTTS Ja ${(g.prob.btts*100).toFixed(1)}%</li>`).join("")}</ul>`;
    matchList.appendChild(topBTTSSection);

    // -----------------------------
    // Restliche Spiele pro Liga
    // -----------------------------
    const restSection = document.createElement("div");
    restSection.className="top-section";
    restSection.innerHTML="<h2>🗂 Restliche Spiele</h2>";
    matchList.appendChild(restSection);

    games.forEach(g=>{
      const card=document.createElement("div");
      card.className="match-card";

      const homeVal = g.prob.home*100;
      const drawVal = g.prob.draw*100;
      const awayVal = g.prob.away*100;
      const overVal = g.prob.over25*100;
      const bttsVal = g.prob.btts*100;

      const trend = homeVal>awayVal && homeVal>drawVal ? "Heimsieg" : awayVal>homeVal && awayVal>drawVal ? "Auswärtssieg" : "Unentschieden";
      const trendOver = overVal>50?"Over 2.5":"Under 2.5";
      const trendBTTS = bttsVal>50?"BTTS JA":"BTTS NEIN";

      const bestChance=Math.max(homeVal,drawVal,awayVal,overVal,bttsVal);
      const bestMarket=bestChance===homeVal?"1":bestChance===drawVal?"X":bestChance===awayVal?"2":bestChance===overVal?"Over 2.5":"BTTS Ja";

      card.innerHTML=`
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

        <!-- Balken: Heim / Draw / Auswärts -->
        <div class="bar-container mb-2">
          <div class="bar-fill bar-home" style="width:${homeVal}%"></div>
          <div class="bar-fill bar-draw" style="width:${drawVal}%"></div>
          <div class="bar-fill bar-away" style="width:${awayVal}%"></div>
          <div class="bar-text">
            1:${homeVal.toFixed(1)}% | X:${drawVal.toFixed(1)}% | 2:${awayVal.toFixed(1)}%
          </div>
        </div>

        <div class="bar-container mb-2">
          <div class="bar-fill bar-over" style="width:${overVal}%"></div>
          <div class="bar-text">
            Over:${overVal.toFixed(1)}% | Under:${(100-overVal).toFixed(1)}%
          </div>
        </div>

        <div class="bar-container">
          <div class="bar-fill bar-btts-yes" style="width:${bttsVal}%"></div>
          <div class="bar-text">
            BTTS Ja:${bttsVal.toFixed(1)}% | Nein:${(100-bttsVal).toFixed(1)}%
          </div>
        </div>

        <div class="trend">
          <span class="trend-${trend==="Heimsieg"?"home":trend==="Auswärtssieg"?"away":"draw"}">${trend}</span>
          <span class="trend-${trendOver.includes("Over")?"over":"under"}">${trendOver}</span>
          <span class="trend-${trendBTTS.includes("JA")?"btts-yes":"btts-no"}">${trendBTTS}</span>
        </div>

        <div class="text-center mt-3 font-semibold text-blue-600">
          👉 Empfehlung: <span class="underline">${bestMarket}</span> (${bestChance.toFixed(1)}% Trefferchance)
        </div>
      `;
      restSection.appendChild(card);
    });

    statusDiv.textContent=`${games.length} Spiele geladen!`;

  } catch(err){
    statusDiv.textContent="Fehler: "+err.message;
    console.error(err);
  }
}
