import { FastifyInstance } from "fastify";
import { authMiddleware, adminMiddleware, operatorOrAboveMiddleware } from "../middleware/auth.js";
import { validate, validateQuery, schemas } from "../middleware/validate.js";
import {
  getAllServers,
  getServerById,
  createServer,
  updateServer,
  deleteServer,
  cloneServer,
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
import { serverDataDir } from "../utils/data-dir.js";
import { logAudit } from "../services/audit.service.js";
import docker from "../config/docker.js";
import { rmSync, existsSync, mkdirSync, readdirSync, readFileSync, createWriteStream, statSync } from "fs";
import os from "os";
import path from "path";
const { join, resolve: pathResolve } = path;
import { pipeline } from "stream/promises";
import { Transform } from "stream";
import zlib from "zlib";
import tar from "tar-fs";
import yauzl from "yauzl";
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
    const { name, description, icon, mc_version, software, ram_mb, image, eula_accepted } = request.body as { name: string; description?: string; icon?: string; mc_version: string; software?: string; ram_mb?: number; image?: string; eula_accepted: boolean };
    const port = await findAvailablePort();
    const server = createServer({
      name,
      description,
      icon,
      mc_version,
      software: software || "vanilla",
      ram_mb: ram_mb || 2048,
      port,
      image,
      eula_accepted,
    });
    logAudit({ user_id: (request as any).user?.id, username: (request as any).user?.username, action: "server.create", target_type: "server", target_id: server.id, details: name, ip: request.ip });
    return reply.status(201).send({ server });
  });

  app.post("/api/servers/import", { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    let importedServer: { id?: number; name?: string } | null = null;
    try {
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: "No file uploaded" });

      const fields = data.fields as Record<string, { value: string }[] | undefined>;
      const serverName = fields.name?.[0]?.value?.trim();
      const software = fields.software?.[0]?.value || "vanilla";
      const mc_version = fields.mc_version?.[0]?.value || "1.21.4";
      const ram_mb = parseInt(fields.ram_mb?.[0]?.value || "2048");
      const eula_accepted = fields.eula_accepted?.[0]?.value === "true";

      if (!serverName) return reply.status(400).send({ error: "Server name is required" });
      if (!eula_accepted) return reply.status(400).send({ error: "You must accept the Minecraft EULA" });
      if (serverName.length > 50) return reply.status(400).send({ error: "Name must be 50 characters or less" });
      if (isNaN(ram_mb) || ram_mb < 512 || ram_mb > 32768) return reply.status(400).send({ error: "RAM must be between 512 and 32768 MB" });

      const port = await findAvailablePort();
      importedServer = createServer({ name: serverName, software, mc_version, ram_mb, port, eula_accepted });
      const importDataDir = serverDataDir(importedServer.id!);
      if (!existsSync(importDataDir)) mkdirSync(importDataDir, { recursive: true });

      const filename = data.filename.toLowerCase();
      if (filename.endsWith(".zip")) {
        const tmpPath = join(os.tmpdir(), `import-${importedServer.id}-${Date.now()}.zip`);
        const ws = createWriteStream(tmpPath);
        await pipeline(data.file, ws);
        const fileSize = statSync(tmpPath).size;
        request.log.info({ fileSize }, "Received zip upload");
        if (fileSize === 0) throw new Error("Uploaded file is empty");
        await new Promise<void>((resolve, reject) => {
          yauzl.open(tmpPath, { lazyEntries: true }, (err: any, zipfile: any) => {
            if (err) { reject(err); return; }
            zipfile.on("entry", (entry: any) => {
              const entryPath = pathResolve(importDataDir, entry.fileName);
              if (!entryPath.startsWith(pathResolve(importDataDir))) {
                request.log.warn({ fileName: entry.fileName }, "Zip Slip path traversal attempt â€” skipping entry");
                zipfile.readEntry();
                return;
              }
              if (entry.fileName.endsWith("/")) {
                if (!existsSync(entryPath)) mkdirSync(entryPath, { recursive: true });
                zipfile.readEntry();
              } else {
                mkdirSync(join(entryPath, ".."), { recursive: true });
                zipfile.openReadStream(entry, (err2: any, readStream: any) => {
                  if (err2) { reject(err2); return; }
                  const ws2 = createWriteStream(entryPath);
                  ws2.on("finish", () => zipfile.readEntry());
                  ws2.on("error", reject);
                  readStream.pipe(ws2);
                });
              }
            });
            zipfile.on("end", resolve);
            zipfile.on("error", reject);
            zipfile.readEntry();
          });
        });
        try { rmSync(tmpPath, { force: true }); } catch {}
      } else if (filename.endsWith(".tar.gz") || filename.endsWith(".tgz")) {
        const gunzip1 = zlib.createGunzip();
        let g2: ReturnType<typeof zlib.createGunzip> | null = null;
        let checked = false;
        const dedouble = new Transform({
          transform(chunk: Buffer, encoding: BufferEncoding, callback: () => void) {
            const self = this as Transform;
            if (!checked) {
              checked = true;
              if (chunk.length >= 2 && chunk[0] === 0x1f && chunk[1] === 0x8b) {
                g2 = zlib.createGunzip();
                g2.on("data", (d: Buffer) => self.push(d));
                g2.on("end", () => self.push(null));
                g2.on("error", callback);
                g2.write(chunk, encoding, callback);
                return;
              }
            }
            if (g2) { g2.write(chunk, encoding, callback); }
            else { self.push(chunk); callback(); }
          },
          final(callback: () => void) {
            if (g2) { g2.end(); callback(); }
            else { callback(); }
          }
        });
            await pipeline(data.file, gunzip1, dedouble, tar.extract(importDataDir));
      } else {
        throw new Error("Unsupported archive format. Upload a .zip or .tar.gz file");
      }

      const detected: { software?: string; version?: string } = {};
      try {
        const files = readdirSync(importDataDir);
        for (const file of files) {
          const lower = file.toLowerCase();
          if (lower.startsWith("paper-") && lower.endsWith(".jar")) {
            detected.software = "paper"; break;
          }
          if (lower.startsWith("purpur-") && lower.endsWith(".jar")) {
            detected.software = "purpur"; break;
          }
          if (lower.startsWith("fabric-server-") && lower.endsWith(".jar")) {
            detected.software = "fabric"; break;
          }
          if ((lower.startsWith("forge-") || lower.includes("-universal")) && lower.endsWith(".jar")) {
            detected.software = "forge"; break;
          }
          if (lower.startsWith("spigot-") && lower.endsWith(".jar")) {
            detected.software = "spigot"; break;
          }
        }
        const versionPath = join(importDataDir, "version.json");
        if (existsSync(versionPath)) {
          try {
            const vdata = JSON.parse(readFileSync(versionPath, "utf-8"));
            detected.version = vdata.id || vdata.name || undefined;
          } catch {}
        }
      } catch {}

      if (detected.software && detected.software !== software) {
        db.prepare("UPDATE servers SET software = ? WHERE id = ?").run(detected.software, importedServer.id);
        db.prepare("UPDATE server_config SET value = ? WHERE server_id = ? AND key = 'TYPE'")
          .run(detected.software.toUpperCase(), importedServer.id);
      }
      if (detected.version) {
        db.prepare("UPDATE servers SET mc_version = ? WHERE id = ?").run(detected.version, importedServer.id);
        db.prepare("UPDATE server_config SET value = ? WHERE server_id = ? AND key = 'VERSION'")
          .run(detected.version, importedServer.id);
      }

      return reply.status(201).send({ server: getServerById(importedServer.id!), detected });
    } catch (err: unknown) {
      if (importedServer) {
        const dir = serverDataDir(importedServer.id!);
        try { rmSync(dir, { recursive: true, force: true }); } catch {}
        try { db.prepare("DELETE FROM servers WHERE id = ?").run(importedServer.id); } catch {}
      }
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.put("/api/servers/:id", { preHandler: [authMiddleware, validate(schemas.updateServer)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });
    try {
      updateServer(Number(id), request.body as Record<string, unknown>);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
    return { server: getServerById(Number(id)) };
  });

  app.delete("/api/servers/:id", { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    const containerName = `servernest-mc-${server.id}`;
    try {
      const container = docker.getContainer(containerName);
      await container.stop({ t: 30 }).catch(() => {});
      await container.remove({ force: true }).catch(() => {});
    } catch {}

    deleteServer(Number(id));
      const dataDir = serverDataDir(server.id);
    try { if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true }); } catch {}
    logAudit({ user_id: (request as any).user?.id, username: (request as any).user?.username, action: "server.delete", target_type: "server", target_id: Number(id), details: server.name, ip: request.ip });
    return { success: true };
  });

  app.post("/api/servers/:id/clone", { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const server = await cloneServer(Number(id));
      return reply.status(201).send({ server });
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.post("/api/servers/:id/start", { preHandler: [authMiddleware, operatorOrAboveMiddleware] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await startServer(Number(id));
      logAudit({ user_id: (request as any).user?.id, username: (request as any).user?.username, action: "server.start", target_type: "server", target_id: Number(id), ip: request.ip });
      if (ioRef) ioRef.to("server-" + id).emit("server:status", { serverId: Number(id), status: "running" });
      return { success: true, status: "running" };
    } catch (err: unknown) {
      const { id } = request.params as { id: string };
      if (ioRef) ioRef.to("server-" + id).emit("server:status", { serverId: Number(id), status: "error" });
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.post("/api/servers/:id/stop", { preHandler: [authMiddleware, operatorOrAboveMiddleware] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await stopServer(Number(id));
      logAudit({ user_id: (request as any).user?.id, username: (request as any).user?.username, action: "server.stop", target_type: "server", target_id: Number(id), ip: request.ip });
      if (ioRef) ioRef.to("server-" + id).emit("server:status", { serverId: Number(id), status: "stopped" });
      return { success: true, status: "stopped" };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.post("/api/servers/:id/restart", { preHandler: [authMiddleware, operatorOrAboveMiddleware] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await restartServer(Number(id));
      logAudit({ user_id: (request as any).user?.id, username: (request as any).user?.username, action: "server.restart", target_type: "server", target_id: Number(id), ip: request.ip });
      if (ioRef) ioRef.to("server-" + id).emit("server:status", { serverId: Number(id), status: "running" });
      return { success: true, status: "running" };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.get("/api/servers/:id/logs", { preHandler: [authMiddleware, validateQuery(schemas.serverLogsQuery)] }, async (request) => {
    const { id } = request.params as { id: string };
    const { tail: tailParam } = request.query as { tail?: string };
    const tail = Number(tailParam) || 100;
    const logs = await getServerLogs(Number(id), tail);
    return { logs };
  });

  app.post("/api/servers/:id/command", {
    preHandler: [authMiddleware, validate(schemas.sendCommand)],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { command } = request.body as { command: string };
    try {
      await sendCommand(Number(id), command);
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.get("/api/servers/:id/config", opts, async (request) => {
    const { id } = request.params as { id: string };
    return { config: getServerConfig(Number(id)) };
  });

  app.put("/api/servers/:id/config", { preHandler: [authMiddleware, adminMiddleware, validate(schemas.updateServerConfig)] }, async (request) => {
    const { id } = request.params as { id: string };
    const { key, value } = request.body as { key: string; value: string };
    setServerConfig(Number(id), key, value);
    return { success: true };
  });

  app.get("/api/servers/:id/backup-settings", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });
    return {
      auto_backup: server.auto_backup,
      backup_interval: server.backup_interval,
      backup_retention: server.backup_retention,
      last_auto_backup: server.last_auto_backup,
    };
  });

  app.put("/api/servers/:id/backup-settings", { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });
    const { auto_backup, backup_interval, backup_retention } = request.body as {
      auto_backup?: number;
      backup_interval?: number;
      backup_retention?: number;
    };
    if (auto_backup !== undefined) {
      db.prepare("UPDATE servers SET auto_backup = ? WHERE id = ?").run(auto_backup ? 1 : 0, Number(id));
    }
    if (backup_interval !== undefined) {
      const clamped = Math.max(5, Math.min(1440, Number(backup_interval)));
      db.prepare("UPDATE servers SET backup_interval = ? WHERE id = ?").run(clamped, Number(id));
    }
    if (backup_retention !== undefined) {
      const clamped = Math.max(1, Math.min(50, Number(backup_retention)));
      db.prepare("UPDATE servers SET backup_retention = ? WHERE id = ?").run(clamped, Number(id));
    }
    return { success: true };
  });

  app.get("/api/servers/:id/metrics", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const metrics = await getServerMetrics(Number(id));
    if (!metrics) return reply.status(404).send({ error: "No metrics available" });
    return { metrics };
  });

  app.get("/api/servers/:id/metrics/history", opts, async (request) => {
    const { id } = request.params as { id: string };
    const { range = "1h" } = request.query as { range?: string };
    const metrics = getMetricsHistory(Number(id), range as "1h" | "6h" | "24h" | "7d");
    return { metrics };
  });

  app.get("/api/mc-versions", opts, async (_request, reply) => {
    try {
      const res = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
      const data = await res.json() as { versions?: { id: string; type: string; releaseTime: string }[]; latest?: Record<string, string> };
      const versions = (data.versions || []).map((v) => ({
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

  app.post("/api/servers/:id/update-version", { preHandler: [authMiddleware, validate(schemas.updateVersion)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { version } = request.body as { version: string };

    const server = getServerById(Number(id));
    if (!server) return reply.status(404).send({ error: "Server not found" });

    try {
      const res = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
      const data = await res.json() as { versions?: { id: string }[] };
      const exists = (data.versions || []).some((v) => v.id === version);
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
