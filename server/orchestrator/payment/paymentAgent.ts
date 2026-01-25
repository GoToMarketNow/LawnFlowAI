import type { Database } from "@db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import {
  PaymentAgentDecision,
  validatePaymentAgentDecision,
  type PaymentCommand,
} from "@shared/orchestrator/payment-contracts";

// ============================================
// Payment Agent - Core Decision Engine
// ============================================

export interface PaymentAgentContext {
  // Entity context
  jobId?: number;
  invoiceId?: number;
  customerId: number;
  businessId: number;

  // Job/Invoice details
  amount: number;
  currency: string;

  // Trigger context
  trigger: "job_completed" | "invoice_created" | "customer_initiated";
  isFirstService: boolean;

  // Tracing
  traceId: string;
}

export interface PaymentAgentInput {
  db: Database;
  context: PaymentAgentContext;
}

/**
 * Payment Agent - Main decision function
 *
 * Returns a decision object with proposed commands.
 * NEVER executes commands directly - command handlers enforce policy.
 */
export async function runPaymentAgent(input: PaymentAgentInput): Promise<PaymentAgentDecision> {
  const { db, context } = input;
  const { customerId, businessId, amount, jobId, invoiceId, isFirstService, traceId } = context;

  const entityId = jobId ? `job_${jobId}` : invoiceId ? `invoice_${invoiceId}` : "unknown";
  const journeyType = jobId ? "job" : invoiceId ? "invoice" : "payment";

  // ============================================
  // 1. Load operator policy
  // ============================================
  const policy = await db.query.operatorPaymentPolicies.findFirst({
    where: (policies, { eq }) => eq(policies.businessId, businessId),
  });

  if (!policy) {
    return escalateDecision(
      traceId,
      entityId,
      journeyType as "job" | "invoice" | "payment",
      "POLICY_VIOLATION",
      "No payment policy configured for business",
      "OPS"
    );
  }

  const policyHash = hashPolicy(policy);

  // ============================================
  // 2. Load customer payment profile
  // ============================================
  const profile = await db.query.customerPaymentProfiles.findFirst({
    where: (profiles, { eq }) => eq(profiles.customerId, customerId),
  });

  // ============================================
  // 3. Load customer payment methods
  // ============================================
  const paymentMethods = profile
    ? await db.query.paymentMethods.findMany({
        where: (methods, { eq, and }) =>
          and(
            eq(methods.customerId, customerId),
            eq(methods.isActive, true)
          ),
      })
    : [];

  const preferredMethod = paymentMethods.find(m => m.id === profile?.preferredPaymentMethodId);

  // ============================================
  // 4. Confidence scoring
  // ============================================
  const confidenceScore = calculateConfidence({
    hasProfile: !!profile,
    hasPreferredMethod: !!preferredMethod,
    autopayEnabled: profile?.autopayEnabled ?? false,
    hasConsent: (profile?.consentRecords as any[])?.length > 0,
    amount,
    policy,
    isFirstService,
  });

  // ============================================
  // 5. Risk flag detection
  // ============================================
  const riskFlags = detectRiskFlags({
    profile,
    preferredMethod,
    paymentMethods,
    amount,
    policy,
    isFirstService,
  });

  // ============================================
  // 6. Decision logic
  // ============================================

  // FIRST SERVICE - requires setup
  if (isFirstService && policy.firstServiceRequiresSetup && !preferredMethod) {
    return buildDecision({
      decision: "request_setup",
      commands: [
        buildRequestPaymentSetupCommand({
          customerId,
          businessId,
          channels: ["sms"],
          context: "first_service",
          jobId,
          traceId,
          entityId,
          policyHash,
        }),
      ],
      confidence: confidenceScore.overall,
      confidenceBreakdown: confidenceScore,
      riskFlags,
      traceId,
      entityId,
      journeyType: journeyType as "job" | "invoice" | "payment",
    });
  }

  // AUTOPAY PATH - preferred method exists and autopay enabled
  if (
    profile?.autopayEnabled &&
    preferredMethod &&
    amount <= (policy.maxAutopayAmount ?? Infinity)
  ) {
    // High-value transactions require customer confirmation
    if (amount > (policy.requireCustomerConfirmationOver ?? Infinity)) {
      return buildDecision({
        decision: "send_text_to_pay",
        commands: [
          buildCreatePaymentSessionCommand({
            customerId,
            businessId,
            amount,
            currency: "USD",
            allowedMethods: profile.allowedMethods as any[] || ["APPLE_PAY", "GOOGLE_PAY", "CARD"],
            channel: "sms",
            jobId,
            invoiceId,
            traceId,
            entityId,
            policyHash,
          }),
        ],
        confidence: confidenceScore.overall,
        confidenceBreakdown: confidenceScore,
        riskFlags,
        traceId,
        entityId,
        journeyType: journeyType as "job" | "invoice" | "payment",
      });
    }

    // Direct autopay capture
    return buildDecision({
      decision: "autopay_capture",
      commands: [
        buildCapturePaymentCommand({
          customerId,
          businessId,
          paymentMethodId: preferredMethod.id,
          amount,
          currency: "USD",
          captureType: isFirstService ? "first_service" : "autopay",
          jobId,
          invoiceId,
          traceId,
          entityId,
          policyHash,
        }),
      ],
      confidence: confidenceScore.overall,
      confidenceBreakdown: confidenceScore,
      riskFlags,
      traceId,
      entityId,
      journeyType: journeyType as "job" | "invoice" | "payment",
    });
  }

  // INVOICE FALLBACK - policy forces invoice for high amounts
  if (policy.invoiceOnlyOver && amount > policy.invoiceOnlyOver) {
    return buildDecision({
      decision: "fallback_invoice",
      commands: [
        buildCreateInvoiceCommand({
          customerId,
          businessId,
          jobId: jobId!,
          amount,
          currency: "USD",
          reason: "amount_exceeds_threshold",
          traceId,
          entityId,
          policyHash,
        }),
      ],
      confidence: confidenceScore.overall,
      confidenceBreakdown: confidenceScore,
      riskFlags,
      traceId,
      entityId,
      journeyType: journeyType as "job" | "invoice" | "payment",
    });
  }

  // ON-DEMAND PAYMENT - customer has methods but autopay disabled
  if (paymentMethods.length > 0 && !profile?.autopayEnabled) {
    return buildDecision({
      decision: "send_text_to_pay",
      commands: [
        buildCreatePaymentSessionCommand({
          customerId,
          businessId,
          amount,
          currency: "USD",
          allowedMethods: profile?.allowedMethods as any[] || ["APPLE_PAY", "GOOGLE_PAY", "CARD"],
          channel: "sms",
          jobId,
          invoiceId,
          traceId,
          entityId,
          policyHash,
        }),
      ],
      confidence: confidenceScore.overall,
      confidenceBreakdown: confidenceScore,
      riskFlags,
      traceId,
      entityId,
      journeyType: journeyType as "job" | "invoice" | "payment",
    });
  }

  // NO PAYMENT METHOD - request setup
  if (paymentMethods.length === 0) {
    return buildDecision({
      decision: "request_setup",
      commands: [
        buildRequestPaymentSetupCommand({
          customerId,
          businessId,
          channels: ["sms"],
          context: "autopay_enrollment",
          jobId,
          traceId,
          entityId,
          policyHash,
        }),
      ],
      confidence: confidenceScore.overall,
      confidenceBreakdown: confidenceScore,
      riskFlags: [...riskFlags, "METHOD_UNAVAILABLE"],
      traceId,
      entityId,
      journeyType: journeyType as "job" | "invoice" | "payment",
    });
  }

  // FALLBACK INVOICE - when policy allows
  if (policy.allowInvoiceInsteadOfPay) {
    return buildDecision({
      decision: "fallback_invoice",
      commands: [
        buildCreateInvoiceCommand({
          customerId,
          businessId,
          jobId: jobId!,
          amount,
          currency: "USD",
          reason: "policy_requires_invoice",
          traceId,
          entityId,
          policyHash,
        }),
      ],
      confidence: confidenceScore.overall,
      confidenceBreakdown: confidenceScore,
      riskFlags,
      traceId,
      entityId,
      journeyType: journeyType as "job" | "invoice" | "payment",
    });
  }

  // ESCALATE - cannot determine path
  return escalateDecision(
    traceId,
    entityId,
    journeyType as "job" | "invoice" | "payment",
    "PAYMENT_RISK",
    "Unable to determine payment path",
    "FINANCE"
  );
}

