import db from "../config/database.js";

interface Node {
  id: number;
  name: string;
  hostname: string;
  port: number;
  status: string;
  api_key: string;
  max_servers: number;
  current_servers: number;
  created_at: string;
}

export function getAllNodes(): Node[] {
  return db.prepare("SELECT * FROM nodes ORDER BY created_at DESC").all() as Node[];
}

export function getNodeById(id: number): Node | undefined {
  return db.prepare("SELECT * FROM nodes WHERE id = ?").get(id) as Node | undefined;
}

export function getNodeByApiKey(apiKey: string): Node | undefined {
  return db.prepare("SELECT * FROM nodes WHERE api_key = ?").get(apiKey) as Node | undefined;
}

export function createNode(data: { name: string; hostname: string; port: number; api_key: string; max_servers?: number }) {
  const result = db.prepare(
    "INSERT INTO nodes (name, hostname, port, api_key, max_servers) VALUES (?, ?, ?, ?, ?)"
  ).run(data.name, data.hostname, data.port, data.api_key, data.max_servers || 10);
  return { id: result.lastInsertRowid, ...data };
}

export function updateNodeStatus(id: number, status: string) {
  db.prepare("UPDATE nodes SET status = ? WHERE id = ?").run(status, id);
}

export function updateNodeServerCount(id: number, count: number) {
  db.prepare("UPDATE nodes SET current_servers = ? WHERE id = ?").run(count, id);
}

export function deleteNode(id: number) {
  db.prepare("DELETE FROM nodes WHERE id = ?").run(id);
}
