import { randomUUID } from "crypto";
import { db } from "../../db";
import { 
  orchestrationRuns, 
  orchestrationSteps, 
  jobRequests,
  customerMessages,
  type OrchestrationRun,
  type OrchestrationStep,
  type JobRequest,
  OrchestrationStages,
  type OrchestrationStage,
  type ConfidenceLevel,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { 
  type OrchestrationContext,
  type StepDecision,
  OrchestrationContextSchema,
} from "@shared/orchestrator/contracts";
import { runLeadIntakeAgent } from "./agents/leadIntake";
import { runQuoteBuildAgent } from "./agents/quoteBuild";
import { runQuoteConfirmAgent } from "./agents/quoteConfirm";
import { runScheduleProposeAgent } from "./agents/schedulePropose";
import { runSimulationRunAgent } from "./agents/simulationRun";
import { runFeasibilityCheckAgent } from "./agents/feasibilityCheck";
import { runMarginValidateAgent } from "./agents/marginValidate";
import { runCrewLockAgent } from "./agents/crewLock";
import { runDispatchReadyAgent } from "./agents/dispatchReady";
import { runJobBookAgent } from "./agents/jobBook";
import { log } from "./logger";

// Property resolver stub for LEAD_INTAKE
async function runPropertyResolverAgent(jobRequest: JobRequest, context: OrchestrationContext) {
  return {
    lat: jobRequest.lat || context.lat,
    lng: jobRequest.lng || context.lng,
    zip: jobRequest.zip || context.zip,
    lotAreaSqft: jobRequest.lotAreaSqft || context.lotAreaSqft,
  };
}

// ============================================
// Stage ordering and transitions
// ============================================

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

// ============================================
// Core Engine Functions
// ============================================

export interface StartOrchestrationParams {
  accountId: string;
  businessId: number;
  jobRequestId: number;
  userId?: number;
  channel?: "sms" | "web" | "ops";
}

export interface StartOrchestrationResult {
  success: boolean;
  runId: string;
  message: string;
  run?: OrchestrationRun;
}

export async function startOrchestration(
  params: StartOrchestrationParams
): Promise<StartOrchestrationResult> {
  const { accountId, businessId, jobRequestId, userId, channel = "ops" } = params;
  const runId = `run_${randomUUID()}`;

  log("info", `Starting orchestration ${runId} for jobRequest ${jobRequestId}`);

  // Get job request
  const [jobRequest] = await db
    .select()
    .from(jobRequests)
    .where(eq(jobRequests.id, jobRequestId))
    .limit(1);

  if (!jobRequest) {
    return { success: false, runId, message: "Job request not found" };
  }

  // Create orchestration run
  const [run] = await db
    .insert(orchestrationRuns)
    .values({
      runId,
      accountId,
      businessId,
      channel,
      currentStage: "LEAD_INTAKE",
      status: "running",
      confidence: "medium",
      primaryEntityType: "job_request",
      primaryEntityId: jobRequestId,
      contextJson: await buildContextWithMemory(jobRequest, businessId),
      createdByUserId: userId || null,
    })
    .returning();

  // Update job request with run reference
  await db
    .update(jobRequests)
    .set({ 
      lastOrchestrationRunId: run.id,
      lifecycleStage: "LEAD_INTAKE",
    })
    .where(eq(jobRequests.id, jobRequestId));

  log("info", `Created orchestration run ${runId}`);

  // Run first step
  const stepResult = await runNextStep(runId);
  
  // Re-fetch the run to get updated state
  const [updatedRun] = await db
    .select()
    .from(orchestrationRuns)
    .where(eq(orchestrationRuns.runId, runId))
    .limit(1);

  return {
    success: stepResult.success,
    runId,
    message: stepResult.message,
    run: updatedRun,
  };
}

function buildInitialContext(jobRequest: JobRequest): OrchestrationContext {
  return {
    customerName: jobRequest.customerName,
    customerPhone: jobRequest.customerPhone || undefined,
    address: jobRequest.address,
    services: (jobRequest.servicesJson as string[]) || [],
    frequency: jobRequest.frequency,
    lat: jobRequest.lat || undefined,
    lng: jobRequest.lng || undefined,
    zip: jobRequest.zip || undefined,
    lotAreaSqft: jobRequest.lotAreaSqft || undefined,
  };
}

async function buildContextWithMemory(jobRequest: JobRequest, businessId: number): Promise<OrchestrationContext> {
  const baseContext = buildInitialContext(jobRequest);
  
  try {
    const { enrichContextWithCustomerInsights } = await import("./memoryHooks");
    const enrichedContext = await enrichContextWithCustomerInsights(businessId, baseContext);
    if (enrichedContext.customerId) {
      log("info", `[Memory] Enriched context with customer ID ${enrichedContext.customerId}`);
    }
    return enrichedContext;
  } catch (error) {
    log("warn", `[Memory] Failed to enrich context: ${error}`);
    return baseContext;
  }
}

export interface RunNextStepResult {
  success: boolean;
  message: string;
  stepId?: number;
  decision?: StepDecision;
}

export async function runNextStep(runId: string): Promise<RunNextStepResult> {
  log("info", `Running next step for ${runId}`);

  // Get run
  const [run] = await db
    .select()
    .from(orchestrationRuns)
    .where(eq(orchestrationRuns.runId, runId))
    .limit(1);

  if (!run) {
    return { success: false, message: "Run not found" };
  }

  // Check if run is in a state that allows execution
  if (run.status !== "running") {
    return { 
      success: false, 
      message: `Run is ${run.status}, not running. ${run.waitingReason || ""}` 
    };
  }

  // Get current step count
  const existingSteps = await db
    .select()
    .from(orchestrationSteps)
    .where(eq(orchestrationSteps.orchestrationRunId, run.id));

  const stepIndex = existingSteps.length;
  const stage = run.currentStage as OrchestrationStage;
  const context = run.contextJson as OrchestrationContext;

  // Get job request
  const [jobRequest] = await db
    .select()
    .from(jobRequests)
    .where(eq(jobRequests.id, run.primaryEntityId))
    .limit(1);

  if (!jobRequest) {
    return { success: false, message: "Job request not found" };
  }

  // Create step record
  const [step] = await db
    .insert(orchestrationSteps)
    .values({
      orchestrationRunId: run.id,
      stage,
      stepIndex,
      inputJson: { context, jobRequest: { id: jobRequest.id } },
      actionsJson: [],
      outputJson: {},
      decisionJson: {},
    })
    .returning();

  try {
    // Execute stage-specific logic
    const result = await executeStage(stage, context, jobRequest, run);

    // Update step with results
    await db
      .update(orchestrationSteps)
      .set({
        actionsJson: result.actions,
        outputJson: result.output,
        decisionJson: result.decision,
        completedAt: new Date(),
      })
      .where(eq(orchestrationSteps.id, step.id));

    // Update run state based on decision
    await applyDecision(run, result.decision, result.updatedContext);

    log("info", `Step ${stepIndex} completed for ${runId}: ${result.decision.advance ? "advancing" : "waiting"}`);

    return {
      success: true,
      message: result.decision.advance 
        ? `Advanced to ${result.decision.nextStage || "next stage"}`
        : `Waiting: ${result.decision.waitReason || "unknown"}`,
      stepId: step.id,
      decision: result.decision,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    await db
      .update(orchestrationSteps)
      .set({
        error: errorMessage,
        completedAt: new Date(),
      })
      .where(eq(orchestrationSteps.id, step.id));

    await db
      .update(orchestrationRuns)
      .set({ 
        status: "failed",
        waitingReason: errorMessage,
      })
      .where(eq(orchestrationRuns.id, run.id));

    log("error", `Step failed for ${runId}: ${errorMessage}`);

    return { success: false, message: errorMessage };
  }
}

interface StageExecutionResult {
  actions: string[];
  output: Record<string, unknown>;
  decision: StepDecision;
  updatedContext: OrchestrationContext;
}

async function executeStage(
  stage: OrchestrationStage,
  context: OrchestrationContext,
  jobRequest: JobRequest,
  run: OrchestrationRun
): Promise<StageExecutionResult> {
  const actions: string[] = [];
  let output: Record<string, unknown> = {};
  let updatedContext = { ...context };
  let decision: StepDecision;

  switch (stage) {
    case "LEAD_INTAKE": {
      actions.push("leadIntakeAgent", "propertyResolverAgent");
      
      const intakeResult = await runLeadIntakeAgent(jobRequest, context);
      const propertyResult = await runPropertyResolverAgent(jobRequest, context);
      
      output = { intake: intakeResult, property: propertyResult };
      
      // Update context with results
      updatedContext = {
        ...updatedContext,
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
      
      // Exit criteria: phone + address + services exist
      const canAdvance = 
        intakeResult.missingFields.length === 0 &&
        !!updatedContext.customerPhone &&
        !!updatedContext.address &&
        (updatedContext.services?.length || 0) > 0;
      
      decision = {
        advance: canAdvance && intakeResult.confidence !== "low" ? true : false,
        nextStage: canAdvance ? "QUOTE_BUILD" : undefined,
        confidence: intakeResult.confidence,
        waitReason: canAdvance ? "none" : "customer_response",
        notes: intakeResult.missingFields.length > 0 
          ? [`Missing fields: ${intakeResult.missingFields.join(", ")}`]
          : [],
      };
      break;
    }

    case "QUOTE_BUILD": {
      actions.push("quoteBuildAgent");
      
      const quoteResult = await runQuoteBuildAgent(jobRequest, context);
      output = { quote: quoteResult };
      
      updatedContext = {
        ...updatedContext,
        rangeLow: quoteResult.rangeLow,
        rangeHigh: quoteResult.rangeHigh,
        quoteAssumptions: quoteResult.assumptions,
      };
      
      // Exit criteria: rangeLow/rangeHigh and assumptions exist
      const canAdvance = 
        quoteResult.rangeLow > 0 && 
        quoteResult.rangeHigh > 0 &&
        quoteResult.assumptions.length > 0 &&
        quoteResult.nextStep === "ready_to_send";
      
      decision = {
        advance: canAdvance && quoteResult.confidence !== "low",
        nextStage: canAdvance ? "QUOTE_CONFIRM" : undefined,
        confidence: quoteResult.confidence,
        waitReason: quoteResult.confidence === "low" ? "ops_approval" : "none",
        notes: [`Next step: ${quoteResult.nextStep}`],
      };
      break;
    }

    case "QUOTE_CONFIRM": {
      actions.push("quoteConfirmAgent");
      
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
      output = { confirm: confirmResult };
      
      // Decision based on outcome
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
          // Will mark as lost in applyDecision
          break;
        case "question":
        case "modify":
          decision = {
            advance: false,
            nextStage: "QUOTE_BUILD", // Loop back
            confidence: confirmResult.confidence,
            waitReason: "customer_response",
            notes: [`Customer ${confirmResult.outcome}: ${confirmResult.customerMessage || "no message"}`],
          };
          break;
        default: // no_response
          decision = {
            advance: false,
            confidence: "low",
            waitReason: "customer_response",
            notes: ["Waiting for customer response"],
          };
      }
      break;
    }

    case "SCHEDULE_PROPOSE": {
      actions.push("scheduleProposeAgent");
      
      // Check if customer already selected a window (from inbound message handling)
      if (context.selectedWindow) {
        decision = {
          advance: true,
          nextStage: "SIMULATION_RUN",
          confidence: "high",
          waitReason: "none",
          notes: [`Customer selected window: ${JSON.stringify(context.selectedWindow)}`],
        };
        output = { schedule: { selectedWindow: context.selectedWindow, proposedWindows: context.proposedWindows || [] } };
        break;
      }
      
      const scheduleResult = await runScheduleProposeAgent(jobRequest, context);
      output = { schedule: scheduleResult };
      
      updatedContext = {
        ...updatedContext,
        proposedWindows: scheduleResult.proposedWindows,
      };
      
      // Need customer to select a window
      decision = {
        advance: false,
        confidence: scheduleResult.confidence,
        waitReason: "customer_response",
        notes: [`Proposed ${scheduleResult.proposedWindows.length} time windows`],
      };
      break;
    }

    case "SIMULATION_RUN": {
      actions.push("simulationRunAgent");
      
      const simResult = await runSimulationRunAgent(jobRequest, context);
      output = { simulation: simResult };
      
      updatedContext = {
        ...updatedContext,
        simulationBatchId: simResult.simulationBatchId,
        simulationRankedOptions: simResult.rankedOptions,
        topRecommendation: simResult.topRecommendation,
      };
      
      // Exit criteria: at least one ranked option exists
      const canAdvance = simResult.rankedOptions.length > 0;
      
      decision = {
        advance: canAdvance,
        nextStage: canAdvance ? "FEASIBILITY_CHECK" : undefined,
        confidence: simResult.confidence,
        waitReason: canAdvance ? "none" : "ops_approval",
        notes: [`Found ${simResult.rankedOptions.length} crew options, top score: ${simResult.topRecommendation?.totalScore || 0}`],
      };
      break;
    }

    case "FEASIBILITY_CHECK": {
      actions.push("feasibilityCheckAgent");
      
      const feasResult = await runFeasibilityCheckAgent(jobRequest, context);
      output = { feasibility: feasResult };
      
      updatedContext = {
        ...updatedContext,
        feasibilityResult: {
          feasible: feasResult.feasible,
          blockers: feasResult.blockers,
          skillsMissing: feasResult.skillsMissing,
          equipmentMissing: feasResult.equipmentMissing,
        },
      };
      
      // Exit criteria: feasible with no critical blockers
      const canAdvance = feasResult.feasible;
      
      decision = {
        advance: canAdvance,
        nextStage: canAdvance ? "MARGIN_VALIDATE" : undefined,
        confidence: feasResult.confidence,
        waitReason: canAdvance ? "none" : "ops_approval",
        notes: feasResult.blockers.length > 0 
          ? [`Blockers: ${feasResult.blockers.join(", ")}`]
          : ["Feasibility passed"],
      };
      break;
    }

    case "MARGIN_VALIDATE": {
      actions.push("marginValidateAgent");
      
      const marginResult = await runMarginValidateAgent(jobRequest, context);
      output = { margin: marginResult };
      
      updatedContext = {
        ...updatedContext,
        marginResult: {
          marginScore: marginResult.marginScore,
          marginPercent: marginResult.marginPercent,
          estimatedCost: marginResult.estimatedCost,
          estimatedRevenue: marginResult.estimatedRevenue,
          meetsThreshold: marginResult.meetsThreshold,
          warnings: marginResult.warnings,
        },
      };
      
      // Exit criteria: margin meets threshold OR ops approval
      const canAdvance = marginResult.meetsThreshold;
      
      decision = {
        advance: canAdvance,
        nextStage: canAdvance ? "CREW_LOCK" : undefined,
        confidence: marginResult.confidence,
        waitReason: canAdvance ? "none" : "ops_approval",
        notes: [`Margin score: ${marginResult.marginScore.toFixed(1)}, meets threshold: ${marginResult.meetsThreshold}`],
      };
      break;
    }

    case "CREW_LOCK": {
      actions.push("crewLockAgent");
      
      const lockResult = await runCrewLockAgent(jobRequest, context);
      output = { crewLock: lockResult };
      
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
      
      // Exit criteria: crew is locked (auto or ops approved)
      const canAdvance = lockResult.locked;
      
      decision = {
        advance: canAdvance,
        nextStage: canAdvance ? "DISPATCH_READY" : undefined,
        confidence: lockResult.confidence,
        waitReason: canAdvance ? "none" : "ops_approval",
        notes: [`${lockResult.approvalMode}: ${lockResult.lockReason}`],
      };
      break;
    }

    case "DISPATCH_READY": {
      actions.push("dispatchReadyAgent");
      
      const dispatchResult = await runDispatchReadyAgent(jobRequest, context);
      output = { dispatch: dispatchResult };
      
      updatedContext = {
        ...updatedContext,
        dispatchTaskId: dispatchResult.dispatchTaskId,
        routeSequence: dispatchResult.routeSequence,
        estimatedTravelMinutes: dispatchResult.estimatedTravelMinutes,
        scheduledStartISO: dispatchResult.scheduledStartISO,
        scheduledEndISO: dispatchResult.scheduledEndISO,
        dispatchStatus: dispatchResult.dispatchStatus,
        crewLeaderNotified: dispatchResult.notificationSent,
      };
      
      // Exit criteria: dispatch task created and queued
      const canAdvance = dispatchResult.dispatchStatus === "queued";
      
      decision = {
        advance: canAdvance,
        nextStage: canAdvance ? "JOB_BOOKED" : undefined,
        confidence: dispatchResult.confidence,
        waitReason: "none",
        notes: [`Dispatch task ${dispatchResult.dispatchTaskId} queued, route sequence: ${dispatchResult.routeSequence}`],
      };
      break;
    }

    case "JOB_BOOKED": {
      actions.push("jobBookAgent");
      
      const bookResult = await runJobBookAgent(jobRequest, context);
      output = { book: bookResult };
      
      if (bookResult.externalId) {
        updatedContext = {
          ...updatedContext,
          externalJobId: bookResult.externalId,
        };
      }
      
      decision = {
        advance: bookResult.writeback === "success" && bookResult.confirmationSent,
        confidence: bookResult.confidence,
        waitReason: "none",
        notes: [
          `Writeback: ${bookResult.writeback}`,
          `Confirmation sent: ${bookResult.confirmationSent}`,
        ],
      };
      break;
    }

    default:
      throw new Error(`Unknown stage: ${stage}`);
  }

  return { actions, output, decision, updatedContext };
}

function validateContext(context: OrchestrationContext): OrchestrationContext {
  // Validate context structure - use safeParse to avoid throwing
  const result = OrchestrationContextSchema.safeParse(context);
  if (!result.success) {
    log("warn", `Context validation failed: ${result.error.message}`);
    // Return context as-is but log the warning
  }
  return context;
}

async function applyDecision(
  run: OrchestrationRun,
  decision: StepDecision,
  updatedContext: OrchestrationContext
): Promise<void> {
  // Validate context before persisting
  const validatedContext = validateContext(updatedContext);
  const currentStage = run.currentStage as OrchestrationStage;
  
  let newStatus: string = run.status;
  let newStage: string = currentStage;
  let lifecycleStatus: string = "open";
  let memoryOutcome: "success" | "waiting" | "failed" = "waiting";

  if (decision.advance) {
    if (decision.nextStage) {
      newStage = decision.nextStage;
    } else {
      const next = getNextStage(currentStage);
      newStage = next || currentStage;
    }
    
    // If we've completed JOB_BOOKED, mark as completed
    if (newStage === "JOB_BOOKED" && currentStage === "JOB_BOOKED") {
      newStatus = "completed";
      lifecycleStatus = "won";
    } else {
      newStatus = "running";
    }
    memoryOutcome = "success";
  } else {
    // Check for special cases
    if (decision.waitReason === "customer_response") {
      newStatus = "waiting_customer";
    } else if (decision.waitReason === "ops_approval") {
      newStatus = "waiting_ops";
    }
    
    // Handle declined quote
    if (currentStage === "QUOTE_CONFIRM" && decision.notes?.some(n => n.includes("declined"))) {
      newStatus = "completed";
      lifecycleStatus = "lost";
      memoryOutcome = "failed";
    }
    
    // Handle loop back to previous stage
    if (decision.nextStage && decision.nextStage !== currentStage) {
      newStage = decision.nextStage;
      newStatus = "running";
    }
  }

  // Update run
  await db
    .update(orchestrationRuns)
    .set({
      currentStage: newStage,
      status: newStatus,
      confidence: decision.confidence,
      contextJson: validatedContext,
      waitingReason: decision.waitReason !== "none" ? decision.notes?.join("; ") : null,
      updatedAt: new Date(),
    })
    .where(eq(orchestrationRuns.id, run.id));

  // Update job request
  await db
    .update(jobRequests)
    .set({
      lifecycleStage: newStage,
      lifecycleStatus,
      updatedAt: new Date(),
    })
    .where(eq(jobRequests.id, run.primaryEntityId));
  
  // Write memory for key stages (async, non-blocking)
  const keyStages: OrchestrationStage[] = ["LEAD_INTAKE", "QUOTE_CONFIRM", "SCHEDULE_PROPOSE", "CREW_LOCK", "JOB_BOOKED"];
  if (keyStages.includes(currentStage)) {
    try {
      const { writeMemoryForStage } = await import("./memoryHooks");
      const memResult = await writeMemoryForStage(run, currentStage, validatedContext, memoryOutcome);
      if (memResult.memoriesWritten > 0) {
        log("info", `[Memory] Wrote ${memResult.memoriesWritten} memory(s) for stage ${currentStage}`);
      }
    } catch (memError) {
      log("warn", `[Memory] Failed to write memory for stage ${currentStage}: ${memError}`);
    }
  }
}

// ============================================
// HITL Functions
// ============================================

export interface HandleInboundMessageParams {
  accountId: string;
  businessId: number;
  from: string;
  to: string;
  body: string;
  messageId?: string;
}

export async function handleInboundMessage(
  params: HandleInboundMessageParams
): Promise<{ resumed: boolean; runId?: string; message: string }> {
  const { accountId, businessId, from, to, body, messageId } = params;
  const msgId = messageId || `msg_${randomUUID()}`;

  log("info", `Handling inbound message from ${from}`);

  // Find active run for this phone number
  const [run] = await db
    .select()
    .from(orchestrationRuns)
    .where(
      and(
        eq(orchestrationRuns.businessId, businessId),
        eq(orchestrationRuns.status, "waiting_customer")
      )
    )
    .orderBy(desc(orchestrationRuns.updatedAt))
    .limit(1);

  // Find associated job request by phone
  const [jobRequest] = await db
    .select()
    .from(jobRequests)
    .where(eq(jobRequests.customerPhone, from))
    .orderBy(desc(jobRequests.updatedAt))
    .limit(1);

  // Store message
  await db.insert(customerMessages).values({
    messageId: msgId,
    accountId,
    businessId,
    orchestrationRunId: run?.id || null,
    jobRequestId: jobRequest?.id || null,
    direction: "inbound",
    channel: "sms",
    fromNumber: from,
    toNumber: to,
    body,
    parsedIntent: null, // Will be parsed by agents
    intentConfidence: null,
  });

  if (!run) {
    return { resumed: false, message: "No active orchestration waiting for customer" };
  }

  // Resume orchestration
  await db
    .update(orchestrationRuns)
    .set({
      status: "running",
      waitingReason: null,
      updatedAt: new Date(),
    })
    .where(eq(orchestrationRuns.id, run.id));

  // Run next step
  const result = await runNextStep(run.runId);

  return {
    resumed: true,
    runId: run.runId,
    message: result.message,
  };
}

export interface OpsApprovalParams {
  runId: string;
  userId: number;
  stage: OrchestrationStage;
  approvalData?: Record<string, unknown>;
  notes?: string;
}

export async function handleOpsApproval(
  params: OpsApprovalParams
): Promise<{ success: boolean; message: string }> {
  const { runId, userId, stage, approvalData, notes } = params;

  log("info", `Processing ops approval for ${runId} at stage ${stage}`);

  const [run] = await db
    .select()
    .from(orchestrationRuns)
    .where(eq(orchestrationRuns.runId, runId))
    .limit(1);

  if (!run) {
    return { success: false, message: "Run not found" };
  }

  if (run.status !== "waiting_ops") {
    return { success: false, message: `Run is not waiting for ops approval (status: ${run.status})` };
  }

  if (run.currentStage !== stage) {
    return { success: false, message: `Run is at ${run.currentStage}, not ${stage}` };
  }

  // Update context with approval data if provided
  let updatedContext = run.contextJson as OrchestrationContext;
  if (approvalData) {
    if (stage === "SIMULATION_RUN" && approvalData.selectedCrewId) {
      // For manual simulation approval, build a synthetic topRecommendation
      const crewId = Number(approvalData.selectedCrewId);
      const crewName = String(approvalData.selectedCrewName || `Crew ${crewId}`);
      const proposedStartISO = String(approvalData.proposedStartISO || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      
      updatedContext = {
        ...updatedContext,
        selectedCrewIdNumeric: crewId,
        topRecommendation: {
          crewId,
          crewName,
          proposedStartISO,
          travelMinutes: Number(approvalData.travelMinutes || 15),
          skillMatchScore: 100,
          equipmentMatchScore: 100,
          distanceScore: 100,
          marginScore: Number(approvalData.marginScore || 80),
          riskScore: Number(approvalData.riskScore || 10),
          totalScore: Number(approvalData.totalScore || 80),
          reasons: ["Manual ops approval"],
        },
      };
    }
    if (stage === "CREW_LOCK" && approvalData.selectedCrewId) {
      updatedContext = {
        ...updatedContext,
        selectedCrewIdNumeric: Number(approvalData.selectedCrewId),
        selectedCrewId: String(approvalData.selectedCrewId),
      };
    }
    if (stage === "MARGIN_VALIDATE") {
      // For margin override, mark as meeting threshold
      updatedContext = {
        ...updatedContext,
        marginResult: {
          marginScore: Number(approvalData.marginScore || 75),
          marginPercent: Number(approvalData.marginPercent || 40),
          estimatedCost: Number(approvalData.estimatedCost || 0),
          estimatedRevenue: Number(approvalData.estimatedRevenue || 0),
          meetsThreshold: true, // Manual approval overrides threshold
          warnings: ["Manually approved"],
        },
      };
    }
    if (stage === "FEASIBILITY_CHECK") {
      // For feasibility override, mark as feasible
      updatedContext = {
        ...updatedContext,
        feasibilityResult: {
          feasible: true, // Manual approval overrides
          blockers: [],
          skillsMissing: [],
          equipmentMissing: [],
        },
      };
    }
    if (stage === "SCHEDULE_PROPOSE" && approvalData.selectedWindow) {
      updatedContext = {
        ...updatedContext,
        selectedWindow: approvalData.selectedWindow as any,
      };
    }
  }

  // Update run to resume
  await db
    .update(orchestrationRuns)
    .set({
      status: "running",
      contextJson: updatedContext,
      lastApprovedByUserId: userId,
      lastApprovedAt: new Date(),
      waitingReason: null,
      updatedAt: new Date(),
    })
    .where(eq(orchestrationRuns.id, run.id));

  // Advance to next stage
  const nextStage = getNextStage(stage);
  if (nextStage) {
    await db
      .update(orchestrationRuns)
      .set({ currentStage: nextStage })
      .where(eq(orchestrationRuns.id, run.id));
    
    await db
      .update(jobRequests)
      .set({ lifecycleStage: nextStage })
      .where(eq(jobRequests.id, run.primaryEntityId));
  }

  // Run next step
  const result = await runNextStep(runId);

  return { success: result.success, message: result.message };
}

export interface OpsOverrideParams {
  runId: string;
  userId: number;
  action: "advance" | "revert" | "cancel" | "inject_context";
  targetStage?: OrchestrationStage;
  contextUpdate?: Record<string, unknown>;
  notes?: string;
}

export async function handleOpsOverride(
  params: OpsOverrideParams
): Promise<{ success: boolean; message: string }> {
  const { runId, userId, action, targetStage, contextUpdate, notes } = params;

  log("info", `Processing ops override for ${runId}: ${action}`);

  const [run] = await db
    .select()
    .from(orchestrationRuns)
    .where(eq(orchestrationRuns.runId, runId))
    .limit(1);

  if (!run) {
    return { success: false, message: "Run not found" };
  }

  switch (action) {
    case "advance": {
      const nextStage = targetStage || getNextStage(run.currentStage as OrchestrationStage);
      if (!nextStage) {
        return { success: false, message: "Already at final stage" };
      }
      
      await db
        .update(orchestrationRuns)
        .set({
          currentStage: nextStage,
          status: "running",
          lastApprovedByUserId: userId,
          lastApprovedAt: new Date(),
          waitingReason: null,
          updatedAt: new Date(),
        })
        .where(eq(orchestrationRuns.id, run.id));
      
      await db
        .update(jobRequests)
        .set({ lifecycleStage: nextStage })
        .where(eq(jobRequests.id, run.primaryEntityId));
      
      // Run next step
      await runNextStep(runId);
      
      return { success: true, message: `Advanced to ${nextStage}` };
    }

    case "revert": {
      const prevStage = targetStage || getPreviousStage(run.currentStage as OrchestrationStage);
      if (!prevStage) {
        return { success: false, message: "Already at first stage" };
      }
      
      await db
        .update(orchestrationRuns)
        .set({
          currentStage: prevStage,
          status: "running",
          lastApprovedByUserId: userId,
          lastApprovedAt: new Date(),
          waitingReason: null,
          updatedAt: new Date(),
        })
        .where(eq(orchestrationRuns.id, run.id));
      
      await db
        .update(jobRequests)
        .set({ lifecycleStage: prevStage })
        .where(eq(jobRequests.id, run.primaryEntityId));
      
      return { success: true, message: `Reverted to ${prevStage}` };
    }

    case "cancel": {
      await db
        .update(orchestrationRuns)
        .set({
          status: "canceled",
          lastApprovedByUserId: userId,
          lastApprovedAt: new Date(),
          waitingReason: notes || "Canceled by ops",
          updatedAt: new Date(),
        })
        .where(eq(orchestrationRuns.id, run.id));
      
      await db
        .update(jobRequests)
        .set({ lifecycleStatus: "paused" })
        .where(eq(jobRequests.id, run.primaryEntityId));
      
      return { success: true, message: "Run canceled" };
    }

    case "inject_context": {
      if (!contextUpdate) {
        return { success: false, message: "No context update provided" };
      }
      
      const currentContext = run.contextJson as OrchestrationContext;
      const newContext = { ...currentContext, ...contextUpdate };
      
      // Validate
      const validated = OrchestrationContextSchema.safeParse(newContext);
      if (!validated.success) {
        return { success: false, message: `Invalid context: ${validated.error.message}` };
      }
      
      await db
        .update(orchestrationRuns)
        .set({
          contextJson: validated.data,
          lastApprovedByUserId: userId,
          lastApprovedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orchestrationRuns.id, run.id));
      
      return { success: true, message: "Context updated" };
    }

    default:
      return { success: false, message: `Unknown action: ${action}` };
  }
}

// ============================================
// Query Functions
// ============================================

export async function getOrchestrationRun(runId: string): Promise<{
  run: OrchestrationRun | null;
  steps: OrchestrationStep[];
  jobRequest: JobRequest | null;
}> {
  const [run] = await db
    .select()
    .from(orchestrationRuns)
    .where(eq(orchestrationRuns.runId, runId))
    .limit(1);

  if (!run) {
    return { run: null, steps: [], jobRequest: null };
  }

  const steps = await db
    .select()
    .from(orchestrationSteps)
    .where(eq(orchestrationSteps.orchestrationRunId, run.id))
    .orderBy(orchestrationSteps.stepIndex);

  const [jobRequest] = await db
    .select()
    .from(jobRequests)
    .where(eq(jobRequests.id, run.primaryEntityId))
    .limit(1);

  return { run, steps, jobRequest };
}

export async function getRunsForJobRequest(jobRequestId: number): Promise<OrchestrationRun[]> {
  return db
    .select()
    .from(orchestrationRuns)
    .where(eq(orchestrationRuns.primaryEntityId, jobRequestId))
    .orderBy(desc(orchestrationRuns.createdAt));
}
