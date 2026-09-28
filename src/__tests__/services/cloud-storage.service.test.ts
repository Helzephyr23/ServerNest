import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PassThrough } from "stream";

const s3Send = vi.fn();
class FakeS3Command {
  constructor(public input: any) {}
}
class FakeS3Client {
  static instances: FakeS3Client[] = [];
  public sent: FakeS3Command[] = [];
  constructor(public config: any) {
    FakeS3Client.instances.push(this);
  }
  async send(cmd: FakeS3Command) {
    this.sent.push(cmd);
    return s3Send(cmd);
  }
}
async function drainStream(stream: any): Promise<void> {
  if (!stream || typeof stream.resume !== "function") return;
  await new Promise<void>((resolve) => {
    stream.on("end", resolve);
    stream.on("error", () => resolve());
    stream.on("close", resolve);
    stream.resume();
  });
}

class FakeUpload {
  static lastParams: any;
  constructor(public opts: any) {
    FakeUpload.lastParams = opts;
  }
  async done(): Promise<void> {
    // Fully consume the lazily-opened read stream so the underlying file
    // is opened and closed before the test's temp directory is removed.
    await drainStream(this.opts?.params?.Body);
  }
}

const oauthSetCredentials = vi.fn();
const oauthGetAccessToken = vi.fn();
class FakeOAuth2 {
  static instances: FakeOAuth2[] = [];
  constructor(public config: any) {
    FakeOAuth2.instances.push(this);
  }
  setCredentials(creds: unknown) {
    oauthSetCredentials(creds);
  }
  async getAccessToken() {
    return oauthGetAccessToken();
  }
}

const driveFactoryRecorder = vi.fn();
const driveFiles = { list: vi.fn(), create: vi.fn(), get: vi.fn(), delete: vi.fn() };
const driveAbout = { get: vi.fn() };

const dbxInstance = {
  filesUpload: vi.fn(),
  filesDownload: vi.fn(),
  filesDeleteV2: vi.fn(),
  usersGetCurrentAccount: vi.fn(),
};
const dropboxCtorRecorder = vi.fn();
class FakeDropbox {
  constructor(config: any) {
    dropboxCtorRecorder(config);
    return dbxInstance;
  }
}

function loadSdk(name: string) {
  switch (name) {
    case "@aws-sdk/client-s3":
      return {
        S3Client: FakeS3Client,
        GetObjectCommand: FakeS3Command,
        DeleteObjectCommand: FakeS3Command,
        HeadBucketCommand: FakeS3Command,
      };
    case "@aws-sdk/lib-storage":
      return { Upload: FakeUpload };
    case "googleapis":
      return {
        google: {
          auth: { OAuth2: FakeOAuth2 },
          drive: driveFactoryRecorder.mockImplementation(() => ({ files: driveFiles, about: driveAbout })),
        },
      };
    case "dropbox":
      return { Dropbox: FakeDropbox };
    default:
      throw new Error(`Unexpected sdk request in tests: ${name}`);
  }
}

const {
  createCloudProvider,
  uploadBackupToCloud,
  downloadFromCloud,
  deleteFromCloud,
  testCloudConnection,
} = await import("../../services/cloud-storage.service.js");

const { _setSdkLoader } = await import("../../services/cloud-storage.service.js");
_setSdkLoader(loadSdk);

let tempDir: string;

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  FakeS3Client.instances = [];
  FakeOAuth2.instances = [];
  FakeUpload.lastParams = undefined;
  oauthGetAccessToken.mockResolvedValue({ token: "test-access-token" });
  (global as any).fetch = fetchMock;
  tempDir = mkdtempSync(join(tmpdir(), "cloud-storage-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function s3Config(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, server_id: 1, provider: "s3" as const, label: "test", enabled: 1, created_at: "",
    config_json: JSON.stringify({
      bucket: "bkt", accessKeyId: "ak", secretAccessKey: "sk", ...overrides,
    }),
  };
}

function gdriveConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 2, server_id: 1, provider: "gdrive" as const, label: "test", enabled: 1, created_at: "",
    config_json: JSON.stringify({ clientId: "cid", clientSecret: "cs", refreshToken: "rt", ...overrides }),
  };
}

function dropboxConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 3, server_id: 1, provider: "dropbox" as const, label: "test", enabled: 1, created_at: "",
    config_json: JSON.stringify({ accessToken: "tok", ...overrides }),
  };
}

describe("createCloudProvider", () => {
  it("constructs an S3 client with credentials and default region", () => {
    createCloudProvider(s3Config());
    expect(FakeS3Client.instances[0].config).toEqual(
      expect.objectContaining({
        region: "us-east-1",
        credentials: { accessKeyId: "ak", secretAccessKey: "sk" },
      })
    );
  });

  it("enables forcePathStyle only when a custom endpoint is set", () => {
    createCloudProvider(s3Config({ endpoint: "https://minio.local" }));
    expect(FakeS3Client.instances[0].config.forcePathStyle).toBe(true);
    createCloudProvider(s3Config());
    expect(FakeS3Client.instances[1].config.forcePathStyle).toBeUndefined();
  });

  it("throws for unknown providers", () => {
    expect(() =>
      createCloudProvider({ ...(s3Config() as any), provider: "ftp" })
    ).toThrow("Unknown provider: ftp");
  });
});

