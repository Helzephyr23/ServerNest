import path from "path";
import { env } from "../config/env.js";

/**
 * Root directory that holds one subdirectory per Minecraft server.
 *
 * Resolved against `env.SERVER_DATA_DIR` (default `./data`).
 */
export function serverDataRoot(): string {
  return path.resolve(env.SERVER_DATA_DIR);
}

/**
 * Absolute host path to a server's Minecraft data directory.
 *
 * Always call this instead of building the path by hand. The result is handed
 * to Docker as a bind source for the Minecraft container, which means the
 * daemon resolves it against the host filesystem -- so it has to be absolute.
 * A relative path here silently resolves against the daemon's working
 * directory and writes the world somewhere nobody is looking.
 */
export function serverDataDir(serverId: number): string {
  return path.join(serverDataRoot(), `server-${serverId}`);
}
