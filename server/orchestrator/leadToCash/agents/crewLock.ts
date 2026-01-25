import { 
  CrewLockResult, 
  CrewLockResultSchema,
  type OrchestrationContext,
  type Confidence,
} from "@shared/orchestrator/contracts";
import { type JobRequest } from "@shared/schema";
import { storage } from "../../../storage";
import { log } from "../logger";

const AUTO_APPROVE_SCORE_THRESHOLD = 80;
const AUTO_APPROVE_MARGIN_THRESHOLD = 70;

export async function runCrewLockAgent(
  jobRequest: JobRequest,
  context: OrchestrationContext
): Promise<CrewLockResult> {
  log("info", `[CrewLock] Starting for job request ${jobRequest.id}`);

  const topRecommendation = context.topRecommendation;
  const marginResult = context.marginResult;
  const feasibilityResult = context.feasibilityResult;

  if (!topRecommendation) {
    log("warn", `[CrewLock] No top recommendation in context`);
    return {
      locked: false,
      crewId: 0,
      crewName: "Unknown",
      proposedStartISO: new Date().toISOString(),
      approvalMode: "ops_required",
      lockReason: "No crew recommendation available",
      confidence: "low",
    };
  }

  try {
    const crew = await storage.getCrew(topRecommendation.crewId);
    if (!crew) {
      return {
        locked: false,
        crewId: topRecommendation.crewId,
        crewName: topRecommendation.crewName,
        proposedStartISO: topRecommendation.proposedStartISO,
        approvalMode: "ops_required",
        lockReason: `Crew ${topRecommendation.crewId} not found`,
        confidence: "low",
      };
    }

    // Check if we can auto-approve
    const canAutoApprove = 
      topRecommendation.totalScore >= AUTO_APPROVE_SCORE_THRESHOLD &&
      (marginResult?.meetsThreshold ?? true) &&
      (feasibilityResult?.feasible ?? true);

    const approvalMode = canAutoApprove ? "auto_approved" : "ops_required";

    // Build lock reason
    const lockReasons: string[] = [];
    if (canAutoApprove) {
      lockReasons.push(`Auto-approved: score ${topRecommendation.totalScore.toFixed(1)}`);
    } else {
      if (topRecommendation.totalScore < AUTO_APPROVE_SCORE_THRESHOLD) {
        lockReasons.push(`Score ${topRecommendation.totalScore.toFixed(1)} below auto-approve threshold`);
      }
      if (marginResult && !marginResult.meetsThreshold) {
        lockReasons.push(`Margin ${marginResult.marginScore.toFixed(1)} below threshold`);
      }
      if (feasibilityResult && !feasibilityResult.feasible) {
        lockReasons.push(`Feasibility blockers: ${feasibilityResult.blockers.length}`);
      }
    }

    // Determine confidence
    let confidence: Confidence = "medium";
    if (canAutoApprove) {
      confidence = "high";
    } else if (!feasibilityResult?.feasible || !marginResult?.meetsThreshold) {
      confidence = "low";
    }

    // Create decision record if auto-approved
    let decisionId: number | undefined;
    if (canAutoApprove) {
      try {
        // Get simulation ID from context if available
        const decision = await storage.createDecision({
          jobRequestId: jobRequest.id,
          simulationId: null, // Will need to track simulation ID
          selectedCrewId: crew.id,
          reasoningJson: {
            score: topRecommendation.totalScore,
            marginScore: marginResult?.marginScore || topRecommendation.marginScore,
            feasible: feasibilityResult?.feasible ?? true,
            autoApproved: true,
          },
          status: "approved",
        });
        decisionId = decision.id;
        log("info", `[CrewLock] Created decision ${decisionId} for auto-approved crew ${crew.id}`);
      } catch (e) {
        log("warn", `[CrewLock] Could not create decision record: ${e}`);
      }
    }

    const result: CrewLockResult = {
      locked: canAutoApprove,
      crewId: crew.id,
      crewName: crew.name,
      proposedStartISO: topRecommendation.proposedStartISO,
      decisionId,
      approvalMode,
      lockReason: lockReasons.join("; "),
      confidence,
    };

    log("info", `[CrewLock] Completed - locked: ${result.locked}, mode: ${approvalMode}`);

    return CrewLockResultSchema.parse(result);
  } catch (error) {
    log("error", `[CrewLock] Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return {
      locked: false,
      crewId: topRecommendation.crewId,
      crewName: topRecommendation.crewName,
      proposedStartISO: topRecommendation.proposedStartISO,
      approvalMode: "ops_required",
      lockReason: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      confidence: "low",
    };
  }
}
