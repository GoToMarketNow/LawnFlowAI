// ============================================
// Payment Provider Adapter - Stripe Integration
// ============================================

/**
 * Adapter for payment provider operations
 * Supports Stripe (primary), with extensibility for Square, etc.
 */

import Stripe from 'stripe';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

export interface CreatePaymentIntentInput {
  amount: number;
  currency: string;
  customerId: string; // Provider customer ID (e.g., Stripe cus_xxx)
  paymentMethodId: string; // Provider payment method ID (e.g., Stripe pm_xxx)
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  success: boolean;
  transactionId?: string;
  status?: "succeeded" | "requires_action" | "failed";
  error?: string;
  errorCode?: string;
}

export interface CreatePaymentMethodInput {
  customerId: string;
  token: string; // Token from Stripe.js, Apple Pay, Google Pay
  type: "card" | "apple_pay" | "google_pay";
}

export interface PaymentMethodResult {
  success: boolean;
  paymentMethodId?: string;
  last4?: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  error?: string;
}

export interface CreateCustomerInput {
  email?: string;
  phone?: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface CustomerResult {
  success: boolean;
  customerId?: string;
  error?: string;
}

// ============================================
// Stripe Payment Intent Operations
// ============================================

/**
 * Create and confirm payment intent
 * Used for autopay captures
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput
): Promise<PaymentIntentResult> {
  const { amount, currency, customerId, paymentMethodId, metadata } = input;

  try {
    console.log(`[Payment Provider] Creating payment intent`);
    console.log(`  Amount: ${amount} ${currency.toUpperCase()}`);
    console.log(`  Customer: ${customerId}`);
    console.log(`  Payment Method: ${paymentMethodId}`);

    // Create and confirm payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never', // For autopay, we don't want redirects
      },
      metadata: metadata || {},
    });

    console.log(`[Payment Provider] Payment intent created: ${paymentIntent.id}`);
    console.log(`  Status: ${paymentIntent.status}`);

    return {
      success: paymentIntent.status === 'succeeded',
      transactionId: paymentIntent.id,
      status: paymentIntent.status as any,
    };
  } catch (error: any) {
    console.error(`[Payment Provider] Payment intent creation failed:`, error);

    return {
      success: false,
      error: error.message || "Unknown payment provider error",
      errorCode: error.code || "unknown",
    };
  }
}

/**
 * Retrieve payment intent status
 * Used for webhook verification and status checks
 */
export async function getPaymentIntentStatus(
  paymentIntentId: string
): Promise<PaymentIntentResult> {
  try {
    console.log(`[Payment Provider] Retrieving payment intent: ${paymentIntentId}`);

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      success: true,
      transactionId: paymentIntent.id,
      status: paymentIntent.status as any,
    };
  } catch (error: any) {
    console.error(`[Payment Provider] Failed to retrieve payment intent:`, error);

    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

// ============================================
// Payment Method Operations
// ============================================

/**
 * Create payment method from token
 * Used when customer adds new payment method
 */
export async function createPaymentMethod(
  input: CreatePaymentMethodInput
): Promise<PaymentMethodResult> {
  const { customerId, token, type } = input;

  try {
    console.log(`[Payment Provider] Creating payment method`);
    console.log(`  Type: ${type}`);
    console.log(`  Customer: ${customerId}`);

    // Create payment method from token
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card', // Stripe handles Apple/Google Pay as card types
      card: { token },
    });

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethod.id, { 
      customer: customerId 
    });

    console.log(`[Payment Provider] Payment method created: ${paymentMethod.id}`);

