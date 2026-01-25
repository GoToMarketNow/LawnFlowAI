// ============================================
// Schedule Impact Planning Workflow
// Generates schedule change proposals and waits for approval
// ============================================

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  workflowInfo,
  sleep
} from '@temporalio/workflow';
import type * as activities from '../activities/weather';
import type * as humanActivities from '../activities/humanTasks';

// Proxy activities
const {
  loadScheduleSnapshotActivity,
  loadCrewConstraintsActivity,
  generatePlanCandidatesActivity,
  applyScheduleChangesActivity,
  sendScheduleChangeNotificationsActivity
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '5s',
    maximumAttempts: 3,
    backoffCoefficient: 2
  }
});

const {
  createHumanTaskActivity,
  resolveHumanTaskActivity
} = proxyActivities<typeof humanActivities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '1s',
    maximumAttempts: 3
  }
});

// Workflow input
export interface ScheduleImpactPlanningInput {
  operatorId: number;
  serviceAreaId: number;
  timeRange: {
    start: string; // ISO datetime
    end: string;
  };
  impactedJobIds: number[];
  riskSummary: {
    highRiskCount: number;
    weatherDescription: string;
    primaryDrivers: string[];
  };
  forecastVersion: string;
  config?: {
    approvalTimeoutHours?: number;
    autoApproveIfLowImpact?: boolean;
    lowImpactThreshold?: number; // Max disruption minutes for auto-approve
  };
}

// Workflow state
interface PlanningState {
  status: 'GENERATING' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'APPLYING' | 'COMPLETED';
  planId: string | null;
  changeSet: any | null;
  approvalPacketId: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  appliedAt: string | null;
  error: string | null;
}

// Signals
export const approvalSignal = defineSignal<[{
  decision: 'APPROVE' | 'REJECT' | 'PARTIAL';
  approvedBy: number;
  selectedChanges?: number[]; // Job IDs to apply (for partial)
  rejectionReason?: string;
}]>('approval');

export const cancelSignal = defineSignal('cancel');

// Queries
export const getStatusQuery = defineQuery<PlanningState>('getStatus');
export const getChangeSetQuery = defineQuery<any>('getChangeSet');

/**
 * Schedule Impact Planning Workflow
 * 
 * Generates a schedule change plan in response to weather risk and waits
 * for operator approval before applying changes.
 * 
 * Flow:
 * 1. Load schedule snapshot
 * 2. Load crew constraints
 * 3. Generate candidate adjustments
 * 4. Create approval packet
 * 5. Wait for approval signal
 * 6. Apply approved changes
 * 7. Send notifications
 */
