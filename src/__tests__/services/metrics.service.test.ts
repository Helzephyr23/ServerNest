import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedServer } from "../helpers.js";

const testDb = createTestDb();

vi.mock("../../config/database.js", () => ({ default: testDb, migrate: vi.fn() }));
vi.mock("../../config/docker.js", () => ({
  default: { ping: vi.fn(), pull: vi.fn(), getContainer: vi.fn(), createContainer: vi.fn(), listContainers: vi.fn().mockResolvedValue([]) },
  isDockerAvailable: vi.fn().mockResolvedValue(true),
  getImageName: vi.fn().mockReturnValue("itzg/minecraft-server"),
}));
vi.mock("../../config/env.js", () => ({
  env: {
    NODE_ENV: "test", PANEL_HOST: "127.0.0.1", PANEL_PORT: 3000, API_PORT: 3001,
    JWT_SECRET: "test-secret", JWT_EXPIRES_IN: "1d", DATABASE_PATH: ":memory:",
    DOCKER_IMAGE: "itzg/minecraft-server", SERVER_PORT_RANGE_START: 25565,
    SERVER_PORT_RANGE_END: 25665, SERVER_DATA_DIR: "./data", NODE_NAME: "master", NODE_API_KEY: "test-key", GRPC_PORT: 50051,
  },
}));

const dockerMod = await import("../../config/docker.js");
const {
  getServerMetrics, collectMetrics, collectAllMetrics, getMetricsHistory, getNodeMetrics,
} = await import("../../services/metrics.service.js");

function statsFixture() {
  return {
    cpu_stats: { cpu_usage: { total_usage: 200 }, system_cpu_usage: 1000, online_cpus: 4 },
    precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 500 },
    memory_stats: { usage: 536870912, limit: 2147483648 },
    networks: { eth0: { rx_bytes: 1000, tx_bytes: 2000 } },
  };
}

function mockContainerStats(stats: unknown | Error) {
  const statsFn = stats instanceof Error
    ? vi.fn().mockRejectedValue(stats)
    : vi.fn().mockResolvedValue(stats);
  (dockerMod.default.getContainer as ReturnType<typeof vi.fn>).mockReturnValue({ stats: statsFn });
  return statsFn;
}

function seedWithContainer(overrides?: Parameters<typeof seedServer>[1]): number {
  const id = seedServer(testDb, overrides);
  testDb.prepare("UPDATE servers SET container_id = 'ctr-' || ? WHERE id = ?").run(String(id), id);
  return id;
}

describe("metrics.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testDb.exec("DELETE FROM server_metrics");
    testDb.exec("DELETE FROM servers");
  });

  describe("getServerMetrics", () => {
    it("returns null for a nonexistent server", async () => {
      expect(await getServerMetrics(999)).toBeNull();
    });

    it("returns null when the server has no container", async () => {
      const id = seedServer(testDb);
      expect(await getServerMetrics(id)).toBeNull();
    });

    it("computes cpu percent, memory, and network values from docker stats", async () => {
      const id = seedWithContainer();
      mockContainerStats(statsFixture());
      const metrics = await getServerMetrics(id);
      expect(metrics).toEqual({
        cpu_percent: 80,
        memory_mb: 512,
        memory_limit_mb: 2048,
        network_rx: 1000,
        network_tx: 2000,
      });
    });

    it("persists cpu_percent onto the server row", async () => {
      const id = seedWithContainer();
      mockContainerStats(statsFixture());
      await getServerMetrics(id);
      const row = testDb.prepare("SELECT cpu_percent FROM servers WHERE id = ?").get(id) as { cpu_percent: number };
      expect(row.cpu_percent).toBe(80);
    });

    it("handles zero system delta without dividing", async () => {
      const id = seedWithContainer();
      mockContainerStats({
        cpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 500, online_cpus: 4 },
        precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 500 },
        memory_stats: {},
      });
      const metrics = await getServerMetrics(id);
      expect(metrics!.cpu_percent).toBe(0);
      expect(metrics!.memory_mb).toBe(0);
    });

    it("returns null when docker stats fail", async () => {
      const id = seedWithContainer();
      mockContainerStats(new Error("container gone"));
      expect(await getServerMetrics(id)).toBeNull();
    });
  });

  describe("collectMetrics", () => {
    it("inserts a server_metrics row when metrics are available", async () => {
      const id = seedWithContainer();
      mockContainerStats(statsFixture());
      await collectMetrics(id);
      const rows = testDb.prepare("SELECT * FROM server_metrics WHERE server_id = ?").all(id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ server_id: id, cpu_percent: 80, memory_mb: 512, memory_limit_mb: 2048 });
    });

    it("inserts nothing when metrics are unavailable", async () => {
      const id = seedServer(testDb);
      await collectMetrics(id);
      expect(testDb.prepare("SELECT COUNT(*) AS c FROM server_metrics").get()).toEqual({ c: 0 });
    });
  });

  describe("collectAllMetrics", () => {
    it("only collects for running servers", async () => {
      const running = seedWithContainer({ status: "running" });
      seedServer(testDb, { name: "stopped", port: 25566, status: "stopped" });
      mockContainerStats(statsFixture());
      await collectAllMetrics();
      const rows = testDb.prepare("SELECT server_id FROM server_metrics").all();
      expect(rows).toEqual([{ server_id: running }]);
    });

    it("keeps going when one server's collection fails", async () => {
      seedWithContainer({ status: "running", port: 25565 });
      const b = seedWithContainer({ status: "running", port: 25567 });
      let calls = 0;
      (dockerMod.default.getContainer as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        stats: () => {
          calls++;
          if (calls === 1) throw new Error("first fails");
          return Promise.resolve(statsFixture());
        },
      }));
      await collectAllMetrics();
      const rows = testDb.prepare("SELECT server_id FROM server_metrics").all();
      expect(rows).toEqual([{ server_id: b }]);
    });
  });

  describe("getMetricsHistory", () => {
    it("returns rows for the server ordered ascending", () => {
      const id = seedServer(testDb);
      const other = seedServer(testDb, { port: 25566 });
      const insert = testDb.prepare(
        "INSERT INTO server_metrics (server_id, cpu_percent, memory_mb, memory_limit_mb) VALUES (?, ?, ?, ?)"
      );
      insert.run(id, 10, 100, 2048);
      insert.run(other, 99, 999, 2048);
      insert.run(id, 20, 200, 2048);
      const history = getMetricsHistory(id, "24h");
      expect(history).toHaveLength(2);
      expect(history.map((h) => h.cpu_percent)).toEqual([10, 20]);
    });

    it("accepts every documented range without throwing", () => {
      const id = seedServer(testDb);
      for (const range of ["1h", "6h", "24h", "7d", "bogus"]) {
        expect(Array.isArray(getMetricsHistory(id, range))).toBe(true);
      }
    });
  });

  describe("getNodeMetrics", () => {
    it("sums ram across all servers but usage only from running containers", async () => {
      const running = seedWithContainer({ status: "running", ram_mb: 2048 });
      seedServer(testDb, { name: "halted", port: 25566, status: "stopped", ram_mb: 1024 });
      seedServer(testDb, { name: "nocontainer", port: 25567, status: "running", ram_mb: 4096 });
      mockContainerStats(statsFixture());
      const node = await getNodeMetrics();
      expect(node.total_servers).toBe(3);
      expect(node.running_servers).toBe(2);
      expect(node.total_memory_mb).toBe(7168);
      expect(node.used_memory_mb).toBe(512);
      void running;
    });
  });
});
