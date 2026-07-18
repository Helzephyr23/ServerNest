"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.id as string;
  const { success, error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const [server, setServer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchServer = useCallback(() => {
    api.get(`/api/servers/${id}`)
      .then(({ server }) => setServer(server))
      .catch(() => router.push("/dashboard/servers"))
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => { fetchServer(); }, [fetchServer]);

  useEffect(() => {
    if (server?.status === "starting") {
      const interval = setInterval(fetchServer, 3000);
      return () => clearInterval(interval);
    }
  }, [server?.status, fetchServer]);

  const handleAction = async (action: "start" | "stop" | "restart") => {
    if (action === "start") setServer((s: any) => ({ ...s, status: "starting" }));
    try {
      await api.post(`/api/servers/${id}/${action}`);
      success(`Server ${action}ed`);
    } catch (err: any) {
      toastError(`Failed to ${action} server`, err.message);
    }
    fetchServer();
  };

  const handleDelete = async () => {
    if (!(await showConfirm({ title: "Delete Server", message: `Delete server "${server.name}"? This will remove all data and cannot be undone.` }))) return;
    try {
      await api.delete(`/api/servers/${id}`);
      router.push("/dashboard/servers");
    } catch (err: any) {
      toastError("Failed to delete server", err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!server) return null;

  const tabs = [
    { href: `/dashboard/servers/${id}`, label: "Overview", exact: true },
    { href: `/dashboard/servers/${id}/console`, label: "Console" },
    { href: `/dashboard/servers/${id}/files`, label: "Files" },
    { href: `/dashboard/servers/${id}/mods`, label: "Mods" },
    { href: `/dashboard/servers/${id}/players`, label: "Players" },
    { href: `/dashboard/servers/${id}/backups`, label: "Backups" },
    { href: `/dashboard/servers/${id}/settings`, label: "Settings" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{server.name}</h1>
          <p className="text-muted-foreground">{server.software} {server.mc_version}</p>
        </div>
        <div className="flex gap-2">
          {server.status === "running" || server.status === "error" ? (
            <>
              <Button variant="outline" onClick={() => handleAction("restart")}>Restart</Button>
              <Button variant="destructive" onClick={() => handleAction("stop")}>Stop</Button>
            </>
          ) : server.status === "starting" ? (
            <Button disabled>Starting...</Button>
          ) : (
            <Button onClick={() => handleAction("start")}>Start</Button>
          )}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Status</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${
                server.status === "running" ? "bg-green-500 animate-pulse" :
                server.status === "starting" ? "bg-yellow-500 animate-pulse" :
                server.status === "error" ? "bg-red-500 animate-pulse" :
                "bg-zinc-500"
              }`} />
              <span className={`text-lg font-bold ${
                server.status === "running" ? "text-green-500" :
                server.status === "starting" ? "text-yellow-500" :
                server.status === "error" ? "text-red-500" :
                "text-zinc-400"
              }`}>{server.status}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Port</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{server.port}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Memory</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold">{server.ram_mb >= 1024 ? `${server.ram_mb / 1024} GB` : `${server.ram_mb} MB`}</p></CardContent>
        </Card>
      </div>

      <Card className="border-destructive/50">
        <CardHeader><CardTitle className="text-destructive">Danger Zone</CardTitle></CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDelete}>Delete Server</Button>
        </CardContent>
      </Card>
    </div>
  );
}
