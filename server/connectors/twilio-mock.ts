import Twilio from "twilio";
import pRetry from "p-retry";
import { audit } from "../tools";

export interface SMSMessage {
  to: string;
  from: string;
  body: string;
}

export interface SMSResponse {
  success: boolean;
  sid?: string;
  error?: string;
}

const MAX_RETRIES = 3;

class TwilioConnector {
  private client: Twilio.Twilio | null = null;
  private isConfigured: boolean;
  private fromNumber: string;
  private accountSid: string | undefined;
  private authToken: string | undefined;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || "+15551234567";
    
    this.isConfigured = !!(this.accountSid && this.authToken && process.env.TWILIO_PHONE_NUMBER);
    
    if (this.isConfigured) {
      this.client = Twilio(this.accountSid, this.authToken);
      console.log("[Twilio] Configured with real credentials");
    } else {
      console.log("[Twilio] Running in mock mode - no credentials configured");
    }
  }

  async sendSMS(to: string, body: string): Promise<SMSResponse> {
    const logPrefix = this.isConfigured ? "[Twilio]" : "[Mock Twilio]";
    console.log(`${logPrefix} Sending SMS to ${to}: ${body.substring(0, 50)}...`);

    if (this.isConfigured && this.client) {
      try {
        const result = await pRetry(
          async () => {
            const message = await this.client!.messages.create({
              to,
              from: this.fromNumber,
              body,
            });
            return message;
          },
          {
            retries: MAX_RETRIES,
            onFailedAttempt: async (error) => {
              const errorMessage = error instanceof Error ? error.message : "Unknown error";
              console.error(`[Twilio] SMS attempt ${error.attemptNumber} failed. ${MAX_RETRIES - error.attemptNumber + 1} retries left.`, errorMessage);
              await audit.logEvent({
                action: "twilio.sendSms.retry",
                actor: "system",
                payload: {
                  to,
                  attempt: error.attemptNumber,
                  error: errorMessage,
                },
              });
            },
          }
        );

        await audit.logEvent({
          action: "twilio.sendSms.success",
          actor: "system",
          payload: { to, sid: result.sid, status: result.status },
        });

        return {
          success: true,
          sid: result.sid,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("[Twilio] SMS sending failed after all retries:", errorMessage);
        
        await audit.logEvent({
          action: "twilio.sendSms.failed",
          actor: "system",
          payload: { to, error: errorMessage },
        });

        return {
          success: false,
          error: errorMessage,
        };
      }
    }

    const mockSid = `SM${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
    
    await audit.logEvent({
      action: "twilio.sendSms.mock",
      actor: "system",
      payload: { to, sid: mockSid },
    });

    return {
      success: true,
      sid: mockSid,
    };
  }

  async receiveWebhook(payload: {
    From: string;
    To: string;
    Body: string;
    MessageSid?: string;
  }): Promise<{
    from: string;
    to: string;
    body: string;
    sid: string;
  }> {
    return {
      from: payload.From,
      to: payload.To,
      body: payload.Body,
      sid: payload.MessageSid || `SM${Date.now().toString(36)}`,
    };
  }

  validateSignature(
    signature: string | undefined,
    url: string,
    params: Record<string, string>
  ): boolean {
    if (!this.isConfigured || !this.authToken) {
      const isDev = process.env.NODE_ENV === "development";
      if (isDev) {
        console.log("[Twilio] Skipping signature validation in development mode (no credentials)");
        return true;
      }
      console.warn("[Twilio] No auth token configured, rejecting webhook");
      return false;
    }

    if (!signature) {
      console.warn("[Twilio] Missing X-Twilio-Signature header");
      return false;
    }

    const isValid = Twilio.validateRequest(this.authToken, signature, url, params);
    
    if (!isValid) {
      console.warn("[Twilio] Invalid signature");
    }

    return isValid;
  }

  getFromNumber(): string {
    return this.fromNumber;
  }

  isRealTwilioConfigured(): boolean {
    return this.isConfigured;
  }
}

export const twilioConnector = new TwilioConnector();
