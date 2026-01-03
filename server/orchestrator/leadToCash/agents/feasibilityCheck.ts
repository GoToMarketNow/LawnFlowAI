import { 
  FeasibilityCheckResult, 
  FeasibilityCheckResultSchema,
  type OrchestrationContext,
  type Confidence,
} from "@shared/orchestrator/contracts";
import { type JobRequest } from "@shared/schema";
import { evaluateFeasibility, type FeasibilityInput } from "../../../agents/jobFeasibility";
import { storage } from "../../../storage";
import { log } from "../logger";

export async function runFeasibilityCheckAgent(
  jobRequest: JobRequest,
  context: OrchestrationContext
): Promise<FeasibilityCheckResult> {
  log("info", `[FeasibilityCheck] Starting for job request ${jobRequest.id}`);

  const topRecommendation = context.topRecommendation;
  if (!topRecommendation) {
    log("warn", `[FeasibilityCheck] No top recommendation in context`);
    return {
      feasible: false,
      crewId: 0,
      crewName: "Unknown",
      skillsMatched: [],
      skillsMissing: context.services || [],
      equipmentMatched: [],
      equipmentMissing: [],
      withinServiceRadius: false,
      hasCapacity: false,
      blockers: ["No crew recommendation available from simulation"],
      confidence: "low",
    };
  }

  try {
    const crew = await storage.getCrew(topRecommendation.crewId);
    if (!crew) {
      return {
        feasible: false,
        crewId: topRecommendation.crewId,
        crewName: topRecommendation.crewName,
        skillsMatched: [],
        skillsMissing: [],
        equipmentMatched: [],
        equipmentMissing: [],
        withinServiceRadius: false,
        hasCapacity: false,
        blockers: [`Crew ${topRecommendation.crewId} not found`],
        confidence: "low",
      };
    }

    // Get proposed date
    const proposedDate = context.selectedWindow?.startISO 
      ? new Date(context.selectedWindow.startISO).toISOString().split('T')[0]
      : topRecommendation.proposedStartISO
        ? new Date(topRecommendation.proposedStartISO).toISOString().split('T')[0]
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Build input for feasibility agent
    const feasibilityInput: FeasibilityInput = {
      job: jobRequest,
      crew: crew,
      date: proposedDate,
    };

    const feasibility = await evaluateFeasibility(feasibilityInput);

    // Extract skills/equipment analysis
    const requiredSkills = (jobRequest.requiredSkillsJson as string[]) || context.services || [];
    const crewSkills = (crew.skillsJson as string[]) || [];
    const skillsMatched = requiredSkills.filter(s => 
      crewSkills.some(cs => cs.toLowerCase() === s.toLowerCase())
    );
    const skillsMissing = requiredSkills.filter(s => 
      !crewSkills.some(cs => cs.toLowerCase() === s.toLowerCase())
    );

    const requiredEquipment = (jobRequest.requiredEquipmentJson as string[]) || [];
    const crewEquipment = (crew.equipmentJson as string[]) || [];
    const equipmentMatched = requiredEquipment.filter(e => 
      crewEquipment.some(ce => ce.toLowerCase() === e.toLowerCase())
    );
    const equipmentMissing = requiredEquipment.filter(e => 
      !crewEquipment.some(ce => ce.toLowerCase() === e.toLowerCase())
    );

    // Build blockers from feasibility reasons
    const blockers: string[] = [];
    if (!feasibility.feasible) {
      blockers.push(...feasibility.reasons);
    }
    if (skillsMissing.length > 0) {
      blockers.push(`Missing skills: ${skillsMissing.join(", ")}`);
    }
    if (equipmentMissing.length > 0) {
      blockers.push(`Missing equipment: ${equipmentMissing.join(", ")}`);
    }

    // Determine within radius and capacity from reasons
    const withinServiceRadius = !feasibility.reasons.some(r => r.includes("outside_service_radius"));
    const hasCapacity = !feasibility.reasons.some(r => r.includes("capacity_exceeded"));

    let confidence: Confidence = "medium";
    if (feasibility.feasible && blockers.length === 0) {
      confidence = "high";
    } else if (!feasibility.feasible) {
      confidence = "low";
    }

    const result: FeasibilityCheckResult = {
      feasible: feasibility.feasible && skillsMissing.length === 0,
      crewId: crew.id,
      crewName: crew.name,
      skillsMatched,
      skillsMissing,
      equipmentMatched,
      equipmentMissing,
      withinServiceRadius,
      hasCapacity,
      blockers,
      confidence,
    };

    log("info", `[FeasibilityCheck] Completed - feasible: ${result.feasible}, blockers: ${blockers.length}`);

    return FeasibilityCheckResultSchema.parse(result);
  } catch (error) {
    log("error", `[FeasibilityCheck] Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return {
      feasible: false,
      crewId: topRecommendation.crewId,
      crewName: topRecommendation.crewName,
      skillsMatched: [],
      skillsMissing: [],
      equipmentMatched: [],
      equipmentMissing: [],
      withinServiceRadius: false,
      hasCapacity: false,
      blockers: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      confidence: "low",
    };
  }
}
