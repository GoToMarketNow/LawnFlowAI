/**
 * Temporal Workflows Index
 *
 * All workflows are exported from this file for worker registration.
 * Workflows are deterministic - they can only interact with the outside
 * world through activities.
 *
 * @module server/temporal/workflows
 */

export { JobCloseoutWorkflow, approvalSignal, cancelSignal } from './jobCloseout';

// Lead-to-Cash Workflow (Sprint 5)
export {
  leadToCashWorkflow,
  approvalSignal as l2cApprovalSignal,
  customerResponseSignal,
  overrideSignal,
  getStatusQuery,
  getHistoryQuery,
  type LeadToCashWorkflowInput,
  type LeadToCashWorkflowOutput,
} from './leadToCash';

// Billing Workflow (Sprint 5)
export {
  billingWorkflow,
  paymentReceivedSignal,
  disputeSignal,
  manualActionSignal,
  getStatusQuery as billingGetStatusQuery,
  getPaymentHistoryQuery,
  type BillingWorkflowInput,
  type BillingWorkflowOutput,
  type BillingStage,
} from './billing';
