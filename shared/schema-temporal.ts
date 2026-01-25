/**
 * Temporal Workflow Schema
 *
 * Database schema for Temporal-based Agentic OS:
 * - workflow_runs: Track Temporal workflow executions
 * - workflow_steps: Audit trail for activity executions
 * - human_tasks: Unified HITL approval queue
 *
 * @module shared/schema-temporal
 */

import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { businessProfiles, users } from "./schema";

// ============================================================================
// Enums and Types
// ============================================================================

export const WorkflowStatus = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMED_OUT: 'timed_out',
  CONTINUED_AS_NEW: 'continued_as_new',
} as const;

export const WorkflowStepStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying',
  CANCELLED: 'cancelled',
} as const;

export const HumanTaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export const HumanTaskType = {
  APPROVAL: 'approval',
  REVIEW: 'review',
  DECISION: 'decision',
  CORRECTION: 'correction',
  ESCALATION: 'escalation',
} as const;

export const HumanTaskCategory = {
  BILLING: 'billing',
  PAYMENT: 'payment',
  SCHEDULING: 'scheduling',
  QUOTE: 'quote',
  SUPPORT: 'support',
  CREW: 'crew',
} as const;

export const HumanTaskPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export const HumanTaskResolution = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
  MODIFIED: 'modified',
  ESCALATED: 'escalated',
} as const;

// ============================================================================
// workflow_runs: Track Temporal workflow executions
// ============================================================================

export const workflowRuns = pgTable("workflow_runs", {
  id: serial("id").primaryKey(),

  // Temporal identifiers
  workflowId: text("workflow_id").notNull().unique(),
  runId: text("run_id").notNull(),
  workflowType: text("workflow_type").notNull(),

  // Account/business context
  accountId: text("account_id").notNull(),
  businessId: integer("business_id").references(() => businessProfiles.id),

  // Entity references
  primaryEntityType: text("primary_entity_type").notNull(),
  primaryEntityId: integer("primary_entity_id").notNull(),

  // Status tracking
  status: text("status").notNull().default('running'),
  currentStage: text("current_stage"),

  // Context/IO
  inputJson: jsonb("input_json").notNull(),
  outputJson: jsonb("output_json"),
  errorJson: jsonb("error_json"),

  // Temporal metadata
  taskQueue: text("task_queue").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  timeoutSeconds: integer("timeout_seconds"),

  // Legacy correlation
  legacyRunId: text("legacy_run_id"),

  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workflowIdIdx: uniqueIndex("workflow_runs_workflow_id_idx").on(table.workflowId),
  businessIdx: index("workflow_runs_business_idx").on(table.businessId),
  statusIdx: index("workflow_runs_status_idx").on(table.status),
  typeIdx: index("workflow_runs_type_idx").on(table.workflowType),
  entityIdx: index("workflow_runs_entity_idx").on(table.primaryEntityType, table.primaryEntityId),
  startedIdx: index("workflow_runs_started_idx").on(table.startedAt),
}));

// ============================================================================
// workflow_steps: Audit trail for activity executions
// ============================================================================

export const workflowSteps = pgTable("workflow_steps", {
  id: serial("id").primaryKey(),
  workflowRunId: integer("workflow_run_id").references(() => workflowRuns.id, { onDelete: 'cascade' }).notNull(),

  // Activity identification
  activityType: text("activity_type").notNull(),
  activityId: text("activity_id").notNull(),
  stepIndex: integer("step_index").notNull(),

  // Execution state
  status: text("status").notNull().default('pending'),
  attemptNumber: integer("attempt_number").notNull().default(1),

  // Input/Output
  inputJson: jsonb("input_json"),
  outputJson: jsonb("output_json"),
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  errorType: text("error_type"),

  // Timing
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),

  // LLM/Model usage (for FinOps)
  modelUsed: text("model_used"),
  modelProvider: text("model_provider"),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),

  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  runIdx: index("workflow_steps_run_idx").on(table.workflowRunId),
  statusIdx: index("workflow_steps_status_idx").on(table.status),
  activityIdx: index("workflow_steps_activity_idx").on(table.activityType),
  startedIdx: index("workflow_steps_started_idx").on(table.startedAt),
}));

// ============================================================================
// human_tasks: Unified HITL approval queue
// ============================================================================

