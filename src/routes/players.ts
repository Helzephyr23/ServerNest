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
    const { name } = request.body as { name: string };
    if (!name) return reply.status(400).send({ error: "name is required" });
    const { id } = request.params as { id: string };
    try {
      const entry = JSON.stringify({ name });
      const script = `import json,sys; f=open('/data/whitelist.json','r'); d=json.load(f); f.close(); d.append(${entry}); f=open('/data/whitelist.json','w'); json.dump(d,f); f.close()`;
      await execWithStdin(Number(id), ["python3", "-c", script], "");
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.delete("/api/servers/:id/players/whitelist/:name", opts, async (request, reply) => {
    const { id, name: paramName } = request.params as { id: string; name: string };
    const name = sanitizeName(paramName);
    try {
      const target = JSON.stringify(name.toLowerCase());
      const script = `import json,sys; f=open('/data/whitelist.json','r'); d=json.load(f); f.close(); d=[x for x in d if x.get('name','').lower()!=${target}]; f=open('/data/whitelist.json','w'); json.dump(d,f); f.close()`;
      await execWithStdin(Number(id), ["python3", "-c", script], "");
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
    const { name } = request.body as { name: string };
    if (!name) return reply.status(400).send({ error: "name is required" });
    try {
      const entry = { name, level: 4, bypassesPlayerLimit: false };
      const script = `import json,sys; f=open('/data/ops.json','r'); d=json.load(f); f.close(); d.append(${JSON.stringify(entry)}); f=open('/data/ops.json','w'); json.dump(d,f); f.close()`;
      await execWithStdin(Number(id), ["python3", "-c", script], "");
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.delete("/api/servers/:id/players/ops/:name", opts, async (request, reply) => {
    const { id, name: paramName } = request.params as { id: string; name: string };
    const name = sanitizeName(paramName);
    try {
      const target = JSON.stringify(name.toLowerCase());
      const script = `import json,sys; f=open('/data/ops.json','r'); d=json.load(f); f.close(); d=[x for x in d if x.get('name','').lower()!=${target}]; f=open('/data/ops.json','w'); json.dump(d,f); f.close()`;
      await execWithStdin(Number(id), ["python3", "-c", script], "");
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
    const { name, reason } = request.body as { name: string; reason?: string };
    if (!name) return reply.status(400).send({ error: "name is required" });
    try {
      const entry = { name, reason: reason || "Banned by operator", created: new Date().toISOString(), source: "Biryani" };
      const script = `import json,sys; f=open('/data/banned-players.json','r'); d=json.load(f); f.close(); d.append(${JSON.stringify(entry)}); f=open('/data/banned-players.json','w'); json.dump(d,f); f.close()`;
      await execWithStdin(Number(id), ["python3", "-c", script], "");
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.delete("/api/servers/:id/players/bans/:name", opts, async (request, reply) => {
    const { id, name: paramName } = request.params as { id: string; name: string };
    const name = sanitizeName(paramName);
    try {
      const target = JSON.stringify(name.toLowerCase());
      const script = `import json,sys; f=open('/data/banned-players.json','r'); d=json.load(f); f.close(); d=[x for x in d if x.get('name','').lower()!=${target}]; f=open('/data/banned-players.json','w'); json.dump(d,f); f.close()`;
      await execWithStdin(Number(id), ["python3", "-c", script], "");
      return { success: true };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
