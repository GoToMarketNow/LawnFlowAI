import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Business Profile - stores landscaping company info
export const businessProfiles = pgTable("business_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerName: text("owner_name"),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  address: text("address"),
  serviceArea: text("service_area"),
  services: text("services").array(),
  businessHours: text("business_hours"),
  autoResponseEnabled: boolean("auto_response_enabled").default(true),
  
  // Service Area Builder fields
  serviceAreaCenterLat: doublePrecision("service_area_center_lat"),
  serviceAreaCenterLng: doublePrecision("service_area_center_lng"),
  serviceAreaRadiusMi: integer("service_area_radius_mi"),
  serviceAreaMaxMi: integer("service_area_max_mi"), // Must be 5, 10, 20, or 40
  serviceAreaAllowExtended: boolean("service_area_allow_extended").default(true),
  
  // Onboarding state
  onboardingRoute: text("onboarding_route"), // "connect_existing" | "standalone"
  onboardingStep: text("onboarding_step").default("welcome"),
  isOnboardingComplete: boolean("is_onboarding_complete").default(false),
  
  // FSM Integration
  fsmProvider: text("fsm_provider"), // "jobber" | "housecall_pro" | "service_autopilot" | "other" | "none"
  fsmConnected: boolean("fsm_connected").default(false),
  fsmProviderOther: text("fsm_provider_other"),
  
  // Communication settings
  phoneProvider: text("phone_provider"), // "twilio" | "existing_number" | "none"
  twilioAreaCode: text("twilio_area_code"),
  textingEnabled: boolean("texting_enabled").default(true),
  
  // Services & Capacity
  serviceTypes: text("service_types").array(), // mowing, cleanup, mulch, landscaping, irrigation, other
  typicalResponseTime: text("typical_response_time"), // same_day, 24h, 48h
  weeklyCapacity: text("weekly_capacity"), // light, medium, heavy
  
  // Pricing basics
  pricingModel: text("pricing_model"), // flat_per_visit, range_estimate, site_visit_first
  mowingMinPrice: integer("mowing_min_price"), // in cents
  cleanupMinPrice: integer("cleanup_min_price"), // in cents
  mulchMinPrice: integer("mulch_min_price"), // in cents
  
  // Automation preferences
  missedCallRecoveryEnabled: boolean("missed_call_recovery_enabled").default(true),
  autoTextEnabled: boolean("auto_text_enabled").default(true),
  autoQuoteEnabled: boolean("auto_quote_enabled").default(false),
  approvalsRequiredForBooking: boolean("approvals_required_for_booking").default(true),
  
  // Standalone CRM settings (for Route B)
  trackCustomersEnabled: boolean("track_customers_enabled").default(true),
  trackJobsEnabled: boolean("track_jobs_enabled").default(true),
  
  // Misc
  onboardingNotes: jsonb("onboarding_notes"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Conversations - tracks all customer interactions
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  customerPhone: text("customer_phone").notNull(),
  customerName: text("customer_name"),
  status: text("status").notNull().default("active"), // active, qualified, scheduled, completed, lost
  source: text("source").notNull(), // missed_call, inbound_sms, web_lead
  agentType: text("agent_type"), // intake, quote, schedule, invoice, reviews
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Messages - individual messages in conversations
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  role: text("role").notNull(), // customer, ai, system
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Events - inbound events that trigger workflows
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // missed_call, inbound_sms, web_lead
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  conversationId: integer("conversation_id").references(() => conversations.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  processedAt: timestamp("processed_at"),
});

// Pending Actions - actions awaiting human approval
export const pendingActions = pgTable("pending_actions", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  actionType: text("action_type").notNull(), // send_quote, schedule_job, send_sms
  description: text("description").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
});

