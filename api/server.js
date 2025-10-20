import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  next();
});

app.get("/", (_, res) => res.send("🎧 FM Signaling Server Active"));

// store all connected sockets
const clients = new Map();

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();
  clients.set(id, { ws });
  console.log("🔌 New connection:", id);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const { type, target, payload, role } = msg;

      if (type === "register") {
        clients.get(id).role = role;
        console.log("Registered:", role, id);

        // notify broadcaster of new listener
        if (role === "listener") {
          for (const [cid, c] of clients) {
            if (c.role === "broadcaster")
              c.ws.send(JSON.stringify({ type: "listener-joined", id }));
          }
        }
        return;
      }

      // offer, answer, candidate routing
      if (["offer", "answer", "candidate"].includes(type)) {
        const targetConn = clients.get(target);
        if (targetConn)
          targetConn.ws.send(JSON.stringify({ type, from: id, payload }));
      }

      // broadcast title/time update
      if (type === "meta-update") {
        for (const [, c] of clients)
          if (c.role === "listener")
            c.ws.send(JSON.stringify({ type: "meta-update", payload }));
      }
    } catch (err) {
      console.error("Error parsing:", err);
    }
  });

  ws.on("close", () => {
    clients.delete(id);
    for (const [, c] of clients)
      if (c.role === "broadcaster")
        c.ws.send(JSON.stringify({ type: "peer-left", id }));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
