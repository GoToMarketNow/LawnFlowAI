/**
 * Billing Temporal Workflow
 * Sprint 5: Full Migration
 *
 * This workflow handles the full billing lifecycle:
 * 1. Invoice generation after job completion
 * 2. Payment collection with reminders
 * 3. Reconciliation and dispute handling
 */

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  sleep,
  workflowInfo,
  ApplicationFailure,
} from "@temporalio/workflow";

// =============================================================================
// Activity Proxies
// =============================================================================

const activities = proxyActivities<{
  // Billing activities
  buildInvoiceActivity: (input: any) => Promise<any>;
  getInvoiceActivity: (input: any) => Promise<any>;

  // Database activities
  recordWorkflowRunActivity: (input: any) => Promise<{ workflowRunId: number }>;
  updateWorkflowRunActivity: (input: any) => Promise<void>;
  recordWorkflowStepActivity: (input: any) => Promise<{ stepId: number }>;
  loadJobActivity: (input: any) => Promise<any>;
  loadCustomerActivity: (input: any) => Promise<any>;

  // Stripe activities
  createPaymentIntentActivity: (input: any) => Promise<any>;
  capturePaymentActivity: (input: any) => Promise<any>;
  getPaymentIntentActivity: (input: any) => Promise<any>;

  // Twilio activities
  sendSmsActivity: (input: any) => Promise<any>;
  sendPaymentLinkSmsActivity: (input: any) => Promise<any>;
  sendPaymentConfirmationSmsActivity: (input: any) => Promise<any>;
  sendReminderSmsActivity: (input: any) => Promise<any>;

  // Human task activities
  createHumanTaskActivity: (input: any) => Promise<{ taskId: string }>;

  // FinOps activities
  recordUsageActivity: (input: any) => Promise<any>;

  // Memory activities
  generateWorkflowSummaryActivity: (input: any) => Promise<any>;
}>({
  startToCloseTimeout: "5 minutes",
  retry: {
    maximumAttempts: 3,
    initialInterval: "1 second",
    maximumInterval: "30 seconds",
    backoffCoefficient: 2,
  },
});

// =============================================================================
// Signals and Queries
// =============================================================================

export interface PaymentReceivedSignalInput {
  paymentIntentId: string;
  amountPaid: number;
  paymentMethod: string;
  status: "succeeded" | "failed" | "canceled";
  timestamp: string;
}

export interface DisputeSignalInput {
  reason: string;
  customerMessage?: string;
  requestedAction: "refund" | "credit" | "review";
}

export interface ManualActionSignalInput {
  action: "send_reminder" | "escalate" | "write_off" | "mark_paid" | "cancel";
  userId: number;
  notes?: string;
  amount?: number;
}

// Signals
export const paymentReceivedSignal = defineSignal<[PaymentReceivedSignalInput]>("paymentReceived");
export const disputeSignal = defineSignal<[DisputeSignalInput]>("dispute");
export const manualActionSignal = defineSignal<[ManualActionSignalInput]>("manualAction");

// Queries
export const getStatusQuery = defineQuery<{
  stage: BillingStage;
  invoiceId?: number;
  invoiceTotal?: number;
  amountPaid: number;
  amountOutstanding: number;
  remindersSent: number;
  status: string;
}>("getStatus");

export const getPaymentHistoryQuery = defineQuery<Array<{
  timestamp: string;
  type: string;
  amount?: number;
  status: string;
}>>("getPaymentHistory");

// =============================================================================
// Workflow Types
// =============================================================================

export type BillingStage =
  | "INVOICE_GENERATION"
  | "AWAITING_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "PAYMENT_CONFIRMED"
  | "OVERDUE"
  | "DISPUTE"
  | "COLLECTIONS"
  | "COMPLETED"
  | "WRITTEN_OFF"
  | "CANCELED";

export interface BillingWorkflowInput {
  accountId: string;
  businessId: number;
  jobId: number;
  customerId?: number;
  customerPhone?: string;
  customerEmail?: string;
  amount?: number; // If known upfront (from quote)
  dueInDays?: number; // Default 30
  reminderCadenceDays?: number[]; // Default [7, 14, 21, 28]
  autoEscalateAfterDays?: number; // Default 45
}

export interface BillingWorkflowOutput {
  success: boolean;
  invoiceId?: number;
  finalStatus: BillingStage;
  totalPaid: number;
  totalOutstanding: number;
  remindersSent: number;
  paymentIntentId?: string;
}

