import { sql, relations } from "drizzle-orm";
import { pgTable, serial, integer, text, timestamp, jsonb, varchar, index, uniqueIndex, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { businessProfiles } from "./schema";

// Marketing Prospects - discovered opportunities from social + referrals
export const marketingProspects = pgTable("marketing_prospects", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  
  // Source tracking
  source: varchar("source", { length: 50 }).notNull(), // 'social' | 'referral'
  sourceContext: jsonb("source_context").notNull(), // platform, postId, url, referrerCustomerId, etc.
  
  // Status pipeline
  status: varchar("status", { length: 50 }).notNull().default("identified"), // identified, contacted, responded, qualified, handed_off, closed_won, closed_lost, do_not_contact
  stage: varchar("stage", { length: 50 }).notNull().default("identified"), // identified, engaged, converted
  
  // Contact info
  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  
  // Location (enhanced for pre-qualification)
  locationRawInput: text("location_raw_input"), // what they typed or what was extracted
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  geocodeConfidence: doublePrecision("geocode_confidence"), // 0-1
  
  // Property classification (NEW for pre-qualification)
  propertyType: varchar("property_type", { length: 20 }), // 'residential' | 'commercial' | 'unknown'
  
  // Intent analysis
  detectedServices: text("detected_services").array(), // ['mowing', 'cleanup', 'landscaping']
  requestedServices: text("requested_services").array(), // normalized canonical services
  urgency: varchar("urgency", { length: 20 }), // 'low' | 'medium' | 'high'
  confidence: doublePrecision("confidence").notNull(), // 0-1 confidence score
  
  // Pre-Qualification (NEW - critical for serviceability)
  serviceabilityStatus: varchar("serviceability_status", { length: 30 }), // 'serviceable' | 'maybe_serviceable' | 'not_serviceable'
  serviceabilityReasons: text("serviceability_reasons").array(), // ['out_of_area', 'service_not_offered', 'commercial_not_supported']
  matchedServiceAreaId: text("matched_service_area_id"), // which service zone matched
  distanceFromServiceAreaMiles: doublePrecision("distance_from_service_area_miles"),
  serviceabilityDecidedAt: timestamp("serviceability_decided_at"),
  
  // Qualification tracking (NEW)
  qualificationStage: varchar("qualification_stage", { length: 30 }).default("unqualified"), // 'unqualified' | 'needs_info' | 'prequalified' | 'disqualified'
  missingFields: text("missing_fields").array(), // ['location', 'propertyType', 'services']
  lastQuestionAsked: text("last_question_asked"),
  lastQuestionAskedAt: timestamp("last_question_asked_at"),
  
  // Engagement tracking
  lastOutreachAt: timestamp("last_outreach_at"),
  lastResponseAt: timestamp("last_response_at"),
  outreachAttempts: integer("outreach_attempts").default(0),
  
  // Handoff tracking
  leadId: integer("lead_id"),
  conversationId: integer("conversation_id"),
  convertedAt: timestamp("converted_at"),
  
  // Outcome tracking
  closeOutcome: varchar("close_outcome", { length: 20 }), // 'won' | 'lost'
  closeReason: text("close_reason"),
  estimatedValueCents: integer("estimated_value_cents"),
  actualRevenueCents: integer("actual_revenue_cents"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdIdx: index("marketing_prospects_business_id_idx").on(table.businessId),
  statusIdx: index("marketing_prospects_status_idx").on(table.status),
  stageIdx: index("marketing_prospects_stage_idx").on(table.stage),
  phoneIdx: index("marketing_prospects_phone_idx").on(table.phone), // dedupe
  serviceabilityIdx: index("marketing_prospects_serviceability_idx").on(table.serviceabilityStatus), // NEW
  qualificationIdx: index("marketing_prospects_qualification_idx").on(table.qualificationStage), // NEW
}));

// Outreach Attempts - every outbound touch
export const outreachAttempts = pgTable("outreach_attempts", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => marketingProspects.id).notNull(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  
  channel: varchar("channel", { length: 20 }).notNull(), // 'sms' | 'email' | 'social'
  messageContent: text("message_content").notNull(),
  
  // Delivery tracking
  status: varchar("status", { length: 50 }).notNull(), // 'queued' | 'sent' | 'delivered' | 'failed' | 'replied'
  externalMessageId: text("external_message_id"), // Twilio SID, etc.
  deliveredAt: timestamp("delivered_at"),
  failureReason: text("failure_reason"),
  
  // Cost tracking
  costCents: integer("cost_cents"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  prospectIdIdx: index("outreach_attempts_prospect_id_idx").on(table.prospectId),
  businessIdIdx: index("outreach_attempts_business_id_idx").on(table.businessId),
}));

