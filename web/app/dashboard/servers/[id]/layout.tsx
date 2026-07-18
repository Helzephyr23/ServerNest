"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const TABS = [
  { href: "", label: "Overview", exact: true },
  { href: "/console", label: "Console" },
  { href: "/files", label: "Files" },
  { href: "/mods", label: "Mods" },
  { href: "/players", label: "Players" },
  { href: "/backups", label: "Backups" },
  { href: "/settings", label: "Settings" },
];

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.id as string;
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
    } catch {}
    fetchServer();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!server) return null;

  const basePath = `/dashboard/servers/${id}`;

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
        {TABS.map((tab) => {
          const href = basePath + tab.href;
          const isActive = tab.exact
            ? pathname === href
            : pathname.startsWith(href);
          return (
            <Link
              key={tab.href}
              href={href}
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

      {children}
    </div>
  );
}
