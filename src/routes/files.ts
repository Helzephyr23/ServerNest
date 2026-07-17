import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import docker from "../config/docker.js";
import db from "../config/database.js";
import path from "path";

async function getServerDir(serverId: number): Promise<string> {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as any;
  if (!server) throw new Error("Server not found");
  return `/data`;
}

async function execInContainer(serverId: number, cmd: string[]): Promise<string> {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as any;
  if (!server || !server.container_id) throw new Error("Server not running");

  const container = docker.getContainer(server.container_id);
  const exec = await container.exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true });
  const stream = await exec.start({ Detach: false });
  return new Promise((resolve, reject) => {
    let output = "";
    stream.on("data", (chunk: Buffer) => { output += chunk.toString("utf-8").replace(/[^\x20-\x7E\n]/g, ""); });
    stream.on("end", () => resolve(output.trim()));
    stream.on("error", reject);
  });
}

export default async function filesRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/servers/:id/files", opts, async (request, reply) => {
    const serverId = Number(request.params.id);
    const reqPath = (request.query as any).path || "";
    try {
      const output = await execInContainer(serverId, [
        "ls", "-la", "--time-style=long-iso", `/data/${reqPath}`,
      ]);
      const lines = output.split("\n").filter((l) => l.trim());
      const entries = lines.slice(1).map((line) => {
        const parts = line.trim().split(/\s+/);
        const isDir = parts[0].startsWith("d");
        const size = parts[4] || "0";
        const name = parts.slice(8).join(" ");
        const dateStr = `${parts[5]} ${parts[6]}`;
        return { name, isDir, size: parseInt(size) || 0, date: dateStr, path: reqPath ? `${reqPath}/${name}` : name };
      }).filter((e) => e.name && e.name !== "." && e.name !== "..");
      return { entries, currentPath: reqPath };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/api/servers/:id/files/content", opts, async (request, reply) => {
    const serverId = Number(request.params.id);
    const filePath = (request.query as any).path;
    if (!filePath) return reply.status(400).send({ error: "path is required" });
    try {
      const output = await execInContainer(serverId, ["cat", `/data/${filePath}`]);
      return { content: output, path: filePath };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.put("/api/servers/:id/files/content", opts, async (request, reply) => {
    const serverId = Number(request.params.id);
    const { path: filePath, content } = request.body as { path: string; content: string };
    if (!filePath || content === undefined) return reply.status(400).send({ error: "path and content are required" });
    try {
      const escapedContent = content.replace(/'/g, "'\\''");
      await execInContainer(serverId, [
        "bash", "-c", `cat > /data/${filePath} << 'BIRYANI_EOF'\n${content}\nBIRYANI_EOF`,
      ]);
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post("/api/servers/:id/files/mkdir", opts, async (request, reply) => {
    const serverId = Number(request.params.id);
    const { path: dirPath } = request.body as { path: string };
    if (!dirPath) return reply.status(400).send({ error: "path is required" });
    try {
      await execInContainer(serverId, ["mkdir", "-p", `/data/${dirPath}`]);
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.delete("/api/servers/:id/files", opts, async (request, reply) => {
    const serverId = Number(request.params.id);
    const filePath = (request.query as any).path;
    if (!filePath) return reply.status(400).send({ error: "path is required" });
    try {
      await execInContainer(serverId, ["rm", "-rf", `/data/${filePath}`]);
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/api/servers/:id/properties", opts, async (request, reply) => {
    const serverId = Number(request.params.id);
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
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.put("/api/servers/:id/properties", opts, async (request, reply) => {
    const serverId = Number(request.params.id);
    const { properties } = request.body as { properties: Record<string, string> };
    if (!properties) return reply.status(400).send({ error: "properties are required" });
    try {
      const lines = Object.entries(properties).map(([k, v]) => `${k}=${v}`);
      const content = lines.join("\n");
      await execInContainer(serverId, [
        "bash", "-c", `cat > /data/server.properties << 'BIRYANI_EOF'\n${content}\nBIRYANI_EOF`,
      ]);
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
