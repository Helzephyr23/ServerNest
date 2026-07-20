"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";

const TASK_TYPES = [
  { id: "backup", label: "Backup", icon: "💾" },
  { id: "restart", label: "Restart", icon: "🔄" },
  { id: "stop", label: "Stop", icon: "⏹️" },
  { id: "start", label: "Start", icon: "▶️" },
  { id: "command", label: "Command", icon: "⌨️" },
];

const TEMPLATES = [
  { name: "Daily Backup", type: "backup", schedule: "0 0 * * *", desc: "Backup server every day at midnight" },
  { name: "Hourly Backup", type: "backup", schedule: "0 * * * *", desc: "Backup server every hour" },
  { name: "Daily Restart", type: "restart", schedule: "0 3 * * *", desc: "Restart server daily at 3 AM" },
  { name: "Weekly Restart", type: "restart", schedule: "0 0 * * 0", desc: "Restart server every Sunday midnight" },
  { name: "Stop at Midnight", type: "stop", schedule: "0 0 * * *", desc: "Stop server every night" },
  { name: "Start at 6 AM", type: "start", schedule: "0 6 * * *", desc: "Start server every morning" },
  { name: "Hourly Broadcast", type: "command", schedule: "0 * * * *", desc: "Broadcast a message every hour", command: "say Server maintenance reminder!" },
  { name: "Auto Save", type: "command", schedule: "*/30 * * * *", desc: "Run save-all every 30 minutes", command: "save-all" },
];

const SCHEDULE_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours", value: "0 */12 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 3 AM", value: "0 3 * * *" },
  { label: "Weekly (Sunday)", value: "0 0 * * 0" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
];

export default function TasksPage() {
  const { success, error: toastError } = useToast();
  const { confirm: showConfirm } = useConfirm();
  const [tasks, setTasks] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateServer, setTemplateServer] = useState("");
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);
  const [form, setForm] = useState({
    server_id: "",
    name: "",
    type: "backup",
    schedule: "0 0 * * *",
    command: "",
  });

  const fetchData = () => {
    Promise.all([
      api.get("/api/tasks"),
      api.get("/api/servers"),
    ]).then(([{ tasks: t }, { servers: s }]) => {
      setTasks(Array.isArray(t) ? t : []);
      setServers(Array.isArray(s) ? s : []);
    }).catch(() => {
      setTasks([]);
      setServers([]);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/api/servers/${form.server_id}/tasks`, {
        name: form.name,
        type: form.type,
        schedule: form.schedule,
        command: form.command || undefined,
      });
      setForm({ server_id: "", name: "", type: "backup", schedule: "0 0 * * *", command: "" });
      setShowAdd(false);
      fetchData();
    } catch (err: any) {
      toastError("Failed to create task", err.message);
    }
  };

  const handleToggle = async (task: any) => {
    await api.put(`/api/tasks/${task.id}`, { enabled: !task.enabled });
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (await showConfirm({ title: "Delete Task", message: "Delete this task?" })) {
      await api.delete(`/api/tasks/${id}`);
      fetchData();
    }
  };

  const handleApplyTemplate = async (tpl: typeof TEMPLATES[0]) => {
    if (!templateServer) { toastError("Select a server first", ""); return; }
    setApplyingTemplate(tpl.name);
    try {
      await api.post(`/api/servers/${templateServer}/tasks`, {
        name: tpl.name,
        type: tpl.type,
        schedule: tpl.schedule,
        command: (tpl as any).command || undefined,
      });
      success(`Template "${tpl.name}" applied`);
      fetchData();
    } catch (err: any) {
      toastError("Failed to apply template", err.message);
    }
    setApplyingTemplate(null);
  };

  const handleRunNow = async (id: number) => {
    try {
      await api.post(`/api/tasks/${id}/run`);
      success("Task executed successfully");
    } catch (err: any) {
      toastError("Failed to run task", err.message);
    }
  };

  const getServerName = (id: number) => {
    const server = servers.find((s: any) => s.id === id);
    return server?.name || `Server #${id}`;
  };

  const getTypeInfo = (type: string) => {
    return TASK_TYPES.find((t) => t.id === type) || { icon: "❓", label: type };
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduled Tasks</h1>
          <p className="text-muted-foreground">Automate server maintenance with scheduled actions</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "Add Task"}
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader><CardTitle>New Scheduled Task</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Server</label>
                  <select
                    value={form.server_id}
                    onChange={(e) => setForm({ ...form, server_id: e.target.value })}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select a server</option>
                    {servers.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Task Name</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Daily Backup"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Task Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Schedule (Cron)</label>
                  <Input
                    value={form.schedule}
                    onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                    placeholder="0 0 * * *"
                    required
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {SCHEDULE_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setForm({ ...form, schedule: preset.value })}
                        className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {form.type === "command" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Command</label>
                  <Input
                    value={form.command}
                    onChange={(e) => setForm({ ...form, command: e.target.value })}
                    placeholder="say Server is restarting in 5 minutes!"
                    className="font-mono"
                    required
                  />
                </div>
              )}

              <Button type="submit">Create Task</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div>
        <Button variant="ghost" onClick={() => setShowTemplates(!showTemplates)} className="text-sm text-muted-foreground">
          {showTemplates ? "Hide Templates" : "Browse Templates"}
        </Button>
      </div>

      {showTemplates && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((tpl) => {
            const typeInfo = TASK_TYPES.find((t) => t.id === tpl.type);
            return (
              <Card key={tpl.name}>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg">{typeInfo?.icon}</span>
                    <p className="font-medium text-sm">{tpl.name}</p>
                  </div>
                  <p className="mb-3 text-[11px] text-muted-foreground">{tpl.desc}</p>
                  <p className="mb-3 text-[10px] font-mono text-zinc-500">{tpl.schedule}</p>
                  <div className="flex gap-2">
                    <select
                      value={templateServer}
                      onChange={(e) => setTemplateServer(e.target.value)}
                      className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                    >
                      <option value="">Select server</option>
                      {servers.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApplyTemplate(tpl)}
                      disabled={applyingTemplate === tpl.name}
                    >
                      {applyingTemplate === tpl.name ? "..." : "Apply"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="mb-2 text-4xl">⏰</span>
            <p className="text-muted-foreground">No scheduled tasks</p>
            <p className="text-xs text-muted-foreground">Create a task to automate server maintenance</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const typeInfo = getTypeInfo(task.type);
            return (
              <Card key={task.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{typeInfo.icon}</span>
                    <div>
                      <p className="font-medium">{task.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getServerName(task.server_id)} &middot; {typeInfo.label} &middot; {task.schedule}
                      </p>
                      {task.last_run && (
                        <p className="text-[10px] text-zinc-500">
                          Last run: {new Date(task.last_run).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleRunNow(task.id)}>
                      Run Now
                    </Button>
                    <button
                      onClick={() => handleToggle(task)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        task.enabled ? "bg-primary" : "bg-zinc-700"
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
                        task.enabled ? "translate-x-5" : "translate-x-1"
                      }`} />
                    </button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
