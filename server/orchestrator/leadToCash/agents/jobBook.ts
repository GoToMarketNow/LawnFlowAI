import type { JobRequest } from "@shared/schema";
import { db } from "../../../db";
import { jobRequests, scheduleItems } from "@shared/schema";
import { 
  type JobBookedResult, 
  JobBookedResultSchema,
  type OrchestrationContext,
  validateAgentResult,
} from "@shared/orchestrator/contracts";
import { eq } from "drizzle-orm";
import { log } from "../logger";
import { randomUUID } from "crypto";

export async function runJobBookAgent(
  jobRequest: JobRequest,
  context: OrchestrationContext
): Promise<JobBookedResult> {
  log("debug", "Running job book agent", { jobRequestId: jobRequest.id });

  let writebackSuccess = false;
  let externalId: string | undefined;
  let confirmationSent = false;

  try {
    // Simulate Jobber writeback (stub for MVP)
    externalId = `jobber_${randomUUID().slice(0, 8)}`;
    
    // Create schedule item in our system
    if (context.selectedWindow && context.selectedCrewId) {
      await db.insert(scheduleItems).values({
        businessId: jobRequest.businessId,
        externalProvider: "jobber",
        externalId,
        crewId: parseInt(context.selectedCrewId),
        startAt: new Date(context.selectedWindow.startISO),
        endAt: new Date(context.selectedWindow.endISO),
        lat: context.lat || null,
        lng: context.lng || null,
        address: context.address || null,
        description: `Job for ${context.customerName}: ${context.services?.join(", ")}`,
        jobRequestId: jobRequest.id,
        status: "scheduled",
      });
    }

    // Update job request status
    await db
      .update(jobRequests)
      .set({
        status: "assigned",
        assignedCrewId: context.selectedCrewId ? parseInt(context.selectedCrewId) : null,
        assignedDate: context.selectedWindow ? new Date(context.selectedWindow.startISO) : null,
        updatedAt: new Date(),
      })
      .where(eq(jobRequests.id, jobRequest.id));

    writebackSuccess = true;

    // Simulate sending confirmation SMS
    // In real implementation, this would call Twilio
    log("info", `Would send confirmation SMS to ${context.customerPhone}`, {
      jobRequestId: jobRequest.id,
      externalId,
    });
    confirmationSent = true;

  } catch (error) {
    log("error", "Job book failed", { 
      jobRequestId: jobRequest.id, 
      error: error instanceof Error ? error.message : "Unknown" 
    });
    writebackSuccess = false;
  }

  const result: JobBookedResult = {
    writeback: writebackSuccess ? "success" : "failed",
    externalProvider: "jobber",
    externalId,
    confirmationSent,
    confidence: writebackSuccess && confirmationSent ? "high" : "low",
  };

  return validateAgentResult(JobBookedResultSchema, result, "jobBookAgent");
}
