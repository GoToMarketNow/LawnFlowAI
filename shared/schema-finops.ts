/**
 * FinOps Schema
 *
 * Database schema for FinOps and Memory/RAG:
 * - usage_ledger: Token and cost tracking
 * - budget_configs: Per-business budget limits
 * - budget_alerts: Budget alert history
 * - model_routing_rules: Custom model routing
 * - memory_docs: RAG document storage
 * - workflow_summaries: Post-workflow summaries
 *
 * @module shared/schema-finops
 */

import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  jsonb,
  boolean,
  numeric,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { businessProfiles, users } from "./schema";
import { workflowRuns, workflowSteps } from "./schema-temporal";

// ============================================================================
// Enums and Types
// ============================================================================

export const BudgetExceededBehavior = {
  DOWNGRADE: 'downgrade',
  BLOCK: 'block',
  ALERT_ONLY: 'alert_only',
} as const;

export const AlertType = {
  WARNING: 'warning',
  CRITICAL: 'critical',
  EXCEEDED: 'exceeded',
  DAILY_LIMIT: 'daily_limit',
  RATE_LIMIT: 'rate_limit',
} as const;

export const DocType = {
  CONVERSATION_SUMMARY: 'conversation_summary',
  JOB_SUMMARY: 'job_summary',
  CUSTOMER_PREFERENCE: 'customer_preference',
  SERVICE_HISTORY: 'service_history',
  COMPLAINT_RESOLUTION: 'complaint_resolution',
  POLICY_DOCUMENT: 'policy_document',
  FAQ: 'faq',
  CUSTOM: 'custom',
} as const;

export const ModelProvider = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  AZURE: 'azure',
} as const;

// ============================================================================
// usage_ledger: Token and cost tracking
// ============================================================================

export const usageLedger = pgTable("usage_ledger", {
  id: serial("id").primaryKey(),

  // Business context
  businessId: integer("business_id").references(() => businessProfiles.id, { onDelete: 'cascade' }),
  accountId: text("account_id").notNull(),

  // Workflow context
  workflowRunId: integer("workflow_run_id").references(() => workflowRuns.id, { onDelete: 'set null' }),
  workflowStepId: integer("workflow_step_id").references(() => workflowSteps.id, { onDelete: 'set null' }),

  // Activity identification
  activityType: text("activity_type").notNull(),
  activityName: text("activity_name"),

  // Model information
  modelProvider: text("model_provider").notNull(),
  modelId: text("model_id").notNull(),

  // Token counts
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),

  // Cost (microdollars)
  costMicrodollars: integer("cost_microdollars").default(0),

  // Request metadata
  traceId: text("trace_id").notNull(),
  requestId: text("request_id"),

  // Timing
  requestTimestamp: timestamp("request_timestamp", { withTimezone: true }).defaultNow(),
  responseTimestamp: timestamp("response_timestamp", { withTimezone: true }),
  latencyMs: integer("latency_ms"),

  // Additional context
  metadata: jsonb("metadata").default({}),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  businessIdIdx: index("idx_usage_ledger_business_id").on(table.businessId),
  accountIdIdx: index("idx_usage_ledger_account_id").on(table.accountId),
  workflowRunIdIdx: index("idx_usage_ledger_workflow_run_id").on(table.workflowRunId),
  requestTimestampIdx: index("idx_usage_ledger_request_timestamp").on(table.requestTimestamp),
  traceIdIdx: index("idx_usage_ledger_trace_id").on(table.traceId),
}));

// ============================================================================
// budget_configs: Per-business budget limits
// ============================================================================

