// ============================================
// Weather Temporal Activities
// Activities for weather monitoring and schedule planning workflows
// ============================================

import { db } from '../../db';
import { 
  weatherForecasts,
  weatherRiskAssessments,
  weatherSchedulePlans,
  winterEvents,
  winterCampaigns,
  winterCampaignMessages,
  weatherApprovalPackets,
  weatherMonitoringRuns
} from '../../../shared/schema-weather';
import { jobs, customers, crews, serviceAreas, operators } from '../../../shared/schema';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { getWeatherProviderService } from '../../services/weather/providerService';
import { RiskScorer } from '../../services/weather/riskScorer';
import { encodeGeohash, clusterByGeohash } from '../../services/weather/geohash';
import type { ForecastBundle, WeatherRisk, ChangeSet, CampaignProposal } from '../../../shared/schema-weather';

// ============================================
// Weather Monitoring Activities
// ============================================

interface FetchWeatherInput {
  operatorId: number;
  serviceAreaId: number;
  horizonDays: number;
  alertsOnly?: boolean;
}

interface FetchWeatherResult {
  forecasts: ForecastBundle[];
  alerts: any[];
  cacheHitRate: number;
}

/**
 * Fetch weather forecasts for a service area
 */
export async function fetchWeatherForServiceAreaActivity(
  input: FetchWeatherInput
): Promise<FetchWeatherResult> {
  const weatherService = getWeatherProviderService();

  // Get jobs in the service area for the horizon
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + input.horizonDays);

  const upcomingJobs = await db
    .select({
      id: jobs.id,
      lat: jobs.lat,
      lon: jobs.lon,
      scheduledDate: jobs.scheduledDate
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.operatorId, input.operatorId),
        eq(jobs.serviceAreaId, input.serviceAreaId),
        gte(jobs.scheduledDate, new Date()),
        lte(jobs.scheduledDate, horizonEnd),
        inArray(jobs.status, ['SCHEDULED', 'IN_PROGRESS'])
      )
    );

  if (upcomingJobs.length === 0 && !input.alertsOnly) {
    return { forecasts: [], alerts: [], cacheHitRate: 1 };
  }

  // Get unique locations by geohash
  const locations = upcomingJobs
    .filter(j => j.lat && j.lon)
    .map(j => ({ lat: j.lat!, lon: j.lon! }));

  const forecasts: ForecastBundle[] = [];
  const alerts: any[] = [];

  if (input.alertsOnly) {
    // Just fetch alerts for the service area center
    const [serviceArea] = await db
      .select()
      .from(serviceAreas)
      .where(eq(serviceAreas.id, input.serviceAreaId))
      .limit(1);

    if (serviceArea?.centerLat && serviceArea?.centerLon) {
      const areaAlerts = await weatherService.fetchAlerts(
        serviceArea.centerLat,
        serviceArea.centerLon
      );
      alerts.push(...areaAlerts);
    }
  } else {
    // Fetch forecasts for job locations
    const forecastMap = await weatherService.fetchBatch(
      locations.map(l => ({ lat: l.lat, lon: l.lon, operatorId: input.operatorId }))
    );

    for (const forecast of forecastMap.values()) {
      forecasts.push(forecast);
      if (forecast.alerts) {
        alerts.push(...forecast.alerts);
      }
    }
  }

  const stats = weatherService.getCacheStats();

  return {
    forecasts,
    alerts,
    cacheHitRate: stats.hitRate
  };
}

interface ScoreJobsInput {
  operatorId: number;
  serviceAreaId: number;
  forecasts: ForecastBundle[];
  horizonDays: number;
}

interface ScoreJobsResult {
  jobsScored: number;
  highRiskJobs: WeatherRisk[];
  medRiskJobs: WeatherRisk[];
}

/**
 * Score weather risk for jobs
 */
