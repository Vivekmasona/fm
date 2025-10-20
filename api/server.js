import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const app = express();
app.use(express.static(rootDir));

app.get("/", (req, res) => res.sendFile(path.join(rootDir, "index.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(rootDir, "dashboard/index.html")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let broadcaster = null;
const listeners = new Map();

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    if (data.type === "register" && data.role === "broadcaster") {
      broadcaster = ws;
      ws.role = "broadcaster";
      console.log("🎧 Broadcaster joined");
    }

    if (data.type === "register" && data.role === "listener") {
      listeners.set(ws, true);
      ws.role = "listener";
      console.log("👂 Listener joined");
      if (broadcaster && broadcaster.readyState === 1) {
        broadcaster.send(JSON.stringify({ type: "listener-joined" }));
      }
    }

    if (data.type === "broadcast" && ws.role === "broadcaster") {
      // Forward updates to all listeners
      for (const [client] of listeners) {
        if (client.readyState === 1) client.send(JSON.stringify(data));
      }
    }
  });

  ws.on("close", () => {
    if (ws.role === "listener") listeners.delete(ws);
    if (ws.role === "broadcaster") broadcaster = null;
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ FM Server live on ${PORT}`));
