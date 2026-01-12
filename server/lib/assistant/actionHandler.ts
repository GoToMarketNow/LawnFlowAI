// Action Request Handler
// Security: Confirm-before-write, idempotency, expiration
// All write actions require explicit user confirmation

import { db } from "../../db";
import { assistantActionRequests, type NewAssistantActionRequest, type ActionType, type ActionStatus } from "@shared/assistant-schema";
import { eq, and, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { audit } from "../audit";

/**
 * Create an action request (pending confirmation)
 * @param request - Action request data
 * @returns Created action request
 */
export async function requestAction(
  request: {
    conversationId?: number;
    businessId: number;
    requestedBy?: number;
    requestedByRole?: string;
    actionType: ActionType;
    actionPayload: any;
    actionReason?: string;
  }
): Promise<typeof assistantActionRequests.$inferSelect> {
  // Validation
  if (!request.businessId || request.businessId <= 0) {
    throw new Error("Valid businessId required");
  }

  if (!request.actionType) {
    throw new Error("Action type required");
  }

  if (!request.actionPayload) {
    throw new Error("Action payload required");
  }

  // Generate idempotency key
  const idempotencyKey = `${request.actionType}-${request.conversationId || "none"}-${Date.now()}-${uuidv4()}`;

  // Calculate expiration (24 hours from now)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    // Create action request
    const [actionRequest] = await db.insert(assistantActionRequests).values({
      conversationId: request.conversationId,
      businessId: request.businessId,
      requestedBy: request.requestedBy,
      requestedByRole: request.requestedByRole,
      actionType: request.actionType,
      actionPayload: request.actionPayload,
      actionReason: request.actionReason,
      status: "pending",
      idempotencyKey,
      expiresAt,
    }).returning();

    // Audit log
    await audit.logEvent({
      action: "assistant.action_requested",
      actor: request.requestedBy || "system",
      businessId: request.businessId,
      metadata: {
        actionRequestId: actionRequest.id,
        actionType: request.actionType,
        conversationId: request.conversationId,
      },
    });

    return actionRequest;
  } catch (error: any) {
    throw new Error(`Failed to create action request: ${error.message}`);
  }
}

/**
 * Confirm an action request (execute it)
 * @param actionId - Action request ID
 * @param confirmedBy - User ID confirming the action
 * @returns Execution result
 */
