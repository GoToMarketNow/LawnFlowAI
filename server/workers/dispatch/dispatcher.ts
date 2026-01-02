import { db } from "../../db";
import { 
  dispatchPlans, 
  dispatchPlanEvents, 
  crewRoster,
  type DispatchPlan,
  type DispatchPlanResult 
} from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { JobberDispatchClient } from "../../connectors/jobber-dispatch-client";
import { computeDispatchPlan, generateRouteUrl } from "./planningEngine";

type DispatchMode = "nightly" | "event";
type PlanStatus = "draft" | "pending_apply" | "applied" | "rejected" | "failed";

interface DispatchRequest {
  businessId: number;
  jobberAccountId: string;
  planDate: Date;
  mode: DispatchMode;
  triggerEventId?: string;
}

const processingQueue: DispatchRequest[] = [];
let isProcessing = false;
const DEBOUNCE_MS = 5000;
const pendingDebounce: Map<string, NodeJS.Timeout> = new Map();

export function enqueueDispatch(request: DispatchRequest): void {
  const key = `${request.businessId}_${request.planDate.toDateString()}_${request.mode}`;
  
  const existing = pendingDebounce.get(key);
  if (existing) {
    clearTimeout(existing);
  }

  const timeout = setTimeout(() => {
    pendingDebounce.delete(key);
    processingQueue.push(request);
    processQueue();
  }, DEBOUNCE_MS);

  pendingDebounce.set(key, timeout);
  console.log(`[Dispatcher] Enqueued dispatch for ${key}, processing in ${DEBOUNCE_MS}ms`);
}

async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (processingQueue.length > 0) {
    const request = processingQueue.shift()!;
    try {
      await processDispatch(request);
    } catch (error) {
      console.error(`[Dispatcher] Error processing dispatch:`, error);
    }
  }

  isProcessing = false;
}

async function processDispatch(request: DispatchRequest): Promise<DispatchPlan | null> {
  console.log(`[Dispatcher] Processing dispatch for business ${request.businessId}, date ${request.planDate.toDateString()}`);

  const startOfDay = new Date(request.planDate);
  startOfDay.setHours(0, 0, 0, 0);

  const existingPlan = await db
    .select()
    .from(dispatchPlans)
    .where(
      and(
        eq(dispatchPlans.businessId, request.businessId),
        eq(dispatchPlans.mode, request.mode),
        gte(dispatchPlans.planDate, startOfDay),
        lte(dispatchPlans.planDate, new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000))
      )
    )
    .limit(1);

  if (existingPlan.length > 0 && existingPlan[0].status === "applied") {
    console.log(`[Dispatcher] Plan already applied for this date, skipping`);
    return existingPlan[0];
  }

  const crews = await db
    .select()
    .from(crewRoster)
    .where(
      and(
        eq(crewRoster.businessId, request.businessId),
        eq(crewRoster.isActive, true)
      )
    );

  if (crews.length === 0) {
    console.log(`[Dispatcher] No active crews found for business ${request.businessId}`);
    return null;
  }

  const dispatchClient = new JobberDispatchClient(request.jobberAccountId);
  const jobs = await dispatchClient.getScheduledJobsForDate(request.planDate);

  if (jobs.length === 0) {
    console.log(`[Dispatcher] No jobs found for ${request.planDate.toDateString()}`);
    return null;
  }

  const startTime = Date.now();
  const planResult = computeDispatchPlan(jobs, crews, request.planDate);
  const computeTimeMs = Date.now() - startTime;

  const [plan] = await db
    .insert(dispatchPlans)
    .values({
      businessId: request.businessId,
      jobberAccountId: request.jobberAccountId,
      planDate: startOfDay,
      mode: request.mode,
      status: "draft" as PlanStatus,
      triggerEventId: request.triggerEventId,
      totalJobs: jobs.length,
      totalCrews: crews.length,
      inputSnapshot: { jobCount: jobs.length, crewCount: crews.length },
      crewAssignments: planResult.assignments.reduce((acc, a) => {
        acc[a.crewId] = a.stops.map(s => s.jobId);
        return acc;
      }, {} as Record<number, string[]>),
      routeStops: planResult.assignments.reduce((acc, a) => {
        acc[a.crewId] = a.stops;
        return acc;
      }, {} as Record<number, any[]>),
      totalDriveMinutes: planResult.totalDriveMins,
      utilizationPercent: planResult.overallUtilization,
      algorithmVersion: "v1-greedy",
      computeTimeMs,
    })
    .onConflictDoUpdate({
      target: [dispatchPlans.businessId, dispatchPlans.planDate, dispatchPlans.mode],
      set: {
        status: "draft" as PlanStatus,
        totalJobs: jobs.length,
        totalCrews: crews.length,
        crewAssignments: planResult.assignments.reduce((acc, a) => {
          acc[a.crewId] = a.stops.map(s => s.jobId);
          return acc;
        }, {} as Record<number, string[]>),
        routeStops: planResult.assignments.reduce((acc, a) => {
          acc[a.crewId] = a.stops;
          return acc;
        }, {} as Record<number, any[]>),
        totalDriveMinutes: planResult.totalDriveMins,
        utilizationPercent: planResult.overallUtilization,
        computeTimeMs,
        updatedAt: new Date(),
      },
    })
    .returning();

  await db.insert(dispatchPlanEvents).values({
    planId: plan.id,
    eventType: "computed",
    actor: request.mode === "nightly" ? "scheduler" : "webhook",
    details: {
      totalJobs: jobs.length,
      assignedJobs: jobs.length - planResult.unassignedJobs.length,
      unassignedJobs: planResult.unassignedJobs.length,
      warnings: planResult.warnings,
    },
  });

  console.log(`[Dispatcher] Created plan ${plan.id}: ${planResult.assignments.length} crews, ${jobs.length - planResult.unassignedJobs.length}/${jobs.length} jobs assigned`);

  const autoApplyEnabled = await dispatchClient.checkAutoDispatchEnabled();
  
  if (autoApplyEnabled) {
    await applyDispatchPlan(plan.id, request.jobberAccountId);
  }

  return plan;
}

