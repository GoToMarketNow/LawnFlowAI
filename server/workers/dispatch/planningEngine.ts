import type { 
  CrewRoster, 
  RouteStop, 
  CrewAssignment, 
  DispatchPlanResult,
  ServiceZone,
  CrewZoneAssignment
} from "@shared/schema";
import type { JobForDispatch } from "../../connectors/jobber-dispatch-client";

interface Coordinates {
  lat: number;
  lng: number;
}

export interface CrewZoneData {
  crewId: number;
  zones: Array<{
    zone: ServiceZone;
    isPrimary: boolean;
    priority: number;
  }>;
}

function isPointInBoundingBox(
  lat: number,
  lng: number,
  zone: ServiceZone
): boolean {
  if (zone.minLat == null || zone.maxLat == null || zone.minLng == null || zone.maxLng == null) {
    return false;
  }
  return (
    lat >= Number(zone.minLat) &&
    lat <= Number(zone.maxLat) &&
    lng >= Number(zone.minLng) &&
    lng <= Number(zone.maxLng)
  );
}

function isPointInCircle(
  lat: number,
  lng: number,
  zone: ServiceZone
): boolean {
  if (zone.centerLat == null || zone.centerLng == null || zone.radiusMiles == null) {
    return false;
  }
  const distance = haversineDistance(
    { lat, lng },
    { lat: Number(zone.centerLat), lng: Number(zone.centerLng) }
  );
  return distance <= Number(zone.radiusMiles);
}

function isPointInZone(lat: number, lng: number, zone: ServiceZone): boolean {
  if (!zone.isActive) return false;
  const hasBoundingBox = zone.minLat != null && zone.maxLat != null && zone.minLng != null && zone.maxLng != null;
  const hasCircle = zone.centerLat != null && zone.centerLng != null && zone.radiusMiles != null;
  if (hasBoundingBox) {
    return isPointInBoundingBox(lat, lng, zone);
  }
  if (hasCircle) {
    return isPointInCircle(lat, lng, zone);
  }
  return false;
}

function getZoneMatchScore(
  jobLat: number,
  jobLng: number,
  crewZones: CrewZoneData | undefined
): { score: number; matchedZone: ServiceZone | null; isPrimary: boolean } {
  if (!crewZones || crewZones.zones.length === 0) {
    return { score: 0, matchedZone: null, isPrimary: false };
  }
  const primaryZones = crewZones.zones.filter(z => z.isPrimary).sort((a, b) => b.priority - a.priority);
  for (const zoneData of primaryZones) {
    if (isPointInZone(jobLat, jobLng, zoneData.zone)) {
      return { score: 20, matchedZone: zoneData.zone, isPrimary: true };
    }
  }
  const backupZones = crewZones.zones.filter(z => !z.isPrimary).sort((a, b) => b.priority - a.priority);
  for (const zoneData of backupZones) {
    if (isPointInZone(jobLat, jobLng, zoneData.zone)) {
      return { score: 10, matchedZone: zoneData.zone, isPrimary: false };
    }
  }
  return { score: 0, matchedZone: null, isPrimary: false };
}

function haversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 3959;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function estimateDriveMinutes(distanceMiles: number): number {
  const avgSpeedMph = 25;
  return Math.round((distanceMiles / avgSpeedMph) * 60);
}

function buildDistanceMatrix(
  jobs: JobForDispatch[],
  crews: CrewRoster[]
): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();
  
  const allPoints: Array<{ id: string; lat: number; lng: number }> = [];
  
  for (const crew of crews) {
    if (crew.homeBaseLat && crew.homeBaseLng) {
      allPoints.push({
        id: `crew_${crew.id}`,
        lat: crew.homeBaseLat,
        lng: crew.homeBaseLng,
      });
    }
  }
  
  for (const job of jobs) {
    if (job.lat && job.lng) {
      allPoints.push({
        id: `job_${job.id}`,
        lat: job.lat,
        lng: job.lng,
      });
    }
  }

  for (const p1 of allPoints) {
    const row = new Map<string, number>();
    for (const p2 of allPoints) {
      if (p1.id === p2.id) {
        row.set(p2.id, 0);
      } else {
        const dist = haversineDistance(
          { lat: p1.lat, lng: p1.lng },
          { lat: p2.lat, lng: p2.lng }
        );
        row.set(p2.id, estimateDriveMinutes(dist));
      }
    }
    matrix.set(p1.id, row);
  }

  return matrix;
}

