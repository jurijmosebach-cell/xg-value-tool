// server.js — komplett überarbeitet, dynamische Märkte + MLS + Top-Tipps
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const ODDS_API_KEY = process.env.ODDS_API_KEY;
if (!ODDS_API_KEY) console.error("FEHLER: ODDS_API_KEY fehlt!");

const PORT = process.env.PORT || 10000;

// ⚽ Ligen
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League" },
  { key: "soccer_germany_bundesliga", name: "Bundesliga" },
  { key: "soccer_spain_la_liga", name: "La Liga" },
  { key: "soccer_italy_serie_a", name: "Serie A" },
  { key: "soccer_france_ligue_one", name: "Ligue 1" },
  { key: "soccer_usa_mls", name: "MLS" }
];

function getFlag(team) {
  const flags = { "England": "gb", "Germany": "de", "Spain": "es", "Italy": "it", "France": "fr", "USA": "us" };
  for (const [country, flag] of Object.entries(flags)) if (team.includes(country)) return flag;
  return "eu";
}

app.get("/api/games", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const date = req.query.date || today;
  let games = [];

  for (const league of LEAGUES) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${league.key}/odds`;
      const fullUrl = `${url}?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals,btts,dnb&dateFormat=iso&oddsFormat=decimal`;

      const response = await fetch(fullUrl);
      if (!response.ok) {
        console.warn(`HTTP ${response.status} für ${league.name}`);
        continue;
      }

      const data = await response.json();
      if (!Array.isArray(data)) continue;

      for (const g of data) {
        if (!g.commence_time?.startsWith(date)) continue;

        const home = g.home_team;
        const away = g.away_team;
        const bookmakers = g.bookmakers || [];
        if (!bookmakers.length) continue;

        const book = bookmakers[0]; // erster Bookmaker
        const odds = {};

        // Dynamisch alle Märkte abfragen
        book.markets?.forEach(market => {
          if (market.key === "h2h") {
            market.outcomes.forEach(o => {
              if (o.name === home) odds.home = o.price;
              else if (o.name === away) odds.away = o.price;
              else if (o.name === "Draw") odds.draw = o.price;
            });
          } else if (market.key === "totals") {
            market.outcomes.forEach(o => {
              if (o.name === "Over" && o.point === 2.5) odds.over25 = o.price;
            });
          } else if (market.key === "btts") {
            market.outcomes.forEach(o => {
              if (o.name === "Yes") odds.bttsYes = o.price;
            });
          } else if (market.key === "dnb") {
            market.outcomes.forEach(o => {
              if (o.name === home) odds.dnbHome = o.price;
              if (o.name === away) odds.dnbAway = o.price;
            });
          }
        });

        // Falls H2H fehlt, skip
        if (!odds.home && !odds.away) continue;

        // xG Simulation
        const homeXG = 1.3 + Math.random() * 0.8;
        const awayXG = 1.2 + Math.random() * 0.7;
        const totalXG = homeXG + awayXG;

        // Wahrscheinlichkeiten
        const prob = {
          home: homeXG / totalXG,
          away: awayXG / totalXG,
          draw: 1 - (homeXG / totalXG + awayXG / totalXG),
          over25: 0.55 + Math.random() * 0.15,
          bttsYes: (homeXG > 0.8 && awayXG > 0.8) ? 0.65 : 0.45
        };

        // Value Berechnung
        const value = {
          home: odds.home ? (prob.home * odds.home - 1) : 0,
          draw: odds.draw ? (prob.draw * odds.draw - 1) : 0,
          away: odds.away ? (prob.away * odds.away - 1) : 0,
          over25: odds.over25 ? (prob.over25 * odds.over25 - 1) : 0,
          bttsYes: odds.bttsYes ? (prob.bttsYes * odds.bttsYes - 1) : 0
        };

        games.push({
          home, away, league: league.name,
          homeLogo: `https://flagcdn.com/48x36/${getFlag(home)}.png`,
          awayLogo: `https://flagcdn.com/48x36/${getFlag(away)}.png`,
          odds, value,
          totalXG: +totalXG.toFixed(2),
          homeXG: +homeXG.toFixed(2),
          awayXG: +awayXG.toFixed(2)
        });
      }
    } catch (err) {
      console.error(`Fehler ${league.name}:`, err.message);
    }
  }

  // Top 7 Value Tipps
  const top7 = [...games]
    .map(g => {
      const bestKey = Object.entries(g.value).reduce((a, b) => b[1] > a[1] ? b : a, ["", -Infinity])[0];
      return { home: g.home, away: g.away, market: bestKey, value: g.value[bestKey] };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  // Top 3 Favoriten (höchste xG Differenz)
  const top3Fav = [...games]
    .map(g => {
      const diff = g.homeXG - g.awayXG;
      return { home: g.home, away: g.away, homeXG: g.homeXG, awayXG: g.awayXG, diff };
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 3);

  res.json({ response: games, top7, top3Fav });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`LIVE: https://xg-value-tool.onrender.com`);
  console.log(`Heute: ${new Date().toISOString().slice(0, 10)}`);
});// app.js — vollständig, farbige Value Balken + Top Tipps + Top Favoriten
const matchList = document.getElementById("match-list");
const refreshBtn = document.getElementById("refresh");
const statusDiv = document.getElementById("status");
const dateInput = document.getElementById("match-date");
const topList = document.getElementById("top-list");
const topFavoritesDiv = document.getElementById("top-favorites");

