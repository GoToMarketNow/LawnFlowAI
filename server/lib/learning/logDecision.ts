import { db } from "../../db";
import { decisionLogs, type DecisionType, type ConfidenceLevel } from "@shared/schema";
import { getActivePolicy } from "./seed";

export interface LogDecisionInput {
  businessId: number;
  runId?: number;
  leadId?: number;
  jobRequestId?: number;
  customerId?: number;
  decisionType: DecisionType;
  stage?: string;
  agentName: string;
  agentVersion: string;
  policyVersion?: string;
  inputsSnapshot: Record<string, unknown>;
  recommendedAction: Record<string, unknown>;
  confidence: ConfidenceLevel;
  reasons?: string[];
}

export async function logDecision(input: LogDecisionInput): Promise<number> {
  let policyVersion = input.policyVersion;
  
  if (!policyVersion) {
    const activePolicy = await getActivePolicy(input.businessId);
    policyVersion = activePolicy?.policyVersion ?? "unknown";
  }
  
  const [inserted] = await db.insert(decisionLogs).values({
    businessId: input.businessId,
    runId: input.runId ?? null,
    leadId: input.leadId ?? null,
    jobRequestId: input.jobRequestId ?? null,
    customerId: input.customerId ?? null,
    decisionType: input.decisionType,
    stage: input.stage ?? null,
    agentName: input.agentName,
    agentVersion: input.agentVersion,
    policyVersion,
    inputsSnapshotJson: input.inputsSnapshot,
    recommendedActionJson: input.recommendedAction,
    confidence: input.confidence,
    reasonsJson: input.reasons ?? [],
  }).returning({ id: decisionLogs.id });
  
  return inserted.id;
}