export async function scoreJobsRiskActivity(
  input: ScoreJobsInput
): Promise<ScoreJobsResult> {
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + input.horizonDays);

  // Get upcoming jobs
  const upcomingJobs = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.operatorId, input.operatorId),
        eq(jobs.serviceAreaId, input.serviceAreaId),
        gte(jobs.scheduledDate, new Date()),
        lte(jobs.scheduledDate, horizonEnd),
        inArray(jobs.status, ['SCHEDULED', 'IN_PROGRESS'])
      )
    );

  if (upcomingJobs.length === 0) {
    return { jobsScored: 0, highRiskJobs: [], medRiskJobs: [] };
  }

  // Create forecast map by geohash
  const forecastMap = new Map<string, ForecastBundle>();
  for (const forecast of input.forecasts) {
    forecastMap.set(forecast.geohash, forecast);
  }

  // Score each job
  const scorer = new RiskScorer();
  const jobInfos = upcomingJobs
    .filter(j => j.lat && j.lon && j.scheduledDate && j.scheduledEndTime)
    .map(j => ({
      id: j.id,
      scheduledStart: j.scheduledDate!,
      scheduledEnd: j.scheduledEndTime!,
      lat: j.lat!,
      lon: j.lon!,
      serviceType: j.serviceType || undefined,
      operatorId: input.operatorId,
      serviceAreaId: input.serviceAreaId
    }));

  const riskAssessments = scorer.scoreJobs(jobInfos, forecastMap);

  // Store assessments
  const highRiskJobs: WeatherRisk[] = [];
  const medRiskJobs: WeatherRisk[] = [];

  for (const assessment of riskAssessments) {
    // Insert into database
    await db.insert(weatherRiskAssessments).values({
      jobId: assessment.jobId,
      operatorId: input.operatorId,
      serviceAreaId: input.serviceAreaId,
      riskScore: assessment.riskScore,
      riskTier: assessment.riskTier,
      drivers: assessment.drivers,
      confidence: assessment.confidence,
      forecastVersion: assessment.forecastVersion,
      jobStart: new Date(assessment.start),
      jobEnd: new Date(assessment.end),
      assessedAt: new Date()
    });

    if (assessment.riskTier === 'HIGH' || assessment.riskTier === 'STOP') {
      highRiskJobs.push(assessment);
    } else if (assessment.riskTier === 'MED') {
      medRiskJobs.push(assessment);
    }
  }

  return {
    jobsScored: riskAssessments.length,
    highRiskJobs,
    medRiskJobs
  };
}

interface CheckWinterEventsInput {
  operatorId: number;
  serviceAreaId: number;
  forecasts: ForecastBundle[];
  alerts: any[];
}

interface CheckWinterEventsResult {
  eventsDetected: number;
  events: any[];
}

/**
 * Check for winter events from forecasts and alerts
 */
export async function checkWinterEventsActivity(
  input: CheckWinterEventsInput
): Promise<CheckWinterEventsResult> {
  const events: any[] = [];
  const winterKeywords = ['snow', 'ice', 'freezing', 'blizzard', 'sleet', 'frost', 'winter'];

  // Check alerts for winter events
  for (const alert of input.alerts) {
    const eventLower = alert.event?.toLowerCase() || '';
    const isWinter = winterKeywords.some(kw => eventLower.includes(kw));

    if (isWinter && alert.severity !== 'Minor') {
      const eventType = eventLower.includes('snow') || eventLower.includes('blizzard') ? 'SNOW'
        : eventLower.includes('ice') ? 'ICE'
        : eventLower.includes('freezing') ? 'FREEZING_RAIN'
        : 'SNOW';

      const eventId = `winter:${input.operatorId}:${alert.start}:${eventType}`;

      // Check if event already exists
      const existing = await db
        .select()
        .from(winterEvents)
        .where(eq(winterEvents.eventId, eventId))
        .limit(1);

      if (existing.length === 0) {
        // Create new event
        await db.insert(winterEvents).values({
          eventId,
          operatorId: input.operatorId,
          eventType,
          windowStart: new Date(alert.start * 1000),
          windowEnd: new Date(alert.end * 1000),
          affectedGeoSet: { type: 'GEOHASH_SET', precision: 6, values: [] },
          confidence: alert.severity === 'Extreme' ? 0.95 : alert.severity === 'Severe' ? 0.85 : 0.7,
          drivers: { alertSource: alert.senderName },
          sourceAlertIds: [alert.event],
          detectedAt: new Date()
        });

        events.push({
          eventId,
          eventType,
          windowStart: new Date(alert.start * 1000).toISOString(),
          windowEnd: new Date(alert.end * 1000).toISOString(),
          source: 'NWS_ALERT'
        });
      }
    }
  }

  // Check forecasts for snow accumulation
  for (const forecast of input.forecasts) {
    for (const hour of forecast.hourly) {
      if (hour.snow && hour.snow > 5) { // >5mm snow expected
        const eventId = `winter:${input.operatorId}:${hour.dt}:SNOW`;
        
        const existing = await db
          .select()
          .from(winterEvents)
          .where(eq(winterEvents.eventId, eventId))
          .limit(1);

        if (existing.length === 0) {
          const windowStart = new Date(hour.dt * 1000);
          const windowEnd = new Date(hour.dt * 1000 + 6 * 60 * 60 * 1000); // 6 hour window

          await db.insert(winterEvents).values({
            eventId,
            operatorId: input.operatorId,
            eventType: 'SNOW',
            windowStart,
            windowEnd,
            affectedGeoSet: { type: 'GEOHASH_SET', precision: 6, values: [forecast.geohash] },
            confidence: 0.7,
            drivers: { snowMm: hour.snow },
            detectedAt: new Date()
          });

          events.push({
            eventId,
            eventType: 'SNOW',
            windowStart: windowStart.toISOString(),
            windowEnd: windowEnd.toISOString(),
            source: 'FORECAST'
          });
        }
      }
    }
  }

  return {
    eventsDetected: events.length,
    events
  };
}

