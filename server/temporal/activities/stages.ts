/**
 * Stage Activities - Wrap all Lead-to-Cash stage agents as Temporal Activities
 * Sprint 5: Full Migration
 */

import { db } from "../../db";
import { jobRequests, customerMessages, type JobRequest } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import type { OrchestrationContext, StepDecision } from "@shared/orchestrator/contracts";

// Import all stage agents
import { runLeadIntakeAgent } from "../../orchestrator/leadToCash/agents/leadIntake";
import { runQuoteBuildAgent } from "../../orchestrator/leadToCash/agents/quoteBuild";
import { runQuoteConfirmAgent } from "../../orchestrator/leadToCash/agents/quoteConfirm";
import { runScheduleProposeAgent } from "../../orchestrator/leadToCash/agents/schedulePropose";
import { runSimulationRunAgent } from "../../orchestrator/leadToCash/agents/simulationRun";
import { runFeasibilityCheckAgent } from "../../orchestrator/leadToCash/agents/feasibilityCheck";
import { runMarginValidateAgent } from "../../orchestrator/leadToCash/agents/marginValidate";
import { runCrewLockAgent } from "../../orchestrator/leadToCash/agents/crewLock";
import { runDispatchReadyAgent } from "../../orchestrator/leadToCash/agents/dispatchReady";
import { runJobBookAgent } from "../../orchestrator/leadToCash/agents/jobBook";

// =============================================================================
// Common Types
// =============================================================================

export interface StageActivityInput {
  jobRequestId: number;
  context: OrchestrationContext;
  workflowRunId?: number;
}

