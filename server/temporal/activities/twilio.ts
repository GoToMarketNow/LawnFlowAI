/**
 * Twilio SMS Activities
 *
 * Temporal Activities for Twilio SMS operations with:
 * - Message delivery tracking
 * - Payment link messaging
 * - Notification templates
 *
 * @module server/temporal/activities/twilio
 */

import Twilio from 'twilio';
import { z } from 'zod';

// ============================================================================
// Configuration
// ============================================================================

const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID || '',
  process.env.TWILIO_AUTH_TOKEN || ''
);

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;

// ============================================================================
// Input/Output Schemas
// ============================================================================

export const SendSmsInputSchema = z.object({
  to: z.string().describe('Recipient phone number in E.164 format'),
  body: z.string().max(1600).describe('Message body'),
  from: z.string().optional().describe('Sender phone number (optional, uses default)'),
  mediaUrl: z.array(z.string().url()).optional().describe('URLs for MMS media'),
  statusCallback: z.string().url().optional().describe('Webhook URL for delivery status'),
});

export const SendSmsOutputSchema = z.object({
  success: z.boolean(),
  messageSid: z.string().optional(),
  status: z.enum([
    'queued',
    'sending',
    'sent',
    'delivered',
    'undelivered',
    'failed',
    'canceled',
  ]).optional(),
  error: z.string().optional(),
  errorCode: z.number().optional(),
});

export const SendPaymentLinkSmsInputSchema = z.object({
  to: z.string(),
  paymentUrl: z.string().url(),
  amount: z.number().positive(),
  businessName: z.string(),
  jobId: z.number().optional(),
  invoiceId: z.number().optional(),
  dueDate: z.string().optional(),
});

export const SendPaymentConfirmationSmsInputSchema = z.object({
  to: z.string(),
  amount: z.number().positive(),
  businessName: z.string(),
  last4: z.string(),
  jobId: z.number().optional(),
});

export const SendPaymentFailureSmsInputSchema = z.object({
  to: z.string(),
  amount: z.number().positive(),
  businessName: z.string(),
  retryUrl: z.string().url(),
  reason: z.string().optional(),
});

export const SendReminderSmsInputSchema = z.object({
  to: z.string(),
  businessName: z.string(),
  serviceName: z.string(),
  scheduledDate: z.string(),
  scheduledTime: z.string().optional(),
  crewName: z.string().optional(),
});

export const GetMessageStatusInputSchema = z.object({
  messageSid: z.string(),
});

