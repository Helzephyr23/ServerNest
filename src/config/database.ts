import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { env } from "./env.js";

const dbDir = path.dirname(path.resolve(env.DATABASE_PATH));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.resolve(env.DATABASE_PATH)) as Database.Database;

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function migrate() {
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
      eula_accepted INTEGER NOT NULL DEFAULT 0,
      eula_accepted_at TEXT,
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

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      cron TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
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

  const nodeCount = db.prepare("SELECT COUNT(*) as count FROM nodes").get() as { count: number };
  if (nodeCount.count === 0) {
    db.prepare(
      "INSERT INTO nodes (name, hostname, port, status, api_key, max_servers) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("master", "127.0.0.1", env.GRPC_PORT, "online", env.NODE_API_KEY || "local", 10);
  }

  const serverColumns = db.prepare("PRAGMA table_info(servers)").all() as { name: string }[];
  if (!serverColumns.some((c) => c.name === "image")) {
    db.exec("ALTER TABLE servers ADD COLUMN image TEXT NOT NULL DEFAULT 'itzg/minecraft-server'");
  }
  if (!serverColumns.some((c) => c.name === "eula_accepted")) {
    db.exec("ALTER TABLE servers ADD COLUMN eula_accepted INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE servers ADD COLUMN eula_accepted_at TEXT");
  }

  const nodeColumns = db.prepare("PRAGMA table_info(nodes)").all() as { name: string }[];
  if (!nodeColumns.some((c) => c.name === "last_heartbeat")) {
    db.exec("ALTER TABLE nodes ADD COLUMN last_heartbeat TEXT");
  }
  if (!nodeColumns.some((c) => c.name === "cpu_percent")) {
    db.exec("ALTER TABLE nodes ADD COLUMN cpu_percent REAL DEFAULT 0");
  }
  if (!nodeColumns.some((c) => c.name === "memory_percent")) {
    db.exec("ALTER TABLE nodes ADD COLUMN memory_percent REAL DEFAULT 0");
  }
  if (!nodeColumns.some((c) => c.name === "disk_percent")) {
    db.exec("ALTER TABLE nodes ADD COLUMN disk_percent REAL DEFAULT 0");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS cloud_storage_configs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id   INTEGER NOT NULL,
      provider    TEXT NOT NULL,
      label       TEXT NOT NULL,
      config_json TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS backup_uploads (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      backup_id   INTEGER NOT NULL,
      storage_id  INTEGER NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      checksum    TEXT,
      error       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (backup_id) REFERENCES backups(id) ON DELETE CASCADE,
      FOREIGN KEY (storage_id) REFERENCES cloud_storage_configs(id) ON DELETE CASCADE
    );
  `);

  const modColumns = db.prepare("PRAGMA table_info(installed_mods)").all() as { name: string }[];
  if (!modColumns.some((c) => c.name === "slug")) {
    db.exec("ALTER TABLE installed_mods ADD COLUMN slug TEXT");
  }

  const backupColumns = db.prepare("PRAGMA table_info(backups)").all() as { name: string }[];
  if (!backupColumns.some((c) => c.name === "checksum")) {
    db.exec("ALTER TABLE backups ADD COLUMN checksum TEXT");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      route       TEXT NOT NULL,
      method      TEXT NOT NULL DEFAULT 'POST',
      max_requests INTEGER NOT NULL DEFAULT 10,
      window_ms   INTEGER NOT NULL DEFAULT 60000,
      enabled     INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS server_metrics (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id       INTEGER NOT NULL,
      cpu_percent     REAL,
      memory_mb       REAL,
      memory_limit_mb REAL,
      collected_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      jti         TEXT UNIQUE NOT NULL,
      user_agent  TEXT,
      ip          TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      last_used   TEXT NOT NULL DEFAULT (datetime('now')),
      expired     INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

export default db;
