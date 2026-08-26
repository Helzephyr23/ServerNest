"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketplacePage() {
  const { success, error: toastError, warning } = useToast();
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
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [batchInstalling, setBatchInstalling] = useState(false);

  useEffect(() => {
    api.get("/api/servers").then(({ servers }) => setServers(servers || []));
  }, []);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelectedMods(new Set());
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

  const toggleMod = (slug: string) => {
    setSelectedMods((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const openVersions = async (mod: any) => {
    if (!selectedServer) {
      warning("No server selected", "Please select a server before installing");
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

  const installMod = async (versionId: string, modTitle?: string) => {
    if (!selectedServer) return;
    setInstallingMod(versionsModal?.slug || null);
    try {
      const { filename } = await api.post(`/api/servers/${selectedServer}/mods/install`, { versionId });
      success(`Installed ${modTitle || filename}`, `${filename} added to server`);
      setVersionsModal(null);
    } catch (err: any) {
      toastError(`Failed to install ${modTitle || "mod"}`, err.message);
    }
    setInstallingMod(null);
  };

  const batchInstall = async () => {
    if (!selectedServer) {
      warning("No server selected", "Please select a server first");
      return;
    }
    if (selectedMods.size === 0) return;
    setBatchInstalling(true);

    const server = servers.find((s: any) => s.id === Number(selectedServer));
    const versionIds: { slug: string; versionId: string }[] = [];

    for (const slug of selectedMods) {
      try {
        const params = new URLSearchParams();
        if (server?.mc_version) params.set("version", server.mc_version);
        if (type === "mods" && server?.software) {
          const loader = server.software === "forge" ? "forge" : server.software === "fabric" ? "fabric" : undefined;
          if (loader) params.set("loader", loader);
        }
        const { versions: v } = await api.get(`/api/mods/${slug}/versions?${params}`);
        if (v && v.length > 0) {
          versionIds.push({ slug, versionId: v[0].id });
        }
      } catch { /* skip failed version fetch */ }
    }

    if (versionIds.length === 0) {
      warning("No compatible versions", "No compatible versions found for selected mods");
      setBatchInstalling(false);
      return;
    }

    try {
      const { results } = await api.post(`/api/servers/${selectedServer}/mods/install-batch`, {
        versionIds: versionIds.map((v) => v.versionId),
      });
      const succeeded = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success).length;
      success(`Installed ${succeeded} mod(s)`, failed ? `${failed} failed to install` : undefined);
      setSelectedMods(new Set());
    } catch (err: any) {
      toastError("Batch install failed", err.message);
    } finally {
      setBatchInstalling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Marketplace</h1>
        <p className="text-muted-foreground">Browse mods and plugins from Modrinth</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={selectedServer}
          onChange={(e) => setSelectedServer(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Select server to install to</option>
          {servers.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name} ({s.software} {s.mc_version})</option>
          ))}
        </select>
      </div>

      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <div className="flex gap-1 rounded-lg border p-1 shrink-0">
          <button
            type="button"
            onClick={() => { setType("mods"); setSelectedMods(new Set()); }}
            className={`rounded-md px-3 py-1.5 text-sm ${type === "mods" ? "bg-primary text-primary-foreground" : ""}`}
          >
            Mods
          </button>
          <button
            type="button"
            onClick={() => { setType("plugins"); setSelectedMods(new Set()); }}
            className={`rounded-md px-3 py-1.5 text-sm ${type === "plugins" ? "bg-primary text-primary-foreground" : ""}`}
          >
            Plugins
          </button>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mods..."
          className="flex-1 min-w-0"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </form>

      {selectedMods.size > 0 && results.length > 0 && (
        <div className="sticky top-0 z-10 -mx-6 flex items-center justify-between border-b bg-background/95 px-6 py-3 backdrop-blur">
          <p className="text-sm font-medium">{selectedMods.size} selected</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedMods(new Set())}>Clear</Button>
            <Button size="sm" onClick={batchInstall} disabled={batchInstalling || !selectedServer}>
              {batchInstalling ? "Installing..." : `Install Selected (${selectedMods.size})`}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader className="flex flex-row items-start gap-3 pb-3">
                <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-3/4 mb-3" />
                <div className="flex gap-1 mb-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-8 w-full mt-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : searched && results.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No results found</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((mod) => (
            <Card key={mod.slug} className="flex flex-col">
              <CardHeader className="flex flex-row items-start gap-3 pb-3">
                <input
                  type="checkbox"
                  checked={selectedMods.has(mod.slug)}
                  onChange={() => toggleMod(mod.slug)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
                />
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
                    disabled={!selectedServer || !!installingMod || batchInstalling}
                  >
                    {installingMod === mod.slug ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Installing...
                      </span>
                    ) : installingMod ? "Busy..." : "Install"}
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
            Select a server above, check multiple mods for batch install, or click Install on any result for version selection.
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
                    <Button size="sm" onClick={() => installMod(v.id, versionsModal?.title)} disabled={!!installingMod}>
                      {installingMod === versionsModal?.slug ? (
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          Installing...
                        </span>
                      ) : "Install"}
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
