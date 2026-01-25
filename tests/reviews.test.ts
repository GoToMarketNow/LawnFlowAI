import { describe, it, expect } from '@jest/globals';
import { reviewActionSchema } from '../server/agents/reviews';

describe('Reviews Agent Schema', () => {
  describe('reviewActionSchema', () => {
    it('should validate SMS review request', () => {
      const action = {
        send_request: true,
        customer_message: {
          channel: "sms",
          to: "+15551234567",
          text: "Hi John! Thanks for choosing GreenScape. We'd love your feedback: https://g.page/greenscape",
        },
        escalation: {
          should_escalate: false,
          reason: null,
          summary: null,
        },
        confidence: 0.9,
      };

      const result = reviewActionSchema.safeParse(action);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.send_request).toBe(true);
        expect(result.data.customer_message.channel).toBe("sms");
        expect(result.data.escalation.should_escalate).toBe(false);
      }
    });

    it('should reject email channel (only sms allowed)', () => {
      const action = {
        send_request: true,
        customer_message: {
          channel: "email",
          to: "john@example.com",
          text: "Hi John, Thank you for choosing GreenScape! We hope your lawn looks great. We'd appreciate a review: https://g.page/greenscape",
        },
        escalation: {
          should_escalate: false,
          reason: null,
          summary: null,
        },
        confidence: 0.85,
      };

      const result = reviewActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should validate escalation for negative sentiment', () => {
      const action = {
        send_request: false,
        customer_message: {
          channel: "sms",
          to: "+15551234567",
          text: "N/A",
        },
        escalation: {
          should_escalate: true,
          reason: "Customer filed a complaint about missed spots",
          summary: "Customer John Smith (Job #123) requires follow-up before review request.",
        },
        confidence: 1.0,
      };

      const result = reviewActionSchema.safeParse(action);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.send_request).toBe(false);
        expect(result.data.escalation.should_escalate).toBe(true);
        expect(result.data.escalation.reason).toContain("complaint");
      }
    });

    it('should validate escalation for low job rating', () => {
      const action = {
        send_request: false,
        customer_message: {
          channel: "sms",
          to: "+15551234567",
          text: "N/A",
        },
        escalation: {
          should_escalate: true,
          reason: "Low job rating: 2/5",
          summary: "Customer requires follow-up due to low satisfaction score.",
        },
        confidence: 1.0,
      };

      const result = reviewActionSchema.safeParse(action);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.escalation.reason).toContain("Low job rating");
      }
    });

    it('should reject invalid channel', () => {
      const action = {
        send_request: true,
        customer_message: {
          channel: "whatsapp",
          to: "+15551234567",
          text: "Test message",
        },
        escalation: {
          should_escalate: false,
          reason: null,
          summary: null,
        },
        confidence: 0.8,
      };

      const result = reviewActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should reject confidence outside 0-1 range', () => {
      const action = {
        send_request: true,
        customer_message: {
          channel: "sms",
          to: "+15551234567",
          text: "Test message",
        },
        escalation: {
          should_escalate: false,
          reason: null,
          summary: null,
        },
        confidence: 1.5,
      };

      const result = reviewActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should reject empty message text', () => {
      const action = {
        send_request: true,
        customer_message: {
          channel: "sms",
          to: "+15551234567",
          text: "",
        },
        escalation: {
          should_escalate: false,
          reason: null,
          summary: null,
        },
        confidence: 0.8,
      };

      const result = reviewActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should reject empty recipient', () => {
      const action = {
        send_request: true,
        customer_message: {
          channel: "sms",
          to: "",
          text: "Test message",
        },
        escalation: {
          should_escalate: false,
          reason: null,
          summary: null,
        },
        confidence: 0.8,
      };

      const result = reviewActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should reject message over 320 characters', () => {
      const action = {
        send_request: true,
        customer_message: {
          channel: "sms",
          to: "+15551234567",
          text: "A".repeat(321),
        },
        escalation: {
          should_escalate: false,
          reason: null,
          summary: null,
        },
        confidence: 0.8,
      };

      const result = reviewActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should accept message at exactly 320 characters', () => {
      const action = {
        send_request: true,
        customer_message: {
          channel: "sms",
          to: "+15551234567",
          text: "A".repeat(320),
        },
        escalation: {
          should_escalate: false,
          reason: null,
          summary: null,
        },
        confidence: 0.8,
      };

      const result = reviewActionSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('should reject missing escalation object', () => {
      const action = {
        send_request: true,
        customer_message: {
          channel: "sms",
          to: "+15551234567",
          text: "Test message",
        },
        confidence: 0.8,
      };

      const result = reviewActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });

    it('should reject negative confidence', () => {
      const action = {
        send_request: true,
        customer_message: {
          channel: "sms",
          to: "+15551234567",
          text: "Test message",
        },
        escalation: {
          should_escalate: false,
          reason: null,
          summary: null,
        },
        confidence: -0.5,
      };

      const result = reviewActionSchema.safeParse(action);
      expect(result.success).toBe(false);
    });
  });
});
