// ============================================
// Payment Orchestrator - Public API
// ============================================

export { runPaymentAgent, type PaymentAgentContext } from "./paymentAgent";
export {
  executePaymentCommand,
  type CommandHandlerContext,
  type CommandResult,
} from "./commandHandlers";
export {
  runJobCompletedPaymentSaga,
  compensatePaymentSaga,
  handleJobCompletionWithPayment,
  type JobCompletedPaymentSagaInput,
  type SagaResult,
} from "./paymentSaga";
export {
  schedulePaymentRetry,
  executePaymentRetry,
  handleFinalPaymentFailure,
  initializePaymentRetryQueue,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
  type RetryResult,
} from "./retryPolicy";

// Adapters
export {
  sendPaymentLink,
  sendPaymentSetupLink,
  sendPaymentConfirmation,
  sendPaymentFailureNotification,
  type SendPaymentLinkInput,
  type SendPaymentSetupInput,
  type SendPaymentConfirmationInput,
  type SendPaymentFailureInput,
  type SMSResult,
} from "./adapters/smsAdapter";

export {
  createPaymentIntent,
  getPaymentIntentStatus,
  createPaymentMethod,
  detachPaymentMethod,
  createCustomer,
  createRefund,
  createApplePaySession,
  createGooglePaySession,
  type CreatePaymentIntentInput,
  type PaymentIntentResult,
  type CreatePaymentMethodInput,
  type PaymentMethodResult,
  type CreateCustomerInput,
  type CustomerResult,
  type CreateRefundInput,
  type RefundResult,
} from "./adapters/paymentProviderAdapter";

// Webhooks
export {
  processStripeWebhook,
  verifyStripeWebhookSignature,
  type StripeWebhookPayload,
  type WebhookProcessingResult,
} from "./webhooks/stripeWebhookHandler";