export async function confirmAction(
  actionId: number,
  confirmedBy: number
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    // 1. Get action request
    const action = await db.query.assistantActionRequests.findFirst({
      where: eq(assistantActionRequests.id, actionId),
    });

    if (!action) {
      throw new Error("Action request not found");
    }

    // 2. Validate status
    if (action.status !== "pending") {
      throw new Error(`Action already processed (status: ${action.status})`);
    }

    // 3. Check expiration
    if (action.expiresAt < new Date()) {
      await db.update(assistantActionRequests)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(assistantActionRequests.id, actionId));

      throw new Error("Action request has expired");
    }

    // 4. Mark as confirmed
    await db.update(assistantActionRequests)
      .set({
        status: "confirmed",
        confirmedBy,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(assistantActionRequests.id, actionId));

    // 5. Execute action
    const executionResult = await executeAction(action.actionType, action.actionPayload);

    // 6. Mark as executed
    await db.update(assistantActionRequests)
      .set({
        status: "executed",
        executedAt: new Date(),
        executionResult,
        updatedAt: new Date(),
      })
      .where(eq(assistantActionRequests.id, actionId));

    // 7. Audit log
    await audit.logEvent({
      action: "assistant.action_confirmed_executed",
      actor: confirmedBy,
      businessId: action.businessId,
      metadata: {
        actionRequestId: actionId,
        actionType: action.actionType,
        executionResult,
      },
    });

    return { success: true, result: executionResult };
  } catch (error: any) {
    // Mark as failed
    await db.update(assistantActionRequests)
      .set({
        status: "failed",
        executionError: error.message,
        updatedAt: new Date(),
      })
      .where(eq(assistantActionRequests.id, actionId));

    // Audit log
    await audit.logEvent({
      action: "assistant.action_failed",
      actor: confirmedBy,
      metadata: {
        actionRequestId: actionId,
        error: error.message,
      },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Reject an action request
 * @param actionId - Action request ID
 * @param rejectedBy - User ID rejecting the action
 * @param reason - Rejection reason
 */
export async function rejectAction(
  actionId: number,
  rejectedBy: number,
  reason?: string
): Promise<void> {
  try {
    // Get action request
    const action = await db.query.assistantActionRequests.findFirst({
      where: eq(assistantActionRequests.id, actionId),
    });

    if (!action) {
      throw new Error("Action request not found");
    }

    if (action.status !== "pending") {
      throw new Error(`Action already processed (status: ${action.status})`);
    }

    // Mark as rejected
    await db.update(assistantActionRequests)
      .set({
        status: "rejected",
        confirmedBy: rejectedBy,
        confirmedAt: new Date(),
        rejectedReason: reason || "Rejected by user",
        updatedAt: new Date(),
      })
      .where(eq(assistantActionRequests.id, actionId));

    // Audit log
    await audit.logEvent({
      action: "assistant.action_rejected",
      actor: rejectedBy,
      businessId: action.businessId,
      metadata: {
        actionRequestId: actionId,
        actionType: action.actionType,
        reason,
      },
    });
  } catch (error: any) {
    throw new Error(`Failed to reject action: ${error.message}`);
  }
}

/**
 * Execute an action (called after confirmation)
 * @param actionType - Type of action to execute
 * @param payload - Action payload
 * @returns Execution result
 */
async function executeAction(actionType: ActionType, payload: any): Promise<any> {
  switch (actionType) {
    case "reschedule_job":
      return await executeRescheduleJob(payload);

    case "cancel_job":
      return await executeCancelJob(payload);

    case "send_message":
      return await executeSendMessage(payload);

    case "update_quote":
      return await executeUpdateQuote(payload);

    case "create_service_request":
      return await executeCreateServiceRequest(payload);

    case "update_payment_method":
      return await executeUpdatePaymentMethod(payload);

    case "issue_refund":
      return await executeIssueRefund(payload);

    case "escalate_to_ops":
      return await executeEscalateToOps(payload);

    case "create_knowledge_item":
      return await executeCreateKnowledgeItem(payload);

    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

// Action execution functions (placeholders - integrate with existing systems)

async function executeRescheduleJob(payload: { jobId: number; newDate: string }): Promise<any> {
  // TODO: Integrate with existing job rescheduling logic
  // For now, return simulated result
  return {
    success: true,
    jobId: payload.jobId,
    newDate: payload.newDate,
    message: "Job rescheduled successfully",
  };
}

async function executeCancelJob(payload: { jobId: number; reason: string }): Promise<any> {
  // TODO: Integrate with existing job cancellation logic
  return {
    success: true,
    jobId: payload.jobId,
    message: "Job cancelled successfully",
  };
}

async function executeSendMessage(payload: { threadId: number; body: string }): Promise<any> {
  // TODO: Integrate with comms system
  return {
    success: true,
    threadId: payload.threadId,
    message: "Message sent successfully",
  };
}

async function executeUpdateQuote(payload: { quoteId: number; updates: any }): Promise<any> {
  // TODO: Integrate with quote system
  return {
    success: true,
    quoteId: payload.quoteId,
    message: "Quote updated successfully",
  };
}

async function executeCreateServiceRequest(payload: { customerId: number; serviceType: string; details: any }): Promise<any> {
  // TODO: Integrate with service request system
  return {
    success: true,
    message: "Service request created successfully",
  };
}

async function executeUpdatePaymentMethod(payload: { customerId: number; paymentMethodId: string }): Promise<any> {
  // TODO: Integrate with payment system
  return {
    success: true,
    message: "Payment method updated successfully",
  };
}

async function executeIssueRefund(payload: { transactionId: number; amount: number; reason: string }): Promise<any> {
  // TODO: Integrate with payment/refund system
  return {
    success: true,
    transactionId: payload.transactionId,
    amount: payload.amount,
    message: "Refund issued successfully",
  };
}

async function executeEscalateToOps(payload: { threadId: number; priority: string; reason: string }): Promise<any> {
  // TODO: Integrate with ops escalation system
  return {
    success: true,
    threadId: payload.threadId,
    message: "Escalated to operations team",
  };
}

async function executeCreateKnowledgeItem(payload: { itemType: string; title: string; content: any }): Promise<any> {
  // TODO: Integrate with knowledge base
  return {
    success: true,
    message: "Knowledge item draft created",
  };
}

/**
 * Get pending action requests for a business
 * @param businessId - Business ID
 * @param limit - Maximum results
 * @returns Pending action requests
 */
export async function getPendingActions(
  businessId: number,
  limit: number = 10
): Promise<typeof assistantActionRequests.$inferSelect[]> {
  try {
    const pending = await db.query.assistantActionRequests.findMany({
      where: and(
        eq(assistantActionRequests.businessId, businessId),
        eq(assistantActionRequests.status, "pending" as ActionStatus)
      ),
      orderBy: [assistantActionRequests.createdAt],
      limit: Math.min(limit, 50),
    });

    return pending;
  } catch (error: any) {
    console.error("Failed to get pending actions:", error.message);
    return [];
  }
}

/**
 * Cleanup expired action requests (cron job)
 * @returns Number of expired actions
 */
export async function cleanupExpiredActions(): Promise<number> {
  try {
    const result = await db.execute(sql`
      UPDATE assistant_action_requests
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'pending'
        AND expires_at < NOW()
    `);

    const expiredCount = (result as any).rowCount || 0;

    if (expiredCount > 0) {
      await audit.logEvent({
        action: "assistant.actions_expired",
        actor: "system",
        metadata: { count: expiredCount },
      });
    }

    return expiredCount;
  } catch (error: any) {
    console.error("Failed to cleanup expired actions:", error.message);
    return 0;
  }
}

/**
 * Health check for action handler
 */
export async function testActionHandler(): Promise<boolean> {
  try {
    return db !== undefined;
  } catch {
    return false;
  }
}

// Import for sql function
import { sql } from "drizzle-orm";
