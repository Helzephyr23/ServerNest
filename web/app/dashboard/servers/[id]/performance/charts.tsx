"use client";

import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChartPoint = Record<string, string | number>;

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

export default function Charts({
  cpuData,
  memData,
  current,
}: {
  cpuData: ChartPoint[];
  memData: ChartPoint[];
  current: any;
}) {
  return (
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
  );
}
