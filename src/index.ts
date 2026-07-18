import http from "node:http";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import { Server as SocketIOServer } from "socket.io";
import { env } from "./config/env.js";
import { migrate } from "./config/database.js";
import db from "./config/database.js";
import authRoutes from "./routes/auth.js";
import serverRoutes from "./routes/servers.js";
import modsRoutes from "./routes/mods.js";
import backupRoutes from "./routes/backups.js";
import nodeRoutes from "./routes/nodes.js";
import filesRoutes from "./routes/files.js";
import playersRoutes from "./routes/players.js";
import scheduleRoutes from "./routes/schedule.js";
import templateRoutes from "./routes/templates.js";
import notificationRoutes from "./routes/notifications.js";
import userRoutes from "./routes/users.js";
import overviewRoutes from "./routes/overview.js";
import { setSocketIO } from "./routes/servers.js";
import { startAllTasks } from "./services/schedule.service.js";
import { notify } from "./services/notification.service.js";
import { markStaleNodesOffline } from "./services/node.service.js";
import { rotateAllBackups } from "./services/backup.service.js";
import docker, { dockerStreamDemux } from "./config/docker.js";

const app = Fastify({
  logger: true,
  serverFactory: (handler) => http.createServer((req, res) => handler(req, res)),
});

await app.register(cors, { origin: true, credentials: true });
await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.JWT_EXPIRES_IN } });
await app.register(multipart);

await app.register(authRoutes);
await app.register(serverRoutes);
await app.register(modsRoutes);
await app.register(backupRoutes);
await app.register(nodeRoutes);
await app.register(filesRoutes);
await app.register(playersRoutes);
await app.register(scheduleRoutes);
await app.register(templateRoutes);
await app.register(notificationRoutes);
await app.register(userRoutes);
await app.register(overviewRoutes);

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
setSocketIO(io);

startAllTasks(async (task) => {
  app.log.info(`[Scheduler] Running task: ${task.name}`);
  const { startServer, stopServer, restartServer, sendCommand } = await import("./services/server.service.js");
  const { createBackup } = await import("./services/backup.service.js");
  try {
    switch (task.type) {
      case "backup": await createBackup(task.server_id); break;
      case "restart": await restartServer(task.server_id); break;
      case "stop": await stopServer(task.server_id); break;
      case "start": await startServer(task.server_id); break;
      case "command": if (task.command) await sendCommand(task.server_id, task.command); break;
    }
    await notify("task_complete", "Task Complete", `Scheduled task "${task.name}" completed successfully`, 0x00ff00);
  } catch (err: any) {
    app.log.error(`[Scheduler] Task ${task.name} failed: ${err.message}`);
    await notify("task_failed", "Task Failed", `Scheduled task "${task.name}" failed: ${err.message}`, 0xff0000);
  }
});

setInterval(() => {
  markStaleNodesOffline();
}, 60000);

setInterval(() => {
  rotateAllBackups(10);
}, 3600000);

setInterval(async () => {
  try {
    const servers = db.prepare("SELECT id, container_id, status FROM servers WHERE status IN ('running', 'starting')").all() as any[];
    for (const server of servers) {
      if (!server.container_id) {
        db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(server.id);
        continue;
      }
      try {
        const container = docker.getContainer(server.container_id);
        const inspect = await container.inspect();
        if (!inspect.State.Running) {
          const exitCode = inspect.State.ExitCode;
          const newStatus = exitCode === 0 ? "stopped" : "error";
          db.prepare("UPDATE servers SET status = ?, container_id = NULL WHERE id = ?").run(newStatus, server.id);
          if (io) io.to(`server-${server.id}`).emit("server:status", { serverId: server.id, status: newStatus });
        }
      } catch {
        db.prepare("UPDATE servers SET status = 'stopped', container_id = NULL WHERE id = ?").run(server.id);
        if (io) io.to(`server-${server.id}`).emit("server:status", { serverId: server.id, status: "stopped" });
      }
    }
  } catch {}
}, 15000);

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

// Track active container attachments per socket
const activeAttachments = new Map<string, { stream: any; outputInterval: NodeJS.Timeout }>();

io.on("connection", (socket) => {
  app.log.info(`Client connected: ${(socket as any).user.username}`);

  socket.on("console:subscribe", async (serverId: number) => {
    socket.join(`server-${serverId}`);
  });

  socket.on("console:attach", async (serverId: number) => {
    const key = `${(socket as any).user.id}-${serverId}`;
    try {
      const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as any;
      if (!server || !server.container_id) {
        socket.emit("console:error", { serverId, error: "Server not running" });
        return;
      }

      const container = docker.getContainer(server.container_id);
      const inspect = await container.inspect();
      if (!inspect.State.Running) {
        socket.emit("console:error", { serverId, error: "Container is not running" });
        return;
      }

      const logStream = await container.logs({
        follow: true, stdout: true, stderr: true, tail: 100, timestamps: false,
      });

      dockerStreamDemux(logStream,
        (data) => socket.emit("console:output", { serverId, data }),
        (data) => socket.emit("console:output", { serverId, data }),
      );

      logStream.on("end", () => {
        socket.emit("console:detached", { serverId });
      });

      activeAttachments.set(key, { stream: logStream, outputInterval: null as any });
      socket.emit("console:attached", { serverId });
    } catch (err: any) {
      socket.emit("console:error", { serverId, error: err.message });
    }
  });

  socket.on("console:command", async ({ serverId, command }: { serverId: number; command: string }) => {
    try {
      const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as any;
      if (!server || !server.container_id) {
        socket.emit("console:error", { serverId, error: "Server not running" });
        return;
      }

      const container = docker.getContainer(server.container_id);
      const exec = await container.exec({
        Cmd: ["rcon-cli", command],
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({ Detach: false });
      dockerStreamDemux(stream,
        (data) => socket.emit("console:output", { serverId, data }),
        (data) => socket.emit("console:output", { serverId, data }),
      );
    } catch (err: any) {
      socket.emit("console:error", { serverId, error: err.message });
    }
  });

  socket.on("console:detach", (serverId: number) => {
    const key = `${(socket as any).user.id}-${serverId}`;
    const attachment = activeAttachments.get(key);
    if (attachment) {
      attachment.stream?.destroy();
      activeAttachments.delete(key);
      socket.emit("console:detached", { serverId });
    }
  });

  socket.on("console:unsubscribe", (serverId: number) => {
    socket.leave(`server-${serverId}`);
    const key = `${(socket as any).user.id}-${serverId}`;
    const attachment = activeAttachments.get(key);
    if (attachment) {
      attachment.stream?.destroy();
      activeAttachments.delete(key);
    }
  });

  socket.on("disconnect", () => {
    for (const [key, attachment] of activeAttachments) {
      if (key.startsWith(`${(socket as any).user.id}-`)) {
        attachment.stream?.destroy();
        activeAttachments.delete(key);
      }
    }
    app.log.info(`Client disconnected: ${(socket as any).user.username}`);
  });
});

export { app, io };