    return {
      success: true,
      paymentMethodId: paymentMethod.id,
      last4: paymentMethod.card?.last4,
      brand: paymentMethod.card?.brand,
      expMonth: paymentMethod.card?.exp_month,
      expYear: paymentMethod.card?.exp_year,
    };
  } catch (error: any) {
    console.error(`[Payment Provider] Failed to create payment method:`, error);

    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Detach (remove) payment method
 */
export async function detachPaymentMethod(paymentMethodId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[Payment Provider] Detaching payment method: ${paymentMethodId}`);

    await stripe.paymentMethods.detach(paymentMethodId);

    console.log(`[Payment Provider] Payment method detached successfully`);

    return { success: true };
  } catch (error: any) {
    console.error(`[Payment Provider] Failed to detach payment method:`, error);

    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

// ============================================
// Customer Operations
// ============================================

/**
 * Create Stripe customer
 * Called when customer first interacts with payment system
 */
export async function createCustomer(input: CreateCustomerInput): Promise<CustomerResult> {
  const { email, phone, name, metadata } = input;

  try {
    console.log(`[Payment Provider] Creating customer`);
    console.log(`  Email: ${email}`);
    console.log(`  Phone: ${phone}`);

    const customer = await stripe.customers.create({
      email,
      phone,
      name,
      metadata: metadata || {},
    });

    console.log(`[Payment Provider] Customer created: ${customer.id}`);

    return {
      success: true,
      customerId: customer.id,
    };
  } catch (error: any) {
    console.error(`[Payment Provider] Failed to create customer:`, error);

    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

// ============================================
// Refund Operations
// ============================================

export interface CreateRefundInput {
  paymentIntentId: string;
  amount?: number; // Optional partial refund
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  metadata?: Record<string, string>;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

export async function createRefund(input: CreateRefundInput): Promise<RefundResult> {
  const { paymentIntentId, amount, reason, metadata } = input;

  try {
    console.log(`[Payment Provider] Creating refund for payment intent: ${paymentIntentId}`);

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      metadata: metadata || {},
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100); // Convert to cents
    }

    if (reason) {
      refundParams.reason = reason;
    }

    const refund = await stripe.refunds.create(refundParams);

    console.log(`[Payment Provider] Refund created: ${refund.id}`);
    console.log(`  Status: ${refund.status}`);

    return {
      success: true,
      refundId: refund.id,
    };
  } catch (error: any) {
    console.error(`[Payment Provider] Failed to create refund:`, error);
    //   payment_intent: paymentIntentId,
    //   amount: amount ? Math.round(amount * 100) : undefined,
    //   reason,
    //   metadata,
    // });

    // Mock response
    const refundId = `re_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      success: true,
      refundId,
    };
  } catch (error: any) {
    console.error(`[Payment Provider] Failed to create refund:`, error);

    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

// ============================================
// Apple Pay & Google Pay Setup
// ============================================

/**
 * Create payment session for Apple Pay
 * Returns session data for Apple Pay JS API
 */
export async function createApplePaySession(input: {
  amount: number;
  currency: string;
  label: string;
}): Promise<{ success: boolean; sessionData?: any; error?: string }> {
  try {
    console.log(`[Payment Provider] Creating Apple Pay session`);

    // TODO: Integrate with Stripe Apple Pay
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // const session = await stripe.paymentIntents.create({
    //   amount: Math.round(input.amount * 100),
    //   currency: input.currency,
    //   payment_method_types: ['card'],
    //   // Apple Pay specific configuration
    // });

    return {
      success: true,
      sessionData: {
        // Mock Apple Pay session data
        merchantIdentifier: "merchant.lawnflow.ai",
        displayName: input.label,
        amount: input.amount,
        currency: input.currency,
      },
    };
  } catch (error: any) {
    console.error(`[Payment Provider] Failed to create Apple Pay session:`, error);

    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Create payment session for Google Pay
 */
export async function createGooglePaySession(input: {
  amount: number;
  currency: string;
}): Promise<{ success: boolean; sessionData?: any; error?: string }> {
  try {
    console.log(`[Payment Provider] Creating Google Pay session`);

    // TODO: Integrate with Stripe Google Pay

    return {
      success: true,
      sessionData: {
        // Mock Google Pay session data
        merchantId: "lawnflow.ai",
        amount: input.amount,
        currency: input.currency,
      },
    };
  } catch (error: any) {
    console.error(`[Payment Provider] Failed to create Google Pay session:`, error);

    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}
