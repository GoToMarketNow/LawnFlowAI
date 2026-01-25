// ============================================
// Weather Agent - Schema Definitions
// Zod schemas + Drizzle tables for weather data
// ============================================

import { z } from 'zod';
import { pgTable, serial, varchar, integer, jsonb, timestamp, boolean, text, index, real } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { jobs } from './schema';

// ============================================
// Zod Schemas - Data Contracts
// ============================================

// Weather risk driver types
export const WeatherDriverTypeSchema = z.enum([
  'RAIN',
  'WIND',
  'LIGHTNING',
  'SNOW',
  'ICE',
  'FREEZE',
  'REFREEZE',
  'HEAT',
  'HAIL'
]);

export type WeatherDriverType = z.infer<typeof WeatherDriverTypeSchema>;

// Risk tier classification
export const RiskTierSchema = z.enum(['LOW', 'MED', 'HIGH', 'STOP']);
export type RiskTier = z.infer<typeof RiskTierSchema>;

// Individual weather driver
export const WeatherDriverSchema = z.object({
  type: WeatherDriverTypeSchema,
  value: z.number(),
  threshold: z.number(),
  unit: z.string().optional(),
  description: z.string().optional()
});

export type WeatherDriver = z.infer<typeof WeatherDriverSchema>;

// Weather risk assessment for a job
export const WeatherRiskSchema = z.object({
  jobId: z.number(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  riskScore: z.number().min(0).max(100),
  riskTier: RiskTierSchema,
  drivers: z.array(WeatherDriverSchema),
  confidence: z.number().min(0).max(1),
  forecastVersion: z.string(),
  assessedAt: z.string().datetime()
});

export type WeatherRisk = z.infer<typeof WeatherRiskSchema>;

// Job change in a schedule adjustment
export const JobChangeSchema = z.object({
  jobId: z.number(),
  before: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    crewId: z.number().nullable()
  }),
  after: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    crewId: z.number().nullable()
  }),
  reason: z.string(),
  customerNotified: z.boolean().default(false)
});

export type JobChange = z.infer<typeof JobChangeSchema>;

// Crew reassignment
export const CrewChangeSchema = z.object({
  fromCrewId: z.number(),
  toCrewId: z.number(),
  jobIds: z.array(z.number()),
  reason: z.string()
});

export type CrewChange = z.infer<typeof CrewChangeSchema>;

// Route change
export const RouteChangeSchema = z.object({
  crewId: z.number(),
  beforeRouteId: z.string().nullable(),
  afterRouteId: z.string().nullable()
});

export type RouteChange = z.infer<typeof RouteChangeSchema>;

// Communication plan item
export const CommsPlanItemSchema = z.object({
  stakeholder: z.enum(['CUSTOMER', 'CREW', 'OWNER', 'OPS']),
  targetId: z.number(),
  templateId: z.string(),
  channel: z.enum(['SMS', 'PUSH', 'EMAIL', 'IN_APP']),
  sendAt: z.string().datetime(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL')
});

export type CommsPlanItem = z.infer<typeof CommsPlanItemSchema>;

// Impact metrics for schedule changes
export const ImpactMetricsSchema = z.object({
  disruptionMinutes: z.number(),
  addedDriveMinutes: z.number(),
  overtimeRisk: z.number().min(0).max(100),
  slaImpactScore: z.number().min(0).max(100),
  marginImpactEstimate: z.number(),
  affectedCustomers: z.number(),
  affectedCrews: z.number()
});

export type ImpactMetrics = z.infer<typeof ImpactMetricsSchema>;

// Complete change set for schedule adjustments
export const ChangeSetSchema = z.object({
  planId: z.string(),
  serviceAreaId: z.number(),
  impactedJobs: z.array(JobChangeSchema),
  crewChanges: z.array(CrewChangeSchema),
  routeChanges: z.array(RouteChangeSchema),
  commsPlan: z.array(CommsPlanItemSchema),
  metrics: ImpactMetricsSchema,
  weatherSummary: z.string(),
  generatedAt: z.string().datetime(),
  expiresAt: z.string().datetime()
});

export type ChangeSet = z.infer<typeof ChangeSetSchema>;

// Winter event types
export const WinterEventTypeSchema = z.enum([
  'SNOW',
  'ICE',
  'FREEZING_RAIN',
  'REFREEZE',
  'SLEET',
  'BLIZZARD'
]);

export type WinterEventType = z.infer<typeof WinterEventTypeSchema>;

// Geohash set for affected area
export const GeohashSetSchema = z.object({
  type: z.literal('GEOHASH_SET'),
  precision: z.number().min(1).max(12),
  values: z.array(z.string())
});

// Polygon for affected area
export const PolygonSchema = z.object({
  type: z.literal('POLYGON'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()])))
});

