import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb, doublePrecision, uniqueIndex, index } from "drizzle-orm/pg-core";
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

// User roles for RBAC
export const UserRoles = ["owner", "admin", "crew_lead", "staff"] as const;
export type UserRole = typeof UserRoles[number];

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phoneE164: text("phone_e164").unique(), // E.164 format phone number
  phoneVerifiedAt: timestamp("phone_verified_at"),
  businessId: integer("business_id").references(() => businessProfiles.id),
  role: text("role").notNull().default("owner"), // owner, admin, crew_lead, staff
  displayName: text("display_name"), // For UI display
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

// ============================================================================
// Reconciliation & Dead Letter Queue Tables
// ============================================================================

// Reconciliation alerts for invoice/payment mismatches
export const reconciliationAlerts = pgTable("reconciliation_alerts", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  jobberAccountId: text("jobber_account_id").notNull(),
  
  // Reference to the problematic entity
  entityType: text("entity_type").notNull(), // invoice, payment, job
  entityId: text("entity_id").notNull(),
  jobberInvoiceId: text("jobber_invoice_id"),
  jobberJobId: text("jobber_job_id"),
  
  // Alert details
  alertType: text("alert_type").notNull(), // payment_mismatch, deposit_inconsistency, missing_payment, overpayment
  severity: text("severity").notNull().default("warning"), // info, warning, critical
  
  // Mismatch data for debugging
  expectedValue: integer("expected_value"), // cents
  actualValue: integer("actual_value"), // cents
  variance: integer("variance"), // cents (actualValue - expectedValue)
  
  description: text("description"),
  
  // Resolution tracking
  status: text("status").notNull().default("open"), // open, acknowledged, resolved, ignored
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
  resolutionNotes: text("resolution_notes"),
  
  // Jobber sync status
  jobberFieldUpdated: boolean("jobber_field_updated").default(false),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  entityIdx: index("recon_alerts_entity_idx").on(table.jobberAccountId, table.entityType, table.entityId),
  statusIdx: index("recon_alerts_status_idx").on(table.businessId, table.status),
}));

// Dead letter queue for failed webhook events
export const deadLetterQueue = pgTable("dead_letter_queue", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  jobberAccountId: text("jobber_account_id").notNull(),
  
  // Original webhook event data
  webhookEventId: text("webhook_event_id").notNull(),
  topic: text("topic").notNull(),
  objectId: text("object_id").notNull(),
  occurredAt: timestamp("occurred_at"),
  payload: text("payload"), // JSON stringified webhook payload
  
  // Failure tracking
  failureReason: text("failure_reason").notNull(),
  failureDetails: text("failure_details"), // Stack trace or additional context
  failedAt: timestamp("failed_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  
  // Retry management
  retryCount: integer("retry_count").default(0).notNull(),
  maxRetries: integer("max_retries").default(3).notNull(),
  lastRetryAt: timestamp("last_retry_at"),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Status
  status: text("status").notNull().default("pending"), // pending, retrying, exhausted, resolved, discarded
  resolvedAt: timestamp("resolved_at"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  webhookEventIdx: uniqueIndex("dlq_webhook_event_idx").on(table.webhookEventId),
  statusIdx: index("dlq_status_idx").on(table.status, table.nextRetryAt),
}));

// Insert schemas
export const insertReconciliationAlertSchema = createInsertSchema(reconciliationAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeadLetterQueueSchema = createInsertSchema(deadLetterQueue).omit({
  id: true,
  createdAt: true,
});

// Customer communication log for tracking all outbound messages
export const customerCommLog = pgTable("customer_comm_log", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  jobberAccountId: text("jobber_account_id"),
  
  // Message details
  messageType: text("message_type").notNull(), // job_rescheduled, job_completed, reminder, follow_up
  serviceCategory: text("service_category"), // lawn_maintenance, hardscape
  templateId: text("template_id").notNull(),
  
  // Recipient info
  recipientPhone: text("recipient_phone").notNull(),
  recipientName: text("recipient_name"),
  
  // Content
  messageContent: text("message_content").notNull(),
  templateVariables: jsonb("template_variables"), // Variables used in rendering
  
  // Related entities
  jobberJobId: text("jobber_job_id"),
  jobberClientId: text("jobber_client_id"),
  conversationId: integer("conversation_id").references(() => conversations.id),
  
  // Delivery status
  deliveryStatus: text("delivery_status").notNull().default("pending"), // pending, sent, delivered, failed
  twilioMessageSid: text("twilio_message_sid"),
  deliveredAt: timestamp("delivered_at"),
  failureReason: text("failure_reason"),
  
  // Compliance tracking
  complianceChecks: jsonb("compliance_checks"), // {noExactEta: true, hasRescheduleOption: true}
  
  // Jobber sync
  jobberFieldUpdated: boolean("jobber_field_updated").default(false),
  jobberFieldValue: text("jobber_field_value"), // The link/pointer written to Jobber
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdx: index("comm_log_business_idx").on(table.businessId),
  jobIdx: index("comm_log_job_idx").on(table.jobberJobId),
  statusIdx: index("comm_log_status_idx").on(table.deliveryStatus),
}));

export const insertCustomerCommLogSchema = createInsertSchema(customerCommLog).omit({
  id: true,
  createdAt: true,
});

// ============================================
// Agent Management Control Center
// ============================================

// Agent Registry - All workers/agents registered in the system
export const agentRegistry = pgTable("agent_registry", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  
  // Agent identification
  agentKey: text("agent_key").notNull(), // unique key: margin_worker, dispatch_worker, comms_worker, etc.
  displayName: text("display_name").notNull(),
  purpose: text("purpose"), // Short one-line purpose
  description: text("description"),
  category: text("category").notNull(), // core, ops, finance, comms
  
  // New: Lifecycle stage and domains for Agent Directory UI
  stage: text("stage").notNull().default("core"), // lead_intake, quoting, confirmation, scheduling, crew_assignment, booking, retention_insights, integrations, core
  domains: text("domains").array(), // messaging, pricing, routing, memory, integrations, orchestration, fsm
  triggers: text("triggers").array(), // e.g., ["missed_call", "inbound_sms", "webhook"]
  
  // I/O Schema (from Zod contracts)
  inputSchema: jsonb("input_schema"), // JSON schema for inputs
  outputSchema: jsonb("output_schema"), // JSON schema for outputs
  
  // Status & Control
  status: text("status").notNull().default("active"), // active, paused, error, needs_config
  lastRunAt: timestamp("last_run_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastError: text("last_error"),
  
  // Health metrics (computed)
  healthScore: integer("health_score").default(100), // 0-100
  successRate24h: doublePrecision("success_rate_24h").default(100),
  avgLatencyMs: integer("avg_latency_ms"),
  failureStreak: integer("failure_streak").default(0),
  
  // Value metrics
  totalRuns: integer("total_runs").default(0),
  timeSavedMinutes: integer("time_saved_minutes").default(0),
  cashAcceleratedCents: integer("cash_accelerated_cents").default(0),
  revenueProtectedCents: integer("revenue_protected_cents").default(0),
  
  // Configuration
  config: jsonb("config"), // agent-specific config
  schedule: text("schedule"), // cron expression or "event-driven"
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessAgentIdx: uniqueIndex("agent_business_key_idx").on(table.businessId, table.agentKey),
  categoryIdx: index("agent_category_idx").on(table.category),
  statusIdx: index("agent_status_idx").on(table.status),
  stageIdx: index("agent_stage_idx").on(table.stage),
}));

// Agent Run Log - Execution history for each agent
export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agentRegistry.id).notNull(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  
  // Run details
  runId: text("run_id").notNull(), // UUID for deduplication
  status: text("status").notNull().default("running"), // running, success, failed, timeout
  triggeredBy: text("triggered_by").notNull(), // cron, event, manual
  eventType: text("event_type"), // For event-driven runs
  eventPayload: jsonb("event_payload"),
  isTestRun: boolean("is_test_run").default(false), // Manual test execution flag
  
  // Timing
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  
  // Outputs
  result: jsonb("result"), // Output data
  error: text("error"),
  errorStack: text("error_stack"),
  
  // Metrics for this run
  itemsProcessed: integer("items_processed").default(0),
  timeSavedMinutes: integer("time_saved_minutes").default(0),
  cashAcceleratedCents: integer("cash_accelerated_cents").default(0),
  revenueProtectedCents: integer("revenue_protected_cents").default(0),
  
  // Related entities
  relatedJobId: text("related_job_id"),
  relatedClientId: text("related_client_id"),
  jobRequestId: integer("job_request_id"), // For test runs with specific job requests
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  agentIdx: index("run_agent_idx").on(table.agentId),
  statusIdx: index("run_status_idx").on(table.status),
  startedIdx: index("run_started_idx").on(table.startedAt),
  runIdIdx: uniqueIndex("run_id_unique_idx").on(table.runId),
}));

// Insert schemas
export const insertAgentRegistrySchema = createInsertSchema(agentRegistry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentRunSchema = createInsertSchema(agentRuns).omit({
  id: true,
  createdAt: true,
});

// Types
export type AgentRegistryEntry = typeof agentRegistry.$inferSelect;
export type InsertAgentRegistryEntry = z.infer<typeof insertAgentRegistrySchema>;

export type AgentRunEntry = typeof agentRuns.$inferSelect;
export type InsertAgentRunEntry = z.infer<typeof insertAgentRunSchema>;

// Types
export type ReconciliationAlert = typeof reconciliationAlerts.$inferSelect;
export type InsertReconciliationAlert = z.infer<typeof insertReconciliationAlertSchema>;

export type DeadLetterQueueItem = typeof deadLetterQueue.$inferSelect;
export type InsertDeadLetterQueueItem = z.infer<typeof insertDeadLetterQueueSchema>;

export type CustomerCommLogEntry = typeof customerCommLog.$inferSelect;
export type InsertCustomerCommLogEntry = z.infer<typeof insertCustomerCommLogSchema>;

// ============================================
// SMS Intelligence Layer - Session Management
// ============================================

// SMS Sessions - tracks SMS conversation state machine progress
export const smsSessions = pgTable("sms_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(), // UUID for external reference
  accountId: text("account_id").notNull(), // Jobber account or LawnFlow account
  businessId: integer("business_id").references(() => businessProfiles.id),
  
  // Channel info
  channel: text("channel").notNull().default("sms"),
  fromPhone: text("from_phone").notNull(), // Customer phone
  toPhone: text("to_phone").notNull(), // Business SMS number
  
  // Session state
  status: text("status").notNull().default("active"), // active, paused_for_human, dormant, closed
  serviceTemplateId: text("service_template_id").notNull().default("lawncare_v1"),
  state: text("state").notNull().default("INTENT"), // Current state machine state
  stateEnteredAt: timestamp("state_entered_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  
  // Activity tracking
  lastInboundAt: timestamp("last_inbound_at"),
  lastOutboundAt: timestamp("last_outbound_at"),
  
  // State machine data (JSONB columns)
  attemptCounters: jsonb("attempt_counters").default({}), // Per-state attempt counters
  confidence: jsonb("confidence").default({}), // Confidence scores
  collected: jsonb("collected").default({}), // User-provided field values
  derived: jsonb("derived").default({}), // System-derived values (ArcGIS, enrichment)
  quote: jsonb("quote").default({}), // Quote information
  scheduling: jsonb("scheduling").default({}), // Scheduling data
  handoff: jsonb("handoff").default({}), // Handoff metadata
  audit: jsonb("audit").default({}), // Jobber IDs, external references
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  sessionIdIdx: uniqueIndex("sms_session_id_idx").on(table.sessionId),
  phoneIdx: index("sms_session_phone_idx").on(table.fromPhone),
  statusIdx: index("sms_session_status_idx").on(table.status),
  businessIdx: index("sms_session_business_idx").on(table.businessId),
}));

