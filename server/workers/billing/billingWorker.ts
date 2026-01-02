import { db } from "../../db";
import { 
  jobBillingStates, 
  billingInvoices, 
  jobberAccounts,
  type InsertJobBillingState,
  type InsertBillingInvoice 
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getJobberClient } from "../../connectors/jobber-client";
import { 
  getBillingRule, 
  getMilestoneForEvent, 
  getInvoiceTypeForMilestone,
  getBillingStageForEvent,
  type BillingMilestone 
} from "./billingRules";

interface BillingEvent {
  accountId: string;
  objectId: string;
  topic: string;
  occurredAt: string;
  data: any;
}

interface BillingResult {
  processed: boolean;
  invoiceCreated: boolean;
  invoiceId?: string;
  billingStageUpdated: boolean;
  error?: string;
}

export async function processBillingEvent(
  accountId: string,
  event: BillingEvent
): Promise<BillingResult> {
  const { objectId, topic, data } = event;
  
  console.log(`[Billing Worker] Processing ${topic} for object ${objectId}`);

  try {
    const [account] = await db
      .select()
      .from(jobberAccounts)
      .where(eq(jobberAccounts.jobberAccountId, accountId))
      .limit(1);

    if (!account?.businessId) {
      console.log(`[Billing Worker] No business linked to account ${accountId}`);
      return { processed: false, invoiceCreated: false, billingStageUpdated: false };
    }

    if (topic === "INVOICE_PAID") {
      return await handleInvoicePaid(accountId, account.businessId, objectId, data);
    }

    if (topic.startsWith("JOB_")) {
      return await handleJobMilestone(accountId, account.businessId, objectId, topic, data);
    }

    return { processed: false, invoiceCreated: false, billingStageUpdated: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Billing Worker] Error processing ${topic}:`, errorMessage);
    return { processed: false, invoiceCreated: false, billingStageUpdated: false, error: errorMessage };
  }
}

async function handleJobMilestone(
  accountId: string,
  businessId: number,
  jobId: string,
  topic: string,
  data: any
): Promise<BillingResult> {
  const milestone = getMilestoneForEvent(topic);
  if (!milestone) {
    console.log(`[Billing Worker] No milestone mapping for topic ${topic}`);
    return { processed: false, invoiceCreated: false, billingStageUpdated: false };
  }

  const client = await getJobberClient(accountId);
  const jobResult = await client.getJob(jobId);
  
  if (!jobResult?.job) {
    console.log(`[Billing Worker] Job ${jobId} not found`);
    return { processed: false, invoiceCreated: false, billingStageUpdated: false };
  }

  const job = jobResult.job;
  const serviceType = job.jobType?.name || "unknown";
  const totalValue = Math.round((job.amounts?.total || 0) * 100);

  const billingRule = getBillingRule(serviceType);
  if (!billingRule) {
    console.log(`[Billing Worker] No billing rule for service type: ${serviceType}`);
    return { processed: false, invoiceCreated: false, billingStageUpdated: false };
  }

  let [billingState] = await db
    .select()
    .from(jobBillingStates)
    .where(and(
      eq(jobBillingStates.jobberAccountId, accountId),
      eq(jobBillingStates.jobberJobId, jobId)
    ))
    .limit(1);

  if (!billingState) {
    const newState: InsertJobBillingState = {
      businessId,
      jobberAccountId: accountId,
      jobberJobId: jobId,
      serviceType,
      totalJobValue: totalValue,
      currentMilestone: milestone,
      milestoneReachedAt: new Date(),
      billingStage: "pending",
    };

    const [inserted] = await db.insert(jobBillingStates).values(newState).returning();
    billingState = inserted;
    console.log(`[Billing Worker] Created billing state for job ${jobId}`);
  } else {
    await db
      .update(jobBillingStates)
      .set({ 
        currentMilestone: milestone, 
        milestoneReachedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobBillingStates.id, billingState.id));
  }

  const milestoneConfig = getInvoiceTypeForMilestone(billingRule, milestone);
  if (!milestoneConfig) {
    console.log(`[Billing Worker] No invoice configured for milestone ${milestone}`);
    return { processed: true, invoiceCreated: false, billingStageUpdated: false };
  }

  const alreadySent = checkInvoiceAlreadySent(billingState, milestoneConfig.invoiceType);
  if (alreadySent) {
    console.log(`[Billing Worker] ${milestoneConfig.invoiceType} invoice already sent for job ${jobId}`);
    return { processed: true, invoiceCreated: false, billingStageUpdated: false };
  }

  const [existingInvoice] = await db
    .select()
    .from(billingInvoices)
    .where(and(
      eq(billingInvoices.jobberAccountId, accountId),
      eq(billingInvoices.jobberJobId, jobId),
      eq(billingInvoices.invoiceType, milestoneConfig.invoiceType)
    ))
    .limit(1);

  if (existingInvoice) {
    console.log(`[Billing Worker] Invoice record already exists for ${milestoneConfig.invoiceType} on job ${jobId}`);
    return { processed: true, invoiceCreated: false, billingStageUpdated: false };
  }

  const invoiceAmount = Math.round((totalValue * milestoneConfig.percentageOfTotal) / 100);
  
  const invoiceResult = await createAndSendInvoice(
    client,
    accountId,
    businessId,
    billingState.id,
    jobId,
    milestoneConfig,
    invoiceAmount
  );

  if (invoiceResult.success && invoiceResult.invoiceId) {
    await markInvoiceSent(billingState.id, milestoneConfig.invoiceType);
    
    const newBillingStage = getBillingStageForEvent(billingRule, milestoneConfig.invoiceType, false);
    await updateBillingStage(client, billingState.id, jobId, billingRule.billingStageField, newBillingStage);

    console.log(`[Billing Worker] Created ${milestoneConfig.invoiceType} invoice ${invoiceResult.invoiceId} for job ${jobId}`);
    return { processed: true, invoiceCreated: true, invoiceId: invoiceResult.invoiceId, billingStageUpdated: true };
  }

  return { processed: true, invoiceCreated: false, billingStageUpdated: false, error: invoiceResult.error };
}

async function handleInvoicePaid(
  accountId: string,
  businessId: number,
  invoiceId: string,
  data: any
): Promise<BillingResult> {
  const client = await getJobberClient(accountId);
  const invoiceResult = await client.getInvoice(invoiceId);
  
  if (!invoiceResult?.invoice) {
    console.log(`[Billing Worker] Invoice ${invoiceId} not found`);
    return { processed: false, invoiceCreated: false, billingStageUpdated: false };
  }

  const jobId = invoiceResult.invoice.job?.id;
  if (!jobId) {
    console.log(`[Billing Worker] No job linked to invoice ${invoiceId}`);
    return { processed: false, invoiceCreated: false, billingStageUpdated: false };
  }

  const [billingInvoice] = await db
    .select()
    .from(billingInvoices)
    .where(eq(billingInvoices.jobberInvoiceId, invoiceId))
    .limit(1);

  if (!billingInvoice) {
    console.log(`[Billing Worker] No billing invoice record for Jobber invoice ${invoiceId}`);
    return { processed: false, invoiceCreated: false, billingStageUpdated: false };
  }

  await db
    .update(billingInvoices)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(billingInvoices.id, billingInvoice.id));

  const [billingState] = await db
    .select()
    .from(jobBillingStates)
    .where(eq(jobBillingStates.id, billingInvoice.billingStateId))
    .limit(1);

  if (!billingState) {
    return { processed: true, invoiceCreated: false, billingStageUpdated: false };
  }

  const billingRule = getBillingRule(billingState.serviceType);
  if (!billingRule) {
    return { processed: true, invoiceCreated: false, billingStageUpdated: false };
  }

  const invoiceType = billingInvoice.invoiceType as "deposit" | "progress" | "final";
  const newBillingStage = getBillingStageForEvent(billingRule, invoiceType, true);
  await updateBillingStage(client, billingState.id, jobId, billingRule.billingStageField, newBillingStage);

  console.log(`[Billing Worker] Updated billing stage to ${newBillingStage} after invoice ${invoiceId} paid`);
  return { processed: true, invoiceCreated: false, billingStageUpdated: true };
}

function checkInvoiceAlreadySent(billingState: any, invoiceType: string): boolean {
  switch (invoiceType) {
    case "deposit":
      return billingState.depositInvoiceSent;
    case "progress":
      return billingState.progressInvoiceSent;
    case "final":
      return billingState.finalInvoiceSent;
    default:
      return false;
  }
}

async function markInvoiceSent(billingStateId: number, invoiceType: string): Promise<void> {
  const updateField: any = { updatedAt: new Date() };
  
  switch (invoiceType) {
    case "deposit":
      updateField.depositInvoiceSent = true;
      break;
    case "progress":
      updateField.progressInvoiceSent = true;
      break;
    case "final":
      updateField.finalInvoiceSent = true;
      break;
  }

  await db
    .update(jobBillingStates)
    .set(updateField)
    .where(eq(jobBillingStates.id, billingStateId));
}

async function createAndSendInvoice(
  client: Awaited<ReturnType<typeof getJobberClient>>,
  accountId: string,
  businessId: number,
  billingStateId: number,
  jobId: string,
  milestoneConfig: BillingMilestone,
  amountCents: number
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    const invoiceRecord: InsertBillingInvoice = {
      billingStateId,
      businessId,
      jobberAccountId: accountId,
      jobberJobId: jobId,
      invoiceType: milestoneConfig.invoiceType,
      amount: amountCents,
      percentageOfTotal: milestoneConfig.percentageOfTotal,
      description: milestoneConfig.description,
      status: "pending",
    };

    const [savedInvoice] = await db.insert(billingInvoices).values(invoiceRecord).returning();

    const createResult = await client.createInvoice(jobId, [{
      name: milestoneConfig.description,
      quantity: 1,
      unitCost: amountCents / 100,
    }]);

    if (createResult.invoiceCreate.userErrors?.length > 0) {
      const errorMsg = createResult.invoiceCreate.userErrors.map((e: any) => e.message).join(", ");
      await db
        .update(billingInvoices)
        .set({ status: "pending", lastError: errorMsg, retryCount: (savedInvoice.retryCount || 0) + 1 })
        .where(eq(billingInvoices.id, savedInvoice.id));
      return { success: false, error: errorMsg };
    }

    const jobberInvoiceId = createResult.invoiceCreate.invoice.id;

    await db
      .update(billingInvoices)
      .set({ 
        jobberInvoiceId,
        status: "created",
      })
      .where(eq(billingInvoices.id, savedInvoice.id));

    const sendResult = await client.sendInvoice(jobberInvoiceId, "EMAIL");

    if (sendResult.invoiceSend.userErrors?.length > 0) {
      const errorMsg = sendResult.invoiceSend.userErrors.map((e: any) => e.message).join(", ");
      await db
        .update(billingInvoices)
        .set({ lastError: errorMsg })
        .where(eq(billingInvoices.id, savedInvoice.id));
      return { success: true, invoiceId: jobberInvoiceId, error: `Created but send failed: ${errorMsg}` };
    }

    await db
      .update(billingInvoices)
      .set({ 
        status: "sent",
        sentAt: new Date(),
      })
      .where(eq(billingInvoices.id, savedInvoice.id));

    return { success: true, invoiceId: jobberInvoiceId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Billing Worker] Failed to create/send invoice:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

async function updateBillingStage(
  client: Awaited<ReturnType<typeof getJobberClient>>,
  billingStateId: number,
  jobId: string,
  fieldName: string,
  value: string
): Promise<void> {
  try {
    await client.setJobCustomField(jobId, fieldName, value);
    
    await db
      .update(jobBillingStates)
      .set({ billingStage: value, updatedAt: new Date() })
      .where(eq(jobBillingStates.id, billingStateId));

    console.log(`[Billing Worker] Updated billing stage to "${value}" for job ${jobId}`);
  } catch (error) {
    console.error(`[Billing Worker] Failed to update billing stage:`, error);
  }
}

export async function getBillingStateForJob(accountId: string, jobId: string) {
  const [state] = await db
    .select()
    .from(jobBillingStates)
    .where(and(
      eq(jobBillingStates.jobberAccountId, accountId),
      eq(jobBillingStates.jobberJobId, jobId)
    ))
    .limit(1);

  if (!state) return null;

  const invoices = await db
    .select()
    .from(billingInvoices)
    .where(eq(billingInvoices.billingStateId, state.id));

  return { state, invoices };
}

export async function getBusinessBillingSummary(businessId: number) {
  const states = await db
    .select()
    .from(jobBillingStates)
    .where(eq(jobBillingStates.businessId, businessId));

  const invoices = await db
    .select()
    .from(billingInvoices)
    .where(eq(billingInvoices.businessId, businessId));

  const summary = {
    totalJobs: states.length,
    invoicesByStatus: {
      pending: invoices.filter(i => i.status === "pending").length,
      created: invoices.filter(i => i.status === "created").length,
      sent: invoices.filter(i => i.status === "sent").length,
      paid: invoices.filter(i => i.status === "paid").length,
    },
    totalInvoiced: invoices.reduce((sum, i) => sum + i.amount, 0),
    totalPaid: invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0),
    jobsByMilestone: {
      created: states.filter(s => s.currentMilestone === "created").length,
      scheduled: states.filter(s => s.currentMilestone === "scheduled").length,
      in_progress: states.filter(s => s.currentMilestone === "in_progress").length,
      complete: states.filter(s => s.currentMilestone === "complete").length,
    },
  };

  return summary;
}
