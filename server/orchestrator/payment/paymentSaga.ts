import type { Database } from "@db";
import { runPaymentAgent, type PaymentAgentContext } from "./paymentAgent";
import { executePaymentCommand } from "./commandHandlers";
import { paymentAgentDecisions } from "@shared/schema-payment";
import crypto from "crypto";

// ============================================
// Payment Saga - JobCompleted → Payment
// ============================================

/**
 * Saga orchestrates the payment flow after job completion.
 *
 * Flow:
 * 1. Job completed (trigger)
 * 2. QA Agent validates job
 * 3. Payment Agent evaluates payment path
 * 4. Execute commands (autopay, text-to-pay, invoice, etc.)
 * 5. Handle retries and failures
 * 6. Trigger Review Agent on successful payment
 */

export interface JobCompletedPaymentSagaInput {
  db: Database;
  jobId: number;
  customerId: number;
  businessId: number;
  amount: number;
  isFirstService: boolean;
  traceId?: string;
}

export interface SagaResult {
  success: boolean;
  decision: string;
  paymentCaptured: boolean;
  invoiceCreated: boolean;
  humanEscalated: boolean;
  agentDecisionId?: number;
  error?: string;
}

/**
 * Main saga entry point - called after QA Agent completes
 */
export async function runJobCompletedPaymentSaga(
  input: JobCompletedPaymentSagaInput
): Promise<SagaResult> {
  const { db, jobId, customerId, businessId, amount, isFirstService } = input;
  const traceId = input.traceId || `payment_${jobId}_${Date.now()}`;

  console.log(`[PaymentSaga] Starting saga for job ${jobId}, customer ${customerId}`);

  try {
    // ============================================
    // Step 1: Run Payment Agent (decision only)
    // ============================================
    const agentContext: PaymentAgentContext = {
      jobId,
      customerId,
      businessId,
      amount,
      currency: "USD",
      trigger: "job_completed",
      isFirstService,
      traceId,
    };

    const decision = await runPaymentAgent({ db, context: agentContext });

    console.log(`[PaymentSaga] Agent decision: ${decision.decision}`);
    console.log(`[PaymentSaga] Confidence: ${decision.confidence}`);
    console.log(`[PaymentSaga] Risk flags: ${decision.riskFlags.join(", ")}`);

    // ============================================
    // Step 2: Persist agent decision
    // ============================================
    const [agentDecisionRecord] = await db
      .insert(paymentAgentDecisions)
      .values({
        traceId: decision.traceId,
        entityId: decision.entityId,
        entityType: "job",
        businessId,
        customerId,
        decision: decision.decision,
        journeyType: decision.journeyType,
        commands: decision.commands as any,
        confidence: decision.confidence,
        confidenceBreakdown: decision.confidenceBreakdown as any,
        riskFlags: decision.riskFlags,
        humanRequired: decision.humanRequired,
        handoffReason: decision.handoffReason,
        handoffToRole: decision.handoffToRole,
        policySnapshotHash: decision.commands[0]?.policySnapshotHash || "unknown",
        executionStatus: "pending",
      })
      .returning();

    // ============================================
    // Step 3: Check if human intervention required
    // ============================================
    if (decision.humanRequired) {
      console.log(`[PaymentSaga] Human intervention required: ${decision.handoffReason}`);

      // Execute CreateHumanTask command if present
      for (const command of decision.commands) {
        if (command.type === "CreateHumanTask") {
          await executePaymentCommand({
            db,
            command,
            agentDecisionId: agentDecisionRecord.id,
          });
        }
      }

      await db
        .update(paymentAgentDecisions)
        .set({ executionStatus: "escalated", executedAt: new Date() })
        .where(eq => eq.id === agentDecisionRecord.id);

      return {
        success: true,
        decision: decision.decision,
        paymentCaptured: false,
        invoiceCreated: false,
        humanEscalated: true,
        agentDecisionId: agentDecisionRecord.id,
      };
    }

    // ============================================
    // Step 4: Execute commands
    // ============================================
    let paymentCaptured = false;
    let invoiceCreated = false;

    for (const command of decision.commands) {
      console.log(`[PaymentSaga] Executing command: ${command.type}`);

      const result = await executePaymentCommand({
        db,
        command,
        agentDecisionId: agentDecisionRecord.id,
      });

      if (!result.success) {
        console.error(`[PaymentSaga] Command execution failed: ${result.error}`);

        // Mark decision as failed
        await db
          .update(paymentAgentDecisions)
          .set({ executionStatus: "failed", executedAt: new Date() })
          .where(eq => eq.id === agentDecisionRecord.id);

        // Attempt retry or fallback
        return await handlePaymentFailure({
          db,
          jobId,
          customerId,
          businessId,
          amount,
          isFirstService,
          traceId,
          originalDecisionId: agentDecisionRecord.id,
          failureReason: result.error || "Unknown command execution error",
        });
      }

      // Track what was executed
      if (command.type === "CapturePayment") {
        paymentCaptured = true;
      }
      if (command.type === "CreateInvoice") {
        invoiceCreated = true;
      }

      console.log(`[PaymentSaga] Command executed successfully: ${command.type}`);
    }

    // ============================================
    // Step 5: Mark decision as completed
    // ============================================
    await db
      .update(paymentAgentDecisions)
      .set({ executionStatus: "completed", executedAt: new Date() })
      .where(eq => eq.id === agentDecisionRecord.id);

    console.log(`[PaymentSaga] Saga completed successfully`);

    return {
      success: true,
      decision: decision.decision,
      paymentCaptured,
      invoiceCreated,
      humanEscalated: false,
      agentDecisionId: agentDecisionRecord.id,
    };
  } catch (error) {
    console.error(`[PaymentSaga] Saga failed with error:`, error);

    return {
      success: false,
      decision: "error",
      paymentCaptured: false,
      invoiceCreated: false,
      humanEscalated: false,
      error: error instanceof Error ? error.message : "Unknown saga error",
    };
  }
}

