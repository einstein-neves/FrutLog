"use client";

import { Shield, CheckCircle, AlertTriangle, Clock } from "lucide-react";
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

const uptimeHistory = [
  { day: "Jan 1", uptime: 99.99 },
  { day: "Jan 5", uptime: 99.95 },
  { day: "Jan 10", uptime: 100 },
  { day: "Jan 15", uptime: 99.98 },
  { day: "Jan 20", uptime: 99.87 },
  { day: "Jan 25", uptime: 99.99 },
  { day: "Jan 30", uptime: 99.98 },
];

const slaMetrics = [
  { label: "Current Uptime", value: "99.98%", target: "99.9%", status: "met" },
  { label: "Avg Response Time", value: "142ms", target: "<200ms", status: "met" },
  { label: "Error Rate", value: "0.42%", target: "<1%", status: "met" },
  { label: "Apdex Score", value: "0.94", target: ">0.9", status: "met" },
];

const services = [
  {
    name: "API Gateway",
    uptime: 99.99,
    target: 99.9,
    incidents: 0,
    downtime: "0m",
    status: "operational",
  },
  {
    name: "Auth Service",
    uptime: 99.97,
    target: 99.9,
    incidents: 1,
    downtime: "13m",
    status: "operational",
  },
  {
    name: "Payment Service",
    uptime: 99.85,
    target: 99.9,
    incidents: 2,
    downtime: "45m",
    status: "degraded",
  },
  {
    name: "User Service",
    uptime: 100,
    target: 99.5,
    incidents: 0,
    downtime: "0m",
    status: "operational",
  },
  {
    name: "Order Service",
    uptime: 99.92,
    target: 99.5,
    incidents: 1,
    downtime: "24m",
    status: "operational",
  },
  {
    name: "Notification Service",
    uptime: 99.98,
    target: 99.0,
    incidents: 0,
    downtime: "6m",
    status: "operational",
  },
];

const recentOutages = [
  {
    id: 1,
    service: "Payment Service",
    duration: "23m",
    impact: "Partial checkout failures",
    date: "Jan 28, 2024",
    resolved: true,
  },
  {
    id: 2,
    service: "Payment Service",
    duration: "22m",
    impact: "Gateway timeout errors",
    date: "Jan 25, 2024",
    resolved: true,
  },
  {
    id: 3,
    service: "Auth Service",
    duration: "13m",
    impact: "Login delays",
    date: "Jan 20, 2024",
    resolved: true,
  },
  {
    id: 4,
    service: "Order Service",
    duration: "24m",
    impact: "Order processing delays",
    date: "Jan 15, 2024",
    resolved: true,
  },
];

const cardShadow = "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px";

export function SlaContent() {
  return (
    <div className="space-y-6">
      {/* SLA Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        {slaMetrics.map((metric) => (
          <div
            key={metric.label}
            className="bg-card rounded-2xl p-5 border border-border"
            style={{ boxShadow: cardShadow }}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center",
                metric.status === "met" ? "bg-success/10" : "bg-warning/10"
              )}>
                {metric.status === "met" ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-warning" />
                )}
              </div>
            </div>
            <p className="text-2xl font-semibold text-foreground mb-1">{metric.value}</p>
            <p className="text-xs text-muted-foreground">Target: {metric.target}</p>
          </div>
        ))}
      </div>

      {/* Uptime Chart */}
      <div
        className="bg-card rounded-2xl p-6 border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">Uptime History</h3>
            <p className="text-sm text-muted-foreground">30-day uptime trend</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 rounded-full">
            <div className="w-2 h-2 bg-success rounded-full" />
            <span className="text-sm font-medium text-success">99.98% average</span>
          </div>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={uptimeHistory}>
              <defs>
                <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.6 0.17 155)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.6 0.17 155)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
              <XAxis 
                dataKey="day" 
                tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
                axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
              />
              <YAxis 
                domain={[99.5, 100]}
                tick={{ fill: "oklch(0.55 0.01 250)", fontSize: 12 }}
                axisLine={{ stroke: "oklch(0.92 0.005 250)" }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid oklch(0.92 0.005 250)",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
                formatter={(value: number) => [`${value}%`, "Uptime"]}
              />
              <Area
                type="monotone"
                dataKey="uptime"
                stroke="oklch(0.6 0.17 155)"
                strokeWidth={2}
                fill="url(#uptimeGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Service SLA Status */}
        <div
          className="bg-card rounded-2xl border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <div className="p-6 border-b border-border">
            <h3 className="text-base font-semibold text-foreground">Service SLA Status</h3>
            <p className="text-sm text-muted-foreground">Current month performance</p>
          </div>
          <div className="divide-y divide-border">
            {services.map((service) => (
              <div key={service.name} className="p-4 flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  service.status === "operational" ? "bg-success/10" : "bg-warning/10"
                )}>
                  <Shield className={cn(
                    "w-5 h-5",
                    service.status === "operational" ? "text-success" : "text-warning"
                  )} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{service.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {service.incidents} incidents • {service.downtime} downtime
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-lg font-semibold",
                    service.uptime >= service.target ? "text-success" : "text-warning"
                  )}>
                    {service.uptime}%
                  </p>
                  <p className="text-xs text-muted-foreground">/ {service.target}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Outages */}
        <div
          className="bg-card rounded-2xl border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <div className="p-6 border-b border-border">
            <h3 className="text-base font-semibold text-foreground">Recent Outages</h3>
            <p className="text-sm text-muted-foreground">Resolved incidents affecting SLA</p>
          </div>
          <div className="divide-y divide-border">
            {recentOutages.map((outage) => (
              <div key={outage.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{outage.service}</span>
                  <span className="text-xs text-muted-foreground">{outage.date}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{outage.impact}</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {outage.duration}
                  </div>
                  {outage.resolved && (
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-success/10 text-success rounded-full">
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
