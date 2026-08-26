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

type StatusFilter = "all" | "running" | "stopped" | "starting" | "error";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
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

  useEffect(() => { fetchServers(); }, []);

  const filtered = useMemo(() => {
    let result = servers;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || s.software?.toLowerCase().includes(q));
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
    try {
      await api.post(`/api/servers/${id}/${action}`);
      fetchServers();
    } catch (err: any) {
      toastError("Action failed", err.message);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!(await showConfirm({ title: "Delete Server", message: `Delete server "${name}"? This cannot be undone.` }))) return;
    try {
      await api.delete(`/api/servers/${id}`);
      fetchServers();
    } catch (err: any) {
      toastError("Delete failed", err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Servers</h1>
          <p className="text-muted-foreground">Manage your Minecraft servers</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/servers/import">
            <Button variant="outline">Import Server</Button>
          </Link>
          <Link href="/dashboard/servers/new">
            <Button>Create Server</Button>
          </Link>
        </div>
      </div>

      {!loading && servers.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={statusFilter === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : servers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium">No servers yet</p>
            <p className="mb-4 text-sm text-muted-foreground">Create your first Minecraft server</p>
            <Link href="/dashboard/servers/new"><Button>Create Server</Button></Link>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium">No servers match your filter</p>
            <p className="text-sm text-muted-foreground">Try adjusting your search or filter</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((server) => (
            <Card key={server.id} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {server.icon && <span className="text-2xl">{server.icon}</span>}
                    <div>
                      <CardTitle className="text-lg">{server.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{server.software} {server.mc_version}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                    server.status === "running"
                      ? "bg-green-500/10 text-green-500"
                      : server.status === "starting"
                      ? "bg-yellow-500/10 text-yellow-500"
                      : server.status === "error"
                      ? "bg-red-500/10 text-red-500"
                      : "bg-zinc-500/10 text-zinc-400"
                  }`}>
                    {server.status}
                  </span>
                  {updateCounts[server.id] > 0 && (
                    <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-500">
                      {updateCounts[server.id]} update{updateCounts[server.id] > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {server.description && (
                  <p className="mb-2 text-sm text-muted-foreground line-clamp-2">{server.description}</p>
                )}
                <div className="mb-4 space-y-1 text-sm text-muted-foreground">
                  <p>Port: {server.port}</p>
                  <p>RAM: {server.ram_mb} MB</p>
                  <p>CPU: {server.cpu_percent !== null ? `${server.cpu_percent}%` : "N/A"}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Link href={`/dashboard/servers/${server.id}`}>
                    <Button variant="outline" className="w-full" size="sm">Manage</Button>
                  </Link>
                  <Button variant="destructive" size="sm" className="w-full" onClick={() => handleDelete(server.id, server.name)}>Delete</Button>
                  {server.status === "running" ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleAction(server.id, "stop")}>Stop</Button>
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => handleAction(server.id, "start")}>Start</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