// SMS Events - append-only log of all messages
export const smsEvents = pgTable("sms_events", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull().unique(), // UUID for deduplication
  sessionId: text("session_id").notNull(), // References sms_sessions.sessionId
  
  // Event details
  ts: timestamp("ts").default(sql`CURRENT_TIMESTAMP`).notNull(),
  direction: text("direction").notNull(), // inbound, outbound
  providerMessageId: text("provider_message_id"), // Twilio MessageSid for deduplication
  type: text("type").notNull().default("sms"),
  text: text("text").notNull(),
  
  // Payload and analysis
  payloadJson: jsonb("payload_json"), // Raw provider payload
  nlpJson: jsonb("nlp_json"), // Optional intent/sentiment analysis
  
  // State tracking
  stateBefore: text("state_before"),
  stateAfter: text("state_after"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  eventIdIdx: uniqueIndex("sms_event_id_idx").on(table.eventId),
  sessionIdx: index("sms_event_session_idx").on(table.sessionId),
  providerMsgIdx: index("sms_event_provider_msg_idx").on(table.providerMessageId),
  tsIdx: index("sms_event_ts_idx").on(table.ts),
}));

// Handoff Tickets - tracks human escalations
export const handoffTickets = pgTable("handoff_tickets", {
  id: serial("id").primaryKey(),
  ticketId: text("ticket_id").notNull().unique(), // UUID
  sessionId: text("session_id").notNull(), // References sms_sessions.sessionId
  accountId: text("account_id").notNull(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  
  // Ticket details
  status: text("status").notNull().default("open"), // open, assigned, resolved, closed
  priority: text("priority").notNull().default("normal"), // low, normal, high
  reasonCodes: jsonb("reason_codes").default([]), // Array of reason codes
  summary: text("summary"),
  
  // Assignment
  assignedTo: text("assigned_to"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  ticketIdIdx: uniqueIndex("handoff_ticket_id_idx").on(table.ticketId),
  sessionIdx: index("handoff_session_idx").on(table.sessionId),
  statusIdx: index("handoff_status_idx").on(table.status),
  businessIdx: index("handoff_business_idx").on(table.businessId),
}));

// Click-to-Call Tokens - expiring tokens for phone handoff
export const clickToCallTokens = pgTable("click_to_call_tokens", {
  id: serial("id").primaryKey(),
  tokenId: text("token_id").notNull().unique(), // UUID
  sessionId: text("session_id").notNull(), // References sms_sessions.sessionId
  
  // Token data
  token: text("token").notNull().unique(), // Short random token for URL
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  tokenIdx: uniqueIndex("ctc_token_idx").on(table.token),
  sessionIdx: index("ctc_session_idx").on(table.sessionId),
  expiresIdx: index("ctc_expires_idx").on(table.expiresAt),
}));

// Call Events - tracks click-to-call usage (MVP optional)
export const callEvents = pgTable("call_events", {
  id: serial("id").primaryKey(),
  callEventId: text("call_event_id").notNull().unique(), // UUID
  sessionId: text("session_id").notNull(), // References sms_sessions.sessionId
  
  // Event details
  ts: timestamp("ts").default(sql`CURRENT_TIMESTAMP`).notNull(),
  type: text("type").notNull(), // click, dial, connected, missed, completed
  metadataJson: jsonb("metadata_json"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  callEventIdIdx: uniqueIndex("call_event_id_idx").on(table.callEventId),
  sessionIdx: index("call_event_session_idx").on(table.sessionId),
  typeIdx: index("call_event_type_idx").on(table.type),
}));

// Insert schemas for SMS tables
export const insertSmsSessionSchema = createInsertSchema(smsSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSmsEventSchema = createInsertSchema(smsEvents).omit({
  id: true,
  createdAt: true,
});

export const insertHandoffTicketSchema = createInsertSchema(handoffTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClickToCallTokenSchema = createInsertSchema(clickToCallTokens).omit({
  id: true,
  createdAt: true,
});

export const insertCallEventSchema = createInsertSchema(callEvents).omit({
  id: true,
  createdAt: true,
});

// Types for SMS Intelligence Layer
export type SmsSession = typeof smsSessions.$inferSelect;
export type InsertSmsSession = z.infer<typeof insertSmsSessionSchema>;

export type SmsEvent = typeof smsEvents.$inferSelect;
export type InsertSmsEvent = z.infer<typeof insertSmsEventSchema>;

export type HandoffTicket = typeof handoffTickets.$inferSelect;
export type InsertHandoffTicket = z.infer<typeof insertHandoffTicketSchema>;

export type ClickToCallToken = typeof clickToCallTokens.$inferSelect;
export type InsertClickToCallToken = z.infer<typeof insertClickToCallTokenSchema>;

export type CallEvent = typeof callEvents.$inferSelect;
export type InsertCallEvent = z.infer<typeof insertCallEventSchema>;

// ============================================
// Pricing Control Center
// ============================================

// Global positioning options for pricing strategy
export const GlobalPositioning = ["aggressive", "balanced", "premium"] as const;
export type GlobalPositioningType = typeof GlobalPositioning[number];

// Property type bands for lot size classification
export const PropertyTypeBands = ["townhome", "small", "medium", "large", "multi_acre"] as const;
export type PropertyTypeBandType = typeof PropertyTypeBands[number];

// Pricing Policies - owner/operator pricing configuration
export const pricingPolicies = pgTable("pricing_policies", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  
  name: text("name").notNull().default("Default Policy"),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  
  // Global positioning strategy
  globalPositioning: text("global_positioning").notNull().default("balanced"), // aggressive, balanced, premium
  globalMultiplier: doublePrecision("global_multiplier").notNull().default(1.0), // 0.85 aggressive, 1.0 balanced, 1.15 premium
  
  // Per-service configuration: { [serviceType]: { minPrice, baseRate, multiplier, enabled } }
  serviceConfigs: jsonb("service_configs").notNull().default({}),
  
  // Property type band configurations: { [band]: { minSqft, maxSqft, baseMultiplier } }
  propertyTypeConfigs: jsonb("property_type_configs").notNull().default({}),
  
  // Guardrails: { floor, ceiling, lowConfidenceThreshold, reviewThreshold }
  guardrails: jsonb("guardrails").notNull().default({}),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdx: index("pricing_policy_business_idx").on(table.businessId),
  activeIdx: index("pricing_policy_active_idx").on(table.isActive),
}));

// Quote Proposals - computed quotes awaiting review/approval
export const quoteProposals = pgTable("quote_proposals", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  
  // Customer info (can be populated from lead or manually)
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),
  
  // Link to lead/session
  leadId: integer("lead_id").references(() => leads.id),
  smsSessionId: text("sms_session_id"), // References sms_sessions.sessionId
  
  // Property classification
  propertyTypeBand: text("property_type_band"), // townhome, small, medium, large, multi_acre
  
  // Services requested
  servicesRequested: jsonb("services_requested").notNull().default([]), // Array of { serviceType, frequency, notes }
  
  // Property signals from parcel resolver
  propertySignals: jsonb("property_signals").notNull().default({}), // { lotAreaSqft, confidence, propertyType, source }
  
  // Policy used for calculation
  policyId: integer("policy_id").references(() => pricingPolicies.id),
  policyVersion: integer("policy_version"),
  
  // Computed quote range (in cents)
  rangeLow: integer("range_low").notNull(),
  rangeHigh: integer("range_high").notNull(),
  
  // Calculation details
  assumptions: jsonb("assumptions").notNull().default([]), // Array of { key, value, reason }
  calculationBreakdown: jsonb("calculation_breakdown").default({}), // Detailed calculation steps
  
  // Review flags
  needsReview: boolean("needs_review").notNull().default(false),
  reviewReasons: jsonb("review_reasons").notNull().default([]), // Array of reason codes
  
  // Status workflow
  status: text("status").notNull().default("pending"), // pending, approved, adjusted, sent, expired, declined
  
  // Final approved values (after adjustment)
  approvedAmount: integer("approved_amount"), // Final approved quote in cents
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  // Sent tracking
  sentAt: timestamp("sent_at"),
  expiresAt: timestamp("expires_at"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdx: index("quote_proposal_business_idx").on(table.businessId),
  leadIdx: index("quote_proposal_lead_idx").on(table.leadId),
  sessionIdx: index("quote_proposal_session_idx").on(table.smsSessionId),
  statusIdx: index("quote_proposal_status_idx").on(table.status),
  needsReviewIdx: index("quote_proposal_needs_review_idx").on(table.needsReview),
}));

// Quote Adjustment Logs - audit trail for manual quote changes
export const quoteAdjustmentLogs = pgTable("quote_adjustment_logs", {
  id: serial("id").primaryKey(),
  quoteProposalId: integer("quote_proposal_id").references(() => quoteProposals.id).notNull(),
  
  // Change details
  changeType: text("change_type").notNull(), // approve, adjust_amount, add_note, decline, expire
  beforeState: jsonb("before_state").notNull(), // Snapshot before change
  afterState: jsonb("after_state").notNull(), // Snapshot after change
  reason: text("reason"), // User-provided reason for change
  
  // Who made the change
  changedByUserId: integer("changed_by_user_id").references(() => users.id),
  changedByRole: text("changed_by_role"), // owner, operator, system
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  quoteIdx: index("quote_adjustment_quote_idx").on(table.quoteProposalId),
  userIdx: index("quote_adjustment_user_idx").on(table.changedByUserId),
}));

// Insert schemas for Pricing Control Center
export const insertPricingPolicySchema = createInsertSchema(pricingPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuoteProposalSchema = createInsertSchema(quoteProposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuoteAdjustmentLogSchema = createInsertSchema(quoteAdjustmentLogs).omit({
  id: true,
  createdAt: true,
});

// Types for Pricing Control Center
export type PricingPolicy = typeof pricingPolicies.$inferSelect;
export type InsertPricingPolicy = z.infer<typeof insertPricingPolicySchema>;

export type QuoteProposal = typeof quoteProposals.$inferSelect;
export type InsertQuoteProposal = z.infer<typeof insertQuoteProposalSchema>;

export type QuoteAdjustmentLog = typeof quoteAdjustmentLogs.$inferSelect;
export type InsertQuoteAdjustmentLog = z.infer<typeof insertQuoteAdjustmentLogSchema>;

// Typed JSON structures for pricing configuration
export interface ServiceConfig {
  enabled: boolean;
  minPrice: number; // cents
  baseRate: number; // cents per sqft or flat rate
  rateType: "per_sqft" | "flat";
  multiplier: number;
}

export interface PropertyTypeBandConfig {
  minSqft: number;
  maxSqft: number;
  baseMultiplier: number;
}

export interface PricingGuardrails {
  floorPrice: number; // cents - absolute minimum quote
  ceilingPrice: number; // cents - absolute maximum quote
  lowConfidenceThreshold: number; // 0-1, below this triggers review
  reviewAboveAmount: number; // cents - quotes above this need review
}

// ============================================
// Unified Quote Builder (UQB)
// ============================================

// Business RBAC Policy - configurable permissions per business
export const businessRbacPolicies = pgTable("business_rbac_policies", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull().unique(),
  
  // Quote Builder permissions
  allowCrewLeadSend: boolean("allow_crew_lead_send").notNull().default(false),
  allowStaffSend: boolean("allow_staff_send").notNull().default(true),
  requireApprovalAboveAmount: integer("require_approval_above_amount"), // cents - quotes above this need owner approval
  
  // Auto-approval settings
  autoApproveWithinRange: boolean("auto_approve_within_range").notNull().default(false),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdx: index("rbac_policy_business_idx").on(table.businessId),
}));

// Quote Draft Status
export const QuoteDraftStatuses = ["draft", "ready", "sent", "blocked", "expired"] as const;
export type QuoteDraftStatus = typeof QuoteDraftStatuses[number];