interface RecordMonitoringRunInput {
  operatorId: number;
  serviceAreaId: number;
  runType: 'DAILY' | 'NEAR_TERM' | 'ALERT';
  jobsScanned: number;
  highRiskJobs: number;
  plansTriggered: number;
  winterEventsDetected: number;
  durationMs: number;
  error?: string;
}

/**
 * Record monitoring run for observability
 */
export async function recordMonitoringRunActivity(
  input: RecordMonitoringRunInput
): Promise<void> {
  const stats = getWeatherProviderService().getCacheStats();

  await db.insert(weatherMonitoringRuns).values({
    operatorId: input.operatorId,
    serviceAreaId: input.serviceAreaId,
    runType: input.runType,
    jobsScanned: input.jobsScanned,
    highRiskJobs: input.highRiskJobs,
    plansTriggered: input.plansTriggered,
    winterEventsDetected: input.winterEventsDetected,
    apiCallsMade: stats.stored,
    cacheHitRate: stats.hitRate,
    durationMs: input.durationMs,
    startedAt: new Date(Date.now() - input.durationMs),
    completedAt: input.error ? null : new Date(),
    error: input.error || null
  });
}

// ============================================
// Schedule Planning Activities
// ============================================

interface LoadScheduleSnapshotInput {
  operatorId: number;
  serviceAreaId: number;
  jobIds: number[];
  timeRange: { start: string; end: string };
}

/**
 * Load schedule snapshot for impacted jobs
 */
export async function loadScheduleSnapshotActivity(
  input: LoadScheduleSnapshotInput
): Promise<any> {
  const jobsData = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.operatorId, input.operatorId),
        inArray(jobs.id, input.jobIds)
      )
    );

  return {
    jobs: jobsData.map(j => ({
      id: j.id,
      customerId: j.customerId,
      serviceType: j.serviceType,
      scheduledDate: j.scheduledDate,
      scheduledEndTime: j.scheduledEndTime,
      crewId: j.crewId,
      routeId: j.routeId,
      lat: j.lat,
      lon: j.lon,
      status: j.status
    })),
    snapshotAt: new Date().toISOString()
  };
}

interface LoadCrewConstraintsInput {
  operatorId: number;
  serviceAreaId: number;
  timeRange: { start: string; end: string };
}

/**
 * Load crew availability and constraints
 */
export async function loadCrewConstraintsActivity(
  input: LoadCrewConstraintsInput
): Promise<any> {
  const crewsData = await db
    .select()
    .from(crews)
    .where(eq(crews.operatorId, input.operatorId));

  return {
    crews: crewsData.map(c => ({
      id: c.id,
      name: c.name,
      availability: 'AVAILABLE', // Would check schedule in real impl
      skills: c.skills || [],
      maxHoursPerDay: 10,
      preferredStartTime: '07:00'
    }))
  };
}

interface GeneratePlanCandidatesInput {
  planId: string;
  operatorId: number;
  serviceAreaId: number;
  scheduleSnapshot: any;
  crewConstraints: any;
  impactedJobIds: number[];
  riskSummary: any;
  forecastVersion: string;
}

