"use client";

import { useState } from "react";
import { AlertTriangle, Clock, User, ExternalLink, CheckCircle, XCircle, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const incidents = [
  {
    id: "INC-2847",
    title: "Database latency spike in us-east-1",
    description: "PostgreSQL primary experiencing high query times affecting checkout flow",
    severity: "high",
    status: "investigating",
    duration: "23 min",
    assignee: "Sarah Miller",
    assigneeInitials: "SM",
    impactedServices: ["checkout-api", "payment-service", "order-service"],
    timeline: [
      { time: "10:32", event: "Alert triggered", type: "alert" },
      { time: "10:35", event: "On-call notified", type: "notification" },
      { time: "10:38", event: "Investigation started", type: "action" },
    ],
  },
  {
    id: "INC-2846",
    title: "Payment gateway timeout errors",
    description: "Stripe API returning 504 errors on 15% of transactions",
    severity: "critical",
    status: "mitigating",
    duration: "45 min",
    assignee: "Mike Chen",
    assigneeInitials: "MC",
    impactedServices: ["payment-service", "checkout-api"],
    timeline: [
      { time: "09:47", event: "Alert triggered", type: "alert" },
      { time: "09:50", event: "On-call notified", type: "notification" },
      { time: "09:55", event: "Root cause identified", type: "action" },
      { time: "10:10", event: "Mitigation in progress", type: "action" },
    ],
  },
  {
    id: "INC-2845",
    title: "CDN cache invalidation delay",
    description: "CloudFront not propagating cache invalidations to edge locations",
    severity: "medium",
    status: "monitoring",
    duration: "1h 12m",
    assignee: "Lisa Park",
    assigneeInitials: "LP",
    impactedServices: ["cdn", "static-assets"],
    timeline: [
      { time: "08:20", event: "Alert triggered", type: "alert" },
      { time: "08:25", event: "Workaround applied", type: "action" },
      { time: "09:15", event: "Monitoring resolution", type: "action" },
    ],
  },
  {
    id: "INC-2844",
    title: "Auth service memory leak",
    description: "Memory usage steadily increasing requiring periodic restarts",
    severity: "low",
    status: "resolved",
    duration: "4h 32m",
    assignee: "Tom Wilson",
    assigneeInitials: "TW",
    impactedServices: ["auth-service"],
    timeline: [
      { time: "04:15", event: "Alert triggered", type: "alert" },
      { time: "08:47", event: "Hotfix deployed", type: "action" },
    ],
  },
];

const statusConfig = {
  investigating: { label: "Investigating", color: "bg-warning/20 text-warning" },
  mitigating: { label: "Mitigating", color: "bg-chart-1/20 text-chart-1" },
  monitoring: { label: "Monitoring", color: "bg-info/20 text-info" },
  resolved: { label: "Resolved", color: "bg-success/20 text-success" },
};

const severityConfig = {
  critical: { label: "Critical", color: "bg-destructive text-destructive-foreground" },
  high: { label: "High", color: "bg-warning/20 text-warning" },
  medium: { label: "Medium", color: "bg-muted text-muted-foreground" },
  low: { label: "Low", color: "bg-muted text-muted-foreground" },
};

const cardShadow = "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px";

export function IncidentsContent() {
  const [selectedIncident, setSelectedIncident] = useState(incidents[0]);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredIncidents = filterStatus === "all" 
    ? incidents 
    : incidents.filter(i => i.status === filterStatus);

  return (
    <div className="flex gap-6 h-[calc(100vh-180px)]">
      {/* Incidents List */}
      <div className="w-[400px] flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search incidents..." className="pl-9" />
          </div>
          <Button variant="outline" size="icon" className="shrink-0 bg-transparent">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          {["all", "investigating", "mitigating", "monitoring", "resolved"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors capitalize",
                filterStatus === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {filteredIncidents.map((incident) => (
            <button
              key={incident.id}
              type="button"
              onClick={() => setSelectedIncident(incident)}
              className={cn(
                "w-full text-left p-4 rounded-2xl border transition-all",
                selectedIncident.id === incident.id
                  ? "bg-card border-primary/30 shadow-md"
                  : "bg-card border-border hover:border-primary/20"
              )}
              style={{ boxShadow: selectedIncident.id === incident.id ? cardShadow : "none" }}
            >
              <div className="flex items-start justify-between mb-2">
                <span className={cn(
                  "px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full",
                  severityConfig[incident.severity as keyof typeof severityConfig].color
                )}>
                  {incident.severity}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{incident.id}</span>
              </div>
              <p className="text-sm font-medium text-foreground mb-2 line-clamp-2">
                {incident.title}
              </p>
              <div className="flex items-center justify-between">
                <span className={cn(
                  "px-2 py-0.5 text-[10px] font-medium rounded-full",
                  statusConfig[incident.status as keyof typeof statusConfig].color
                )}>
                  {statusConfig[incident.status as keyof typeof statusConfig].label}
                </span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {incident.duration}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Incident Detail */}
      <div 
        className="flex-1 bg-card rounded-2xl border border-border p-6 overflow-y-auto"
        style={{ boxShadow: cardShadow }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={cn(
                "px-2.5 py-1 text-xs font-semibold uppercase rounded-full",
                severityConfig[selectedIncident.severity as keyof typeof severityConfig].color
              )}>
                {selectedIncident.severity}
              </span>
              <span className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full",
                statusConfig[selectedIncident.status as keyof typeof statusConfig].color
              )}>
                {statusConfig[selectedIncident.status as keyof typeof statusConfig].label}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-1">
              {selectedIncident.title}
            </h2>
            <p className="text-sm text-muted-foreground font-mono">
              {selectedIncident.id}
            </p>
          </div>
          <Button variant="outline" className="gap-2 bg-transparent">
            <ExternalLink className="w-4 h-4" />
            Open in PagerDuty
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Duration</p>
            <p className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              {selectedIncident.duration}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Assignee</p>
            <p className="text-lg font-semibold text-foreground flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-chart-1/20 flex items-center justify-center text-xs font-medium text-chart-1">
                {selectedIncident.assigneeInitials}
              </div>
              {selectedIncident.assignee}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Impacted Services</p>
            <p className="text-lg font-semibold text-foreground">
              {selectedIncident.impactedServices.length} services
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Description</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {selectedIncident.description}
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Impacted Services</h3>
          <div className="flex flex-wrap gap-2">
            {selectedIncident.impactedServices.map((service) => (
              <span
                key={service}
                className="px-3 py-1.5 text-xs font-medium bg-muted rounded-lg text-foreground"
              >
                {service}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Timeline</h3>
          <div className="space-y-3">
            {selectedIncident.timeline.map((entry, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  entry.type === "alert" 
                    ? "bg-destructive/10" 
                    : entry.type === "notification"
                      ? "bg-warning/10"
                      : "bg-success/10"
                )}>
                  {entry.type === "alert" ? (
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  ) : entry.type === "notification" ? (
                    <User className="w-4 h-4 text-warning" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-success" />
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm text-foreground">{entry.event}</p>
                  <p className="text-xs text-muted-foreground">{entry.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