export async function applyDispatchPlan(planId: number, jobberAccountId: string): Promise<boolean> {
  console.log(`[Dispatcher] Applying plan ${planId}`);

  const [plan] = await db
    .select()
    .from(dispatchPlans)
    .where(eq(dispatchPlans.id, planId))
    .limit(1);

  if (!plan) {
    console.error(`[Dispatcher] Plan ${planId} not found`);
    return false;
  }

  if (plan.status === "applied") {
    console.log(`[Dispatcher] Plan ${planId} already applied`);
    return true;
  }

  await db
    .update(dispatchPlans)
    .set({ status: "pending_apply" as PlanStatus })
    .where(eq(dispatchPlans.id, planId));

  const client = new JobberDispatchClient(jobberAccountId);
  const routeStops = plan.routeStops as Record<number, any[]>;
  const errors: string[] = [];

  for (const crewIdStr of Object.keys(routeStops)) {
    const crewId = parseInt(crewIdStr);
    const stops = routeStops[crewId] || [];

    const [crew] = await db
      .select()
      .from(crewRoster)
      .where(eq(crewRoster.id, crewId))
      .limit(1);

    if (!crew?.jobberCrewId) {
      console.warn(`[Dispatcher] Crew ${crewId} has no Jobber crew ID, skipping updates`);
      continue;
    }

    for (const stop of stops) {
      try {
        await client.updateJobAssignment(stop.jobberJobId, crew.jobberCrewId, stop.arriveBy);
        
        const routeUrl = generateRouteUrl(planId, crewId);
        await client.setRoutePlanUrl(stop.jobberJobId, routeUrl);
      } catch (error: any) {
        console.error(`[Dispatcher] Error updating job ${stop.jobberJobId}:`, error);
        errors.push(`Job ${stop.jobberJobId}: ${error.message}`);
      }
    }
  }

  if (errors.length > 0) {
    await db
      .update(dispatchPlans)
      .set({
        status: "failed" as PlanStatus,
        applyError: errors.join("; "),
        updatedAt: new Date(),
      })
      .where(eq(dispatchPlans.id, planId));

    await db.insert(dispatchPlanEvents).values({
      planId,
      eventType: "failed",
      actor: "system",
      details: { errors },
    });

    return false;
  }

  await db
    .update(dispatchPlans)
    .set({
      status: "applied" as PlanStatus,
      appliedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(dispatchPlans.id, planId));

  await db.insert(dispatchPlanEvents).values({
    planId,
    eventType: "applied",
    actor: "system",
    details: { jobsUpdated: Object.values(routeStops).flat().length },
  });

  console.log(`[Dispatcher] Successfully applied plan ${planId}`);
  return true;
}

export async function scheduleNightlyDispatch(): Promise<void> {
  console.log(`[Dispatcher] Running nightly dispatch scheduler`);
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const crews = await db
    .select({
      businessId: crewRoster.businessId,
    })
    .from(crewRoster)
    .where(eq(crewRoster.isActive, true))
    .groupBy(crewRoster.businessId);

  console.log(`[Dispatcher] Found ${crews.length} businesses with active crews`);
}

export { processDispatch };