// ============================================
// Confidence Scoring
// ============================================

interface ConfidenceInput {
  hasProfile: boolean;
  hasPreferredMethod: boolean;
  autopayEnabled: boolean;
  hasConsent: boolean;
  amount: number;
  policy: any;
  isFirstService: boolean;
}

interface ConfidenceBreakdown {
  dataCompleteness: number;
  policyCompliance: number;
  consentCertainty: number;
  methodAvailabilityCertainty: number;
  paymentRiskCertainty: number;
  overall: number;
}

function calculateConfidence(input: ConfidenceInput): ConfidenceBreakdown {
  const {
    hasProfile,
    hasPreferredMethod,
    autopayEnabled,
    hasConsent,
    amount,
    policy,
    isFirstService,
  } = input;

  // Data completeness: Do we have all required data?
  let dataCompleteness = 0.5; // Base score
  if (hasProfile) dataCompleteness += 0.2;
  if (hasPreferredMethod) dataCompleteness += 0.3;

  // Policy compliance: Does request fit within policy?
  let policyCompliance = 1.0;
  if (amount > (policy.maxAutopayAmount ?? Infinity)) policyCompliance -= 0.3;
  if (isFirstService && policy.firstServiceRequiresSetup && !hasPreferredMethod) {
    policyCompliance -= 0.2;
  }

  // Consent certainty: Do we have clear customer consent?
  const consentCertainty = hasConsent ? 1.0 : autopayEnabled ? 0.7 : 0.3;

  // Method availability: Can we execute payment?
  const methodAvailabilityCertainty = hasPreferredMethod ? 1.0 : 0.0;

  // Payment risk: Low risk = high certainty
  let paymentRiskCertainty = 0.9; // Base high certainty
  if (amount > 1000) paymentRiskCertainty -= 0.2;
  if (isFirstService) paymentRiskCertainty -= 0.1;

  // Overall: weighted average
  const overall =
    dataCompleteness * 0.2 +
    policyCompliance * 0.25 +
    consentCertainty * 0.2 +
    methodAvailabilityCertainty * 0.2 +
    paymentRiskCertainty * 0.15;

  return {
    dataCompleteness,
    policyCompliance,
    consentCertainty,
    methodAvailabilityCertainty,
    paymentRiskCertainty,
    overall: Math.max(0, Math.min(1, overall)),
  };
}