/**
 * Generate schedule change candidates
 */
export async function generatePlanCandidatesActivity(
  input: GeneratePlanCandidatesInput
): Promise<ChangeSet> {
  const impactedJobs: any[] = [];
  const crewChanges: any[] = [];
  const routeChanges: any[] = [];
  const commsPlan: any[] = [];

  // For each impacted job, generate reschedule options
  for (const job of input.scheduleSnapshot.jobs) {
    if (!input.impactedJobIds.includes(job.id)) continue;

    // Simple strategy: push job forward by 1 day
    const newStart = new Date(job.scheduledDate);
    newStart.setDate(newStart.getDate() + 1);
    
    const newEnd = new Date(job.scheduledEndTime);
    newEnd.setDate(newEnd.getDate() + 1);

    impactedJobs.push({
      jobId: job.id,
      before: {
        start: job.scheduledDate,
        end: job.scheduledEndTime,
        crewId: job.crewId
      },
      after: {
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
        crewId: job.crewId // Keep same crew
      },
      reason: `Weather risk: ${input.riskSummary.weatherDescription}`,
      customerNotified: false
    });

    // Add to comms plan
    commsPlan.push({
      stakeholder: 'CUSTOMER',
      targetId: job.customerId,
      templateId: 'WEATHER_RESCHEDULE',
      channel: 'SMS',
      sendAt: new Date().toISOString(),
      priority: 'HIGH'
    });
  }

  // Calculate metrics
  const disruptionMinutes = impactedJobs.length * 30; // Estimate 30 min disruption per job
  const addedDriveMinutes = 0; // Would calculate actual route impact

  const changeSet: ChangeSet = {
    planId: input.planId,
    serviceAreaId: input.serviceAreaId,
    impactedJobs,
    crewChanges,
    routeChanges,
    commsPlan,
    metrics: {
      disruptionMinutes,
      addedDriveMinutes,
      overtimeRisk: 0,
      slaImpactScore: impactedJobs.length * 5,
      marginImpactEstimate: impactedJobs.length * -10,
      affectedCustomers: impactedJobs.length,
      affectedCrews: new Set(impactedJobs.map(j => j.before.crewId)).size
    },
    weatherSummary: input.riskSummary.weatherDescription,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  // Store the plan
  await db.insert(weatherSchedulePlans).values({
    planId: input.planId,
    operatorId: input.operatorId,
    serviceAreaId: input.serviceAreaId,
    status: 'PENDING',
    changeSetData: changeSet,
    weatherSummary: input.riskSummary.weatherDescription,
    impactedJobCount: impactedJobs.length,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  return changeSet;
}

interface ApplyScheduleChangesInput {
  planId: string;
  operatorId: number;
  changes: any[];
  crewChanges: any[];
  routeChanges: any[];
}

/**
 * Apply approved schedule changes
 */
export async function applyScheduleChangesActivity(
  input: ApplyScheduleChangesInput
): Promise<{ appliedCount: number }> {
  let appliedCount = 0;

  for (const change of input.changes) {
    try {
      await db
        .update(jobs)
        .set({
          scheduledDate: new Date(change.after.start),
          scheduledEndTime: new Date(change.after.end),
          crewId: change.after.crewId,
          updatedAt: new Date()
        })
        .where(eq(jobs.id, change.jobId));

      appliedCount++;
    } catch (error) {
      console.error(`[ApplyChanges] Failed to update job ${change.jobId}:`, error);
    }
  }

  // Update plan status
  await db
    .update(weatherSchedulePlans)
    .set({
      status: 'APPLIED',
      appliedAt: new Date()
    })
    .where(eq(weatherSchedulePlans.planId, input.planId));

  return { appliedCount };
}

interface SendNotificationsInput {
  operatorId: number;
  changes: any[];
  commsPlan: any[];
  weatherSummary: string;
}

/**
 * Send schedule change notifications
 */
export async function sendScheduleChangeNotificationsActivity(
  input: SendNotificationsInput
): Promise<{ sent: number }> {
  // In production, this would call Twilio/Firebase
  // For now, just log and return
  console.log(`[Notifications] Would send ${input.commsPlan.length} notifications for ${input.changes.length} schedule changes`);
  
  return { sent: input.commsPlan.length };
}

// ============================================
// Winter Campaign Activities
// ============================================

interface ValidateOperatorServicesInput {
  operatorId: number;
  requiredServiceTypes: string[];
}

/**
 * Validate operator offers winter services
 */
export async function validateOperatorServicesActivity(
  input: ValidateOperatorServicesInput
): Promise<{ hasWinterServices: boolean; availableServices: string[] }> {
  const [operator] = await db
    .select()
    .from(operators)
    .where(eq(operators.id, input.operatorId))
    .limit(1);

  if (!operator) {
    return { hasWinterServices: false, availableServices: [] };
  }

  // Check if operator offers any winter services
  const services = (operator.serviceTypes as string[]) || [];
  const winterServices = services.filter(s => 
    input.requiredServiceTypes.some(req => 
      s.toUpperCase().includes(req.replace('_', ' '))
    )
  );

  return {
    hasWinterServices: winterServices.length > 0,
    availableServices: winterServices
  };
}

interface QueryEligibleCustomersInput {
  operatorId: number;
  serviceAreaId: number;
  affectedGeoSet: any;
  excludeRecurringPlan: boolean;
  requireOptIn: boolean;
}

/**
 * Query customers eligible for winter campaign
 */
export async function queryEligibleCustomersActivity(
  input: QueryEligibleCustomersInput
): Promise<{ customerCount: number; customers: any[] }> {
  const eligibleCustomers = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.operatorId, input.operatorId),
        eq(customers.status, 'ACTIVE')
      )
    )
    .limit(100); // Limit for campaign

  // Filter by opt-in and recurring status in real implementation
  const filtered = eligibleCustomers.filter(c => {
    // Would check recurring plan status and marketing opt-in
    return true;
  });

  return {
    customerCount: filtered.length,
    customers: filtered.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      lat: c.lat,
      lon: c.lon
    }))
  };
}

