import { describe, it, expect } from '@jest/globals';
import { schedulePlanSchema, escalationPlanSchema } from '../server/agents/scheduling';

describe('Scheduling Agent Schema', () => {
  describe('schedulePlanSchema', () => {
    it('should validate a complete schedule with 3 slots', () => {
      const plan = {
        proposal: {
          proposed_slots: [
            { start_iso: "2025-01-15T09:00:00Z", end_iso: "2025-01-15T11:00:00Z", label: "Wed, Jan 15, 9:00 AM" },
            { start_iso: "2025-01-16T13:00:00Z", end_iso: "2025-01-16T15:00:00Z", label: "Thu, Jan 16, 1:00 PM" },
            { start_iso: "2025-01-17T10:00:00Z", end_iso: "2025-01-17T12:00:00Z", label: "Fri, Jan 17, 10:00 AM" },
          ],
          notes_for_customer: "All slots include travel time to your location.",
        },
        booking: {
          should_book_now: false,
          requires_human_approval: true,
          approval_reason: "SMB tier requires approval for job bookings",
          fsm_create_job_payload: {
            leadId: 123,
            start_iso: "2025-01-15T09:00:00Z",
            end_iso: "2025-01-15T11:00:00Z",
            service_type: "mowing",
            crew_id: "crew-1",
          },
        },
        customer_message: {
          recommended_text: "Hi John! We have availability for mowing: Wed 9AM, Thu 1PM, or Fri 10AM. Which works best?",
        },
        confidence: 0.85,
        assumptions: ["Standard 2-hour service duration", "Customer is flexible on exact time"],
      };

      const result = schedulePlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.proposal.proposed_slots.length).toBe(3);
        expect(result.data.booking.requires_human_approval).toBe(true);
      }
    });

    it('should validate auto-booking for Commercial tier with 2 slots', () => {
      const plan = {
        proposal: {
          proposed_slots: [
            { start_iso: "2025-01-15T08:00:00Z", end_iso: "2025-01-15T10:00:00Z", label: "Wed, Jan 15, 8:00 AM" },
            { start_iso: "2025-01-16T08:00:00Z", end_iso: "2025-01-16T10:00:00Z", label: "Thu, Jan 16, 8:00 AM" },
          ],
          notes_for_customer: "",
        },
        booking: {
          should_book_now: true,
          requires_human_approval: false,
          approval_reason: null,
          fsm_create_job_payload: {
            leadId: 456,
            start_iso: "2025-01-15T08:00:00Z",
            end_iso: "2025-01-15T10:00:00Z",
            service_type: "cleanup",
            crew_id: "crew-2",
          },
        },
        customer_message: {
          recommended_text: "Great news! We've booked your cleanup for Wednesday at 8AM. See you then!",
        },
        confidence: 0.95,
        assumptions: [],
      };

      const result = schedulePlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.proposal.proposed_slots.length).toBe(2);
        expect(result.data.booking.should_book_now).toBe(true);
        expect(result.data.booking.requires_human_approval).toBe(false);
      }
    });

    it('should validate schedule with exactly 2 slots (minimum)', () => {
      const plan = {
        proposal: {
          proposed_slots: [
            { start_iso: "2025-01-20T09:00:00Z", end_iso: "2025-01-20T11:00:00Z", label: "Mon, Jan 20, 9:00 AM" },
            { start_iso: "2025-01-21T14:00:00Z", end_iso: "2025-01-21T16:00:00Z", label: "Tue, Jan 21, 2:00 PM" },
          ],
          notes_for_customer: "Morning slot is our first availability.",
        },
        booking: {
          should_book_now: false,
          requires_human_approval: true,
          approval_reason: "Owner tier requires approval for all job bookings",
          fsm_create_job_payload: { leadId: 789, status: "pending" },
        },
        customer_message: {
          recommended_text: "Hi! We can come out Monday morning or Tuesday afternoon. Let me know what works!",
        },
        confidence: 0.8,
        assumptions: ["First slot is preferred"],
      };

      const result = schedulePlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.proposal.proposed_slots.length).toBe(2);
      }
    });

    it('should reject schedule with only 1 slot (below minimum)', () => {
      const plan = {
        proposal: {
          proposed_slots: [
            { start_iso: "2025-01-15T09:00:00Z", end_iso: "2025-01-15T11:00:00Z", label: "Slot 1" },
          ],
          notes_for_customer: "",
        },
        booking: {
          should_book_now: false,
          requires_human_approval: true,
          approval_reason: "test",
          fsm_create_job_payload: {},
        },
        customer_message: {
          recommended_text: "Test",
        },
        confidence: 0.5,
        assumptions: [],
      };

      const result = schedulePlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('should reject schedule with no slots', () => {
      const plan = {
        proposal: {
          proposed_slots: [],
          notes_for_customer: "No availability",
        },
        booking: {
          should_book_now: false,
          requires_human_approval: true,
          approval_reason: "No slots",
          fsm_create_job_payload: {},
        },
        customer_message: {
          recommended_text: "Test",
        },
        confidence: 0.5,
        assumptions: [],
      };

      const result = schedulePlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('should reject schedule with more than 3 slots', () => {
      const plan = {
        proposal: {
          proposed_slots: [
            { start_iso: "2025-01-15T09:00:00Z", end_iso: "2025-01-15T11:00:00Z", label: "Slot 1" },
            { start_iso: "2025-01-16T09:00:00Z", end_iso: "2025-01-16T11:00:00Z", label: "Slot 2" },
            { start_iso: "2025-01-17T09:00:00Z", end_iso: "2025-01-17T11:00:00Z", label: "Slot 3" },
            { start_iso: "2025-01-18T09:00:00Z", end_iso: "2025-01-18T11:00:00Z", label: "Slot 4" },
          ],
          notes_for_customer: "",
        },
        booking: {
          should_book_now: false,
          requires_human_approval: true,
          approval_reason: "test",
          fsm_create_job_payload: {},
        },
        customer_message: {
          recommended_text: "Test",
        },
        confidence: 0.5,
        assumptions: [],
      };

      const result = schedulePlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('should reject confidence outside 0-1 range', () => {
      const plan = {
        proposal: {
          proposed_slots: [
            { start_iso: "2025-01-15T09:00:00Z", end_iso: "2025-01-15T11:00:00Z", label: "Slot 1" },
            { start_iso: "2025-01-16T09:00:00Z", end_iso: "2025-01-16T11:00:00Z", label: "Slot 2" },
          ],
          notes_for_customer: "",
        },
        booking: {
          should_book_now: false,
          requires_human_approval: true,
          approval_reason: "test",
          fsm_create_job_payload: {},
        },
        customer_message: {
          recommended_text: "Test",
        },
        confidence: 1.5,
        assumptions: [],
      };

      const result = schedulePlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('should reject missing fsm_create_job_payload', () => {
      const plan = {
        proposal: {
          proposed_slots: [
            { start_iso: "2025-01-15T09:00:00Z", end_iso: "2025-01-15T11:00:00Z", label: "Slot 1" },
            { start_iso: "2025-01-16T09:00:00Z", end_iso: "2025-01-16T11:00:00Z", label: "Slot 2" },
          ],
          notes_for_customer: "",
        },
        booking: {
          should_book_now: false,
          requires_human_approval: true,
          approval_reason: "test",
        },
        customer_message: {
          recommended_text: "Test",
        },
        confidence: 0.5,
        assumptions: [],
      };

      const result = schedulePlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('should reject missing slot label', () => {
      const plan = {
        proposal: {
          proposed_slots: [
            { start_iso: "2025-01-15T09:00:00Z", end_iso: "2025-01-15T11:00:00Z" },
            { start_iso: "2025-01-16T09:00:00Z", end_iso: "2025-01-16T11:00:00Z", label: "Slot 2" },
          ],
          notes_for_customer: "",
        },
        booking: {
          should_book_now: false,
          requires_human_approval: true,
          approval_reason: "test",
          fsm_create_job_payload: {},
        },
        customer_message: {
          recommended_text: "Test",
        },
        confidence: 0.5,
        assumptions: [],
      };

      const result = schedulePlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });
  });

  describe('escalationPlanSchema', () => {
    it('should validate escalation for no availability', () => {
      const plan = {
        escalation_required: true,
        reason: "No crew availability found in the requested timeframe",
        customer_message: {
          recommended_text: "We're checking our crew schedules and will get back to you shortly.",
        },
        booking: {
          should_book_now: false,
          requires_human_approval: true,
          approval_reason: "Manual scheduling required - insufficient available slots",
          fsm_create_job_payload: { leadId: 100, status: "pending_availability" },
        },
        confidence: 0.3,
        assumptions: ["No crew availability found in the requested timeframe"],
      };

      const result = escalationPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.escalation_required).toBe(true);
        expect(result.data.booking.requires_human_approval).toBe(true);
      }
    });

    it('should validate escalation for insufficient slots', () => {
      const plan = {
        escalation_required: true,
        reason: "Insufficient availability - only 1 slot found, need 2-3 options",
        customer_message: {
          recommended_text: "Hi John! We're checking availability and will get back to you.",
        },
        booking: {
          should_book_now: false,
          requires_human_approval: true,
          approval_reason: "Manual scheduling required - insufficient available slots",
          fsm_create_job_payload: { leadId: 200, status: "pending_availability" },
        },
        confidence: 0.3,
        assumptions: ["Insufficient availability - only 1 slot found, need 2-3 options"],
      };

      const result = escalationPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
    });

    it('should reject escalation with should_book_now=true', () => {
      const plan = {
        escalation_required: true,
        reason: "Test escalation",
        customer_message: {
          recommended_text: "Test",
        },
        booking: {
          should_book_now: true,
          requires_human_approval: true,
          approval_reason: "test",
          fsm_create_job_payload: {},
        },
        confidence: 0.3,
        assumptions: [],
      };

      const result = escalationPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('should reject escalation with requires_human_approval=false', () => {
      const plan = {
        escalation_required: true,
        reason: "Test escalation",
        customer_message: {
          recommended_text: "Test",
        },
        booking: {
          should_book_now: false,
          requires_human_approval: false,
          approval_reason: "test",
          fsm_create_job_payload: {},
        },
        confidence: 0.3,
        assumptions: [],
      };

      const result = escalationPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('should reject escalation_required=false', () => {
      const plan = {
        escalation_required: false,
        reason: "Test",
        customer_message: {
          recommended_text: "Test",
        },
        booking: {
          should_book_now: false,
          requires_human_approval: true,
          approval_reason: "test",
          fsm_create_job_payload: {},
        },
        confidence: 0.3,
        assumptions: [],
      };

      const result = escalationPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });
  });
});
