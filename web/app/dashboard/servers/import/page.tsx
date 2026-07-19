"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, File, X, CheckCircle } from "lucide-react";

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

function getApiUrl(): string {
  if (typeof window === "undefined") return "";
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  if (window.location.port === "3000") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return "";
}

export default function ImportServerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apiUrl] = useState(getApiUrl);

  const [name, setName] = useState("");
  const [software, setSoftware] = useState("vanilla");
  const [version, setVersion] = useState("1.21.4");
  const [ram, setRam] = useState(2048);
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detected, setDetected] = useState<{ software?: string; version?: string } | null>(null);
  const [importedId, setImportedId] = useState<number | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".zip") || f.name.endsWith(".tar.gz") || f.name.endsWith(".tgz"))) {
      setFile(f);
      setError("");
    } else {
      setError("Please upload a .zip or .tar.gz file");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Server name is required"); return; }
    if (!eulaAccepted) { setError("You must accept the Minecraft EULA"); return; }
    if (!file) { setError("Please select a server archive to upload"); return; }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("software", software);
      formData.append("mc_version", version);
      formData.append("ram_mb", String(ram));
      formData.append("eula_accepted", "true");
      formData.append("file", file);

      const res = await fetch(`${apiUrl}/api/servers/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("biryani_token")}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      setDetected(data.detected || null);
      setImportedId(data.server.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (importedId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h2 className="text-2xl font-bold">Server Imported</h2>
            <p className="text-muted-foreground">
              Your server has been imported successfully. The files are in place and ready to start.
            </p>
            {detected && (detected.software || detected.version) && (
              <div className="rounded-lg bg-muted px-4 py-3 text-sm">
                <p className="font-medium">Auto-detected:</p>
                {detected.software && <p className="text-muted-foreground">Software: <span className="font-medium text-foreground capitalize">{detected.software}</span></p>}
                {detected.version && <p className="text-muted-foreground">Version: <span className="font-medium text-foreground">{detected.version}</span></p>}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push("/dashboard/servers")}>
                Back to Servers
              </Button>
              <Button onClick={() => router.push(`/dashboard/servers/${importedId}`)}>
                Go to Server
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Server</h1>
        <p className="text-muted-foreground">
          Upload an existing Minecraft server directory as a .zip or .tar.gz archive
        </p>
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
              <p className="text-xs text-muted-foreground">We&apos;ll auto-detect from the uploaded files, or pick one below</p>
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
              <p className="text-xs text-muted-foreground">We&apos;ll auto-detect from version.json, or select one below</p>
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Server Archive</label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
                  file ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,.tar.gz,.tgz"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {file ? (
                  <>
                    <File className="h-8 w-8 text-primary" />
                    <div className="text-center">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium">Drop your server archive here</p>
                      <p className="text-sm text-muted-foreground">or click to browse (.zip, .tar.gz)</p>
                    </div>
                  </>
                )}
              </div>
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
              <Button type="submit" disabled={loading || !eulaAccepted || !file} className="flex-1">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Importing...
                  </span>
                ) : "Import Server"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to prepare your server archive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Stop your Minecraft server</p>
          <p>2. Zip or tar.gz your server directory (the folder containing server.properties, world/, mods/, etc.)</p>
          <p>3. Upload the archive here</p>
          <p className="mt-2 rounded-md bg-muted p-3 font-mono text-xs">
            # Example structure inside the archive:<br />
            server.properties<br />
            world/<br />
            world_nether/<br />
            world_the_end/<br />
            mods/ (for Fabric/Forge)<br />
            plugins/ (for Paper/Spigot)<br />
            ops.json<br />
            whitelist.json<br />
            version.json (auto-detected if present)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
