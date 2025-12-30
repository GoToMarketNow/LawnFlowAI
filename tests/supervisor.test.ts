import { describe, it, expect } from '@jest/globals';
import { supervisorPlanSchema, stepSchema } from '../server/orchestrator/supervisor';
import type { SupervisorPlan, Step } from '../server/orchestrator/supervisor';

describe('Supervisor Plan Validation', () => {
  describe('stepSchema', () => {
    it('should validate a valid intake step', () => {
      const step = {
        stepId: 'step_1',
        agent: 'intake',
        action: 'Send missed call auto-response',
        inputs: { phone: '+15551234567', businessName: 'Test Co' },
        requiresApproval: false,
        toolCalls: [
          { tool: 'comms.sendSms', args: { to: '+15551234567', text: 'Hello' } },
        ],
      };

      const result = stepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.agent).toBe('intake');
        expect(result.data.requiresApproval).toBe(false);
      }
    });

    it('should validate a step requiring approval', () => {
      const step = {
        stepId: 'step_2',
        agent: 'schedule',
        action: 'Book appointment',
        inputs: { leadId: 'lead_123' },
        requiresApproval: true,
        approvalType: 'book_job',
        toolCalls: [],
      };

      const result = stepSchema.safeParse(step);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiresApproval).toBe(true);
        expect(result.data.approvalType).toBe('book_job');
      }
    });

    it('should reject invalid agent type', () => {
      const step = {
        stepId: 'step_1',
        agent: 'invalid_agent',
        action: 'Some action',
        inputs: {},
        requiresApproval: false,
      };

      const result = stepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const step = {
        stepId: 'step_1',
        agent: 'intake',
      };

      const result = stepSchema.safeParse(step);
      expect(result.success).toBe(false);
    });

    it('should validate all valid agent types', () => {
      const agents = ['intake', 'quote', 'schedule', 'reviews'];
      
      agents.forEach(agent => {
        const step = {
          stepId: `step_${agent}`,
          agent,
          action: `Action for ${agent}`,
          inputs: {},
          requiresApproval: false,
        };

        const result = stepSchema.safeParse(step);
        expect(result.success).toBe(true);
      });
    });

    it('should validate all valid approval types', () => {
      const approvalTypes = ['send_message', 'send_quote', 'book_job'];
      
      approvalTypes.forEach(approvalType => {
        const step = {
          stepId: `step_approval`,
          agent: 'intake',
          action: 'Test action',
          inputs: {},
          requiresApproval: true,
          approvalType,
        };

        const result = stepSchema.safeParse(step);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('supervisorPlanSchema', () => {
    it('should validate a valid supervisor plan', () => {
      const plan = {
        planId: 'plan_123',
        eventType: 'missed_call',
        steps: [
          {
            stepId: 'step_1',
            agent: 'intake',
            action: 'Send response',
            inputs: { phone: '+15551234567' },
            requiresApproval: false,
            toolCalls: [
              { tool: 'comms.sendSms', args: { to: '+15551234567', text: 'Hello' } },
            ],
          },
        ],
        shouldStop: false,
      };

      const result = supervisorPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.planId).toBe('plan_123');
        expect(result.data.steps.length).toBe(1);
        expect(result.data.shouldStop).toBe(false);
      }
    });

    it('should validate a plan with stop reason', () => {
      const plan = {
        planId: 'plan_456',
        eventType: 'inbound_sms',
        steps: [],
        shouldStop: true,
        stopReason: 'Customer already has an active conversation',
      };

      const result = supervisorPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.shouldStop).toBe(true);
        expect(result.data.stopReason).toBe('Customer already has an active conversation');
      }
    });

    it('should validate a multi-step plan', () => {
      const plan = {
        planId: 'plan_multi',
        eventType: 'web_lead',
        steps: [
          {
            stepId: 'step_1',
            agent: 'intake',
            action: 'Qualify lead',
            inputs: {},
            requiresApproval: false,
          },
          {
            stepId: 'step_2',
            agent: 'quote',
            action: 'Generate quote',
            inputs: {},
            requiresApproval: true,
            approvalType: 'send_quote',
          },
          {
            stepId: 'step_3',
            agent: 'schedule',
            action: 'Propose schedule',
            inputs: {},
            requiresApproval: true,
            approvalType: 'book_job',
          },
        ],
        shouldStop: false,
      };

      const result = supervisorPlanSchema.safeParse(plan);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.steps.length).toBe(3);
        expect(result.data.steps[1].requiresApproval).toBe(true);
      }
    });

    it('should reject plan with missing planId', () => {
      const plan = {
        eventType: 'missed_call',
        steps: [],
        shouldStop: false,
      };

      const result = supervisorPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it('should reject plan with invalid step', () => {
      const plan = {
        planId: 'plan_bad',
        eventType: 'missed_call',
        steps: [
          {
            stepId: 'step_1',
            agent: 'invalid',
            action: 'Bad action',
            inputs: {},
            requiresApproval: false,
          },
        ],
        shouldStop: false,
      };

      const result = supervisorPlanSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });
  });
});
