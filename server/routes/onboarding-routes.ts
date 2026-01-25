import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { OnboardingAgent } from '../../lawnflow-agents/src/agents/onboarding';
import { OnboardingHelpAgent } from '../../lawnflow-agents/src/agents/onboarding-help';
import { AgentContext, Event, StateSummary, FinOpsConfig, BusinessConfig } from '../../lawnflow-agents/src/types';

const router = Router();

// JWT secret for QR code tokens (in production, use proper env var)
const QR_CODE_SECRET = process.env.QR_CODE_SECRET || 'lawnflow-onboarding-secret-change-in-prod';

// Validation schemas
const startOnboardingSchema = z.object({
  userId: z.number(),
  businessId: z.number().optional(),
});

const submitStepSchema = z.object({
  sessionId: z.number(),
  step: z.enum([
    'welcome',
    'business_basics',
    'services',
    'pricing',
    'crews',
    'get_paid',
    'approvals',
    'power_ups',
  ]),
  data: z.record(z.any()),
});

const validateStepSchema = z.object({
  step: z.enum([
    'welcome',
    'business_basics',
    'services',
    'pricing',
    'crews',
    'get_paid',
    'approvals',
    'power_ups',
  ]),
  data: z.record(z.any()),
});

const helpRequestSchema = z.object({
  sessionId: z.number(),
  step: z.enum([
    'welcome',
    'business_basics',
    'services',
    'pricing',
    'crews',
    'get_paid',
    'approvals',
    'power_ups',
  ]),
  question: z.string().min(1),
  businessContext: z.record(z.any()).optional(),
});

/**
 * Create agent context helper
 */
function createAgentContext(
  action: string,
  payload: Record<string, any>,
  businessConfig?: Partial<BusinessConfig>
): AgentContext {
  const event: Event = {
    id: `evt_${Date.now()}`,
    type: 'onboarding_action',
    channel: 'web',
    payload: {
      action,
      ...payload,
    },
    timestamp: new Date().toISOString(),
    priority: 'medium',
  };

  const state: StateSummary = {
    context: payload.state || {},
    last_actions: [],
    active_jobs: [],
    pending_quotes: [],
  };

  const finops: FinOpsConfig = {
    token_budget: 10000,
    allowed_tools: [],
    max_tool_calls: 5,
    cost_tracking: true,
  };

  const defaultBusinessConfig: BusinessConfig = {
    account_id: businessConfig?.account_id || 'pending',
    business_name: businessConfig?.business_name || 'New Business',
    services: [],
    service_area: '',
    pricing_rules: {
      min_margin: 0.2,
      max_discount: 0.15,
      frequency_multipliers: {},
      complexity_multipliers: {},
    },
    scheduling_rules: {
      business_hours: {
        start: '08:00',
        end: '18:00',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      },
      max_jobs_per_crew: 8,
      travel_buffer_minutes: 30,
    },
    crew_config: [],
    ...businessConfig,
  };

  return {
    event,
    state,
    finops,
    business_config: defaultBusinessConfig,
  };
}

/**
 * POST /api/onboarding/start
 * Start a new onboarding session
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const parsed = startOnboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { userId, businessId } = parsed.data;

    // Create agent and execute
    const agent = new OnboardingAgent();
    const context = createAgentContext('start', { userId, businessId });
    const result = await agent.execute(context);

    if (result.status === 'error') {
      return res.status(500).json({
        error: 'Failed to start onboarding',
        details: result.errors,
      });
    }

    // In production, save to database
    // await storage.createOnboardingSession(...)

    return res.status(200).json({
      ok: true,
      session: result.data,
      summary: result.summary,
    });
  } catch (error) {
    console.error('Error starting onboarding:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/onboarding/session/:sessionId
 * Get current onboarding session status
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    // Create agent and execute
    const agent = new OnboardingAgent();
    const context = createAgentContext('get_status', { session_id: sessionId });
    const result = await agent.execute(context);

    if (result.status === 'error') {
      return res.status(500).json({
        error: 'Failed to get session status',
        details: result.errors,
      });
    }

    return res.status(200).json({
      ok: true,
      session: result.data,
    });
  } catch (error) {
    console.error('Error getting onboarding status:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/onboarding/validate/:stepId
 * Validate a step before submission
 */
