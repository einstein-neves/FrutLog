"use client";

import { Bug, TrendingUp, TrendingDown, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const errorTrend = [
  { time: "00:00", errors: 45, rate: 0.36 },
  { time: "04:00", errors: 23, rate: 0.28 },
  { time: "08:00", errors: 89, rate: 0.36 },
  { time: "12:00", errors: 124, rate: 0.40 },
  { time: "16:00", errors: 98, rate: 0.34 },
  { time: "20:00", errors: 67, rate: 0.34 },
  { time: "Now", errors: 72, rate: 0.33 },
];

const funnelData = [
  { stage: "Total Requests", count: 22100, percentage: 100 },
  { stage: "Processed", count: 21950, percentage: 99.32 },
  { stage: "Validated", count: 21820, percentage: 98.73 },
  { stage: "Executed", count: 21650, percentage: 97.96 },
  { stage: "Successful", count: 21008, percentage: 95.06 },
];

const topErrors = [
  {
    id: 1,
    type: "TimeoutException",
    message: "Request timeout after 30000ms",
    count: 342,
    change: "+23%",
    trend: "up",
    service: "payment-service",
    lastSeen: "2 min ago",
  },
  {
    id: 2,
    type: "ConnectionRefused",
    message: "Failed to connect to database pool",
    count: 189,
    change: "-12%",
    trend: "down",
    service: "user-service",
    lastSeen: "5 min ago",
  },
  {
    id: 3,
    type: "ValidationError",
    message: "Invalid request payload: missing field 'email'",
    count: 156,
    change: "+8%",
    trend: "up",
    service: "auth-service",
    lastSeen: "1 min ago",
  },
  {
    id: 4,
    type: "RateLimitExceeded",
    message: "Too many requests from IP",
    count: 98,
    change: "-45%",
    trend: "down",
    service: "api-gateway",
    lastSeen: "12 min ago",
  },
  {
    id: 5,
    type: "NullPointerException",
    message: "Cannot read property 'id' of undefined",
    count: 67,
    change: "+5%",
    trend: "up",
    service: "order-service",
    lastSeen: "8 min ago",
  },
];

const metrics = [
  { label: "Total Errors (24h)", value: "1,842", change: "-12%", good: true },
  { label: "Error Rate", value: "0.42%", change: "-0.08%", good: true },
  { label: "Unique Errors", value: "24", change: "+3", good: false },
  { label: "Resolved Today", value: "8", change: "+2", good: true },
];

const cardShadow = "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px";

export function ErrorsContent() {
  const maxCount = funnelData[0].count;

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
              <span className={`text-sm font-medium ${
                metric.good ? "text-success" : "text-destructive"
              }`}>
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Error Trend */}
        <div
          className="bg-card rounded-2xl p-6 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Error Trend</h3>
              <p className="text-sm text-muted-foreground">Errors over time</p>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={errorTrend}>
                <defs>
                  <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.6 0.2 25)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="oklch(0.6 0.2 25)" stopOpacity={0} />
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
                  dataKey="errors"
                  stroke="oklch(0.6 0.2 25)"
                  strokeWidth={2}
                  fill="url(#errorGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Request Funnel */}
        <div
          className="bg-card rounded-2xl p-6 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Request Funnel</h3>
              <p className="text-sm text-muted-foreground">Request processing pipeline</p>
            </div>
          </div>
          <div className="space-y-3">
            {funnelData.map((stage, index) => {
              const widthPercentage = (stage.count / maxCount) * 100;
              const dropoff = index > 0 
                ? ((funnelData[index - 1].count - stage.count) / funnelData[index - 1].count * 100).toFixed(2)
                : null;
              
              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground">{stage.stage}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {stage.count.toLocaleString()}
                      </span>
                      {dropoff && Number(dropoff) > 0 && (
                        <span className="text-xs text-destructive">
                          -{dropoff}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-8 bg-muted rounded-lg overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-lg transition-all duration-500",
                        index === funnelData.length - 1
                          ? "bg-success"
                          : "bg-chart-1"
                      )}
                      style={{ width: `${widthPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Errors */}
      <div
        className="bg-card rounded-2xl border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="p-6 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Top Errors</h3>
          <p className="text-sm text-muted-foreground">Most frequent errors in the last 24 hours</p>
        </div>
        <div className="divide-y divide-border">
          {topErrors.map((error) => (
            <div
              key={error.id}
              className="p-4 hover:bg-muted/30 transition-colors cursor-pointer flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Bug className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground font-mono text-sm">{error.type}</span>
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-muted rounded-full text-muted-foreground">
                    {error.service}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{error.message}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground">{error.count}</p>
                  <p className={cn(
                    "text-xs font-medium flex items-center justify-end gap-0.5",
                    error.trend === "up" ? "text-destructive" : "text-success"
                  )}>
                    {error.trend === "up" ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {error.change}
                  </p>
                </div>
                <div className="text-right w-20">
                  <p className="text-xs text-muted-foreground">{error.lastSeen}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
