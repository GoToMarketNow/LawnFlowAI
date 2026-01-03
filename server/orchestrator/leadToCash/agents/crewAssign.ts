import type { JobRequest } from "@shared/schema";
import { db } from "../../../db";
import { crews, assignmentSimulations, type Crew } from "@shared/schema";
import { 
  type CrewAssignResult, 
  CrewAssignResultSchema,
  type OrchestrationContext,
  type CrewOption,
  validateAgentResult,
} from "@shared/orchestrator/contracts";
import { eq, and } from "drizzle-orm";
import { log } from "../logger";

// Haversine distance calculation
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimate travel time (2 min per mile as baseline)
function estimateTravelMinutes(distanceMiles: number): number {
  return Math.round(distanceMiles * 2);
}

// Score a crew for a job
function scoreCrew(
  crew: Crew,
  jobRequest: JobRequest,
  context: OrchestrationContext
): CrewOption | null {
  // Check if crew is active
  if (!crew.isActive) return null;

  // Check skills match
  const requiredSkills = (jobRequest.requiredSkillsJson as string[]) || [];
  const crewSkills = (crew.skillsJson as string[]) || [];
  
  for (const skill of requiredSkills) {
    if (!crewSkills.includes(skill)) {
      return null; // Missing required skill
    }
  }

  // Calculate distance
  let distanceMiles = 0;
  let travelMinutes = 0;
  
  if (crew.homeBaseLat && crew.homeBaseLng && context.lat && context.lng) {
    distanceMiles = haversineDistance(
      crew.homeBaseLat, crew.homeBaseLng,
      context.lat, context.lng
    );
    travelMinutes = estimateTravelMinutes(distanceMiles);
  }

  // Check service radius
  if (distanceMiles > crew.serviceRadiusMiles) {
    return null; // Outside service area
  }

  // Calculate scores
  // Travel score: penalize 2x for travel (lower is better)
  const travelPenalty = travelMinutes * 2;
  
  // Margin score: base 100, minus travel costs (assuming $0.50/min travel cost, $100/hr revenue)
  const estimatedRevenue = context.rangeHigh || 100;
  const travelCost = travelMinutes * 0.5;
  const marginScore = Math.max(0, Math.min(100, Math.round(
    ((estimatedRevenue - travelCost) / estimatedRevenue) * 100
  )));
  
  // Risk score: based on distance and capacity (lower is better)
  const riskScore = Math.min(100, Math.round(
    (distanceMiles / crew.serviceRadiusMiles) * 50 + 
    (travelMinutes / crew.dailyCapacityMinutes) * 50
  ));

  // Total score: margin bonus - travel penalty - risk (penalized 10x)
  const totalScore = marginScore - travelPenalty - (riskScore * 0.1);

  // Generate reasons
  const reasons: string[] = [];
  if (crewSkills.length > 0) {
    reasons.push(`Has skills: ${crewSkills.slice(0, 3).join(", ")}`);
  }
  if (distanceMiles < 5) {
    reasons.push("Close proximity (< 5 miles)");
  } else if (distanceMiles < 10) {
    reasons.push("Reasonable distance (< 10 miles)");
  }
  if (marginScore > 80) {
    reasons.push("High margin potential");
  }

  // Propose start time (next available slot - simplified for MVP)
  const proposedStart = context.selectedWindow?.startISO || 
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    crewId: String(crew.id),
    crewName: crew.name,
    proposedStartISO: proposedStart,
    travelMinutesDelta: travelMinutes,
    marginScore,
    riskScore,
    totalScore: Math.round(totalScore),
    reasons,
  };
}

export async function runCrewAssignAgent(
  jobRequest: JobRequest,
  context: OrchestrationContext
): Promise<CrewAssignResult> {
  log("debug", "Running crew assign agent", { jobRequestId: jobRequest.id });

  // Get all crews for this business
  const allCrews = await db
    .select()
    .from(crews)
    .where(
      and(
        eq(crews.businessId, jobRequest.businessId),
        eq(crews.isActive, true)
      )
    );

  // Score each crew
  const options: CrewOption[] = [];
  for (const crew of allCrews) {
    const option = scoreCrew(crew, jobRequest, context);
    if (option) {
      options.push(option);
    }
  }

  // Sort by total score (descending)
  options.sort((a, b) => b.totalScore - a.totalScore);

  // Take top 3
  const topOptions = options.slice(0, 3);

  // Determine mode and confidence
  let mode: "recommend_only" | "auto_assign" = "recommend_only";
  let confidence: "high" | "medium" | "low" = "low";
  let selectedOption: { crewId: string; proposedStartISO: string } | undefined;

  if (topOptions.length === 0) {
    confidence = "low";
  } else if (topOptions.length === 1) {
    confidence = "medium";
  } else {
    // Check if top option is significantly better
    const scoreDiff = topOptions[0].totalScore - (topOptions[1]?.totalScore || 0);
    if (scoreDiff > 20 && topOptions[0].totalScore > 50) {
      confidence = "high";
      mode = "auto_assign";
      selectedOption = {
        crewId: topOptions[0].crewId,
        proposedStartISO: topOptions[0].proposedStartISO,
      };
    } else {
      confidence = "medium";
    }
  }

  const result: CrewAssignResult = {
    topOptions,
    selectedOption,
    mode,
    confidence,
  };

  return validateAgentResult(CrewAssignResultSchema, result, "crewAssignAgent");
}
