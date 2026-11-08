"use client";

import { FileText, Clock, User, Tag, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const postmortems = [
  {
    id: "PM-2024-012",
    title: "Payment Gateway Outage",
    incident: "INC-2846",
    severity: "critical",
    duration: "45 minutes",
    date: "Jan 28, 2024",
    author: "Mike Chen",
    authorInitials: "MC",
    status: "published",
    impact: "15% of checkout transactions failed",
    rootCause: "Stripe API rate limiting due to retry storm",
    actionItems: 5,
    completedItems: 3,
    tags: ["payments", "external-dependency", "rate-limiting"],
  },
  {
    id: "PM-2024-011",
    title: "Database Connection Pool Exhaustion",
    incident: "INC-2839",
    severity: "high",
    duration: "23 minutes",
    date: "Jan 25, 2024",
    author: "Sarah Miller",
    authorInitials: "SM",
    status: "published",
    impact: "API latency increased 10x for all services",
    rootCause: "Connection leak in user-service after v1.7.0 deploy",
    actionItems: 4,
    completedItems: 4,
    tags: ["database", "connection-pool", "memory-leak"],
  },
  {
    id: "PM-2024-010",
    title: "CDN Cache Invalidation Failure",
    incident: "INC-2832",
    severity: "medium",
    duration: "1h 12m",
    date: "Jan 20, 2024",
    author: "Lisa Park",
    authorInitials: "LP",
    status: "draft",
    impact: "Stale content served to 5% of users",
    rootCause: "CloudFront invalidation API timeout",
    actionItems: 3,
    completedItems: 1,
    tags: ["cdn", "caching", "aws"],
  },
  {
    id: "PM-2024-009",
    title: "Authentication Service Memory Leak",
    incident: "INC-2825",
    severity: "high",
    duration: "4h 32m",
    date: "Jan 15, 2024",
    author: "Tom Wilson",
    authorInitials: "TW",
    status: "published",
    impact: "Periodic auth failures every 6 hours",
    rootCause: "JWT validation caching unbounded growth",
    actionItems: 6,
    completedItems: 6,
    tags: ["auth", "memory-leak", "caching"],
  },
  {
    id: "PM-2024-008",
    title: "Order Service Deployment Rollback",
    incident: "INC-2818",
    severity: "medium",
    duration: "18 minutes",
    date: "Jan 10, 2024",
    author: "Sarah Miller",
    authorInitials: "SM",
    status: "published",
    impact: "Order processing halted temporarily",
    rootCause: "Breaking API change in inventory integration",
    actionItems: 4,
    completedItems: 4,
    tags: ["deployment", "api-compatibility", "rollback"],
  },
];

const metrics = [
  { label: "Total Postmortems", value: "24", period: "Last 90 days" },
  { label: "Avg MTTR", value: "47m", period: "Improving" },
  { label: "Action Items Open", value: "8", period: "Across all PMs" },
  { label: "Recurring Issues", value: "2", period: "Need attention" },
];

const cardShadow = "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px";

export function PostmortemsContent() {
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
            <p className="text-2xl font-semibold text-foreground mb-1">{metric.value}</p>
            <p className="text-xs text-muted-foreground">{metric.period}</p>
          </div>
        ))}
      </div>

      {/* Postmortems List */}
      <div
        className="bg-card rounded-2xl border border-border"
        style={{ boxShadow: cardShadow }}
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Incident Postmortems</h3>
            <p className="text-sm text-muted-foreground">Review and learn from past incidents</p>
          </div>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New Postmortem
          </Button>
        </div>
        <div className="divide-y divide-border">
          {postmortems.map((pm) => (
            <div
              key={pm.id}
              className="p-6 hover:bg-muted/20 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  pm.severity === "critical"
                    ? "bg-destructive/10"
                    : pm.severity === "high"
                      ? "bg-warning/10"
                      : "bg-muted"
                )}>
                  <FileText className={cn(
                    "w-5 h-5",
                    pm.severity === "critical"
                      ? "text-destructive"
                      : pm.severity === "high"
                        ? "text-warning"
                        : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground">{pm.title}</h4>
                    <span className={cn(
                      "px-2 py-0.5 text-[10px] font-medium rounded-full",
                      pm.status === "published"
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    )}>
                      {pm.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{pm.impact}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Duration: {pm.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {pm.author}
                    </span>
                    <span className="font-mono">{pm.incident}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pm.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-[10px] font-medium bg-muted rounded-md text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-muted-foreground mb-2">{pm.date}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full"
                        style={{ width: `${(pm.completedItems / pm.actionItems) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {pm.completedItems}/{pm.actionItems}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
