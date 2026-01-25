/**
 * Stripe Webhook Handler for Temporal
 *
 * Receives Stripe webhooks and:
 * - Verifies webhook signatures
 * - Processes payment events
 * - Sends Temporal signals to waiting workflows
 * - Records events for idempotency
 *
 * @module server/temporal/webhooks/stripe
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { getTemporalClient } from '../client';
import { db } from '@db';
import { eq, and } from 'drizzle-orm';
import { workflowRuns, workflowSteps } from '@shared/schema-temporal';

// ============================================================================
// Configuration
// ============================================================================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// ============================================================================
// Types
// ============================================================================

export const PaymentSignalSchema = z.object({
  eventType: z.string(),
  paymentIntentId: z.string(),
  status: z.string(),
  amount: z.number(),
  amountReceived: z.number().optional(),
  currency: z.string(),
  customerId: z.string().nullable(),
  metadata: z.record(z.string()),
  failureCode: z.string().optional(),
  failureMessage: z.string().optional(),
  timestamp: z.string(),
});

export type PaymentSignal = z.infer<typeof PaymentSignalSchema>;

// ============================================================================
// Webhook Event Store (for idempotency)
// ============================================================================

// In-memory store for development; in production use database
const processedEvents = new Set<string>();

async function isEventProcessed(eventId: string): Promise<boolean> {
  // Check in-memory first
  if (processedEvents.has(eventId)) {
    return true;
  }

  // In production, check database
  // const existing = await db.query.webhookEvents.findFirst({
  //   where: eq(webhookEvents.eventId, eventId),
  // });
  // return !!existing;

  return false;
}

async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  processedEvents.add(eventId);

  // In production, store in database
  // await db.insert(webhookEvents).values({
  //   eventId,
  //   eventType,
  //   processedAt: new Date(),
  // });

  console.log(`[Stripe Webhook] Event marked as processed: ${eventId}`);
}

// ============================================================================
// Signal Dispatch
// ============================================================================

/**
 * Find workflow by payment intent metadata and send signal
 */
async function signalWorkflowForPayment(
  paymentIntent: Stripe.PaymentIntent,
  signalName: string,
  signalData: PaymentSignal
): Promise<boolean> {
  const metadata = paymentIntent.metadata;

  // Check for workflow ID in metadata (set when creating payment intent)
  const workflowId = metadata?.workflowId;

  if (!workflowId) {
    console.log(`[Stripe Webhook] No workflowId in payment intent metadata`, {
      paymentIntentId: paymentIntent.id,
    });

    // Try to find workflow by entity reference
    const jobId = metadata?.jobId;
    const invoiceId = metadata?.invoiceId;

    if (jobId || invoiceId) {
      return signalWorkflowByEntity(
        jobId ? 'job' : 'invoice',
        parseInt(jobId || invoiceId!),
        signalName,
        signalData
      );
    }

    return false;
  }

  return sendWorkflowSignal(workflowId, signalName, signalData);
}

/**
 * Find workflow by entity (job or invoice) and send signal
 */
async function signalWorkflowByEntity(
  entityType: string,
  entityId: number,
  signalName: string,
  signalData: PaymentSignal
): Promise<boolean> {
  try {
    // Find active workflow for this entity
    const workflow = await db.query.workflowRuns.findFirst({
      where: and(
        eq(workflowRuns.primaryEntityType, entityType),
        eq(workflowRuns.primaryEntityId, entityId),
        eq(workflowRuns.status, 'running')
      ),
    });

    if (!workflow) {
      console.log(`[Stripe Webhook] No active workflow found for ${entityType}:${entityId}`);
      return false;
    }

    return sendWorkflowSignal(workflow.workflowId, signalName, signalData);
  } catch (error) {
    console.error(`[Stripe Webhook] Error finding workflow by entity`, error);
    return false;
  }
}

/**
 * Send signal to a Temporal workflow
 */
async function sendWorkflowSignal(
  workflowId: string,
  signalName: string,
  signalData: PaymentSignal
): Promise<boolean> {
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);

    await handle.signal(signalName, signalData);

    console.log(`[Stripe Webhook] Signal sent to workflow`, {
      workflowId,
      signalName,
      paymentIntentId: signalData.paymentIntentId,
    });

    return true;
  } catch (error) {
    console.error(`[Stripe Webhook] Error sending signal to workflow`, {
      workflowId,
      signalName,
      error,
    });
    return false;
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  console.log(`[Stripe Webhook] payment_intent.succeeded`, {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    status: paymentIntent.status,
  });

  const signalData: PaymentSignal = {
    eventType: 'payment_intent.succeeded',
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    amountReceived: paymentIntent.amount_received,
    currency: paymentIntent.currency,
    customerId: typeof paymentIntent.customer === 'string'
      ? paymentIntent.customer
      : paymentIntent.customer?.id ?? null,
    metadata: paymentIntent.metadata as Record<string, string>,
    timestamp: new Date().toISOString(),
  };

  await signalWorkflowForPayment(paymentIntent, 'paymentSucceeded', signalData);
}

