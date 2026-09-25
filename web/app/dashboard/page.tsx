"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Server,
  Activity,
  Cpu,
  Network,
  Plus,
  ArrowUpRight,
  Layers,
  ShoppingBag,
  Terminal,
  RefreshCw,
} from "lucide-react";

interface NodeData {
  id: number | string;
  name: string;
  hostname: string;
  port: number;
  status: "online" | "offline" | string;
  cpu_percent?: number;
  memory_percent?: number;
}

interface ServerData {
  id: number;
  name: string;
  software: string;
  mc_version: string;
  port: number;
  status: "running" | "stopped" | "starting" | "error" | string;
  ram_mb: number;
  cpu_percent: number | null;
  description?: string;
  icon?: string;
}

interface OverviewData {
  nodes: NodeData[];
  metrics: {
    total_servers: number;
    running_servers: number;
    total_memory_mb: number;
    used_memory_mb: number;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updateCounts, setUpdateCounts] = useState<Record<number, number>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDashboard = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [overview, serverRes] = await Promise.all([
        api.get("/api/overview"),
        api.get("/api/servers"),
      ]);
      const safeData: OverviewData = {
        nodes: Array.isArray(overview?.nodes) ? overview.nodes : [],
        metrics: overview?.metrics || {
          total_servers: 0,
          running_servers: 0,
          total_memory_mb: 0,
          used_memory_mb: 0,
        },
      };
      setData(safeData);
      const list = Array.isArray(serverRes?.servers) ? serverRes.servers : [];
      setServers(list);
      const counts: Record<number, number> = {};
      await Promise.all(
        list.map(async (s: ServerData) => {
          try {
            const { count } = await api.get(`/api/servers/${s.id}/mods/update-count`);
            if (count > 0) counts[s.id] = count;
          } catch {}
        })
      );
      setUpdateCounts(counts);
      setLastUpdated(new Date());
    } catch {
      setData({
        nodes: [],
        metrics: { total_servers: 0, running_servers: 0, total_memory_mb: 0, used_memory_mb: 0 },
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => fetchDashboard(false), 30_000);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        fetchDashboard(false);
        startPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5 border-border/80 bg-card/60">
              <Skeleton className="h-4 w-28 mb-3" />
              <Skeleton className="h-8 w-20" />
            </Card>
          ))}
        </div>
        <Card className="border-border/80 bg-card/60 p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const stats = data?.metrics;
  const memoryPercent =
    stats && stats.total_memory_mb > 0
      ? Math.min((stats.used_memory_mb / stats.total_memory_mb) * 100, 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Overview Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-medium text-primary">
              Control Plane v1.0
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Telemetry Connected</span>
            </span>
            {lastUpdated && (
              <>
                <span>·</span>
                <span>Synced {lastUpdated.toLocaleTimeString()}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            className="h-8 gap-1.5 text-xs text-muted-foreground border-border/80 hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
            <span>Refresh</span>
          </Button>
          <Link href="/dashboard/servers/new">
            <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold shadow-[0_0_12px_rgba(22,224,136,0.25)]">
              <Plus className="h-3.5 w-3.5" />
              <span>Create Server</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Telemetry Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Servers */}
        <Card className="relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm transition-all hover:border-border">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                Total Servers
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Server className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono tracking-tight text-foreground tabular-nums">
                {stats?.total_servers || 0}
              </span>
              <span className="text-xs text-muted-foreground font-mono">instances</span>
            </div>
            <div className="mt-3 flex items-center text-xs text-muted-foreground font-mono">
              <span className="text-primary font-medium">{stats?.running_servers || 0} active</span>
              <span className="mx-1.5">·</span>
              <span>{(stats?.total_servers || 0) - (stats?.running_servers || 0)} idle</span>
            </div>
          </div>
        </Card>

        {/* Running Servers */}
        <Card className="relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm transition-all hover:border-border">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                Active State
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono tracking-tight text-emerald-400 tabular-nums">
                {stats?.running_servers || 0}
              </span>
              <span className="text-xs text-muted-foreground font-mono">running</span>
            </div>
            <div className="mt-3 flex items-center text-xs text-muted-foreground font-mono">
              <span className="relative flex h-1.5 w-1.5 mr-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span>Port map 25565-25665</span>
            </div>
          </div>
        </Card>

        {/* RAM Usage */}
        <Card className="relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm transition-all hover:border-border">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                Memory In Use
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Cpu className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono tracking-tight text-foreground tabular-nums">
                {stats?.used_memory_mb || 0}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                / {stats?.total_memory_mb || 0} MB
              </span>
            </div>
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                  style={{ width: `${memoryPercent}%` }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Node Infrastructure */}
        <Card className="relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-sm transition-all hover:border-border">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                Agent Nodes
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Network className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono tracking-tight text-foreground tabular-nums">
                {data?.nodes?.length || 0}
              </span>
              <span className="text-xs text-muted-foreground font-mono">clusters</span>
            </div>
            <div className="mt-3 flex items-center text-xs text-muted-foreground font-mono">
              <span className="text-cyan-400 font-medium">
                {data?.nodes?.filter((n) => n.status === "online").length || 0} online
              </span>
              <span className="mx-1.5">·</span>
              <span>Port 50051</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Servers Management Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Managed Servers
            </h2>
            <span className="text-xs font-mono text-muted-foreground">
              ({servers.length})
            </span>
          </div>
          <Link
            href="/dashboard/servers"
            className="flex items-center gap-1 text-xs font-mono text-muted-foreground transition-colors hover:text-primary"
          >
            <span>View All</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {servers.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(() => {
              const sorted = [...servers].sort((a, b) => {
                if (a.status === "running" && b.status !== "running") return -1;
                if (a.status !== "running" && b.status === "running") return 1;
                return a.name.localeCompare(b.name);
              });
              const visible = sorted.slice(0, 6);
              return (
                <>
                  {visible.map((server) => {
                    const isRunning = server.status === "running";
                    const isStarting = server.status === "starting";
                    const isError = server.status === "error";

                    return (
                      <Link key={server.id} href={`/dashboard/servers/${server.id}`} className="group block">
                        <Card className="h-full border-border/80 bg-card/60 backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-card/90 hover:shadow-[0_4px_20px_-4px_rgba(22,224,136,0.12)]">
                          <CardHeader className="p-4 pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 truncate">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition-transform">
                                  <Server className="h-4 w-4" />
                                </div>
                                <div className="truncate">
                                  <CardTitle className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                    {server.name}
                                  </CardTitle>
                                  <p className="text-[11px] font-mono text-muted-foreground">
                                    {server.software} · {server.mc_version}
                                  </p>
                                </div>
                              </div>

                              {/* Status Indicator */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {updateCounts[server.id] > 0 && (
                                  <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-mono font-medium text-amber-400">
                                    +{updateCounts[server.id]} mods
                                  </span>
                                )}
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
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="p-4 pt-1">
                            {server.description && (
                              <p className="mb-3 text-xs text-muted-foreground line-clamp-1">
                                {server.description}
                              </p>
                            )}
                            <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/50 bg-background/50 p-2 text-center text-xs font-mono">
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
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </>
              );
            })()}
          </div>
        ) : (
          <Card className="border-border/80 border-dashed bg-card/40 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Server className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">No servers configured</h3>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              Deploy your first containerized Minecraft instance in seconds.
            </p>
            <div className="mt-4">
              <Link href="/dashboard/servers/new">
                <Button size="sm" className="gap-1.5 text-xs font-semibold shadow-[0_0_12px_rgba(22,224,136,0.2)]">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Server</span>
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>

      {/* Nodes & Control Plane Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Nodes Health */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="p-4 pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-cyan-400" />
                <CardTitle className="text-sm font-semibold">Cluster Nodes</CardTitle>
              </div>
              <Link href="/dashboard/nodes" className="text-xs font-mono text-muted-foreground hover:text-primary">
                Manage Nodes →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {data?.nodes?.length ? (
              <div className="space-y-3">
                {data.nodes.map((node) => (
                  <div key={node.id} className="rounded-lg border border-border/60 bg-background/50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{node.name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          {node.hostname}:{node.port}
                        </p>
                      </div>
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] font-mono font-medium ${
                          node.status === "online"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-red-500/30 bg-red-500/10 text-red-400"
                        }`}
                      >
                        {node.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-border/40 bg-background/30 p-4 text-center">
                <p className="text-xs text-muted-foreground font-mono">
                  Running on default local node (:3001)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Launch & Actions */}
        <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="p-4 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            <Link
              href="/dashboard/servers/new"
              className="group flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-3 transition-colors hover:border-primary/40 hover:bg-card/80"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    Deploy New Server
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Paper, Fabric, Purpur, Forge or Vanilla
                  </p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>

            <Link
              href="/dashboard/marketplace"
              className="group flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-3 transition-colors hover:border-primary/40 hover:bg-card/80"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground group-hover:text-cyan-400 transition-colors">
                    Modrinth Marketplace
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Install mods, plugins and datapacks in 1-click
                  </p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
            </Link>

            <Link
              href="/dashboard/templates"
              className="group flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-3 transition-colors hover:border-primary/40 hover:bg-card/80"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground group-hover:text-amber-400 transition-colors">
                    Server Templates
                  </p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Save and replicate server configuration profiles
                  </p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-400 transition-colors" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
