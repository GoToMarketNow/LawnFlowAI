import { db } from "../../db";
import { 
  decisionLogs, 
  humanActionLogs, 
  outcomeLogs, 
  policyTuningSuggestions,
  reasonCodes,
  policyVersions,
  type ReasonCode
} from "@shared/schema";
import { eq, and, gte, desc, sql, inArray } from "drizzle-orm";

interface SuggestionResult {
  created: number;
  skipped: number;
  details: string[];
}

const ANALYSIS_WINDOW_DAYS = 30;
const MIN_DECISIONS_FOR_ANALYSIS = 10;
const OVERRIDE_THRESHOLD_PERCENT = 20;
const HIGH_OVERRIDE_THRESHOLD_PERCENT = 50;

export async function generateSuggestions(businessId: number): Promise<SuggestionResult> {
  const result: SuggestionResult = { created: 0, skipped: 0, details: [] };
  
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - ANALYSIS_WINDOW_DAYS);

  const decisions = await db.select()
    .from(decisionLogs)
    .where(and(
      eq(decisionLogs.businessId, businessId),
      gte(decisionLogs.createdAt, windowStart)
    ));

  if (decisions.length < MIN_DECISIONS_FOR_ANALYSIS) {
    result.details.push(`Not enough decisions (${decisions.length}/${MIN_DECISIONS_FOR_ANALYSIS}) for analysis`);
    return result;
  }

  const decisionIds = decisions.map(d => d.id);
  
  const humanActions = decisionIds.length > 0 
    ? await db.select()
        .from(humanActionLogs)
        .where(inArray(humanActionLogs.decisionId, decisionIds))
    : [];

  const outcomes = decisionIds.length > 0
    ? await db.select()
        .from(outcomeLogs)
        .where(and(
          sql`${outcomeLogs.decisionId} IS NOT NULL`,
          inArray(outcomeLogs.decisionId, decisionIds)
        ))
    : [];

  const allReasonCodes = await db.select().from(reasonCodes);
  const reasonCodeMap = new Map(allReasonCodes.map(rc => [rc.code, rc]));

  const overrides = humanActions.filter(a => a.actionType === "edit" || a.actionType === "reject");
  const overrideRate = (overrides.length / decisions.length) * 100;

  result.details.push(`Analyzed ${decisions.length} decisions with ${overrides.length} overrides (${overrideRate.toFixed(1)}%)`);

  const overridesByReason = new Map<string, number>();
  overrides.forEach(action => {
    const codes = action.reasonCodesJson as string[];
    if (Array.isArray(codes) && codes.length > 0) {
      codes.forEach(code => {
        overridesByReason.set(code, (overridesByReason.get(code) || 0) + 1);
      });
    } else {
      overridesByReason.set("UNSPECIFIED", (overridesByReason.get("UNSPECIFIED") || 0) + 1);
    }
  });

  const reasonEntries = Array.from(overridesByReason.entries());
  for (const [code, count] of reasonEntries) {
    const percentage = (count / overrides.length) * 100;
    if (percentage >= OVERRIDE_THRESHOLD_PERCENT && count >= 3) {
      const reasonInfo = reasonCodeMap.get(code);
      const suggestion = await createSuggestionForReasonCode(
        businessId,
        code,
        count,
        percentage,
        reasonInfo,
        result
      );
      if (suggestion) result.created++;
      else result.skipped++;
    }
  }

  const decisionsByType = new Map<string, typeof decisions>();
  decisions.forEach(d => {
    const type = d.decisionType;
    if (!decisionsByType.has(type)) decisionsByType.set(type, []);
    decisionsByType.get(type)!.push(d);
  });

  const typeEntries = Array.from(decisionsByType.entries());
  for (const [decisionType, typeDecisions] of typeEntries) {
    const typeDecisionIds = typeDecisions.map(d => d.id);
    const typeOverrides = humanActions.filter(
      a => typeDecisionIds.includes(a.decisionId) && 
           (a.actionType === "edit" || a.actionType === "reject")
    );
    const typeOverrideRate = (typeOverrides.length / typeDecisions.length) * 100;

    if (typeOverrideRate >= HIGH_OVERRIDE_THRESHOLD_PERCENT && typeDecisions.length >= 5) {
      const suggestion = await createHighOverrideSuggestion(
        businessId,
        decisionType,
        typeOverrideRate,
        typeDecisions.length,
        result
      );
      if (suggestion) result.created++;
      else result.skipped++;
    }
  }

  const lowConfidenceDecisions = decisions.filter(d => d.confidence === "low");
  const lowConfidenceRate = (lowConfidenceDecisions.length / decisions.length) * 100;
  
  if (lowConfidenceRate >= 30 && lowConfidenceDecisions.length >= 5) {
    const suggestion = await createConfidenceThresholdSuggestion(
      businessId,
      lowConfidenceRate,
      lowConfidenceDecisions.length,
      result
    );
    if (suggestion) result.created++;
    else result.skipped++;
  }

  const positiveOutcomes = outcomes.filter(o => 
    o.outcomeType === "customer_accepted" || o.outcomeType === "job_completed"
  );
  
  if (positiveOutcomes.length > 0 && overrides.length > 0) {
    const overriddenDecisionIds = new Set(overrides.map(o => o.decisionId));
    const positiveAfterOverride = positiveOutcomes.filter(o => o.decisionId && overriddenDecisionIds.has(o.decisionId));
    
    if (positiveAfterOverride.length >= 3) {
      const successRateAfterOverride = (positiveAfterOverride.length / overrides.length) * 100;
      if (successRateAfterOverride > 60) {
        const suggestion = await createLearnFromOverridesSuggestion(
          businessId,
          successRateAfterOverride,
          positiveAfterOverride.length,
          result
        );
        if (suggestion) result.created++;
        else result.skipped++;
      }
    }
  }

  return result;
}

