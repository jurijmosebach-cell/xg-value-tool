import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// === Pfade korrekt auflösen (da kein public) ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === API Keys ===
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const API_FOOTBALL_URL = "https://v3.football.api-sports.io";

// === Cache ===
const CACHE_FILE = path.join(__dirname, "cache.json");
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
}

// === Ligenliste ===
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", id: 39 },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", id: 78 },
  { key: "soccer_spain_la_liga", name: "La Liga", id: 140 },
  { key: "soccer_italy_serie_a", name: "Serie A", id: 135 },
  { key: "soccer_france_ligue_one", name: "Ligue 1", id: 61 },
  { key: "soccer_netherlands_eredivisie", name: "Eredivisie", id: 88 },
  { key: "soccer_uefa_champs_league", name: "UEFA Champions League", id: 2 },
];

// === Middleware ===
app.use(express.json());

// === Root liefert direkt index.html ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// === API ROUTE: Ligen an Frontend ===
app.get("/api/leagues", (req, res) => {
  res.json(LEAGUES);
});

// === Cache speichern ===
function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// === Helper: gewichtete Formberechnung ===
function weightedForm(matches, isHome) {
  if (!matches || matches.length === 0) return 0;

  let score = 0;
  let totalWeight = 0;

  matches.slice(-10).forEach((m, i) => {
    const weight = 1 + i * 0.1;
    const goalsFor = isHome ? m.goals.for : m.goals.against;
    const goalsAgainst = isHome ? m.goals.against : m.goals.for;
    const points =
      goalsFor > goalsAgainst ? 3 : goalsFor === goalsAgainst ? 1 : 0;
    score += points * weight;
    totalWeight += weight;
  });

  const avg = score / (totalWeight * 3);
  const adjusted = avg * (isHome ? 1.03 : 0.97); // Heimbonus
  return Math.min(1, adjusted);
}

// === API ROUTE: Spiele abrufen ===
app.get("/api/games", async (req, res) => {
  try {
    const { date, leagues } = req.query;
    const selected = leagues ? leagues.split(",") : LEAGUES.map(l => l.key);
    const results = [];

    for (const leagueKey of selected) {
      const league = LEAGUES.find(l => l.key === leagueKey);
      if (!league) continue;

      const cacheKey = `${league.key}_${date}`;
      const now = Date.now();

      if (cache[cacheKey] && now - cache[cacheKey].timestamp < 12 * 60 * 60 * 1000) {
        console.log(`✅ Cache verwendet für ${league.name}`);
        results.push(...cache[cacheKey].data);
        continue;
      }

      console.log(`🌍 Lade ${league.name} (${date}) von API-Football ...`);
      const url = `${API_FOOTBALL_URL}/fixtures?league=${league.id}&season=2025&date=${date}`;

      const response = await axios.get(url, {
        headers: { "x-apisports-key": API_FOOTBALL_KEY },
      });

      const fixtures = response.data.response || [];
      const processed = [];

      for (const f of fixtures) {
        const home = f.teams.home.name;
        const away = f.teams.away.name;

        // Letzte 10 Spiele für beide Teams abrufen
        const [homeForm, awayForm] = await Promise.all([
          axios.get(`${API_FOOTBALL_URL}/fixtures?team=${f.teams.home.id}&last=10`, {
            headers: { "x-apisports-key": API_FOOTBALL_KEY },
          }),
          axios.get(`${API_FOOTBALL_URL}/fixtures?team=${f.teams.away.id}&last=10`, {
            headers: { "x-apisports-key": API_FOOTBALL_KEY },
          }),
        ]);

        const homeMatches = homeForm.data.response.map(m => ({
          goals: { for: m.goals.for.total, against: m.goals.against.total },
        }));
        const awayMatches = awayForm.data.response.map(m => ({
          goals: { for: m.goals.for.total, against: m.goals.against.total },
        }));

        const homeStrength = weightedForm(homeMatches, true);
        const awayStrength = weightedForm(awayMatches, false);

        const total = homeStrength + awayStrength;
        const probHome = total > 0 ? homeStrength / total : 0.33;
        const probAway = total > 0 ? awayStrength / total : 0.33;
        const probDraw = 1 - (probHome + probAway);

        const odds = f.odds?.[0]?.bookmakers?.[0]?.bets?.[0]?.values || [];
        const o1 = odds[0]?.odd || 2.0;
        const ox = odds[1]?.odd || 3.2;
        const o2 = odds[2]?.odd || 3.4;

        const valueHome = probHome * o1 - 1;
        const valueDraw = probDraw * ox - 1;
        const valueAway = probAway * o2 - 1;

        processed.push({
          league: league.name,
          home,
          away,
          homeXG: homeStrength * 2.5,
          awayXG: awayStrength * 2.5,
          prob: {
            home: probHome,
            draw: probDraw,
            away: probAway,
            over25: (homeStrength + awayStrength) / 2,
            btts: Math.min(1, (homeStrength + awayStrength) / 1.8),
          },
          value: { home: valueHome, draw: valueDraw, away: valueAway },
        });
      }

      cache[cacheKey] = { timestamp: now, data: processed };
      saveCache();

      console.log(`✅ ${processed.length} Spiele aus ${league.name} verarbeitet.`);
      results.push(...processed);
    }

    const avgXG =
      results.reduce((sum, g) => sum + g.homeXG + g.awayXG, 0) / (results.length || 1);
    console.log(`📊 Gesamt xG-Durchschnitt: ${avgXG.toFixed(2)}`);

    res.json({ response: results });
  } catch (err) {
    console.error("❌ Fehler beim Abruf:", err.message);
    res.status(500).json({ error: "Fehler beim Abruf der Spiele." });
  }
});

// === TEST-ROUTE ===
app.get("/api/test", async (req, res) => {
  try {
    const r = await axios.get(`${API_FOOTBALL_URL}/status`, {
      headers: { "x-apisports-key": API_FOOTBALL_KEY },
    });
    res.json({ ok: true, api_status: r.data });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// === Server Start ===
app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
});
