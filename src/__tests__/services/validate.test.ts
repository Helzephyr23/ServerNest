import { describe, it, expect } from "vitest";
import { schemas } from "../../middleware/validate.js";
import { rateLimit } from "../../middleware/rate-limit.js";

describe("middleware/validate", () => {
  describe("schemas.login", () => {
    it("should accept valid login data", () => {
      const result = schemas.login.safeParse({ username: "admin", password: "pass" });
      expect(result.success).toBe(true);
    });

    it("should reject empty username", () => {
      const result = schemas.login.safeParse({ username: "", password: "pass" });
      expect(result.success).toBe(false);
    });

    it("should reject missing password", () => {
      const result = schemas.login.safeParse({ username: "admin" });
      expect(result.success).toBe(false);
    });
  });

  describe("schemas.setup", () => {
    it("should accept valid setup data", () => {
      const result = schemas.setup.safeParse({ username: "admin", password: "password123" });
      expect(result.success).toBe(true);
    });

    it("should reject short username", () => {
      const result = schemas.setup.safeParse({ username: "ab", password: "password123" });
      expect(result.success).toBe(false);
    });

    it("should reject short password", () => {
      const result = schemas.setup.safeParse({ username: "admin", password: "12345" });
      expect(result.success).toBe(false);
    });
  });

  describe("schemas.createServer", () => {
    it("should accept valid server data", () => {
      const result = schemas.createServer.safeParse({
        name: "My Server",
        mc_version: "1.21.4",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing name", () => {
      const result = schemas.createServer.safeParse({ mc_version: "1.21.4" });
      expect(result.success).toBe(false);
    });

    it("should reject missing mc_version", () => {
      const result = schemas.createServer.safeParse({ name: "My Server" });
      expect(result.success).toBe(false);
    });

    it("should apply defaults", () => {
      const result = schemas.createServer.safeParse({
        name: "My Server",
        mc_version: "1.21.4",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.software).toBe("vanilla");
        expect(result.data.ram_mb).toBe(2048);
      }
    });

    it("should reject ram_mb below 512", () => {
      const result = schemas.createServer.safeParse({
        name: "Test",
        mc_version: "1.21.4",
        ram_mb: 256,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("schemas.sendCommand", () => {
    it("should accept valid command", () => {
      const result = schemas.sendCommand.safeParse({ command: "list" });
      expect(result.success).toBe(true);
    });

    it("should reject empty command", () => {
      const result = schemas.sendCommand.safeParse({ command: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("schemas.updateProperties", () => {
    it("should accept valid properties", () => {
      const result = schemas.updateProperties.safeParse({
        properties: { "server-name": "Test" },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("schemas.createNode", () => {
    it("should accept valid node data", () => {
      const result = schemas.createNode.safeParse({
        name: "node-1",
        hostname: "192.168.1.100",
        api_key: "secret",
      });
      expect(result.success).toBe(true);
    });

    it("should apply default port", () => {
      const result = schemas.createNode.safeParse({
        name: "node-1",
        hostname: "192.168.1.100",
        api_key: "secret",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.port).toBe(50051);
      }
    });
  });
});

describe("middleware/rate-limit", () => {
  it("should return a function", () => {
    const rl = rateLimit(10, 60000);
    expect(typeof rl).toBe("function");
  });
});
