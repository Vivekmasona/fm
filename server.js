// server.js
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const app = express();

app.get("/", (req, res) => {
  res.send("🎧 FM WebRTC Signaling Server is Live and Ready!");
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map(); // id -> { ws, role }

function safeSend(ws, data) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
}

// prevent Render from sleeping connection
setInterval(() => {
  for (const [, c] of clients)
    if (c.ws.readyState === c.ws.OPEN) safeSend(c.ws, { type: "ping" });
}, 25000);

wss.on("connection", (ws, req) => {
  const id = crypto.randomUUID();
  clients.set(id, { ws });
  console.log("🔗 Connected:", id, "from", req.socket.remoteAddress);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      console.warn("⚠️ Invalid JSON message");
      return;
    }

    const { type, role, target, payload } = msg;

    // 🔹 Client registration
    if (type === "register") {
      clients.get(id).role = role;
      console.log(`🧩 ${id} registered as ${role}`);
      if (role === "listener") {
        // Notify all broadcasters that listener joined
        for (const [, c] of clients)
          if (c.role === "broadcaster")
            safeSend(c.ws, { type: "listener-joined", id });
      }
    }

    // 🔹 Forward offer/answer/candidate
    if (["offer", "answer", "candidate"].includes(type) && target) {
      const targetClient = clients.get(target);
      if (targetClient) {
        safeSend(targetClient.ws, { type, from: id, payload });
      }
    }
  });

  ws.on("close", () => {
    clients.delete(id);
    console.log("❌ Disconnected:", id);
    // Inform broadcasters
    for (const [, c] of clients)
      if (c.role === "broadcaster") safeSend(c.ws, { type: "peer-left", id });
  });

  ws.on("error", (err) => console.error("WebSocket error:", err.message));
});

// prevent Render gateway timeout
server.keepAliveTimeout = 70000;
server.headersTimeout = 75000;

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ FM Server running on port ${PORT}`));
