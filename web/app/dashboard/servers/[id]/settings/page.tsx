"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { useServer } from "@/lib/server-context";

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

  const fetchProps = () => {
    api.get(`/api/servers/${id}/properties`)
      .then(({ properties: p }) => setProperties(p || {}))
      .catch(() => setProperties({}))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProps(); }, [id]);
  useEffect(() => { if (server?.status) fetchProps(); }, [server?.status]);

  const handleChange = (key: string, value: string) => {
    setProperties((prev) => ({ ...prev, [key]: value }));
    setNeedsRestart(true);
  };

  const handleToggle = (key: string) => {
    const current = properties[key];
    handleChange(key, current === "true" ? "false" : "true");
  };

  const handleSave = async (applyNow: boolean = false) => {
    setSaving(true);
    try {
      await api.put(`/api/servers/${id}/properties`, { properties, reload: applyNow });
      setNeedsRestart(false);
      success(applyNow ? "Settings saved and reloaded." : "Settings saved. Restart the server to apply changes.");
    } catch (err: any) {
      toastError("Failed to save", err.message);
    } finally {
      setSaving(false);
    }
  };

  const [mcVersions, setMcVersions] = useState<any[]>([]);
const [updatingVersion, setUpdatingVersion] = useState(false);

useEffect(() => {
  api.get("/api/mc-versions").then(({ versions }) => {
    setMcVersions(Array.isArray(versions) ? versions.filter((v: any) => v.type === "release") : []);
  }).catch(() => {});
}, []);

const handleVersionUpdate = async (version: string) => {
  setUpdatingVersion(true);
  try {
    await api.post(`/api/servers/${id}/update-version`, { version });
    success(`Server version updated to ${version}`);
    refresh();
  } catch (err: any) {
    toastError("Failed to update version", err.message);
  } finally {
    setUpdatingVersion(false);
  }
};

if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Server Settings</h2>
        <div className="flex items-center gap-3">
          {needsRestart && (
            <span className="text-sm text-yellow-500">Unsaved changes</span>
          )}
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving || !needsRestart}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {server?.status === "running" && (
            <Button onClick={() => handleSave(true)} disabled={saving || !needsRestart}>
              {saving ? "Saving..." : "Save & Reload"}
            </Button>
          )}
        </div>
      </div>

      {needsRestart && (
        <div className="rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-500">
          Restart the server after saving to apply changes
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Minecraft Version</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Current: <span className="font-medium text-foreground">{server?.mc_version}</span>
          </p>
          <div className="flex gap-2">
            <select
              id="version-select"
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) handleVersionUpdate(e.target.value);
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
            {updatingVersion && <p className="text-sm text-yellow-500">Updating...</p>}
          </div>
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
