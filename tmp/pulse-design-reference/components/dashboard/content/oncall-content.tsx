"use client";

import { Phone, Clock, User, Calendar, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const responseTimeData = [
  { week: "W1", ack: 2.3, resolve: 45 },
  { week: "W2", ack: 1.8, resolve: 38 },
  { week: "W3", ack: 3.1, resolve: 52 },
  { week: "W4", ack: 2.1, resolve: 41 },
];

const currentSchedule = [
  {
    name: "Sarah Miller",
    initials: "SM",
    role: "Primary",
    shift: "Mon-Fri 9AM-5PM",
    status: "active",
  },
  {
    name: "Mike Chen",
    initials: "MC",
    role: "Secondary",
    shift: "Mon-Fri 9AM-5PM",
    status: "standby",
  },
  {
    name: "Lisa Park",
    initials: "LP",
    role: "Primary",
    shift: "Mon-Fri 5PM-9AM",
    status: "upcoming",
  },
  {
    name: "Tom Wilson",
    initials: "TW",
    role: "Weekend",
    shift: "Sat-Sun All Day",
    status: "upcoming",
  },
];

const recentPages = [
  {
    id: 1,
    title: "High CPU usage on api-gateway-prod-3",
    severity: "high",
    acknowledged: true,
    ackTime: "1m 23s",
    assignee: "Sarah Miller",
    timestamp: "10:32 AM",
    resolved: false,
  },
  {
    id: 2,
    title: "Database connection pool exhausted",
    severity: "critical",
    acknowledged: true,
    ackTime: "45s",
    assignee: "Sarah Miller",
    timestamp: "09:47 AM",
    resolved: true,
  },
  {
    id: 3,
    title: "Memory leak detected in user-service",
    severity: "medium",
    acknowledged: true,
    ackTime: "2m 12s",
    assignee: "Mike Chen",
    timestamp: "Yesterday",
    resolved: true,
  },
  {
    id: 4,
    title: "SSL certificate expiring in 7 days",
    severity: "low",
    acknowledged: true,
    ackTime: "5m 34s",
    assignee: "Lisa Park",
    timestamp: "Yesterday",
    resolved: true,
  },
];

const metrics = [
  { label: "Avg Ack Time", value: "2.1m", change: "-23%", good: true },
  { label: "Avg Resolve Time", value: "41m", change: "-15%", good: true },
  { label: "Pages This Week", value: "12", change: "-4", good: true },
  { label: "Escalations", value: "2", change: "+1", good: false },
];

const cardShadow = "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px";

export function OncallContent() {
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
                <TrendingDown className="w-4 h-4" />
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Current Schedule */}
        <div
          className="bg-card rounded-2xl border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <div className="p-6 border-b border-border">
            <h3 className="text-base font-semibold text-foreground">Current Schedule</h3>
            <p className="text-sm text-muted-foreground">On-call rotation this week</p>
          </div>
          <div className="p-4 space-y-3">
            {currentSchedule.map((person) => (
              <div
                key={person.name}
                className={cn(
                  "p-4 rounded-xl transition-colors",
                  person.status === "active" ? "bg-success/5 border border-success/20" : "bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium",
                      person.status === "active"
                        ? "bg-success/20 text-success"
                        : person.status === "standby"
                          ? "bg-warning/20 text-warning"
                          : "bg-muted text-muted-foreground"
                    )}>
                      {person.initials}
                    </div>
                    {person.status === "active" && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{person.name}</p>
                    <p className="text-xs text-muted-foreground">{person.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{person.shift}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Response Time Chart */}
        <div
          className="col-span-2 bg-card rounded-2xl p-6 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Response Times</h3>
              <p className="text-sm text-muted-foreground">Ack time (min) vs Resolve time (min)</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-1" />
                <span className="text-muted-foreground">Acknowledge</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-chart-2" />
                <span className="text-muted-foreground">Resolve</span>
              </div>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                <XAxis 
                  dataKey="week" 
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
                <Bar dataKey="ack" fill="oklch(0.55 0.18 250)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolve" fill="oklch(0.65 0.15 155)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Pages */}
      <div
        className="bg-card rounded-2xl border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="p-6 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Recent Pages</h3>
          <p className="text-sm text-muted-foreground">Latest alerts and incidents</p>
        </div>
        <div className="divide-y divide-border">
          {recentPages.map((page) => (
            <div key={page.id} className="p-4 flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                page.resolved ? "bg-success/10" : "bg-warning/10"
              )}>
                {page.resolved ? (
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-warning" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full",
                    page.severity === "critical"
                      ? "bg-destructive/20 text-destructive"
                      : page.severity === "high"
                        ? "bg-warning/20 text-warning"
                        : "bg-muted text-muted-foreground"
                  )}>
                    {page.severity}
                  </span>
                  <span className="text-sm font-medium text-foreground truncate">
                    {page.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Ack: {page.ackTime}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {page.assignee}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{page.timestamp}</p>
                <p className={cn(
                  "text-xs font-medium",
                  page.resolved ? "text-success" : "text-warning"
                )}>
                  {page.resolved ? "Resolved" : "In Progress"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