// Quote Drafts - incomplete quotes being built via UQB
export const quoteDrafts = pgTable("quote_drafts", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id).notNull(),
  
  // Customer info (populated progressively)
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  serviceAddress: text("service_address"),
  
  // Voice transcript (if created via voice)
  transcriptText: text("transcript_text"),
  
  // Structured input extracted from voice or form
  structuredInput: jsonb("structured_input").notNull().default({}), // QuoteDraftInput type
  
  // Missing fields that need follow-up
  missingFields: text("missing_fields").array().notNull().default([]),
  currentQuestion: text("current_question"), // Current follow-up question
  
  // Property resolution
  lotAreaSqft: integer("lot_area_sqft"),
  lotConfidence: text("lot_confidence"), // high, medium, low
  propertyBand: text("property_band"), // townhome, small, medium, large, multi_acre
  
  // Quote calculation (once resolved)
  rangeLow: integer("range_low"),
  rangeHigh: integer("range_high"),
  assumptions: jsonb("assumptions").default([]),
  
  // Approval tracking
  needsReview: boolean("needs_review").notNull().default(false),
  reviewReasons: jsonb("review_reasons").default([]),
  recommendedNextStep: text("recommended_next_step"), // request_photos, site_visit, ready_to_send
  
  // Status workflow
  status: text("status").notNull().default("draft"), // draft, ready, sent, blocked, expired
  
  // Link to final quote proposal (once approved/sent)
  quoteProposalId: integer("quote_proposal_id").references(() => quoteProposals.id),
  
  // Timestamps
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdx: index("quote_draft_business_idx").on(table.businessId),
  userIdx: index("quote_draft_user_idx").on(table.createdByUserId),
  statusIdx: index("quote_draft_status_idx").on(table.status),
}));

// Insert schemas for UQB
export const insertBusinessRbacPolicySchema = createInsertSchema(businessRbacPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuoteDraftSchema = createInsertSchema(quoteDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for UQB
export type BusinessRbacPolicy = typeof businessRbacPolicies.$inferSelect;
export type InsertBusinessRbacPolicy = z.infer<typeof insertBusinessRbacPolicySchema>;

export type QuoteDraft = typeof quoteDrafts.$inferSelect;
export type InsertQuoteDraft = z.infer<typeof insertQuoteDraftSchema>;

// QuoteDraftInput - unified input model for voice and form
export interface QuoteDraftInput {
  customer_name?: string;
  customer_phone?: string;
  service_address?: string;
  services_requested?: string[];
  frequency?: "one_time" | "weekly" | "biweekly" | "monthly" | "unknown";
  complexity?: "light" | "medium" | "heavy" | "unknown";
  lot_area_sqft?: number;
  lot_confidence?: "high" | "medium" | "low";
  property_band?: "townhome" | "small" | "medium" | "large" | "multi_acre" | "unknown";
  photos_provided?: boolean;
}

// Voice parser response
export interface VoiceParseResult {
  extracted: Partial<QuoteDraftInput>;
  missing_fields: string[];
  questions: string[];
}

// ============================================
// Route Optimizer
// ============================================

// Crew status enum
export const CrewStatuses = ["ACTIVE", "INACTIVE"] as const;
export type CrewStatus = typeof CrewStatuses[number];

// Crew member role enum  
export const CrewMemberRoles = ["LEADER", "MEMBER"] as const;
export type CrewMemberRole = typeof CrewMemberRoles[number];

// Crew - team unit for job assignments
export const crews = pgTable("crews", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, INACTIVE
  
  // Home base location
  homeBaseLat: doublePrecision("home_base_lat"),
  homeBaseLng: doublePrecision("home_base_lng"),
  homeBaseAddress: text("home_base_address"), // Human-readable address
  
  // Capacity constraints
  serviceRadiusMiles: integer("service_radius_miles").notNull().default(20),
  dailyCapacityMinutes: integer("daily_capacity_minutes").notNull().default(420), // 7 hours
  maxJobsPerDay: integer("max_jobs_per_day").notNull().default(8), // Max jobs crew can handle
  
  // Skills and equipment (JSON arrays)
  skillsJson: jsonb("skills_json").notNull().default([]), // e.g. ["mowing", "hardscape", "irrigation"]
  equipmentJson: jsonb("equipment_json").notNull().default([]), // e.g. ["zero_turn", "dump_trailer", "skid_steer"]
  
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdx: index("crew_business_idx").on(table.businessId),
  statusIdx: index("crew_status_idx").on(table.status),
}));

// Crew Members - individuals within a crew
export const crewMembers = pgTable("crew_members", {
  id: serial("id").primaryKey(),
  crewId: integer("crew_id").references(() => crews.id).notNull(),
  userId: integer("user_id").references(() => users.id), // Optional link to system user
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("MEMBER"), // LEADER, MEMBER
  
  isActive: boolean("is_active").notNull().default(true),
  startAt: timestamp("start_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  endAt: timestamp("end_at"), // null means still active
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  crewIdx: index("crew_member_crew_idx").on(table.crewId),
  userIdx: index("crew_member_user_idx").on(table.userId),
  activeIdx: index("crew_member_active_idx").on(table.isActive),
}));

// Job Request Statuses
export const JobRequestStatuses = ["new", "triaged", "simulated", "recommended", "assigned", "needs_review"] as const;
export type JobRequestStatus = typeof JobRequestStatuses[number];

// Job Request Frequencies
export const JobRequestFrequencies = ["one_time", "weekly", "biweekly", "monthly", "unknown"] as const;
export type JobRequestFrequency = typeof JobRequestFrequencies[number];

// Job Requests - new leads/jobs needing assignment
export const jobRequests = pgTable("job_requests", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  
  // Customer info
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  address: text("address").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  zip: text("zip"),
  
  // Job details
  servicesJson: jsonb("services_json").notNull().default([]), // ["mowing", "mulch"]
  frequency: text("frequency").notNull().default("unknown"), // one_time, weekly, biweekly, monthly, unknown
  
  // Property/lot info
  lotAreaSqft: integer("lot_area_sqft"),
  lotConfidence: text("lot_confidence"), // high, medium, low
  
  // Requirements for matching
  requiredSkillsJson: jsonb("required_skills_json").notNull().default([]),
  requiredEquipmentJson: jsonb("required_equipment_json").notNull().default([]),
  crewSizeMin: integer("crew_size_min").notNull().default(1),
  
  // Labor estimates (minutes)
  laborLowMinutes: integer("labor_low_minutes"),
  laborHighMinutes: integer("labor_high_minutes"),
  
  // Status workflow
  status: text("status").notNull().default("new"), // new, triaged, simulated, recommended, assigned, needs_review
  
  // Link to conversation if from SMS flow
  conversationId: integer("conversation_id").references(() => conversations.id),
  
  // Link to assigned crew
  assignedCrewId: integer("assigned_crew_id").references(() => crews.id),
  assignedDate: timestamp("assigned_date"),
  
  // Lifecycle tracking for orchestrator
  lifecycleStage: text("lifecycle_stage").default("LEAD_INTAKE"), // LEAD_INTAKE, QUOTE_BUILD, etc.
  lifecycleStatus: text("lifecycle_status").default("open"), // open, won, lost, paused
  lastOrchestrationRunId: integer("last_orchestration_run_id"), // Last run that touched this
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdx: index("job_request_business_idx").on(table.businessId),
  statusIdx: index("job_request_status_idx").on(table.status),
  lifecycleIdx: index("job_request_lifecycle_idx").on(table.lifecycleStage, table.lifecycleStatus),
}));

// Schedule Item Statuses
export const ScheduleItemStatuses = ["scheduled", "complete", "canceled"] as const;
export type ScheduleItemStatus = typeof ScheduleItemStatuses[number];

// Schedule Items - cached schedule from Jobber or internal
export const scheduleItems = pgTable("schedule_items", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  
  // External provider sync
  externalProvider: text("external_provider"), // jobber, internal
  externalId: text("external_id"),
  
  // Assignment
  crewId: integer("crew_id").references(() => crews.id),
  userId: integer("user_id").references(() => users.id),
  
  // Time slot
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  
  // Location
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  address: text("address"),
  
  // Job details
  description: text("description"),
  jobRequestId: integer("job_request_id").references(() => jobRequests.id),
  
  status: text("status").notNull().default("scheduled"), // scheduled, complete, canceled
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdx: index("schedule_item_business_idx").on(table.businessId),
  crewIdx: index("schedule_item_crew_idx").on(table.crewId),
  dateIdx: index("schedule_item_date_idx").on(table.startAt),
}));

// Assignment Simulation - scored placement options
export const assignmentSimulations = pgTable("assignment_simulations", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  jobRequestId: integer("job_request_id").references(() => jobRequests.id).notNull(),
  crewId: integer("crew_id").references(() => crews.id).notNull(),
  
  // Proposed slot
  proposedDate: text("proposed_date").notNull(), // YYYY-MM-DD
  proposedStartAt: timestamp("proposed_start_at"),
  insertionType: text("insertion_type").notNull(), // before, between, after, anytime
  
  // Scoring metrics
  travelMinutesDelta: integer("travel_minutes_delta").notNull().default(0),
  loadMinutesDelta: integer("load_minutes_delta").notNull().default(0),
  marginScore: integer("margin_score").notNull().default(0), // 0-100
  riskScore: integer("risk_score").notNull().default(0), // 0-100 (lower is better)
  totalScore: integer("total_score").notNull().default(0), // Combined score for ranking
  
  // Explanation for transparency
  explanationJson: jsonb("explanation_json").notNull().default({}),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  jobRequestIdx: index("simulation_job_request_idx").on(table.jobRequestId),
  crewIdx: index("simulation_crew_idx").on(table.crewId),
}));

// Assignment Decision Statuses
export const AssignmentDecisionStatuses = ["draft", "approved", "written_back", "failed"] as const;
export type AssignmentDecisionStatus = typeof AssignmentDecisionStatuses[number];

// Assignment Decision - selected simulation and approval state
export const assignmentDecisions = pgTable("assignment_decisions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  jobRequestId: integer("job_request_id").references(() => jobRequests.id).notNull(),
  selectedSimulationId: integer("selected_simulation_id").references(() => assignmentSimulations.id).notNull(),
  
  // Mode
  mode: text("mode").notNull().default("recommend_only"), // recommend_only, auto_assign
  
  // Approval
  approvedByUserId: integer("approved_by_user_id").references(() => users.id),
  status: text("status").notNull().default("draft"), // draft, approved, written_back, failed
  
  // Reasoning/notes
  reasoningJson: jsonb("reasoning_json").notNull().default({}),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  jobRequestIdx: index("decision_job_request_idx").on(table.jobRequestId),
  statusIdx: index("decision_status_idx").on(table.status),
}));

// Distance Cache - precomputed travel times
export const distanceCache = pgTable("distance_cache", {
  id: serial("id").primaryKey(),
  originKey: text("origin_key").notNull(), // "lat,lng" rounded to ~100m
  destKey: text("dest_key").notNull(),
  
  travelMinutes: integer("travel_minutes").notNull(),
  distanceMeters: integer("distance_meters").notNull(),
  
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  routeIdx: uniqueIndex("distance_cache_route_idx").on(table.originKey, table.destKey),
}));

// Insert schemas for Route Optimizer
export const insertCrewSchema = createInsertSchema(crews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrewMemberSchema = createInsertSchema(crewMembers).omit({
  id: true,
  createdAt: true,
});

export const insertJobRequestSchema = createInsertSchema(jobRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduleItemSchema = createInsertSchema(scheduleItems).omit({
  id: true,
  createdAt: true,
});

export const insertAssignmentSimulationSchema = createInsertSchema(assignmentSimulations).omit({
  id: true,
  createdAt: true,
});

export const insertAssignmentDecisionSchema = createInsertSchema(assignmentDecisions).omit({
  id: true,
  createdAt: true,
});

export const insertDistanceCacheSchema = createInsertSchema(distanceCache).omit({
  id: true,
  createdAt: true,
});

// ============================================
// Skills & Equipment Tables
// ============================================

// Skill Categories
export const SkillCategories = ["lawn_maintenance", "hardscape", "irrigation", "tree_care", "landscaping", "snow_removal", "general"] as const;
export type SkillCategory = typeof SkillCategories[number];

// Master Skills table
export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"), // lawn_maintenance, hardscape, irrigation, etc.
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdx: index("skill_business_idx").on(table.businessId),
  nameIdx: index("skill_name_idx").on(table.businessId, table.name),
}));

