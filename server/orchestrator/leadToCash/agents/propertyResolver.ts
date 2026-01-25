import type { JobRequest } from "@shared/schema";
import { 
  type PropertyResolverResult, 
  PropertyResolverResultSchema,
  type OrchestrationContext,
  validateAgentResult,
} from "@shared/orchestrator/contracts";
import { log } from "../logger";

export async function runPropertyResolverAgent(
  jobRequest: JobRequest,
  context: OrchestrationContext
): Promise<PropertyResolverResult> {
  log("debug", "Running property resolver agent", { jobRequestId: jobRequest.id });

  // Check if we already have property data
  const hasLat = jobRequest.lat !== null || context.lat !== undefined;
  const hasLng = jobRequest.lng !== null || context.lng !== undefined;
  const hasLotSize = jobRequest.lotAreaSqft !== null || context.lotAreaSqft !== undefined;

  // Determine confidence based on data availability
  let lotConfidence: "high" | "medium" | "low" = "low";
  let notes: string | undefined;

  if (hasLat && hasLng && hasLotSize) {
    lotConfidence = "high";
    notes = "All property data available from existing records";
  } else if (hasLat && hasLng) {
    lotConfidence = "medium";
    notes = "Location available but lot size unknown - consider ArcGIS lookup";
  } else if (jobRequest.address || context.address) {
    lotConfidence = "low";
    notes = "Address available but geocoding needed";
  } else {
    notes = "No property data available";
  }

  const result: PropertyResolverResult = {
    lat: jobRequest.lat || context.lat,
    lng: jobRequest.lng || context.lng,
    zip: jobRequest.zip || context.zip,
    lotAreaSqft: jobRequest.lotAreaSqft || context.lotAreaSqft,
    lotConfidence,
    notes,
  };

  return validateAgentResult(PropertyResolverResultSchema, result, "propertyResolverAgent");
}
