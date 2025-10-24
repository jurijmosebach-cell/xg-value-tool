const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const PORT = process.env.PORT || 10000;

const LEAGUES = [
  { name: 'Premier League', oddsKey: 'soccer_epl', footballId: 39 },
  { name: 'Bundesliga', oddsKey: 'soccer_germany_bundesliga', footballId: 78 },
  { name: 'La Liga', oddsKey: 'soccer_spain_la_liga', footballId: 140 },
  { name: 'Serie A', oddsKey: 'soccer_italy_serie_a', footballId: 135 },
  { name: 'Ligue 1', oddsKey: 'soccer_france_ligue_one', footballId: 61 },
  { name: 'Champions League', oddsKey: 'soccer_europe_champions_league', footballId: 2 },
];

const app = express();
app.use(cors());
app.use(express.static('public'));

function dateISOstr(date = new Date()) { return date.toISOString().slice(0, 10); }

async function getOdds(oddsKey, date) {
  const url = `https://api.the-odds-api.com/v4/sports/${oddsKey}/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&dateFormat=iso&oddsFormat=decimal`;
  let res = await axios.get(url);
  return res.data.filter(g => g.commence_time.startsWith(date));
}

async function getXGAndScorers(leagueId, date) {
  // Spiele
  const fixturesRes = await axios.get('https://v3.football.api-sports.io/fixtures', {
    params: { league: leagueId, season: 2023, date }, // ggf. Saison anpassen!
    headers: { 'x-apisports-key': API_FOOTBALL_KEY }
  });
  const fixtures = fixturesRes.data.response;
  let xgData = {}, scorerData = {};
  for (let f of fixtures) {
    const key = `${f.teams.home.name}_${f.teams.away.name}`;
    // xG
    let xg = { home_xg: 1.3, away_xg: 1.1 };
    try {
      const statsRes = await axios.get('https://v3.football.api-sports.io/fixtures/statistics', {
        params: { fixture: f.fixture.id },
        headers: { 'x-apisports-key': API_FOOTBALL_KEY }
      });
      const h = statsRes.data.response[0]?.statistics?.find(s => s.type === 'Expected goals');
      const a = statsRes.data.response[1]?.statistics?.find(s => s.type === 'Expected goals');
      xg.home_xg = h?.value || 1.3;
      xg.away_xg = a?.value || 1.1;
    } catch {}
    xgData[key] = xg;

    // Scorer
    try {
      const scorerRes = await axios.get('https://v3.football.api-sports.io/players/topscorers', {
        params: { league: leagueId, season: 2023 },
        headers: { 'x-apisports-key': API_FOOTBALL_KEY }
      });
      scorerData[key] = scorerRes.data.response
        .filter(p => [f.teams.home.id, f.teams.away.id].includes(p.statistics[0]?.team?.id))
        .slice(0, 3)
        .map(p => ({
          name: p.player.name,
          team: p.statistics[0].team.name,
          goals: p.statistics[0].goals.total,
        }));
    } catch { scorerData[key] = []; }
  }
  return { xgData, scorerData };
}

app.get('/api/allvalue', async (req, res) => {
  const date = req.query.date || dateISOstr();
  let result = [];
  for (let liga of LEAGUES) {
    try {
      const oddsGames = await getOdds(liga.oddsKey, date);
      const { xgData, scorerData } = await getXGAndScorers(liga.footballId, date);

      for (let g of oddsGames) {
        const key = `${g.home_team}_${g.away_team}`;
        const xg = xgData[key] || { home_xg: 1.3, away_xg: 1.1 };
        const scorers = scorerData[key] || [];
        // Over/Under Value
        const total_xg = xg.home_xg + xg.away_xg;
        const getValue = (prob, quote) => quote * prob - 1;
        const ouMarkets = g.bookmakers[0]?.markets.filter(m => m.key === 'totals') || [];
        const ouValues = [];
        for (let l of [1.5, 2.5, 3.5]) {
          const market = ouMarkets.flatMap(m => m.outcomes.filter(o => o.point == l));
          for (let o of market) {
            let overProb = Math.min(1, total_xg / (l * 0.95));
            let prob = o.name.startsWith('Over') ? overProb : 1 - overProb;
            ouValues.push({
              name: `${o.name} ${o.point}`,
              quote: o.price,
              value: getValue(prob, o.price),
              prob: (prob * 100).toFixed(1) + '%'
            });
          }
        }
        // H2H Value
        const h2hMarket = g.bookmakers[0]?.markets.find(m => m.key === 'h2h');
        let h2hValues = [];
        if (h2hMarket) {
          const sumInv = h2hMarket.outcomes.reduce((acc, out) => acc + 1 / out.price, 0);
          h2hValues = h2hMarket.outcomes.map(out => {
            const prob = (1 / out.price) / sumInv;
            return {
              name: out.name,
              quote: out.price,
              value: getValue(prob, out.price),
              prob: (prob * 100).toFixed(1) + '%'
            };
          });
        }
        result.push({
          liga: liga.name,
          home: g.home_team,
          away: g.away_team,
          start: g.commence_time,
          xg,
          h2h: h2hValues,
          ou: ouValues,
          scorers
        });
      }
    } catch (e) {
      // Liga hat vielleicht kein Spiel am Tag
    }
  }
  res.json({ games: result });
});

app.get("/", (req, res) => res.redirect("/index.html"));

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
