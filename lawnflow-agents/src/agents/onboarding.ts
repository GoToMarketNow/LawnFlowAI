import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, NextAction } from '../types';

/**
 * Onboarding Steps
 */
export const ONBOARDING_STEPS = [
  'welcome',
  'business_basics',
  'services',
  'pricing',
  'crews',
  'get_paid',
  'approvals',
  'power_ups',
  'complete',
] as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[number];

/**
 * Step Configuration
 */
interface StepConfig {
  id: OnboardingStep;
  name: string;
  required: boolean;
  validationRules: string[];
  nextStep: OnboardingStep | null;
  previousStep: OnboardingStep | null;
}

const STEP_CONFIGS: Record<OnboardingStep, StepConfig> = {
  welcome: {
    id: 'welcome',
    name: 'Welcome',
    required: false,
    validationRules: [],
    nextStep: 'business_basics',
    previousStep: null,
  },
  business_basics: {
    id: 'business_basics',
    name: 'Business Basics',
    required: true,
    validationRules: ['business_name', 'primary_service_area', 'customer_type'],
    nextStep: 'services',
    previousStep: 'welcome',
  },
  services: {
    id: 'services',
    name: 'Services',
    required: true,
    validationRules: ['at_least_one_service_category'],
    nextStep: 'pricing',
    previousStep: 'business_basics',
  },
  pricing: {
    id: 'pricing',
    name: 'Pricing Model',
    required: true,
    validationRules: ['pricing_model_selected'],
    nextStep: 'crews',
    previousStep: 'services',
  },
  crews: {
    id: 'crews',
    name: 'Crews',
    required: true,
    validationRules: ['crew_lead_name', 'crew_lead_phone'],
    nextStep: 'get_paid',
    previousStep: 'pricing',
  },
  get_paid: {
    id: 'get_paid',
    name: 'Get Paid',
    required: true,
    validationRules: [
      'at_least_one_payment_method',
      'bank_connected',
      'test_payment_successful',
    ],
    nextStep: 'approvals',
    previousStep: 'crews',
  },
  approvals: {
    id: 'approvals',
    name: 'Approvals & Control',
    required: true,
    validationRules: ['approval_owner_set'],
    nextStep: 'power_ups',
    previousStep: 'get_paid',
  },
  power_ups: {
    id: 'power_ups',
    name: 'Optional Power-Ups',
    required: false,
    validationRules: [],
    nextStep: 'complete',
    previousStep: 'approvals',
  },
  complete: {
    id: 'complete',
    name: 'Complete',
    required: false,
    validationRules: [],
    nextStep: null,
    previousStep: 'power_ups',
  },
};

/**
 * Onboarding Result
 */
export interface OnboardingResult {
  session_id: number;
  current_step: OnboardingStep;
  completed_steps: OnboardingStep[];
  validation_errors: Array<{
    field: string;
    message: string;
  }>;
  next_step: OnboardingStep | null;
  can_proceed: boolean;
  progress_percentage: number;
  state: Record<string, any>;
  qr_code_token?: string;
  mobile_verified: boolean;
  web_verified: boolean;
}

/**
 * OnboardingAgent - Hybrid workflow orchestrator with AI assistance
 * 
 * Manages the 7-step onboarding flow with:
 * - Step validation and state machine transitions
 * - Smart defaults generation
 * - Integration with other agents (Payment, Marketing, Scheduling)
 * - QR code generation for mobile binding
 * - Platform verification
 */
export class OnboardingAgent extends BaseAgent {
  constructor() {
    super('onboarding', '1.0.0');
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const action = context.event.payload?.action || 'get_status';
      const sessionId = context.event.payload?.session_id;
      const stepData = context.event.payload?.step_data;
      const step = context.event.payload?.step as OnboardingStep;

      switch (action) {
        case 'start':
          return await this.startOnboarding(context, startTime);
        
        case 'get_status':
          return await this.getStatus(context, sessionId, startTime);
        
        case 'validate_step':
          return await this.validateStep(context, step, stepData, startTime);
        
        case 'submit_step':
          return await this.submitStep(context, sessionId, step, stepData, startTime);
        
        case 'generate_qr_code':
          return await this.generateQRCode(context, sessionId, startTime);
        
        case 'complete_onboarding':
          return await this.completeOnboarding(context, sessionId, startTime);
        
        default:
          return this.createEnvelope(
            'error',
            `Unknown action: ${action}`,
            null,
            [],
            [{ code: 'UNKNOWN_ACTION', message: `Action ${action} not supported`, recoverable: false }],
            { estimated_tokens_in: 10, estimated_tokens_out: 20, tool_calls: 0 }
          );
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.createEnvelope(
        'error',
        'Onboarding agent failed',
        null,
        [],
        [{ 
          code: 'AGENT_ERROR', 
          message: error instanceof Error ? error.message : 'Unknown error', 
          recoverable: true 
        }],
        {
          estimated_tokens_in: 0,
          estimated_tokens_out: 0,
          tool_calls: 0,
          metadata: {
            execution_time_ms: executionTime,
            agent_version: this.version,
          }
        }
      );
    }
  }

