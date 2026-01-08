import { db } from "../../db";
import { csatRecords, reviewModerationQueue, insertReviewModerationQueueSchema } from "../../../shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// Type Definitions
// ============================================

export interface ReviewManagementInput {
  csatRecordId: number;
  customerPhone: string;
  customerName: string;
}

export interface ReviewManagementResult {
  success: boolean;
  ratingPromptSent: boolean;
  error?: string;
}

export interface RatingResponseResult {
  success: boolean;
  nextAction: "collect_review" | "escalate" | "complete";
  csatRecordId?: number;
  starRating?: number;
}

export interface ReviewTextResult {
  success: boolean;
  reviewQueueId?: number;
  needsModeration: boolean;
}

export interface ModerationResult {
  approved: boolean;
  appropriatenessScore: number;
  authenticityScore: number;
  completenessScore: number;
  rejectionReason?: string;
}

// ============================================
// Main Review Management Agent
// ============================================

/**
 * Review Management Agent
 * Handles rating collection and review text gathering
 * Triggered after customer confirms satisfaction
 */
export async function runReviewManagementAgent(
  input: ReviewManagementInput
): Promise<ReviewManagementResult> {
  try {
    console.log(`[ReviewManagementAgent] Starting for CSAT record ${input.csatRecordId}`);

    // Send rating prompt (1-5 stars)
    const ratingPromptSent = await sendRatingPrompt(input.customerPhone, input.customerName);

    if (ratingPromptSent) {
      // Update CSAT record status
      await db
        .update(csatRecords)
        .set({
          status: "rating_prompt_sent",
          ratingPromptSentAt: new Date(),
        })
        .where(eq(csatRecords.id, input.csatRecordId));

      console.log(`[ReviewManagementAgent] Rating prompt sent successfully`);
    }

    return {
      success: true,
      ratingPromptSent,
    };
  } catch (error) {
    console.error(`[ReviewManagementAgent] Error:`, error);
    return {
      success: false,
      ratingPromptSent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// SMS Communication
// ============================================

/**
 * Send rating prompt via SMS
 */
async function sendRatingPrompt(customerPhone: string, customerName: string): Promise<boolean> {
  try {
    const message = `Thanks ${customerName}! On a scale of 1-5 stars, how would you rate your experience? (1=Poor, 5=Excellent)`;

    // TODO: Integrate with actual Twilio API
    console.log(`[ReviewManagementAgent] Would send SMS to ${customerPhone}: ${message}`);
    return true;
  } catch (error) {
    console.error(`[ReviewManagementAgent] Failed to send rating prompt:`, error);
    return false;
  }
}

/**
 * Send review text request via SMS (for 4-5 star ratings)
 */
async function sendReviewTextRequest(customerPhone: string, customerName: string): Promise<boolean> {
  try {
    const message = `We're so glad you had a great experience, ${customerName}! Would you mind sharing a quick review? Just reply with a few sentences about your experience.`;

    // TODO: Integrate with actual Twilio API
    console.log(`[ReviewManagementAgent] Would send SMS to ${customerPhone}: ${message}`);
    return true;
  } catch (error) {
    console.error(`[ReviewManagementAgent] Failed to send review text request:`, error);
    return false;
  }
}

// ============================================
// Inbound Response Handlers
// ============================================

/**
 * Handle customer rating response (1-5)
 */
export async function handleRatingResponse(
  from: string,
  body: string,
  receivedAt: Date
): Promise<RatingResponseResult> {
  try {
    console.log(`[ReviewManagementAgent] Received rating from ${from}: ${body}`);

    // Find the most recent CSAT record awaiting rating
    const csatRecord = await db.query.csatRecords.findFirst({
      where: (csat, { eq, and, isNull }) =>
        and(eq(csat.customerPhone, from), isNull(csat.ratingResponse)),
      orderBy: (csat, { desc }) => [desc(csat.createdAt)],
    });

    if (!csatRecord) {
      console.log(`[ReviewManagementAgent] No pending CSAT record found for ${from}`);
      return { success: false, nextAction: "complete" };
    }

    // Parse star rating (1-5)
    const starRating = parseStarRating(body);

    if (!starRating) {
      console.log(`[ReviewManagementAgent] Could not parse star rating from: ${body}`);
      return { success: false, nextAction: "complete" };
    }

    // Update CSAT record
    await db
      .update(csatRecords)
      .set({
        ratingResponse: body,
        ratingResponseAt: receivedAt,
        starRating,
        status: starRating >= 4 ? "review_prompt_sent" : "rating_received",
      })
      .where(eq(csatRecords.id, csatRecord.id));

    console.log(`[ReviewManagementAgent] Updated CSAT record ${csatRecord.id} with ${starRating} stars`);

    // Determine next action based on rating
    if (starRating >= 4) {
      // High rating: request review text
      await sendReviewTextRequest(from, csatRecord.customerName || "Customer");

      await db
        .update(csatRecords)
        .set({
          reviewTextPromptSentAt: new Date(),
        })
        .where(eq(csatRecords.id, csatRecord.id));

      return {
        success: true,
        nextAction: "collect_review",
        csatRecordId: csatRecord.id,
        starRating,
      };
    } else if (starRating <= 2) {
      // Low rating: escalate for resolution
      await db
        .update(csatRecords)
        .set({
          escalatedAt: receivedAt,
          escalationReason: `Low rating: ${starRating} stars`,
          status: "escalated",
        })
        .where(eq(csatRecords.id, csatRecord.id));

      return {
        success: true,
        nextAction: "escalate",
        csatRecordId: csatRecord.id,
        starRating,
      };
    } else {
      // Neutral rating (3 stars): no further action
      await db
        .update(csatRecords)
        .set({
          status: "completed",
        })
        .where(eq(csatRecords.id, csatRecord.id));

      return {
        success: true,
        nextAction: "complete",
        csatRecordId: csatRecord.id,
        starRating,
      };
    }
  } catch (error) {
    console.error(`[ReviewManagementAgent] Error handling rating response:`, error);
    return { success: false, nextAction: "complete" };
  }
}

/**
 * Handle customer review text response
 */
export async function handleReviewTextResponse(
  from: string,
  body: string,
  receivedAt: Date
): Promise<ReviewTextResult> {
  try {
    console.log(`[ReviewManagementAgent] Received review text from ${from}`);

    // Find the most recent CSAT record awaiting review text
    const csatRecord = await db.query.csatRecords.findFirst({
      where: (csat, { eq, and, isNull }) =>
        and(eq(csat.customerPhone, from), isNull(csat.reviewTextResponse)),
      orderBy: (csat, { desc }) => [desc(csat.createdAt)],
    });

    if (!csatRecord) {
      console.log(`[ReviewManagementAgent] No pending CSAT record found for ${from}`);
      return { success: false, needsModeration: false };
    }

    // Update CSAT record with review text
    await db
      .update(csatRecords)
      .set({
        reviewTextResponse: body,
        reviewTextResponseAt: receivedAt,
        reviewText: body,
        reviewOptIn: true, // Customer provided review text = implicit opt-in
        status: "review_moderated",
      })
      .where(eq(csatRecords.id, csatRecord.id));

    console.log(`[ReviewManagementAgent] Stored review text for CSAT record ${csatRecord.id}`);

    // Create moderation queue entry
    const moderationQueue = await db
      .insert(reviewModerationQueue)
      .values({
        csatRecordId: csatRecord.id,
        reviewText: body,
        status: "pending",
      })
      .returning();

    const reviewQueueId = moderationQueue[0].id;
    console.log(`[ReviewManagementAgent] Created moderation queue entry ${reviewQueueId}`);

    // Run AI moderation
    const moderationResult = await moderateReview(reviewQueueId);

    // Update moderation status
    if (moderationResult.approved) {
      await db
        .update(csatRecords)
        .set({
          status: "review_posted",
        })
        .where(eq(csatRecords.id, csatRecord.id));

      // TODO: Actually post to Google Business Profile
      // await postToGoogleReviews(csatRecord.id);
    }

    return {
      success: true,
      reviewQueueId,
      needsModeration: !moderationResult.approved,
    };
  } catch (error) {
    console.error(`[ReviewManagementAgent] Error handling review text:`, error);
    return { success: false, needsModeration: false };
  }
}

// ============================================
// Parsing Utilities
// ============================================

/**
 * Parse star rating (1-5) from customer response
 */
function parseStarRating(body: string): number | null {
  const normalized = body.toLowerCase().trim();

  // Look for number 1-5
  const numberMatch = normalized.match(/[1-5]/);
  if (numberMatch) {
    return parseInt(numberMatch[0]);
  }

  // Look for star emoji
  const starCount = (normalized.match(/⭐/g) || []).length;
  if (starCount >= 1 && starCount <= 5) {
    return starCount;
  }

  // Text-based ratings
  if (normalized.includes("excellent") || normalized.includes("perfect") || normalized.includes("amazing")) {
    return 5;
  }
  if (normalized.includes("good") || normalized.includes("great")) {
    return 4;
  }
  if (normalized.includes("okay") || normalized.includes("ok") || normalized.includes("average")) {
    return 3;
  }
  if (normalized.includes("poor") || normalized.includes("bad")) {
    return 2;
  }
  if (normalized.includes("terrible") || normalized.includes("awful")) {
    return 1;
  }

  return null;
}

// ============================================
// AI Moderation
// ============================================

/**
 * Moderate review using AI to check appropriateness, authenticity, and completeness
 */
export async function moderateReview(reviewQueueId: number): Promise<ModerationResult> {
  try {
    console.log(`[ReviewManagementAgent] Moderating review ${reviewQueueId}`);

    // Fetch review from queue
    const reviewQueue = await db.query.reviewModerationQueue.findFirst({
      where: (queue, { eq }) => eq(queue.id, reviewQueueId),
    });

    if (!reviewQueue) {
      throw new Error(`Review queue ${reviewQueueId} not found`);
    }

    // Run AI moderation
    const moderationResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a review moderation assistant. Analyze the following customer review and provide scores (0.0-1.0) for:
1. appropriateness: No profanity, threats, or inappropriate content
2. authenticity: Appears genuine, not spam or fake
3. completeness: Has meaningful content (at least 10 words with substance)

Respond in JSON format:
{
  "appropriateness": 0.95,
  "authenticity": 0.90,
  "completeness": 0.85,
  "approved": true,
  "rejectionReason": null
}

Set approved=false if any score is below 0.7. Provide rejectionReason if rejected.`,
        },
        {
          role: "user",
          content: `Review text: "${reviewQueue.reviewText}"`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(moderationResponse.choices[0]?.message?.content || "{}");

    // Update moderation queue with scores
    await db
      .update(reviewModerationQueue)
      .set({
        appropriatenessScore: result.appropriateness,
        authenticityScore: result.authenticity,
        completenessScore: result.completeness,
        status: result.approved ? "approved" : "rejected",
        moderatedAt: new Date(),
        moderatedBy: "ai",
        rejectionReason: result.rejectionReason,
      })
      .where(eq(reviewModerationQueue.id, reviewQueueId));

    console.log(`[ReviewManagementAgent] Moderation complete: ${result.approved ? "APPROVED" : "REJECTED"}`);

    return {
      approved: result.approved,
      appropriatenessScore: result.appropriateness,
      authenticityScore: result.authenticity,
      completenessScore: result.completeness,
      rejectionReason: result.rejectionReason,
    };
  } catch (error) {
    console.error(`[ReviewManagementAgent] Error moderating review:`, error);
    // Default to manual review on error
    await db
      .update(reviewModerationQueue)
      .set({
        status: "manual_review",
      })
      .where(eq(reviewModerationQueue.id, reviewQueueId));

    return {
      approved: false,
      appropriatenessScore: 0,
      authenticityScore: 0,
      completenessScore: 0,
      rejectionReason: "Automatic moderation failed, requires manual review",
    };
  }
}

// ============================================
// Review Posting
// ============================================

/**
 * Post approved review to Google Business Profile
 * TODO: Implement Google Business Profile API integration
 */
export async function postToGoogleReviews(csatRecordId: number): Promise<{ success: boolean }> {
  try {
    console.log(`[ReviewManagementAgent] Posting review for CSAT record ${csatRecordId}`);

    // Fetch CSAT record
    const csatRecord = await db.query.csatRecords.findFirst({
      where: (csat, { eq }) => eq(csat.id, csatRecordId),
    });

    if (!csatRecord || !csatRecord.reviewText) {
      throw new Error(`CSAT record ${csatRecordId} not found or has no review text`);
    }

    // TODO: Implement actual Google Business Profile API call
    // For now, just send the customer a link to leave a review
    const reviewLink = `https://g.page/r/YOUR_BUSINESS_REVIEW_LINK`;
    const message = `Thank you for your review! You can also share it on Google: ${reviewLink}`;

    console.log(`[ReviewManagementAgent] Would send review link to ${csatRecord.customerPhone}`);

    // Update CSAT record
    await db
      .update(csatRecords)
      .set({
        reviewPostedAt: new Date(),
        reviewPostedTo: ["google"],
        status: "completed",
      })
      .where(eq(csatRecords.id, csatRecordId));

    return { success: true };
  } catch (error) {
    console.error(`[ReviewManagementAgent] Error posting review:`, error);
    return { success: false };
  }
}