// ============================================
// Risk Flag Detection
// ============================================

interface RiskFlagInput {
  profile: any;
  preferredMethod: any;
  paymentMethods: any[];
  amount: number;
  policy: any;
  isFirstService: boolean;
}

type RiskFlag =
  | "PAYMENT_RISK"
  | "CONSENT_MISSING"
  | "POLICY_VIOLATION"
  | "AMOUNT_THRESHOLD_EXCEEDED"
  | "METHOD_UNAVAILABLE"
  | "CUSTOMER_DISPUTE_HISTORY"
  | "FIRST_SERVICE_NO_SETUP";

function detectRiskFlags(input: RiskFlagInput): RiskFlag[] {
  const { profile, preferredMethod, paymentMethods, amount, policy, isFirstService } = input;
  const flags: RiskFlag[] = [];

  // No consent records
  if (!profile || !(profile.consentRecords as any[])?.length) {
    flags.push("CONSENT_MISSING");
  }

  // No payment method available
  if (paymentMethods.length === 0) {
    flags.push("METHOD_UNAVAILABLE");
  }

  // Amount exceeds autopay threshold
  if (amount > (policy.maxAutopayAmount ?? Infinity)) {
    flags.push("AMOUNT_THRESHOLD_EXCEEDED");
  }

  // First service without setup
  if (isFirstService && policy.firstServiceRequiresSetup && !preferredMethod) {
    flags.push("FIRST_SERVICE_NO_SETUP");
  }

  // High-value transaction risk
  if (amount > 1000) {
    flags.push("PAYMENT_RISK");
  }

  return flags;
}

// ============================================
// Decision Builders
// ============================================

interface BuildDecisionInput {
  decision: "autopay_capture" | "request_setup" | "send_text_to_pay" | "create_in_app_session" | "fallback_invoice" | "escalate";
  commands: any[];
  confidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
  riskFlags: RiskFlag[];
  traceId: string;
  entityId: string;
  journeyType: "job" | "invoice" | "payment";
}

function buildDecision(input: BuildDecisionInput): PaymentAgentDecision {
  const { decision, commands, confidence, confidenceBreakdown, riskFlags, traceId, entityId, journeyType } = input;

  // Determine if human intervention required
  const humanRequired = confidence < 0.70 || riskFlags.some(f =>
    ["PAYMENT_RISK", "POLICY_VIOLATION", "CUSTOMER_DISPUTE_HISTORY"].includes(f)
  );

  return validatePaymentAgentDecision({
    decision,
    commands,
    confidence,
    confidenceBreakdown,
    riskFlags,
    humanRequired,
    handoffReason: humanRequired ? "Low confidence or high risk flags" : null,
    handoffToRole: humanRequired ? (riskFlags.includes("POLICY_VIOLATION") ? "OPS" : "FINANCE") : null,
    traceId,
    entityId,
    journeyType,
  });
}

