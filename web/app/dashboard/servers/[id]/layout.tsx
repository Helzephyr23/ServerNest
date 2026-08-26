"use client";

import { useCallback } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ServerProvider, useServer } from "@/lib/server-context";

const TABS = [
  { href: "", label: "Overview", exact: true },
  { href: "/console", label: "Console" },
  { href: "/files", label: "Files" },
  { href: "/mods", label: "Mods" },
  { href: "/players", label: "Players" },
  { href: "/backups", label: "Backups" },
  { href: "/cloud-storage", label: "Cloud Storage" },
  { href: "/settings", label: "Settings" },
  { href: "/performance", label: "Performance" },
];

function ServerLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const id = params.id as string;
  const { server, loading, refresh } = useServer();

  const handleAction = useCallback(async (action: "start" | "stop" | "restart") => {
    try {
      await api.post(`/api/servers/${id}/${action}`);
    } catch { /* action failed, refresh will show updated state */ }
    refresh();
  }, [id, refresh]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="flex gap-1 border-b">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-20" />
          ))}
        </div>
      </div>
    );
  }

  if (!server) return null;

  const basePath = `/dashboard/servers/${id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2 sm:text-3xl">
            {server.icon && <span>{server.icon}</span>}
            <span className="truncate">{server.name}</span>
          </h1>
          <p className="text-muted-foreground">{server.software} {server.mc_version}</p>
          {server.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{server.description}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
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

      <div className="flex gap-1 overflow-x-auto border-b [-webkit-scrollbar-hide] [scrollbar-width:none]">
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

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ServerProvider>
      <ServerLayoutInner>{children}</ServerLayoutInner>
    </ServerProvider>
  );
}
