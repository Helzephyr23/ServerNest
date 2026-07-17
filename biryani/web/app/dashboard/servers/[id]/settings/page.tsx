"use client";

<<<<<<< Updated upstream
import { Card, CardContent } from "@/components/ui/card";
=======
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const params = useParams();
  const id = params.id as string;
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsRestart, setNeedsRestart] = useState(false);
  const [server, setServer] = useState<any>(null);

  const fetchProps = () => {
    Promise.all([
      api.get(`/api/servers/${id}/properties`),
      api.get(`/api/servers/${id}`),
    ]).then(([{ properties: p }, { server: s }]) => {
      setProperties(p);
      setServer(s);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchProps(); }, [id]);

  const handleChange = (key: string, value: string) => {
    setProperties((prev) => ({ ...prev, [key]: value }));
    setNeedsRestart(true);
  };

  const handleToggle = (key: string) => {
    const current = properties[key];
    handleChange(key, current === "true" ? "false" : "true");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/servers/${id}/properties`, { properties });
      setNeedsRestart(false);
      alert("Settings saved. Restart the server to apply changes.");
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
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
>>>>>>> Stashed changes

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Server Settings</h2>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <span className="mb-2 text-4xl">⚙️</span>
          <p className="text-muted-foreground">Server settings coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