export const budgetConfigs = pgTable("budget_configs", {
  id: serial("id").primaryKey(),

  businessId: integer("business_id").references(() => businessProfiles.id, { onDelete: 'cascade' }).unique(),
  accountId: text("account_id").notNull(),

  // Monthly budget (microdollars)
  monthlyBudgetMicrodollars: integer("monthly_budget_microdollars").default(10000000), // $10 default

  // Alert thresholds
  warningThresholdPercent: integer("warning_threshold_percent").default(80),
  criticalThresholdPercent: integer("critical_threshold_percent").default(95),
  hardCapPercent: integer("hard_cap_percent").default(100),

  // Model preferences
  preferredModel: text("preferred_model").default('gpt-4o-mini'),
  fallbackModel: text("fallback_model").default('gpt-3.5-turbo'),
  allowPremiumModels: boolean("allow_premium_models").default(false),
  premiumModels: jsonb("premium_models").default(['gpt-4o', 'claude-3-opus', 'claude-3-5-sonnet']),

  // Budget exceeded behavior
  onBudgetExceeded: text("on_budget_exceeded").default('downgrade'),

  // Daily limits
  dailyLimitMicrodollars: integer("daily_limit_microdollars"),

  // Per-workflow limits
  perWorkflowLimitMicrodollars: integer("per_workflow_limit_microdollars"),

  // Rate limiting
  maxRequestsPerMinute: integer("max_requests_per_minute").default(60),
  maxTokensPerMinute: integer("max_tokens_per_minute").default(100000),

  // Notification settings
  alertEmail: text("alert_email"),
  alertWebhookUrl: text("alert_webhook_url"),

  // Status
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ============================================================================
// budget_alerts: Budget alert history
// ============================================================================

export const budgetAlerts = pgTable("budget_alerts", {
  id: serial("id").primaryKey(),

  businessId: integer("business_id").references(() => businessProfiles.id, { onDelete: 'cascade' }),
  accountId: text("account_id").notNull(),

  // Alert details
  alertType: text("alert_type").notNull(),
  thresholdPercent: integer("threshold_percent"),
  currentUsageMicrodollars: integer("current_usage_microdollars").notNull(),
  budgetLimitMicrodollars: integer("budget_limit_microdollars").notNull(),

  // Period
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),

  // Resolution
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  acknowledgedByUserId: integer("acknowledged_by_user_id").references(() => users.id),

  // Notification status
  notificationSent: boolean("notification_sent").default(false),
  notificationSentAt: timestamp("notification_sent_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  businessIdIdx: index("idx_budget_alerts_business_id").on(table.businessId),
  createdAtIdx: index("idx_budget_alerts_created_at").on(table.createdAt),
}));

// ============================================================================
// model_routing_rules: Custom model routing
// ============================================================================

export const modelRoutingRules = pgTable("model_routing_rules", {
  id: serial("id").primaryKey(),

  businessId: integer("business_id").references(() => businessProfiles.id, { onDelete: 'cascade' }),
  accountId: text("account_id").notNull(),

  ruleName: text("rule_name").notNull(),
  priority: integer("priority").default(0),

  // Matching conditions
  conditions: jsonb("conditions").default({}).notNull(),

  // Model selection
  modelId: text("model_id").notNull(),
  modelProvider: text("model_provider").notNull(),

  // Cost control
  maxTokens: integer("max_tokens"),
  temperature: numeric("temperature", { precision: 3, scale: 2 }).default('0.7'),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  businessIdIdx: index("idx_model_routing_rules_business_id").on(table.businessId),
}));

// ============================================================================
// memory_docs: RAG document storage
// ============================================================================

