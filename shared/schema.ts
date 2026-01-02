import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb, doublePrecision, uniqueIndex } from "drizzle-orm/pg-core";
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
  serviceAreaMode: text("service_area_mode").default("circle"), // "circle" | "zip"
  serviceAreaCenterLat: doublePrecision("service_area_center_lat"),
  serviceAreaCenterLng: doublePrecision("service_area_center_lng"),
  serviceAreaRadiusMi: integer("service_area_radius_mi"),
  serviceAreaMaxMi: integer("service_area_max_mi"), // Must be 5, 10, 20, or 40
  serviceAreaAllowExtended: boolean("service_area_allow_extended").default(true),
  serviceZipCodes: text("service_zip_codes").array(), // ZIP codes for ZIP mode
  
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

// Account Packages - subscription package definitions
export const accountPackages = pgTable("account_packages", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  packageName: text("package_name").notNull().default("starter"), // starter, growth, pro
  monthlyActionsIncluded: integer("monthly_actions_included").notNull().default(3000),
  hardCapActions: integer("hard_cap_actions").notNull().default(3500),
  packSizeActions: integer("pack_size_actions").notNull().default(1000),
  packPriceUsd: integer("pack_price_usd").notNull().default(25), // in dollars
  
  // Peak months for seasonality (1-12)
  peakMonths: integer("peak_months").array(),
  
  // Cooldowns for nudge timing
  lastUpgradeNudge: timestamp("last_upgrade_nudge"),
  lastPackNudge: timestamp("last_pack_nudge"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// AI Action Usage - tracks daily AI action consumption
export const aiActionUsage = pgTable("ai_action_usage", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  date: timestamp("date").notNull(), // Date of usage (start of day)
  
  // Action type breakdowns
  inboundQualification: integer("inbound_qualification").default(0).notNull(),
  supervisorOrchestration: integer("supervisor_orchestration").default(0).notNull(),
  quoteGeneration: integer("quote_generation").default(0).notNull(),
  schedulingProposal: integer("scheduling_proposal").default(0).notNull(),
  billingFollowup: integer("billing_followup").default(0).notNull(),
  reviewRequest: integer("review_request").default(0).notNull(),
  
  // Total for the day
  totalActions: integer("total_actions").default(0).notNull(),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessDateIdx: uniqueIndex("ai_action_usage_business_date_idx").on(table.businessId, table.date),
}));

