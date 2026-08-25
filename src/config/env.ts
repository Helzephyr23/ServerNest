import { config } from "dotenv";
import path from "path";
import crypto from "crypto";

config({ path: path.resolve(process.cwd(), ".env") });

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
  DATABASE_PATH: process.env.DATABASE_PATH || "./data/biryani.db",
  DOCKER_IMAGE: process.env.DOCKER_IMAGE || "itzg/minecraft-server",
  SERVER_PORT_RANGE_START: parseInt(process.env.SERVER_PORT_RANGE_START || "25565", 10),
  SERVER_PORT_RANGE_END: parseInt(process.env.SERVER_PORT_RANGE_END || "25665", 10),
  NODE_NAME: process.env.NODE_NAME || "master",
  NODE_API_KEY: process.env.NODE_API_KEY || "",
  GRPC_PORT: parseInt(process.env.GRPC_PORT || "50051", 10),
};

export function checkJwtSecret(): void {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "change-me-to-a-random-string" || process.env.JWT_SECRET === "change-me-in-production") {
    console.error("\n🚨 SECURITY ERROR: JWT_SECRET is set to an insecure default value.");
    console.error("   Set a strong, unique JWT_SECRET in your .env file before starting in production.\n");
    process.exit(1);
  }
}
