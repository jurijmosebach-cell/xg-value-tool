const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const topValueDiv = document.getElementById("top-value") || document.getElementById("top-value");
const topXGDiv = document.getElementById("top-xg") || document.getElementById("top-xg");
const dateInput = document.getElementById("match-date");

// set today
const today = new Date().toISOString().slice(0,10);
if (dateInput) dateInput.value = today;

refreshBtn?.addEventListener("click", loadMatches);
loadMatches();

function safeFixed(v, n = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  return Number(v).toFixed(n);
}

// compute draw probability consistent with server logic
function computeProbFromXG(homeXG, awayXG) {
  const total = (homeXG || 0) + (awayXG || 0);
  if (!total) return { home: 0.33, draw: 0.34, away: 0.33 };
  const home = homeXG / total;
  const away = awayXG / total;
  const draw = Math.max(0, 1 - (home + away)); // might be 0 in this simple model
  // if draw is 0 (rare), we re-normalize to keep some draw mass
  if (draw === 0) {
    // give small draw mass based on closeness
    const closeness = 1 - Math.abs(home - away); // 0..1
    const drawAdj = 0.15 * closeness;
    const scale = 1 - drawAdj;
    return { home: home * scale, draw: drawAdj, away: away * scale };
  }
  return { home, draw, away };
}

// heuristic overProb from total xG (smooth)
function estimateOverProb(totalXG) {
  // map totalXG from [0,4+] to [0,1] with a smooth curve
  // 2.7+ -> strong over, 2.3- -> strong under
  // use logistic-ish mapping
  const x = (totalXG - 2.4); // center near 2.4
  const prob = 1 / (1 + Math.exp(-1.6 * x)); // steepness tuned
  return Math.min(Math.max(prob, 0), 1);
}

// helper to create a colored div
function createDiv(classes = "", inner = "") {
  const d = document.createElement("div");
  if (classes) d.className = classes;
  if (inner !== undefined) d.innerHTML = inner;
  return d;
}

// animate a width style from 0 to target (ms)
function animateWidth(el, targetPercent, ms = 800) {
  // init
  el.style.width = "0%";
  el.style.transition = `width ${ms}ms ease`;
  // force reflow then set
  requestAnimationFrame(() => {
    el.style.width = `${targetPercent}%`;
  });
}

