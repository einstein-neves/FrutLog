import React from "react"
export type NavigationSection = 
  | 'overview'
  | 'pipeline'
  | 'insights'
  | 'analytics'
  | 'participants'
  | 'reports'
  | 'settings';

export interface NavigationItem {
  id: NavigationSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export interface Study {
  id: string;
  title: string;
  status: 'planning' | 'recruiting' | 'in-progress' | 'analysis' | 'completed' | 'blocked';
  type: 'usability' | 'interview' | 'survey' | 'diary' | 'card-sort' | 'a-b-test';
  owner: string;
  ownerAvatar: string;
  participants: { target: number; current: number };
  dueDate: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface Insight {
  id: string;
  title: string;
  summary: string;
  studyId: string;
  studyName: string;
  confidence: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  themes: string[];
  createdAt: string;
  createdBy: string;
  createdByAvatar: string;
  linkedProducts: string[];
  evidenceCount: number;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  avatar: string;
  segment: string;
  studiesParticipated: number;
  lastActivity: string;
  status: 'active' | 'inactive' | 'opted-out' | 'pending';
  tags: string[];
}

export interface MetricCard {
  label: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down' | 'neutral';
  };
  period?: string;
}

export interface ThemeCluster {
  name: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ProductImpact {
  metric: string;
  value: string;
  change: number;
  linkedInsights: number;
}

export interface TimeFilter {
  label: string;
  value: '7d' | '30d' | '90d' | 'ytd' | 'all';
}
