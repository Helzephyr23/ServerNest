"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, formatDate } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";
import { useServer } from "@/lib/server-context";

const PROVIDER_ICONS: Record<string, string> = {
  s3: "☁️",
  gdrive: "📂",
  dropbox: "📦",
};

const PROVIDER_LABELS: Record<string, string> = {
  s3: "S3",
  gdrive: "Drive",
  dropbox: "Dropbox",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  uploading: "bg-blue-500/10 text-blue-500",
  uploaded: "bg-green-500/10 text-green-500",
  failed: "bg-red-500/10 text-red-500",
};

export default function BackupsPage() {
  const { success, error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const params = useParams();
  const id = params.id as string;
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const { server } = useServer();

  const fetchBackups = () => {
    api.get(`/api/servers/${id}/backups`)
      .then(({ backups: b }) => setBackups(Array.isArray(b) ? b : []))
      .catch(() => setBackups([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBackups(); }, [id]);
  useEffect(() => { if (server?.status) fetchBackups(); }, [server?.status]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.post(`/api/servers/${id}/backups`);
      success("Backup created! Cloud upload starting...");
      setTimeout(fetchBackups, 2000);
    } catch (err: any) {
      toastError("Failed to create backup", err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (backupId: number) => {
    if (!(await showConfirm({ title: "Restore Backup", message: "Restore this backup? The server will restart." }))) return;
    try {
      await api.post(`/api/servers/${id}/backups/${backupId}/restore`);
      success("Backup restored! Server is restarting.");
    } catch (err: any) {
      toastError("Failed to restore backup", err.message);
    }
  };

  const handleDelete = async (backupId: number) => {
    if (!(await showConfirm({ title: "Delete Backup", message: "Delete this backup permanently?" }))) return;
    try {
      await api.delete(`/api/backups/${backupId}`);
      fetchBackups();
    } catch (err: any) {
      toastError("Failed to delete backup", err.message);
    }
  };

  const handleDownload = async (backupId: number) => {
    setDownloading(backupId);
    try {
      const res = await fetch(`/api/servers/${id}/backups/${backupId}/download`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backups.find((b) => b.id === backupId)?.filename || "backup.tar.gz";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toastError("Download failed", err.message);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Backups</h2>
        <Button onClick={handleCreate} disabled={creating || server?.status !== "running"}>
          {creating ? "Creating..." : "Create Backup"}
        </Button>
      </div>

      {server?.status !== "running" && (
        <div className="rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-500">
          Server must be running to create backups
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <div className="flex gap-2 shrink-0 ml-4">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : backups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="mb-2 text-4xl">💾</span>
            <p className="text-muted-foreground">No backups yet</p>
            <p className="text-xs text-muted-foreground">Create a backup to save your world</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {backups.map((backup) => {
            return (
              <Card key={backup.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{backup.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(backup.size)} &middot; {formatDate(backup.created_at)}
                      {backup.checksum && (
                        <span title={`SHA256: ${backup.checksum}`} className="ml-2 cursor-help underline decoration-dotted">
                          verified
                        </span>
                      )}
                    </p>
                    {backup.uploads?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {backup.uploads.map((u: any) => (
                          <span
                            key={u.id}
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${STATUS_BADGE[u.status] || ""}`}
                          >
                            {PROVIDER_ICONS[u.provider] || "☁️"} {PROVIDER_LABELS[u.provider] || u.provider}
                            {u.status === "uploaded" ? " ✓" : u.status === "uploading" ? " ↻" : u.status === "failed" ? " ✗" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(backup.id)} disabled={downloading === backup.id}>
                      {downloading === backup.id ? "..." : "Download"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleRestore(backup.id)}>Restore</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(backup.id)}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
