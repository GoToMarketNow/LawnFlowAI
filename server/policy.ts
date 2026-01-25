import { z } from "zod";
import { storage } from "./storage";
import { audit } from "./tools";
import type { PolicyProfile, PolicyTier } from "@shared/schema";

// Action types that can be checked against policy
export const PolicyActionTypes = [
  "send_message",
  "send_quote", 
  "book_job",
  "after_hours_action",
] as const;
export type PolicyActionType = typeof PolicyActionTypes[number];

// Context schemas for different action types
const sendMessageContextSchema = z.object({
  phone: z.string(),
  address: z.string().optional(),
  zip: z.string().optional(),
  isAfterHours: z.boolean().optional(),
});

const sendQuoteContextSchema = z.object({
  phone: z.string(),
  address: z.string().optional(),
  zip: z.string().optional(),
  quoteType: z.enum(["range", "fixed"]),
  amount: z.number().optional(), // For fixed quotes
  amountMin: z.number().optional(), // For range quotes
  amountMax: z.number().optional(), // For range quotes
  confidence: z.number(), // 0-1
  isAfterHours: z.boolean().optional(),
});

const bookJobContextSchema = z.object({
  phone: z.string(),
  address: z.string().optional(),
  zip: z.string().optional(),
  confidence: z.number(), // 0-1
  slotScore: z.number(), // 0-100
  isAfterHours: z.boolean().optional(),
});

const afterHoursContextSchema = z.object({
  phone: z.string().optional(),
  address: z.string().optional(),
  zip: z.string().optional(),
});

// Union type for action context
export type PolicyContext = 
  | { action: "send_message"; data: z.infer<typeof sendMessageContextSchema> }
  | { action: "send_quote"; data: z.infer<typeof sendQuoteContextSchema> }
  | { action: "book_job"; data: z.infer<typeof bookJobContextSchema> }
  | { action: "after_hours_action"; data: z.infer<typeof afterHoursContextSchema> };

// Result of policy check
export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
  approvalType?: string;
}

// Default tier configurations
const tierDefaults: Record<PolicyTier, Partial<PolicyProfile>> = {
  owner_operator: {
    autoSendMessages: true,
    autoSendQuotes: false,
    autoBookJobs: false,
    afterHoursAutomation: false,
    confidenceThreshold: 85,
    slotScoreThreshold: 80,
  },
  smb: {
    autoSendMessages: true,
    autoSendQuotes: true, // Only range quotes
    autoBookJobs: false,
    afterHoursAutomation: false, // configurable
    confidenceThreshold: 85,
    slotScoreThreshold: 80,
  },
  commercial: {
    autoSendMessages: true,
    autoSendQuotes: true, // Range and fixed
    autoBookJobs: true,
    afterHoursAutomation: true, // configurable
    confidenceThreshold: 90,
    slotScoreThreshold: 80,
  },
};

export class PolicyService {
  private profile: PolicyProfile | null = null;

  async loadPolicy(businessId: number): Promise<PolicyProfile | null> {
    this.profile = await storage.getPolicyProfile(businessId) ?? null;
    return this.profile;
  }

  setProfile(profile: PolicyProfile): void {
    this.profile = profile;
  }

  getProfile(): PolicyProfile | null {
    return this.profile;
  }

  // Get effective tier defaults merged with profile overrides
  getEffectiveConfig(): Partial<PolicyProfile> {
    if (!this.profile) {
      return tierDefaults.owner_operator;
    }
    const tier = this.profile.tier as PolicyTier;
    return { ...tierDefaults[tier], ...this.profile };
  }

  // Check if phone is blocked
  isPhoneBlocked(phone: string): boolean {
    if (!this.profile?.blockedPhones) return false;
    const normalizedPhone = phone.replace(/\D/g, "");
    return this.profile.blockedPhones.some(blocked => 
      normalizedPhone.includes(blocked.replace(/\D/g, ""))
    );
  }

  // Check if address is blocked
  isAddressBlocked(address: string): boolean {
    if (!this.profile?.blockedAddresses || !address) return false;
    const normalizedAddress = address.toLowerCase().trim();
    return this.profile.blockedAddresses.some(blocked =>
      normalizedAddress.includes(blocked.toLowerCase().trim())
    );
  }

  // Check if zip code is in service area
  isInServiceArea(zip: string | undefined): boolean {
    if (!zip) return true; // Assume in service area if no zip provided
    if (!this.profile?.serviceAreaZips || this.profile.serviceAreaZips.length === 0) {
      return true; // No restrictions = all areas served
    }
    return this.profile.serviceAreaZips.includes(zip);
  }

