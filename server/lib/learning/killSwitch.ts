import { db } from "../../db";
import { killSwitches } from "@shared/schema";
import { and, eq } from "drizzle-orm";

export interface KillSwitchCheckParams {
  businessId: number;
  agentType?: string;
  stage?: string;
  decisionType?: string;
}

export interface KillSwitchResult {
  blocked: boolean;
  reason?: string;
  switchId?: number;
  scope?: string;
  scopeValue?: string;
}

export async function checkKillSwitch(params: KillSwitchCheckParams): Promise<KillSwitchResult> {
  const { businessId, agentType, stage, decisionType } = params;

  const activeKillSwitches = await db
    .select()
    .from(killSwitches)
    .where(
      and(
        eq(killSwitches.businessId, businessId),
        eq(killSwitches.isEnabled, true)
      )
    )
    .orderBy(killSwitches.createdAt);

  for (const sw of activeKillSwitches) {
    if (sw.scope === "global") {
      return {
        blocked: true,
        reason: sw.reason || "Global kill switch is active",
        switchId: sw.id,
        scope: sw.scope,
        scopeValue: sw.scopeValue,
      };
    }

    if (sw.scope === "agent" && agentType && sw.scopeValue === agentType) {
      return {
        blocked: true,
        reason: sw.reason || `Kill switch active for agent: ${agentType}`,
        switchId: sw.id,
        scope: sw.scope,
        scopeValue: sw.scopeValue,
      };
    }

    if (sw.scope === "stage" && stage && sw.scopeValue === stage) {
      return {
        blocked: true,
        reason: sw.reason || `Kill switch active for stage: ${stage}`,
        switchId: sw.id,
        scope: sw.scope,
        scopeValue: sw.scopeValue,
      };
    }

    if (sw.scope === "decision_type" && decisionType && sw.scopeValue === decisionType) {
      return {
        blocked: true,
        reason: sw.reason || `Kill switch active for decision type: ${decisionType}`,
        switchId: sw.id,
        scope: sw.scope,
        scopeValue: sw.scopeValue,
      };
    }
  }

  return { blocked: false };
}

export async function getActiveKillSwitches(businessId: number) {
  return db
    .select()
    .from(killSwitches)
    .where(
      and(
        eq(killSwitches.businessId, businessId),
        eq(killSwitches.isEnabled, true)
      )
    )
    .orderBy(killSwitches.createdAt);
}
