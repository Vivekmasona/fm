import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Serve static files from "public"
const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

// ✅ Route for dashboard (optional direct link)
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(publicPath, "dashboard/index.html"));
});

// ✅ Default listener page
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// Store all clients
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
        if (data.role === "listener") {
          broadcastTo("broadcaster", { type: "listener-joined", id });
        }
        return;
      }

      // Forward signaling
      if (["offer", "answer", "candidate"].includes(data.type)) {
        const target = clients.get(data.target);
        if (target?.ws?.readyState === 1) {
          target.ws.send(JSON.stringify({ ...data, from: id }));
        }
        return;
      }

      // Broadcast control updates (title + quality)
      if (data.type === "broadcast-control") {
        broadcastTo("listener", { type: "control", payload: data.payload });
      }

    } catch (err) {
      console.error("WS error:", err);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
