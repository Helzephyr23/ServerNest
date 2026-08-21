import Docker from "dockerode";
import { createApp } from "./app";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;

function createLogger(level: LogLevel = "info") {
  const minLevel = LOG_LEVELS[level];
  const log = (lvl: LogLevel, msg: string, extra?: Record<string, unknown>) => {
    if (LOG_LEVELS[lvl] >= minLevel) {
      const entry: Record<string, unknown> = { level: lvl, msg, time: new Date().toISOString() };
      if (extra) Object.assign(entry, extra);
      const line = JSON.stringify(entry);
      if (lvl === "error") console.error(line);
      else if (lvl === "warn") console.warn(line);
      else console.log(line);
    }
  };
  return {
    debug: (msg: string, extra?: Record<string, unknown>) => log("debug", msg, extra),
    info: (msg: string, extra?: Record<string, unknown>) => log("info", msg, extra),
    warn: (msg: string, extra?: Record<string, unknown>) => log("warn", msg, extra),
    error: (msg: string, extra?: Record<string, unknown>) => log("error", msg, extra),
  };
}

const logger = createLogger((process.env.LOG_LEVEL as LogLevel) || "info");

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const PORT = parseInt(process.env.AGENT_PORT || "50051", 10);
const API_KEY = process.env.NODE_API_KEY || "";
const NODE_NAME = process.env.NODE_NAME || "agent";
const PANEL_URL = process.env.PANEL_URL || "";

const app = createApp({ docker, apiKey: API_KEY, nodeName: NODE_NAME });

app.listen(PORT, "0.0.0.0", () => {
  logger.info("Agent started", { port: PORT, name: NODE_NAME, panelUrl: PANEL_URL || "not configured" });
});
