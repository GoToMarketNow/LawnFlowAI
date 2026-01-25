import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { Database } from '@db';
import Stripe from 'stripe';
import crypto from 'crypto';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

// ============================================
// Validation Schemas
// ============================================

const createTestPaymentSchema = z.object({
  userId: z.number(),
  businessId: z.number(),
  sessionId: z.number().optional(),
});

const verifyTestPaymentSchema = z.object({
  paymentIntentId: z.string(),
  userId: z.number(),
  businessId: z.number(),
});

// ============================================
// Test Payment Routes
// ============================================

/**
 * POST /api/test-payment/create
 * Create a $0.01 test payment intent
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const parsed = createTestPaymentSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { userId, businessId, sessionId } = parsed.data;

    // Generate idempotency key
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`test-payment-${userId}-${businessId}-${Date.now()}`)
      .digest('hex')
      .substring(0, 32);

    // Create Stripe Payment Intent for $0.01
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: 1, // $0.01 in cents
        currency: 'usd',
        description: `Test payment for onboarding - User ${userId}`,
        metadata: {
          userId: userId.toString(),
          businessId: businessId.toString(),
          sessionId: sessionId?.toString() || '',
          type: 'onboarding_test',
        },
        automatic_payment_methods: {
          enabled: true,
        },
      },
      {
        idempotencyKey,
      }
    );

    // Store payment intent in database
    const db = (req as any).db as Database;
    
    await db.insert((req as any).schema.testPayments).values({
      userId,
      businessId,
      sessionId,
      paymentIntentId: paymentIntent.id,
      amount: 1,
      currency: 'usd',
      status: 'pending',
      createdAt: new Date(),
    });

    return res.status(200).json({
      ok: true,
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        status: paymentIntent.status,
      },
    });
  } catch (error: any) {
    console.error('Test payment creation failed:', error);
    return res.status(500).json({
      error: 'Failed to create test payment',
      message: error.message,
    });
  }
});

/**
 * POST /api/test-payment/verify
 * Verify test payment completion
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const parsed = verifyTestPaymentSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { paymentIntentId, userId, businessId } = parsed.data;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const db = (req as any).db as Database;

    // Update test payment record
    await db
      .update((req as any).schema.testPayments)
      .set({
        status: paymentIntent.status as 'pending' | 'succeeded' | 'failed',
        verifiedAt: paymentIntent.status === 'succeeded' ? new Date() : null,
        stripeResponse: paymentIntent as any,
      })
      .where(
        (req as any).schema.eq(
          (req as any).schema.testPayments.paymentIntentId,
          paymentIntentId
        )
      );

    // If payment succeeded, mark onboarding step as complete
    if (paymentIntent.status === 'succeeded') {
      const sessionId = parseInt(paymentIntent.metadata.sessionId || '0');
      
      if (sessionId) {
        const session = await db.query.onboardingSessions.findFirst({
          where: (sessions, { eq }) => eq(sessions.id, sessionId),
        });

        if (session) {
          const stateJson = (session.stateJson as any) || {};
          stateJson.get_paid = stateJson.get_paid || {};
          stateJson.get_paid.test_payment_verified = true;
          stateJson.get_paid.payment_intent_id = paymentIntentId;

          await db
            .update((req as any).schema.onboardingSessions)
            .set({
              stateJson,
              updatedAt: new Date(),
            })
            .where((req as any).schema.eq((req as any).schema.onboardingSessions.id, sessionId));
        }
      }
    }

    return res.status(200).json({
      ok: true,
      verified: paymentIntent.status === 'succeeded',
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      message:
        paymentIntent.status === 'succeeded'
          ? 'Test payment verified successfully'
          : `Payment status: ${paymentIntent.status}`,
    });
  } catch (error: any) {
    console.error('Test payment verification failed:', error);
    return res.status(500).json({
      error: 'Failed to verify test payment',
      message: error.message,
    });
  }
});

/**
 * GET /api/test-payment/status/:userId
 * Get test payment status for user
 */
router.get('/status/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const db = (req as any).db as Database;

    const testPayments = await db.query.testPayments.findMany({
      where: (payments, { eq }) => eq(payments.userId, userId),
      orderBy: (payments, { desc }) => [desc(payments.createdAt)],
      limit: 10,
    });

    const hasSuccessfulPayment = testPayments.some(p => p.status === 'succeeded');

    return res.status(200).json({
      ok: true,
      hasSuccessfulPayment,
      payments: testPayments.map(p => ({
        id: p.id,
        paymentIntentId: p.paymentIntentId,
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt,
        verifiedAt: p.verifiedAt,
      })),
    });
  } catch (error: any) {
    console.error('Test payment status fetch failed:', error);
    return res.status(500).json({
      error: 'Failed to fetch test payment status',
      message: error.message,
    });
  }
});

/**
 * POST /api/test-payment/simulate-success
 * Simulate successful test payment (for development/testing)
 * Only works in development mode
 */
router.post('/simulate-success', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Simulation only available in development',
    });
  }

  try {
    const { userId, businessId, sessionId } = req.body;

    const db = (req as any).db as Database;

    // Create a mock test payment record
    const mockPaymentIntentId = `pi_test_${crypto.randomBytes(16).toString('hex')}`;

    await db.insert((req as any).schema.testPayments).values({
      userId,
      businessId,
      sessionId,
      paymentIntentId: mockPaymentIntentId,
      amount: 1,
      currency: 'usd',
      status: 'succeeded',
      verifiedAt: new Date(),
      createdAt: new Date(),
    });

    // Update onboarding session
    if (sessionId) {
      const session = await db.query.onboardingSessions.findFirst({
        where: (sessions, { eq }) => eq(sessions.id, sessionId),
      });

      if (session) {
        const stateJson = (session.stateJson as any) || {};
        stateJson.get_paid = stateJson.get_paid || {};
        stateJson.get_paid.test_payment_verified = true;
        stateJson.get_paid.payment_intent_id = mockPaymentIntentId;
        stateJson.get_paid.bank_connected = true;

        await db
          .update((req as any).schema.onboardingSessions)
          .set({
            stateJson,
            updatedAt: new Date(),
          })
          .where((req as any).schema.eq((req as any).schema.onboardingSessions.id, sessionId));
      }
    }

    return res.status(200).json({
      ok: true,
      simulated: true,
      paymentIntentId: mockPaymentIntentId,
      message: 'Test payment simulated successfully',
    });
  } catch (error: any) {
    console.error('Test payment simulation failed:', error);
    return res.status(500).json({
      error: 'Failed to simulate test payment',
      message: error.message,
    });
  }
});

export default router;