// =============================================================================
// Main Workflow
// =============================================================================

export async function billingWorkflow(
  input: BillingWorkflowInput
): Promise<BillingWorkflowOutput> {
  const {
    accountId,
    businessId,
    jobId,
    customerId,
    customerPhone,
    customerEmail,
    amount,
    dueInDays = 30,
    reminderCadenceDays = [7, 14, 21, 28],
    autoEscalateAfterDays = 45,
  } = input;

  const { workflowId, runId } = workflowInfo();

  // Workflow state
  let stage: BillingStage = "INVOICE_GENERATION";
  let invoiceId: number | undefined;
  let invoiceTotal = amount || 0;
  let amountPaid = 0;
  let amountOutstanding = invoiceTotal;
  let remindersSent = 0;
  let paymentIntentId: string | undefined;
  let workflowRunId: number | undefined;
  let dueDate: Date | undefined;

  // Signal state
  let pendingPayment: PaymentReceivedSignalInput | null = null;
  let pendingDispute: DisputeSignalInput | null = null;
  let pendingManualAction: ManualActionSignalInput | null = null;

  // Payment history
  const paymentHistory: Array<{
    timestamp: string;
    type: string;
    amount?: number;
    status: string;
  }> = [];

  // =============================================================================
  // Signal Handlers
  // =============================================================================

  setHandler(paymentReceivedSignal, (payment) => {
    pendingPayment = payment;
    paymentHistory.push({
      timestamp: payment.timestamp,
      type: "payment",
      amount: payment.amountPaid,
      status: payment.status,
    });
  });

  setHandler(disputeSignal, (dispute) => {
    pendingDispute = dispute;
    paymentHistory.push({
      timestamp: new Date().toISOString(),
      type: "dispute",
      status: dispute.reason,
    });
  });

  setHandler(manualActionSignal, (action) => {
    pendingManualAction = action;
    paymentHistory.push({
      timestamp: new Date().toISOString(),
      type: "manual_action",
      status: action.action,
    });
  });

  // =============================================================================
  // Query Handlers
  // =============================================================================

  setHandler(getStatusQuery, () => ({
    stage,
    invoiceId,
    invoiceTotal,
    amountPaid,
    amountOutstanding,
    remindersSent,
    status: stage,
  }));

  setHandler(getPaymentHistoryQuery, () => paymentHistory);

  // =============================================================================
  // Record workflow start
  // =============================================================================

  try {
    const runRecord = await activities.recordWorkflowRunActivity({
      workflowId,
      runId,
      workflowType: "billing",
      accountId,
      businessId,
      primaryEntityType: "job",
      primaryEntityId: jobId,
      inputJson: input,
      taskQueue: "billing",
    });
    workflowRunId = runRecord.workflowRunId;
  } catch (err) {
    // Continue even if recording fails
  }

  // =============================================================================
  // Load job and customer data
  // =============================================================================

  let job: any;
  let customer: any;

  try {
    job = await activities.loadJobActivity({ jobId });
    if (customerId) {
      customer = await activities.loadCustomerActivity({ customerId });
    }
  } catch (err) {
    throw ApplicationFailure.nonRetryable(`Failed to load job data: ${err}`);
  }

  // =============================================================================
  // Stage 1: Invoice Generation
  // =============================================================================

  try {
    const invoiceResult = await activities.buildInvoiceActivity({
      accountId: parseInt(accountId),
      jobId,
      customerId,
      businessId,
    });

    if (!invoiceResult.success) {
      throw new Error(invoiceResult.error || "Invoice generation failed");
    }

    invoiceId = invoiceResult.invoice.id;
    invoiceTotal = invoiceResult.invoice.total;
    amountOutstanding = invoiceTotal;
    dueDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);

    paymentHistory.push({
      timestamp: new Date().toISOString(),
      type: "invoice_created",
      amount: invoiceTotal,
      status: "success",
    });

    stage = "AWAITING_PAYMENT";

    // Record step
    await activities.recordWorkflowStepActivity({
      workflowRunId,
      activityType: "invoice_generation",
      activityId: `${workflowId}-invoice`,
      stepIndex: 1,
      inputJson: { jobId },
      outputJson: invoiceResult,
      status: "completed",
    });
  } catch (err) {
    // Create human task for manual invoice creation
    await activities.createHumanTaskActivity({
      workflowRunId,
      accountId,
      businessId,
      taskType: "invoice_creation",
      category: "billing",
      assignedRole: "billing_admin",
      title: `Manual invoice needed for Job #${jobId}`,
      description: `Auto-invoice failed: ${err}`,
      contextJson: { jobId, customerId, error: String(err) },
      priority: "high",
      signalName: "manualAction",
    });

    // Wait for manual resolution
    await condition(() => pendingManualAction !== null, "7 days");

    if (pendingManualAction?.action === "cancel") {
      stage = "CANCELED";
      return {
        success: false,
        finalStatus: stage,
        totalPaid: 0,
        totalOutstanding: 0,
        remindersSent: 0,
      };
    }

    pendingManualAction = null;
    // Retry invoice generation would happen here
  }

  // =============================================================================
  // Stage 2: Payment Link & Initial Notification
  // =============================================================================

  const phone = customerPhone || customer?.phone;
  if (phone && invoiceId) {
    try {
      // Create payment intent
      const paymentIntent = await activities.createPaymentIntentActivity({
        amount: invoiceTotal,
        currency: "usd",
        customerId: customer?.stripeCustomerId,
        metadata: {
          invoiceId: String(invoiceId),
          jobId: String(jobId),
          workflowId,
        },
        idempotencyKey: `${workflowId}-payment-intent`,
      });

      paymentIntentId = paymentIntent.paymentIntentId;

      // Send payment link SMS
      await activities.sendPaymentLinkSmsActivity({
        to: phone,
        customerName: customer?.name || "Customer",
        amount: invoiceTotal,
        paymentLink: paymentIntent.clientSecret ? `https://pay.lawnflow.ai/${invoiceId}` : undefined,
        businessName: "LawnFlow",
      });

      paymentHistory.push({
        timestamp: new Date().toISOString(),
        type: "payment_link_sent",
        status: "success",
      });
    } catch (err) {
      // Non-critical, continue
      paymentHistory.push({
        timestamp: new Date().toISOString(),
        type: "payment_link_sent",
        status: `failed: ${err}`,
      });
    }
  }

  // =============================================================================
  // Stage 3: Payment Collection Loop
  // =============================================================================

  let daysSinceInvoice = 0;
  let nextReminderIndex = 0;

  while (
    stage === "AWAITING_PAYMENT" ||
    stage === "OVERDUE" ||
    stage === "PAYMENT_PROCESSING" ||
    stage === "DISPUTE"
  ) {
    // Check for manual actions
    if (pendingManualAction) {
      const action = pendingManualAction;
      pendingManualAction = null;

      switch (action.action) {
        case "mark_paid":
          amountPaid = invoiceTotal;
          amountOutstanding = 0;
          stage = "PAYMENT_CONFIRMED";
          paymentHistory.push({
            timestamp: new Date().toISOString(),
            type: "manual_mark_paid",
            amount: invoiceTotal,
            status: "success",
          });
          break;

        case "write_off":
          stage = "WRITTEN_OFF";
          paymentHistory.push({
            timestamp: new Date().toISOString(),
            type: "write_off",
            amount: amountOutstanding,
            status: "approved",
          });
          break;

        case "cancel":
          stage = "CANCELED";
          break;

        case "send_reminder":
          if (phone) {
            await activities.sendReminderSmsActivity({
              to: phone,
              customerName: customer?.name || "Customer",
              amount: amountOutstanding,
              daysOverdue: daysSinceInvoice - dueInDays,
              businessName: "LawnFlow",
            });
            remindersSent++;
          }
          break;

        case "escalate":
          stage = "COLLECTIONS";
          break;
      }

      if (stage === "CANCELED" || stage === "WRITTEN_OFF" || stage === "COLLECTIONS") {
        break;
      }
      continue;
    }

    // Check for payment received
    if (pendingPayment) {
      const payment = pendingPayment;
      pendingPayment = null;

      if (payment.status === "succeeded") {
        amountPaid += payment.amountPaid;
        amountOutstanding = Math.max(0, invoiceTotal - amountPaid);

        if (amountOutstanding === 0) {
          stage = "PAYMENT_CONFIRMED";

          // Send confirmation
          if (phone) {
            await activities.sendPaymentConfirmationSmsActivity({
              to: phone,
              customerName: customer?.name || "Customer",
              amount: payment.amountPaid,
              businessName: "LawnFlow",
            });
          }

          break;
        }
      } else if (payment.status === "failed") {
        paymentHistory.push({
          timestamp: new Date().toISOString(),
          type: "payment_failed",
          amount: payment.amountPaid,
          status: "failed",
        });
      }
      continue;
    }

    // Check for dispute
    if (pendingDispute) {
      const dispute = pendingDispute;
      pendingDispute = null;
      stage = "DISPUTE";

      // Create human task for dispute resolution
      await activities.createHumanTaskActivity({
        workflowRunId,
        accountId,
        businessId,
        taskType: "dispute_resolution",
        category: "billing",
        assignedRole: "billing_admin",
        title: `Dispute: Invoice #${invoiceId}`,
        description: `Customer dispute: ${dispute.reason}. Requested action: ${dispute.requestedAction}`,
        contextJson: {
          invoiceId,
          jobId,
          customerId,
          dispute,
          amountOutstanding,
        },
        priority: "high",
        signalName: "manualAction",
      });

      // Wait for dispute resolution
      await condition(() => pendingManualAction !== null, "14 days");
      continue;
    }

    // Check if overdue
    if (dueDate && new Date() > dueDate && stage === "AWAITING_PAYMENT") {
      stage = "OVERDUE";
    }

    // Check if should auto-escalate
    if (daysSinceInvoice >= autoEscalateAfterDays && stage === "OVERDUE") {
      stage = "COLLECTIONS";

      // Create escalation task
      await activities.createHumanTaskActivity({
        workflowRunId,
        accountId,
        businessId,
        taskType: "collections_escalation",
        category: "billing",
        assignedRole: "collections",
        title: `Collections: Invoice #${invoiceId} - $${(amountOutstanding / 100).toFixed(2)}`,
        description: `Invoice ${autoEscalateAfterDays}+ days overdue. ${remindersSent} reminders sent.`,
        contextJson: {
          invoiceId,
          jobId,
          customerId,
          amountOutstanding,
          daysSinceInvoice,
          remindersSent,
        },
        priority: "high",
        signalName: "manualAction",
      });

      break;
    }

    // Send scheduled reminders
    if (
      phone &&
      nextReminderIndex < reminderCadenceDays.length &&
      daysSinceInvoice >= reminderCadenceDays[nextReminderIndex]
    ) {
      try {
        await activities.sendReminderSmsActivity({
          to: phone,
          customerName: customer?.name || "Customer",
          amount: amountOutstanding,
          daysOverdue: stage === "OVERDUE" ? daysSinceInvoice - dueInDays : 0,
          businessName: "LawnFlow",
        });
        remindersSent++;
        nextReminderIndex++;

        paymentHistory.push({
          timestamp: new Date().toISOString(),
          type: "reminder_sent",
          status: `reminder_${remindersSent}`,
        });
      } catch (err) {
        paymentHistory.push({
          timestamp: new Date().toISOString(),
          type: "reminder_failed",
          status: String(err),
        });
      }
    }

    // Wait for payment or next check (1 day)
    const gotSignal = await condition(
      () =>
        pendingPayment !== null ||
        pendingDispute !== null ||
        pendingManualAction !== null,
      "1 day"
    );

    if (!gotSignal) {
      daysSinceInvoice++;
    }
  }

  // =============================================================================
  // Workflow Completion
  // =============================================================================

  if (stage === "PAYMENT_CONFIRMED") {
    stage = "COMPLETED";
  }

  // Generate summary
  try {
    await activities.generateWorkflowSummaryActivity({
      workflowRunId,
      businessId,
      customerId,
      outcome: stage === "COMPLETED" ? "success" : stage === "CANCELED" ? "canceled" : "failed",
      finalContext: {
        invoiceId,
        invoiceTotal,
        amountPaid,
        amountOutstanding,
        remindersSent,
        daysSinceInvoice,
      },
    });
  } catch (err) {
    // Summary is optional
  }

  // Update final status
  try {
    await activities.updateWorkflowRunActivity({
      workflowRunId,
      status: stage === "COMPLETED" ? "completed" : "failed",
      currentStage: stage,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    // Ignore
  }

  return {
    success: stage === "COMPLETED",
    invoiceId,
    finalStatus: stage,
    totalPaid: amountPaid,
    totalOutstanding: amountOutstanding,
    remindersSent,
    paymentIntentId,
  };
}
