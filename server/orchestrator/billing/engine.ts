/**
 * Billing Orchestrator Engine
 * 
 * Manages the post-job-completion billing lifecycle:
 * 1. JOB_COMPLETED -> Invoice generation via InvoiceBuildAgent
 * 2. INVOICE_SENT -> Payment tracking
 * 3. PAYMENT_RECEIVED -> Accounting sync
 * 4. DISPUTE_DETECTED -> Remediation flow via RemediationAgent
 */

import { db } from "../../db";
import { 
  jobs, 
  invoices, 
  billingIssues,
  auditLogs,
  payments,
  businessProfiles,
  policyProfiles,
} from "@shared/schema";
import { eq, and, lt, isNull, gt, sql } from "drizzle-orm";
import { runInvoiceBuildAgent, type PricingRules } from "../../agents/billing";
import { storage } from "../../storage";

// Billing lifecycle stages
export const BillingStages = [
  "JOB_COMPLETED",
  "INVOICE_DRAFT",
  "INVOICE_PENDING_APPROVAL",
  "INVOICE_SENT",
  "PAYMENT_PENDING",
  "PAYMENT_RECEIVED",
  "ACCOUNTING_SYNCED",
  "CLOSED",
  // Exception paths
  "OVERDUE",
  "DISPUTE",
  "REMEDIATION",
] as const;
export type BillingStage = typeof BillingStages[number];

