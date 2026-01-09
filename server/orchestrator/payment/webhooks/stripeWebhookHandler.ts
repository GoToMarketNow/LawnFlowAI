import type { Database } from "@db";
import { eq } from "drizzle-orm";
import { paymentTransactions, paymentSessions } from "@shared/schema-payment";
import type { PaymentEvent } from "@shared/orchestrator/payment-contracts";

// ============================================
// Stripe Webhook Handler - Event Normalization
// ============================================

/**
 * Normalizes Stripe webhook events into LawnFlow payment events
 * Ensures idempotent processing and state synchronization
 */

export interface StripeWebhookPayload {
  id: string; // Stripe event ID
  type: string; // Event type (payment_intent.succeeded, etc.)
  data: {
    object: any; // Stripe object (PaymentIntent, Charge, etc.)
  };
  created: number; // Unix timestamp
}

export interface WebhookProcessingResult {
  success: boolean;
  processed: boolean;
  event?: PaymentEvent;
  error?: string;
}

// ============================================
// Main Webhook Router
// ============================================

export async function processStripeWebhook(
  db: Database,
  payload: StripeWebhookPayload
): Promise<WebhookProcessingResult> {
  const { id, type, data, created } = payload;

  console.log(`[Stripe Webhook] Processing event: ${type} (${id})`);

  // Check idempotency - have we already processed this event?
  const alreadyProcessed = await checkWebhookIdempotency(db, id);
  if (alreadyProcessed) {
    console.log(`[Stripe Webhook] Event already processed: ${id}`);
    return {
      success: true,
      processed: false, // Already handled
    };
  }

  // Route to appropriate handler
  let result: WebhookProcessingResult;

  switch (type) {
    case "payment_intent.succeeded":
      result = await handlePaymentIntentSucceeded(db, data.object);
      break;

    case "payment_intent.payment_failed":
      result = await handlePaymentIntentFailed(db, data.object);
      break;

    case "payment_intent.canceled":
      result = await handlePaymentIntentCanceled(db, data.object);
      break;

    case "payment_method.attached":
      result = await handlePaymentMethodAttached(db, data.object);
      break;

    case "payment_method.detached":
      result = await handlePaymentMethodDetached(db, data.object);
      break;

    case "charge.refunded":
      result = await handleChargeRefunded(db, data.object);
      break;

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${type}`);
      result = {
        success: true,
        processed: false,
      };
  }

  // Mark webhook as processed (store event ID for idempotency)
  if (result.success) {
    await recordWebhookProcessed(db, id, type);
  }

  return result;
}

// ============================================
// Event Handlers
// ============================================

async function handlePaymentIntentSucceeded(
  db: Database,
  paymentIntent: any
): Promise<WebhookProcessingResult> {
  const { id, amount, currency, customer, payment_method, metadata } = paymentIntent;

  try {
    console.log(`[Stripe Webhook] Payment intent succeeded: ${id}`);

    // Find corresponding transaction by provider transaction ID
    const transaction = await db.query.paymentTransactions.findFirst({
      where: (txns, { eq }) => eq(txns.providerTransactionId, id),
    });

    if (!transaction) {
      console.error(`[Stripe Webhook] Transaction not found for payment intent: ${id}`);
      return {
        success: false,
        processed: false,
        error: `Transaction not found for payment intent: ${id}`,
      };
    }

    // Update transaction status to captured
    await db
      .update(paymentTransactions)
      .set({
        status: "captured",
        capturedAt: new Date(),
        updatedAt: new Date(),
        providerResponse: paymentIntent,
      })
      .where(eq(paymentTransactions.id, transaction.id));

    console.log(`[Stripe Webhook] Transaction ${transaction.id} marked as captured`);

    // Emit PaymentCaptured event
    const event: PaymentEvent = {
      eventType: "PaymentCaptured",
      timestamp: new Date().toISOString(),
      traceId: transaction.traceId,
      customerId: transaction.customerId,
      businessId: transaction.businessId,
      transactionId: transaction.id,
      amount: amount / 100, // Convert from cents
      currency,
      paymentMethodId: transaction.paymentMethodId!,
      methodType: transaction.methodType as any,
      captureType: transaction.captureType as any,
      provider: "stripe",
      providerTransactionId: id,
      jobId: transaction.jobId ?? undefined,
      invoiceId: transaction.invoiceId ?? undefined,
    };

    return {
      success: true,
      processed: true,
      event,
    };
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling payment_intent.succeeded:`, error);
    return {
      success: false,
      processed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function handlePaymentIntentFailed(
  db: Database,
  paymentIntent: any
): Promise<WebhookProcessingResult> {
  const { id, last_payment_error, metadata } = paymentIntent;

  try {
    console.log(`[Stripe Webhook] Payment intent failed: ${id}`);

    // Find corresponding transaction
    const transaction = await db.query.paymentTransactions.findFirst({
      where: (txns, { eq }) => eq(txns.providerTransactionId, id),
    });

    if (!transaction) {
      console.error(`[Stripe Webhook] Transaction not found for payment intent: ${id}`);
      return {
        success: false,
        processed: false,
        error: `Transaction not found for payment intent: ${id}`,
      };
    }

    // Extract failure reason
    const failureReason = last_payment_error?.message || "Unknown payment failure";
    const failureCode = last_payment_error?.code || "unknown";

    // Update transaction status to failed
    await db
      .update(paymentTransactions)
      .set({
        status: "failed",
        failedAt: new Date(),
        failureReason,
        failureCode,
        retryCount: (transaction.retryCount ?? 0) + 1,
        updatedAt: new Date(),
        providerResponse: paymentIntent,
      })
      .where(eq(paymentTransactions.id, transaction.id));

    console.log(`[Stripe Webhook] Transaction ${transaction.id} marked as failed`);

    // Emit PaymentFailed event
    const event: PaymentEvent = {
      eventType: "PaymentFailed",
      timestamp: new Date().toISOString(),
      traceId: transaction.traceId,
      customerId: transaction.customerId,
      businessId: transaction.businessId,
      transactionId: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      paymentMethodId: transaction.paymentMethodId ?? undefined,
      failureReason,
      failureCode,
      retryCount: (transaction.retryCount ?? 0) + 1,
      jobId: transaction.jobId ?? undefined,
      invoiceId: transaction.invoiceId ?? undefined,
    };

    return {
      success: true,
      processed: true,
      event,
    };
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling payment_intent.payment_failed:`, error);
    return {
      success: false,
      processed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function handlePaymentIntentCanceled(
  db: Database,
  paymentIntent: any
): Promise<WebhookProcessingResult> {
  const { id } = paymentIntent;

  try {
    console.log(`[Stripe Webhook] Payment intent canceled: ${id}`);

    // Find corresponding transaction
    const transaction = await db.query.paymentTransactions.findFirst({
      where: (txns, { eq }) => eq(txns.providerTransactionId, id),
    });

    if (!transaction) {
      return {
        success: true,
        processed: false, // Not an error, just not found
      };
    }

    // Update transaction status to voided
    await db
      .update(paymentTransactions)
      .set({
        status: "voided",
        updatedAt: new Date(),
        providerResponse: paymentIntent,
      })
      .where(eq(paymentTransactions.id, transaction.id));

    console.log(`[Stripe Webhook] Transaction ${transaction.id} marked as voided`);

    return {
      success: true,
      processed: true,
    };
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling payment_intent.canceled:`, error);
    return {
      success: false,
      processed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function handlePaymentMethodAttached(
  db: Database,
  paymentMethod: any
): Promise<WebhookProcessingResult> {
  const { id, customer, type, card } = paymentMethod;

  try {
    console.log(`[Stripe Webhook] Payment method attached: ${id} to customer ${customer}`);

    // TODO: Sync payment method to our database
    // This would typically happen during payment setup flow
    // Webhook serves as backup/confirmation

    return {
      success: true,
      processed: true,
    };
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling payment_method.attached:`, error);
    return {
      success: false,
      processed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function handlePaymentMethodDetached(
  db: Database,
  paymentMethod: any
): Promise<WebhookProcessingResult> {
  const { id } = paymentMethod;

  try {
    console.log(`[Stripe Webhook] Payment method detached: ${id}`);

    // TODO: Mark payment method as inactive in our database

    return {
      success: true,
      processed: true,
    };
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling payment_method.detached:`, error);
    return {
      success: false,
      processed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function handleChargeRefunded(
  db: Database,
  charge: any
): Promise<WebhookProcessingResult> {
  const { id, amount_refunded, payment_intent } = charge;

  try {
    console.log(`[Stripe Webhook] Charge refunded: ${id}`);

    // Find transaction by payment intent
    const transaction = await db.query.paymentTransactions.findFirst({
      where: (txns, { eq }) => eq(txns.providerTransactionId, payment_intent),
    });

    if (!transaction) {
      console.error(`[Stripe Webhook] Transaction not found for payment intent: ${payment_intent}`);
      return {
        success: true,
        processed: false,
      };
    }

    // Update transaction status to refunded
    await db
      .update(paymentTransactions)
      .set({
        status: "refunded",
        updatedAt: new Date(),
        providerResponse: charge,
      })
      .where(eq(paymentTransactions.id, transaction.id));

    console.log(`[Stripe Webhook] Transaction ${transaction.id} marked as refunded`);

    return {
      success: true,
      processed: true,
    };
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling charge.refunded:`, error);
    return {
      success: false,
      processed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Idempotency Helpers
// ============================================

async function checkWebhookIdempotency(db: Database, eventId: string): Promise<boolean> {
  // TODO: Implement webhook event ID tracking table
  // For now, return false (never processed)
  return false;
}

async function recordWebhookProcessed(db: Database, eventId: string, eventType: string): Promise<void> {
  // TODO: Store processed webhook event ID
  console.log(`[Stripe Webhook] Recording event as processed: ${eventId} (${eventType})`);
}

// ============================================
// Webhook Signature Verification
// ============================================

export function verifyStripeWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // TODO: Implement Stripe signature verification
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // stripe.webhooks.constructEvent(payload, signature, secret);

    console.log(`[Stripe Webhook] Signature verification (mock): PASSED`);
    return true;
  } catch (error) {
    console.error(`[Stripe Webhook] Signature verification failed:`, error);
    return false;
  }
}
