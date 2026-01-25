import { db } from "../../db";
import { customerCommLog, businessProfiles } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { renderMessage, formatDateForMessage, RenderContext, RenderResult } from "./messageRenderer";
import { detectServiceCategory, ServiceCategory } from "./messageTemplates";
import { twilioConnector } from "../../connectors/twilio-mock";
import { getJobberClient } from "../../connectors/jobber-client";

const LAWNFLOW_BASE_URL = process.env.LAWNFLOW_BASE_URL || "https://lawnflow.app";
const COMM_LOG_CUSTOM_FIELD = "LAWNFLOW_COMM_LOG";

export interface JobEventData {
  id: string;
  title?: string;
  client?: {
    id: string;
    firstName?: string;
    lastName?: string;
    phones?: Array<{ number: string; primary?: boolean }>;
  };
  property?: {
    address?: {
      street1?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
  };
  startAt?: string;
  endAt?: string;
  jobType?: string;
  lineItems?: Array<{
    name?: string;
    description?: string;
  }>;
  notes?: string;
  customFields?: Array<{
    id: string;
    label: string;
    valueText?: string;
  }>;
}

export interface ProcessCommsEventResult {
  processed: boolean;
  messageSent: boolean;
  commLogId?: number;
  jobberFieldUpdated: boolean;
  violations?: string[];
  error?: string;
}

export async function processJobRescheduledEvent(
  accountId: string,
  businessId: number | undefined,
  jobData: JobEventData,
  originalDate?: string
): Promise<ProcessCommsEventResult> {
  console.log(`[CustomerComms] Processing JOB_RESCHEDULED for job ${jobData.id}`);

  const profile = await getBusinessProfile(businessId);
  if (!profile) {
    return { processed: false, messageSent: false, jobberFieldUpdated: false, error: "No business profile found" };
  }

  const customerPhone = extractPrimaryPhone(jobData.client?.phones);
  if (!customerPhone) {
    console.log(`[CustomerComms] No phone number found for client, skipping SMS`);
    return { processed: true, messageSent: false, jobberFieldUpdated: false };
  }

  const serviceCategory = detectServiceCategory(jobData.jobType || jobData.lineItems?.[0]?.name);

  const context: RenderContext = {
    customerFirstName: jobData.client?.firstName || "Valued Customer",
    customerLastName: jobData.client?.lastName,
    customerPhone,
    propertyAddress: formatAddress(jobData.property?.address),
    businessName: profile.name,
    businessPhone: profile.phone,
    newDate: jobData.startAt ? formatDateForMessage(jobData.startAt) : "a new date",
    originalDate: originalDate ? formatDateForMessage(originalDate) : undefined,
    serviceType: jobData.jobType,
    reason: undefined,
    hasGpsEta: false,
  };

  const renderResult = renderMessage("job_rescheduled", context, serviceCategory);

  if (!renderResult.success) {
    console.warn(`[CustomerComms] Message rendering failed:`, renderResult.violations);
    return {
      processed: true,
      messageSent: false,
      jobberFieldUpdated: false,
      violations: renderResult.violations,
    };
  }

  const commLogEntry = await createCommLogEntry(
    businessId,
    accountId,
    "job_rescheduled",
    serviceCategory,
    renderResult,
    customerPhone,
    jobData.client?.firstName,
    jobData.id,
    jobData.client?.id
  );

  const smsResult = await sendSms(customerPhone, renderResult.message, profile.id);

  await updateCommLogDelivery(commLogEntry.id, smsResult);

  const logUrl = `${LAWNFLOW_BASE_URL}/comms/${commLogEntry.id}`;
  const fieldUpdated = await updateJobberCommLogField(accountId, jobData.id, logUrl);

  if (fieldUpdated) {
    await db
      .update(customerCommLog)
      .set({ 
        jobberFieldUpdated: true, 
        jobberFieldValue: logUrl 
      })
      .where(eq(customerCommLog.id, commLogEntry.id));
  }

  console.log(`[CustomerComms] JOB_RESCHEDULED processed: SMS ${smsResult.success ? "sent" : "failed"}, Jobber field ${fieldUpdated ? "updated" : "skipped"}`);

  return {
    processed: true,
    messageSent: smsResult.success,
    commLogId: commLogEntry.id,
    jobberFieldUpdated: fieldUpdated,
  };
}

export async function processJobCompletedEvent(
  accountId: string,
  businessId: number | undefined,
  jobData: JobEventData
): Promise<ProcessCommsEventResult> {
  console.log(`[CustomerComms] Processing JOB_COMPLETED for job ${jobData.id}`);

  const profile = await getBusinessProfile(businessId);
  if (!profile) {
    return { processed: false, messageSent: false, jobberFieldUpdated: false, error: "No business profile found" };
  }

  const customerPhone = extractPrimaryPhone(jobData.client?.phones);
  if (!customerPhone) {
    console.log(`[CustomerComms] No phone number found for client, skipping SMS`);
    return { processed: true, messageSent: false, jobberFieldUpdated: false };
  }

  const serviceCategory = detectServiceCategory(jobData.jobType || jobData.lineItems?.[0]?.name);

  const context: RenderContext = {
    customerFirstName: jobData.client?.firstName || "Valued Customer",
    customerLastName: jobData.client?.lastName,
    customerPhone,
    propertyAddress: formatAddress(jobData.property?.address),
    businessName: profile.name,
    businessPhone: profile.phone,
    serviceType: jobData.jobType,
    serviceNotes: jobData.notes || undefined,
    hasGpsEta: false,
  };

  const renderResult = renderMessage("job_completed", context, serviceCategory);

  if (!renderResult.success) {
    console.warn(`[CustomerComms] Message rendering failed:`, renderResult.violations);
    return {
      processed: true,
      messageSent: false,
      jobberFieldUpdated: false,
      violations: renderResult.violations,
    };
  }

  const commLogEntry = await createCommLogEntry(
    businessId,
    accountId,
    "job_completed",
    serviceCategory,
    renderResult,
    customerPhone,
    jobData.client?.firstName,
    jobData.id,
    jobData.client?.id
  );

  const smsResult = await sendSms(customerPhone, renderResult.message, profile.id);

  await updateCommLogDelivery(commLogEntry.id, smsResult);

  const logUrl = `${LAWNFLOW_BASE_URL}/comms/${commLogEntry.id}`;
  const fieldUpdated = await updateJobberCommLogField(accountId, jobData.id, logUrl);

  if (fieldUpdated) {
    await db
      .update(customerCommLog)
      .set({ 
        jobberFieldUpdated: true, 
        jobberFieldValue: logUrl 
      })
      .where(eq(customerCommLog.id, commLogEntry.id));
  }

  console.log(`[CustomerComms] JOB_COMPLETED processed: SMS ${smsResult.success ? "sent" : "failed"}, Jobber field ${fieldUpdated ? "updated" : "skipped"}`);

  return {
    processed: true,
    messageSent: smsResult.success,
    commLogId: commLogEntry.id,
    jobberFieldUpdated: fieldUpdated,
  };
}

async function getBusinessProfile(businessId: number | undefined) {
  if (!businessId) {
    const [profile] = await db.select().from(businessProfiles).limit(1);
    return profile;
  }
  
  const [profile] = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.id, businessId))
    .limit(1);
  
  return profile;
}

