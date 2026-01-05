import { Router, Request, Response } from "express";
import { onboardingEngine } from "./engine";
import { z } from "zod";

const router = Router();

// Schema for submitting an answer
const submitAnswerSchema = z.object({
  nodeId: z.string(),
  answer: z.unknown(),
});

// Schema for updating an answer during review
const updateAnswerSchema = z.object({
  nodeId: z.string(),
  answer: z.unknown(),
});

/**
 * GET /api/onboarding/session
 * Get or create an onboarding session for the current user
 */
router.get("/session", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Start or resume session
    const session = await onboardingEngine.startSession(user.id, user.accountId || 1);
    const currentNode = await onboardingEngine.getCurrentNode(session.id);

    res.json({
      session,
      currentNode: currentNode?.node || null,
      progress: currentNode?.progress || 0,
    });
  } catch (error) {
    console.error("[Onboarding] Error getting session:", error);
    res.status(500).json({ error: "Failed to get onboarding session" });
  }
});

/**
 * GET /api/onboarding/session/:id
 * Get a specific onboarding session with all answers
 */
router.get("/session/:id", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const sessionId = parseInt(req.params.id, 10);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    const session = await onboardingEngine.resumeSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Verify ownership - user must own this session
    if (session.userId !== user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const currentNode = await onboardingEngine.getCurrentNode(sessionId);

    res.json({
      session,
      currentNode: currentNode?.node || null,
      progress: currentNode?.progress || 0,
    });
  } catch (error) {
    console.error("[Onboarding] Error getting session:", error);
    res.status(500).json({ error: "Failed to get onboarding session" });
  }
});

/**
 * GET /api/onboarding/node
 * Get the current node for the user's active session
 */
router.get("/node", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await onboardingEngine.startSession(user.id, user.accountId || 1);
    const result = await onboardingEngine.getCurrentNode(session.id);

    if (!result) {
      return res.status(404).json({ error: "No current node found" });
    }

    res.json({
      node: result.node,
      progress: result.progress,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("[Onboarding] Error getting current node:", error);
    res.status(500).json({ error: "Failed to get current node" });
  }
});

/**
 * POST /api/onboarding/answer
 * Submit an answer and advance to the next node
 */
router.post("/answer", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const body = submitAnswerSchema.parse(req.body);
    const session = await onboardingEngine.startSession(user.id, user.accountId || 1);

    const result = await onboardingEngine.submitAnswer(
      session.id,
      body.nodeId,
      body.answer
    );

    res.json({
      nextNode: result.nextNode,
      session: result.session,
      isComplete: result.nextNode?.type === "terminal",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: error.errors });
    }
    console.error("[Onboarding] Error submitting answer:", error);
    const message = error instanceof Error ? error.message : "Failed to submit answer";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/onboarding/summary
 * Get a summary of all answers for review
 */
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await onboardingEngine.startSession(user.id, user.accountId || 1);
    const summary = await onboardingEngine.getSessionSummary(session.id);

    res.json({
      sessionId: session.id,
      answers: summary.answers,
      progress: summary.progress,
    });
  } catch (error) {
    console.error("[Onboarding] Error getting summary:", error);
    res.status(500).json({ error: "Failed to get summary" });
  }
});

/**
 * PATCH /api/onboarding/answer
 * Update an existing answer during review
 */
router.patch("/answer", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const body = updateAnswerSchema.parse(req.body);
    const session = await onboardingEngine.startSession(user.id, user.accountId || 1);

    await onboardingEngine.updateAnswer(session.id, body.nodeId, body.answer);

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", details: error.errors });
    }
    console.error("[Onboarding] Error updating answer:", error);
    const message = error instanceof Error ? error.message : "Failed to update answer";
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/onboarding/complete
 * Complete the onboarding session and derive configuration
 */
router.post("/complete", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await onboardingEngine.startSession(user.id, user.accountId || 1);
    const config = await onboardingEngine.completeSession(session.id);

    res.json({
      success: true,
      derivedConfig: config,
    });
  } catch (error) {
    console.error("[Onboarding] Error completing session:", error);
    const message = error instanceof Error ? error.message : "Failed to complete onboarding";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/onboarding/progress
 * Get onboarding progress for the current user
 */
router.get("/progress", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = await onboardingEngine.startSession(user.id, user.accountId || 1);
    const result = await onboardingEngine.getCurrentNode(session.id);

    res.json({
      sessionId: session.id,
      status: session.status,
      progress: result?.progress || 0,
      currentNodeId: session.currentNodeId,
    });
  } catch (error) {
    console.error("[Onboarding] Error getting progress:", error);
    res.status(500).json({ error: "Failed to get progress" });
  }
});

export default router;
