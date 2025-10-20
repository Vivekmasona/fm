// server.js
import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
app.get("/", (_, res) => res.send("🎧 FM WebSocket server is running!"));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map();
let currentMeta = null; // store title + currentTime

function broadcast(obj, filter) {
  const msg = JSON.stringify(obj);
  for (const c of clients.values()) {
    if (!filter || filter(c)) c.ws.send(msg);
  }
}

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();
  const client = { id, ws, role: null };
  clients.set(id, client);
  console.log(`🆕 New socket ${id}`);

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
        console.log(`👤 ${id} registered as ${client.role}`);
        // If listener joins late, send currentMeta
        if (msg.role === "listener" && currentMeta) ws.send(JSON.stringify({ type: "meta", ...currentMeta }));
        break;

      case "offer":
        broadcast(msg, c => c.role === "listener");
        break;

      case "answer":
        broadcast(msg, c => c.role === "broadcaster");
        break;

      case "candidate":
        broadcast(msg, c => c.id !== id);
        break;

      case "meta":
        currentMeta = msg;
        broadcast(msg, c => c.role === "listener");
        break;
    }
  });

  ws.on("close", () => {
    clients.delete(id);
    console.log(`❌ Closed ${id}`);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 FM Server ready on port ${PORT}`));