// Jobs - mock FSM jobs created after approval
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id),
  businessId: integer("business_id").references(() => businessProfiles.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address"),
  serviceType: text("service_type").notNull(),
  scheduledDate: timestamp("scheduled_date"),
  estimatedPrice: integer("estimated_price"), // in cents
  status: text("status").notNull().default("pending"), // pending, scheduled, in_progress, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Audit Log - tracks all system actions
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // conversation, job, action
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Event Receipts - idempotency tracking for event processing
export const eventReceipts = pgTable("event_receipts", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(), // External event ID for deduplication
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("processing"), // processing, completed, failed
  result: jsonb("result"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

// Policy Profiles - tiered automation policy configuration
export const policyProfiles = pgTable("policy_profiles", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  tier: text("tier").notNull().default("owner_operator"), // owner_operator, smb, commercial
  
  // Automation flags
  autoSendMessages: boolean("auto_send_messages").default(true),
  autoSendQuotes: boolean("auto_send_quotes").default(false),
  autoBookJobs: boolean("auto_book_jobs").default(false),
  afterHoursAutomation: boolean("after_hours_automation").default(false),
  
  // Thresholds
  confidenceThreshold: integer("confidence_threshold").default(85), // 85 = 0.85
  slotScoreThreshold: integer("slot_score_threshold").default(80), // For commercial auto-booking
  
  // Service area configuration (JSON array of zip codes or { radius: number, center: {lat, lng} })
  serviceAreaZips: text("service_area_zips").array(),
  serviceAreaRadius: integer("service_area_radius"), // miles from HQ
  
  // Do-not-serve rules (blocked phone numbers and addresses)
  blockedPhones: text("blocked_phones").array(),
  blockedAddresses: text("blocked_addresses").array(),
  
  // Pricing rules for Commercial tier (JSON)
  pricingRules: jsonb("pricing_rules"), // { minQuote, maxQuote, requiresApprovalAbove }
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// FSM Leads - mock lead tracking
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull().unique(), // FSM lead ID
  conversationId: integer("conversation_id").references(() => conversations.id),
  name: text("name"),
  phone: text("phone").notNull(),
  address: text("address"),
  serviceRequested: text("service_requested").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("new"), // new, contacted, qualified, converted, lost
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Relations
export const businessProfilesRelations = relations(businessProfiles, ({ many }) => ({
  conversations: many(conversations),
  jobs: many(jobs),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  business: one(businessProfiles, {
    fields: [conversations.businessId],
    references: [businessProfiles.id],
  }),
  messages: many(messages),
  events: many(events),
  pendingActions: many(pendingActions),
  jobs: many(jobs),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  conversation: one(conversations, {
    fields: [events.conversationId],
    references: [conversations.id],
  }),
}));

export const pendingActionsRelations = relations(pendingActions, ({ one }) => ({
  conversation: one(conversations, {
    fields: [pendingActions.conversationId],
    references: [conversations.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  conversation: one(conversations, {
    fields: [jobs.conversationId],
    references: [conversations.id],
  }),
  business: one(businessProfiles, {
    fields: [jobs.businessId],
    references: [businessProfiles.id],
  }),
}));

export const policyProfilesRelations = relations(policyProfiles, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [policyProfiles.businessId],
    references: [businessProfiles.id],
  }),
}));

// Insert Schemas
export const insertBusinessProfileSchema = createInsertSchema(businessProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertPendingActionSchema = createInsertSchema(pendingActions).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
  resolvedBy: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertEventReceiptSchema = createInsertSchema(eventReceipts).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export const insertPolicyProfileSchema = createInsertSchema(policyProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type PendingAction = typeof pendingActions.$inferSelect;
export type InsertPendingAction = z.infer<typeof insertPendingActionSchema>;

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type EventReceipt = typeof eventReceipts.$inferSelect;
export type InsertEventReceipt = z.infer<typeof insertEventReceiptSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export type PolicyProfile = typeof policyProfiles.$inferSelect;
export type InsertPolicyProfile = z.infer<typeof insertPolicyProfileSchema>;

// Policy tier enum for type safety
export const PolicyTiers = ["owner_operator", "smb", "commercial"] as const;
export type PolicyTier = typeof PolicyTiers[number];