  // Main policy check method
  async check(context: PolicyContext): Promise<PolicyCheckResult> {
    const config = this.getEffectiveConfig();
    const tier = (this.profile?.tier || "owner_operator") as PolicyTier;

    // Extract common fields for do-not-serve checks
    const phone = "phone" in context.data ? context.data.phone : undefined;
    const address = "address" in context.data ? context.data.address : undefined;
    const zip = "zip" in context.data ? context.data.zip : undefined;
    const isAfterHours = "isAfterHours" in context.data ? context.data.isAfterHours : false;

    // Check do-not-serve rules first
    if (phone && this.isPhoneBlocked(phone)) {
      await this.logPolicyDecision(context.action, "blocked", "Phone number is on do-not-serve list");
      return {
        allowed: false,
        reason: "Phone number is on do-not-serve list",
        requiresApproval: false,
      };
    }

    if (address && this.isAddressBlocked(address)) {
      await this.logPolicyDecision(context.action, "blocked", "Address is on do-not-serve list");
      return {
        allowed: false,
        reason: "Address is on do-not-serve list",
        requiresApproval: false,
      };
    }

    // Check service area
    if (!this.isInServiceArea(zip)) {
      await this.logPolicyDecision(context.action, "blocked", "Location is outside service area");
      return {
        allowed: false,
        reason: "Location is outside service area",
        requiresApproval: false,
      };
    }

    // Check after-hours automation
    if (isAfterHours && !config.afterHoursAutomation) {
      await this.logPolicyDecision(context.action, "requires_approval", "After-hours automation is disabled");
      return {
        allowed: false,
        reason: "After-hours automation is disabled",
        requiresApproval: true,
        approvalType: "after_hours_override",
      };
    }

    // Action-specific checks
    switch (context.action) {
      case "send_message":
        return this.checkSendMessage(config);

      case "send_quote":
        return this.checkSendQuote(context.data as z.infer<typeof sendQuoteContextSchema>, config, tier);

      case "book_job":
        return this.checkBookJob(context.data as z.infer<typeof bookJobContextSchema>, config, tier);

      case "after_hours_action":
        return this.checkAfterHours(config);

      default:
        return { allowed: false, reason: "Unknown action type" };
    }
  }

  private async checkSendMessage(config: Partial<PolicyProfile>): Promise<PolicyCheckResult> {
    if (config.autoSendMessages) {
      await this.logPolicyDecision("send_message", "allowed", "Auto-send messages enabled");
      return { allowed: true };
    }
    await this.logPolicyDecision("send_message", "requires_approval", "Auto-send messages disabled");
    return {
      allowed: false,
      reason: "Auto-send messages is disabled for this tier",
      requiresApproval: true,
      approvalType: "send_message",
    };
  }

  private async checkSendQuote(
    data: z.infer<typeof sendQuoteContextSchema>,
    config: Partial<PolicyProfile>,
    tier: PolicyTier
  ): Promise<PolicyCheckResult> {
    const threshold = (config.confidenceThreshold || 85) / 100;

    // Check if auto-quote is enabled
    if (!config.autoSendQuotes) {
      await this.logPolicyDecision("send_quote", "requires_approval", "Auto-send quotes disabled");
      return {
        allowed: false,
        reason: "Auto-send quotes is disabled for this tier",
        requiresApproval: true,
        approvalType: "send_quote",
      };
    }

    // Check confidence threshold
    if (data.confidence < threshold) {
      await this.logPolicyDecision("send_quote", "requires_approval", 
        `Confidence ${data.confidence} below threshold ${threshold}`);
      return {
        allowed: false,
        reason: `Quote confidence (${(data.confidence * 100).toFixed(0)}%) is below required threshold (${threshold * 100}%)`,
        requiresApproval: true,
        approvalType: "low_confidence_quote",
      };
    }

    // SMB tier: only allow range quotes
    if (tier === "smb" && data.quoteType === "fixed") {
      await this.logPolicyDecision("send_quote", "requires_approval", "SMB tier only allows range quotes");
      return {
        allowed: false,
        reason: "SMB tier only allows automatic range quotes, not fixed quotes",
        requiresApproval: true,
        approvalType: "fixed_quote_approval",
      };
    }

    // Commercial tier: check pricing rules
    if (tier === "commercial" && this.profile?.pricingRules) {
      const rules = this.profile.pricingRules as { 
        minQuote?: number; 
        maxQuote?: number; 
        requiresApprovalAbove?: number; 
      };
      
      const quoteAmount = data.quoteType === "fixed" 
        ? data.amount 
        : data.amountMax;

      if (quoteAmount) {
        if (rules.requiresApprovalAbove && quoteAmount > rules.requiresApprovalAbove) {
          await this.logPolicyDecision("send_quote", "requires_approval", 
            `Quote ${quoteAmount} exceeds approval threshold ${rules.requiresApprovalAbove}`);
          return {
            allowed: false,
            reason: `Quote amount ($${quoteAmount}) exceeds auto-approval limit ($${rules.requiresApprovalAbove})`,
            requiresApproval: true,
            approvalType: "high_value_quote",
          };
        }
      }
    }

    await this.logPolicyDecision("send_quote", "allowed", "All quote conditions met");
    return { allowed: true };
  }

