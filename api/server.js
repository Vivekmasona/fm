import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
app.use(express.static("public")); // optional if static served

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map();

function broadcastTo(role, data) {
  for (const [, client] of clients) {
    if (client.role === role && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(data));
    }
  }
}

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2);
  clients.set(id, { ws });

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "register") {
        clients.get(id).role = data.role;
        console.log("🔗 Registered", id, data.role);
        if (data.role === "listener") {
          // notify broadcaster
          broadcastTo("broadcaster", { type: "listener-joined", id });
        }
        return;
      }

      // Forward signaling messages
      if (["offer", "answer", "candidate"].includes(data.type)) {
        const target = clients.get(data.target);
        if (target?.ws?.readyState === 1) {
          target.ws.send(JSON.stringify({ ...data, from: id }));
        }
        return;
      }

      // 🟢 Broadcast control (title, quality, etc.)
      if (data.type === "broadcast-control") {
        broadcastTo("listener", { type: "control", payload: data.payload });
      }

    } catch (err) {
      console.error("WS message error:", err);
    }
  });

  ws.on("close", () => {
    const role = clients.get(id)?.role;
    clients.delete(id);
    if (role === "listener") {
      broadcastTo("broadcaster", { type: "peer-left", id });
    }
  });
});

app.get("/", (req, res) => {
  res.send("🎧 FM WebSocket server is running.");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log("✅ Server ready on port", PORT)
);
