import db from "../config/database.js";
import docker, { isDockerAvailable, dockerStreamDemux } from "../config/docker.js";
import { env } from "../config/env.js";
import { notify } from "./notification.service.js";
import { Readable } from "stream";
import { mkdirSync, existsSync } from "fs";
import { cp } from "fs/promises";

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
  eula_accepted: number;
  eula_accepted_at: string | null;
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
  image?: string;
  eula_accepted: boolean;
}): Server {
  const nodeId = data.node_id || 1;
  const image = data.image || "itzg/minecraft-server";
  const result = db.prepare(
    "INSERT INTO servers (name, node_id, port, mc_version, software, ram_mb, image, eula_accepted, eula_accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))"
  ).run(data.name, nodeId, data.port, data.mc_version, data.software, data.ram_mb, image);
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
  db.prepare("DELETE FROM server_config WHERE server_id = ?").run(id);
  db.prepare("DELETE FROM backups WHERE server_id = ?").run(id);
  db.prepare("DELETE FROM scheduled_tasks WHERE server_id = ?").run(id);
  db.prepare("DELETE FROM installed_mods WHERE server_id = ?").run(id);
  db.prepare("DELETE FROM servers WHERE id = ?").run(id);
}

export async function cloneServer(id: number): Promise<Server> {
  const source = getServerById(id);
  if (!source) throw new Error("Server not found");

  const port = findAvailablePort();
  const newName = `Copy of ${source.name}`;

  const cloneTx = db.transaction(() => {
    const result = db.prepare(
      "INSERT INTO servers (name, node_id, port, mc_version, software, ram_mb, image, eula_accepted, eula_accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).run(newName, source.node_id, port, source.mc_version, source.software, source.ram_mb, source.image, source.eula_accepted);

    const newId = result.lastInsertRowid as number;

    const configs = db.prepare("SELECT key, value FROM server_config WHERE server_id = ?").all(id) as ServerConfig[];
    for (const cfg of configs) {
      db.prepare("INSERT INTO server_config (server_id, key, value) VALUES (?, ?, ?)").run(newId, cfg.key, cfg.value);
    }

    const mods = db.prepare("SELECT mod_name, filename, version, source FROM installed_mods WHERE server_id = ?").all(id) as { mod_name: string; filename: string; version: string; source: string }[];
    for (const mod of mods) {
      db.prepare("INSERT INTO installed_mods (server_id, mod_name, filename, version, source) VALUES (?, ?, ?, ?, ?)").run(newId, mod.mod_name, mod.filename, mod.version, mod.source);
    }

    return newId;
  });

  const newId = cloneTx();

  const srcDir = `${process.cwd()}/data/server-${id}`;
  const dstDir = `${process.cwd()}/data/server-${newId}`;
  if (existsSync(srcDir)) {
    mkdirSync(dstDir, { recursive: true });
    await cp(srcDir, dstDir, { recursive: true, force: true });
  }

  return getServerById(newId)!;
}

export async function startServer(id: number): Promise<string | null> {
  const server = getServerById(id);
  if (!server) throw new Error("Server not found");

  db.prepare("UPDATE servers SET status = 'starting' WHERE id = ?").run(id);

  const available = await isDockerAvailable();
  if (!available) {
    db.prepare("UPDATE servers SET status = 'error' WHERE id = ?").run(id);
    notify("server_error", "Server Start Failed", `Server "${server.name}" failed: Docker is not available`, 0xff0000);
    throw new Error("Docker is not available");
  }

  if (!server.eula_accepted) {
    db.prepare("UPDATE servers SET status = 'error' WHERE id = ?").run(id);
    notify("server_error", "Server Start Failed", `Server "${server.name}" failed: Minecraft EULA not accepted`, 0xff0000);
    throw new Error("Minecraft EULA has not been accepted. Please accept the EULA in server settings before starting.");
  }

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
    if (cfg.key !== "TYPE" && cfg.key !== "VERSION") {
      envVars[cfg.key] = cfg.value;
    }
  }

  const containerName = `biryani-mc-${server.id}`;
  const dataDir = `${process.cwd()}/data/server-${server.id}`;

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  try {
    const existing = docker.getContainer(containerName);
    await existing.remove({ force: true });
  } catch {}

  const image = server.image || "itzg/minecraft-server";
  try {
    await docker.pull(image);

    const container = await docker.createContainer({
      Image: image,
      name: containerName,
      Env: Object.entries(envVars).map(([k, v]) => `${k}=${v}`),
      HostConfig: {
        PortBindings: { "25565/tcp": [{ HostPort: server.port.toString() }] },
        Memory: server.ram_mb * 1024 * 1024,
        Binds: [`${dataDir}:/data`],
        RestartPolicy: { Name: "unless-stopped" },
      },
      WorkingDir: "/data",
      Labels: { "biryani.managed": "true", "biryani.server_id": server.id.toString() },
    });

    await container.start();
    db.prepare("UPDATE servers SET status = 'running', container_id = ? WHERE id = ?").run(container.id, id);
    notify("server_started", "Server Started", `Server "${server.name}" is now running`, 0x00ff00);
    return container.id;
  } catch (err) {
    db.prepare("UPDATE servers SET status = 'error' WHERE id = ?").run(id);
    notify("server_error", "Server Start Failed", `Server "${server.name}" failed to start: ${(err as Error).message}`, 0xff0000);
    throw err;
  }
}

export async function stopServer(id: number): Promise<void> {
  const server = getServerById(id);
  if (!server) throw new Error("Server not found");

  const containerName = `biryani-mc-${server.id}`;

  try {
    const container = docker.getContainer(containerName);
    await container.stop({ t: 30 });
    await container.remove({ force: true });
  } catch {}

  db.prepare("UPDATE servers SET status = 'stopped', container_id = NULL WHERE id = ?").run(id);
  notify("server_stopped", "Server Stopped", `Server "${server.name}" has been stopped`, 0xffaa00);
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
    const raw = await container.logs({ stdout: true, stderr: true, tail, follow: false }) as unknown as Buffer;
    let output = "";
    let pos = 0;
    while (pos < raw.length) {
      if (pos + 8 > raw.length) break;
      const size = raw.readUInt32BE(pos + 4);
      if (pos + 8 + size > raw.length) break;
      output += raw.subarray(pos + 8, pos + 8 + size).toString("utf-8");
      pos += 8 + size;
    }
    return output.trim();
  } catch {
    return "";
  }
}

export async function sendCommand(id: number, command: string): Promise<string> {
  const server = getServerById(id);
  if (!server || !server.container_id) throw new Error("Server not running");

  const container = docker.getContainer(server.container_id);
  const exec = await container.exec({
    Cmd: ["rcon-cli", command],
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({ Detach: false });
  return new Promise((resolve, reject) => {
    let output = "";
    dockerStreamDemux(stream,
      (data) => { output += data; },
      (data) => { output += data; },
    );
    stream.on("end", () => resolve(output.trim()));
    stream.on("error", reject);
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