  private async checkBookJob(
    data: z.infer<typeof bookJobContextSchema>,
    config: Partial<PolicyProfile>,
    tier: PolicyTier
  ): Promise<PolicyCheckResult> {
    const confidenceThreshold = (config.confidenceThreshold || 85) / 100;
    const slotScoreThreshold = config.slotScoreThreshold || 80;

    // Check if auto-booking is enabled
    if (!config.autoBookJobs) {
      await this.logPolicyDecision("book_job", "requires_approval", "Auto-book jobs disabled");
      return {
        allowed: false,
        reason: "Auto-book jobs is disabled for this tier",
        requiresApproval: true,
        approvalType: "book_job",
      };
    }

    // Check confidence threshold
    if (data.confidence < confidenceThreshold) {
      await this.logPolicyDecision("book_job", "requires_approval",
        `Confidence ${data.confidence} below threshold ${confidenceThreshold}`);
      return {
        allowed: false,
        reason: `Booking confidence (${(data.confidence * 100).toFixed(0)}%) is below required threshold (${confidenceThreshold * 100}%)`,
        requiresApproval: true,
        approvalType: "low_confidence_booking",
      };
    }

    // Commercial tier: also check slot score
    if (tier === "commercial" && data.slotScore < slotScoreThreshold) {
      await this.logPolicyDecision("book_job", "requires_approval",
        `Slot score ${data.slotScore} below threshold ${slotScoreThreshold}`);
      return {
        allowed: false,
        reason: `Slot score (${data.slotScore}) is below required threshold (${slotScoreThreshold})`,
        requiresApproval: true,
        approvalType: "low_slot_score_booking",
      };
    }

    await this.logPolicyDecision("book_job", "allowed", "All booking conditions met");
    return { allowed: true };
  }

  private async checkAfterHours(config: Partial<PolicyProfile>): Promise<PolicyCheckResult> {
    if (config.afterHoursAutomation) {
      await this.logPolicyDecision("after_hours_action", "allowed", "After-hours automation enabled");
      return { allowed: true };
    }
    await this.logPolicyDecision("after_hours_action", "requires_approval", "After-hours automation disabled");
    return {
      allowed: false,
      reason: "After-hours automation is disabled",
      requiresApproval: true,
      approvalType: "after_hours_override",
    };
  }

  private async logPolicyDecision(action: string, decision: string, reason: string): Promise<void> {
    try {
      await audit.logEvent({
        action: "policy.check",
        actor: "policy_service",
        payload: {
          policyAction: action,
          decision,
          reason,
          tier: this.profile?.tier || "owner_operator",
          policyId: this.profile?.id,
        },
      });
    } catch (error) {
      console.error("[PolicyService] Failed to log policy decision:", error);
    }
  }

  // Helper to get a summary of policy for supervisor planning
  getPolicySummary(): {
    tier: PolicyTier;
    autoSendMessages: boolean;
    autoSendQuotes: boolean;
    autoBookJobs: boolean;
    afterHoursAutomation: boolean;
    confidenceThreshold: number;
    slotScoreThreshold: number;
    hasServiceAreaRestrictions: boolean;
    hasBlockedContacts: boolean;
  } {
    const config = this.getEffectiveConfig();
    return {
      tier: (this.profile?.tier || "owner_operator") as PolicyTier,
      autoSendMessages: config.autoSendMessages ?? true,
      autoSendQuotes: config.autoSendQuotes ?? false,
      autoBookJobs: config.autoBookJobs ?? false,
      afterHoursAutomation: config.afterHoursAutomation ?? false,
      confidenceThreshold: (config.confidenceThreshold ?? 85) / 100,
      slotScoreThreshold: config.slotScoreThreshold ?? 80,
      hasServiceAreaRestrictions: (this.profile?.serviceAreaZips?.length ?? 0) > 0,
      hasBlockedContacts: (this.profile?.blockedPhones?.length ?? 0) > 0 || 
                          (this.profile?.blockedAddresses?.length ?? 0) > 0,
    };
  }

  // Create default policy for a business
  static async createDefaultPolicy(businessId: number, tier: PolicyTier = "owner_operator"): Promise<PolicyProfile> {
    const defaults = tierDefaults[tier];
    return storage.createPolicyProfile({
      businessId,
      tier,
      autoSendMessages: defaults.autoSendMessages ?? true,
      autoSendQuotes: defaults.autoSendQuotes ?? false,
      autoBookJobs: defaults.autoBookJobs ?? false,
      afterHoursAutomation: defaults.afterHoursAutomation ?? false,
      confidenceThreshold: defaults.confidenceThreshold ?? 85,
      slotScoreThreshold: defaults.slotScoreThreshold ?? 80,
    });
  }
}

// Singleton instance
export const policyService = new PolicyService();

// Convenience function for quick policy checks
export async function checkPolicy(
  businessId: number,
  context: PolicyContext
): Promise<PolicyCheckResult> {
  await policyService.loadPolicy(businessId);
  return policyService.check(context);
}
