"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ServersPage() {
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServers = () => {
    api.get("/api/servers").then(({ servers }) => setServers(servers)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchServers(); }, []);

  const handleAction = async (id: number, action: "start" | "stop" | "restart") => {
    await api.post(`/api/servers/${id}/${action}`);
    fetchServers();
  };

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Delete server "${name}"? This cannot be undone.`)) {
      await api.delete(`/api/servers/${id}`);
      fetchServers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Servers</h1>
          <p className="text-muted-foreground">Manage your Minecraft servers</p>
        </div>
        <Link href="/dashboard/servers/new">
          <Button>Create Server</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : servers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium">No servers yet</p>
            <p className="mb-4 text-sm text-muted-foreground">Create your first Minecraft server</p>
            <Link href="/dashboard/servers/new"><Button>Create Server</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <Card key={server.id} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{server.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{server.software} {server.mc_version}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                    server.status === "running"
                      ? "bg-green-500/10 text-green-500"
                      : server.status === "starting"
                      ? "bg-yellow-500/10 text-yellow-500"
                      : "bg-zinc-500/10 text-zinc-400"
                  }`}>
                    {server.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 space-y-1 text-sm text-muted-foreground">
                  <p>Port: {server.port}</p>
                  <p>RAM: {server.ram_mb} MB</p>
                  {server.cpu_percent !== null && <p>CPU: {server.cpu_percent}%</p>}
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/servers/${server.id}`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">Manage</Button>
                  </Link>
                  {server.status === "running" ? (
                    <Button variant="outline" size="sm" onClick={() => handleAction(server.id, "stop")}>Stop</Button>
                  ) : (
                    <Button size="sm" onClick={() => handleAction(server.id, "start")}>Start</Button>
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
