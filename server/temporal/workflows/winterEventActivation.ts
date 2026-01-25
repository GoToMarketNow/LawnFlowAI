// ============================================
// Winter Event Activation Workflow
// Manages winter service outreach campaigns
// ============================================

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  workflowInfo,
  sleep,
  startChild
} from '@temporalio/workflow';
import type * as activities from '../activities/weather';
import type * as humanActivities from '../activities/humanTasks';
import { SnowIceRequestFulfillmentWorkflow } from './snowIceFulfillment';

// Proxy activities
const {
  validateOperatorServicesActivity,
  queryEligibleCustomersActivity,
  checkOperationalCapacityActivity,
  buildCampaignProposalActivity,
  sendCampaignBatchActivity,
  recordCampaignMetricsActivity
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '5s',
    maximumAttempts: 3,
    backoffCoefficient: 2
  }
});

const {
  createHumanTaskActivity
} = proxyActivities<typeof humanActivities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    initialInterval: '1s',
    maximumAttempts: 3
  }
});

// Workflow input
export interface WinterEventActivationInput {
  operatorId: number;
  serviceAreaId: number;
  event: {
    eventId: string;
    eventType: 'SNOW' | 'ICE' | 'FREEZING_RAIN' | 'REFREEZE' | 'SLEET' | 'BLIZZARD';
    windowStart: string;
    windowEnd: string;
    affectedGeoSet: any;
    confidence: number;
    drivers: {
      snowInches?: number;
      iceProbability?: number;
      tempMin?: number;
      windGust?: number;
    };
  };
  config?: {
    approvalTimeoutHours?: number;
    maxAcceptsTotal?: number;
    maxAcceptsPerHour?: number;
    batchSize?: number;
    delayBetweenBatchesSec?: number;
    maxMsgsPerCustomerPer24h?: number;
  };
}

// Campaign state
interface CampaignState {
  status: 'VALIDATING' | 'BUILDING_PROPOSAL' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENDING' | 'COMPLETED' | 'REJECTED' | 'FAILED';
  campaignId: string;
  eligibleCustomers: number;
  sentCount: number;
  deliveredCount: number;
  acceptedCount: number;
  fulfillmentWorkflows: string[];
  error: string | null;
}

// Signals
export const approvalSignal = defineSignal<[{
  decision: 'APPROVE' | 'REJECT';
  approvedBy: number;
  modifiedThrottle?: {
    maxAcceptsTotal?: number;
    batchSize?: number;
  };
  rejectionReason?: string;
}]>('approval');

export const customerAcceptedSignal = defineSignal<[{
  customerId: number;
  offerId: string;
  requestedService: string;
  windowPrefs?: { start?: string; end?: string };
}]>('customerAccepted');

export const cancelSignal = defineSignal('cancel');

// Queries
export const getStatusQuery = defineQuery<CampaignState>('getStatus');
export const getMetricsQuery = defineQuery<{
  sent: number;
  delivered: number;
  accepted: number;
  conversionRate: number;
}>('getMetrics');

/**
 * Winter Event Activation Workflow
 * 
 * Detects winter events and runs customer outreach campaigns for
 * snow/ice services.
 * 
 * Flow:
 * 1. Validate operator offers winter services
 * 2. Query eligible customers
 * 3. Check operational capacity
 * 4. Build campaign proposal
 * 5. Wait for approval
 * 6. Send batched messages (rate-limited)
 * 7. Handle customer acceptances via child workflows
 */
