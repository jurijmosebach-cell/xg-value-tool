const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");
const leagueSelect = document.getElementById("league-select");
const playerSelect = document.getElementById("player-select");

dateInput.value = new Date().toISOString().slice(0,10);
refreshBtn.addEventListener("click", loadMatches);

async function loadMatches() {
  const date = dateInput.value;
  const leagues = Array.from(leagueSelect.selectedOptions).map(o => o.value);
  const selectedPlayers = Array.from(playerSelect.selectedOptions).map(o => o.value);

  if (!date) return statusDiv.textContent = "Bitte Datum wählen!";
  if (!leagues.length) return statusDiv.textContent = "Bitte mindestens eine Liga wählen!";

  statusDiv.textContent = "Lade Spiele...";
  matchList.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}&leagues=${leagues.join(",")}`);
    const { response: games } = await res.json();

    if (!games || !games.length) {
      statusDiv.textContent = "Keine Spiele gefunden.";
      return;
    }

    // Spieler Optionen füllen
    const players = new Set();
    games.forEach(g => g.playerProps?.forEach(p => players.add(p.name)));
    playerSelect.innerHTML = "";
    Array.from(players).sort().forEach(name => {
      const option = document.createElement("option");
      option.value = name; option.textContent = name;
      playerSelect.appendChild(option);
    });

    // =====================
    // Top 7 nach Wahrscheinlichkeit (Sieg/Unentschieden)
    // =====================
    const top7Prob = [...games].map(g => {
      const best = g.prob.home>g.prob.away&&g.prob.home>g.prob.draw?{type:"1",val:g.prob.home}:
                   g.prob.away>g.prob.home&&g.prob.away>g.prob.draw?{type:"2",val:g.prob.away}:{type:"X",val:g.prob.draw};
      return {...g,best};
    }).sort((a,b)=>b.best.val - a.best.val).slice(0,7);

    const topProbDiv = document.createElement("div");
    topProbDiv.className="mb-4 p-3 bg-gray-200 rounded";
    topProbDiv.innerHTML = `<h2 class="font-bold mb-2">🏅 Top 7 Spiele nach Trefferwahrscheinlichkeit</h2>
      <ul>${top7Prob.map(g=>`<li>${g.home} vs ${g.away} → Tipp <b>${g.best.type}</b> ${(g.best.val*100).toFixed(1)}%</li>`).join("")}</ul>`;
    matchList.appendChild(topProbDiv);

    // =====================
    // Top 5 nach Value
    // =====================
    const markets = ["home","draw","away","over25","btts"];
    markets.forEach(market=>{
      const top5 = [...games].sort((a,b)=> (b.value[market]||0) - (a.value[market]||0)).slice(0,5);
      const div = document.createElement("div");
      div.className="mb-4 p-3 bg-gray-100 rounded";
      const title = market==="home"||market==="draw"||market==="away"?"💰 Top 5 Value Sieg/Unentschieden":
                    market==="over25"?"💰 Top 5 Value Over 2.5":"💰 Top 5 Value BTTS";
      div.innerHTML = `<h2 class="font-bold mb-2">${title}</h2>
        <ul>${top5.map(g=>`<li>${g.home} vs ${g.away} → ${(g.value[market]*100).toFixed(1)}%</li>`).join("")}</ul>`;
      matchList.appendChild(div);
    });

    // =====================
    // Spiele Karten
    // =====================
    games.forEach(g => {
      const card = document.createElement("div");
      card.className = "match-card p-3 mb-4 border rounded bg-white shadow";

      const homeVal = g.prob.home*100;
      const drawVal = g.prob.draw*100;
      const awayVal = g.prob.away*100;
      const overVal = g.prob.over25*100;
      const bttsVal = g.prob.btts*100;

      let trend = homeVal>awayVal&&homeVal>drawVal?"Heimsieg":awayVal>homeVal&&awayVal>drawVal?"Auswärtssieg":"Unentschieden";
      let trendOver = overVal>50?"Over 2.5":"Under 2.5";
      let trendBTTS = bttsVal>50?"BTTS: JA":"BTTS: NEIN";

      const bestChance = Math.max(homeVal, drawVal, awayVal, overVal, bttsVal);
      const bestMarket = bestChance===homeVal?"1":bestChance===drawVal?"X":bestChance===awayVal?"2":bestChance===overVal?"Over 2.5":"BTTS Ja";

      card.innerHTML = `
        <div class="flex justify-between mb-2">
          <div><b>${g.home}</b> (${g.homeXG} xG) vs <b>${g.away}</b> (${g.awayXG} xG)</div>
          <div class="text-sm text-gray-600">${g.league}</div>
        </div>

        <div class="bar-container"><div class="bar-fill bar-home" style="width:${homeVal}%"></div><div class="bar-text">1:${homeVal.toFixed(1)}% | X:${drawVal.toFixed(1)}% | 2:${awayVal.toFixed(1)}%</div></div>
        <div class="bar-container"><div class="bar-fill bar-over" style="width:${overVal}%"></div><div class="bar-text">Over:${overVal.toFixed(1)}% | Under:${(100-overVal).toFixed(1)}%</div></div>
        <div class="bar-container"><div class="bar-fill bar-btts-yes" style="width:${bttsVal}%"></div><div class="bar-text">BTTS Ja:${bttsVal.toFixed(1)}% | Nein:${(100-bttsVal).toFixed(1)}%</div></div>

        <div class="trend">
          <span class="trend-${trend==='Heimsieg'?'home':trend==='Auswärtssieg'?'away':'draw'}">${trend}</span>
          <span class="trend-${trendOver.includes('Over')?'over':'under'}">${trendOver}</span>
          <span class="trend-${trendBTTS.includes('JA')?'btts-yes':'btts-no'}">${trendBTTS}</span>
        </div>
        <div class="text-center mt-2 font-semibold text-blue-700">👉 Empfehlung: <span class="underline">${bestMarket}</span> (${bestChance.toFixed(1)}%)</div>
      `;

      // PlayerProps Balken für ausgewählte Spieler
      g.playerProps?.filter(p=>selectedPlayers.includes(p.name)).forEach(p=>{
        const bar = document.createElement("div");
        bar.className = "bar-container mt-1";
        bar.innerHTML = `<div class="bar-fill bar-player" style="width:${p.prob*100}%"></div><div class="bar-text">${p.name}: ${(p.prob*100).toFixed(1)}%</div>`;
        card.appendChild(bar);
      });

      matchList.appendChild(card);
    });

    statusDiv.textContent = `${games.length} Spiele geladen!`;
  } catch(err) {
    statusDiv.textContent = "Fehler: "+err.message;
    console.error(err);
  }
}
