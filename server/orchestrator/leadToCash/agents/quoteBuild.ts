import type { JobRequest } from "@shared/schema";
import { 
  type QuoteBuildResult, 
  QuoteBuildResultSchema,
  type OrchestrationContext,
  validateAgentResult,
} from "@shared/orchestrator/contracts";
import { log } from "../logger";

// Simple pricing rules for MVP
const BASE_PRICES: Record<string, { low: number; high: number }> = {
  mowing: { low: 35, high: 75 },
  lawn_mowing: { low: 35, high: 75 },
  cleanup: { low: 150, high: 400 },
  fall_cleanup: { low: 150, high: 400 },
  spring_cleanup: { low: 150, high: 400 },
  mulch: { low: 200, high: 600 },
  mulching: { low: 200, high: 600 },
  landscaping: { low: 500, high: 2000 },
  tree_trimming: { low: 150, high: 500 },
  irrigation: { low: 100, high: 300 },
  hedge_trimming: { low: 75, high: 200 },
  fertilization: { low: 50, high: 150 },
  aeration: { low: 100, high: 250 },
  overseeding: { low: 75, high: 200 },
};

// Lot size multipliers
function getLotSizeMultiplier(sqft: number | undefined): number {
  if (!sqft) return 1.0;
  if (sqft < 5000) return 0.8;
  if (sqft < 10000) return 1.0;
  if (sqft < 20000) return 1.3;
  if (sqft < 43560) return 1.6; // Under 1 acre
  return 2.0; // 1+ acre
}

export async function runQuoteBuildAgent(
  jobRequest: JobRequest,
  context: OrchestrationContext
): Promise<QuoteBuildResult> {
  log("debug", "Running quote build agent", { jobRequestId: jobRequest.id });

  const services = context.services || (jobRequest.servicesJson as string[]) || [];
  const lotSqft = context.lotAreaSqft || jobRequest.lotAreaSqft;
  const multiplier = getLotSizeMultiplier(lotSqft || undefined);

  let totalLow = 0;
  let totalHigh = 0;
  const servicesIncluded: string[] = [];
  const assumptions: string[] = [];

  // Calculate prices for each service
  for (const service of services) {
    const normalizedService = service.toLowerCase().replace(/\s+/g, "_");
    const prices = BASE_PRICES[normalizedService] || BASE_PRICES["mowing"];
    
    totalLow += Math.round(prices.low * multiplier);
    totalHigh += Math.round(prices.high * multiplier);
    servicesIncluded.push(service);
  }

  // Ensure we have at least some price
  if (totalLow === 0) {
    totalLow = 50;
    totalHigh = 150;
    assumptions.push("Generic service pricing applied");
  }

  // Add assumptions
  if (lotSqft) {
    assumptions.push(`Lot size: ${lotSqft.toLocaleString()} sq ft`);
  } else {
    assumptions.push("Lot size unknown - using average estimate");
  }

  if (context.frequency && context.frequency !== "unknown") {
    assumptions.push(`Frequency: ${context.frequency}`);
    // Discount for recurring
    if (context.frequency === "weekly") {
      totalLow = Math.round(totalLow * 0.85);
      totalHigh = Math.round(totalHigh * 0.85);
      assumptions.push("15% discount applied for weekly service");
    } else if (context.frequency === "biweekly") {
      totalLow = Math.round(totalLow * 0.9);
      totalHigh = Math.round(totalHigh * 0.9);
      assumptions.push("10% discount applied for biweekly service");
    }
  }

  assumptions.push("Standard access to property assumed");
  assumptions.push("No major obstacles or special equipment needed");

  // Determine confidence and next step
  let confidence: "high" | "medium" | "low" = "medium";
  let nextStep: "ready_to_send" | "request_photos" | "schedule_site_visit" = "ready_to_send";

  if (!lotSqft) {
    confidence = "low";
    nextStep = "request_photos";
  } else if (totalHigh - totalLow > totalLow * 0.5) {
    // Wide range - need more info
    confidence = "medium";
    nextStep = "request_photos";
  } else {
    confidence = "high";
    nextStep = "ready_to_send";
  }

  const result: QuoteBuildResult = {
    rangeLow: totalLow,
    rangeHigh: totalHigh,
    currency: "USD",
    servicesIncluded,
    assumptions,
    nextStep,
    confidence,
  };

  return validateAgentResult(QuoteBuildResultSchema, result, "quoteBuildAgent");
}
