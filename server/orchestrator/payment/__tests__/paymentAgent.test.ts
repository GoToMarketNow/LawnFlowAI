import { describe, it, expect, beforeEach } from "vitest";
import { runPaymentAgent, type PaymentAgentContext } from "../paymentAgent";

// ============================================
// Payment Agent Tests
// ============================================

describe("Payment Agent Decision Logic", () => {
  let mockDb: any;

  beforeEach(() => {
    // Mock database
    mockDb = {
      query: {
        operatorPaymentPolicies: {
          findFirst: async () => ({
            businessId: 1,
            maxAutopayAmount: 500,
            requireCustomerConfirmationOver: 200,
            allowInvoiceInsteadOfPay: true,
            invoiceOnlyOver: 1000,
            firstServiceRequiresSetup: true,
            allowedPaymentMethods: ["APPLE_PAY", "GOOGLE_PAY", "CARD"],
            paymentFailureRetryCount: 3,
            paymentSlaMiuntes: 60,
          }),
        },
        customerPaymentProfiles: {
          findFirst: async () => null,
        },
        paymentMethods: {
          findMany: async () => [],
        },
      },
    };
  });

  describe("First Service Flow", () => {
    it("should request payment setup for first service with no payment method", async () => {
      const context: PaymentAgentContext = {
        jobId: 1,
        customerId: 100,
        businessId: 1,
        amount: 150,
        currency: "USD",
        trigger: "job_completed",
        isFirstService: true,
        traceId: "test-trace-1",
      };

      const decision = await runPaymentAgent({ db: mockDb, context });

      expect(decision.decision).toBe("request_setup");
      expect(decision.commands).toHaveLength(1);
      expect(decision.commands[0].type).toBe("RequestPaymentSetup");
      expect(decision.humanRequired).toBe(false);
    });

    it("should capture payment for first service with existing method", async () => {
      mockDb.query.customerPaymentProfiles.findFirst = async () => ({
        customerId: 100,
        preferredPaymentMethodId: 1,
        autopayEnabled: true,
        allowedMethods: ["CARD"],
        consentRecords: [{ timestamp: new Date(), channel: "sms" }],
      });

      mockDb.query.paymentMethods.findMany = async () => [
        {
          id: 1,
          customerId: 100,
          type: "CARD",
          providerTokenRef: "pm_test",
          isActive: true,
        },
      ];

      const context: PaymentAgentContext = {
        jobId: 1,
        customerId: 100,
        businessId: 1,
        amount: 150,
        currency: "USD",
        trigger: "job_completed",
        isFirstService: true,
        traceId: "test-trace-2",
      };

      const decision = await runPaymentAgent({ db: mockDb, context });

      expect(decision.decision).toBe("autopay_capture");
      expect(decision.commands).toHaveLength(1);
      expect(decision.commands[0].type).toBe("CapturePayment");
      expect(decision.commands[0].captureType).toBe("first_service");
    });
  });

  describe("Autopay Flow", () => {
    beforeEach(() => {
      mockDb.query.customerPaymentProfiles.findFirst = async () => ({
        customerId: 100,
        preferredPaymentMethodId: 1,
        autopayEnabled: true,
        allowedMethods: ["CARD"],
        consentRecords: [{ timestamp: new Date(), channel: "sms" }],
      });

      mockDb.query.paymentMethods.findMany = async () => [
        {
          id: 1,
          customerId: 100,
          type: "CARD",
          providerTokenRef: "pm_test",
          isActive: true,
        },
      ];
    });

    it("should capture payment directly for autopay under threshold", async () => {
      const context: PaymentAgentContext = {
        jobId: 1,
        customerId: 100,
        businessId: 1,
        amount: 150, // Under $200 confirmation threshold
        currency: "USD",
        trigger: "job_completed",
        isFirstService: false,
        traceId: "test-trace-3",
      };

      const decision = await runPaymentAgent({ db: mockDb, context });

      expect(decision.decision).toBe("autopay_capture");
      expect(decision.confidence).toBeGreaterThan(0.8);
      expect(decision.riskFlags).not.toContain("AMOUNT_THRESHOLD_EXCEEDED");
    });

    it("should require confirmation for autopay over confirmation threshold", async () => {
      const context: PaymentAgentContext = {
        jobId: 1,
        customerId: 100,
        businessId: 1,
        amount: 250, // Over $200 confirmation threshold
        currency: "USD",
        trigger: "job_completed",
        isFirstService: false,
        traceId: "test-trace-4",
      };

      const decision = await runPaymentAgent({ db: mockDb, context });

      expect(decision.decision).toBe("send_text_to_pay");
      expect(decision.commands).toHaveLength(1);
      expect(decision.commands[0].type).toBe("CreatePaymentSession");
    });

    it("should fallback to invoice for amount exceeding max autopay", async () => {
      const context: PaymentAgentContext = {
        jobId: 1,
        customerId: 100,
        businessId: 1,
        amount: 1500, // Over $1000 invoice-only threshold
        currency: "USD",
        trigger: "job_completed",
        isFirstService: false,
        traceId: "test-trace-5",
      };

      const decision = await runPaymentAgent({ db: mockDb, context });

      expect(decision.decision).toBe("fallback_invoice");
      expect(decision.commands).toHaveLength(1);
      expect(decision.commands[0].type).toBe("CreateInvoice");
      expect(decision.commands[0].reason).toBe("amount_exceeds_threshold");
    });
  });

  describe("Confidence Scoring", () => {
    it("should have low confidence with no payment method", async () => {
      const context: PaymentAgentContext = {
        jobId: 1,
        customerId: 100,
        businessId: 1,
        amount: 150,
        currency: "USD",
        trigger: "job_completed",
        isFirstService: false,
        traceId: "test-trace-6",
      };

      const decision = await runPaymentAgent({ db: mockDb, context });

      expect(decision.confidence).toBeLessThan(0.7);
      expect(decision.confidenceBreakdown.methodAvailabilityCertainty).toBe(0);
    });

    it("should have high confidence with complete profile and method", async () => {
      mockDb.query.customerPaymentProfiles.findFirst = async () => ({
        customerId: 100,
        preferredPaymentMethodId: 1,
        autopayEnabled: true,
        allowedMethods: ["CARD"],
        consentRecords: [{ timestamp: new Date(), channel: "sms" }],
      });

      mockDb.query.paymentMethods.findMany = async () => [
        {
          id: 1,
          customerId: 100,
          type: "CARD",
          providerTokenRef: "pm_test",
          isActive: true,
        },
      ];

      const context: PaymentAgentContext = {
        jobId: 1,
        customerId: 100,
        businessId: 1,
        amount: 100,
        currency: "USD",
        trigger: "job_completed",
        isFirstService: false,
        traceId: "test-trace-7",
      };

      const decision = await runPaymentAgent({ db: mockDb, context });

      expect(decision.confidence).toBeGreaterThan(0.85);
      expect(decision.confidenceBreakdown.dataCompleteness).toBeGreaterThan(0.8);
      expect(decision.confidenceBreakdown.methodAvailabilityCertainty).toBe(1.0);
    });
  });

  describe("Risk Flags", () => {
    it("should flag missing consent", async () => {
      mockDb.query.customerPaymentProfiles.findFirst = async () => ({
        customerId: 100,
        preferredPaymentMethodId: 1,
        autopayEnabled: true,
        allowedMethods: ["CARD"],
        consentRecords: [], // No consent
      });

      mockDb.query.paymentMethods.findMany = async () => [
        {
          id: 1,
          customerId: 100,
          type: "CARD",
          providerTokenRef: "pm_test",
          isActive: true,
        },
      ];

      const context: PaymentAgentContext = {
        jobId: 1,
        customerId: 100,
        businessId: 1,
        amount: 150,
        currency: "USD",
        trigger: "job_completed",
        isFirstService: false,
        traceId: "test-trace-8",
      };

      const decision = await runPaymentAgent({ db: mockDb, context });

      expect(decision.riskFlags).toContain("CONSENT_MISSING");
    });

    it("should flag high-value transactions", async () => {
      mockDb.query.customerPaymentProfiles.findFirst = async () => ({
        customerId: 100,
        preferredPaymentMethodId: 1,
        autopayEnabled: true,
        allowedMethods: ["CARD"],
        consentRecords: [{ timestamp: new Date() }],
      });

      mockDb.query.paymentMethods.findMany = async () => [
        {
          id: 1,
          customerId: 100,
          type: "CARD",
          providerTokenRef: "pm_test",
          isActive: true,
        },
      ];

      const context: PaymentAgentContext = {
        jobId: 1,
        customerId: 100,
        businessId: 1,
        amount: 1200, // High value
        currency: "USD",
        trigger: "job_completed",
        isFirstService: false,
        traceId: "test-trace-9",
      };

      const decision = await runPaymentAgent({ db: mockDb, context });

      expect(decision.riskFlags).toContain("PAYMENT_RISK");
    });
  });

  describe("Policy Enforcement", () => {
    it("should escalate when no policy configured", async () => {
      mockDb.query.operatorPaymentPolicies.findFirst = async () => null;

      const context: PaymentAgentContext = {
        jobId: 1,
        customerId: 100,
        businessId: 1,
        amount: 150,
        currency: "USD",
        trigger: "job_completed",
        isFirstService: false,
        traceId: "test-trace-10",
      };

      const decision = await runPaymentAgent({ db: mockDb, context });

      expect(decision.decision).toBe("escalate");
      expect(decision.humanRequired).toBe(true);
      expect(decision.handoffToRole).toBe("OPS");
    });
  });
});

// ============================================
// Idempotency Tests
// ============================================

describe("Payment Command Idempotency", () => {
  it("should generate consistent idempotency keys", () => {
    // Idempotency key generation is deterministic based on entity + trace
    // Test that same inputs produce same keys
    // (This would be tested in commandHandlers.test.ts)
  });

  it("should skip duplicate command execution", async () => {
    // Test that executing same command twice only processes once
  });
});
