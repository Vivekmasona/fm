import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import crypto from "crypto";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const conns = new Map();

app.get("/", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send("🎧 WebSocket signaling server (Render)");
});

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();
  const conn = { id, ws, role: null };
  conns.set(id, conn);
  console.log("🟢 Conn open", id);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === "register") {
        conn.role = msg.role;
        console.log(`registered ${id} as ${conn.role}`);

        // Notify broadcaster when listener joins
        if (conn.role === "listener") {
          for (const c of conns.values()) {
            if (c.role === "broadcaster") {
              c.ws.send(JSON.stringify({ type: "listener-joined", id }));
            }
          }
        }
        return;
      }

      const { type, target, payload } = msg;

      if (type === "offer") {
        const t = conns.get(target);
        if (t) t.ws.send(JSON.stringify({ type: "offer", from: id, payload }));
        return;
      }

      if (type === "answer") {
        const t = conns.get(target);
        if (t) t.ws.send(JSON.stringify({ type: "answer", from: id, payload }));
        return;
      }

      if (type === "candidate") {
        const t = conns.get(target);
        if (t) t.ws.send(JSON.stringify({ type: "candidate", from: id, payload }));
        return;
      }

      if (type === "broadcast-control") {
        for (const c of conns.values()) {
          if (c.role === "listener") {
            c.ws.send(JSON.stringify({ type: "control", payload }));
          }
        }
        return;
      }
    } catch (err) {
      console.error("❌ Message parse error", err);
    }
  });

  ws.on("close", () => {
    conns.delete(id);
    console.log("🔴 Conn closed", id);
    // Notify broadcaster if listener left
    for (const c of conns.values()) {
      if (c.role === "broadcaster") {
        c.ws.send(JSON.stringify({ type: "peer-left", id }));
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
