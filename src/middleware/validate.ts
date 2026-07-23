import { FastifyRequest, FastifyReply } from "fastify";
import { z, ZodType } from "zod";

export function validate(schema: ZodType) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const errors = result.error.issues.map((e) => `${e.path.join(".") || "field"}: ${e.message}`).join(", ");
      return reply.status(400).send({ error: `Validation failed: ${errors}` });
    }
    request.body = result.data;
  };
}

export function validateQuery(schema: ZodType) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      const errors = result.error.issues.map((e) => `${e.path.join(".") || "field"}: ${e.message}`).join(", ");
      return reply.status(400).send({ error: `Validation failed: ${errors}` });
    }
    request.query = result.data;
  };
}

export const schemas = {
  login: z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
  }),

  setup: z.object({
    username: z.string().min(3, "Username must be at least 3 characters").max(30),
    password: z.string().min(6, "Password must be at least 6 characters").max(100),
  }),

  createServer: z.object({
    name: z.string().min(1, "Name is required").max(50),
    mc_version: z.string().min(1, "Version is required"),
    software: z.string().optional().default("vanilla"),
    ram_mb: z.number().int().min(512).max(32768).optional().default(2048),
    template: z.string().optional(),
    image: z.string().optional(),
    eula_accepted: z.boolean().refine((v) => v === true, { message: "You must accept the Minecraft EULA" }),
  }),

  createNode: z.object({
    name: z.string().min(1).max(50),
    hostname: z.string().min(1),
    port: z.number().int().min(1).max(65535).optional().default(50051),
    api_key: z.string().min(1),
    max_servers: z.number().int().min(1).max(100).optional().default(10),
  }),

  createTask: z.object({
    name: z.string().min(1),
    type: z.enum(["backup", "restart", "stop", "start", "command"]),
    schedule: z.string().min(1),
    command: z.string().optional(),
  }),

  createNotification: z.object({
    type: z.enum(["discord", "email"]),
    webhook_url: z.string().url().optional(),
    email: z.string().email().optional(),
    events: z.array(z.string()).min(1),
  }),

  sendCommand: z.object({
    command: z.string().min(1, "Command is required").max(500),
  }),

  updateProperties: z.object({
    properties: z.record(z.string(), z.string()),
    reload: z.boolean().optional().default(false),
  }),

  fileContent: z.object({
    path: z.string().min(1),
    content: z.string(),
  }),

  createUser: z.object({
    username: z.string().min(3, "Username must be at least 3 characters").max(30),
    password: z.string().min(6, "Password must be at least 6 characters").max(100),
    role: z.enum(["admin", "user"]).optional().default("user"),
  }),

  updateUserRole: z.object({
    role: z.enum(["admin", "user"]),
  }),

  updateUserPassword: z.object({
    password: z.string().min(6, "Password must be at least 6 characters").max(100),
  }),

  addPlayer: z.object({
    name: z.string().min(1, "Name is required").max(16),
  }),

  addBanPlayer: z.object({
    name: z.string().min(1, "Name is required").max(16),
    reason: z.string().max(500).optional(),
  }),

  installMod: z.object({
    versionId: z.string().min(1, "versionId is required"),
  }),

  installModsBatch: z.object({
    versionIds: z.array(z.string().min(1)).min(1, "At least one versionId is required"),
  }),

  updateServer: z.object({
    name: z.string().min(1).max(50).optional(),
    mc_version: z.string().min(1).optional(),
    software: z.string().optional(),
    ram_mb: z.number().int().min(512).max(32768).optional(),
    image: z.string().optional(),
  }),

  updateServerConfig: z.object({
    key: z.string().min(1, "Key is required"),
    value: z.string().min(1, "Value is required"),
  }),

  updateVersion: z.object({
    version: z.string().min(1, "Version is required"),
  }),

  mkdirPath: z.object({
    path: z.string().min(1, "Path is required"),
  }),

  twofaChallenge: z.object({
    tempToken: z.string().min(1, "tempToken is required"),
    code: z.string().min(1, "Code is required"),
  }),

  twofaVerify: z.object({
    code: z.string().min(1, "Code is required"),
  }),

  twofaDisable: z.object({
    password: z.string().min(1, "Password is required"),
    code: z.string().min(1, "Code is required"),
  }),

  nodeHeartbeat: z.object({
    metrics: z.object({
      cpu_percent: z.number().optional(),
      memory_percent: z.number().optional(),
      disk_percent: z.number().optional(),
    }).optional(),
  }),

  nodeHeartbeatAgent: z.object({
    name: z.string().optional(),
    api_key: z.string().min(1),
    metrics: z.object({
      cpu_percent: z.number().optional(),
      memory_percent: z.number().optional(),
      disk_percent: z.number().optional(),
    }).optional(),
  }),

  updateTask: z.object({
    name: z.string().min(1).optional(),
    schedule: z.string().min(1).optional(),
    command: z.string().optional(),
    enabled: z.boolean().optional(),
  }),

  testNotification: z.object({
    webhook_url: z.string().url("webhook_url is required for Discord"),
  }),

  createCloudConfig: z.object({
    provider: z.enum(["s3", "gdrive", "dropbox"]),
    label: z.string().min(1, "Label is required"),
    config: z.record(z.string(), z.unknown()),
  }),

  updateCloudConfig: z.object({
    label: z.string().min(1).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  }),

  filePathQuery: z.object({
    path: z.string().min(1, "path is required"),
  }),

  serverLogsQuery: z.object({
    tail: z.coerce.number().int().min(1).max(10000).optional().default(100),
  }),

  metricsHistoryQuery: z.object({
    range: z.enum(["1h", "6h", "24h", "7d"]).optional().default("1h"),
  }),

  modSearchQuery: z.object({
    q: z.string().optional(),
    version: z.string().optional(),
    loader: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),

  pluginSearchQuery: z.object({
    q: z.string().optional(),
    version: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),

  createRateLimit: z.object({
    route: z.string().min(1, "Route is required"),
    method: z.string().optional().default("POST"),
    max_requests: z.number().int().min(1, "max_requests must be at least 1"),
    window_ms: z.number().int().min(1000, "window_ms must be at least 1000ms"),
    description: z.string().max(200).optional(),
  }),

  updateRateLimit: z.object({
    route: z.string().min(1).optional(),
    method: z.string().optional(),
    max_requests: z.number().int().min(1).optional(),
    window_ms: z.number().int().min(1000).optional(),
    enabled: z.boolean().optional(),
    description: z.string().max(200).nullable().optional(),
  }),
};
