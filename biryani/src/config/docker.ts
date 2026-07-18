import Docker from "dockerode";
import { env } from "./env.js";

const docker = process.env.DOCKER_HOST
  ? new Docker({ host: process.env.DOCKER_HOST })
  : new Docker();

export default docker;

export async function isDockerAvailable(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

export function dockerStreamDemux(stream: any, onStdout: (data: string) => void, onStderr: (data: string) => void) {
  let buffer = Buffer.alloc(0);
  stream.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 8) {
      const type = buffer[0];
      const size = buffer.readUInt32BE(4);
      if (buffer.length < 8 + size) break;
      const data = buffer.subarray(8, 8 + size).toString("utf-8");
      buffer = buffer.subarray(8 + size);
      if (type === 1) onStdout(data);
      else if (type === 2) onStderr(data);
      else onStdout(data);
    }
  });
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
