"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    api.get("/api/overview")
      .then((response: any) => {
        const safeData: OverviewData = {
          nodes: Array.isArray(response?.nodes) ? response.nodes : [],
          metrics: response?.metrics || {
            total_servers: 0,
            running_servers: 0,
            total_memory_mb: 0,
            used_memory_mb: 0,
          },
        };
        setData(safeData);
      })
      .catch((err) => {
        console.error(err);
        setData({
          nodes: [],
          metrics: {
            total_servers: 0,
            running_servers: 0,
            total_memory_mb: 0,
            used_memory_mb: 0,
          },
        });
      });
  }, []);

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
