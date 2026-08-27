import http from "node:http";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import { Server as SocketIOServer } from "socket.io";
import { env, checkJwtSecret } from "./config/env.js";
import { migrate } from "./config/database.js";
import db from "./config/database.js";
import { getSessionByJti, getUserById } from "./services/auth.service.js";
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
import cloudStorageRoutes from "./routes/cloud-storage.js";
import googleDriveRoutes from "./routes/google-drive.js";
import rateLimitRoutes from "./routes/rate-limits.js";
import sessionRoutes from "./routes/sessions.js";
import auditRoutes from "./routes/audit.js";
import { loadRateLimits } from "./middleware/rate-limit.js";
import { setSocketIO } from "./routes/servers.js";
import { startAllTasks } from "./services/schedule.service.js";
import { notify } from "./services/notification.service.js";
import { markStaleNodesOffline } from "./services/node.service.js";

import docker, { dockerStreamDemux } from "./config/docker.js";

if (env.NODE_ENV === "production") {
  checkJwtSecret();
}

const app = Fastify({
  logger: true,
  serverFactory: (handler) => http.createServer((req, res) => handler(req, res)),
});

const corsOrigin = process.env.CORS_ORIGIN || (env.NODE_ENV === "production" ? false : true);
await app.register(cors, { origin: corsOrigin, credentials: true });
await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.JWT_EXPIRES_IN } });
await app.register(cookie);
await app.register(multipart, { limits: { fileSize: 2048 * 1024 * 1024 } });

await app.register(helmet, {
  contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
  hsts: env.NODE_ENV === "production" ? { maxAge: 31536000, includeSubDomains: true } : false,
  xssFilter: true,
  noSniff: true,
  frameguard: { action: "deny" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

app.setErrorHandler((error: any, request, reply) => {
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 && env.NODE_ENV === "production"
    ? "Internal server error"
    : error.message || "Unknown error";
  if (statusCode === 500) {
    request.log.error(error.stack || error.message);
  }
  reply.status(statusCode).send({ error: message });
});

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
await app.register(cloudStorageRoutes);
await app.register(googleDriveRoutes);
await app.register(rateLimitRoutes);
  await app.register(sessionRoutes);
  await app.register(auditRoutes);

app.get("/api/health", async () => {
  let dockerOk = false;
  try { await docker.ping(); dockerOk = true; } catch {}
  return { status: "ok", version: "0.1.0", docker: dockerOk };
});

migrate();
loadRateLimits();
app.log.info("Database migrated");

await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
app.log.info(`Biryani API running on port ${env.API_PORT}`);

const io = new SocketIOServer(app.server as ReturnType<typeof http.createServer>, {
  cors: {
    origin: corsOrigin === true ? true : corsOrigin === false ? false : corsOrigin,
    credentials: true,
  },
});
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
  } catch (err: unknown) {
    app.log.error(`[Scheduler] Task ${task.name} failed: ${(err as Error).message}`);
    await notify("task_failed", "Task Failed", `Scheduled task "${task.name}" failed: ${(err as Error).message}`, 0xff0000);
  }
});

const metricInterval = setInterval(async () => {
  const { collectAllMetrics } = await import("./services/metrics.service.js");
  await collectAllMetrics();
}, 60000);

const staleNodeInterval = setInterval(() => {
  markStaleNodesOffline();
}, 60000);

const autoBackupInterval = setInterval(() => {
  import("./services/backup.service.js").then(({ checkAndRunAutoBackups }) => {
    checkAndRunAutoBackups();
  });
}, 60000);

const backupRotationInterval = setInterval(() => {
  import("./services/backup.service.js").then(({ rotateAllBackups }) => {
    rotateAllBackups();
  });
}, 3600000);

