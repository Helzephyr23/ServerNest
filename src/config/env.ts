import { config } from "dotenv";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env") });

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  const fallback = crypto.randomBytes(32).toString("hex");
  console.warn("⚠️  JWT_SECRET not set — using random ephemeral secret (sessions will not survive restarts)");
  return fallback;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PANEL_HOST: process.env.PANEL_HOST || "127.0.0.1",
  PANEL_PORT: parseInt(process.env.PANEL_PORT || "3000", 10),
  API_PORT: parseInt(process.env.API_PORT || "3001", 10),
  JWT_SECRET: resolveJwtSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "24h",
  DATABASE_PATH: process.env.DATABASE_PATH || "./data/servernest.db",
  // Root directory holding per-server Minecraft data (`server-<id>/`).
  //
  // This is NOT just an API-side path. The panel passes it straight to Docker
  // as a bind source when creating the Minecraft container, so the daemon
  // resolves it against the *host* filesystem. If the panel reads it from a
  // different location than the daemon writes it, every host-path code path
  // (mod install, file upload/download, server import, clone, the restore
  // safety snapshot) silently operates on an empty directory while the
  // Minecraft container is perfectly happy. See src/utils/data-dir.ts.
  //
  // In Docker it must be an absolute path that is identical inside and outside
  // the API container, so the bind below resolves to the same directory:
  //   - type: bind
  //     source: ${SERVER_DATA_DIR}
  //     target: ${SERVER_DATA_DIR}
  SERVER_DATA_DIR: process.env.SERVER_DATA_DIR || "./data",
  DOCKER_IMAGE: process.env.DOCKER_IMAGE || "itzg/minecraft-server",
  SERVER_PORT_RANGE_START: parseInt(process.env.SERVER_PORT_RANGE_START || "25565", 10),
  SERVER_PORT_RANGE_END: parseInt(process.env.SERVER_PORT_RANGE_END || "25665", 10),
  NODE_NAME: process.env.NODE_NAME || "master",
  NODE_API_KEY: process.env.NODE_API_KEY || "",
  GRPC_PORT: parseInt(process.env.GRPC_PORT || "50051", 10),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
};

export function checkJwtSecret(): void {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "change-me-to-a-random-string" || process.env.JWT_SECRET === "change-me-in-production") {
    console.error("\n🚨 SECURITY ERROR: JWT_SECRET is set to an insecure default value.");
    console.error("   Set a strong, unique JWT_SECRET in your .env file before starting in production.\n");
    process.exit(1);
  }
}
