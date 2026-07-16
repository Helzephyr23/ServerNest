import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { searchMods, searchPlugins, getProject, getProjectVersions } from "../services/modrinth.service.js";

export default async function modsRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/mods/search", opts, async (request) => {
    const { q, version, loader, limit } = request.query as any;
    const mods = await searchMods(q || "", version, loader, limit ? Number(limit) : 20);
    return { mods };
  });

  app.get("/api/mods/plugins", opts, async (request) => {
    const { q, version, limit } = request.query as any;
    const plugins = await searchPlugins(q || "", version, limit ? Number(limit) : 20);
    return { plugins };
  });

  app.get("/api/mods/:slug", opts, async (request, reply) => {
    try {
      const project = await getProject(request.params.slug as string);
      return { project };
    } catch {
      return reply.status(404).send({ error: "Project not found" });
    }
  });

  app.get("/api/mods/:slug/versions", opts, async (request) => {
    const { version, loader } = request.query as any;
    const versions = await getProjectVersions(request.params.slug as string, version, loader);
    return { versions };
  });
}
