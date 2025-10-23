// app.js — FIXED 23.10.2025 (Render Version)
const API_BASE = "/";
const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const toggleSampleBtn = document.getElementById("toggle-sample");
const statusDiv = document.getElementById("status");
const leagueSelect = document.getElementById("league-select");
const dateInput = document.getElementById("match-date");
const filterValue = document.getElementById("filter-value");

let useSample = false;
dateInput.value = new Date().toISOString().slice(0, 10);

refreshBtn.addEventListener("click", loadMatches);
toggleSampleBtn.addEventListener("click", () => {
  useSample = !useSample;
  toggleSampleBtn.textContent = useSample ? "API-Daten" : "Beispieldaten";
  loadMatches();
});

// === POISSON FUNCTIONS ===
function poisson(lambda) {
  const probs = [];
  let p = Math.exp(-lambda);
  probs.push(p);
  for (let k = 1; k < 10; k++) { p *= lambda / k; probs.push(p); }
  return probs;
}

function calculatePoissonProbability(homeXG, awayXG, outcome) {
  const h = poisson(homeXG), a = poisson(awayXG);
  if (outcome === "home") {
    return h.reduce((s, pH, i) => s + pH * a.slice(0, i).reduce((x, y) => x + y, 0), 0);
  } else {
    return a.reduce((s, pA, i) => s + pA * h.slice(0, i).reduce((x, y) => x + y, 0), 0);
  }
}

function calculateOverUnderProbability(homeXG, awayXG, goals) {
  const totalXG = homeXG + awayXG;
  const probs = poisson(totalXG);
  return probs.slice(goals + 1).reduce((a, b) => a + b, 0);
}

function calculateBTTSProbability(homeXG, awayXG) {
  const h = poisson(homeXG), a = poisson(awayXG);
  let both = 0;
  for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) both += h[i] * a[j];
  return both;
}

function calculateAsianHandicapProbability(homeXG, awayXG, handicap) {
  const diff = homeXG - awayXG - handicap;
  const probs = poisson(Math.abs(diff));
  return diff >= 0 ? 1 - probs[0] : probs[0];
}

// === LOAD MATCHES ===
async function loadMatches() {
  matchList.innerHTML = "";
  const date = dateInput.value;
  const minValue = parseFloat(filterValue.value) || 0;
  const league = leagueSelect.value;

  statusDiv.textContent = useSample ? "Lade Beispieldaten..." : "Lade Live-Quoten & xG...";

  try {
    // === Fixtures ===
    let fixtures;
    if (useSample) {
      fixtures = await fetch("./sample-fixtures.json").then(r => r.json()).catch(() => ({ response: [] }));
    } else {
      const res = await fetch(`${API_BASE}fixtures?date=${date}`);
      if (!res.ok) throw new Error("Fixtures fehlgeschlagen");
      fixtures = await res.json();
    }

    if (!fixtures.response || fixtures.response.length === 0) {
      matchList.innerHTML = `<div class="no-data">Keine Spiele gefunden</div>`;
      statusDiv.textContent = "";
      return;
    }

    let games = fixtures.response;
    if (league !== "all") {
      games = games.filter(g => g.league.name.replace(/\s/g, "_") === league);
    }

    // === ODDS ===
    let oddsRaw = {};
    try {
      const oddsRes = await fetch(`${API_BASE}odds?date=${date}`);
      const oddsJson = await oddsRes.json();

      // Falls API im "response"-Format liefert, umwandeln:
      if (Array.isArray(oddsJson.response)) {
        for (const g of oddsJson.response) {
          const home = g.teams?.home?.name || "Home";
          const away = g.teams?.away?.name || "Away";
          const key = `${home} vs ${away}`;
          const site = g.bookmakers?.[0]?.bets?.[0]?.values || [];
          oddsRaw[key] = {
            home: parseFloat(site[0]?.odd) || 2.0,
            draw: parseFloat(site[1]?.odd) || 3.3,
            away: parseFloat(site[2]?.odd) || 3.4,
            over25: 1.8,
            under25: 2.0,
            bttsYes: 1.7,
            bttsNo: 2.2
