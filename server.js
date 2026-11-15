import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { Server } from "socket.io";
import WebSocket from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

let tikliveProcess = null;
let liveSocket = null;
let connectedUsername = "";
let ticker = null;
let tikliveReady = false;

const state = {
  title: "AZKA LIVE AUCTION",
  durationSeconds: 180,
  extraSeconds: 5,
  extraOnGift: true,
  running: false,
  endAt: null,
  remainingMs: 180000,
  leaderboard: [],
  lastGift: null,
  connectionStatus: "disconnected"
};

function usernameClean(value = "") {
  return String(value).trim().replace(/^@/, "").replace(/.*tiktok\.com\/@/i, "").replace(/\/live.*$/i, "").replace(/[^a-zA-Z0-9._]/g, "");
}

function getSnapshot() {
  const remainingMs = state.running && state.endAt
    ? Math.max(0, state.endAt - Date.now())
    : Math.max(0, state.remainingMs);

  return {
    ...state,
    remainingMs,
    leaderboard: [...state.leaderboard].sort((a, b) => b.totalCoin - a.totalCoin),
    connectedUsername
  };
}

function emitState() {
  io.emit("state", getSnapshot());
}

function stopAtZero() {
  state.running = false;
  state.endAt = null;
  state.remainingMs = 0;
  if (ticker) clearInterval(ticker);
  ticker = null;
  emitState();
}

function runTicker() {
  if (ticker) clearInterval(ticker);
  ticker = setInterval(() => {
    if (!state.running || !state.endAt) return;
    if (state.endAt <= Date.now()) stopAtZero();
    else emitState();
  }, 250);
}

function processGift(data) {
  // Gift hanya dihitung selama timer sedang berjalan.
  if (!state.running || !state.endAt) return;

  // Gift streak dihitung sekali, setelah combo selesai.
  if (data.streaking === true) return;

  const user = data.user ?? {};
  const username = usernameClean(user.uniqueId || user.nickname || data.uniqueId || "unknown");
  const coinEach = Number(data.diamondCount ?? 0);
  const repeatCount = Math.max(1, Number(data.repeatCount ?? 1));
  const coins = Math.floor(Number(data.totalDiamonds ?? (coinEach * repeatCount)));

  if (!username || !Number.isFinite(coins) || coins <= 0) return;

  let row = state.leaderboard.find(x => x.username.toLowerCase() === username.toLowerCase());
  if (!row) {
    row = { username, totalCoin: 0 };
    state.leaderboard.push(row);
  }
  row.totalCoin += coins;

  state.lastGift = {
    username,
    coin: coins,
    giftName: data.giftName || "Gift",
    at: Date.now()
  };

  if (state.extraOnGift && state.extraSeconds > 0) {
    state.endAt += state.extraSeconds * 1000;
    state.remainingMs = Math.max(0, state.endAt - Date.now());
  }
  emitState();
}

function startTikLiveService() {
  const cliPath = path.join(__dirname, "node_modules", "tiklive", "dist", "bin.mjs");
  tikliveProcess = spawn(process.execPath, [cliPath, "--host", "127.0.0.1", "--port", "8080"], {
    cwd: __dirname,
    stdio: "inherit",
    windowsHide: true
  });

  tikliveProcess.on("error", (err) => {
    console.error("Gagal menjalankan layanan TikTok lokal:", err.message);
  });
  tikliveProcess.on("exit", (code) => {
    tikliveReady = false;
    if (code !== 0 && code !== null) {
      console.error(`Layanan TikTok lokal berhenti dengan kode ${code}.`);
    }
  });
}