router.post('/validate/:stepId', async (req: Request, res: Response) => {
  try {
    const stepId = req.params.stepId;
    const parsed = validateStepSchema.safeParse({
      step: stepId,
      data: req.body,
    });

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { step, data } = parsed.data;

    // Create agent and execute
    const agent = new OnboardingAgent();
    const context = createAgentContext('validate_step', {
      step,
      step_data: data,
    });
    const result = await agent.execute(context);

    if (result.status === 'error') {
      return res.status(500).json({
        error: 'Validation failed',
        details: result.errors,
      });
    }

    return res.status(200).json({
      ok: true,
      validation: result.data,
    });
  } catch (error) {
    console.error('Error validating step:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/onboarding/step/:stepId
 * Submit a step and transition to next
 */
router.post('/step/:stepId', async (req: Request, res: Response) => {
  try {
    const stepId = req.params.stepId;
    const parsed = submitStepSchema.safeParse({
      sessionId: req.body.sessionId,
      step: stepId,
      data: req.body,
    });

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { sessionId, step, data } = parsed.data;

    // Create agent and execute
    const agent = new OnboardingAgent();
    const context = createAgentContext('submit_step', {
      session_id: sessionId,
      step,
      step_data: data,
    });
    const result = await agent.execute(context);

    if (result.status === 'error' || result.status === 'needs_input') {
      return res.status(400).json({
        ok: false,
        error: result.summary,
        details: result.errors,
        validation: result.data,
      });
    }

    // In production, save to database
    // await storage.updateOnboardingSession(...)

    return res.status(200).json({
      ok: true,
      session: result.data,
      next_actions: result.next_actions,
    });
  } catch (error) {
    console.error('Error submitting step:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/onboarding/help
 * Request AI assistance
 */
router.post('/help', async (req: Request, res: Response) => {
  try {
    const parsed = helpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { sessionId, step, question, businessContext } = parsed.data;

    // Create help agent and execute
    const agent = new OnboardingHelpAgent();
    const context = createAgentContext('answer_question', {
      session_id: sessionId,
      step,
      question,
      business_context: businessContext || {},
    });
    const result = await agent.execute(context);

    if (result.status === 'error') {
      return res.status(500).json({
        error: 'Help request failed',
        details: result.errors,
      });
    }

    // In production, log help request
    // await storage.createOnboardingHelpRequest(...)

    return res.status(200).json({
      ok: true,
      help: result.data,
    });
  } catch (error) {
    console.error('Error processing help request:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/onboarding/qr-code/:sessionId
 * Generate QR code for mobile binding
 */
router.get('/qr-code/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    // Verify session exists and belongs to authenticated user
    // In production: check req.user.id matches session.userId

    // Generate JWT token
    const token = jwt.sign(
      {
        type: 'onboarding_mobile_binding',
        sessionId,
        userId: req.user?.id || 0, // In production, use actual user ID
        iat: Math.floor(Date.now() / 1000),
      },
      QR_CODE_SECRET,
      { expiresIn: '15m' } // 15 minutes
    );

    // Create agent and execute
    const agent = new OnboardingAgent();
    const context = createAgentContext('generate_qr_code', {
      session_id: sessionId,
    });
    const result = await agent.execute(context);

    if (result.status === 'error') {
      return res.status(500).json({
        error: 'Failed to generate QR code',
        details: result.errors,
      });
    }

    return res.status(200).json({
      ok: true,
      token,
      qr_data: {
        type: 'lawnflow_onboarding',
        token,
        session_id: sessionId,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/onboarding/verify-mobile
 * Verify mobile app is connected and 2FA complete
 */
router.post('/verify-mobile', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // In production, check mobile_device_bindings table
    // and phoneVerifications table to confirm 2FA

    return res.status(200).json({
      ok: true,
      mobile_verified: true,
      device_binding: {
        device_type: 'ios', // or 'android'
        verified_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error verifying mobile:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/onboarding/verify-web
 * Verify web dashboard access
 */
router.post('/verify-web', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Simple verification: if they can call this endpoint, web works
    return res.status(200).json({
      ok: true,
      web_verified: true,
      verified_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error verifying web:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/onboarding/complete
 * Finalize onboarding
 */
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Create agent and execute
    const agent = new OnboardingAgent();
    const context = createAgentContext('complete_onboarding', {
      session_id: sessionId,
    });
    const result = await agent.execute(context);

    if (result.status === 'error' || result.status === 'blocked') {
      return res.status(400).json({
        ok: false,
        error: result.summary,
        details: result.errors,
        missing_steps: result.data?.missing_steps,
      });
    }

    // In production, mark session as complete in database
    // await storage.completeOnboardingSession(sessionId)

    return res.status(200).json({
      ok: true,
      completion: result.data,
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/onboarding/skip-to-power-ups
 * Skip optional steps and go to power-ups
 */
router.post('/skip-to-power-ups', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // In production, update session to power_ups step
    return res.status(200).json({
      ok: true,
      current_step: 'power_ups',
    });
  } catch (error) {
    console.error('Error skipping to power-ups:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
