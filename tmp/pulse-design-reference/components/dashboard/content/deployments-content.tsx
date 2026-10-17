"use client";

import { CheckCircle, XCircle, Clock, GitBranch, User, MoreHorizontal, Rocket } from "lucide-react";
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

const deploymentFrequency = [
  { day: "Mon", deploys: 12 },
  { day: "Tue", deploys: 18 },
  { day: "Wed", deploys: 15 },
  { day: "Thu", deploys: 22 },
  { day: "Fri", deploys: 19 },
  { day: "Sat", deploys: 5 },
  { day: "Sun", deploys: 3 },
];

const deployments = [
  {
    id: "DEP-1234",
    service: "api-gateway",
    version: "v2.3.1",
    status: "success",
    environment: "production",
    duration: "2m 34s",
    timestamp: "10 min ago",
    author: "Sarah Miller",
    authorInitials: "SM",
    commit: "feat: add rate limiting",
    commitHash: "a3b4c5d",
  },
  {
    id: "DEP-1233",
    service: "user-service",
    version: "v1.8.0",
    status: "success",
    environment: "production",
    duration: "3m 12s",
    timestamp: "45 min ago",
    author: "Mike Chen",
    authorInitials: "MC",
    commit: "fix: resolve auth token refresh",
    commitHash: "f6g7h8i",
  },
  {
    id: "DEP-1232",
    service: "checkout-api",
    version: "v3.1.2",
    status: "failed",
    environment: "staging",
    duration: "1m 45s",
    timestamp: "1 hour ago",
    author: "Lisa Park",
    authorInitials: "LP",
    commit: "chore: update dependencies",
    commitHash: "j9k0l1m",
  },
  {
    id: "DEP-1231",
    service: "notification-service",
    version: "v2.0.5",
    status: "success",
    environment: "production",
    duration: "2m 08s",
    timestamp: "2 hours ago",
    author: "Tom Wilson",
    authorInitials: "TW",
    commit: "feat: add email templates",
    commitHash: "n2o3p4q",
  },
  {
    id: "DEP-1230",
    service: "analytics-api",
    version: "v1.4.0",
    status: "success",
    environment: "production",
    duration: "4m 21s",
    timestamp: "3 hours ago",
    author: "Sarah Miller",
    authorInitials: "SM",
    commit: "feat: add new metrics endpoint",
    commitHash: "r5s6t7u",
  },
  {
    id: "DEP-1229",
    service: "payment-service",
    version: "v2.2.1",
    status: "rollback",
    environment: "production",
    duration: "5m 12s",
    timestamp: "4 hours ago",
    author: "Mike Chen",
    authorInitials: "MC",
    commit: "feat: add Apple Pay support",
    commitHash: "v8w9x0y",
  },
];

const metrics = [
  { label: "Deploys Today", value: "8", change: "+3" },
  { label: "Success Rate", value: "94%", change: "+2%" },
  { label: "Avg Duration", value: "2m 45s", change: "-15s" },
  { label: "Rollbacks", value: "1", change: "0" },
];

const cardShadow = "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px";

export function DeploymentsContent() {
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
              <span className="text-sm text-success font-medium">{metric.change}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Deploy Frequency Chart */}
      <div
        className="bg-card rounded-2xl p-6 border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">Deployment Frequency</h3>
            <p className="text-sm text-muted-foreground">Deploys per day this week</p>
          </div>
        </div>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={deploymentFrequency}>
              <defs>
                <linearGradient id="deployGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.15 155)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.65 0.15 155)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
              <XAxis 
                dataKey="day" 
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
                dataKey="deploys"
                stroke="oklch(0.65 0.15 155)"
                strokeWidth={2}
                fill="url(#deployGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Deployments */}
      <div
        className="bg-card rounded-2xl border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="p-6 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Recent Deployments</h3>
        </div>
        <div className="divide-y divide-border">
          {deployments.map((deploy) => (
            <div
              key={deploy.id}
              className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {/* Status Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  deploy.status === "success" 
                    ? "bg-success/10"
                    : deploy.status === "failed"
                      ? "bg-destructive/10"
                      : "bg-warning/10"
                )}>
                  {deploy.status === "success" ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : deploy.status === "failed" ? (
                    <XCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <Rocket className="w-5 h-5 text-warning" />
                  )}
                </div>

                {/* Service Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">{deploy.service}</span>
                    <span className="text-xs font-mono text-muted-foreground">{deploy.version}</span>
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] font-medium rounded-full",
                      deploy.environment === "production"
                        ? "bg-chart-1/10 text-chart-1"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {deploy.environment}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GitBranch className="w-3 h-3" />
                    <span className="truncate">{deploy.commit}</span>
                    <span className="font-mono text-xs">({deploy.commitHash})</span>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{deploy.duration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-chart-1/20 flex items-center justify-center text-xs font-medium text-chart-1">
                      {deploy.authorInitials}
                    </div>
                    <span className="text-muted-foreground">{deploy.author}</span>
                  </div>
                  <span className="text-muted-foreground w-24 text-right">{deploy.timestamp}</span>
                  <button type="button" className="p-1 hover:bg-muted rounded-lg">
                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
