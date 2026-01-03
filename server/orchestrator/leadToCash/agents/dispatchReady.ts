import { randomUUID } from "crypto";
import { 
  DispatchReadyResult, 
  DispatchReadyResultSchema,
  type OrchestrationContext,
  type Confidence,
} from "@shared/orchestrator/contracts";
import { type JobRequest } from "@shared/schema";
import { storage } from "../../../storage";
import { log } from "../logger";

const DEFAULT_JOB_DURATION_MINUTES = 90;

export async function runDispatchReadyAgent(
  jobRequest: JobRequest,
  context: OrchestrationContext
): Promise<DispatchReadyResult> {
  log("info", `[DispatchReady] Starting for job request ${jobRequest.id}`);

  const topRecommendation = context.topRecommendation;
  const crewId = context.selectedCrewIdNumeric || topRecommendation?.crewId;

  // Validate required context from previous stages
  if (!crewId) {
    log("error", `[DispatchReady] No crew ID in context - crew lock stage may have failed`);
    return {
      dispatchTaskId: `dispatch_${randomUUID().slice(0, 8)}`,
      crewId: 0,
      scheduledStartISO: new Date().toISOString(),
      scheduledEndISO: new Date().toISOString(),
      routeSequence: 0,
      estimatedTravelMinutes: 0,
      dispatchStatus: "queued",
      notificationSent: false,
      confidence: "low",
    };
  }

  // Validate crew lock approval mode
  if (!context.crewLockApprovalMode && !context.decisionId) {
    log("warn", `[DispatchReady] Crew lock approval not confirmed - proceeding with caution`);
  }

  // Validate schedule data
  if (!context.proposedStartISO && !topRecommendation?.proposedStartISO && !context.selectedWindow?.startISO) {
    log("warn", `[DispatchReady] No scheduled start time in context`);
  }

  try {
    const crew = await storage.getCrew(crewId);
    if (!crew) {
      return {
        dispatchTaskId: `dispatch_${randomUUID().slice(0, 8)}`,
        crewId: crewId,
        scheduledStartISO: new Date().toISOString(),
        scheduledEndISO: new Date().toISOString(),
        routeSequence: 0,
        estimatedTravelMinutes: 0,
        dispatchStatus: "queued",
        notificationSent: false,
        confidence: "low",
      };
    }

    // Get crew leader if available
    const crewMembers = await storage.getCrewMembers(crewId);
    const leader = crewMembers.find(m => m.role === "lead");

    // Calculate schedule
    const proposedStart = context.proposedStartISO 
      || topRecommendation?.proposedStartISO 
      || context.selectedWindow?.startISO
      || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const startDate = new Date(proposedStart);
    const jobDuration = jobRequest.laborHighMinutes || DEFAULT_JOB_DURATION_MINUTES;
    const endDate = new Date(startDate.getTime() + jobDuration * 60 * 1000);

    // Get existing schedule items for this day to determine route sequence
    const profile = await storage.getBusinessProfile();
    let routeSequence = 1;
    
    if (profile) {
      const dayStart = new Date(startDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(startDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      try {
        const existingItems = await storage.getScheduleItemsByDateRange(
          profile.id,
          crewId,
          dayStart,
          dayEnd
        );
        routeSequence = existingItems.length + 1;
      } catch (e) {
        // Default to 1 if we can't get schedule items
      }
    }

    // Create dispatch task ID
    const dispatchTaskId = `dispatch_${randomUUID().slice(0, 8)}`;

    // Get travel minutes from context
    const estimatedTravelMinutes = context.estimatedTravelMinutes 
      || topRecommendation?.travelMinutes 
      || 0;

    // Create schedule item for the job
    if (profile) {
      try {
        await storage.createScheduleItem({
          businessId: profile.id,
          crewId: crewId,
          jobRequestId: jobRequest.id,
          startAt: startDate,
          endAt: endDate,
          status: "scheduled",
          notes: `Dispatched via L2C orchestrator - Task: ${dispatchTaskId}`,
        });
        log("info", `[DispatchReady] Created schedule item for job ${jobRequest.id}`);
      } catch (e) {
        log("warn", `[DispatchReady] Could not create schedule item: ${e}`);
      }
    }

    const result: DispatchReadyResult = {
      dispatchTaskId,
      crewId: crew.id,
      crewLeaderId: leader?.userId,
      scheduledStartISO: startDate.toISOString(),
      scheduledEndISO: endDate.toISOString(),
      routeSequence,
      estimatedTravelMinutes: Math.round(estimatedTravelMinutes),
      dispatchStatus: "queued",
      notificationSent: false, // Would send SMS in production
      confidence: "high",
    };

    log("info", `[DispatchReady] Completed - dispatchTaskId: ${dispatchTaskId}, routeSequence: ${routeSequence}`);

    return DispatchReadyResultSchema.parse(result);
  } catch (error) {
    log("error", `[DispatchReady] Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return {
      dispatchTaskId: `dispatch_${randomUUID().slice(0, 8)}`,
      crewId: crewId,
      scheduledStartISO: new Date().toISOString(),
      scheduledEndISO: new Date().toISOString(),
      routeSequence: 0,
      estimatedTravelMinutes: 0,
      dispatchStatus: "queued",
      notificationSent: false,
      confidence: "low",
    };
  }
}
