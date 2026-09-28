import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import { execInContainer, writeInContainer } from "../utils/container.js";

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16);
}

export default async function playersRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/servers/:id/players/whitelist", opts, async (request) => {
    const { id } = request.params as { id: string };
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/whitelist.json"]);
      try {
        const list = JSON.parse(output);
        return { players: list.map((e: { name?: string; UUID?: string }) => e.name || e.UUID || JSON.stringify(e)) };
      } catch {
        return { players: [] };
      }
    } catch {
      return { players: [] };
    }
  });

  app.post("/api/servers/:id/players/whitelist", { preHandler: [authMiddleware, validate(schemas.addPlayer)] }, async (request, reply) => {
    const { name: rawName } = request.body as { name: string };
    const name = sanitizeName(rawName);
    const { id } = request.params as { id: string };
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/whitelist.json"]);
      const list = JSON.parse(output || "[]");
      list.push({ name });
      await writeInContainer(Number(id), ["tee", "/data/whitelist.json"], JSON.stringify(list, null, 2));
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.delete("/api/servers/:id/players/whitelist/:name", opts, async (request, reply) => {
    const { id, name: paramName } = request.params as { id: string; name: string };
    const name = sanitizeName(paramName);
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/whitelist.json"]);
      const list = JSON.parse(output || "[]");
      const filtered = list.filter((x: { name?: string }) => (x.name || "").toLowerCase() !== name.toLowerCase());
      await writeInContainer(Number(id), ["tee", "/data/whitelist.json"], JSON.stringify(filtered, null, 2));
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.get("/api/servers/:id/players/ops", opts, async (request) => {
    const { id } = request.params as { id: string };
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/ops.json"]);
      try {
        const list = JSON.parse(output);
        return { players: list.map((e: { name?: string }) => e.name || JSON.stringify(e)) };
      } catch {
        return { players: [] };
      }
    } catch {
      return { players: [] };
    }
  });

  app.post("/api/servers/:id/players/ops", { preHandler: [authMiddleware, validate(schemas.addPlayer)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name: rawName } = request.body as { name: string };
    const name = sanitizeName(rawName);
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/ops.json"]);
      const list = JSON.parse(output || "[]");
      list.push({ name, level: 4, bypassesPlayerLimit: false });
      await writeInContainer(Number(id), ["tee", "/data/ops.json"], JSON.stringify(list, null, 2));
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.delete("/api/servers/:id/players/ops/:name", opts, async (request, reply) => {
    const { id, name: paramName } = request.params as { id: string; name: string };
    const name = sanitizeName(paramName);
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/ops.json"]);
      const list = JSON.parse(output || "[]");
      const filtered = list.filter((x: { name?: string }) => (x.name || "").toLowerCase() !== name.toLowerCase());
      await writeInContainer(Number(id), ["tee", "/data/ops.json"], JSON.stringify(filtered, null, 2));
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.get("/api/servers/:id/players/bans", opts, async (request) => {
    const { id } = request.params as { id: string };
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/banned-players.json"]);
      try {
        const list = JSON.parse(output);
        return { players: list.map((e: { name?: string; reason?: string; created?: string }) => ({ name: e.name, reason: e.reason, created: e.created })) };
      } catch {
        return { players: [] };
      }
    } catch {
      return { players: [] };
    }
  });

  app.post("/api/servers/:id/players/bans", { preHandler: [authMiddleware, validate(schemas.addBanPlayer)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name: rawName, reason } = request.body as { name: string; reason?: string };
    const name = sanitizeName(rawName);
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/banned-players.json"]);
      const list = JSON.parse(output || "[]");
      list.push({ name, reason: reason || "Banned by operator", created: new Date().toISOString(), source: "ServerNest" });
      await writeInContainer(Number(id), ["tee", "/data/banned-players.json"], JSON.stringify(list, null, 2));
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.delete("/api/servers/:id/players/bans/:name", opts, async (request, reply) => {
    const { id, name: paramName } = request.params as { id: string; name: string };
    const name = sanitizeName(paramName);
    try {
      const output = await execInContainer(Number(id), ["cat", "/data/banned-players.json"]);
      const list = JSON.parse(output || "[]");
      const filtered = list.filter((x: { name?: string }) => (x.name || "").toLowerCase() !== name.toLowerCase());
      await writeInContainer(Number(id), ["tee", "/data/banned-players.json"], JSON.stringify(filtered, null, 2));
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}