interface StageResult {
  success: boolean;
  nextStage?: BillingStage;
  requiresApproval?: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

/**
 * Build pricing rules from business profile and policy (account-scoped)
 */
async function buildPricingRules(accountId: number): Promise<PricingRules> {
  // Use accountId to get the specific business profile
  const profile = await storage.getBusinessProfile(accountId);
  // getPolicyProfile expects businessId which is accountId (same as businessProfiles.id)
  const policy = await storage.getPolicyProfile(accountId);
  
  // Base rates from business profile
  let baseRates: Record<string, number> = {
    mowing: profile?.mowingMinPrice ?? 4500,
    cleanup: profile?.cleanupMinPrice ?? 15000,
    mulch: profile?.mulchMinPrice ?? 20000,
    general: 5000,
  };
  
  // Initialize optional pricing fields
  let sqftRate: number | undefined;
  let hourlyRate: number | undefined;
  let minimumCharge: number | undefined;
  
  // Apply policy-based overrides if available
  if (policy?.pricingRulesJson && typeof policy.pricingRulesJson === "object") {
    const policyRates = policy.pricingRulesJson as Record<string, unknown>;
    if (policyRates.baseRates && typeof policyRates.baseRates === "object") {
      baseRates = { ...baseRates, ...(policyRates.baseRates as Record<string, number>) };
    }
    // Apply additional pricing fields from policy
    if (typeof policyRates.sqftRate === "number") {
      sqftRate = policyRates.sqftRate;
    }
    if (typeof policyRates.hourlyRate === "number") {
      hourlyRate = policyRates.hourlyRate;
    }
    if (typeof policyRates.minimumCharge === "number") {
      minimumCharge = policyRates.minimumCharge;
    }
  }
  
  // Tax rate is stored as percentage * 100 (e.g., 750 = 7.5%)
  // Convert to decimal: 750 / 10000 = 0.075
  const rules: PricingRules = {
    baseRates,
    sqftRate,
    hourlyRate,
    minimumCharge,
    taxRate: profile?.taxEnabled && profile?.defaultTaxRate 
      ? profile.defaultTaxRate / 10000 
      : 0,
  };
  
  return rules;
}

/**
 * Process a job completion event and generate invoice via InvoiceBuildAgent
 */
export async function handleJobCompleted(
  accountId: number,
  jobId: number
): Promise<StageResult> {
  console.log(`[BillingOrchestrator] Processing job completion: ${jobId}`);

  try {
    // Get job details
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.businessId, accountId)))
      .limit(1);

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    if (job.status !== "completed") {
      return { success: false, error: "Job is not completed" };
    }

    // Check if invoice already exists
    const existingInvoice = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.jobId, jobId), eq(invoices.accountId, accountId)))
      .limit(1);

    if (existingInvoice.length > 0) {
      console.log(`[BillingOrchestrator] Invoice already exists for job ${jobId}`);
      const status = existingInvoice[0].status?.toUpperCase() || "DRAFT";
      return {
        success: true,
        nextStage: status === "DRAFT" ? "INVOICE_PENDING_APPROVAL" : "INVOICE_SENT",
        data: { invoiceId: existingInvoice[0].id },
      };
    }

    // Build pricing rules from business profile (account-scoped)
    const pricing = await buildPricingRules(accountId);
    
    // Get business name (account-scoped)
    const profile = await storage.getBusinessProfile(accountId);
    const businessName = profile?.name || "LawnFlow";

    // Prepare job data for InvoiceBuildAgent
    // Note: jobs table stores customerName/customerPhone directly, not customerId FK
    // customerId is now optional in JobDataForInvoice - invoices table has nullable customerId
    // Note: jobs table doesn't have completedAt field, using scheduledDate as best available
    // Future enhancement: add completedAt column to jobs table for accurate timestamps
    const jobData = {
      id: job.id,
      title: job.serviceType || "Service",
      description: job.notes,
      // customerId omitted - jobs table stores customer info inline
      customerName: job.customerName || undefined,
      customerPhone: job.customerPhone || undefined,
      serviceType: job.serviceType || "general",
      scheduledDate: job.scheduledDate,
      completedDate: job.scheduledDate, // jobs table lacks completedAt - using scheduledDate
      notes: job.notes,
      status: "COMPLETED",
      quoteAmount: job.estimatedPrice || undefined,
    };

    // Call InvoiceBuildAgent
    const invoiceResult = await runInvoiceBuildAgent(
      jobData,
      accountId,
      pricing,
      businessName
    );

    if (!invoiceResult.success || !invoiceResult.invoice) {
      return { 
        success: false, 
        error: invoiceResult.error || "Failed to generate invoice" 
      };
    }

    // Log audit event
    await db.insert(auditLogs).values({
      action: "invoice_generated",
      entityType: "invoice",
      entityId: invoiceResult.invoice.id,
      details: {
        jobId,
        confidence: invoiceResult.confidence,
        reasoning: invoiceResult.reasoning,
      },
    });

    // Determine if approval needed based on confidence or value
    const requiresApproval = 
      (invoiceResult.confidence && invoiceResult.confidence < 0.8) ||
      (invoiceResult.invoice.total > 50000); // $500+

    if (requiresApproval) {
      // Update invoice status to pending approval
      await db.update(invoices)
        .set({ status: "PENDING_APPROVAL", updatedAt: new Date() })
        .where(eq(invoices.id, invoiceResult.invoice.id));
    }

    return {
      success: true,
      nextStage: requiresApproval ? "INVOICE_PENDING_APPROVAL" : "INVOICE_DRAFT",
      requiresApproval,
      data: {
        invoiceId: invoiceResult.invoice.id,
        confidence: invoiceResult.confidence,
      },
    };
  } catch (error) {
    console.error(`[BillingOrchestrator] Error processing job ${jobId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check for overdue invoices and create billing issues
 */
export async function checkOverdueInvoices(accountId: number): Promise<{
  processed: number;
  overdueCount: number;
  issues: number[];
}> {
  const now = new Date();
  const results = { processed: 0, overdueCount: 0, issues: [] as number[] };

  try {
    // Find invoices that are sent but past due date (handle both SENT and sent)
    const overdueInvoices = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.accountId, accountId),
          sql`UPPER(${invoices.status}) = 'SENT'`,
          lt(invoices.dueDate, now)
        )
      );

    for (const invoice of overdueInvoices) {
      results.processed++;
      
      // Guard for null dueDate
      if (!invoice.dueDate) continue;
      
      results.overdueCount++;

      // Check if there's already an overdue billing issue
      const existingIssue = await db
        .select()
        .from(billingIssues)
        .where(
          and(
            eq(billingIssues.relatedInvoiceId, invoice.id),
            eq(billingIssues.type, "OVERDUE")
          )
        )
        .limit(1);

      if (existingIssue.length === 0) {
        const daysOverdue = Math.floor(
          (now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        const severity = daysOverdue > 30 ? "HIGH" : daysOverdue > 14 ? "MED" : "LOW";

        const [issue] = await db
          .insert(billingIssues)
          .values({
            accountId,
            relatedInvoiceId: invoice.id,
            type: "OVERDUE",
            severity,
            summary: `Invoice #${invoice.invoiceNumber || invoice.id} is ${daysOverdue} days overdue`,
            detailsJson: { daysOverdue, amountCents: invoice.total },
          })
          .returning();

        results.issues.push(issue.id);

        await db.insert(auditLogs).values({
          action: "overdue_invoice_detected",
          entityType: "billing_issue",
          entityId: issue.id,
          details: { invoiceId: invoice.id, daysOverdue },
        });
      }
    }

    return results;
  } catch (error) {
    console.error(`[BillingOrchestrator] Error checking overdue invoices:`, error);
    throw error;
  }
}

/**
 * Handle a dispute detected event - creates billing issue for RemediationAgent
 */
