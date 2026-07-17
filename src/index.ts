import http from "node:http";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { Server as SocketIOServer } from "socket.io";
import { env } from "./config/env.js";
import { migrate } from "./config/database.js";
import authRoutes from "./routes/auth.js";
import serverRoutes from "./routes/servers.js";
import modsRoutes from "./routes/mods.js";
import backupRoutes from "./routes/backups.js";
import nodeRoutes from "./routes/nodes.js";
import filesRoutes from "./routes/files.js";
import playersRoutes from "./routes/players.js";
import docker from "./config/docker.js";

const app = Fastify({
  logger: true,
  serverFactory: (handler) => http.createServer((req, res) => handler(req, res)),
});

await app.register(cors, { origin: true, credentials: true });
await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.JWT_EXPIRES_IN } });

await app.register(authRoutes);
await app.register(serverRoutes);
await app.register(modsRoutes);
await app.register(backupRoutes);
await app.register(nodeRoutes);
await app.register(filesRoutes);
await app.register(playersRoutes);

app.get("/api/health", async () => {
  let dockerOk = false;
  try { await docker.ping(); dockerOk = true; } catch {}
  return { status: "ok", version: "0.1.0", docker: dockerOk };
});

migrate();
app.log.info("Database migrated");

await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
app.log.info(`Biryani API running on port ${env.API_PORT}`);

const io = new SocketIOServer(app.server as any, { cors: { origin: "*", credentials: true } });

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("No token"));
    const decoded = app.jwt.verify<{ id: number; username: string }>(token);
    (socket as any).user = decoded;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  app.log.info(`Client connected: ${(socket as any).user.username}`);

  socket.on("console:subscribe", async (serverId: number) => {
    socket.join(`server-${serverId}`);
  });

  socket.on("console:command", async ({ serverId, command }: { serverId: number; command: string }) => {
    try {
      const containerName = `biryani-mc-${serverId}`;
      const container = docker.getContainer(containerName);
      const exec = await container.exec({
        Cmd: ["rcon-cli", command],
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({ Detach: false });
      stream.on("data", (chunk: Buffer) => {
        socket.emit("console:output", { serverId, output: chunk.toString() });
      });
    } catch (err: any) {
      socket.emit("console:error", { serverId, error: err.message });
    }
  });

  socket.on("console:unsubscribe", (serverId: number) => {
    socket.leave(`server-${serverId}`);
  });

  socket.on("disconnect", () => {
    app.log.info(`Client disconnected: ${(socket as any).user.username}`);
  });
});

export { app, io };
