"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/confirm-dialog";
import { useToast } from "@/components/toast";
import {
  Server,
  Plus,
  Upload,
  Search,
  Play,
  Square,
  Trash2,
  ExternalLink,
} from "lucide-react";

type StatusFilter = "all" | "running" | "stopped" | "starting" | "error";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Instances" },
  { value: "running", label: "Running" },
  { value: "stopped", label: "Stopped" },
  { value: "starting", label: "Starting" },
  { value: "error", label: "Error" },
];

export default function ServersPage() {
  const { confirm: showConfirm } = useConfirm();
  const { error: toastError } = useToast();
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [updateCounts, setUpdateCounts] = useState<Record<number, number>>({});
  const [actionInProgress, setActionInProgress] = useState<Record<number, boolean>>({});

  const fetchServers = () => {
    api.get("/api/servers")
      .then(async ({ servers }) => {
        const list = Array.isArray(servers) ? servers : [];
        setServers(list);
        const counts: Record<number, number> = {};
        await Promise.all(
          list.map(async (s: any) => {
            try {
              const { count } = await api.get(`/api/servers/${s.id}/mods/update-count`);
              if (count > 0) counts[s.id] = count;
            } catch {}
          })
        );
        setUpdateCounts(counts);
      })
      .catch(() => setServers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const filtered = useMemo(() => {
    let result = servers;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.software?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }
    return [...result].sort((a, b) => {
      if (a.status === "running" && b.status !== "running") return -1;
      if (a.status !== "running" && b.status === "running") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [servers, search, statusFilter]);

  const handleAction = async (id: number, action: "start" | "stop" | "restart") => {
    setActionInProgress((prev) => ({ ...prev, [id]: true }));
    try {
      await api.post(`/api/servers/${id}/${action}`);
      fetchServers();
    } catch (err: any) {
      toastError("Action failed", err.message);
    } finally {
      setActionInProgress((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (
      !(await showConfirm({
        title: "Delete Server Instance",
        message: `Permanently delete server "${name}" and container resources? This cannot be undone.`,
      }))
    )
      return;
    try {
      await api.delete(`/api/servers/${id}`);
      fetchServers();
    } catch (err: any) {
      toastError("Delete failed", err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Server Instances
            </h1>
            <span className="rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-xs font-mono text-muted-foreground">
              {servers.length} configured
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            Provisioned on Docker engine via itzg/minecraft-server
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/servers/import">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-border/80 text-muted-foreground hover:text-foreground"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import Archive</span>
            </Button>
          </Link>
          <Link href="/dashboard/servers/new">
            <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold shadow-[0_0_12px_rgba(22,224,136,0.25)]">
              <Plus className="h-3.5 w-3.5" />
              <span>Deploy Server</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      {!loading && servers.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/70" />
            <Input
              placeholder="Filter by name, software..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-xs bg-card/60 border-border/80"
            />
          </div>
          {/* Segmented Filter Control */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-card/40 p-1">
            {STATUS_OPTIONS.map((opt) => {
              const active = statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-mono font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Server Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5 border-border/80 bg-card/60">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-10 w-full rounded" />
                <Skeleton className="h-8 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : servers.length === 0 ? (
        <Card className="border-dashed border-border/80 bg-card/30 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Server className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">No servers created yet</h3>
          <p className="mt-1 text-xs text-muted-foreground font-mono max-w-sm mx-auto">
            Spin up a high-performance Paper, Fabric, Forge, or Vanilla server container in seconds.
          </p>
          <div className="mt-5">
            <Link href="/dashboard/servers/new">
              <Button size="sm" className="gap-1.5 text-xs font-semibold shadow-[0_0_12px_rgba(22,224,136,0.25)]">
                <Plus className="h-3.5 w-3.5" />
                <span>Deploy Server</span>
              </Button>
            </Link>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-border/60 bg-card/30 p-8 text-center">
          <p className="text-sm font-medium text-foreground">No servers match filter criteria</p>
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            Clear search term or change status selector
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((server) => {
            const isRunning = server.status === "running";
            const isStarting = server.status === "starting";
            const isError = server.status === "error";
            const inProgress = actionInProgress[server.id];

            return (
              <Card
                key={server.id}
                className="group relative flex flex-col justify-between overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-card/90 hover:shadow-[0_4px_24px_-4px_rgba(22,224,136,0.12)]"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 truncate">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition-transform">
                        <Server className="h-5 w-5" />
                      </div>
                      <div className="truncate">
                        <CardTitle className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {server.name}
                        </CardTitle>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          {server.software} · {server.mc_version}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div
                        className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-mono font-medium ${
                          isRunning
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : isStarting
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                            : isError
                            ? "border-red-500/30 bg-red-500/10 text-red-400"
                            : "border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
                        }`}
                      >
                        {isRunning && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </span>
                        )}
                        <span className="capitalize">{server.status}</span>
                      </div>
                      {updateCounts[server.id] > 0 && (
                        <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 text-[9px] font-mono font-medium text-amber-400">
                          +{updateCounts[server.id]} updates
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-1 space-y-4">
                  {server.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{server.description}</p>
                  )}

                  {/* Telemetry Metrics */}
                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/50 bg-background/50 p-2.5 text-center text-xs font-mono">
                    <div>
                      <span className="block text-[10px] uppercase text-muted-foreground/70">Port</span>
                      <span className="font-semibold text-foreground tabular-nums">{server.port}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-muted-foreground/70">RAM</span>
                      <span className="font-semibold text-foreground tabular-nums">{server.ram_mb} MB</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-muted-foreground/70">CPU</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {server.cpu_percent !== null ? `${Math.round(server.cpu_percent)}%` : "0%"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <Link href={`/dashboard/servers/${server.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs border-border/80 hover:border-primary/50 hover:text-primary gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Manage</span>
                      </Button>
                    </Link>

                    {isRunning ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={inProgress}
                        onClick={() => handleAction(server.id, "stop")}
                        className="w-full h-8 text-xs border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 gap-1"
                      >
                        <Square className="h-3 w-3 fill-current" />
                        <span>Stop</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={inProgress}
                        onClick={() => handleAction(server.id, "start")}
                        className="w-full h-8 text-xs font-semibold gap-1 shadow-[0_0_8px_rgba(22,224,136,0.2)]"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>Start</span>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(server.id, server.name)}
                      className="w-full h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </Button>
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