async function waitTikLiveReady() {
  if (tikliveReady) return;
  for (let i = 0; i < 30; i++) {
    if (tikliveProcess && tikliveProcess.exitCode !== null) {
      throw new Error("Layanan TikTok lokal berhenti. Pastikan Node.js versi 22 atau lebih baru.");
    }
    try {
      const response = await fetch("http://127.0.0.1:8080/api/health");
      if (response.ok) {
        tikliveReady = true;
        return;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Layanan TikTok lokal belum siap di port 8080. Periksa apakah port tersebut sedang dipakai aplikasi lain.");
}

async function connectTikTok(username) {
  await waitTikLiveReady();

  if (liveSocket) {
    try { liveSocket.close(); } catch {}
    liveSocket = null;
  }

  connectedUsername = username;
  state.connectionStatus = "connecting";
  emitState();

  await new Promise((resolve, reject) => {
    const ws = new WebSocket("ws://127.0.0.1:8080/ws");
    liveSocket = ws;
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { ws.close(); } catch {}
        reject(new Error("Koneksi ke layanan TikTok lokal timeout."));
      }
    }, 12000);

    ws.on("open", () => {
      ws.send(JSON.stringify({
        action: "subscribe",
        username,
        events: ["gift"],
        replay: false
      }));
    });

    ws.on("message", (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return; }

      if (message.type === "error") {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error(message.message || "Layanan TikTok menolak username."));
        }
        state.connectionStatus = "error";
        emitState();
        return;
      }

      if (message.type === "status" && message.username?.toLowerCase() === username.toLowerCase()) {
        const sessionState = message.status?.state;
        if (sessionState === "live") {
          state.connectionStatus = "connected";
          emitState();
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve();
          }
        } else if (sessionState === "error") {
          state.connectionStatus = "error";
          emitState();
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error(message.status?.error || "TikTok gagal membuka LIVE."));
          }
        } else {
          state.connectionStatus = "connecting";
          emitState();
        }
      }

      if (message.type === "event" && message.event?.type === "gift") {
        const gift = message.event;
        processGift({
          user: gift.user,
          giftName: gift.giftName,
          diamondCount: gift.diamondCount,
          repeatCount: gift.repeatCount,
          totalDiamonds: gift.totalDiamonds,
          // TikLive marks an unfinished combo as streaking=true.
          streaking: gift.streaking === true
        });
      }
    });

    ws.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Tidak bisa membuka koneksi lokal: ${err.message}`));
      }
      state.connectionStatus = "error";
      emitState();
    });

    ws.on("close", () => {
      if (liveSocket === ws) {
        liveSocket = null;
        if (state.connectionStatus !== "disconnected") {
          state.connectionStatus = "disconnected";
          emitState();
        }
      }
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error("Koneksi layanan TikTok terputus sebelum LIVE tersambung."));
      }
    });
  });
}

app.get("/api/state", (_req, res) => res.json(getSnapshot()));

app.post("/api/connect", async (req, res) => {
  const username = usernameClean(req.body.username);
  if (!username) return res.status(400).json({ error: "Masukkan username TikTok tanpa tanda @." });

  try {
    await connectTikTok(username);
    res.json({ ok: true, username });
  } catch (error) {
    console.error("TikTok connection failed:", error);
    state.connectionStatus = "error";
    emitState();
    res.status(502).json({
      error: error?.message || "Tidak berhasil terhubung. Pastikan akun sedang LIVE dan username benar."
    });
  }
});

app.post("/api/disconnect", async (_req, res) => {
  if (liveSocket) {
    try { liveSocket.close(); } catch {}
    liveSocket = null;
  }
  connectedUsername = "";
  state.connectionStatus = "disconnected";
  emitState();
  res.json({ ok: true });
});

app.post("/api/settings", (req, res) => {
  const { title, durationSeconds, extraSeconds, extraOnGift } = req.body;
  if (typeof title === "string") state.title = title.trim().slice(0, 80) || "AZKA LIVE AUCTION";

  if (Number.isFinite(Number(durationSeconds))) {
    state.durationSeconds = Math.min(86400, Math.max(5, Math.floor(Number(durationSeconds))));
  }
  if (Number.isFinite(Number(extraSeconds))) {
    state.extraSeconds = Math.min(3600, Math.max(0, Math.floor(Number(extraSeconds))));
  }
  if (typeof extraOnGift === "boolean") state.extraOnGift = extraOnGift;

  if (!state.running) state.remainingMs = state.durationSeconds * 1000;
  emitState();
  res.json({ ok: true, state: getSnapshot() });
});

app.post("/api/start", (_req, res) => {
  if (!state.running) {
    if (state.remainingMs <= 0) state.remainingMs = state.durationSeconds * 1000;
    state.endAt = Date.now() + state.remainingMs;
    state.running = true;
    runTicker();
  }
  emitState();
  res.json({ ok: true });
});

app.post("/api/pause", (_req, res) => {
  if (state.running && state.endAt) {
    state.remainingMs = Math.max(0, state.endAt - Date.now());
  }
  state.running = false;
  state.endAt = null;
  if (ticker) clearInterval(ticker);
  ticker = null;
  emitState();
  res.json({ ok: true });
});

app.post("/api/reset", (_req, res) => {
  state.running = false;
  state.endAt = null;
  state.remainingMs = state.durationSeconds * 1000;
  state.leaderboard = [];
  state.lastGift = null;
  if (ticker) clearInterval(ticker);
  ticker = null;
  emitState();
  res.json({ ok: true });
});

// Simulasi gift hanya untuk pengujian lokal.
app.post("/api/test-gift", (req, res) => {
  processGift({
    user: { uniqueId: usernameClean(req.body.username || "testuser") },
    diamondCount: Math.max(1, Math.floor(Number(req.body.coin || 1))),
    repeatCount: 1,
    totalDiamonds: Math.max(1, Math.floor(Number(req.body.coin || 1))),
    streaking: false,
    giftName: "Test Gift"
  });
  res.json({ ok: true, state: getSnapshot() });
});

app.get("/overlay", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "overlay.html"));
});
app.get("/overlay-panel", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "overlay-panel.html"));
});

const PORT = process.env.PORT || 3000;
startTikLiveService();

server.listen(PORT, () => {
  console.log(`AZKA server berjalan di http://localhost:${PORT}`);
  console.log(`Overlay transparan: http://localhost:${PORT}/overlay`);
  console.log(`Overlay panel OBS: http://localhost:${PORT}/overlay-panel`);
  console.log("TikTok LIVE signing berjalan lokal melalui tiklive; tidak memakai Euler Stream.");
});

function shutdown() {
  if (liveSocket) {
    try { liveSocket.close(); } catch {}
  }
  if (tikliveProcess && !tikliveProcess.killed) {
    tikliveProcess.kill();
  }
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
