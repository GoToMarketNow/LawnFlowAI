import type { Database } from "@db";
import { eq } from "drizzle-orm";
import { paymentTransactions } from "@shared/schema-payment";
import { runJobCompletedPaymentSaga } from "./paymentSaga";

// ============================================
// Payment Retry Policy & Backoff Logic
// ============================================

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number; // Initial retry delay
  maxDelayMs: number; // Maximum retry delay
  backoffMultiplier: number; // Exponential backoff multiplier
  retryableErrorCodes: string[]; // Which error codes should trigger retry
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 5000, // 5 seconds
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
  retryableErrorCodes: [
    "card_declined",
    "insufficient_funds",
    "payment_method_unavailable",
    "network_error",
    "temporary_failure",
  ],
};

// ============================================
// Retry Logic
// ============================================

export interface RetryPaymentInput {
  db: Database;
  transactionId: number;
  retryConfig?: RetryConfig;
}

export interface RetryResult {
  success: boolean;
  retryScheduled: boolean;
  finalFailure: boolean;
  nextRetryAt?: Date;
  error?: string;
}

/**
 * Determines if a payment should be retried and schedules retry
 */
export async function schedulePaymentRetry(input: RetryPaymentInput): Promise<RetryResult> {
  const { db, transactionId, retryConfig = DEFAULT_RETRY_CONFIG } = input;

  try {
    // Load transaction
    const transaction = await db.query.paymentTransactions.findFirst({
      where: (txns, { eq }) => eq(txns.id, transactionId),
    });

    if (!transaction) {
      return {
        success: false,
        retryScheduled: false,
        finalFailure: false,
        error: "Transaction not found",
      };
    }

    const currentRetryCount = transaction.retryCount ?? 0;

    // Check if max retries exceeded
    if (currentRetryCount >= retryConfig.maxAttempts) {
      console.log(`[Retry Policy] Max retries exceeded for transaction ${transactionId}`);

      return {
        success: true,
        retryScheduled: false,
        finalFailure: true,
      };
    }

    // Check if error code is retryable
    const isRetryable = shouldRetry(transaction.failureCode, retryConfig);

    if (!isRetryable) {
      console.log(
        `[Retry Policy] Error code '${transaction.failureCode}' is not retryable for transaction ${transactionId}`
      );

      return {
        success: true,
        retryScheduled: false,
        finalFailure: true,
      };
    }

    // Calculate next retry delay (exponential backoff)
    const delay = calculateBackoff(currentRetryCount, retryConfig);
    const nextRetryAt = new Date(Date.now() + delay);

    console.log(
      `[Retry Policy] Scheduling retry ${currentRetryCount + 1}/${retryConfig.maxAttempts} for transaction ${transactionId} at ${nextRetryAt.toISOString()}`
    );

    // TODO: Integrate with job queue (BullMQ, etc.) to schedule retry
    // await paymentRetryQueue.add(
    //   'retry-payment',
    //   { transactionId, retryAttempt: currentRetryCount + 1 },
    //   { delay }
    // );

    return {
      success: true,
      retryScheduled: true,
      finalFailure: false,
      nextRetryAt,
    };
  } catch (error) {
    console.error(`[Retry Policy] Error scheduling retry:`, error);

    return {
      success: false,
      retryScheduled: false,
      finalFailure: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Executes a payment retry
 * Called by job queue worker
 */
export async function executePaymentRetry(input: {
  db: Database;
  transactionId: number;
  retryAttempt: number;
}): Promise<{ success: boolean; error?: string }> {
  const { db, transactionId, retryAttempt } = input;

  console.log(`[Retry Policy] Executing retry attempt ${retryAttempt} for transaction ${transactionId}`);

  try {
    // Load transaction
    const transaction = await db.query.paymentTransactions.findFirst({
      where: (txns, { eq }) => eq(txns.id, transactionId),
    });

    if (!transaction) {
      return { success: false, error: "Transaction not found" };
    }

    // Increment retry count
    await db
      .update(paymentTransactions)
      .set({
        retryCount: retryAttempt,
        status: "pending", // Reset to pending for retry
        updatedAt: new Date(),
      })
      .where(eq(paymentTransactions.id, transactionId));

    // Re-run payment saga with same context
    const sagaResult = await runJobCompletedPaymentSaga({
      db,
      jobId: transaction.jobId!,
      customerId: transaction.customerId,
      businessId: transaction.businessId,
      amount: transaction.amount,
      isFirstService: transaction.captureType === "first_service",
      traceId: `${transaction.traceId}_retry_${retryAttempt}`,
    });

    if (sagaResult.success && sagaResult.paymentCaptured) {
      console.log(`[Retry Policy] Retry succeeded for transaction ${transactionId}`);
      return { success: true };
    } else {
      console.log(`[Retry Policy] Retry failed for transaction ${transactionId}`);

      // Schedule next retry if applicable
      await schedulePaymentRetry({ db, transactionId });

      return {
        success: false,
        error: sagaResult.error || "Payment retry failed",
      };
    }
  } catch (error) {
    console.error(`[Retry Policy] Error executing retry:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown retry error",
    };
  }
}

// ============================================
// Backoff Calculation
// ============================================

function calculateBackoff(retryCount: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, retryCount);
  return Math.min(delay, config.maxDelayMs);
}

// ============================================
// Retryability Logic
// ============================================

function shouldRetry(failureCode: string | null, config: RetryConfig): boolean {
  if (!failureCode) return false;

  // Check against retryable error codes
  return config.retryableErrorCodes.includes(failureCode);
}

// ============================================
// Final Failure Handling
// ============================================

export interface HandleFinalFailureInput {
  db: Database;
  transactionId: number;
  escalateToRole?: "FINANCE" | "OPS";
}

export async function handleFinalPaymentFailure(
  input: HandleFinalFailureInput
): Promise<{ success: boolean; error?: string }> {
  const { db, transactionId, escalateToRole = "FINANCE" } = input;

  try {
    console.log(`[Retry Policy] Handling final failure for transaction ${transactionId}`);

    // Load transaction
    const transaction = await db.query.paymentTransactions.findFirst({
      where: (txns, { eq }) => eq(txns.id, transactionId),
    });

    if (!transaction) {
      return { success: false, error: "Transaction not found" };
    }

    // Load policy to check fallback options
    const policy = await db.query.operatorPaymentPolicies.findFirst({
      where: (policies, { eq }) => eq(policies.businessId, transaction.businessId),
    });

    // Option 1: Create invoice as fallback (if policy allows)
    if (policy?.allowInvoiceInsteadOfPay && transaction.jobId) {
      console.log(`[Retry Policy] Creating invoice as fallback for job ${transaction.jobId}`);

      // TODO: Trigger invoice creation
      // const invoiceResult = await createInvoiceCommand({...});

      return { success: true };
    }

    // Option 2: Create human task for manual intervention
    console.log(`[Retry Policy] Creating human task for manual payment resolution`);

    // TODO: Create human task
    // const taskResult = await createHumanTask({
    //   role: escalateToRole,
    //   reason: `Payment failed after ${transaction.retryCount} retries`,
    //   context: { transactionId, jobId: transaction.jobId },
    // });

    return { success: true };
  } catch (error) {
    console.error(`[Retry Policy] Error handling final failure:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Retry Queue Integration (BullMQ Stub)
// ============================================

/**
 * Initialize payment retry queue
 * Called on application startup
 */
export async function initializePaymentRetryQueue(): Promise<void> {
  console.log(`[Retry Policy] Initializing payment retry queue`);

  // TODO: Setup BullMQ queue
  // const paymentRetryQueue = new Queue('payment-retry', {
  //   connection: { host: 'localhost', port: 6379 },
  // });

  // TODO: Setup worker to process retries
  // const worker = new Worker('payment-retry', async (job) => {
  //   const { transactionId, retryAttempt } = job.data;
  //   await executePaymentRetry({ db, transactionId, retryAttempt });
  // });

  console.log(`[Retry Policy] Payment retry queue initialized`);
}
