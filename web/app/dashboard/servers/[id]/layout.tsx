"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const id = params.id as string;
  const { server, loading, refresh } = useServer();

  const handleAction = useCallback(async (action: "start" | "stop" | "restart") => {
    try {
      await api.post(`/api/servers/${id}/${action}`);
    } catch {}
    refresh();
  }, [id, refresh]);

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

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ServerProvider>
      <ServerLayoutInner>{children}</ServerLayoutInner>
    </ServerProvider>
  );
}