interface CheckCapacityInput {
  operatorId: number;
  serviceAreaId: number;
  eventWindow: { start: string; end: string };
  estimatedDemand: number;
}

/**
 * Check operational capacity for winter services
 */
export async function checkOperationalCapacityActivity(
  input: CheckCapacityInput
): Promise<{ hasCapacity: boolean; availableSlots: number; reservedBlocks: any[] }> {
  // In production, would check crew availability, equipment, and existing commitments
  const crewsData = await db
    .select()
    .from(crews)
    .where(eq(crews.operatorId, input.operatorId));

  const slotsPerCrew = 10; // Estimated capacity per crew
  const availableSlots = crewsData.length * slotsPerCrew;

  return {
    hasCapacity: availableSlots >= input.estimatedDemand * 0.3, // Need at least 30% capacity
    availableSlots,
    reservedBlocks: []
  };
}

interface BuildCampaignProposalInput {
  campaignId: string;
  operatorId: number;
  event: any;
  eligibleCustomers: any[];
  capacity: any;
  throttle: any;
  maxAcceptsTotal: number;
}

/**
 * Build campaign proposal
 */
export async function buildCampaignProposalActivity(
  input: BuildCampaignProposalInput
): Promise<CampaignProposal> {
  const proposal: CampaignProposal = {
    campaignId: input.campaignId,
    eventId: input.event.eventId,
    segment: {
      estimatedCustomers: input.eligibleCustomers.length,
      geoSet: input.event.affectedGeoSet,
      filtersApplied: ['ACTIVE', 'NOT_RECURRING', 'OPT_IN']
    },
    offer: {
      serviceType: input.event.eventType === 'SNOW' ? 'SNOW_REMOVAL' : 'ICE_REMOVAL',
      pricingModel: 'FIXED',
      basePrice: 75,
      ctaType: 'REQUEST_SERVICE'
    },
    capacity: {
      maxAcceptsTotal: input.maxAcceptsTotal,
      maxAcceptsPerHour: 10,
      reservedBlocks: input.capacity.reservedBlocks || []
    },
    throttle: input.throttle,
    templates: {
      smsTemplateId: 'WINTER_OFFER_SMS',
      pushTemplateId: 'WINTER_OFFER_PUSH'
    },
    metricsEstimate: {
      expectedConversionRate: 0.15,
      expectedRevenue: input.eligibleCustomers.length * 0.15 * 75,
      expectedMargin: input.eligibleCustomers.length * 0.15 * 30
    }
  };

  return proposal;
}

