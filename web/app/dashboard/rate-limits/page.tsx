"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";

interface RateLimitRule {
  id: number;
  route: string;
  method: string;
  max_requests: number;
  window_ms: number;
  enabled: number;
  description: string | null;
  created_at: string;
}

const METHODS = ["GET", "POST", "PUT", "DELETE"];

function formatWindow(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${ms / 1000}s`;
  const mins = ms / 60000;
  return mins >= 60 ? `${mins / 60}h` : `${mins}m`;
}

export default function RateLimitsPage() {
  const { success, error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const [rules, setRules] = useState<RateLimitRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [route, setRoute] = useState("");
  const [method, setMethod] = useState("POST");
  const [maxRequests, setMaxRequests] = useState("10");
  const [windowMs, setWindowMs] = useState("60000");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRules = () => {
    api.get("/api/rate-limits")
      .then(({ rules }) => setRules(Array.isArray(rules) ? rules : []))
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRules(); }, []);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setRoute("");
    setMethod("POST");
    setMaxRequests("10");
    setWindowMs("60000");
    setDescription("");
  };

  const handleEdit = (rule: RateLimitRule) => {
    setEditingId(rule.id);
    setRoute(rule.route);
    setMethod(rule.method);
    setMaxRequests(String(rule.max_requests));
    setWindowMs(String(rule.window_ms));
    setDescription(rule.description || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!route.trim() || !maxRequests || !windowMs) {
      toastError("Validation", "Route, max requests, and window are required");
      return;
    }
    setSaving(true);
    try {
      const body = { route: route.trim(), method, max_requests: Number(maxRequests), window_ms: Number(windowMs), description: description.trim() || null };
      if (editingId) {
        await api.put(`/api/rate-limits/${editingId}`, body);
        success("Rule updated");
      } else {
        await api.post("/api/rate-limits", body);
        success("Rule created");
      }
      resetForm();
      fetchRules();
    } catch (err: any) {
      toastError("Failed to save", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: RateLimitRule) => {
    try {
      await api.put(`/api/rate-limits/${rule.id}`, { enabled: !rule.enabled });
      fetchRules();
    } catch (err: any) {
      toastError("Failed to toggle", err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await showConfirm({ title: "Delete Rule", message: "Delete this rate limit rule?" }))) return;
    try {
      await api.delete(`/api/rate-limits/${id}`);
      success("Rule deleted");
      fetchRules();
    } catch (err: any) {
      toastError("Failed to delete", err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Rate Limits</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }} disabled={showForm}>
          Add Rule
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure per-route rate limiting. Use <code>*</code> at the end of a route for prefix matching.
        Hardcoded defaults apply for routes without a configured rule.
      </p>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold">{editingId ? "Edit" : "Add"} Rate Limit Rule</h3>
            <div className="flex gap-2">
              {METHODS.map((m) => (
                <Button
                  key={m}
                  variant={method === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMethod(m)}
                >
                  {m}
                </Button>
              ))}
            </div>
            <Input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="/api/auth/login or /api/auth/*" />
            <div className="grid grid-cols-2 gap-3">
              <Input value={maxRequests} onChange={(e) => setMaxRequests(e.target.value)} type="number" placeholder="Max requests" />
              <Input value={windowMs} onChange={(e) => setWindowMs(e.target.value)} type="number" placeholder="Window (ms)" />
            </div>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
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
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="mb-2 text-4xl">🚦</span>
            <p className="text-muted-foreground">No rate limit rules configured</p>
            <p className="text-xs text-muted-foreground">Add a rule to override the hardcoded defaults</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Method</th>
                <th className="px-4 py-3 text-left font-medium">Route</th>
                <th className="px-4 py-3 text-left font-medium">Limit</th>
                <th className="px-4 py-3 text-left font-medium">Window</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs font-mono">{rule.method}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{rule.route}</td>
                  <td className="px-4 py-3">{rule.max_requests}</td>
                  <td className="px-4 py-3">{formatWindow(rule.window_ms)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{rule.description || "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        rule.enabled
                          ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                          : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                      }`}
                    >
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(rule.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