async function handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const lastError = paymentIntent.last_payment_error;

  console.log(`[Stripe Webhook] payment_intent.payment_failed`, {
    paymentIntentId: paymentIntent.id,
    errorCode: lastError?.code,
    errorMessage: lastError?.message,
  });

  const signalData: PaymentSignal = {
    eventType: 'payment_intent.payment_failed',
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    customerId: typeof paymentIntent.customer === 'string'
      ? paymentIntent.customer
      : paymentIntent.customer?.id ?? null,
    metadata: paymentIntent.metadata as Record<string, string>,
    failureCode: lastError?.code ?? undefined,
    failureMessage: lastError?.message ?? undefined,
    timestamp: new Date().toISOString(),
  };

  await signalWorkflowForPayment(paymentIntent, 'paymentFailed', signalData);
}

async function handlePaymentIntentCanceled(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  console.log(`[Stripe Webhook] payment_intent.canceled`, {
    paymentIntentId: paymentIntent.id,
  });

  const signalData: PaymentSignal = {
    eventType: 'payment_intent.canceled',
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    customerId: typeof paymentIntent.customer === 'string'
      ? paymentIntent.customer
      : paymentIntent.customer?.id ?? null,
    metadata: paymentIntent.metadata as Record<string, string>,
    timestamp: new Date().toISOString(),
  };

  await signalWorkflowForPayment(paymentIntent, 'paymentCanceled', signalData);
}

async function handlePaymentIntentRequiresAction(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  console.log(`[Stripe Webhook] payment_intent.requires_action`, {
    paymentIntentId: paymentIntent.id,
  });

  const signalData: PaymentSignal = {
    eventType: 'payment_intent.requires_action',
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    customerId: typeof paymentIntent.customer === 'string'
      ? paymentIntent.customer
      : paymentIntent.customer?.id ?? null,
    metadata: paymentIntent.metadata as Record<string, string>,
    timestamp: new Date().toISOString(),
  };

  await signalWorkflowForPayment(paymentIntent, 'paymentRequiresAction', signalData);
}

async function handleChargeRefunded(event: Stripe.Event): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id;

  console.log(`[Stripe Webhook] charge.refunded`, {
    chargeId: charge.id,
    paymentIntentId,
    amountRefunded: charge.amount_refunded,
  });

  if (!paymentIntentId) {
    console.log(`[Stripe Webhook] No payment intent for refunded charge`);
    return;
  }

  // Retrieve the payment intent to get metadata
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  const signalData: PaymentSignal = {
    eventType: 'charge.refunded',
    paymentIntentId,
    status: 'refunded',
    amount: charge.amount,
    amountReceived: charge.amount - charge.amount_refunded,
    currency: charge.currency,
    customerId: typeof charge.customer === 'string'
      ? charge.customer
      : charge.customer?.id ?? null,
    metadata: paymentIntent.metadata as Record<string, string>,
    timestamp: new Date().toISOString(),
  };

  await signalWorkflowForPayment(paymentIntent, 'paymentRefunded', signalData);
}

// ============================================================================
// Router
// ============================================================================

export const stripeWebhookRouter = Router();

/**
 * POST /api/webhooks/stripe
 *
 * Handles incoming Stripe webhook events
 */
stripeWebhookRouter.post(
  '/',
  // Use raw body for signature verification
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;

    if (!sig) {
      console.error(`[Stripe Webhook] Missing stripe-signature header`);
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body, // Raw body
        sig,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error(`[Stripe Webhook] Signature verification failed`, err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    // Check idempotency
    if (await isEventProcessed(event.id)) {
      console.log(`[Stripe Webhook] Event already processed: ${event.id}`);
      return res.json({ received: true, processed: false, reason: 'already_processed' });
    }

    console.log(`[Stripe Webhook] Processing event: ${event.type}`, {
      eventId: event.id,
      created: new Date(event.created * 1000).toISOString(),
    });

    try {
      // Route to appropriate handler
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event);
          break;

        case 'payment_intent.canceled':
          await handlePaymentIntentCanceled(event);
          break;

        case 'payment_intent.requires_action':
          await handlePaymentIntentRequiresAction(event);
          break;

        case 'charge.refunded':
          await handleChargeRefunded(event);
          break;

        case 'payment_method.attached':
          console.log(`[Stripe Webhook] payment_method.attached - no workflow signal needed`);
          break;

        case 'payment_method.detached':
          console.log(`[Stripe Webhook] payment_method.detached - no workflow signal needed`);
          break;

        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }

      // Mark as processed
      await markEventProcessed(event.id, event.type);

      return res.json({ received: true, processed: true });
    } catch (error) {
      console.error(`[Stripe Webhook] Error processing event`, error);
      // Return 200 to prevent Stripe retries for non-retryable errors
      return res.json({ received: true, processed: false, error: 'Processing error' });
    }
  }
);

/**
 * GET /api/webhooks/stripe/health
 *
 * Health check endpoint
 */
stripeWebhookRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    webhookConfigured: !!STRIPE_WEBHOOK_SECRET,
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
  });
});
