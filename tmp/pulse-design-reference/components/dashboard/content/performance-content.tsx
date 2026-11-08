"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

const latencyData = [
  { time: "00:00", p50: 45, p95: 120, p99: 250 },
  { time: "04:00", p50: 42, p95: 115, p99: 235 },
  { time: "08:00", p50: 58, p95: 145, p99: 298 },
  { time: "12:00", p50: 72, p95: 168, p99: 345 },
  { time: "16:00", p50: 65, p95: 152, p99: 312 },
  { time: "20:00", p50: 48, p95: 125, p99: 268 },
  { time: "Now", p50: 52, p95: 132, p99: 275 },
];

const throughputData = [
  { time: "00:00", rps: 12400 },
  { time: "04:00", rps: 8200 },
  { time: "08:00", rps: 24500 },
  { time: "12:00", rps: 31200 },
  { time: "16:00", rps: 28900 },
  { time: "20:00", rps: 19800 },
  { time: "Now", rps: 22100 },
];

const metrics = [
  { label: "P50 Latency", value: "52ms", change: "-8ms", trend: "down", good: true },
  { label: "P95 Latency", value: "132ms", change: "+12ms", trend: "up", good: false },
  { label: "Throughput", value: "22.1k", change: "+2.3k", trend: "up", good: true },
  { label: "Error Rate", value: "0.42%", change: "-0.08%", trend: "down", good: true },
];

const serviceLatencies = [
  { name: "API Gateway", p50: 45, p95: 142, p99: 289, status: "healthy" },
  { name: "Auth Service", p50: 23, p95: 67, p99: 134, status: "healthy" },
  { name: "User Service", p50: 34, p95: 89, p99: 178, status: "healthy" },
  { name: "Payment Service", p50: 89, p95: 245, p99: 512, status: "degraded" },
  { name: "Order Service", p50: 56, p95: 134, p99: 267, status: "healthy" },
  { name: "Notification Service", p50: 12, p95: 34, p99: 67, status: "healthy" },
];

const cardShadow = "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px";

export function PerformanceContent() {
  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-card rounded-2xl p-5 border border-border"
            style={{ boxShadow: cardShadow }}
          >
            <p className="text-sm text-muted-foreground mb-1">{metric.label}</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-semibold text-foreground">{metric.value}</p>
              <span className={`text-sm font-medium flex items-center gap-1 ${
                metric.good ? "text-success" : "text-destructive"
              }`}>
                {metric.trend === "up" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Latency Chart */}
        <div
          className="bg-card rounded-2xl p-6 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Latency Distribution</h3>
              <p className="text-sm text-muted-foreground">P50, P95, P99 over time (ms)</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <span className="text-muted-foreground">P50</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-1" />
                <span className="text-muted-foreground">P95</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-3" />
                <span className="text-muted-foreground">P99</span>
              </div>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
                  axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
                />
                <YAxis 
                  tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
                  axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid oklch(0.92 0.005 250)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Line type="monotone" dataKey="p50" stroke="oklch(0.65 0.15 155)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p95" stroke="oklch(0.55 0.18 250)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p99" stroke="oklch(0.7 0.18 350)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Throughput Chart */}
        <div
          className="bg-card rounded-2xl p-6 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Request Throughput</h3>
              <p className="text-sm text-muted-foreground">Requests per second</p>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughputData}>
                <defs>
                  <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="oklch(0.55 0.18 250)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
                  axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
                />
                <YAxis 
                  tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
                  axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid oklch(0.92 0.005 250)",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rps"
                  stroke="oklch(0.55 0.18 250)"
                  strokeWidth={2}
                  fill="url(#throughputGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Service Latencies Table */}
      <div
        className="bg-card rounded-2xl border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="p-6 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Service Latencies</h3>
          <p className="text-sm text-muted-foreground">Current latency percentiles by service</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Service</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">P50</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">P95</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">P99</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {serviceLatencies.map((service) => (
                <tr key={service.name} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-foreground">{service.name}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground text-right font-mono">{service.p50}ms</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground text-right font-mono">{service.p95}ms</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground text-right font-mono">{service.p99}ms</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      service.status === "healthy"
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    }`}>
                      {service.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
