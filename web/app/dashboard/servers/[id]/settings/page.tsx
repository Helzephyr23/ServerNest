"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/toast";
import { useServer } from "@/lib/server-context";
import { RAM_OPTIONS } from "@/lib/constants";

const PROPERTY_LABELS: Record<string, string> = {
  "server-name": "Server Name",
  "gamemode": "Gamemode",
  "difficulty": "Difficulty",
  "max-players": "Max Players",
  "view-distance": "View Distance",
  "simulation-distance": "Simulation Distance",
  "spawn-protection": "Spawn Protection",
  "pvp": "PVP",
  "allow-flight": "Allow Flight",
  "hardcore": "Hardcore",
  "white-list": "Whitelist",
  "online-mode": "Online Mode",
  "command-block": "Command Blocks",
  "level-name": "World Name",
  "level-seed": "World Seed",
  "level-type": "World Type",
  "motd": "MOTD",
  "server-port": "Server Port",
  "allow-nether": "Allow Nether",
  "spawn-animals": "Spawn Animals",
  "spawn-monsters": "Spawn Monsters",
  "spawn-npcs": "Spawn NPCs",
  "generate-structures": "Generate Structures",
  "max-tick-time": "Max Tick Time",
  "max-world-size": "Max World Size",
  "network-compression-threshold": "Network Compression",
  "rate-limit": "Rate Limit",
  "resource-pack": "Resource Pack",
  "resource-pack-sha1": "Resource Pack SHA1",
  "resource-pack-prompt": "Resource Pack Prompt",
  "require-resource-pack": "Require Resource Pack",
  "enforce-secure-profile": "Enforce Secure Profile",
  "hide-online-players": "Hide Online Players",
};

const BOOLEAN_KEYS = new Set([
  "pvp", "allow-flight", "hardcore", "white-list", "online-mode",
  "command-block", "allow-nether", "spawn-animals", "spawn-monsters",
  "spawn-npcs", "generate-structures", "require-resource-pack",
  "enforce-secure-profile", "hide-online-players",
]);

