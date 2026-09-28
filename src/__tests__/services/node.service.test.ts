import { describe, it, expect, beforeEach, vi } from "vitest";
import { TEST_SCHEMA_SQL } from "../schema.js";

const testDb = vi.hoisted(() => {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  return db;
});

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

testDb.exec(TEST_SCHEMA_SQL);

const {
  getAllNodes, getNodeById, getNodeByApiKey, createNode, updateNodeStatus,
  updateNodeHeartbeat, updateNodeServerCount, deleteNode, getServersForNode,
  findNodeForNewServer, markStaleNodesOffline,
} = await import("../../services/node.service.js");

describe("node.service", () => {
  beforeEach(() => {
    testDb.exec("DELETE FROM servers");
    testDb.exec("DELETE FROM installed_mods");
    testDb.exec("DELETE FROM scheduled_tasks");
    testDb.exec("DELETE FROM backups");
    // Reset nodes: delete all, reset autoincrement, insert master with id=1
    testDb.exec("DELETE FROM nodes");
    testDb.exec("DELETE FROM sqlite_sequence WHERE name = 'nodes'");
    testDb.prepare(
      "INSERT INTO nodes (name, hostname, port, status, api_key, max_servers) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("master", "127.0.0.1", 50051, "online", "test-key", 10);
  });

  describe("createNode", () => {
    it("should create a node and return it", () => {
      const node = createNode({ name: "agent-1", hostname: "192.168.1.100", port: 50051, api_key: "secret-key" });
      expect(node).toHaveProperty("id");
      expect(node.name).toBe("agent-1");
      expect(node.hostname).toBe("192.168.1.100");
      expect(node.status).toBe("offline");
      expect(node.max_servers).toBe(10);
    });

    it("should use custom max_servers", () => {
      const node = createNode({ name: "agent-2", hostname: "192.168.1.101", port: 50051, api_key: "key", max_servers: 20 });
      expect(node.max_servers).toBe(20);
    });
  });

  describe("getAllNodes", () => {
    it("should return all nodes", () => {
      const nodes = getAllNodes();
      expect(nodes.length).toBe(1);
      expect(nodes[0].name).toBe("master");
    });
  });

  describe("getNodeById", () => {
    it("should return undefined for non-existent id", () => {
      expect(getNodeById(9999)).toBeUndefined();
    });

    it("should return node by id", () => {
      const master = getNodeById(1);
      expect(master).toBeDefined();
      expect(master!.name).toBe("master");
    });
  });

  describe("getNodeByApiKey", () => {
    it("should return undefined for invalid key", () => {
      expect(getNodeByApiKey("invalid")).toBeUndefined();
    });

    it("should return node by api key", () => {
      const node = getNodeByApiKey("test-key");
      expect(node).toBeDefined();
      expect(node!.name).toBe("master");
    });
  });

  describe("updateNodeStatus", () => {
    it("should update status", () => {
      updateNodeStatus(1, "offline");
      expect(getNodeById(1)!.status).toBe("offline");
    });
  });

  describe("updateNodeHeartbeat", () => {
    it("should update heartbeat and status to online", () => {
      updateNodeStatus(1, "offline");
      updateNodeHeartbeat(1);
      const node = getNodeById(1)!;
      expect(node.status).toBe("online");
      expect(node.last_heartbeat).toBeTruthy();
    });

    it("should update metrics when provided", () => {
      updateNodeHeartbeat(1, { cpu_percent: 45.5, memory_percent: 72.3, disk_percent: 55.1 });
      const node = getNodeById(1)!;
      expect(node.cpu_percent).toBe(45.5);
      expect(node.memory_percent).toBe(72.3);
      expect(node.disk_percent).toBe(55.1);
    });
  });

  describe("updateNodeServerCount", () => {
    it("should update server count", () => {
      updateNodeServerCount(1, 5);
      expect(getNodeById(1)!.current_servers).toBe(5);
    });
  });

  describe("deleteNode", () => {
    it("should delete a node", () => {
      const node = createNode({ name: "del-me", hostname: "10.0.0.1", port: 50051, api_key: "k" });
      deleteNode(node.id);
      expect(getNodeById(node.id)).toBeUndefined();
    });
  });

  describe("getServersForNode", () => {
    it("should return servers for a node", () => {
      testDb.prepare("INSERT INTO servers (name, node_id, port, mc_version, software, ram_mb) VALUES (?, ?, ?, ?, ?, ?)").run("S1", 1, 25565, "1.21.4", "vanilla", 2048);
      expect(getServersForNode(1).length).toBe(1);
    });

    it("should return empty for node with no servers", () => {
      expect(getServersForNode(9999)).toEqual([]);
    });
  });

  describe("findNodeForNewServer", () => {
    it("should find an online node with capacity", () => {
      const node = findNodeForNewServer();
      expect(node).toBeDefined();
      expect(node!.name).toBe("master");
    });

    it("should return undefined if all nodes at capacity", () => {
      testDb.prepare("UPDATE nodes SET current_servers = max_servers WHERE name = 'master'").run();
      expect(findNodeForNewServer()).toBeUndefined();
    });
  });

  describe("markStaleNodesOffline", () => {
    it("should mark non-master nodes with old heartbeat as offline", () => {
      const node = createNode({ name: "stale-node", hostname: "10.0.0.2", port: 50051, api_key: "k2" });
      const twoMinAgo = new Date(Date.now() - 120000).toISOString();
      testDb.prepare("UPDATE nodes SET last_heartbeat = ?, status = 'online' WHERE id = ?").run(twoMinAgo, node.id);
      markStaleNodesOffline();
      expect(getNodeById(node.id)!.status).toBe("offline");
    });

    it("should not mark master node as offline", () => {
      const twoMinAgo = new Date(Date.now() - 120000).toISOString();
      testDb.prepare("UPDATE nodes SET last_heartbeat = ? WHERE name = 'master'").run(twoMinAgo);
      markStaleNodesOffline();
      expect(getNodeById(1)!.status).toBe("online");
    });
  });
});
