// Mock Twilio Connector
// This simulates Twilio SMS functionality without requiring actual credentials.
// Replace with real Twilio client when credentials are configured.

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

class MockTwilioConnector {
  private isConfigured: boolean;
  private fromNumber: string;

  constructor() {
    this.isConfigured = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    );
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || "+15551234567";
  }

  async sendSMS(to: string, body: string): Promise<SMSResponse> {
    console.log(`[Mock Twilio] Sending SMS to ${to}: ${body.substring(0, 50)}...`);

    if (this.isConfigured) {
      // TODO: Implement real Twilio sending when configured
      // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // const message = await client.messages.create({ to, from: this.fromNumber, body });
      // return { success: true, sid: message.sid };
    }

    // Mock response - simulate successful send
    const mockSid = `SM${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
    
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

  getFromNumber(): string {
    return this.fromNumber;
  }

  isRealTwilioConfigured(): boolean {
    return this.isConfigured;
  }
}

export const twilioConnector = new MockTwilioConnector();
