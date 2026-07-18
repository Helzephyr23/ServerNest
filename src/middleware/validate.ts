import { FastifyRequest, FastifyReply } from "fastify";
import { z, ZodType } from "zod";

export function validate(schema: ZodType) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const issues = (result.error as any).issues || [];
      const errors = issues.map((e: any) => `${e.path?.join(".") || "field"}: ${e.message}`).join(", ");
      return reply.status(400).send({ error: `Validation failed: ${errors}` });
    }
    request.body = result.data;
  };
}

export function validateQuery(schema: ZodType) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      const issues = (result.error as any).issues || [];
      const errors = issues.map((e: any) => `${e.path?.join(".") || "field"}: ${e.message}`).join(", ");
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
};
