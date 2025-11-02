const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");
const leagueSelect = document.getElementById("league-select");

dateInput.value = new Date().toISOString().slice(0,10);

refreshBtn.addEventListener("click", loadMatches);

async function loadMatches() {
  const date = dateInput.value;
  const leagues = Array.from(leagueSelect.selectedOptions).map(o=>o.value);

  if (!date) { statusDiv.textContent="Bitte Datum wählen!"; return; }
  if (!leagues.length) { statusDiv.textContent="Bitte mindestens eine Liga wählen!"; return; }

  statusDiv.textContent = "Lade Spiele...";
  matchList.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}&leagues=${leagues.join(",")}`);
    const data = await res.json();
    const games = data.response || [];

    if (!games.length) { statusDiv.textContent="Keine Spiele gefunden."; return; }

    renderDashboard(games);
    statusDiv.textContent = `${games.length} Spiele geladen!`;

  } catch(e) {
    console.error(e);
    statusDiv.textContent = "Fehler: "+e.message;
  }
}

function renderDashboard(games) {
  matchList.innerHTML="";

  // --- Top 10 1X2 ---
  const top10 = [...games].map(g=>{
    const best = g.prob.home>g.prob.away && g.prob.home>g.prob.draw ? {type:"1",val:g.prob.home} :
                 g.prob.away>g.prob.home && g.prob.away>g.prob.draw ? {type:"2",val:g.prob.away} :
                 {type:"X",val:g.prob.draw};
    return {...g,best};
  }).sort((a,b)=>b.best.val-a.best.val).slice(0,10);

  const topSection = document.createElement("div");
  topSection.className="top-section";
  topSection.innerHTML=`<h2>🏅 Top 10 Siegwahrscheinlichkeiten</h2>
    <ul>${top10.map(g=>`<li>${g.home} vs ${g.away} → <b>${g.best.type}</b> (${(g.best.val*100).toFixed(1)}%)</li>`).join('')}</ul>`;
  matchList.appendChild(topSection);

  // --- Top 5 Value ---
  const allValues = games.flatMap(g=>[
    {home:g.home,away:g.away,market:"1",val:g.value.home,prob:g.prob.home},
    {home:g.home,away:g.away,market:"X",val:g.value.draw,prob:g.prob.draw},
    {home:g.home,away:g.away,market:"2",val:g.value.away,prob:g.prob.away},
    {home:g.home,away:g.away,market:"Over 2.5",val:g.value.over25,prob:g.prob.over25},
    {home:g.home,away:g.away,market:"BTTS",val:g.value.btts,prob:g.prob.btts}
  ]).filter(v=>v.val>0.03).sort((a,b)=>b.val-a.val).slice(0,5);

  const valueSection = document.createElement("div");
  valueSection.className="top-section";
  valueSection.innerHTML=`<h2>💰 Top 5 Value Bets</h2>`+
    (allValues.length ? `<ul>${allValues.map(v=>`<li><b>${v.market}</b> (${(v.val*100).toFixed(1)}%) — ${v.home} vs ${v.away}</li>`).join('')}</ul>` : "<p>Keine Value Bets 🔍</p>");
  matchList.appendChild(valueSection);

  // --- Top 5 Over 2.5 ---
  const topOver = [...games].sort((a,b)=>b.prob.over25-a.prob.over25).slice(0,5);
  const overSection = document.createElement("div");
  overSection.className="top-section";
  overSection.innerHTML=`<h2>🔝 Top 5 Over 2.5</h2>
    <ul>${topOver.map(g=>`<li>${g.home} vs ${g.away} → ${(g.prob.over25*100).toFixed(1)}%</li>`).join('')}</ul>`;
  matchList.appendChild(overSection);

  // --- Top 5 BTTS ---
  const topBTTS = [...games].sort((a,b)=>b.prob.btts-a.prob.btts).slice(0,5);
  const bttsSection = document.createElement("div");
  bttsSection.className="top-section";
  bttsSection.innerHTML=`<h2>⚡ Top 5 BTTS</h2>
    <ul>${topBTTS.map(g=>`<li>${g.home} vs ${g.away} → BTTS Ja ${(g.prob.btts*100).toFixed(1)}%</li>`).join('')}</ul>`;
  matchList.appendChild(bttsSection);

  // --- Restliche Spiele nach Liga ---
  const leagues = [...new Set(games.map(g=>g.league))];
  leagues.forEach(leagueName=>{
    const leagueGames = games.filter(g=>g.league===leagueName);
    const leagueSection = document.createElement("div");
    leagueSection.className="top-section";
    leagueSection.innerHTML=`<h3>${leagueName}</h3>`;
    leagueGames.forEach(g=>{
      const card = document.createElement("div");
      card.className="match-card";

      const homeVal = g.prob.home*100;
      const drawVal = g.prob.draw*100;
      const awayVal = g.prob.away*100;
      const overVal = g.prob.over25*100;
      const bttsVal = g.prob.btts*100;

      const trend1X2 = homeVal>awayVal && homeVal>drawVal ? "Heimsieg" : awayVal>homeVal && awayVal>drawVal ? "Auswärtssieg" : "Unentschieden";
      const trendOver = overVal>50 ? "Over 2.5" : "Under 2.5";
      const trendBTTS = bttsVal>50 ? "BTTS Ja" : "BTTS Nein";
      const bestChance = Math.max(homeVal, drawVal, awayVal, overVal, bttsVal);
      const bestMarket = bestChance===homeVal ? "1" : bestChance===drawVal ? "X" : bestChance===awayVal ? "2" : bestChance===overVal ? "Over 2.5" : "BTTS Ja";

      card.innerHTML = `
        <div class="match-header">
          <div class="team">
            <img src="${g.homeLogo}" alt="${g.home}" />
            <div>
              <div>${g.home}</div>
              <div>${g.homeXG} xG</div>
            </div>
          </div>
          <div class="team">
            <div>
              <div>${g.away}</div>
              <div>${g.awayXG} xG</div>
            </div>
            <img src="${g.awayLogo}" alt="${g.away}" />
          </div>
        </div>
        <div>1:${g.odds.home.toFixed(2)} | X:${g.odds.draw.toFixed(2)} | 2:${g.odds.away.toFixed(2)}</div>
        <div class="bar-container"><div class="bar-fill bar-home" style="width:${homeVal}%"></div><div class="bar-text">1:${homeVal.toFixed(1)}% | X:${drawVal.toFixed(1)}% | 2:${awayVal.toFixed(1)}%</div></div>
        <div class="bar-container"><div class="bar-fill bar-over" style="width:${overVal}%"></div><div class="bar-text">Over:${overVal.toFixed(1)}% | Under:${(100-overVal).toFixed(1)}%</div></div>
        <div class="bar-container"><div class="bar-fill bar-btts-yes" style="width:${bttsVal}%"></div><div class="bar-text">BTTS Ja:${bttsVal.toFixed(1)}% | Nein:${(100-bttsVal).toFixed(1)}%</div></div>
        <div class="trend">
          <span class="trend-${trend1X2==='Heimsieg'?'home':trend1X2==='Auswärtssieg'?'away':'draw'}">${trend1X2}</span>
          <span class="trend-${trendOver.includes('Over')?'over':'under'}">${trendOver}</span>
          <span class="trend-${trendBTTS.includes('Ja')?'btts-yes':'btts-no'}">${trendBTTS}</span>
        </div>
        <div class="text-center">👉 Empfehlung: <b>${bestMarket}</b> (${bestChance.toFixed(1)}%)</div>
      `;
      leagueSection.appendChild(card);
    });
    matchList.appendChild(leagueSection);
  });
}
