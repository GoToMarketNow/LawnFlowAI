import { db } from "../db";
import { jobberQuoteJobSync, jobberEnrichments } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { JobberClient, getJobberClient } from "./jobber-client";
import {
  computeLineItemDiff,
  evaluateRules,
  canAutoApply,
  getChangeOrderReason,
  DEFAULT_RULES,
  LineItem,
  QuoteJobRules,
} from "./jobber-rules";
import crypto from "crypto";

const LAWNFLOW_WRITE_BUFFER_MS = 5000;

interface WebhookPayload {
  webhookEventId: string;
  accountId: string;
  topic: string;
  appId: string;
  data: {
    webUri: string;
  };
  resourceId: string;
  occurredAt: string;
}

interface QuoteJobWorkerOptions {
  rules?: QuoteJobRules;
}

type SyncStatus = "pending" | "processing" | "applied" | "change_order" | "skipped" | "failed";

class QuoteJobSyncQueue {
  private queue: Array<{ payload: WebhookPayload; options: QuoteJobWorkerOptions }> = [];
  private processing = false;

  async enqueue(payload: WebhookPayload, options: QuoteJobWorkerOptions = {}) {
    this.queue.push({ payload, options });
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        try {
          await processQuoteJobEvent(item.payload, item.options);
        } catch (error) {
          console.error("[QuoteJobWorker] Queue processing error:", error);
        }
      }
    }

    this.processing = false;
  }
}

const syncQueue = new QuoteJobSyncQueue();

