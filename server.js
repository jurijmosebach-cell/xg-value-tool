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

// ===== Alle Ligen =====
const LEAGUES = [
  { key: "soccer_epl", name: "Premier League", flag: "gb" },
  { key: "soccer_germany_bundesliga", name: "Bundesliga", flag: "de" },
  { key: "soccer_germany_2_bundesliga", name: "2. Bundesliga", flag: "de" },
  { key: "soccer_spain_la_liga", name: "La Liga", flag: "es" },
  { key: "soccer_italy_serie_a", name: "Serie A", flag: "it" },
  { key: "soccer_france_ligue_one", name: "Ligue 1", flag: "fr" },
  { key: "soccer_turkey_superlig", name: "Türkei Süper Lig", flag: "tr" },
  { key: "soccer_australia_a_league", name: "Australien A League", flag: "au" },
  { key: "soccer_belgium_first_division_a", name: "Belgien 1. Division A", flag: "be" },
  { key: "soccer_brazil_serie_a", name: "Brasilien Serie A", flag: "br" },
  { key: "soccer_china_super_league", name: "China Super League", flag: "cn" },
  { key: "soccer_denmark_superligaen", name: "Dänemark Superligaen", flag: "dk" },
  { key: "soccer_japan_j_league", name: "Japan J-League", flag: "jp" },
  { key: "soccer_netherlands_eredivisie", name: "Niederlande Eredivisie", flag: "nl" },
  { key: "soccer_norway_eliteserien", name: "Norwegen Eliteserien", flag: "no" },
  { key: "soccer_sweden_allsvenskan", name: "Schweden Allsvenskan", flag: "se" },
  { key: "soccer_usa_mls", name: "MLS", flag: "us" }
];

function getFlag(team) {
  const flags = { "England":"gb","Germany":"de","Spain":"es","Italy":"it","France":"fr","USA":"us",
                  "Turkey":"tr","Australia":"au","Belgium":"be","Brazil":"br","China":"cn",
                  "Denmark":"dk","Japan":"jp","Netherlands":"nl","Norway":"no","Sweden":"se" };
  for(const [country,flag] of Object.entries(flags)) if(team.includes(country)) return flag;
  return "eu";
}

app.get("/api/games", async (req,res)=>{
  const today = new Date().toISOString().slice(0,10);
  const date = req.query.date || today;
  let games = [];

  for(const league of LEAGUES){
    try{
      const url = `https://api.the-odds-api.com/v4/sports/${league.key}/odds`;
      const fullUrl = `${url}?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&dateFormat=iso&oddsFormat=decimal`;
      const response = await fetch(fullUrl);
      if(!response.ok){
        console.warn(`HTTP ${response.status} für ${league.name}`);
        continue;
      }
      const data = await response.json();
      if(!Array.isArray(data)) continue;

      for(const g of data){
        if(!g.commence_time?.startsWith(date)) continue;
        const home = g.home_team;
        const away = g.away_team;
        const bookmakers = g.bookmakers || [];
        if(bookmakers.length===0) continue;
        const book = bookmakers[0];
        const h2h = book.markets?.find(m=>m.key==="h2h")?.outcomes||[];
        const totals = book.markets?.find(m=>m.key==="totals")?.outcomes||[];

        const odds = {
          home: h2h.find(o=>o.name===home)?.price||0,
          draw: h2h.find(o=>o.name==="Draw")?.price||0,
          away: h2h.find(o=>o.name===away)?.price||0,
          over25: totals.find(o=>o.name==="Over" && o.point===2.5)?.price||0
        };

        if(odds.home===0 && odds.away===0) continue;

        const homeXG = 1.3 + Math.random()*0.7;
        const awayXG = 1.2 + Math.random()*0.6;
        const totalXG = homeXG + awayXG;

        const prob = {
          home: homeXG/totalXG,
          away: awayXG/totalXG,
          draw: 1-(homeXG/totalXG + awayXG/totalXG),
          over25: 0.55 + Math.random()*0.15
        };

        const value = {
          home: odds.home ? (prob.home*odds.home-1) : 0,
          draw: odds.draw ? (prob.draw*odds.draw-1) : 0,
          away: odds.away ? (prob.away*odds.away-1) : 0,
          over25: odds.over25 ? (prob.over25*odds.over25-1) : 0
        };

        games.push({
          home, away, league: league.name,
          homeLogo:`https://flagcdn.com/48x36/${getFlag(home)}.png`,
          awayLogo:`https://flagcdn.com/48x36/${getFlag(away)}.png`,
          odds,value,
          totalXG:+totalXG.toFixed(2),
          homeXG:+homeXG.toFixed(2),
          awayXG:+awayXG.toFixed(2)
        });
      }
    } catch(err){console.error(`Fehler ${league.name}:`,err.message);}
  }

  // ===== Top 7 Value Tipps global sortieren =====
  const top7Value = [...games]
    .map(g=>{
      const bestValue = Math.max(g.value.home,g.value.draw,g.value.away,g.value.over25);
      const market = bestValue===g.value.home?"1":bestValue===g.value.draw?"X":bestValue===g.value.away?"2":"O2.5";
      return {...g,bestValue,market};
    })
    .sort((a,b)=>b.bestValue-a.bestValue)
    .slice(0,7);

  // ===== Top 3 Favoriten nach xG =====
  const top3xG = [...games].sort((a,b)=> (b.homeXG+b.awayXG) - (a.homeXG+a.awayXG) ).slice(0,3);

  res.json({response:games, top7Value, top3xG});
});

app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"index.html"));
});

app.listen(PORT,()=>{console.log(`LIVE: https://xg-value-tool.onrender.com`);console.log(`Heute: ${new Date().toISOString().slice(0,10)}`)});