// Equipment Types
export const EquipmentTypes = ["mower", "trailer", "truck", "skid_steer", "excavator", "aerator", "dethatcher", "spreader", "blower", "trimmer", "chainsaw", "other"] as const;
export type EquipmentType = typeof EquipmentTypes[number];

// Equipment Statuses
export const EquipmentStatuses = ["available", "in_use", "maintenance", "retired"] as const;
export type EquipmentStatus = typeof EquipmentStatuses[number];

// Master Equipment table
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("other"), // mower, trailer, truck, etc.
  description: text("description"),
  status: text("status").notNull().default("available"), // available, in_use, maintenance, retired
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdx: index("equipment_business_idx").on(table.businessId),
  typeIdx: index("equipment_type_idx").on(table.type),
}));

// Junction table: Crew Skills
export const crewSkills = pgTable("crew_skills", {
  id: serial("id").primaryKey(),
  crewId: integer("crew_id").references(() => crews.id).notNull(),
  skillId: integer("skill_id").references(() => skills.id).notNull(),
  proficiencyLevel: integer("proficiency_level").default(1), // 1-5 scale
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  crewIdx: index("crew_skill_crew_idx").on(table.crewId),
  skillIdx: index("crew_skill_skill_idx").on(table.skillId),
  uniqueIdx: uniqueIndex("crew_skill_unique_idx").on(table.crewId, table.skillId),
}));

// Junction table: Crew Equipment
export const crewEquipment = pgTable("crew_equipment", {
  id: serial("id").primaryKey(),
  crewId: integer("crew_id").references(() => crews.id).notNull(),
  equipmentId: integer("equipment_id").references(() => equipment.id).notNull(),
  assignedAt: timestamp("assigned_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => ({
  crewIdx: index("crew_equipment_crew_idx").on(table.crewId),
  equipmentIdx: index("crew_equipment_equipment_idx").on(table.equipmentId),
  uniqueIdx: uniqueIndex("crew_equipment_unique_idx").on(table.crewId, table.equipmentId),
}));

// Crew Availability - weekly schedule patterns
export const crewAvailability = pgTable("crew_availability", {
  id: serial("id").primaryKey(),
  crewId: integer("crew_id").references(() => crews.id).notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: text("start_time").notNull(), // "08:00" format
  endTime: text("end_time").notNull(), // "17:00" format
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  crewIdx: index("crew_availability_crew_idx").on(table.crewId),
  dayIdx: index("crew_availability_day_idx").on(table.crewId, table.dayOfWeek),
}));

// Time-Off Requests for crews
export const timeOffRequests = pgTable("time_off_requests", {
  id: serial("id").primaryKey(),
  crewId: integer("crew_id").references(() => crews.id).notNull(),
  requestedBy: integer("requested_by").references(() => users.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // pending, approved, denied
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  crewIdx: index("time_off_crew_idx").on(table.crewId),
  statusIdx: index("time_off_status_idx").on(table.status),
  dateIdx: index("time_off_date_idx").on(table.startDate, table.endDate),
}));

// Service Zones - Geographic areas where crews operate
export const serviceZones = pgTable("service_zones", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Zone boundary - stored as GeoJSON polygon or bounding box
  // For MVP, using simple bounding box (min/max lat/lng)
  minLat: doublePrecision("min_lat"),
  maxLat: doublePrecision("max_lat"),
  minLng: doublePrecision("min_lng"),
  maxLng: doublePrecision("max_lng"),
  
  // Alternative: center point + radius for circular zones
  centerLat: doublePrecision("center_lat"),
  centerLng: doublePrecision("center_lng"),
  radiusMiles: doublePrecision("radius_miles"),
  
  // Zone metadata
  color: text("color").default("#22c55e"), // Display color on map
  priority: integer("priority").default(0), // Higher priority zones get preference
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessIdx: index("service_zone_business_idx").on(table.businessId),
  activeIdx: index("service_zone_active_idx").on(table.isActive),
}));

