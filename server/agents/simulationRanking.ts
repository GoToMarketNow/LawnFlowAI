/**
 * Simulation & Ranking Agent
 * 
 * Generates assignment simulations across eligible crews and dates,
 * scores each candidate using a deterministic formula, and returns
 * the top-ranked options.
 */

import { storage } from "../storage";
import { 
  getEligibleCrews, 
  filterEligibleCrewsWithThresholds,
  type EligibleCrew,
  type EligibilityThresholds,
  DEFAULT_THRESHOLDS 
} from "./crewIntelligence";
import { evaluateFeasibility } from "./jobFeasibility";
import { getCrewToJobTravelMinutes } from "./routeCost";
import { computeMarginScore } from "./marginBurn";
import type { JobRequest, Crew, AssignmentSimulation } from "@shared/schema";

export interface SimulationConfig {
  dateRangeDays?: number;
  skillMatchMinPct?: number;
  equipmentMatchMinPct?: number;
  persistTopN?: number;
  returnTopN?: number;
}

export interface SimulationCandidate {
  crewId: number;
  crewName: string;
  proposedDate: string;
  insertionType: "anytime" | "before" | "after" | "between";
  travelMinutesDelta: number;
  travelSource: "api" | "cache" | "haversine" | "estimate";
  loadMinutesDelta: number;
  marginScore: number;
  riskScore: number;
  totalScore: number;
  explanationJson: SimulationExplanation;
}

export interface SimulationExplanation {
  whyThisCrew: string;
  whyThisDate: string;
  travelImpact: {
    minutes: number;
    source: string;
    distanceFromHomeKm: number | null;
  };
  loadRemaining: {
    beforeJob: number;
    afterJob: number;
    percentUsed: number;
  };
  riskFlags: string[];
  feasibility: {
    feasible: boolean;
    needsReview: boolean;
    reasons: string[];
  };
  marginBurn: {
    burnMinutes: number;
    estLaborCost: number;
    estEquipmentCost: number;
    estTotalCost: number;
    revenueEstimate: number | null;
    notes: string[];
  };
  scoring: {
    travelComponent: number;
    marginComponent: number;
    riskComponent: number;
    rawTotal: number;
    clampedTotal: number;
  };
}

export interface SimulationResult {
  simulations: AssignmentSimulation[];
  eligibleCrews: EligibleCrew[];
  thresholdsUsed: EligibilityThresholds;
  candidatesGenerated: number;
  candidatesPersisted: number;
}

const DEFAULT_CONFIG: Required<SimulationConfig> = {
  dateRangeDays: 7,
  skillMatchMinPct: 100,
  equipmentMatchMinPct: 100,
  persistTopN: 10,
  returnTopN: 3,
};

/**
 * Calculate the total score for a simulation candidate
 * Formula: totalScore = (100 - travelMinutesDelta*2) + marginScore - riskScore*10
 * Clamped to 0-200
 */
export function calculateTotalScore(
  travelMinutesDelta: number,
  marginScore: number,
  riskScore: number
): { rawScore: number; clampedScore: number; components: { travel: number; margin: number; risk: number } } {
  const travelComponent = 100 - (travelMinutesDelta * 2);
  const marginComponent = marginScore;
  const riskComponent = riskScore * 10;
  
  const rawScore = travelComponent + marginComponent - riskComponent;
  const clampedScore = Math.max(0, Math.min(200, rawScore));
  
  return {
    rawScore,
    clampedScore,
    components: {
      travel: travelComponent,
      margin: marginComponent,
      risk: riskComponent,
    },
  };
}

/**
 * Generate a human-readable explanation for why this crew was selected
 */
function generateCrewReasoning(
  crew: Crew,
  eligibleCrew: EligibleCrew,
  marginScore: number,
  travelMinutes: number
): string {
  const reasons: string[] = [];
  
  if (eligibleCrew.skillsMatchPct === 100) {
    reasons.push("100% skill match");
  } else {
    reasons.push(`${eligibleCrew.skillsMatchPct}% skill match`);
  }
  
  if (eligibleCrew.equipmentMatchPct === 100) {
    reasons.push("all required equipment");
  }
  
  if (eligibleCrew.memberCount >= 2) {
    reasons.push(`${eligibleCrew.memberCount}-person crew`);
  }
  
  if (travelMinutes <= 15) {
    reasons.push("short travel time");
  } else if (travelMinutes <= 30) {
    reasons.push("moderate travel time");
  }
  
  if (marginScore >= 80) {
    reasons.push("high margin potential");
  }
  
  return reasons.length > 0 
    ? `${crew.name}: ${reasons.join(", ")}`
    : `${crew.name} is available`;
}

