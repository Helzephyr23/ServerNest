import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import db from "../config/database.js";
import { testCloudConnection, CloudStorageConfig } from "../services/cloud-storage.service.js";

const SENSITIVE_KEYS = ["accessKeyId", "secretAccessKey", "refreshToken", "accessToken", "clientSecret"];

function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...config };
  for (const key of SENSITIVE_KEYS) {
    if (masked[key]) masked[key] = "********";
  }
  return masked;
}

export default async function cloudStorageRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/servers/:id/cloud-storage", opts, async (request) => {
    const { id } = request.params as { id: string };
    const configs = db
      .prepare("SELECT * FROM cloud_storage_configs WHERE server_id = ? AND provider != 'gdrive' ORDER BY created_at DESC")
      .all(Number(id)) as CloudStorageConfig[];
    return {
      configs: configs.map((c) => ({
        ...c,
        config_json: JSON.stringify(maskConfig(JSON.parse(c.config_json))),
      })),
    };
  });

  app.post("/api/servers/:id/cloud-storage", { preHandler: [authMiddleware, validate(schemas.createCloudConfig)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { provider, label, config } = request.body as { provider: string; label: string; config: Record<string, unknown> };
    const result = db
      .prepare("INSERT INTO cloud_storage_configs (server_id, provider, label, config_json) VALUES (?, ?, ?, ?)")
      .run(Number(id), provider, label, JSON.stringify(config));
    return reply.status(201).send({ id: result.lastInsertRowid });
  });

  app.put("/api/servers/:id/cloud-storage/:configId", { preHandler: [authMiddleware, validate(schemas.updateCloudConfig)] }, async (request, reply) => {
    const { id, configId } = request.params as { id: string; configId: string };
    const body = request.body as { label?: string; config?: Record<string, unknown> };
    const existing = db
      .prepare("SELECT * FROM cloud_storage_configs WHERE id = ? AND server_id = ?")
      .get(Number(configId), Number(id)) as CloudStorageConfig | undefined;
    if (!existing) return reply.status(404).send({ error: "Config not found" });

    let config = body.config || JSON.parse(existing.config_json);
    if (body.config) {
      const existingParsed = JSON.parse(existing.config_json);
      for (const key of SENSITIVE_KEYS) {
        if (body.config[key] === "********") {
          config[key] = existingParsed[key];
        }
      }
    }

    db.prepare("UPDATE cloud_storage_configs SET label = ?, config_json = ? WHERE id = ?")
      .run(body.label || existing.label, JSON.stringify(config), Number(configId));
    return { success: true };
  });

  app.delete("/api/servers/:id/cloud-storage/:configId", opts, async (request, reply) => {
    const { id, configId } = request.params as { id: string; configId: string };
    const existing = db
      .prepare("SELECT * FROM cloud_storage_configs WHERE id = ? AND server_id = ?")
      .get(Number(configId), Number(id)) as CloudStorageConfig | undefined;
    if (!existing) return reply.status(404).send({ error: "Config not found" });
    db.prepare("DELETE FROM cloud_storage_configs WHERE id = ?").run(Number(configId));
    return { success: true };
  });

  app.post("/api/servers/:id/cloud-storage/:configId/test", opts, async (request, reply) => {
    const { id, configId } = request.params as { id: string; configId: string };
    const existing = db
      .prepare("SELECT * FROM cloud_storage_configs WHERE id = ? AND server_id = ?")
      .get(Number(configId), Number(id)) as CloudStorageConfig | undefined;
    if (!existing) return reply.status(404).send({ error: "Config not found" });
    const ok = await testCloudConnection(existing);
    return { success: ok, message: ok ? "Connection successful" : "Connection failed" };
  });
}
