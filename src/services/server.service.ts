import db from "../config/database.js";
import docker, { isDockerAvailable } from "../config/docker.js";
import { env } from "../config/env.js";
import { Readable } from "stream";

interface Server {
  id: number;
  name: string;
  node_id: number;
  port: number;
  status: string;
  mc_version: string;
  software: string;
  image: string;
  ram_mb: number;
  cpu_percent: number | null;
  container_id: string | null;
  created_at: string;
}

interface ServerConfig {
  key: string;
  value: string;
}

export function getAllServers(): Server[] {
  return db.prepare("SELECT * FROM servers ORDER BY created_at DESC").all() as Server[];
}

export function getServerById(id: number): Server | undefined {
  return db.prepare("SELECT * FROM servers WHERE id = ?").get(id) as Server | undefined;
}

export function createServer(data: {
  name: string;
  mc_version: string;
  software: string;
  ram_mb: number;
  port: number;
  node_id?: number;
}): Server {
  const nodeId = data.node_id || 1;
  const result = db.prepare(
    "INSERT INTO servers (name, node_id, port, mc_version, software, ram_mb) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(data.name, nodeId, data.port, data.mc_version, data.software, data.ram_mb);

  db.prepare("INSERT INTO server_config (server_id, key, value) VALUES (?, ?, ?)")
    .run(result.lastInsertRowid, "EULA", "TRUE");
  db.prepare("INSERT INTO server_config (server_id, key, value) VALUES (?, ?, ?)")
    .run(result.lastInsertRowid, "TYPE", data.software === "vanilla" ? "VANILLA" : data.software.toUpperCase());
  db.prepare("INSERT INTO server_config (server_id, key, value) VALUES (?, ?, ?)")
    .run(result.lastInsertRowid, "VERSION", data.mc_version);

  return getServerById(result.lastInsertRowid as number)!;
}

export function updateServer(id: number, data: Partial<{ name: string; ram_mb: number; mc_version: string; software: string }>) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name) { fields.push("name = ?"); values.push(data.name); }
  if (data.ram_mb) { fields.push("ram_mb = ?"); values.push(data.ram_mb); }
  if (data.mc_version) { fields.push("mc_version = ?"); values.push(data.mc_version); }
  if (data.software) { fields.push("software = ?"); values.push(data.software); }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE servers SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteServer(id: number) {
  db.prepare("DELETE FROM servers WHERE id = ?").run(id);
}

export async function startServer(id: number): Promise<string | null> {
  const server = getServerById(id);
  if (!server) throw new Error("Server not found");

  const available = await isDockerAvailable();
  if (!available) throw new Error("Docker is not available");

  const eula = db.prepare("SELECT value FROM server_config WHERE server_id = ? AND key = 'EULA'").get(id) as ServerConfig | undefined;
  const type = db.prepare("SELECT value FROM server_config WHERE server_id = ? AND key = 'TYPE'").get(id) as ServerConfig | undefined;
  const version = db.prepare("SELECT value FROM server_config WHERE server_id = ? AND key = 'VERSION'").get(id) as ServerConfig | undefined;

  const envVars: Record<string, string> = {
    EULA: "TRUE",
    TYPE: type?.value || "VANILLA",
    VERSION: version?.value || server.mc_version,
    MEMORY: `${Math.floor(server.ram_mb / 1024)}G`,
    SERVER_PORT: "25565",
    TZ: "UTC",
  };

  const configs = db.prepare("SELECT key, value FROM server_config WHERE server_id = ?").all(id) as ServerConfig[];
  for (const cfg of configs) {
    if (cfg.key !== "EULA" && cfg.key !== "TYPE" && cfg.key !== "VERSION") {
      envVars[cfg.key] = cfg.value;
    }
  }

  const containerName = `biryani-mc-${server.id}`;
  try {
    const existing = docker.getContainer(containerName);
    await existing.remove({ force: true });
  } catch {}

  const container = await docker.createContainer({
    Image: server.image,
    name: containerName,
    Env: Object.entries(envVars).map(([k, v]) => `${k}=${v}`),
    HostConfig: {
      PortBindings: { "25565/tcp": [{ HostPort: server.port.toString() }] },
      Memory: server.ram_mb * 1024 * 1024,
      RestartPolicy: { Name: "unless-stopped" },
    },
    WorkingDir: "/data",
    Labels: { "biryani.managed": "true", "biryani.server_id": server.id.toString() },
  });

  await container.start();
  db.prepare("UPDATE servers SET status = 'running', container_id = ? WHERE id = ?").run(container.id, id);
  return container.id;
}

export async function stopServer(id: number): Promise<void> {
  const server = getServerById(id);
  if (!server) throw new Error("Server not found");
  if (!server.container_id) {
    db.prepare("UPDATE servers SET status = 'stopped' WHERE id = ?").run(id);
    return;
  }

  try {
    const container = docker.getContainer(server.container_id);
    await container.stop({ t: 30 });
    await container.remove({ force: true });
  } catch {}

  db.prepare("UPDATE servers SET status = 'stopped', container_id = NULL WHERE id = ?").run(id);
}

export async function restartServer(id: number): Promise<void> {
  await stopServer(id);
  await startServer(id);
}

export async function getServerLogs(id: number, tail: number = 100): Promise<string> {
  const server = getServerById(id);
  if (!server || !server.container_id) return "";

  try {
    const container = docker.getContainer(server.container_id);
    const logs = await container.logs({ stdout: true, stderr: true, tail, follow: false });
    return logs.toString("utf-8");
  } catch {
    return "";
  }
}

export async function sendCommand(id: number, command: string): Promise<void> {
  const server = getServerById(id);
  if (!server || !server.container_id) throw new Error("Server not running");

  const container = docker.getContainer(server.container_id);
  await container.exec({
    Cmd: ["rcon-cli", command],
    AttachStdout: true,
    AttachStderr: true,
  });
}

export function getServerConfig(id: number): ServerConfig[] {
  return db.prepare("SELECT key, value FROM server_config WHERE server_id = ?").all(id) as ServerConfig[];
}

export function setServerConfig(id: number, key: string, value: string) {
  const existing = db.prepare("SELECT 1 FROM server_config WHERE server_id = ? AND key = ?").get(id, key);
  if (existing) {
    db.prepare("UPDATE server_config SET value = ? WHERE server_id = ? AND key = ?").run(value, id, key);
  } else {
    db.prepare("INSERT INTO server_config (server_id, key, value) VALUES (?, ?, ?)").run(id, key, value);
  }
}

export function deleteServerConfig(id: number, key: string) {
  db.prepare("DELETE FROM server_config WHERE server_id = ? AND key = ?").run(id, key);
}

export function findAvailablePort(): number {
  const usedPorts = (db.prepare("SELECT port FROM servers").all() as { port: number }[]).map((r) => r.port);
  for (let port = env.SERVER_PORT_RANGE_START; port <= env.SERVER_PORT_RANGE_END; port++) {
    if (!usedPorts.includes(port)) return port;
  }
  throw new Error("No available ports");
}
