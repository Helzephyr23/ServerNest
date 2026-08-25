import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import {
  getAllNodes,
  getNodeById,
  getNodeByApiKey,
  createNode,
  deleteNode,
  updateNodeHeartbeat,
  getServersForNode,
  findNodeForNewServer,
} from "../services/node.service.js";
import { getNodeMetrics } from "../services/metrics.service.js";
export default async function nodeRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };
  const adminOpts = { preHandler: [authMiddleware, adminMiddleware] };

  app.get("/api/nodes", opts, async () => {
    return { nodes: getAllNodes() };
  });

  app.get("/api/nodes/:id", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const node = getNodeById(Number(id));
    if (!node) return reply.status(404).send({ error: "Node not found" });
    return { node };
  });

  app.get("/api/nodes/:id/servers", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const node = getNodeById(Number(id));
    if (!node) return reply.status(404).send({ error: "Node not found" });
    return { servers: getServersForNode(Number(id)) };
  });

  app.post("/api/nodes", { preHandler: [authMiddleware, adminMiddleware, validate(schemas.createNode)] }, async (request, reply) => {
    const data = request.body as z.infer<typeof schemas.createNode>;
    const node = createNode(data);
    return reply.status(201).send({ node });
  });

  app.delete("/api/nodes/:id", adminOpts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const node = getNodeById(Number(id));
    if (!node) return reply.status(404).send({ error: "Node not found" });
    if (node.name === "master") return reply.status(400).send({ error: "Cannot delete master node" });
    deleteNode(Number(id));
    return { success: true };
  });

  app.post("/api/nodes/:id/heartbeat", { preHandler: [authMiddleware, validate(schemas.nodeHeartbeat)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { metrics } = request.body as { metrics?: { cpu_percent?: number; memory_percent?: number; disk_percent?: number } };
    const node = getNodeById(Number(id));
    if (!node) return reply.status(404).send({ error: "Node not found" });
    updateNodeHeartbeat(Number(id), metrics);
    return { success: true };
  });

  app.post("/api/nodes/heartbeat", { preHandler: [authMiddleware, validate(schemas.nodeHeartbeatAgent)] }, async (request, reply) => {
    const { api_key, metrics } = request.body as {
      api_key: string;
      name?: string;
      metrics?: { cpu_percent?: number; memory_percent?: number; disk_percent?: number };
    };
    const node = getNodeByApiKey(api_key);
    if (!node) return reply.status(401).send({ error: "Invalid API key" });
    updateNodeHeartbeat(node.id, metrics);
    return { success: true };
  });

  app.get("/api/nodes/metrics", opts, async () => {
    return { metrics: await getNodeMetrics() };
  });

  app.post("/api/nodes/find-for-server", opts, async () => {
    const node = findNodeForNewServer();
    return { node: node || null };
  });
}
