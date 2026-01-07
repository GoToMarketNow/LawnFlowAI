import { storage } from "../storage";
import type { Crew, JobRequest, ScheduleItem } from "@shared/schema";

export interface CapacityByDay {
  date: string; // YYYY-MM-DD
  minutes: number;
}

export interface EligibleCrew {
  crewId: number;
  name: string;
  skillsMatchPct: number;
  equipmentMatchPct: number;
  capacityRemainingByDay: CapacityByDay[];
  distanceFromHomeEstimate: number | null;
  memberCount: number;
  flags: string[];
}

export interface EligibilityThresholds {
  skillMatchMinPct: number;   // Minimum skill match % required (default: 100)
  equipmentMatchMinPct: number; // Minimum equipment match % required (default: 100)
}

export const DEFAULT_THRESHOLDS: EligibilityThresholds = {
  skillMatchMinPct: 100,
  equipmentMatchMinPct: 100,
};

const DEFAULT_DAILY_CAPACITY_MINUTES = 480; // 8 hours fallback

export interface CrewDailyLoad {
  crewId: number;
  date: string;
  scheduledMinutes: number;
  itemCount: number;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateSkillMatchPct(requiredSkills: string[], crewSkills: string[]): number {
  if (!requiredSkills || requiredSkills.length === 0) {
    return 100; // No skills required = 100% match
  }
  const crewSkillSet = new Set(crewSkills.map(s => s.toLowerCase()));
  const matches = requiredSkills.filter(skill => crewSkillSet.has(skill.toLowerCase())).length;
  return Math.round((matches / requiredSkills.length) * 100);
}

export function calculateEquipmentMatchPct(requiredEquipment: string[], crewEquipment: string[]): number {
  if (!requiredEquipment || requiredEquipment.length === 0) {
    return 100; // No equipment required = 100% match
  }
  const crewEquipSet = new Set(crewEquipment.map(e => e.toLowerCase()));
  const matches = requiredEquipment.filter(equip => crewEquipSet.has(equip.toLowerCase())).length;
  return Math.round((matches / requiredEquipment.length) * 100);
}

export async function computeCrewDailyLoad(
  businessId: number,
  crewId: number,
  date: string
): Promise<CrewDailyLoad> {
  const items: ScheduleItem[] = await storage.getScheduleItemsForCrewAndDate(businessId, crewId, date);

  let totalMinutes = 0;
  for (const item of items) {
    const start = new Date(item.startAt);
    const end = new Date(item.endAt);
    const durationMs = end.getTime() - start.getTime();
    totalMinutes += Math.round(durationMs / (1000 * 60));
  }

  return {
    crewId,
    date,
    scheduledMinutes: totalMinutes,
    itemCount: items.length,
  };
}

function getBusinessDays(startDate: Date, count: number): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  
  while (dates.length < count) {
    const day = current.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (day !== 0 && day !== 6) {
      dates.push(current.toISOString().split("T")[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

export async function getEligibleCrews(
  businessId: number,
  jobRequestId: number,
  dateRangeDays: number = 7
): Promise<EligibleCrew[]> {
  // Fetch the job request
  const jobRequest: JobRequest | undefined = await storage.getJobRequest(jobRequestId);

  if (!jobRequest) {
    throw new Error(`Job request ${jobRequestId} not found`);
  }

  // Fetch all active crews for this business
  const allCrews: Crew[] = await storage.getCrews(businessId);

  // Get business days for the date range
  const today = new Date();
  today.setDate(today.getDate() + 1); // Start from tomorrow
  const businessDays = getBusinessDays(today, dateRangeDays);

  const requiredSkills = (jobRequest.requiredSkillsJson as string[]) || [];
  const requiredEquipment = (jobRequest.requiredEquipmentJson as string[]) || [];
  const jobLat = jobRequest.lat;
  const jobLng = jobRequest.lng;
  const crewSizeMin = jobRequest.crewSizeMin || 1;

  const eligibleCrews: EligibleCrew[] = [];

  for (const crew of allCrews) {
    const flags: string[] = [];
    
    const crewSkills = (crew.skillsJson as string[]) || [];
    const crewEquipment = (crew.equipmentJson as string[]) || [];

    // Calculate skill and equipment match percentages
    const skillsMatchPct = calculateSkillMatchPct(requiredSkills, crewSkills);
    const equipmentMatchPct = calculateEquipmentMatchPct(requiredEquipment, crewEquipment);

    // Flag if not 100% skill match
    if (skillsMatchPct < 100) {
      flags.push("partial_skill_match");
    }

    // Flag if not 100% equipment match
    if (equipmentMatchPct < 100) {
      flags.push("partial_equipment_match");
    }

    // Calculate distance from home base
    let distanceFromHomeEstimate: number | null = null;
    if (crew.homeBaseLat && crew.homeBaseLng && jobLat && jobLng) {
      distanceFromHomeEstimate = haversineDistance(
        crew.homeBaseLat,
        crew.homeBaseLng,
        jobLat,
        jobLng
      );

      // Check if within service radius
      if (distanceFromHomeEstimate > crew.serviceRadiusMiles) {
        flags.push("outside_service_radius");
      }
    } else {
      // Missing coordinates - allow but flag
      flags.push("missing_coordinates");
    }

    // Get crew member count
    const memberCount = await storage.getCrewMembersCount(crew.id);

    // Check crew size requirement
    if (memberCount < crewSizeMin) {
      flags.push("insufficient_crew_size");
    }

    // Calculate capacity remaining for each day
    const capacityRemainingByDay: CapacityByDay[] = [];
    const dailyCapacity = crew.dailyCapacityMinutes ?? DEFAULT_DAILY_CAPACITY_MINUTES;
    
    for (const date of businessDays) {
      const dailyLoad = await computeCrewDailyLoad(businessId, crew.id, date);
      const remaining = dailyCapacity - dailyLoad.scheduledMinutes;
      
      capacityRemainingByDay.push({
        date,
        minutes: Math.max(0, remaining),
      });
    }

    // Check if there's any day with enough capacity
    const laborHighMinutes = jobRequest.laborHighMinutes || 60;
    const hasCapacity = capacityRemainingByDay.some(day => day.minutes >= laborHighMinutes);
    
    if (!hasCapacity) {
      flags.push("no_available_capacity");
    }

    eligibleCrews.push({
      crewId: crew.id,
      name: crew.name,
      skillsMatchPct,
      equipmentMatchPct,
      capacityRemainingByDay,
      distanceFromHomeEstimate: distanceFromHomeEstimate !== null 
        ? Math.round(distanceFromHomeEstimate * 10) / 10 
        : null,
      memberCount,
      flags,
    });
  }

  // Sort by eligibility (fewest flags first, then by skill match, then equipment match)
  eligibleCrews.sort((a, b) => {
    // First sort by number of critical flags
    const criticalFlags = ["outside_service_radius", "no_available_capacity", "insufficient_crew_size"];
    const aCritical = a.flags.filter(f => criticalFlags.includes(f)).length;
    const bCritical = b.flags.filter(f => criticalFlags.includes(f)).length;
    if (aCritical !== bCritical) return aCritical - bCritical;

    // Then by total flag count
    if (a.flags.length !== b.flags.length) return a.flags.length - b.flags.length;
    
    // Then by skill match
    if (a.skillsMatchPct !== b.skillsMatchPct) return b.skillsMatchPct - a.skillsMatchPct;
    
    // Then by equipment match
    if (a.equipmentMatchPct !== b.equipmentMatchPct) return b.equipmentMatchPct - a.equipmentMatchPct;
    
    // Finally by distance (closer is better)
    if (a.distanceFromHomeEstimate !== null && b.distanceFromHomeEstimate !== null) {
      return a.distanceFromHomeEstimate - b.distanceFromHomeEstimate;
    }
    
    return 0;
  });

  return eligibleCrews;
}

export function isCrewEligibleWithThresholds(
  crew: EligibleCrew, 
  thresholds: EligibilityThresholds = DEFAULT_THRESHOLDS
): boolean {
  // Critical flags that always disqualify
  const criticalFlags = [
    "outside_service_radius",
    "no_available_capacity",
    "insufficient_crew_size",
  ];
  
  // Check critical flags first
  if (crew.flags.some(f => criticalFlags.includes(f))) {
    return false;
  }
  
  // Check if skill match meets threshold
  if (crew.skillsMatchPct < thresholds.skillMatchMinPct) {
    return false;
  }
  
  // Check if equipment match meets threshold  
  if (crew.equipmentMatchPct < thresholds.equipmentMatchMinPct) {
    return false;
  }
  
  return true;
}

export function isCrewFullyEligible(crew: EligibleCrew): boolean {
  return isCrewEligibleWithThresholds(crew, DEFAULT_THRESHOLDS);
}

export function filterEligibleCrewsWithThresholds(
  crews: EligibleCrew[], 
  thresholds: EligibilityThresholds = DEFAULT_THRESHOLDS
): EligibleCrew[] {
  return crews.filter(c => isCrewEligibleWithThresholds(c, thresholds));
}

export function filterFullyEligibleCrews(crews: EligibleCrew[]): EligibleCrew[] {
  return crews.filter(isCrewFullyEligible);
}
