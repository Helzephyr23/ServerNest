import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import docker, { dockerStreamDemux } from "../config/docker.js";
import db from "../config/database.js";
import { join, normalize } from "path";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";

function sanitizePath(userPath: string): string {
  const normal = normalize(userPath).replace(/\\/g, "/");
  if (normal.startsWith("..") || normal.includes("/../")) {
    throw new Error("Invalid path: directory traversal detected");
  }
  return normal;
}

function sanitizeContainerPath(userPath: string): string {
  const normal = normalize("/data/" + userPath).replace(/\\/g, "/");
  if (!normal.startsWith("/data/") || normal.includes("/../")) {
    throw new Error("Invalid path: directory traversal detected");
  }
  return normal;
}

interface ServerRow {
  id: number;
  container_id: string | null;
}

async function execInContainer(serverId: number, cmd: string[]): Promise<string> {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as ServerRow | undefined;
  if (!server || !server.container_id) throw new Error("Server not running");

  const container = docker.getContainer(server.container_id);
  const exec = await container.exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true });
  const stream = await exec.start({ Detach: false });
  return new Promise((resolve, reject) => {
    let output = "";
    dockerStreamDemux(stream,
      (data) => { output += data; },
      (data) => { output += data; },
    );
    stream.on("end", () => resolve(output.trim()));
    stream.on("error", reject);
  });
}

async function writeInContainer(serverId: number, cmd: string[], stdin: string): Promise<string> {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as ServerRow | undefined;
  if (!server || !server.container_id) throw new Error("Server not running");

  const container = docker.getContainer(server.container_id);
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({ Detach: false, Tty: false, hijack: true });
  stream.write(stdin);
  stream.end();
  return new Promise((resolve, reject) => {
    let output = "";
    dockerStreamDemux(stream,
      (data) => { output += data; },
      (data) => { output += data; },
    );
    stream.on("end", () => resolve(output.trim()));
    stream.on("error", reject);
  });
}

export default async function filesRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/servers/:id/files", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const serverId = Number(id);
    const reqPath = (request.query as { path?: string }).path || "";
    try {
      const safePath = sanitizeContainerPath(reqPath);
      const output = await execInContainer(serverId, [
        "ls", "-la", "--time-style=long-iso", safePath,
      ]);
      const lines = output.split("\n").filter((l) => l.trim());
      const entries = lines.slice(1).map((line) => {
        const parts = line.trim().split(/\s+/);
        const isDir = parts[0].startsWith("d");
        const size = parts[4] || "0";
        const name = parts.slice(7).join(" ");
        const dateStr = `${parts[5]} ${parts[6]}`;
        return { name, isDir, size: parseInt(size) || 0, date: dateStr, path: reqPath ? `${reqPath}/${name}` : name };
      }).filter((e) => e.name && e.name !== "." && e.name !== "..");
      return { entries, currentPath: reqPath };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.delete("/api/servers/:id/files", { preHandler: [authMiddleware, validate(schemas.filePathQuery)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const serverId = Number(id);
    const { path: filePath } = request.query as { path: string };
    if (!filePath) return reply.status(400).send({ error: "path is required" });
    try {
      const safePath = sanitizeContainerPath(filePath);
      await execInContainer(serverId, ["rm", "-rf", safePath]);
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.put("/api/servers/:id/files/content", { preHandler: [authMiddleware, validate(schemas.fileContent)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const serverId = Number(id);
    const { path: filePath, content } = request.body as { path: string; content: string };
    try {
      const safePath = sanitizeContainerPath(filePath);
      await writeInContainer(serverId, ["tee", safePath], content);
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.post("/api/servers/:id/files/mkdir", { preHandler: [authMiddleware, validate(schemas.mkdirPath)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const serverId = Number(id);
    const { path: dirPath } = request.body as { path: string };
    try {
      const safePath = sanitizeContainerPath(dirPath);
      await execInContainer(serverId, ["mkdir", "-p", safePath]);
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.get("/api/servers/:id/properties", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const serverId = Number(id);
    try {
      const output = await execInContainer(serverId, ["cat", "/data/server.properties"]);
      const props: Record<string, string> = {};
      output.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIndex = trimmed.indexOf("=");
          if (eqIndex > 0) {
            props[trimmed.substring(0, eqIndex).trim()] = trimmed.substring(eqIndex + 1).trim();
          }
        }
      });
      return { properties: props };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.put("/api/servers/:id/properties", { preHandler: [authMiddleware, validate(schemas.updateProperties)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const serverId = Number(id);
    const { properties, reload } = request.body as { properties: Record<string, string>; reload?: boolean };
    try {
      const lines = Object.entries(properties).map(([k, v]) => `${k}=${v}`);
      const content = lines.join("\n");
      await writeInContainer(serverId, ["tee", "/data/server.properties"], content);
      if (reload) {
        try {
          await execInContainer(serverId, ["rcon-cli", "reload"]);
        } catch {}
      }
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.post("/api/servers/:id/files/upload", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const serverId = Number(id);
    const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as ServerRow | undefined;
    if (!server) return reply.status(404).send({ error: "Server not found" });

    try {
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: "No file provided" });

      const filePath = sanitizePath(data.filename);
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const serverDataDir = join(process.cwd(), "data", `server-${serverId}`);
      const fullPath = join(serverDataDir, filePath);
      if (!fullPath.startsWith(serverDataDir)) {
        return reply.status(400).send({ error: "Invalid path" });
      }
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(fullPath, buffer);

      return { success: true, filename: filePath, size: buffer.length };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.get("/api/servers/:id/files/download", { preHandler: [authMiddleware, validate(schemas.filePathQuery)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const serverId = Number(id);
    const { path: filePath } = request.query as { path: string };

    const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as ServerRow | undefined;
    if (!server) return reply.status(404).send({ error: "Server not found" });

    try {
      const safePath = sanitizePath(filePath);
      const serverDataDir = join(process.cwd(), "data", `server-${serverId}`);
      const fullPath = join(serverDataDir, safePath);
      if (!fullPath.startsWith(serverDataDir)) {
        return reply.status(400).send({ error: "Invalid path" });
      }
      if (!existsSync(fullPath)) return reply.status(404).send({ error: "File not found" });

      const content = readFileSync(fullPath);
      const filename = safePath.split("/").pop() || "download";
      return reply
        .header("Content-Type", "application/octet-stream")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(content);
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}