// Heute als Standard
const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

refreshBtn.addEventListener("click", loadMatches);
loadMatches();

async function loadMatches() {
  const date = dateInput.value;
  if (!date) {
    statusDiv.textContent = "Bitte Datum wählen!";
    return;
  }

  statusDiv.textContent = "Lade aktuelle Spiele...";
  matchList.innerHTML = "";
  topList.innerHTML = "";
  topFavoritesDiv.innerHTML = '<h2 class="text-xl font-bold text-green-400 mb-2">Top 3 Favoriten (xG)</h2>';

  try {
    const res = await fetch(`/api/games?date=${date}`);
    const { response: games, top7, top3Fav } = await res.json();

    if (!games || games.length === 0) {
      statusDiv.textContent = "Keine Spiele für dieses Datum!";
      return;
    }

    // ----- TOP 7 Value Tipps -----
    top7.forEach(t => {
      const li = document.createElement("li");
      const valPercent = (t.value * 100).toFixed(1);
      let color = "text-red-400";
      if (valPercent > 15) color = "text-green-400";
      else if (valPercent > 5) color = "text-yellow-400";
      li.className = color;
      li.textContent = `${t.home} vs ${t.away} → ${t.market.toUpperCase()} ${valPercent}% Value`;
      topList.appendChild(li);
    });

    // ----- TOP 3 Favoriten -----
    top3Fav.forEach(f => {
      const div = document.createElement("div");
      div.className = "text-gray-200 mb-1";
      div.textContent = `${f.home} (${f.homeXG} xG) vs ${f.away} (${f.awayXG} xG)`;
      topFavoritesDiv.appendChild(div);
    });

    // ----- MATCH LIST -----
    games.forEach(g => {
      const bestValue = Math.max(g.value.home, g.value.draw, g.value.away, g.value.over25 || 0, g.value.bttsYes || 0);
      const valuePercent = (bestValue * 100).toFixed(1);
      const valueClass = bestValue > 0.12 ? "bg-green-500" : bestValue > 0.05 ? "bg-yellow-500" : "bg-red-500";
      const market = bestValue === g.value.home ? "1" :
                     bestValue === g.value.draw ? "X" :
                     bestValue === g.value.away ? "2" :
                     bestValue === g.value.over25 ? "O2.5" :
                     bestValue === g.value.bttsYes ? "BTTS" : "";

      const card = document.createElement("div");
      card.className = "bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700 mb-4";

      card.innerHTML = `
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
          1: ${g.odds.home?.toFixed(2) || "-"} | X: ${g.odds.draw?.toFixed(2) || "-"} | 2: ${g.odds.away?.toFixed(2) || "-"}
        </div>
        <div class="text-sm mb-2 text-gray-300">
          ${g.odds.over25 ? `Over 2.5: ${g.odds.over25.toFixed(2)}` : ""} 
          ${g.odds.bttsYes ? `| BTTS: ${g.odds.bttsYes.toFixed(2)}` : ""}
        </div>
        <div class="relative h-10 bg-gray-700 rounded-full overflow-hidden">
          <div class="${valueClass} h-full transition-all duration-500" style="width: ${Math.min(bestValue * 120 + 40, 100)}%"></div>
          <span class="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
            ${market} ${valuePercent}% Value
          </span>
        </div>
      `;

      matchList.appendChild(card);
    });

    statusDiv.textContent = `${games.length} aktuelle Spiele geladen!`;

  } catch (err) {
    statusDiv.textContent = "Fehler: " + err.message;
    console.error(err);
  }
}
