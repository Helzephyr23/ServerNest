import express from "express";
import type Dockerode from "dockerode";

type Request = express.Request;
type Response = express.Response;

function getParamId(req: Request): string {
  return String(req.params.id);
}

export interface CreateAppOptions {
  docker: Dockerode;
  apiKey?: string;
  nodeName?: string;
}

export function createApp({ docker, apiKey = "", nodeName = "agent" }: CreateAppOptions): express.Express {
  const app = express();

  app.use(express.json());

  function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    const key = req.headers["x-api-key"] as string;
    if (!apiKey) return next();
    if (key !== apiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    next();
  }

  app.get("/health", async (req, res) => {
    let dockerOk = false;
    try { await docker.ping(); dockerOk = true; } catch {}
    res.json({
      status: "ok",
      name: nodeName,
      docker: dockerOk,
      uptime: process.uptime(),
    });
  });

  app.get("/metrics", authMiddleware, async (req, res) => {
    const si = await import("systeminformation");
    const [cpu, mem, disk, os] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.osInfo(),
    ]);

    const containers = await docker.listContainers();
    const mcContainers = containers.filter((c) => c.Labels?.["servernest.managed"] === "true");

    let totalRamMb = 0;
    for (const container of mcContainers) {
      try {
        const c = docker.getContainer(container.Id);
        const stats = await c.stats({ stream: false });
        totalRamMb += (stats.memory_stats.usage || 0) / (1024 * 1024);
      } catch {}
    }

    res.json({
      cpu_percent: Math.round(cpu.currentLoad * 100) / 100,
      memory_total: mem.total,
      memory_used: mem.used,
      memory_percent: Math.round((mem.used / mem.total) * 10000) / 100,
      disk_total: disk[0]?.size || 0,
      disk_used: disk[0]?.used || 0,
      disk_percent: disk[0]?.use || 0,
      os: `${os.platform} ${os.distro} ${os.release}`,
      containers_running: containers.filter((c) => c.State === "running").length,
      containers_total: containers.length,
      mc_servers: mcContainers.length,
      mc_ram_used_mb: Math.round(totalRamMb),
    });
  });

  app.get("/containers", authMiddleware, async (req, res) => {
    const containers = await docker.listContainers({ all: true });
    const mcContainers = containers.filter((c) => c.Labels?.["servernest.managed"] === "true");
    res.json({
      servers: mcContainers.map((c) => ({
        id: c.Id,
        name: c.Names[0]?.replace(/^\//, ""),
        image: c.Image,
        status: c.State,
        ports: c.Ports,
        created: c.Created,
      })),
    });
  });

  app.get("/containers/:id/stats", authMiddleware, async (req, res) => {
    try {
      const container = docker.getContainer(getParamId(req));
      const stats = await container.stats({ stream: false });

      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
      const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0);
      const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;

      res.json({
        cpu_percent: Math.round(cpuPercent * 100) / 100,
        memory_mb: Math.round((stats.memory_stats.usage || 0) / (1024 * 1024)),
        memory_limit_mb: Math.round((stats.memory_stats.limit || 0) / (1024 * 1024)),
        network_rx: stats.networks?.["eth0"]?.rx_bytes || 0,
        network_tx: stats.networks?.["eth0"]?.tx_bytes || 0,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/containers", authMiddleware, async (req, res) => {
    try {
      const { name, image, env, ports, memory_mb, labels } = req.body;
      const container = await docker.createContainer({
        Image: image,
        name,
        Env: env || [],
        Labels: { "servernest.managed": "true", ...labels },
        HostConfig: {
          PortBindings: ports || {},
          Memory: memory_mb ? memory_mb * 1024 * 1024 : undefined,
          RestartPolicy: { Name: "unless-stopped" },
        },
      });
      await container.start();
      res.json({ success: true, id: container.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/containers/:id/start", authMiddleware, async (req, res) => {
    try {
      const container = docker.getContainer(getParamId(req));
      await container.start();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/containers/:id/stop", authMiddleware, async (req, res) => {
    try {
      const container = docker.getContainer(getParamId(req));
      await container.stop({ t: 30 });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/containers/:id", authMiddleware, async (req, res) => {
    try {
      const container = docker.getContainer(getParamId(req));
      try { await container.stop({ t: 10 }); } catch {}
      await container.remove({ force: true });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/containers/:id/logs", authMiddleware, async (req, res) => {
    try {
      const tail = parseInt((req.query as any).tail || "100", 10);
      const container = docker.getContainer(getParamId(req));
      const logStream = await container.logs({ stdout: true, stderr: true, tail, follow: false });

      const chunks: string[] = [];
      const raw = logStream as unknown as Buffer;
      if (Buffer.isBuffer(raw)) {
        let pos = 0;
        while (pos < raw.length) {
          if (pos + 8 > raw.length) break;
          const size = raw.readUInt32BE(pos + 4);
          if (pos + 8 + size > raw.length) break;
          chunks.push(raw.subarray(pos + 8, pos + 8 + size).toString("utf-8"));
          pos += 8 + size;
        }
      }
      res.json({ logs: chunks.join("").trim() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/containers/:id/exec", authMiddleware, async (req, res) => {
    try {
      const { cmd } = req.body;
      const container = docker.getContainer(getParamId(req));
      const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({ Detach: false });
      let output = "";
      stream.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf-8").replace(/[^\x20-\x7E\n]/g, "");
      });
      stream.on("end", () => {
        res.json({ output: output.trim() });
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/containers/:id/remove", authMiddleware, async (req, res) => {
    try {
      const container = docker.getContainer(getParamId(req));
      try { await container.stop({ t: 5 }); } catch {}
      await container.remove({ force: true });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/pull-image", authMiddleware, async (req, res) => {
    try {
      const { image } = req.body;
      await docker.pull(image);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