// Affected geo set (union type)
export const AffectedGeoSetSchema = z.union([GeohashSetSchema, PolygonSchema]);

// Winter event definition
export const WinterEventSchema = z.object({
  eventId: z.string(),
  eventType: WinterEventTypeSchema,
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  affectedGeoSet: AffectedGeoSetSchema,
  confidence: z.number().min(0).max(1),
  drivers: z.object({
    snowInches: z.number().optional(),
    iceProbability: z.number().optional(),
    tempMin: z.number().optional(),
    windGust: z.number().optional()
  }),
  sourceAlertIds: z.array(z.string()).optional()
});

export type WinterEvent = z.infer<typeof WinterEventSchema>;

// Campaign offer types
export const CampaignOfferSchema = z.object({
  serviceType: z.enum(['SNOW_REMOVAL', 'SALTING', 'ICE_REMOVAL', 'PLOWING']),
  pricingModel: z.enum(['FIXED', 'PER_INCH', 'HOURLY', 'CUSTOM']),
  basePrice: z.number().optional(),
  ctaType: z.enum(['REQUEST_SERVICE', 'JOIN_RECURRING', 'CALLBACK'])
});

// Campaign segment
export const CampaignSegmentSchema = z.object({
  estimatedCustomers: z.number(),
  geoSet: AffectedGeoSetSchema,
  filtersApplied: z.array(z.string())
});

// Capacity reservation
export const CapacityBlockSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  crewType: z.string()
});

// Campaign throttle rules
export const ThrottleRulesSchema = z.object({
  maxMsgsPerCustomerPer24h: z.number(),
  batchSize: z.number(),
  delayBetweenBatchesSec: z.number()
});

// Campaign metrics estimate
export const CampaignMetricsSchema = z.object({
  expectedConversionRate: z.number(),
  expectedRevenue: z.number(),
  expectedMargin: z.number()
});

// Campaign proposal
export const CampaignProposalSchema = z.object({
  campaignId: z.string(),
  eventId: z.string(),
  segment: CampaignSegmentSchema,
  offer: CampaignOfferSchema,
  capacity: z.object({
    maxAcceptsTotal: z.number(),
    maxAcceptsPerHour: z.number(),
    reservedBlocks: z.array(CapacityBlockSchema)
  }),
  throttle: ThrottleRulesSchema,
  templates: z.object({
    pushTemplateId: z.string().optional(),
    smsTemplateId: z.string().optional()
  }),
  metricsEstimate: CampaignMetricsSchema
});

export type CampaignProposal = z.infer<typeof CampaignProposalSchema>;

// Approval packet types
export const ApprovalPacketTypeSchema = z.enum([
  'SCHEDULE_CHANGE',
  'WINTER_CAMPAIGN',
  'COMBINED'
]);

// Approval packet
export const ApprovalPacketSchema = z.object({
  packetId: z.string(),
  type: ApprovalPacketTypeSchema,
  operatorId: z.number(),
  serviceAreaId: z.number(),
  summary: z.string(),
  proposals: z.object({
    changeSet: ChangeSetSchema.optional(),
    campaign: CampaignProposalSchema.optional()
  }),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'PARTIAL']).default('PENDING')
});

export type ApprovalPacket = z.infer<typeof ApprovalPacketSchema>;

// Forecast data from providers
export const HourlyForecastSchema = z.object({
  dt: z.number(),
  temp: z.number(),
  feelsLike: z.number(),
  humidity: z.number(),
  windSpeed: z.number(),
  windGust: z.number().optional(),
  windDeg: z.number(),
  clouds: z.number(),
  pop: z.number(), // Probability of precipitation
  rain: z.number().optional(),
  snow: z.number().optional(),
  weather: z.array(z.object({
    id: z.number(),
    main: z.string(),
    description: z.string(),
    icon: z.string()
  })),
  visibility: z.number().optional()
});

export const DailyForecastSchema = z.object({
  dt: z.number(),
  sunrise: z.number(),
  sunset: z.number(),
  temp: z.object({
    min: z.number(),
    max: z.number(),
    day: z.number(),
    night: z.number()
  }),
  humidity: z.number(),
  windSpeed: z.number(),
  windGust: z.number().optional(),
  pop: z.number(),
  rain: z.number().optional(),
  snow: z.number().optional(),
  weather: z.array(z.object({
    id: z.number(),
    main: z.string(),
    description: z.string(),
    icon: z.string()
  }))
});

