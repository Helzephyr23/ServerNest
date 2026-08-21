import Database from "better-sqlite3";
import { applyTestSchema, seedMasterNode } from "./schema.js";

export function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  applyTestSchema(db);
  seedMasterNode(db);
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
