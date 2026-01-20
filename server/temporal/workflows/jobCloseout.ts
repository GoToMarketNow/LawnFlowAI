/**
 * Job Closeout Workflow
 *
 * Temporal workflow for closing out a completed job:
 * 1. Check policy for invoice generation
 * 2. Build invoice using AI agent
 * 3. Wait for HITL approval if needed
 * 4. (Future) Capture payment
 * 5. (Future) Send notification
 *
 * This is the "golden workflow" that proves Temporal value.
 *
 * @module server/temporal/workflows/jobCloseout
 */

import {
  proxyActivities,
  defineSignal,
  setHandler,
  condition,
  workflowInfo,
  sleep,
  ApplicationFailure,
} from '@temporalio/workflow';

// Import activity types (not implementations - workflows can't import non-deterministic code)
import type * as activities from '../activities';

// ============================================================================
// Signal Definitions
// ============================================================================

/**
 * Signal for human approval/rejection
 */
export const approvalSignal = defineSignal<
  [{ approved: boolean; data?: Record<string, unknown>; userId: number; notes?: string }]
>('approval');

/**
 * Signal to cancel the workflow
 */
export const cancelSignal = defineSignal<[{ reason: string; userId?: number }]>('cancel');

// ============================================================================
// Workflow Types
// ============================================================================

export interface JobCloseoutInput {
  accountId: string;
  businessId: number;
  jobId: number;
  customerId?: number;
  amount?: number;
  serviceType?: string;
  completedAt?: string;
}

export interface JobCloseoutOutput {
  success: boolean;
  invoiceId?: number;
  total?: number;
  paymentCaptured?: boolean;
  humanApproved?: boolean;
  error?: string;
  stages: Array<{
    stage: string;
    status: 'completed' | 'failed' | 'skipped';
    durationMs?: number;
  }>;
}

// ============================================================================
// Activity Proxies
// ============================================================================

const {
  // Database activities
  recordWorkflowRunActivity,
  updateWorkflowRunActivity,
  recordWorkflowStepActivity,
  loadJobActivity,
  loadBusinessProfileActivity,

  // Billing activities
  buildInvoiceActivity,

  // Human task activities
  createHumanTaskActivity,

  // Policy activities
  checkPolicyActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '30 seconds',
  },
});

// ============================================================================
// Workflow Implementation
// ============================================================================

/**
 * Job Closeout Workflow
 *
 * Orchestrates the process of closing out a completed job:
 * generating invoice, getting approval if needed, and preparing for payment.
 */
