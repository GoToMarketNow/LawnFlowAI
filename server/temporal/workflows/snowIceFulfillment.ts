// ============================================
// Snow/Ice Request Fulfillment Workflow
// On-demand job creation from campaign acceptance
// ============================================

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  workflowInfo
} from '@temporalio/workflow';
import type * as activities from '../activities/weather';
import type * as stageActivities from '../activities/stages';
import type * as notifyActivities from '../activities/twilio';

// Proxy activities
const {
  createSnowIceJobActivity,
  assignCrewToJobActivity,
  updateRouteActivity
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    initialInterval: '5s',
    maximumAttempts: 3,
    backoffCoefficient: 2
  }
});

const {
  sendJobConfirmationSmsActivity
} = proxyActivities<typeof notifyActivities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '2s',
    maximumAttempts: 3
  }
});

// Workflow input
export interface SnowIceFulfillmentInput {
  operatorId: number;
  customerId: number;
  campaignId: string;
  requestedService: string;
  windowPrefs?: {
    start?: string;
    end?: string;
  };
  eventWindow: {
    start: string;
    end: string;
  };
  requestId?: string; // For idempotency
}

// Fulfillment state
interface FulfillmentState {
  status: 'CREATING_JOB' | 'ASSIGNING_CREW' | 'UPDATING_ROUTE' | 'NOTIFYING' | 'COMPLETED' | 'FAILED';
  jobId: number | null;
  crewId: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  error: string | null;
}

// Signals
export const cancelSignal = defineSignal('cancel');

// Queries
export const getStatusQuery = defineQuery<FulfillmentState>('getStatus');

/**
 * Snow/Ice Request Fulfillment Workflow
 * 
 * Processes a customer's acceptance of a winter service offer
 * and creates/schedules the job.
 * 
 * Flow:
 * 1. Create snow/ice job
 * 2. Assign crew
 * 3. Update route
 * 4. Notify customer and crew
 */
export async function SnowIceRequestFulfillmentWorkflow(
  input: SnowIceFulfillmentInput
): Promise<{ status: string; jobId: number | null; scheduledStart: string | null }> {
  // Generate request ID for idempotency
  const requestId = input.requestId || `${input.campaignId}:${input.customerId}:${Date.now()}`;

  // Initialize state
  const state: FulfillmentState = {
    status: 'CREATING_JOB',
    jobId: null,
    crewId: null,
    scheduledStart: null,
    scheduledEnd: null,
    error: null
  };

  let isCancelled = false;

  // Signal handlers
  setHandler(cancelSignal, () => {
    isCancelled = true;
  });

  // Query handler
  setHandler(getStatusQuery, () => state);

  try {
    // Step 1: Create snow/ice job
    console.log(`[SnowIceFulfillment] Creating job for customer ${input.customerId}`);
    
    const jobResult = await createSnowIceJobActivity({
      operatorId: input.operatorId,
      customerId: input.customerId,
      serviceType: input.requestedService,
      eventWindow: input.eventWindow,
      windowPrefs: input.windowPrefs,
      requestId,
      source: `campaign:${input.campaignId}`
    });

    if (!jobResult.success || !jobResult.jobId) {
      state.status = 'FAILED';
      state.error = jobResult.error || 'Failed to create job';
      return { status: 'FAILED', jobId: null, scheduledStart: null };
    }

    state.jobId = jobResult.jobId;
    state.scheduledStart = jobResult.scheduledStart;
    state.scheduledEnd = jobResult.scheduledEnd;

    if (isCancelled) {
      state.status = 'FAILED';
      state.error = 'Cancelled';
      return { status: 'CANCELLED', jobId: state.jobId, scheduledStart: state.scheduledStart };
    }

    // Step 2: Assign crew
    state.status = 'ASSIGNING_CREW';
    console.log(`[SnowIceFulfillment] Assigning crew to job ${state.jobId}`);

    const crewResult = await assignCrewToJobActivity({
      operatorId: input.operatorId,
      jobId: state.jobId,
      serviceType: input.requestedService,
      scheduledStart: state.scheduledStart!,
      scheduledEnd: state.scheduledEnd!,
      requireWinterEquipment: true
    });

    if (!crewResult.success) {
      // Job created but no crew available - still notify customer
      console.warn(`[SnowIceFulfillment] No crew available for job ${state.jobId}`);
    } else {
      state.crewId = crewResult.crewId;
    }

    if (isCancelled) {
      return { status: 'CANCELLED', jobId: state.jobId, scheduledStart: state.scheduledStart };
    }

    // Step 3: Update route (if crew assigned)
    if (state.crewId) {
      state.status = 'UPDATING_ROUTE';
      console.log(`[SnowIceFulfillment] Updating route for crew ${state.crewId}`);

      await updateRouteActivity({
        operatorId: input.operatorId,
        crewId: state.crewId,
        jobId: state.jobId,
        scheduledStart: state.scheduledStart!
      });
    }

    // Step 4: Notify customer
    state.status = 'NOTIFYING';
    console.log(`[SnowIceFulfillment] Sending confirmation to customer ${input.customerId}`);

    await sendJobConfirmationSmsActivity({
      operatorId: input.operatorId,
      customerId: input.customerId,
      jobId: state.jobId,
      serviceType: input.requestedService,
      scheduledStart: state.scheduledStart!,
      scheduledEnd: state.scheduledEnd!,
      crewAssigned: state.crewId !== null
    });

    state.status = 'COMPLETED';
    console.log(`[SnowIceFulfillment] Completed. Job ${state.jobId} scheduled for ${state.scheduledStart}`);

    return {
      status: 'COMPLETED',
      jobId: state.jobId,
      scheduledStart: state.scheduledStart
    };

  } catch (error) {
    state.status = 'FAILED';
    state.error = String(error);
    console.error(`[SnowIceFulfillment] Error:`, error);
    throw error;
  }
}

/**
 * Workflow ID helper
 */
export function getSnowIceFulfillmentWorkflowId(
  campaignId: string,
  customerId: number
): string {
  return `SnowIceRequestFulfillmentWorkflow:${campaignId}:${customerId}`;
}
