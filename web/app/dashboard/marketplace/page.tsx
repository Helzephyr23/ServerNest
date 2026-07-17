"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarketplacePage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"mods" | "plugins">("mods");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [servers, setServers] = useState<any[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("");
  const [installingMod, setInstallingMod] = useState<string | null>(null);
  const [versionsModal, setVersionsModal] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [installStatus, setInstallStatus] = useState<string>("");

  useEffect(() => {
    api.get("/api/servers").then(({ servers }) => setServers(servers || []));
  }, []);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const endpoint = type === "mods" ? "/api/mods/search" : "/api/mods/plugins";
      const { mods, plugins } = await api.get(`${endpoint}?q=${encodeURIComponent(query.trim())}`);
      setResults(Array.isArray(mods) ? mods : Array.isArray(plugins) ? plugins : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const openVersions = async (mod: any) => {
    if (!selectedServer) {
      setInstallStatus("Please select a server first");
      return;
    }
    setVersionsModal(mod);
    setLoadingVersions(true);
    setVersions([]);
    try {
      const server = servers.find((s: any) => s.id === Number(selectedServer));
      const params = new URLSearchParams();
      if (server?.mc_version) params.set("version", server.mc_version);
      if (type === "mods" && server?.software) {
        const loader = server.software === "forge" ? "forge" : server.software === "fabric" ? "fabric" : undefined;
        if (loader) params.set("loader", loader);
      }
      const { versions: v } = await api.get(`/api/mods/${mod.slug}/versions?${params}`);
      setVersions(v || []);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const installMod = async (versionId: string) => {
    if (!selectedServer) return;
    setInstallStatus("Installing...");
    try {
      const { filename } = await api.post(`/api/servers/${selectedServer}/mods/install`, { versionId });
      setInstallStatus(`Installed ${filename}`);
      setVersionsModal(null);
      setTimeout(() => setInstallStatus(""), 3000);
    } catch (err: any) {
      setInstallStatus(`Error: ${err.message}`);
      setTimeout(() => setInstallStatus(""), 5000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Marketplace</h1>
        <p className="text-muted-foreground">Browse mods and plugins from Modrinth</p>
      </div>

      {installStatus && (
        <div className={`rounded-md px-4 py-3 text-sm ${installStatus.startsWith("Error") || installStatus === "Please select a server first" ? "bg-destructive/10 text-destructive" : installStatus.startsWith("Installing") ? "bg-yellow-500/10 text-yellow-600" : "bg-green-500/10 text-green-600"}`}>
          {installStatus}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={selectedServer}
          onChange={(e) => setSelectedServer(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Select server to install to</option>
          {servers.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name} ({s.software} {s.mc_version})</option>
          ))}
        </select>
      </div>

      <form onSubmit={search} className="flex gap-2">
        <div className="flex gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setType("mods")}
            className={`rounded-md px-3 py-1 text-sm ${type === "mods" ? "bg-primary text-primary-foreground" : ""}`}
          >
            Mods
          </button>
          <button
            type="button"
            onClick={() => setType("plugins")}
            className={`rounded-md px-3 py-1 text-sm ${type === "plugins" ? "bg-primary text-primary-foreground" : ""}`}
          >
            Plugins
          </button>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mods..."
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : searched && results.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No results found</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((mod) => (
            <Card key={mod.slug} className="flex flex-col">
              <CardHeader className="flex flex-row items-start gap-3 pb-3">
                {mod.icon_url && (
                  <img src={mod.icon_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <CardTitle className="text-base">{mod.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{mod.downloads?.toLocaleString()} downloads</p>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="line-clamp-2 text-sm text-muted-foreground">{mod.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {mod.categories?.slice(0, 3).map((cat: string) => (
                    <span key={cat} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{cat}</span>
                  ))}
                </div>
                <div className="mt-auto pt-3">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => openVersions(mod)}
                    disabled={!selectedServer || installingMod === mod.slug}
                  >
                    {installingMod === mod.slug ? "Installing..." : "Install"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!searched && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-4 text-6xl">📦</span>
          <h2 className="text-xl font-bold">Discover Mods & Plugins</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Search for mods and plugins to enhance your Minecraft server.
            Select a server above, then click Install on any result.
          </p>
        </div>
      )}

      {versionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{versionsModal.title}</h3>
                <p className="text-sm text-muted-foreground">Select a version to install</p>
              </div>
              <button onClick={() => setVersionsModal(null)} className="text-xl text-muted-foreground hover:text-foreground">&times;</button>
            </div>

            {loadingVersions ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : versions.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No compatible versions found</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.version_number} &middot; {v.game_versions?.join(", ")} &middot; {v.loaders?.join(", ")}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => installMod(v.id)}>
                      Install
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
