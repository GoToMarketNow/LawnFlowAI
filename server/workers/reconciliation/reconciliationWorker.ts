import { db } from "../../db";
import { 
  reconciliationAlerts, 
  jobberAccounts,
  type InsertReconciliationAlert 
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getJobberClient } from "../../connectors/jobber-client";

interface ReconciliationEvent {
  accountId: string;
  objectId: string;
  topic: string;
  occurredAt: string;
  data: any;
}

interface ReconciliationResult {
  processed: boolean;
  alertCreated: boolean;
  alertId?: number;
  jobberFieldUpdated: boolean;
  error?: string;
}

const RECON_STATUS_FIELD = "RECON_STATUS";
const NEEDS_REVIEW_STATUS = "NEEDS_REVIEW";
const OK_STATUS = "OK";

export async function processReconciliationEvent(
  accountId: string,
  event: ReconciliationEvent
): Promise<ReconciliationResult> {
  const { objectId, topic, data } = event;
  
  console.log(`[Reconciliation] Processing ${topic} for object ${objectId}`);

  try {
    const [account] = await db
      .select()
      .from(jobberAccounts)
      .where(eq(jobberAccounts.jobberAccountId, accountId))
      .limit(1);

    if (!account?.businessId) {
      console.log(`[Reconciliation] No business linked to account ${accountId}`);
      return { processed: false, alertCreated: false, jobberFieldUpdated: false };
    }

    if (topic.startsWith("INVOICE_")) {
      return await reconcileInvoice(accountId, account.businessId, objectId, topic, data);
    }

    if (topic.startsWith("PAYMENT_")) {
      return await reconcilePayment(accountId, account.businessId, objectId, topic, data);
    }

    return { processed: false, alertCreated: false, jobberFieldUpdated: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Reconciliation] Error processing ${topic}:`, errorMessage);
    return { processed: false, alertCreated: false, jobberFieldUpdated: false, error: errorMessage };
  }
}

async function reconcileInvoice(
  accountId: string,
  businessId: number,
  invoiceId: string,
  topic: string,
  data: any
): Promise<ReconciliationResult> {
  console.log(`[Reconciliation] Reconciling invoice ${invoiceId}`);

  const client = await getJobberClient(accountId);
  
  const invoiceResult = await client.getInvoice(invoiceId);
  if (!invoiceResult?.invoice) {
    console.log(`[Reconciliation] Invoice ${invoiceId} not found`);
    return { processed: false, alertCreated: false, jobberFieldUpdated: false };
  }

  const invoice = invoiceResult.invoice;
  const jobId = invoice.job?.id;
  
  const invoiceTotal = Math.round((invoice.amounts?.total || 0) * 100);
  const paidTotal = Math.round((invoice.amounts?.paid || 0) * 100);
  
  const paymentsResult = await client.getInvoicePayments(invoiceId);
  const payments = paymentsResult?.invoice?.payments?.nodes || [];
  
  const sumOfPayments = payments.reduce((sum: number, p: any) => {
    return sum + Math.round((p.amount || 0) * 100);
  }, 0);

  const hasPaymentMismatch = paidTotal !== sumOfPayments;
  
  const depositPayment = payments.find((p: any) => {
    const note = p.note || "";
    const method = p.paymentMethod || "";
    return note.toLowerCase().includes("deposit") || method.toLowerCase().includes("deposit");
  });
  
  const hasDepositInconsistency = checkDepositInconsistency(
    invoice, 
    payments, 
    depositPayment
  );

  if (!hasPaymentMismatch && !hasDepositInconsistency) {
    console.log(`[Reconciliation] Invoice ${invoiceId} is consistent`);
    
    await tryUpdateJobberField(client, jobId, OK_STATUS);
    
    return { processed: true, alertCreated: false, jobberFieldUpdated: true };
  }

  let alertType = "payment_mismatch";
  let severity = "warning";
  let description = "";
  
  if (hasPaymentMismatch) {
    const variance = sumOfPayments - paidTotal;
    description = `Payment sum mismatch: Invoice shows $${(paidTotal/100).toFixed(2)} paid, but sum of payments is $${(sumOfPayments/100).toFixed(2)} (variance: $${(variance/100).toFixed(2)})`;
    
    if (Math.abs(variance) > 10000) {
      severity = "critical";
    }
    
    console.log(`[Reconciliation] ${description}`);
  }

  if (hasDepositInconsistency) {
    alertType = "deposit_inconsistency";
    description = "Deposit handling inconsistency detected in payment records";
    console.log(`[Reconciliation] ${description}`);
  }

  const alertData: InsertReconciliationAlert = {
    businessId,
    jobberAccountId: accountId,
    entityType: "invoice",
    entityId: invoiceId,
    jobberInvoiceId: invoiceId,
    jobberJobId: jobId,
    alertType,
    severity,
    expectedValue: paidTotal,
    actualValue: sumOfPayments,
    variance: sumOfPayments - paidTotal,
    description,
    status: "open",
    jobberFieldUpdated: false,
  };

  const [existingAlert] = await db
    .select()
    .from(reconciliationAlerts)
    .where(and(
      eq(reconciliationAlerts.jobberAccountId, accountId),
      eq(reconciliationAlerts.entityType, "invoice"),
      eq(reconciliationAlerts.entityId, invoiceId),
      eq(reconciliationAlerts.status, "open")
    ))
    .limit(1);

  if (existingAlert) {
    await db
      .update(reconciliationAlerts)
      .set({
        expectedValue: paidTotal,
        actualValue: sumOfPayments,
        variance: sumOfPayments - paidTotal,
        description,
        updatedAt: new Date(),
      })
      .where(eq(reconciliationAlerts.id, existingAlert.id));
    
    console.log(`[Reconciliation] Updated existing alert ${existingAlert.id} for invoice ${invoiceId}`);
    return {
      processed: true,
      alertCreated: false,
      alertId: existingAlert.id,
      jobberFieldUpdated: existingAlert.jobberFieldUpdated || false,
    };
  }

  const [alert] = await db
    .insert(reconciliationAlerts)
    .values(alertData)
    .returning({ id: reconciliationAlerts.id });

  const fieldUpdated = await tryUpdateJobberField(client, jobId, NEEDS_REVIEW_STATUS);

  if (fieldUpdated) {
    await db
      .update(reconciliationAlerts)
      .set({ jobberFieldUpdated: true, updatedAt: new Date() })
      .where(eq(reconciliationAlerts.id, alert.id));
  }

  console.log(`[Reconciliation] Created alert ${alert.id} for invoice ${invoiceId}`);

  return {
    processed: true,
    alertCreated: true,
    alertId: alert.id,
    jobberFieldUpdated: fieldUpdated,
  };
}

async function reconcilePayment(
  accountId: string,
  businessId: number,
  paymentId: string,
  topic: string,
  data: any
): Promise<ReconciliationResult> {
  console.log(`[Reconciliation] Reconciling payment ${paymentId}`);

  const client = await getJobberClient(accountId);
  
  const paymentResult = await client.getPayment(paymentId);
  if (!paymentResult?.payment) {
    console.log(`[Reconciliation] Payment ${paymentId} not found`);
    return { processed: false, alertCreated: false, jobberFieldUpdated: false };
  }

  const payment = paymentResult.payment;
  const invoiceId = payment.invoice?.id;
  
  if (!invoiceId) {
    console.log(`[Reconciliation] Payment ${paymentId} has no linked invoice`);
    return { processed: true, alertCreated: false, jobberFieldUpdated: false };
  }

  return await reconcileInvoice(accountId, businessId, invoiceId, topic, data);
}

function isDepositPayment(payment: any): boolean {
  const note = payment.note || "";
  const method = payment.paymentMethod || "";
  return note.toLowerCase().includes("deposit") || method.toLowerCase().includes("deposit");
}

function checkDepositInconsistency(
  invoice: any, 
  payments: any[], 
  depositPayment: any
): boolean {
  if (!depositPayment) return false;
  
  const depositAmount = Math.round((depositPayment.amount || 0) * 100);
  const invoiceTotal = Math.round((invoice.amounts?.total || 0) * 100);
  
  if (depositAmount > invoiceTotal * 0.5) {
    return true;
  }
  
  const depositPayments = payments.filter((p: any) => isDepositPayment(p));
  
  if (depositPayments.length > 1) {
    return true;
  }
  
  return false;
}

async function tryUpdateJobberField(
  client: any,
  jobId: string | undefined,
  status: string
): Promise<boolean> {
  if (!jobId) return false;
  
  try {
    await client.setJobCustomField(jobId, RECON_STATUS_FIELD, status);
    console.log(`[Reconciliation] Updated ${RECON_STATUS_FIELD} to ${status} for job ${jobId}`);
    return true;
  } catch (error) {
    console.error(`[Reconciliation] Failed to update Jobber field:`, error);
    return false;
  }
}

export async function getReconciliationAlerts(businessId: number, status?: string) {
  const query = db
    .select()
    .from(reconciliationAlerts)
    .where(and(
      eq(reconciliationAlerts.businessId, businessId),
      status ? eq(reconciliationAlerts.status, status) : undefined
    ));

  return query;
}

export async function acknowledgeAlert(alertId: number): Promise<void> {
  await db
    .update(reconciliationAlerts)
    .set({ status: "acknowledged", updatedAt: new Date() })
    .where(eq(reconciliationAlerts.id, alertId));
}

export async function resolveAlert(
  alertId: number, 
  resolvedBy: string, 
  notes?: string
): Promise<void> {
  await db
    .update(reconciliationAlerts)
    .set({ 
      status: "resolved", 
      resolvedAt: new Date(),
      resolvedBy,
      resolutionNotes: notes,
      updatedAt: new Date(),
    })
    .where(eq(reconciliationAlerts.id, alertId));
}

export async function getReconciliationSummary(businessId: number) {
  const alerts = await db
    .select()
    .from(reconciliationAlerts)
    .where(eq(reconciliationAlerts.businessId, businessId));

  return {
    total: alerts.length,
    byStatus: {
      open: alerts.filter(a => a.status === "open").length,
      acknowledged: alerts.filter(a => a.status === "acknowledged").length,
      resolved: alerts.filter(a => a.status === "resolved").length,
      ignored: alerts.filter(a => a.status === "ignored").length,
    },
    byType: {
      payment_mismatch: alerts.filter(a => a.alertType === "payment_mismatch").length,
      deposit_inconsistency: alerts.filter(a => a.alertType === "deposit_inconsistency").length,
      missing_payment: alerts.filter(a => a.alertType === "missing_payment").length,
      overpayment: alerts.filter(a => a.alertType === "overpayment").length,
    },
    bySeverity: {
      info: alerts.filter(a => a.severity === "info").length,
      warning: alerts.filter(a => a.severity === "warning").length,
      critical: alerts.filter(a => a.severity === "critical").length,
    },
    totalVariance: alerts.reduce((sum, a) => sum + (a.variance || 0), 0),
  };
}