export const memoryDocs = pgTable("memory_docs", {
  id: serial("id").primaryKey(),

  businessId: integer("business_id").references(() => businessProfiles.id, { onDelete: 'cascade' }),
  accountId: text("account_id").notNull(),
  customerId: integer("customer_id"),

  // Document identification
  docType: text("doc_type").notNull(),

  // Content
  title: text("title"),
  content: text("content").notNull(),

  // Embedding (stored as JSON array)
  embedding: jsonb("embedding"),
  embeddingModel: text("embedding_model").default('text-embedding-3-small'),

  // Source tracking
  sourceEntityType: text("source_entity_type"),
  sourceEntityId: integer("source_entity_id"),
  sourceWorkflowId: text("source_workflow_id"),

  // Metadata
  tags: jsonb("tags").default([]),
  metadata: jsonb("metadata").default({}),

  // Relevance
  importanceScore: numeric("importance_score", { precision: 3, scale: 2 }).default('0.5'),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  accessCount: integer("access_count").default(0),

  // TTL
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  businessIdIdx: index("idx_memory_docs_business_id").on(table.businessId),
  customerIdIdx: index("idx_memory_docs_customer_id").on(table.customerId),
  docTypeIdx: index("idx_memory_docs_doc_type").on(table.docType),
  sourceIdx: index("idx_memory_docs_source").on(table.sourceEntityType, table.sourceEntityId),
}));

// ============================================================================
// workflow_summaries: Post-workflow summaries
// ============================================================================

export const workflowSummaries = pgTable("workflow_summaries", {
  id: serial("id").primaryKey(),

  workflowRunId: integer("workflow_run_id").references(() => workflowRuns.id, { onDelete: 'cascade' }).unique(),
  workflowId: text("workflow_id").notNull(),
  workflowType: text("workflow_type").notNull(),

  businessId: integer("business_id").references(() => businessProfiles.id, { onDelete: 'cascade' }),
  accountId: text("account_id").notNull(),

  // Entity context
  primaryEntityType: text("primary_entity_type"),
  primaryEntityId: integer("primary_entity_id"),
  customerId: integer("customer_id"),

  // Summary content
  summary: text("summary").notNull(),
  keyDecisions: jsonb("key_decisions").default([]),
  outcomes: jsonb("outcomes").default({}),

  // Metrics
  totalSteps: integer("total_steps"),
  humanInterventions: integer("human_interventions").default(0),
  totalDurationMs: integer("total_duration_ms"),
  totalCostMicrodollars: integer("total_cost_microdollars").default(0),

  // Model usage breakdown
  modelUsage: jsonb("model_usage").default({}),

  // Generated memory doc
  memoryDocId: integer("memory_doc_id").references(() => memoryDocs.id),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  workflowRunIdIdx: index("idx_workflow_summaries_workflow_run_id").on(table.workflowRunId),
  businessIdIdx: index("idx_workflow_summaries_business_id").on(table.businessId),
  customerIdIdx: index("idx_workflow_summaries_customer_id").on(table.customerId),
}));

// ============================================================================
// Relations
// ============================================================================

export const usageLedgerRelations = relations(usageLedger, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [usageLedger.businessId],
    references: [businessProfiles.id],
  }),
  workflowRun: one(workflowRuns, {
    fields: [usageLedger.workflowRunId],
    references: [workflowRuns.id],
  }),
  workflowStep: one(workflowSteps, {
    fields: [usageLedger.workflowStepId],
    references: [workflowSteps.id],
  }),
}));

export const budgetConfigsRelations = relations(budgetConfigs, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [budgetConfigs.businessId],
    references: [businessProfiles.id],
  }),
}));

export const budgetAlertsRelations = relations(budgetAlerts, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [budgetAlerts.businessId],
    references: [businessProfiles.id],
  }),
  acknowledgedBy: one(users, {
    fields: [budgetAlerts.acknowledgedByUserId],
    references: [users.id],
  }),
}));

export const memoryDocsRelations = relations(memoryDocs, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [memoryDocs.businessId],
    references: [businessProfiles.id],
  }),
}));

export const workflowSummariesRelations = relations(workflowSummaries, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [workflowSummaries.businessId],
    references: [businessProfiles.id],
  }),
  workflowRun: one(workflowRuns, {
    fields: [workflowSummaries.workflowRunId],
    references: [workflowRuns.id],
  }),
  memoryDoc: one(memoryDocs, {
    fields: [workflowSummaries.memoryDocId],
    references: [memoryDocs.id],
  }),
}));

// ============================================================================
// Zod Schemas
// ============================================================================

