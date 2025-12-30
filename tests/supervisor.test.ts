import { describe, it, expect } from '@jest/globals';
import { supervisorPlanSchema, stepSchema, classificationSchema, planBlockSchema, policyBlockSchema } from '../server/orchestrator/supervisor';
import type { SupervisorPlan, Step, Classification, PlanBlock, PolicyBlock } from '../server/orchestrator/supervisor';

describe('Supervisor Plan Validation', () => {
  describe('classificationSchema', () => {
    it('should validate a valid classification', () => {
      const classification = {
        category: 'inbound_lead',
        priority: 'high',
        reason: 'New customer inquiry',
      };

      const result = classificationSchema.safeParse(classification);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('inbound_lead');
        expect(result.data.priority).toBe('high');
      }
    });

    it('should validate all valid categories', () => {
      const categories = ['inbound_lead', 'quote_request', 'schedule_change', 'billing', 'review', 'unknown'];
      
      for (const category of categories) {
        const result = classificationSchema.safeParse({
          category,
          priority: 'normal',
          reason: 'Test reason',
        });
        expect(result.success).toBe(true);
      }
    });

    it('should validate all valid priorities', () => {
      const priorities = ['low', 'normal', 'high', 'urgent'];
      
      for (const priority of priorities) {
        const result = classificationSchema.safeParse({
          category: 'inbound_lead',
          priority,
          reason: 'Test reason',
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid category', () => {
      const result = classificationSchema.safeParse({
        category: 'invalid_category',
        priority: 'normal',
        reason: 'Test',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('stepSchema', () => {
    it('should validate a valid InboundEngagement step', () => {
      const step = {
        step_id: 'step_1',
        agent: 'InboundEngagement',
        goal: 'Qualify lead and gather customer information',
        inputs: {
          phone: '+15551234567',
          message: 'I need lawn mowing service',
        },
        requires_human_approval: false,
        approval_reason: null,
        tools_to_use: ['comms.sendSms', 'fsm.createLead'],
      };

      const result = stepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.agent).toBe('InboundEngagement');
        expect(result.data.requires_human_approval).toBe(false);
      }
    });

    it('should validate a step requiring approval', () => {
      const step = {
        step_id: 'step_2',
        agent: 'Scheduling',
        goal: 'Book job for customer',
        inputs: {
          serviceType: 'Mowing',
          proposedDate: '2025-01-15T10:00:00Z',
        },
        requires_human_approval: true,
        approval_reason: 'Job booking requires approval per tier policy',
        tools_to_use: ['fsm.getAvailability', 'fsm.createJob', 'approvals.requestApproval'],
      };

      const result = stepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requires_human_approval).toBe(true);
        expect(result.data.approval_reason).toBe('Job booking requires approval per tier policy');
      }
    });

    it('should reject invalid agent type', () => {
      const step = {
        step_id: 'step_1',
        agent: 'InvalidAgent',
        goal: 'Do something',
        inputs: {},
        requires_human_approval: false,
        approval_reason: null,
        tools_to_use: [],
      };

      const result = stepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const step = {
        step_id: 'step_1',
        agent: 'InboundEngagement',
      };

      const result = stepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should validate all valid agent types', () => {
      const agents = ['InboundEngagement', 'Quoting', 'Scheduling', 'Billing', 'Reviews'];
      
      for (const agent of agents) {
        const result = stepSchema.safeParse({
          step_id: 'step_1',
          agent,
          goal: 'Test goal',
          inputs: {},
          requires_human_approval: false,
          approval_reason: null,
          tools_to_use: [],
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('policyBlockSchema', () => {
    it('should validate all valid tiers', () => {
      const tiers = ['Owner', 'SMB', 'Commercial'];
      
      for (const tier of tiers) {
        const result = policyBlockSchema.safeParse({
          tier,
          confidence_threshold: 0.85,
          notes: 'Test notes',
        });
        expect(result.success).toBe(true);
      }
    });

    it('should validate confidence thresholds', () => {
      const result = policyBlockSchema.safeParse({
        tier: 'Commercial',
        confidence_threshold: 0.90,
        notes: 'High confidence required for Commercial tier',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confidence_threshold).toBe(0.90);
      }
    });
  });

  describe('supervisorPlanSchema', () => {
    it('should validate a valid supervisor plan', () => {
      const plan = {
        event_id: 'evt_123',
        classification: {
          category: 'inbound_lead',
          priority: 'high',
          reason: 'Missed call requires immediate response',
        },
        plan: {
          steps: [
            {
              step_id: 'evt_123_step_1',
              agent: 'InboundEngagement',
              goal: 'Send missed call auto-response and create lead',
              inputs: { phone: '+15551234567' },
              requires_human_approval: false,
              approval_reason: null,
              tools_to_use: ['comms.sendSms', 'fsm.createLead'],
            },
          ],
          stop_conditions: ['Customer declines service', 'Address outside service area'],
        },
        policy: {
          tier: 'Owner',
          confidence_threshold: 0.85,
          notes: 'Owner tier - approval required for quotes and scheduling',
        },
      };

      const result = supervisorPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.event_id).toBe('evt_123');
        expect(result.data.classification.category).toBe('inbound_lead');
        expect(result.data.plan.steps.length).toBe(1);
        expect(result.data.policy.tier).toBe('Owner');
      }
    });

    it('should validate a multi-step plan', () => {
      const plan = {
        event_id: 'evt_456',
        classification: {
          category: 'quote_request',
          priority: 'normal',
          reason: 'Customer requesting service quote',
        },
        plan: {
          steps: [
            {
              step_id: 'evt_456_step_1',
              agent: 'InboundEngagement',
              goal: 'Gather service requirements',
              inputs: { phone: '+15551234567', message: 'Need quote for lawn care' },
              requires_human_approval: false,
              approval_reason: null,
              tools_to_use: ['comms.logInbound'],
            },
            {
              step_id: 'evt_456_step_2',
              agent: 'Quoting',
              goal: 'Generate and send quote',
              inputs: { serviceType: 'Lawn mowing' },
              requires_human_approval: true,
              approval_reason: 'Quote requires approval per tier policy',
              tools_to_use: ['comms.sendSms', 'approvals.requestApproval'],
            },
          ],
          stop_conditions: ['Awaiting human approval'],
        },
        policy: {
          tier: 'SMB',
          confidence_threshold: 0.85,
          notes: 'SMB tier allows auto-quotes but requires approval for booking',
        },
      };

      const result = supervisorPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.plan.steps.length).toBe(2);
        expect(result.data.plan.steps[1].requires_human_approval).toBe(true);
      }
    });

    it('should reject plan with missing classification', () => {
      const plan = {
        event_id: 'evt_123',
        plan: {
          steps: [],
          stop_conditions: [],
        },
        policy: {
          tier: 'Owner',
          confidence_threshold: 0.85,
          notes: 'Test',
        },
      };

      const result = supervisorPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('should reject plan with invalid policy tier', () => {
      const plan = {
        event_id: 'evt_123',
        classification: {
          category: 'inbound_lead',
          priority: 'normal',
          reason: 'Test',
        },
        plan: {
          steps: [],
          stop_conditions: [],
        },
        policy: {
          tier: 'Enterprise',
          confidence_threshold: 0.85,
          notes: 'Invalid tier',
        },
      };

      const result = supervisorPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('should validate Commercial tier with high confidence threshold', () => {
      const plan = {
        event_id: 'evt_789',
        classification: {
          category: 'schedule_change',
          priority: 'urgent',
          reason: 'Customer needs to reschedule',
        },
        plan: {
          steps: [
            {
              step_id: 'evt_789_step_1',
              agent: 'Scheduling',
              goal: 'Auto-book new slot within policy thresholds',
              inputs: { jobId: 123 },
              requires_human_approval: false,
              approval_reason: null,
              tools_to_use: ['fsm.getAvailability', 'fsm.createJob'],
            },
          ],
          stop_conditions: ['No available slots', 'Outside service hours'],
        },
        policy: {
          tier: 'Commercial',
          confidence_threshold: 0.90,
          notes: 'Commercial tier allows auto-booking for high-confidence opportunities',
        },
      };

      const result = supervisorPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.policy.tier).toBe('Commercial');
        expect(result.data.policy.confidence_threshold).toBe(0.90);
        expect(result.data.plan.steps[0].requires_human_approval).toBe(false);
      }
    });
  });
});
