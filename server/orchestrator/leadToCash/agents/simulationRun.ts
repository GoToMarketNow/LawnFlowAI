import { randomUUID } from "crypto";
import { 
  SimulationRunResult, 
  SimulationRunResultSchema,
  type SimulationCrewOption,
  type OrchestrationContext,
  type Confidence,
} from "@shared/orchestrator/contracts";
import { type JobRequest } from "@shared/schema";
import { 
  getEligibleCrews, 
  filterEligibleCrewsWithThresholds,
  DEFAULT_THRESHOLDS,
} from "../../../agents/crewIntelligence";
import { runSimulations, type SimulationResult } from "../../../agents/simulationRanking";
import { storage } from "../../../storage";
import { log } from "../logger";

const AUTO_ADVANCE_SCORE_THRESHOLD = 75;
const MIN_ELIGIBLE_CREWS = 1;
const AVG_SPEED_MPH = 30;

export async function runSimulationRunAgent(
  jobRequest: JobRequest,
  context: OrchestrationContext
): Promise<SimulationRunResult> {
  log("info", `[SimulationRun] Starting for job request ${jobRequest.id}`);

  const simulationBatchId = `sim_${randomUUID().slice(0, 8)}`;
  
  try {
    const profile = await storage.getBusinessProfile();
    if (!profile) {
      return {
        simulationBatchId,
        eligibleCrewCount: 0,
        rankedOptions: [],
        confidence: "low",
      };
    }

    // Get eligible crews using crew intelligence
    const eligibleCrews = await getEligibleCrews(
      profile.id,
      jobRequest.id,
      7 // 7 day date range
    );

    // Apply thresholds
    const filteredCrews = filterEligibleCrewsWithThresholds(
      eligibleCrews,
      DEFAULT_THRESHOLDS
    );

    log("info", `[SimulationRun] Found ${filteredCrews.length} eligible crews`);

    if (filteredCrews.length < MIN_ELIGIBLE_CREWS) {
      log("warn", `[SimulationRun] Not enough eligible crews (${filteredCrews.length})`);
      return {
        simulationBatchId,
        eligibleCrewCount: filteredCrews.length,
        rankedOptions: [],
        confidence: "low",
      };
    }

    // Run simulations
    const simResult: SimulationResult = await runSimulations(
      profile.id,
      jobRequest.id,
      { persistTopN: 10, returnTopN: 5 }
    );

    // Convert to our contract format
    const rankedOptions: SimulationCrewOption[] = simResult.simulations.map((sim) => {
      const eligibleCrew = simResult.eligibleCrews.find(c => c.crewId === sim.crewId);
      
      // Calculate travel minutes from distance
      const distanceMiles = eligibleCrew?.distanceFromHomeEstimate || 0;
      const travelMinutes = distanceMiles > 0 ? (distanceMiles / AVG_SPEED_MPH) * 60 : 0;
      
      return {
        crewId: sim.crewId,
        crewName: eligibleCrew?.name || `Crew ${sim.crewId}`,
        proposedStartISO: sim.proposedDate 
          ? new Date(sim.proposedDate + "T09:00:00").toISOString()
          : context.selectedWindow?.startISO || new Date().toISOString(),
        travelMinutes: Math.round(travelMinutes),
        skillMatchScore: eligibleCrew?.skillsMatchPct || 100,
        equipmentMatchScore: eligibleCrew?.equipmentMatchPct || 100,
        distanceScore: distanceMiles > 0 ? Math.max(0, 100 - distanceMiles * 2) : 100,
        marginScore: sim.marginScore,
        riskScore: sim.riskScore,
        totalScore: sim.totalScore,
        reasons: [
          `Score: ${sim.totalScore.toFixed(1)}`,
          `Margin: ${sim.marginScore.toFixed(1)}`,
          `Travel: ${Math.round(travelMinutes)} min`,
        ],
      };
    }).sort((a, b) => b.totalScore - a.totalScore);

    // Determine confidence based on top option score
    let confidence: Confidence = "medium";
    if (rankedOptions.length > 0) {
      const topScore = rankedOptions[0].totalScore;
      if (topScore >= AUTO_ADVANCE_SCORE_THRESHOLD) {
        confidence = "high";
      } else if (topScore < 50) {
        confidence = "low";
      }
    }

    const result: SimulationRunResult = {
      simulationBatchId,
      eligibleCrewCount: filteredCrews.length,
      rankedOptions,
      topRecommendation: rankedOptions[0],
      confidence,
    };

    log("info", `[SimulationRun] Completed with ${rankedOptions.length} options, top score: ${rankedOptions[0]?.totalScore || 0}`);

    return SimulationRunResultSchema.parse(result);
  } catch (error) {
    log("error", `[SimulationRun] Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return {
      simulationBatchId,
      eligibleCrewCount: 0,
      rankedOptions: [],
      confidence: "low",
    };
  }
}