export async function JobCloseoutWorkflow(input: JobCloseoutInput): Promise<JobCloseoutOutput> {
  const { workflowId, runId } = workflowInfo();
  const stages: JobCloseoutOutput['stages'] = [];

  // Signal state
  let approvalReceived: {
    approved: boolean;
    data?: Record<string, unknown>;
    userId: number;
    notes?: string;
  } | null = null;
  let cancelled = false;
  let cancelReason = '';

  // Set up signal handlers
  setHandler(approvalSignal, (approval) => {
    approvalReceived = approval;
  });

  setHandler(cancelSignal, ({ reason }) => {
    cancelled = true;
    cancelReason = reason;
  });

  let workflowRunId: number | undefined;
  let stepIndex = 0;

  try {
    // ========================================================================
    // Step 0: Record workflow run
    // ========================================================================
    const runResult = await recordWorkflowRunActivity({
      workflowId,
      runId,
      workflowType: 'JobCloseoutWorkflow',
      accountId: input.accountId,
      businessId: input.businessId,
      primaryEntityType: 'job',
      primaryEntityId: input.jobId,
      taskQueue: 'lawnflow-main',
      inputJson: input as Record<string, unknown>,
    });
    workflowRunId = runResult.id;

    // ========================================================================
    // Step 1: Load job data
    // ========================================================================
    const loadJobStart = Date.now();
    await recordWorkflowStepActivity({
      workflowRunId,
      activityType: 'loadJobActivity',
      activityId: `load-job-${stepIndex}`,
      stepIndex: stepIndex++,
      status: 'running',
      startedAt: new Date(),
    });

    const { job } = await loadJobActivity({ jobId: input.jobId });

    if (!job) {
      throw ApplicationFailure.nonRetryable(`Job ${input.jobId} not found`);
    }

    await recordWorkflowStepActivity({
      workflowRunId,
      activityType: 'loadJobActivity',
      activityId: `load-job-${stepIndex - 1}`,
      stepIndex: stepIndex - 1,
      status: 'completed',
      completedAt: new Date(),
      durationMs: Date.now() - loadJobStart,
      outputJson: { jobId: job.id, serviceType: job.serviceType },
    });

    stages.push({ stage: 'LOAD_JOB', status: 'completed', durationMs: Date.now() - loadJobStart });

    // Check for cancellation
    if (cancelled) {
      return {
        success: false,
        error: `Workflow cancelled: ${cancelReason}`,
        stages,
      };
    }

    // ========================================================================
    // Step 2: Check policy
    // ========================================================================
    const policyStart = Date.now();
    await updateWorkflowRunActivity({ workflowId, currentStage: 'POLICY_CHECK' });

    await recordWorkflowStepActivity({
      workflowRunId,
      activityType: 'checkPolicyActivity',
      activityId: `policy-check-${stepIndex}`,
      stepIndex: stepIndex++,
      status: 'running',
      startedAt: new Date(),
    });

    const policyResult = await checkPolicyActivity({
      businessId: input.businessId,
      action: 'generate_invoice',
      context: {
        amount: input.amount || job.estimatedPrice || 0,
        confidence: 0.9,
      },
    });

    await recordWorkflowStepActivity({
      workflowRunId,
      activityType: 'checkPolicyActivity',
      activityId: `policy-check-${stepIndex - 1}`,
      stepIndex: stepIndex - 1,
      status: 'completed',
      completedAt: new Date(),
      durationMs: Date.now() - policyStart,
      outputJson: policyResult as Record<string, unknown>,
    });

    stages.push({ stage: 'POLICY_CHECK', status: 'completed', durationMs: Date.now() - policyStart });

    // ========================================================================
    // Step 3: Build invoice
    // ========================================================================
    const invoiceStart = Date.now();
    await updateWorkflowRunActivity({ workflowId, currentStage: 'BUILD_INVOICE' });

    await recordWorkflowStepActivity({
      workflowRunId,
      activityType: 'buildInvoiceActivity',
      activityId: `build-invoice-${stepIndex}`,
      stepIndex: stepIndex++,
      status: 'running',
      startedAt: new Date(),
    });

    const invoiceResult = await buildInvoiceActivity({
      accountId: input.accountId,
      businessId: input.businessId,
      jobId: input.jobId,
      amount: input.amount,
      serviceType: input.serviceType || job.serviceType || undefined,
    });

    await recordWorkflowStepActivity({
      workflowRunId,
      activityType: 'buildInvoiceActivity',
      activityId: `build-invoice-${stepIndex - 1}`,
      stepIndex: stepIndex - 1,
      status: invoiceResult.success ? 'completed' : 'failed',
      completedAt: new Date(),
      durationMs: Date.now() - invoiceStart,
      outputJson: invoiceResult as unknown as Record<string, unknown>,
      errorMessage: invoiceResult.error,
    });

    if (!invoiceResult.success) {
      stages.push({ stage: 'BUILD_INVOICE', status: 'failed', durationMs: Date.now() - invoiceStart });
      throw ApplicationFailure.nonRetryable(invoiceResult.error || 'Invoice build failed');
    }

    stages.push({ stage: 'BUILD_INVOICE', status: 'completed', durationMs: Date.now() - invoiceStart });

    // ========================================================================
    // Step 4: Wait for approval if needed
    // ========================================================================
    const needsApproval = invoiceResult.requiresApproval || policyResult.requiresApproval;

    if (needsApproval) {
      const approvalStart = Date.now();
      await updateWorkflowRunActivity({ workflowId, currentStage: 'AWAITING_APPROVAL' });

      await recordWorkflowStepActivity({
        workflowRunId,
        activityType: 'createHumanTaskActivity',
        activityId: `human-task-${stepIndex}`,
        stepIndex: stepIndex++,
        status: 'running',
        startedAt: new Date(),
      });

      // Create human task
      const taskResult = await createHumanTaskActivity({
        workflowId,
        taskType: 'approval',
        category: 'billing',
        assignedRole: 'ops',
        title: `Invoice approval for Job #${input.jobId}`,
        description: `Invoice total: $${((invoiceResult.total || 0) / 100).toFixed(2)}. Confidence: ${((invoiceResult.confidence || 0) * 100).toFixed(0)}%`,
        context: {
          accountId: input.accountId,
          businessId: input.businessId,
          jobId: input.jobId,
          invoiceId: invoiceResult.invoiceId,
          total: invoiceResult.total,
          confidence: invoiceResult.confidence,
          lineItems: invoiceResult.lineItems,
          policyResult,
        },
        options: [
          { value: 'approve', label: 'Approve Invoice' },
          { value: 'reject', label: 'Reject & Revise' },
          { value: 'modify', label: 'Modify Amount' },
        ],
        signalName: 'approval',
        priority: 'normal',
      });

      await recordWorkflowStepActivity({
        workflowRunId,
        activityType: 'createHumanTaskActivity',
        activityId: `human-task-${stepIndex - 1}`,
        stepIndex: stepIndex - 1,
        status: 'completed',
        completedAt: new Date(),
        durationMs: Date.now() - approvalStart,
        outputJson: { taskId: taskResult.taskId },
      });

      // Wait for approval signal (with 24 hour timeout)
      const approved = await condition(
        () => approvalReceived !== null || cancelled,
        '24 hours'
      );

      if (cancelled) {
        stages.push({ stage: 'APPROVAL', status: 'failed', durationMs: Date.now() - approvalStart });
        return {
          success: false,
          invoiceId: invoiceResult.invoiceId,
          error: `Workflow cancelled: ${cancelReason}`,
          stages,
        };
      }

      if (!approved || !approvalReceived) {
        // Timeout
        stages.push({ stage: 'APPROVAL', status: 'failed', durationMs: Date.now() - approvalStart });
        await updateWorkflowRunActivity({
          workflowId,
          status: 'timed_out',
          completedAt: new Date(),
        });
        return {
          success: false,
          invoiceId: invoiceResult.invoiceId,
          error: 'Approval timeout (24 hours)',
          stages,
        };
      }

      if (!approvalReceived.approved) {
        stages.push({ stage: 'APPROVAL', status: 'failed', durationMs: Date.now() - approvalStart });
        await updateWorkflowRunActivity({
          workflowId,
          status: 'cancelled',
          completedAt: new Date(),
          outputJson: { rejectedBy: approvalReceived.userId, notes: approvalReceived.notes },
        });
        return {
          success: false,
          invoiceId: invoiceResult.invoiceId,
          humanApproved: false,
          error: `Invoice rejected: ${approvalReceived.notes || 'No reason provided'}`,
          stages,
        };
      }

      stages.push({ stage: 'APPROVAL', status: 'completed', durationMs: Date.now() - approvalStart });
    } else {
      stages.push({ stage: 'APPROVAL', status: 'skipped' });
    }

    // ========================================================================
    // Step 5: Complete workflow
    // ========================================================================
    await updateWorkflowRunActivity({
      workflowId,
      status: 'completed',
      currentStage: 'COMPLETED',
      completedAt: new Date(),
      outputJson: {
        invoiceId: invoiceResult.invoiceId,
        total: invoiceResult.total,
        humanApproved: needsApproval ? true : undefined,
      },
    });

    return {
      success: true,
      invoiceId: invoiceResult.invoiceId,
      total: invoiceResult.total,
      humanApproved: needsApproval ? approvalReceived?.approved : undefined,
      stages,
    };
  } catch (error) {
    // Record failure
    if (workflowRunId) {
      await updateWorkflowRunActivity({
        workflowId,
        status: 'failed',
        completedAt: new Date(),
        errorJson: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stages,
    };
  }
}
