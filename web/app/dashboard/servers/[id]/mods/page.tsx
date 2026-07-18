"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function ModsPage() {
  const { error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const params = useParams();
  const id = params.id as string;
  const [server, setServer] = useState<any>(null);
  const [mods, setMods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchMods = async () => {
    try {
      const [{ server: s }, { mods: m }] = await Promise.all([
        api.get(`/api/servers/${id}`),
        api.get(`/api/servers/${id}/mods`),
      ]);
      setServer(s);
      setMods(m || []);
    } catch {
      setMods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMods(); }, [id]);

  const handleDelete = async (filename: string) => {
    if (!(await showConfirm({ title: "Delete Mod", message: `Delete ${filename}?` }))) return;
    setDeleting(filename);
    try {
      await api.delete(`/api/servers/${id}/mods/${encodeURIComponent(filename)}`);
      setMods((prev) => prev.filter((m) => m.filename !== filename));
    } catch (err: any) {
      toastError("Failed to delete", err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Installed Mods</h2>
          <p className="text-sm text-muted-foreground">
            {mods.length} {mods.length === 1 ? "mod" : "mods"} installed
          </p>
        </div>
        <Link href="/dashboard/marketplace">
          <Button>Browse Marketplace</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {server?.software === "vanilla" ? (
            <div className="flex flex-col items-center justify-center py-12">
              <span className="mb-2 text-4xl">📦</span>
              <p className="text-muted-foreground">Vanilla servers don&apos;t support mods/plugins</p>
              <p className="text-xs text-muted-foreground">Create a server with Paper, Spigot, Forge, or Fabric</p>
            </div>
          ) : mods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <span className="mb-2 text-4xl">🧩</span>
              <p className="text-muted-foreground">No mods installed yet</p>
              <Link href="/dashboard/marketplace">
                <Button variant="link" className="mt-1">Browse Marketplace</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {mods.map((mod) => (
                <div key={mod.filename} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{mod.filename}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(mod.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(mod.filename)}
                    disabled={deleting === mod.filename}
                  >
                    {deleting === mod.filename ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
