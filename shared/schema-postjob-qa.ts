import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, timestamp, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { jobs } from "./schema";

// ============================================
// Post-Job QA & Review Management Schema
// ============================================

// Job Photos - stores photos uploaded by crew leaders after job completion
export const jobPhotos = pgTable("job_photos", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  photoUrl: text("photo_url").notNull(), // Cloud storage URL (S3, Cloudinary, etc.)
  aiCaption: text("ai_caption"), // AI-generated description of photo
  aiTags: text("ai_tags").array(), // AI-extracted tags (e.g., "lawn", "edging", "mulch")
  uploadedByCrewMemberId: integer("uploaded_by_crew_member_id"), // Reference to crew member
  status: text("status").default("pending_upload"), // pending_upload, uploaded, failed
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Customer Satisfaction Records - tracks post-job QA flow
export const csatRecords = pgTable("csat_records", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  businessId: integer("business_id").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerName: text("customer_name"),

  // Satisfaction Prompt (Step 1: "Are you satisfied?")
  satisfactionPromptSentAt: timestamp("satisfaction_prompt_sent_at"),
  satisfactionResponse: text("satisfaction_response"), // Raw customer response
  satisfactionResponseAt: timestamp("satisfaction_response_at"),
  isSatisfied: boolean("is_satisfied"), // true = YES, false = NO, null = unclear/no response

  // Rating Prompt (Step 2: "Rate 1-5 stars")
  ratingPromptSentAt: timestamp("rating_prompt_sent_at"),
  ratingResponse: text("rating_response"), // Raw customer response
  ratingResponseAt: timestamp("rating_response_at"),
  starRating: integer("star_rating"), // 1-5

  // Review Text Collection (Step 3: "Share your experience")
  reviewTextPromptSentAt: timestamp("review_text_prompt_sent_at"),
  reviewTextResponse: text("review_text_response"), // Raw customer review text
  reviewTextResponseAt: timestamp("review_text_response_at"),
  reviewText: text("review_text"), // Cleaned/processed review text
  reviewOptIn: boolean("review_opt_in").default(false), // Customer consented to public posting

  // Review Posting
  reviewPostedAt: timestamp("review_posted_at"),
  reviewPostedTo: text("review_posted_to").array(), // ["google", "facebook", "yelp"]
  reviewExternalIds: text("review_external_ids").array(), // External review IDs

  // Escalation (for low ratings or dissatisfaction)
  escalatedAt: timestamp("escalated_at"),
  escalationReason: text("escalation_reason"),
  escalationResolved: boolean("escalation_resolved").default(false),
  escalationResolvedAt: timestamp("escalation_resolved_at"),

  // Status tracking
  status: text("status").default("satisfaction_prompt_sent"),
  // satisfaction_prompt_sent, satisfaction_received, rating_prompt_sent, rating_received,
  // review_prompt_sent, review_received, review_moderated, review_posted, escalated, completed

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Review Moderation Queue - AI-powered review screening before posting
export const reviewModerationQueue = pgTable("review_moderation_queue", {
  id: serial("id").primaryKey(),
  csatRecordId: integer("csat_record_id").references(() => csatRecords.id).notNull(),
  reviewText: text("review_text").notNull(),

  // AI Moderation Scores (0.0 - 1.0)
  appropriatenessScore: doublePrecision("appropriateness_score"), // No profanity, threats, etc.
  authenticityScore: doublePrecision("authenticity_score"), // Appears genuine, not spam
  completenessScore: doublePrecision("completeness_score"), // Has meaningful content

  // Moderation Decision
  status: text("status").default("pending"), // pending, approved, rejected, manual_review
  moderatedAt: timestamp("moderated_at"),
  moderatedBy: text("moderated_by"), // "ai" | "manual" | crew_member_id
  rejectionReason: text("rejection_reason"),

  // Manual Override
  manualOverrideBy: integer("manual_override_by"), // Admin/ops user ID
  manualOverrideAt: timestamp("manual_override_at"),
  manualOverrideNotes: text("manual_override_notes"),

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// CSAT Analytics - aggregated metrics per business
export const csatAnalytics = pgTable("csat_analytics", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),

  // Engagement Metrics
  totalJobsCompleted: integer("total_jobs_completed").default(0),
  totalSatisfactionPromptsSent: integer("total_satisfaction_prompts_sent").default(0),
  totalSatisfactionResponsesReceived: integer("total_satisfaction_responses_received").default(0),
  satisfactionResponseRate: doublePrecision("satisfaction_response_rate"), // percentage

  // Satisfaction Metrics
  totalSatisfiedResponses: integer("total_satisfied_responses").default(0),
  totalDissatisfiedResponses: integer("total_dissatisfied_responses").default(0),
  satisfactionRate: doublePrecision("satisfaction_rate"), // percentage of satisfied / total responses

  // Rating Metrics
  totalRatingPromptsSent: integer("total_rating_prompts_sent").default(0),
  totalRatingsReceived: integer("total_ratings_received").default(0),
  avgStarRating: doublePrecision("avg_star_rating"), // 0.0 - 5.0
  fiveStarCount: integer("five_star_count").default(0),
  fourStarCount: integer("four_star_count").default(0),
  threeStarCount: integer("three_star_count").default(0),
  twoStarCount: integer("two_star_count").default(0),
  oneStarCount: integer("one_star_count").default(0),

  // Review Metrics
  totalReviewPromptsSent: integer("total_review_prompts_sent").default(0),
  totalReviewTextsReceived: integer("total_review_texts_received").default(0),
  totalReviewsPosted: integer("total_reviews_posted").default(0),
  reviewConversionRate: doublePrecision("review_conversion_rate"), // reviews posted / ratings received

  // Escalation Metrics
  totalEscalations: integer("total_escalations").default(0),
  totalEscalationsResolved: integer("total_escalations_resolved").default(0),
  avgEscalationResolutionTimeHours: doublePrecision("avg_escalation_resolution_time_hours"),

  // Time Window
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ============================================
// Zod Insert Schemas
// ============================================

export const insertJobPhotoSchema = createInsertSchema(jobPhotos);
export const insertCsatRecordSchema = createInsertSchema(csatRecords);
export const insertReviewModerationQueueSchema = createInsertSchema(reviewModerationQueue);
export const insertCsatAnalyticsSchema = createInsertSchema(csatAnalytics);