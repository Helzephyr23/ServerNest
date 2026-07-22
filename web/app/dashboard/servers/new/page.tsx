"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const SOFTWARE_OPTIONS = [
  { id: "vanilla", name: "Vanilla", desc: "Official Minecraft server" },
  { id: "paper", name: "Paper", desc: "High-performance with plugins" },
  { id: "spigot", name: "Spigot", desc: "Plugin support" },
  { id: "fabric", name: "Fabric", desc: "Lightweight mod loader" },
  { id: "forge", name: "Forge", desc: "Mod loader for modpacks" },
  { id: "purpur", name: "Purpur", desc: "Enhanced Paper fork" },
];

const VERSIONS = ["1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.20", "1.19.4", "1.19.2", "1.18.2", "1.17.1", "1.16.5"];
const RAM_OPTIONS = [1024, 2048, 3072, 4096, 6144, 8192, 10240, 16384];

export default function NewServerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [software, setSoftware] = useState("vanilla");
  const [version, setVersion] = useState("1.21.4");
  const [ram, setRam] = useState(2048);
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Server name is required"); return; }
    if (!eulaAccepted) { setError("You must accept the Minecraft EULA"); return; }
    setLoading(true);
    setError("");
    try {
      const { server } = await api.post("/api/servers", {
        name: name.trim(),
        software,
        mc_version: version,
        ram_mb: ram,
        eula_accepted: true,
      });
      router.push(`/dashboard/servers/${server.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Server</h1>
        <p className="text-muted-foreground">Set up a new Minecraft server</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

            <div className="space-y-2">
              <label className="text-sm font-medium">Server Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Server" required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Software</label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {SOFTWARE_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSoftware(s.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      software === s.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Minecraft Version</label>
              <select
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">RAM (MB)</label>
              <select
                value={ram}
                onChange={(e) => setRam(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {RAM_OPTIONS.map((r) => <option key={r} value={r}>{r >= 1024 ? `${r / 1024} GB` : `${r} MB`}</option>)}
              </select>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={eulaAccepted}
                onChange={(e) => setEulaAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-sm text-muted-foreground leading-5">
                I agree to the{" "}
                <a
                  href="https://minecraft.net/eula"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Minecraft End User License Agreement
                </a>
              </span>
            </label>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" disabled={loading || !eulaAccepted} className="flex-1">
                {loading ? "Creating..." : "Create Server"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
