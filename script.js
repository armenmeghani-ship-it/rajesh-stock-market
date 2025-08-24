const log = document.getElementById("log");
const quoteBox = document.getElementById("quote");
const micBtn = document.getElementById("micBtn");

const API_BASE = ""; // same origin (proxied through Express)

function say(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-IN";
  speechSynthesis.speak(u);
}

function addLog(who, text) {
  const row = document.createElement("div");
  row.className = "text-sm";
  row.innerHTML = `<span class="font-semibold ${who==='Rajesh'?'text-emerald-400':'text-sky-400'}">${who}:</span> ${text}`;
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
}

async function fetchQuote(symbol) {
  const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Quote fetch failed");
  const j = await res.json();
  renderQuote(j);
  return j;
}

function renderQuote(q) {
  quoteBox.innerHTML = `
    <div><span class="text-slate-400">Symbol:</span> <span class="font-semibold">${q.symbol}</span></div>
    <div class="text-lg font-bold">${q.regularMarketPrice ?? "-"} <span class="text-xs">${q.currency ?? ""}</span></div>
    <div><span class="text-slate-400">Change:</span> ${fmt(q.regularMarketChange)} (${fmt(q.regularMarketChangePercent)}%)</div>
    <div class="text-slate-400">Open ${fmt(q.open)} • Prev ${fmt(q.previousClose)}</div>
    <div class="text-slate-400">Day ${fmt(q.dayLow)} - ${fmt(q.dayHigh)}</div>
    <div class="text-slate-400">52W ${fmt(q.fiftyTwoWeekLow)} - ${fmt(q.fiftyTwoWeekHigh)}</div>
    <div class="text-slate-500 text-xs">Market: ${q.exchange} • ${q.marketState}</div>
  `;
}

function fmt(v) {
  if (v === undefined || v === null) return "-";
  return typeof v === "number" ? v.toFixed(2) : v;
}

// Simple symbol dictionary for popular Indian stocks (NSE)
const SYMBOL_MAP = {
  "reliance": "RELIANCE.NS",
  "tcs": "TCS.NS",
  "infosys": "INFY.NS",
  "infy": "INFY.NS",
  "hdfc": "HDFCBANK.NS",
  "hdfc bank": "HDFCBANK.NS",
  "icici": "ICICIBANK.NS",
  "icici bank": "ICICIBANK.NS",
  "sbi": "SBIN.NS",
  "state bank": "SBIN.NS",
  "hindu": "HINDUNILVR.NS",
  "hindustan unilever": "HINDUNILVR.NS",
  "tata motors": "TATAMOTORS.NS",
  "itc": "ITC.NS",
  "maruti": "MARUTI.NS"
};

function extractSymbol(utterance) {
  const u = utterance.toLowerCase();
  // try direct mapping
  for (const [k, sym] of Object.entries(SYMBOL_MAP)) {
    if (u.includes(k)) return sym;
  }
  // try to parse "price of XYZ" -> XYZ
  const m = u.match(/(?:price|quote|of|for)\s+([a-z0-9 .&-]+)/i);
  if (m) {
    return SYMBOL_MAP[m[1].trim().toLowerCase()] || null;
  }
  return null;
}

let listening = false;
let woke = false;
let recognition;

function setupRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    addLog("Rajesh", "Speech Recognition not supported in this browser. Try Chrome on desktop.");
    say("Speech recognition is not supported in this browser. Please try Chrome on desktop.");
    return;
  }
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-IN";

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      transcript += t + " ";
      if (event.results[i].isFinal) {
        handleFinal(t.toLowerCase().trim());
      }
    }
    // show partials lightly
  };

  recognition.onerror = (e) => {
    addLog("Rajesh", "Recognition error: " + e.error);
  };

  recognition.onend = () => {
    if (listening) recognition.start(); // keep it going
  };
}

function handleFinal(text) {
  addLog("You", text);
  if (!woke) {
    if (text.includes("rajesh")) {
      woke = true;
      addLog("Rajesh", "I'm here. Which Indian stock should I check?");
      say("I'm here. Which Indian stock should I check?");
    }
    return;
  }

  // If woke, try to parse intent
  const sym = extractSymbol(text);
  if (sym) {
    respondWithQuote(sym);
  } else if (text.includes("stop") || text.includes("thanks")) {
    woke = false;
    addLog("Rajesh", "Okay, say Rajesh again when you need me.");
    say("Okay, say Rajesh again when you need me.");
  } else {
    addLog("Rajesh", "I didn't catch the symbol. You can say: price of Reliance, or TCS quote.");
    say("I didn't catch the symbol. You can say: price of Reliance, or T C S quote.");
  }
}

async function respondWithQuote(symbol) {
  try {
    addLog("Rajesh", `Fetching ${symbol}...`);
    const q = await fetchQuote(symbol);
    const dir = (q.regularMarketChange ?? 0) >= 0 ? "up" : "down";
    const msg = `${q.shortName || q.symbol} is ${dir} at ${q.regularMarketPrice} ${q.currency || ""}, change ${fmt(q.regularMarketChange)} or ${fmt(q.regularMarketChangePercent)} percent.`;
    say(msg);
  } catch (e) {
    addLog("Rajesh", "Sorry, I couldn't get that quote.");
    say("Sorry, I could not get that quote.");
  }
}

micBtn.addEventListener("click", () => {
  if (!recognition) setupRecognition();
  if (!recognition) return;
  listening = !listening;
  if (listening) {
    recognition.start();
    micBtn.textContent = "🛑 Stop";
    micBtn.classList.remove("bg-emerald-500");
    micBtn.classList.add("bg-rose-500");
    addLog("Rajesh", "Listening... say Rajesh to wake me.");
    say("Listening. Say Rajesh to wake me.");
  } else {
    recognition.stop();
    micBtn.textContent = "🎤 Start";
    micBtn.classList.remove("bg-rose-500");
    micBtn.classList.add("bg-emerald-500");
    addLog("Rajesh", "Stopped listening.");
    say("Stopped listening.");
  }
});

// Quick symbol buttons
document.querySelectorAll(".sym").forEach(btn => {
  btn.addEventListener("click", () => {
    respondWithQuote(btn.dataset.s);
  });
});

// Initial setup
setupRecognition();
