import type { OpsCommsThread } from "@shared/schema";
import { storage } from "../../storage";

export interface UrgencyFactors {
  slaBreach: boolean;
  slaMinutesRemaining: number | null;
  hasNegativeSentiment: boolean;
  sentimentScore: number | null;
  audienceType: string;
  hasQuotePending: boolean;
  hasJobScheduled: boolean;
  waitingHours: number;
  lastMessageWasInbound: boolean;
  hasPendingApproval: boolean;
}

export interface UrgencyResult {
  score: number;
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  reason: string;
}

export function computeUrgency(factors: UrgencyFactors): UrgencyResult {
  let score = 0;
  const reasons: string[] = [];

  if (factors.slaBreach) {
    score += 40;
    reasons.push("SLA breached");
  } else if (factors.slaMinutesRemaining !== null && factors.slaMinutesRemaining < 30) {
    score += 30;
    reasons.push("SLA breach imminent");
  } else if (factors.slaMinutesRemaining !== null && factors.slaMinutesRemaining < 60) {
    score += 20;
    reasons.push("SLA deadline approaching");
  }

  if (factors.hasNegativeSentiment) {
    score += 25;
    reasons.push("Negative sentiment detected");
  } else if (factors.sentimentScore !== null && factors.sentimentScore < -30) {
    score += 15;
    reasons.push("Customer sentiment declining");
  }

  if (factors.hasPendingApproval) {
    score += 15;
    reasons.push("Pending approval required");
  }

  if (factors.audienceType === "LEAD" && factors.hasQuotePending) {
    score += 15;
    reasons.push("Hot lead with pending quote");
  }

  if (factors.hasJobScheduled) {
    score += 10;
    reasons.push("Job scheduled - time-sensitive");
  }

  if (factors.waitingHours >= 24) {
    score += 15;
    reasons.push("Waiting over 24 hours");
  } else if (factors.waitingHours >= 4) {
    score += 5;
    reasons.push("Waiting over 4 hours");
  }

  if (factors.lastMessageWasInbound) {
    score += 5;
    reasons.push("Awaiting reply");
  }

  score = Math.min(100, score);

  let level: UrgencyResult["level"];
  if (score >= 70) {
    level = "CRITICAL";
  } else if (score >= 50) {
    level = "HIGH";
  } else if (score >= 25) {
    level = "MEDIUM";
  } else {
    level = "LOW";
  }

  return {
    score,
    level,
    reason: reasons.length > 0 ? reasons.join("; ") : "Normal priority"
  };
}

export async function recomputeThreadUrgency(threadId: number): Promise<OpsCommsThread> {
  const thread = await storage.getOpsCommsThread(threadId);
  if (!thread) {
    throw new Error(`Thread ${threadId} not found`);
  }

  const now = new Date();
  const lastMessageAt = thread.lastMessageAt ? new Date(thread.lastMessageAt) : now;
  const waitingHours = (now.getTime() - lastMessageAt.getTime()) / (1000 * 60 * 60);

  let slaMinutesRemaining: number | null = null;
  let slaBreach = false;
  if (thread.slaDeadlineAt) {
    const deadline = new Date(thread.slaDeadlineAt);
    slaMinutesRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60);
    slaBreach = slaMinutesRemaining < 0;
  }

  const lastInboundAt = thread.lastInboundAt ? new Date(thread.lastInboundAt).getTime() : 0;
  const lastOutboundAt = thread.lastOutboundAt ? new Date(thread.lastOutboundAt).getTime() : 0;
  const lastMessageWasInbound = lastInboundAt > lastOutboundAt;

  const factors: UrgencyFactors = {
    slaBreach,
    slaMinutesRemaining,
    hasNegativeSentiment: thread.hasNegativeSentiment,
    sentimentScore: thread.sentimentScore,
    audienceType: thread.audienceType,
    hasQuotePending: !!thread.relatedQuoteId,
    hasJobScheduled: !!thread.relatedJobId,
    waitingHours,
    lastMessageWasInbound,
    hasPendingApproval: thread.hasPendingApproval
  };

  const result = computeUrgency(factors);

  return storage.updateOpsCommsThreadUrgency(
    threadId,
    result.score,
    result.level,
    result.reason
  );
}

export async function recomputeAllThreadUrgencies(accountId: number): Promise<void> {
  const threads = await storage.getOpsCommsThreads(accountId, { excludeResolved: true });
  for (const thread of threads) {
    await recomputeThreadUrgency(thread.id);
  }
}
