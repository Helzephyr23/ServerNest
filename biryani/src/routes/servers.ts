import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
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

export default async function serverRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/servers", opts, async () => {
    return { servers: getAllServers() };
  });

  app.get("/api/servers/:id", opts, async (request, reply) => {
    const server = getServerById(Number(request.params.id));
    if (!server) return reply.status(404).send({ error: "Server not found" });
    return { server };
  });

  app.post("/api/servers", opts, async (request, reply) => {
    const { name, mc_version, software, ram_mb } = request.body as any;
    if (!name || !mc_version) {
      return reply.status(400).send({ error: "name and mc_version are required" });
    }
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
    const server = getServerById(Number(request.params.id));
    if (!server) return reply.status(404).send({ error: "Server not found" });
    updateServer(Number(request.params.id), request.body as any);
    return { server: getServerById(Number(request.params.id)) };
  });

  app.delete("/api/servers/:id", opts, async (request, reply) => {
    const server = getServerById(Number(request.params.id));
    if (!server) return reply.status(404).send({ error: "Server not found" });
    await stopServer(Number(request.params.id)).catch(() => {});
    deleteServer(Number(request.params.id));
    return { success: true };
  });

  app.post("/api/servers/:id/start", opts, async (request, reply) => {
    try {
      await startServer(Number(request.params.id));
      return { success: true, status: "running" };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post("/api/servers/:id/stop", opts, async (request, reply) => {
    try {
      await stopServer(Number(request.params.id));
      return { success: true, status: "stopped" };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post("/api/servers/:id/restart", opts, async (request, reply) => {
    try {
      await restartServer(Number(request.params.id));
      return { success: true, status: "running" };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/api/servers/:id/logs", opts, async (request) => {
    const tail = Number((request.query as any).tail) || 100;
    const logs = await getServerLogs(Number(request.params.id), tail);
    return { logs };
  });

  app.post("/api/servers/:id/command", opts, async (request, reply) => {
    const { command } = request.body as { command: string };
    if (!command) return reply.status(400).send({ error: "command is required" });
    try {
      await sendCommand(Number(request.params.id), command);
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/api/servers/:id/config", opts, async (request) => {
    return { config: getServerConfig(Number(request.params.id)) };
  });

  app.put("/api/servers/:id/config", opts, async (request) => {
    const { key, value } = request.body as { key: string; value: string };
    setServerConfig(Number(request.params.id), key, value);
    return { success: true };
  });

  app.get("/api/servers/:id/metrics", opts, async (request, reply) => {
    const metrics = await getServerMetrics(Number(request.params.id));
    if (!metrics) return reply.status(404).send({ error: "No metrics available" });
    return { metrics };
  });
}
