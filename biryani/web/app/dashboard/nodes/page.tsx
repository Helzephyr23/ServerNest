"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NodesPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", hostname: "", port: "50051", api_key: "" });
  const [error, setError] = useState("");

  const fetchNodes = () => {
    api.get("/api/nodes")
      .then(({ nodes }) => setNodes(Array.isArray(nodes) ? nodes : []))
      .catch(() => setNodes([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNodes(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/nodes", { ...form, port: Number(form.port) });
      setForm({ name: "", hostname: "", port: "50051", api_key: "" });
      setShowAdd(false);
      fetchNodes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Remove node "${name}"?`)) {
      await api.delete(`/api/nodes/${id}`);
      fetchNodes();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nodes</h1>
          <p className="text-muted-foreground">Manage server nodes (machines)</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "Add Node"}
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader><CardTitle>Add Node</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              {error && <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="node-1" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hostname</label>
                  <Input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} placeholder="192.168.1.100" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">gRPC Port</label>
                  <Input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} required />
                </div>
              </div>
              <Button type="submit">Register Node</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {nodes.map((node) => (
            <Card key={node.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">{node.name}</CardTitle>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                  node.status === "online" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                }`}>{node.status}</span>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Host: {node.hostname}:{node.port}</p>
                  <p>Servers: {node.current_servers}/{node.max_servers}</p>
                </div>
                {node.name !== "master" && (
                  <Button variant="destructive" size="sm" className="mt-3" onClick={() => handleDelete(node.id, node.name)}>
                    Remove
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