export async function handleDisputeDetected(
  accountId: number,
  invoiceId: number,
  reason: string
): Promise<StageResult> {
  console.log(`[BillingOrchestrator] Dispute detected for invoice ${invoiceId}`);

  try {
    // Verify invoice exists
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.accountId, accountId)))
      .limit(1);
      
    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Create billing issue for RemediationAgent to process
    const [issue] = await db
      .insert(billingIssues)
      .values({
        accountId,
        relatedInvoiceId: invoiceId,
        relatedJobId: invoice.jobId,
        type: "DISPUTE",
        severity: "HIGH",
        status: "OPEN",
        summary: reason,
        detailsJson: { source: "customer_complaint", invoiceTotal: invoice.total },
      })
      .returning();

    // Update invoice status
    await db.update(invoices)
      .set({ status: "DISPUTED", updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId));

    await db.insert(auditLogs).values({
      action: "dispute_created",
      entityType: "billing_issue",
      entityId: issue.id,
      details: { invoiceId, reason },
    });

    return {
      success: true,
      nextStage: "REMEDIATION",
      data: { billingIssueId: issue.id },
    };
  } catch (error) {
    console.error(`[BillingOrchestrator] Error handling dispute:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Handle payment received event - creates payment record and updates invoice
 */
export async function handlePaymentReceived(
  accountId: number,
  invoiceId: number,
  amountCents: number,
  paymentMethod: "CASH" | "CHECK" | "CARD" | "ACH" | "UNKNOWN" = "UNKNOWN"
): Promise<StageResult> {
  console.log(`[BillingOrchestrator] Payment received for invoice ${invoiceId}`);

  try {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.accountId, accountId)))
      .limit(1);

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Create payment record via storage
    const payment = await storage.createPayment({
      accountId,
      invoiceId,
      amount: amountCents,
      method: paymentMethod,
      status: "SUCCEEDED",
    });

    // Get total payments for this invoice
    const paymentSum = await db
      .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId));

    const totalPaid = paymentSum[0]?.total || 0;
    const invoiceTotal = invoice.total || 0;
    const remainingCents = invoiceTotal - totalPaid;
    
    const newStatus = remainingCents <= 0 ? "PAID" : "PARTIAL";

    // Only set paidAt when fully paid; explicitly null it for partial to keep accounting accurate
    await db
      .update(invoices)
      .set({
        status: newStatus,
        paidAt: newStatus === "PAID" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    await db.insert(auditLogs).values({
      action: "payment_received",
      entityType: "invoice",
      entityId: invoiceId,
      details: { amountCents, totalPaid, remainingCents, paymentMethod, paymentId: payment.id },
    });

    // Check for overpayment
    if (remainingCents < 0) {
      const [issue] = await db
        .insert(billingIssues)
        .values({
          accountId,
          relatedInvoiceId: invoiceId,
          type: "VARIANCE",
          severity: "MED",
          summary: `Overpayment detected: ${Math.abs(remainingCents)} cents`,
          detailsJson: { overpaymentCents: Math.abs(remainingCents), paymentId: payment.id },
        })
        .returning();

      return {
        success: true,
        nextStage: "ACCOUNTING_SYNCED",
        data: { invoiceId, totalPaid, overpayment: true, billingIssueId: issue.id, paymentId: payment.id },
      };
    }

    return {
      success: true,
      nextStage: newStatus === "PAID" ? "ACCOUNTING_SYNCED" : "PAYMENT_PENDING",
      data: { invoiceId, totalPaid, remainingCents, paymentId: payment.id },
    };
  } catch (error) {
    console.error(`[BillingOrchestrator] Error handling payment:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get billing dashboard summary for an account
 */
export async function getBillingSummary(accountId: number): Promise<{
  pendingInvoices: number;
  overdueInvoices: number;
  activeDisputes: number;
  totalOutstandingCents: number;
  recentPaymentsCents: number;
}> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get pending invoices (handle case sensitivity)
  const pendingResult = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.accountId, accountId),
        sql`UPPER(${invoices.status}) = 'SENT'`
      )
    );

  const pendingInvoices = pendingResult.length;
  
  // Calculate outstanding: invoice total minus payments
  let totalOutstandingCents = 0;
  for (const inv of pendingResult) {
    const paymentSum = await db
      .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
      .from(payments)
      .where(eq(payments.invoiceId, inv.id));
    const paid = paymentSum[0]?.total || 0;
    totalOutstandingCents += (inv.total || 0) - paid;
  }

  // Get overdue invoices
  const overdueResult = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.accountId, accountId),
        sql`UPPER(${invoices.status}) = 'SENT'`,
        lt(invoices.dueDate, now)
      )
    );
  const overdueInvoices = overdueResult.length;

  // Get active disputes
  const disputeResult = await db
    .select()
    .from(billingIssues)
    .where(
      and(
        eq(billingIssues.accountId, accountId),
        eq(billingIssues.type, "DISPUTE"),
        isNull(billingIssues.resolvedAt)
      )
    );
  const activeDisputes = disputeResult.length;

  // Get recent payments - sum all payments in last 30 days for this account's invoices
  const recentPaymentsResult = await db
    .select({ total: sql<number>`COALESCE(SUM(p.amount), 0)` })
    .from(payments)
    .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(
      and(
        eq(invoices.accountId, accountId),
        gt(payments.createdAt, thirtyDaysAgo)
      )
    );
  const recentPaymentsCents = recentPaymentsResult[0]?.total || 0;

  return {
    pendingInvoices,
    overdueInvoices,
    activeDisputes,
    totalOutstandingCents,
    recentPaymentsCents,
  };
}
