import fs from "fs";
import { createReadStream, createWriteStream } from "fs";

export interface CloudStorageConfig {
  id: number;
  server_id: number;
  provider: "s3" | "gdrive" | "dropbox";
  label: string;
  config_json: string;
  enabled: number;
  created_at: string;
}

export interface CloudStorageProvider {
  upload(localPath: string, remotePath: string): Promise<void>;
  download(remotePath: string, localPath: string): Promise<void>;
  delete(remotePath: string): Promise<void>;
  testConnection(): Promise<boolean>;
}

class S3StorageProvider implements CloudStorageProvider {
  private s3: any;
  private bucket: string;
  private prefix: string;

  constructor(config: any) {
    const { S3Client } = require("@aws-sdk/client-s3");
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

  async upload(localPath: string, remotePath: string): Promise<void> {
    const { Upload } = require("@aws-sdk/lib-storage");
    const fileStream = createReadStream(localPath);
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: this.prefix + remotePath,
        Body: fileStream,
      },
    });
    await upload.done();
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
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
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
    await this.s3.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: this.prefix + remotePath,
    }));
  }

  async testConnection(): Promise<boolean> {
    const { HeadBucketCommand } = require("@aws-sdk/client-s3");
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
  private folderId: string | undefined;

  constructor(config: any) {
    const { google } = require("googleapis");
    const auth = new google.auth.OAuth2({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
    auth.setCredentials({ refresh_token: config.refreshToken });
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

  async upload(localPath: string, remotePath: string): Promise<void> {
    const folderId = await this.ensureFolder("BiryaniBackups");
    await this.drive.files.create({
      requestBody: {
        name: remotePath,
        parents: [folderId],
      },
      media: {
        mimeType: "application/gzip",
        body: createReadStream(localPath),
      },
      fields: "id",
    });
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const folderId = await this.ensureFolder("BiryaniBackups");
    const res = await this.drive.files.list({
      q: `name='${remotePath}' and '${folderId}' in parents and trashed=false`,
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
    const res = await this.drive.files.list({
      q: `name='${remotePath}' and '${folderId}' in parents and trashed=false`,
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
    const { Dropbox } = require("dropbox");
    this.dbx = new Dropbox({ accessToken: config.accessToken });
    this.pathPrefix = (config.path || "/BiryaniBackups").replace(/\/?$/, "/");
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    const fileContent = fs.readFileSync(localPath);
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

export async function uploadBackupToCloud(localPath: string, filename: string, storageConfig: CloudStorageConfig): Promise<void> {
  const provider = createCloudProvider(storageConfig);
  await provider.upload(localPath, filename);
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
