/**
 * Tool Gateway Activity
 *
 * Unified abstraction for external tool execution with:
 * - Namespace-based routing (stripe, twilio, fsm, email)
 * - Idempotency key management
 * - Trace ID propagation
 * - Centralized logging and metrics
 *
 * @module server/temporal/activities/toolGateway
 */

import { z } from 'zod';
import * as stripeActivities from './stripe';
import * as twilioActivities from './twilio';

// ============================================================================
// Tool Gateway Schema
// ============================================================================

export const ToolNamespaceSchema = z.enum([
  'stripe',
  'twilio',
  'fsm',      // Field Service Management (internal)
  'email',    // Email provider
  'calendar', // Calendar integration
]);

export const ToolExecutionInputSchema = z.object({
  toolName: z.string().describe('Operation name within the namespace'),
  namespace: ToolNamespaceSchema,
  operation: z.string().describe('Specific operation (e.g., createPaymentIntent)'),
  input: z.unknown().describe('Operation-specific input'),
  idempotencyKey: z.string().describe('Unique key for safe retries'),
  traceId: z.string().describe('Distributed trace ID for observability'),
  metadata: z.record(z.string()).optional(),
});

export const ToolExecutionOutputSchema = z.object({
  success: z.boolean(),
  namespace: ToolNamespaceSchema,
  operation: z.string(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  durationMs: z.number(),
  traceId: z.string(),
});

export type ToolNamespace = z.infer<typeof ToolNamespaceSchema>;
export type ToolExecutionInput = z.infer<typeof ToolExecutionInputSchema>;
export type ToolExecutionOutput = z.infer<typeof ToolExecutionOutputSchema>;

// ============================================================================
// Stripe Operations Registry
// ============================================================================

const stripeOperations: Record<string, (input: any) => Promise<any>> = {
  createPaymentIntent: stripeActivities.createPaymentIntentActivity,
  capturePayment: stripeActivities.capturePaymentActivity,
  createRefund: stripeActivities.createRefundActivity,
  createCustomer: stripeActivities.createStripeCustomerActivity,
  attachPaymentMethod: stripeActivities.attachPaymentMethodActivity,
  getPaymentIntent: stripeActivities.getPaymentIntentActivity,
  cancelPaymentIntent: stripeActivities.cancelPaymentIntentActivity,
  listPaymentMethods: stripeActivities.listPaymentMethodsActivity,
};

// ============================================================================
// Twilio Operations Registry
// ============================================================================

const twilioOperations: Record<string, (input: any) => Promise<any>> = {
  sendSms: twilioActivities.sendSmsActivity,
  sendPaymentLink: twilioActivities.sendPaymentLinkSmsActivity,
  sendPaymentConfirmation: twilioActivities.sendPaymentConfirmationSmsActivity,
  sendPaymentFailure: twilioActivities.sendPaymentFailureSmsActivity,
  sendReminder: twilioActivities.sendReminderSmsActivity,
  sendPaymentSetup: twilioActivities.sendPaymentSetupSmsActivity,
  getMessageStatus: twilioActivities.getMessageStatusActivity,
  sendJobCompletion: twilioActivities.sendJobCompletionSmsActivity,
  sendQuoteReady: twilioActivities.sendQuoteReadySmsActivity,
};

// ============================================================================
// FSM Operations (Internal Field Service Management)
// ============================================================================

const fsmOperations: Record<string, (input: any) => Promise<any>> = {
  // These would wrap internal FSM operations
  // For now, placeholders that can be implemented
  async createJob(input: any) {
    console.log(`[Tool Gateway] FSM createJob`, input);
    return { success: true, jobId: input.jobId || Date.now() };
  },
  async updateJobStatus(input: any) {
    console.log(`[Tool Gateway] FSM updateJobStatus`, input);
    return { success: true, status: input.status };
  },
  async assignCrew(input: any) {
    console.log(`[Tool Gateway] FSM assignCrew`, input);
    return { success: true, crewId: input.crewId };
  },
  async scheduleVisit(input: any) {
    console.log(`[Tool Gateway] FSM scheduleVisit`, input);
    return { success: true, visitId: Date.now() };
  },
};

// ============================================================================
// Email Operations (Placeholder)
// ============================================================================

const emailOperations: Record<string, (input: any) => Promise<any>> = {
  async sendEmail(input: any) {
    console.log(`[Tool Gateway] Email sendEmail`, input);
    // Would integrate with SendGrid, Postmark, etc.
    return { success: true, messageId: `email_${Date.now()}` };
  },
  async sendInvoice(input: any) {
    console.log(`[Tool Gateway] Email sendInvoice`, input);
    return { success: true, messageId: `invoice_${Date.now()}` };
  },
  async sendReceipt(input: any) {
    console.log(`[Tool Gateway] Email sendReceipt`, input);
    return { success: true, messageId: `receipt_${Date.now()}` };
  },
};

// ============================================================================
// Calendar Operations (Placeholder)
// ============================================================================

const calendarOperations: Record<string, (input: any) => Promise<any>> = {
  async createEvent(input: any) {
    console.log(`[Tool Gateway] Calendar createEvent`, input);
    // Would integrate with Google Calendar, Calendly, etc.
    return { success: true, eventId: `cal_${Date.now()}` };
  },
  async updateEvent(input: any) {
    console.log(`[Tool Gateway] Calendar updateEvent`, input);
    return { success: true, eventId: input.eventId };
  },
  async cancelEvent(input: any) {
    console.log(`[Tool Gateway] Calendar cancelEvent`, input);
    return { success: true, canceled: true };
  },
};

// ============================================================================
// Operation Registry
// ============================================================================

const operationRegistry: Record<ToolNamespace, Record<string, (input: any) => Promise<any>>> = {
  stripe: stripeOperations,
  twilio: twilioOperations,
  fsm: fsmOperations,
  email: emailOperations,
  calendar: calendarOperations,
};

// ============================================================================
// Tool Gateway Activity
// ============================================================================

/**
 * Execute an external tool operation through the unified gateway
 *
 * This activity provides:
 * - Centralized routing to external services
 * - Consistent error handling and logging
 * - Idempotency key propagation
 * - Trace ID correlation
 *
 * @activity executeToolActivity
 */
export async function executeToolActivity(
  input: ToolExecutionInput
): Promise<ToolExecutionOutput> {
  const validated = ToolExecutionInputSchema.parse(input);
  const startTime = Date.now();

  console.log(`[Tool Gateway] Executing tool`, {
    namespace: validated.namespace,
    operation: validated.operation,
    traceId: validated.traceId,
    idempotencyKey: validated.idempotencyKey,
  });

  try {
    // Get operation registry for namespace
    const namespaceOps = operationRegistry[validated.namespace];
    if (!namespaceOps) {
      throw new Error(`Unknown namespace: ${validated.namespace}`);
    }

    // Get specific operation
    const operation = namespaceOps[validated.operation];
    if (!operation) {
      throw new Error(
        `Unknown operation '${validated.operation}' in namespace '${validated.namespace}'`
      );
    }

    // Inject idempotency key if the input supports it
    const enrichedInput = {
      ...validated.input as object,
      idempotencyKey: validated.idempotencyKey,
      _traceId: validated.traceId,
    };

    // Execute operation
    const result = await operation(enrichedInput);

    const durationMs = Date.now() - startTime;

    console.log(`[Tool Gateway] Tool execution completed`, {
      namespace: validated.namespace,
      operation: validated.operation,
      success: result?.success ?? true,
      durationMs,
      traceId: validated.traceId,
    });

    return {
      success: result?.success ?? true,
      namespace: validated.namespace,
      operation: validated.operation,
      result,
      durationMs,
      traceId: validated.traceId,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;

    console.error(`[Tool Gateway] Tool execution failed`, {
      namespace: validated.namespace,
      operation: validated.operation,
      error: error.message,
      durationMs,
      traceId: validated.traceId,
    });

    return {
      success: false,
      namespace: validated.namespace,
      operation: validated.operation,
      error: error.message,
      errorCode: error.code || 'TOOL_EXECUTION_ERROR',
      durationMs,
      traceId: validated.traceId,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Execute a Stripe operation
 */
export async function executeStripeToolActivity(
  operation: keyof typeof stripeOperations,
  input: any,
  idempotencyKey: string,
  traceId: string
): Promise<ToolExecutionOutput> {
  return executeToolActivity({
    toolName: `stripe.${operation}`,
    namespace: 'stripe',
    operation,
    input,
    idempotencyKey,
    traceId,
  });
}

/**
 * Execute a Twilio operation
 */
export async function executeTwilioToolActivity(
  operation: keyof typeof twilioOperations,
  input: any,
  idempotencyKey: string,
  traceId: string
): Promise<ToolExecutionOutput> {
  return executeToolActivity({
    toolName: `twilio.${operation}`,
    namespace: 'twilio',
    operation,
    input,
    idempotencyKey,
    traceId,
  });
}

/**
 * Execute an FSM (Field Service Management) operation
 */
export async function executeFsmToolActivity(
  operation: keyof typeof fsmOperations,
  input: any,
  idempotencyKey: string,
  traceId: string
): Promise<ToolExecutionOutput> {
  return executeToolActivity({
    toolName: `fsm.${operation}`,
    namespace: 'fsm',
    operation,
    input,
    idempotencyKey,
    traceId,
  });
}

// ============================================================================
// Tool Discovery (for agent introspection)
// ============================================================================

export interface ToolDefinition {
  namespace: ToolNamespace;
  operation: string;
  description: string;
  inputSchema?: z.ZodType<any>;
}

/**
 * Get available tools for discovery/introspection
 */
export function getAvailableTools(): ToolDefinition[] {
  return [
    // Stripe tools
    { namespace: 'stripe', operation: 'createPaymentIntent', description: 'Create and optionally confirm a payment intent' },
    { namespace: 'stripe', operation: 'capturePayment', description: 'Capture a previously authorized payment' },
    { namespace: 'stripe', operation: 'createRefund', description: 'Create a refund for a payment' },
    { namespace: 'stripe', operation: 'createCustomer', description: 'Create a Stripe customer' },
    { namespace: 'stripe', operation: 'attachPaymentMethod', description: 'Attach a payment method to a customer' },
    { namespace: 'stripe', operation: 'getPaymentIntent', description: 'Retrieve payment intent status' },
    { namespace: 'stripe', operation: 'cancelPaymentIntent', description: 'Cancel a payment intent' },
    { namespace: 'stripe', operation: 'listPaymentMethods', description: 'List payment methods for a customer' },

    // Twilio tools
    { namespace: 'twilio', operation: 'sendSms', description: 'Send a generic SMS message' },
    { namespace: 'twilio', operation: 'sendPaymentLink', description: 'Send text-to-pay payment link' },
    { namespace: 'twilio', operation: 'sendPaymentConfirmation', description: 'Send payment confirmation SMS' },
    { namespace: 'twilio', operation: 'sendPaymentFailure', description: 'Send payment failure notification' },
    { namespace: 'twilio', operation: 'sendReminder', description: 'Send service reminder' },
    { namespace: 'twilio', operation: 'sendPaymentSetup', description: 'Send payment setup link' },
    { namespace: 'twilio', operation: 'getMessageStatus', description: 'Get message delivery status' },
    { namespace: 'twilio', operation: 'sendJobCompletion', description: 'Send job completion notification' },
    { namespace: 'twilio', operation: 'sendQuoteReady', description: 'Send quote ready notification' },

    // FSM tools
    { namespace: 'fsm', operation: 'createJob', description: 'Create a new job in FSM' },
    { namespace: 'fsm', operation: 'updateJobStatus', description: 'Update job status' },
    { namespace: 'fsm', operation: 'assignCrew', description: 'Assign a crew to a job' },
    { namespace: 'fsm', operation: 'scheduleVisit', description: 'Schedule a service visit' },

    // Email tools
    { namespace: 'email', operation: 'sendEmail', description: 'Send a generic email' },
    { namespace: 'email', operation: 'sendInvoice', description: 'Send invoice email' },
    { namespace: 'email', operation: 'sendReceipt', description: 'Send receipt email' },

    // Calendar tools
    { namespace: 'calendar', operation: 'createEvent', description: 'Create a calendar event' },
    { namespace: 'calendar', operation: 'updateEvent', description: 'Update a calendar event' },
    { namespace: 'calendar', operation: 'cancelEvent', description: 'Cancel a calendar event' },
  ];
}