export const WeatherAlertSchema = z.object({
  senderName: z.string(),
  event: z.string(),
  start: z.number(),
  end: z.number(),
  description: z.string(),
  tags: z.array(z.string()),
  severity: z.enum(['Minor', 'Moderate', 'Severe', 'Extreme']).optional()
});

export const ForecastBundleSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  geohash: z.string(),
  timezone: z.string(),
  current: z.object({
    dt: z.number(),
    temp: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    weather: z.array(z.object({
      main: z.string(),
      description: z.string()
    }))
  }).optional(),
  hourly: z.array(HourlyForecastSchema),
  daily: z.array(DailyForecastSchema),
  alerts: z.array(WeatherAlertSchema).optional(),
  provider: z.string(),
  fetchedAt: z.string().datetime()
});

export type ForecastBundle = z.infer<typeof ForecastBundleSchema>;

// ============================================
// Drizzle Tables - Database Schema
// ============================================

// Weather forecast cache
export const weatherForecasts = pgTable('weather_forecasts', {
  id: serial('id').primaryKey(),
  geohash: varchar('geohash', { length: 12 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  lat: real('lat').notNull(),
  lon: real('lon').notNull(),
  forecastData: jsonb('forecast_data').notNull(),
  alertsData: jsonb('alerts_data'),
  fetchedAt: timestamp('fetched_at').notNull(),
  expiresAt: timestamp('expires_at').notNull()
}, (table) => ({
  geohashIdx: index('weather_forecasts_geohash_idx').on(table.geohash),
  expiresIdx: index('weather_forecasts_expires_idx').on(table.expiresAt)
}));

// Weather risk assessments
export const weatherRiskAssessments = pgTable('weather_risk_assessments', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').references(() => jobs.id),
  operatorId: integer('operator_id').notNull(),
  serviceAreaId: integer('service_area_id'),
  riskScore: integer('risk_score').notNull(),
  riskTier: varchar('risk_tier', { length: 10 }).notNull(),
  drivers: jsonb('drivers').notNull(),
  confidence: real('confidence').notNull(),
  forecastVersion: varchar('forecast_version', { length: 100 }),
  jobStart: timestamp('job_start').notNull(),
  jobEnd: timestamp('job_end').notNull(),
  assessedAt: timestamp('assessed_at').notNull(),
  supersededAt: timestamp('superseded_at')
}, (table) => ({
  jobIdx: index('weather_risk_job_idx').on(table.jobId),
  operatorIdx: index('weather_risk_operator_idx').on(table.operatorId),
  riskTierIdx: index('weather_risk_tier_idx').on(table.riskTier),
  assessedIdx: index('weather_risk_assessed_idx').on(table.assessedAt)
}));

// Schedule change plans
export const weatherSchedulePlans = pgTable('weather_schedule_plans', {
  id: serial('id').primaryKey(),
  planId: varchar('plan_id', { length: 100 }).notNull().unique(),
  operatorId: integer('operator_id').notNull(),
  serviceAreaId: integer('service_area_id').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('PENDING'),
  changeSetData: jsonb('change_set_data').notNull(),
  weatherSummary: text('weather_summary'),
  impactedJobCount: integer('impacted_job_count').notNull().default(0),
  approvedBy: integer('approved_by'),
  approvedAt: timestamp('approved_at'),
  appliedAt: timestamp('applied_at'),
  createdAt: timestamp('created_at').notNull(),
  expiresAt: timestamp('expires_at').notNull()
}, (table) => ({
  planIdIdx: index('weather_plan_id_idx').on(table.planId),
  operatorIdx: index('weather_plan_operator_idx').on(table.operatorId),
  statusIdx: index('weather_plan_status_idx').on(table.status)
}));

// Winter events detected
export const winterEvents = pgTable('winter_events', {
  id: serial('id').primaryKey(),
  eventId: varchar('event_id', { length: 100 }).notNull().unique(),
  operatorId: integer('operator_id').notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  windowStart: timestamp('window_start').notNull(),
  windowEnd: timestamp('window_end').notNull(),
  affectedGeoSet: jsonb('affected_geo_set').notNull(),
  confidence: real('confidence').notNull(),
  drivers: jsonb('drivers').notNull(),
  sourceAlertIds: jsonb('source_alert_ids'),
  detectedAt: timestamp('detected_at').notNull(),
  resolvedAt: timestamp('resolved_at')
}, (table) => ({
  eventIdIdx: index('winter_event_id_idx').on(table.eventId),
  operatorIdx: index('winter_event_operator_idx').on(table.operatorId),
  windowIdx: index('winter_event_window_idx').on(table.windowStart, table.windowEnd)
}));

// Winter campaigns
export const winterCampaigns = pgTable('winter_campaigns', {
  id: serial('id').primaryKey(),
  campaignId: varchar('campaign_id', { length: 100 }).notNull().unique(),
  eventId: varchar('event_id', { length: 100 }).notNull(),
  operatorId: integer('operator_id').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('PENDING'),
  proposalData: jsonb('proposal_data').notNull(),
  segmentSize: integer('segment_size').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  deliveredCount: integer('delivered_count').notNull().default(0),
  acceptedCount: integer('accepted_count').notNull().default(0),
  approvedBy: integer('approved_by'),
  approvedAt: timestamp('approved_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull()
}, (table) => ({
  campaignIdIdx: index('winter_campaign_id_idx').on(table.campaignId),
  eventIdIdx: index('winter_campaign_event_idx').on(table.eventId),
  operatorIdx: index('winter_campaign_operator_idx').on(table.operatorId),
  statusIdx: index('winter_campaign_status_idx').on(table.status)
}));

// Campaign message sends
export const winterCampaignMessages = pgTable('winter_campaign_messages', {
  id: serial('id').primaryKey(),
  campaignId: varchar('campaign_id', { length: 100 }).notNull(),
  customerId: integer('customer_id').notNull(),
  channel: varchar('channel', { length: 20 }).notNull(),
  templateId: varchar('template_id', { length: 100 }),
  status: varchar('status', { length: 50 }).notNull().default('QUEUED'),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  respondedAt: timestamp('responded_at'),
  response: varchar('response', { length: 50 }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull()
}, (table) => ({
  campaignIdx: index('campaign_msg_campaign_idx').on(table.campaignId),
  customerIdx: index('campaign_msg_customer_idx').on(table.customerId),
  statusIdx: index('campaign_msg_status_idx').on(table.status)
}));

// Approval packets (unified for schedule changes and campaigns)
export const weatherApprovalPackets = pgTable('weather_approval_packets', {
  id: serial('id').primaryKey(),
  packetId: varchar('packet_id', { length: 100 }).notNull().unique(),
  type: varchar('type', { length: 50 }).notNull(),
  operatorId: integer('operator_id').notNull(),
  serviceAreaId: integer('service_area_id'),
  summary: text('summary').notNull(),
  proposalsData: jsonb('proposals_data').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('PENDING'),
  workflowId: varchar('workflow_id', { length: 200 }),
  approvedBy: integer('approved_by'),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').notNull(),
  expiresAt: timestamp('expires_at').notNull()
}, (table) => ({
  packetIdIdx: index('approval_packet_id_idx').on(table.packetId),
  operatorIdx: index('approval_packet_operator_idx').on(table.operatorId),
  statusIdx: index('approval_packet_status_idx').on(table.status),
  workflowIdx: index('approval_packet_workflow_idx').on(table.workflowId)
}));

// Weather monitoring runs (for observability)
export const weatherMonitoringRuns = pgTable('weather_monitoring_runs', {
  id: serial('id').primaryKey(),
  operatorId: integer('operator_id').notNull(),
  serviceAreaId: integer('service_area_id').notNull(),
  runType: varchar('run_type', { length: 50 }).notNull(), // 'DAILY', 'NEAR_TERM', 'ALERT'
  jobsScanned: integer('jobs_scanned').notNull().default(0),
  highRiskJobs: integer('high_risk_jobs').notNull().default(0),
  plansTriggered: integer('plans_triggered').notNull().default(0),
  winterEventsDetected: integer('winter_events_detected').notNull().default(0),
  apiCallsMade: integer('api_calls_made').notNull().default(0),
  cacheHitRate: real('cache_hit_rate'),
  durationMs: integer('duration_ms'),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  error: text('error')
}, (table) => ({
  operatorIdx: index('monitoring_run_operator_idx').on(table.operatorId),
  startedIdx: index('monitoring_run_started_idx').on(table.startedAt)
}));

// ============================================
// Relations
// ============================================

export const weatherRiskAssessmentsRelations = relations(weatherRiskAssessments, ({ one }) => ({
  job: one(jobs, {
    fields: [weatherRiskAssessments.jobId],
    references: [jobs.id]
  })
}));

export const winterCampaignsRelations = relations(winterCampaigns, ({ one, many }) => ({
  event: one(winterEvents, {
    fields: [winterCampaigns.eventId],
    references: [winterEvents.eventId]
  }),
  messages: many(winterCampaignMessages)
}));

export const winterCampaignMessagesRelations = relations(winterCampaignMessages, ({ one }) => ({
  campaign: one(winterCampaigns, {
    fields: [winterCampaignMessages.campaignId],
    references: [winterCampaigns.campaignId]
  })
}));
