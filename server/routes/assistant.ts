// AI Assistant API Routes
// Gated AI chat, action requests, confirmations
// Security: Citation enforcement, confirm-before-write, audit logging

import { Router, type Request, type Response } from "express";
import { db } from "../db";
import {
  assistantConversations,
  assistantMessages,
  assistantActionRequests,
  type NewAssistantConversation,
  type NewAssistantMessage,
} from "@shared/assistant-schema";
import { eq, and, desc } from "drizzle-orm";
import { generateResponse } from "../lib/assistant/agent";
import { confirmAction, rejectAction, getPendingActions } from "../lib/assistant/actionHandler";
import { getToolExecutionHistory } from "../lib/assistant/toolRouter";
import { audit } from "../lib/audit";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// ============================================
// Middleware: Authentication & Authorization
// ============================================

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    businessId: number;
    role: string;
    email: string;
  };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: Function) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: Function) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// ============================================
// START CONVERSATION
// ============================================

router.post("/conversations", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId, context } = req.body;

    // Create conversation
    const [conversation] = await db.insert(assistantConversations).values({
      businessId: req.user!.businessId,
      threadId,
      userId: req.user!.id,
      userRole: req.user!.role,
      sessionId: uuidv4(),
      context: context || {},
      isActive: true,
    }).returning();

    res.status(201).json({ conversation });
  } catch (error: any) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: error.message || "Failed to create conversation" });
  }
});

// ============================================
// SEND MESSAGE (Get Assistant Response)
// ============================================

router.post("/conversations/:conversationId/messages", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { content, context } = req.body;

    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "Message content required" });
    }

    // Get conversation
    const conversation = await db.query.assistantConversations.findFirst({
      where: and(
        eq(assistantConversations.id, parseInt(conversationId)),
        eq(assistantConversations.businessId, req.user!.businessId)
      ),
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get conversation history
    const history = await db.query.assistantMessages.findMany({
      where: eq(assistantMessages.conversationId, parseInt(conversationId)),
      orderBy: [assistantMessages.createdAt],
      limit: 20, // Last 20 messages for context
    });

    // Build messages array
    const messages = [
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user" as const,
        content,
      },
    ];

    // Generate assistant response
    const startTime = Date.now();
    const response = await generateResponse({
      businessId: req.user!.businessId,
      conversationId: parseInt(conversationId),
      messages,
      userRole: req.user!.role,
      userId: req.user!.id,
      context: { ...conversation.context, ...context },
    });
    const latencyMs = Date.now() - startTime;

    // Save user message
    const [userMessage] = await db.insert(assistantMessages).values({
      conversationId: parseInt(conversationId),
      role: "user",
      content,
    }).returning();

    // Save assistant message
    const [assistantMessage] = await db.insert(assistantMessages).values({
      conversationId: parseInt(conversationId),
      role: "assistant",
      content: response.content,
      citations: response.citations || [],
      toolsUsed: response.toolsUsed || [],
      latencyMs,
      modelUsed: "gpt-4o",
    }).returning();

    // Audit log
    await audit.logEvent({
      action: "assistant.message_sent",
      actor: req.user!.id,
      businessId: req.user!.businessId,
      metadata: {
        conversationId: parseInt(conversationId),
        hasCitations: response.citations && response.citations.length > 0,
        requiresApproval: response.requiresApproval,
      },
    });

    res.json({
      userMessage,
      assistantMessage,
      response,
    });
  } catch (error: any) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message || "Failed to send message" });
  }
});

// ============================================
// GET CONVERSATION HISTORY
// ============================================

router.get("/conversations/:conversationId/messages", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { limit = "50", offset = "0" } = req.query;

    // Security check
    const conversation = await db.query.assistantConversations.findFirst({
      where: and(
        eq(assistantConversations.id, parseInt(conversationId)),
        eq(assistantConversations.businessId, req.user!.businessId)
      ),
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await db.query.assistantMessages.findMany({
      where: eq(assistantMessages.conversationId, parseInt(conversationId)),
      orderBy: [assistantMessages.createdAt],
      limit: Math.min(parseInt(limit as string), 100),
      offset: parseInt(offset as string),
    });

    res.json({ messages, count: messages.length });
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: error.message || "Failed to fetch messages" });
  }
});

