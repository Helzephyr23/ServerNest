"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface AuditEntry {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: string | null;
  ip: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "server.create": { label: "Created", color: "bg-green-500/10 text-green-500" },
  "server.delete": { label: "Deleted", color: "bg-red-500/10 text-red-500" },
  "server.start": { label: "Started", color: "bg-blue-500/10 text-blue-500" },
  "server.stop": { label: "Stopped", color: "bg-yellow-500/10 text-yellow-500" },
  "server.restart": { label: "Restarted", color: "bg-purple-500/10 text-purple-500" },
  "user.login": { label: "Login", color: "bg-zinc-500/10 text-zinc-400" },
  "backup.create": { label: "Backup Created", color: "bg-cyan-500/10 text-cyan-500" },
  "backup.restore": { label: "Backup Restored", color: "bg-orange-500/10 text-orange-500" },
};

function formatDate(iso: string) {
  return new Date(iso + "Z").toLocaleString();
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchEntries = (offset: number) => {
    setLoading(true);
    api.get(`/api/audit?limit=${pageSize}&offset=${offset}`)
      .then((data) => {
        setEntries(data.entries || []);
        setTotal(data.total || 0);
      })
      .catch(() => { setEntries([]); setTotal(0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEntries(page * pageSize); }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activity Log</h1>
        <p className="text-muted-foreground">Audit trail of actions performed in this panel</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity ({total} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-20 rounded" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32 ml-auto" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const actionMeta = ACTION_LABELS[entry.action] || { label: entry.action, color: "bg-zinc-500/10 text-zinc-400" };
                return (
                  <div key={entry.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                    <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${actionMeta.color}`}>
                      {actionMeta.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{entry.username || "System"}</span>
                      {entry.target_type && (
                        <span className="ml-1 text-muted-foreground">
                          {entry.action.includes(".") ? entry.action.split(".")[1] : entry.action} a {entry.target_type}
                        </span>
                      )}
                      {entry.details && (
                        <span className="ml-1 text-muted-foreground">&quot;{entry.details}&quot;</span>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <p>{formatDate(entry.created_at)}</p>
                      {entry.ip && <p className="text-[10px]">{entry.ip}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
