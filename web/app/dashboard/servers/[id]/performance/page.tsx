"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useServer } from "@/lib/server-context";

const Charts = dynamic(() => import("./charts"), {
  ssr: false,
  loading: () => (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  ),
});

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
      <div className="space-y-6">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
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

      <Charts cpuData={cpuData} memData={memData} current={current} />

      {metrics.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No historical data available yet. Data is collected once per minute while the server is running.
        </p>
      )}
    </div>
  );
}