function getCrewAvailabilityMins(crew: CrewRoster): number {
  const [startH, startM] = (crew.availabilityStart || "08:00").split(":").map(Number);
  const [endH, endM] = (crew.availabilityEnd || "17:00").split(":").map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}

const EQUIPMENT_REQUIREMENTS: Record<string, string[]> = {
  aeration: ["aerator"],
  aerating: ["aerator"],
  mulching: ["trailer"],
  mulch: ["trailer"],
  landscaping: ["trailer"],
  hardscape: ["trailer", "skid_steer"],
  irrigation: ["trencher"],
  tree_removal: ["chainsaw", "trailer"],
  stump_grinding: ["stump_grinder"],
};

function checkEquipmentCompatibility(
  job: JobForDispatch,
  crew: CrewRoster
): boolean {
  const capabilities = new Set((crew.equipmentCapabilities || []).map(c => c.toLowerCase()));
  const serviceType = job.serviceType.toLowerCase();
  
  for (const [keyword, requiredEquipment] of Object.entries(EQUIPMENT_REQUIREMENTS)) {
    if (serviceType.includes(keyword)) {
      const hasAllRequired = requiredEquipment.every(eq => capabilities.has(eq));
      if (!hasAllRequired) {
        return false;
      }
    }
  }
  
  return true;
}

