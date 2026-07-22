"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useServer } from "@/lib/server-context";
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";

type MetricPoint = {
  collected_at: string;
  cpu_percent: number;
  memory_mb: number;
  memory_limit_mb: number;
};

const RANGES = [
  { value: "1h", label: "1 Hour" },
  { value: "6h", label: "6 Hours" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
];

function formatTime(dateStr: string, range: string): string {
  const d = new Date(dateStr + "Z");
  if (range === "1h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (range === "6h" || range === "24h") return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      <p className="text-muted-foreground">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.value?.toFixed?.(1) ?? entry.value}{entry.name === "CPU" ? "%" : " MB"}
        </p>
      ))}
    </div>
  );
}

export default function PerformancePage() {
  const params = useParams();
  const id = params.id as string;
  const { server } = useServer();
  const [range, setRange] = useState("1h");
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<any>(null);

  const fetchMetrics = useCallback(async () => {
    const [{ metrics: history }, { metrics: live }] = await Promise.all([
      api.get(`/api/servers/${id}/metrics/history?range=${range}`),
      api.get(`/api/servers/${id}/metrics`).catch(() => ({ metrics: null })),
    ]);
    setMetrics(history || []);
    setCurrent(live);
    setLoading(false);
  }, [id, range]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  useEffect(() => { if (server?.status) fetchMetrics(); }, [server?.status]);

  useEffect(() => {
    if (range === "1h") {
      const interval = setInterval(fetchMetrics, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, range]);

  const cpuData = metrics.map((m) => ({
    time: formatTime(m.collected_at, range),
    CPU: m.cpu_percent,
  }));

  const memData = metrics.map((m) => ({
    time: formatTime(m.collected_at, range),
    Used: +(m.memory_mb || 0).toFixed(0),
    Limit: +(m.memory_limit_mb || 0).toFixed(0),
  }));

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              range === r.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CPU Usage (%)</CardTitle>
          </CardHeader>
          <CardContent>
            {current && (
              <p className="mb-4 text-2xl font-bold">{current.cpu_percent?.toFixed(1)}%</p>
            )}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cpuData}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="CPU" stroke="#3b82f6" fill="url(#cpuGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Memory Usage (MB)</CardTitle>
          </CardHeader>
          <CardContent>
            {current && (
              <p className="mb-4 text-2xl font-bold">
                {current.memory_mb?.toFixed(0)} MB <span className="text-base text-muted-foreground">/ {current.memory_limit_mb?.toFixed(0)} MB</span>
              </p>
            )}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={memData}>
                  <defs>
                    <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Used" stroke="#a855f7" fill="url(#memGrad)" strokeWidth={2} dot={false} />
                  {memData.length > 0 && (
                    <Line type="monotone" dataKey="Limit" stroke="#dc2626" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {metrics.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No historical data available yet. Data is collected once per minute while the server is running.
        </p>
      )}
    </div>
  );
}
