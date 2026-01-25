import { describe, it, expect } from '@jest/globals';
import { inboundResponseSchema } from '../server/agents/inbound-engagement';

describe('InboundEngagement Agent Schema', () => {
  describe('inboundResponseSchema', () => {
    it('should validate a complete inbound response', () => {
      const response = {
        customer_message: {
          send_now: true,
          channel: "sms" as const,
          to: "+15551234567",
          text: "Hi! Thanks for reaching out to Green Lawn Care. We'd love to help with your landscaping needs. What's your address so we can provide an accurate quote?",
        },
        lead_capture: {
          name: "John Smith",
          address: "123 Main St, 90210",
          service_requested: "mowing",
          urgency: "this_week",
          property_size_hint: "medium",
          preferred_contact_method: "sms",
          notes: "Customer interested in weekly mowing service",
        },
        next_action: {
          type: "ask_question",
          questions: ["What size is your lawn approximately?"],
          proposed_slots: [],
          handoff_reason: null,
        },
        confidence: 0.85,
        assumptions: ["Assuming residential property based on address format"],
      };

      const result = inboundResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customer_message.send_now).toBe(true);
        expect(result.data.lead_capture.service_requested).toBe("mowing");
        expect(result.data.confidence).toBe(0.85);
      }
    });

    it('should validate a missed call response with schedule proposal', () => {
      const response = {
        customer_message: {
          send_now: true,
          channel: "sms" as const,
          to: "+15559876543",
          text: "Hi! Sorry we missed your call at Green Lawn Care. We're closed now but would love to call you back. Would tomorrow at 9am work?",
        },
        lead_capture: {
          name: null,
          address: null,
          service_requested: "other",
          urgency: "unknown",
          property_size_hint: "unknown",
          preferred_contact_method: "call",
          notes: "Missed call after hours",
        },
        next_action: {
          type: "propose_schedule",
          questions: [],
          proposed_slots: [
            {
              start_iso: "2025-01-02T09:00:00.000Z",
              end_iso: "2025-01-02T11:00:00.000Z",
              label: "Thursday 9:00 AM",
            },
          ],
          handoff_reason: null,
        },
        confidence: 0.7,
        assumptions: ["Customer called outside business hours"],
      };

      const result = inboundResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.next_action.type).toBe("propose_schedule");
        expect(result.data.next_action.proposed_slots.length).toBe(1);
      }
    });

    it('should validate a handoff to human response', () => {
      const response = {
        customer_message: {
          send_now: true,
          channel: "sms" as const,
          to: "+15551112222",
          text: "Thank you for reaching out! Unfortunately, your area (Beverly Hills 90210) is outside our current service area. Our team will reach out if we expand.",
        },
        lead_capture: {
          name: "Jane Doe",
          address: "456 Rodeo Dr, Beverly Hills 90210",
          service_requested: "landscaping",
          urgency: "flexible",
          property_size_hint: "large",
          preferred_contact_method: "either",
          notes: "Address outside service area - ZIP 90210 not in service list",
        },
        next_action: {
          type: "handoff_to_human",
          questions: [],
          proposed_slots: [],
          handoff_reason: "Customer location outside service area",
        },
        confidence: 0.95,
        assumptions: ["ZIP code 90210 extracted from address"],
      };

      const result = inboundResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.next_action.type).toBe("handoff_to_human");
        expect(result.data.next_action.handoff_reason).toBe("Customer location outside service area");
      }
    });

    it('should reject invalid service_requested value', () => {
      const response = {
        customer_message: {
          send_now: true,
          channel: "sms" as const,
          to: "+15551234567",
          text: "Test message",
        },
        lead_capture: {
          name: null,
          address: null,
          service_requested: "invalid_service",
          urgency: "unknown",
          property_size_hint: "unknown",
          preferred_contact_method: "unknown",
          notes: "",
        },
        next_action: {
          type: "ask_question",
          questions: [],
          proposed_slots: [],
          handoff_reason: null,
        },
        confidence: 0.5,
        assumptions: [],
      };

      const result = inboundResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should reject confidence outside 0-1 range', () => {
      const response = {
        customer_message: {
          send_now: true,
          channel: "sms" as const,
          to: "+15551234567",
          text: "Test message",
        },
        lead_capture: {
          name: null,
          address: null,
          service_requested: "mowing",
          urgency: "unknown",
          property_size_hint: "unknown",
          preferred_contact_method: "unknown",
          notes: "",
        },
        next_action: {
          type: "ask_question",
          questions: [],
          proposed_slots: [],
          handoff_reason: null,
        },
        confidence: 1.5,
        assumptions: [],
      };

      const result = inboundResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should validate all valid service types', () => {
      const serviceTypes = ["mowing", "cleanup", "mulch", "landscaping", "other"];
      
      for (const service of serviceTypes) {
        const response = {
          customer_message: {
            send_now: true,
            channel: "sms" as const,
            to: "+15551234567",
            text: "Test",
          },
          lead_capture: {
            name: null,
            address: null,
            service_requested: service,
            urgency: "unknown" as const,
            property_size_hint: "unknown" as const,
            preferred_contact_method: "unknown" as const,
            notes: "",
          },
          next_action: {
            type: "ask_question" as const,
            questions: [],
            proposed_slots: [],
            handoff_reason: null,
          },
          confidence: 0.5,
          assumptions: [],
        };

        const result = inboundResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      }
    });

    it('should reject channel other than sms', () => {
      const response = {
        customer_message: {
          send_now: true,
          channel: "call",
          to: "+15551234567",
          text: "Test message",
        },
        lead_capture: {
          name: null,
          address: null,
          service_requested: "mowing" as const,
          urgency: "unknown" as const,
          property_size_hint: "unknown" as const,
          preferred_contact_method: "unknown" as const,
          notes: "",
        },
        next_action: {
          type: "ask_question" as const,
          questions: [],
          proposed_slots: [],
          handoff_reason: null,
        },
        confidence: 0.5,
        assumptions: [],
      };

      const result = inboundResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should reject text over 320 characters', () => {
      const longText = "A".repeat(321);
      const response = {
        customer_message: {
          send_now: true,
          channel: "sms" as const,
          to: "+15551234567",
          text: longText,
        },
        lead_capture: {
          name: null,
          address: null,
          service_requested: "mowing" as const,
          urgency: "unknown" as const,
          property_size_hint: "unknown" as const,
          preferred_contact_method: "unknown" as const,
          notes: "",
        },
        next_action: {
          type: "ask_question" as const,
          questions: [],
          proposed_slots: [],
          handoff_reason: null,
        },
        confidence: 0.5,
        assumptions: [],
      };

      const result = inboundResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should validate all valid urgency levels', () => {
      const urgencyLevels = ["today", "this_week", "flexible", "unknown"];
      
      for (const urgency of urgencyLevels) {
        const response = {
          customer_message: {
            send_now: true,
            channel: "sms" as const,
            to: "+15551234567",
            text: "Test",
          },
          lead_capture: {
            name: null,
            address: null,
            service_requested: "other" as const,
            urgency: urgency,
            property_size_hint: "unknown" as const,
            preferred_contact_method: "unknown" as const,
            notes: "",
          },
          next_action: {
            type: "ask_question" as const,
            questions: [],
            proposed_slots: [],
            handoff_reason: null,
          },
          confidence: 0.5,
          assumptions: [],
        };

        const result = inboundResponseSchema.safeParse(response);
        expect(result.success).toBe(true);
      }
    });
  });
});
