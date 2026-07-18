import db from "../config/database.js";

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
  const parts = schedule.split(" ");
  if (parts.length !== 5) return null;

  const [min, hour, , ,] = parts;
  const now = new Date();
  const next = new Date(now);

  if (min !== "*") {
    const m = parseInt(min, 10);
    if (!isNaN(m)) next.setMinutes(m, 0, 0);
  }
  if (hour !== "*") {
    const h = parseInt(hour, 10);
    if (!isNaN(h)) next.setHours(h, next.getMinutes(), 0, 0);
  }

  if (schedule.includes("*/")) {
    const intervalMatch = schedule.match(/\*\/(\d+)/);
    if (intervalMatch) {
      const interval = parseInt(intervalMatch[1], 10);
      if (schedule.startsWith("*/")) {
        return interval * 60 * 1000;
      }
      return interval * 60 * 60 * 1000;
    }
  }

  let diff = next.getTime() - now.getTime();
  if (diff <= 0) {
    next.setDate(next.getDate() + 1);
    diff = next.getTime() - now.getTime();
  }
  return diff;
}

export function startTask(task: ScheduledTask, executor: (task: ScheduledTask) => Promise<void>) {
  const interval = parseSchedule(task.schedule);
  if (!interval) return;

  stopTask(task.id);

  const timeout = setInterval(async () => {
    try {
      await executor(task);
      const now = new Date().toISOString();
      db.prepare("UPDATE scheduled_tasks SET last_run = ? WHERE id = ?").run(now, task.id);
    } catch (err) {
      console.error(`[Scheduler] Task ${task.id} failed:`, err);
    }
  }, interval);

  tasks.set(task.id, timeout);
}

export function stopTask(id: number) {
  const timeout = tasks.get(id);
  if (timeout) {
    clearInterval(timeout);
    tasks.delete(id);
  }
}

export function startAllTasks(executor: (task: ScheduledTask) => Promise<void>) {
  const enabled = db.prepare("SELECT * FROM scheduled_tasks WHERE enabled = 1").all() as ScheduledTask[];
  for (const task of enabled) {
    startTask(task, executor);
  }
}