// Consent Preferences - opt-in/opt-out tracking
export const marketingConsent = pgTable("marketing_consent", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  
  // Contact identifier (could be phone or email)
  contactType: varchar("contact_type", { length: 20 }).notNull(), // 'phone' | 'email'
  contactValue: text("contact_value").notNull(), // normalized phone (E.164) or email
  
  // Consent status
  optedIn: boolean("opted_in").default(true).notNull(),
  optedOutAt: timestamp("opted_out_at"),
  optedOutReason: text("opted_out_reason"),
  
  // Channel preferences
  allowSms: boolean("allow_sms").default(true),
  allowEmail: boolean("allow_email").default(true),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  contactIdx: uniqueIndex("marketing_consent_contact_idx").on(table.businessId, table.contactType, table.contactValue),
}));

// Marketing Approvals - pending approvals for outreach
export const marketingApprovals = pgTable("marketing_approvals", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => marketingProspects.id).notNull(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  
  approvalType: varchar("approval_type", { length: 50 }).notNull(), // 'outreach' | 'campaign'
  
  // Proposal details
  proposedMessage: text("proposed_message").notNull(),
  proposedChannel: varchar("proposed_channel", { length: 20 }).notNull(),
  contextData: jsonb("context_data"), // post snippet, referral context, etc.
  confidence: doublePrecision("confidence").notNull(),
  reasoning: text("reasoning"),
  
  // Approval tracking
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessStatusIdx: index("marketing_approvals_business_status_idx").on(table.businessId, table.status),
  prospectIdIdx: index("marketing_approvals_prospect_id_idx").on(table.prospectId),
}));

// Social Signals - raw social platform signals
export const socialSignals = pgTable("social_signals", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  
  platform: varchar("platform", { length: 50 }).notNull(), // 'nextdoor' | 'facebook' | 'reddit' | 'google_business'
  postId: text("post_id").notNull(), // external platform post ID
  commentId: text("comment_id"),
  
  // Content
  authorHandle: text("author_handle").notNull(),
  authorDisplayName: text("author_display_name"),
  text: text("text").notNull(),
  url: text("url"),
  
  // Location hints
  communityId: text("community_id"), // neighborhood ID, group ID, etc.
  geoHint: jsonb("geo_hint"), // { city, state, zip, lat, lng }
  
  // Processing
  processed: boolean("processed").default(false).notNull(),
  processingResult: varchar("processing_result", { length: 50 }), // 'created_prospect' | 'ignored_out_of_area' | 'ignored_low_intent'
  prospectId: integer("prospect_id").references(() => marketingProspects.id),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  postIdIdx: uniqueIndex("social_signals_post_id_idx").on(table.platform, table.postId, table.commentId),
  businessProcessedIdx: index("social_signals_business_processed_idx").on(table.businessId, table.processed),
}));

// Provider Service Area Configuration
export const providerServiceAreas = pgTable("provider_service_areas", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  
  name: text("name").notNull(), // "Austin Metro", "North Seattle", etc.
  areaType: varchar("area_type", { length: 20 }).notNull(), // 'polygon' | 'zip_list' | 'radius'
  
  // Area definition (JSON based on type)
  polygonCoords: jsonb("polygon_coords"), // [[lat, lng], [lat, lng], ...]
  zipCodes: text("zip_codes").array(), // ['78701', '78702', ...]
  radiusCenter: jsonb("radius_center"), // { lat, lng }
  radiusMiles: doublePrecision("radius_miles"),
  
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Provider Service Capabilities
export const providerCapabilities = pgTable("provider_capabilities", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  
  // Services offered (canonical list)
  servicesOffered: text("services_offered").array().notNull(), 
  // ['mowing', 'edging', 'trimming', 'mulching', 'leaf_cleanup', 'aeration', 'snow_removal', 'ice_management']
  
  // Property type support
  supportsResidential: boolean("supports_residential").default(true).notNull(),
  supportsCommercial: boolean("supports_commercial").default(false).notNull(),
  
  // Commercial constraints (if supported)
  commercialMinLotSizeSqFt: integer("commercial_min_lot_size_sq_ft"),
  commercialMinContractMonths: integer("commercial_min_contract_months"),
  
  // Seasonal availability
  winterServices: text("winter_services").array(), // ['snow_removal', 'ice_management']
  springServices: text("spring_services").array(),
  summerServices: text("summer_services").array(),
  fallServices: text("fall_services").array(),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdIdx: uniqueIndex("provider_capabilities_business_id_idx").on(table.businessId),
}));

