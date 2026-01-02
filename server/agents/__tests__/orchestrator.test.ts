import { canCreateDecision, canApproveDecision, type UserRole } from '../orchestrator';

describe('Optimizer Orchestrator Agent', () => {
  describe('canCreateDecision', () => {
    it('allows owner to create decisions', () => {
      expect(canCreateDecision('owner')).toBe(true);
    });

    it('allows admin to create decisions', () => {
      expect(canCreateDecision('admin')).toBe(true);
    });

    it('allows crew_lead to create decisions', () => {
      expect(canCreateDecision('crew_lead')).toBe(true);
    });

    it('denies staff from creating decisions', () => {
      expect(canCreateDecision('staff')).toBe(false);
    });
  });

  describe('canApproveDecision', () => {
    it('allows owner to approve decisions', () => {
      expect(canApproveDecision('owner')).toBe(true);
    });

    it('allows admin to approve decisions', () => {
      expect(canApproveDecision('admin')).toBe(true);
    });

    it('denies crew_lead by default', () => {
      expect(canApproveDecision('crew_lead')).toBe(false);
    });

    it('allows crew_lead when allowCrewLeadApprove is true', () => {
      expect(canApproveDecision('crew_lead', { allowCrewLeadApprove: true })).toBe(true);
    });

    it('denies staff even with allowCrewLeadApprove', () => {
      expect(canApproveDecision('staff', { allowCrewLeadApprove: true })).toBe(false);
    });
  });

  describe('RBAC role hierarchy', () => {
    const roles: UserRole[] = ['owner', 'admin', 'crew_lead', 'staff'];

    it('owner has all permissions', () => {
      expect(canCreateDecision('owner')).toBe(true);
      expect(canApproveDecision('owner')).toBe(true);
    });

    it('admin has all permissions', () => {
      expect(canCreateDecision('admin')).toBe(true);
      expect(canApproveDecision('admin')).toBe(true);
    });

    it('crew_lead can create but not approve by default', () => {
      expect(canCreateDecision('crew_lead')).toBe(true);
      expect(canApproveDecision('crew_lead')).toBe(false);
    });

    it('staff cannot create or approve', () => {
      expect(canCreateDecision('staff')).toBe(false);
      expect(canApproveDecision('staff')).toBe(false);
    });
  });

  describe('config options', () => {
    it('empty config uses defaults', () => {
      expect(canApproveDecision('crew_lead', {})).toBe(false);
    });

    it('explicit false for allowCrewLeadApprove', () => {
      expect(canApproveDecision('crew_lead', { allowCrewLeadApprove: false })).toBe(false);
    });

    it('only crew_lead benefits from allowCrewLeadApprove', () => {
      expect(canApproveDecision('staff', { allowCrewLeadApprove: true })).toBe(false);
      expect(canApproveDecision('admin', { allowCrewLeadApprove: true })).toBe(true);
      expect(canApproveDecision('owner', { allowCrewLeadApprove: true })).toBe(true);
    });
  });
});
