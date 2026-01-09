import { z } from "zod";

// ============================================
// Payment Agent Contract Schemas
// All payment agents return ONLY structured JSON matching these schemas
// ============================================

// Payment method type enum
export const PaymentMethodTypeSchema = z.enum(["APPLE_PAY", "GOOGLE_PAY", "CARD"]);
export type PaymentMethodType = z.infer<typeof PaymentMethodTypeSchema>;

// Payment status enum
export const PaymentStatusSchema = z.enum([
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "voided"
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

// Capture type enum
export const CaptureTypeSchema = z.enum([
  "autopay",
  "on_demand",
  "invoice_payment",
  "first_service"
]);
export type CaptureType = z.infer<typeof CaptureTypeSchema>;

// ============================================
// Payment Agent Decision Result
// ============================================

export const PaymentAgentDecisionSchema = z.object({
  decision: z.enum([
    "autopay_capture",
    "request_setup",
    "send_text_to_pay",
    "create_in_app_session",
    "fallback_invoice",
    "escalate"
  ]),

  // Commands to execute (JSONB array)
  commands: z.array(z.object({
    type: z.string(),
    payload: z.record(z.unknown()),
    idempotencyKey: z.string(),
    traceId: z.string(),
    entityId: z.string(),
    policySnapshotHash: z.string(),
  })),

  // Confidence scoring
  confidence: z.number().min(0).max(1),
  confidenceBreakdown: z.object({
    dataCompleteness: z.number().min(0).max(1),
    policyCompliance: z.number().min(0).max(1),
    consentCertainty: z.number().min(0).max(1),
    methodAvailabilityCertainty: z.number().min(0).max(1),
    paymentRiskCertainty: z.number().min(0).max(1),
  }),

  // Risk and escalation
  riskFlags: z.array(z.enum([
    "PAYMENT_RISK",
    "CONSENT_MISSING",
    "POLICY_VIOLATION",
    "AMOUNT_THRESHOLD_EXCEEDED",
    "METHOD_UNAVAILABLE",
    "CUSTOMER_DISPUTE_HISTORY",
    "FIRST_SERVICE_NO_SETUP",
  ])),

  humanRequired: z.boolean(),
  handoffReason: z.string().nullable(),
  handoffToRole: z.enum(["FINANCE", "OPS"]).nullable(),

  // Tracing
  traceId: z.string(),
  entityId: z.string(), // job_id or invoice_id
  journeyType: z.enum(["job", "invoice", "payment"]),
});
export type PaymentAgentDecision = z.infer<typeof PaymentAgentDecisionSchema>;

// ============================================
// Payment Events (Domain Events)
// ============================================

export const PaymentPreferenceUpdatedEventSchema = z.object({
  eventType: z.literal("PaymentPreferenceUpdated"),
  timestamp: z.string(),
  traceId: z.string(),
  customerId: z.number(),
  businessId: z.number(),

  preferredMethodId: z.number().nullable(),
  autopayEnabled: z.boolean(),
  autoBillingEnabled: z.boolean(),
  allowedMethods: z.array(PaymentMethodTypeSchema),
});
export type PaymentPreferenceUpdatedEvent = z.infer<typeof PaymentPreferenceUpdatedEventSchema>;

export const PaymentSetupRequestedEventSchema = z.object({
  eventType: z.literal("PaymentSetupRequested"),
  timestamp: z.string(),
  traceId: z.string(),
  customerId: z.number(),
  businessId: z.number(),

  channels: z.array(z.enum(["sms", "in_app", "email"])),
  context: z.enum(["first_service", "autopay_enrollment", "payment_method_update"]),
  jobId: z.number().optional(),
});
export type PaymentSetupRequestedEvent = z.infer<typeof PaymentSetupRequestedEventSchema>;

export const PaymentSessionCreatedEventSchema = z.object({
  eventType: z.literal("PaymentSessionCreated"),
  timestamp: z.string(),
  traceId: z.string(),
  customerId: z.number(),
  businessId: z.number(),

  sessionId: z.string(),
  amount: z.number(),
  currency: z.string().default("USD"),
  allowedMethods: z.array(PaymentMethodTypeSchema),
  channel: z.enum(["sms", "in_app", "email"]),
  sessionUrl: z.string().optional(),
  expiresAt: z.string(),

  jobId: z.number().optional(),
  invoiceId: z.number().optional(),
});
export type PaymentSessionCreatedEvent = z.infer<typeof PaymentSessionCreatedEventSchema>;

export const PaymentAuthorizedEventSchema = z.object({
  eventType: z.literal("PaymentAuthorized"),
  timestamp: z.string(),
  traceId: z.string(),
  customerId: z.number(),
  businessId: z.number(),

  transactionId: z.number(),
  amount: z.number(),
  currency: z.string(),
  paymentMethodId: z.number(),
  methodType: PaymentMethodTypeSchema,

  provider: z.string(),
  providerTransactionId: z.string(),

  jobId: z.number().optional(),
  invoiceId: z.number().optional(),
});
export type PaymentAuthorizedEvent = z.infer<typeof PaymentAuthorizedEventSchema>;

export const PaymentCapturedEventSchema = z.object({
  eventType: z.literal("PaymentCaptured"),
  timestamp: z.string(),
  traceId: z.string(),
  customerId: z.number(),
  businessId: z.number(),

  transactionId: z.number(),
  amount: z.number(),
  currency: z.string(),
  paymentMethodId: z.number(),
  methodType: PaymentMethodTypeSchema,
  captureType: CaptureTypeSchema,

  provider: z.string(),
  providerTransactionId: z.string(),

  jobId: z.number().optional(),
  invoiceId: z.number().optional(),
});
export type PaymentCapturedEvent = z.infer<typeof PaymentCapturedEventSchema>;

export const PaymentFailedEventSchema = z.object({
  eventType: z.literal("PaymentFailed"),
  timestamp: z.string(),
  traceId: z.string(),
  customerId: z.number(),
  businessId: z.number(),

  transactionId: z.number(),
  amount: z.number(),
  currency: z.string(),
  paymentMethodId: z.number().optional(),

  failureReason: z.string(),
  failureCode: z.string(),
  retryCount: z.number(),

  jobId: z.number().optional(),
  invoiceId: z.number().optional(),
});
export type PaymentFailedEvent = z.infer<typeof PaymentFailedEventSchema>;

export const InvoiceFallbackTriggeredEventSchema = z.object({
  eventType: z.literal("InvoiceFallbackTriggered"),
  timestamp: z.string(),
  traceId: z.string(),
  customerId: z.number(),
  businessId: z.number(),

  jobId: z.number(),
  amount: z.number(),
  reason: z.enum([
    "autopay_disabled",
    "no_payment_method",
    "amount_exceeds_threshold",
    "payment_failed",
    "customer_opted_out",
    "policy_requires_invoice"
  ]),
});
export type InvoiceFallbackTriggeredEvent = z.infer<typeof InvoiceFallbackTriggeredEventSchema>;

export const PaymentMethodAddedEventSchema = z.object({
  eventType: z.literal("PaymentMethodAdded"),
  timestamp: z.string(),
  traceId: z.string(),
  customerId: z.number(),
  businessId: z.number(),

  paymentMethodId: z.number(),
  methodType: PaymentMethodTypeSchema,
  isDefault: z.boolean(),
  addedVia: z.enum(["sms_link", "in_app", "first_service", "manual"]),
});
export type PaymentMethodAddedEvent = z.infer<typeof PaymentMethodAddedEventSchema>;

// Union of all payment events
export const PaymentEventSchema = z.discriminatedUnion("eventType", [
  PaymentPreferenceUpdatedEventSchema,
  PaymentSetupRequestedEventSchema,
  PaymentSessionCreatedEventSchema,
  PaymentAuthorizedEventSchema,
  PaymentCapturedEventSchema,
  PaymentFailedEventSchema,
  InvoiceFallbackTriggeredEventSchema,
  PaymentMethodAddedEventSchema,
]);
export type PaymentEvent = z.infer<typeof PaymentEventSchema>;

// ============================================
// Payment Commands (Proposed Actions)
// ============================================

export const RequestPaymentSetupCommandSchema = z.object({
  type: z.literal("RequestPaymentSetup"),
  customerId: z.number(),
  businessId: z.number(),
  channels: z.array(z.enum(["sms", "in_app", "email"])),
  context: z.enum(["first_service", "autopay_enrollment", "payment_method_update"]),
  jobId: z.number().optional(),

  // Required for all commands
  idempotencyKey: z.string(),
  traceId: z.string(),
  entityId: z.string(),
  policySnapshotHash: z.string(),
});
export type RequestPaymentSetupCommand = z.infer<typeof RequestPaymentSetupCommandSchema>;

export const CreatePaymentSessionCommandSchema = z.object({
  type: z.literal("CreatePaymentSession"),
  customerId: z.number(),
  businessId: z.number(),
  amount: z.number(),
  currency: z.string().default("USD"),
  allowedMethods: z.array(PaymentMethodTypeSchema),
  channel: z.enum(["sms", "in_app", "email"]),

  jobId: z.number().optional(),
  invoiceId: z.number().optional(),

  // Required for all commands
  idempotencyKey: z.string(),
  traceId: z.string(),
  entityId: z.string(),
  policySnapshotHash: z.string(),
});
export type CreatePaymentSessionCommand = z.infer<typeof CreatePaymentSessionCommandSchema>;

export const SetPreferredPaymentMethodCommandSchema = z.object({
  type: z.literal("SetPreferredPaymentMethod"),
  customerId: z.number(),
  businessId: z.number(),
  paymentMethodId: z.number(),

  // Required for all commands
  idempotencyKey: z.string(),
  traceId: z.string(),
  entityId: z.string(),
  policySnapshotHash: z.string(),
});
export type SetPreferredPaymentMethodCommand = z.infer<typeof SetPreferredPaymentMethodCommandSchema>;

export const EnableAutopayCommandSchema = z.object({
  type: z.literal("EnableAutopay"),
  customerId: z.number(),
  businessId: z.number(),
  enabled: z.boolean(),

  // Required for all commands
  idempotencyKey: z.string(),
  traceId: z.string(),
  entityId: z.string(),
  policySnapshotHash: z.string(),
});
export type EnableAutopayCommand = z.infer<typeof EnableAutopayCommandSchema>;

export const CapturePaymentCommandSchema = z.object({
  type: z.literal("CapturePayment"),
  customerId: z.number(),
  businessId: z.number(),
  paymentMethodId: z.number(),
  amount: z.number(),
  currency: z.string().default("USD"),
  captureType: CaptureTypeSchema,

  jobId: z.number().optional(),
  invoiceId: z.number().optional(),

  // Required for all commands
  idempotencyKey: z.string(),
  traceId: z.string(),
  entityId: z.string(),
  policySnapshotHash: z.string(),
});
export type CapturePaymentCommand = z.infer<typeof CapturePaymentCommandSchema>;

export const SendTextToPayLinkCommandSchema = z.object({
  type: z.literal("SendTextToPayLink"),
  customerId: z.number(),
  businessId: z.number(),
  customerPhone: z.string(),
  paymentSessionUrl: z.string(),
  amount: z.number(),

  jobId: z.number().optional(),
  invoiceId: z.number().optional(),

  // Required for all commands
  idempotencyKey: z.string(),
  traceId: z.string(),
  entityId: z.string(),
  policySnapshotHash: z.string(),
});
export type SendTextToPayLinkCommand = z.infer<typeof SendTextToPayLinkCommandSchema>;

export const CreateInvoiceCommandSchema = z.object({
  type: z.literal("CreateInvoice"),
  customerId: z.number(),
  businessId: z.number(),
  jobId: z.number(),
  amount: z.number(),
  currency: z.string().default("USD"),
  reason: z.enum([
    "autopay_disabled",
    "no_payment_method",
    "amount_exceeds_threshold",
    "payment_failed",
    "customer_opted_out",
    "policy_requires_invoice"
  ]),

  // Required for all commands
  idempotencyKey: z.string(),
  traceId: z.string(),
  entityId: z.string(),
  policySnapshotHash: z.string(),
});
export type CreateInvoiceCommand = z.infer<typeof CreateInvoiceCommandSchema>;

export const CreateHumanTaskCommandSchema = z.object({
  type: z.literal("CreateHumanTask"),
  customerId: z.number(),
  businessId: z.number(),
  role: z.enum(["FINANCE", "OPS"]),
  reason: z.string(),
  context: z.record(z.unknown()),

  jobId: z.number().optional(),
  invoiceId: z.number().optional(),

  // Required for all commands
  idempotencyKey: z.string(),
  traceId: z.string(),
  entityId: z.string(),
  policySnapshotHash: z.string(),
});
export type CreateHumanTaskCommand = z.infer<typeof CreateHumanTaskCommandSchema>;

// Union of all payment commands
export const PaymentCommandSchema = z.discriminatedUnion("type", [
  RequestPaymentSetupCommandSchema,
  CreatePaymentSessionCommandSchema,
  SetPreferredPaymentMethodCommandSchema,
  EnableAutopayCommandSchema,
  CapturePaymentCommandSchema,
  SendTextToPayLinkCommandSchema,
  CreateInvoiceCommandSchema,
  CreateHumanTaskCommandSchema,
]);
export type PaymentCommand = z.infer<typeof PaymentCommandSchema>;

// ============================================
// Helper functions for validation
// ============================================

export function validatePaymentAgentDecision(data: unknown): PaymentAgentDecision {
  const result = PaymentAgentDecisionSchema.safeParse(data);
  if (!result.success) {
    console.error("[PaymentAgent] Invalid decision:", result.error.format());
    throw new Error(`Payment Agent returned invalid decision: ${result.error.message}`);
  }
  return result.data;
}

export function validatePaymentCommand(data: unknown): PaymentCommand {
  const result = PaymentCommandSchema.safeParse(data);
  if (!result.success) {
    console.error("[PaymentCommand] Invalid command:", result.error.format());
    throw new Error(`Invalid payment command: ${result.error.message}`);
  }
  return result.data;
}

export function validatePaymentEvent(data: unknown): PaymentEvent {
  const result = PaymentEventSchema.safeParse(data);
  if (!result.success) {
    console.error("[PaymentEvent] Invalid event:", result.error.format());
    throw new Error(`Invalid payment event: ${result.error.message}`);
  }
  return result.data;
}
