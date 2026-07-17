"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatDate } from "@/lib/utils";

export default function BackupsPage() {
  const params = useParams();
  const id = params.id as string;
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [server, setServer] = useState<any>(null);

  const fetchBackups = () => {
    Promise.all([
      api.get(`/api/servers/${id}/backups`),
      api.get(`/api/servers/${id}`),
    ]).then(([{ backups: b }, { server: s }]) => {
      setBackups(b);
      setServer(s);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchBackups(); }, [id]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.post(`/api/servers/${id}/backups`);
      fetchBackups();
    } catch (err: any) {
      alert(err.message || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (backupId: number) => {
    if (!confirm("Restore this backup? The server will restart.")) return;
    try {
      await api.post(`/api/servers/${id}/backups/${backupId}/restore`);
      alert("Backup restored! Server is restarting.");
    } catch (err: any) {
      alert(err.message || "Failed to restore backup");
    }
  };

  const handleDelete = async (backupId: number) => {
    if (!confirm("Delete this backup permanently?")) return;
    try {
      await api.delete(`/api/backups/${backupId}`);
      fetchBackups();
    } catch (err: any) {
      alert(err.message || "Failed to delete backup");
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
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
          {backups.map((backup) => (
            <Card key={backup.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <p className="font-medium">{backup.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(backup.size)} &middot; {formatDate(backup.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleRestore(backup.id)}>Restore</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(backup.id)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
