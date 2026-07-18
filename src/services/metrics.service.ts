import db from "../config/database.js";
import docker from "../config/docker.js";

interface Metrics {
  cpu_percent: number;
  memory_mb: number;
  memory_limit_mb: number;
  network_rx: number;
  network_tx: number;
}

export async function getServerMetrics(serverId: number): Promise<Metrics | null> {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as any;
  if (!server || !server.container_id) return null;

  try {
    const container = docker.getContainer(server.container_id);
    const stats = await container.stats({ stream: false });

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
    const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0);
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;

    const memoryMb = (stats.memory_stats.usage || 0) / (1024 * 1024);
    const memoryLimitMb = (stats.memory_stats.limit || 0) / (1024 * 1024);

    const metrics: Metrics = {
      cpu_percent: Math.round(cpuPercent * 100) / 100,
      memory_mb: Math.round(memoryMb),
      memory_limit_mb: Math.round(memoryLimitMb),
      network_rx: stats.networks?.["eth0"]?.rx_bytes || 0,
      network_tx: stats.networks?.["eth0"]?.tx_bytes || 0,
    };

    db.prepare("UPDATE servers SET cpu_percent = ? WHERE id = ?").run(metrics.cpu_percent, serverId);

    return metrics;
  } catch {
    return null;
  }
}

export async function collectMetrics(serverId: number): Promise<void> {
  const metrics = await getServerMetrics(serverId);
  if (metrics) {
    db.prepare("INSERT INTO server_metrics (server_id, cpu_percent, memory_mb, memory_limit_mb) VALUES (?, ?, ?, ?)")
      .run(serverId, metrics.cpu_percent, metrics.memory_mb, metrics.memory_limit_mb);
  }
}

export async function collectAllMetrics(): Promise<void> {
  const servers = db.prepare("SELECT id FROM servers WHERE status = 'running'").all() as { id: number }[];
  for (const server of servers) {
    try {
      await collectMetrics(server.id);
    } catch {}
  }
}

export function getMetricsHistory(serverId: number, range: string): any[] {
  let timeFilter: string;
  switch (range) {
    case "1h": timeFilter = "datetime('now', '-1 hour')"; break;
    case "6h": timeFilter = "datetime('now', '-6 hours')"; break;
    case "24h": timeFilter = "datetime('now', '-24 hours')"; break;
    case "7d": timeFilter = "datetime('now', '-7 days')"; break;
    default: timeFilter = "datetime('now', '-1 hour')";
  }
  return db.prepare(
    `SELECT * FROM server_metrics WHERE server_id = ? AND collected_at >= ${timeFilter} ORDER BY collected_at ASC`
  ).all(serverId) as any[];
}

export async function getNodeMetrics(): Promise<{
  total_servers: number;
  running_servers: number;
  total_memory_mb: number;
  used_memory_mb: number;
}> {
  const servers = db.prepare("SELECT * FROM servers").all() as any[];
  let totalMemory = 0;
  let usedMemory = 0;

  for (const server of servers) {
    totalMemory += server.ram_mb;
    if (server.status === "running" && server.container_id) {
      const metrics = await getServerMetrics(server.id);
      if (metrics) usedMemory += metrics.memory_mb;
    }
  }

  return {
    total_servers: servers.length,
    running_servers: servers.filter((s) => s.status === "running").length,
    total_memory_mb: totalMemory,
    used_memory_mb: Math.round(usedMemory),
  };
}
