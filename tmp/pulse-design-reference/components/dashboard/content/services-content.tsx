"use client";

import { Server, CheckCircle, AlertTriangle, XCircle, ExternalLink, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const services = [
  {
    name: "api-gateway",
    description: "Main API entry point and rate limiting",
    status: "healthy",
    version: "v2.3.1",
    uptime: "99.99%",
    requests: "22.1k/min",
    errorRate: "0.02%",
    latency: "45ms",
    team: "Platform",
    repo: "github.com/acme/api-gateway",
    lastDeploy: "10 min ago",
  },
  {
    name: "auth-service",
    description: "Authentication and authorization",
    status: "healthy",
    version: "v1.8.2",
    uptime: "99.97%",
    requests: "8.4k/min",
    errorRate: "0.05%",
    latency: "23ms",
    team: "Identity",
    repo: "github.com/acme/auth-service",
    lastDeploy: "2 hours ago",
  },
  {
    name: "payment-service",
    description: "Payment processing and billing",
    status: "degraded",
    version: "v2.2.0",
    uptime: "99.85%",
    requests: "3.2k/min",
    errorRate: "0.42%",
    latency: "89ms",
    team: "Payments",
    repo: "github.com/acme/payment-service",
    lastDeploy: "4 hours ago",
  },
  {
    name: "user-service",
    description: "User profile and preferences",
    status: "healthy",
    version: "v1.5.0",
    uptime: "100%",
    requests: "5.6k/min",
    errorRate: "0.01%",
    latency: "34ms",
    team: "Users",
    repo: "github.com/acme/user-service",
    lastDeploy: "1 day ago",
  },
  {
    name: "order-service",
    description: "Order management and fulfillment",
    status: "healthy",
    version: "v3.1.2",
    uptime: "99.92%",
    requests: "4.8k/min",
    errorRate: "0.08%",
    latency: "56ms",
    team: "Commerce",
    repo: "github.com/acme/order-service",
    lastDeploy: "6 hours ago",
  },
  {
    name: "notification-service",
    description: "Email, SMS, and push notifications",
    status: "healthy",
    version: "v2.0.5",
    uptime: "99.98%",
    requests: "12.3k/min",
    errorRate: "0.03%",
    latency: "12ms",
    team: "Communications",
    repo: "github.com/acme/notification-service",
    lastDeploy: "3 hours ago",
  },
  {
    name: "analytics-api",
    description: "Metrics and analytics data",
    status: "healthy",
    version: "v1.4.0",
    uptime: "99.95%",
    requests: "1.2k/min",
    errorRate: "0.02%",
    latency: "78ms",
    team: "Data",
    repo: "github.com/acme/analytics-api",
    lastDeploy: "5 hours ago",
  },
  {
    name: "search-service",
    description: "Full-text search and indexing",
    status: "maintenance",
    version: "v1.2.3",
    uptime: "99.89%",
    requests: "2.1k/min",
    errorRate: "0.12%",
    latency: "145ms",
    team: "Search",
    repo: "github.com/acme/search-service",
    lastDeploy: "2 days ago",
  },
];

const statusConfig = {
  healthy: { label: "Healthy", color: "text-success", bgColor: "bg-success/10", icon: CheckCircle },
  degraded: { label: "Degraded", color: "text-warning", bgColor: "bg-warning/10", icon: AlertTriangle },
  down: { label: "Down", color: "text-destructive", bgColor: "bg-destructive/10", icon: XCircle },
  maintenance: { label: "Maintenance", color: "text-muted-foreground", bgColor: "bg-muted", icon: Server },
};

const cardShadow = "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px";

export function ServicesContent() {
  const healthyCount = services.filter(s => s.status === "healthy").length;
  const degradedCount = services.filter(s => s.status === "degraded").length;
  const downCount = services.filter(s => s.status === "down").length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div
          className="bg-card rounded-2xl p-5 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <p className="text-sm text-muted-foreground mb-1">Total Services</p>
          <p className="text-2xl font-semibold text-foreground">{services.length}</p>
        </div>
        <div
          className="bg-card rounded-2xl p-5 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <p className="text-sm text-muted-foreground mb-1">Healthy</p>
          <p className="text-2xl font-semibold text-success">{healthyCount}</p>
        </div>
        <div
          className="bg-card rounded-2xl p-5 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <p className="text-sm text-muted-foreground mb-1">Degraded</p>
          <p className="text-2xl font-semibold text-warning">{degradedCount}</p>
        </div>
        <div
          className="bg-card rounded-2xl p-5 border border-border"
          style={{ boxShadow: cardShadow }}
        >
          <p className="text-sm text-muted-foreground mb-1">Down</p>
          <p className="text-2xl font-semibold text-destructive">{downCount}</p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-2 gap-4">
        {services.map((service) => {
          const status = statusConfig[service.status as keyof typeof statusConfig];
          const StatusIcon = status.icon;
          
          return (
            <div
              key={service.name}
              className="bg-card rounded-2xl border border-border p-6 hover:border-primary/20 transition-colors"
              style={{ boxShadow: cardShadow }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", status.bgColor)}>
                    <StatusIcon className={cn("w-5 h-5", status.color)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{service.name}</h3>
                    <p className="text-xs text-muted-foreground">{service.description}</p>
                  </div>
                </div>
                <span className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-full",
                  status.bgColor,
                  status.color
                )}>
                  {status.label}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Uptime</p>
                  <p className="text-sm font-semibold text-foreground">{service.uptime}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Requests</p>
                  <p className="text-sm font-semibold text-foreground">{service.requests}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Errors</p>
                  <p className="text-sm font-semibold text-foreground">{service.errorRate}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Latency</p>
                  <p className="text-sm font-semibold text-foreground">{service.latency}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    {service.version}
                  </span>
                  <span>Team: {service.team}</span>
                  <span>Deployed {service.lastDeploy}</span>
                </div>
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                  <ExternalLink className="w-3 h-3" />
                  View
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