  /**
   * Start a new onboarding session
   */
  private async startOnboarding(
    context: AgentContext,
    startTime: number
  ): Promise<Envelope> {
    // In real implementation, this would create a database record
    const sessionId = Date.now(); // Mock session ID
    
    const result: OnboardingResult = {
      session_id: sessionId,
      current_step: 'welcome',
      completed_steps: [],
      validation_errors: [],
      next_step: 'business_basics',
      can_proceed: true,
      progress_percentage: 0,
      state: {},
      mobile_verified: false,
      web_verified: false,
    };

    const executionTime = Date.now() - startTime;

    return this.createEnvelope(
      'ok',
      'Onboarding session started',
      result,
      [
        {
          type: 'complete',
          detail: 'Session initialized, ready for business basics',
          priority: 'medium',
        },
      ],
      [],
      {
        estimated_tokens_in: 50,
        estimated_tokens_out: 100,
        tool_calls: 1,
        metadata: {
          execution_time_ms: executionTime,
          agent_version: this.version,
        }
      }
    );
  }

  /**
   * Get current onboarding status
   */
  private async getStatus(
    context: AgentContext,
    sessionId: number,
    startTime: number
  ): Promise<Envelope> {
    if (!sessionId) {
      return this.createEnvelope(
        'needs_input',
        'Session ID required',
        null,
        [this.createUserAsk('Please provide session_id')],
        [],
        { estimated_tokens_in: 10, estimated_tokens_out: 20, tool_calls: 0 }
      );
    }

    // In real implementation, fetch from database
    const result: OnboardingResult = {
      session_id: sessionId,
      current_step: 'business_basics',
      completed_steps: ['welcome'],
      validation_errors: [],
      next_step: 'services',
      can_proceed: false,
      progress_percentage: 14,
      state: {},
      mobile_verified: false,
      web_verified: false,
    };

    const executionTime = Date.now() - startTime;

    return this.createEnvelope(
      'ok',
      'Retrieved onboarding status',
      result,
      [],
      [],
      {
        estimated_tokens_in: 20,
        estimated_tokens_out: 150,
        tool_calls: 1,
        metadata: {
          execution_time_ms: executionTime,
          agent_version: this.version,
        }
      }
    );
  }

  /**
   * Validate a step without submitting
   */
  private async validateStep(
    context: AgentContext,
    step: OnboardingStep,
    stepData: Record<string, any>,
    startTime: number
  ): Promise<Envelope> {
    if (!step || !STEP_CONFIGS[step]) {
      return this.createEnvelope(
        'error',
        'Invalid step',
        null,
        [],
        [{ code: 'INVALID_STEP', message: 'Step not found', recoverable: false }],
        { estimated_tokens_in: 10, estimated_tokens_out: 20, tool_calls: 0 }
      );
    }

    const config = STEP_CONFIGS[step];
    const errors = this.runValidationRules(config.validationRules, stepData);

    const result = {
      step,
      valid: errors.length === 0,
      errors,
      can_proceed: errors.length === 0,
    };

    const executionTime = Date.now() - startTime;

    return this.createEnvelope(
      errors.length === 0 ? 'ok' : 'needs_input',
      errors.length === 0 ? 'Validation passed' : 'Validation failed',
      result,
      [],
      errors.length > 0 ? [{ 
        code: 'VALIDATION_ERROR', 
        message: 'Step validation failed', 
        details: errors,
        recoverable: true 
      }] : [],
      {
        estimated_tokens_in: 50,
        estimated_tokens_out: 100,
        tool_calls: 0,
        metadata: {
          execution_time_ms: executionTime,
          agent_version: this.version,
        }
      }
    );
  }