// ============================================
// END CONVERSATION
// ============================================

router.post("/conversations/:conversationId/end", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { reason } = req.body;

    await db.update(assistantConversations)
      .set({
        isActive: false,
        endedAt: new Date(),
        endReason: reason || "User ended conversation",
      })
      .where(and(
        eq(assistantConversations.id, parseInt(conversationId)),
        eq(assistantConversations.businessId, req.user!.businessId)
      ));

    res.json({ success: true, message: "Conversation ended" });
  } catch (error: any) {
    console.error("Error ending conversation:", error);
    res.status(500).json({ error: error.message || "Failed to end conversation" });
  }
});

// ============================================
// GET PENDING ACTION REQUESTS
// ============================================

router.get("/actions/pending", requireAuth, requireRole(["owner", "admin", "staff"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = "10" } = req.query;

    const pending = await getPendingActions(
      req.user!.businessId,
      parseInt(limit as string)
    );

    res.json({ pending, count: pending.length });
  } catch (error: any) {
    console.error("Error fetching pending actions:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pending actions" });
  }
});

// ============================================
// CONFIRM ACTION
// ============================================

router.post("/actions/:actionId/confirm", requireAuth, requireRole(["owner", "admin", "staff"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { actionId } = req.params;

    const result = await confirmAction(parseInt(actionId), req.user!.id);

    if (result.success) {
      res.json({ success: true, result: result.result, message: "Action confirmed and executed" });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    console.error("Error confirming action:", error);
    res.status(500).json({ error: error.message || "Failed to confirm action" });
  }
});

// ============================================
// REJECT ACTION
// ============================================

router.post("/actions/:actionId/reject", requireAuth, requireRole(["owner", "admin", "staff"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { actionId } = req.params;
    const { reason } = req.body;

    await rejectAction(parseInt(actionId), req.user!.id, reason);

    res.json({ success: true, message: "Action rejected" });
  } catch (error: any) {
    console.error("Error rejecting action:", error);
    res.status(500).json({ error: error.message || "Failed to reject action" });
  }
});

// ============================================
// GET ACTION REQUEST DETAILS
// ============================================

router.get("/actions/:actionId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { actionId } = req.params;

    const action = await db.query.assistantActionRequests.findFirst({
      where: and(
        eq(assistantActionRequests.id, parseInt(actionId)),
        eq(assistantActionRequests.businessId, req.user!.businessId)
      ),
    });

    if (!action) {
      return res.status(404).json({ error: "Action request not found" });
    }

    res.json({ action });
  } catch (error: any) {
    console.error("Error fetching action:", error);
    res.status(500).json({ error: error.message || "Failed to fetch action" });
  }
});

// ============================================
// GET TOOL EXECUTION HISTORY
// ============================================

router.get("/conversations/:conversationId/tools", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { limit = "10" } = req.query;

    // Security check
    const conversation = await db.query.assistantConversations.findFirst({
      where: and(
        eq(assistantConversations.id, parseInt(conversationId)),
        eq(assistantConversations.businessId, req.user!.businessId)
      ),
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const tools = await getToolExecutionHistory(
      parseInt(conversationId),
      parseInt(limit as string)
    );

    res.json({ tools, count: tools.length });
  } catch (error: any) {
    console.error("Error fetching tool history:", error);
    res.status(500).json({ error: error.message || "Failed to fetch tool history" });
  }
});

// ============================================
// SUBMIT MESSAGE FEEDBACK
// ============================================

router.post("/messages/:messageId/feedback", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const { rating, text } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Update message with feedback
    await db.update(assistantMessages)
      .set({
        feedbackRating: rating,
        feedbackText: text,
      })
      .where(eq(assistantMessages.id, parseInt(messageId)));

    // Audit log
    await audit.logEvent({
      action: "assistant.feedback_submitted",
      actor: req.user!.id,
      businessId: req.user!.businessId,
      metadata: { messageId: parseInt(messageId), rating },
    });

    res.json({ success: true, message: "Feedback submitted" });
  } catch (error: any) {
    console.error("Error submitting feedback:", error);
    res.status(500).json({ error: error.message || "Failed to submit feedback" });
  }
});

export default router;