export function computeDispatchPlan(
  jobs: JobForDispatch[],
  crews: CrewRoster[],
  planDate: Date,
  crewZoneData?: Map<number, CrewZoneData>
): DispatchPlanResult {
  const startTime = Date.now();
  const warnings: string[] = [];
  
  const activeCrews = crews.filter(c => c.isActive);
  if (activeCrews.length === 0) {
    return {
      planDate: planDate.toISOString(),
      assignments: [],
      unassignedJobs: jobs.map(j => j.id),
      totalDriveMins: 0,
      overallUtilization: 0,
      warnings: ["No active crews available"],
    };
  }

  const validJobs = jobs.filter(j => j.lat && j.lng);
  const invalidJobs = jobs.filter(j => !j.lat || !j.lng);
  
  if (invalidJobs.length > 0) {
    warnings.push(`${invalidJobs.length} jobs have no coordinates and cannot be routed`);
  }

  const distanceMatrix = buildDistanceMatrix(validJobs, activeCrews);

  const crewState: Map<number, {
    crew: CrewRoster;
    assignedJobs: JobForDispatch[];
    currentLocation: string;
    usedMinutes: number;
    availableMinutes: number;
  }> = new Map();

  for (const crew of activeCrews) {
    crewState.set(crew.id, {
      crew,
      assignedJobs: [],
      currentLocation: `crew_${crew.id}`,
      usedMinutes: 0,
      availableMinutes: getCrewAvailabilityMins(crew),
    });
  }

  const sortedJobs = [...validJobs].sort((a, b) => {
    const aTime = new Date(a.scheduledAt).getTime();
    const bTime = new Date(b.scheduledAt).getTime();
    return aTime - bTime;
  });

  const unassignedJobs: string[] = [];
  let zoneMatchedCount = 0;
  let primaryZoneMatchedCount = 0;

  for (const job of sortedJobs) {
    let bestCrew: number | null = null;
    let bestScore = Infinity;
    let bestDriveMins = 0;
    let bestZoneMatch = false;

    for (const entry of Array.from(crewState.entries())) {
      const [crewId, state] = entry;
      if (!checkEquipmentCompatibility(job, state.crew)) {
        continue;
      }

      if (state.assignedJobs.length >= (state.crew.capacity || 8)) {
        continue;
      }

      const driveMins = distanceMatrix.get(state.currentLocation)?.get(`job_${job.id}`) || 30;
      const totalMins = driveMins + job.estimatedDurationMins;

      if (state.usedMinutes + totalMins > state.availableMinutes) {
        continue;
      }

      const utilizationFactor = state.usedMinutes / state.availableMinutes;
      const loadBalancingPenalty = utilizationFactor * 10;
      
      let zoneBonus = 0;
      if (crewZoneData && job.lat && job.lng) {
        const zoneMatch = getZoneMatchScore(job.lat, job.lng, crewZoneData.get(crewId));
        zoneBonus = zoneMatch.score;
      }
      
      const score = driveMins * 1.5 + loadBalancingPenalty - zoneBonus;

      if (score < bestScore) {
        bestScore = score;
        bestCrew = crewId;
        bestDriveMins = driveMins;
        bestZoneMatch = zoneBonus > 0;
      }
    }

    if (bestCrew !== null) {
      const state = crewState.get(bestCrew)!;
      const driveMins = distanceMatrix.get(state.currentLocation)?.get(`job_${job.id}`) || 0;
      
      state.assignedJobs.push(job);
      state.currentLocation = `job_${job.id}`;
      state.usedMinutes += driveMins + job.estimatedDurationMins;
    } else {
      unassignedJobs.push(job.id);
    }
  }

  for (const jobId of invalidJobs.map(j => j.id)) {
    unassignedJobs.push(jobId);
  }

  const assignments: CrewAssignment[] = [];
  let totalDriveMins = 0;
  let totalServiceMins = 0;
  let totalAvailableMins = 0;

  for (const entry of Array.from(crewState.entries())) {
    const [crewId, state] = entry;
    if (state.assignedJobs.length === 0) continue;

    const stops: RouteStop[] = [];
    let prevLocation = `crew_${crewId}`;
    let currentTime = new Date(planDate);
    const [startH, startM] = (state.crew.availabilityStart || "08:00").split(":").map(Number);
    currentTime.setHours(startH, startM, 0, 0);

    let crewDriveMins = 0;
    let crewServiceMins = 0;

    for (let i = 0; i < state.assignedJobs.length; i++) {
      const job = state.assignedJobs[i];
      const driveMins = distanceMatrix.get(prevLocation)?.get(`job_${job.id}`) || 0;
      
      currentTime = new Date(currentTime.getTime() + driveMins * 60000);
      const arriveBy = currentTime.toISOString();
      
      currentTime = new Date(currentTime.getTime() + job.estimatedDurationMins * 60000);
      const departBy = currentTime.toISOString();

      stops.push({
        jobId: job.id,
        jobberJobId: job.id,
        order: i + 1,
        propertyAddress: job.propertyAddress,
        lat: job.lat!,
        lng: job.lng!,
        arriveBy,
        departBy,
        driveMinsFromPrev: driveMins,
        serviceType: job.serviceType,
        estimatedDurationMins: job.estimatedDurationMins,
      });

      crewDriveMins += driveMins;
      crewServiceMins += job.estimatedDurationMins;
      prevLocation = `job_${job.id}`;
    }

    const crewAvailable = getCrewAvailabilityMins(state.crew);
    const utilization = Math.round(((crewDriveMins + crewServiceMins) / crewAvailable) * 100);

    assignments.push({
      crewId: crewId,
      crewName: state.crew.name,
      stops,
      totalDriveMins: crewDriveMins,
      totalServiceMins: crewServiceMins,
      utilizationPercent: utilization,
    });

    totalDriveMins += crewDriveMins;
    totalServiceMins += crewServiceMins;
    totalAvailableMins += crewAvailable;
  }

  const overallUtilization = totalAvailableMins > 0
    ? Math.round(((totalDriveMins + totalServiceMins) / totalAvailableMins) * 100)
    : 0;

  if (unassignedJobs.length > 0) {
    warnings.push(`${unassignedJobs.length} jobs could not be assigned to any crew`);
  }

  const computeTimeMs = Date.now() - startTime;
  console.log(`[PlanningEngine] Computed plan in ${computeTimeMs}ms: ${assignments.length} crews, ${validJobs.length - unassignedJobs.length} assigned, ${unassignedJobs.length} unassigned`);

  return {
    planDate: planDate.toISOString(),
    assignments,
    unassignedJobs,
    totalDriveMins,
    overallUtilization,
    warnings,
  };
}

export function generateRouteUrl(planId: number, crewId: number): string {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://lawnflow.app";
  return `${baseUrl}/dispatch/route/${planId}/${crewId}`;
}
