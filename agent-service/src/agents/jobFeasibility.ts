import { storage } from "../storage";
import { Crew, JobRequest } from "@shared/schema";
import { calculateSkillMatchPct, calculateEquipmentMatchPct, computeCrewDailyLoad } from "./crewIntelligence";

const SKILL_EQUIPMENT_THRESHOLD = 0.9;
const LABOR_BUFFER_PCT = 0.15;
const LARGE_LOT_SQFT = 43560;
const HIGH_VARIANCE_SERVICES = ["cleanup", "mulch", "shrub_trim"];

export interface FeasibilityInput {
  job: JobRequest;
  crew: Crew;
  date: string;
  crewMemberCount?: number;
}

export interface FeasibilityResult {
  feasible: boolean;
  needsReview: boolean;
  reasons: string[];
  riskScore: number;
}

export async function evaluateFeasibility(input: FeasibilityInput): Promise<FeasibilityResult> {
  const { job, crew, date, crewMemberCount } = input;
  const reasons: string[] = [];
  let needsReview = false;
  let riskPoints = 0;

  const memberCount = crewMemberCount ?? (await getCrewMemberCount(crew.businessId, crew.id));

  const requiredSkills = (job.requiredSkillsJson || []) as string[];
  const crewSkills = (crew.skillsJson || []) as string[];
  const skillMatchPct = calculateSkillMatchPct(requiredSkills, crewSkills);

  if (skillMatchPct < SKILL_EQUIPMENT_THRESHOLD * 100) {
    reasons.push(`skill_match_below_threshold:${skillMatchPct.toFixed(0)}%`);
    riskPoints += 30;
  }

  const requiredEquipment = (job.requiredEquipmentJson || []) as string[];
  const crewEquipment = (crew.equipmentJson || []) as string[];
  const equipMatchPct = calculateEquipmentMatchPct(requiredEquipment, crewEquipment);

  if (equipMatchPct < SKILL_EQUIPMENT_THRESHOLD * 100) {
    reasons.push(`equipment_match_below_threshold:${equipMatchPct.toFixed(0)}%`);
    riskPoints += 30;
  }

  const crewSizeMin = job.crewSizeMin ?? 1;
  if (memberCount < crewSizeMin) {
    reasons.push(`insufficient_crew_size:need_${crewSizeMin}_have_${memberCount}`);
    riskPoints += 40;
  }

  const laborHighMinutes = job.laborHighMinutes || 60;
  const laborWithBuffer = laborHighMinutes * (1 + LABOR_BUFFER_PCT);
  
  const dailyLoad = await computeCrewDailyLoad(crew.businessId, crew.id, date);
  const dailyCapacity = crew.dailyCapacityMinutes ?? 480;
  const availableCapacity = dailyCapacity - dailyLoad.scheduledMinutes;

  if (availableCapacity < laborWithBuffer) {
    reasons.push(`capacity_exceeded:need_${Math.ceil(laborWithBuffer)}min_have_${Math.max(0, availableCapacity)}min`);
    riskPoints += 50;
  }

  const lotConfidence = job.lotConfidence ?? "high";
  const services = (job.servicesJson || []) as string[];
  const servicesLower = services.map(s => s.toLowerCase());
  
  const hasHighVarianceService = HIGH_VARIANCE_SERVICES.some(hvs => 
    servicesLower.some(s => s.includes(hvs))
  );
  
  if (lotConfidence === "low" && hasHighVarianceService) {
    reasons.push(`low_lot_confidence_high_variance_service:${services.join(",")}`);
    needsReview = true;
    riskPoints += 20;
  }

  const frequency = job.frequency?.toLowerCase() || "once";
  const lotAreaSqft = job.lotAreaSqft ?? 0;
  
  if (frequency === "monthly" && lotAreaSqft > LARGE_LOT_SQFT) {
    reasons.push(`large_lot_monthly_service:${lotAreaSqft}sqft`);
    needsReview = true;
    riskPoints += 15;
  }

  if (job.lat == null || job.lng == null) {
    reasons.push("missing_coordinates");
    needsReview = true;
    riskPoints += 25;
  }

  const feasible = !reasons.some(r => 
    r.startsWith("skill_match_below") || 
    r.startsWith("equipment_match_below") ||
    r.startsWith("insufficient_crew_size") ||
    r.startsWith("capacity_exceeded")
  );

  const riskScore = Math.min(100, riskPoints);

  return {
    feasible,
    needsReview,
    reasons,
    riskScore,
  };
}

async function getCrewMemberCount(businessId: number, crewId: number): Promise<number> {
  const members = await storage.getCrewMembers(crewId);
  return members.length || 1;
}

export function calculateRiskScore(reasons: string[]): number {
  let riskPoints = 0;
  
  for (const reason of reasons) {
    if (reason.startsWith("skill_match_below")) riskPoints += 30;
    else if (reason.startsWith("equipment_match_below")) riskPoints += 30;
    else if (reason.startsWith("insufficient_crew_size")) riskPoints += 40;
    else if (reason.startsWith("capacity_exceeded")) riskPoints += 50;
    else if (reason.startsWith("low_lot_confidence")) riskPoints += 20;
    else if (reason.startsWith("large_lot_monthly")) riskPoints += 15;
    else if (reason === "missing_coordinates") riskPoints += 25;
  }
  
  return Math.min(100, riskPoints);
}
