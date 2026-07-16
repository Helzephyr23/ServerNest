import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { getAllNodes, getNodeById, createNode, deleteNode, updateNodeStatus } from "../services/node.service.js";
import { getNodeMetrics } from "../services/metrics.service.js";

export default async function nodeRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/nodes", opts, async () => {
    return { nodes: getAllNodes() };
  });

  app.get("/api/nodes/:id", opts, async (request, reply) => {
    const node = getNodeById(Number(request.params.id));
    if (!node) return reply.status(404).send({ error: "Node not found" });
    return { node };
  });

  app.post("/api/nodes", opts, async (request, reply) => {
    const { name, hostname, port, api_key, max_servers } = request.body as any;
    if (!name || !hostname || !api_key) {
      return reply.status(400).send({ error: "name, hostname, and api_key are required" });
    }
    const node = createNode({ name, hostname, port: port || 50051, api_key, max_servers });
    return reply.status(201).send({ node });
  });

  app.delete("/api/nodes/:id", opts, async (request, reply) => {
    const node = getNodeById(Number(request.params.id));
    if (!node) return reply.status(404).send({ error: "Node not found" });
    if (node.name === "master") return reply.status(400).send({ error: "Cannot delete master node" });
    deleteNode(Number(request.params.id));
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
}
