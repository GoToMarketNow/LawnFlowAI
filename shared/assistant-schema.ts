// AI Assistant Schema
// Type-safe database schema for gated AI assistant
// Security: Confirm-before-write, citations required, read-only tools

import { pgTable, serial, integer, text, timestamp, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businessProfiles as businesses, users } from "./schema";

// Action type enum
export const ActionType = {
  RESCHEDULE_JOB: "reschedule_job",
  CANCEL_JOB: "cancel_job",
  SEND_MESSAGE: "send_message",
  UPDATE_QUOTE: "update_quote",
  CREATE_SERVICE_REQUEST: "create_service_request",
  UPDATE_PAYMENT_METHOD: "update_payment_method",
  ISSUE_REFUND: "issue_refund",
  ESCALATE_TO_OPS: "escalate_to_ops",
  CREATE_KNOWLEDGE_ITEM: "create_knowledge_item",
} as const;

export type ActionType = typeof ActionType[keyof typeof ActionType];

// Action status enum
export const ActionStatus = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
  EXECUTED: "executed",
  FAILED: "failed",
  EXPIRED: "expired",
} as const;

export type ActionStatus = typeof ActionStatus[keyof typeof ActionStatus];

// Message role enum
export const MessageRole = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
} as const;

export type MessageRole = typeof MessageRole[keyof typeof MessageRole];

// 1. Assistant Action Requests Table
export const assistantActionRequests = pgTable("assistant_action_requests", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id"),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),

  // Requester
  requestedBy: integer("requested_by").references(() => users.id),
  requestedByRole: text("requested_by_role"),

  // Action details
  actionType: text("action_type").notNull().$type<ActionType>(),
  actionPayload: jsonb("action_payload").notNull().default(sql`'{}'::jsonb`),
  actionReason: text("action_reason"),

  // Confirmation workflow
  status: text("status").notNull().default(ActionStatus.PENDING).$type<ActionStatus>(),
  confirmedBy: integer("confirmed_by").references(() => users.id),
  confirmedAt: timestamp("confirmed_at"),
  rejectedReason: text("rejected_reason"),

  // Execution tracking
  executedAt: timestamp("executed_at"),
  executionResult: jsonb("execution_result"),
  executionError: text("execution_error"),

  // Idempotency and expiration
  idempotencyKey: text("idempotency_key").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull().default(sql`NOW() + INTERVAL '24 hours'`),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  businessIdx: index("idx_assistant_actions_business").on(table.businessId),
  statusIdx: index("idx_assistant_actions_status").on(table.status),
  pendingIdx: index("idx_assistant_actions_pending").on(table.businessId, table.status),
  conversationIdx: index("idx_assistant_actions_conversation").on(table.conversationId),
  expiresIdx: index("idx_assistant_actions_expires").on(table.expiresAt),
}));

// 2. Assistant Conversations Table
export const assistantConversations = pgTable("assistant_conversations", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  threadId: integer("thread_id"),
  userId: integer("user_id").references(() => users.id),
  userRole: text("user_role"),

  // Conversation metadata
  startedAt: timestamp("started_at").notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  messageCount: integer("message_count").notNull().default(0),

  // Context
  context: jsonb("context").default(sql`'{}'::jsonb`),

  // Session tracking
  sessionId: text("session_id").unique(),
  isActive: boolean("is_active").default(true),
  endedAt: timestamp("ended_at"),
  endReason: text("end_reason"),
}, (table) => ({
  businessIdx: index("idx_assistant_conversations_business").on(table.businessId),
  threadIdx: index("idx_assistant_conversations_thread").on(table.threadId),
  userIdx: index("idx_assistant_conversations_user").on(table.userId),
  activeIdx: index("idx_assistant_conversations_active").on(table.isActive, table.lastMessageAt),
}));

