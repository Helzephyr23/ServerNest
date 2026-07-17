"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Tab = "whitelist" | "ops" | "bans";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "whitelist", label: "Whitelist", icon: "✅" },
  { id: "ops", label: "Operators", icon: "👑" },
  { id: "bans", label: "Bans", icon: "🚫" },
];

export default function PlayersPage() {
  const params = useParams();
  const id = params.id as string;
  const [tab, setTab] = useState<Tab>("whitelist");
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [reason, setReason] = useState("");
  const [server, setServer] = useState<any>(null);

  const fetchPlayers = () => {
    setLoading(true);
    Promise.all([
      api.get(`/api/servers/${id}/players/${tab}`),
      api.get(`/api/servers/${id}`),
    ]).then(([{ players: p }, { server: s }]) => {
      setPlayers(Array.isArray(p) ? p : []);
      setServer(s || null);
    }).catch(() => {
      setPlayers([]);
      setServer(null);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchPlayers(); }, [id, tab]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      if (tab === "bans") {
        await api.post(`/api/servers/${id}/players/bans`, { name: newName.trim(), reason: reason.trim() || undefined });
      } else {
        await api.post(`/api/servers/${id}/players/${tab}`, { name: newName.trim() });
      }
      setNewName("");
      setReason("");
      fetchPlayers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemove = async (name: string) => {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await api.delete(`/api/servers/${id}/players/${tab}/${name}`);
      fetchPlayers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Player Management</h2>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {server?.status !== "running" && (
        <div className="rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-500">
          Server must be running to manage players
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={tab === "bans" ? "Player name to ban" : "Player name"}
          disabled={server?.status !== "running"}
        />
        {tab === "bans" && (
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="max-w-xs"
            disabled={server?.status !== "running"}
          />
        )}
        <Button onClick={handleAdd} disabled={server?.status !== "running" || !newName.trim()}>
          {tab === "bans" ? "Ban" : "Add"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : players.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No {tab} entries</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {players.map((player, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">
                    {typeof player === "string" ? player : player.name}
                  </p>
                  {player.reason && (
                    <p className="text-xs text-muted-foreground">Reason: {player.reason}</p>
                  )}
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleRemove(typeof player === "string" ? player : player.name)}>
                  Remove
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
