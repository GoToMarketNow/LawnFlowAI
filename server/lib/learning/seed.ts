import { db } from "../../db";
import { reasonCodes, policyVersions } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const DEFAULT_REASON_CODES = [
  { code: "LOT_SIZE_UNCERTAIN", label: "Lot size data uncertain", appliesTo: { decisionTypes: ["quote_range"], actions: ["edit", "reject"] } },
  { code: "SCOPE_MISSING", label: "Scope or service details missing", appliesTo: { decisionTypes: ["quote_range", "next_question"], actions: ["edit", "reject", "request_info"] } },
  { code: "SEASONAL_PRICING", label: "Seasonal pricing adjustment needed", appliesTo: { decisionTypes: ["quote_range"], actions: ["edit"] } },
  { code: "TRAVEL_TOO_HIGH", label: "Travel time/distance too high", appliesTo: { decisionTypes: ["crew_assignment", "schedule_windows"], actions: ["reject", "assign_different_crew"] } },
  { code: "CREW_CAPABILITY_MISMATCH", label: "Crew capability doesn't match job", appliesTo: { decisionTypes: ["crew_assignment"], actions: ["reject", "assign_different_crew"] } },
  { code: "CUSTOMER_PRICE_SENSITIVE", label: "Customer known to be price sensitive", appliesTo: { decisionTypes: ["quote_range"], actions: ["edit"] } },
  { code: "CUSTOMER_REQUESTED_HUMAN", label: "Customer explicitly requested human contact", appliesTo: { decisionTypes: ["channel_choice", "escalate_human"], actions: ["escalate", "change_channel"] } },
  { code: "NEEDS_PHOTOS", label: "Need photos for accurate quote", appliesTo: { decisionTypes: ["quote_range", "feasibility_gate"], actions: ["request_info", "reject"] } },
  { code: "NEEDS_SITE_VISIT", label: "Site visit required", appliesTo: { decisionTypes: ["quote_range", "feasibility_gate"], actions: ["reject", "request_info"] } },
  { code: "CHANNEL_PREFERENCE_MISMATCH", label: "Customer prefers different channel", appliesTo: { decisionTypes: ["channel_choice"], actions: ["change_channel"] } },
  { code: "MARGIN_TOO_LOW", label: "Margin below acceptable threshold", appliesTo: { decisionTypes: ["quote_range", "crew_assignment"], actions: ["edit", "reject"] } },
  { code: "EQUIPMENT_UNAVAILABLE", label: "Required equipment not available", appliesTo: { decisionTypes: ["crew_assignment", "schedule_windows"], actions: ["reject", "assign_different_crew"] } },
  { code: "WEATHER_CONCERN", label: "Weather conditions concern", appliesTo: { decisionTypes: ["schedule_windows"], actions: ["edit", "reject"] } },
  { code: "CUSTOMER_HISTORY", label: "Based on customer history/preferences", appliesTo: { decisionTypes: ["quote_range", "crew_assignment", "schedule_windows"], actions: ["edit"] } },
  { code: "OTHER", label: "Other (see notes)", appliesTo: { decisionTypes: ["*"], actions: ["*"] } },
];

const DEFAULT_POLICY = {
  version: "v1",
  thresholds: {
    autoSendQuoteConfidence: 0.85,
    autoBookJobConfidence: 0.90,
    requirePhotosWhenLotConfidenceLow: true,
    maxTravelMinutes: 45,
    minMarginPercent: 0.25,
  },
  pricing: {
    mowing: { basePerSqft: 0.004, minPrice: 3500, maxMultiplier: 2.0 },
    cleanup: { basePerSqft: 0.012, minPrice: 15000, maxMultiplier: 2.5 },
    mulch: { basePerCubicYard: 7500, minPrice: 20000, maxMultiplier: 2.0 },
  },
  routing: {
    preferHomeZip: true,
    maxJobsPerDay: 8,
    bufferMinutes: 15,
  },
  channels: {
    preferSms: true,
    escalateAfterNoResponseHours: 24,
    maxAutoMessagesPerDay: 5,
  },
};

export async function seedLearningSystem(businessId: number): Promise<{ reasonCodesCount: number; policyVersionId: number }> {
  const existingReasonCodes = await db.select().from(reasonCodes).where(eq(reasonCodes.businessId, businessId));
  
  let reasonCodesCount = existingReasonCodes.length;
  
  if (existingReasonCodes.length === 0) {
    const toInsert = DEFAULT_REASON_CODES.map(rc => ({
      businessId,
      code: rc.code,
      label: rc.label,
      appliesTo: rc.appliesTo,
      isActive: true,
    }));
    
    await db.insert(reasonCodes).values(toInsert);
    reasonCodesCount = toInsert.length;
  }
  
  const existingPolicyVersion = await db.select()
    .from(policyVersions)
    .where(and(eq(policyVersions.businessId, businessId), eq(policyVersions.status, "active")));
  
  let policyVersionId: number;
  
  if (existingPolicyVersion.length === 0) {
    const now = new Date();
    const versionString = `pricing-v1-${now.toISOString().split('T')[0]}`;
    
    const [newPolicy] = await db.insert(policyVersions).values({
      businessId,
      version: versionString,
      policyJson: DEFAULT_POLICY,
      status: "active",
    }).returning();
    
    policyVersionId = newPolicy.id;
  } else {
    policyVersionId = existingPolicyVersion[0].id;
  }
  
  return { reasonCodesCount, policyVersionId };
}

export async function getActivePolicy(businessId: number): Promise<{ policyVersion: string; policyJson: Record<string, unknown> } | null> {
  const [activePolicy] = await db.select()
    .from(policyVersions)
    .where(and(eq(policyVersions.businessId, businessId), eq(policyVersions.status, "active")))
    .limit(1);
  
  if (!activePolicy) {
    return null;
  }
  
  return {
    policyVersion: activePolicy.version,
    policyJson: activePolicy.policyJson as Record<string, unknown>,
  };
}

export async function getReasonCodesForDecision(businessId: number, decisionType: string): Promise<Array<{ code: string; label: string }>> {
  const codes = await db.select()
    .from(reasonCodes)
    .where(and(eq(reasonCodes.businessId, businessId), eq(reasonCodes.isActive, true)));
  
  return codes.filter(rc => {
    const appliesTo = rc.appliesTo as { decisionTypes: string[]; actions: string[] };
    return appliesTo.decisionTypes.includes("*") || appliesTo.decisionTypes.includes(decisionType);
  }).map(rc => ({ code: rc.code, label: rc.label }));
}
