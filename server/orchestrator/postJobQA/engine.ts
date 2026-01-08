import {
  runPostJobQAAgent,
  handleSatisfactionResponse,
  PostJobQAInput,
} from "./postJobQAAgent";
import {
  runReviewManagementAgent,
  handleRatingResponse,
  handleReviewTextResponse,
  ReviewManagementInput,
} from "./reviewManagementAgent";
import { db } from "../../db";
import { csatRecords } from "../../../shared/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

// ============================================
// Main Orchestration Functions
// ============================================

/**
 * Handle job completion event
 * Entry point for Post-Job QA workflow
 */
export async function handleJobCompletion(
  jobId: number,
  businessId: number,
  crewMemberId?: number,
  photoUrls?: string[]
): Promise<{ success: boolean; csatRecordId?: number; error?: string }> {
  try {
    console.log(`[PostJobQA Engine] Handling job completion for job ${jobId}`);

    // Run Post-Job QA Agent
    const qaResult = await runPostJobQAAgent({
      jobId,
      businessId,
      crewMemberId,
      photoUrls,
    });

    if (!qaResult.success) {
      console.error(`[PostJobQA Engine] Post-Job QA Agent failed:`, qaResult.error);
      return { success: false, error: qaResult.error };
    }

    console.log(`[PostJobQA Engine] Post-Job QA completed successfully`);
    console.log(`  - CSAT Record ID: ${qaResult.csatRecordId}`);
    console.log(`  - Photos Processed: ${qaResult.photosProcessed}`);
    console.log(`  - Satisfaction Prompt Sent: ${qaResult.satisfactionPromptSent}`);

    // TODO: Schedule 24h timeout for rating prompt using BullMQ
    // await scheduleRatingPromptTimeout(qaResult.csatRecordId, 24 * 60 * 60 * 1000);

    return {
      success: true,
      csatRecordId: qaResult.csatRecordId,
    };
  } catch (error) {
    console.error(`[PostJobQA Engine] Error handling job completion:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Route inbound SMS message to appropriate CSAT handler
 * Determines which stage of the workflow the message belongs to
 */
export async function routeInboundCSATMessage(
  from: string,
  body: string,
  receivedAt: Date = new Date()
): Promise<{ handled: boolean; action: string; csatRecordId?: number }> {
  try {
    console.log(`[PostJobQA Engine] Routing inbound message from ${from}`);

    // Check if this is a satisfaction response (awaiting YES/NO)
    const satisfactionPending = await db.query.csatRecords.findFirst({
      where: (csat, { eq, and, isNull }) =>
        and(
          eq(csat.customerPhone, from),
          isNull(csat.satisfactionResponse)
        ),
      orderBy: (csat, { desc }) => [desc(csat.createdAt)],
    });

    if (satisfactionPending) {
      console.log(`[PostJobQA Engine] Processing as satisfaction response`);
      const result = await handleSatisfactionResponse(from, body, receivedAt);

      if (result.success && result.nextAction === "rating_prompt") {
        // Trigger Review Management Agent
        await runReviewManagementAgent({
          csatRecordId: result.csatRecordId!,
          customerPhone: from,
          customerName: "Customer", // TODO: Fetch from CSAT record
        });

        return {
          handled: true,
          action: "triggered_rating_prompt",
          csatRecordId: result.csatRecordId,
        };
      } else if (result.nextAction === "escalate") {
        return {
          handled: true,
          action: "escalated_dissatisfaction",
          csatRecordId: result.csatRecordId,
        };
      }

      return {
        handled: true,
        action: "satisfaction_unclear",
        csatRecordId: result.csatRecordId,
      };
    }

    // Check if this is a rating response (awaiting 1-5 stars)
    const ratingPending = await db.query.csatRecords.findFirst({
      where: (csat, { eq, and, isNull }) =>
        and(
          eq(csat.customerPhone, from),
          isNull(csat.ratingResponse)
        ),
      orderBy: (csat, { desc }) => [desc(csat.createdAt)],
    });

    if (ratingPending) {
      console.log(`[PostJobQA Engine] Processing as rating response`);
      const result = await handleRatingResponse(from, body, receivedAt);

      return {
        handled: true,
        action: result.nextAction,
        csatRecordId: result.csatRecordId,
      };
    }

    // Check if this is a review text response (awaiting review text)
    const reviewTextPending = await db.query.csatRecords.findFirst({
      where: (csat, { eq, and, isNull }) =>
        and(
          eq(csat.customerPhone, from),
          isNull(csat.reviewTextResponse)
        ),
      orderBy: (csat, { desc }) => [desc(csat.createdAt)],
    });

    if (reviewTextPending) {
      console.log(`[PostJobQA Engine] Processing as review text response`);
      const result = await handleReviewTextResponse(from, body, receivedAt);

      return {
        handled: true,
        action: result.needsModeration ? "review_needs_moderation" : "review_posted",
        csatRecordId: reviewTextPending.id,
      };
    }

    // No matching CSAT workflow found
    console.log(`[PostJobQA Engine] No matching CSAT workflow found for ${from}`);
    return {
      handled: false,
      action: "no_matching_workflow",
    };
  } catch (error) {
    console.error(`[PostJobQA Engine] Error routing inbound message:`, error);
    return {
      handled: false,
      action: "error",
    };
  }
}

/**
 * Get CSAT analytics for a business
 */
export async function getCSATAnalytics(
  businessId: number,
  limit: number = 10
): Promise<{
  recentRecords: any[];
  stats: {
    totalRecords: number;
    satisfactionRate: number | null;
    avgStarRating: number | null;
    reviewConversionRate: number | null;
  };
}> {
  try {
    // Fetch recent CSAT records
    const recentRecords = await db.query.csatRecords.findMany({
      where: (csat, { eq }) => eq(csat.businessId, businessId),
      orderBy: (csat, { desc }) => [desc(csat.createdAt)],
      limit,
    });

    // Calculate stats
    const totalRecords = recentRecords.length;
    const satisfiedCount = recentRecords.filter((r) => r.isSatisfied === true).length;
    const ratedCount = recentRecords.filter((r) => r.starRating !== null).length;
    const reviewedCount = recentRecords.filter((r) => r.reviewText !== null).length;

    const totalStars = recentRecords.reduce((sum, r) => sum + (r.starRating || 0), 0);

    const satisfactionRate = totalRecords > 0 ? (satisfiedCount / totalRecords) * 100 : null;
    const avgStarRating = ratedCount > 0 ? totalStars / ratedCount : null;
    const reviewConversionRate = ratedCount > 0 ? (reviewedCount / ratedCount) * 100 : null;

    return {
      recentRecords,
      stats: {
        totalRecords,
        satisfactionRate,
        avgStarRating,
        reviewConversionRate,
      },
    };
  } catch (error) {
    console.error(`[PostJobQA Engine] Error fetching CSAT analytics:`, error);
    return {
      recentRecords: [],
      stats: {
        totalRecords: 0,
        satisfactionRate: null,
        avgStarRating: null,
        reviewConversionRate: null,
      },
    };
  }
}

/**
 * Get pending moderation queue entries
 */
export async function getModerationQueue(businessId: number, limit: number = 20): Promise<any[]> {
  try {
    const queue = await db.query.reviewModerationQueue.findMany({
      where: (moderation, { eq }) => eq(moderation.status, "pending"),
      orderBy: (moderation, { desc }) => [desc(moderation.createdAt)],
      limit,
      with: {
        csatRecord: true,
      },
    });

    return queue;
  } catch (error) {
    console.error(`[PostJobQA Engine] Error fetching moderation queue:`, error);
    return [];
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Manually trigger rating prompt (for testing or manual intervention)
 */
export async function manuallyTriggerRatingPrompt(
  csatRecordId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const csatRecord = await db.query.csatRecords.findFirst({
      where: (csat, { eq }) => eq(csat.id, csatRecordId),
    });

    if (!csatRecord) {
      return { success: false, error: "CSAT record not found" };
    }

    await runReviewManagementAgent({
      csatRecordId,
      customerPhone: csatRecord.customerPhone,
      customerName: csatRecord.customerName || "Customer",
    });

    return { success: true };
  } catch (error) {
    console.error(`[PostJobQA Engine] Error triggering rating prompt:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get CSAT record details
 */
export async function getCSATRecord(csatRecordId: number): Promise<any | null> {
  try {
    const csatRecord = await db.query.csatRecords.findFirst({
      where: (csat, { eq }) => eq(csat.id, csatRecordId),
    });

    return csatRecord || null;
  } catch (error) {
    console.error(`[PostJobQA Engine] Error fetching CSAT record:`, error);
    return null;
  }
}