function extractPrimaryPhone(phones?: Array<{ number: string; primary?: boolean }>): string | null {
  if (!phones || phones.length === 0) return null;
  
  const primary = phones.find(p => p.primary);
  return primary?.number || phones[0]?.number || null;
}

function formatAddress(address?: { street1?: string; city?: string; state?: string; postalCode?: string }): string {
  if (!address) return "your property";
  
  const parts = [address.street1, address.city, address.state].filter(Boolean);
  return parts.join(", ") || "your property";
}

async function createCommLogEntry(
  businessId: number | undefined,
  accountId: string,
  messageType: string,
  serviceCategory: ServiceCategory,
  renderResult: RenderResult,
  recipientPhone: string,
  recipientName: string | undefined,
  jobberJobId: string,
  jobberClientId: string | undefined
) {
  const [entry] = await db
    .insert(customerCommLog)
    .values({
      businessId,
      jobberAccountId: accountId,
      messageType,
      serviceCategory,
      templateId: renderResult.templateId,
      recipientPhone,
      recipientName,
      messageContent: renderResult.message,
      templateVariables: renderResult.variables,
      jobberJobId,
      jobberClientId,
      deliveryStatus: "pending",
      complianceChecks: renderResult.complianceChecks,
    })
    .returning({ id: customerCommLog.id });

  return entry;
}

interface SmsResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

async function sendSms(to: string, message: string, businessId?: number): Promise<SmsResult> {
  try {
    const result = await twilioConnector.sendSMS(to, message);
    return {
      success: result.success,
      messageSid: result.sid,
    };
  } catch (error: any) {
    console.error(`[CustomerComms] SMS send failed:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function updateCommLogDelivery(logId: number, smsResult: SmsResult) {
  await db
    .update(customerCommLog)
    .set({
      deliveryStatus: smsResult.success ? "sent" : "failed",
      twilioMessageSid: smsResult.messageSid,
      deliveredAt: smsResult.success ? new Date() : undefined,
      failureReason: smsResult.error,
    })
    .where(eq(customerCommLog.id, logId));
}

async function updateJobberCommLogField(
  accountId: string,
  jobId: string,
  logUrl: string
): Promise<boolean> {
  try {
    const client = await getJobberClient(accountId);
    if (!client) {
      console.warn(`[CustomerComms] No Jobber client available for account ${accountId}`);
      return false;
    }
    
    const mutation = `
      mutation UpdateJobCustomField($input: JobUpdateInput!) {
        jobUpdate(input: $input) {
          job {
            id
          }
          userErrors {
            message
            path
          }
        }
      }
    `;

    const variables = {
      input: {
        id: jobId,
        customFields: [
          {
            label: COMM_LOG_CUSTOM_FIELD,
            valueText: logUrl,
          },
        ],
      },
    };

    const response = await client.query<any>(mutation, variables);

    if (response.jobUpdate?.userErrors?.length > 0) {
      console.warn(`[CustomerComms] Jobber field update had errors:`, response.jobUpdate.userErrors);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[CustomerComms] Failed to update Jobber comm log field:`, error);
    return false;
  }
}

export async function getCommLogSummary(businessId?: number) {
  let query = db.select().from(customerCommLog);
  
  if (businessId) {
    query = query.where(eq(customerCommLog.businessId, businessId)) as typeof query;
  }
  
  const entries = await query;
  
  return {
    total: entries.length,
    byStatus: {
      pending: entries.filter(e => e.deliveryStatus === "pending").length,
      sent: entries.filter(e => e.deliveryStatus === "sent").length,
      delivered: entries.filter(e => e.deliveryStatus === "delivered").length,
      failed: entries.filter(e => e.deliveryStatus === "failed").length,
    },
    byType: {
      job_rescheduled: entries.filter(e => e.messageType === "job_rescheduled").length,
      job_completed: entries.filter(e => e.messageType === "job_completed").length,
      reminder: entries.filter(e => e.messageType === "reminder").length,
      follow_up: entries.filter(e => e.messageType === "follow_up").length,
    },
    jobberFieldUpdates: entries.filter(e => e.jobberFieldUpdated).length,
  };
}
