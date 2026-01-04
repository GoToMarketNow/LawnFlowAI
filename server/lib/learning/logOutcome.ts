import { db } from "../../db";
import { outcomeLogs, type OutcomeType } from "@shared/schema";

export interface LogOutcomeInput {
  businessId: number;
  decisionId?: number;
  leadId?: number;
  jobRequestId?: number;
  customerId?: number;
  outcomeType: OutcomeType;
  outcomeValue?: Record<string, unknown>;
  occurredAt?: Date;
}

export async function logOutcome(input: LogOutcomeInput): Promise<number> {
  const [inserted] = await db.insert(outcomeLogs).values({
    businessId: input.businessId,
    decisionId: input.decisionId ?? null,
    leadId: input.leadId ?? null,
    jobRequestId: input.jobRequestId ?? null,
    customerId: input.customerId ?? null,
    outcomeType: input.outcomeType,
    outcomeValueJson: input.outcomeValue ?? {},
    occurredAt: input.occurredAt ?? new Date(),
  }).returning({ id: outcomeLogs.id });
  
  return inserted.id;
}