// Crew Zone Assignments - Links crews to their service zones
export const crewZoneAssignments = pgTable("crew_zone_assignments", {
  id: serial("id").primaryKey(),
  crewId: integer("crew_id").references(() => crews.id).notNull(),
  zoneId: integer("zone_id").references(() => serviceZones.id).notNull(),
  
  // Assignment priority within this zone (for routing decisions)
  priority: integer("priority").default(0),
  
  // Whether this is a primary or backup zone for the crew
  isPrimary: boolean("is_primary").notNull().default(true),
  
  assignedAt: timestamp("assigned_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  assignedBy: integer("assigned_by").references(() => users.id),
}, (table) => ({
  crewIdx: index("crew_zone_crew_idx").on(table.crewId),
  zoneIdx: index("crew_zone_zone_idx").on(table.zoneId),
  uniqueAssignment: uniqueIndex("crew_zone_unique_idx").on(table.crewId, table.zoneId),
}));

// Crew Analytics Snapshots - Daily performance metrics for each crew
export const crewAnalyticsSnapshots = pgTable("crew_analytics_snapshots", {
  id: serial("id").primaryKey(),
  crewId: integer("crew_id").references(() => crews.id).notNull(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  snapshotDate: timestamp("snapshot_date").notNull(),
  
  // Job metrics
  jobsCompleted: integer("jobs_completed").default(0).notNull(),
  jobsAssigned: integer("jobs_assigned").default(0).notNull(),
  jobsCancelled: integer("jobs_cancelled").default(0),
  
  // Time metrics (in minutes)
  totalServiceMinutes: integer("total_service_minutes").default(0),
  totalDriveMinutes: integer("total_drive_minutes").default(0),
  totalAvailableMinutes: integer("total_available_minutes").default(0),
  utilizationPercent: integer("utilization_percent").default(0),
  
  // Revenue metrics (in cents)
  revenueGenerated: integer("revenue_generated").default(0),
  averageJobRevenue: integer("average_job_revenue").default(0),
  
  // Zone performance
  inZoneJobCount: integer("in_zone_job_count").default(0),
  outOfZoneJobCount: integer("out_of_zone_job_count").default(0),
  zoneCompliancePercent: integer("zone_compliance_percent").default(0),
  
  // Efficiency metrics
  averageDriveMinutesPerJob: integer("avg_drive_minutes_per_job").default(0),
  onTimeArrivalPercent: integer("on_time_arrival_percent").default(0),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  crewIdx: index("crew_analytics_crew_idx").on(table.crewId),
  dateIdx: index("crew_analytics_date_idx").on(table.snapshotDate),
  uniqueSnapshot: uniqueIndex("crew_analytics_unique_idx").on(table.crewId, table.snapshotDate),
}));

// Insert schemas for Skills & Equipment
export const insertSkillSchema = createInsertSchema(skills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrewSkillSchema = createInsertSchema(crewSkills).omit({
  id: true,
  createdAt: true,
});

export const insertCrewEquipmentSchema = createInsertSchema(crewEquipment).omit({
  id: true,
  assignedAt: true,
});

export const insertCrewAvailabilitySchema = createInsertSchema(crewAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimeOffRequestSchema = createInsertSchema(timeOffRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
});

// Insert schemas for Service Zones
export const insertServiceZoneSchema = createInsertSchema(serviceZones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrewZoneAssignmentSchema = createInsertSchema(crewZoneAssignments).omit({
  id: true,
  assignedAt: true,
});

export const insertCrewAnalyticsSnapshotSchema = createInsertSchema(crewAnalyticsSnapshots).omit({
  id: true,
  createdAt: true,
});

// Types for Skills & Equipment
export type Skill = typeof skills.$inferSelect;
export type InsertSkill = z.infer<typeof insertSkillSchema>;

export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;

export type CrewSkill = typeof crewSkills.$inferSelect;
export type InsertCrewSkill = z.infer<typeof insertCrewSkillSchema>;

export type CrewEquipment = typeof crewEquipment.$inferSelect;
export type InsertCrewEquipment = z.infer<typeof insertCrewEquipmentSchema>;

export type CrewAvailability = typeof crewAvailability.$inferSelect;
export type InsertCrewAvailability = z.infer<typeof insertCrewAvailabilitySchema>;

export type TimeOffRequest = typeof timeOffRequests.$inferSelect;
export type InsertTimeOffRequest = z.infer<typeof insertTimeOffRequestSchema>;

// Types for Service Zones
export type ServiceZone = typeof serviceZones.$inferSelect;
export type InsertServiceZone = z.infer<typeof insertServiceZoneSchema>;

export type CrewZoneAssignment = typeof crewZoneAssignments.$inferSelect;
export type InsertCrewZoneAssignment = z.infer<typeof insertCrewZoneAssignmentSchema>;

export type CrewAnalyticsSnapshot = typeof crewAnalyticsSnapshots.$inferSelect;
export type InsertCrewAnalyticsSnapshot = z.infer<typeof insertCrewAnalyticsSnapshotSchema>;

// Extended types with relations
export type SkillWithCrews = Skill & { crewCount: number };
export type EquipmentWithCrews = Equipment & { crewCount: number; crews?: Crew[] };

// ============================================
// Types for Route Optimizer
// ============================================
export type Crew = typeof crews.$inferSelect;
export type InsertCrew = z.infer<typeof insertCrewSchema>;

export type CrewMember = typeof crewMembers.$inferSelect;
export type InsertCrewMember = z.infer<typeof insertCrewMemberSchema>;

// Extended type with member details for crew management UI
export type CrewWithMembers = Crew & {
  members: (CrewMember & { user?: User | null })[];
  leader?: (CrewMember & { user?: User | null }) | null;
  memberCount: number;
  skills?: Skill[];
  equipment?: Equipment[];
};

export type JobRequest = typeof jobRequests.$inferSelect;
export type InsertJobRequest = z.infer<typeof insertJobRequestSchema>;

export type ScheduleItem = typeof scheduleItems.$inferSelect;
export type InsertScheduleItem = z.infer<typeof insertScheduleItemSchema>;

export type AssignmentSimulation = typeof assignmentSimulations.$inferSelect;
export type InsertAssignmentSimulation = z.infer<typeof insertAssignmentSimulationSchema>;

export type AssignmentDecision = typeof assignmentDecisions.$inferSelect;
export type InsertAssignmentDecision = z.infer<typeof insertAssignmentDecisionSchema>;

export type DistanceCache = typeof distanceCache.$inferSelect;
export type InsertDistanceCache = z.infer<typeof insertDistanceCacheSchema>;

// Zod validation schemas for API input
export const crewInputSchema = z.object({
  businessId: z.number(),
  name: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  homeBaseLat: z.number().optional(),
  homeBaseLng: z.number().optional(),
  homeBaseAddress: z.string().optional(),
  serviceRadiusMiles: z.number().default(20),
  dailyCapacityMinutes: z.number().default(420),
  maxJobsPerDay: z.number().default(8),
  skillsJson: z.array(z.string()).default([]),
  equipmentJson: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const crewMemberInputSchema = z.object({
  crewId: z.number(),
  userId: z.number().optional(),
  displayName: z.string().min(1),
  role: z.enum(["LEADER", "MEMBER"]).default("MEMBER"),
  isActive: z.boolean().default(true),
});

export const jobRequestInputSchema = z.object({
  businessId: z.number(),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  address: z.string().min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
  zip: z.string().optional(),
  servicesJson: z.array(z.string()).default([]),
  frequency: z.enum(["one_time", "weekly", "biweekly", "monthly", "unknown"]).default("unknown"),
  lotAreaSqft: z.number().optional(),
  lotConfidence: z.enum(["high", "medium", "low"]).optional(),
  requiredSkillsJson: z.array(z.string()).default([]),
  requiredEquipmentJson: z.array(z.string()).default([]),
  crewSizeMin: z.number().default(1),
  laborLowMinutes: z.number().optional(),
  laborHighMinutes: z.number().optional(),
});

export const simulateInputSchema = z.object({
  jobRequestId: z.number(),
});

export const decideInputSchema = z.object({
  jobRequestId: z.number(),
  simulationId: z.number(),
});

export const approveInputSchema = z.object({
  decisionId: z.number(),
});

// ============================================
// Lead-to-Cash Orchestrator
// ============================================

// Orchestration Stages - fixed lifecycle ordering
// Post-quote stages integrate with crew intelligence, simulation, feasibility, margin, and dispatch systems
export const OrchestrationStages = [
  "LEAD_INTAKE",
  "QUOTE_BUILD", 
  "QUOTE_CONFIRM",
  "SCHEDULE_PROPOSE",
  "SIMULATION_RUN",      // Run crew simulations to find best assignment
  "FEASIBILITY_CHECK",   // Verify job is feasible for selected crew
  "MARGIN_VALIDATE",     // Ensure margin meets acceptance criteria
  "CREW_LOCK",           // Lock crew assignment, create decision record
  "DISPATCH_READY",      // Calculate route, assign schedule slot, queue dispatch
  "JOB_BOOKED"
] as const;
export type OrchestrationStage = typeof OrchestrationStages[number];

// Orchestration Run Statuses
export const OrchestrationRunStatuses = [
  "running",
  "waiting_customer",
  "waiting_ops",
  "completed",
  "failed",
  "canceled"
] as const;
export type OrchestrationRunStatus = typeof OrchestrationRunStatuses[number];

// Confidence levels
export const ConfidenceLevels = ["high", "medium", "low"] as const;
export type ConfidenceLevel = typeof ConfidenceLevels[number];

// Lifecycle statuses for job requests
export const LifecycleStatuses = ["open", "won", "lost", "paused"] as const;
export type LifecycleStatus = typeof LifecycleStatuses[number];

// Orchestration Runs - tracks each Lead-to-Cash execution
export const orchestrationRuns = pgTable("orchestration_runs", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull().unique(), // UUID for external reference
  accountId: text("account_id").notNull(), // Business/account identifier
  businessId: integer("business_id").references(() => businessProfiles.id),
  
  // Channel info
  channel: text("channel").notNull().default("sms"), // sms, web, ops
  
  // Current state
  currentStage: text("current_stage").notNull().default("LEAD_INTAKE"),
  status: text("status").notNull().default("running"), // running, waiting_customer, waiting_ops, completed, failed, canceled
  confidence: text("confidence").notNull().default("medium"), // high, medium, low
  
  // Primary entity reference
  primaryEntityType: text("primary_entity_type").notNull().default("job_request"),
  primaryEntityId: integer("primary_entity_id").notNull(), // References jobRequests.id
  
  // Rolling context (validated, minimal JSON)
  contextJson: jsonb("context_json").notNull().default({}),
  
  // Ownership
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  
  // HITL tracking
  lastApprovedByUserId: integer("last_approved_by_user_id").references(() => users.id),
  lastApprovedAt: timestamp("last_approved_at"),
  waitingReason: text("waiting_reason"), // Why we're paused
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  runIdIdx: uniqueIndex("orch_run_id_idx").on(table.runId),
  entityIdx: index("orch_run_entity_idx").on(table.primaryEntityType, table.primaryEntityId),
  statusIdx: index("orch_run_status_idx").on(table.status),
  businessIdx: index("orch_run_business_idx").on(table.businessId),
}));

// Orchestration Steps - individual step execution log
export const orchestrationSteps = pgTable("orchestration_steps", {
  id: serial("id").primaryKey(),
  orchestrationRunId: integer("orchestration_run_id").references(() => orchestrationRuns.id).notNull(),
  
  // Step identification
  stage: text("stage").notNull(), // LEAD_INTAKE, QUOTE_BUILD, etc.
  stepIndex: integer("step_index").notNull(), // Order within the run
  
  // Input/Output tracking
  inputJson: jsonb("input_json").notNull().default({}),
  actionsJson: jsonb("actions_json").notNull().default([]), // List of agent calls
  outputJson: jsonb("output_json").notNull().default({}), // Consolidated outputs
  decisionJson: jsonb("decision_json").notNull().default({}), // advance, next_stage, confidence, notes
  
  // Timing
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
  
  // Error tracking
  error: text("error"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  runIdx: index("orch_step_run_idx").on(table.orchestrationRunId),
  stageIdx: index("orch_step_stage_idx").on(table.stage),
}));

// Customer Messages - inbound/outbound message tracking for orchestration
export const customerMessages = pgTable("customer_messages", {
  id: serial("id").primaryKey(),
  messageId: text("message_id").notNull().unique(), // UUID for deduplication
  accountId: text("account_id").notNull(),
  businessId: integer("business_id").references(() => businessProfiles.id),
  
  // Links to orchestration
  orchestrationRunId: integer("orchestration_run_id").references(() => orchestrationRuns.id),
  jobRequestId: integer("job_request_id").references(() => jobRequests.id),
  
  // Message details
  direction: text("direction").notNull(), // inbound, outbound
  channel: text("channel").notNull().default("sms"),
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  body: text("body").notNull(),
  
  // Intent parsing (for inbound)
  parsedIntent: text("parsed_intent"), // accepted, declined, question, modify, schedule_select, etc.
  intentConfidence: text("intent_confidence"), // high, medium, low
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  messageIdIdx: uniqueIndex("cust_msg_id_idx").on(table.messageId),
  runIdx: index("cust_msg_run_idx").on(table.orchestrationRunId),
  jobReqIdx: index("cust_msg_job_req_idx").on(table.jobRequestId),
  phoneIdx: index("cust_msg_phone_idx").on(table.fromNumber),
}));

// Insert schemas for Lead-to-Cash Orchestrator
export const insertOrchestrationRunSchema = createInsertSchema(orchestrationRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrchestrationStepSchema = createInsertSchema(orchestrationSteps).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerMessageSchema = createInsertSchema(customerMessages).omit({
  id: true,
  createdAt: true,
});

// Types for Lead-to-Cash Orchestrator
export type OrchestrationRun = typeof orchestrationRuns.$inferSelect;
export type InsertOrchestrationRun = z.infer<typeof insertOrchestrationRunSchema>;

export type OrchestrationStep = typeof orchestrationSteps.$inferSelect;
export type InsertOrchestrationStep = z.infer<typeof insertOrchestrationStepSchema>;

export type CustomerMessage = typeof customerMessages.$inferSelect;
export type InsertCustomerMessage = z.infer<typeof insertCustomerMessageSchema>;

// API input schemas for orchestrator
export const startOrchestrationInputSchema = z.object({
  jobRequestId: z.number(),
  userId: z.number().optional(),
  channel: z.enum(["sms", "web", "ops"]).default("ops"),
});

export const runNextStepInputSchema = z.object({
  runId: z.string(),
});

export const opsApprovalInputSchema = z.object({
  runId: z.string(),
  stage: z.enum(["LEAD_INTAKE", "QUOTE_BUILD", "QUOTE_CONFIRM", "SCHEDULE_PROPOSE", "CREW_ASSIGN", "JOB_BOOKED"]),
  approvalData: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

export const opsOverrideInputSchema = z.object({
  runId: z.string(),
  action: z.enum(["advance", "revert", "cancel", "inject_context"]),
  targetStage: z.enum(["LEAD_INTAKE", "QUOTE_BUILD", "QUOTE_CONFIRM", "SCHEDULE_PROPOSE", "CREW_ASSIGN", "JOB_BOOKED"]).optional(),
  contextUpdate: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

// ============================================================================
// CUSTOMER EXPERIENCE VECTOR MEMORY
// ============================================================================
// Customer profiles with tenant isolation via businessId
// Memories support vector embeddings (pgvector) for semantic search

// Memory type enum for customer memories
export const memoryTypeEnum = z.enum(["interaction", "preference", "outcome", "summary"]);
export type MemoryType = z.infer<typeof memoryTypeEnum>;

// Channel enum for memory sources
export const memoryChannelEnum = z.enum(["sms", "call", "email", "in_app", "ops_note", "system"]);
export type MemoryChannel = z.infer<typeof memoryChannelEnum>;

// Customer Profiles - consolidated customer data per tenant
export const customerProfiles = pgTable("customer_profiles", {
  id: serial("id").primaryKey(),
  
  // Tenant isolation (required for all queries)
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  accountId: text("account_id"), // Optional account-level grouping
  
  // Customer identity
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  primaryAddress: text("primary_address"),
  
  // Linked entities (for cross-referencing)
  conversationId: integer("conversation_id").references(() => conversations.id),
  jobRequestId: integer("job_request_id").references(() => jobRequests.id),
  
  // Aggregated stats
  totalJobs: integer("total_jobs").default(0).notNull(),
  totalRevenue: integer("total_revenue").default(0).notNull(), // in cents
  avgNpsScore: doublePrecision("avg_nps_score"),
  lastInteractionAt: timestamp("last_interaction_at"),
  
  // Tags for quick filtering
  tagsJson: jsonb("tags_json").default({}).notNull(),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessPhoneIdx: uniqueIndex("customer_profile_business_phone_idx").on(table.businessId, table.phone),
  businessIdx: index("customer_profile_business_idx").on(table.businessId),
  accountIdx: index("customer_profile_account_idx").on(table.accountId),
}));

// Customer Memories - semantic memory entries with optional vector embeddings
// Note: embedding column uses pgvector type (1536 dimensions for OpenAI text-embedding-3-small)
// Run SQL: CREATE EXTENSION IF NOT EXISTS vector; before using embeddings
export const customerMemories = pgTable("customer_memories", {
  id: serial("id").primaryKey(),
  
  // Tenant isolation (required for all queries)
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  accountId: text("account_id"),
  customerId: integer("customer_id").references(() => customerProfiles.id).notNull(),
  
  // Memory classification
  memoryType: text("memory_type").notNull(), // interaction, preference, outcome, summary
  serviceType: text("service_type"), // mowing, cleanup, mulch, etc.
  channel: text("channel"), // sms, call, email, in_app, ops_note, system
  
  // Importance and sentiment
  importance: integer("importance").default(3).notNull(), // 1-5 scale
  sentiment: doublePrecision("sentiment"), // -1.0 to +1.0
  npsScore: integer("nps_score"), // 0-10
  
  // Timing
  occurredAt: timestamp("occurred_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  
  // Core content
  text: text("text").notNull(), // Canonical text to embed
  
  // Vector embedding (stored as text array, converted at query time)
  // We store as JSONB for compatibility; vector search uses raw SQL
  embeddingJson: jsonb("embedding_json"), // number[] with 1536 dimensions
  embeddingModel: text("embedding_model"), // e.g., "text-embedding-3-small"
  
  // Metadata and provenance
  tagsJson: jsonb("tags_json").default({}).notNull(),
  sourceEntityType: text("source_entity_type"), // "CustomerMessage", "JobRequest", etc.
  sourceEntityId: text("source_entity_id"),
  
  // Content hash for idempotency
  contentHash: text("content_hash"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  customerOccurredIdx: index("customer_memory_customer_occurred_idx").on(table.customerId, table.occurredAt),
  businessTypeIdx: index("customer_memory_business_type_idx").on(table.businessId, table.memoryType),
  contentHashIdx: uniqueIndex("customer_memory_content_hash_idx").on(table.contentHash),
}));

// Relations for customer profiles
export const customerProfilesRelations = relations(customerProfiles, ({ one, many }) => ({
  business: one(businessProfiles, {
    fields: [customerProfiles.businessId],
    references: [businessProfiles.id],
  }),
  conversation: one(conversations, {
    fields: [customerProfiles.conversationId],
    references: [conversations.id],
  }),
  jobRequest: one(jobRequests, {
    fields: [customerProfiles.jobRequestId],
    references: [jobRequests.id],
  }),
  memories: many(customerMemories),
}));

export const customerMemoriesRelations = relations(customerMemories, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [customerMemories.businessId],
    references: [businessProfiles.id],
  }),
  customer: one(customerProfiles, {
    fields: [customerMemories.customerId],
    references: [customerProfiles.id],
  }),
}));

// Insert schemas for Customer Memory
export const insertCustomerProfileSchema = createInsertSchema(customerProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerMemorySchema = createInsertSchema(customerMemories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for Customer Memory
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type InsertCustomerProfile = z.infer<typeof insertCustomerProfileSchema>;

export type CustomerMemory = typeof customerMemories.$inferSelect;
export type InsertCustomerMemory = z.infer<typeof insertCustomerMemorySchema>;

// API input schemas for memory operations
export const memoryUpsertInputSchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email().optional(),
    address: z.string().optional(),
  }),
  memory: z.object({
    memoryType: memoryTypeEnum,
    serviceType: z.string().optional(),
    channel: memoryChannelEnum.optional(),
    importance: z.number().min(1).max(5).optional(),
    sentiment: z.number().min(-1).max(1).optional(),
    npsScore: z.number().min(0).max(10).optional(),
    occurredAt: z.string().datetime().optional(),
    text: z.string().min(1),
    tagsJson: z.record(z.unknown()).optional(),
    sourceEntityType: z.string().optional(),
    sourceEntityId: z.string().optional(),
  }),
});

export const memorySearchInputSchema = z.object({
  customerId: z.number().optional(),
  queryText: z.string().min(1),
  limit: z.number().min(1).max(50).default(8),
  memoryTypes: z.array(memoryTypeEnum).optional(),
  serviceType: z.string().optional(),
});

export const customerInsightsSchema = z.object({
  summary: z.string().optional(),
  tags: z.array(z.string()).default([]),
  topMemoryIds: z.array(z.number()).default([]),
  preferences: z.array(z.string()).default([]),
  recentIssues: z.array(z.string()).default([]),
  avgSentiment: z.number().optional(),
  confidence: z.enum(["high", "medium", "low"]).default("low"),
});

export type CustomerInsights = z.infer<typeof customerInsightsSchema>;

// ============================================
// Agents & Agent Runs - Additional Types
// ============================================

// Agent lifecycle stages - user-facing stages shown as tiles, core is hidden but searchable
export const AgentStages = [
  "lead_intake",
  "quoting", 
  "confirmation",
  "scheduling",
  "crew_assignment",
  "booking",
  "retention_insights",
  "integrations",
  "core" // Hidden from tiles, but searchable/auditable
] as const;
export type AgentStage = typeof AgentStages[number];

// Agent domains for tagging
export const AgentDomains = [
  "messaging",
  "pricing", 
  "routing",
  "memory",
  "integrations",
  "orchestration",
  "fsm"
] as const;
export type AgentDomain = typeof AgentDomains[number];

// ============================================
// LEARNING SYSTEM - Feedback Loop Architecture
// ============================================

// Enums for Learning System
export const DecisionTypes = [
  "quote_range",
  "next_question", 
  "schedule_windows",
  "crew_assignment",
  "channel_choice",
  "feasibility_gate",
  "escalate_human"
] as const;
export type DecisionType = typeof DecisionTypes[number];
export const decisionTypeEnum = z.enum(DecisionTypes);

export const HumanActionTypes = [
  "approve",
  "reject",
  "edit",
  "request_info",
  "change_channel",
  "escalate",
  "assign_different_crew",
  "send_quote",
  "pause",
  "resume"
] as const;
export type HumanActionType = typeof HumanActionTypes[number];
export const humanActionTypeEnum = z.enum(HumanActionTypes);

export const OutcomeTypes = [
  "quote_accepted",
  "quote_declined",
  "quote_no_response",
  "job_booked",
  "job_completed",
  "job_canceled",
  "complaint",
  "refund",
  "churn",
  "retention_event"
] as const;
export type OutcomeType = typeof OutcomeTypes[number];
export const outcomeTypeEnum = z.enum(OutcomeTypes);

// ConfidenceLevels and ConfidenceLevel already defined above (line ~2250)
export const confidenceLevelEnum = z.enum(ConfidenceLevels);

export const SuggestionStatuses = ["proposed", "approved", "rejected", "applied"] as const;
export type SuggestionStatus = typeof SuggestionStatuses[number];
export const suggestionStatusEnum = z.enum(SuggestionStatuses);

export const PolicyChangeTypes = [
  "threshold_update",
  "pricing_parameter_update",
  "routing_rule_update",
  "channel_rule_update"
] as const;
export type PolicyChangeType = typeof PolicyChangeTypes[number];
export const policyChangeTypeEnum = z.enum(PolicyChangeTypes);

export const KillSwitchScopes = ["global", "service_type", "stage", "channel"] as const;
export type KillSwitchScope = typeof KillSwitchScopes[number];
export const killSwitchScopeEnum = z.enum(KillSwitchScopes);

export const PolicyVersionStatuses = ["draft", "active", "archived"] as const;
export type PolicyVersionStatus = typeof PolicyVersionStatuses[number];
export const policyVersionStatusEnum = z.enum(PolicyVersionStatuses);

// DecisionLog - captures every AI decision
export const decisionLogs = pgTable("decision_logs", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  runId: integer("run_id").references(() => orchestrationRuns.id),
  leadId: integer("lead_id").references(() => leads.id),
  jobRequestId: integer("job_request_id").references(() => jobRequests.id),
  customerId: integer("customer_id").references(() => customerProfiles.id),
  
  decisionType: text("decision_type").notNull(), // DecisionType enum
  stage: text("stage"), // OrchestrationStage if in orchestrator
  agentName: text("agent_name").notNull(), // e.g., QuoteBuildAgent
  agentVersion: text("agent_version").notNull(), // prompt hash or git sha
  policyVersion: text("policy_version"), // pricing policy revision id/hash
  
  inputsSnapshotJson: jsonb("inputs_snapshot_json").notNull(), // minimal but sufficient context
  recommendedActionJson: jsonb("recommended_action_json").notNull(), // structured recommendation
  confidence: text("confidence").notNull().default("medium"), // ConfidenceLevel
  reasonsJson: jsonb("reasons_json").default([]).notNull(), // structured reasons list
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessCreatedIdx: index("decision_log_business_created_idx").on(table.businessId, table.createdAt),
  businessTypeCreatedIdx: index("decision_log_business_type_created_idx").on(table.businessId, table.decisionType, table.createdAt),
}));

