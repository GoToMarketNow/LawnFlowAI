/**
 * Margin & Variance Worker
 * 
 * Processes JOB_* and VISIT_* webhook events to track job profitability.
 * Computes variance against baselines and creates alerts when thresholds exceeded.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db";
import { jobSnapshots, marginAlerts, type MarginAlertAction } from "@shared/schema";
import { JobberClient } from "../../connectors/jobber-client";
import { computeVariance, upsertJobSnapshot, getSnapshotByJobberId, updateSnapshotVariance, type VarianceResult } from "./varianceEngine";

// Event types handled by this worker
export const MARGIN_EVENT_TOPICS = [
  "JOB_CREATED",
  "JOB_UPDATED",
  "JOB_COMPLETED",
  "VISIT_CREATED",
  "VISIT_UPDATED",
  "VISIT_COMPLETED",
  "VISIT_APPROVED",  // Time entries approved
];

export interface MarginEventPayload {
  accountId: string;
  objectId: string;  // Job ID or Visit ID depending on event type
  topic: string;
  occurredAt: string;
  data?: {
    jobId?: string;
    visitId?: string;
    duration?: number;
    timeLoggedMins?: number;
  };
}

/**
 * Process a margin-related webhook event
 */
export async function processMarginEvent(
  accountId: string,
  payload: MarginEventPayload
): Promise<{ processed: boolean; snapshotId?: number; alert?: boolean }> {
  const topic = payload.topic.toUpperCase();
  
  console.log(`[MarginWorker] Processing ${topic} for account ${accountId}`);
  
  try {
    if (topic.startsWith("JOB_")) {
      return await handleJobEvent(accountId, payload);
    } else if (topic.startsWith("VISIT_")) {
      return await handleVisitEvent(accountId, payload);
    }
    
    return { processed: false };
  } catch (error) {
    console.error(`[MarginWorker] Error processing ${topic}:`, error);
    return { processed: false };
  }
}

/**
 * Handle JOB_* events
 */
async function handleJobEvent(
  accountId: string,
  payload: MarginEventPayload
): Promise<{ processed: boolean; snapshotId?: number; alert?: boolean }> {
  const jobId = payload.objectId;
  const topic = payload.topic.toUpperCase();
  
  // Fetch job details from Jobber
  const client = new JobberClient(accountId);
  let jobData;
  
  try {
    const result = await client.getJob(jobId);
    jobData = result.job;
  } catch (error) {
    console.error(`[MarginWorker] Failed to fetch job ${jobId}:`, error);
    return { processed: false };
  }
  
  if (!jobData) {
    console.warn(`[MarginWorker] Job ${jobId} not found`);
    return { processed: false };
  }
  
  // Extract job details with safe defaults
  const serviceType = extractServiceType(jobData);
  const crewSize = (jobData.assignedUsers?.nodes?.length || 1);
  
  // Get baseline from quote if available
  let baselineRevenue = 0;
  if (jobData.amounts?.total) {
    baselineRevenue = parseJobberAmount(jobData.amounts.total);
  }
  
  // Estimate cost (simple 60% of revenue for MVP)
  const baselineCost = Math.round(baselineRevenue * 0.6);
  
  // Get lot size from property (if enriched)
  let lotSizeSqft: number | undefined;
  if (jobData.property?.customFields?.nodes) {
    const lotSizeField = jobData.property.customFields.nodes.find(
      (f: any) => f.label?.toLowerCase().includes('lot') && f.label?.toLowerCase().includes('size')
    );
    if (lotSizeField?.value) {
      lotSizeSqft = parseInt(lotSizeField.value, 10) || undefined;
    }
  }
  
  // Create or update snapshot
  const snapshot = await upsertJobSnapshot(accountId, jobId, {
    serviceType,
    crewSize,
    lotSizeSqft,
    baselineRevenue,
    baselineCost,
    quoteId: jobData.quote?.id,
  });
  
  // For JOB_COMPLETED, run full variance check
  if (topic === "JOB_COMPLETED") {
    const variance = computeVariance(snapshot);
    
    if (variance.alertNeeded) {
      await createMarginAlert(snapshot, variance);
      await syncMarginRiskToJobber(client, jobId, variance.marginRisk);
      return { processed: true, snapshotId: snapshot.id, alert: true };
    }
  }
  
  return { processed: true, snapshotId: snapshot.id };
}

/**
 * Handle VISIT_* events
 */
