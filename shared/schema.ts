import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Business Profile - stores landscaping company info
export const businessProfiles = pgTable("business_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  address: text("address"),
  serviceArea: text("service_area"),
  services: text("services").array(),
  businessHours: text("business_hours"),
  autoResponseEnabled: boolean("auto_response_enabled").default(true),
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