function escalateDecision(
  traceId: string,
  entityId: string,
  journeyType: "job" | "invoice" | "payment",
  riskFlag: RiskFlag,
  reason: string,
  role: "FINANCE" | "OPS"
): PaymentAgentDecision {
  return validatePaymentAgentDecision({
    decision: "escalate",
    commands: [],
    confidence: 0.0,
    confidenceBreakdown: {
      dataCompleteness: 0,
      policyCompliance: 0,
      consentCertainty: 0,
      methodAvailabilityCertainty: 0,
      paymentRiskCertainty: 0,
    },
    riskFlags: [riskFlag],
    humanRequired: true,
    handoffReason: reason,
    handoffToRole: role,
    traceId,
    entityId,
    journeyType,
  });
}

// ============================================
// Command Builders
// ============================================

function generateIdempotencyKey(prefix: string, entityId: string, traceId: string): string {
  return crypto.createHash("sha256").update(`${prefix}-${entityId}-${traceId}`).digest("hex").substring(0, 32);
}

function hashPolicy(policy: any): string {
  return crypto.createHash("sha256").update(JSON.stringify(policy)).digest("hex").substring(0, 16);
}

function buildRequestPaymentSetupCommand(params: {
  customerId: number;
  businessId: number;
  channels: ("sms" | "in_app" | "email")[];
  context: "first_service" | "autopay_enrollment" | "payment_method_update";
  jobId?: number;
  traceId: string;
  entityId: string;
  policyHash: string;
}): PaymentCommand {
  return {
    type: "RequestPaymentSetup" as const,
    customerId: params.customerId,
    businessId: params.businessId,
    channels: params.channels,
    context: params.context,
    jobId: params.jobId,
    idempotencyKey: generateIdempotencyKey("setup", params.entityId, params.traceId),
    traceId: params.traceId,
    entityId: params.entityId,
    policySnapshotHash: params.policyHash,
  };
}

function buildCreatePaymentSessionCommand(params: {
  customerId: number;
  businessId: number;
  amount: number;
  currency: string;
  allowedMethods: ("APPLE_PAY" | "GOOGLE_PAY" | "CARD")[];
  channel: "sms" | "in_app" | "email";
  jobId?: number;
  invoiceId?: number;
  traceId: string;
  entityId: string;
  policyHash: string;
}): PaymentCommand {
  return {
    type: "CreatePaymentSession" as const,
    customerId: params.customerId,
    businessId: params.businessId,
    amount: params.amount,
    currency: params.currency,
    allowedMethods: params.allowedMethods,
    channel: params.channel,
    jobId: params.jobId,
    invoiceId: params.invoiceId,
    idempotencyKey: generateIdempotencyKey("session", params.entityId, params.traceId),
    traceId: params.traceId,
    entityId: params.entityId,
    policySnapshotHash: params.policyHash,
  };
}

function buildCapturePaymentCommand(params: {
  customerId: number;
  businessId: number;
  paymentMethodId: number;
  amount: number;
  currency: string;
  captureType: "autopay" | "on_demand" | "invoice_payment" | "first_service";
  jobId?: number;
  invoiceId?: number;
  traceId: string;
  entityId: string;
  policyHash: string;
}): PaymentCommand {
  return {
    type: "CapturePayment" as const,
    customerId: params.customerId,
    businessId: params.businessId,
    paymentMethodId: params.paymentMethodId,
    amount: params.amount,
    currency: params.currency,
    captureType: params.captureType,
    jobId: params.jobId,
    invoiceId: params.invoiceId,
    idempotencyKey: generateIdempotencyKey("capture", params.entityId, params.traceId),
    traceId: params.traceId,
    entityId: params.entityId,
    policySnapshotHash: params.policyHash,
  };
}

function buildCreateInvoiceCommand(params: {
  customerId: number;
  businessId: number;
  jobId: number;
  amount: number;
  currency: string;
  reason: "autopay_disabled" | "no_payment_method" | "amount_exceeds_threshold" | "payment_failed" | "customer_opted_out" | "policy_requires_invoice";
  traceId: string;
  entityId: string;
  policyHash: string;
}): PaymentCommand {
  return {
    type: "CreateInvoice" as const,
    customerId: params.customerId,
    businessId: params.businessId,
    jobId: params.jobId,
    amount: params.amount,
    currency: params.currency,
    reason: params.reason,
    idempotencyKey: generateIdempotencyKey("invoice", params.entityId, params.traceId),
    traceId: params.traceId,
    entityId: params.entityId,
    policySnapshotHash: params.policyHash,
  };
}