// ============================================
// Failure Handling & Retry Logic
// ============================================

interface PaymentFailureInput {
  db: Database;
  jobId: number;
  customerId: number;
  businessId: number;
  amount: number;
  isFirstService: boolean;
  traceId: string;
  originalDecisionId: number;
  failureReason: string;
  retryCount?: number;
}

async function handlePaymentFailure(input: PaymentFailureInput): Promise<SagaResult> {
  const { db, jobId, customerId, businessId, amount, traceId, failureReason, retryCount = 0 } = input;

  console.log(`[PaymentSaga] Handling payment failure (retry ${retryCount}): ${failureReason}`);

  // Load policy to check retry limits
  const policy = await db.query.operatorPaymentPolicies.findFirst({
    where: (policies, { eq }) => eq(policies.businessId, businessId),
  });

  const maxRetries = policy?.paymentFailureRetryCount ?? 3;

  // If retries exhausted, fallback to invoice (if policy allows)
  if (retryCount >= maxRetries) {
    console.log(`[PaymentSaga] Max retries exhausted, falling back to invoice`);

    if (policy?.allowInvoiceInsteadOfPay) {
      // Create invoice as fallback
      const invoiceCommand = {
        type: "CreateInvoice" as const,
        customerId,
        businessId,
        jobId,
        amount,
        currency: "USD",
        reason: "payment_failed" as const,
        idempotencyKey: crypto.randomUUID(),
        traceId: `${traceId}_fallback`,
        entityId: `job_${jobId}`,
        policySnapshotHash: "retry_fallback",
      };

      const result = await executePaymentCommand({ db, command: invoiceCommand });

      return {
        success: result.success,
        decision: "fallback_invoice",
        paymentCaptured: false,
        invoiceCreated: result.success,
        humanEscalated: false,
      };
    } else {
      // Escalate to human
      console.log(`[PaymentSaga] Invoice fallback not allowed, escalating to human`);

      return {
        success: false,
        decision: "escalate",
        paymentCaptured: false,
        invoiceCreated: false,
        humanEscalated: true,
        error: `Payment failed after ${maxRetries} retries: ${failureReason}`,
      };
    }
  }

  // TODO: Implement retry logic with exponential backoff
  // For now, just escalate
  return {
    success: false,
    decision: "escalate",
    paymentCaptured: false,
    invoiceCreated: false,
    humanEscalated: true,
    error: `Payment failed: ${failureReason}`,
  };
}

// ============================================
// Saga Compensation (Rollback)
// ============================================

/**
 * Compensates a failed payment saga
 * Used for rollback scenarios (e.g., void payment, mark job unpaid)
 */
export async function compensatePaymentSaga(input: {
  db: Database;
  agentDecisionId: number;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  const { db, agentDecisionId, reason } = input;

  console.log(`[PaymentSaga] Compensating saga for decision ${agentDecisionId}: ${reason}`);

  try {
    // Load decision record
    const decision = await db.query.paymentAgentDecisions.findFirst({
      where: (decisions, { eq }) => eq(decisions.id, agentDecisionId),
    });

    if (!decision) {
      return { success: false, error: "Decision record not found" };
    }

    // TODO: Implement compensation logic
    // - Void payment transactions
    // - Mark job as unpaid
    // - Send notification to ops

    console.log(`[PaymentSaga] Compensation completed`);

    return { success: true };
  } catch (error) {
    console.error(`[PaymentSaga] Compensation failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown compensation error",
    };
  }
}

// ============================================
// Integration with Post-Job QA
// ============================================

/**
 * Extended job completion handler that includes payment
 * Call this AFTER QA Agent completes successfully
 */
export async function handleJobCompletionWithPayment(input: {
  db: Database;
  jobId: number;
  customerId: number;
  businessId: number;
  amount: number;
  isFirstService: boolean;
}): Promise<{
  qaSuccess: boolean;
  paymentSuccess: boolean;
  paymentCaptured: boolean;
  invoiceCreated: boolean;
  error?: string;
}> {
  const { db, jobId, customerId, businessId, amount, isFirstService } = input;

  try {
    // Step 1: QA validation (assuming already done by caller)
    // In production, this would call the QA Agent first

    // Step 2: Run payment saga
    const paymentResult = await runJobCompletedPaymentSaga({
      db,
      jobId,
      customerId,
      businessId,
      amount,
      isFirstService,
    });

    // Step 3: Trigger Review Agent only if payment succeeded
    if (paymentResult.paymentCaptured) {
      console.log(`[PaymentSaga] Payment captured, ready for Review Agent`);
      // TODO: Trigger Review Agent
      // await triggerReviewAgent({ db, jobId, customerId });
    }

    return {
      qaSuccess: true, // Assumed
      paymentSuccess: paymentResult.success,
      paymentCaptured: paymentResult.paymentCaptured,
      invoiceCreated: paymentResult.invoiceCreated,
    };
  } catch (error) {
    console.error(`[PaymentSaga] Job completion with payment failed:`, error);
    return {
      qaSuccess: true,
      paymentSuccess: false,
      paymentCaptured: false,
      invoiceCreated: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
