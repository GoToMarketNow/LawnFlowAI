import type { JobRequest } from "@shared/schema";
import { 
  type LeadIntakeResult, 
  LeadIntakeResultSchema,
  type OrchestrationContext,
  validateAgentResult,
} from "@shared/orchestrator/contracts";
import { log } from "../logger";

export async function runLeadIntakeAgent(
  jobRequest: JobRequest,
  context: OrchestrationContext
): Promise<LeadIntakeResult> {
  log("debug", "Running lead intake agent", { jobRequestId: jobRequest.id });

  const services = (jobRequest.servicesJson as string[]) || [];
  const missingFields: string[] = [];

  // Check required fields
  if (!jobRequest.customerPhone && !context.customerPhone) {
    missingFields.push("phone");
  }
  if (!jobRequest.address && !context.address) {
    missingFields.push("address");
  }
  if (services.length === 0 && (!context.services || context.services.length === 0)) {
    missingFields.push("services");
  }

  // Determine confidence based on completeness
  let confidence: "high" | "medium" | "low" = "high";
  if (missingFields.length > 0) {
    confidence = "low";
  } else if (!jobRequest.customerName) {
    confidence = "medium";
  }

  const result: LeadIntakeResult = {
    customerName: jobRequest.customerName || context.customerName,
    customerPhone: jobRequest.customerPhone || context.customerPhone || "",
    address: jobRequest.address || context.address || "",
    services: services.length > 0 ? services : (context.services || []),
    frequency: (jobRequest.frequency as LeadIntakeResult["frequency"]) || context.frequency as LeadIntakeResult["frequency"] || "unknown",
    timeline: undefined,
    missingFields,
    confidence,
  };

  return validateAgentResult(LeadIntakeResultSchema, result, "leadIntakeAgent");
}
