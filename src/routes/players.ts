import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import docker from "../config/docker.js";
import db from "../config/database.js";

async function execInContainer(serverId: number, cmd: string[]): Promise<string> {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as any;
  if (!server || !server.container_id) throw new Error("Server not running");

  const container = docker.getContainer(server.container_id);
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({ Detach: false });
  return new Promise((resolve, reject) => {
    let output = "";
    stream.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf-8").replace(/[^\x20-\x7E\n]/g, "");
    });
    stream.on("end", () => resolve(output.trim()));
    stream.on("error", reject);
  });
}

async function execWithStdin(serverId: number, cmd: string[], stdin: string): Promise<string> {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as any;
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
    stream.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf-8").replace(/[^\x20-\x7E\n]/g, "");
    });
    stream.on("end", () => resolve(output.trim()));
    stream.on("error", reject);
  });
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16);
}

export default async function playersRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/servers/:id/players/whitelist", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/whitelist.json"]);
      try {
        const list = JSON.parse(output);
        return { players: list.map((e: any) => e.name || e.UUID || JSON.stringify(e)) };
      } catch {
        return { players: [] };
      }
    } catch {
      return { players: [] };
    }
  });

  app.post("/api/servers/:id/players/whitelist", opts, async (request, reply) => {
    const rawName = (request.body as { name: string }).name;
    if (!rawName) return reply.status(400).send({ error: "name is required" });
    const name = sanitizeName(rawName);
    const { id } = request.params as { id: string };
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/whitelist.json"]);
      const list = JSON.parse(output || "[]");
      list.push({ name });
      await execWithStdin(Number(id), ["tee", "/data/whitelist.json"], JSON.stringify(list, null, 2));
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.delete("/api/servers/:id/players/whitelist/:name", opts, async (request, reply) => {
    const { id, name: paramName } = request.params as { id: string; name: string };
    const name = sanitizeName(paramName);
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/whitelist.json"]);
      const list = JSON.parse(output || "[]");
      const filtered = list.filter((x: any) => (x.name || "").toLowerCase() !== name.toLowerCase());
      await execWithStdin(Number(id), ["tee", "/data/whitelist.json"], JSON.stringify(filtered, null, 2));
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/api/servers/:id/players/ops", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/ops.json"]);
      try {
        const list = JSON.parse(output);
        return { players: list.map((e: any) => e.name || JSON.stringify(e)) };
      } catch {
        return { players: [] };
      }
    } catch {
      return { players: [] };
    }
  });

  app.post("/api/servers/:id/players/ops", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rawName = (request.body as { name: string }).name;
    if (!rawName) return reply.status(400).send({ error: "name is required" });
    const name = sanitizeName(rawName);
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/ops.json"]);
      const list = JSON.parse(output || "[]");
      list.push({ name, level: 4, bypassesPlayerLimit: false });
      await execWithStdin(Number(id), ["tee", "/data/ops.json"], JSON.stringify(list, null, 2));
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.delete("/api/servers/:id/players/ops/:name", opts, async (request, reply) => {
    const { id, name: paramName } = request.params as { id: string; name: string };
    const name = sanitizeName(paramName);
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/ops.json"]);
      const list = JSON.parse(output || "[]");
      const filtered = list.filter((x: any) => (x.name || "").toLowerCase() !== name.toLowerCase());
      await execWithStdin(Number(id), ["tee", "/data/ops.json"], JSON.stringify(filtered, null, 2));
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/api/servers/:id/players/bans", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/banned-players.json"]);
      try {
        const list = JSON.parse(output);
        return { players: list.map((e: any) => ({ name: e.name, reason: e.reason, created: e.created })) };
      } catch {
        return { players: [] };
      }
    } catch {
      return { players: [] };
    }
  });

  app.post("/api/servers/:id/players/bans", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name: rawName, reason } = request.body as { name: string; reason?: string };
    if (!rawName) return reply.status(400).send({ error: "name is required" });
    const name = sanitizeName(rawName);
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/banned-players.json"]);
      const list = JSON.parse(output || "[]");
      list.push({ name, reason: reason || "Banned by operator", created: new Date().toISOString(), source: "Biryani" });
      await execWithStdin(Number(id), ["tee", "/data/banned-players.json"], JSON.stringify(list, null, 2));
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.delete("/api/servers/:id/players/bans/:name", opts, async (request, reply) => {
    const { id, name: paramName } = request.params as { id: string; name: string };
    const name = sanitizeName(paramName);
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/banned-players.json"]);
      const list = JSON.parse(output || "[]");
      const filtered = list.filter((x: any) => (x.name || "").toLowerCase() !== name.toLowerCase());
      await execWithStdin(Number(id), ["tee", "/data/banned-players.json"], JSON.stringify(filtered, null, 2));
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
