import { FastifyRequest, FastifyReply } from "fastify";
import { z, ZodError, ZodType } from "zod";

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
};
