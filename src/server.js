import http from "http";
import express from "express";
import morgan from "morgan";
import mongoose from "mongoose";
import crypto from "crypto";
import { setupWebSocket } from './hocuspocus-server.js';
import { createUserApiRouter } from "./apiRoutes/user.js";

// 环境变量配置
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;


mongoose.connect("mongodb://127.0.0.1:27017/EditorTogether")
  .then(() => console.log("✅ 已成功连接到 MongoDB 数据库"))
  .catch(err => console.error("❌ 连接失败", err))

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function createRequestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return crypto.randomBytes(16).toString("hex");
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  req.id = createRequestId();
  res.setHeader("X-Request-Id", req.id);
  next();
});
app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms", {
    stream: { write: (msg) => log(msg.trim()) }
  })
);

app.use(
  "/api",
  createUserApiRouter()
);


// 404 handler (JSON)
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  log("Unhandled error", { requestId: req?.id, message: err?.message, stack: err?.stack });
  res.status(500).json({ error: "Internal server error", requestId: req?.id });
});

setupWebSocket(server); 

const server = http.createServer(app);

server.listen(PORT, () => {
  log(`Server listening on http://localhost:${PORT}`);
  log(`WebSocket endpoint ws://localhost:${PORT}/ws?roomId=xxx&token=xxx`);
});
