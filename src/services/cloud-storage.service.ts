import fs from "fs";
import { createReadStream, createWriteStream } from "fs";
import { createRequire } from "module";

const nodeRequire = createRequire(import.meta.url);

// Resolves CommonJS-only SDK packages from this ESM module.
// Overridable so tests can substitute lightweight fakes.
export let _loadSdk: (id: string) => any = (id: string) => nodeRequire(id);

export function _setSdkLoader(loader: (id: string) => any): void {
  _loadSdk = loader;
}

export interface CloudStorageConfig {
  id: number;
  server_id: number;
  provider: "s3" | "gdrive" | "dropbox";
  label: string;
  config_json: string;
  enabled: number;
  created_at: string;
}

export type OnProgress = (bytesUploaded: number) => void;

export interface CloudStorageProvider {
  upload(localPath: string, remotePath: string, totalBytes: number, onProgress?: OnProgress): Promise<void>;
  download(remotePath: string, localPath: string): Promise<void>;
  delete(remotePath: string): Promise<void>;
  testConnection(): Promise<boolean>;
}

class S3StorageProvider implements CloudStorageProvider {
  private s3: any;
  private bucket: string;
  private prefix: string;

  constructor(config: any) {
    const { S3Client } = _loadSdk("@aws-sdk/client-s3");
    this.bucket = config.bucket;
    this.prefix = (config.prefix || "").replace(/\/?$/, "/");
    this.s3 = new S3Client({
      endpoint: config.endpoint || undefined,
      region: config.region || "us-east-1",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.endpoint ? true : undefined,
    });
  }

  async upload(localPath: string, remotePath: string, _totalBytes: number, onProgress?: OnProgress): Promise<void> {
    const { Upload } = _loadSdk("@aws-sdk/lib-storage");
    const fileStream = createReadStream(localPath);
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: this.prefix + remotePath,
        Body: fileStream,
      },
    });
    if (onProgress) {
      upload.on("httpUploadProgress", (progress: { loaded?: number }) => {
        if (progress.loaded != null) onProgress(progress.loaded);
      });
    }
    await upload.done();
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const { GetObjectCommand } = _loadSdk("@aws-sdk/client-s3");
    const response = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.prefix + remotePath,
    }));
    const writeStream = createWriteStream(localPath);
    await new Promise<void>((resolve, reject) => {
      (response.Body as NodeJS.ReadableStream).pipe(writeStream).on("finish", resolve).on("error", reject);
    });
  }

  async delete(remotePath: string): Promise<void> {
    const { DeleteObjectCommand } = _loadSdk("@aws-sdk/client-s3");
    await this.s3.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: this.prefix + remotePath,
    }));
  }

  async testConnection(): Promise<boolean> {
    const { HeadBucketCommand } = _loadSdk("@aws-sdk/client-s3");
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}

class GoogleDriveStorageProvider implements CloudStorageProvider {
  private drive: any;
  private auth: any;
  private folderId: string | undefined;

