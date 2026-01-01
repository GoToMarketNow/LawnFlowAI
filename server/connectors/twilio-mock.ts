// Twilio Connector - Uses Replit Twilio Integration with fallback to env vars
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

interface TwilioCredentials {
  accountSid: string;
  apiKey?: string;
  apiKeySecret?: string;
  authToken?: string;
  phoneNumber?: string;
  useApiKey: boolean;
}

const MAX_RETRIES = 3;

// Cache for credentials and client
let cachedCredentials: TwilioCredentials | null = null;
let cachedClient: Twilio.Twilio | null = null;
let credentialsFetchedAt: number = 0;
const CREDENTIALS_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCredentialsFromReplitIntegration(): Promise<TwilioCredentials | null> {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY
      ? "repl " + process.env.REPL_IDENTITY
      : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

    if (!xReplitToken || !hostname) {
      return null;
    }

    const response = await fetch(
      "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=twilio",
      {
        headers: {
          Accept: "application/json",
          X_REPLIT_TOKEN: xReplitToken,
        },
      }
    );

    const data = await response.json();
    const connectionSettings = data.items?.[0];

    // Check if connected and has valid credentials
    if (
      !connectionSettings ||
      connectionSettings.status === "disconnected" ||
      !connectionSettings.settings?.account_sid
    ) {
      return null;
    }

    // Verify API key looks valid (should start with SK)
    const apiKey = connectionSettings.settings.api_key;
    if (!apiKey || !apiKey.startsWith("SK")) {
      console.log("[Twilio] Replit integration API key appears invalid, will try fallback");
      return null;
    }

    return {
      accountSid: connectionSettings.settings.account_sid,
      apiKey: apiKey,
      apiKeySecret: connectionSettings.settings.api_key_secret,
      phoneNumber: connectionSettings.settings.phone_number,
      useApiKey: true,
    };
  } catch (error) {
    console.log("[Twilio] Failed to get credentials from Replit integration:", error);
    return null;
  }
}

function getCredentialsFromEnv(): TwilioCredentials | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  // Prefer API Key authentication if available (more secure)
  if (accountSid && apiKey && apiKeySecret && apiKey.startsWith("SK")) {
    console.log("[Twilio] Using API Key authentication from environment");
    return {
      accountSid,
      apiKey,
      apiKeySecret,
      phoneNumber,
      useApiKey: true,
    };
  }

  // Fall back to Auth Token authentication
  if (accountSid && authToken) {
    return {
      accountSid,
      authToken,
      phoneNumber,
      useApiKey: false,
    };
  }

  return null;
}

async function getCredentials(): Promise<TwilioCredentials> {
  // Return cached credentials if still valid
  if (cachedCredentials && Date.now() - credentialsFetchedAt < CREDENTIALS_TTL_MS) {
    return cachedCredentials;
  }

  // Try Replit integration first
  const replitCreds = await getCredentialsFromReplitIntegration();
  if (replitCreds) {
    console.log("[Twilio] Using Replit Twilio Integration");
    cachedCredentials = replitCreds;
    credentialsFetchedAt = Date.now();
    cachedClient = null; // Reset client to use new credentials
    return replitCreds;
  }

  // Fall back to environment variables
  const envCreds = getCredentialsFromEnv();
  if (envCreds) {
    console.log("[Twilio] Using environment variable credentials");
    cachedCredentials = envCreds;
    credentialsFetchedAt = Date.now();
    cachedClient = null; // Reset client to use new credentials
    return envCreds;
  }

  throw new Error("Twilio not configured - no valid credentials found");
}

async function getTwilioClient(): Promise<Twilio.Twilio> {
  if (cachedClient && cachedCredentials && Date.now() - credentialsFetchedAt < CREDENTIALS_TTL_MS) {
    return cachedClient;
  }

  const creds = await getCredentials();
  
  if (creds.useApiKey && creds.apiKey && creds.apiKeySecret) {
    cachedClient = Twilio(creds.apiKey, creds.apiKeySecret, { accountSid: creds.accountSid });
  } else if (creds.authToken) {
    cachedClient = Twilio(creds.accountSid, creds.authToken);
  } else {
    throw new Error("Invalid Twilio credentials configuration");
  }
  
  return cachedClient;
}

async function getTwilioFromPhoneNumber(): Promise<string | undefined> {
  const creds = await getCredentials();
  return creds.phoneNumber;
}

class TwilioConnector {
  private messagingServiceSid: string | undefined;
  private legacyFromNumber: string;

  constructor() {
    // Messaging Service SID from env (for OTP delivery)
    this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    this.legacyFromNumber = process.env.TWILIO_PHONE_NUMBER || "+15551234567";
    
    console.log("[Twilio] Connector initialized (will use Replit integration or env vars)");
  }

