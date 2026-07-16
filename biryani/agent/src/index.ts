import express from "express";
import Docker from "dockerode";

const app = express();
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const PORT = parseInt(process.env.AGENT_PORT || "50051", 10);
const API_KEY = process.env.NODE_API_KEY || "";
const NODE_NAME = process.env.NODE_NAME || "agent";

app.use(express.json());

app.get("/health", async (req, res) => {
  let dockerOk = false;
  try { await docker.ping(); dockerOk = true; } catch {}
  res.json({ status: "ok", name: NODE_NAME, docker: dockerOk });
});

app.get("/metrics", async (req, res) => {
  const si = await import("systeminformation");
  const cpu = await si.currentLoad();
  const mem = await si.mem();
  const containers = await docker.listContainers();

  res.json({
    cpu_percent: cpu.currentLoad,
    memory_total: mem.total,
    memory_used: mem.used,
    memory_percent: (mem.used / mem.total) * 100,
    containers_running: containers.filter((c) => c.State === "running").length,
    containers_total: containers.length,
  });
});

app.get("/containers", async (req, res) => {
  const containers = await docker.listContainers({ all: true });
  const mcContainers = containers.filter((c) =>
    c.Labels?.["biryani.managed"] === "true"
  );
  res.json({
    servers: mcContainers.map((c) => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, ""),
      image: c.Image,
      status: c.State,
      ports: c.Ports,
    })),
  });
});

app.post("/containers/:id/start", async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.start();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/containers/:id/stop", async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.stop({ t: 30 });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Biryani Agent] Running on port ${PORT}`);
  console.log(`[Biryani Agent] Name: ${NODE_NAME}`);
});
