// server.js — Für direkten API-Sports (api-football.com) Key

import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// __dirname für ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Statische Dateien (Frontend)
app.use(express.static(__dirname));

// ⚙️ Richtige URL für API-Sports (nicht RapidAPI!)
const API_URL = "https://v3.football.api-sports.io";

// Dein API Key aus Render:
const API_KEY = process.env.API_FOOTBALL_KEY;

// 🔹 Fixtures Endpoint
app.get("/fixtures", async (req, res) => {
  const date = req.query.date;

  console.log("API_KEY vorhanden?", !!API_KEY);
  console.log("Datum:", date);

  if (!API_KEY) {
    return res.status(500).json({ error: "API Key fehlt! Setze API_FOOTBALL_KEY in Render." });
  }

  try {
    const resp = await fetch(`${API_URL}/fixtures?date=${date}`, {
      headers: {
        "x-apisports-key": API_KEY, // ✅ Richtiger Header für api-football.com
      },
    });

    const data = await resp.json();

    console.log("Status:", resp.status);
    console.log("Daten (Auszug):", JSON.stringify(data).slice(0, 300));

    if (!resp.ok) {
      return res.status(resp.status).json({ error: "API-Fehler", details: data });
    }

    res.json(data);
  } catch (err) {
    console.error("Fetch-Fehler:", err.message);
    res.status(500).json({ error: "Serverfehler", message: err.message });
  }
});

// Optional: Odds Endpoint
app.get("/odds", async (req, res) => {
  const date = req.query.date;

  if (!API_KEY) {
    return res.status(500).json({ error: "API Key fehlt!" });
  }

  try {
    const resp = await fetch(`${API_URL}/odds?date=${date}`, {
      headers: {
        "x-apisports-key": API_KEY,
      },
    });

    const data = await resp.json();
    console.log("Odds Status:", resp.status);

    if (!resp.ok) {
      return res.status(resp.status).json({ error: "Odds-Fehler", details: data });
    }

    res.json(data);
  } catch (err) {
    console.error("Odds-Fehler:", err.message);
    res.status(500).json({ error: "Serverfehler", message: err.message });
  }
});

// Fallback: index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
  console.log(`🌐 Frontend erreichbar über Render`);
});