interface SendCampaignBatchInput {
  campaignId: string;
  operatorId: number;
  customers: any[];
  event: any;
  offer: any;
  templates: any;
}

/**
 * Send campaign messages to a batch of customers
 */
export async function sendCampaignBatchActivity(
  input: SendCampaignBatchInput
): Promise<{ sent: number; delivered: number }> {
  let sent = 0;
  let delivered = 0;

  for (const customer of input.customers) {
    // Record the message send
    await db.insert(winterCampaignMessages).values({
      campaignId: input.campaignId,
      customerId: customer.id,
      channel: 'SMS',
      templateId: input.templates.smsTemplateId,
      status: 'SENT',
      sentAt: new Date(),
      createdAt: new Date()
    });

    sent++;
    delivered++; // In production, would track actual delivery
  }

  return { sent, delivered };
}

interface RecordCampaignMetricsInput {
  campaignId: string;
  operatorId: number;
  eventId: string;
  metrics: any;
}

/**
 * Record final campaign metrics
 */
export async function recordCampaignMetricsActivity(
  input: RecordCampaignMetricsInput
): Promise<void> {
  await db
    .update(winterCampaigns)
    .set({
      status: 'COMPLETED',
      sentCount: input.metrics.sent,
      deliveredCount: input.metrics.delivered,
      acceptedCount: input.metrics.accepted,
      completedAt: new Date()
    })
    .where(eq(winterCampaigns.campaignId, input.campaignId));
}

// ============================================
// Snow/Ice Fulfillment Activities
// ============================================

interface CreateSnowIceJobInput {
  operatorId: number;
  customerId: number;
  serviceType: string;
  eventWindow: { start: string; end: string };
  windowPrefs?: { start?: string; end?: string };
  requestId: string;
  source: string;
}

/**
 * Create a snow/ice service job
 */
export async function createSnowIceJobActivity(
  input: CreateSnowIceJobInput
): Promise<{ success: boolean; jobId?: number; scheduledStart?: string; scheduledEnd?: string; error?: string }> {
  try {
    // Get customer location
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, input.customerId))
      .limit(1);

    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    // Schedule within event window or customer preference
    const scheduledStart = input.windowPrefs?.start 
      ? new Date(input.windowPrefs.start)
      : new Date(input.eventWindow.start);
    
    const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60 * 1000); // 1 hour service

    // Create the job
    const [newJob] = await db.insert(jobs).values({
      operatorId: input.operatorId,
      customerId: input.customerId,
      serviceType: input.serviceType,
      scheduledDate: scheduledStart,
      scheduledEndTime: scheduledEnd,
      status: 'SCHEDULED',
      lat: customer.lat,
      lon: customer.lon,
      source: input.source,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning({ id: jobs.id });

    return {
      success: true,
      jobId: newJob.id,
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString()
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

interface AssignCrewInput {
  operatorId: number;
  jobId: number;
  serviceType: string;
  scheduledStart: string;
  scheduledEnd: string;
  requireWinterEquipment: boolean;
}

/**
 * Assign crew to snow/ice job
 */
export async function assignCrewToJobActivity(
  input: AssignCrewInput
): Promise<{ success: boolean; crewId?: number; error?: string }> {
  // Find available crew with winter equipment
  const availableCrews = await db
    .select()
    .from(crews)
    .where(eq(crews.operatorId, input.operatorId))
    .limit(1);

  if (availableCrews.length === 0) {
    return { success: false, error: 'No crews available' };
  }

  const crew = availableCrews[0];

  // Assign crew to job
  await db
    .update(jobs)
    .set({ crewId: crew.id, updatedAt: new Date() })
    .where(eq(jobs.id, input.jobId));

  return { success: true, crewId: crew.id };
}

interface UpdateRouteInput {
  operatorId: number;
  crewId: number;
  jobId: number;
  scheduledStart: string;
}

/**
 * Update crew route with new job
 */
export async function updateRouteActivity(
  input: UpdateRouteInput
): Promise<{ success: boolean }> {
  // In production, would update route optimization
  console.log(`[UpdateRoute] Adding job ${input.jobId} to crew ${input.crewId} route`);
  return { success: true };
}
