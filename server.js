import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_FOOTBALL_KEY;
const API_BASE = "https://v3.football.api-sports.io";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/api/fixtures", async (req, res) => {
  const { date } = req.query;
  try {
    const response = await fetch(`${API_BASE}/fixtures?date=${date}`, {
      headers: { "x-apisports-key": API_KEY }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Fehler bei /fixtures:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Fixtures" });
  }
});

app.get("/api/odds", async (req, res) => {
  const { date } = req.query;
  try {
    const response = await fetch(`${API_BASE}/odds?date=${date}`, {
      headers: { "x-apisports-key": API_KEY }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Fehler bei /odds:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Quoten" });
  }
});

app.listen(PORT, () => console.log(`✅ Proxy-Server läuft auf http://localhost:${PORT}`));
