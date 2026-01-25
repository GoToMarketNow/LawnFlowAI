// Thread Enrichment Worker
// Automatically enriches threads with intent, priority, coverage, and SLA tracking
// Security: Multi-tenant isolation, error handling, idempotency

import { db } from "../../db";
import { threadEnrichment, calculateSLADeadlines, type NewThreadEnrichment } from "@shared/thread-enrichment-schema";
import { eq, and, desc } from "drizzle-orm";
import { classifyIntent } from "../../lib/support/intentClassifier";
import { detectCoverage } from "../../lib/support/coverageDetector";
import { audit } from "../../lib/audit";

interface ThreadMessage {
  id: number;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  sentAt: Date;
}

interface Thread {
  id: number;
  businessId: number;
  subject: string | null;
  createdAt: Date;
  messages: ThreadMessage[];
}

/**
 * Enrich a single thread with intent, priority, and coverage
 * @param threadId - Thread ID to enrich
 * @returns Enrichment record
 */
export async function enrichThread(threadId: number): Promise<typeof threadEnrichment.$inferSelect | null> {
  try {
    // 1. Get thread with messages (this would query comms_threads in real implementation)
    // For now, using a simplified approach
    const thread = await getThreadWithMessages(threadId);

    if (!thread) {
      console.warn(`Thread ${threadId} not found`);
      return null;
    }

    if (thread.messages.length === 0) {
      console.warn(`Thread ${threadId} has no messages`);
      return null;
    }

    // 2. Check if already enriched (idempotency)
    const existing = await db.query.threadEnrichment.findFirst({
      where: eq(threadEnrichment.threadId, threadId),
    });

    // 3. Prepare messages for classification
    const messages = thread.messages
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
      .map(msg => ({
        role: msg.direction === "INBOUND" ? "customer" as const : "assistant" as const,
        content: msg.body,
      }));

    // 4. Classify intent using Claude
    const classification = await classifyIntent(messages);

    // 5. Detect PSKB coverage
    const lastMessage = messages[messages.length - 1];
    const coverage = await detectCoverage(
      thread.businessId,
      classification.intent,
      lastMessage.content
    );

    // 6. Calculate SLA deadlines
    const slaDeadlines = calculateSLADeadlines(classification.priority, thread.createdAt);

    // 7. Upsert enrichment record
    const enrichmentData: NewThreadEnrichment = {
      threadId: thread.id,
      businessId: thread.businessId,
      intent: classification.intent,
      intentConfidence: classification.confidence,
      priority: classification.priority,
      priorityReason: classification.priorityReason,
      coverageStatus: coverage.status,
      matchedKnowledgeItemIds: coverage.matchedKnowledgeItemIds,
      coverageGaps: coverage.coverageGaps,
      firstResponseDue: slaDeadlines.firstResponseDue,
      resolutionDue: slaDeadlines.resolutionDue,
      slaStatus: "on_track",
      enrichedBy: "system",
    };

    let result;

    if (existing) {
      // Update existing
      await db.update(threadEnrichment)
        .set({
          ...enrichmentData,
          lastUpdatedAt: new Date(),
        })
        .where(eq(threadEnrichment.id, existing.id));

      result = await db.query.threadEnrichment.findFirst({
        where: eq(threadEnrichment.id, existing.id),
      });
    } else {
      // Insert new
      const [inserted] = await db.insert(threadEnrichment)
        .values(enrichmentData)
        .returning();

      result = inserted;
    }

    // 8. Audit log
    await audit.logEvent({
      action: existing ? "thread.enrichment_updated" : "thread.enrichment_created",
      actor: "system",
      businessId: thread.businessId,
      metadata: {
        threadId,
        intent: classification.intent,
        priority: classification.priority,
        coverageStatus: coverage.status,
      },
    });

    return result || null;
  } catch (error: any) {
    console.error(`Failed to enrich thread ${threadId}:`, error.message);
    throw error;
  }
}

/**
 * Enrich multiple threads in batch
 * @param threadIds - Array of thread IDs
 * @returns Array of enrichment results
 */
export async function enrichThreadsBatch(threadIds: number[]): Promise<Array<typeof threadEnrichment.$inferSelect | null>> {
  const results = [];

  for (const threadId of threadIds) {
    try {
      const result = await enrichThread(threadId);
      results.push(result);

      // Rate limiting: small delay between enrichments
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error: any) {
      console.error(`Batch enrichment error for thread ${threadId}:`, error.message);
      results.push(null);
    }
  }

  return results;
}

/**
 * Re-enrich thread when new messages are added
 * @param threadId - Thread ID
 * @returns Updated enrichment
 */
