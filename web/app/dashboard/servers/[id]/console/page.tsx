"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConsolePage() {
  const params = useParams();
  const id = params.id as string;
  const [logs, setLogs] = useState("");
  const [command, setCommand] = useState("");
  const [server, setServer] = useState<any>(null);
  const logsRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    api.get(`/api/servers/${id}`).then(({ server }) => setServer(server));
    loadLogs();
  }, [id]);

  const loadLogs = async () => {
    try {
      const { logs } = await api.get(`/api/servers/${id}/logs?tail=200`);
      setLogs(logs || "No logs available. Server may not be running.");
    } catch {
      setLogs("Failed to load logs");
    }
  };

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  const sendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    try {
      await api.post(`/api/servers/${id}/command`, { command: command.trim() });
      setCommand("");
      setTimeout(loadLogs, 1000);
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Console</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadLogs}>Refresh</Button>
          <Button size="sm" onClick={loadLogs} variant="ghost">Auto-scroll</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <pre
            ref={logsRef}
            className="h-[500px] overflow-auto bg-black/50 p-4 font-mono text-sm text-green-400 scrollbar-thin"
          >
            {logs || "No logs available"}
          </pre>
        </CardContent>
      </Card>

      <form onSubmit={sendCommand} className="flex gap-2">
        <Input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Enter command..."
          className="font-mono"
          disabled={server?.status !== "running"}
        />
        <Button type="submit" disabled={server?.status !== "running" || !command.trim()}>Send</Button>
      </form>
    </div>
  );
}
