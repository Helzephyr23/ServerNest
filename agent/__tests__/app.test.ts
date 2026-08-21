import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { PassThrough } from "node:stream";
import type Dockerode from "dockerode";
import { createApp } from "../src/app";

vi.mock("systeminformation", () => ({
  currentLoad: vi.fn(async () => ({ currentLoad: 12.345 })),
  mem: vi.fn(async () => ({ total: 17179869184, used: 8589934592 })),
  fsSize: vi.fn(async () => [{ size: 500000000000, used: 250000000000, use: 50 }]),
  osInfo: vi.fn(async () => ({ platform: "linux", distro: "Ubuntu", release: "22.04" })),
}));

type FakeContainer = {
  id: string;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  stats: ReturnType<typeof vi.fn>;
  logs: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
};

function makeContainer(overrides: Partial<FakeContainer> = {}): FakeContainer {
  return {
    id: "container-id-1",
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    stats: vi.fn().mockResolvedValue({}),
    logs: vi.fn().mockResolvedValue(Buffer.alloc(0)),
    exec: vi.fn(),
    ...overrides,
  };
}

function makeDocker(overrides: Record<string, unknown> = {}): Dockerode {
  return {
    ping: vi.fn().mockResolvedValue(undefined),
    listContainers: vi.fn().mockResolvedValue([]),
    getContainer: vi.fn(),
    createContainer: vi.fn(),
    pull: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Dockerode;
}

function dockerLogFrame(streamByte: number, text: string): Buffer {
  const payload = Buffer.from(text, "utf-8");
  const header = Buffer.alloc(8);
  header.writeUInt8(streamByte, 0);
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

describe("agent app", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("auth middleware", () => {
    it("allows requests when no API key is configured", async () => {
      const app = createApp({ docker: makeDocker() });
      const res = await request(app).get("/containers");
      expect(res.status).toBe(200);
    });

    it("rejects a wrong API key with 401", async () => {
      const app = createApp({ docker: makeDocker(), apiKey: "secret" });
      const res = await request(app).get("/containers").set("x-api-key", "wrong");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid API key");
    });

    it("accepts the correct API key", async () => {
      const app = createApp({ docker: makeDocker(), apiKey: "secret" });
      const res = await request(app).get("/containers").set("x-api-key", "secret");
      expect(res.status).toBe(200);
    });

    it("rejects missing API key when one is required", async () => {
      const app = createApp({ docker: makeDocker(), apiKey: "secret" });
      const res = await request(app).get("/containers");
      expect(res.status).toBe(401);
    });

    it("protects every container route, not just some", async () => {
      const docker = makeDocker();
      const app = createApp({ docker, apiKey: "secret" });
      const routes = [
        ["get", "/containers"],
        ["post", "/containers"],
        ["post", "/containers/x/start"],
        ["post", "/containers/x/stop"],
        ["delete", "/containers/x"],
        ["get", "/containers/x/logs"],
        ["post", "/containers/x/exec"],
        ["post", "/containers/x/remove"],
        ["post", "/pull-image"],
        ["get", "/metrics"],
      ] as const;
      for (const [method, url] of routes) {
        const res = await (request(app) as any)[method](url);
        expect(res.status).toBe(401);
      }
    });
  });

  describe("GET /health", () => {
    it("reports ok with node name and uptime when docker responds", async () => {
      const app = createApp({ docker: makeDocker(), nodeName: "node-1" });
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.name).toBe("node-1");
      expect(res.body.docker).toBe(true);
      expect(typeof res.body.uptime).toBe("number");
    });

    it("reports docker:false when ping fails", async () => {
      const docker = makeDocker({ ping: vi.fn().mockRejectedValue(new Error("no socket")) });
      const app = createApp({ docker });
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.docker).toBe(false);
    });
  });

  describe("GET /metrics", () => {
    it("aggregates only biryani-managed containers and rounds percentages", async () => {
      const managed = { Id: "mc1", Labels: { "biryani.managed": "true" }, State: "running" };
      const unmanaged = { Id: "other", Labels: {}, State: "running" };
      const stoppedManaged = { Id: "mc2", Labels: { "biryani.managed": "true" }, State: "exited" };
      const container = makeContainer({
        stats: vi.fn().mockResolvedValue({ memory_stats: { usage: 512 * 1024 * 1024 } }),
      });
      const docker = makeDocker({
        listContainers: vi.fn().mockResolvedValue([managed, unmanaged, stoppedManaged]),
        getContainer: vi.fn().mockReturnValue(container),
      });
      const app = createApp({ docker });
      const metrics = await request(app).get("/metrics");
      expect(metrics.status).toBe(200);
      expect(metrics.body.mc_servers).toBe(2);
      expect(metrics.body.containers_running).toBe(2);
      expect(metrics.body.containers_total).toBe(3);
      expect(metrics.body.mc_ram_used_mb).toBe(1024);
      expect(metrics.body.cpu_percent).toBe(12.35);
      expect(metrics.body.memory_percent).toBe(50);
      expect(metrics.body.os).toBe("linux Ubuntu 22.04");
    });

    it("tolerates a failing container stats call", async () => {
      const managed = { Id: "mc1", Labels: { "biryani.managed": "true" }, State: "running" };
      const container = makeContainer({ stats: vi.fn().mockRejectedValue(new Error("gone")) });
      const docker = makeDocker({
        listContainers: vi.fn().mockResolvedValue([managed]),
        getContainer: vi.fn().mockReturnValue(container),
      });
      const res = await request(createApp({ docker })).get("/metrics");
      expect(res.status).toBe(200);
      expect(res.body.mc_ram_used_mb).toBe(0);
    });
  });

  describe("GET /containers", () => {
    it("lists managed containers with leading slash stripped from names", async () => {
      const docker = makeDocker({
        listContainers: vi.fn().mockResolvedValue([
          {
            Id: "abc",
            Names: ["/mc-server"],
            Image: "itzg/minecraft-server",
            State: "running",
            Ports: [{ PrivatePort: 25565 }],
            Created: 1700000000,
            Labels: { "biryani.managed": "true" },
          },
          { Id: "zzz", Names: ["/unmanaged"], Labels: {} },
        ]),
      });
      const res = await request(createApp({ docker })).get("/containers");
      expect(res.status).toBe(200);
      expect(res.body.servers).toHaveLength(1);
      expect(res.body.servers[0]).toMatchObject({
        id: "abc",
        name: "mc-server",
        image: "itzg/minecraft-server",
        status: "running",
        created: 1700000000,
      });
    });
  });

  describe("GET /containers/:id/stats", () => {
    it("computes cpu percent, memory mb, and network counters", async () => {
      const container = makeContainer({
        stats: vi.fn().mockResolvedValue({
          cpu_stats: { cpu_usage: { total_usage: 200 }, system_cpu_usage: 1000, online_cpus: 4 },
          precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 500 },
          memory_stats: { usage: 536870912, limit: 2147483648 },
          networks: { eth0: { rx_bytes: 1000, tx_bytes: 2000 } },
        }),
      });
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).get("/containers/abc/stats");
      expect(res.status).toBe(200);
      expect(res.body.cpu_percent).toBe(80);
      expect(res.body.memory_mb).toBe(512);
      expect(res.body.memory_limit_mb).toBe(2048);
      expect(res.body.network_rx).toBe(1000);
      expect(res.body.network_tx).toBe(2000);
    });

    it("returns zero cpu percent when system delta is not positive", async () => {
      const container = makeContainer({
        stats: vi.fn().mockResolvedValue({
          cpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 500, online_cpus: 4 },
          precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 500 },
          memory_stats: {},
        }),
      });
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).get("/containers/abc/stats");
      expect(res.status).toBe(200);
      expect(res.body.cpu_percent).toBe(0);
      expect(res.body.network_rx).toBe(0);
    });

    it("returns 500 with the error message when docker fails", async () => {
      const docker = makeDocker({
        getContainer: vi.fn(() => {
          throw new Error("no such container");
        }),
      });
      const res = await request(createApp({ docker })).get("/containers/nope/stats");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("no such container");
    });
  });

  describe("POST /containers", () => {
    it("creates and starts a managed container with converted memory limit", async () => {
      const container = makeContainer();
      const createContainer = vi.fn().mockResolvedValue(container);
      const docker = makeDocker({ createContainer });
      const res = await request(createApp({ docker }))
        .post("/containers")
        .send({ name: "mc", image: "itzg/minecraft-server", env: ["EULA=TRUE"], ports: {}, memory_mb: 2048, labels: { tier: "game" } });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, id: "container-id-1" });
      expect(createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: "itzg/minecraft-server",
          name: "mc",
          Env: ["EULA=TRUE"],
          Labels: { "biryani.managed": "true", tier: "game" },
          HostConfig: expect.objectContaining({
            Memory: 2048 * 1024 * 1024,
            RestartPolicy: { Name: "unless-stopped" },
          }),
        })
      );
      expect(container.start).toHaveBeenCalled();
    });

    it("omits Memory when memory_mb is not provided", async () => {
      const createContainer = vi.fn().mockResolvedValue(makeContainer());
      const docker = makeDocker({ createContainer });
      await request(createApp({ docker })).post("/containers").send({ name: "mc", image: "img" });
      const arg = createContainer.mock.calls[0][0];
      expect(arg.HostConfig.Memory).toBeUndefined();
      expect(arg.Env).toEqual([]);
    });

    it("returns 500 when creation fails", async () => {
      const docker = makeDocker({ createContainer: vi.fn().mockRejectedValue(new Error("port busy")) });
      const res = await request(createApp({ docker })).post("/containers").send({ image: "img" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("port busy");
    });
  });

  describe("lifecycle routes", () => {
    it("start calls docker start", async () => {
      const container = makeContainer();
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).post("/containers/abc/start");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(container.start).toHaveBeenCalled();
    });

    it("stop passes a 30s timeout", async () => {
      const container = makeContainer();
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).post("/containers/abc/stop");
      expect(res.status).toBe(200);
      expect(container.stop).toHaveBeenCalledWith({ t: 30 });
    });

    it("start failure returns 500", async () => {
      const container = makeContainer({ start: vi.fn().mockRejectedValue(new Error("already running")) });
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).post("/containers/abc/start");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("already running");
    });

    it("DELETE removes after best-effort stop and tolerates stop failure", async () => {
      const container = makeContainer({ stop: vi.fn().mockRejectedValue(new Error("already stopped")) });
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).delete("/containers/abc");
      expect(res.status).toBe(200);
      expect(container.stop).toHaveBeenCalledWith({ t: 10 });
      expect(container.remove).toHaveBeenCalledWith({ force: true });
    });

    it("DELETE returns 500 when removal fails", async () => {
      const container = makeContainer({ remove: vi.fn().mockRejectedValue(new Error("locked")) });
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).delete("/containers/abc");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("locked");
    });

    it("POST /remove stops with 5s timeout then force-removes", async () => {
      const container = makeContainer();
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).post("/containers/abc/remove");
      expect(res.status).toBe(200);
      expect(container.stop).toHaveBeenCalledWith({ t: 5 });
      expect(container.remove).toHaveBeenCalledWith({ force: true });
    });
  });

  describe("GET /containers/:id/logs", () => {
    it("decodes multiple docker multiplexed frames and trims output", async () => {
      const raw = Buffer.concat([
        dockerLogFrame(1, "Starting server\n"),
        dockerLogFrame(2, "[WARN] low disk"),
      ]);
      const container = makeContainer({ logs: vi.fn().mockResolvedValue(raw) });
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).get("/containers/abc/logs");
      expect(res.status).toBe(200);
      expect(res.body.logs).toBe("Starting server\n[WARN] low disk");
    });

    it("defaults tail to 100 and forwards numeric tails", async () => {
      const container = makeContainer();
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const app = createApp({ docker });
      await request(app).get("/containers/abc/logs");
      expect(container.logs).toHaveBeenCalledWith(expect.objectContaining({ tail: 100 }));
      await request(app).get("/containers/abc/logs?tail=25");
      expect(container.logs).toHaveBeenLastCalledWith(expect.objectContaining({ tail: 25 }));
    });

    it("returns empty logs for non-buffer streams", async () => {
      const container = makeContainer({ logs: vi.fn().mockResolvedValue({ pipe: () => {} }) });
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).get("/containers/abc/logs");
      expect(res.status).toBe(200);
      expect(res.body.logs).toBe("");
    });

    it("ignores truncated frames instead of throwing", async () => {
      const full = dockerLogFrame(1, "hello");
      const truncated = full.subarray(0, full.length - 2);
      const container = makeContainer({ logs: vi.fn().mockResolvedValue(truncated) });
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).get("/containers/abc/logs");
      expect(res.status).toBe(200);
      expect(res.body.logs).toBe("");
    });

    it("returns 500 when fetching logs fails", async () => {
      const container = makeContainer({ logs: vi.fn().mockRejectedValue(new Error("dead")) });
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).get("/containers/abc/logs");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /containers/:id/exec", () => {
    function execContainer(): { container: FakeContainer; stream: PassThrough } {
      const stream = new PassThrough();
      const container = makeContainer({
        exec: vi.fn().mockResolvedValue({
          start: vi.fn().mockResolvedValue(stream),
        }),
      });
      return { container, stream };
    }

    it("streams sanitized command output", async () => {
      const { container, stream } = execContainer();
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const pending = request(createApp({ docker })).post("/containers/abc/exec").send({ cmd: ["echo", "hi"] });
      stream.write("out\x01put\ntext");
      stream.end();
      const res = await pending;
      expect(res.status).toBe(200);
      expect(res.body.output).toBe("output\ntext");
      expect(container.exec).toHaveBeenCalledWith(
        expect.objectContaining({ Cmd: ["echo", "hi"], AttachStdout: true, AttachStderr: true })
      );
    });

    it("returns 500 when exec cannot be created", async () => {
      const container = makeContainer({ exec: vi.fn().mockRejectedValue(new Error("not running")) });
      const docker = makeDocker({ getContainer: vi.fn().mockReturnValue(container) });
      const res = await request(createApp({ docker })).post("/containers/abc/exec").send({ cmd: ["ls"] });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("not running");
    });
  });

  describe("POST /pull-image", () => {
    it("pulls the requested image", async () => {
      const pull = vi.fn().mockResolvedValue(undefined);
      const docker = makeDocker({ pull });
      const res = await request(createApp({ docker })).post("/pull-image").send({ image: "itzg/minecraft-server:latest" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(pull).toHaveBeenCalledWith("itzg/minecraft-server:latest");
    });

    it("returns 500 when pull fails", async () => {
      const docker = makeDocker({ pull: vi.fn().mockRejectedValue(new Error("manifest unknown")) });
      const res = await request(createApp({ docker })).post("/pull-image").send({ image: "nope" });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("manifest unknown");
    });
  });
});
