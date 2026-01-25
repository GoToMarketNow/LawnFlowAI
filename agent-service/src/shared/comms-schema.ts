import { z } from "zod";

export const CommunicationChannel = z.enum(["sms", "email"]);
export type CommunicationChannel = z.infer<typeof CommunicationChannel>;

export const CommunicationIntentType = z.enum([
  "lead_acknowledgment",
  "lead_followup",
  "lead_qualification",
  "quote_delivery",
  "quote_reminder",
  "quote_clarification",
  "quote_approved",
  "quote_declined",
  "approval_request",
  "approval_confirmation",
  "schedule_proposal",
  "schedule_confirmation",
  "schedule_change",
  "schedule_reminder",
  "job_eta",
  "job_crew_arrival",
  "job_in_progress",
  "job_complete",
  "job_followup",
  "invoice_sent",
  "payment_reminder",
  "payment_received",
  "payment_failed",
  "review_request",
  "upsell_offer",
  "seasonal_reminder",
  "churn_recovery",
  "general_inquiry_response",
  "custom_message",
]);
export type CommunicationIntentType = z.infer<typeof CommunicationIntentType>;

export const CommunicationPriority = z.enum(["urgent", "high", "normal", "low"]);
export type CommunicationPriority = z.infer<typeof CommunicationPriority>;

export const ServiceCategory = z.enum(["lawn_maintenance", "hardscape", "landscaping", "irrigation", "tree_service", "snow_removal", "general"]);
export type ServiceCategory = z.infer<typeof ServiceCategory>;

export const RecipientSchema = z.object({
  customerId: z.number().optional(),
  customerProfileId: z.number().optional(),
  phone: z.string(),
  email: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  preferredName: z.string().optional(),
  preferredChannel: CommunicationChannel.optional(),
  preferredContactWindow: z.object({
    startHour: z.number().min(0).max(23),
    endHour: z.number().min(0).max(23),
  }).optional(),
  timezone: z.string().optional(),
  optedOut: z.boolean().optional(),
});
export type Recipient = z.infer<typeof RecipientSchema>;

export const BusinessContextSchema = z.object({
  businessId: z.number(),
  businessName: z.string(),
  businessPhone: z.string(),
  businessEmail: z.string().optional(),
  businessWebsite: z.string().optional(),
  businessAddress: z.string().optional(),
  ownerFirstName: z.string().optional(),
});
export type BusinessContext = z.infer<typeof BusinessContextSchema>;

export const JobContextSchema = z.object({
  jobId: z.string().optional(),
  jobberJobId: z.string().optional(),
  jobTitle: z.string().optional(),
  serviceType: z.string().optional(),
  serviceCategory: ServiceCategory.optional(),
  scheduledDate: z.string().optional(),
  scheduledTimeWindow: z.string().optional(),
  propertyAddress: z.string().optional(),
  crewName: z.string().optional(),
  crewLeadName: z.string().optional(),
  estimatedDuration: z.string().optional(),
  jobNotes: z.string().optional(),
  previousDate: z.string().optional(),
  rescheduleReason: z.string().optional(),
});
export type JobContext = z.infer<typeof JobContextSchema>;

export const QuoteContextSchema = z.object({
  quoteId: z.string().optional(),
  jobberQuoteId: z.string().optional(),
  quoteNumber: z.string().optional(),
  totalAmount: z.number().optional(),
  formattedTotal: z.string().optional(),
  lineItems: z.array(z.object({
    name: z.string(),
    quantity: z.number().optional(),
    unitPrice: z.number().optional(),
    total: z.number().optional(),
  })).optional(),
  validUntil: z.string().optional(),
  quoteUrl: z.string().optional(),
  lotSize: z.string().optional(),
  frequency: z.string().optional(),
  proposedStartDate: z.string().optional(),
});
export type QuoteContext = z.infer<typeof QuoteContextSchema>;

export const PaymentContextSchema = z.object({
  invoiceId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  amountDue: z.number().optional(),
  formattedAmountDue: z.string().optional(),
  dueDate: z.string().optional(),
  paymentUrl: z.string().optional(),
  amountPaid: z.number().optional(),
  paymentMethod: z.string().optional(),
  balanceRemaining: z.number().optional(),
});
export type PaymentContext = z.infer<typeof PaymentContextSchema>;

export const ScheduleContextSchema = z.object({
  proposedWindows: z.array(z.object({
    date: z.string(),
    timeWindow: z.string(),
    available: z.boolean().optional(),
  })).optional(),
  selectedWindow: z.object({
    date: z.string(),
    timeWindow: z.string(),
  }).optional(),
  originalSchedule: z.object({
    date: z.string(),
    timeWindow: z.string(),
  }).optional(),
  changeReason: z.string().optional(),
  requestedByCustomer: z.boolean().optional(),
});
export type ScheduleContext = z.infer<typeof ScheduleContextSchema>;