const serverCheckInterval = setInterval(async () => {
  try {
    const servers = db.prepare("SELECT id, container_id, status FROM servers WHERE status IN ('running', 'starting')").all() as { id: number; container_id: string | null; status: string }[];
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
    let token: string | undefined;

    const auth = socket.handshake.auth?.token;
    if (auth) {
      token = auth;
    } else {
      const cookieHeader = socket.handshake.headers?.cookie;
      if (cookieHeader) {
        const match = cookieHeader.match(/biryani_token=([^;]+)/);
        if (match) token = match[1];
      }
    }

    if (!token) return next(new Error("No token"));
    const decoded = app.jwt.verify<{ id: number; username: string; jti?: string }>(token);
    if (decoded.jti) {
      const session = getSessionByJti(decoded.jti);
      if (!session) return next(new Error("Session revoked"));
    }
    socket.data.user = decoded;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

// Track active container attachments per socket
const activeAttachments = new Map<string, { stream: NodeJS.ReadableStream & { destroy(): void }; outputInterval: NodeJS.Timeout }>();

io.on("connection", (socket) => {
  const user = socket.data.user as { id: number; username: string };
  app.log.info(`Client connected: ${user.username}`);

  function canAccessConsole(): boolean {
    const dbUser = getUserById(user.id);
    return dbUser?.role === "admin" || dbUser?.role === "operator";
  }

  socket.on("console:subscribe", async (serverId: number) => {
    if (!canAccessConsole()) {
      socket.emit("console:error", { serverId, error: "Console access requires admin or operator role" });
      return;
    }
    const server = db.prepare("SELECT 1 FROM servers WHERE id = ?").get(serverId);
    if (!server) {
      socket.emit("console:error", { serverId, error: "Server not found" });
      return;
    }
    socket.join(`server-${serverId}`);
  });

  socket.on("console:attach", async (serverId: number) => {
    if (!canAccessConsole()) {
      socket.emit("console:error", { serverId, error: "Console access requires admin or operator role" });
      return;
    }
    const key = `${user.id}-${serverId}`;
    try {
      const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as { id: number; container_id: string | null } | undefined;
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
        follow: true, stdout: true, stderr: true, tail: 500, timestamps: false,
      });

      dockerStreamDemux(logStream,
        (data) => socket.emit("console:output", { serverId, data }),
        (data) => socket.emit("console:output", { serverId, data }),
      );

      logStream.on("end", () => {
        socket.emit("console:detached", { serverId });
      });

      const existing = activeAttachments.get(key);
      if (existing?.stream) existing.stream.destroy();
      activeAttachments.set(key, { stream: logStream as NodeJS.ReadableStream & { destroy(): void }, outputInterval: null as unknown as NodeJS.Timeout });
      socket.emit("console:attached", { serverId });
    } catch (err: unknown) {
      socket.emit("console:error", { serverId, error: (err as Error).message });
    }
  });

  socket.on("console:command", async ({ serverId, command }: { serverId: number; command: string }) => {
    if (!canAccessConsole()) {
      socket.emit("console:error", { serverId, error: "Console access requires admin or operator role" });
      return;
    }
    try {
      const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as { id: number; container_id: string | null } | undefined;
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
      const stream = await exec.start({ Detach: false, Tty: false });
      const timeout = setTimeout(() => {
        stream.destroy();
        socket.emit("console:error", { serverId, error: "Command timed out (30s)" });
      }, 30000);
      stream.on("end", () => clearTimeout(timeout));
      stream.on("error", () => clearTimeout(timeout));
      dockerStreamDemux(stream,
        (data) => socket.emit("console:output", { serverId, data }),
        (data) => socket.emit("console:output", { serverId, data }),
      );
    } catch (err: unknown) {
      socket.emit("console:error", { serverId, error: (err as Error).message });
    }
  });

  socket.on("console:detach", (serverId: number) => {
    const key = `${user.id}-${serverId}`;
    const attachment = activeAttachments.get(key);
    if (attachment) {
      attachment.stream?.destroy();
      activeAttachments.delete(key);
      socket.emit("console:detached", { serverId });
    }
  });

  socket.on("console:unsubscribe", (serverId: number) => {
    socket.leave(`server-${serverId}`);
    const key = `${user.id}-${serverId}`;
    const attachment = activeAttachments.get(key);
    if (attachment) {
      attachment.stream?.destroy();
      activeAttachments.delete(key);
    }
  });

  socket.on("disconnect", () => {
    for (const [key, attachment] of activeAttachments) {
      if (key.startsWith(`${user.id}-`)) {
        attachment.stream?.destroy();
        activeAttachments.delete(key);
      }
    }
    app.log.info(`Client disconnected: ${user.username}`);
  });
});

function gracefulShutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down gracefully...`);
  clearInterval(metricInterval);
  clearInterval(staleNodeInterval);
  clearInterval(autoBackupInterval);
  clearInterval(backupRotationInterval);
  clearInterval(serverCheckInterval);
  for (const [, attachment] of activeAttachments) {
    attachment.stream?.destroy();
  }
  activeAttachments.clear();
  io.close();
  app.close().then(() => {
    app.log.info("Server closed");
    process.exit(0);
  }).catch(() => process.exit(1));
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export { app, io };
