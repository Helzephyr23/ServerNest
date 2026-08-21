import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb } from "../helpers.js";

const testDb = createTestDb();

const otplibMocks = vi.hoisted(() => ({
  generateSecret: vi.fn(() => "MOCKSECRET234567"),
  generateURI: vi.fn(() => "otpauth://totp/Biryani:admin?secret=MOCKSECRET234567"),
  verifySync: vi.fn(),
}));
vi.mock("otplib", () => otplibMocks);

const qrcodeMocks = vi.hoisted(() => ({
  toDataURL: vi.fn(async () => "data:image/png;base64,QRDATA"),
}));
vi.mock("qrcode", () => ({ default: qrcodeMocks }));

vi.mock("../../config/database.js", () => ({ default: testDb, migrate: vi.fn() }));
vi.mock("../../config/docker.js", () => ({
  default: { ping: vi.fn(), pull: vi.fn(), getContainer: vi.fn(), createContainer: vi.fn() },
  isDockerAvailable: vi.fn().mockResolvedValue(true),
  getImageName: vi.fn().mockReturnValue("itzg/minecraft-server"),
}));
vi.mock("../../config/env.js", () => ({
  env: {
    NODE_ENV: "test", PANEL_HOST: "127.0.0.1", PANEL_PORT: 3000, API_PORT: 3001,
    JWT_SECRET: "test-secret", JWT_EXPIRES_IN: "1d", DATABASE_PATH: ":memory:",
    DOCKER_IMAGE: "itzg/minecraft-server", SERVER_PORT_RANGE_START: 25565,
    SERVER_PORT_RANGE_END: 25665, NODE_NAME: "master", NODE_API_KEY: "test-key", GRPC_PORT: 50051,
  },
}));

const {
  getUserByUsername, getUserById, createUser, verifyPassword, isFirstRun,
  setupTotp, verifyTotpCode, isTotpEnabled, enableTotp,
  createSession, getSessions, getSessionByJti, revokeSessionByJti,
} = await import("../../services/auth.service.js");

