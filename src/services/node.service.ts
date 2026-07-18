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
  last_heartbeat: string | null;
  cpu_percent: number | null;
  memory_percent: number | null;
  disk_percent: number | null;
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

export function createNode(data: {
  name: string;
  hostname: string;
  port: number;
  api_key: string;
  max_servers?: number;
}) {
  const result = db.prepare(
    "INSERT INTO nodes (name, hostname, port, api_key, max_servers) VALUES (?, ?, ?, ?, ?)"
  ).run(data.name, data.hostname, data.port, data.api_key, data.max_servers || 10);
  return getNodeById(result.lastInsertRowid as number)!;
}

export function updateNodeStatus(id: number, status: string) {
  db.prepare("UPDATE nodes SET status = ? WHERE id = ?").run(status, id);
}

export function updateNodeHeartbeat(id: number, metrics?: {
  cpu_percent?: number;
  memory_percent?: number;
  disk_percent?: number;
}) {
  const now = new Date().toISOString();
  if (metrics) {
    db.prepare(
      "UPDATE nodes SET last_heartbeat = ?, status = 'online', cpu_percent = ?, memory_percent = ?, disk_percent = ? WHERE id = ?"
    ).run(now, metrics.cpu_percent || 0, metrics.memory_percent || 0, metrics.disk_percent || 0, id);
  } else {
    db.prepare("UPDATE nodes SET last_heartbeat = ?, status = 'online' WHERE id = ?").run(now, id);
  }
}

export function updateNodeServerCount(id: number, count: number) {
  db.prepare("UPDATE nodes SET current_servers = ? WHERE id = ?").run(count, id);
}

export function deleteNode(id: number) {
  db.prepare("DELETE FROM nodes WHERE id = ?").run(id);
}

export function getServersForNode(nodeId: number) {
  return db.prepare("SELECT * FROM servers WHERE node_id = ?").all(nodeId);
}

export function findNodeForNewServer(): Node | undefined {
  return db.prepare(
    "SELECT * FROM nodes WHERE status = 'online' AND current_servers < max_servers ORDER BY current_servers ASC LIMIT 1"
  ).get() as Node | undefined;
}

export function markStaleNodesOffline() {
  const threshold = new Date(Date.now() - 60000).toISOString();
  db.prepare("UPDATE nodes SET status = 'offline' WHERE last_heartbeat < ? AND name != 'master'").run(threshold);
}
