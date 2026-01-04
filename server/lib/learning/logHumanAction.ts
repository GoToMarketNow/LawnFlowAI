import { db } from "../../db";
import { humanActionLogs, decisionLogs, type HumanActionType } from "@shared/schema";
import { eq } from "drizzle-orm";
import { computeJsonDiff } from "./diff";

export interface LogHumanActionInput {
  businessId: number;
  decisionId: number;
  userId: number;
  role: string;
  actionType: HumanActionType;
  finalAction: Record<string, unknown>;
  reasonCodes?: string[];
  note?: string;
}

export async function logHumanAction(input: LogHumanActionInput): Promise<number> {
  const [decision] = await db.select()
    .from(decisionLogs)
    .where(eq(decisionLogs.id, input.decisionId))
    .limit(1);
  
  if (!decision) {
    throw new Error(`DecisionLog ${input.decisionId} not found`);
  }
  
  const recommendedAction = decision.recommendedActionJson as Record<string, unknown>;
  const editDelta = computeJsonDiff(recommendedAction, input.finalAction);
  
  const decisionCreatedAt = decision.createdAt;
  const now = new Date();
  const timeToActionSeconds = Math.floor((now.getTime() - decisionCreatedAt.getTime()) / 1000);
  
  const [inserted] = await db.insert(humanActionLogs).values({
    businessId: input.businessId,
    decisionId: input.decisionId,
    userId: input.userId,
    role: input.role,
    actionType: input.actionType,
    finalActionJson: input.finalAction,
    editDeltaJson: editDelta,
    reasonCodesJson: input.reasonCodes ?? [],
    note: input.note ?? null,
    timeToActionSeconds,
  }).returning({ id: humanActionLogs.id });
  
  return inserted.id;
}
