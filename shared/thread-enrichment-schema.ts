// Thread Enrichment Schema
// Type-safe database schema for support queue and SLA tracking
// Security: Multi-tenant isolation, intent classification

import { pgTable, serial, integer, text, timestamp, jsonb, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businessProfiles as businesses } from "./schema";

// Priority levels enum
export const Priority = {
  URGENT: "urgent",
  HIGH: "high",
  NORMAL: "normal",
  LOW: "low",
} as const;

export type Priority = typeof Priority[keyof typeof Priority];

// Coverage status enum
export const CoverageStatus = {
  COVERED: "covered",
  PARTIAL: "partial",
  UNCOVERED: "uncovered",
  UNKNOWN: "unknown",
} as const;

export type CoverageStatus = typeof CoverageStatus[keyof typeof CoverageStatus];

// SLA status enum
export const SLAStatus = {
  ON_TRACK: "on_track",
  AT_RISK: "at_risk",
  BREACHED: "breached",
  RESOLVED: "resolved",
} as const;

export type SLAStatus = typeof SLAStatus[keyof typeof SLAStatus];

// Thread Enrichment Table
export const threadEnrichment = pgTable("thread_enrichment", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().unique(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),

  // Classification
  intent: text("intent"),
  intentConfidence: real("intent_confidence"),
  priority: text("priority").notNull().default(Priority.NORMAL).$type<Priority>(),
  priorityReason: text("priority_reason"),

  // PSKB Coverage Analysis
  coverageStatus: text("coverage_status").notNull().default(CoverageStatus.UNKNOWN).$type<CoverageStatus>(),
  matchedKnowledgeItemIds: jsonb("matched_knowledge_item_ids").$type<number[]>().default(sql`'[]'::jsonb`),
  coverageGaps: jsonb("coverage_gaps").$type<Array<{ topic: string; reason: string }>>().default(sql`'[]'::jsonb`),

  // SLA Tracking
  firstResponseDue: timestamp("first_response_due"),
  resolutionDue: timestamp("resolution_due"),
  slaStatus: text("sla_status").notNull().default(SLAStatus.ON_TRACK).$type<SLAStatus>(),
  firstResponseAt: timestamp("first_response_at"),
  resolvedAt: timestamp("resolved_at"),

  // Metadata
  enrichedAt: timestamp("enriched_at").notNull().defaultNow(),
  enrichedBy: text("enriched_by").notNull().default("system"),
  lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
}, (table) => ({
  businessIdx: index("idx_thread_enrichment_business").on(table.businessId),
  priorityIdx: index("idx_thread_enrichment_priority").on(table.priority),
  coverageIdx: index("idx_thread_enrichment_coverage").on(table.coverageStatus),
  slaIdx: index("idx_thread_enrichment_sla_status").on(table.slaStatus),
  intentIdx: index("idx_thread_enrichment_intent").on(table.intent),
  responseDueIdx: index("idx_thread_enrichment_response_due").on(table.firstResponseDue),
}));

// Type exports
export type ThreadEnrichment = typeof threadEnrichment.$inferSelect;
export type NewThreadEnrichment = typeof threadEnrichment.$inferInsert;

// Intent classification result
export interface IntentClassification {
  intent: string;
  confidence: number;
  priority: Priority;
  priorityReason: string;
  suggestedActions?: string[];
}

// Coverage detection result
export interface CoverageResult {
  status: CoverageStatus;
  matchedKnowledgeItemIds: number[];
  coverageGaps: Array<{ topic: string; reason: string }>;
  confidence: number;
}

// SLA deadlines
export interface SLADeadlines {
  firstResponseDue: Date;
  resolutionDue: Date;
}

// Support queue item (enriched view)
export interface SupportQueueItem {
  enrichmentId: number;
  threadId: number;
  businessId: number;
  intent: string | null;
  priority: Priority;
  coverageStatus: CoverageStatus;
  firstResponseDue: Date | null;
  slaStatus: SLAStatus;
  subject: string | null;
  lastMessageAt: Date | null;
  assignedTo: number | null;
  threadStatus: string | null;
  responseUrgency: "overdue" | "critical" | "soon" | "ok";
}

// Coverage gap analysis
export interface CoverageGapAnalysis {
  businessId: number;
  intent: string;
  coverageStatus: CoverageStatus;
  occurrenceCount: number;
  lastSeen: Date;
  firstSeen: Date;
  affectedThreadIds: number[];
}

// SLA metrics
export interface SLAMetrics {
  businessId: number;
  priority: Priority;
  breachedCount: number;
  atRiskCount: number;
  onTrackCount: number;
  resolvedCount: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionHours: number | null;
}

// Helper function to calculate SLA deadlines
export function calculateSLADeadlines(priority: Priority, createdAt: Date = new Date()): SLADeadlines {
  const firstResponseHours: Record<Priority, number> = {
    urgent: 1,
    high: 2,
    normal: 4,
    low: 8,
  };

  const resolutionHours: Record<Priority, number> = {
    urgent: 24,
    high: 48,
    normal: 72,
    low: 120,
  };

  return {
    firstResponseDue: new Date(createdAt.getTime() + firstResponseHours[priority] * 60 * 60 * 1000),
    resolutionDue: new Date(createdAt.getTime() + resolutionHours[priority] * 60 * 60 * 1000),
  };
}

// Helper function to determine priority from signals
export function determinePriority(signals: {
  hasUrgentKeywords?: boolean;
  customerSentiment?: "angry" | "frustrated" | "neutral" | "satisfied";
  isHighValue?: boolean;
  isEscalated?: boolean;
  daysSinceLastContact?: number;
}): Priority {
  if (signals.isEscalated || signals.hasUrgentKeywords) {
    return Priority.URGENT;
  }

  if (signals.customerSentiment === "angry" || signals.isHighValue) {
    return Priority.HIGH;
  }

  if (signals.customerSentiment === "frustrated" || (signals.daysSinceLastContact && signals.daysSinceLastContact > 7)) {
    return Priority.HIGH;
  }

  return Priority.NORMAL;
}

// Relations for type-safe queries
export const threadEnrichmentRelations = {
  business: {
    fields: [threadEnrichment.businessId],
    references: [businesses.id],
  },
};