  constructor(config: any) {
    const { google } = _loadSdk("googleapis");
    const auth = new google.auth.OAuth2({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
    auth.setCredentials({ refresh_token: config.refreshToken });
    this.auth = auth;
    this.drive = google.drive({ version: "v3", auth });
    this.folderId = config.folderId;
  }

  private async ensureFolder(_name: string): Promise<string> {
    if (!this.folderId) {
      const res = await this.drive.files.list({
        q: "name='BiryaniBackups' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: "files(id)",
        spaces: "drive",
      });
      if (res.data.files?.length) {
        this.folderId = res.data.files[0].id;
      } else {
        const folder = await this.drive.files.create({
          requestBody: {
            name: "BiryaniBackups",
            mimeType: "application/vnd.google-apps.folder",
          },
          fields: "id",
        });
        this.folderId = folder.data.id;
      }
    }
    return this.folderId!;
  }

  private static async getAccessToken(auth: any): Promise<string> {
    if (auth.getAccessToken && typeof auth.getAccessToken === "function") {
      const token = await auth.getAccessToken();
      if (token?.token) return token.token;
    }
    throw new Error("Unable to obtain a Google access token");
  }

  async upload(localPath: string, remotePath: string, totalBytes: number, onProgress?: OnProgress): Promise<void> {
    const folderId = await this.ensureFolder("BiryaniBackups");
    const accessToken = await GoogleDriveStorageProvider.getAccessToken(this.auth);

    // 1. Initiate a resumable upload session. This returns a Location header
    //    pointing to the resumable session URI. Google's resumable protocol is
    //    designed for large files and has no single-request timeout.
    const sessionUrl = await this.initiateResumableSession(
      accessToken,
      remotePath,
      folderId,
      totalBytes,
    );

    // 2. Stream the file bytes to the session URI.
    await this.streamToResumableSession(
      accessToken,
      sessionUrl,
      localPath,
      totalBytes,
      onProgress,
    );
  }

  private async initiateResumableSession(
    accessToken: string,
    remotePath: string,
    folderId: string,
    totalBytes: number,
  ): Promise<string> {
    const metadata = {
      name: remotePath,
      parents: [folderId],
      mimeType: "application/gzip",
    };
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "application/gzip",
          "X-Upload-Content-Length": String(totalBytes),
        },
        body: JSON.stringify(metadata),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to start Google Drive resumable upload (${res.status})`);
    }
    const location = res.headers.get("location");
    if (!location) {
      throw new Error("Google Drive did not return a resumable upload session");
    }
    return location;
  }

  private async streamToResumableSession(
    accessToken: string,
    sessionUrl: string,
    localPath: string,
    totalBytes: number,
    onProgress?: OnProgress,
  ): Promise<void> {
    const fd = await import("fs").then((m) => m.promises.open(localPath, "r"));
    try {
      let offset = 0;
      const CHUNK = 5 * 1024 * 1024; // 5 MB resumable chunks
      while (offset < totalBytes) {
        const bytesRead = Math.min(CHUNK, totalBytes - offset);
        const buffer = Buffer.alloc(bytesRead);
        await fd.read(buffer, 0, bytesRead, offset);

        const isFinal = offset + bytesRead >= totalBytes;
        const contentRange = isFinal
          ? `bytes ${offset}-${offset + bytesRead - 1}/${totalBytes}`
          : `bytes ${offset}-${offset + bytesRead - 1}/*`;

        const res = await fetch(sessionUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/gzip",
            "Content-Length": String(bytesRead),
            "Content-Range": contentRange,
          },
          body: buffer,
        });

        offset += bytesRead;
        if (onProgress) onProgress(offset);

        if (res.status === 308) {
          // Continue sending the next chunk.
          continue;
        }
        if (res.status === 200 || res.status === 201) {
          // Upload complete.
          return;
        }
        throw new Error(`Google Drive upload failed with status ${res.status}`);
      }
    } finally {
      await fd.close();
    }
  }

  private static escapeGdriveQuery(value: string): string {
    return value.replace(/'/g, "\\'");
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const folderId = await this.ensureFolder("BiryaniBackups");
    const safePath = GoogleDriveStorageProvider.escapeGdriveQuery(remotePath);
    const res = await this.drive.files.list({
      q: `name='${safePath}' and '${folderId}' in parents and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });
    if (!res.data.files?.length) throw new Error("File not found in Google Drive");
    const fileId = res.data.files[0].id;
    const response = await this.drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
    const writeStream = createWriteStream(localPath);
    await new Promise<void>((resolve, reject) => {
      response.data.pipe(writeStream).on("finish", resolve).on("error", reject);
    });
  }

  async delete(remotePath: string): Promise<void> {
    const folderId = await this.ensureFolder("BiryaniBackups");
    const safePath = GoogleDriveStorageProvider.escapeGdriveQuery(remotePath);
    const res = await this.drive.files.list({
      q: `name='${safePath}' and '${folderId}' in parents and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });
    if (res.data.files?.length) {
      await this.drive.files.delete({ fileId: res.data.files[0].id });
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.drive.about.get({ fields: "user" });
      return true;
    } catch {
      return false;
    }
  }
}

class DropboxStorageProvider implements CloudStorageProvider {
  private dbx: any;
  private pathPrefix: string;

  constructor(config: any) {
    const { Dropbox } = _loadSdk("dropbox");
    this.dbx = new Dropbox({ accessToken: config.accessToken });
    this.pathPrefix = (config.path || "/BiryaniBackups").replace(/\/?$/, "/");
  }

  async upload(localPath: string, remotePath: string, totalBytes: number, onProgress?: OnProgress): Promise<void> {
    const fileContent = fs.readFileSync(localPath);
    if (onProgress) onProgress(totalBytes);
    await this.dbx.filesUpload({
      path: this.pathPrefix + remotePath,
      contents: fileContent,
      mode: "overwrite",
    });
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const response = await this.dbx.filesDownload({ path: this.pathPrefix + remotePath });
    const buf = Buffer.from((response.result as { fileBinary: string }).fileBinary);
    fs.writeFileSync(localPath, buf);
  }

  async delete(remotePath: string): Promise<void> {
    try {
      await this.dbx.filesDeleteV2({ path: this.pathPrefix + remotePath });
    } catch {}
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.dbx.usersGetCurrentAccount();
      return true;
    } catch {
      return false;
    }
  }
}

export function createCloudProvider(config: CloudStorageConfig): CloudStorageProvider {
  const parsed = JSON.parse(config.config_json);
  switch (config.provider) {
    case "s3": return new S3StorageProvider(parsed);
    case "gdrive": return new GoogleDriveStorageProvider(parsed);
    case "dropbox": return new DropboxStorageProvider(parsed);
    default: throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export async function uploadBackupToCloud(
  localPath: string,
  filename: string,
  storageConfig: CloudStorageConfig,
  totalBytes: number,
  onProgress?: OnProgress,
): Promise<void> {
  const provider = createCloudProvider(storageConfig);
  await provider.upload(localPath, filename, totalBytes, onProgress);
}

export async function downloadFromCloud(storageConfig: CloudStorageConfig, filename: string, destPath: string): Promise<void> {
  const provider = createCloudProvider(storageConfig);
  await provider.download(filename, destPath);
}

export async function deleteFromCloud(storageConfig: CloudStorageConfig, filename: string): Promise<void> {
  const provider = createCloudProvider(storageConfig);
  await provider.delete(filename);
}

export async function testCloudConnection(storageConfig: CloudStorageConfig): Promise<boolean> {
  const provider = createCloudProvider(storageConfig);
  return provider.testConnection();
}