  /**
   * Submit a step and transition to next
   */
  private async submitStep(
    context: AgentContext,
    sessionId: number,
    step: OnboardingStep,
    stepData: Record<string, any>,
    startTime: number
  ): Promise<Envelope> {
    if (!sessionId) {
      return this.createEnvelope(
        'needs_input',
        'Session ID required',
        null,
        [this.createUserAsk('Please provide session_id')],
        [],
        { estimated_tokens_in: 10, estimated_tokens_out: 20, tool_calls: 0 }
      );
    }

    if (!step || !STEP_CONFIGS[step]) {
      return this.createEnvelope(
        'error',
        'Invalid step',
        null,
        [],
        [{ code: 'INVALID_STEP', message: 'Step not found', recoverable: false }],
        { estimated_tokens_in: 10, estimated_tokens_out: 20, tool_calls: 0 }
      );
    }

    const config = STEP_CONFIGS[step];
    const errors = this.runValidationRules(config.validationRules, stepData);

    if (errors.length > 0) {
      return this.createEnvelope(
        'needs_input',
        'Validation failed, cannot proceed',
        { step, errors },
        [],
        [{ 
          code: 'VALIDATION_ERROR', 
          message: 'Step validation failed', 
          details: errors,
          recoverable: true 
        }],
        { estimated_tokens_in: 50, estimated_tokens_out: 100, tool_calls: 0 }
      );
    }

    // Handle special step logic
    const nextActions: NextAction[] = [];
    
    if (step === 'services') {
      // Generate service configuration in database
      nextActions.push({
        type: 'tool_call',
        detail: 'create_service_categories',
        priority: 'high',
      });
    }
    
    if (step === 'get_paid') {
      // Trigger Payment Agent for test payment
      nextActions.push(
        this.createHandoff('payment', {
          action: 'test_payment',
          amount: 1, // $0.01
          customer_email: stepData.test_email || context.business_config.business_info?.email,
        })
      );
    }
    
    if (step === 'power_ups' && stepData.enable_marketing) {
      // Enable Marketing Agent
      nextActions.push(
        this.createHandoff('marketing', {
          action: 'initialize',
          business_id: context.business_config.account_id,
        })
      );
    }

    // Calculate progress
    const completedSteps = [...(context.state.context?.completed_steps || []), step];
    const totalSteps = ONBOARDING_STEPS.filter(s => STEP_CONFIGS[s].required).length;
    const progress = Math.round((completedSteps.length / totalSteps) * 100);

    const result: OnboardingResult = {
      session_id: sessionId,
      current_step: config.nextStep || step,
      completed_steps: completedSteps,
      validation_errors: [],
      next_step: config.nextStep,
      can_proceed: config.nextStep !== null,
      progress_percentage: progress,
      state: stepData,
      mobile_verified: false,
      web_verified: false,
    };

    const executionTime = Date.now() - startTime;

    return this.createEnvelope(
      'ok',
      `Step ${step} completed successfully`,
      result,
      nextActions,
      [],
      {
        estimated_tokens_in: 100,
        estimated_tokens_out: 200,
        tool_calls: nextActions.length,
        metadata: {
          execution_time_ms: executionTime,
          agent_version: this.version,
        }
      }
    );
  }

