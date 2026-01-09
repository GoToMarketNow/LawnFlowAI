// ============================================
// SMS Adapter - Text-to-Pay & Payment Setup Links
// ============================================

/**
 * Adapter for sending payment-related SMS messages
 * Integrates with Twilio or other SMS providers
 */

export interface SendPaymentLinkInput {
  to: string; // Customer phone number
  sessionUrl: string; // Payment session URL
  amount: number;
  businessName: string;
  jobId?: number;
}

export interface SendPaymentSetupInput {
  to: string;
  setupUrl: string;
  businessName: string;
  context: "first_service" | "autopay_enrollment";
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send text-to-pay link
 */
export async function sendPaymentLink(input: SendPaymentLinkInput): Promise<SMSResult> {
  const { to, sessionUrl, amount, businessName, jobId } = input;

  try {
    // TODO: Integrate with Twilio or SMS provider
    const message = buildPaymentLinkMessage({ sessionUrl, amount, businessName, jobId });

    console.log(`[SMS Adapter] Sending payment link to ${to}`);
    console.log(`[SMS Adapter] Message: ${message}`);

    // Mock SMS send (replace with actual provider integration)
    const messageId = `sms_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Simulate Twilio API call:
    // const twilioResult = await twilioClient.messages.create({
    //   to,
    //   from: TWILIO_PHONE_NUMBER,
    //   body: message,
    // });

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    console.error(`[SMS Adapter] Failed to send payment link:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown SMS error",
    };
  }
}

/**
 * Send payment setup link (first service or autopay enrollment)
 */
export async function sendPaymentSetupLink(input: SendPaymentSetupInput): Promise<SMSResult> {
  const { to, setupUrl, businessName, context } = input;

  try {
    const message = buildPaymentSetupMessage({ setupUrl, businessName, context });

    console.log(`[SMS Adapter] Sending payment setup link to ${to}`);
    console.log(`[SMS Adapter] Message: ${message}`);

    // Mock SMS send
    const messageId = `sms_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    console.error(`[SMS Adapter] Failed to send payment setup link:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown SMS error",
    };
  }
}

// ============================================
// Message Templates
// ============================================

function buildPaymentLinkMessage(params: {
  sessionUrl: string;
  amount: number;
  businessName: string;
  jobId?: number;
}): string {
  const { sessionUrl, amount, businessName, jobId } = params;
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

  return `${businessName}: Your service is complete! Pay now: ${sessionUrl}\nAmount: ${formattedAmount}${
    jobId ? ` (Job #${jobId})` : ""
  }\nQuestions? Reply to this message.`;
}

function buildPaymentSetupMessage(params: {
  setupUrl: string;
  businessName: string;
  context: "first_service" | "autopay_enrollment";
}): string {
  const { setupUrl, businessName, context } = params;

  if (context === "first_service") {
    return `${businessName}: Welcome! To complete your first service payment and enable fast checkout, please set up your payment method: ${setupUrl}`;
  } else {
    return `${businessName}: Enable autopay for seamless service payments. Set up your payment method: ${setupUrl}`;
  }
}

// ============================================
// Confirmation & Receipt Messages
// ============================================

export interface SendPaymentConfirmationInput {
  to: string;
  amount: number;
  businessName: string;
  last4: string;
  jobId?: number;
}

export async function sendPaymentConfirmation(
  input: SendPaymentConfirmationInput
): Promise<SMSResult> {
  const { to, amount, businessName, last4, jobId } = input;

  try {
    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

    const message = `${businessName}: Payment confirmed! ${formattedAmount} charged to card ending in ${last4}.${
      jobId ? ` (Job #${jobId})` : ""
    } Thank you!`;

    console.log(`[SMS Adapter] Sending payment confirmation to ${to}`);

    // Mock SMS send
    const messageId = `sms_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    console.error(`[SMS Adapter] Failed to send payment confirmation:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown SMS error",
    };
  }
}

// ============================================
// Payment Failure Notification
// ============================================

export interface SendPaymentFailureInput {
  to: string;
  amount: number;
  businessName: string;
  retryUrl: string;
  reason?: string;
}

export async function sendPaymentFailureNotification(
  input: SendPaymentFailureInput
): Promise<SMSResult> {
  const { to, amount, businessName, retryUrl, reason } = input;

  try {
    const formattedAmount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

    const reasonText = reason ? ` (${reason})` : "";

    const message = `${businessName}: Payment of ${formattedAmount} failed${reasonText}. Please update your payment method and try again: ${retryUrl}`;

    console.log(`[SMS Adapter] Sending payment failure notification to ${to}`);

    // Mock SMS send
    const messageId = `sms_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    console.error(`[SMS Adapter] Failed to send payment failure notification:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown SMS error",
    };
  }
}
