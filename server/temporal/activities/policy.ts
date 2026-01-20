/**
 * Policy Activities
 *
 * Activities that wrap the policy service for trust tree / policy checks.
 * These determine if actions can proceed autonomously or need HITL approval.
 *
 * @module server/temporal/activities/policy
 */

import { PolicyService, PolicyContext, PolicyCheckResult } from '../../policy';
import { storage } from '../../storage';

// ============================================================================
// Check Policy Activity
// ============================================================================

export interface CheckPolicyInput {
  businessId: number;
  action: 'send_message' | 'send_quote' | 'book_job' | 'generate_invoice' | 'capture_payment';
  context: {
    phone?: string;
    address?: string;
    zip?: string;
    amount?: number;
    amountMin?: number;
    amountMax?: number;
    confidence?: number;
    slotScore?: number;
    isAfterHours?: boolean;
    quoteType?: 'range' | 'fixed';
  };
}

export interface CheckPolicyOutput {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  approvalType?: string;
  policyTier?: string;
}

/**
 * Check if an action is allowed by the business policy
 */
export async function checkPolicyActivity(
  input: CheckPolicyInput
): Promise<CheckPolicyOutput> {
  const { businessId, action, context } = input;

  try {
    // Create policy service instance
    const policyService = new PolicyService();

    // Load policy for business
    const profile = await policyService.loadPolicy(businessId);

    if (!profile) {
      // No policy configured - default to requiring approval
      return {
        allowed: false,
        requiresApproval: true,
        reason: 'No policy profile configured for business',
        approvalType: 'missing_policy',
      };
    }

    // Map our action types to policy action types
    const policyAction = mapActionToPolicyAction(action);

    // Build policy context based on action type
    const policyContext = buildPolicyContext(policyAction, context);

    // Check policy
    const result = await policyService.check(policyContext);

    return {
      allowed: result.allowed,
      requiresApproval: result.requiresApproval || false,
      reason: result.reason,
      approvalType: result.approvalType,
      policyTier: profile.tier,
    };
  } catch (error) {
    // On error, require approval to be safe
    return {
      allowed: false,
      requiresApproval: true,
      reason: `Policy check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      approvalType: 'error',
    };
  }
}

/**
 * Map our activity actions to policy service action types
 */
function mapActionToPolicyAction(
  action: CheckPolicyInput['action']
): 'send_message' | 'send_quote' | 'book_job' | 'after_hours_action' {
  switch (action) {
    case 'send_message':
      return 'send_message';
    case 'send_quote':
    case 'generate_invoice':
      return 'send_quote';
    case 'book_job':
    case 'capture_payment':
      return 'book_job';
    default:
      return 'send_message';
  }
}

/**
 * Build the policy context object for the policy service
 */
function buildPolicyContext(
  action: 'send_message' | 'send_quote' | 'book_job' | 'after_hours_action',
  context: CheckPolicyInput['context']
): PolicyContext {
  const baseContext = {
    phone: context.phone || '',
    address: context.address,
    zip: context.zip,
    isAfterHours: context.isAfterHours,
  };

  switch (action) {
    case 'send_message':
      return {
        action: 'send_message',
        data: baseContext,
      };

    case 'send_quote':
      return {
        action: 'send_quote',
        data: {
          ...baseContext,
          quoteType: context.quoteType || 'range',
          amount: context.amount,
          amountMin: context.amountMin,
          amountMax: context.amountMax,
          confidence: context.confidence ?? 0.8,
        },
      };

    case 'book_job':
      return {
        action: 'book_job',
        data: {
          ...baseContext,
          confidence: context.confidence ?? 0.8,
          slotScore: context.slotScore ?? 80,
        },
      };

    case 'after_hours_action':
      return {
        action: 'after_hours_action',
        data: baseContext,
      };
  }
}
