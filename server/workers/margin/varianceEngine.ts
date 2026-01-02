/**
 * Variance Computation Engine
 * 
 * Compares actual job progress against expected baselines and computes variance.
 */

import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { jobSnapshots, marginAlerts, type JobSnapshot, type MarginAlertAction } from "@shared/schema";
import { expected_duration, getRiskLevel, VARIANCE_THRESHOLDS } from "./durationModel";

export interface VarianceResult {
  snapshotId: number;
  jobberJobId: string;
  
  // Duration variance
  expectedDurationMins: number;
  actualDurationMins: number;
  durationVariancePercent: number;
  durationRisk: 'normal' | 'low' | 'medium' | 'high';
  
  // Visit variance
  expectedVisits: number;
  actualVisits: number;
  visitVariance: number;
  visitRisk: 'normal' | 'low' | 'medium' | 'high';
  
  // Margin risk (composite)
  marginRisk: 'normal' | 'medium' | 'high';
  
  // Alert needed?
  alertNeeded: boolean;
  alertType?: 'duration_overrun' | 'margin_risk' | 'visit_overrun';
  alertSeverity?: 'low' | 'medium' | 'high';
  
  // Recommended actions
  recommendedActions: MarginAlertAction[];
}

/**
 * Compute variance for a job snapshot
 */
export function computeVariance(snapshot: JobSnapshot): VarianceResult {
  const expectedDurationMins = snapshot.expectedDurationMins;
  const actualDurationMins = snapshot.actualDurationMins || 0;
  const expectedVisits = snapshot.expectedVisits || 1;
  const actualVisits = snapshot.visitsCompleted || 0;
  
  // Duration variance (positive = over, negative = under)
  const durationVariancePercent = expectedDurationMins > 0
    ? Math.round(((actualDurationMins - expectedDurationMins) / expectedDurationMins) * 100)
    : 0;
  
  const durationRisk = getRiskLevel('duration', Math.max(0, durationVariancePercent));
  
  // Visit variance
  const visitVariance = actualVisits - expectedVisits;
  const visitRisk = getRiskLevel('visits', Math.max(0, visitVariance));
  
  // Composite margin risk (highest of duration and visit risk)
  const riskOrder: Record<string, number> = { normal: 0, low: 1, medium: 2, high: 3 };
  const highestRisk = riskOrder[durationRisk] > riskOrder[visitRisk] ? durationRisk : visitRisk;
  const marginRisk = highestRisk === 'low' ? 'normal' : (highestRisk as 'normal' | 'medium' | 'high');
  
  // Determine if alert is needed
  let alertNeeded = false;
  let alertType: 'duration_overrun' | 'margin_risk' | 'visit_overrun' | undefined;
  let alertSeverity: 'low' | 'medium' | 'high' | undefined;
  
  if (durationRisk === 'high' || visitRisk === 'high') {
    alertNeeded = true;
    alertSeverity = 'high';
    alertType = durationRisk === 'high' ? 'duration_overrun' : 'visit_overrun';
  } else if (durationRisk === 'medium' || visitRisk === 'medium') {
    alertNeeded = true;
    alertSeverity = 'medium';
    alertType = durationRisk === 'medium' ? 'duration_overrun' : 'visit_overrun';
  }
  
  // Generate recommended actions
  const recommendedActions = generateRecommendedActions(
    durationVariancePercent,
    visitVariance,
    marginRisk,
    snapshot.serviceType
  );
  
  return {
    snapshotId: snapshot.id,
    jobberJobId: snapshot.jobberJobId,
    expectedDurationMins,
    actualDurationMins,
    durationVariancePercent,
    durationRisk,
    expectedVisits,
    actualVisits,
    visitVariance,
    visitRisk,
    marginRisk,
    alertNeeded,
    alertType,
    alertSeverity,
    recommendedActions,
  };
}

/**
 * Generate recommended actions based on variance
 */
function generateRecommendedActions(
  durationVariance: number,
  visitVariance: number,
  marginRisk: string,
  serviceType: string
): MarginAlertAction[] {
  const actions: MarginAlertAction[] = [];
  
  // Duration overrun actions
  if (durationVariance >= VARIANCE_THRESHOLDS.duration.high) {
    actions.push({
      action: "review_scope",
      description: `Job is ${durationVariance}% over estimated time. Review if scope changed or was underestimated.`,
      priority: "high",
    });
    actions.push({
      action: "update_estimate",
      description: `Consider updating future ${serviceType} job estimates to account for actual time.`,
      priority: "medium",
    });
  } else if (durationVariance >= VARIANCE_THRESHOLDS.duration.medium) {
    actions.push({
      action: "monitor_progress",
      description: `Job is ${durationVariance}% over time. Monitor completion and consider scope review.`,
      priority: "medium",
    });
  }
  
  // Visit overrun actions
  if (visitVariance >= VARIANCE_THRESHOLDS.visits.high) {
    actions.push({
      action: "review_recurring",
      description: `Job required ${visitVariance} more visits than expected. Review if recurring schedule needs adjustment.`,
      priority: "high",
    });
    actions.push({
      action: "discuss_with_client",
      description: "Consider discussing additional visits with client for future billing adjustments.",
      priority: "medium",
    });
  } else if (visitVariance >= VARIANCE_THRESHOLDS.visits.medium) {
    actions.push({
      action: "track_pattern",
      description: `${visitVariance} extra visits logged. Track if this becomes a pattern for this property.`,
      priority: "low",
    });
  }
  
  // High margin risk composite actions
  if (marginRisk === 'high') {
    actions.push({
      action: "flag_for_review",
      description: "High margin risk detected. Flag job for profitability review before next billing cycle.",
      priority: "high",
    });
    actions.push({
      action: "no_auto_pricing",
      description: "MVP safety: No automatic pricing changes. Manual review required.",
      priority: "high",
    });
  }
  
  return actions;
}