async function loadMatches() {
  const date = dateInput?.value;
  if (!date) {
    statusDiv.textContent = "Bitte Datum wählen!";
    return;
  }

  statusDiv.textContent = "Lade aktuelle Spiele...";
  matchList.innerHTML = "";
  if (topValueDiv) topValueDiv.innerHTML = "";
  if (topXGDiv) topXGDiv.innerHTML = "";

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const data = await res.json();

    // server returns { response: games, top7Value, top3xG } (see server.js)
    const games = data?.response || [];
    const top7Value = data?.top7Value || [];
    const top3xG = data?.top3xG || [];

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele für dieses Datum!";
      return;
    }

    // ===== TOP 7 Value Dashboard =====
    if (top7Value && top7Value.length) {
      top7Value.forEach(g => {
        const bestValPct = (g.bestValue || 0) * 100;
        const barColor = (g.bestValue > 0.12) ? "bg-green-500" : (g.bestValue > 0.05) ? "bg-yellow-500" : "bg-red-500";

        const row = createDiv("flex items-center justify-between mb-2");
        const label = createDiv("text-sm text-gray-100 truncate", `<strong>${g.home}</strong> vs <strong>${g.away}</strong> → ${g.market.toUpperCase()} ${bestValPct.toFixed(1)}%`);
        const barWrap = createDiv("relative w-40 h-4 bg-gray-700 rounded-full overflow-hidden ml-4");
        const barFill = createDiv(`${barColor} h-full`, "");
        barFill.style.width = "0%";
        barWrap.appendChild(barFill);

        // tooltip small with odds/xg if present (some servers include)
        const tooltip = createDiv("text-xs text-gray-300 mt-1", 
          `xG: ${g.homeXG ?? "-"} / ${g.awayXG ?? "-"} | Value: ${bestValPct.toFixed(1)}%`);
        row.appendChild(label);
        row.appendChild(barWrap);
        const container = createDiv("mb-2");
        container.appendChild(row);
        container.appendChild(tooltip);
        topValueDiv.appendChild(container);

        // animate
        animateWidth(barFill, Math.min(g.bestValue * 120 + 40, 100), 900);
      });
    } else {
      topValueDiv.innerHTML = "<div class='text-gray-300'>Keine Value-Tipps gefunden.</div>";
    }

    // ===== TOP 3 xG =====
    if (top3xG && top3xG.length) {
      top3xG.forEach(f => {
        const div = createDiv("text-gray-100 mb-1", `<strong>${f.home}</strong> vs <strong>${f.away}</strong> → ${(f.homeXG + f.awayXG).toFixed(2)} xG`);
        topXGDiv.appendChild(div);
      });
    }

    // ===== MATCH LIST (with animated bars) =====
    games.forEach((g, idx) => {
      // safe numbers
      const homeXG = Number(g.homeXG || 0);
      const awayXG = Number(g.awayXG || 0);
      const totalXG = Number(g.totalXG || (homeXG + awayXG));
      const oddsHome = Number(g.odds?.home || 0);
      const oddsDraw = Number(g.odds?.draw || 0);
      const oddsAway = Number(g.odds?.away || 0);
      const oddsOver = Number(g.odds?.over25 || 0);

      // compute model probs from xG
      const probs = computeProbFromXG(homeXG, awayXG); // {home, draw, away}
      // estimate overProb
      const overProb = estimateOverProb(totalXG);

      // decide tendency labels
      const maxResProb = Math.max(probs.home, probs.draw, probs.away);
      const tendencyRes = (maxResProb === probs.home) ? "1" : (maxResProb === probs.draw) ? "X" : "2";
      const tendencyOver = overProb >= 0.6 ? "Over 2.5" : (overProb <= 0.4 ? "Under 2.5" : "Neutral");

      // prepare card
      const card = createDiv("match-card opacity-0 transform translate-y-3");
      // header and basic info
      const header = `
        <div class="flex justify-between items-center mb-3">
          <div class="flex items-center gap-3">
            <img src="${g.homeLogo || `https://flagcdn.com/48x36/eu.png`}" class="w-10 h-10 rounded-full" alt="${g.home}"/>
            <div><div class="font-bold text-lg text-gray-100">${g.home}</div><div class="text-xs text-gray-400">${homeXG} xG</div></div>
          </div>
          <span class="text-xs bg-cyan-900 text-cyan-300 px-3 py-1 rounded-full">${g.league}</span>
          <div class="flex items-center gap-3 text-right">
            <div><div class="font-bold text-lg text-gray-100">${g.away}</div><div class="text-xs text-gray-400">${awayXG} xG</div></div>
            <img src="${g.awayLogo || `https://flagcdn.com/48x36/eu.png`}" class="w-10 h-10 rounded-full" alt="${g.away}"/>
          </div>
        </div>
        <div class="text-amber-300 text-sm mb-2">
          1: ${oddsHome ? safeFixed(oddsHome,2) : "-"} | X: ${oddsDraw ? safeFixed(oddsDraw,2) : "-"} | 2: ${oddsAway ? safeFixed(oddsAway,2) : "-"}
        </div>
        <div class="text-sm mb-2 text-gray-300">
          Over 2.5: ${oddsOver ? safeFixed(oddsOver,2) : "-"}  •  total xG: ${totalXG.toFixed(2)}
        </div>
      `;
      card.innerHTML = header;

      // ----- Result (1/X/2) segmented bar -----
      const resWrap = createDiv("mb-2");
      const resLabel = createDiv("text-sm text-gray-200 mb-1", `<strong>Tendenz (1 / X / 2):</strong> ${tendencyRes}`);
      const resBarOuter = createDiv("relative w-full h-5 bg-gray-800 rounded-full overflow-hidden border border-gray-700");
      const segHome = createDiv("absolute left-0 top-0 h-full bg-blue-500");
      const segDraw = createDiv("absolute top-0 h-full bg-gray-500");
      const segAway = createDiv("absolute top-0 h-full bg-orange-500");
      // initial widths 0
      segHome.style.width = "0%";
      segDraw.style.width = "0%";
      segAway.style.width = "0%";
      // attach
      resBarOuter.appendChild(segHome);
      resBarOuter.appendChild(segDraw);
      resBarOuter.appendChild(segAway);
      // overlay text
      const resText = createDiv("absolute inset-0 flex items-center justify-center text-xs font-bold text-white", 
        `${(probs.home*100).toFixed(0)}% / ${(probs.draw*100).toFixed(0)}% / ${(probs.away*100).toFixed(0)}%`);
      resBarOuter.appendChild(resText);

      resWrap.appendChild(resLabel);
      resWrap.appendChild(resBarOuter);
      card.appendChild(resWrap);

      // ----- Over/Under bar -----
      const ouWrap = createDiv("mb-2");
      const ouLabel = createDiv("text-sm text-gray-200 mb-1", `<strong>Tendenz (Over/Under):</strong> ${tendencyOver}`);
      const ouBarOuter = createDiv("relative w-full h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700");
      const ouFill = createDiv(`${overProb > 0.6 ? "bg-green-500" : overProb < 0.4 ? "bg-red-500" : "bg-yellow-500"} h-full`);
      ouFill.style.width = "0%";
      // overlay percent
      const ouText = createDiv("absolute inset-0 flex items-center justify-center text-xs font-bold text-white", `${(overProb*100).toFixed(0)}% Over`);
      ouBarOuter.appendChild(ouFill);
      ouBarOuter.appendChild(ouText);

      ouWrap.appendChild(ouLabel);
      ouWrap.appendChild(ouBarOuter);
      card.appendChild(ouWrap);

      // ----- Value bar (existing) -----
      const bestValue = Math.max(g.value?.home || 0, g.value?.draw || 0, g.value?.away || 0, g.value?.over25 || 0);
      const valuePercent = (bestValue * 100).toFixed(1);
      const valColorClass = bestValue > 0.12 ? "bg-green-500" : bestValue > 0.05 ? "bg-yellow-500" : "bg-red-500";
      const valOuter = createDiv("relative h-8 bg-gray-700 rounded-full overflow-hidden mt-2");
      const valFill = createDiv(`${valColorClass} h-full`, "");
      valFill.style.width = "0%";
      const valText = createDiv("absolute inset-0 flex items-center justify-center font-bold text-white text-sm", `${marketLabelFromValue(g)} ${valuePercent}% Value`);
      valOuter.appendChild(valFill);
      valOuter.appendChild(valText);
      card.appendChild(valOuter);

      // fade-in + append
      matchList.appendChild(card);
      // trigger fade in (small stagger)
      setTimeout(() => {
        card.style.transition = "opacity 400ms ease, transform 400ms ease";
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      }, 40 * (idx % 12)); // small stagger

      // animate bars after appended
      // result segments widths from probs (sum must be 100)
      const homePct = Math.round(probs.home * 100);
      const drawPct = Math.round(probs.draw * 100);
      const awayPct = Math.max(0, 100 - homePct - drawPct); // adjust last to keep sum 100
      // place segments: segHome width = homePct, segDraw positioned left = homePct, segAway left = homePct+drawPct
      segHome.style.left = "0%";
      segHome.style.zIndex = "10";
      segDraw.style.left = `${homePct}%`;
      segDraw.style.zIndex = "9";
      segAway.style.left = `${homePct + drawPct}%`;
      segAway.style.zIndex = "8";

      // set widths with animation
      animateWidth(segHome, homePct, 900);
      animateWidth(segDraw, drawPct, 900);
      animateWidth(segAway, awayPct, 900);

      // ou and value fills
      animateWidth(ouFill, Math.round(overProb * 100), 900);
      animateWidth(valFill, Math.min(bestValue * 120 + 40, 100), 900);
    });

    statusDiv.textContent = `${games.length} Spiele geladen!`;
  } catch (err) {
    statusDiv.textContent = "Fehler: " + err.message;
    console.error(err);
  }
}

// helper to choose label for value bar center text
function marketLabelFromValue(g) {
  const v = g?.value || {};
  const best = Math.max(v.home || 0, v.draw || 0, v.away || 0, v.over25 || 0);
  if (best === v.home) return "1";
  if (best === v.draw) return "X";
  if (best === v.away) return "2";
  if (best === v.over25) return "O2.5";
  return "";
}