export const humanTasks = pgTable("human_tasks", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").notNull().unique(),

  // Workflow correlation
  workflowRunId: integer("workflow_run_id").references(() => workflowRuns.id, { onDelete: 'set null' }),

  // Context
  accountId: text("account_id").notNull(),
  businessId: integer("business_id").references(() => businessProfiles.id),

  // Task classification
  taskType: text("task_type").notNull(),
  category: text("category").notNull(),

  // Assignment
  assignedRole: text("assigned_role").notNull(),
  assignedUserId: integer("assigned_user_id").references(() => users.id),

  // Content
  title: text("title").notNull(),
  description: text("description"),
  contextJson: jsonb("context_json").notNull(),
  optionsJson: jsonb("options_json"),

  // Status
  status: text("status").notNull().default('pending'),
  priority: text("priority").notNull().default('normal'),

  // Resolution
  resolution: text("resolution"),
  resolutionData: jsonb("resolution_data"),
  resolvedByUserId: integer("resolved_by_user_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNotes: text("resolution_notes"),

  // SLA and escalation
  dueBy: timestamp("due_by", { withTimezone: true }),
  escalatedAt: timestamp("escalated_at", { withTimezone: true }),
  escalationReason: text("escalation_reason"),

  // Temporal signal integration
  signalName: text("signal_name"),

  // Source tracking
  sourceType: text("source_type"),
  sourceId: text("source_id"),

  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  taskIdIdx: uniqueIndex("human_tasks_task_id_idx").on(table.taskId),
  statusIdx: index("human_tasks_status_idx").on(table.status),
  workflowIdx: index("human_tasks_workflow_idx").on(table.workflowRunId),
  businessIdx: index("human_tasks_business_idx").on(table.businessId),
  assignedIdx: index("human_tasks_assigned_idx").on(table.assignedRole, table.assignedUserId),
  priorityIdx: index("human_tasks_priority_idx").on(table.priority, table.dueBy),
}));

// ============================================================================
// Relations
// ============================================================================

export const workflowRunsRelations = relations(workflowRuns, ({ one, many }) => ({
  business: one(businessProfiles, {
    fields: [workflowRuns.businessId],
    references: [businessProfiles.id],
  }),
  steps: many(workflowSteps),
  humanTasks: many(humanTasks),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one }) => ({
  workflowRun: one(workflowRuns, {
    fields: [workflowSteps.workflowRunId],
    references: [workflowRuns.id],
  }),
}));

export const humanTasksRelations = relations(humanTasks, ({ one }) => ({
  workflowRun: one(workflowRuns, {
    fields: [humanTasks.workflowRunId],
    references: [workflowRuns.id],
  }),
  business: one(businessProfiles, {
    fields: [humanTasks.businessId],
    references: [businessProfiles.id],
  }),
  assignedUser: one(users, {
    fields: [humanTasks.assignedUserId],
    references: [users.id],
  }),
  resolvedByUser: one(users, {
    fields: [humanTasks.resolvedByUserId],
    references: [users.id],
  }),
}));

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

// WorkflowRun schemas
export const insertWorkflowRunSchema = createInsertSchema(workflowRuns, {
  workflowId: z.string().min(1),
  runId: z.string().min(1),
  workflowType: z.string().min(1),
  accountId: z.string().min(1),
  primaryEntityType: z.string().min(1),
  primaryEntityId: z.number().int().positive(),
  status: z.enum(['running', 'completed', 'failed', 'cancelled', 'timed_out', 'continued_as_new']),
  taskQueue: z.string().min(1),
});

export const selectWorkflowRunSchema = createSelectSchema(workflowRuns);

export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type InsertWorkflowRun = typeof workflowRuns.$inferInsert;

// WorkflowStep schemas
export const insertWorkflowStepSchema = createInsertSchema(workflowSteps, {
  activityType: z.string().min(1),
  activityId: z.string().min(1),
  stepIndex: z.number().int().nonnegative(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'retrying', 'cancelled']),
  attemptNumber: z.number().int().positive(),
});

export const selectWorkflowStepSchema = createSelectSchema(workflowSteps);

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = typeof workflowSteps.$inferInsert;

// HumanTask schemas
export const insertHumanTaskSchema = createInsertSchema(humanTasks, {
  taskId: z.string().uuid(),
  taskType: z.enum(['approval', 'review', 'decision', 'correction', 'escalation']),
  category: z.enum(['billing', 'payment', 'scheduling', 'quote', 'support', 'crew']),
  assignedRole: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'expired']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  resolution: z.enum(['approved', 'rejected', 'modified', 'escalated']).optional(),
});

export const selectHumanTaskSchema = createSelectSchema(humanTasks);

export type HumanTask = typeof humanTasks.$inferSelect;
export type InsertHumanTask = typeof humanTasks.$inferInsert;

// ============================================================================
// Helper Types for Workflow Context
// ============================================================================

/**
 * Standard workflow input that all workflows should include
 */
export interface BaseWorkflowInput {
  accountId: string;
  businessId: number;
  traceId?: string;
}

/**
 * Standard activity result format
 */
export interface ActivityResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  durationMs?: number;
}

/**
 * Human task resolution payload
 */
export interface TaskResolution {
  resolution: 'approved' | 'rejected' | 'modified' | 'escalated';
  data?: Record<string, unknown>;
  notes?: string;
  userId: number;
}

/**
 * Temporal signal payload for task approval
 */
export interface ApprovalSignalPayload {
  approved: boolean;
  data?: Record<string, unknown>;
  userId: number;
  notes?: string;
}
