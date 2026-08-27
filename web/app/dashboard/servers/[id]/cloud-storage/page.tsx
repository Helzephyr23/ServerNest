"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";
import { useServer } from "@/lib/server-context";

type Provider = "s3" | "dropbox";

const PROVIDER_LABELS: Record<Provider, string> = {
  s3: "S3-Compatible",
  dropbox: "Dropbox",
};

const PROVIDER_HELP: Record<Provider, string[]> = {
  s3: ["Endpoint (optional)", "Region", "Bucket", "Access Key ID", "Secret Access Key", "Prefix (optional)"],
  dropbox: ["Access Token", "Path (optional)"],
};

const PROVIDER_FIELDS: Record<Provider, string[]> = {
  s3: ["endpoint", "region", "bucket", "accessKeyId", "secretAccessKey", "prefix"],
  dropbox: ["accessToken", "path"],
};

interface GDriveStatus {
  connected: boolean;
  email: string | null;
  configId: number | null;
}

export default function CloudStoragePage() {
  const { success, error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { server } = useServer();
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [provider, setProvider] = useState<Provider>("s3");
  const [label, setLabel] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Google Drive state
  const [gdriveStatus, setGdriveStatus] = useState<GDriveStatus>({ connected: false, email: null, configId: null });
  const [gdriveLoading, setGdriveLoading] = useState(true);
  const [gdriveConnecting, setGdriveConnecting] = useState(false);
  const [gdriveDisconnecting, setGdriveDisconnecting] = useState(false);
  const [gdriveTesting, setGdriveTesting] = useState(false);

  const fetchConfigs = useCallback(() => {
    api.get(`/api/servers/${id}/cloud-storage`)
      .then(({ configs }) => setConfigs(Array.isArray(configs) ? configs : []))
      .catch(() => setConfigs([]))
      .finally(() => setLoading(false));
  }, [id]);

  const fetchGdriveStatus = useCallback(() => {
    api.get(`/api/google-drive/status?serverId=${id}`)
      .then((res) => setGdriveStatus(res))
      .catch(() => setGdriveStatus({ connected: false, email: null, configId: null }))
      .finally(() => setGdriveLoading(false));
  }, [id]);

  useEffect(() => { fetchConfigs(); fetchGdriveStatus(); }, [fetchConfigs, fetchGdriveStatus]);
  useEffect(() => { if (server?.status) { fetchConfigs(); fetchGdriveStatus(); } }, [server?.status, fetchConfigs, fetchGdriveStatus]);

  // Handle OAuth redirect results
  useEffect(() => {
    const gdriveResult = searchParams.get("gdrive");
    const error = searchParams.get("error");
    if (gdriveResult === "connected") {
      success("Google Drive connected successfully");
      fetchGdriveStatus();
      window.history.replaceState({}, "", `/dashboard/servers/${id}/cloud-storage`);
    } else if (error) {
      const errorMessages: Record<string, string> = {
        gdrive_auth_denied: "Authorization was denied",
        gdrive_missing_params: "Missing authorization parameters",
        gdrive_invalid_state: "Invalid or expired authorization state",
        gdrive_no_refresh_token: "No refresh token received from Google",
        gdrive_token_exchange_failed: "Failed to exchange authorization code",
      };
      toastError("Google Drive", errorMessages[error] || "Connection failed");
      window.history.replaceState({}, "", `/dashboard/servers/${id}/cloud-storage`);
    }
  }, [searchParams, id, success, toastError, fetchGdriveStatus]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setProvider("s3");
    setLabel("");
    setConfig({});
  };

  const handleEdit = (cfg: any) => {
    setEditingId(cfg.id);
    setProvider(cfg.provider);
    setLabel(cfg.label);
    setConfig(JSON.parse(cfg.config_json));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!label.trim()) { toastError("Validation", "Label is required"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/servers/${id}/cloud-storage/${editingId}`, { label, config });
        success("Cloud storage config updated");
      } else {
        await api.post(`/api/servers/${id}/cloud-storage`, { provider, label, config });
        success("Cloud storage config added");
      }
      resetForm();
      fetchConfigs();
    } catch (err: any) {
      toastError("Failed to save", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cfgId: number) => {
    if (!(await showConfirm({ title: "Delete Config", message: "Remove this cloud storage config?" }))) return;
    try {
      await api.delete(`/api/servers/${id}/cloud-storage/${cfgId}`);
      success("Config deleted");
      fetchConfigs();
    } catch (err: any) {
      toastError("Failed to delete", err.message);
    }
  };

  const handleTest = async (cfgId: number) => {
    setTestingId(cfgId);
    try {
      const res = await api.post(`/api/servers/${id}/cloud-storage/${cfgId}/test`);
      if (res.success) success("Connection successful");
      else toastError("Connection failed", res.message);
    } catch (err: any) {
      toastError("Connection failed", err.message);
    } finally {
      setTestingId(null);
    }
  };

  const handleGdriveConnect = async () => {
    setGdriveConnecting(true);
    try {
      const res = await api.get(`/api/google-drive/auth-url?serverId=${id}`);
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      toastError("Google Drive", err.message);
      setGdriveConnecting(false);
    }
  };

  const handleGdriveDisconnect = async () => {
    if (!(await showConfirm({ title: "Disconnect Google Drive", message: "This will revoke access and remove the connection." }))) return;
    setGdriveDisconnecting(true);
    try {
      await api.post("/api/google-drive/disconnect", { serverId: id });
      success("Google Drive disconnected");
      fetchGdriveStatus();
    } catch (err: any) {
      toastError("Failed to disconnect", err.message);
    } finally {
      setGdriveDisconnecting(false);
    }
  };

  const handleGdriveTest = async () => {
    setGdriveTesting(true);
    try {
      const res = await api.post("/api/google-drive/test", { serverId: id });
      if (res.success) success("Connection successful");
      else toastError("Connection failed", res.message);
    } catch (err: any) {
      toastError("Connection failed", err.message);
    } finally {
      setGdriveTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Cloud Storage</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} disabled={showForm}>
          Add Provider
        </Button>
      </div>

      {/* ── Google Drive Section ───────────────────────────────────────── */}
      {gdriveLoading ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-20 rounded" />
          </CardContent>
        </Card>
      ) : gdriveStatus.connected ? (
        <Card className="border-green-500/30">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">📂</span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Google Drive</p>
                  <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-500">Connected</span>
                </div>
                <p className="text-sm text-muted-foreground">{gdriveStatus.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleGdriveTest} disabled={gdriveTesting}>
                {gdriveTesting ? "Testing..." : "Test"}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleGdriveDisconnect} disabled={gdriveDisconnecting}>
                {gdriveDisconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">📂</span>
              <div>
                <p className="font-medium">Google Drive</p>
                <p className="text-sm text-muted-foreground">Connect your Google Drive to store backups</p>
              </div>
            </div>
            <Button onClick={handleGdriveConnect} disabled={gdriveConnecting}>
              {gdriveConnecting ? "Connecting..." : "Connect Google Drive"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Add Provider Form ──────────────────────────────────────────── */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold">{editingId ? "Edit" : "Add"} Cloud Provider</h3>
            <div className="flex gap-2">
              {(["s3", "dropbox"] as Provider[]).map((p) => (
                <Button
                  key={p}
                  variant={provider === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setProvider(p); setConfig({}); }}
                >
                  {p === "s3" ? "☁️" : "📦"} {PROVIDER_LABELS[p]}
                </Button>
              ))}
            </div>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. My S3 Bucket)"
            />
            {PROVIDER_FIELDS[provider].map((field, i) => (
              <Input
                key={field}
                value={config[field] || ""}
                onChange={(e) => setConfig((c) => ({ ...c, [field]: e.target.value }))}
                placeholder={PROVIDER_HELP[provider][i] || field}
                type={field.toLowerCase().includes("secret") || field.toLowerCase().includes("token") ? "password" : "text"}
              />
            ))}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Other Configs List ─────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16 rounded" />
                  <Skeleton className="h-5 w-14 rounded" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : configs.length === 0 ? null : (
        <div className="space-y-2">
          {configs.map((cfg) => (
            <Card key={cfg.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span>{cfg.provider === "s3" ? "☁️" : "📦"}</span>
                    <p className="font-medium">{cfg.label}</p>
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {PROVIDER_LABELS[cfg.provider as Provider] || cfg.provider}
                    </span>
                    {cfg.enabled ? (
                      <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-500">Active</span>
                    ) : (
                      <span className="rounded bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-500">Disabled</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleTest(cfg.id)} disabled={testingId === cfg.id}>
                    {testingId === cfg.id ? "Testing..." : "Test"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(cfg)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(cfg.id)}>Remove</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Empty State ─────────────────────────────────────────────────── */}
      {!loading && !gdriveLoading && configs.length === 0 && !gdriveStatus.connected && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="mb-2 text-4xl">☁️</span>
            <p className="text-muted-foreground">No cloud storage configured</p>
            <p className="text-xs text-muted-foreground">Connect Google Drive or add S3/Dropbox to upload backups</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