// HumanActionLog - captures every human action on AI decisions
export const humanActionLogs = pgTable("human_action_logs", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  decisionId: integer("decision_id").references(() => decisionLogs.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").notNull(), // OWNER/ADMIN/CREW_LEAD/STAFF
  
  actionType: text("action_type").notNull(), // HumanActionType enum
  finalActionJson: jsonb("final_action_json").notNull(), // final approved/edited result
  editDeltaJson: jsonb("edit_delta_json").default({}).notNull(), // computed diff
  reasonCodesJson: jsonb("reason_codes_json").default([]).notNull(), // selected reason codes
  note: text("note"),
  timeToActionSeconds: integer("time_to_action_seconds"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessCreatedIdx: index("human_action_business_created_idx").on(table.businessId, table.createdAt),
  decisionIdx: index("human_action_decision_idx").on(table.decisionId),
}));

// OutcomeLog - captures downstream outcomes
export const outcomeLogs = pgTable("outcome_logs", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  decisionId: integer("decision_id").references(() => decisionLogs.id),
  leadId: integer("lead_id").references(() => leads.id),
  jobRequestId: integer("job_request_id").references(() => jobRequests.id),
  customerId: integer("customer_id").references(() => customerProfiles.id),
  
  outcomeType: text("outcome_type").notNull(), // OutcomeType enum
  outcomeValueJson: jsonb("outcome_value_json").default({}).notNull(), // e.g., {accepted:true, nps:9}
  occurredAt: timestamp("occurred_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessOccurredIdx: index("outcome_log_business_occurred_idx").on(table.businessId, table.occurredAt),
  decisionIdx: index("outcome_log_decision_idx").on(table.decisionId),
}));

// ReasonCode - seeded reason codes for structured feedback
export const reasonCodes = pgTable("reason_codes", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  code: text("code").notNull(), // e.g., LOT_SIZE_UNCERTAIN
  label: text("label").notNull(), // human-readable label
  appliesTo: jsonb("applies_to").notNull(), // decisionTypes/actions it applies to
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  businessCodeUnique: uniqueIndex("reason_code_business_code_idx").on(table.businessId, table.code),
}));

// PolicyVersion - versioned policy storage
export const policyVersions = pgTable("policy_versions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  version: text("version").notNull(), // e.g., "pricing-v3-2026-01-03"
  policyJson: jsonb("policy_json").notNull(), // full policy template set
  status: text("status").notNull().default("draft"), // draft|active|archived
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// PolicyTuningSuggestion - AI-generated policy improvement suggestions
export const policyTuningSuggestions = pgTable("policy_tuning_suggestions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  createdBy: text("created_by").notNull().default("system"),
  
  policyChangeType: text("policy_change_type").notNull(), // PolicyChangeType enum
  target: text("target").notNull(), // e.g., "quote.auto_send_threshold"
  proposedValueJson: jsonb("proposed_value_json").notNull(),
  currentValueJson: jsonb("current_value_json").notNull(),
  evidenceJson: jsonb("evidence_json").notNull(), // metrics, counts, examples
  
  status: text("status").notNull().default("proposed"), // SuggestionStatus enum
  reviewedByUserId: integer("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  appliedAt: timestamp("applied_at"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// KillSwitch - emergency automation control
export const killSwitches = pgTable("kill_switches", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  scope: text("scope").notNull(), // KillSwitchScope enum
  scopeValue: text("scope_value").notNull(), // e.g., "cleanup" or "QUOTE_BUILD"
  isEnabled: boolean("is_enabled").default(false).notNull(),
  reason: text("reason"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Relations for Learning System
export const decisionLogsRelations = relations(decisionLogs, ({ one, many }) => ({
  business: one(businessProfiles, {
    fields: [decisionLogs.businessId],
    references: [businessProfiles.id],
  }),
  run: one(orchestrationRuns, {
    fields: [decisionLogs.runId],
    references: [orchestrationRuns.id],
  }),
  lead: one(leads, {
    fields: [decisionLogs.leadId],
    references: [leads.id],
  }),
  jobRequest: one(jobRequests, {
    fields: [decisionLogs.jobRequestId],
    references: [jobRequests.id],
  }),
  customer: one(customerProfiles, {
    fields: [decisionLogs.customerId],
    references: [customerProfiles.id],
  }),
  humanActions: many(humanActionLogs),
  outcomes: many(outcomeLogs),
}));

export const humanActionLogsRelations = relations(humanActionLogs, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [humanActionLogs.businessId],
    references: [businessProfiles.id],
  }),
  decision: one(decisionLogs, {
    fields: [humanActionLogs.decisionId],
    references: [decisionLogs.id],
  }),
  user: one(users, {
    fields: [humanActionLogs.userId],
    references: [users.id],
  }),
}));

export const outcomeLogsRelations = relations(outcomeLogs, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [outcomeLogs.businessId],
    references: [businessProfiles.id],
  }),
  decision: one(decisionLogs, {
    fields: [outcomeLogs.decisionId],
    references: [decisionLogs.id],
  }),
  lead: one(leads, {
    fields: [outcomeLogs.leadId],
    references: [leads.id],
  }),
  jobRequest: one(jobRequests, {
    fields: [outcomeLogs.jobRequestId],
    references: [jobRequests.id],
  }),
  customer: one(customerProfiles, {
    fields: [outcomeLogs.customerId],
    references: [customerProfiles.id],
  }),
}));