// Growth Advisor Recommendations - stores recommendation history
export const growthRecommendations = pgTable("growth_recommendations", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  
  recommendationType: text("recommendation_type").notNull(), // upgrade, pack, monitor, seasonal_boost
  packageRecommended: text("package_recommended"), // growth, pro
  urgency: text("urgency").notNull(), // low, moderate, high
  reasoning: text("reasoning").notNull(),
  
  // Cost analysis (stored as JSON)
  costAnalysis: jsonb("cost_analysis"),
  
  // Predictions at time of recommendation
  projectedMonthlyActions: integer("projected_monthly_actions"),
  projectedDateHitAllowance: timestamp("projected_date_hit_allowance"),
  projectedDateHitHardCap: timestamp("projected_date_hit_hard_cap"),
  modelConfidence: doublePrecision("model_confidence"),
  
  // User action
  userAction: text("user_action"), // accepted, dismissed, ignored
  userActionAt: timestamp("user_action_at"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ZIP Geocode Cache - caches geocoding results to reduce API calls
export const zipGeoCache = pgTable("zip_geo_cache", {
  zip: text("zip").primaryKey(),
  centerLat: doublePrecision("center_lat").notNull(),
  centerLng: doublePrecision("center_lng").notNull(),
  viewportNorth: doublePrecision("viewport_north").notNull(),
  viewportSouth: doublePrecision("viewport_south").notNull(),
  viewportEast: doublePrecision("viewport_east").notNull(),
  viewportWest: doublePrecision("viewport_west").notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
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

export const insertZipGeoCacheSchema = createInsertSchema(zipGeoCache).omit({
  updatedAt: true,
});

export const insertAccountPackageSchema = createInsertSchema(accountPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiActionUsageSchema = createInsertSchema(aiActionUsage).omit({
  id: true,
  createdAt: true,
});

export const insertGrowthRecommendationSchema = createInsertSchema(growthRecommendations).omit({
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

export type EventReceipt = typeof eventReceipts.$inferSelect;
export type InsertEventReceipt = z.infer<typeof insertEventReceiptSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export type PolicyProfile = typeof policyProfiles.$inferSelect;
export type InsertPolicyProfile = z.infer<typeof insertPolicyProfileSchema>;

export type ZipGeoCache = typeof zipGeoCache.$inferSelect;
export type InsertZipGeoCache = z.infer<typeof insertZipGeoCacheSchema>;

export type AccountPackage = typeof accountPackages.$inferSelect;
export type InsertAccountPackage = z.infer<typeof insertAccountPackageSchema>;

export type AiActionUsage = typeof aiActionUsage.$inferSelect;
export type InsertAiActionUsage = z.infer<typeof insertAiActionUsageSchema>;

export type GrowthRecommendation = typeof growthRecommendations.$inferSelect;
export type InsertGrowthRecommendation = z.infer<typeof insertGrowthRecommendationSchema>;

// Policy tier enum for type safety
export const PolicyTiers = ["owner_operator", "smb", "commercial"] as const;
export type PolicyTier = typeof PolicyTiers[number];

// ============================================
// User Authentication & Phone Verification
// ============================================

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phoneE164: text("phone_e164").unique(), // E.164 format phone number
  phoneVerifiedAt: timestamp("phone_verified_at"),
  businessId: integer("business_id").references(() => businessProfiles.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Phone verification records for OTP
export const phoneVerifications = pgTable("phone_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  phoneE164: text("phone_e164").notNull(),
  otpHash: text("otp_hash").notNull(), // Hashed OTP, never stored in plaintext
  expiresAt: timestamp("expires_at").notNull(),
  attemptsUsed: integer("attempts_used").default(0).notNull(),
  sendsUsedHour: integer("sends_used_hour").default(0).notNull(),
  sendWindowStart: timestamp("send_window_start").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhoneVerificationSchema = createInsertSchema(phoneVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type PhoneVerification = typeof phoneVerifications.$inferSelect;
export type InsertPhoneVerification = z.infer<typeof insertPhoneVerificationSchema>;

// ============================================
// Parcel Coverage & Quote Context
// ============================================

// Parcel Coverage Registry - tracks which counties have parcel data available
export const parcelCoverageRegistry = pgTable("parcel_coverage_registry", {
  id: serial("id").primaryKey(),
  state: text("state").notNull(),
  countyFips: text("county_fips").notNull(),
  countyName: text("county_name").notNull(),
  coverageStatus: text("coverage_status").notNull().default("unknown"), // full, partial, none, unknown
  provider: text("provider"), // Data provider name
  lookupUrl: text("lookup_url"), // URL for manual lookups
  notes: text("notes"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  stateCountyIdx: uniqueIndex("parcel_coverage_state_county_idx").on(table.state, table.countyFips),
}));

// Property Quote Context - stores property data for quote calculations
export const propertyQuoteContext = pgTable("property_quote_context", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  conversationId: integer("conversation_id").references(() => conversations.id),
  
  // Address info
  normalizedAddress: text("normalized_address"),
  zip: text("zip"),
  countyName: text("county_name"),
  state: text("state"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  
  // Parcel data
  parcelCoverageStatus: text("parcel_coverage_status"), // full, partial, none, unknown
  parcelId: text("parcel_id"),
  lotAreaSqft: integer("lot_area_sqft"),
  areaBand: text("area_band"), // xs, small, medium, large, xl, xxl
  
  // Data source and confidence
  source: text("source").notNull().default("unknown"), // parcel, customer, unknown
  confidence: text("confidence").notNull().default("low"), // high, medium, low
  
  // Complexity flags (for pricing)
  complexityTrees: text("complexity_trees").default("unknown"), // none, few, many, unknown
  complexityShrubs: text("complexity_shrubs").default("unknown"),
  complexityBeds: text("complexity_beds").default("unknown"),
  complexitySlope: text("complexity_slope").default("unknown"), // flat, moderate, steep, unknown
  complexityAccess: text("complexity_access").default("unknown"), // easy, moderate, difficult, unknown
  
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas
export const insertParcelCoverageRegistrySchema = createInsertSchema(parcelCoverageRegistry).omit({
  id: true,
  updatedAt: true,
});

export const insertPropertyQuoteContextSchema = createInsertSchema(propertyQuoteContext).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type ParcelCoverageRegistry = typeof parcelCoverageRegistry.$inferSelect;
export type InsertParcelCoverageRegistry = z.infer<typeof insertParcelCoverageRegistrySchema>;

export type PropertyQuoteContext = typeof propertyQuoteContext.$inferSelect;
export type InsertPropertyQuoteContext = z.infer<typeof insertPropertyQuoteContextSchema>;

// Area band definitions (sqft ranges)
export const AreaBands = {
  xs: { min: 0, max: 2500, label: "Extra Small (<2,500 sqft)" },
  small: { min: 2500, max: 5000, label: "Small (2,500-5,000 sqft)" },
  medium: { min: 5000, max: 10000, label: "Medium (5,000-10,000 sqft)" },
  large: { min: 10000, max: 20000, label: "Large (10,000-20,000 sqft)" },
  xl: { min: 20000, max: 43560, label: "Extra Large (20,000-1 acre)" },
  xxl: { min: 43560, max: Infinity, label: "XXL (1+ acre)" },
} as const;

export type AreaBandKey = keyof typeof AreaBands;

// ============================================
// FREE-FIRST Lot Size Resolver Tables
// ============================================

// County Source - ArcGIS endpoint config for parcel lookups
export const countySources = pgTable("county_sources", {
  id: serial("id").primaryKey(),
  stateFips: text("state_fips").notNull(),
  countyFips: text("county_fips").notNull(),
  countyName: text("county_name").notNull(),
  status: text("status").notNull().default("unknown"), // full, partial, none, unknown
  sourceType: text("source_type").notNull().default("none"), // arcgis_feature_service, arcgis_rest, manual_viewer, none
  serviceUrl: text("service_url"), // FeatureServer base URL (no layer id)
  layerId: integer("layer_id"), // parcel layer index
  supportsPointQuery: boolean("supports_point_query").default(false),
  areaFieldCandidates: jsonb("area_field_candidates").default(sql`'[]'::jsonb`), // ["Shape_Area","ACRES","LOT_ACRES",...]
  areaUnits: text("area_units").default("unknown"), // sqft, sqm, acres, unknown
  parcelIdField: text("parcel_id_field"), // field name for parcel ID
  lastVerifiedAt: timestamp("last_verified_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  stateCountyIdx: uniqueIndex("county_sources_state_county_idx").on(table.stateFips, table.countyFips),
}));

// Geocode Cache - address to lat/lng cache (180 day TTL)
export const geocodeCache = pgTable("geocode_cache", {
  addressHash: text("address_hash").primaryKey(), // SHA-256 hash of normalized address
  normalizedAddress: text("normalized_address").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  zip: text("zip"),
  stateFips: text("state_fips"),
  countyFips: text("county_fips"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Parcel Cache - lot size cache (365 day TTL, 30 day for negative)
export const parcelCache = pgTable("parcel_cache", {
  cacheKey: text("cache_key").primaryKey(), // `${countyFips}:${latRound}:${lngRound}`
  countyFips: text("county_fips").notNull(),
  latRound: doublePrecision("lat_round").notNull(),
  lngRound: doublePrecision("lng_round").notNull(),
  parcelAreaSqft: doublePrecision("parcel_area_sqft"),
  parcelId: text("parcel_id"),
  sourceUrl: text("source_url"),
  confidence: text("confidence").notNull().default("low"), // high, medium, low
  negative: boolean("negative").default(false), // true if unsupported or failed
  negativeReason: text("negative_reason"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ZIP County Crosswalk - ZIP to county FIPS mapping
export const zipCountyCrosswalk = pgTable("zip_county_crosswalk", {
  id: serial("id").primaryKey(),
  zip: text("zip").notNull(),
  countyFips: text("county_fips").notNull(),
  stateFips: text("state_fips").notNull(),
  countyName: text("county_name"),
  weight: doublePrecision("weight").default(1.0), // probability/ratio for ZIPs spanning counties
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  zipIdx: uniqueIndex("zip_county_crosswalk_zip_idx").on(table.zip, table.countyFips),
}));

// Insert schemas for lot size resolver tables
export const insertCountySourceSchema = createInsertSchema(countySources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGeocodeCacheSchema = createInsertSchema(geocodeCache).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertParcelCacheSchema = createInsertSchema(parcelCache).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertZipCountyCrosswalkSchema = createInsertSchema(zipCountyCrosswalk).omit({
  id: true,
  createdAt: true,
});

// Types for lot size resolver
export type CountySource = typeof countySources.$inferSelect;
export type InsertCountySource = z.infer<typeof insertCountySourceSchema>;

export type GeocodeCache = typeof geocodeCache.$inferSelect;
export type InsertGeocodeCache = z.infer<typeof insertGeocodeCacheSchema>;

export type ParcelCache = typeof parcelCache.$inferSelect;
export type InsertParcelCache = z.infer<typeof insertParcelCacheSchema>;

export type ZipCountyCrosswalk = typeof zipCountyCrosswalk.$inferSelect;
export type InsertZipCountyCrosswalk = z.infer<typeof insertZipCountyCrosswalkSchema>;

// LotSizeResult interface for the resolver
export interface LotSizeResult {
  normalizedAddress: string;
  lat: number;
  lng: number;
  zip: string | null;
  countyFips: string | null;
  countyName: string | null;
  parcelCoverage: "full" | "partial" | "none" | "unknown";
  lotAreaSqft: number | null;
  lotAreaAcres: number | null;
  confidence: "high" | "medium" | "low";
  source: "county_gis" | "cache" | "customer_required";
  fallback: {
    requiresCustomerValidation: boolean;
    questions: string[];
  };
}

// ============================================
// Jobber Integration Tables
// ============================================

// Jobber Accounts - OAuth tokens and account info
export const jobberAccounts = pgTable("jobber_accounts", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  jobberAccountId: text("jobber_account_id").notNull().unique(),
  jobberUserId: text("jobber_user_id"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  scopes: text("scopes").array(),
  webhookSecret: text("webhook_secret"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Jobber Webhook Events - deduplication and tracking
export const jobberWebhookEvents = pgTable("jobber_webhook_events", {
  id: serial("id").primaryKey(),
  webhookEventId: text("webhook_event_id").notNull().unique(),
  jobberAccountId: text("jobber_account_id").notNull(),
  topic: text("topic").notNull(), // CLIENT_CREATE, PROPERTY_UPDATE, QUOTE_CREATE, etc.
  objectId: text("object_id").notNull(), // ID of the client/property/quote
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed, skipped
  error: text("error"),
  attempts: integer("attempts").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  receivedAt: timestamp("received_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Jobber Enrichments - cached enrichment data for Jobber objects
export const jobberEnrichments = pgTable("jobber_enrichments", {
  id: serial("id").primaryKey(),
  jobberAccountId: text("jobber_account_id").notNull(),
  objectType: text("object_type").notNull(), // client, property, quote
  objectId: text("object_id").notNull(),
  lotSizeEstimate: integer("lot_size_estimate"), // in sqft
  serviceClass: text("service_class"), // residential_small, residential_medium, residential_large, commercial
  accessConstraints: text("access_constraints").array(), // gated, narrow_access, steep_driveway, etc.
  slopeRisk: text("slope_risk"), // low, medium, high
  enrichmentData: jsonb("enrichment_data"), // full enrichment payload
  syncedToJobber: boolean("synced_to_jobber").default(false),
  lastSyncAt: timestamp("last_sync_at"),
  lastWriteSource: text("last_write_source"), // "lawnflow" | "external" - for loop prevention
  lastWriteAt: timestamp("last_write_at"), // timestamp of last LawnFlow write
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  objectIdx: uniqueIndex("jobber_enrichments_object_idx").on(table.jobberAccountId, table.objectType, table.objectId),
}));

// Quote-Job Sync - tracks quote-to-job synchronization events
export const jobberQuoteJobSync = pgTable("jobber_quote_job_sync", {
  id: serial("id").primaryKey(),
  jobberAccountId: text("jobber_account_id").notNull(),
  quoteId: text("quote_id").notNull(),
  jobId: text("job_id"),
  idempotencyKey: text("idempotency_key").notNull(), // topic + objectId + updatedAt hash
  status: text("status").notNull().default("pending"), // pending, processing, applied, change_order, skipped, failed
  diffComputed: jsonb("diff_computed"), // computed line item diff
  rulesViolations: text("rules_violations").array(), // which rules were violated
  appliedChanges: jsonb("applied_changes"), // changes that were applied
  changeOrderReason: text("change_order_reason"), // reason change order was required
  error: text("error"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  processedAt: timestamp("processed_at"),
}, (table) => ({
  idempotencyIdx: uniqueIndex("jobber_quote_job_sync_idempotency_idx").on(table.idempotencyKey),
  quoteIdx: uniqueIndex("jobber_quote_job_sync_quote_idx").on(table.jobberAccountId, table.quoteId),
}));

// Insert schemas for Jobber tables
export const insertJobberAccountSchema = createInsertSchema(jobberAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobberWebhookEventSchema = createInsertSchema(jobberWebhookEvents).omit({
  id: true,
  createdAt: true,
});

export const insertJobberEnrichmentSchema = createInsertSchema(jobberEnrichments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobberQuoteJobSyncSchema = createInsertSchema(jobberQuoteJobSync).omit({
  id: true,
  createdAt: true,
});

// Types for Jobber integration
export type JobberAccount = typeof jobberAccounts.$inferSelect;
export type InsertJobberAccount = z.infer<typeof insertJobberAccountSchema>;

export type JobberWebhookEvent = typeof jobberWebhookEvents.$inferSelect;
export type InsertJobberWebhookEvent = z.infer<typeof insertJobberWebhookEventSchema>;

export type JobberEnrichment = typeof jobberEnrichments.$inferSelect;
export type InsertJobberEnrichment = z.infer<typeof insertJobberEnrichmentSchema>;

export type JobberQuoteJobSync = typeof jobberQuoteJobSync.$inferSelect;
export type InsertJobberQuoteJobSync = z.infer<typeof insertJobberQuoteJobSyncSchema>;

// ============================================
// Dispatch & Routing Tables
// ============================================

// Crew Roster - crew capacity and equipment capabilities
export const crewRoster = pgTable("crew_roster", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  jobberCrewId: text("jobber_crew_id"), // External Jobber team/crew ID if synced
  name: text("name").notNull(),
  color: text("color"), // For UI display (hex color)
  capacity: integer("capacity").default(8), // Max jobs per day
  equipmentCapabilities: text("equipment_capabilities").array(), // mower, aerator, trailer, etc.
  homeBaseLat: doublePrecision("home_base_lat"),
  homeBaseLng: doublePrecision("home_base_lng"),
  homeBaseAddress: text("home_base_address"),
  availabilityStart: text("availability_start").default("08:00"), // HH:mm format
  availabilityEnd: text("availability_end").default("17:00"), // HH:mm format
  workDays: text("work_days").array().default(["mon", "tue", "wed", "thu", "fri"]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Dispatch Plans - route plans for a given date
export const dispatchPlans = pgTable("dispatch_plans", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  jobberAccountId: text("jobber_account_id"),
  planDate: timestamp("plan_date").notNull(), // Date this plan is for
  mode: text("mode").notNull().default("nightly"), // "nightly" | "event"
  status: text("status").notNull().default("draft"), // draft, pending_apply, applied, rejected, failed
  triggerEventId: text("trigger_event_id"), // Webhook event ID that triggered this plan
  
  // Algorithm inputs snapshot
  totalJobs: integer("total_jobs").default(0),
  totalCrews: integer("total_crews").default(0),
  inputSnapshot: jsonb("input_snapshot"), // { jobs, crews, constraints }
  
  // Algorithm outputs
  crewAssignments: jsonb("crew_assignments"), // { crewId: [jobId, ...], ... }
  routeStops: jsonb("route_stops"), // { crewId: [{ jobId, order, arriveBy, departBy, driveMins }, ...] }
  totalDriveMinutes: integer("total_drive_minutes"),
  utilizationPercent: integer("utilization_percent"),
  
  // Jobber sync
  routeUrl: text("route_url"), // Link to route visualization
  autoApplyEnabled: boolean("auto_apply_enabled").default(false),
  appliedAt: timestamp("applied_at"),
  applyError: text("apply_error"),
  
  // Metadata
  algorithmVersion: text("algorithm_version").default("v1-greedy"),
  computeTimeMs: integer("compute_time_ms"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  planDateIdx: uniqueIndex("dispatch_plans_date_idx").on(table.businessId, table.planDate, table.mode),
}));

// Dispatch Plan Events - audit log for dispatch operations
export const dispatchPlanEvents = pgTable("dispatch_plan_events", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").references(() => dispatchPlans.id).notNull(),
  eventType: text("event_type").notNull(), // created, computed, approved, applied, rejected, failed
  actor: text("actor").default("system"), // system, user, webhook
  details: jsonb("details"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas for dispatch tables
export const insertCrewRosterSchema = createInsertSchema(crewRoster).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDispatchPlanSchema = createInsertSchema(dispatchPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDispatchPlanEventSchema = createInsertSchema(dispatchPlanEvents).omit({
  id: true,
  createdAt: true,
});

// Types for dispatch
export type CrewRoster = typeof crewRoster.$inferSelect;
export type InsertCrewRoster = z.infer<typeof insertCrewRosterSchema>;

export type DispatchPlan = typeof dispatchPlans.$inferSelect;
export type InsertDispatchPlan = z.infer<typeof insertDispatchPlanSchema>;

export type DispatchPlanEvent = typeof dispatchPlanEvents.$inferSelect;
export type InsertDispatchPlanEvent = z.infer<typeof insertDispatchPlanEventSchema>;

// Dispatch algorithm types
export interface RouteStop {
  jobId: string;
  jobberJobId?: string;
  order: number;
  propertyAddress: string;
  lat: number;
  lng: number;
  arriveBy: string; // ISO timestamp
  departBy: string; // ISO timestamp
  driveMinsFromPrev: number;
  serviceType?: string;
  estimatedDurationMins: number;
}

export interface CrewAssignment {
  crewId: number;
  crewName: string;
  stops: RouteStop[];
  totalDriveMins: number;
  totalServiceMins: number;
  utilizationPercent: number;
}

export interface DispatchPlanResult {
  planDate: string;
  assignments: CrewAssignment[];
  unassignedJobs: string[];
  totalDriveMins: number;
  overallUtilization: number;
  warnings: string[];
}

// ============================================
// Margin & Variance Tracking Tables
// ============================================

// Job Snapshots - baseline data captured when job starts
export const jobSnapshots = pgTable("job_snapshots", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  jobberAccountId: text("jobber_account_id"),
  jobberJobId: text("jobber_job_id").notNull(),
  jobberQuoteId: text("jobber_quote_id"), // Source quote if applicable
  
  // Baseline metrics (captured at job creation/start)
  baselineRevenue: integer("baseline_revenue"), // cents
  baselineCost: integer("baseline_cost"), // cents (labor + materials estimate)
  baselineMarginPercent: integer("baseline_margin_percent"), // 0-100
  
  // Expected duration model inputs
  serviceType: text("service_type").notNull(),
  lotSizeSqft: integer("lot_size_sqft"),
  crewSize: integer("crew_size").default(1),
  expectedDurationMins: integer("expected_duration_mins").notNull(),
  expectedVisits: integer("expected_visits").default(1),
  
  // Current progress (updated on VISIT_* events)
  actualDurationMins: integer("actual_duration_mins").default(0),
  visitsCompleted: integer("visits_completed").default(0),
  timeLoggedMins: integer("time_logged_mins").default(0),
  
  // Variance tracking
  durationVariancePercent: integer("duration_variance_percent").default(0), // negative = under, positive = over
  marginRisk: text("margin_risk").default("normal"), // normal, medium, high
  lastVarianceCheck: timestamp("last_variance_check"),
  
  // Sync status
  jobberSynced: boolean("jobber_synced").default(false),
  jobberSyncedAt: timestamp("jobber_synced_at"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  jobberJobIdx: uniqueIndex("job_snapshots_jobber_job_idx").on(table.jobberAccountId, table.jobberJobId),
}));

// Margin Alerts - internal alerts for variance threshold breaches
export const marginAlerts = pgTable("margin_alerts", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  snapshotId: integer("snapshot_id").references(() => jobSnapshots.id).notNull(),
  jobberJobId: text("jobber_job_id").notNull(),
  
  // Alert details
  alertType: text("alert_type").notNull(), // duration_overrun, margin_risk, visit_overrun
  severity: text("severity").notNull().default("medium"), // low, medium, high
  title: text("title").notNull(),
  description: text("description").notNull(),
  
  // Variance data
  expectedValue: integer("expected_value"),
  actualValue: integer("actual_value"),
  variancePercent: integer("variance_percent"),
  
  // Recommended actions (JSON array)
  recommendedActions: jsonb("recommended_actions"), // [{ action, description, priority }]
  
  // Status tracking
  status: text("status").notNull().default("open"), // open, acknowledged, resolved, dismissed
  acknowledgedBy: text("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"), // notes on how it was resolved
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Insert schemas for margin tables
export const insertJobSnapshotSchema = createInsertSchema(jobSnapshots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarginAlertSchema = createInsertSchema(marginAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for margin tracking
export type JobSnapshot = typeof jobSnapshots.$inferSelect;
export type InsertJobSnapshot = z.infer<typeof insertJobSnapshotSchema>;

export type MarginAlert = typeof marginAlerts.$inferSelect;
export type InsertMarginAlert = z.infer<typeof insertMarginAlertSchema>;

// Margin alert recommended action type
export interface MarginAlertAction {
  action: string;
  description: string;
  priority: "low" | "medium" | "high";
}

// ==================== BILLING ORCHESTRATOR ====================

// Tracks billing lifecycle state for each job
export const jobBillingStates = pgTable("job_billing_states", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  jobberAccountId: text("jobber_account_id").notNull(),
  jobberJobId: text("jobber_job_id").notNull(),
  
  // Job context
  serviceType: text("service_type").notNull(),
  totalJobValue: integer("total_job_value"), // cents
  
  // Current milestone state
  currentMilestone: text("current_milestone").notNull().default("created"), // created, scheduled, in_progress, complete
  milestoneReachedAt: timestamp("milestone_reached_at"),
  
  // Invoice stage flags (prevent duplicates)
  depositInvoiceSent: boolean("deposit_invoice_sent").default(false),
  progressInvoiceSent: boolean("progress_invoice_sent").default(false),
  finalInvoiceSent: boolean("final_invoice_sent").default(false),
  
  // Billing stage (synced to Jobber custom field)
  billingStage: text("billing_stage").default("pending"), // pending, deposit_sent, deposit_paid, progress_sent, progress_paid, final_sent, final_paid
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  jobberJobIdx: uniqueIndex("billing_states_jobber_job_idx").on(table.jobberAccountId, table.jobberJobId),
}));

// Individual invoices created for billing milestones
export const billingInvoices = pgTable("billing_invoices", {
  id: serial("id").primaryKey(),
  billingStateId: integer("billing_state_id").references(() => jobBillingStates.id).notNull(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  
  // Jobber references
  jobberAccountId: text("jobber_account_id").notNull(),
  jobberJobId: text("jobber_job_id").notNull(),
  jobberInvoiceId: text("jobber_invoice_id"), // Set after invoice created in Jobber
  
  // Invoice details
  invoiceType: text("invoice_type").notNull(), // deposit, progress, final
  amount: integer("amount").notNull(), // cents
  percentageOfTotal: integer("percentage_of_total"), // 0-100
  description: text("description"),
  
  // Status tracking
  status: text("status").notNull().default("pending"), // pending, created, sent, paid, cancelled
  
  // Timestamps
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  
  // Error tracking
  lastError: text("last_error"),
  retryCount: integer("retry_count").default(0),
}, (table) => ({
  // Idempotency: one invoice per type per job
  jobInvoiceTypeIdx: uniqueIndex("billing_invoice_job_type_idx").on(table.jobberAccountId, table.jobberJobId, table.invoiceType),
}));

// Insert schemas for billing tables
export const insertJobBillingStateSchema = createInsertSchema(jobBillingStates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBillingInvoiceSchema = createInsertSchema(billingInvoices).omit({
  id: true,
  createdAt: true,
});

// Types for billing
export type JobBillingState = typeof jobBillingStates.$inferSelect;
export type InsertJobBillingState = z.infer<typeof insertJobBillingStateSchema>;

export type BillingInvoice = typeof billingInvoices.$inferSelect;
export type InsertBillingInvoice = z.infer<typeof insertBillingInvoiceSchema>;
