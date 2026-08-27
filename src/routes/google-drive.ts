import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { env } from "../config/env.js";
import db from "../config/database.js";
import { authMiddleware, adminMiddleware } from "../middleware/auth.js";
import { _loadSdk } from "../services/cloud-storage.service.js";

const SCOPE = "https://www.googleapis.com/auth/drive.file";

function getRedirectUri(request: any): string {
  const proto = request.headers["x-forwarded-proto"] || "http";
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  return `${proto}://${host}/api/google-drive/callback`;
}

export default async function googleDriveRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authMiddleware] };

  // ── Generate authorization URL ──────────────────────────────────────────
  app.get("/api/google-drive/auth-url", { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return reply.status(400).send({ error: "Google Drive OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
    }

    const { serverId } = request.query as { serverId?: string };
    if (!serverId) {
      return reply.status(400).send({ error: "serverId query parameter is required" });
    }

    const server = db.prepare("SELECT id FROM servers WHERE id = ?").get(Number(serverId));
    if (!server) {
      return reply.status(404).send({ error: "Server not found" });
    }

    const state = crypto.randomBytes(32).toString("hex");
    const redirectUri = getRedirectUri(request);

    // Store state → server_id mapping in DB (short-lived)
    db.prepare("DELETE FROM gdrive_oauth_states WHERE created_at < datetime('now', '-5 minutes')").run();
    db.prepare("INSERT INTO gdrive_oauth_states (state, server_id, created_at) VALUES (?, ?, datetime('now'))").run(state, Number(serverId));

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      state,
      access_type: "offline",
      prompt: "consent",
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  });

  // ── OAuth callback ──────────────────────────────────────────────────────
  app.get("/api/google-drive/callback", async (request, reply) => {
    const { code, state, error: oauthError } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (oauthError) {
      return reply.redirect(`/dashboard?error=gdrive_auth_denied`);
    }

    if (!code || !state) {
      return reply.redirect(`/dashboard?error=gdrive_missing_params`);
    }

    // Validate state
    const row = db.prepare("SELECT server_id FROM gdrive_oauth_states WHERE state = ?").get(state) as { server_id: number } | undefined;
    db.prepare("DELETE FROM gdrive_oauth_states WHERE state = ?").run(state);

    if (!row) {
      return reply.redirect(`/dashboard?error=gdrive_invalid_state`);
    }

    const serverId = row.server_id;
    const redirectUri = getRedirectUri(request);

    try {
      // Exchange authorization code for tokens (server-side only)
      const { google } = _loadSdk("googleapis");
      const oauth2 = new google.auth.OAuth2({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      });

      const { tokens } = await oauth2.getToken({ code, redirect_uri: redirectUri });
      const refreshToken = tokens.refresh_token;
      if (!refreshToken) {
        return reply.redirect(`/dashboard/servers/${serverId}/cloud-storage?error=gdrive_no_refresh_token`);
      }

      // Fetch user email
      oauth2.setCredentials({ access_token: tokens.access_token });
      const drive = google.drive({ version: "v3", auth: oauth2 });
      const about = await drive.about.get({ fields: "user" });
      const email = about.data.user?.emailAddress || "unknown";

      // Upsert cloud storage config for this server
      const existing = db.prepare("SELECT id, config_json FROM cloud_storage_configs WHERE server_id = ? AND provider = 'gdrive'").get(serverId) as { id: number; config_json: string } | undefined;

      const configJson = JSON.stringify({
        refreshToken,
        email,
        connectedAt: new Date().toISOString(),
      });

      if (existing) {
        db.prepare("UPDATE cloud_storage_configs SET config_json = ?, enabled = 1 WHERE id = ?").run(configJson, existing.id);
      } else {
        db.prepare("INSERT INTO cloud_storage_configs (server_id, provider, label, config_json) VALUES (?, 'gdrive', 'Google Drive', ?)").run(serverId, configJson);
      }

      return reply.redirect(`/dashboard/servers/${serverId}/cloud-storage?gdrive=connected`);
    } catch (err: any) {
      console.error("Google Drive OAuth callback error:", err);
      return reply.redirect(`/dashboard/servers/${serverId}/cloud-storage?error=gdrive_token_exchange_failed`);
    }
  });

  // ── Connection status ───────────────────────────────────────────────────
  app.get("/api/google-drive/status", opts, async (request) => {
    const { serverId } = request.query as { serverId?: string };
    if (!serverId) {
      return { connected: false };
    }

    const config = db.prepare("SELECT id, config_json, enabled FROM cloud_storage_configs WHERE server_id = ? AND provider = 'gdrive'").get(Number(serverId)) as { id: number; config_json: string; enabled: number } | undefined;

    if (!config) {
      return { connected: false };
    }

    const parsed = JSON.parse(config.config_json);
    return {
      connected: config.enabled === 1,
      email: parsed.email || null,
      configId: config.id,
    };
  });

  // ── Disconnect / revoke ─────────────────────────────────────────────────
  app.post("/api/google-drive/disconnect", { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    const { serverId } = request.body as { serverId?: string };
    if (!serverId) {
      return reply.status(400).send({ error: "serverId is required" });
    }

    const config = db.prepare("SELECT id, config_json FROM cloud_storage_configs WHERE server_id = ? AND provider = 'gdrive'").get(Number(serverId)) as { id: number; config_json: string } | undefined;

    if (!config) {
      return reply.status(404).send({ error: "Google Drive not connected" });
    }

    // Revoke refresh token with Google
    try {
      const parsed = JSON.parse(config.config_json);
      if (parsed.refreshToken) {
        const { google } = _loadSdk("googleapis");
        const oauth2 = new google.auth.OAuth2({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        });
        await oauth2.revokeToken(parsed.refreshToken);
      }
    } catch (err) {
      // Token may already be invalid — proceed with deletion anyway
    }

    db.prepare("DELETE FROM cloud_storage_configs WHERE id = ?").run(config.id);
    return { success: true };
  });

  // ── Test connection ─────────────────────────────────────────────────────
  app.post("/api/google-drive/test", opts, async (request, reply) => {
    const { serverId } = request.body as { serverId?: string };
    if (!serverId) {
      return reply.status(400).send({ error: "serverId is required" });
    }

    const config = db.prepare("SELECT id, config_json FROM cloud_storage_configs WHERE server_id = ? AND provider = 'gdrive'").get(Number(serverId)) as { id: number; config_json: string } | undefined;

    if (!config) {
      return reply.status(404).send({ error: "Google Drive not connected" });
    }

    try {
      const parsed = JSON.parse(config.config_json);
      const { google } = _loadSdk("googleapis");
      const oauth2 = new google.auth.OAuth2({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      });
      oauth2.setCredentials({ refresh_token: parsed.refreshToken });
      const drive = google.drive({ version: "v3", auth: oauth2 });
      await drive.about.get({ fields: "user" });
      return { success: true, message: "Connection successful" };
    } catch {
      return { success: false, message: "Connection failed" };
    }
  });
}
