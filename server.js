import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import crypto from "crypto";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map();
let currentMeta = null;
let lastOffer = null;

app.get("/", (req, res) => {
  res.send("🎧 FM WebSocket server is running!");
});

function broadcast(data, filter) {
  const msg = JSON.stringify(data);
  for (const c of clients.values()) {
    if (!filter || filter(c)) c.ws.send(msg);
  }
}

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();
  const client = { id, ws, role: null };
  clients.set(id, client);
  console.log(`🆕 Client ${id} connected`);

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {
      case "register":
        client.role = msg.role;
        console.log(`👤 ${id} registered as ${msg.role}`);

        // 🟢 New listener reconnect fix
        if (msg.role === "listener") {
          if (currentMeta)
            ws.send(JSON.stringify({ type: "meta", ...currentMeta }));
          if (lastOffer)
            ws.send(JSON.stringify({ type: "offer", payload: lastOffer }));
        }
        break;

      case "offer":
        lastOffer = msg.payload;
        broadcast(msg, (c) => c.role === "listener");
        break;

      case "answer":
        broadcast(msg, (c) => c.role === "broadcaster");
        break;

      case "candidate":
        broadcast(msg, (c) => c.id !== id);
        break;

      case "meta":
        currentMeta = msg;
        broadcast(msg, (c) => c.role === "listener");
        break;
    }
  });

  ws.on("close", () => {
    clients.delete(id);
    console.log(`❌ Client ${id} disconnected`);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
