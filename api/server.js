import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const app = express();

// serve static
app.use(express.static(rootDir));
app.get("/", (req, res) => res.sendFile(path.join(rootDir, "index.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(rootDir, "dashboard/index.html")));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Map();

let currentMeta = null; // for reconnect (title, time, poster, quality)

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();
  clients.set(id, { ws });
  console.log("🔗 Connected", id);

  // send current song state
  if (currentMeta)
    ws.send(JSON.stringify({ type: "meta-update", payload: currentMeta }));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      const { type, payload } = data;

      if (type === "broadcast-meta") {
        currentMeta = payload;
        for (const [cid, c] of clients)
          if (c.ws.readyState === 1 && c.ws !== ws)
            c.ws.send(JSON.stringify({ type: "meta-update", payload }));
      }
    } catch (e) {
      console.error("parse error", e);
    }
  });

  ws.on("close", () => {
    clients.delete(id);
    console.log("❌ Disconnected", id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Running on ${PORT}`));
