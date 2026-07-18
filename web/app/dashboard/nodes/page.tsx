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
  const [form, setForm] = useState({ name: "", hostname: "", port: "50051", api_key: "", max_servers: "10" });
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
      await api.post("/api/nodes", { ...form, port: Number(form.port), max_servers: Number(form.max_servers) });
      setForm({ name: "", hostname: "", port: "50051", api_key: "", max_servers: "10" });
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

  const totalServers = nodes.reduce((acc: number, n: any) => acc + (n.current_servers || 0), 0);
  const onlineNodes = nodes.filter((n: any) => n.status === "online").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nodes</h1>
          <p className="text-muted-foreground">Manage server nodes across your infrastructure</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "Add Node"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Nodes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{nodes.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Online</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-500">{onlineNodes}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Servers</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalServers}</p></CardContent>
        </Card>
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
                  <label className="text-sm font-medium">Hostname / IP</label>
                  <Input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} placeholder="192.168.1.100" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Agent Port</label>
                  <Input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Servers</label>
                  <Input value={form.max_servers} onChange={(e) => setForm({ ...form, max_servers: e.target.value })} type="number" />
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
      ) : nodes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="mb-2 text-4xl">🖥️</span>
            <p className="text-muted-foreground">No nodes registered</p>
            <p className="text-xs text-muted-foreground">Add a node to start hosting servers</p>
          </CardContent>
        </Card>
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
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <p>Host: {node.hostname}:{node.port}</p>
                    <p>Servers: {node.current_servers}/{node.max_servers}</p>
                    {node.last_heartbeat && (
                      <p>Last seen: {new Date(node.last_heartbeat).toLocaleString()}</p>
                    )}
                  </div>

                  {node.status === "online" && (
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs">
                          <span>CPU</span>
                          <span>{node.cpu_percent || 0}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(node.cpu_percent || 0, 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs">
                          <span>Memory</span>
                          <span>{node.memory_percent || 0}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(node.memory_percent || 0, 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs">
                          <span>Disk</span>
                          <span>{node.disk_percent || 0}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800">
                          <div className="h-full rounded-full bg-yellow-500" style={{ width: `${Math.min(node.disk_percent || 0, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {node.name !== "master" && (
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(node.id, node.name)}>
                      Remove
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