async function createSuggestionForReasonCode(
  businessId: number,
  code: string,
  count: number,
  percentage: number,
  reasonInfo: ReasonCode | undefined,
  result: SuggestionResult
): Promise<boolean> {
  const existingSuggestion = await db.select()
    .from(policyTuningSuggestions)
    .where(and(
      eq(policyTuningSuggestions.businessId, businessId),
      eq(policyTuningSuggestions.status, "proposed"),
      sql`${policyTuningSuggestions.evidenceJson}->>'reasonCode' = ${code}`
    ))
    .limit(1);

  if (existingSuggestion.length > 0) {
    result.details.push(`Skipped duplicate suggestion for reason code: ${code}`);
    return false;
  }

  const suggestionConfig = getReasonCodeSuggestion(code, percentage);
  
  if (!suggestionConfig) {
    result.details.push(`No suggestion template for reason code: ${code}`);
    return false;
  }

  await db.insert(policyTuningSuggestions).values({
    businessId,
    createdBy: "system",
    policyChangeType: "threshold",
    target: suggestionConfig.target,
    currentValueJson: { value: suggestionConfig.currentValue },
    proposedValueJson: { value: suggestionConfig.proposedValue },
    evidenceJson: {
      reasonCode: code,
      overrideCount: count,
      overridePercentage: percentage,
      rationale: `${reasonInfo?.label || code} was cited ${count} times (${percentage.toFixed(1)}% of overrides). ${suggestionConfig.rationale}`,
      impactEstimate: suggestionConfig.impactEstimate,
      recommendation: suggestionConfig.recommendation,
    },
    status: "proposed",
  });

  result.details.push(`Created suggestion for reason code: ${code} (${count} overrides)`);
  return true;
}

async function createHighOverrideSuggestion(
  businessId: number,
  decisionType: string,
  overrideRate: number,
  totalDecisions: number,
  result: SuggestionResult
): Promise<boolean> {
  const existingSuggestion = await db.select()
    .from(policyTuningSuggestions)
    .where(and(
      eq(policyTuningSuggestions.businessId, businessId),
      eq(policyTuningSuggestions.status, "proposed"),
      sql`${policyTuningSuggestions.evidenceJson}->>'type' = 'high_override_rate'`,
      sql`${policyTuningSuggestions.evidenceJson}->>'decisionType' = ${decisionType}`
    ))
    .limit(1);

  if (existingSuggestion.length > 0) {
    result.details.push(`Skipped duplicate high-override suggestion for: ${decisionType}`);
    return false;
  }

  await db.insert(policyTuningSuggestions).values({
    businessId,
    createdBy: "system",
    policyChangeType: "automation_level",
    target: `automation.${decisionType}`,
    currentValueJson: { value: "auto" },
    proposedValueJson: { value: "review_required" },
    evidenceJson: {
      type: "high_override_rate",
      decisionType,
      overrideRate,
      totalDecisions,
      rationale: `${overrideRate.toFixed(1)}% of ${decisionType} decisions are being overridden (${totalDecisions} total). Consider requiring review for this decision type.`,
      impactEstimate: `Reduce override rate by ~${(overrideRate * 0.5).toFixed(0)}%`,
      recommendation: "Increase review requirements for this decision type",
    },
    status: "proposed",
  });

  result.details.push(`Created high-override suggestion for ${decisionType} (${overrideRate.toFixed(1)}% rate)`);
  return true;
}

async function createConfidenceThresholdSuggestion(
  businessId: number,
  lowConfidenceRate: number,
  lowConfidenceCount: number,
  result: SuggestionResult
): Promise<boolean> {
  const existingSuggestion = await db.select()
    .from(policyTuningSuggestions)
    .where(and(
      eq(policyTuningSuggestions.businessId, businessId),
      eq(policyTuningSuggestions.status, "proposed"),
      sql`${policyTuningSuggestions.evidenceJson}->>'type' = 'low_confidence_threshold'`
    ))
    .limit(1);

  if (existingSuggestion.length > 0) {
    result.details.push(`Skipped duplicate confidence threshold suggestion`);
    return false;
  }

  await db.insert(policyTuningSuggestions).values({
    businessId,
    createdBy: "system",
    policyChangeType: "threshold",
    target: "confidence.minimumForAuto",
    currentValueJson: { value: 0.7 },
    proposedValueJson: { value: 0.8 },
    evidenceJson: {
      type: "low_confidence_threshold",
      lowConfidenceRate,
      lowConfidenceCount,
      rationale: `${lowConfidenceRate.toFixed(1)}% of decisions (${lowConfidenceCount}) are low confidence. Consider raising the auto-approval threshold.`,
      impactEstimate: `Improve decision accuracy, may increase review queue by ~15%`,
      recommendation: "Raise minimum confidence threshold for auto-approval",
    },
    status: "proposed",
  });

  result.details.push(`Created confidence threshold suggestion (${lowConfidenceRate.toFixed(1)}% low confidence)`);
  return true;
}

