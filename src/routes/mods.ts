import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import { searchMods, searchPlugins, getProject, getProjectVersions, downloadMod } from "../services/modrinth.service.js";
import { getServerById } from "../services/server.service.js";
import db from "../config/database.js";
import { readdirSync, statSync, unlinkSync, existsSync } from "fs";
import { join, resolve } from "path";

interface InstalledModRow {
  slug: string;
  filename: string;
  version: string;
  mod_name: string;
}

export default async function modsRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/mods/search", opts, async (request) => {
    const { q, version, loader, limit } = request.query as { q?: string; version?: string; loader?: string; limit?: string };
    const mods = await searchMods(q || "", version, loader, limit ? Number(limit) : 20);
    return { mods };
  });

  app.get("/api/mods/plugins", opts, async (request) => {
    const { q, version, limit } = request.query as { q?: string; version?: string; limit?: string };
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
    const { version, loader } = request.query as { version?: string; loader?: string };
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

  app.post("/api/servers/:id/mods/install", { preHandler: [authMiddleware, validate(schemas.installMod)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { versionId } = request.body as { versionId: string };

    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    const dataDir = `${process.cwd()}/data/server-${server.id}`;
    const result = await downloadMod(versionId, dataDir);
    if (!result.success) {
      return reply.status(500).send({ error: result.error });
    }

    try {
      db.prepare("INSERT INTO installed_mods (server_id, slug, mod_name, filename, version, source) VALUES (?, ?, ?, ?, ?, 'modrinth')")
        .run(Number(id), result.slug, result.filename.replace(/\.jar$/, ""), result.filename, result.version_number);
    } catch {}

    return { success: true, filename: result.filename };
  });

  app.post("/api/servers/:id/mods/install-batch", { preHandler: [authMiddleware, validate(schemas.installModsBatch)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { versionIds } = request.body as { versionIds: string[] };

    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    const dataDir = `${process.cwd()}/data/server-${server.id}`;
    const results = [];

    for (const versionId of versionIds) {
      const result = await downloadMod(versionId, dataDir);
      results.push({ versionId, success: result.success, filename: result.filename, error: result.error });
      if (result.success) {
        try {
          db.prepare("INSERT INTO installed_mods (server_id, slug, mod_name, filename, version, source) VALUES (?, ?, ?, ?, ?, 'modrinth')")
            .run(Number(id), result.slug, result.filename.replace(/\.jar$/, ""), result.filename, result.version_number);
        } catch {}
      }
    }

    return { results };
  });

  app.post("/api/servers/:id/mods/check-updates", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    const dbMods = db.prepare("SELECT slug, filename, version, mod_name FROM installed_mods WHERE server_id = ? AND slug IS NOT NULL AND slug != ''").all(Number(id)) as InstalledModRow[];
    const updates: Record<string, unknown>[] = [];

    for (const mod of dbMods) {
      try {
        const versions = await getProjectVersions(mod.slug, server.mc_version);
        if (versions.length === 0) {
          db.prepare("UPDATE installed_mods SET has_update = 0, latest_version = NULL WHERE server_id = ? AND filename = ?")
            .run(Number(id), mod.filename);
          continue;
        }
        const latest = versions[0];
        if (latest.version_number !== mod.version) {
          updates.push({
            slug: mod.slug,
            filename: mod.filename,
            modName: mod.mod_name,
            currentVersion: mod.version,
            latestVersion: latest.version_number,
            latestVersionId: latest.id,
          });
          db.prepare("UPDATE installed_mods SET has_update = 1, latest_version = ? WHERE server_id = ? AND filename = ?")
            .run(latest.version_number, Number(id), mod.filename);
        } else {
          db.prepare("UPDATE installed_mods SET has_update = 0, latest_version = NULL WHERE server_id = ? AND filename = ?")
            .run(Number(id), mod.filename);
        }
      } catch {}
    }

    return { updates };
  });

  app.get("/api/servers/:id/mods/update-count", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    const row = db.prepare("SELECT COUNT(*) as count FROM installed_mods WHERE server_id = ? AND has_update = 1")
      .get(Number(id)) as { count: number };
    return { count: row.count };
  });

  app.post("/api/servers/:id/mods/update/:filename", opts, async (request, reply) => {
    const { id, filename } = request.params as { id: string; filename: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    const mod = db.prepare("SELECT slug, version FROM installed_mods WHERE server_id = ? AND filename = ?").get(Number(id), filename) as { slug: string; version: string } | undefined;
    if (!mod || !mod.slug) return reply.status(400).send({ error: "Mod slug not found — cannot check for updates" });

    try {
      const versions = await getProjectVersions(mod.slug, server.mc_version);
      if (versions.length === 0) return reply.status(404).send({ error: "No versions found" });
      const latest = versions[0];

      const dataDir = `${process.cwd()}/data/server-${server.id}`;
      const modsDir = resolve(dataDir, "mods");
      const oldPath = resolve(dataDir, "mods", filename);
      if (!oldPath.startsWith(modsDir)) return reply.status(400).send({ error: "Invalid filename" });

      const result = await downloadMod(latest.id, dataDir);
      if (!result.success) return reply.status(500).send({ error: result.error });

      // Only delete old file after successful download
      if (existsSync(oldPath)) unlinkSync(oldPath);

      db.prepare("UPDATE installed_mods SET filename = ?, version = ?, has_update = 0, latest_version = NULL WHERE server_id = ? AND filename = ?")
        .run(result.filename, result.version_number, Number(id), filename);

      return { success: true, filename: result.filename, version: result.version_number };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.delete("/api/servers/:id/mods/:filename", opts, async (request, reply) => {
    const { id, filename } = request.params as { id: string; filename: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    try {
      const modsDir = resolve(`${process.cwd()}/data/server-${server.id}/mods`);
      const filePath = resolve(modsDir, filename);
      if (!filePath.startsWith(modsDir)) return reply.status(400).send({ error: "Invalid filename" });
      unlinkSync(filePath);
      db.prepare("DELETE FROM installed_mods WHERE server_id = ? AND filename = ?").run(Number(id), filename);
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}
