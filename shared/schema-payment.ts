import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, timestamp, boolean, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { jobs } from "./schema";

// ============================================
// Payment Agent Schema
// ============================================

// Customer Payment Profiles - stores payment preferences and autopay settings
export const customerPaymentProfiles = pgTable("customer_payment_profiles", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().unique(), // Reference to customers table
  businessId: integer("business_id").notNull(),

  // Payment preferences
  preferredPaymentMethodId: integer("preferred_payment_method_id"), // FK to paymentMethods
  autopayEnabled: boolean("autopay_enabled").default(false),
  autoBillingEnabled: boolean("auto_billing_enabled").default(false), // Opt-in for future invoicing

  // Allowed methods (array of enums)
  allowedMethods: text("allowed_methods").array(), // ["APPLE_PAY", "GOOGLE_PAY", "CARD"]

  // Last usage tracking
  lastMethodUsedId: integer("last_method_used_id"),
  lastMethodUsedAt: timestamp("last_method_used_at"),

  // Consent records (JSONB array of {timestamp, channel, consent_text_hash})
  consentRecords: jsonb("consent_records").default([]),

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Payment Methods - tokenized payment method references (never store raw PAN)
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(), // Reference to customers table
  businessId: integer("business_id").notNull(),

  // Method type
  type: text("type").notNull(), // "APPLE_PAY" | "GOOGLE_PAY" | "CARD"

  // Tokenized reference (provider-specific token, NEVER raw card data)
  providerTokenRef: text("provider_token_ref").notNull(), // Stripe pm_xxx, customer_xxx, etc.
  provider: text("provider").notNull().default("stripe"), // "stripe" | "square" | etc.

  // Display info (for UI only)
  brandLast4: text("brand_last4"), // "Visa ****1234"
  expMonth: integer("exp_month"),
  expYear: integer("exp_year"),

  // Status
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),

  // Metadata
  addedVia: text("added_via"), // "sms_link" | "in_app" | "first_service" | "manual"

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Operator Payment Policies - business-level payment rules
export const operatorPaymentPolicies = pgTable("operator_payment_policies", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().unique(),

  // Autopay thresholds
  maxAutopayAmount: doublePrecision("max_autopay_amount").default(500.00), // Max amount for auto-capture
  requireCustomerConfirmationOver: doublePrecision("require_customer_confirmation_over").default(200.00),

  // Invoice fallback rules
  allowInvoiceInsteadOfPay: boolean("allow_invoice_instead_of_pay").default(false),
  invoiceOnlyOver: doublePrecision("invoice_only_over"), // Force invoice if job > this amount

  // First service rules
  firstServiceRequiresSetup: boolean("first_service_requires_setup").default(true),

  // Allowed payment methods for this business
  allowedPaymentMethods: text("allowed_payment_methods").array().default(["APPLE_PAY", "GOOGLE_PAY", "CARD"]),

  // Retry and SLA settings
  paymentFailureRetryCount: integer("payment_failure_retry_count").default(3),
  paymentSlaMiuntes: integer("payment_sla_minutes").default(60), // Time window for payment completion

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Payment Transactions - audit trail of all payment attempts
export const paymentTransactions = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  customerId: integer("customer_id").notNull(),

  // Reference to source entity
  jobId: integer("job_id").references(() => jobs.id),
  invoiceId: integer("invoice_id"), // FK to invoices table (if exists)

  // Payment details
  amount: doublePrecision("amount").notNull(),
  currency: text("currency").default("USD").notNull(),

  // Method used
  paymentMethodId: integer("payment_method_id").references(() => paymentMethods.id),
  methodType: text("method_type"), // Snapshot: "APPLE_PAY" | "GOOGLE_PAY" | "CARD"

  // Transaction status
  status: text("status").notNull(), // "pending" | "authorized" | "captured" | "failed" | "refunded" | "voided"

  // Provider details
  provider: text("provider").default("stripe"),
  providerTransactionId: text("provider_transaction_id"), // Stripe charge_id, PaymentIntent id, etc.
  providerResponse: jsonb("provider_response"), // Full provider response for debugging

  // Flow tracking
  captureType: text("capture_type"), // "autopay" | "on_demand" | "invoice_payment" | "first_service"
  initiatedBy: text("initiated_by"), // "agent" | "customer" | "manual"

  // Idempotency
  idempotencyKey: text("idempotency_key").notNull().unique(),

  // Tracing
  traceId: text("trace_id").notNull(),
  agentDecisionId: integer("agent_decision_id"), // FK to paymentAgentDecisions

  // Error tracking
  failureReason: text("failure_reason"),
  failureCode: text("failure_code"),
  retryCount: integer("retry_count").default(0),

  // Timestamps
  authorizedAt: timestamp("authorized_at"),
  capturedAt: timestamp("captured_at"),
  failedAt: timestamp("failed_at"),

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Payment Sessions - ephemeral payment collection sessions
export const paymentSessions = pgTable("payment_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(), // UUID or provider session ID
  businessId: integer("business_id").notNull(),
  customerId: integer("customer_id").notNull(),

  // Session context
  jobId: integer("job_id").references(() => jobs.id),
  invoiceId: integer("invoice_id"),

  // Amount and methods
  amount: doublePrecision("amount").notNull(),
  currency: text("currency").default("USD").notNull(),
  allowedMethods: text("allowed_methods").array(), // ["APPLE_PAY", "GOOGLE_PAY", "CARD"]

  // Delivery channel
  channel: text("channel"), // "sms" | "in_app" | "email"
  sessionUrl: text("session_url"), // Public URL for payment collection

  // Status
  status: text("status").default("created"), // "created" | "sent" | "opened" | "completed" | "expired" | "failed"

  // Completion tracking
  paymentMethodCapturedId: integer("payment_method_captured_id"), // Method used to complete
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),

  // Tracing
  traceId: text("trace_id").notNull(),

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Payment Agent Decisions - audit trail of agent reasoning
export const paymentAgentDecisions = pgTable("payment_agent_decisions", {
  id: serial("id").primaryKey(),
  traceId: text("trace_id").notNull(),
  entityId: text("entity_id").notNull(), // job_id or invoice_id
  entityType: text("entity_type").notNull(), // "job" | "invoice"
  businessId: integer("business_id").notNull(),
  customerId: integer("customer_id").notNull(),

  // Agent decision
  decision: text("decision").notNull(), // "autopay_capture" | "request_setup" | "send_text_to_pay" | "create_session" | "fallback_invoice" | "escalate"

  // Journey context
  journeyType: text("journey_type").notNull(), // "job" | "invoice" | "payment"

  // Commands proposed (JSONB array)
  commands: jsonb("commands").notNull().default([]),

  // Confidence scoring
  confidence: doublePrecision("confidence").notNull(),
  confidenceBreakdown: jsonb("confidence_breakdown").notNull(), // {data_completeness, policy_compliance, consent_certainty, method_availability_certainty, payment_risk_certainty}

  // Risk flags
  riskFlags: text("risk_flags").array().default([]),

  // Human escalation
  humanRequired: boolean("human_required").default(false),
  handoffReason: text("handoff_reason"),
  handoffToRole: text("handoff_to_role"), // "FINANCE" | "OPS" | null

  // Policy snapshot (hash of policy at decision time)
  policySnapshotHash: text("policy_snapshot_hash").notNull(),

  // Execution status
  executionStatus: text("execution_status").default("pending"), // "pending" | "executing" | "completed" | "failed" | "escalated"
  executedAt: timestamp("executed_at"),

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Payment Human Tasks - escalations requiring manual intervention
export const paymentHumanTasks = pgTable("payment_human_tasks", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  customerId: integer("customer_id").notNull(),

  // Task context
  agentDecisionId: integer("agent_decision_id").references(() => paymentAgentDecisions.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id),
  invoiceId: integer("invoice_id"),

  // Task details
  role: text("role").notNull(), // "FINANCE" | "OPS"
  reason: text("reason").notNull(),
  context: jsonb("context").notNull(), // Full context for human review

  // Status
  status: text("status").default("pending"), // "pending" | "in_progress" | "completed" | "cancelled"
  assignedTo: integer("assigned_to"), // User ID
  assignedAt: timestamp("assigned_at"),

  // Resolution
  resolution: text("resolution"),
  resolvedBy: integer("resolved_by"),
  resolvedAt: timestamp("resolved_at"),

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ============================================
// Zod Insert Schemas
// ============================================

export const insertCustomerPaymentProfileSchema = createInsertSchema(customerPaymentProfiles);
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods);
export const insertOperatorPaymentPolicySchema = createInsertSchema(operatorPaymentPolicies);
export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions);
export const insertPaymentSessionSchema = createInsertSchema(paymentSessions);
export const insertPaymentAgentDecisionSchema = createInsertSchema(paymentAgentDecisions);
export const insertPaymentHumanTaskSchema = createInsertSchema(paymentHumanTasks);
