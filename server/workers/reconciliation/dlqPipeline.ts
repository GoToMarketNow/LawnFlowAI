import { db } from "../../db";
import { deadLetterQueue, type InsertDeadLetterQueueItem } from "@shared/schema";
import { eq, and, lt, lte } from "drizzle-orm";

const DEFAULT_MAX_RETRIES = 3;
const RETRY_BACKOFF_BASE_MS = 5000;

export interface DLQEntry {
  webhookEventId: string;
  accountId: string;
  businessId?: number;
  topic: string;
  objectId: string;
  occurredAt?: Date;
  payload?: any;
  failureReason: string;
  failureDetails?: string;
}

export async function addToDeadLetterQueue(entry: DLQEntry): Promise<number> {
  console.log(`[DLQ] Adding failed event to queue: ${entry.topic} ${entry.objectId}`);
  
  const nextRetryAt = new Date(Date.now() + RETRY_BACKOFF_BASE_MS);
  
  const insertData: InsertDeadLetterQueueItem = {
    businessId: entry.businessId,
    jobberAccountId: entry.accountId,
    webhookEventId: entry.webhookEventId,
    topic: entry.topic,
    objectId: entry.objectId,
    occurredAt: entry.occurredAt,
    payload: entry.payload ? JSON.stringify(entry.payload) : undefined,
    failureReason: entry.failureReason,
    failureDetails: entry.failureDetails,
    retryCount: 0,
    maxRetries: DEFAULT_MAX_RETRIES,
    nextRetryAt,
    status: "pending",
  };

  try {
    const [existing] = await db
      .select()
      .from(deadLetterQueue)
      .where(eq(deadLetterQueue.webhookEventId, entry.webhookEventId))
      .limit(1);

    if (existing) {
      await db
        .update(deadLetterQueue)
        .set({
          failureReason: entry.failureReason,
          failureDetails: entry.failureDetails,
          nextRetryAt,
          status: "pending",
        })
        .where(eq(deadLetterQueue.id, existing.id));
      console.log(`[DLQ] Event ${entry.webhookEventId} updated in queue with id ${existing.id}`);
      return existing.id;
    }

    const [result] = await db
      .insert(deadLetterQueue)
      .values(insertData)
      .returning({ id: deadLetterQueue.id });

    console.log(`[DLQ] Event ${entry.webhookEventId} added to queue with id ${result.id}`);
    return result.id;
  } catch (error) {
    console.error(`[DLQ] Failed to add event to queue:`, error);
    throw error;
  }
}

export async function getRetryableItems(limit: number = 10) {
  const now = new Date();
  
  return db
    .select()
    .from(deadLetterQueue)
    .where(and(
      eq(deadLetterQueue.status, "pending"),
      lte(deadLetterQueue.nextRetryAt, now)
    ))
    .orderBy(deadLetterQueue.nextRetryAt)
    .limit(limit);
}

export async function markRetryAttempt(
  itemId: number,
  success: boolean,
  errorDetails?: string
): Promise<void> {
  const [item] = await db
    .select()
    .from(deadLetterQueue)
    .where(eq(deadLetterQueue.id, itemId))
    .limit(1);

  if (!item) {
    console.warn(`[DLQ] Item ${itemId} not found`);
    return;
  }

  const now = new Date();

  if (success) {
    await db
      .update(deadLetterQueue)
      .set({
        status: "resolved",
        resolvedAt: now,
        lastRetryAt: now,
      })
      .where(eq(deadLetterQueue.id, itemId));

    console.log(`[DLQ] Item ${itemId} resolved after ${item.retryCount} attempts`);
    return;
  }

  const newRetryCount = item.retryCount + 1;

  if (newRetryCount >= item.maxRetries) {
    await db
      .update(deadLetterQueue)
      .set({
        status: "exhausted",
        lastRetryAt: now,
        retryCount: newRetryCount,
        failureDetails: errorDetails || item.failureDetails,
      })
      .where(eq(deadLetterQueue.id, itemId));

    console.log(`[DLQ] Item ${itemId} exhausted after ${newRetryCount} attempts`);
    return;
  }

  const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, newRetryCount);
  const nextRetryAt = new Date(Date.now() + backoffMs);

  await db
    .update(deadLetterQueue)
    .set({
      status: "retrying",
      lastRetryAt: now,
      nextRetryAt,
      retryCount: newRetryCount,
      failureDetails: errorDetails || item.failureDetails,
    })
    .where(eq(deadLetterQueue.id, itemId));

  console.log(`[DLQ] Item ${itemId} scheduled for retry ${newRetryCount}/${item.maxRetries} at ${nextRetryAt.toISOString()}`);
}

export async function discardItem(itemId: number, reason?: string): Promise<void> {
  await db
    .update(deadLetterQueue)
    .set({
      status: "discarded",
      resolvedAt: new Date(),
      failureDetails: reason,
    })
    .where(eq(deadLetterQueue.id, itemId));

  console.log(`[DLQ] Item ${itemId} discarded: ${reason || "No reason given"}`);
}

export async function getDLQSummary(businessId?: number) {
  let query = db.select().from(deadLetterQueue);
  
  if (businessId) {
    query = query.where(eq(deadLetterQueue.businessId, businessId)) as typeof query;
  }
  
  const items = await query;

  return {
    total: items.length,
    byStatus: {
      pending: items.filter(i => i.status === "pending").length,
      retrying: items.filter(i => i.status === "retrying").length,
      exhausted: items.filter(i => i.status === "exhausted").length,
      resolved: items.filter(i => i.status === "resolved").length,
      discarded: items.filter(i => i.status === "discarded").length,
    },
    byTopic: items.reduce((acc, i) => {
      acc[i.topic] = (acc[i.topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}

export type { InsertDeadLetterQueueItem };
