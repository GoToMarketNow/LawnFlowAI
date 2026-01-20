/**
 * Stripe Payment Activities
 *
 * Temporal Activities for Stripe payment operations with:
 * - Idempotency keys for safe retries
 * - Comprehensive error handling
 * - Activity-level logging for observability
 *
 * @module server/temporal/activities/stripe
 */

import Stripe from 'stripe';
import { z } from 'zod';

// ============================================================================
// Configuration
// ============================================================================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

// ============================================================================
// Input/Output Schemas
// ============================================================================

export const CreatePaymentIntentInputSchema = z.object({
  amount: z.number().positive().describe('Amount in cents'),
  currency: z.string().default('usd'),
  customerId: z.string().describe('Stripe customer ID (cus_xxx)'),
  paymentMethodId: z.string().describe('Stripe payment method ID (pm_xxx)'),
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  idempotencyKey: z.string().describe('Unique key for idempotent retry'),
  captureMethod: z.enum(['automatic', 'manual']).default('automatic'),
  confirm: z.boolean().default(true),
});

export const CreatePaymentIntentOutputSchema = z.object({
  success: z.boolean(),
  paymentIntentId: z.string().optional(),
  clientSecret: z.string().optional(),
  status: z.enum([
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
    'requires_capture',
    'canceled',
    'succeeded',
  ]).optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  declineCode: z.string().optional(),
});

export const CapturePaymentInputSchema = z.object({
  paymentIntentId: z.string(),
  amountToCapture: z.number().positive().optional().describe('Partial capture amount in cents'),
  idempotencyKey: z.string(),
});

export const CapturePaymentOutputSchema = z.object({
  success: z.boolean(),
  paymentIntentId: z.string().optional(),
  status: z.string().optional(),
  amountCaptured: z.number().optional(),
  error: z.string().optional(),
});

export const CreateRefundInputSchema = z.object({
  paymentIntentId: z.string(),
  amount: z.number().positive().optional().describe('Partial refund amount in cents'),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
  metadata: z.record(z.string()).optional(),
  idempotencyKey: z.string(),
});

export const CreateRefundOutputSchema = z.object({
  success: z.boolean(),
  refundId: z.string().optional(),
  status: z.string().optional(),
  amount: z.number().optional(),
  error: z.string().optional(),
});

export const CreateCustomerInputSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  idempotencyKey: z.string(),
});

export const CreateCustomerOutputSchema = z.object({
  success: z.boolean(),
  customerId: z.string().optional(),
  error: z.string().optional(),
});

export const AttachPaymentMethodInputSchema = z.object({
  customerId: z.string(),
  paymentMethodId: z.string(),
  setAsDefault: z.boolean().default(false),
  idempotencyKey: z.string(),
});

export const AttachPaymentMethodOutputSchema = z.object({
  success: z.boolean(),
  paymentMethodId: z.string().optional(),
  last4: z.string().optional(),
  brand: z.string().optional(),
  expMonth: z.number().optional(),
  expYear: z.number().optional(),
  error: z.string().optional(),
});

export const GetPaymentIntentInputSchema = z.object({
  paymentIntentId: z.string(),
});

export const GetPaymentIntentOutputSchema = z.object({
  success: z.boolean(),
  paymentIntent: z.object({
    id: z.string(),
    status: z.string(),
    amount: z.number(),
    amountReceived: z.number(),
    currency: z.string(),
    customerId: z.string().nullable(),
    paymentMethodId: z.string().nullable(),
    metadata: z.record(z.string()),
  }).optional(),
  error: z.string().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreatePaymentIntentInput = z.infer<typeof CreatePaymentIntentInputSchema>;
export type CreatePaymentIntentOutput = z.infer<typeof CreatePaymentIntentOutputSchema>;
export type CapturePaymentInput = z.infer<typeof CapturePaymentInputSchema>;
export type CapturePaymentOutput = z.infer<typeof CapturePaymentOutputSchema>;
export type CreateRefundInput = z.infer<typeof CreateRefundInputSchema>;
export type CreateRefundOutput = z.infer<typeof CreateRefundOutputSchema>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;
export type CreateCustomerOutput = z.infer<typeof CreateCustomerOutputSchema>;
export type AttachPaymentMethodInput = z.infer<typeof AttachPaymentMethodInputSchema>;
export type AttachPaymentMethodOutput = z.infer<typeof AttachPaymentMethodOutputSchema>;
export type GetPaymentIntentInput = z.infer<typeof GetPaymentIntentInputSchema>;
export type GetPaymentIntentOutput = z.infer<typeof GetPaymentIntentOutputSchema>;

// ============================================================================
// Activities
// ============================================================================

/**
 * Create and optionally confirm a payment intent
 *
 * @activity createPaymentIntentActivity
 */
export async function createPaymentIntentActivity(
  input: CreatePaymentIntentInput
): Promise<CreatePaymentIntentOutput> {
  const validated = CreatePaymentIntentInputSchema.parse(input);

  console.log(`[Stripe Activity] Creating payment intent`, {
    amount: validated.amount,
    currency: validated.currency,
    customerId: validated.customerId,
    idempotencyKey: validated.idempotencyKey,
  });

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: validated.amount,
        currency: validated.currency,
        customer: validated.customerId,
        payment_method: validated.paymentMethodId,
        description: validated.description,
        metadata: validated.metadata,
        capture_method: validated.captureMethod,
        confirm: validated.confirm,
        // Automatic payment methods for flexibility
        automatic_payment_methods: validated.confirm ? undefined : {
          enabled: true,
          allow_redirects: 'never',
        },
      },
      {
        idempotencyKey: validated.idempotencyKey,
      }
    );

    console.log(`[Stripe Activity] Payment intent created`, {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ?? undefined,
      status: paymentIntent.status as CreatePaymentIntentOutput['status'],
    };
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;

    console.error(`[Stripe Activity] Payment intent creation failed`, {
      type: stripeError.type,
      code: stripeError.code,
      message: stripeError.message,
      declineCode: stripeError.decline_code,
    });

    return {
      success: false,
      error: stripeError.message,
      errorCode: stripeError.code,
      declineCode: stripeError.decline_code,
    };
  }
}