describe("auth.service", () => {
  beforeEach(() => {
    testDb.exec("DELETE FROM users");
    testDb.exec("DELETE FROM sessions");
    vi.clearAllMocks();
  });

  describe("createUser", () => {
    it("should create a user and return user data", async () => {
      const user = await createUser("admin", "password123", "admin");
      expect(user).toHaveProperty("id");
      expect(user.username).toBe("admin");
      expect(user.role).toBe("admin");
    });

    it("should hash the password", async () => {
      await createUser("admin", "password123");
      const row = testDb.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
      expect(row.password_hash).not.toBe("password123");
      expect(row.password_hash.length).toBeGreaterThan(20);
    });

    it("should throw on duplicate username", async () => {
      await createUser("admin", "password123");
      await expect(createUser("admin", "other123")).rejects.toThrow();
    });
  });

  describe("getUserByUsername", () => {
    it("should return undefined for non-existent user", () => {
      expect(getUserByUsername("nobody")).toBeUndefined();
    });

    it("should return the user if it exists", async () => {
      await createUser("admin", "password123");
      const user = getUserByUsername("admin");
      expect(user).toBeDefined();
      expect(user!.username).toBe("admin");
    });
  });

  describe("getUserById", () => {
    it("should return undefined for non-existent id", () => {
      expect(getUserById(9999)).toBeUndefined();
    });

    it("should return the user by id", async () => {
      const created = await createUser("admin", "password123");
      const user = getUserById(created.id as number);
      expect(user).toBeDefined();
      expect(user!.username).toBe("admin");
    });
  });

  describe("verifyPassword", () => {
    it("should return true for correct password", async () => {
      await createUser("admin", "password123");
      const dbUser = getUserByUsername("admin")!;
      expect(await verifyPassword(dbUser, "password123")).toBe(true);
    });

    it("should return false for incorrect password", async () => {
      await createUser("admin", "password123");
      const dbUser = getUserByUsername("admin")!;
      expect(await verifyPassword(dbUser, "wrongpassword")).toBe(false);
    });
  });

  describe("isFirstRun", () => {
    it("should return true when no users exist", () => {
      testDb.exec("DELETE FROM users");
      expect(isFirstRun()).toBe(true);
    });

    it("should return false when users exist", async () => {
      await createUser("admin", "password123");
      expect(isFirstRun()).toBe(false);
    });
  });

  describe("Sessions", () => {
    it("createSession registers an active session resolvable by jti", async () => {
      const admin = await createUser("admin", "password123");
      const jti = createSession(admin.id, "test-agent", "127.0.0.1");
      expect(getSessions(admin.id)).toHaveLength(1);
      expect(getSessionByJti(jti)?.user_id).toBe(admin.id);
    });

    it("revokeSessionByJti removes the session from the active list and blocks jti lookup", async () => {
      const admin = await createUser("admin", "password123");
      const jti = createSession(admin.id);
      revokeSessionByJti(jti);
      expect(getSessions(admin.id)).toHaveLength(0);
      expect(getSessionByJti(jti)).toBeUndefined();
    });

    it("revokeSessionByJti only affects the targeted session", async () => {
      const admin = await createUser("admin", "password123");
      const keep = createSession(admin.id, "keep-browser");
      const drop = createSession(admin.id, "drop-browser");
      revokeSessionByJti(drop);
      const remaining = getSessions(admin.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].jti).toBe(keep);
    });

    it("revoking an unknown jti is a harmless no-op", () => {
      expect(() => revokeSessionByJti("does-not-exist")).not.toThrow();
    });
  });

  describe("TOTP", () => {
    it("setupTotp generates a secret, otpauth uri and qr data url", async () => {
      const admin = await createUser("admin", "password123");
      const result = await setupTotp(admin.id);
      expect(result.secret).toBe("MOCKSECRET234567");
      expect(result.uri).toContain("Biryani:admin");
      expect(result.qr).toBe("data:image/png;base64,QRDATA");
      expect(otplibMocks.generateURI).toHaveBeenCalledWith(
        expect.objectContaining({ issuer: "Biryani", label: "admin", secret: "MOCKSECRET234567" })
      );
    });

    it("setupTotp persists the secret encrypted, not in plaintext", async () => {
      const admin = await createUser("admin", "password123");
      const result = await setupTotp(admin.id);
      const row = testDb.prepare("SELECT totp_secret FROM users WHERE id = ?").get(admin.id) as { totp_secret: string };
      expect(row.totp_secret).toBeTruthy();
      expect(row.totp_secret).not.toBe(result.secret);
      expect(row.totp_secret).not.toContain("MOCKSECRET");
    });

    it("verifyTotpCode accepts a code otplib validates against the stored secret", async () => {
      const admin = await createUser("admin", "password123");
      await setupTotp(admin.id);
      otplibMocks.verifySync.mockReturnValueOnce({ valid: true });
      await expect(verifyTotpCode("123456", admin.id)).resolves.toBe(true);
      const secretArg = otplibMocks.verifySync.mock.calls[0][0] as { token: string; secret: string };
      expect(secretArg.token).toBe("123456");
      expect(secretArg.secret).toBe("MOCKSECRET234567");
    });

    it("verifyTotpCode rejects a code otplib marks invalid", async () => {
      const admin = await createUser("admin", "password123");
      await setupTotp(admin.id);
      otplibMocks.verifySync.mockReturnValueOnce({ valid: false });
      await expect(verifyTotpCode("000000", admin.id)).resolves.toBe(false);
    });

    it("verifyTotpCode returns false when 2FA was never set up", async () => {
      const admin = await createUser("admin", "password123");
      await expect(verifyTotpCode("123456", admin.id)).resolves.toBe(false);
      expect(otplibMocks.verifySync).not.toHaveBeenCalled();
    });

    it("isTotpEnabled reflects enablement only after enableTotp", async () => {
      const admin = await createUser("admin", "password123");
      await setupTotp(admin.id);
      expect(isTotpEnabled(admin.id)).toBe(false);
      enableTotp(admin.id);
      expect(isTotpEnabled(admin.id)).toBe(true);
    });
  });
});
