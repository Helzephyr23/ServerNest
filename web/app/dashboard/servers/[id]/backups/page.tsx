"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

const CRON_PRESETS = [
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours", value: "0 */12 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 3 AM", value: "0 3 * * *" },
  { label: "Weekly (Sunday)", value: "0 0 * * 0" },
  { label: "Every 3 days", value: "0 0 */3 * *" },
];

const INTERVAL_OPTIONS = [
  { label: "Every 30 minutes", value: 30 },
  { label: "Every 1 hour", value: 60 },
  { label: "Every 6 hours", value: 360 },
  { label: "Every 12 hours", value: 720 },
  { label: "Daily", value: 1440 },
];

export default function BackupsPage() {
  const { success, error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const params = useParams();
  const id = params.id as string;
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const { server: ctxServer } = useServer();

  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [backupInterval, setBackupInterval] = useState(30);
  const [backupRetention, setBackupRetention] = useState(10);
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleName, setScheduleName] = useState("Auto Backup");
  const [scheduleCron, setScheduleCron] = useState("0 3 * * *");
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  const [uploadProgress, setUploadProgress] = useState<Record<number, Record<string, { bytesUploaded: number; totalBytes: number; percentage: number; status: string }>>>({});
  const [preparing, setPreparing] = useState(false);
  const preparingRef = useRef(false);
  const preparingStartedAtRef = useRef<number | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const backupsRef = useRef<any[]>([]);

  const fetchProgress = useCallback(async () => {
    try {
      const data = await api.get(`/api/servers/${id}/backups/progress`) as { uploads: Record<number, Record<string, { bytesUploaded: number; totalBytes: number; percentage: number; status: string }>> };
      const uploads = data.uploads || {};
      setUploadProgress(uploads);
      const hasActive = Object.values(uploads).some((backup) =>
        Object.values(backup).some((u) => u.status === "uploading"),
      );
      return hasActive;
    } catch {
      return false;
    }
  }, [id]);

  const fetchBackups = () => {
    api.get(`/api/servers/${id}/backups`)
      .then(({ backups: b }) => {
        const list = Array.isArray(b) ? b : [];
        setBackups(list);
        backupsRef.current = list;
      })
      .catch(() => { setBackups([]); backupsRef.current = []; })
      .finally(() => setLoading(false));
  };

  const fetchSchedules = () => {
    api.get(`/api/servers/${id}/tasks`)
      .then(({ tasks }) => {
        const backupTasks = Array.isArray(tasks) ? tasks.filter((t: any) => t.type === "backup") : [];
        setSchedules(backupTasks);
      })
      .catch(() => setSchedules([]))
      .finally(() => setLoadingSchedules(false));
  };

  const fetchBackupSettings = () => {
    api.get(`/api/servers/${id}/backup-settings`)
      .then((data: any) => {
        setAutoBackupEnabled(data.auto_backup === 1);
        setBackupInterval(data.backup_interval || 30);
        setBackupRetention(data.backup_retention || 10);
        setLastAutoBackup(data.last_auto_backup || null);
      })
      .catch(() => {});
  };

  useEffect(() => { fetchBackups(); fetchSchedules(); fetchBackupSettings(); }, [id]);
  useEffect(() => { if (ctxServer?.status) fetchBackups(); }, [ctxServer?.status]);

  // On mount/refresh, resume progress polling if any loaded backup still has
  // an in-flight upload. Progress is persisted in the DB, so a page refresh
  // no longer loses live upload progress. Polling self-stops once idle.
  useEffect(() => {
    startProgressPolling();
  }, [id]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put(`/api/servers/${id}/backup-settings`, {
        auto_backup: autoBackupEnabled ? 1 : 0,
        backup_interval: backupInterval,
        backup_retention: backupRetention,
      });
      success("Auto-backup settings saved");
      fetchBackupSettings();
    } catch (err: any) {
      toastError("Failed to save settings", err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const startProgressPolling = useCallback(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    fetchBackups();
    progressTimerRef.current = setInterval(async () => {
      // 1) In-memory live upload progress (only populated once an upload starts)
      const hasLiveUpload = await fetchProgress();
      // 2) DB-backed upload status across the latest backup list (covers the
      //    long tar/checksum window and the period while uploads are still
      //    recorded as 'uploading'/'pending' in the database)
      const hasDbUpload = backupsRef.current.some((b) =>
        Array.isArray(b.uploads) && b.uploads.some((u: any) => u.status === "uploading" || u.status === "pending"),
      );
      if (hasLiveUpload || hasDbUpload) {
        setPreparing(false);
        preparingRef.current = false;
        preparingStartedAtRef.current = null;
      } else if (preparingRef.current && preparingStartedAtRef.current &&
                 Date.now() - preparingStartedAtRef.current > 5 * 60 * 1000) {
        // Safety: if no upload ever materializes (background backup failed),
        // clear the preparing indicator so the UI isn't stuck forever.
        setPreparing(false);
        preparingRef.current = false;
        preparingStartedAtRef.current = null;
      }
      fetchBackups();
      const stillActive = hasLiveUpload || hasDbUpload || preparingRef.current;
      if (!stillActive && progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
        fetchBackups();
      }
    }, 2000);
  }, [fetchProgress, fetchBackups]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.post(`/api/servers/${id}/backups`);
      success("Backup started");
      setPreparing(true);
      preparingRef.current = true;
      preparingStartedAtRef.current = Date.now();
      startProgressPolling();
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

  const handleCreateSchedule = async () => {
    if (!scheduleCron.trim() || !scheduleName.trim()) return;
    setCreatingSchedule(true);
    try {
      await api.post(`/api/servers/${id}/tasks`, {
        name: scheduleName.trim(),
        type: "backup",
        schedule: scheduleCron.trim(),
      });
      success("Schedule created", `Backup will run: ${scheduleCron}`);
      setShowScheduleForm(false);
      setScheduleName("Auto Backup");
      setScheduleCron("0 3 * * *");
      fetchSchedules();
    } catch (err: any) {
      toastError("Failed to create schedule", err.message);
    } finally {
      setCreatingSchedule(false);
    }
  };

  const handleToggleSchedule = async (taskId: number, enabled: boolean) => {
    try {
      await api.put(`/api/tasks/${taskId}`, { enabled });
      success(enabled ? "Schedule enabled" : "Schedule disabled");
      fetchSchedules();
    } catch (err: any) {
      toastError("Failed to update schedule", err.message);
    }
  };

  const handleRunSchedule = async (taskId: number) => {
    try {
      await api.post(`/api/tasks/${taskId}/run`);
      success("Backup started manually");
      setTimeout(fetchBackups, 2000);
    } catch (err: any) {
      toastError("Failed to run backup", err.message);
    }
  };

  const handleDeleteSchedule = async (taskId: number) => {
    if (!(await showConfirm({ title: "Delete Schedule", message: "Remove this scheduled backup?" }))) return;
    try {
      await api.delete(`/api/tasks/${taskId}`);
      fetchSchedules();
    } catch (err: any) {
      toastError("Failed to delete schedule", err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Backups</h2>
        <Button onClick={handleCreate} disabled={creating || ctxServer?.status !== "running"}>
          {creating ? "Creating..." : "Create Backup"}
        </Button>
      </div>

      {ctxServer?.status !== "running" && (
        <div className="rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-500">
          Server must be running to create backups
        </div>
      )}

      {preparing && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-4 py-3 text-sm text-blue-500">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Preparing backup… (compressing &amp; checksumming, upload starts shortly)
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Auto-Backup Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Auto-Backups</p>
              <p className="text-xs text-muted-foreground">
                Automatically back up your server on a schedule
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoBackupEnabled(!autoBackupEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                autoBackupEnabled ? "bg-primary" : "bg-zinc-600"
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                autoBackupEnabled ? "translate-x-4" : "translate-x-0"
              }`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Backup Interval</label>
              <select
                value={backupInterval}
                onChange={(e) => setBackupInterval(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Keep Backups</label>
              <Input
                type="number"
                min={1}
                max={50}
                value={backupRetention}
                onChange={(e) => setBackupRetention(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-muted-foreground">Maximum backups to keep (1-50)</p>
            </div>
          </div>

          {lastAutoBackup && (
            <p className="text-xs text-muted-foreground">
              Last auto-backup: {formatDate(lastAutoBackup)}
            </p>
          )}

          <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔒</span>
              <div>
                <p className="font-medium">Backup on Server Stop</p>
                <p className="text-xs text-muted-foreground">Always creates a backup before stopping</p>
              </div>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Always On</span>
          </div>

          <Button onClick={handleSaveSettings} disabled={savingSettings} size="sm">
            {savingSettings ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Scheduled Backups</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowScheduleForm(!showScheduleForm)}>
              {showScheduleForm ? "Cancel" : "+ Add Schedule"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showScheduleForm && (
            <div className="mb-4 space-y-3 rounded-md border p-4">
              <Input
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                placeholder="Schedule name"
              />
              <Input
                value={scheduleCron}
                onChange={(e) => setScheduleCron(e.target.value)}
                placeholder="Cron expression (e.g. 0 3 * * *)"
              />
              <div className="flex flex-wrap gap-1">
                {CRON_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setScheduleCron(preset.value)}
                    className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                      scheduleCron === preset.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-secondary"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Current: <code className="rounded bg-muted px-1">{scheduleCron}</code>
              </p>
              <Button size="sm" onClick={handleCreateSchedule} disabled={creatingSchedule || !scheduleCron.trim()}>
                {creatingSchedule ? "Creating..." : "Create Schedule"}
              </Button>
            </div>
          )}

          {loadingSchedules ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
            </div>
          ) : schedules.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No scheduled backups. Click &quot;Add Schedule&quot; to set up additional schedules.
            </p>
          ) : (
            <div className="space-y-2">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{schedule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <code className="rounded bg-muted px-1">{schedule.schedule}</code>
                    </p>
                    {schedule.last_run && (
                      <p className="text-xs text-muted-foreground">Last run: {formatDate(schedule.last_run)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRunSchedule(schedule.id)}
                      disabled={!schedule.enabled}
                      title="Run now"
                    >
                      Run
                    </Button>
                    <Button
                      variant={schedule.enabled ? "outline" : "ghost"}
                      size="sm"
                      onClick={() => handleToggleSchedule(schedule.id, !schedule.enabled)}
                    >
                      {schedule.enabled ? "Enabled" : "Disabled"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                      <div className="mt-1 space-y-1">
                        {backup.uploads.map((u: any) => {
                          const prog = uploadProgress[backup.id]?.[u.provider];
                          const isUploading = prog && prog.status === "uploading";
                          const pct = prog?.percentage ?? (u.status === "uploaded" ? 100 : 0);
                          return (
                            <div key={u.id} className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${STATUS_BADGE[u.status] || ""}`}>
                                {PROVIDER_ICONS[u.provider] || "☁️"} {PROVIDER_LABELS[u.provider] || u.provider}
                              </span>
                              {isUploading ? (
                                <div className="flex flex-1 items-center gap-2">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                                    <div
                                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-20 text-right">
                                    {pct}% &middot; {formatBytes(prog.bytesUploaded)} / {formatBytes(prog.totalBytes)}
                                  </span>
                                </div>
                              ) : u.status === "uploaded" ? (
                                <span className="text-xs text-green-500">Done</span>
                              ) : u.status === "failed" ? (
                                <span className="text-xs text-red-500">Failed</span>
                              ) : null}
                            </div>
                          );
                        })}
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
