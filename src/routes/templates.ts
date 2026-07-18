import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { getAllTemplates, getTemplate } from "../services/template.service.js";

export default async function templateRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/templates", opts, async () => {
    return { templates: getAllTemplates() };
  });

  app.get("/api/templates/:id", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const template = getTemplate(id);
    if (!template) return reply.status(404).send({ error: "Template not found" });
    return { template };
  });
}
