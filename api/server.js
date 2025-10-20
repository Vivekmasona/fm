import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from root and dashboard
app.use(express.static(path.join(__dirname, "..")));
app.use("/dashboard", express.static(path.join(__dirname, "../dashboard")));

// Create server
const server = app.listen(PORT, () => {
  console.log(`🚀 FM WebSocket server running on port ${PORT}`);
});

// WebSocket setup
const wss = new WebSocketServer({ server });

let broadcaster = null;
const listeners = new Set();

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      // Broadcaster joins
      if (data.type === "broadcaster") {
        broadcaster = ws;
        ws.role = "broadcaster";
        ws.send(JSON.stringify({ type: "ack", message: "Broadcaster connected" }));
        broadcastListenerCount();
      }

      // Listener joins
      if (data.type === "listener") {
        ws.role = "listener";
        listeners.add(ws);
        ws.send(JSON.stringify({ type: "ack", message: "Listener connected" }));
        broadcastListenerCount();
      }

      // Broadcast metadata (title / quality)
      if (data.type === "meta" && ws.role === "broadcaster") {
        for (const l of listeners) {
          if (l.readyState === 1) {
            l.send(JSON.stringify({ type: "meta", title: data.title, quality: data.quality }));
          }
        }
      }

      // Audio chunk from broadcaster
      if (data.type === "audio" && ws.role === "broadcaster") {
        for (const l of listeners) {
          if (l.readyState === 1) l.send(msg);
        }
      }
    } catch (err) {
      console.error("Error:", err);
    }
  });

  ws.on("close", () => {
    if (ws.role === "listener") listeners.delete(ws);
    if (ws.role === "broadcaster") broadcaster = null;
    broadcastListenerCount();
  });
});

function broadcastListenerCount() {
  const count = listeners.size;
  if (broadcaster && broadcaster.readyState === 1) {
    broadcaster.send(JSON.stringify({ type: "count", count }));
  }
}
