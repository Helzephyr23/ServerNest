"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast";

const EVENT_OPTIONS = [
  { id: "server_start", label: "Server Start" },
  { id: "server_stop", label: "Server Stop" },
  { id: "server_crash", label: "Server Crash" },
  { id: "backup_complete", label: "Backup Complete" },
  { id: "backup_failed", label: "Backup Failed" },
  { id: "task_complete", label: "Task Complete" },
  { id: "task_failed", label: "Task Failed" },
  { id: "all", label: "All Events" },
];

export default function NotificationsPage() {
  const { success, error: toastError } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: "discord", webhook_url: "", email: "", events: ["all"] });
  const [testUrl, setTestUrl] = useState("");

  const fetchNotifications = () => {
    api.get("/api/notifications")
      .then(({ notifications: n }) => setNotifications(Array.isArray(n) ? n : []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/notifications", form);
      setForm({ type: "discord", webhook_url: "", email: "", events: ["all"] });
      setShowAdd(false);
      fetchNotifications();
    } catch (err: any) {
      toastError("Failed to create notification", err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this notification?")) {
      await api.delete(`/api/notifications/${id}`);
      fetchNotifications();
    }
  };

  const handleTest = async () => {
    if (!testUrl) return;
    try {
      await api.post("/api/notifications/test", { webhook_url: testUrl });
      success("Test notification sent!");
    } catch (err: any) {
      toastError("Failed to send test", err.message);
    }
  };

  const toggleEvent = (eventId: string) => {
    setForm((prev) => {
      const events = prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId];
      return { ...prev, events };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Configure alerts for server events</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "Add Notification"}
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader><CardTitle>Add Notification</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="flex gap-4">
                <Button type="button" variant={form.type === "discord" ? "default" : "outline"} onClick={() => setForm({ ...form, type: "discord" })}>
                  Discord Webhook
                </Button>
                <Button type="button" variant={form.type === "email" ? "default" : "outline"} onClick={() => setForm({ ...form, type: "email" })}>
                  Email
                </Button>
              </div>

              {form.type === "discord" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Discord Webhook URL</label>
                  <Input
                    value={form.webhook_url}
                    onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                    placeholder="https://discord.com/api/webhooks/..."
                    required
                  />
                </div>
              )}

              {form.type === "email" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="admin@example.com"
                    type="email"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Events</label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_OPTIONS.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => toggleEvent(event.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        form.events.includes(event.id)
                          ? "bg-primary text-primary-foreground"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      {event.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit">Create Notification</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Test Discord Webhook</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
            />
            <Button onClick={handleTest} disabled={!testUrl}>Send Test</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="mb-2 text-4xl">🔔</span>
            <p className="text-muted-foreground">No notifications configured</p>
            <p className="text-xs text-muted-foreground">Add a notification to get alerts</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card key={notif.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{notif.type === "discord" ? "Discord" : "Email"} Notification</p>
                  <p className="text-xs text-muted-foreground">
                    {notif.type === "discord" ? notif.webhook_url?.substring(0, 50) + "..." : notif.email}
                  </p>
                  <div className="mt-1 flex gap-1">
                    {JSON.parse(notif.events || "[]").map((e: string) => (
                      <span key={e} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{e}</span>
                    ))}
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(notif.id)}>
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