async function handleVisitEvent(
  accountId: string,
  payload: MarginEventPayload
): Promise<{ processed: boolean; snapshotId?: number; alert?: boolean }> {
  const visitId = payload.objectId;
  const topic = payload.topic.toUpperCase();
  
  // Fetch visit details from Jobber
  const client = new JobberClient(accountId);
  let visitData;
  
  try {
    const result = await client.getVisit(visitId);
    visitData = result.visit;
  } catch (error) {
    console.error(`[MarginWorker] Failed to fetch visit ${visitId}:`, error);
    return { processed: false };
  }
  
  if (!visitData || !visitData.job?.id) {
    console.warn(`[MarginWorker] Visit ${visitId} not found or has no job`);
    return { processed: false };
  }
  
  const jobId = visitData.job.id;
  
  // Get existing snapshot
  let snapshot = await getSnapshotByJobberId(accountId, jobId);
  
  if (!snapshot) {
    // Create snapshot from visit's job
    const jobResult = await client.getJob(jobId);
    if (!jobResult.job) {
      return { processed: false };
    }
    
    const serviceType = extractServiceType(jobResult.job);
    const crewSize = (jobResult.job.assignedUsers?.nodes?.length || 1);
    let baselineRevenue = 0;
    if (jobResult.job.amounts?.total) {
      baselineRevenue = parseJobberAmount(jobResult.job.amounts.total);
    }
    
    snapshot = await upsertJobSnapshot(accountId, jobId, {
      serviceType,
      crewSize,
      baselineRevenue,
      baselineCost: Math.round(baselineRevenue * 0.6),
    });
  }
  
  // Update progress metrics
  const visitDuration = visitData.duration || 0;  // minutes
  const currentActualDuration = (snapshot.actualDurationMins || 0) + visitDuration;
  const currentVisitsCompleted = (snapshot.visitsCompleted || 0) + (topic.includes("COMPLETED") ? 1 : 0);
  
  // Get time logged from visit entries if available
  let timeLoggedMins = snapshot.timeLoggedMins || 0;
  if (visitData.timeEntries?.nodes) {
    const visitTimeLogged = visitData.timeEntries.nodes.reduce(
      (sum: number, entry: any) => sum + (entry.duration || 0),
      0
    );
    timeLoggedMins += visitTimeLogged;
  }
  
  // Update snapshot and compute variance
  const variance = await updateSnapshotVariance(
    snapshot.id,
    currentActualDuration,
    currentVisitsCompleted,
    timeLoggedMins
  );
  
  if (!variance) {
    return { processed: false };
  }
  
  // Check if alert needed
  if (variance.alertNeeded) {
    // Check for duplicate alert in last 24 hours
    const existingAlert = await findRecentAlert(snapshot.id, variance.alertType!);
    
    if (!existingAlert) {
      await createMarginAlert(snapshot, variance);
      await syncMarginRiskToJobber(client, jobId, variance.marginRisk);
      return { processed: true, snapshotId: snapshot.id, alert: true };
    }
  }
  
  return { processed: true, snapshotId: snapshot.id };
}

/**
 * Extract service type from job data
 */
function extractServiceType(jobData: any): string {
  // Try job type first
  if (jobData.jobType?.name) {
    return jobData.jobType.name;
  }
  
  // Try title
  if (jobData.title) {
    return jobData.title;
  }
  
  // Try first line item
  if (jobData.lineItems?.nodes?.[0]?.name) {
    return jobData.lineItems.nodes[0].name;
  }
  
  return "general";
}

/**
 * Parse Jobber amount (handles currency object or number)
 */
function parseJobberAmount(amount: any): number {
  if (typeof amount === 'number') {
    return Math.round(amount * 100);  // Convert to cents
  }
  if (typeof amount === 'object' && amount !== null) {
    if (amount.value !== undefined) {
      return Math.round(parseFloat(amount.value) * 100);
    }
    if (amount.raw !== undefined) {
      return Math.round(parseFloat(amount.raw) * 100);
    }
  }
  if (typeof amount === 'string') {
    return Math.round(parseFloat(amount.replace(/[^0-9.-]/g, '')) * 100);
  }
  return 0;
}

/**
 * Find recent alert to avoid duplicates
 */
async function findRecentAlert(
  snapshotId: number,
  alertType: string
): Promise<boolean> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const [existing] = await db
    .select()
    .from(marginAlerts)
    .where(and(
      eq(marginAlerts.snapshotId, snapshotId),
      eq(marginAlerts.alertType, alertType),
      eq(marginAlerts.status, "open")
    ))
    .limit(1);
  
  return !!existing;
}

