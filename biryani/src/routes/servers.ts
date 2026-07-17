import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
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
import { getServerMetrics } from "../services/metrics.service.js";

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

  app.post("/api/servers", { preHandler: [authMiddleware, validate(schemas.createServer)] }, async (request, reply) => {
    const { name, mc_version, software, ram_mb } = request.body as any;
    const port = findAvailablePort();
    const server = createServer({
      name,
      mc_version,
      software: software || "vanilla",
      ram_mb: ram_mb || 2048,
      port,
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

  app.delete("/api/servers/:id", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });
    await stopServer(Number(id)).catch(() => {});
    deleteServer(Number(id));
    return { success: true };
  });

  app.post("/api/servers/:id/start", opts, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await startServer(Number(id));
      if (ioRef) ioRef.to("server-" + id).emit("server:status", { serverId: Number(id), status: "running" });
      return { success: true, status: "running" };
    } catch (err: any) {
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

  app.put("/api/servers/:id/config", opts, async (request) => {
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
}