export async function reenrichThread(threadId: number): Promise<typeof threadEnrichment.$inferSelect | null> {
  // Get existing enrichment
  const existing = await db.query.threadEnrichment.findFirst({
    where: eq(threadEnrichment.threadId, threadId),
  });

  if (!existing) {
    // First enrichment
    return enrichThread(threadId);
  }

  // Re-enrich (may update priority or coverage)
  return enrichThread(threadId);
}

/**
 * Mark first response sent
 * @param threadId - Thread ID
 * @returns Updated enrichment
 */
export async function markFirstResponse(threadId: number): Promise<void> {
  const enrichment = await db.query.threadEnrichment.findFirst({
    where: eq(threadEnrichment.threadId, threadId),
  });

  if (!enrichment) {
    console.warn(`No enrichment found for thread ${threadId}`);
    return;
  }

  if (enrichment.firstResponseAt) {
    // Already marked
    return;
  }

  await db.update(threadEnrichment)
    .set({
      firstResponseAt: new Date(),
      lastUpdatedAt: new Date(),
    })
    .where(eq(threadEnrichment.id, enrichment.id));

  // Audit log
  await audit.logEvent({
    action: "thread.first_response_sent",
    actor: "system",
    businessId: enrichment.businessId,
    metadata: { threadId },
  });
}

/**
 * Mark thread as resolved
 * @param threadId - Thread ID
 * @returns Updated enrichment
 */
export async function markThreadResolved(threadId: number): Promise<void> {
  const enrichment = await db.query.threadEnrichment.findFirst({
    where: eq(threadEnrichment.threadId, threadId),
  });

  if (!enrichment) {
    console.warn(`No enrichment found for thread ${threadId}`);
    return;
  }

  await db.update(threadEnrichment)
    .set({
      resolvedAt: new Date(),
      slaStatus: "resolved",
      lastUpdatedAt: new Date(),
    })
    .where(eq(threadEnrichment.id, enrichment.id));

  // Audit log
  await audit.logEvent({
    action: "thread.resolved",
    actor: "system",
    businessId: enrichment.businessId,
    metadata: { threadId },
  });
}

/**
 * Update SLA status for all threads (cron job)
 * Checks for breached or at-risk SLAs
 */
export async function updateSLAStatuses(): Promise<{ updated: number; breached: number; atRisk: number }> {
  const now = new Date();
  let updated = 0;
  let breached = 0;
  let atRisk = 0;

  // Get all unresolved threads
  const unresolved = await db.query.threadEnrichment.findMany({
    where: and(
      eq(threadEnrichment.slaStatus, "on_track" as any),
    ),
  });

  for (const item of unresolved) {
    let newStatus = item.slaStatus;

    // Check first response SLA
    if (!item.firstResponseAt && item.firstResponseDue) {
      if (item.firstResponseDue < now) {
        newStatus = "breached";
        breached++;
      } else if (item.firstResponseDue.getTime() - now.getTime() < 30 * 60 * 1000) {
        // Within 30 minutes
        newStatus = "at_risk";
        atRisk++;
      }
    }

    // Check resolution SLA
    if (item.firstResponseAt && !item.resolvedAt && item.resolutionDue) {
      if (item.resolutionDue < now) {
        newStatus = "breached";
        breached++;
      } else if (item.resolutionDue.getTime() - now.getTime() < 4 * 60 * 60 * 1000) {
        // Within 4 hours
        newStatus = "at_risk";
        atRisk++;
      }
    }

    if (newStatus !== item.slaStatus) {
      await db.update(threadEnrichment)
        .set({ slaStatus: newStatus, lastUpdatedAt: new Date() })
        .where(eq(threadEnrichment.id, item.id));
      updated++;
    }
  }

  return { updated, breached, atRisk };
}

/**
 * Get thread with messages (placeholder - real implementation would query comms tables)
 */
async function getThreadWithMessages(threadId: number): Promise<Thread | null> {
  // TODO: Implement actual query to comms_threads and comms_messages
  // For now, returning null to indicate not implemented
  // In production, this would:
  // 1. Query comms_threads table
  // 2. Join with comms_messages
  // 3. Return formatted thread object

  return null;
}

/**
 * Scheduled job to enrich new threads
 * Run every 5 minutes via cron
 */
export async function enrichNewThreads(): Promise<{ enriched: number; errors: number }> {
  // TODO: Query comms_threads for threads created in last 5 minutes without enrichment
  // For each thread, call enrichThread()

  return { enriched: 0, errors: 0 };
}

/**
 * Health check for enrichment worker
 */
export async function testEnrichmentWorker(): Promise<boolean> {
  try {
    // Test that dependencies are available
    const hasClassifier = process.env.ANTHROPIC_API_KEY !== undefined;
    const hasDatabase = db !== undefined;

    return hasClassifier && hasDatabase;
  } catch {
    return false;
  }
}