// 3. Assistant Messages Table
export const assistantMessages = pgTable("assistant_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => assistantConversations.id, { onDelete: "cascade" }),

  // Message content
  role: text("role").notNull().$type<MessageRole>(),
  content: text("content").notNull(),

  // Citations (for assistant responses)
  citations: jsonb("citations").$type<Array<{
    knowledgeItemId: number;
    versionId: number;
    title: string;
    excerpt?: string;
  }>>().default(sql`'[]'::jsonb`),

  // Tool usage tracking
  toolsUsed: jsonb("tools_used").$type<string[]>().default(sql`'[]'::jsonb`),

  // Action requests generated
  actionRequestId: integer("action_request_id").references(() => assistantActionRequests.id),

  // Feedback
  feedbackRating: integer("feedback_rating"),
  feedbackText: text("feedback_text"),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  modelUsed: text("model_used"),
  tokenCount: integer("token_count"),
  latencyMs: integer("latency_ms"),
}, (table) => ({
  conversationIdx: index("idx_assistant_messages_conversation").on(table.conversationId),
  createdIdx: index("idx_assistant_messages_created").on(table.createdAt),
  citationsIdx: index("idx_assistant_messages_with_citations").on(table.role),
}));

// 4. Assistant Tool Executions Table
export const assistantToolExecutions = pgTable("assistant_tool_executions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => assistantMessages.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id").notNull().references(() => assistantConversations.id, { onDelete: "cascade" }),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),

  // Tool details
  toolName: text("tool_name").notNull(),
  toolParams: jsonb("tool_params").notNull(),
  toolResult: jsonb("tool_result"),

  // Execution tracking
  executedAt: timestamp("executed_at").notNull().defaultNow(),
  executionTimeMs: integer("execution_time_ms"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),

  // Security: read-only enforcement
  isReadOnly: boolean("is_read_only").notNull().default(true),
}, (table) => ({
  messageIdx: index("idx_assistant_tool_executions_message").on(table.messageId),
  conversationIdx: index("idx_assistant_tool_executions_conversation").on(table.conversationId),
  businessIdx: index("idx_assistant_tool_executions_business").on(table.businessId),
  toolIdx: index("idx_assistant_tool_executions_tool").on(table.toolName),
}));

// Type exports
export type AssistantActionRequest = typeof assistantActionRequests.$inferSelect;
export type NewAssistantActionRequest = typeof assistantActionRequests.$inferInsert;
export type AssistantConversation = typeof assistantConversations.$inferSelect;
export type NewAssistantConversation = typeof assistantConversations.$inferInsert;
export type AssistantMessage = typeof assistantMessages.$inferSelect;
export type NewAssistantMessage = typeof assistantMessages.$inferInsert;
export type AssistantToolExecution = typeof assistantToolExecutions.$inferSelect;
export type NewAssistantToolExecution = typeof assistantToolExecutions.$inferInsert;

// Citation interface
export interface Citation {
  knowledgeItemId: number;
  versionId: number;
  title: string;
  excerpt?: string;
}

// Assistant response interface
export interface AssistantResponse {
  content: string;
  citations: Citation[];
  toolsUsed?: string[];
  requiresApproval: boolean;
  suggestedActions?: Array<{
    type: ActionType;
    description: string;
    payload: any;
  }>;
}

// Action request creation interface
export interface CreateActionRequest {
  conversationId?: number;
  businessId: number;
  requestedBy?: number;
  requestedByRole?: string;
  actionType: ActionType;
  actionPayload: any;
  actionReason?: string;
}

// Relations for type-safe queries
export const assistantActionRequestsRelations = {
  business: {
    fields: [assistantActionRequests.businessId],
    references: [businesses.id],
  },
  requester: {
    fields: [assistantActionRequests.requestedBy],
    references: [users.id],
  },
  confirmer: {
    fields: [assistantActionRequests.confirmedBy],
    references: [users.id],
  },
};

export const assistantConversationsRelations = {
  business: {
    fields: [assistantConversations.businessId],
    references: [businesses.id],
  },
  user: {
    fields: [assistantConversations.userId],
    references: [users.id],
  },
  messages: {
    fields: [assistantConversations.id],
    references: [assistantMessages.conversationId],
  },
};

export const assistantMessagesRelations = {
  conversation: {
    fields: [assistantMessages.conversationId],
    references: [assistantConversations.id],
  },
  actionRequest: {
    fields: [assistantMessages.actionRequestId],
    references: [assistantActionRequests.id],
  },
};

export const assistantToolExecutionsRelations = {
  message: {
    fields: [assistantToolExecutions.messageId],
    references: [assistantMessages.id],
  },
  conversation: {
    fields: [assistantToolExecutions.conversationId],
    references: [assistantConversations.id],
  },
  business: {
    fields: [assistantToolExecutions.businessId],
    references: [businesses.id],
  },
};
