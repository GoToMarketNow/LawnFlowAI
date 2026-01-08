import { Router } from "express";
import {
  handleJobCompletion,
  routeInboundCSATMessage,
  getCSATAnalytics,
  getModerationQueue,
  manuallyTriggerRatingPrompt,
  getCSATRecord,
} from "./orchestrator/postJobQA/engine";
import { moderateReview } from "./orchestrator/postJobQA/reviewManagementAgent";

const router = Router();

// ============================================
// POST-JOB QA ROUTES
// ============================================

/**
 * POST /api/post-job-qa/job-completed
 * Webhook endpoint for crew mobile app to trigger Post-Job QA workflow
 *
 * Body: {
 *   jobId: number;
 *   businessId: number;
 *   crewMemberId?: number;
 *   photoUrls?: string[];
 * }
 */
router.post("/post-job-qa/job-completed", async (req, res) => {
  try {
    const { jobId, businessId, crewMemberId, photoUrls } = req.body;

    // Validate required fields
    if (!jobId || !businessId) {
      return res.status(400).json({
        error: "Missing required fields: jobId and businessId are required",
      });
    }

    console.log(`[API] Job completion webhook received for job ${jobId}`);

    // Trigger Post-Job QA workflow
    const result = await handleJobCompletion(jobId, businessId, crewMemberId, photoUrls);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || "Failed to process job completion",
      });
    }

    res.json({
      success: true,
      csatRecordId: result.csatRecordId,
      message: "Post-Job QA workflow initiated successfully",
    });
  } catch (error) {
    console.error("[API] Error in job-completed webhook:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/post-job-qa/inbound-sms
 * Webhook endpoint for Twilio to send inbound SMS messages
 *
 * Body (Twilio format): {
 *   From: string;  // Customer phone number
 *   Body: string;  // Message text
 *   MessageSid: string;
 * }
 */
router.post("/post-job-qa/inbound-sms", async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;

    if (!From || !Body) {
      return res.status(400).json({
        error: "Missing required Twilio fields: From and Body",
      });
    }

    console.log(`[API] Inbound SMS from ${From}: ${Body}`);

    // Route message to appropriate CSAT handler
    const result = await routeInboundCSATMessage(From, Body);

    // Respond to Twilio (empty response = no auto-reply)
    res.status(200).send();

    console.log(`[API] Inbound SMS handled: ${result.action}`);
  } catch (error) {
    console.error("[API] Error in inbound-sms webhook:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/post-job-qa/analytics/:businessId
 * Get CSAT analytics for a business
 *
 * Query params:
 *   limit?: number (default: 10)
 */
router.get("/post-job-qa/analytics/:businessId", async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    if (isNaN(businessId)) {
      return res.status(400).json({
        error: "Invalid businessId: must be a number",
      });
    }

    console.log(`[API] Fetching CSAT analytics for business ${businessId}`);

    const analytics = await getCSATAnalytics(businessId, limit);

    res.json({
      success: true,
      businessId,
      ...analytics,
    });
  } catch (error) {
    console.error("[API] Error fetching CSAT analytics:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/post-job-qa/csat-record/:csatRecordId
 * Get details of a specific CSAT record
 */
router.get("/post-job-qa/csat-record/:csatRecordId", async (req, res) => {
  try {
    const csatRecordId = parseInt(req.params.csatRecordId);

    if (isNaN(csatRecordId)) {
      return res.status(400).json({
        error: "Invalid csatRecordId: must be a number",
      });
    }

    console.log(`[API] Fetching CSAT record ${csatRecordId}`);

    const record = await getCSATRecord(csatRecordId);

    if (!record) {
      return res.status(404).json({
        error: "CSAT record not found",
      });
    }

    res.json({
      success: true,
      record,
    });
  } catch (error) {
    console.error("[API] Error fetching CSAT record:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/post-job-qa/moderation-queue/:businessId
 * Get pending review moderation queue entries
 *
 * Query params:
 *   limit?: number (default: 20)
 */
router.get("/post-job-qa/moderation-queue/:businessId", async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    if (isNaN(businessId)) {
      return res.status(400).json({
        error: "Invalid businessId: must be a number",
      });
    }

    console.log(`[API] Fetching moderation queue for business ${businessId}`);

    const queue = await getModerationQueue(businessId, limit);

    res.json({
      success: true,
      businessId,
      queueLength: queue.length,
      queue,
    });
  } catch (error) {
    console.error("[API] Error fetching moderation queue:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/post-job-qa/moderate-review/:reviewQueueId
 * Manually trigger AI moderation for a review
 */
router.post("/post-job-qa/moderate-review/:reviewQueueId", async (req, res) => {
  try {
    const reviewQueueId = parseInt(req.params.reviewQueueId);

    if (isNaN(reviewQueueId)) {
      return res.status(400).json({
        error: "Invalid reviewQueueId: must be a number",
      });
    }

    console.log(`[API] Manually moderating review ${reviewQueueId}`);

    const result = await moderateReview(reviewQueueId);

    res.json({
      success: true,
      reviewQueueId,
      moderation: result,
    });
  } catch (error) {
    console.error("[API] Error moderating review:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/post-job-qa/trigger-rating-prompt/:csatRecordId
 * Manually trigger rating prompt for a CSAT record
 */
router.post("/post-job-qa/trigger-rating-prompt/:csatRecordId", async (req, res) => {
  try {
    const csatRecordId = parseInt(req.params.csatRecordId);

    if (isNaN(csatRecordId)) {
      return res.status(400).json({
        error: "Invalid csatRecordId: must be a number",
      });
    }

    console.log(`[API] Manually triggering rating prompt for CSAT record ${csatRecordId}`);

    const result = await manuallyTriggerRatingPrompt(csatRecordId);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || "Failed to trigger rating prompt",
      });
    }

    res.json({
      success: true,
      csatRecordId,
      message: "Rating prompt sent successfully",
    });
  } catch (error) {
    console.error("[API] Error triggering rating prompt:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

/**
 * GET /api/post-job-qa/health
 * Health check endpoint
 */
router.get("/post-job-qa/health", (req, res) => {
  res.json({
    status: "ok",
    service: "post-job-qa",
    timestamp: new Date().toISOString(),
  });
});

export default router;