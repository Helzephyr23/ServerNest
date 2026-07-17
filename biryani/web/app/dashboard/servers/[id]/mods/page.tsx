"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function ModsPage() {
  const params = useParams();
  const id = params.id as string;
  const [server, setServer] = useState<any>(null);
  const [config, setConfig] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.get(`/api/servers/${id}`),
      api.get(`/api/servers/${id}/config`),
    ]).then(([{ server: s }, { config: c }]) => {
      setServer(s);
      setConfig(c);
    });
  }, [id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Mods & Plugins</h2>
        <Link href="/dashboard/marketplace">
          <Button variant="outline">Browse Marketplace</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="py-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <span className="text-2xl">🧩</span>
              <div className="flex-1">
                <p className="font-medium">Server Software</p>
                <p className="text-sm text-muted-foreground">
                  {server?.software || "vanilla"} {server?.mc_version}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {(server?.software === "paper" || server?.software === "spigot" || server?.software === "purpur")
                  ? "Plugins Supported"
                  : (server?.software === "forge" || server?.software === "fabric")
                  ? "Mods Supported"
                  : "Vanilla (No Plugins/Mods)"}
              </span>
            </div>

            {server?.software === "vanilla" ? (
              <div className="flex flex-col items-center justify-center py-8">
                <span className="mb-2 text-4xl">📦</span>
                <p className="text-muted-foreground">Vanilla servers don&apos;t support mods/plugins</p>
                <p className="text-xs text-muted-foreground">Create a new server with Paper, Spigot, Forge, or Fabric</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <span className="mb-2 text-4xl">📦</span>
                <p className="text-muted-foreground">Mod/plugin management coming soon</p>
                <p className="text-xs text-muted-foreground">For now, upload mods to the server files directly</p>
                <Link href={`/dashboard/servers/${id}/files`}>
                  <Button variant="link" className="mt-2">Open File Manager</Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