export const CustomerInsightsSchema = z.object({
  isReturningCustomer: z.boolean().optional(),
  totalJobsCompleted: z.number().optional(),
  lastServiceDate: z.string().optional(),
  preferredCrew: z.string().optional(),
  preferredTimeSlot: z.string().optional(),
  priorServices: z.array(z.string()).optional(),
  communicationNotes: z.string().optional(),
  sentimentScore: z.number().optional(),
});
export type CustomerInsights = z.infer<typeof CustomerInsightsSchema>;

export const CommunicationIntentSchema = z.object({
  id: z.string().optional(),
  intentType: CommunicationIntentType,
  channel: CommunicationChannel.default("sms"),
  priority: CommunicationPriority.default("normal"),
  recipient: RecipientSchema,
  business: BusinessContextSchema,
  job: JobContextSchema.optional(),
  quote: QuoteContextSchema.optional(),
  payment: PaymentContextSchema.optional(),
  schedule: ScheduleContextSchema.optional(),
  customerInsights: CustomerInsightsSchema.optional(),
  orchestratorStage: z.string().optional(),
  triggeredBy: z.enum(["orchestrator", "worker", "manual", "customer_reply", "scheduled"]).optional(),
  correlationId: z.string().optional(),
  replyToMessageId: z.string().optional(),
  customMessage: z.string().optional(),
  customVariables: z.record(z.string()).optional(),
  requiresApproval: z.boolean().default(false),
  sendAfter: z.date().optional(),
  expiresAt: z.date().optional(),
  createdAt: z.date().optional(),
});
export type CommunicationIntent = z.infer<typeof CommunicationIntentSchema>;

export const RenderedMessageSchema = z.object({
  intentId: z.string(),
  intentType: CommunicationIntentType,
  channel: CommunicationChannel,
  templateId: z.string(),
  templateVersion: z.string().optional(),
  recipientPhone: z.string(),
  recipientEmail: z.string().optional(),
  subject: z.string().optional(),
  body: z.string(),
  characterCount: z.number(),
  estimatedSegments: z.number().optional(),
  personalizationTokensUsed: z.array(z.string()),
  complianceFlags: z.array(z.string()).optional(),
  renderedAt: z.date(),
});
export type RenderedMessage = z.infer<typeof RenderedMessageSchema>;

export const DeliveryResultSchema = z.object({
  intentId: z.string(),
  messageId: z.string().optional(),
  channel: CommunicationChannel,
  status: z.enum(["queued", "sent", "delivered", "failed", "blocked", "opted_out"]),
  providerMessageId: z.string().optional(),
  sentAt: z.date().optional(),
  deliveredAt: z.date().optional(),
  failureReason: z.string().optional(),
  cost: z.number().optional(),
});
export type DeliveryResult = z.infer<typeof DeliveryResultSchema>;

export const CommsAuditLogSchema = z.object({
  id: z.number().optional(),
  intentId: z.string(),
  businessId: z.number(),
  customerId: z.number().optional(),
  intentType: CommunicationIntentType,
  channel: CommunicationChannel,
  recipientPhone: z.string(),
  templateId: z.string(),
  messageBody: z.string(),
  status: z.string(),
  providerMessageId: z.string().optional(),
  triggeredBy: z.string().optional(),
  orchestratorStage: z.string().optional(),
  correlationId: z.string().optional(),
  approvedBy: z.number().optional(),
  approvedAt: z.date().optional(),
  sentAt: z.date().optional(),
  deliveredAt: z.date().optional(),
  failureReason: z.string().optional(),
  createdAt: z.date(),
});
export type CommsAuditLog = z.infer<typeof CommsAuditLogSchema>;