/**
 * Generate a human-readable explanation for why this date was selected
 */
function generateDateReasoning(
  proposedDate: string,
  capacityRemaining: number,
  dailyCapacity: number,
  dayOffset: number
): string {
  const reasons: string[] = [];
  const capacityPercent = Math.round((capacityRemaining / dailyCapacity) * 100);
  
  if (dayOffset === 0) {
    reasons.push("same day availability");
  } else if (dayOffset === 1) {
    reasons.push("next day availability");
  } else if (dayOffset <= 3) {
    reasons.push("within 3 days");
  } else {
    reasons.push(`${dayOffset} days out`);
  }
  
  if (capacityPercent >= 80) {
    reasons.push(`${capacityPercent}% capacity available`);
  } else if (capacityPercent >= 50) {
    reasons.push(`${capacityPercent}% capacity remaining`);
  } else {
    reasons.push(`${capacityPercent}% capacity left`);
  }
  
  return reasons.join(", ");
}

/**
 * Run simulations for a job request across eligible crews and dates
 */
export async function runSimulations(
  businessId: number,
  jobRequestId: number,
  config: SimulationConfig = {}
): Promise<SimulationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const jobRequest = await storage.getJobRequest(jobRequestId);
  if (!jobRequest) {
    throw new Error(`Job request ${jobRequestId} not found`);
  }

  // Delete existing decisions first (they reference simulations via FK)
  await storage.deleteDecisionsForJobRequest(jobRequestId);
  await storage.deleteSimulationsForJobRequest(jobRequestId);

  const eligibleCrews = await getEligibleCrews(businessId, jobRequestId, cfg.dateRangeDays);
  
  if (eligibleCrews.length === 0) {
    return {
      simulations: [],
      eligibleCrews: [],
      thresholdsUsed: DEFAULT_THRESHOLDS,
      candidatesGenerated: 0,
      candidatesPersisted: 0,
    };
  }

  const thresholds: EligibilityThresholds = {
    skillMatchMinPct: Math.max(0, Math.min(100, cfg.skillMatchMinPct)),
    equipmentMatchMinPct: Math.max(0, Math.min(100, cfg.equipmentMatchMinPct)),
  };

  const fullyEligible = filterEligibleCrewsWithThresholds(eligibleCrews, thresholds);

  if (fullyEligible.length === 0) {
    return {
      simulations: [],
      eligibleCrews,
      thresholdsUsed: thresholds,
      candidatesGenerated: 0,
      candidatesPersisted: 0,
    };
  }

  const candidates: SimulationCandidate[] = [];
  const laborMinutes = jobRequest.laborHighMinutes || jobRequest.laborLowMinutes || 60;
  const today = new Date();

  for (const eligibleCrew of fullyEligible) {
    const crew = await storage.getCrew(eligibleCrew.crewId);
    if (!crew) continue;

    let travelMinutes = 15;
    let travelSource: "api" | "cache" | "haversine" | "estimate" = "estimate";
    
    const travelEstimate = await getCrewToJobTravelMinutes(
      businessId,
      { lat: crew.homeBaseLat, lng: crew.homeBaseLng },
      { lat: jobRequest.lat, lng: jobRequest.lng }
    );
    
    if (travelEstimate) {
      travelMinutes = travelEstimate.minutes;
      travelSource = travelEstimate.source;
    } else if (eligibleCrew.distanceFromHomeEstimate !== null) {
      travelMinutes = Math.round(eligibleCrew.distanceFromHomeEstimate * 2);
      travelSource = "haversine";
    }

    const loadDelta = laborMinutes + travelMinutes * 2;

    const requiredEquipment = Array.isArray(jobRequest.requiredEquipmentJson) 
      ? (jobRequest.requiredEquipmentJson as string[])
      : [];

    const marginResult = computeMarginScore({
      laborLowMinutes: jobRequest.laborLowMinutes,
      laborHighMinutes: jobRequest.laborHighMinutes,
      travelMinutesDelta: travelMinutes,
      crewSizeMin: jobRequest.crewSizeMin,
      lotAreaSqft: jobRequest.lotAreaSqft,
      requiredEquipment,
    });

    for (const dayCapacity of eligibleCrew.capacityRemainingByDay) {
      if (dayCapacity.minutes < laborMinutes) {
        continue;
      }

      const feasibility = await evaluateFeasibility({
        job: jobRequest,
        crew,
        date: dayCapacity.date,
        crewMemberCount: eligibleCrew.memberCount,
      });

      if (!feasibility.feasible) {
        continue;
      }

      const proposedDate = new Date(dayCapacity.date);
      const dayOffset = Math.round((proposedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const { clampedScore, rawScore, components } = calculateTotalScore(
        travelMinutes,
        marginResult.marginScore,
        feasibility.riskScore
      );

      const riskFlags: string[] = [];
      if (feasibility.needsReview) {
        riskFlags.push("needs_manual_review");
      }
      if (travelMinutes > 30) {
        riskFlags.push("long_travel");
      }
      if (dayCapacity.minutes - loadDelta < 60) {
        riskFlags.push("tight_capacity");
      }
      if (feasibility.riskScore > 30) {
        riskFlags.push("elevated_risk");
      }

      const explanation: SimulationExplanation = {
        whyThisCrew: generateCrewReasoning(crew, eligibleCrew, marginResult.marginScore, travelMinutes),
        whyThisDate: generateDateReasoning(dayCapacity.date, dayCapacity.minutes, crew.dailyCapacityMinutes, dayOffset),
        travelImpact: {
          minutes: travelMinutes,
          source: travelSource,
          distanceFromHomeKm: eligibleCrew.distanceFromHomeEstimate,
        },
        loadRemaining: {
          beforeJob: dayCapacity.minutes,
          afterJob: dayCapacity.minutes - loadDelta,
          percentUsed: Math.round((loadDelta / crew.dailyCapacityMinutes) * 100),
        },
        riskFlags,
        feasibility: {
          feasible: feasibility.feasible,
          needsReview: feasibility.needsReview,
          reasons: feasibility.reasons,
        },
        marginBurn: {
          burnMinutes: marginResult.burnMinutes,
          estLaborCost: marginResult.estLaborCost,
          estEquipmentCost: marginResult.estEquipmentCost,
          estTotalCost: marginResult.estTotalCost,
          revenueEstimate: marginResult.revenueEstimate,
          notes: marginResult.notes,
        },
        scoring: {
          travelComponent: components.travel,
          marginComponent: components.margin,
          riskComponent: components.risk,
          rawTotal: rawScore,
          clampedTotal: clampedScore,
        },
      };

      candidates.push({
        crewId: crew.id,
        crewName: crew.name,
        proposedDate: dayCapacity.date,
        insertionType: "anytime",
        travelMinutesDelta: travelMinutes,
        travelSource,
        loadMinutesDelta: loadDelta,
        marginScore: marginResult.marginScore,
        riskScore: feasibility.riskScore,
        totalScore: clampedScore,
        explanationJson: explanation,
      });
    }
  }

  candidates.sort((a, b) => b.totalScore - a.totalScore);

  const toPersist = candidates.slice(0, cfg.persistTopN);
  const persistedSimulations: AssignmentSimulation[] = [];

  for (const candidate of toPersist) {
    const sim = await storage.createSimulation({
      businessId,
      jobRequestId,
      crewId: candidate.crewId,
      proposedDate: candidate.proposedDate,
      insertionType: candidate.insertionType,
      travelMinutesDelta: candidate.travelMinutesDelta,
      loadMinutesDelta: candidate.loadMinutesDelta,
      marginScore: candidate.marginScore,
      riskScore: candidate.riskScore,
      totalScore: candidate.totalScore,
      explanationJson: candidate.explanationJson,
    });
    persistedSimulations.push(sim);
  }

  await storage.updateJobRequest(jobRequestId, { status: "simulated" });

  return {
    simulations: persistedSimulations.slice(0, cfg.returnTopN),
    eligibleCrews,
    thresholdsUsed: thresholds,
    candidatesGenerated: candidates.length,
    candidatesPersisted: persistedSimulations.length,
  };
}
