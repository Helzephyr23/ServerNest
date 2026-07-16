import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PANEL_HOST: process.env.PANEL_HOST || "127.0.0.1",
  PANEL_PORT: parseInt(process.env.PANEL_PORT || "3000", 10),
  API_PORT: parseInt(process.env.API_PORT || "3001", 10),
  JWT_SECRET: process.env.JWT_SECRET || "change-me-to-a-random-string",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  DATABASE_PATH: process.env.DATABASE_PATH || "./data/biryani.db",
  DOCKER_IMAGE: process.env.DOCKER_IMAGE || "itzg/minecraft-server",
  SERVER_PORT_RANGE_START: parseInt(process.env.SERVER_PORT_RANGE_START || "25565", 10),
  SERVER_PORT_RANGE_END: parseInt(process.env.SERVER_PORT_RANGE_END || "25665", 10),
  NODE_NAME: process.env.NODE_NAME || "master",
  NODE_API_KEY: process.env.NODE_API_KEY || "",
  GRPC_PORT: parseInt(process.env.GRPC_PORT || "50051", 10),
};
