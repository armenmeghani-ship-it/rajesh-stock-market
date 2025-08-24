import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const YF_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=";
const YF_SEARCH_URL = "https://query2.finance.yahoo.com/v1/finance/search?q=";

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Autocomplete/search companies -> returns top symbols (works for Indian NSE/BSE with .NS / .BO suffix)
app.get("/api/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Missing q" });
    const url = `${YF_SEARCH_URL}${encodeURIComponent(q)}`;
    const r = await fetch(url);
    const j = await r.json();
    const items = (j.quotes || []).map(it => ({
      symbol: it.symbol,
      shortname: it.shortname,
      longname: it.longname,
      exch: it.exchDisp,
      type: it.quoteType
    }));
    res.json({ q, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get real-time-ish quote data (price, change, market state). For NSE use .NS, for BSE use .BO
app.get("/api/quote", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "").trim();
    if (!symbol) return res.status(400).json({ error: "Missing symbol" });
    const url = `${YF_QUOTE_URL}${encodeURIComponent(symbol)}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }});
    const j = await r.json();
    const result = j?.quoteResponse?.result?.[0];
    if (!result) return res.status(404).json({ error: "Symbol not found", symbol });
    const out = {
      symbol: result.symbol,
      shortName: result.shortName,
      longName: result.longName,
      exchange: result.fullExchangeName,
      currency: result.currency,
      marketState: result.marketState,
      regularMarketPrice: result.regularMarketPrice,
      regularMarketChange: result.regularMarketChange,
      regularMarketChangePercent: result.regularMarketChangePercent,
      regularMarketTime: result.regularMarketTime,
      previousClose: result.previousClose,
      open: result.open,
      dayLow: result.dayLow,
      dayHigh: result.dayHigh,
      fiftyTwoWeekLow: result.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: result.fiftyTwoWeekHigh
    };
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve frontend (optional, for local dev): static files from ../frontend
app.use("/", express.static(new URL("../frontend", import.meta.url).pathname));

app.listen(PORT, () => {
  console.log(`✅ Rajesh Stock Market backend running on http://localhost:${PORT}`);
});