// Canonical service mapping (for normalization)
export const canonicalServices = pgTable("canonical_services", {
  id: serial("id").primaryKey(),
  serviceKey: varchar("service_key", { length: 50 }).notNull().unique(), // 'mowing'
  displayName: text("display_name").notNull(), // 'Lawn Mowing'
  aliases: text("aliases").array(), // ['mow', 'cut grass', 'lawn cutting']
  category: varchar("category", { length: 30 }), // 'lawn_care' | 'landscaping' | 'winter'
});

// =====================================
// Zod Schemas for Validation
// =====================================

export const insertMarketingProspectSchema = createInsertSchema(marketingProspects);
export const insertOutreachAttemptSchema = createInsertSchema(outreachAttempts);
export const insertMarketingConsentSchema = createInsertSchema(marketingConsent);
export const insertMarketingApprovalSchema = createInsertSchema(marketingApprovals);
export const insertSocialSignalSchema = createInsertSchema(socialSignals);
export const insertProviderServiceAreaSchema = createInsertSchema(providerServiceAreas);
export const insertProviderCapabilitiesSchema = createInsertSchema(providerCapabilities);
export const insertCanonicalServiceSchema = createInsertSchema(canonicalServices);

// =====================================
// TypeScript Types
// =====================================

export type MarketingProspect = typeof marketingProspects.$inferSelect;
export type InsertMarketingProspect = typeof marketingProspects.$inferInsert;

export type OutreachAttempt = typeof outreachAttempts.$inferSelect;
export type InsertOutreachAttempt = typeof outreachAttempts.$inferInsert;

export type MarketingConsent = typeof marketingConsent.$inferSelect;
export type InsertMarketingConsent = typeof marketingConsent.$inferInsert;

export type MarketingApproval = typeof marketingApprovals.$inferSelect;
export type InsertMarketingApproval = typeof marketingApprovals.$inferInsert;

export type SocialSignal = typeof socialSignals.$inferSelect;
export type InsertSocialSignal = typeof socialSignals.$inferInsert;

export type ProviderServiceArea = typeof providerServiceAreas.$inferSelect;
export type InsertProviderServiceArea = typeof providerServiceAreas.$inferInsert;

export type ProviderCapabilities = typeof providerCapabilities.$inferSelect;
export type InsertProviderCapabilities = typeof providerCapabilities.$inferInsert;

export type CanonicalService = typeof canonicalServices.$inferSelect;
export type InsertCanonicalService = typeof canonicalServices.$inferInsert;

// =====================================
// Relations
// =====================================

export const marketingProspectsRelations = relations(marketingProspects, ({ one, many }) => ({
  business: one(businessProfiles, {
    fields: [marketingProspects.businessId],
    references: [businessProfiles.id],
  }),
  outreachAttempts: many(outreachAttempts),
  approvals: many(marketingApprovals),
}));

export const outreachAttemptsRelations = relations(outreachAttempts, ({ one }) => ({
  prospect: one(marketingProspects, {
    fields: [outreachAttempts.prospectId],
    references: [marketingProspects.id],
  }),
  business: one(businessProfiles, {
    fields: [outreachAttempts.businessId],
    references: [businessProfiles.id],
  }),
}));

export const marketingApprovalsRelations = relations(marketingApprovals, ({ one }) => ({
  prospect: one(marketingProspects, {
    fields: [marketingApprovals.prospectId],
    references: [marketingProspects.id],
  }),
  business: one(businessProfiles, {
    fields: [marketingApprovals.businessId],
    references: [businessProfiles.id],
  }),
}));

export const socialSignalsRelations = relations(socialSignals, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [socialSignals.businessId],
    references: [businessProfiles.id],
  }),
  prospect: one(marketingProspects, {
    fields: [socialSignals.prospectId],
    references: [marketingProspects.id],
  }),
}));

export const providerServiceAreasRelations = relations(providerServiceAreas, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [providerServiceAreas.businessId],
    references: [businessProfiles.id],
  }),
}));

export const providerCapabilitiesRelations = relations(providerCapabilities, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [providerCapabilities.businessId],
    references: [businessProfiles.id],
  }),
}));
