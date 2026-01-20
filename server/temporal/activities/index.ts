/**
 * Temporal Activities Index
 *
 * All activities are exported from this file for worker registration.
 * Activities are the "side effects" that interact with external systems.
 *
 * @module server/temporal/activities
 */

// Database operations
export {
  recordWorkflowRunActivity,
  updateWorkflowRunActivity,
  recordWorkflowStepActivity,
  loadJobActivity,
  loadJobRequestActivity,
  loadBusinessProfileActivity,
  loadCustomerActivity,
} from './db';

// Billing operations
export {
  buildInvoiceActivity,
  getInvoiceActivity,
} from './billing';

// Human task operations
export {
  createHumanTaskActivity,
  getHumanTaskActivity,
  updateHumanTaskActivity,
} from './humanTasks';

// Policy operations
export {
  checkPolicyActivity,
} from './policy';

// Stripe payment operations
export {
  createPaymentIntentActivity,
  capturePaymentActivity,
  createRefundActivity,
  createStripeCustomerActivity,
  attachPaymentMethodActivity,
  getPaymentIntentActivity,
  cancelPaymentIntentActivity,
  listPaymentMethodsActivity,
} from './stripe';

// Twilio SMS operations
export {
  sendSmsActivity,
  sendPaymentLinkSmsActivity,
  sendPaymentConfirmationSmsActivity,
  sendPaymentFailureSmsActivity,
  sendReminderSmsActivity,
  sendPaymentSetupSmsActivity,
  getMessageStatusActivity,
  sendJobCompletionSmsActivity,
  sendQuoteReadySmsActivity,
} from './twilio';

// Tool Gateway
export {
  executeToolActivity,
  executeStripeToolActivity,
  executeTwilioToolActivity,
  executeFsmToolActivity,
  getAvailableTools,
} from './toolGateway';

// FinOps - Budget gates and usage tracking
export {
  checkBudgetActivity,
  recordUsageActivity,
  createAlertActivity,
  getBudgetStatusActivity,
  getWorkflowUsageActivity,
  calculateCostActivity,
} from './finops';

// Memory/RAG operations
export {
  createMemoryDocActivity,
  updateMemoryDocActivity,
  queryMemoryActivity,
  getContextActivity,
  recordAccessActivity,
  deleteMemoryDocActivity,
  getCustomerPreferencesActivity,
  bulkCreateMemoryDocsActivity,
  cleanupExpiredDocsActivity,
} from './memory';

// Writeback - Post-workflow summaries
export {
  generateWorkflowSummaryActivity,
  createWorkflowSummaryActivity,
  updateCustomerContextActivity,
  getWorkflowSummaryActivity,
} from './writeback';

// Lead-to-Cash Stage Activities
export {
  leadIntakeActivity,
  quoteBuildActivity,
  quoteConfirmActivity,
  scheduleProposeActivity,
  simulationRunActivity,
  feasibilityCheckActivity,
  marginValidateActivity,
  crewLockActivity,
  dispatchReadyActivity,
  jobBookActivity,
  executeStageActivity,
  STAGE_ORDER,
  getNextStage,
  getPreviousStage,
  type StageActivityInput,
  type StageActivityOutput,
  type OrchestrationStage,
} from './stages';
