/**
 * Lead-to-Cash Temporal Workflow
 * Sprint 5: Full Migration
 *
 * This workflow orchestrates the full lead-to-cash pipeline using Temporal's
 * durable execution model. Each stage is executed as an Activity, with
 * human-in-the-loop (HITL) support via Signals.
 */

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  sleep,
  workflowInfo,
  ApplicationFailure,
} from "@temporalio/workflow";

import type {
  StageActivityInput,
  StageActivityOutput,
  OrchestrationStage,
} from "../activities/stages";
import type { OrchestrationContext, StepDecision } from "@shared/orchestrator/contracts";

// =============================================================================
// Activity Proxies
// =============================================================================

const activities = proxyActivities<{
  // Stage activities
  leadIntakeActivity: (input: StageActivityInput) => Promise<StageActivityOutput>;
  quoteBuildActivity: (input: StageActivityInput) => Promise<StageActivityOutput>;
  quoteConfirmActivity: (input: StageActivityInput) => Promise<StageActivityOutput>;
  scheduleProposeActivity: (input: StageActivityInput) => Promise<StageActivityOutput>;
  simulationRunActivity: (input: StageActivityInput) => Promise<StageActivityOutput>;
  feasibilityCheckActivity: (input: StageActivityInput) => Promise<StageActivityOutput>;
  marginValidateActivity: (input: StageActivityInput) => Promise<StageActivityOutput>;
  crewLockActivity: (input: StageActivityInput) => Promise<StageActivityOutput>;
  dispatchReadyActivity: (input: StageActivityInput) => Promise<StageActivityOutput>;
  jobBookActivity: (input: StageActivityInput) => Promise<StageActivityOutput>;

  // Database activities
  recordWorkflowRunActivity: (input: any) => Promise<{ workflowRunId: number }>;
  updateWorkflowRunActivity: (input: any) => Promise<void>;
  recordWorkflowStepActivity: (input: any) => Promise<{ stepId: number }>;

  // Human task activities
  createHumanTaskActivity: (input: any) => Promise<{ taskId: string }>;

  // FinOps activities
  checkBudgetActivity: (input: any) => Promise<any>;
  recordUsageActivity: (input: any) => Promise<any>;

  // Memory activities
  getContextActivity: (input: any) => Promise<any>;
  generateWorkflowSummaryActivity: (input: any) => Promise<any>;
}>({
  startToCloseTimeout: "5 minutes",
  retry: {
    maximumAttempts: 3,
    initialInterval: "1 second",
    maximumInterval: "30 seconds",
    backoffCoefficient: 2,
  },
});

// =============================================================================
// Signals and Queries
// =============================================================================

export interface ApprovalSignalInput {
  approved: boolean;
  stage: OrchestrationStage;
  userId?: number;
  data?: Record<string, unknown>;
  notes?: string;
}

export interface CustomerResponseSignalInput {
  messageId: string;
  body: string;
  stage: OrchestrationStage;
  parsedIntent?: string;
  selectedWindow?: {
    date: string;
    startTime: string;
    endTime: string;
  };
}

export interface OverrideSignalInput {
  action: "advance" | "revert" | "cancel" | "inject_context";
  targetStage?: OrchestrationStage;
  contextUpdate?: Record<string, unknown>;
  userId: number;
  notes?: string;
}

// Signals
export const approvalSignal = defineSignal<[ApprovalSignalInput]>("approval");
export const customerResponseSignal = defineSignal<[CustomerResponseSignalInput]>("customerResponse");
export const overrideSignal = defineSignal<[OverrideSignalInput]>("override");

// Queries
export const getStatusQuery = defineQuery<{
  currentStage: OrchestrationStage;
  status: string;
  context: OrchestrationContext;
  stepsCompleted: number;
  waitingReason?: string;
}>("getStatus");

export const getHistoryQuery = defineQuery<Array<{
  stage: OrchestrationStage;
  decision: StepDecision;
  timestamp: string;
}>>("getHistory");

// =============================================================================
// Workflow Input/Output
// =============================================================================

export interface LeadToCashWorkflowInput {
  accountId: string;
  businessId: number;
  jobRequestId: number;
  initialContext: OrchestrationContext;
  userId?: number;
  channel?: "sms" | "web" | "ops";
}

export interface LeadToCashWorkflowOutput {
  success: boolean;
  finalStage: OrchestrationStage;
  finalStatus: "completed" | "lost" | "canceled" | "failed";
  stepsCompleted: number;
  context: OrchestrationContext;
  jobId?: number;
  externalJobId?: string;
}

// =============================================================================
// Stage Configuration
// =============================================================================