/**
 * Capture a previously authorized payment
 *
 * @activity capturePaymentActivity
 */
export async function capturePaymentActivity(
  input: CapturePaymentInput
): Promise<CapturePaymentOutput> {
  const validated = CapturePaymentInputSchema.parse(input);

  console.log(`[Stripe Activity] Capturing payment`, {
    paymentIntentId: validated.paymentIntentId,
    amountToCapture: validated.amountToCapture,
    idempotencyKey: validated.idempotencyKey,
  });

  try {
    const paymentIntent = await stripe.paymentIntents.capture(
      validated.paymentIntentId,
      {
        amount_to_capture: validated.amountToCapture,
      },
      {
        idempotencyKey: validated.idempotencyKey,
      }
    );

    console.log(`[Stripe Activity] Payment captured`, {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amountReceived: paymentIntent.amount_received,
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amountCaptured: paymentIntent.amount_received,
    };
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;

    console.error(`[Stripe Activity] Payment capture failed`, {
      type: stripeError.type,
      code: stripeError.code,
      message: stripeError.message,
    });

    return {
      success: false,
      error: stripeError.message,
    };
  }
}

/**
 * Create a refund for a payment
 *
 * @activity createRefundActivity
 */
export async function createRefundActivity(
  input: CreateRefundInput
): Promise<CreateRefundOutput> {
  const validated = CreateRefundInputSchema.parse(input);

  console.log(`[Stripe Activity] Creating refund`, {
    paymentIntentId: validated.paymentIntentId,
    amount: validated.amount,
    reason: validated.reason,
    idempotencyKey: validated.idempotencyKey,
  });

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: validated.paymentIntentId,
        amount: validated.amount,
        reason: validated.reason,
        metadata: validated.metadata,
      },
      {
        idempotencyKey: validated.idempotencyKey,
      }
    );

    console.log(`[Stripe Activity] Refund created`, {
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount,
    });

    return {
      success: true,
      refundId: refund.id,
      status: refund.status ?? undefined,
      amount: refund.amount,
    };
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;

    console.error(`[Stripe Activity] Refund creation failed`, {
      type: stripeError.type,
      code: stripeError.code,
      message: stripeError.message,
    });

    return {
      success: false,
      error: stripeError.message,
    };
  }
}

/**
 * Create a Stripe customer
 *
 * @activity createStripeCustomerActivity
 */
export async function createStripeCustomerActivity(
  input: CreateCustomerInput
): Promise<CreateCustomerOutput> {
  const validated = CreateCustomerInputSchema.parse(input);

  console.log(`[Stripe Activity] Creating customer`, {
    email: validated.email,
    phone: validated.phone,
    idempotencyKey: validated.idempotencyKey,
  });

  try {
    const customer = await stripe.customers.create(
      {
        email: validated.email,
        phone: validated.phone,
        name: validated.name,
        metadata: validated.metadata,
      },
      {
        idempotencyKey: validated.idempotencyKey,
      }
    );

    console.log(`[Stripe Activity] Customer created`, {
      customerId: customer.id,
    });

    return {
      success: true,
      customerId: customer.id,
    };
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;

    console.error(`[Stripe Activity] Customer creation failed`, {
      type: stripeError.type,
      code: stripeError.code,
      message: stripeError.message,
    });

    return {
      success: false,
      error: stripeError.message,
    };
  }
}

/**
 * Attach a payment method to a customer
 *
 * @activity attachPaymentMethodActivity
 */
