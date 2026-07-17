import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { searchMods, searchPlugins, getProject, getProjectVersions, downloadMod } from "../services/modrinth.service.js";
import { getServerById } from "../services/server.service.js";
import { readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";

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
      const { slug } = request.params as { slug: string };
      const project = await getProject(slug);
      return { project };
    } catch {
      return reply.status(404).send({ error: "Project not found" });
    }
  });

  app.get("/api/mods/:slug/versions", opts, async (request) => {
    const { version, loader } = request.query as any;
    const { slug } = request.params as { slug: string };
    const versions = await getProjectVersions(slug, version, loader);
    return { versions };
  });

  app.get("/api/servers/:id/mods", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    const modsDir = join(`${process.cwd()}/data/server-${server.id}`, "mods");
    try {
      const files = readdirSync(modsDir);
      const mods = files
        .filter((f) => f.endsWith(".jar"))
        .map((f) => {
          const stat = statSync(join(modsDir, f));
          return { filename: f, size: stat.size, modified: stat.mtime.toISOString() };
        })
        .sort((a, b) => a.filename.localeCompare(b.filename));
      return { mods };
    } catch {
      return { mods: [] };
    }
  });

  app.post("/api/servers/:id/mods/install", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { versionId } = request.body as { versionId: string };
    if (!versionId) return reply.status(400).send({ error: "versionId is required" });

    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    const dataDir = `${process.cwd()}/data/server-${server.id}`;
    const result = await downloadMod(versionId, dataDir);
    if (!result.success) {
      return reply.status(500).send({ error: result.error });
    }

    return { success: true, filename: result.filename };
  });

  app.delete("/api/servers/:id/mods/:filename", opts, async (request, reply) => {
    const { id, filename } = request.params as { id: string; filename: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    try {
      const filePath = join(`${process.cwd()}/data/server-${server.id}/mods`, filename);
      unlinkSync(filePath);
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
