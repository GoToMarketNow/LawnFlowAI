// ============================================
// Twilio SMS Integration
// ============================================

import twilio from 'twilio';

// Initialize Twilio client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

export interface SendSMSInput {
  to: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send SMS message via Twilio
 * @param input - SMS details
 * @returns Result with message ID or error
 */
export async function sendSMS(input: SendSMSInput): Promise<SMSResult> {
  const { to, message, metadata } = input;

  try {
    // Check if Twilio is configured
    if (!twilioClient || !TWILIO_PHONE_NUMBER) {
      console.warn('[Twilio] Twilio not configured - would send SMS:', {
        to,
        message: message.substring(0, 50) + '...',
      });
      
      // In development without Twilio, return mock success
      if (process.env.NODE_ENV === 'development') {
        return {
          success: true,
          messageId: `mock_${Date.now()}`,
        };
      }
      
      throw new Error('Twilio is not configured');
    }

    console.log(`[Twilio] Sending SMS to ${to}`);
    
    const twilioMessage = await twilioClient.messages.create({
      to,
      from: TWILIO_PHONE_NUMBER,
      body: message,
    });

    console.log(`[Twilio] SMS sent successfully: ${twilioMessage.sid}`);
    
    return {
      success: true,
      messageId: twilioMessage.sid,
    };
  } catch (error: any) {
    console.error('[Twilio] Failed to send SMS:', error);
    
    return {
      success: false,
      error: error.message || 'Failed to send SMS',
    };
  }
}

/**
 * Send payment link via SMS
 * @param to - Customer phone number
 * @param paymentUrl - Stripe payment link
 * @param amount - Payment amount
 */
export async function sendPaymentLink(
  to: string,
  paymentUrl: string,
  amount: number,
  jobId?: string
): Promise<SMSResult> {
  const message = `Your payment of $${amount.toFixed(2)} is ready${jobId ? ` for job ${jobId}` : ''}. Pay here: ${paymentUrl}`;
  
  return sendSMS({
    to,
    message,
    metadata: { type: 'payment_link', amount, jobId },
  });
}

/**
 * Send job notification via SMS
 * @param to - Recipient phone number
 * @param message - Notification message
 * @param jobId - Optional job ID
 */
export async function sendJobNotification(
  to: string,
  message: string,
  jobId?: string
): Promise<SMSResult> {
  return sendSMS({
    to,
    message,
    metadata: { type: 'job_notification', jobId },
  });
}

/**
 * Send review request via SMS
 * @param to - Customer phone number
 * @param reviewUrl - Review link URL
 * @param businessName - Business name
 */
export async function sendReviewRequest(
  to: string,
  reviewUrl: string,
  businessName: string
): Promise<SMSResult> {
  const message = `Thanks for choosing ${businessName}! We'd love your feedback: ${reviewUrl}`;
  
  return sendSMS({
    to,
    message,
    metadata: { type: 'review_request' },
  });
}

/**
 * Legacy connector interface for compatibility
 */
export const twilioConnector = {
  sendSMS,
  sendPaymentLink,
  sendJobNotification,
  sendReviewRequest,
};