export async function ScheduleImpactPlanningWorkflow(
  input: ScheduleImpactPlanningInput
): Promise<{ status: string; planId: string | null; appliedChanges: number }> {
  const config = {
    approvalTimeoutHours: input.config?.approvalTimeoutHours ?? 24,
    autoApproveIfLowImpact: input.config?.autoApproveIfLowImpact ?? false,
    lowImpactThreshold: input.config?.lowImpactThreshold ?? 60 // 60 minutes
  };

  // Generate plan ID
  const planId = generatePlanId(input);

  // Initialize state
  const state: PlanningState = {
    status: 'GENERATING',
    planId,
    changeSet: null,
    approvalPacketId: null,
    approvedBy: null,
    approvedAt: null,
    appliedAt: null,
    error: null
  };

  // Approval decision holder
  let approvalDecision: {
    decision: 'APPROVE' | 'REJECT' | 'PARTIAL';
    approvedBy: number;
    selectedChanges?: number[];
    rejectionReason?: string;
  } | null = null;

  let isCancelled = false;

  // Set up signal handlers
  setHandler(approvalSignal, (decision) => {
    approvalDecision = decision;
  });

  setHandler(cancelSignal, () => {
    isCancelled = true;
  });

  // Set up query handlers
  setHandler(getStatusQuery, () => state);
  setHandler(getChangeSetQuery, () => state.changeSet);

  try {
    // Step 1: Load schedule snapshot
    console.log(`[SchedulePlanning] Loading schedule for ${input.impactedJobIds.length} impacted jobs`);
    const scheduleSnapshot = await loadScheduleSnapshotActivity({
      operatorId: input.operatorId,
      serviceAreaId: input.serviceAreaId,
      jobIds: input.impactedJobIds,
      timeRange: input.timeRange
    });

    if (isCancelled) {
      state.status = 'REJECTED';
      state.error = 'Cancelled by user';
      return { status: 'CANCELLED', planId, appliedChanges: 0 };
    }

    // Step 2: Load crew constraints
    console.log(`[SchedulePlanning] Loading crew constraints`);
    const crewConstraints = await loadCrewConstraintsActivity({
      operatorId: input.operatorId,
      serviceAreaId: input.serviceAreaId,
      timeRange: input.timeRange
    });

    if (isCancelled) {
      state.status = 'REJECTED';
      return { status: 'CANCELLED', planId, appliedChanges: 0 };
    }

    // Step 3: Generate candidate adjustments
    console.log(`[SchedulePlanning] Generating plan candidates`);
    const changeSet = await generatePlanCandidatesActivity({
      planId,
      operatorId: input.operatorId,
      serviceAreaId: input.serviceAreaId,
      scheduleSnapshot,
      crewConstraints,
      impactedJobIds: input.impactedJobIds,
      riskSummary: input.riskSummary,
      forecastVersion: input.forecastVersion
    });

    state.changeSet = changeSet;

    if (changeSet.impactedJobs.length === 0) {
      console.log(`[SchedulePlanning] No changes needed`);
      state.status = 'COMPLETED';
      return { status: 'NO_CHANGES_NEEDED', planId, appliedChanges: 0 };
    }

    // Check for auto-approve
    if (config.autoApproveIfLowImpact && 
        changeSet.metrics.disruptionMinutes <= config.lowImpactThreshold) {
      console.log(`[SchedulePlanning] Auto-approving low-impact plan`);
      approvalDecision = {
        decision: 'APPROVE',
        approvedBy: 0 // System
      };
    } else {
      // Step 4: Create approval packet
      console.log(`[SchedulePlanning] Creating approval packet`);
      state.status = 'PENDING_APPROVAL';

      const packetId = await createHumanTaskActivity({
        type: 'WEATHER_SCHEDULE_APPROVAL',
        title: `Weather Schedule Change: ${changeSet.impactedJobs.length} jobs`,
        description: `Weather conditions require rescheduling ${changeSet.impactedJobs.length} jobs. ` +
          `Expected disruption: ${changeSet.metrics.disruptionMinutes} minutes. ` +
          `Weather: ${input.riskSummary.weatherDescription}`,
        operatorId: input.operatorId,
        workflowId: workflowInfo().workflowId,
        data: {
          changeSet,
          riskSummary: input.riskSummary,
          timeRange: input.timeRange
        },
        expiresAt: new Date(Date.now() + config.approvalTimeoutHours * 60 * 60 * 1000).toISOString()
      });

      state.approvalPacketId = packetId;

      // Step 5: Wait for approval
      console.log(`[SchedulePlanning] Waiting for approval (timeout: ${config.approvalTimeoutHours}h)`);
      const approved = await condition(
        () => approvalDecision !== null || isCancelled,
        `${config.approvalTimeoutHours} hours`
      );

      if (!approved || isCancelled) {
        state.status = 'EXPIRED';
        console.log(`[SchedulePlanning] Approval timeout or cancelled`);
        return { status: 'EXPIRED', planId, appliedChanges: 0 };
      }
    }

    // Process approval decision
    if (!approvalDecision) {
      state.status = 'EXPIRED';
      return { status: 'EXPIRED', planId, appliedChanges: 0 };
    }

    state.approvedBy = approvalDecision.approvedBy;
    state.approvedAt = new Date().toISOString();

    if (approvalDecision.decision === 'REJECT') {
      state.status = 'REJECTED';
      state.error = approvalDecision.rejectionReason || 'Rejected by operator';
      console.log(`[SchedulePlanning] Plan rejected: ${state.error}`);
      return { status: 'REJECTED', planId, appliedChanges: 0 };
    }

    // Step 6: Apply approved changes
    state.status = 'APPLYING';
    console.log(`[SchedulePlanning] Applying schedule changes`);

    const jobsToApply = approvalDecision.decision === 'PARTIAL' && approvalDecision.selectedChanges
      ? state.changeSet.impactedJobs.filter((j: any) => approvalDecision!.selectedChanges!.includes(j.jobId))
      : state.changeSet.impactedJobs;

    const applyResult = await applyScheduleChangesActivity({
      planId,
      operatorId: input.operatorId,
      changes: jobsToApply,
      crewChanges: state.changeSet.crewChanges,
      routeChanges: state.changeSet.routeChanges
    });

    state.appliedAt = new Date().toISOString();

    // Step 7: Send notifications
    console.log(`[SchedulePlanning] Sending notifications`);
    await sendScheduleChangeNotificationsActivity({
      operatorId: input.operatorId,
      changes: jobsToApply,
      commsPlan: state.changeSet.commsPlan,
      weatherSummary: input.riskSummary.weatherDescription
    });

    state.status = 'COMPLETED';
    console.log(`[SchedulePlanning] Plan completed. Applied ${applyResult.appliedCount} changes`);

    return {
      status: 'COMPLETED',
      planId,
      appliedChanges: applyResult.appliedCount
    };

  } catch (error) {
    state.status = 'REJECTED';
    state.error = String(error);
    console.error(`[SchedulePlanning] Error:`, error);
    throw error;
  }
}

/**
 * Generate deterministic plan ID for idempotency
 */
function generatePlanId(input: ScheduleImpactPlanningInput): string {
  const date = input.timeRange.start.split('T')[0];
  const jobHash = input.impactedJobIds.sort().join(',').slice(0, 20);
  return `plan:${input.serviceAreaId}:${date}:${input.forecastVersion.slice(0, 10)}:${jobHash}`;
}

/**
 * Workflow ID helper
 */
export function getScheduleImpactPlanningWorkflowId(
  operatorId: number,
  serviceAreaId: number,
  date: string,
  forecastVersion: string
): string {
  return `ScheduleImpactPlanningWorkflow:${operatorId}:${serviceAreaId}:${date}:${forecastVersion.slice(0, 10)}`;
}
