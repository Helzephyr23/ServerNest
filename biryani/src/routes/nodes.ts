import { FastifyInstance } from "fastify";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import {
  getAllNodes,
  getNodeById,
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

  app.post("/api/nodes", adminOpts, async (request, reply) => {
    const { name, hostname, port, api_key, max_servers } = request.body as any;
    if (!name || !hostname || !api_key) {
      return reply.status(400).send({ error: "name, hostname, and api_key are required" });
    }
    const node = createNode({ name, hostname, port: port || 50051, api_key, max_servers });
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

  app.post("/api/nodes/:id/heartbeat", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { metrics } = request.body as { metrics?: { cpu_percent?: number; memory_percent?: number; disk_percent?: number } };
    const node = getNodeById(Number(id));
    if (!node) return reply.status(404).send({ error: "Node not found" });
    updateNodeHeartbeat(Number(id), metrics);
    return { success: true };
  });

  app.post("/api/nodes/heartbeat", opts, async (request, reply) => {
    const { name, api_key, metrics } = request.body as {
      name?: string;
      api_key: string;
      metrics?: { cpu_percent?: number; memory_percent?: number; disk_percent?: number };
    };
    const node = name ? getNodeById(Number(name)) : undefined;
    if (!node) return reply.status(404).send({ error: "Node not found" });
    updateNodeHeartbeat(node.id, metrics);
    return { success: true };
  });

  app.get("/api/nodes/metrics", opts, async () => {
    return { metrics: await getNodeMetrics() };
  });

  app.get("/api/overview", opts, async () => {
    const nodes = getAllNodes();
    const metrics = await getNodeMetrics();
    return { nodes, metrics };
  });

  app.post("/api/nodes/find-for-server", opts, async () => {
    const node = findNodeForNewServer();
    return { node: node || null };
  });
}
