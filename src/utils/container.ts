import docker, { dockerStreamDemux } from "../config/docker.js";
import db from "../config/database.js";

interface ServerRow {
  id: number;
  container_id: string | null;
}

export async function execInContainer(serverId: number, cmd: string[]): Promise<string> {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as ServerRow | undefined;
  if (!server || !server.container_id) throw new Error("Server not running");

  const container = docker.getContainer(server.container_id);
  const exec = await container.exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true });
  const stream = await exec.start({ Detach: false });
  return new Promise((resolve, reject) => {
    let output = "";
    dockerStreamDemux(stream,
      (data) => { output += data; },
      (data) => { output += data; },
    );
    stream.on("end", () => resolve(output.trim()));
    stream.on("error", reject);
  });
}

export async function writeInContainer(serverId: number, cmd: string[], stdin: string): Promise<string> {
  const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(serverId) as ServerRow | undefined;
  if (!server || !server.container_id) throw new Error("Server not running");

  const container = docker.getContainer(server.container_id);
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({ Detach: false, Tty: false, hijack: true });
  stream.write(stdin);
  stream.end();
  return new Promise((resolve, reject) => {
    let output = "";
    dockerStreamDemux(stream,
      (data) => { output += data; },
      (data) => { output += data; },
    );
    stream.on("end", () => resolve(output.trim()));
    stream.on("error", reject);
  });
}