  /**
   * Generate QR code for mobile binding
   */
  private async generateQRCode(
    context: AgentContext,
    sessionId: number,
    startTime: number
  ): Promise<Envelope> {
    if (!sessionId) {
      return this.createEnvelope(
        'needs_input',
        'Session ID required',
        null,
        [this.createUserAsk('Please provide session_id')],
        [],
        { estimated_tokens_in: 10, estimated_tokens_out: 20, tool_calls: 0 }
      );
    }

    // Generate JWT token (mock implementation)
    const token = `qr_${sessionId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const result = {
      session_id: sessionId,
      qr_code_token: token,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      qr_code_data: {
        type: 'lawnflow_onboarding',
        token,
        session_id: sessionId,
        business_id: context.business_config.account_id,
      },
    };

    const executionTime = Date.now() - startTime;

    return this.createEnvelope(
      'ok',
      'QR code generated for mobile binding',
      result,
      [],
      [],
      {
        estimated_tokens_in: 30,
        estimated_tokens_out: 80,
        tool_calls: 1,
        metadata: {
          execution_time_ms: executionTime,
          agent_version: this.version,
        }
      }
    );
  }

  /**
   * Complete onboarding
   */
  private async completeOnboarding(
    context: AgentContext,
    sessionId: number,
    startTime: number
  ): Promise<Envelope> {
    if (!sessionId) {
      return this.createEnvelope(
        'needs_input',
        'Session ID required',
        null,
        [this.createUserAsk('Please provide session_id')],
        [],
        { estimated_tokens_in: 10, estimated_tokens_out: 20, tool_calls: 0 }
      );
    }

    // Validate all required steps completed
    const requiredSteps = ONBOARDING_STEPS.filter(s => STEP_CONFIGS[s].required);
    const completedSteps = context.state.context?.completed_steps || [];
    const missingSteps = requiredSteps.filter(s => !completedSteps.includes(s));

    if (missingSteps.length > 0) {
      return this.createEnvelope(
        'blocked',
        'Cannot complete onboarding: required steps missing',
        { missing_steps: missingSteps },
        [],
        [{ 
          code: 'INCOMPLETE_ONBOARDING', 
          message: 'Required steps not completed', 
          details: missingSteps,
          recoverable: true 
        }],
        { estimated_tokens_in: 50, estimated_tokens_out: 100, tool_calls: 0 }
      );
    }

    const result = {
      session_id: sessionId,
      completed_at: new Date().toISOString(),
      status: 'complete',
      ready_for_operations: true,
      next_steps: [
        'Access your dashboard',
        'Review agent configurations',
        'Start receiving leads',
      ],
    };

    const executionTime = Date.now() - startTime;

    return this.createEnvelope(
      'ok',
      'Onboarding completed successfully! 🎉',
      result,
      [
        {
          type: 'complete',
          detail: 'Redirect to dashboard',
          priority: 'high',
        },
      ],
      [],
      {
        estimated_tokens_in: 100,
        estimated_tokens_out: 150,
        tool_calls: 2,
        metadata: {
          execution_time_ms: executionTime,
          agent_version: this.version,
        }
      }
    );
  }

  /**
   * Run validation rules on step data
   */
  private runValidationRules(
    rules: string[],
    data: Record<string, any>
  ): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];

    rules.forEach(rule => {
      switch (rule) {
        case 'business_name':
          if (!data.business_name || data.business_name.trim().length === 0) {
            errors.push({ field: 'business_name', message: 'Business name is required' });
          }
          break;
        
        case 'primary_service_area':
          if (!data.service_area && !data.zip_codes?.length) {
            errors.push({ field: 'service_area', message: 'Service area is required' });
          }
          break;
        
        case 'customer_type':
          if (!data.customer_type || !['residential', 'commercial', 'both'].includes(data.customer_type)) {
            errors.push({ field: 'customer_type', message: 'Customer type is required' });
          }
          break;
        
        case 'at_least_one_service_category':
          if (!data.service_packs?.length && !data.service_categories?.length) {
            errors.push({ field: 'services', message: 'At least one service category is required' });
          }
          break;
        
        case 'pricing_model_selected':
          if (!data.pricing_model) {
            errors.push({ field: 'pricing_model', message: 'Pricing model is required' });
          }
          break;
        
        case 'crew_lead_name':
          if (!data.crew_lead_name || data.crew_lead_name.trim().length === 0) {
            errors.push({ field: 'crew_lead_name', message: 'Crew lead name is required' });
          }
          break;
        
        case 'crew_lead_phone':
          if (!data.crew_lead_phone || data.crew_lead_phone.trim().length < 10) {
            errors.push({ field: 'crew_lead_phone', message: 'Valid crew lead phone is required' });
          }
          break;
        
        case 'at_least_one_payment_method':
          if (!data.payment_methods?.length) {
            errors.push({ field: 'payment_methods', message: 'At least one payment method is required' });
          }
          break;
        
        case 'bank_connected':
          if (!data.bank_connected) {
            errors.push({ field: 'bank_connection', message: 'Bank connection is required' });
          }
          break;
        
        case 'test_payment_successful':
          if (!data.test_payment_verified) {
            errors.push({ field: 'test_payment', message: 'Test payment must be completed' });
          }
          break;
        
        case 'approval_owner_set':
          if (!data.approval_owner) {
            errors.push({ field: 'approval_owner', message: 'Approval owner is required' });
          }
          break;
      }
    });

    return errors;
  }
}
