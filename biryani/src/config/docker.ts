import Docker from "dockerode";
import { env } from "./env.js";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export default docker;

export async function isDockerAvailable(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

export function getImageName(software: string): string {
  switch (software) {
    case "paper":
      return "itzg/minecraft-server";
    case "spigot":
      return "itzg/minecraft-server";
    case "forge":
      return "itzg/minecraft-server";
    case "fabric":
      return "itzg/minecraft-server";
    case "bedrock":
      return "itzg/minecraft-bedrock-server";
    default:
      return "itzg/minecraft-server";
  }
}
