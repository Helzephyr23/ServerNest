import { FastifyInstance } from "fastify";
import {
  getUserByUsername, getUserById, createUser, verifyPassword, isFirstRun, createSession,
  isTotpEnabled, setupTotp, verifyTotpCode, enableTotp, disableTotp, getUserTotpStatus,
  isAccountLocked, recordFailedLogin, clearFailedLogins,
} from "../services/auth.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { validate, schemas } from "../middleware/validate.js";

export default async function authRoutes(app: FastifyInstance) {
  function setAuthCookie(reply: any, token: string) {
    reply.setCookie("biryani_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 24 * 60 * 60,
    });
  }

  app.post("/api/auth/setup", {
    preHandler: [rateLimit(5, 60000), validate(schemas.setup)],
  }, async (request, reply) => {
    if (!isFirstRun()) {
      return reply.status(400).send({ error: "Admin already exists" });
    }
    const { username, password } = request.body as { username: string; password: string };
    const user = await createUser(username, password, "admin");
    const jti = createSession(user.id, request.headers["user-agent"], request.ip);
    const token = app.jwt.sign({ id: user.id, username: user.username, role: user.role, jti });
    setAuthCookie(reply, token);
    return { token, user: { id: user.id, username: user.username, role: user.role } };
  });

  app.get("/api/auth/status", async () => {
    return { firstRun: isFirstRun() };
  });

  app.post("/api/auth/login", {
    preHandler: [rateLimit(10, 60000), validate(schemas.login)],
  }, async (request, reply) => {
    try {
      const { username, password } = request.body as { username: string; password: string };
      const user = getUserByUsername(username);
      if (!user) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      if (isAccountLocked(user.id)) {
        return reply.status(429).send({ error: "Account temporarily locked due to too many failed login attempts. Try again later." });
      }

      if (!(await verifyPassword(user, password))) {
        recordFailedLogin(user.id);
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      clearFailedLogins(user.id);

      if (isTotpEnabled(user.id)) {
        const tempToken = app.jwt.sign(
          { purpose: "totp", id: user.id },
          { expiresIn: "5m" }
        );
        return { requiresTotp: true, tempToken, user: { id: user.id, username: user.username, role: user.role } };
      }

      const jti = createSession(user.id, request.headers["user-agent"], request.ip);
      const token = app.jwt.sign({ id: user.id, username: user.username, role: user.role, jti });
      setAuthCookie(reply, token);
      return { token, user: { id: user.id, username: user.username, role: user.role } };
    } catch (err: unknown) {
      request.log.error(err, "Login failed");
      return reply.status(500).send({ error: (err as Error).message || "Internal server error" });
    }
  });

  app.post("/api/auth/2fa/challenge", {
    preHandler: [rateLimit(5, 60000), validate(schemas.twofaChallenge)],
  }, async (request, reply) => {
    try {
      const { tempToken, code } = request.body as { tempToken: string; code: string };

      let decoded: any;
      try {
        decoded = app.jwt.verify(tempToken);
      } catch {
        return reply.status(401).send({ error: "Invalid or expired temp token" });
      }

      if (decoded.purpose !== "totp" || !decoded.id) {
        return reply.status(401).send({ error: "Invalid temp token" });
      }

      if (!verifyTotpCode(code, decoded.id)) {
        return reply.status(401).send({ error: "Invalid authentication code" });
      }

      const user = getUserById(decoded.id);
      if (!user) return reply.status(401).send({ error: "User not found" });

      const jti = createSession(user.id, request.headers["user-agent"], request.ip);
      const token = app.jwt.sign({ id: user.id, username: user.username, role: user.role, jti });
      setAuthCookie(reply, token);
      return { token, user: { id: user.id, username: user.username, role: user.role } };
    } catch (err: unknown) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.get("/api/auth/2fa/status", {
    preHandler: [authMiddleware],
  }, async (request) => {
    const user = request.user!;
    return getUserTotpStatus(user.id);
  });

  app.post("/api/auth/2fa/setup", {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const user = request.user!;
    const status = getUserTotpStatus(user.id);
    if (status.enabled) {
      return reply.status(400).send({ error: "2FA is already enabled" });
    }
    const result = await setupTotp(user.id);
    return result;
  });

  app.post("/api/auth/2fa/verify", {
    preHandler: [authMiddleware, validate(schemas.twofaVerify)],
  }, async (request, reply) => {
    const user = request.user!;
    const { code } = request.body as { code: string };

    if (!verifyTotpCode(code, user.id)) {
      return reply.status(401).send({ error: "Invalid code" });
    }

    enableTotp(user.id);
    return { success: true };
  });

  app.post("/api/auth/2fa/disable", {
    preHandler: [authMiddleware, validate(schemas.twofaDisable)],
  }, async (request, reply) => {
    const user = request.user!;
    const { password, code } = request.body as { password: string; code: string };

    const fullUser = getUserByUsername(user.username);
    if (!fullUser || !(await verifyPassword(fullUser, password))) {
      return reply.status(401).send({ error: "Invalid password" });
    }

    if (!verifyTotpCode(code, user.id)) {
      return reply.status(401).send({ error: "Invalid code" });
    }

    disableTotp(user.id);
    return { success: true };
  });

  app.get("/api/auth/me", {
    preHandler: [async (req, reply) => {
      try {
        const token = req.cookies?.biryani_token
          ?? req.headers.authorization?.replace("Bearer ", "");
        if (!token) return reply.status(401).send({ error: "No token" });
        const decoded = app.jwt.verify<{ id: number; username: string; role: string }>(token);
        req.user = decoded;
      } catch {
        return reply.status(401).send({ error: "Invalid token" });
      }
    }]
  }, async (request) => {
    const token = request.cookies?.biryani_token
      ?? request.headers.authorization?.replace("Bearer ", "");
    let expiresAt: number | null = null;
    if (token) {
      try {
        const decoded = app.jwt.verify<{ exp?: number }>(token);
        if (typeof decoded.exp === "number") expiresAt = decoded.exp * 1000;
      } catch {}
    }
    const { id, username, role } = request.user!;
    return { user: { id, username, role }, expiresAt };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    reply.clearCookie("biryani_token", { path: "/" });
    return { success: true };
  });
}