/**
 * Create margin alert in database
 */
async function createMarginAlert(
  snapshot: typeof jobSnapshots.$inferSelect,
  variance: VarianceResult
): Promise<void> {
  const title = generateAlertTitle(variance);
  const description = generateAlertDescription(snapshot, variance);
  
  await db.insert(marginAlerts).values({
    businessId: snapshot.businessId,
    snapshotId: snapshot.id,
    jobberJobId: snapshot.jobberJobId,
    alertType: variance.alertType!,
    severity: variance.alertSeverity!,
    title,
    description,
    expectedValue: variance.expectedDurationMins,
    actualValue: variance.actualDurationMins,
    variancePercent: variance.durationVariancePercent,
    recommendedActions: variance.recommendedActions,
  });
  
  console.log(`[MarginWorker] Created ${variance.alertSeverity} alert for job ${snapshot.jobberJobId}: ${title}`);
}

/**
 * Generate alert title
 */
function generateAlertTitle(variance: VarianceResult): string {
  if (variance.alertType === 'duration_overrun') {
    return `Job ${variance.durationVariancePercent}% over estimated time`;
  }
  if (variance.alertType === 'visit_overrun') {
    return `Job required ${variance.visitVariance} extra visit${variance.visitVariance > 1 ? 's' : ''}`;
  }
  return `Margin risk: ${variance.marginRisk.toUpperCase()}`;
}

/**
 * Generate alert description
 */
function generateAlertDescription(
  snapshot: typeof jobSnapshots.$inferSelect,
  variance: VarianceResult
): string {
  const parts: string[] = [];
  
  parts.push(`Service: ${snapshot.serviceType}`);
  parts.push(`Expected: ${variance.expectedDurationMins} mins, Actual: ${variance.actualDurationMins} mins`);
  
  if (variance.visitVariance > 0) {
    parts.push(`Visits: ${variance.actualVisits} of ${variance.expectedVisits} expected`);
  }
  
  if (snapshot.baselineRevenue) {
    parts.push(`Baseline revenue: $${(snapshot.baselineRevenue / 100).toFixed(2)}`);
  }
  
  return parts.join(". ");
}

/**
 * Sync margin risk to Jobber custom field
 */
async function syncMarginRiskToJobber(
  client: JobberClient,
  jobId: string,
  marginRisk: string
): Promise<void> {
  try {
    // Only sync if risk is elevated (medium or high)
    if (marginRisk === 'normal') {
      return;
    }
    
    await client.setJobCustomField(
      jobId,
      "MARGIN_RISK",
      marginRisk.toUpperCase()
    );
    
    // Update snapshot sync status
    await db
      .update(jobSnapshots)
      .set({
        jobberSynced: true,
        jobberSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobSnapshots.jobberJobId, jobId));
    
    console.log(`[MarginWorker] Synced MARGIN_RISK=${marginRisk.toUpperCase()} to Jobber for job ${jobId}`);
  } catch (error) {
    console.error(`[MarginWorker] Failed to sync margin risk to Jobber:`, error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Get open alerts for a business
 */
export async function getOpenAlerts(businessId: number): Promise<Array<typeof marginAlerts.$inferSelect>> {
  return db
    .select()
    .from(marginAlerts)
    .where(and(
      eq(marginAlerts.businessId, businessId),
      eq(marginAlerts.status, "open")
    ))
    .orderBy(desc(marginAlerts.createdAt));
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  alertId: number,
  acknowledgedBy: string
): Promise<void> {
  await db
    .update(marginAlerts)
    .set({
      status: "acknowledged",
      acknowledgedBy,
      acknowledgedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(marginAlerts.id, alertId));
}

/**
 * Resolve an alert
 */
export async function resolveAlert(
  alertId: number,
  resolvedBy: string,
  resolution: string
): Promise<void> {
  await db
    .update(marginAlerts)
    .set({
      status: "resolved",
      resolvedBy,
      resolvedAt: new Date(),
      resolution,
      updatedAt: new Date(),
    })
    .where(eq(marginAlerts.id, alertId));
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(alertId: number): Promise<void> {
  await db
    .update(marginAlerts)
    .set({
      status: "dismissed",
      updatedAt: new Date(),
    })
    .where(eq(marginAlerts.id, alertId));
}