export const INTENT_METADATA: Record<CommunicationIntentType, {
  name: string;
  description: string;
  defaultPriority: CommunicationPriority;
  requiresApprovalDefault: boolean;
  allowedChannels: CommunicationChannel[];
  journeyStage: string;
}> = {
  lead_acknowledgment: {
    name: "Lead Acknowledgment",
    description: "Immediate response when a new lead comes in",
    defaultPriority: "high",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "LEAD_INTAKE",
  },
  lead_followup: {
    name: "Lead Follow-up",
    description: "Follow-up message for leads that haven't responded",
    defaultPriority: "normal",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "LEAD_INTAKE",
  },
  lead_qualification: {
    name: "Lead Qualification",
    description: "Questions to qualify a lead",
    defaultPriority: "normal",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "LEAD_INTAKE",
  },
  quote_delivery: {
    name: "Quote Delivery",
    description: "Sending a quote to the customer",
    defaultPriority: "high",
    requiresApprovalDefault: false,
    allowedChannels: ["sms", "email"],
    journeyStage: "QUOTE_BUILD",
  },
  quote_reminder: {
    name: "Quote Reminder",
    description: "Reminder about a pending quote",
    defaultPriority: "normal",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "QUOTE_CONFIRM",
  },
  quote_clarification: {
    name: "Quote Clarification",
    description: "Response to customer questions about a quote",
    defaultPriority: "high",
    requiresApprovalDefault: true,
    allowedChannels: ["sms"],
    journeyStage: "QUOTE_CONFIRM",
  },
  quote_approved: {
    name: "Quote Approved Confirmation",
    description: "Confirmation that quote was approved",
    defaultPriority: "high",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "QUOTE_CONFIRM",
  },
  quote_declined: {
    name: "Quote Declined Acknowledgment",
    description: "Acknowledgment when customer declines a quote",
    defaultPriority: "normal",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "QUOTE_CONFIRM",
  },
  approval_request: {
    name: "Approval Request",
    description: "Request for customer approval on changes",
    defaultPriority: "high",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "CREW_LOCK",
  },
  approval_confirmation: {
    name: "Approval Confirmation",
    description: "Confirmation of customer approval",
    defaultPriority: "normal",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "CREW_LOCK",
  },
  schedule_proposal: {
    name: "Schedule Proposal",
    description: "Proposing available time slots to customer",
    defaultPriority: "high",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "SCHEDULE_PROPOSE",
  },
  schedule_confirmation: {
    name: "Schedule Confirmation",
    description: "Confirming the scheduled service date",
    defaultPriority: "high",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "JOB_BOOKED",
  },
  schedule_change: {
    name: "Schedule Change",
    description: "Notifying customer of a schedule change",
    defaultPriority: "high",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "DISPATCH_READY",
  },
  schedule_reminder: {
    name: "Schedule Reminder",
    description: "Reminder about upcoming service",
    defaultPriority: "normal",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "DISPATCH_READY",
  },
  job_eta: {
    name: "Job ETA",
    description: "Crew is on the way notification",
    defaultPriority: "high",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "DISPATCH_READY",
  },
  job_crew_arrival: {
    name: "Crew Arrival",
    description: "Crew has arrived notification",
    defaultPriority: "normal",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "DISPATCH_READY",
  },
  job_in_progress: {
    name: "Job In Progress",
    description: "Job has started notification",
    defaultPriority: "low",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "DISPATCH_READY",
  },
  job_complete: {
    name: "Job Complete",
    description: "Job completed notification",
    defaultPriority: "normal",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "JOB_BOOKED",
  },
  job_followup: {
    name: "Job Follow-up",
    description: "Follow-up after job completion",
    defaultPriority: "low",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "JOB_BOOKED",
  },
  invoice_sent: {
    name: "Invoice Sent",
    description: "Invoice delivery notification",
    defaultPriority: "normal",
    requiresApprovalDefault: false,
    allowedChannels: ["sms", "email"],
    journeyStage: "JOB_BOOKED",
  },
  payment_reminder: {
    name: "Payment Reminder",
    description: "Reminder about outstanding payment",
    defaultPriority: "normal",
    requiresApprovalDefault: true,
    allowedChannels: ["sms"],
    journeyStage: "JOB_BOOKED",
  },
  payment_received: {
    name: "Payment Received",
    description: "Payment confirmation",
    defaultPriority: "normal",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "JOB_BOOKED",
  },
  payment_failed: {
    name: "Payment Failed",
    description: "Payment failure notification",
    defaultPriority: "high",
    requiresApprovalDefault: true,
    allowedChannels: ["sms"],
    journeyStage: "JOB_BOOKED",
  },
  review_request: {
    name: "Review Request",
    description: "Request for customer review",
    defaultPriority: "low",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "JOB_BOOKED",
  },
  upsell_offer: {
    name: "Upsell Offer",
    description: "Offering additional services",
    defaultPriority: "low",
    requiresApprovalDefault: true,
    allowedChannels: ["sms"],
    journeyStage: "JOB_BOOKED",
  },
  seasonal_reminder: {
    name: "Seasonal Reminder",
    description: "Seasonal service reminder",
    defaultPriority: "low",
    requiresApprovalDefault: false,
    allowedChannels: ["sms"],
    journeyStage: "JOB_BOOKED",
  },
  churn_recovery: {
    name: "Churn Recovery",
    description: "Re-engagement for inactive customers",
    defaultPriority: "low",
    requiresApprovalDefault: true,
    allowedChannels: ["sms"],
    journeyStage: "JOB_BOOKED",
  },
  general_inquiry_response: {
    name: "General Inquiry Response",
    description: "Response to general customer questions",
    defaultPriority: "normal",
    requiresApprovalDefault: true,
    allowedChannels: ["sms"],
    journeyStage: "LEAD_INTAKE",
  },
  custom_message: {
    name: "Custom Message",
    description: "Custom message from business owner",
    defaultPriority: "normal",
    requiresApprovalDefault: true,
    allowedChannels: ["sms", "email"],
    journeyStage: "LEAD_INTAKE",
  },
};

export function createIntent(
  intentType: CommunicationIntentType,
  recipient: Recipient,
  business: BusinessContext,
  options?: Partial<CommunicationIntent>
): CommunicationIntent {
  const metadata = INTENT_METADATA[intentType];
  const id = `intent_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  return {
    id,
    intentType,
    channel: options?.channel || "sms",
    priority: options?.priority || metadata.defaultPriority,
    recipient,
    business,
    requiresApproval: options?.requiresApproval ?? metadata.requiresApprovalDefault,
    triggeredBy: options?.triggeredBy || "orchestrator",
    createdAt: new Date(),
    ...options,
  };
}
