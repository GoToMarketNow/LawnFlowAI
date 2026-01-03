import { 
  MarginValidateResult, 
  MarginValidateResultSchema,
  type OrchestrationContext,
  type Confidence,
} from "@shared/orchestrator/contracts";
import { type JobRequest } from "@shared/schema";
import { computeMarginScore, type MarginBurnInput } from "../../../agents/marginBurn";
import { storage } from "../../../storage";
import { log } from "../logger";

const MARGIN_THRESHOLD = 70;
const AVG_SPEED_MPH = 30;

export async function runMarginValidateAgent(
  jobRequest: JobRequest,
  context: OrchestrationContext
): Promise<MarginValidateResult> {
  log("info", `[MarginValidate] Starting for job request ${jobRequest.id}`);

  const topRecommendation = context.topRecommendation;
  if (!topRecommendation) {
    log("warn", `[MarginValidate] No top recommendation in context`);
    return {
      marginScore: 0,
      estimatedCost: 0,
      estimatedRevenue: context.rangeLow || 0,
      marginPercent: 0,
      meetsThreshold: false,
      travelCostDelta: 0,
      laborCost: 0,
      warnings: ["No crew recommendation available"],
      confidence: "low",
    };
  }

  try {
    const crew = await storage.getCrew(topRecommendation.crewId);
    if (!crew) {
      return {
        marginScore: 0,
        estimatedCost: 0,
        estimatedRevenue: context.rangeLow || 0,
        marginPercent: 0,
        meetsThreshold: false,
        travelCostDelta: 0,
        laborCost: 0,
        warnings: [`Crew ${topRecommendation.crewId} not found`],
        confidence: "low",
      };
    }

    // Build margin burn input
    const marginInput: MarginBurnInput = {
      laborLowMinutes: jobRequest.laborLowMinutes || 60,
      laborHighMinutes: jobRequest.laborHighMinutes || (jobRequest.laborLowMinutes || 60) * 1.5,
      travelMinutesDelta: topRecommendation.travelMinutes || 0,
      crewSizeMin: jobRequest.crewSizeMin || 2,
      lotAreaSqft: context.lotAreaSqft || jobRequest.lotAreaSqft || null,
      priceLowCents: context.rangeLow ? context.rangeLow * 100 : null,
      priceHighCents: context.rangeHigh ? context.rangeHigh * 100 : null,
      requiredEquipment: (jobRequest.requiredEquipmentJson as string[]) || [],
    };

    const marginResult = computeMarginScore(marginInput);

    // Calculate actual margin percent
    const estimatedRevenue = marginResult.revenueEstimate || context.rangeLow || 0;
    const marginPercent = estimatedRevenue > 0 
      ? ((estimatedRevenue - marginResult.estTotalCost) / estimatedRevenue) * 100 
      : 0;

    const meetsThreshold = marginResult.marginScore >= MARGIN_THRESHOLD;
    
    // Build warnings
    const warnings: string[] = [];
    if (!meetsThreshold) {
      warnings.push(`Margin score ${marginResult.marginScore.toFixed(1)} is below threshold of ${MARGIN_THRESHOLD}`);
    }
    if (marginPercent < 20) {
      warnings.push(`Low margin percent: ${marginPercent.toFixed(1)}%`);
    }
    
    // Calculate travel cost
    const travelMiles = (topRecommendation.travelMinutes / 60) * AVG_SPEED_MPH;
    const travelCostDelta = travelMiles * 0.65 * 2; // IRS rate * round trip
    
    if (travelCostDelta > estimatedRevenue * 0.15) {
      warnings.push(`High travel cost: $${travelCostDelta.toFixed(2)} (>15% of revenue)`);
    }

    let confidence: Confidence = "medium";
    if (meetsThreshold && warnings.length === 0) {
      confidence = "high";
    } else if (!meetsThreshold) {
      confidence = "low";
    }

    const result: MarginValidateResult = {
      marginScore: marginResult.marginScore,
      estimatedCost: marginResult.estTotalCost,
      estimatedRevenue,
      marginPercent,
      meetsThreshold,
      travelCostDelta,
      laborCost: marginResult.estLaborCost,
      warnings,
      confidence,
    };

    log("info", `[MarginValidate] Completed - marginScore: ${marginResult.marginScore.toFixed(1)}, meetsThreshold: ${meetsThreshold}`);

    return MarginValidateResultSchema.parse(result);
  } catch (error) {
    log("error", `[MarginValidate] Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return {
      marginScore: 0,
      estimatedCost: 0,
      estimatedRevenue: context.rangeLow || 0,
      marginPercent: 0,
      meetsThreshold: false,
      travelCostDelta: 0,
      laborCost: 0,
      warnings: [`Error: ${error instanceof Error ? error.message : 'Unknown'}`],
      confidence: "low",
    };
  }
}