export async function attachPaymentMethodActivity(
  input: AttachPaymentMethodInput
): Promise<AttachPaymentMethodOutput> {
  const validated = AttachPaymentMethodInputSchema.parse(input);

  console.log(`[Stripe Activity] Attaching payment method`, {
    customerId: validated.customerId,
    paymentMethodId: validated.paymentMethodId,
    setAsDefault: validated.setAsDefault,
    idempotencyKey: validated.idempotencyKey,
  });

  try {
    // Attach the payment method
    const paymentMethod = await stripe.paymentMethods.attach(
      validated.paymentMethodId,
      {
        customer: validated.customerId,
      },
      {
        idempotencyKey: validated.idempotencyKey,
      }
    );

    // Optionally set as default
    if (validated.setAsDefault) {
      await stripe.customers.update(validated.customerId, {
        invoice_settings: {
          default_payment_method: validated.paymentMethodId,
        },
      });
    }

    const card = paymentMethod.card;

    console.log(`[Stripe Activity] Payment method attached`, {
      paymentMethodId: paymentMethod.id,
      brand: card?.brand,
      last4: card?.last4,
    });

    return {
      success: true,
      paymentMethodId: paymentMethod.id,
      last4: card?.last4,
      brand: card?.brand,
      expMonth: card?.exp_month,
      expYear: card?.exp_year,
    };
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;

    console.error(`[Stripe Activity] Payment method attach failed`, {
      type: stripeError.type,
      code: stripeError.code,
      message: stripeError.message,
    });

    return {
      success: false,
      error: stripeError.message,
    };
  }
}

/**
 * Retrieve payment intent status
 *
 * @activity getPaymentIntentActivity
 */
export async function getPaymentIntentActivity(
  input: GetPaymentIntentInput
): Promise<GetPaymentIntentOutput> {
  const validated = GetPaymentIntentInputSchema.parse(input);

  console.log(`[Stripe Activity] Retrieving payment intent`, {
    paymentIntentId: validated.paymentIntentId,
  });

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      validated.paymentIntentId
    );

    console.log(`[Stripe Activity] Payment intent retrieved`, {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });

    return {
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        amountReceived: paymentIntent.amount_received,
        currency: paymentIntent.currency,
        customerId: typeof paymentIntent.customer === 'string'
          ? paymentIntent.customer
          : paymentIntent.customer?.id ?? null,
        paymentMethodId: typeof paymentIntent.payment_method === 'string'
          ? paymentIntent.payment_method
          : paymentIntent.payment_method?.id ?? null,
        metadata: paymentIntent.metadata as Record<string, string>,
      },
    };
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;

    console.error(`[Stripe Activity] Payment intent retrieval failed`, {
      type: stripeError.type,
      code: stripeError.code,
      message: stripeError.message,
    });

    return {
      success: false,
      error: stripeError.message,
    };
  }
}

/**
 * Cancel a payment intent
 *
 * @activity cancelPaymentIntentActivity
 */
export async function cancelPaymentIntentActivity(
  input: { paymentIntentId: string; cancellationReason?: string; idempotencyKey: string }
): Promise<{ success: boolean; status?: string; error?: string }> {
  console.log(`[Stripe Activity] Canceling payment intent`, {
    paymentIntentId: input.paymentIntentId,
    idempotencyKey: input.idempotencyKey,
  });

  try {
    const paymentIntent = await stripe.paymentIntents.cancel(
      input.paymentIntentId,
      {
        cancellation_reason: input.cancellationReason as Stripe.PaymentIntentCancelParams.CancellationReason,
      },
      {
        idempotencyKey: input.idempotencyKey,
      }
    );

    console.log(`[Stripe Activity] Payment intent canceled`, {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });

    return {
      success: true,
      status: paymentIntent.status,
    };
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;

    console.error(`[Stripe Activity] Payment intent cancellation failed`, {
      type: stripeError.type,
      code: stripeError.code,
      message: stripeError.message,
    });

    return {
      success: false,
      error: stripeError.message,
    };
  }
}

/**
 * List payment methods for a customer
 *
 * @activity listPaymentMethodsActivity
 */
export async function listPaymentMethodsActivity(
  input: { customerId: string; type?: 'card' | 'us_bank_account' }
): Promise<{
  success: boolean;
  paymentMethods?: Array<{
    id: string;
    type: string;
    last4?: string;
    brand?: string;
    expMonth?: number;
    expYear?: number;
  }>;
  error?: string;
}> {
  console.log(`[Stripe Activity] Listing payment methods`, {
    customerId: input.customerId,
    type: input.type,
  });

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: input.customerId,
      type: input.type || 'card',
    });

    const methods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      last4: pm.card?.last4,
      brand: pm.card?.brand,
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
    }));

    console.log(`[Stripe Activity] Found ${methods.length} payment methods`);

    return {
      success: true,
      paymentMethods: methods,
    };
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;

    console.error(`[Stripe Activity] List payment methods failed`, {
      type: stripeError.type,
      code: stripeError.code,
      message: stripeError.message,
    });

    return {
      success: false,
      error: stripeError.message,
    };
  }
}
