import { FastifyInstance } from "fastify";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import {
  getAllServers,
  getServerById,
  createServer,
  updateServer,
  deleteServer,
  startServer,
  stopServer,
  restartServer,
  getServerLogs,
  sendCommand,
  getServerConfig,
  setServerConfig,
  findAvailablePort,
} from "../services/server.service.js";
import { getServerMetrics, getMetricsHistory } from "../services/metrics.service.js";
import { getImageName } from "../config/docker.js";
import docker from "../config/docker.js";
import { rmSync, existsSync } from "fs";
import db from "../config/database.js";

let ioRef: any = null;

export function setSocketIO(io: any) {
  ioRef = io;
}

export default async function serverRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/servers", opts, async () => {
    return { servers: getAllServers() };
  });

  app.get("/api/servers/:id", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });
    return { server };
  });

  app.post("/api/servers", { preHandler: [authMiddleware, adminMiddleware, validate(schemas.createServer)] }, async (request, reply) => {
    const { name, mc_version, software, ram_mb, image, eula_accepted } = request.body as any;
    const port = findAvailablePort();
    const server = createServer({
      name,
      mc_version,
      software: software || "vanilla",
      ram_mb: ram_mb || 2048,
      port,
      image,
      eula_accepted,
    });
    return reply.status(201).send({ server });
  });

  app.put("/api/servers/:id", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });
    updateServer(Number(id), request.body as any);
    return { server: getServerById(Number(id)) };
  });

  app.delete("/api/servers/:id", { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    const containerName = `biryani-mc-${server.id}`;
    try {
      const container = docker.getContainer(containerName);
      await container.stop({ t: 30 }).catch(() => {});
      await container.remove({ force: true }).catch(() => {});
    } catch {}

    deleteServer(Number(id));
    const dataDir = `${process.cwd()}/data/server-${server.id}`;
    try { if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true }); } catch {}
    return { success: true };
  });

  app.post("/api/servers/:id/start", opts, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await startServer(Number(id));
      if (ioRef) ioRef.to("server-" + id).emit("server:status", { serverId: Number(id), status: "running" });
      return { success: true, status: "running" };
    } catch (err: any) {
      const { id } = request.params as { id: string };
      if (ioRef) ioRef.to("server-" + id).emit("server:status", { serverId: Number(id), status: "error" });
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post("/api/servers/:id/stop", opts, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await stopServer(Number(id));
      if (ioRef) ioRef.to("server-" + id).emit("server:status", { serverId: Number(id), status: "stopped" });
      return { success: true, status: "stopped" };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post("/api/servers/:id/restart", opts, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await restartServer(Number(id));
      if (ioRef) ioRef.to("server-" + id).emit("server:status", { serverId: Number(id), status: "running" });
      return { success: true, status: "running" };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/api/servers/:id/logs", opts, async (request) => {
    const { id } = request.params as { id: string };
    const tail = Number((request.query as any).tail) || 100;
    const logs = await getServerLogs(Number(id), tail);
    return { logs };
  });

  app.post("/api/servers/:id/command", {
    preHandler: [authMiddleware, validate(schemas.sendCommand)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { command } = request.body as any;
    try {
      await sendCommand(Number(id), command);
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/api/servers/:id/config", opts, async (request) => {
    const { id } = request.params as { id: string };
    return { config: getServerConfig(Number(id)) };
  });

  app.put("/api/servers/:id/config", { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
    const { id } = request.params as { id: string };
    const { key, value } = request.body as { key: string; value: string };
    setServerConfig(Number(id), key, value);
    return { success: true };
  });

  app.get("/api/servers/:id/metrics", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const metrics = await getServerMetrics(Number(id));
    if (!metrics) return reply.status(404).send({ error: "No metrics available" });
    return { metrics };
  });

  app.get("/api/servers/:id/metrics/history", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const range = (request.query as any).range || "1h";
    const metrics = getMetricsHistory(Number(id), range);
    return { metrics };
  });

  app.get("/api/mc-versions", opts, async (_request, reply) => {
    try {
      const res = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
      const data = await res.json() as any;
      const versions = (data.versions || []).map((v: any) => ({
        id: v.id,
        type: v.type,
        releaseDate: v.releaseTime,
      }));
      const latest = data.latest || {};
      return { versions, latest };
    } catch {
      return reply.status(502).send({ error: "Failed to fetch Minecraft versions" });
    }
  });

  app.post("/api/servers/:id/update-version", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { version } = request.body as { version: string };
    if (!version) return reply.status(400).send({ error: "version is required" });

    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    try {
      const res = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
      const data = await res.json() as any;
      const exists = (data.versions || []).some((v: any) => v.id === version);
      if (!exists) return reply.status(400).send({ error: `Version "${version}" not found` });
    } catch {
      return reply.status(502).send({ error: "Failed to validate version" });
    }

    if (server.status === "running") {
      await stopServer(Number(id));
    }

    db.prepare("UPDATE servers SET mc_version = ? WHERE id = ?").run(version, Number(id));
    const existing = db.prepare("SELECT 1 FROM server_config WHERE server_id = ? AND key = 'VERSION'").get(Number(id));
    if (existing) {
      db.prepare("UPDATE server_config SET value = ? WHERE server_id = ? AND key = 'VERSION'").run(version, Number(id));
    } else {
      db.prepare("INSERT INTO server_config (server_id, key, value) VALUES (?, ?, ?)").run(Number(id), "VERSION", version);
    }

    if (server.status === "running") {
      await startServer(Number(id));
    }

    return { success: true, version };
  });
}