  private async getFromNumber(): Promise<string> {
    try {
      const phoneNumber = await getTwilioFromPhoneNumber();
      return phoneNumber || this.legacyFromNumber;
    } catch {
      return this.legacyFromNumber;
    }
  }

  async sendSMS(to: string, body: string): Promise<SMSResponse> {
    console.log(`[Twilio] Sending SMS to ${to}: ${body.substring(0, 50)}...`);

    try {
      const client = await getTwilioClient();
      const fromNumber = await this.getFromNumber();

      const result = await pRetry(
        async () => {
          const message = await client.messages.create({
            to,
            from: fromNumber,
            body,
          });
          return message;
        },
        {
          retries: MAX_RETRIES,
          onFailedAttempt: async (error) => {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error(
              `[Twilio] SMS attempt ${error.attemptNumber} failed. ${MAX_RETRIES - error.attemptNumber + 1} retries left.`,
              errorMessage
            );
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
      console.error("[Twilio] SMS sending failed:", errorMessage);

      await audit.logEvent({
        action: "twilio.sendSms.failed",
        actor: "system",
        payload: { to, error: errorMessage },
      });

      // Fallback to mock mode if credentials not available
      if (errorMessage.includes("not configured") || errorMessage.includes("not available")) {
        const mockSid = `SM${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
        console.log("[Mock Twilio] Falling back to mock mode");

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

      return {
        success: false,
        error: errorMessage,
      };
    }
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

  async validateSignature(
    signature: string | undefined,
    url: string,
    params: Record<string, string>
  ): Promise<boolean> {
    try {
      const creds = await getCredentials();
      const secret = creds.useApiKey ? creds.apiKeySecret : creds.authToken;
      
      if (!secret) {
        throw new Error("No secret available for validation");
      }
      
      if (!signature) {
        console.warn("[Twilio] Missing X-Twilio-Signature header");
        return false;
      }

      const isValid = Twilio.validateRequest(secret, signature, url, params);

      if (!isValid) {
        console.warn("[Twilio] Invalid signature");
      }

      return isValid;
    } catch (error) {
      const isDev = process.env.NODE_ENV === "development";
      if (isDev) {
        console.log("[Twilio] Skipping signature validation in development mode");
        return true;
      }
      console.warn("[Twilio] Failed to validate signature:", error);
      return false;
    }
  }

  async isRealTwilioConfigured(): Promise<boolean> {
    try {
      await getCredentials();
      return true;
    } catch {
      return false;
    }
  }

  isMessagingServiceReady(): boolean {
    return !!this.messagingServiceSid;
  }

  async sendOtpSMS(to: string, otp: string): Promise<SMSResponse> {
    const body = `Your LawnFlow verification code is ${otp}. It expires in 10 minutes.`;
    const maskedTo = to.slice(0, -4).replace(/\d/g, "*") + to.slice(-4);

    console.log(`[Twilio OTP] Sending OTP to ${maskedTo}`);

    try {
      const client = await getTwilioClient();

      const result = await pRetry(
        async () => {
          // Prefer Messaging Service SID if configured, otherwise use from number
          if (this.messagingServiceSid) {
            const message = await client.messages.create({
              to,
              messagingServiceSid: this.messagingServiceSid,
              body,
            });
            return message;
          } else {
            const fromNumber = await this.getFromNumber();
            const message = await client.messages.create({
              to,
              from: fromNumber,
              body,
            });
            return message;
          }
        },
        {
          retries: MAX_RETRIES,
          onFailedAttempt: async (error) => {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error(
              `[Twilio OTP] Attempt ${error.attemptNumber} failed. ${MAX_RETRIES - error.attemptNumber + 1} retries left.`
            );
            await audit.logEvent({
              action: "twilio.sendOtp.retry",
              actor: "system",
              payload: {
                to: maskedTo,
                attempt: error.attemptNumber,
                error: errorMessage,
              },
            });
          },
        }
      );

      console.log(`[Twilio OTP] Sent successfully, SID: ${result.sid}`);

      await audit.logEvent({
        action: "twilio.sendOtp.success",
        actor: "system",
        payload: { to: maskedTo, sid: result.sid, status: result.status },
      });

      return {
        success: true,
        sid: result.sid,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[Twilio OTP] Failed:", errorMessage);

      await audit.logEvent({
        action: "twilio.sendOtp.failed",
        actor: "system",
        payload: { to: maskedTo, error: errorMessage },
      });

      // Fallback to mock mode if credentials not available
      if (errorMessage.includes("not configured") || errorMessage.includes("not available")) {
        const mockSid = `SMOTP${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
        console.log(`[Mock Twilio OTP] Would send to ${maskedTo}: ${body}`);

        await audit.logEvent({
          action: "twilio.sendOtp.mock",
          actor: "system",
          payload: { to: maskedTo, sid: mockSid },
        });

        return {
          success: true,
          sid: mockSid,
        };
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

export const twilioConnector = new TwilioConnector();
