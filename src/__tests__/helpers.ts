import Database from "better-sqlite3";

export function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      hostname TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 50051,
      status TEXT NOT NULL DEFAULT 'offline',
      api_key TEXT NOT NULL,
      max_servers INTEGER NOT NULL DEFAULT 10,
      current_servers INTEGER NOT NULL DEFAULT 0,
      last_heartbeat TEXT,
      cpu_percent REAL DEFAULT 0,
      memory_percent REAL DEFAULT 0,
      disk_percent REAL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      node_id INTEGER NOT NULL DEFAULT 1,
      port INTEGER UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'stopped',
      mc_version TEXT NOT NULL DEFAULT '1.21.4',
      software TEXT NOT NULL DEFAULT 'vanilla',
      image TEXT NOT NULL DEFAULT 'itzg/minecraft-server',
      ram_mb INTEGER NOT NULL DEFAULT 2048,
      cpu_percent REAL DEFAULT NULL,
      container_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (node_id) REFERENCES nodes(id)
    );
    CREATE TABLE IF NOT EXISTS server_config (
      server_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (server_id, key),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      schedule TEXT NOT NULL,
      command TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run TEXT,
      next_run TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      webhook_url TEXT,
      email TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      events TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS installed_mods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      mod_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      version TEXT,
      source TEXT NOT NULL DEFAULT 'modrinth',
      installed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
  `);

  db.prepare(
    "INSERT INTO nodes (name, hostname, port, status, api_key, max_servers) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("master", "127.0.0.1", 50051, "online", "test-key", 10);

  return db;
}

export function seedServer(db: Database.Database, overrides?: Partial<{ name: string; port: number; node_id: number; status: string; mc_version: string; software: string; ram_mb: number; container_id: string }>) {
  const defaults = {
    name: "Test Server",
    port: 25565,
    node_id: 1,
    status: "stopped",
    mc_version: "1.21.4",
    software: "vanilla",
    ram_mb: 2048,
  };
  const data = { ...defaults, ...overrides };
  const result = db.prepare(
    "INSERT INTO servers (name, node_id, port, mc_version, software, ram_mb, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(data.name, data.node_id, data.port, data.mc_version, data.software, data.ram_mb, data.status);
  return result.lastInsertRowid as number;
}

export const mockDocker = {
  ping: async () => true,
  pull: async () => null,
  getContainer: () => ({
    start: async () => {},
    stop: async () => {},
    remove: async () => {},
    inspect: async () => ({ State: { Running: true } }),
    export: async () => Buffer.from("test"),
    logs: async () => Buffer.from("test log"),
    exec: () => ({
      start: async () => ({
        on: (event: string, cb: any) => {
          if (event === "data") cb(Buffer.from("output"));
          if (event === "end") cb();
        },
      }),
    }),
    stats: async () => ({
      cpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 1000, online_cpus: 4 },
      precpu_stats: { cpu_usage: { total_usage: 50 }, system_cpu_usage: 500 },
      memory_stats: { usage: 1024 * 1024 * 512, limit: 1024 * 1024 * 2048 },
      networks: { eth0: { rx_bytes: 1000, tx_bytes: 2000 } },
    }),
  }),
  createContainer: async () => ({
    id: "test-container-id",
    start: async () => {},
  }),
  listContainers: async () => [],
};
