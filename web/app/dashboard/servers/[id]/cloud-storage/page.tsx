"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";
import { useServer } from "@/lib/server-context";

type Provider = "s3" | "gdrive" | "dropbox";

const PROVIDER_LABELS: Record<Provider, string> = {
  s3: "S3-Compatible",
  gdrive: "Google Drive",
  dropbox: "Dropbox",
};

const PROVIDER_HELP: Record<Provider, string[]> = {
  s3: ["Endpoint (optional)", "Region", "Bucket", "Access Key ID", "Secret Access Key", "Prefix (optional)"],
  gdrive: ["Client ID", "Client Secret", "Refresh Token", "Folder ID (optional)"],
  dropbox: ["Access Token", "Path (optional)"],
};

const PROVIDER_FIELDS: Record<Provider, string[]> = {
  s3: ["endpoint", "region", "bucket", "accessKeyId", "secretAccessKey", "prefix"],
  gdrive: ["clientId", "clientSecret", "refreshToken", "folderId"],
  dropbox: ["accessToken", "path"],
};

export default function CloudStoragePage() {
  const { success, error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const params = useParams();
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

  const fetchConfigs = () => {
    api.get(`/api/servers/${id}/cloud-storage`)
      .then(({ configs }) => setConfigs(Array.isArray(configs) ? configs : []))
      .catch(() => setConfigs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchConfigs(); }, [id]);
  useEffect(() => { if (server?.status) fetchConfigs(); }, [server?.status]);

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

  const providerIcon: Record<Provider, string> = {
    s3: "☁️",
    gdrive: "📂",
    dropbox: "📦",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Cloud Storage</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} disabled={showForm}>
          Add Provider
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold">{editingId ? "Edit" : "Add"} Cloud Provider</h3>
            <div className="flex gap-2">
              {(["s3", "gdrive", "dropbox"] as Provider[]).map((p) => (
                <Button
                  key={p}
                  variant={provider === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setProvider(p); setConfig({}); }}
                >
                  {providerIcon[p]} {PROVIDER_LABELS[p]}
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

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="mb-2 text-4xl">☁️</span>
            <p className="text-muted-foreground">No cloud storage configured</p>
            <p className="text-xs text-muted-foreground">Add S3, Google Drive, or Dropbox to upload backups</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {configs.map((cfg) => (
            <Card key={cfg.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span>{providerIcon[cfg.provider as Provider] || "☁️"}</span>
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
    </div>
  );
}
