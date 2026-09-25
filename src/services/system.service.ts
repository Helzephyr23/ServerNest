import os from "node:os";
import fs from "node:fs";

export interface SystemUsage {
  hostname: string;
  platform: string;
  cores: number;
  uptime_seconds: number;
  cpu_percent: number;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_percent: number;
  disk_total_mb: number;
  disk_used_mb: number;
  disk_percent: number;
}

let prevCpuSample: { idle: number; total: number } | null = null;

function getCpuPercent(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const t = cpu.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }

  const now = { idle, total };
  if (prevCpuSample && now.total > prevCpuSample.total) {
    const idleDelta = now.idle - prevCpuSample.idle;
    const totalDelta = now.total - prevCpuSample.total;
    prevCpuSample = now;
    if (totalDelta > 0) {
      return Math.round(((totalDelta - idleDelta) / totalDelta) * 1000) / 10;
    }
  }
  prevCpuSample = now;
  return 0;
}

function getDiskUsage(): { total_mb: number; used_mb: number; percent: number } {
  try {
    const stats = fs.statfsSync(process.cwd());
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    const used = total - free;
    const totalMb = Math.round(total / (1024 * 1024));
    const usedMb = Math.round(used / (1024 * 1024));
    return {
      total_mb: totalMb,
      used_mb: usedMb,
      percent: totalMb > 0 ? Math.round((usedMb / totalMb) * 1000) / 10 : 0,
    };
  } catch {
    return { total_mb: 0, used_mb: 0, percent: 0 };
  }
}

export function getSystemUsage(): SystemUsage {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const disk = getDiskUsage();

  return {
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    cores: os.cpus().length,
    uptime_seconds: os.uptime(),
    cpu_percent: getCpuPercent(),
    memory_total_mb: Math.round(totalMem / (1024 * 1024)),
    memory_used_mb: Math.round(usedMem / (1024 * 1024)),
    memory_percent: totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0,
    disk_total_mb: disk.total_mb,
    disk_used_mb: disk.used_mb,
    disk_percent: disk.percent,
  };
}