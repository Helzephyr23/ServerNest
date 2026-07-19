"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OverviewData {
  nodes: any[];
  metrics: {
    total_servers: number;
    running_servers: number;
    total_memory_mb: number;
    used_memory_mb: number;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/overview"),
      api.get("/api/servers"),
    ]).then(([overview, serverRes]) => {
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
      setServers(Array.isArray(serverRes?.servers) ? serverRes.servers : []);
    })
    .catch(() => {
        setData({
          nodes: [],
          metrics: {
            total_servers: 0,
            running_servers: 0,
            total_memory_mb: 0,
            used_memory_mb: 0,
          },
        });
      })
    .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const stats = data?.metrics;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to Biryani</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Servers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total_servers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{stats?.running_servers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Memory Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.used_memory_mb || 0} MB</div>
            <p className="text-xs text-muted-foreground">of {stats?.total_memory_mb || 0} MB allocated</p>
            {stats && stats.total_memory_mb > 0 && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min((stats.used_memory_mb / stats.total_memory_mb) * 100, 100)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nodes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data?.nodes?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {data?.nodes?.filter((n: any) => n.status === "online").length || 0} online
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Servers</CardTitle>
        </CardHeader>
        <CardContent>
          {servers.length ? (
            <div className="space-y-3">
              {servers.filter((s) => s.status === "running").map((server) => (
                <Link key={server.id} href={`/dashboard/servers/${server.id}`} className="block rounded-lg border p-3 transition-colors hover:bg-accent">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{server.name}</p>
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-500">Running</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">CPU</p>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${Math.min(server.cpu_percent || 0, 100)}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{Math.round(server.cpu_percent || 0)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">RAM</p>
                      <p className="mt-1 text-sm font-medium">{server.ram_mb || 0} MB</p>
                    </div>
                  </div>
                </Link>
              ))}
              {servers.filter((s) => s.status !== "running").length > 0 && (
                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">
                    {servers.filter((s) => s.status !== "running").length} stopped servers
                  </summary>
                  <div className="mt-2 space-y-1">
                    {servers.filter((s) => s.status !== "running").map((server) => (
                      <Link key={server.id} href={`/dashboard/servers/${server.id}`} className="flex items-center justify-between rounded px-2 py-1 hover:bg-accent">
                        <span>{server.name}</span>
                        <span className={`text-xs ${server.status === "error" ? "text-red-500" : "text-muted-foreground"}`}>{server.status}</span>
                      </Link>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No servers created yet</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nodes</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.nodes?.length ? (
              <div className="space-y-3">
                {data.nodes.map((node: any) => (
                  <div key={node.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{node.name}</p>
                        <p className="text-xs text-muted-foreground">{node.hostname}:{node.port}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        node.status === "online" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                      }`}>
                        {node.status}
                      </span>
                    </div>
                    {node.status === "online" && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">CPU</p>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all"
                              style={{ width: `${Math.min(node.cpu_percent || 0, 100)}%` }}
                            />
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{Math.round(node.cpu_percent || 0)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">RAM</p>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-green-500 transition-all"
                              style={{ width: `${Math.min(node.memory_percent || 0, 100)}%` }}
                            />
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">{Math.round(node.memory_percent || 0)}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No nodes configured</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a href="/dashboard/servers/new" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                <span className="text-xl">➕</span>
                <div>
                  <p className="font-medium">Create Server</p>
                  <p className="text-xs text-muted-foreground">Set up a new Minecraft server</p>
                </div>
              </a>
              <a href="/dashboard/marketplace" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                <span className="text-xl">📦</span>
                <div>
                  <p className="font-medium">Browse Mods</p>
                  <p className="text-xs text-muted-foreground">Find mods and plugins from Modrinth</p>
                </div>
              </a>
              <a href="/dashboard/nodes" className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                <span className="text-xl">🌐</span>
                <div>
                  <p className="font-medium">Add Node</p>
                  <p className="text-xs text-muted-foreground">Connect another machine</p>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
