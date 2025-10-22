// server.js — Vollversion für Render (Frontend + Backend)

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// __dirname sauber für ESModules holen:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 STATIC: Dein Frontend (index.html, style.css, app.js)
app.use(express.static(__dirname));

// ⚙️ Deine API-Settings:
const API_URL = "https://api-football-v1.p.rapidapi.com/v3";
const API_KEY = process.env.API_KEY;

// 🧠 Fixtures abrufen
app.get("/fixtures", async (req, res) => {
  try {
    const date = req.query.date;
    const resp = await fetch(`${API_URL}/fixtures?date=${date}`, {
      headers: {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
      },
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error("Fehler bei /fixtures:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Fixtures" });
  }
});

// 💰 Odds abrufen
app.get("/odds", async (req, res) => {
  try {
    const date = req.query.date;
    const resp = await fetch(`${API_URL}/odds?date=${date}`, {
      headers: {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
      },
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error("Fehler bei /odds:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Odds" });
  }
});

// 🔹 ALLES andere (/) -> index.html (Frontend)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 🔸 Server starten
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
