import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

// 🧠 Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, ".."); // one level up (where index.html and dashboard/ exist)

const app = express();

// 🟢 Serve static frontend
app.use(express.static(rootDir));
app.get("/", (req, res) => res.sendFile(path.join(rootDir, "index.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(rootDir, "dashboard/index.html")));

// 🟢 Create HTTP + WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map(); // id → { ws, role }

console.log("🎧 FM server booting...");

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();
  clients.set(id, { ws });
  console.log("🔗 Client connected:", id);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const { type, role, target, payload } = msg;

      // Register role
      if (type === "register") {
        clients.get(id).role = role;
        console.log(`🧩 ${id} registered as ${role}`);

        if (role === "listener") {
          for (const [pid, p] of clients) {
            if (p.role === "broadcaster") {
              p.ws.send(JSON.stringify({ type: "listener-joined", id }));
            }
          }
        }
      }

      // Relay offer/answer/candidate
      if (["offer", "answer", "candidate"].includes(type) && target) {
        const t = clients.get(target);
        if (t && t.ws.readyState === 1)
          t.ws.send(JSON.stringify({ type, from: id, payload }));
      }
    } catch (err) {
      console.error("⚠️ Message parse error:", err);
    }
  });

  ws.on("close", () => {
    clients.delete(id);
    console.log("❌ Disconnected:", id);
    // notify broadcaster(s)
    for (const [pid, p] of clients) {
      if (p.role === "broadcaster") {
        p.ws.send(JSON.stringify({ type: "peer-left", id }));
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on :${PORT}`));