async function createLearnFromOverridesSuggestion(
  businessId: number,
  successRate: number,
  successCount: number,
  result: SuggestionResult
): Promise<boolean> {
  const existingSuggestion = await db.select()
    .from(policyTuningSuggestions)
    .where(and(
      eq(policyTuningSuggestions.businessId, businessId),
      eq(policyTuningSuggestions.status, "proposed"),
      sql`${policyTuningSuggestions.evidenceJson}->>'type' = 'learn_from_overrides'`
    ))
    .limit(1);

  if (existingSuggestion.length > 0) {
    result.details.push(`Skipped duplicate learn-from-overrides suggestion`);
    return false;
  }

  await db.insert(policyTuningSuggestions).values({
    businessId,
    createdBy: "system",
    policyChangeType: "model_training",
    target: "training.incorporateOverrides",
    currentValueJson: { value: false },
    proposedValueJson: { value: true },
    evidenceJson: {
      type: "learn_from_overrides",
      successRate,
      successCount,
      rationale: `${successRate.toFixed(1)}% of overridden decisions resulted in customer acceptance (${successCount} cases). Human overrides are improving outcomes.`,
      impactEstimate: `Could improve AI accuracy by incorporating override patterns`,
      recommendation: "Analyze override patterns to improve AI decision quality",
    },
    status: "proposed",
  });

  result.details.push(`Created learn-from-overrides suggestion (${successRate.toFixed(1)}% success rate)`);
  return true;
}

function getReasonCodeSuggestion(code: string, percentage: number): {
  target: string;
  currentValue: string;
  proposedValue: string;
  rationale: string;
  impactEstimate: string;
  recommendation: string;
} | null {
  const suggestions: Record<string, ReturnType<typeof getReasonCodeSuggestion>> = {
    LOT_SIZE_UNCERTAIN: {
      target: "pricing.lotSizeConfidenceThreshold",
      currentValue: "0.7",
      proposedValue: "0.85",
      rationale: "Lot size uncertainty is leading to quote rejections.",
      impactEstimate: "Reduce pricing errors by ~20%",
      recommendation: "Require higher confidence for lot size estimates before auto-quoting",
    },
    MARGIN_TOO_LOW: {
      target: "pricing.minimumMargin",
      currentValue: "0.15",
      proposedValue: "0.20",
      rationale: "Low margin jobs are frequently rejected by operators.",
      impactEstimate: "Improve average job margin by ~5%",
      recommendation: "Increase minimum margin threshold for job acceptance",
    },
    CREW_UNAVAILABLE: {
      target: "scheduling.bufferDays",
      currentValue: "2",
      proposedValue: "3",
      rationale: "Crew availability issues suggest tighter scheduling than realistic.",
      impactEstimate: "Reduce scheduling conflicts by ~30%",
      recommendation: "Add buffer days between scheduled jobs",
    },
    PRICE_MISMATCH: {
      target: "pricing.competitorAdjustment",
      currentValue: "1.0",
      proposedValue: "0.95",
      rationale: "Prices are being adjusted down frequently.",
      impactEstimate: "Improve quote acceptance rate by ~10%",
      recommendation: "Consider slight price reduction for competitive markets",
    },
    CUSTOMER_HISTORY: {
      target: "customers.historyWeight",
      currentValue: "0.3",
      proposedValue: "0.5",
      rationale: "Customer history is influencing decisions more than the AI accounts for.",
      impactEstimate: "Better personalization, improved retention",
      recommendation: "Increase weight of customer history in decision making",
    },
    SAFETY_CONCERN: {
      target: "safety.autoRejectThreshold",
      currentValue: "0.3",
      proposedValue: "0.2",
      rationale: "Safety concerns require human review more often.",
      impactEstimate: "Reduce safety-related issues",
      recommendation: "Lower threshold for flagging potential safety issues",
    },
    SERVICE_NOT_OFFERED: {
      target: "services.validationLevel",
      currentValue: "basic",
      proposedValue: "strict",
      rationale: "Requests for non-offered services are reaching the pipeline.",
      impactEstimate: "Reduce invalid quote requests",
      recommendation: "Add stricter service validation at intake",
    },
    SCHEDULING_CONFLICT: {
      target: "scheduling.conflictBuffer",
      currentValue: "30",
      proposedValue: "60",
      rationale: "Scheduling conflicts are common.",
      impactEstimate: "Reduce double-booking by ~40%",
      recommendation: "Increase buffer time between appointments",
    },
  };

  return suggestions[code] || null;
}
