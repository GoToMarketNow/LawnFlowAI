// Knowledge Base Schema
// Type-safe database schema using Drizzle ORM
// Security: Multi-tenant isolation, immutable versions, approval gates

import { pgTable, serial, integer, text, timestamp, jsonb, uniqueIndex, index, check, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses, users } from "./schema";

// Custom vector type for pgvector
export const vector = (name: string, config: { dimensions: number }) => {
  return text(name).$type<number[]>();
};

// Knowledge item types enum
export const KnowledgeItemType = {
  POLICY: "policy",
  SERVICE: "service",
  PAYMENT: "payment",
  OPERATIONS: "operations",
  PROOF_OF_WORK: "proof_of_work",
  MACRO: "macro",
} as const;

export type KnowledgeItemType = typeof KnowledgeItemType[keyof typeof KnowledgeItemType];

// Knowledge status enum
export const KnowledgeStatus = {
  DRAFT: "draft",
  REVIEW: "review",
  PUBLISHED: "published",
  RETIRED: "retired",
} as const;

export type KnowledgeStatus = typeof KnowledgeStatus[keyof typeof KnowledgeStatus];

// Approval decision enum
export const ApprovalDecision = {
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type ApprovalDecision = typeof ApprovalDecision[keyof typeof ApprovalDecision];

// Review reason enum
export const ReviewReason = {
  PERIODIC: "periodic",
  POLICY_CHANGE: "policy_change",
  CONFIG_CHANGE: "config_change",
  INCIDENT: "incident",
} as const;

export type ReviewReason = typeof ReviewReason[keyof typeof ReviewReason];

// 1. Knowledge Items Table
export const knowledgeItems = pgTable("knowledge_items", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull().$type<KnowledgeItemType>(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  category: text("category").notNull(),
  appliesTo: jsonb("applies_to").$type<{
    serviceTypes?: string[];
    locations?: string[];
    customerTiers?: string[];
  }>().default(sql`'{}'::jsonb`),
  status: text("status").notNull().default(KnowledgeStatus.DRAFT).$type<KnowledgeStatus>(),
  currentVersionId: integer("current_version_id"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniqueSlug: uniqueIndex("knowledge_items_business_slug_idx").on(table.businessId, table.slug),
  businessIdx: index("idx_knowledge_items_business").on(table.businessId),
  statusIdx: index("idx_knowledge_items_status").on(table.status),
  categoryIdx: index("idx_knowledge_items_category").on(table.businessId, table.category),
}));

// 2. Knowledge Versions Table
export const knowledgeVersions = pgTable("knowledge_versions", {
  id: serial("id").primaryKey(),
  knowledgeItemId: integer("knowledge_item_id").notNull().references(() => knowledgeItems.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  contentJson: jsonb("content_json").notNull().$type<any>(),
  contentText: text("content_text").notNull(),
  contentEmbedding: vector("content_embedding", { dimensions: 1536 }),
  authorId: integer("author_id").notNull().references(() => users.id),
  changeNotes: text("change_notes"),
  publishedAt: timestamp("published_at"),
  retiredAt: timestamp("retired_at"),
  lastVerifiedAt: timestamp("last_verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueVersion: uniqueIndex("knowledge_versions_item_version_idx").on(table.knowledgeItemId, table.versionNumber),
  itemIdx: index("idx_knowledge_versions_item").on(table.knowledgeItemId),
  publishedIdx: index("idx_knowledge_versions_published").on(table.knowledgeItemId, table.publishedAt),
}));

// 3. Knowledge Approvals Table
export const knowledgeApprovals = pgTable("knowledge_approvals", {
  id: serial("id").primaryKey(),
  knowledgeItemId: integer("knowledge_item_id").notNull().references(() => knowledgeItems.id, { onDelete: "cascade" }),
  versionId: integer("version_id").notNull().references(() => knowledgeVersions.id, { onDelete: "cascade" }),
  submittedBy: integer("submitted_by").notNull().references(() => users.id),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewerId: integer("reviewer_id").references(() => users.id),
  decision: text("decision").$type<ApprovalDecision | null>(),
  decisionNotes: text("decision_notes"),
  decidedAt: timestamp("decided_at"),
}, (table) => ({
  pendingIdx: index("idx_knowledge_approvals_pending").on(table.knowledgeItemId),
}));

// 4. Knowledge Reviews Due Table
export const knowledgeReviewsDue = pgTable("knowledge_reviews_due", {
  id: serial("id").primaryKey(),
  knowledgeItemId: integer("knowledge_item_id").notNull().references(() => knowledgeItems.id, { onDelete: "cascade" }),
  reviewDueDate: timestamp("review_due_date").notNull(),
  reviewReason: text("review_reason").notNull().$type<ReviewReason>(),
  assignedTo: integer("assigned_to").references(() => users.id),
  completedAt: timestamp("completed_at"),
  completedBy: integer("completed_by").references(() => users.id),
}, (table) => ({
  dueDateIdx: index("idx_knowledge_reviews_due_date").on(table.reviewDueDate),
}));

// Relations for type-safe queries
export const knowledgeItemsRelations = {
  business: {
    fields: [knowledgeItems.businessId],
    references: [businesses.id],
  },
  creator: {
    fields: [knowledgeItems.createdBy],
    references: [users.id],
  },
  currentVersion: {
    fields: [knowledgeItems.currentVersionId],
    references: [knowledgeVersions.id],
  },
  versions: {
    fields: [knowledgeItems.id],
    references: [knowledgeVersions.knowledgeItemId],
  },
  approvals: {
    fields: [knowledgeItems.id],
    references: [knowledgeApprovals.knowledgeItemId],
  },
  reviews: {
    fields: [knowledgeItems.id],
    references: [knowledgeReviewsDue.knowledgeItemId],
  },
};

export const knowledgeVersionsRelations = {
  item: {
    fields: [knowledgeVersions.knowledgeItemId],
    references: [knowledgeItems.id],
  },
  author: {
    fields: [knowledgeVersions.authorId],
    references: [users.id],
  },
};

export const knowledgeApprovalsRelations = {
  item: {
    fields: [knowledgeApprovals.knowledgeItemId],
    references: [knowledgeItems.id],
  },
  version: {
    fields: [knowledgeApprovals.versionId],
    references: [knowledgeVersions.id],
  },
  submitter: {
    fields: [knowledgeApprovals.submittedBy],
    references: [users.id],
  },
  reviewer: {
    fields: [knowledgeApprovals.reviewerId],
    references: [users.id],
  },
};

export const knowledgeReviewsDueRelations = {
  item: {
    fields: [knowledgeReviewsDue.knowledgeItemId],
    references: [knowledgeItems.id],
  },
  assignee: {
    fields: [knowledgeReviewsDue.assignedTo],
    references: [users.id],
  },
  completedByUser: {
    fields: [knowledgeReviewsDue.completedBy],
    references: [users.id],
  },
};

// Type exports for use in application code
export type KnowledgeItem = typeof knowledgeItems.$inferSelect;
export type NewKnowledgeItem = typeof knowledgeItems.$inferInsert;
export type KnowledgeVersion = typeof knowledgeVersions.$inferSelect;
export type NewKnowledgeVersion = typeof knowledgeVersions.$inferInsert;
export type KnowledgeApproval = typeof knowledgeApprovals.$inferSelect;
export type NewKnowledgeApproval = typeof knowledgeApprovals.$inferInsert;
export type KnowledgeReviewDue = typeof knowledgeReviewsDue.$inferSelect;
export type NewKnowledgeReviewDue = typeof knowledgeReviewsDue.$inferInsert;