export interface StageActivityOutput {
  actions: string[];
  output: Record<string, unknown>;
  decision: StepDecision;
  updatedContext: OrchestrationContext;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getJobRequest(jobRequestId: number): Promise<JobRequest> {
  const [jobRequest] = await db
    .select()
    .from(jobRequests)
    .where(eq(jobRequests.id, jobRequestId))
    .limit(1);

  if (!jobRequest) {
    throw new Error(`Job request ${jobRequestId} not found`);
  }

  return jobRequest;
}

async function runPropertyResolverAgent(jobRequest: JobRequest, context: OrchestrationContext) {
  return {
    lat: jobRequest.lat || context.lat,
    lng: jobRequest.lng || context.lng,
    zip: jobRequest.zip || context.zip,
    lotAreaSqft: jobRequest.lotAreaSqft || context.lotAreaSqft,
  };
}

// =============================================================================
// Stage Activities
// =============================================================================

/**
 * LEAD_INTAKE Stage Activity
 * Extracts lead information and resolves property data
 */
export async function leadIntakeActivity(input: StageActivityInput): Promise<StageActivityOutput> {
  const { jobRequestId, context } = input;
  const jobRequest = await getJobRequest(jobRequestId);
  const actions: string[] = ["leadIntakeAgent", "propertyResolverAgent"];

  const intakeResult = await runLeadIntakeAgent(jobRequest, context);
  const propertyResult = await runPropertyResolverAgent(jobRequest, context);

  const output = { intake: intakeResult, property: propertyResult };

  const updatedContext: OrchestrationContext = {
    ...context,
    customerName: intakeResult.customerName || context.customerName,
    customerPhone: intakeResult.customerPhone || context.customerPhone,
    address: intakeResult.address || context.address,
    services: intakeResult.services.length > 0 ? intakeResult.services : context.services,
    frequency: intakeResult.frequency !== "unknown" ? intakeResult.frequency : context.frequency,
    lat: propertyResult.lat || context.lat,
    lng: propertyResult.lng || context.lng,
    zip: propertyResult.zip || context.zip,
    lotAreaSqft: propertyResult.lotAreaSqft || context.lotAreaSqft,
  };

  const canAdvance =
    intakeResult.missingFields.length === 0 &&
    !!updatedContext.customerPhone &&
    !!updatedContext.address &&
    (updatedContext.services?.length || 0) > 0;

  const decision: StepDecision = {
    advance: canAdvance && intakeResult.confidence !== "low",
    nextStage: canAdvance ? "QUOTE_BUILD" : undefined,
    confidence: intakeResult.confidence,
    waitReason: canAdvance ? "none" : "customer_response",
    notes: intakeResult.missingFields.length > 0
      ? [`Missing fields: ${intakeResult.missingFields.join(", ")}`]
      : [],
  };

  return { actions, output, decision, updatedContext };
}

/**
 * QUOTE_BUILD Stage Activity
 * Generates price quote based on services and property
 */
export async function quoteBuildActivity(input: StageActivityInput): Promise<StageActivityOutput> {
  const { jobRequestId, context } = input;
  const jobRequest = await getJobRequest(jobRequestId);
  const actions: string[] = ["quoteBuildAgent"];

  const quoteResult = await runQuoteBuildAgent(jobRequest, context);
  const output = { quote: quoteResult };

  const updatedContext: OrchestrationContext = {
    ...context,
    rangeLow: quoteResult.rangeLow,
    rangeHigh: quoteResult.rangeHigh,
    quoteAssumptions: quoteResult.assumptions,
  };

  const canAdvance =
    quoteResult.rangeLow > 0 &&
    quoteResult.rangeHigh > 0 &&
    quoteResult.assumptions.length > 0 &&
    quoteResult.nextStep === "ready_to_send";

  const decision: StepDecision = {
    advance: canAdvance && quoteResult.confidence !== "low",
    nextStage: canAdvance ? "QUOTE_CONFIRM" : undefined,
    confidence: quoteResult.confidence,
    waitReason: quoteResult.confidence === "low" ? "ops_approval" : "none",
    notes: [`Next step: ${quoteResult.nextStep}`],
  };

  return { actions, output, decision, updatedContext };
}

/**
 * QUOTE_CONFIRM Stage Activity
 * Checks customer response to quote
 */
export async function quoteConfirmActivity(input: StageActivityInput): Promise<StageActivityOutput> {
  const { jobRequestId, context } = input;
  const jobRequest = await getJobRequest(jobRequestId);
  const actions: string[] = ["quoteConfirmAgent"];

  // Get latest customer message
  const [lastMessage] = await db
    .select()
    .from(customerMessages)
    .where(
      and(
        eq(customerMessages.jobRequestId, jobRequest.id),
        eq(customerMessages.direction, "inbound")
      )
    )
    .orderBy(desc(customerMessages.createdAt))
    .limit(1);

  const confirmResult = await runQuoteConfirmAgent(lastMessage?.body, context);
  const output = { confirm: confirmResult };

  let decision: StepDecision;
  const updatedContext = { ...context };

  switch (confirmResult.outcome) {
    case "accepted":
      decision = {
        advance: true,
        nextStage: "SCHEDULE_PROPOSE",
        confidence: confirmResult.confidence,
        waitReason: "none",
        notes: ["Quote accepted by customer"],
      };
      break;
    case "declined":
      decision = {
        advance: false,
        confidence: confirmResult.confidence,
        waitReason: "none",
        notes: ["Quote declined - marking as lost"],
      };
      break;
    case "question":
    case "modify":
      decision = {
        advance: false,
        nextStage: "QUOTE_BUILD",
        confidence: confirmResult.confidence,
        waitReason: "customer_response",
        notes: [`Customer ${confirmResult.outcome}: ${confirmResult.customerMessage || "no message"}`],
      };
      break;
    default:
      decision = {
        advance: false,
        confidence: "low",
        waitReason: "customer_response",
        notes: ["Waiting for customer response"],
      };
  }

  return { actions, output, decision, updatedContext };
}

/**
 * SCHEDULE_PROPOSE Stage Activity
 * Proposes available time windows
 */
export async function scheduleProposeActivity(input: StageActivityInput): Promise<StageActivityOutput> {
  const { jobRequestId, context } = input;
  const jobRequest = await getJobRequest(jobRequestId);
  const actions: string[] = ["scheduleProposeAgent"];

  // Check if customer already selected a window
  if (context.selectedWindow) {
    return {
      actions,
      output: { schedule: { selectedWindow: context.selectedWindow, proposedWindows: context.proposedWindows || [] } },
      decision: {
        advance: true,
        nextStage: "SIMULATION_RUN",
        confidence: "high",
        waitReason: "none",
        notes: [`Customer selected window: ${JSON.stringify(context.selectedWindow)}`],
      },
      updatedContext: context,
    };
  }

  const scheduleResult = await runScheduleProposeAgent(jobRequest, context);
  const output = { schedule: scheduleResult };

  const updatedContext: OrchestrationContext = {
    ...context,
    proposedWindows: scheduleResult.proposedWindows,
  };

  const decision: StepDecision = {
    advance: false,
    confidence: scheduleResult.confidence,
    waitReason: "customer_response",
    notes: [`Proposed ${scheduleResult.proposedWindows.length} time windows`],
  };

  return { actions, output, decision, updatedContext };
}

/**
 * SIMULATION_RUN Stage Activity
 * Runs crew/route simulations
 */
export async function simulationRunActivity(input: StageActivityInput): Promise<StageActivityOutput> {
  const { jobRequestId, context } = input;
  const jobRequest = await getJobRequest(jobRequestId);
  const actions: string[] = ["simulationRunAgent"];

  const simResult = await runSimulationRunAgent(jobRequest, context);
  const output = { simulation: simResult };

  const updatedContext: OrchestrationContext = {
    ...context,
    simulationBatchId: simResult.simulationBatchId,
    simulationRankedOptions: simResult.rankedOptions,
    topRecommendation: simResult.topRecommendation,
  };

  const canAdvance = simResult.rankedOptions.length > 0;

  const decision: StepDecision = {
    advance: canAdvance,
    nextStage: canAdvance ? "FEASIBILITY_CHECK" : undefined,
    confidence: simResult.confidence,
    waitReason: canAdvance ? "none" : "ops_approval",
    notes: [`Found ${simResult.rankedOptions.length} crew options, top score: ${simResult.topRecommendation?.totalScore || 0}`],
  };

  return { actions, output, decision, updatedContext };
}

/**
 * FEASIBILITY_CHECK Stage Activity
 * Validates job is feasible for selected crew
 */
export async function feasibilityCheckActivity(input: StageActivityInput): Promise<StageActivityOutput> {
  const { jobRequestId, context } = input;
  const jobRequest = await getJobRequest(jobRequestId);
  const actions: string[] = ["feasibilityCheckAgent"];

  const feasResult = await runFeasibilityCheckAgent(jobRequest, context);
  const output = { feasibility: feasResult };

  const updatedContext: OrchestrationContext = {
    ...context,
    feasibilityResult: {
      feasible: feasResult.feasible,
      blockers: feasResult.blockers,
      skillsMissing: feasResult.skillsMissing,
      equipmentMissing: feasResult.equipmentMissing,
    },
  };

  const canAdvance = feasResult.feasible;

  const decision: StepDecision = {
    advance: canAdvance,
    nextStage: canAdvance ? "MARGIN_VALIDATE" : undefined,
    confidence: feasResult.confidence,
    waitReason: canAdvance ? "none" : "ops_approval",
    notes: feasResult.blockers.length > 0
      ? [`Blockers: ${feasResult.blockers.join(", ")}`]
      : ["Feasibility passed"],
  };

  return { actions, output, decision, updatedContext };
}

/**
 * MARGIN_VALIDATE Stage Activity
 * Validates job meets margin requirements
 */
export async function marginValidateActivity(input: StageActivityInput): Promise<StageActivityOutput> {
  const { jobRequestId, context } = input;
  const jobRequest = await getJobRequest(jobRequestId);
  const actions: string[] = ["marginValidateAgent"];

  const marginResult = await runMarginValidateAgent(jobRequest, context);
  const output = { margin: marginResult };

  const updatedContext: OrchestrationContext = {
    ...context,
    marginResult: {
      marginScore: marginResult.marginScore,
      marginPercent: marginResult.marginPercent,
      estimatedCost: marginResult.estimatedCost,
      estimatedRevenue: marginResult.estimatedRevenue,
      meetsThreshold: marginResult.meetsThreshold,
      warnings: marginResult.warnings,
    },
  };

  const canAdvance = marginResult.meetsThreshold;

  const decision: StepDecision = {
    advance: canAdvance,
    nextStage: canAdvance ? "CREW_LOCK" : undefined,
    confidence: marginResult.confidence,
    waitReason: canAdvance ? "none" : "ops_approval",
    notes: [`Margin score: ${marginResult.marginScore.toFixed(1)}, meets threshold: ${marginResult.meetsThreshold}`],
  };

  return { actions, output, decision, updatedContext };
}

/**
 * CREW_LOCK Stage Activity
 * Locks crew assignment for the job
 */
export async function crewLockActivity(input: StageActivityInput): Promise<StageActivityOutput> {
  const { jobRequestId, context } = input;
  const jobRequest = await getJobRequest(jobRequestId);
  const actions: string[] = ["crewLockAgent"];

  const lockResult = await runCrewLockAgent(jobRequest, context);
  const output = { crewLock: lockResult };

  let updatedContext = { ...context };
  if (lockResult.locked) {
    updatedContext = {
      ...updatedContext,
      selectedCrewIdNumeric: lockResult.crewId,
      selectedCrewName: lockResult.crewName,
      proposedStartISO: lockResult.proposedStartISO,
      decisionId: lockResult.decisionId,
      crewLockApprovalMode: lockResult.approvalMode,
    };
  }

  const canAdvance = lockResult.locked;

  const decision: StepDecision = {
    advance: canAdvance,
    nextStage: canAdvance ? "DISPATCH_READY" : undefined,
    confidence: lockResult.confidence,
    waitReason: canAdvance ? "none" : "ops_approval",
    notes: [`${lockResult.approvalMode}: ${lockResult.lockReason}`],
  };

  return { actions, output, decision, updatedContext };
}

/**
 * DISPATCH_READY Stage Activity
 * Prepares dispatch and notifies crew
 */
export async function dispatchReadyActivity(input: StageActivityInput): Promise<StageActivityOutput> {
  const { jobRequestId, context } = input;
  const jobRequest = await getJobRequest(jobRequestId);
  const actions: string[] = ["dispatchReadyAgent"];

  const dispatchResult = await runDispatchReadyAgent(jobRequest, context);
  const output = { dispatch: dispatchResult };

  const updatedContext: OrchestrationContext = {
    ...context,
    dispatchTaskId: dispatchResult.dispatchTaskId,
    routeSequence: dispatchResult.routeSequence,
    estimatedTravelMinutes: dispatchResult.estimatedTravelMinutes,
    scheduledStartISO: dispatchResult.scheduledStartISO,
    scheduledEndISO: dispatchResult.scheduledEndISO,
    dispatchStatus: dispatchResult.dispatchStatus,
    crewLeaderNotified: dispatchResult.notificationSent,
  };

  const canAdvance = dispatchResult.dispatchStatus === "queued";

  const decision: StepDecision = {
    advance: canAdvance,
    nextStage: canAdvance ? "JOB_BOOKED" : undefined,
    confidence: dispatchResult.confidence,
    waitReason: "none",
    notes: [`Dispatch task ${dispatchResult.dispatchTaskId} queued, route sequence: ${dispatchResult.routeSequence}`],
  };

  return { actions, output, decision, updatedContext };
}

/**
 * JOB_BOOKED Stage Activity
 * Finalizes job booking
 */
export async function jobBookActivity(input: StageActivityInput): Promise<StageActivityOutput> {
  const { jobRequestId, context } = input;
  const jobRequest = await getJobRequest(jobRequestId);
  const actions: string[] = ["jobBookAgent"];

  const bookResult = await runJobBookAgent(jobRequest, context);
  const output = { book: bookResult };

  let updatedContext = { ...context };
  if (bookResult.externalId) {
    updatedContext = {
      ...updatedContext,
      externalJobId: bookResult.externalId,
    };
  }

  const decision: StepDecision = {
    advance: bookResult.writeback === "success" && bookResult.confirmationSent,
    confidence: bookResult.confidence,
    waitReason: "none",
    notes: [
      `Writeback: ${bookResult.writeback}`,
      `Confirmation sent: ${bookResult.confirmationSent}`,
    ],
  };

  return { actions, output, decision, updatedContext };
}

// =============================================================================
// Activity Execution Map
// =============================================================================

export type OrchestrationStage =
  | "LEAD_INTAKE"
  | "QUOTE_BUILD"
  | "QUOTE_CONFIRM"
  | "SCHEDULE_PROPOSE"
  | "SIMULATION_RUN"
  | "FEASIBILITY_CHECK"
  | "MARGIN_VALIDATE"
  | "CREW_LOCK"
  | "DISPATCH_READY"
  | "JOB_BOOKED";

export const STAGE_ORDER: OrchestrationStage[] = [
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

export function getNextStage(current: OrchestrationStage): OrchestrationStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export function getPreviousStage(current: OrchestrationStage): OrchestrationStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx <= 0) return null;
  return STAGE_ORDER[idx - 1];
}

/**
 * Execute any stage by name
 */
export async function executeStageActivity(
  stage: OrchestrationStage,
  input: StageActivityInput
): Promise<StageActivityOutput> {
  switch (stage) {
    case "LEAD_INTAKE":
      return leadIntakeActivity(input);
    case "QUOTE_BUILD":
      return quoteBuildActivity(input);
    case "QUOTE_CONFIRM":
      return quoteConfirmActivity(input);
    case "SCHEDULE_PROPOSE":
      return scheduleProposeActivity(input);
    case "SIMULATION_RUN":
      return simulationRunActivity(input);
    case "FEASIBILITY_CHECK":
      return feasibilityCheckActivity(input);
    case "MARGIN_VALIDATE":
      return marginValidateActivity(input);
    case "CREW_LOCK":
      return crewLockActivity(input);
    case "DISPATCH_READY":
      return dispatchReadyActivity(input);
    case "JOB_BOOKED":
      return jobBookActivity(input);
    default:
      throw new Error(`Unknown stage: ${stage}`);
  }
}