/**
 * Update snapshot with computed variance and return result
 */
export async function updateSnapshotVariance(
  snapshotId: number,
  actualDurationMins: number,
  visitsCompleted: number,
  timeLoggedMins: number
): Promise<VarianceResult | null> {
  // Get existing snapshot
  const [snapshot] = await db
    .select()
    .from(jobSnapshots)
    .where(eq(jobSnapshots.id, snapshotId))
    .limit(1);
  
  if (!snapshot) {
    console.warn(`[MarginWorker] Snapshot ${snapshotId} not found`);
    return null;
  }
  
  // Update with new values
  const updatedSnapshot: JobSnapshot = {
    ...snapshot,
    actualDurationMins,
    visitsCompleted,
    timeLoggedMins,
  };
  
  // Compute variance
  const variance = computeVariance(updatedSnapshot);
  
  // Update snapshot in DB
  await db
    .update(jobSnapshots)
    .set({
      actualDurationMins,
      visitsCompleted,
      timeLoggedMins,
      durationVariancePercent: variance.durationVariancePercent,
      marginRisk: variance.marginRisk,
      lastVarianceCheck: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobSnapshots.id, snapshotId));
  
  return variance;
}

/**
 * Create or update job snapshot from Jobber job data
 */
export async function upsertJobSnapshot(
  jobberAccountId: string,
  jobberJobId: string,
  jobData: {
    businessId?: number;
    quoteId?: string;
    serviceType: string;
    lotSizeSqft?: number;
    crewSize?: number;
    baselineRevenue?: number;
    baselineCost?: number;
    expectedVisits?: number;
  }
): Promise<JobSnapshot> {
  // Calculate expected duration
  const durationResult = expected_duration({
    jobType: jobData.serviceType,
    lotSizeSqft: jobData.lotSizeSqft,
    crewSize: jobData.crewSize,
  });
  
  // Calculate baseline margin
  let baselineMarginPercent = null;
  if (jobData.baselineRevenue && jobData.baselineCost && jobData.baselineRevenue > 0) {
    baselineMarginPercent = Math.round(
      ((jobData.baselineRevenue - jobData.baselineCost) / jobData.baselineRevenue) * 100
    );
  }
  
  // Check for existing snapshot
  const [existing] = await db
    .select()
    .from(jobSnapshots)
    .where(and(
      eq(jobSnapshots.jobberAccountId, jobberAccountId),
      eq(jobSnapshots.jobberJobId, jobberJobId)
    ))
    .limit(1);
  
  if (existing) {
    // Update existing (don't overwrite progress data)
    await db
      .update(jobSnapshots)
      .set({
        serviceType: jobData.serviceType,
        lotSizeSqft: jobData.lotSizeSqft || existing.lotSizeSqft,
        crewSize: jobData.crewSize || existing.crewSize,
        expectedDurationMins: durationResult.expectedDurationMins,
        expectedVisits: jobData.expectedVisits || existing.expectedVisits,
        baselineRevenue: jobData.baselineRevenue ?? existing.baselineRevenue,
        baselineCost: jobData.baselineCost ?? existing.baselineCost,
        baselineMarginPercent: baselineMarginPercent ?? existing.baselineMarginPercent,
        updatedAt: new Date(),
      })
      .where(eq(jobSnapshots.id, existing.id));
    
    const [updated] = await db
      .select()
      .from(jobSnapshots)
      .where(eq(jobSnapshots.id, existing.id))
      .limit(1);
    
    return updated;
  }
  
  // Create new snapshot
  const [created] = await db
    .insert(jobSnapshots)
    .values({
      businessId: jobData.businessId,
      jobberAccountId,
      jobberJobId,
      jobberQuoteId: jobData.quoteId,
      serviceType: jobData.serviceType,
      lotSizeSqft: jobData.lotSizeSqft,
      crewSize: jobData.crewSize || 1,
      expectedDurationMins: durationResult.expectedDurationMins,
      expectedVisits: jobData.expectedVisits || 1,
      baselineRevenue: jobData.baselineRevenue,
      baselineCost: jobData.baselineCost,
      baselineMarginPercent,
    })
    .returning();
  
  console.log(`[MarginWorker] Created snapshot for job ${jobberJobId}: ${durationResult.expectedDurationMins}min expected`);
  
  return created;
}

/**
 * Get snapshot by Jobber job ID
 */
export async function getSnapshotByJobberId(
  jobberAccountId: string,
  jobberJobId: string
): Promise<JobSnapshot | null> {
  const [snapshot] = await db
    .select()
    .from(jobSnapshots)
    .where(and(
      eq(jobSnapshots.jobberAccountId, jobberAccountId),
      eq(jobSnapshots.jobberJobId, jobberJobId)
    ))
    .limit(1);
  
  return snapshot || null;
}
