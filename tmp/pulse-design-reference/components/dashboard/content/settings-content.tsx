"use client";

import { cn } from "@/lib/utils";
import { User, Bell, Lock, Palette, Users, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const settingsSections = [
  {
    id: "profile",
    label: "Profile",
    description: "Manage your personal information",
    icon: User,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Configure how you receive updates",
    icon: Bell,
  },
  {
    id: "security",
    label: "Security",
    description: "Password and authentication settings",
    icon: Lock,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Customize the look and feel",
    icon: Palette,
  },
  {
    id: "team",
    label: "Team",
    description: "Manage team members and roles",
    icon: Users,
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Connect with other tools",
    icon: Zap,
  },
];

const integrations = [
  { name: "PagerDuty", connected: true, icon: "PD" },
  { name: "Slack", connected: true, icon: "S" },
  { name: "Datadog", connected: true, icon: "DD" },
  { name: "GitHub", connected: true, icon: "GH" },
  { name: "Jira", connected: false, icon: "J" },
];

export function SettingsContent() {
  return (
    <div className="max-w-4xl space-y-6">
      {/* Profile Section */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6">Profile Settings</h3>
        
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-chart-1/10 text-chart-1 flex items-center justify-center text-2xl font-semibold">
            JD
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  defaultValue="John"
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  defaultValue="Doe"
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">Email</label>
                <input
                  type="email"
                  id="email"
                  defaultValue="john.doe@company.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="role" className="block text-sm font-medium text-foreground mb-2">Role</label>
                <input
                  type="text"
                  id="role"
                  defaultValue="SRE Lead"
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button>Save Changes</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Settings */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <h3 className="font-semibold text-foreground p-6 pb-4">Quick Settings</h3>
        <div className="divide-y divide-border">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                className="w-full flex items-center gap-4 p-6 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm">{section.label}</p>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Integrations */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6">Integrations</h3>
        <div className="space-y-3">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center gap-4 p-4 rounded-xl bg-muted/30"
            >
              <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center text-sm font-semibold text-foreground">
                {integration.icon}
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">{integration.name}</p>
                <p className="text-xs text-muted-foreground">
                  {integration.connected ? "Connected" : "Not connected"}
                </p>
              </div>
              <Button
                variant={integration.connected ? "outline" : "default"}
                size="sm"
                className={cn(integration.connected && "bg-transparent")}
              >
                {integration.connected ? "Disconnect" : "Connect"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