export const reasonCodesRelations = relations(reasonCodes, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [reasonCodes.businessId],
    references: [businessProfiles.id],
  }),
}));

export const policyVersionsRelations = relations(policyVersions, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [policyVersions.businessId],
    references: [businessProfiles.id],
  }),
}));

export const policyTuningSuggestionsRelations = relations(policyTuningSuggestions, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [policyTuningSuggestions.businessId],
    references: [businessProfiles.id],
  }),
  reviewedByUser: one(users, {
    fields: [policyTuningSuggestions.reviewedByUserId],
    references: [users.id],
  }),
}));

export const killSwitchesRelations = relations(killSwitches, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [killSwitches.businessId],
    references: [businessProfiles.id],
  }),
}));

// Insert schemas for Learning System
export const insertDecisionLogSchema = createInsertSchema(decisionLogs).omit({
  id: true,
  createdAt: true,
});

export const insertHumanActionLogSchema = createInsertSchema(humanActionLogs).omit({
  id: true,
  createdAt: true,
});

export const insertOutcomeLogSchema = createInsertSchema(outcomeLogs).omit({
  id: true,
  createdAt: true,
});

export const insertReasonCodeSchema = createInsertSchema(reasonCodes).omit({
  id: true,
  createdAt: true,
});

export const insertPolicyVersionSchema = createInsertSchema(policyVersions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPolicyTuningSuggestionSchema = createInsertSchema(policyTuningSuggestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKillSwitchSchema = createInsertSchema(killSwitches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for Learning System
export type DecisionLog = typeof decisionLogs.$inferSelect;
export type InsertDecisionLog = z.infer<typeof insertDecisionLogSchema>;

export type HumanActionLog = typeof humanActionLogs.$inferSelect;
export type InsertHumanActionLog = z.infer<typeof insertHumanActionLogSchema>;

export type OutcomeLog = typeof outcomeLogs.$inferSelect;
export type InsertOutcomeLog = z.infer<typeof insertOutcomeLogSchema>;

export type ReasonCode = typeof reasonCodes.$inferSelect;
export type InsertReasonCode = z.infer<typeof insertReasonCodeSchema>;

export type PolicyVersion = typeof policyVersions.$inferSelect;
export type InsertPolicyVersion = z.infer<typeof insertPolicyVersionSchema>;

export type PolicyTuningSuggestion = typeof policyTuningSuggestions.$inferSelect;
export type InsertPolicyTuningSuggestion = z.infer<typeof insertPolicyTuningSuggestionSchema>;

export type KillSwitch = typeof killSwitches.$inferSelect;
export type InsertKillSwitch = z.infer<typeof insertKillSwitchSchema>;

// API input schemas for Learning System
export const logDecisionInputSchema = z.object({
  businessId: z.number(),
  runId: z.number().optional(),
  leadId: z.number().optional(),
  jobRequestId: z.number().optional(),
  customerId: z.number().optional(),
  decisionType: decisionTypeEnum,
  stage: z.string().optional(),
  agentName: z.string(),
  agentVersion: z.string(),
  policyVersion: z.string().optional(),
  inputsSnapshot: z.record(z.unknown()),
  recommendedAction: z.record(z.unknown()),
  confidence: confidenceLevelEnum,
  reasons: z.array(z.string()).default([]),
});

export const logHumanActionInputSchema = z.object({
  businessId: z.number(),
  decisionId: z.number(),
  userId: z.number(),
  role: z.string(),
  actionType: humanActionTypeEnum,
  finalAction: z.record(z.unknown()),
  reasonCodes: z.array(z.string()).default([]),
  note: z.string().optional(),
});

export const logOutcomeInputSchema = z.object({
  businessId: z.number(),
  decisionId: z.number().optional(),
  leadId: z.number().optional(),
  jobRequestId: z.number().optional(),
  customerId: z.number().optional(),
  outcomeType: outcomeTypeEnum,
  outcomeValue: z.record(z.unknown()).default({}),
  occurredAt: z.string().datetime().optional(),
});

export const reviewSuggestionInputSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewerNote: z.string().optional(),
});

// ============================================
// Crew Comms Worker Agent
// ============================================

// Notification channel enum
export const notificationChannelEnum = z.enum(["IN_APP", "PUSH", "SMS"]);
export type NotificationChannel = z.infer<typeof notificationChannelEnum>;

// Notification type enum
export const notificationTypeEnum = z.enum([
  "DAILY_BRIEFING",
  "JOB_ADDED",
  "JOB_UPDATED",
  "JOB_CANCELED",
  "SCOPE_CHANGED",
  "ETA_CHANGED",
  "CUSTOMER_NOTE",
  "EQUIPMENT_ALERT",
  "ACTION_REQUIRED",
  "CREW_BROADCAST",
]);
export type NotificationType = z.infer<typeof notificationTypeEnum>;

// Notification status enum
export const notificationStatusEnum = z.enum(["QUEUED", "SENT", "DELIVERED", "FAILED", "ACKED"]);
export type NotificationStatus = z.infer<typeof notificationStatusEnum>;

// Recipient role enum
export const recipientRoleEnum = z.enum(["OWNER_ADMIN", "CREW_LEAD", "CREW_MEMBER"]);
export type RecipientRole = z.infer<typeof recipientRoleEnum>;

// Message direction enum
export const messageDirectionEnum = z.enum(["OUTBOUND", "INBOUND"]);
export type MessageDirection = z.infer<typeof messageDirectionEnum>;

// Language enum
export const languageEnum = z.enum(["EN", "ES"]);
export type Language = z.infer<typeof languageEnum>;

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  recipientUserId: integer("recipient_user_id").references(() => users.id).notNull(),
  recipientRole: text("recipient_role").notNull(), // OWNER_ADMIN | CREW_LEAD | CREW_MEMBER
  channel: text("channel").notNull(), // IN_APP | PUSH | SMS
  type: text("type").notNull(), // DAILY_BRIEFING | JOB_ADDED | etc.
  title: text("title").notNull(),
  body: text("body").notNull(),
  dataJson: jsonb("data_json"), // {jobId, crewId, route, deepLink, severity}
  status: text("status").default("QUEUED").notNull(), // QUEUED | SENT | DELIVERED | FAILED | ACKED
  providerMessageId: text("provider_message_id"), // Twilio SID etc.
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  ackedAt: timestamp("acked_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  recipientIdx: index("notification_recipient_idx").on(table.recipientUserId),
  statusIdx: index("notification_status_idx").on(table.status),
  businessIdx: index("notification_business_idx").on(table.businessId),
  typeIdx: index("notification_type_idx").on(table.type),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Crew Comms Preferences table
export const crewCommsPreferences = pgTable("crew_comms_preferences", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  smsEnabled: boolean("sms_enabled").default(true).notNull(),
  pushEnabled: boolean("push_enabled").default(true).notNull(),
  quietHoursStart: text("quiet_hours_start"), // HH:MM format
  quietHoursEnd: text("quiet_hours_end"), // HH:MM format
  language: text("language").default("EN").notNull(), // EN | ES
  phoneE164: text("phone_e164"), // snapshot from user
  timezone: text("timezone").default("America/New_York"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userIdx: index("crew_comms_pref_user_idx").on(table.userId),
  businessIdx: index("crew_comms_pref_business_idx").on(table.businessId),
  uniqueUserPref: uniqueIndex("crew_comms_pref_unique_idx").on(table.userId),
}));

export const insertCrewCommsPreferenceSchema = createInsertSchema(crewCommsPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type CrewCommsPreference = typeof crewCommsPreferences.$inferSelect;
export type InsertCrewCommsPreference = z.infer<typeof insertCrewCommsPreferenceSchema>;

// Comms Thread table (for SMS conversation threads)
export const commsThreads = pgTable("comms_threads", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessProfiles.id).notNull(),
  participantUserId: integer("participant_user_id").references(() => users.id).notNull(),
  participantPhoneE164: text("participant_phone_e164").notNull(),
  channel: text("channel").default("SMS").notNull(), // SMS
  lastMessageAt: timestamp("last_message_at"),
  lastMessagePreview: text("last_message_preview"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  participantIdx: index("comms_thread_participant_idx").on(table.participantUserId),
  phoneIdx: index("comms_thread_phone_idx").on(table.participantPhoneE164),
  businessIdx: index("comms_thread_business_idx").on(table.businessId),
}));

export const insertCommsThreadSchema = createInsertSchema(commsThreads).omit({ id: true, createdAt: true });
export type CommsThread = typeof commsThreads.$inferSelect;
export type InsertCommsThread = z.infer<typeof insertCommsThreadSchema>;

// Comms Message table (individual messages in threads)
export const commsMessages = pgTable("comms_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").references(() => commsThreads.id).notNull(),
  direction: text("direction").notNull(), // OUTBOUND | INBOUND
  channel: text("channel").default("SMS").notNull(), // SMS | IN_APP
  body: text("body").notNull(),
  providerMessageId: text("provider_message_id"),
  relatedJobId: text("related_job_id"),
  relatedCrewId: integer("related_crew_id"),
  relatedNotificationId: integer("related_notification_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  threadIdx: index("comms_message_thread_idx").on(table.threadId),
  directionIdx: index("comms_message_direction_idx").on(table.direction),
}));

export const insertCommsMessageSchema = createInsertSchema(commsMessages).omit({ id: true, createdAt: true });
export type CommsMessage = typeof commsMessages.$inferSelect;
export type InsertCommsMessage = z.infer<typeof insertCommsMessageSchema>;

// Push Subscription table (for Web Push notifications)
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  endpoint: text("endpoint").notNull(),
  keysJson: jsonb("keys_json").notNull(), // {p256dh, auth}
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => ({
  userIdx: index("push_sub_user_idx").on(table.userId),
  endpointIdx: uniqueIndex("push_sub_endpoint_idx").on(table.endpoint),
}));

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

// Types for Crew Comms
export type NotificationWithRecipient = Notification & { recipient?: User };
export type CommsThreadWithMessages = CommsThread & { messages: CommsMessage[]; participant?: User };

// API input schemas for Crew Comms
export const sendNotificationInputSchema = z.object({
  businessId: z.number(),
  recipientUserId: z.number(),
  recipientRole: recipientRoleEnum,
  channel: notificationChannelEnum,
  type: notificationTypeEnum,
  title: z.string().min(1),
  body: z.string().min(1),
  dataJson: z.record(z.unknown()).optional(),
});

export const ackNotificationInputSchema = z.object({
  notificationId: z.number(),
});

export const sendCrewBroadcastInputSchema = z.object({
  businessId: z.number(),
  crewId: z.number(),
  message: z.string().min(1),
  channels: z.array(notificationChannelEnum).default(["IN_APP", "SMS"]),
  requestAck: z.boolean().default(false),
});

export const updateCommsPreferenceInputSchema = z.object({
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  language: languageEnum.optional(),
  phoneE164: z.string().optional(),
  timezone: z.string().optional(),
});

export const registerPushSubscriptionInputSchema = z.object({
  endpoint: z.string().url(),
  keysJson: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().optional(),
});

// =============================================
// ONBOARDING AGENT TABLES (Sprint 1)
// =============================================

// Onboarding Status enum
export const onboardingStatusEnum = z.enum(["NEW", "IN_PROGRESS", "AWAITING_CONFIRM", "COMPLETE"]);
export type OnboardingStatus = z.infer<typeof onboardingStatusEnum>;

