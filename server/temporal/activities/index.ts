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

// Weather Monitoring and Planning Activities
export {
  // Monitoring
  fetchWeatherForServiceAreaActivity,
  scoreJobsRiskActivity,
  checkWinterEventsActivity,
  recordMonitoringRunActivity,
  // Schedule Planning
  loadScheduleSnapshotActivity,
  loadCrewConstraintsActivity,
  generatePlanCandidatesActivity,
  applyScheduleChangesActivity,
  sendScheduleChangeNotificationsActivity,
  // Winter Campaigns
  validateOperatorServicesActivity,
  queryEligibleCustomersActivity,
  checkOperationalCapacityActivity,
  buildCampaignProposalActivity,
  sendCampaignBatchActivity,
  recordCampaignMetricsActivity,
  // Snow/Ice Fulfillment
  createSnowIceJobActivity,
  assignCrewToJobActivity,
  updateRouteActivity,
} from './weather';

// Pre-Qualification Activities (Marketing Agent)
export {
  extractRequestedServicesActivity,
  inferPropertyTypeActivity,
  resolveLocationActivity,
  checkServiceabilityActivity,
  generateNextQuestionActivity,
} from './prequalification';

// Marketing Agent Activities
export {
  upsertMarketingProspectActivity,
  getMarketingProspectActivity,
  updateProspectStatusActivity,
  updateProspectActivity,
  createOutreachDraftActivity,
  recordOutreachAttemptActivity,
  sendSocialReplyActivity,
  createApprovalTaskActivity,
  decideEngagementActivity,
  checkConsentActivity,
  setOptOutActivity,
  handoffToLeadIntakeActivity,
  sendPoliteDeclineActivity,
  matchConversationToProspectActivity,
  classifyResponseActivity,
} from './marketing';
