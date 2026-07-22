import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import {
  getAllTasks,
  getTasksForServer,
  createTask,
  updateTask,
  deleteTask,
  startTask,
  stopTask,
} from "../services/schedule.service.js";
import { startServer, stopServer, restartServer, sendCommand } from "../services/server.service.js";
import { createBackup } from "../services/backup.service.js";
import type { ScheduledTask } from "../services/schedule.service.js";

async function executeTask(task: ScheduledTask) {
  switch (task.type) {
    case "backup":
      await createBackup(task.server_id);
      break;
    case "restart":
      await restartServer(task.server_id);
      break;
    case "stop":
      await stopServer(task.server_id);
      break;
    case "start":
      await startServer(task.server_id);
      break;
    case "command":
      if (task.command) await sendCommand(task.server_id, task.command);
      break;
  }
}

export default async function scheduleRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  app.get("/api/tasks", opts, async () => {
    return { tasks: getAllTasks() };
  });

  app.get("/api/servers/:id/tasks", opts, async (request) => {
    const { id } = request.params as { id: string };
    return { tasks: getTasksForServer(Number(id)) };
  });

  app.post("/api/servers/:id/tasks", { preHandler: [authMiddleware, validate(schemas.createTask)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, type, schedule, command } = request.body as { name: string; type: "backup" | "restart" | "stop" | "start" | "command"; schedule: string; command?: string };
    const task = createTask({ server_id: Number(id), name, type, schedule, command });
    startTask(task, executeTask);
    return reply.status(201).send({ task });
  });

  app.put("/api/tasks/:id", { preHandler: [authMiddleware, validate(schemas.updateTask)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = (await import("../services/schedule.service.js")).getTaskById(Number(id));
    if (!existing) return reply.status(404).send({ error: "Task not found" });
    const { name, schedule, command, enabled } = request.body as { name?: string; schedule?: string; command?: string; enabled?: boolean };
    updateTask(Number(id), { name, schedule, command, enabled });
    const updated = (await import("../services/schedule.service.js")).getTaskById(Number(id))!;
    if (updated.enabled) {
      startTask(updated, executeTask);
    } else {
      stopTask(Number(id));
    }
    return { task: updated };
  });

  app.delete("/api/tasks/:id", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = (await import("../services/schedule.service.js")).getTaskById(Number(id));
    if (!existing) return reply.status(404).send({ error: "Task not found" });
    deleteTask(Number(id));
    return { success: true };
  });

  app.post("/api/tasks/:id/run", opts, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = (await import("../services/schedule.service.js")).getTaskById(Number(id));
    if (!existing) return reply.status(404).send({ error: "Task not found" });
    try {
      await executeTask(existing);
      return { success: true };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
}