export const GetMessageStatusOutputSchema = z.object({
  success: z.boolean(),
  messageSid: z.string().optional(),
  status: z.string().optional(),
  errorCode: z.number().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  dateSent: z.string().nullable().optional(),
  dateUpdated: z.string().optional(),
  error: z.string().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SendSmsInput = z.infer<typeof SendSmsInputSchema>;
export type SendSmsOutput = z.infer<typeof SendSmsOutputSchema>;
export type SendPaymentLinkSmsInput = z.infer<typeof SendPaymentLinkSmsInputSchema>;
export type SendPaymentConfirmationSmsInput = z.infer<typeof SendPaymentConfirmationSmsInputSchema>;
export type SendPaymentFailureSmsInput = z.infer<typeof SendPaymentFailureSmsInputSchema>;
export type SendReminderSmsInput = z.infer<typeof SendReminderSmsInputSchema>;
export type GetMessageStatusInput = z.infer<typeof GetMessageStatusInputSchema>;
export type GetMessageStatusOutput = z.infer<typeof GetMessageStatusOutputSchema>;

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function normalizePhoneNumber(phone: string): string {
  // Strip non-digits
  const digits = phone.replace(/\D/g, '');

  // Add US country code if missing
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }

  return phone;
}

// ============================================================================
// Activities
// ============================================================================

/**
 * Send a generic SMS message
 *
 * @activity sendSmsActivity
 */
export async function sendSmsActivity(
  input: SendSmsInput
): Promise<SendSmsOutput> {
  const validated = SendSmsInputSchema.parse(input);
  const toNormalized = normalizePhoneNumber(validated.to);

  console.log(`[Twilio Activity] Sending SMS`, {
    to: toNormalized,
    bodyLength: validated.body.length,
    hasMedia: !!validated.mediaUrl?.length,
  });

  try {
    const messageParams: Twilio.Twilio.MessageListInstanceCreateOptions = {
      to: toNormalized,
      body: validated.body,
      statusCallback: validated.statusCallback,
    };

    // Use messaging service if available, otherwise use phone number
    if (TWILIO_MESSAGING_SERVICE_SID) {
      messageParams.messagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
    } else {
      messageParams.from = validated.from || TWILIO_PHONE_NUMBER;
    }

    if (validated.mediaUrl?.length) {
      messageParams.mediaUrl = validated.mediaUrl;
    }

    const message = await twilioClient.messages.create(messageParams);

    console.log(`[Twilio Activity] SMS sent`, {
      messageSid: message.sid,
      status: message.status,
    });

    return {
      success: true,
      messageSid: message.sid,
      status: message.status as SendSmsOutput['status'],
    };
  } catch (error: any) {
    console.error(`[Twilio Activity] SMS send failed`, {
      code: error.code,
      message: error.message,
    });

    return {
      success: false,
      error: error.message,
      errorCode: error.code,
    };
  }
}

/**
 * Send text-to-pay payment link
 *
 * @activity sendPaymentLinkSmsActivity
 */
export async function sendPaymentLinkSmsActivity(
  input: SendPaymentLinkSmsInput
): Promise<SendSmsOutput> {
  const validated = SendPaymentLinkSmsInputSchema.parse(input);

  const amount = formatCurrency(validated.amount);
  const jobRef = validated.jobId ? ` (Job #${validated.jobId})` : '';
  const dueRef = validated.dueDate ? `\nDue: ${validated.dueDate}` : '';

  const body = `${validated.businessName}: Your service is complete! Pay now: ${validated.paymentUrl}\nAmount: ${amount}${jobRef}${dueRef}\nQuestions? Reply to this message.`;

  console.log(`[Twilio Activity] Sending payment link SMS`, {
    to: validated.to,
    amount: validated.amount,
    jobId: validated.jobId,
  });

  return sendSmsActivity({
    to: validated.to,
    body,
  });
}

/**
 * Send payment confirmation
 *
 * @activity sendPaymentConfirmationSmsActivity
 */
export async function sendPaymentConfirmationSmsActivity(
  input: SendPaymentConfirmationSmsInput
): Promise<SendSmsOutput> {
  const validated = SendPaymentConfirmationSmsInputSchema.parse(input);

  const amount = formatCurrency(validated.amount);
  const jobRef = validated.jobId ? ` (Job #${validated.jobId})` : '';

  const body = `${validated.businessName}: Payment confirmed! ${amount} charged to card ending in ${validated.last4}.${jobRef} Thank you!`;

  console.log(`[Twilio Activity] Sending payment confirmation SMS`, {
    to: validated.to,
    amount: validated.amount,
  });

  return sendSmsActivity({
    to: validated.to,
    body,
  });
}

/**
 * Send payment failure notification
 *
 * @activity sendPaymentFailureSmsActivity
 */
export async function sendPaymentFailureSmsActivity(
  input: SendPaymentFailureSmsInput
): Promise<SendSmsOutput> {
  const validated = SendPaymentFailureSmsInputSchema.parse(input);

  const amount = formatCurrency(validated.amount);
  const reasonText = validated.reason ? ` (${validated.reason})` : '';

  const body = `${validated.businessName}: Payment of ${amount} failed${reasonText}. Please update your payment method and try again: ${validated.retryUrl}`;

  console.log(`[Twilio Activity] Sending payment failure SMS`, {
    to: validated.to,
    amount: validated.amount,
    reason: validated.reason,
  });

  return sendSmsActivity({
    to: validated.to,
    body,
  });
}

/**
 * Send service reminder
 *
 * @activity sendReminderSmsActivity
 */
export async function sendReminderSmsActivity(
  input: SendReminderSmsInput
): Promise<SendSmsOutput> {
  const validated = SendReminderSmsInputSchema.parse(input);

  const timeInfo = validated.scheduledTime
    ? ` at ${validated.scheduledTime}`
    : '';
  const crewInfo = validated.crewName
    ? ` Our ${validated.crewName} crew will be there.`
    : '';

  const body = `${validated.businessName}: Reminder - Your ${validated.serviceName} is scheduled for ${validated.scheduledDate}${timeInfo}.${crewInfo} Reply with any questions!`;

  console.log(`[Twilio Activity] Sending reminder SMS`, {
    to: validated.to,
    serviceName: validated.serviceName,
    scheduledDate: validated.scheduledDate,
  });

  return sendSmsActivity({
    to: validated.to,
    body,
  });
}

/**
 * Send payment setup link (for autopay enrollment)
 *
 * @activity sendPaymentSetupSmsActivity
 */
export async function sendPaymentSetupSmsActivity(
  input: {
    to: string;
    setupUrl: string;
    businessName: string;
    context: 'first_service' | 'autopay_enrollment';
  }
): Promise<SendSmsOutput> {
  let body: string;

  if (input.context === 'first_service') {
    body = `${input.businessName}: Welcome! To complete your first service payment and enable fast checkout, please set up your payment method: ${input.setupUrl}`;
  } else {
    body = `${input.businessName}: Enable autopay for seamless service payments. Set up your payment method: ${input.setupUrl}`;
  }

  console.log(`[Twilio Activity] Sending payment setup SMS`, {
    to: input.to,
    context: input.context,
  });

  return sendSmsActivity({
    to: input.to,
    body,
  });
}

/**
 * Get message delivery status
 *
 * @activity getMessageStatusActivity
 */
export async function getMessageStatusActivity(
  input: GetMessageStatusInput
): Promise<GetMessageStatusOutput> {
  const validated = GetMessageStatusInputSchema.parse(input);

  console.log(`[Twilio Activity] Getting message status`, {
    messageSid: validated.messageSid,
  });

  try {
    const message = await twilioClient.messages(validated.messageSid).fetch();

    console.log(`[Twilio Activity] Message status retrieved`, {
      messageSid: message.sid,
      status: message.status,
    });

    return {
      success: true,
      messageSid: message.sid,
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
      dateSent: message.dateSent?.toISOString() ?? null,
      dateUpdated: message.dateUpdated?.toISOString(),
    };
  } catch (error: any) {
    console.error(`[Twilio Activity] Get message status failed`, {
      code: error.code,
      message: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send job completion notification
 *
 * @activity sendJobCompletionSmsActivity
 */
export async function sendJobCompletionSmsActivity(
  input: {
    to: string;
    businessName: string;
    serviceName: string;
    jobId: number;
    notes?: string;
    reviewUrl?: string;
  }
): Promise<SendSmsOutput> {
  let body = `${input.businessName}: Your ${input.serviceName} (Job #${input.jobId}) is complete!`;

  if (input.notes) {
    body += `\n\nNotes: ${input.notes}`;
  }

  if (input.reviewUrl) {
    body += `\n\nWe'd love your feedback: ${input.reviewUrl}`;
  }

  body += `\n\nThank you for choosing us!`;

  console.log(`[Twilio Activity] Sending job completion SMS`, {
    to: input.to,
    jobId: input.jobId,
  });

  return sendSmsActivity({
    to: input.to,
    body,
  });
}

/**
 * Send quote ready notification
 *
 * @activity sendQuoteReadySmsActivity
 */
export async function sendQuoteReadySmsActivity(
  input: {
    to: string;
    businessName: string;
    quoteUrl: string;
    amount: number;
    serviceName: string;
    expiresAt?: string;
  }
): Promise<SendSmsOutput> {
  const formattedAmount = formatCurrency(input.amount);
  const expiryInfo = input.expiresAt ? `\nOffer expires: ${input.expiresAt}` : '';

  const body = `${input.businessName}: Your quote for ${input.serviceName} is ready!\n\nEstimated price: ${formattedAmount}\n\nView and accept: ${input.quoteUrl}${expiryInfo}\n\nQuestions? Reply here!`;

  console.log(`[Twilio Activity] Sending quote ready SMS`, {
    to: input.to,
    amount: input.amount,
    serviceName: input.serviceName,
  });

  return sendSmsActivity({
    to: input.to,
    body,
  });
}