export default function ServerSettingsPage() {
  const { success, error: toastError } = useToast();
  const params = useParams();
  const id = params.id as string;
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsRestart, setNeedsRestart] = useState(false);
  const { server, refresh } = useServer();
  const [search, setSearch] = useState("");
  const [portError, setPortError] = useState("");

  // Pending (staged) changes — not saved until user clicks Save
  const [pendingRam, setPendingRam] = useState<number | null>(null);
  const [pendingPort, setPendingPort] = useState<number | null>(null);
  const [pendingVersion, setPendingVersion] = useState<string | null>(null);
  const [pendingDescription, setPendingDescription] = useState<string | null>(null);
  const [pendingIcon, setPendingIcon] = useState<string | null>(null);
  const [versionToApply, setVersionToApply] = useState("");
  const [showVersionConfirm, setShowVersionConfirm] = useState(false);

  const [mcVersions, setMcVersions] = useState<any[]>([]);

  const fetchProps = () => {
    api.get(`/api/servers/${id}/properties`)
      .then(({ properties: p }) => setProperties(p || {}))
      .catch(() => setProperties({}))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProps(); }, [id]);
  useEffect(() => { if (server?.status) fetchProps(); }, [server?.status]);
  useEffect(() => {
    api.get("/api/mc-versions").then(({ versions }) => {
      setMcVersions(Array.isArray(versions) ? versions.filter((v: any) => v.type === "release") : []);
    }).catch(() => {});
  }, []);

  const hasChanges = pendingRam !== null || pendingPort !== null || pendingVersion !== null || pendingDescription !== null || pendingIcon !== null || needsRestart;

  const handleChange = (key: string, value: string) => {
    setProperties((prev) => ({ ...prev, [key]: value }));
    setNeedsRestart(true);
  };

  const handleToggle = (key: string) => {
    const current = properties[key];
    handleChange(key, current === "true" ? "false" : "true");
  };

  const handleReset = () => {
    setPendingRam(null);
    setPendingPort(null);
    setPendingVersion(null);
    setPendingDescription(null);
    setPendingIcon(null);
    setNeedsRestart(false);
    setPortError("");
    setShowVersionConfirm(false);
    setVersionToApply("");
    fetchProps();
  };

  const handleSave = async () => {
    setSaving(true);
    let savedAny = false;
    try {
      // 1. RAM + Port + Description + Icon (single PUT)
      if (pendingRam !== null || pendingPort !== null || pendingDescription !== null || pendingIcon !== null) {
        const body: Record<string, any> = {};
        if (pendingRam !== null) body.ram_mb = pendingRam;
        if (pendingPort !== null) body.port = pendingPort;
        if (pendingDescription !== null) body.description = pendingDescription || null;
        if (pendingIcon !== null) body.icon = pendingIcon || null;
        await api.put(`/api/servers/${id}`, body);
        savedAny = true;
      }

      // 2. Version (separate endpoint — validates against Mojang, updates server_config, restarts)
      if (pendingVersion !== null) {
        await api.post(`/api/servers/${id}/update-version`, { version: pendingVersion });
        savedAny = true;
      }

      // 3. Properties
      if (needsRestart) {
        await api.put(`/api/servers/${id}/properties`, { properties, reload: false });
        savedAny = true;
      }

      // Clear pending
      setPendingRam(null);
      setPendingPort(null);
      setPendingVersion(null);
      setPendingDescription(null);
      setPendingIcon(null);
      setNeedsRestart(false);
      setPortError("");
      setShowVersionConfirm(false);
      setVersionToApply("");
      refresh();
      if (savedAny) {
        success("Settings saved. Restart the server to apply changes.");
      }
    } catch (err: any) {
      toastError("Failed to save", err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatRam = (mb: number) => mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Card>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedKeys = Object.keys(properties || {}).sort();
  const filteredKeys = search
    ? sortedKeys.filter((key) => {
        const label = PROPERTY_LABELS[key] || key;
        return label.toLowerCase().includes(search.toLowerCase()) || key.toLowerCase().includes(search.toLowerCase());
      })
    : sortedKeys;

  return (
    <div className="space-y-4">
      {/* Header with Save / Reset */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Server Settings</h2>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-yellow-500">
              Unsaved changes
            </span>
          )}
          {hasChanges && (
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}>
              Reset
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-500">
          Restart the server after saving to apply changes
        </div>
      )}

      {/* Minecraft Version */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Minecraft Version
            {pendingVersion !== null && (
              <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-500">Unsaved</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Current: <span className="font-medium text-foreground">{server?.mc_version}</span>
            {pendingVersion !== null && (
              <span className="ml-2 text-yellow-500">&rarr; {pendingVersion}</span>
            )}
          </p>

          {showVersionConfirm ? (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
              <p className="mb-3 text-sm text-yellow-500">
                Update to <strong>{versionToApply}</strong>?{server?.status === "running" && " The server will be stopped and restarted."}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setPendingVersion(versionToApply);
                    setShowVersionConfirm(false);
                  }}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowVersionConfirm(false);
                    setVersionToApply("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                id="version-select"
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    setVersionToApply(e.target.value);
                    setShowVersionConfirm(true);
                  }
                  e.target.value = "";
                }}
              >
                <option value="" disabled>Select version to update...</option>
                {mcVersions.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.id} {v.id === mcVersions[0]?.id ? "(latest)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Description & Icon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Description & Icon
            {(pendingDescription !== null || pendingIcon !== null) && (
              <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-500">Unsaved</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Server Icon (emoji)</label>
            <input
              type="text"
              maxLength={10}
              value={pendingIcon ?? server?.icon ?? ""}
              onChange={(e) => setPendingIcon(e.target.value)}
              placeholder="e.g. ⛏️ 🟣 🧵"
              className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              maxLength={500}
              value={pendingDescription ?? server?.description ?? ""}
              onChange={(e) => setPendingDescription(e.target.value)}
              placeholder="A short description of this server"
              rows={3}
              className="flex w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Memory (RAM) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Memory (RAM)
            {pendingRam !== null && (
              <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-500">Unsaved</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Current: <span className="font-medium text-foreground">{formatRam(server?.ram_mb ?? 0)}</span>
            {pendingRam !== null && (
              <span className="ml-2 text-yellow-500">&rarr; {formatRam(pendingRam)}</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <select
              id="ram-select"
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={pendingRam ?? server?.ram_mb ?? 2048}
              onChange={(e) => setPendingRam(Number(e.target.value))}
            >
              {RAM_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {formatRam(r)}
                </option>
              ))}
            </select>
            {pendingRam !== null && (
              <Button variant="ghost" size="sm" onClick={() => setPendingRam(null)}>
                Revert
              </Button>
            )}
          </div>
          {server?.status === "running" && (
            <p className="mt-2 text-sm text-yellow-500">
              Restart the server for RAM changes to take effect
            </p>
          )}
        </CardContent>
      </Card>

      {/* Network Port */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Network Port
            {pendingPort !== null && (
              <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-500">Unsaved</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Current: <span className="font-medium text-foreground">{server?.port}</span>
            {pendingPort !== null && (
              <span className="ml-2 text-yellow-500">&rarr; {pendingPort}</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1024}
              max={65535}
              value={pendingPort ?? server?.port ?? ""}
              onChange={(e) => {
                setPortError("");
                setPendingPort(Number(e.target.value));
              }}
              className="w-32"
            />
            {pendingPort !== null && (
              <Button variant="ghost" size="sm" onClick={() => { setPendingPort(null); setPortError(""); }}>
                Revert
              </Button>
            )}
          </div>
          {portError && (
            <p className="mt-2 text-sm text-red-500">{portError}</p>
          )}
          {server?.status === "running" && !portError && (
            <p className="mt-2 text-sm text-yellow-500">
              Restart the server for port changes to take effect
            </p>
          )}
        </CardContent>
      </Card>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search settings..."
        className="max-w-sm"
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredKeys.map((key) => {
          const label = PROPERTY_LABELS[key] || key;
          const value = properties[key];

          if (BOOLEAN_KEYS.has(key)) {
            return (
              <div key={key} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{key}</p>
                </div>
                <button
                  onClick={() => handleToggle(key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    value === "true" ? "bg-primary" : "bg-zinc-700"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                    value === "true" ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>
            );
          }

          return (
            <div key={key} className="rounded-lg border p-4">
              <label className="mb-1 block text-sm font-medium">{label}</label>
              <p className="mb-2 text-xs text-muted-foreground">{key}</p>
              <Input
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
