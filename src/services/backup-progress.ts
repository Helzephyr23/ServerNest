interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  provider: string;
  serverId: number;
  status: "uploading" | "uploaded" | "failed";
}

const progressStore = new Map<string, UploadProgress>();

function makeKey(backupId: number, provider: string): string {
  return `${backupId}:${provider}`;
}

export function setUploadProgress(
  backupId: number,
  provider: string,
  serverId: number,
  bytesUploaded: number,
  totalBytes: number,
): void {
  const key = makeKey(backupId, provider);
  progressStore.set(key, {
    bytesUploaded,
    totalBytes,
    provider,
    serverId,
    status: "uploading",
  });
}

export function completeUpload(backupId: number, provider: string, status: "uploaded" | "failed"): void {
  const key = makeKey(backupId, provider);
  const existing = progressStore.get(key);
  if (existing) {
    existing.status = status;
    if (status === "uploaded") existing.bytesUploaded = existing.totalBytes;
  } else {
    progressStore.delete(key);
  }
}

export function getServerUploadProgress(serverId: number): Record<number, Record<string, { bytesUploaded: number; totalBytes: number; percentage: number; status: string }>> {
  const result: Record<number, Record<string, { bytesUploaded: number; totalBytes: number; percentage: number; status: string }>> = {};

  for (const [, entry] of progressStore) {
    if (entry.serverId !== serverId) continue;
  }

  for (const [key, entry] of progressStore) {
    if (entry.serverId !== serverId) continue;
    const [backupIdStr] = key.split(":");
    const backupId = Number(backupIdStr);
    if (!result[backupId]) result[backupId] = {};
    result[backupId][entry.provider] = {
      bytesUploaded: entry.bytesUploaded,
      totalBytes: entry.totalBytes,
      percentage: entry.totalBytes > 0 ? Math.round((entry.bytesUploaded / entry.totalBytes) * 100) : 0,
      status: entry.status,
    };
  }

  return result;
}

export function clearUploadProgress(backupId: number, provider: string): void {
  progressStore.delete(makeKey(backupId, provider));
}
