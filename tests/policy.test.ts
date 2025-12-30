import { describe, it, expect, beforeEach } from '@jest/globals';
import { PolicyService } from '../server/policy';
import type { PolicyContext, PolicyCheckResult } from '../server/policy';

type PolicyTier = 'owner_operator' | 'smb' | 'commercial';

interface PolicyProfile {
  id: number;
  businessId: number;
  tier: PolicyTier;
  autoSendMessages: boolean | null;
  autoSendQuotes: boolean | null;
  autoBookJobs: boolean | null;
  afterHoursAutomation: boolean | null;
  confidenceThreshold: number | null;
  slotScoreThreshold: number | null;
  serviceAreaZips: string[] | null;
  serviceAreaRadius: number | null;
  blockedPhones: string[] | null;
  blockedAddresses: string[] | null;
  pricingRules: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

function createMockProfile(overrides: Partial<PolicyProfile> = {}): PolicyProfile {
  return {
    id: 1,
    businessId: 1,
    tier: 'owner_operator' as PolicyTier,
    autoSendMessages: true,
    autoSendQuotes: false,
    autoBookJobs: false,
    afterHoursAutomation: false,
    confidenceThreshold: 85,
    slotScoreThreshold: 80,
    serviceAreaZips: null,
    serviceAreaRadius: null,
    blockedPhones: null,
    blockedAddresses: null,
    pricingRules: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('Policy Gating', () => {
  let policyService: PolicyService;

  beforeEach(() => {
    policyService = new PolicyService();
  });

  describe('Phone Blocking', () => {
    it('should block a phone number on the do-not-serve list', async () => {
      const profile = createMockProfile({
        blockedPhones: ['+15551234567', '+15559876543'],
      });
      policyService.setProfile(profile);

      const result = await policyService.check({
        action: 'send_message',
        data: { phone: '+15551234567' },
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('do-not-serve');
      expect(result.requiresApproval).toBe(false);
    });

    it('should allow a phone number not on the block list', async () => {
      const profile = createMockProfile({
        blockedPhones: ['+15551234567'],
      });
      policyService.setProfile(profile);

      const result = await policyService.check({
        action: 'send_message',
        data: { phone: '+15559999999' },
      });

      expect(result.allowed).toBe(true);
    });

    it('should handle phone number normalization', async () => {
      const profile = createMockProfile({
        blockedPhones: ['555-123-4567'],
      });
      policyService.setProfile(profile);

      const result = await policyService.check({
        action: 'send_message',
        data: { phone: '(555) 123-4567' },
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe('Address Blocking', () => {
    it('should block an address on the do-not-serve list', async () => {
      const profile = createMockProfile({
        blockedAddresses: ['123 Main St'],
      });
      policyService.setProfile(profile);

      const result = await policyService.check({
        action: 'send_message',
        data: { phone: '+15551234567', address: '123 Main St, City, ST 12345' },
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('do-not-serve');
    });

    it('should be case-insensitive for address matching', async () => {
      const profile = createMockProfile({
        blockedAddresses: ['123 MAIN ST'],
      });
      policyService.setProfile(profile);

      const result = await policyService.check({
        action: 'send_message',
        data: { phone: '+15551234567', address: '123 main st' },
      });

      expect(result.allowed).toBe(false);
    });
  });

  describe('Service Area', () => {
    it('should allow zip codes in service area', async () => {
      const profile = createMockProfile({
        serviceAreaZips: ['22901', '22902', '22903'],
      });
      policyService.setProfile(profile);

      const result = await policyService.check({
        action: 'send_message',
        data: { phone: '+15551234567', zip: '22901' },
      });

      expect(result.allowed).toBe(true);
    });

    it('should block zip codes outside service area', async () => {
      const profile = createMockProfile({
        serviceAreaZips: ['22901', '22902'],
      });
      policyService.setProfile(profile);

      const result = await policyService.check({
        action: 'send_message',
        data: { phone: '+15551234567', zip: '99999' },
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('outside service area');
    });

    it('should allow all zips when service area is not configured', async () => {
      const profile = createMockProfile({
        serviceAreaZips: null,
      });
      policyService.setProfile(profile);

      const result = await policyService.check({
        action: 'send_message',
        data: { phone: '+15551234567', zip: '12345' },
      });

      expect(result.allowed).toBe(true);
    });

    it('should allow when no zip is provided', async () => {
      const profile = createMockProfile({
        serviceAreaZips: ['22901'],
      });
      policyService.setProfile(profile);

      const result = await policyService.check({
        action: 'send_message',
        data: { phone: '+15551234567' },
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Owner Operator Tier', () => {
    beforeEach(() => {
      const profile = createMockProfile({
        tier: 'owner_operator',
        autoSendMessages: true,
        autoSendQuotes: false,
        autoBookJobs: false,
      });
      policyService.setProfile(profile);
    });

    it('should allow sending messages', async () => {
      const result = await policyService.check({
        action: 'send_message',
        data: { phone: '+15551234567' },
      });

      expect(result.allowed).toBe(true);
    });

    it('should require approval for quotes', async () => {
      const result = await policyService.check({
        action: 'send_quote',
        data: {
          phone: '+15551234567',
          quoteType: 'range',
          confidence: 0.9,
        },
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalType).toBe('send_quote');
    });

    it('should require approval for booking', async () => {
      const result = await policyService.check({
        action: 'book_job',
        data: {
          phone: '+15551234567',
          confidence: 0.95,
          slotScore: 90,
        },
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalType).toBe('book_job');
    });
  });

  describe('SMB Tier', () => {
    beforeEach(() => {
      const profile = createMockProfile({
        tier: 'smb',
        autoSendMessages: true,
        autoSendQuotes: true,
        autoBookJobs: false,
        confidenceThreshold: 85,
      });
      policyService.setProfile(profile);
    });

    it('should allow range quotes with high confidence', async () => {
      const result = await policyService.check({
        action: 'send_quote',
        data: {
          phone: '+15551234567',
          quoteType: 'range',
          amountMin: 200,
          amountMax: 300,
          confidence: 0.9,
        },
      });

      expect(result.allowed).toBe(true);
    });

    it('should require approval for fixed quotes', async () => {
      const result = await policyService.check({
        action: 'send_quote',
        data: {
          phone: '+15551234567',
          quoteType: 'fixed',
          amount: 250,
          confidence: 0.9,
        },
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalType).toBe('fixed_quote_approval');
    });

    it('should require approval for low confidence quotes', async () => {
      const result = await policyService.check({
        action: 'send_quote',
        data: {
          phone: '+15551234567',
          quoteType: 'range',
          confidence: 0.7,
        },
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalType).toBe('low_confidence_quote');
    });
  });

  describe('Commercial Tier', () => {
    beforeEach(() => {
      const profile = createMockProfile({
        tier: 'commercial',
        autoSendMessages: true,
        autoSendQuotes: true,
        autoBookJobs: true,
        confidenceThreshold: 90,
        slotScoreThreshold: 80,
      });
      policyService.setProfile(profile);
    });

    it('should allow auto-booking with high confidence and slot score', async () => {
      const result = await policyService.check({
        action: 'book_job',
        data: {
          phone: '+15551234567',
          confidence: 0.95,
          slotScore: 85,
        },
      });

      expect(result.allowed).toBe(true);
    });

    it('should require approval for low slot score', async () => {
      const result = await policyService.check({
        action: 'book_job',
        data: {
          phone: '+15551234567',
          confidence: 0.95,
          slotScore: 70,
        },
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalType).toBe('low_slot_score_booking');
    });

    it('should require approval for low confidence booking', async () => {
      const result = await policyService.check({
        action: 'book_job',
        data: {
          phone: '+15551234567',
          confidence: 0.8,
          slotScore: 90,
        },
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalType).toBe('low_confidence_booking');
    });

    it('should require approval for high-value quotes', async () => {
      const profile = createMockProfile({
        tier: 'commercial',
        autoSendQuotes: true,
        confidenceThreshold: 90,
        pricingRules: {
          requiresApprovalAbove: 5000,
        },
      });
      policyService.setProfile(profile);

      const result = await policyService.check({
        action: 'send_quote',
        data: {
          phone: '+15551234567',
          quoteType: 'fixed',
          amount: 7500,
          confidence: 0.95,
        },
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalType).toBe('high_value_quote');
    });
  });

  describe('After Hours Automation', () => {
    it('should require approval for after-hours actions when disabled', async () => {
      const profile = createMockProfile({
        afterHoursAutomation: false,
      });
      policyService.setProfile(profile);

      const result = await policyService.check({
        action: 'send_message',
        data: { phone: '+15551234567', isAfterHours: true },
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalType).toBe('after_hours_override');
    });

    it('should allow after-hours actions when enabled', async () => {
      const profile = createMockProfile({
        afterHoursAutomation: true,
      });
      policyService.setProfile(profile);

      const result = await policyService.check({
        action: 'send_message',
        data: { phone: '+15551234567', isAfterHours: true },
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Policy Summary', () => {
    it('should generate accurate policy summary', () => {
      const profile = createMockProfile({
        tier: 'smb',
        autoSendMessages: true,
        autoSendQuotes: true,
        autoBookJobs: false,
        confidenceThreshold: 85,
        slotScoreThreshold: 75,
        serviceAreaZips: ['22901', '22902'],
        blockedPhones: ['+15551234567'],
      });
      policyService.setProfile(profile);

      const summary = policyService.getPolicySummary();

      expect(summary.tier).toBe('smb');
      expect(summary.autoSendMessages).toBe(true);
      expect(summary.autoSendQuotes).toBe(true);
      expect(summary.autoBookJobs).toBe(false);
      expect(summary.confidenceThreshold).toBe(0.85);
      expect(summary.slotScoreThreshold).toBe(75);
      expect(summary.hasServiceAreaRestrictions).toBe(true);
      expect(summary.hasBlockedContacts).toBe(true);
    });
  });

  describe('Hard Block vs Soft Block (Approval)', () => {
    beforeEach(() => {
      const profile = createMockProfile({
        tier: 'owner_operator',
        autoSendQuotes: false,
        blockedPhones: ['+15551111111'],
        serviceAreaZips: ['22901'],
      });
      policyService.setProfile(profile);
    });

    it('should hard block (no approval) for blocked phone', async () => {
      const result = await policyService.check({
        action: 'send_quote',
        data: {
          phone: '+15551111111',
          quoteType: 'range',
          confidence: 0.9,
        },
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(false);
    });

    it('should hard block (no approval) for out-of-service-area', async () => {
      const result = await policyService.check({
        action: 'send_quote',
        data: {
          phone: '+15552222222',
          zip: '99999',
          quoteType: 'range',
          confidence: 0.9,
        },
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(false);
    });

    it('should soft block (allow approval) for tier restrictions', async () => {
      const result = await policyService.check({
        action: 'send_quote',
        data: {
          phone: '+15552222222',
          zip: '22901',
          quoteType: 'range',
          confidence: 0.9,
        },
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalType).toBe('send_quote');
    });
  });
});