// Usage Ledger
export const insertUsageLedgerSchema = createInsertSchema(usageLedger);
export const selectUsageLedgerSchema = createSelectSchema(usageLedger);
export type UsageLedger = z.infer<typeof selectUsageLedgerSchema>;
export type InsertUsageLedger = z.infer<typeof insertUsageLedgerSchema>;

// Budget Config
export const insertBudgetConfigSchema = createInsertSchema(budgetConfigs);
export const selectBudgetConfigSchema = createSelectSchema(budgetConfigs);
export type BudgetConfig = z.infer<typeof selectBudgetConfigSchema>;
export type InsertBudgetConfig = z.infer<typeof insertBudgetConfigSchema>;

// Budget Alert
export const insertBudgetAlertSchema = createInsertSchema(budgetAlerts);
export const selectBudgetAlertSchema = createSelectSchema(budgetAlerts);
export type BudgetAlert = z.infer<typeof selectBudgetAlertSchema>;
export type InsertBudgetAlert = z.infer<typeof insertBudgetAlertSchema>;

// Model Routing Rule
export const insertModelRoutingRuleSchema = createInsertSchema(modelRoutingRules);
export const selectModelRoutingRuleSchema = createSelectSchema(modelRoutingRules);
export type ModelRoutingRule = z.infer<typeof selectModelRoutingRuleSchema>;
export type InsertModelRoutingRule = z.infer<typeof insertModelRoutingRuleSchema>;

// Memory Doc
export const insertMemoryDocSchema = createInsertSchema(memoryDocs);
export const selectMemoryDocSchema = createSelectSchema(memoryDocs);
export type MemoryDoc = z.infer<typeof selectMemoryDocSchema>;
export type InsertMemoryDoc = z.infer<typeof insertMemoryDocSchema>;

// Workflow Summary
export const insertWorkflowSummarySchema = createInsertSchema(workflowSummaries);
export const selectWorkflowSummarySchema = createSelectSchema(workflowSummaries);
export type WorkflowSummary = z.infer<typeof selectWorkflowSummarySchema>;
export type InsertWorkflowSummary = z.infer<typeof insertWorkflowSummarySchema>;

// ============================================================================
// API Types
// ============================================================================

export const BudgetCheckResultSchema = z.object({
  allowed: z.boolean(),
  modelToUse: z.string(),
  remainingBudget: z.number(),
  usagePercent: z.number(),
  status: z.enum(['ok', 'warning', 'critical', 'exceeded']),
  reason: z.string().optional(),
});

export type BudgetCheckResult = z.infer<typeof BudgetCheckResultSchema>;

export const UsageRecordInputSchema = z.object({
  businessId: z.number(),
  accountId: z.string(),
  workflowRunId: z.number().optional(),
  workflowStepId: z.number().optional(),
  activityType: z.string(),
  activityName: z.string().optional(),
  modelProvider: z.string(),
  modelId: z.string(),
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
  costMicrodollars: z.number(),
  traceId: z.string(),
  requestId: z.string().optional(),
  latencyMs: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export type UsageRecordInput = z.infer<typeof UsageRecordInputSchema>;

export const MemoryDocInputSchema = z.object({
  businessId: z.number(),
  accountId: z.string(),
  customerId: z.number().optional(),
  docType: z.string(),
  title: z.string().optional(),
  content: z.string(),
  sourceEntityType: z.string().optional(),
  sourceEntityId: z.number().optional(),
  sourceWorkflowId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  importanceScore: z.number().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type MemoryDocInput = z.infer<typeof MemoryDocInputSchema>;

export const MemoryQueryInputSchema = z.object({
  businessId: z.number(),
  customerId: z.number().optional(),
  docTypes: z.array(z.string()).optional(),
  query: z.string(),
  limit: z.number().default(10),
  minImportance: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

export type MemoryQueryInput = z.infer<typeof MemoryQueryInputSchema>;