export async function WinterEventActivationWorkflow(
  input: WinterEventActivationInput
): Promise<{ status: string; campaignId: string; metrics: any }> {
  const config = {
    approvalTimeoutHours: input.config?.approvalTimeoutHours ?? 12,
    maxAcceptsTotal: input.config?.maxAcceptsTotal ?? 50,
    maxAcceptsPerHour: input.config?.maxAcceptsPerHour ?? 10,
    batchSize: input.config?.batchSize ?? 20,
    delayBetweenBatchesSec: input.config?.delayBetweenBatchesSec ?? 30,
    maxMsgsPerCustomerPer24h: input.config?.maxMsgsPerCustomerPer24h ?? 1
  };

  // Generate campaign ID
  const campaignId = `winter:${input.operatorId}:${input.event.eventId}`;

  // Initialize state
  const state: CampaignState = {
    status: 'VALIDATING',
    campaignId,
    eligibleCustomers: 0,
    sentCount: 0,
    deliveredCount: 0,
    acceptedCount: 0,
    fulfillmentWorkflows: [],
    error: null
  };

  let approvalDecision: any = null;
  let isCancelled = false;
  const customerAcceptances: Array<{
    customerId: number;
    offerId: string;
    requestedService: string;
    windowPrefs?: any;
  }> = [];

  // Signal handlers
  setHandler(approvalSignal, (decision) => {
    approvalDecision = decision;
  });

  setHandler(customerAcceptedSignal, (acceptance) => {
    customerAcceptances.push(acceptance);
  });

  setHandler(cancelSignal, () => {
    isCancelled = true;
  });

  // Query handlers
  setHandler(getStatusQuery, () => state);
  setHandler(getMetricsQuery, () => ({
    sent: state.sentCount,
    delivered: state.deliveredCount,
    accepted: state.acceptedCount,
    conversionRate: state.sentCount > 0 ? state.acceptedCount / state.sentCount : 0
  }));

  try {
    // Step 1: Validate operator offers winter services
    console.log(`[WinterCampaign] Validating operator ${input.operatorId} services`);
    const validation = await validateOperatorServicesActivity({
      operatorId: input.operatorId,
      requiredServiceTypes: ['SNOW_REMOVAL', 'SALTING', 'ICE_REMOVAL', 'PLOWING']
    });

    if (!validation.hasWinterServices) {
      state.status = 'REJECTED';
      state.error = 'Operator does not offer winter services';
      return { status: 'NO_WINTER_SERVICES', campaignId, metrics: getMetrics(state) };
    }

    if (isCancelled) {
      state.status = 'REJECTED';
      return { status: 'CANCELLED', campaignId, metrics: getMetrics(state) };
    }

    // Step 2: Query eligible customers
    state.status = 'BUILDING_PROPOSAL';
    console.log(`[WinterCampaign] Querying eligible customers`);
    
    const eligibleResult = await queryEligibleCustomersActivity({
      operatorId: input.operatorId,
      serviceAreaId: input.serviceAreaId,
      affectedGeoSet: input.event.affectedGeoSet,
      excludeRecurringPlan: true,
      requireOptIn: true
    });

    state.eligibleCustomers = eligibleResult.customerCount;

    if (eligibleResult.customerCount === 0) {
      state.status = 'COMPLETED';
      return { status: 'NO_ELIGIBLE_CUSTOMERS', campaignId, metrics: getMetrics(state) };
    }

    // Step 3: Check operational capacity
    console.log(`[WinterCampaign] Checking operational capacity`);
    const capacityResult = await checkOperationalCapacityActivity({
      operatorId: input.operatorId,
      serviceAreaId: input.serviceAreaId,
      eventWindow: {
        start: input.event.windowStart,
        end: input.event.windowEnd
      },
      estimatedDemand: Math.min(eligibleResult.customerCount, config.maxAcceptsTotal)
    });

    if (!capacityResult.hasCapacity) {
      state.status = 'REJECTED';
      state.error = 'Insufficient operational capacity';
      return { status: 'NO_CAPACITY', campaignId, metrics: getMetrics(state) };
    }

    // Step 4: Build campaign proposal
    console.log(`[WinterCampaign] Building campaign proposal`);
    const proposal = await buildCampaignProposalActivity({
      campaignId,
      operatorId: input.operatorId,
      event: input.event,
      eligibleCustomers: eligibleResult.customers,
      capacity: capacityResult,
      throttle: {
        maxMsgsPerCustomerPer24h: config.maxMsgsPerCustomerPer24h,
        batchSize: config.batchSize,
        delayBetweenBatchesSec: config.delayBetweenBatchesSec
      },
      maxAcceptsTotal: config.maxAcceptsTotal
    });

    // Step 5: Create approval task and wait
    state.status = 'PENDING_APPROVAL';
    console.log(`[WinterCampaign] Creating approval task`);

    await createHumanTaskActivity({
      type: 'WINTER_CAMPAIGN_APPROVAL',
      title: `Winter Campaign: ${input.event.eventType} - ${eligibleResult.customerCount} customers`,
      description: `${input.event.eventType} event detected. Proposed outreach to ${eligibleResult.customerCount} eligible customers. ` +
        `Expected conversion: ${proposal.metricsEstimate.expectedConversionRate * 100}%. ` +
        `Capacity: ${capacityResult.availableSlots} slots available.`,
      operatorId: input.operatorId,
      workflowId: workflowInfo().workflowId,
      data: {
        proposal,
        event: input.event,
        capacity: capacityResult
      },
      expiresAt: new Date(Date.now() + config.approvalTimeoutHours * 60 * 60 * 1000).toISOString()
    });

    // Wait for approval
    console.log(`[WinterCampaign] Waiting for approval`);
    const approved = await condition(
      () => approvalDecision !== null || isCancelled,
      `${config.approvalTimeoutHours} hours`
    );

    if (!approved || isCancelled || !approvalDecision) {
      state.status = 'REJECTED';
      state.error = 'Approval timeout or cancelled';
      return { status: 'EXPIRED', campaignId, metrics: getMetrics(state) };
    }

    if (approvalDecision.decision === 'REJECT') {
      state.status = 'REJECTED';
      state.error = approvalDecision.rejectionReason || 'Rejected by operator';
      return { status: 'REJECTED', campaignId, metrics: getMetrics(state) };
    }

    // Apply any throttle modifications
    if (approvalDecision.modifiedThrottle) {
      if (approvalDecision.modifiedThrottle.maxAcceptsTotal) {
        config.maxAcceptsTotal = approvalDecision.modifiedThrottle.maxAcceptsTotal;
      }
      if (approvalDecision.modifiedThrottle.batchSize) {
        config.batchSize = approvalDecision.modifiedThrottle.batchSize;
      }
    }

    // Step 6: Send campaign messages in batches
    state.status = 'SENDING';
    console.log(`[WinterCampaign] Sending campaign messages`);

    const customers = eligibleResult.customers;
    const batches = [];
    for (let i = 0; i < customers.length; i += config.batchSize) {
      batches.push(customers.slice(i, i + config.batchSize));
    }

    for (const batch of batches) {
      if (isCancelled || state.acceptedCount >= config.maxAcceptsTotal) {
        break;
      }

      const batchResult = await sendCampaignBatchActivity({
        campaignId,
        operatorId: input.operatorId,
        customers: batch,
        event: input.event,
        offer: proposal.offer,
        templates: proposal.templates
      });

      state.sentCount += batchResult.sent;
      state.deliveredCount += batchResult.delivered;

      // Process any acceptances that came in
      while (customerAcceptances.length > 0 && state.acceptedCount < config.maxAcceptsTotal) {
        const acceptance = customerAcceptances.shift()!;
        state.acceptedCount++;

        // Start child workflow for fulfillment
        const childHandle = await startChild(SnowIceRequestFulfillmentWorkflow, {
          workflowId: `SnowIceFulfillment:${campaignId}:${acceptance.customerId}`,
          args: [{
            operatorId: input.operatorId,
            customerId: acceptance.customerId,
            campaignId,
            requestedService: acceptance.requestedService,
            windowPrefs: acceptance.windowPrefs,
            eventWindow: {
              start: input.event.windowStart,
              end: input.event.windowEnd
            }
          }]
        });

        state.fulfillmentWorkflows.push(childHandle.workflowId);
      }

      // Delay between batches
      if (config.delayBetweenBatchesSec > 0) {
        await sleep(`${config.delayBetweenBatchesSec} seconds`);
      }
    }

    // Record final metrics
    await recordCampaignMetricsActivity({
      campaignId,
      operatorId: input.operatorId,
      eventId: input.event.eventId,
      metrics: getMetrics(state)
    });

    state.status = 'COMPLETED';
    console.log(`[WinterCampaign] Campaign completed. Sent: ${state.sentCount}, Accepted: ${state.acceptedCount}`);

    return {
      status: 'COMPLETED',
      campaignId,
      metrics: getMetrics(state)
    };

  } catch (error) {
    state.status = 'FAILED';
    state.error = String(error);
    console.error(`[WinterCampaign] Error:`, error);
    throw error;
  }
}

function getMetrics(state: CampaignState) {
  return {
    eligibleCustomers: state.eligibleCustomers,
    sent: state.sentCount,
    delivered: state.deliveredCount,
    accepted: state.acceptedCount,
    conversionRate: state.sentCount > 0 ? state.acceptedCount / state.sentCount : 0,
    fulfillmentWorkflows: state.fulfillmentWorkflows.length
  };
}

/**
 * Workflow ID helper
 */
export function getWinterEventActivationWorkflowId(
  operatorId: number,
  serviceAreaId: number,
  eventId: string
): string {
  return `WinterEventActivationWorkflow:${operatorId}:${serviceAreaId}:${eventId}`;
}