// Answer Confidence enum
export const answerConfidenceEnum = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type AnswerConfidence = z.infer<typeof answerConfidenceEnum>;

// Onboarding Flow - stores flow definitions (YAML parsed to JSON)
export const onboardingFlows = pgTable("onboarding_flows", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(), // "v1"
  name: text("name").notNull(), // "LawnFlow V1 Implementation"
  definitionJson: jsonb("definition_json").notNull(), // parsed YAML flow definition
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  versionIdx: uniqueIndex("onboarding_flow_version_idx").on(table.version),
}));

export const insertOnboardingFlowSchema = createInsertSchema(onboardingFlows).omit({ id: true, createdAt: true, updatedAt: true });
export type OnboardingFlow = typeof onboardingFlows.$inferSelect;
export type InsertOnboardingFlow = z.infer<typeof insertOnboardingFlowSchema>;

// Onboarding Session - tracks a user's onboarding progress
export const onboardingSessions = pgTable("onboarding_sessions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => businessProfiles.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  flowId: integer("flow_id").references(() => onboardingFlows.id).notNull(),
  status: text("status").notNull().default("NEW"), // NEW, IN_PROGRESS, AWAITING_CONFIRM, COMPLETE
  currentNodeId: text("current_node_id"), // which question we're on
  derivedConfigJson: jsonb("derived_config_json"), // generated config from answers
  flagsJson: jsonb("flags_json"), // assumptions, revisitLater flags
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  accountIdx: index("onboarding_session_account_idx").on(table.accountId),
  userIdx: index("onboarding_session_user_idx").on(table.userId),
  statusIdx: index("onboarding_session_status_idx").on(table.status),
}));

export const insertOnboardingSessionSchema = createInsertSchema(onboardingSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type OnboardingSession = typeof onboardingSessions.$inferSelect;
export type InsertOnboardingSession = z.infer<typeof insertOnboardingSessionSchema>;

// Onboarding Answer - stores each answer given during onboarding
export const onboardingAnswers = pgTable("onboarding_answers", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => onboardingSessions.id).notNull(),
  nodeId: text("node_id").notNull(), // which question node
  questionText: text("question_text").notNull(), // the question asked
  answerValueJson: jsonb("answer_value_json").notNull(), // {selected:[], text:"", number:...}
  confidence: text("confidence").default("HIGH").notNull(), // HIGH, MEDIUM, LOW
  assumptionMade: boolean("assumption_made").default(false).notNull(),
  revisitLater: boolean("revisit_later").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  sessionIdx: index("onboarding_answer_session_idx").on(table.sessionId),
  nodeIdx: index("onboarding_answer_node_idx").on(table.nodeId),
}));

export const insertOnboardingAnswerSchema = createInsertSchema(onboardingAnswers).omit({ id: true, createdAt: true });
export type OnboardingAnswer = typeof onboardingAnswers.$inferSelect;
export type InsertOnboardingAnswer = z.infer<typeof insertOnboardingAnswerSchema>;

// Types for Onboarding API
export type OnboardingSessionWithAnswers = OnboardingSession & { answers: OnboardingAnswer[] };
export type OnboardingFlowWithNodes = OnboardingFlow & { nodes?: any[] };

// =============================================
// BILLING & QUICKBOOKS INTEGRATION (Phase A1)
// =============================================

// Integration Provider enum
export const integrationProviderEnum = z.enum(["QUICKBOOKS"]);
export type IntegrationProvider = z.infer<typeof integrationProviderEnum>;

// Integration Status enum
export const integrationStatusEnum = z.enum(["DISCONNECTED", "CONNECTED", "ERROR"]);
export type IntegrationStatus = z.infer<typeof integrationStatusEnum>;

// Account Integrations - OAuth connections to external services
export const accountIntegrations = pgTable("account_integrations", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => businessProfiles.id).notNull(),
  provider: text("provider").notNull(), // QUICKBOOKS
  status: text("status").notNull().default("DISCONNECTED"), // DISCONNECTED, CONNECTED, ERROR
  accessToken: text("access_token"), // encrypted
  refreshToken: text("refresh_token"), // encrypted
  tokenExpiresAt: timestamp("token_expires_at"),
  realmId: text("realm_id"), // QuickBooks company ID
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  accountProviderIdx: uniqueIndex("account_integration_account_provider_idx").on(table.accountId, table.provider),
  statusIdx: index("account_integration_status_idx").on(table.status),
}));

export const insertAccountIntegrationSchema = createInsertSchema(accountIntegrations).omit({ id: true, createdAt: true, updatedAt: true });
export type AccountIntegration = typeof accountIntegrations.$inferSelect;
export type InsertAccountIntegration = z.infer<typeof insertAccountIntegrationSchema>;

// Invoice Status enum
export const invoiceStatusEnum = z.enum([
  "DRAFT", "PENDING_APPROVAL", "SENT", "PAID", "PARTIAL", "OVERDUE", "VOID", "DISPUTED", "FAILED_SYNC"
]);
export type InvoiceStatus = z.infer<typeof invoiceStatusEnum>;

// Invoices - billing documents
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => businessProfiles.id).notNull(),
  customerId: integer("customer_id"), // FK to customers when table exists
  jobId: integer("job_id").references(() => jobs.id),
  quoteId: integer("quote_id"), // FK to quotes when table exists
  invoiceNumber: text("invoice_number"), // human-readable number
  status: text("status").notNull().default("DRAFT"),
  currency: text("currency").notNull().default("USD"),
  subtotal: integer("subtotal").notNull().default(0), // in cents
  tax: integer("tax").notNull().default(0), // in cents
  total: integer("total").notNull().default(0), // in cents
  minQuote: integer("min_quote"), // quote range lower bound (cents)
  maxQuote: integer("max_quote"), // quote range upper bound (cents)
  approvedQuote: integer("approved_quote"), // final approved amount (cents)
  dueDate: timestamp("due_date"),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  externalProvider: text("external_provider"), // QUICKBOOKS
  externalInvoiceId: text("external_invoice_id"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  accountIdx: index("invoice_account_idx").on(table.accountId),
  statusIdx: index("invoice_status_idx").on(table.status),
  customerIdx: index("invoice_customer_idx").on(table.customerId),
  dueDateIdx: index("invoice_due_date_idx").on(table.dueDate),
}));

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// Invoice Line Items
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: integer("unit_price").notNull().default(0), // in cents
  amount: integer("amount").notNull().default(0), // in cents (qty * unitPrice)
  serviceCode: text("service_code"), // maps to quote engine service type
  externalItemId: text("external_item_id"), // QuickBooks item ID
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  invoiceIdx: index("invoice_line_item_invoice_idx").on(table.invoiceId),
}));

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({ id: true, createdAt: true });
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;

// Payment Status enum
export const paymentStatusEnum = z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED", "PARTIAL"]);
export type PaymentStatus = z.infer<typeof paymentStatusEnum>;

// Payment Method enum
export const paymentMethodEnum = z.enum(["CASH", "CHECK", "CARD", "ACH", "UNKNOWN"]);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

// Payments - payment records
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => businessProfiles.id).notNull(),
  invoiceId: integer("invoice_id").references(() => invoices.id).notNull(),
  status: text("status").notNull().default("PENDING"),
  amount: integer("amount").notNull().default(0), // in cents
  method: text("method").default("UNKNOWN"),
  externalProvider: text("external_provider"),
  externalPaymentId: text("external_payment_id"),
  occurredAt: timestamp("occurred_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  accountIdx: index("payment_account_idx").on(table.accountId),
  invoiceIdx: index("payment_invoice_idx").on(table.invoiceId),
  statusIdx: index("payment_status_idx").on(table.status),
}));

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

// Billing Issue Type enum
export const billingIssueTypeEnum = z.enum([
  "VARIANCE", "SYNC_ERROR", "DISPUTE", "OVERDUE", "PAYMENT_FAILED", "CREDIT_REQUEST", "REFUND_REQUEST"
]);
export type BillingIssueType = z.infer<typeof billingIssueTypeEnum>;

// Billing Issue Severity enum
export const billingIssueSeverityEnum = z.enum(["LOW", "MED", "HIGH"]);
export type BillingIssueSeverity = z.infer<typeof billingIssueSeverityEnum>;

// Billing Issue Status enum
export const billingIssueStatusEnum = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]);
export type BillingIssueStatus = z.infer<typeof billingIssueStatusEnum>;

// Billing Issues - exceptions requiring attention
export const billingIssues = pgTable("billing_issues", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => businessProfiles.id).notNull(),
  type: text("type").notNull(), // VARIANCE, SYNC_ERROR, DISPUTE, etc.
  severity: text("severity").notNull().default("MED"), // LOW, MED, HIGH
  status: text("status").notNull().default("OPEN"), // OPEN, IN_PROGRESS, RESOLVED
  relatedInvoiceId: integer("related_invoice_id").references(() => invoices.id),
  relatedJobId: integer("related_job_id").references(() => jobs.id),
  relatedCustomerId: integer("related_customer_id"), // FK to customers when table exists
  summary: text("summary").notNull(),
  detailsJson: jsonb("details_json"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  accountIdx: index("billing_issue_account_idx").on(table.accountId),
  typeIdx: index("billing_issue_type_idx").on(table.type),
  severityIdx: index("billing_issue_severity_idx").on(table.severity),
  statusIdx: index("billing_issue_status_idx").on(table.status),
}));

export const insertBillingIssueSchema = createInsertSchema(billingIssues).omit({ id: true, createdAt: true, updatedAt: true });
export type BillingIssue = typeof billingIssues.$inferSelect;
export type InsertBillingIssue = z.infer<typeof insertBillingIssueSchema>;

// Policy Service Mapping - maps services to QuickBooks items
export const policyServiceMappings = pgTable("policy_service_mappings", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => businessProfiles.id).notNull(),
  serviceCode: text("service_code").notNull(), // from quote engine: mowing, cleanup, etc.
  quickbooksItemName: text("quickbooks_item_name").notNull(),
  quickbooksItemId: text("quickbooks_item_id"),
  taxCode: text("tax_code"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  accountServiceIdx: uniqueIndex("policy_service_mapping_account_service_idx").on(table.accountId, table.serviceCode),
}));

export const insertPolicyServiceMappingSchema = createInsertSchema(policyServiceMappings).omit({ id: true, createdAt: true, updatedAt: true });
export type PolicyServiceMapping = typeof policyServiceMappings.$inferSelect;
export type InsertPolicyServiceMapping = z.infer<typeof insertPolicyServiceMappingSchema>;

// Billing Customer - external sync tracking for customers
export const billingCustomers = pgTable("billing_customers", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => businessProfiles.id).notNull(),
  localCustomerId: integer("local_customer_id").notNull(), // FK to customers when table exists
  externalProvider: text("external_provider").notNull(), // QUICKBOOKS
  externalCustomerId: text("external_customer_id"),
  syncStatus: text("sync_status").notNull().default("OK"), // OK, NEEDS_REVIEW, ERROR
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  accountIdx: index("billing_customer_account_idx").on(table.accountId),
  localCustomerIdx: index("billing_customer_local_idx").on(table.localCustomerId),
  providerCustomerIdx: uniqueIndex("billing_customer_provider_idx").on(table.accountId, table.externalProvider, table.localCustomerId),
}));

export const insertBillingCustomerSchema = createInsertSchema(billingCustomers).omit({ id: true, createdAt: true, updatedAt: true });
export type BillingCustomer = typeof billingCustomers.$inferSelect;
export type InsertBillingCustomer = z.infer<typeof insertBillingCustomerSchema>;

// Billing Overview Stats (for API responses)
export interface BillingOverview {
  draftInvoices: number;
  overdueInvoices: number;
  openIssues: number;
  lastSyncStatus: IntegrationStatus | null;
  lastSyncAt: Date | null;
  totalOutstanding: number; // in cents
}
