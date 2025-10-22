// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_FOOTBALL_KEY;

// Basis-URL der API-Football über RapidAPI
const API_BASE = "https://api-football-v1.p.rapidapi.com/v3";

// --- Route: Fixtures abrufen ---
app.get("/fixtures", async (req, res) => {
  const date = req.query.date;
  try {
    const response = await fetch(`${API_BASE}/fixtures?date=${date}`, {
      headers: {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Abrufen der Fixtures" });
  }
});

// --- Route: Quoten abrufen ---
app.get("/odds", async (req, res) => {
  const date = req.query.date;
  try {
    const response = await fetch(`${API_BASE}/odds?date=${date}`, {
      headers: {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Abrufen der Quoten" });
  }
});

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