describe("S3 provider", () => {
  it("uploads via multipart Upload with prefixed key and stream body", async () => {
    const localFile = join(tempDir, "backup.tar.gz");
    writeFileSync(localFile, "data");
    const provider = createCloudProvider(s3Config({ prefix: "prefix" }));
    await provider.upload(localFile, "remote.tar.gz", 4);
    expect(FakeUpload.lastParams.params).toMatchObject({
      Bucket: "bkt",
      Key: "prefix/remote.tar.gz",
    });
    expect(FakeUpload.lastParams.params.Body.path).toBe(localFile);
  });

  it("deletes objects with the prefixed key", async () => {
    const provider = createCloudProvider(s3Config({ prefix: "p" }));
    await provider.delete("file.tar.gz");
    const client = FakeS3Client.instances[0];
    expect(client.sent).toHaveLength(1);
    expect(client.sent[0].input).toEqual({ Bucket: "bkt", Key: "p/file.tar.gz" });
  });

  it("downloads objects by piping the response body to disk", async () => {
    const dest = join(tempDir, "out.bin");
    s3Send.mockImplementation(async () => {
      const body = new PassThrough();
      setImmediate(() => {
        body.write("hello ");
        body.end("world");
      });
      return { Body: body };
    });
    const provider = createCloudProvider(s3Config({ prefix: "" }));
    await provider.download("in.bin", dest);
    expect(readFileSync(dest, "utf-8")).toBe("hello world");
  });

  it("reports connection success and failure", async () => {
    const provider = createCloudProvider(s3Config());
    s3Send.mockResolvedValueOnce({});
    expect(await provider.testConnection()).toBe(true);
    s3Send.mockRejectedValueOnce(new Error("403"));
    expect(await provider.testConnection()).toBe(false);
  });
});

describe("Google Drive provider", () => {
  it("configures OAuth2 with refresh token credentials", () => {
    createCloudProvider(gdriveConfig());
    expect(FakeOAuth2.instances[0].config).toEqual({ clientId: "cid", clientSecret: "cs" });
    expect(oauthSetCredentials).toHaveBeenCalledWith({ refresh_token: "rt" });
    expect(driveFactoryRecorder).toHaveBeenCalledWith(expect.objectContaining({ version: "v3" }));
  });

  it("uses the configured folder without listing when folderId exists", async () => {
    const localFile = join(tempDir, "f.txt");
    writeFileSync(localFile, "data");
    fetchMock.mockImplementation(async (url: string, init: any) => {
      if ((init?.method || "GET") === "POST") {
        expect(init.headers["X-Upload-Content-Length"]).toBe("4");
        return { ok: true, status: 200, headers: { get: (n: string) => n.toLowerCase() === "location" ? "https://session.example/resumable" : null } };
      }
      return { ok: true, status: 201 };
    });
    await uploadBackupToCloud(localFile, "f.txt", gdriveConfig({ folderId: "folder-42" }), 4);
    expect(driveFiles.list).not.toHaveBeenCalled();
    expect(driveFiles.list).not.toHaveBeenCalled();
  });

  it("discovers an existing ServerNestBackups folder when none configured", async () => {
    const localFile = join(tempDir, "f.txt");
    writeFileSync(localFile, "data");
    driveFiles.list.mockResolvedValueOnce({ data: { files: [{ id: "found-1" }] } });
    fetchMock.mockImplementation(async (url: string, init: any) => {
      if ((init?.method || "GET") === "POST") return { ok: true, status: 200, headers: { get: (n: string) => n.toLowerCase() === "location" ? "https://session.example/resumable" : null } };
      return { ok: true, status: 201 };
    });
    await uploadBackupToCloud(localFile, "f.txt", gdriveConfig(), 4);
    // Folder discovery used the existing folder without creating a new one.
    expect(driveFiles.create).not.toHaveBeenCalled();
  });

  it("creates the ServerNestBackups folder when discovery comes up empty", async () => {
    const localFile = join(tempDir, "f.txt");
    writeFileSync(localFile, "data");
    driveFiles.list.mockResolvedValueOnce({ data: { files: [] } });
    driveFiles.create.mockResolvedValueOnce({ data: { id: "new-folder" } });
    fetchMock.mockImplementation(async (url: string, init: any) => {
      if ((init?.method || "GET") === "POST") return { ok: true, status: 200, headers: { get: (n: string) => n.toLowerCase() === "location" ? "https://session.example/resumable" : null } };
      return { ok: true, status: 201 };
    });
    await uploadBackupToCloud(localFile, "f.txt", gdriveConfig(), 4);
    expect(driveFiles.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({ name: "ServerNestBackups", mimeType: "application/vnd.google-apps.folder" }),
      })
    );
  });

  it("throws when downloading a file that does not exist", async () => {
    driveFiles.list.mockResolvedValue({ data: { files: [] } });
    const provider = createCloudProvider(gdriveConfig({ folderId: "fld" }));
    await expect(provider.download("ghost.tar.gz", join(tempDir, "x"))).rejects.toThrow(
      "File not found in Google Drive"
    );
  });

  it("pipes downloaded files to disk", async () => {
    const dest = join(tempDir, "gd.bin");
    driveFiles.list.mockResolvedValue({ data: { files: [{ id: "fid" }] } });
    driveFiles.get.mockImplementation(async () => {
      const body = new PassThrough();
      setImmediate(() => body.end("gdrive-data"));
      return { data: body };
    });
    const provider = createCloudProvider(gdriveConfig({ folderId: "fld" }));
    await provider.download("f.bin", dest);
    expect(readFileSync(dest, "utf-8")).toBe("gdrive-data");
  });

  it("deletes an existing remote file and ignores missing ones", async () => {
    const provider = createCloudProvider(gdriveConfig({ folderId: "fld" }));
    driveFiles.list.mockResolvedValueOnce({ data: { files: [{ id: "kill-me" }] } });
    await provider.delete("gone.tar.gz");
    expect(driveFiles.delete).toHaveBeenCalledWith({ fileId: "kill-me" });
    driveFiles.list.mockResolvedValueOnce({ data: { files: [] } });
    await provider.delete("already-gone.tar.gz");
    expect(driveFiles.delete).toHaveBeenCalledTimes(1);
  });

  it("reports connection success and failure", async () => {
    const provider = createCloudProvider(gdriveConfig());
    driveAbout.get.mockResolvedValueOnce({});
    expect(await provider.testConnection()).toBe(true);
    driveAbout.get.mockRejectedValueOnce(new Error("denied"));
    expect(await provider.testConnection()).toBe(false);
  });
});

