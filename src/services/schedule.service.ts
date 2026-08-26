import db from "../config/database.js";
import { logger } from "../utils/logger.js";
import { CronExpressionParser } from "cron-parser";

export interface ScheduledTask {
  id: number;
  server_id: number;
  name: string;
  type: "backup" | "restart" | "stop" | "start" | "command";
  schedule: string;
  command?: string;
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}

const tasks = new Map<number, NodeJS.Timeout>();

export function getAllTasks(): ScheduledTask[] {
  return db.prepare("SELECT * FROM scheduled_tasks ORDER BY created_at DESC").all() as ScheduledTask[];
}

export function getTasksForServer(serverId: number): ScheduledTask[] {
  return db.prepare("SELECT * FROM scheduled_tasks WHERE server_id = ?").all(serverId) as ScheduledTask[];
}

export function getTaskById(id: number): ScheduledTask | undefined {
  return db.prepare("SELECT * FROM scheduled_tasks WHERE id = ?").get(id) as ScheduledTask | undefined;
}

export function createTask(data: {
  server_id: number;
  name: string;
  type: ScheduledTask["type"];
  schedule: string;
  command?: string;
}): ScheduledTask {
  const result = db.prepare(
    "INSERT INTO scheduled_tasks (server_id, name, type, schedule, command) VALUES (?, ?, ?, ?, ?)"
  ).run(data.server_id, data.name, data.type, data.schedule, data.command || null);
  return getTaskById(result.lastInsertRowid as number)!;
}

export function updateTask(id: number, data: Partial<Pick<ScheduledTask, "name" | "schedule" | "command" | "enabled">>) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
  if (data.schedule !== undefined) { fields.push("schedule = ?"); values.push(data.schedule); }
  if (data.command !== undefined) { fields.push("command = ?"); values.push(data.command); }
  if (data.enabled !== undefined) { fields.push("enabled = ?"); values.push(data.enabled ? 1 : 0); }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE scheduled_tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteTask(id: number) {
  stopTask(id);
  db.prepare("DELETE FROM scheduled_tasks WHERE id = ?").run(id);
}

export function parseSchedule(schedule: string): number | null {
  try {
    const interval = CronExpressionParser.parse(schedule, { currentDate: new Date() });
    return interval.next().toDate().getTime() - Date.now();
  } catch {
    return null;
  }
}

export function getNextRunTime(schedule: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(schedule, { currentDate: new Date() });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

export function startTask(task: ScheduledTask, executor: (task: ScheduledTask) => Promise<void>) {
  stopTask(task.id);

  function scheduleNext() {
    const ms = parseSchedule(task.schedule);
    if (ms === null || ms <= 0) return;

    const nextRun = getNextRunTime(task.schedule);
    if (nextRun) {
      db.prepare("UPDATE scheduled_tasks SET next_run = ? WHERE id = ?")
        .run(nextRun.toISOString(), task.id);
    }

    const timeout = setTimeout(async () => {
      tasks.delete(task.id);
      try {
        await executor(task);
        const now = new Date().toISOString();
        db.prepare("UPDATE scheduled_tasks SET last_run = ? WHERE id = ?").run(now, task.id);
      } catch (err) {
        logger.error(`Scheduler - Task ${task.id} failed:`, err);
      }
      scheduleNext();
    }, ms);

    tasks.set(task.id, timeout);
  }

  scheduleNext();
}

export function stopTask(id: number) {
  const timeout = tasks.get(id);
  if (timeout) {
    clearTimeout(timeout);
    tasks.delete(id);
  }
}

export function startAllTasks(executor: (task: ScheduledTask) => Promise<void>) {
  const enabled = db.prepare("SELECT * FROM scheduled_tasks WHERE enabled = 1").all() as ScheduledTask[];
  for (const task of enabled) {
    startTask(task, executor);
  }
}