function computeIdempotencyKey(topic: string, objectId: string, occurredAt: string): string {
  const data = `${topic}:${objectId}:${occurredAt}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function isWritebackLoop(
  accountId: string,
  objectId: string,
  occurredAt: string,
): Promise<boolean> {
  const [enrichment] = await db
    .select({
      lastWriteSource: jobberEnrichments.lastWriteSource,
      lastWriteAt: jobberEnrichments.lastWriteAt,
    })
    .from(jobberEnrichments)
    .where(
      and(
        eq(jobberEnrichments.jobberAccountId, accountId),
        eq(jobberEnrichments.objectId, objectId),
      ),
    )
    .limit(1);

  if (!enrichment || enrichment.lastWriteSource !== "lawnflow" || !enrichment.lastWriteAt) {
    return false;
  }

  const eventTime = new Date(occurredAt).getTime();
  const lastWriteTime = enrichment.lastWriteAt.getTime();

  if (eventTime - lastWriteTime < LAWNFLOW_WRITE_BUFFER_MS) {
    console.log(`[QuoteJobWorker] Detected writeback loop for ${objectId}, skipping`);
    return true;
  }

  return false;
}

async function markWriteSource(
  accountId: string,
  objectType: string,
  objectId: string,
): Promise<void> {
  const now = new Date();
  
  const [existing] = await db
    .select({ id: jobberEnrichments.id })
    .from(jobberEnrichments)
    .where(
      and(
        eq(jobberEnrichments.jobberAccountId, accountId),
        eq(jobberEnrichments.objectId, objectId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(jobberEnrichments)
      .set({
        lastWriteSource: "lawnflow",
        lastWriteAt: now,
        updatedAt: now,
      })
      .where(eq(jobberEnrichments.id, existing.id));
  } else {
    await db.insert(jobberEnrichments).values({
      jobberAccountId: accountId,
      objectType,
      objectId,
      lastWriteSource: "lawnflow",
      lastWriteAt: now,
    });
  }
}

async function processQuoteJobEvent(
  payload: WebhookPayload,
  options: QuoteJobWorkerOptions = {},
): Promise<void> {
  const { topic, accountId, resourceId: objectId, occurredAt, webhookEventId } = payload;
  const rules = options.rules || DEFAULT_RULES;

  const idempotencyKey = computeIdempotencyKey(topic, objectId, occurredAt);

  const [existing] = await db
    .select({ id: jobberQuoteJobSync.id })
    .from(jobberQuoteJobSync)
    .where(eq(jobberQuoteJobSync.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing) {
    console.log(`[QuoteJobWorker] Duplicate event detected: ${idempotencyKey}`);
    return;
  }

  const isLoop = await isWritebackLoop(accountId, objectId, occurredAt);
  if (isLoop) {
    await db.insert(jobberQuoteJobSync).values({
      jobberAccountId: accountId,
      quoteId: objectId,
      idempotencyKey,
      status: "skipped" as SyncStatus,
      changeOrderReason: "Writeback loop detected",
      processedAt: new Date(),
    });
    return;
  }

  await db.insert(jobberQuoteJobSync).values({
    jobberAccountId: accountId,
    quoteId: objectId,
    idempotencyKey,
    status: "processing" as SyncStatus,
  });

  try {
    const client = await getJobberClient(accountId);

    const quoteResult = await client.getQuote(objectId);
    if (!quoteResult?.quote) {
      console.log(`[QuoteJobWorker] Quote ${objectId} not found, skipping`);
      await db
        .update(jobberQuoteJobSync)
        .set({
          status: "skipped" as SyncStatus,
          changeOrderReason: "Quote not found",
          processedAt: new Date(),
        })
        .where(eq(jobberQuoteJobSync.idempotencyKey, idempotencyKey));
      return;
    }

    const quote = quoteResult.quote;

    if (quote.quoteStatus !== "approved" && quote.quoteStatus !== "APPROVED") {
      console.log(`[QuoteJobWorker] Quote ${objectId} not approved (${quote.quoteStatus}), skipping`);
      await db
        .update(jobberQuoteJobSync)
        .set({
          status: "skipped" as SyncStatus,
          changeOrderReason: `Quote status: ${quote.quoteStatus}`,
          processedAt: new Date(),
        })
        .where(eq(jobberQuoteJobSync.idempotencyKey, idempotencyKey));
      return;
    }

    const jobId = await findLinkedJob(client, quote);
    
    if (!jobId) {
      console.log(`[QuoteJobWorker] No linked job found for quote ${objectId}`);
      await db
        .update(jobberQuoteJobSync)
        .set({
          status: "skipped" as SyncStatus,
          changeOrderReason: "No linked job found",
          processedAt: new Date(),
        })
        .where(eq(jobberQuoteJobSync.idempotencyKey, idempotencyKey));
      return;
    }

    const jobResult = await client.getJob(jobId);
    if (!jobResult?.job) {
      console.log(`[QuoteJobWorker] Job ${jobId} not found`);
      await db
        .update(jobberQuoteJobSync)
        .set({
          jobId,
          status: "skipped" as SyncStatus,
          changeOrderReason: "Linked job not found",
          processedAt: new Date(),
        })
        .where(eq(jobberQuoteJobSync.idempotencyKey, idempotencyKey));
      return;
    }

    const job = jobResult.job;

    const quoteLineItems: LineItem[] = (quote.lineItems?.nodes || []).map((li: any) => ({
      name: li.name || "",
      description: li.description || "",
      quantity: parseFloat(li.quantity) || 0,
      unitPrice: Math.round((parseFloat(li.unitPrice) || 0) * 100),
      total: Math.round((parseFloat(li.total) || 0) * 100),
      category: li.category || undefined,
    }));

    const jobLineItems: LineItem[] = (job.lineItems?.nodes || []).map((li: any) => ({
      name: li.name || "",
      description: li.description || "",
      quantity: parseFloat(li.quantity) || 0,
      unitPrice: Math.round((parseFloat(li.unitPrice) || 0) * 100),
      total: Math.round((parseFloat(li.total) || 0) * 100),
      category: li.category || undefined,
    }));

    const diffs = computeLineItemDiff(quoteLineItems, jobLineItems);
    const diffResult = evaluateRules(diffs, rules);

    if (canAutoApply(diffResult)) {
      console.log(`[QuoteJobWorker] Auto-applying changes to job ${jobId}`);
      
      const lineItemsForApi = quoteLineItems.map(li => ({
        name: li.name,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice / 100,
      }));
      const updateResult = await client.updateJobLineItems(jobId, lineItemsForApi);
      
      if (updateResult?.jobEdit?.userErrors?.length > 0) {
        const errors = updateResult.jobEdit.userErrors.map((e: any) => e.message).join("; ");
        throw new Error(`Jobber API error: ${errors}`);
      }
      
      await markWriteSource(accountId, "job", jobId);

      await db
        .update(jobberQuoteJobSync)
        .set({
          jobId,
          status: "applied" as SyncStatus,
          diffComputed: diffResult,
          appliedChanges: { lineItems: quoteLineItems },
          processedAt: new Date(),
        })
        .where(eq(jobberQuoteJobSync.idempotencyKey, idempotencyKey));

      console.log(`[QuoteJobWorker] Successfully applied changes to job ${jobId}`);
    } else {
      console.log(`[QuoteJobWorker] Change order required for job ${jobId}`);
      
      const reason = getChangeOrderReason(diffResult.violations);
      
      const customFieldResult = await client.setJobCustomField(jobId, "CHANGE_ORDER_REQUIRED", "true");
      if (customFieldResult?.jobEdit?.userErrors?.length > 0) {
        console.warn(`[QuoteJobWorker] Custom field update warning:`, customFieldResult.jobEdit.userErrors);
      }
      
      const noteResult = await client.addJobNote(jobId, `LawnFlow: Change order required - ${reason}`);
      if (noteResult?.noteCreate?.userErrors?.length > 0) {
        console.warn(`[QuoteJobWorker] Note creation warning:`, noteResult.noteCreate.userErrors);
      }
      
      await markWriteSource(accountId, "job", jobId);

      await db
        .update(jobberQuoteJobSync)
        .set({
          jobId,
          status: "change_order" as SyncStatus,
          diffComputed: diffResult,
          rulesViolations: diffResult.violations.map(v => v.message),
          changeOrderReason: reason,
          processedAt: new Date(),
        })
        .where(eq(jobberQuoteJobSync.idempotencyKey, idempotencyKey));

      console.log(`[QuoteJobWorker] Flagged job ${jobId} for change order`);
    }
  } catch (error: any) {
    console.error(`[QuoteJobWorker] Error processing quote ${objectId}:`, error);
    await db
      .update(jobberQuoteJobSync)
      .set({
        status: "failed" as SyncStatus,
        error: error.message || "Unknown error",
        processedAt: new Date(),
      })
      .where(eq(jobberQuoteJobSync.idempotencyKey, idempotencyKey));
  }
}

async function findLinkedJob(client: JobberClient, quote: any): Promise<string | null> {
  if (quote.job?.id) {
    return quote.job.id;
  }

  if (quote.convertedTo?.job?.id) {
    return quote.convertedTo.job.id;
  }

  if (quote.client?.id) {
    const clientJobs = await client.getClientJobs(quote.client.id);
    if (clientJobs?.client?.jobs?.nodes?.length > 0) {
      const recentJobs = clientJobs.client.jobs.nodes.filter((j: any) => {
        const jobCreated = new Date(j.createdAt);
        const quoteCreated = new Date(quote.createdAt || Date.now());
        const daysDiff = (jobCreated.getTime() - quoteCreated.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff >= 0 && daysDiff <= 7;
      });

      if (recentJobs.length > 0) {
        return recentJobs[0].id;
      }
    }
  }

  return null;
}

export async function handleQuoteJobWebhook(
  payload: WebhookPayload,
  options: QuoteJobWorkerOptions = {},
): Promise<{ acknowledged: boolean; queued: boolean }> {
  const { topic } = payload;

  if (!topic.startsWith("QUOTE_") && !topic.startsWith("JOB_")) {
    return { acknowledged: true, queued: false };
  }

  if (topic === "QUOTE_APPROVED" || topic === "QUOTE_UPDATED") {
    syncQueue.enqueue(payload, options);
    return { acknowledged: true, queued: true };
  }

  return { acknowledged: true, queued: false };
}

export async function getSyncEvents(
  accountId?: string,
  limit: number = 50,
): Promise<any[]> {
  let query = db.select().from(jobberQuoteJobSync);
  
  if (accountId) {
    query = query.where(eq(jobberQuoteJobSync.jobberAccountId, accountId)) as any;
  }

  return query.orderBy(jobberQuoteJobSync.createdAt).limit(limit);
}

export { syncQueue, processQuoteJobEvent };