describe("Dropbox provider", () => {
  it("passes the access token to the Dropbox client", () => {
    createCloudProvider(dropboxConfig());
    expect(dropboxCtorRecorder).toHaveBeenCalledWith({ accessToken: "tok" });
  });

  it("uploads file contents in overwrite mode under the prefix", async () => {
    const localFile = join(tempDir, "dbx.bin");
    writeFileSync(localFile, "dropbox-bytes");
    const provider = createCloudProvider(dropboxConfig({ path: "/backups" }));
    await provider.upload(localFile, "save.tar.gz", 14);
    expect(dbxInstance.filesUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/backups/save.tar.gz",
        mode: "overwrite",
      })
    );
    const contents = dbxInstance.filesUpload.mock.calls[0][0].contents;
    expect(contents.toString()).toBe("dropbox-bytes");
  });

  it("defaults the prefix to /ServerNestBackups/", async () => {
    const provider = createCloudProvider(dropboxConfig());
    await provider.delete("x.tar.gz");
    expect(dbxInstance.filesDeleteV2).toHaveBeenCalledWith({ path: "/ServerNestBackups/x.tar.gz" });
  });

  it("writes downloaded fileBinary to disk", async () => {
    const dest = join(tempDir, "from-dbx.bin");
    dbxInstance.filesDownload.mockResolvedValue({ result: { fileBinary: Buffer.from("dbx-data") } });
    const provider = createCloudProvider(dropboxConfig());
    await provider.download("f.bin", dest);
    expect(readFileSync(dest)).toEqual(Buffer.from("dbx-data"));
  });

  it("swallows delete errors silently", async () => {
    dbxInstance.filesDeleteV2.mockRejectedValueOnce(new Error("lookup_failed"));
    const provider = createCloudProvider(dropboxConfig());
    await expect(provider.delete("whatever")).resolves.toBeUndefined();
  });

  it("reports connection success and failure", async () => {
    const provider = createCloudProvider(dropboxConfig());
    dbxInstance.usersGetCurrentAccount.mockResolvedValueOnce({});
    expect(await provider.testConnection()).toBe(true);
    dbxInstance.usersGetCurrentAccount.mockRejectedValueOnce(new Error("invalid token"));
    expect(await provider.testConnection()).toBe(false);
  });
});

describe("wrapper functions", () => {
  it("uploadBackupToCloud delegates to the provider upload", async () => {
    const localFile = join(tempDir, "w.txt");
    writeFileSync(localFile, "w");
    await uploadBackupToCloud(localFile, "remote-name", s3Config({ prefix: "pre" }), 1);
    expect(FakeUpload.lastParams.params.Key).toBe("pre/remote-name");
  });

  it("downloadFromCloud delegates to the provider download", async () => {
    const dest = join(tempDir, "d.bin");
    s3Send.mockImplementation(async () => {
      const body = new PassThrough();
      setImmediate(() => body.end("ok"));
      return { Body: body };
    });
    await downloadFromCloud(s3Config(), "f", dest);
    expect(existsSync(dest)).toBe(true);
  });

  it("deleteFromCloud delegates to the provider delete", async () => {
    await deleteFromCloud(s3Config(), "f");
    expect(s3Send).toHaveBeenCalledTimes(1);
  });

  it("testCloudConnection delegates to the provider testConnection", async () => {
    s3Send.mockResolvedValueOnce({});
    expect(await testCloudConnection(s3Config())).toBe(true);
  });
});