const STAGE_ORDER: OrchestrationStage[] = [
  "LEAD_INTAKE",
  "QUOTE_BUILD",
  "QUOTE_CONFIRM",
  "SCHEDULE_PROPOSE",
  "SIMULATION_RUN",
  "FEASIBILITY_CHECK",
  "MARGIN_VALIDATE",
  "CREW_LOCK",
  "DISPATCH_READY",
  "JOB_BOOKED",
];

function getNextStage(current: OrchestrationStage): OrchestrationStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

function getPreviousStage(current: OrchestrationStage): OrchestrationStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx <= 0) return null;
  return STAGE_ORDER[idx - 1];
}

// =============================================================================
// Main Workflow
// =============================================================================

export async function leadToCashWorkflow(
  input: LeadToCashWorkflowInput
): Promise<LeadToCashWorkflowOutput> {
  const { accountId, businessId, jobRequestId, initialContext, userId, channel = "ops" } = input;
  const { workflowId, runId } = workflowInfo();

  // Workflow state
  let currentStage: OrchestrationStage = "LEAD_INTAKE";
  let context: OrchestrationContext = { ...initialContext };
  let status: "running" | "waiting_customer" | "waiting_ops" | "completed" | "lost" | "canceled" | "failed" = "running";
  let waitingReason: string | undefined;
  let stepsCompleted = 0;
  let workflowRunId: number | undefined;

  // Signal state
  let pendingApproval: ApprovalSignalInput | null = null;
  let pendingCustomerResponse: CustomerResponseSignalInput | null = null;
  let pendingOverride: OverrideSignalInput | null = null;

  // History for queries
  const history: Array<{
    stage: OrchestrationStage;
    decision: StepDecision;
    timestamp: string;
  }> = [];

  // =============================================================================
  // Signal Handlers
  // =============================================================================

  setHandler(approvalSignal, (approval) => {
    if (approval.stage === currentStage) {
      pendingApproval = approval;
    }
  });

  setHandler(customerResponseSignal, (response) => {
    if (response.stage === currentStage) {
      pendingCustomerResponse = response;
      // Update context with selected window if provided
      if (response.selectedWindow) {
        context = { ...context, selectedWindow: response.selectedWindow };
      }
    }
  });

  setHandler(overrideSignal, (override) => {
    pendingOverride = override;
  });

  // =============================================================================
  // Query Handlers
  // =============================================================================

  setHandler(getStatusQuery, () => ({
    currentStage,
    status,
    context,
    stepsCompleted,
    waitingReason,
  }));

  setHandler(getHistoryQuery, () => history);

  // =============================================================================
  // Record workflow start
  // =============================================================================

  try {
    const runRecord = await activities.recordWorkflowRunActivity({
      workflowId,
      runId,
      workflowType: "lead-to-cash",
      accountId,
      businessId,
      primaryEntityType: "job_request",
      primaryEntityId: jobRequestId,
      inputJson: input,
      taskQueue: "lead-to-cash",
    });
    workflowRunId = runRecord.workflowRunId;
  } catch (err) {
    // Continue even if recording fails - workflow execution is more important
  }

  // =============================================================================
  // Enrich context with memory
  // =============================================================================

  try {
    const memoryContext = await activities.getContextActivity({
      businessId,
      customerId: context.customerId,
      phone: context.customerPhone,
      limit: 10,
    });

    if (memoryContext.success && memoryContext.previousInteractions?.length > 0) {
      context = {
        ...context,
        previousInteractions: memoryContext.previousInteractions,
        customerPreferences: memoryContext.preferences,
      };
    }
  } catch (err) {
    // Memory enrichment is optional
  }

  // =============================================================================
  // Main Execution Loop
  // =============================================================================

  while (status === "running" || status === "waiting_customer" || status === "waiting_ops") {
    // Check for override signal
    if (pendingOverride) {
      const override = pendingOverride;
      pendingOverride = null;

      switch (override.action) {
        case "cancel":
          status = "canceled";
          waitingReason = override.notes || "Canceled by operator";
          break;
        case "advance":
          if (override.targetStage) {
            currentStage = override.targetStage;
          } else {
            const next = getNextStage(currentStage);
            if (next) currentStage = next;
          }
          status = "running";
          waitingReason = undefined;
          break;
        case "revert":
          if (override.targetStage) {
            currentStage = override.targetStage;
          } else {
            const prev = getPreviousStage(currentStage);
            if (prev) currentStage = prev;
          }
          status = "running";
          waitingReason = undefined;
          break;
        case "inject_context":
          if (override.contextUpdate) {
            context = { ...context, ...override.contextUpdate };
          }
          break;
      }

      if (status === "canceled") break;
      continue;
    }

    // Check for waiting conditions
    if (status === "waiting_customer") {
      // Wait for customer response or timeout (24 hours)
      const gotResponse = await condition(
        () => pendingCustomerResponse !== null || pendingOverride !== null,
        "24 hours"
      );

      if (!gotResponse && pendingOverride === null) {
        // Timeout - mark as lost
        status = "lost";
        waitingReason = "Customer response timeout (24 hours)";
        break;
      }

      if (pendingCustomerResponse) {
        // Process customer response
        if (pendingCustomerResponse.selectedWindow) {
          context = { ...context, selectedWindow: pendingCustomerResponse.selectedWindow };
        }
        pendingCustomerResponse = null;
        status = "running";
        waitingReason = undefined;
      }
      continue;
    }

    if (status === "waiting_ops") {
      // Wait for ops approval or timeout (48 hours)
      const gotApproval = await condition(
        () => pendingApproval !== null || pendingOverride !== null,
        "48 hours"
      );

      if (!gotApproval && pendingOverride === null) {
        // Timeout - create escalation task
        await activities.createHumanTaskActivity({
          workflowRunId,
          accountId,
          businessId,
          taskType: "escalation",
          category: "timeout",
          assignedRole: "supervisor",
          title: `Escalation: ${currentStage} approval timeout`,
          description: `Workflow has been waiting for approval for 48 hours at stage ${currentStage}`,
          contextJson: { stage: currentStage, context },
          priority: "high",
          signalName: "approval",
        });

        // Wait another 24 hours for escalation response
        const gotEscalation = await condition(
          () => pendingApproval !== null || pendingOverride !== null,
          "24 hours"
        );

        if (!gotEscalation && pendingOverride === null) {
          status = "failed";
          waitingReason = "Approval timeout after escalation";
          break;
        }
      }

      if (pendingApproval) {
        if (pendingApproval.approved) {
          // Apply approval data to context
          if (pendingApproval.data) {
            context = { ...context, ...pendingApproval.data };
          }
          status = "running";
          waitingReason = undefined;

          // Advance to next stage
          const next = getNextStage(currentStage);
          if (next) currentStage = next;
        } else {
          // Rejection - could mean revert or cancel depending on stage
          if (currentStage === "QUOTE_BUILD" || currentStage === "QUOTE_CONFIRM") {
            status = "lost";
            waitingReason = pendingApproval.notes || "Quote rejected";
          } else {
            // Revert to previous stage
            const prev = getPreviousStage(currentStage);
            if (prev) {
              currentStage = prev;
              status = "running";
            } else {
              status = "failed";
              waitingReason = "Cannot revert from first stage";
            }
          }
        }
        pendingApproval = null;
      }
      continue;
    }

    // =============================================================================
    // Execute current stage
    // =============================================================================

    const stageInput: StageActivityInput = {
      jobRequestId,
      context,
      workflowRunId,
    };

    let result: StageActivityOutput;

    try {
      // Check budget before LLM-heavy stages
      const llmStages: OrchestrationStage[] = [
        "LEAD_INTAKE", "QUOTE_BUILD", "QUOTE_CONFIRM", "SIMULATION_RUN"
      ];

      if (llmStages.includes(currentStage)) {
        const budgetCheck = await activities.checkBudgetActivity({
          businessId,
          estimatedTokens: 2000,
          activityType: currentStage,
        });

        if (!budgetCheck.allowed && budgetCheck.action === "block") {
          // Create human task for budget approval
          await activities.createHumanTaskActivity({
            workflowRunId,
            accountId,
            businessId,
            taskType: "budget_approval",
            category: "finops",
            assignedRole: "owner",
            title: `Budget limit reached for ${currentStage}`,
            description: `Monthly budget ${budgetCheck.budgetUsedPercent?.toFixed(1)}% used. Approve to continue.`,
            contextJson: { stage: currentStage, budgetCheck },
            priority: "high",
            signalName: "approval",
          });

          status = "waiting_ops";
          waitingReason = "Budget approval required";
          continue;
        }
      }

      // Execute stage activity
      switch (currentStage) {
        case "LEAD_INTAKE":
          result = await activities.leadIntakeActivity(stageInput);
          break;
        case "QUOTE_BUILD":
          result = await activities.quoteBuildActivity(stageInput);
          break;
        case "QUOTE_CONFIRM":
          result = await activities.quoteConfirmActivity(stageInput);
          break;
        case "SCHEDULE_PROPOSE":
          result = await activities.scheduleProposeActivity(stageInput);
          break;
        case "SIMULATION_RUN":
          result = await activities.simulationRunActivity(stageInput);
          break;
        case "FEASIBILITY_CHECK":
          result = await activities.feasibilityCheckActivity(stageInput);
          break;
        case "MARGIN_VALIDATE":
          result = await activities.marginValidateActivity(stageInput);
          break;
        case "CREW_LOCK":
          result = await activities.crewLockActivity(stageInput);
          break;
        case "DISPATCH_READY":
          result = await activities.dispatchReadyActivity(stageInput);
          break;
        case "JOB_BOOKED":
          result = await activities.jobBookActivity(stageInput);
          break;
        default:
          throw ApplicationFailure.nonRetryable(`Unknown stage: ${currentStage}`);
      }

      // Record step
      stepsCompleted++;
      history.push({
        stage: currentStage,
        decision: result.decision,
        timestamp: new Date().toISOString(),
      });

      // Record step in database
      try {
        await activities.recordWorkflowStepActivity({
          workflowRunId,
          activityType: currentStage,
          activityId: `${workflowId}-${currentStage}-${stepsCompleted}`,
          stepIndex: stepsCompleted,
          inputJson: stageInput,
          outputJson: result.output,
          status: result.decision.advance ? "completed" : "waiting",
        });
      } catch (err) {
        // Continue even if recording fails
      }

      // Update context
      context = result.updatedContext;

      // Process decision
      if (result.decision.advance) {
        if (currentStage === "JOB_BOOKED") {
          // Workflow complete!
          status = "completed";
          break;
        }

        // Advance to next stage
        const next = result.decision.nextStage || getNextStage(currentStage);
        if (next) {
          currentStage = next;
        } else {
          status = "completed";
          break;
        }
      } else {
        // Handle wait conditions
        if (result.decision.waitReason === "customer_response") {
          status = "waiting_customer";
          waitingReason = result.decision.notes?.join("; ");
        } else if (result.decision.waitReason === "ops_approval") {
          // Create human task
          await activities.createHumanTaskActivity({
            workflowRunId,
            accountId,
            businessId,
            taskType: "stage_approval",
            category: currentStage.toLowerCase(),
            assignedRole: "operator",
            title: `Approval needed: ${currentStage}`,
            description: result.decision.notes?.join("; ") || "Manual approval required",
            contextJson: { stage: currentStage, context, decision: result.decision },
            priority: result.decision.confidence === "low" ? "high" : "normal",
            signalName: "approval",
          });

          status = "waiting_ops";
          waitingReason = result.decision.notes?.join("; ");
        } else if (result.decision.notes?.some(n => n.includes("declined"))) {
          // Quote declined
          status = "lost";
          waitingReason = "Quote declined by customer";
          break;
        }
      }

      // Update workflow run record
      try {
        await activities.updateWorkflowRunActivity({
          workflowRunId,
          status,
          currentStage,
          contextJson: context,
        });
      } catch (err) {
        // Continue even if update fails
      }

    } catch (err) {
      // Stage execution failed
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Record failure
      try {
        await activities.recordWorkflowStepActivity({
          workflowRunId,
          activityType: currentStage,
          activityId: `${workflowId}-${currentStage}-${stepsCompleted + 1}`,
          stepIndex: stepsCompleted + 1,
          inputJson: stageInput,
          status: "failed",
          errorMessage,
        });
      } catch (recordErr) {
        // Ignore recording errors
      }

      // Create human task for failure review
      await activities.createHumanTaskActivity({
        workflowRunId,
        accountId,
        businessId,
        taskType: "failure_review",
        category: "error",
        assignedRole: "supervisor",
        title: `Stage failed: ${currentStage}`,
        description: `Error: ${errorMessage}`,
        contextJson: { stage: currentStage, context, error: errorMessage },
        priority: "high",
        signalName: "override",
      });

      status = "waiting_ops";
      waitingReason = `Stage failed: ${errorMessage}`;
    }
  }

  // =============================================================================
  // Workflow Completion
  // =============================================================================

  // Generate summary for memory
  if (status === "completed" || status === "lost") {
    try {
      await activities.generateWorkflowSummaryActivity({
        workflowRunId,
        businessId,
        customerId: context.customerId,
        outcome: status === "completed" ? "success" : "lost",
        stagesCompleted: stepsCompleted,
        finalContext: context,
      });
    } catch (err) {
      // Summary generation is optional
    }
  }

  // Update final workflow run status
  try {
    await activities.updateWorkflowRunActivity({
      workflowRunId,
      status,
      currentStage,
      contextJson: context,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    // Ignore update errors
  }

  return {
    success: status === "completed",
    finalStage: currentStage,
    finalStatus: status as "completed" | "lost" | "canceled" | "failed",
    stepsCompleted,
    context,
    jobId: context.jobId,
    externalJobId: context.externalJobId,
  };
}
