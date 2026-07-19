"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";

export default function SessionsPage() {
  const { success, error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingAll, setRevokingAll] = useState(false);

  const fetchSessions = () => {
    api.get("/api/sessions")
      .then(({ sessions }) => setSessions(Array.isArray(sessions) ? sessions : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleRevoke = async (id: number) => {
    if (!(await showConfirm({ title: "Revoke Session", message: "Log out this session?" }))) return;
    try {
      await api.delete(`/api/sessions/${id}`);
      success("Session revoked");
      fetchSessions();
    } catch (err: any) {
      toastError("Failed to revoke", err.message);
    }
  };

  const handleRevokeAll = async () => {
    if (!(await showConfirm({ title: "Revoke All", message: "Log out all other sessions? You will stay logged in." }))) return;
    setRevokingAll(true);
    try {
      await api.post("/api/sessions/revoke-all");
      success("Other sessions revoked");
      fetchSessions();
    } catch (err: any) {
      toastError("Failed to revoke", err.message);
    } finally {
      setRevokingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Active Sessions</h2>
        {sessions.length > 1 && (
          <Button variant="outline" onClick={handleRevokeAll} disabled={revokingAll}>
            {revokingAll ? "Revoking..." : "Revoke Others"}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="mb-2 text-4xl">🔐</span>
            <p className="text-muted-foreground">No active sessions</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {session.user_agent ? (
                      <span title={session.user_agent}>
                        {session.user_agent.length > 60 ? session.user_agent.slice(0, 60) + "..." : session.user_agent}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unknown device</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {session.ip && <>IP: {session.ip} &middot; </>}
                    Created: {formatDate(session.created_at)}
                    {session.last_used !== session.created_at && <> &middot; Last used: {formatDate(session.last_used)}</>}
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleRevoke(session.id)}>
                  Revoke
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
