import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
app.get("/", (req, res) => res.send("🎧 FM Server Active"));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map(); // id -> ws
let broadcaster = null;
let currentTime = 0;
let currentTitle = "";

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      // Register user role
      if (data.type === "register") {
        ws.role = data.role;
        if (ws.role === "broadcaster") {
          broadcaster = ws;
          console.log("🎙️ Broadcaster connected");
        } else console.log("🎧 Listener connected");
      }

      // Offer/Answer/Candidate signaling
      if (["offer", "answer", "candidate"].includes(data.type)) {
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && client !== ws) {
            client.send(JSON.stringify(data));
          }
        });
      }

      // Broadcaster time & title sync
      if (data.type === "sync") {
        currentTime = data.time;
        currentTitle = data.title;
        // forward to all listeners
        wss.clients.forEach((client) => {
          if (client.readyState === 1 && client.role === "listener") {
            client.send(JSON.stringify({ type: "sync", time: currentTime, title: currentTitle }));
          }
        });
      }

    } catch (e) {
      console.error("Parse error", e);
    }
  });

  ws.on("close", () => {
    if (ws.role === "broadcaster") broadcaster = null;
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on :${PORT}`));
