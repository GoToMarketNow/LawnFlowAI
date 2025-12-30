import { describe, it, expect } from '@jest/globals';
import { billingActionSchema } from '../server/agents/billing';

describe('Billing Agent Schema', () => {
  describe('billingActionSchema', () => {
    it('should validate SMS reminder action', () => {
      const action = {
        message: {
          channel: "sms",
          to: "+15551234567",
          text: "Hi John, this is GreenScape Lawns. Your invoice for $150.00 is due. Please let us know if you have any questions.",
        },
        action: {
          type: "send_reminder",
          payment_link: null,
          next_followup_in_days: 7,
        },
        confidence: 0.85,
        assumptions: ["Customer prefers SMS", "First reminder"],
      };

      const result = billingActionSchema.safeParse(action);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message.channel).toBe("sms");
        expect(result.data.action.type).toBe("send_reminder");
      }
    });

    it('should validate email with payment link action', () => {
      const action = {
        message: {
          channel: "email",
          to: "john@example.com",
          text: "Hi John, your invoice for $250.00 is 5 days overdue. Pay easily online at https://pay.greenscape.com/inv/123",
        },
        action: {
          type: "offer_payment_link",
          payment_link: "https://pay.greenscape.com/inv/123",
          next_followup_in_days: 3,
        },
        confidence: 0.9,
        assumptions: ["Email is preferred for payment links"],
      };

      const result = billingActionSchema.safeParse(action);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action.type).toBe("offer_payment_link");
        expect(result.data.action.payment_link).toBe("https://pay.greenscape.com/inv/123");
      }
    });

    it('should validate handoff to human action', () => {
      const action = {
        message: {
          channel: "email",
          to: "admin@greenscape.com",
          text: "Billing case for John Smith requires human review.",
        },
        action: {
          type: "handoff_to_human",
          payment_link: null,
          next_followup_in_days: 0,
        },
        confidence: 1.0,
        assumptions: ["Invoice is disputed - requires human review"],
      };

      const result = billingActionSchema.safeParse(action);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action.type).toBe("handoff_to_human");
        expect(result.data.action.next_followup_in_days).toBe(0);
      }
    });

    it('should reject invalid channel', () => {
      const action = {
        message: {
          channel: "phone",
          to: "+15551234567",
          text: "Test message",
        },
        action: {
          type: "send_reminder",
          payment_link: null,
          next_followup_in_days: 7,
        },
        confidence: 0.8,
        assumptions: [],
      };

      const result = billingActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should reject invalid action type', () => {
      const action = {
        message: {
          channel: "sms",
          to: "+15551234567",
          text: "Test message",
        },
        action: {
          type: "send_warning",
          payment_link: null,
          next_followup_in_days: 7,
        },
        confidence: 0.8,
        assumptions: [],
      };

      const result = billingActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should reject confidence outside 0-1 range', () => {
      const action = {
        message: {
          channel: "sms",
          to: "+15551234567",
          text: "Test message",
        },
        action: {
          type: "send_reminder",
          payment_link: null,
          next_followup_in_days: 7,
        },
        confidence: 1.5,
        assumptions: [],
      };

      const result = billingActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should reject negative next_followup_in_days', () => {
      const action = {
        message: {
          channel: "sms",
          to: "+15551234567",
          text: "Test message",
        },
        action: {
          type: "send_reminder",
          payment_link: null,
          next_followup_in_days: -1,
        },
        confidence: 0.8,
        assumptions: [],
      };

      const result = billingActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should reject next_followup_in_days over 30', () => {
      const action = {
        message: {
          channel: "sms",
          to: "+15551234567",
          text: "Test message",
        },
        action: {
          type: "send_reminder",
          payment_link: null,
          next_followup_in_days: 45,
        },
        confidence: 0.8,
        assumptions: [],
      };

      const result = billingActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should reject empty message text', () => {
      const action = {
        message: {
          channel: "sms",
          to: "+15551234567",
          text: "",
        },
        action: {
          type: "send_reminder",
          payment_link: null,
          next_followup_in_days: 7,
        },
        confidence: 0.8,
        assumptions: [],
      };

      const result = billingActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should reject empty recipient', () => {
      const action = {
        message: {
          channel: "sms",
          to: "",
          text: "Test message",
        },
        action: {
          type: "send_reminder",
          payment_link: null,
          next_followup_in_days: 7,
        },
        confidence: 0.8,
        assumptions: [],
      };

      const result = billingActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should accept message up to 500 characters', () => {
      const longMessage = "A".repeat(500);
      const action = {
        message: {
          channel: "email",
          to: "test@example.com",
          text: longMessage,
        },
        action: {
          type: "send_reminder",
          payment_link: null,
          next_followup_in_days: 7,
        },
        confidence: 0.8,
        assumptions: [],
      };

      const result = billingActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('should reject message over 500 characters', () => {
      const tooLongMessage = "A".repeat(501);
      const action = {
        message: {
          channel: "email",
          to: "test@example.com",
          text: tooLongMessage,
        },
        action: {
          type: "send_reminder",
          payment_link: null,
          next_followup_in_days: 7,
        },
        confidence: 0.8,
        assumptions: [],
      };

      const result = billingActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });
  });
});
