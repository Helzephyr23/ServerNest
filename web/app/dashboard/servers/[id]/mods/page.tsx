"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";
import { useServer } from "@/lib/server-context";
import { formatBytes } from "@/lib/utils";

export default function ModsPage() {
  const { success, error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const params = useParams();
  const id = params.id as string;
  const { server } = useServer();
  const [mods, setMods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updates, setUpdates] = useState<any[]>([]);
  const [updatingMod, setUpdatingMod] = useState<string | null>(null);

  const fetchMods = async () => {
    try {
      const { mods: m } = await api.get(`/api/servers/${id}/mods`);
      setMods(m || []);
    } catch {
      setMods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMods(); }, [id]);
  useEffect(() => { if (server?.status) fetchMods(); }, [server?.status]);

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    setUpdates([]);
    try {
      const { updates: u } = await api.post(`/api/servers/${id}/mods/check-updates`);
      setUpdates(Array.isArray(u) ? u : []);
      if (!u || u.length === 0) success("All mods are up to date");
    } catch (err: any) {
      toastError("Failed to check updates", err.message);
    }
    setCheckingUpdates(false);
  };

  const handleUpdate = async (mod: any) => {
    setUpdatingMod(mod.filename);
    try {
      const res = await api.post(`/api/servers/${id}/mods/update/${encodeURIComponent(mod.filename)}`);
      success(`Updated "${mod.filename}" to ${res.version}`);
      setUpdates((prev) => prev.filter((u) => u.filename !== mod.filename));
      fetchMods();
    } catch (err: any) {
      toastError("Failed to update", err.message);
    }
    setUpdatingMod(null);
  };

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
          <div className="flex gap-2">
            {updates.length > 0 && (
              <span className="rounded-full bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-500">
                {updates.length} update{updates.length > 1 ? "s" : ""} available
              </span>
            )}
            <Button variant="outline" onClick={handleCheckUpdates} disabled={checkingUpdates}>
              {checkingUpdates ? "Checking..." : "Check Updates"}
            </Button>
            <Link href="/dashboard/marketplace">
              <Button>Browse Marketplace</Button>
            </Link>
          </div>
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
              {mods.map((mod) => {
                const update = updates.find((u) => u.filename === mod.filename);
                return (
                  <div key={mod.filename} className="flex items-center justify-between px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{mod.filename}</p>
                        {update && (
                          <span className="shrink-0 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-500">
                            Update available
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{formatBytes(mod.size)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {update && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdate(update)}
                          disabled={updatingMod === mod.filename}
                        >
                          {updatingMod === mod.filename ? "..." : "Update"}
                        </Button>
                      )}
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
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
