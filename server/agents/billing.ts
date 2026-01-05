import { z } from "zod";
import OpenAI from "openai";
import { storage } from "../storage";
import type { Job, Invoice, InsertInvoice, InsertInvoiceLineItem } from "@shared/schema";

const messageSchema = z.object({
  channel: z.enum(["sms", "email"]),
  to: z.string().min(1),
  text: z.string().min(1).max(500),
});

const actionSchema = z.object({
  type: z.enum(["send_reminder", "offer_payment_link", "handoff_to_human"]),
  payment_link: z.string().nullable(),
  next_followup_in_days: z.number().int().min(0).max(30),
});

export const billingActionSchema = z.object({
  message: messageSchema,
  action: actionSchema,
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()),
});

export type BillingAction = z.infer<typeof billingActionSchema>;

export interface InvoiceData {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  amount: number;
  due_date: string;
  status: "pending" | "overdue" | "paid" | "disputed";
  days_overdue: number;
}

export interface CustomerHistory {
  previous_delinquencies: number;
  last_payment_date?: string;
  total_lifetime_value: number;
  notes?: string;
}

export interface BillingConfig {
  business_name: string;
  payment_link_base_url?: string;
  include_late_fee_language: boolean;
  escalation_cadence_days: number[];
  tone: "friendly" | "professional" | "firm";
}

export interface PolicyThresholds {
  tier: "owner" | "smb" | "commercial";
  auto_send_reminders: boolean;
  max_auto_followups: number;
}

function buildSystemPrompt(config: BillingConfig): string {
  const toneGuidance = {
    friendly: "Use warm, understanding language. Assume the customer simply forgot or has a good reason for delay.",
    professional: "Use clear, businesslike language. Be direct but courteous.",
    firm: "Be direct and clear about expectations while remaining respectful.",
  };

  return `You are a billing assistant for ${config.business_name}, a landscaping/lawn care company.

Your role is to help collect payments while maintaining positive customer relationships.

TONE: ${toneGuidance[config.tone]}

CRITICAL RULES:
1. ALWAYS be polite and assume good intent
2. NEVER use threatening language
3. NEVER mention late fees${config.include_late_fee_language ? " unless the invoice is significantly overdue (14+ days)" : ""}
4. Focus on making payment easy and convenient
5. Acknowledge any history of good payment if applicable

When crafting messages:
- Keep SMS messages under 160 characters when possible
- Include the amount owed clearly
- Mention the service provided if known
- Offer easy payment options
- For email, you can be more detailed

Respond with a JSON object matching the BillingAction schema.`;
}

function buildUserPrompt(
  invoice: InvoiceData,
  history: CustomerHistory,
  config: BillingConfig,
  escalationStep: number
): string {
  const historyContext = history.previous_delinquencies > 0
    ? `Customer has ${history.previous_delinquencies} previous late payments.`
    : "Customer has good payment history.";

  const lifetimeContext = history.total_lifetime_value > 1000
    ? "This is a valuable long-term customer."
    : "";

  return `Generate a billing action for this invoice:

INVOICE:
- Customer: ${invoice.customer_name}
- Phone: ${invoice.customer_phone}
- Email: ${invoice.customer_email || "not provided"}
- Amount: $${invoice.amount.toFixed(2)}
- Due Date: ${invoice.due_date}
- Status: ${invoice.status}
- Days Overdue: ${invoice.days_overdue}

CUSTOMER HISTORY:
- ${historyContext}
- ${lifetimeContext}
${history.notes ? `- Notes: ${history.notes}` : ""}

ESCALATION:
- This is escalation step ${escalationStep + 1}
- Cadence: ${config.escalation_cadence_days.join(", ")} days
${config.payment_link_base_url ? `- Payment link available: ${config.payment_link_base_url}/pay/${invoice.id}` : "- No payment link configured"}

Determine the appropriate action:
- send_reminder: Standard payment reminder
- offer_payment_link: Include direct payment link
- handoff_to_human: Escalate to human for complex situations

Choose SMS for brief reminders, email for detailed communications.
Set next_followup_in_days based on the escalation cadence.`;
}

function sanitizeMessage(text: string, channel: "sms" | "email"): string {
  let sanitized = text
    .replace(/[\u{1F600}-\u{1F6FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
    .trim();

  const threatPatterns = [
    /legal action/gi,
    /sue you/gi,
    /court/gi,
    /attorney/gi,
    /lawyer/gi,
    /collections agency/gi,
    /credit score/gi,
    /credit report/gi,
    /consequences/gi,
    /force us to/gi,
    /no choice but to/gi,
  ];

  for (const pattern of threatPatterns) {
    sanitized = sanitized.replace(pattern, "");
  }

  sanitized = sanitized.replace(/\s+/g, " ").trim();

  const maxLength = channel === "sms" ? 320 : 2000;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength - 3) + "...";
  }

  return sanitized;
}

function removeLateFeeLanguage(text: string): string {
  const lateFeePatterns = [
    /late fee[s]?/gi,
    /penalty/gi,
    /interest charge[s]?/gi,
    /additional charge[s]?/gi,
    /\$?\d+(\.\d{2})?\s*(late|penalty|fee)/gi,
  ];

  let cleaned = text;
  for (const pattern of lateFeePatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

function determineEscalationStep(
  daysOverdue: number,
  cadence: number[]
): number {
  let step = 0;
  let accumulated = 0;
  for (let i = 0; i < cadence.length; i++) {
    accumulated += cadence[i];
    if (daysOverdue >= accumulated) {
      step = i + 1;
    }
  }
  return Math.min(step, cadence.length - 1);
}

function shouldHandoffToHuman(
  invoice: InvoiceData,
  history: CustomerHistory,
  escalationStep: number,
  maxAutoFollowups: number
): { handoff: boolean; reason: string } {
  if (invoice.status === "disputed") {
    return { handoff: true, reason: "Invoice is disputed - requires human review" };
  }

  if (escalationStep >= maxAutoFollowups) {
    return { handoff: true, reason: "Maximum automatic followups reached" };
  }

  if (history.previous_delinquencies >= 3 && invoice.days_overdue > 30) {
    return { handoff: true, reason: "Repeat delinquency with significant overdue - human intervention needed" };
  }

  if (invoice.amount > 5000) {
    return { handoff: true, reason: "High-value invoice requires human oversight" };
  }

  return { handoff: false, reason: "" };
}

function createFallbackAction(
  invoice: InvoiceData,
  config: BillingConfig,
  escalationStep: number
): BillingAction {
  const channel = invoice.customer_email ? "email" : "sms";
  const paymentLink = config.payment_link_base_url
    ? `${config.payment_link_base_url}/pay/${invoice.id}`
    : null;

  const nextFollowup = config.escalation_cadence_days[escalationStep] || 7;

  const text = channel === "sms"
    ? `Hi ${invoice.customer_name}, this is ${config.business_name}. Your invoice for $${invoice.amount.toFixed(2)} is due. Please let us know if you have any questions.`
    : `Hi ${invoice.customer_name},\n\nThis is a friendly reminder that your invoice for $${invoice.amount.toFixed(2)} is due${invoice.days_overdue > 0 ? ` (${invoice.days_overdue} days overdue)` : ""}.\n\n${paymentLink ? `You can pay online at: ${paymentLink}\n\n` : ""}Please let us know if you have any questions.\n\nThank you,\n${config.business_name}`;

  return {
    message: {
      channel,
      to: channel === "sms" ? invoice.customer_phone : (invoice.customer_email || invoice.customer_phone),
      text: sanitizeMessage(text, channel),
    },
    action: {
      type: paymentLink ? "offer_payment_link" : "send_reminder",
      payment_link: paymentLink,
      next_followup_in_days: nextFollowup,
    },
    confidence: 0.7,
    assumptions: [
      "Using standard reminder template",
      "Customer prefers " + channel,
    ],
  };
}

// =============================================
// INVOICE BUILD AGENT (Phase B1)
// =============================================

export interface JobDataForInvoice {
  id: number;
  title: string;
  description?: string | null;
  customerId?: number; // Optional - invoices.customerId is nullable
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  serviceType?: string;
  scheduledDate?: Date | null;
  completedDate?: Date | null;
  estimatedDuration?: number; // minutes
  actualDuration?: number; // minutes
  lotSizeSqFt?: number;
  notes?: string | null;
  status: string;
  quoteAmount?: number; // Original quote amount in cents
}

export interface PricingRules {
  baseRates: Record<string, number>; // service type -> base rate in cents
  sqftRate?: number; // cents per sqft
  hourlyRate?: number; // cents per hour
  minimumCharge?: number; // minimum invoice amount in cents
  taxRate?: number; // percentage (e.g., 0.08 for 8%)
}

export interface InvoiceLineItemSuggestion {
  description: string;
  quantity: number;
  unitPrice: number; // in cents
  serviceType?: string;
}

export interface InvoiceBuildResult {
  success: boolean;
  invoice?: Invoice;
  lineItems?: InvoiceLineItemSuggestion[];
  reasoning?: string;
  error?: string;
  confidence: number;
}

const invoiceLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(0),
  unitPrice: z.number().int().min(0), // in cents
  serviceType: z.string().optional(),
});

const invoiceBuildResponseSchema = z.object({
  lineItems: z.array(invoiceLineItemSchema),
  notes: z.string().optional(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});

function buildInvoiceBuildSystemPrompt(businessName: string): string {
  return `You are an invoice generation assistant for ${businessName}, a landscaping/lawn care company.

Your role is to analyze completed job data and generate appropriate invoice line items.

CRITICAL RULES:
1. Be accurate with pricing - use the provided rates
2. Be descriptive in line item descriptions - customers should understand what they're paying for
3. Group related work into logical line items
4. Apply lot size or hourly calculations when appropriate
5. All prices are in CENTS (not dollars)
6. Always include the service date in descriptions when available

When generating line items:
- Use clear, professional descriptions
- Include specific details (e.g., "Lawn Mowing - 5,000 sqft front and back yard")
- Separate materials from labor when applicable
- Round quantities to reasonable numbers

Respond with a JSON object matching the expected schema with lineItems array, notes, reasoning, and confidence.`;
}

function buildInvoiceBuildUserPrompt(
  job: JobDataForInvoice,
  pricing: PricingRules
): string {
  const completedDate = job.completedDate
    ? new Date(job.completedDate).toLocaleDateString()
    : job.scheduledDate
    ? new Date(job.scheduledDate).toLocaleDateString()
    : "Unknown date";

  return `Generate invoice line items for this completed job:

JOB DETAILS:
- Job ID: ${job.id}
- Title: ${job.title}
- Description: ${job.description || "None provided"}
- Service Type: ${job.serviceType || "General"}
- Status: ${job.status}
- Completed Date: ${completedDate}
- Duration: ${job.actualDuration || job.estimatedDuration || "Unknown"} minutes
${job.lotSizeSqFt ? `- Lot Size: ${job.lotSizeSqFt.toLocaleString()} sqft` : ""}
${job.notes ? `- Notes: ${job.notes}` : ""}

CUSTOMER:
- Name: ${job.customerName || "Customer #" + job.customerId}

PRICING RULES:
- Base Rates (in cents): ${JSON.stringify(pricing.baseRates)}
${pricing.sqftRate ? `- Per sqft rate: ${pricing.sqftRate} cents` : ""}
${pricing.hourlyRate ? `- Hourly rate: ${pricing.hourlyRate} cents` : ""}
${pricing.minimumCharge ? `- Minimum charge: ${pricing.minimumCharge} cents` : ""}
${pricing.taxRate ? `- Tax rate: ${(pricing.taxRate * 100).toFixed(1)}%` : ""}

Generate appropriate line items for this job. Include all services performed.
Remember: All prices must be in CENTS (e.g., $50.00 = 5000 cents).`;
}

function createFallbackLineItems(
  job: JobDataForInvoice,
  pricing: PricingRules
): InvoiceLineItemSuggestion[] {
  const serviceType = job.serviceType || "general";
  const baseRate = pricing.baseRates[serviceType] || pricing.baseRates.general || 5000; // default $50
  
  let amount = baseRate;
  
  // Apply sqft rate if available
  if (pricing.sqftRate && job.lotSizeSqFt) {
    amount = Math.max(amount, pricing.sqftRate * job.lotSizeSqFt);
  }
  
  // Apply hourly rate if duration is known
  if (pricing.hourlyRate && job.actualDuration) {
    const hours = job.actualDuration / 60;
    amount = Math.max(amount, Math.round(pricing.hourlyRate * hours));
  }
  
  // Ensure minimum charge
  if (pricing.minimumCharge) {
    amount = Math.max(amount, pricing.minimumCharge);
  }
  
  return [{
    description: `${job.title}${job.completedDate ? ` - Completed ${new Date(job.completedDate).toLocaleDateString()}` : ""}`,
    quantity: 1,
    unitPrice: amount,
    serviceType: serviceType,
  }];
}

export async function runInvoiceBuildAgent(
  job: JobDataForInvoice,
  accountId: number,
  pricing: PricingRules,
  businessName: string = "LawnFlow"
): Promise<InvoiceBuildResult> {
  try {
    // Validate job is completed
    if (job.status !== "COMPLETED" && job.status !== "completed") {
      return {
        success: false,
        error: `Job is not completed (status: ${job.status})`,
        confidence: 0,
      };
    }

    const openai = new OpenAI();
    const systemPrompt = buildInvoiceBuildSystemPrompt(businessName);
    const userPrompt = buildInvoiceBuildUserPrompt(job, pricing);

    let lineItems: InvoiceLineItemSuggestion[];
    let reasoning: string;
    let confidence: number;
    let notes: string | undefined;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const parsed = JSON.parse(content);
      const validated = invoiceBuildResponseSchema.parse(parsed);
      
      lineItems = validated.lineItems;
      reasoning = validated.reasoning;
      confidence = validated.confidence;
      notes = validated.notes;
    } catch (aiError) {
      console.error("[InvoiceBuildAgent] AI error, using fallback:", aiError);
      lineItems = createFallbackLineItems(job, pricing);
      reasoning = "Used fallback calculation due to AI error";
      confidence = 0.6;
    }

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = pricing.taxRate ? Math.round(subtotal * pricing.taxRate) : 0;
    const total = subtotal + tax;

    // Create invoice in database
    const invoiceData: InsertInvoice = {
      accountId,
      customerId: job.customerId,
      jobId: job.id,
      status: "DRAFT",
      currency: "USD",
      subtotal,
      tax,
      total,
      notes: notes || null,
    };

    const invoice = await storage.createInvoice(invoiceData);

    // Create line items
    for (const item of lineItems) {
      const lineItemData: InsertInvoiceLineItem = {
        invoiceId: invoice.id,
        name: item.description.substring(0, 50), // Use description for name
        description: item.description,
        quantity: Math.round(item.quantity),
        unitPrice: item.unitPrice,
        amount: Math.round(item.quantity * item.unitPrice),
        serviceCode: item.serviceType,
      };
      await storage.createInvoiceLineItem(lineItemData);
    }

    return {
      success: true,
      invoice,
      lineItems,
      reasoning,
      confidence,
    };
  } catch (error: any) {
    console.error("[InvoiceBuildAgent] Error:", error);
    return {
      success: false,
      error: error.message,
      confidence: 0,
    };
  }
}

// =============================================
// RECONCILIATION WORKER (Phase B1)
// =============================================

export interface ReconciliationResult {
  invoiceId: number;
  isValid: boolean;
  issues: ReconciliationIssue[];
  suggestedActions: string[];
}

export interface ReconciliationIssue {
  type: "VARIANCE" | "SYNC_ERROR" | "DUPLICATE" | "MISSING_PAYMENT" | "OVERPAYMENT";
  severity: "LOW" | "MED" | "HIGH";
  description: string;
  amount?: number;
}

export async function runReconciliationWorker(
  accountId: number
): Promise<ReconciliationResult[]> {
  const results: ReconciliationResult[] = [];
  
  try {
    // Get all invoices that need reconciliation (SENT, PARTIAL, OVERDUE)
    const invoicesToCheck = await storage.getInvoices(accountId, { 
      status: undefined // Get all, we'll filter below
    });
    
    const relevantStatuses = ["SENT", "PARTIAL", "OVERDUE", "PAID"];
    const invoicesForReconciliation = invoicesToCheck.filter(
      inv => relevantStatuses.includes(inv.status)
    );

    // Get all payments once for efficiency
    const allPayments = await storage.getPayments(accountId, {});
    
    // Get existing open billing issues to avoid duplicates
    const existingIssues = await storage.getBillingIssues(accountId, { status: "OPEN" });
    const existingIssueKeys = new Set(
      existingIssues.map(i => `${i.relatedInvoiceId}-${i.type}-${i.summary}`)
    );

    for (const invoice of invoicesForReconciliation) {
      const issues: ReconciliationIssue[] = [];
      const suggestedActions: string[] = [];

      // Filter payments for this specific invoice
      const invoicePayments = allPayments.filter(p => p.invoiceId === invoice.id);
      
      // Calculate total paid (only completed/succeeded payments)
      const totalPaid = invoicePayments
        .filter(p => p.status === "COMPLETED" || p.status === "SUCCEEDED" || p.status === "RECEIVED")
        .reduce((sum, p) => sum + p.amount, 0);
      
      const outstanding = invoice.total - totalPaid;

      // Check for overpayment
      if (totalPaid > invoice.total) {
        issues.push({
          type: "OVERPAYMENT",
          severity: "MED",
          description: `Invoice overpaid by ${formatCents(totalPaid - invoice.total)}`,
          amount: totalPaid - invoice.total,
        });
        suggestedActions.push("Issue refund or apply credit to next invoice");
      }

      // Check for status mismatch
      if (invoice.status === "PAID" && outstanding > 0) {
        issues.push({
          type: "VARIANCE",
          severity: "HIGH",
          description: `Invoice marked as PAID but has ${formatCents(outstanding)} outstanding`,
          amount: outstanding,
        });
        suggestedActions.push("Update invoice status to PARTIAL or investigate missing payment");
      }

      if (invoice.status === "SENT" && totalPaid > 0 && totalPaid < invoice.total) {
        issues.push({
          type: "VARIANCE",
          severity: "LOW",
          description: `Invoice has partial payment of ${formatCents(totalPaid)} but status is SENT`,
          amount: totalPaid,
        });
        suggestedActions.push("Update invoice status to PARTIAL");
      }

      if (invoice.status !== "PAID" && outstanding === 0 && totalPaid > 0) {
        issues.push({
          type: "VARIANCE",
          severity: "MED",
          description: `Invoice fully paid (${formatCents(totalPaid)}) but status is ${invoice.status}`,
        });
        suggestedActions.push("Update invoice status to PAID");
      }

      // Check for overdue invoices
      if (invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status === "SENT") {
        issues.push({
          type: "VARIANCE",
          severity: "MED",
          description: "Invoice is past due date but status is SENT",
        });
        suggestedActions.push("Update invoice status to OVERDUE");
      }

      // Create billing issues for HIGH severity problems (avoid duplicates)
      for (const issue of issues) {
        if (issue.severity === "HIGH") {
          const issueKey = `${invoice.id}-${issue.type}-${issue.description}`;
          if (!existingIssueKeys.has(issueKey)) {
            try {
              await storage.createBillingIssue({
                accountId,
                type: issue.type,
                severity: issue.severity,
                status: "OPEN",
                relatedInvoiceId: invoice.id,
                summary: issue.description,
                detailsJson: { issue, suggestedActions },
              });
              existingIssueKeys.add(issueKey); // Prevent duplicates in same run
            } catch (e) {
              console.error("[ReconciliationWorker] Failed to create billing issue:", e);
            }
          }
        }
      }

      results.push({
        invoiceId: invoice.id,
        isValid: issues.length === 0,
        issues,
        suggestedActions,
      });
    }

    return results;
  } catch (error: any) {
    console.error("[ReconciliationWorker] Error:", error);
    throw error;
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function runBillingAgent(
  invoice: InvoiceData,
  history: CustomerHistory,
  config: BillingConfig,
  policy: PolicyThresholds
): Promise<BillingAction> {
  const escalationStep = determineEscalationStep(
    invoice.days_overdue,
    config.escalation_cadence_days
  );

  const handoffCheck = shouldHandoffToHuman(
    invoice,
    history,
    escalationStep,
    policy.max_auto_followups
  );

  if (handoffCheck.handoff) {
    return {
      message: {
        channel: "email",
        to: invoice.customer_email || invoice.customer_phone,
        text: `Billing case for ${invoice.customer_name} requires human review.`,
      },
      action: {
        type: "handoff_to_human",
        payment_link: null,
        next_followup_in_days: 0,
      },
      confidence: 1.0,
      assumptions: [handoffCheck.reason],
    };
  }

  const openai = new OpenAI();
  const systemPrompt = buildSystemPrompt(config);
  const userPrompt = buildUserPrompt(invoice, history, config, escalationStep);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return createFallbackAction(invoice, config, escalationStep);
    }

    const parsed = JSON.parse(content);
    const validated = billingActionSchema.parse(parsed);

    let messageText = sanitizeMessage(validated.message.text, validated.message.channel);
    if (!config.include_late_fee_language) {
      messageText = removeLateFeeLanguage(messageText);
    }

    return {
      ...validated,
      message: {
        ...validated.message,
        text: messageText,
      },
    };
  } catch (error) {
    console.error("[BillingAgent] Error:", error);
    return createFallbackAction(invoice, config, escalationStep);
  }
}

// =============================================
// QUICKBOOKS SYNC AGENT (Phase B2)
// =============================================

export interface QuickBooksConfig {
  realmId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  baseUrl?: string; // sandbox or production
}

export interface QBOCustomer {
  Id?: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
}

export interface QBOInvoice {
  Id?: string;
  DocNumber?: string;
  TxnDate: string;
  DueDate?: string;
  CustomerRef: { value: string; name?: string };
  Line: QBOInvoiceLine[];
  TotalAmt?: number;
  Balance?: number;
  EmailStatus?: string;
  BillEmail?: { Address: string };
}

export interface QBOInvoiceLine {
  DetailType: "SalesItemLineDetail" | "DescriptionOnly";
  Amount: number;
  Description?: string;
  SalesItemLineDetail?: {
    ItemRef: { value: string; name?: string };
    Qty?: number;
    UnitPrice?: number;
  };
}

export interface QBOPayment {
  Id?: string;
  TxnDate: string;
  TotalAmt: number;
  CustomerRef: { value: string; name?: string };
  Line?: {
    Amount: number;
    LinkedTxn: { TxnId: string; TxnType: "Invoice" }[];
  }[];
  PaymentMethodRef?: { value: string; name?: string };
}

export interface SyncResult {
  success: boolean;
  action: "created" | "updated" | "skipped" | "error";
  localId: number;
  externalId?: string;
  error?: string;
  details?: Record<string, any>;
}

// QuickBooks API client class
export class QuickBooksClient {
  private config: QuickBooksConfig;
  private accountId: number;
  private baseUrl: string;

  constructor(accountId: number, config: QuickBooksConfig) {
    this.accountId = accountId;
    this.config = config;
    this.baseUrl = config.baseUrl || "https://quickbooks.api.intuit.com";
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(this.config.tokenExpiresAt);
    
    // Refresh if expires within 5 minutes
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      console.log("[QuickBooksClient] Token expires soon, refreshing...");
      // In production, this would call Intuit OAuth refresh endpoint
      // and update the token in the database
      // For now, we'll log a warning
      console.warn("[QuickBooksClient] Token refresh not yet implemented");
    }
  }

  private async makeRequest<T>(
    method: "GET" | "POST",
    endpoint: string,
    body?: any
  ): Promise<T> {
    await this.refreshTokenIfNeeded();

    const url = `${this.baseUrl}/v3/company/${this.config.realmId}/${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QuickBooks API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async getCustomer(id: string): Promise<QBOCustomer | null> {
    try {
      const result = await this.makeRequest<{ Customer: QBOCustomer }>(
        "GET",
        `customer/${id}`
      );
      return result.Customer;
    } catch (error) {
      console.error("[QuickBooksClient] Error fetching customer:", error);
      return null;
    }
  }

  async findCustomerByEmail(email: string): Promise<QBOCustomer | null> {
    try {
      const query = encodeURIComponent(`SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email}'`);
      const result = await this.makeRequest<{ QueryResponse: { Customer?: QBOCustomer[] } }>(
        "GET",
        `query?query=${query}`
      );
      return result.QueryResponse.Customer?.[0] || null;
    } catch (error) {
      console.error("[QuickBooksClient] Error finding customer:", error);
      return null;
    }
  }

  async createCustomer(customer: QBOCustomer): Promise<QBOCustomer> {
    const result = await this.makeRequest<{ Customer: QBOCustomer }>(
      "POST",
      "customer",
      customer
    );
    return result.Customer;
  }

  async createInvoice(invoice: QBOInvoice): Promise<QBOInvoice> {
    const result = await this.makeRequest<{ Invoice: QBOInvoice }>(
      "POST",
      "invoice",
      invoice
    );
    return result.Invoice;
  }

  async getInvoice(id: string): Promise<QBOInvoice | null> {
    try {
      const result = await this.makeRequest<{ Invoice: QBOInvoice }>(
        "GET",
        `invoice/${id}`
      );
      return result.Invoice;
    } catch (error) {
      console.error("[QuickBooksClient] Error fetching invoice:", error);
      return null;
    }
  }

  async getPaymentsSince(since: Date): Promise<QBOPayment[]> {
    try {
      const sinceStr = since.toISOString().split("T")[0];
      const query = encodeURIComponent(
        `SELECT * FROM Payment WHERE MetaData.LastUpdatedTime >= '${sinceStr}'`
      );
      const result = await this.makeRequest<{ QueryResponse: { Payment?: QBOPayment[] } }>(
        "GET",
        `query?query=${query}`
      );
      return result.QueryResponse.Payment || [];
    } catch (error) {
      console.error("[QuickBooksClient] Error fetching payments:", error);
      return [];
    }
  }
}

// Invoice Sync Agent - syncs local invoices to QuickBooks
export async function runInvoiceSyncAgent(
  accountId: number,
  invoiceId: number
): Promise<SyncResult> {
  try {
    // Get local invoice
    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) {
      return {
        success: false,
        action: "error",
        localId: invoiceId,
        error: "Invoice not found",
      };
    }

    // Check if already synced
    if (invoice.externalInvoiceId) {
      return {
        success: true,
        action: "skipped",
        localId: invoiceId,
        externalId: invoice.externalInvoiceId,
        details: { reason: "Already synced" },
      };
    }

    // Get QuickBooks integration
    const integration = await storage.getAccountIntegration(accountId, "QUICKBOOKS");
    if (!integration || integration.status !== "CONNECTED") {
      return {
        success: false,
        action: "error",
        localId: invoiceId,
        error: "QuickBooks not connected",
      };
    }

    // Initialize client
    const client = new QuickBooksClient(accountId, {
      realmId: integration.realmId || "",
      accessToken: integration.accessToken || "",
      refreshToken: integration.refreshToken || "",
      tokenExpiresAt: integration.tokenExpiresAt || new Date(),
    });

    // Get line items
    const lineItems = await storage.getInvoiceLineItems(invoiceId);

    // Build QuickBooks invoice
    const qboInvoice: QBOInvoice = {
      TxnDate: invoice.invoiceDate?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
      DueDate: invoice.dueDate?.toISOString().split("T")[0],
      CustomerRef: { value: invoice.externalCustomerId || "1" }, // Default customer if not mapped
      Line: lineItems.map(item => ({
        DetailType: "SalesItemLineDetail" as const,
        Amount: item.amount / 100, // Convert cents to dollars
        Description: item.name,
        SalesItemLineDetail: {
          ItemRef: { value: item.externalItemId || "1" }, // Default item if not mapped
          Qty: item.quantity,
          UnitPrice: item.unitPrice / 100,
        },
      })),
    };

    // Create in QuickBooks
    const created = await client.createInvoice(qboInvoice);

    // Update local invoice with external ID
    await storage.updateInvoice(invoiceId, {
      externalInvoiceId: created.Id,
      status: "SENT",
    });

    // Update sync timestamp
    await storage.updateAccountIntegration(integration.id, {
      lastSyncAt: new Date(),
    });

    return {
      success: true,
      action: "created",
      localId: invoiceId,
      externalId: created.Id,
      details: { docNumber: created.DocNumber },
    };
  } catch (error: any) {
    console.error("[InvoiceSyncAgent] Error:", error);
    
    // Create billing issue for sync failure
    await storage.createBillingIssue({
      accountId,
      type: "SYNC_ERROR",
      severity: "HIGH",
      status: "OPEN",
      relatedInvoiceId: invoiceId,
      summary: `Failed to sync invoice to QuickBooks: ${error.message}`,
      detailsJson: { error: error.message },
    });

    return {
      success: false,
      action: "error",
      localId: invoiceId,
      error: error.message,
    };
  }
}

// Payment Sync Agent - syncs payments from QuickBooks to local
export async function runPaymentSyncAgent(
  accountId: number,
  since?: Date
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  
  try {
    // Get QuickBooks integration
    const integration = await storage.getAccountIntegration(accountId, "QUICKBOOKS");
    if (!integration || integration.status !== "CONNECTED") {
      return [{
        success: false,
        action: "error",
        localId: 0,
        error: "QuickBooks not connected",
      }];
    }

    // Initialize client
    const client = new QuickBooksClient(accountId, {
      realmId: integration.realmId || "",
      accessToken: integration.accessToken || "",
      refreshToken: integration.refreshToken || "",
      tokenExpiresAt: integration.tokenExpiresAt || new Date(),
    });

    // Get payments since last sync or provided date
    const syncSince = since || integration.lastSyncAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const qboPayments = await client.getPaymentsSince(syncSince);

    // Pre-load all local data ONCE before the loop (avoid O(N^2))
    const existingPayments = await storage.getPayments(accountId, {});
    const existingInvoices = await storage.getInvoices(accountId, {});
    
    // Build lookup maps for O(1) access (guard against undefined keys)
    const paymentByExternalId = new Map(
      existingPayments.filter(p => p.externalPaymentId).map(p => [p.externalPaymentId, p])
    );
    const invoiceByExternalId = new Map(
      existingInvoices.filter(i => i.externalInvoiceId).map(i => [i.externalInvoiceId, i])
    );
    const invoiceById = new Map(
      existingInvoices.map(i => [i.id, i])
    );
    
    // Track newly created payments to update totals correctly
    const newPayments: { invoiceId: number; amount: number }[] = [];

    for (const qboPayment of qboPayments) {
      if (!qboPayment.Id) continue;

      // Check if payment already exists locally using pre-loaded map
      const existingPayment = paymentByExternalId.get(qboPayment.Id);

      if (existingPayment) {
        results.push({
          success: true,
          action: "skipped",
          localId: existingPayment.id,
          externalId: qboPayment.Id,
          details: { reason: "Already synced" },
        });
        continue;
      }

      // Find linked invoice using pre-loaded map
      let invoiceId: number | undefined;
      if (qboPayment.Line && qboPayment.Line.length > 0) {
        const linkedTxn = qboPayment.Line[0].LinkedTxn?.find(t => t.TxnType === "Invoice");
        if (linkedTxn) {
          const matchingInvoice = invoiceByExternalId.get(linkedTxn.TxnId);
          invoiceId = matchingInvoice?.id;
        }
      }

      // Create local payment
      try {
        const paymentAmount = Math.round(qboPayment.TotalAmt * 100); // Convert dollars to cents
        const payment = await storage.createPayment({
          accountId,
          invoiceId,
          amount: paymentAmount,
          paymentDate: new Date(qboPayment.TxnDate),
          method: qboPayment.PaymentMethodRef?.name || "OTHER",
          status: "COMPLETED",
          externalPaymentId: qboPayment.Id,
        });

        // Track for invoice status update
        if (invoiceId) {
          newPayments.push({ invoiceId, amount: paymentAmount });
        }

        results.push({
          success: true,
          action: "created",
          localId: payment.id,
          externalId: qboPayment.Id,
        });
      } catch (error: any) {
        results.push({
          success: false,
          action: "error",
          localId: 0,
          externalId: qboPayment.Id,
          error: error.message,
        });
      }
    }

    // Update invoice statuses based on new payments (batch at end)
    const invoicePaymentTotals = new Map<number, number>();
    
    // Sum existing completed payments per invoice
    for (const payment of existingPayments) {
      if (payment.invoiceId && (payment.status === "COMPLETED" || payment.status === "SUCCEEDED")) {
        const current = invoicePaymentTotals.get(payment.invoiceId) || 0;
        invoicePaymentTotals.set(payment.invoiceId, current + payment.amount);
      }
    }
    
    // Add newly created payments
    for (const np of newPayments) {
      const current = invoicePaymentTotals.get(np.invoiceId) || 0;
      invoicePaymentTotals.set(np.invoiceId, current + np.amount);
    }

    // Update invoice statuses
    const invoicesToUpdate = new Set(newPayments.map(np => np.invoiceId));
    for (const invoiceId of invoicesToUpdate) {
      const invoice = invoiceById.get(invoiceId);
      const totalPaid = invoicePaymentTotals.get(invoiceId) || 0;
      
      if (invoice && totalPaid >= invoice.total) {
        await storage.updateInvoice(invoiceId, { status: "PAID" });
      } else if (invoice && totalPaid > 0 && totalPaid < invoice.total) {
        await storage.updateInvoice(invoiceId, { status: "PARTIAL" });
      }
    }

    // Update sync timestamp
    await storage.updateAccountIntegration(integration.id, {
      lastSyncAt: new Date(),
    });

    return results;
  } catch (error: any) {
    console.error("[PaymentSyncAgent] Error:", error);
    return [{
      success: false,
      action: "error",
      localId: 0,
      error: error.message,
    }];
  }
}

// Batch sync all pending invoices
export async function runBatchInvoiceSync(
  accountId: number
): Promise<{ total: number; synced: number; errors: number; results: SyncResult[] }> {
  const results: SyncResult[] = [];
  
  // Get all invoices that haven't been synced
  const invoices = await storage.getInvoices(accountId, {});
  const unsyncedInvoices = invoices.filter(i => !i.externalInvoiceId && i.status !== "DRAFT");

  for (const invoice of unsyncedInvoices) {
    const result = await runInvoiceSyncAgent(accountId, invoice.id);
    results.push(result);
  }

  return {
    total: unsyncedInvoices.length,
    synced: results.filter(r => r.action === "created").length,
    errors: results.filter(r => r.action === "error").length,
    results,
  };
}

// ============================================================================
// REMEDIATION AGENT (Phase A6)
// Handles disputes, credits, redo visits
// ============================================================================

export interface RemediationInput {
  accountId: number;
  billingIssueId: number;
  invoice?: Invoice | null;
  job?: Job | null;
  customerMessages?: string[];
  crewNotes?: string;
}

export interface ResolutionOption {
  type: "CREDIT" | "REDO_VISIT" | "CALL_CUSTOMER" | "ADJUST_INVOICE" | "WAIVE_FEES";
  amount?: number;
  reason: string;
  scheduleSuggestion?: {
    preferredDate?: string;
    estimatedDuration?: number;
  };
}

export interface RemediationOutput {
  rootCause: "SCOPE_MISMATCH" | "QUALITY_ISSUE" | "PRICING_SURPRISE" | "PAYMENT_ERROR" | "COMMUNICATION_BREAKDOWN" | "UNKNOWN";
  resolutionOptions: ResolutionOption[];
  recommended: ResolutionOption;
  requiresHumanApproval: boolean;
  approvalReason?: string;
  confidence: number;
  nextAction: "CREATE_CREDIT_MEMO" | "SCHEDULE_REVISIT" | "ADJUST_INVOICE" | "ESCALATE" | "CONTACT_CUSTOMER";
}

const remediationOutputSchema = z.object({
  rootCause: z.enum(["SCOPE_MISMATCH", "QUALITY_ISSUE", "PRICING_SURPRISE", "PAYMENT_ERROR", "COMMUNICATION_BREAKDOWN", "UNKNOWN"]),
  resolutionOptions: z.array(z.object({
    type: z.enum(["CREDIT", "REDO_VISIT", "CALL_CUSTOMER", "ADJUST_INVOICE", "WAIVE_FEES"]),
    amount: z.number().optional(),
    reason: z.string(),
    scheduleSuggestion: z.object({
      preferredDate: z.string().optional(),
      estimatedDuration: z.number().optional(),
    }).optional(),
  })),
  recommended: z.object({
    type: z.enum(["CREDIT", "REDO_VISIT", "CALL_CUSTOMER", "ADJUST_INVOICE", "WAIVE_FEES"]),
    amount: z.number().optional(),
    reason: z.string(),
  }),
  requiresHumanApproval: z.boolean(),
  approvalReason: z.string().optional(),
  confidence: z.number().min(0).max(1),
  nextAction: z.enum(["CREATE_CREDIT_MEMO", "SCHEDULE_REVISIT", "ADJUST_INVOICE", "ESCALATE", "CONTACT_CUSTOMER"]),
});

export async function runRemediationAgent(input: RemediationInput): Promise<RemediationOutput> {
  const { accountId, billingIssueId } = input;
  
  // Get the billing issue
  const issue = await storage.getBillingIssue(billingIssueId);
  if (!issue) {
    throw new Error(`Billing issue ${billingIssueId} not found`);
  }

  // Get related data
  const invoice = input.invoice || (issue.relatedInvoiceId ? await storage.getInvoice(issue.relatedInvoiceId) : null);
  const job = input.job || (issue.relatedJobId ? await storage.getJob(issue.relatedJobId) : null);
  const customer = issue.relatedCustomerId ? await storage.getCustomer(issue.relatedCustomerId) : null;

  // Get business profile for policy thresholds (optional parameter)
  const businessProfile = await storage.getBusinessProfile(accountId);
  const creditThresholdDollars = 50; // Default: credits above $50 require approval
  const creditThresholdCents = creditThresholdDollars * 100;

  const systemPrompt = `You are RemediationAgent for LawnFlow.ai, a landscaping business automation platform.

Your role is to analyze billing disputes and issues, then recommend appropriate resolutions.

CRITICAL RULES:
1. Preserve customer trust while protecting business margin
2. Prefer low-cost resolutions first when appropriate
3. Any credit/refund above $${creditThresholdDollars} requires human approval
4. Never create credits that exceed the original invoice amount
5. Consider customer lifetime value when recommending resolutions
6. Be specific about root causes - don't guess if uncertain

RESOLUTION PRIORITY (prefer in this order):
1. CALL_CUSTOMER - When clarification needed or situation unclear
2. ADJUST_INVOICE - When billing error is clear and fixable
3. WAIVE_FEES - For minor late fees or service charges
4. CREDIT - When partial refund is appropriate
5. REDO_VISIT - When service quality issue requires correction

OUTPUT: Respond with valid JSON matching the RemediationOutput schema.`;

  const userPrompt = `Analyze this billing issue and recommend a resolution:

BILLING ISSUE:
- ID: ${issue.id}
- Type: ${issue.type}
- Severity: ${issue.severity}
- Summary: ${issue.summary}
- Details: ${JSON.stringify(issue.detailsJson || {})}

${invoice ? `
INVOICE:
- ID: ${invoice.id}
- Status: ${invoice.status}
- Subtotal: $${(invoice.subtotal / 100).toFixed(2)}
- Tax: $${(invoice.tax / 100).toFixed(2)}
- Total: $${(invoice.total / 100).toFixed(2)}
- Quote Range: $${invoice.minQuote ? (invoice.minQuote / 100).toFixed(2) : 'N/A'} - $${invoice.maxQuote ? (invoice.maxQuote / 100).toFixed(2) : 'N/A'}
` : 'No invoice linked.'}

${job ? `
JOB:
- ID: ${job.id}
- Status: ${job.status}
- Scheduled: ${job.scheduledDate}
` : 'No job linked.'}

${customer ? `
CUSTOMER:
- Name: ${customer.name}
- Phone: ${customer.phone}
` : 'No customer linked.'}

${input.customerMessages?.length ? `
CUSTOMER MESSAGES:
${input.customerMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}
` : ''}

${input.crewNotes ? `
CREW NOTES:
${input.crewNotes}
` : ''}

Determine the root cause, provide resolution options, and recommend the best action.`;

  try {
    const openai = new OpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    const validated = remediationOutputSchema.parse(parsed);

    // Force human approval for high-value credits
    // AI returns amounts in cents, compare against threshold in cents
    if (validated.recommended.type === "CREDIT" && validated.recommended.amount && validated.recommended.amount > creditThresholdCents) {
      validated.requiresHumanApproval = true;
      validated.approvalReason = `Credit amount ($${(validated.recommended.amount / 100).toFixed(2)}) exceeds threshold ($${creditThresholdDollars})`;
    }

    console.log("[RemediationAgent] Analysis complete:", validated.rootCause, "->", validated.nextAction);
    return validated;

  } catch (error: any) {
    console.error("[RemediationAgent] Error:", error);
    
    // Return safe fallback
    return {
      rootCause: "UNKNOWN",
      resolutionOptions: [
        { type: "CALL_CUSTOMER", reason: "Unable to analyze issue automatically - manual review required" }
      ],
      recommended: { type: "CALL_CUSTOMER", reason: "Unable to analyze issue automatically - manual review required" },
      requiresHumanApproval: true,
      approvalReason: `AI analysis failed: ${error.message}`,
      confidence: 0,
      nextAction: "ESCALATE",
    };
  }
}

// ============================================================================
// PRICING OPTIMIZATION AGENT (Phase B1)
// Analyzes quote acceptance rates and recommends pricing adjustments
// ============================================================================

export interface PricingOptimizationInput {
  accountId: number;
  period?: { start: Date; end: Date };
  serviceTypes?: string[];
}

export interface PricingRecommendation {
  serviceType: string;
  currentPrice: number;
  recommendedPrice: number;
  changePercent: number;
  reason: string;
  confidence: number;
  expectedImpact: {
    acceptanceRateChange: number;
    revenueImpact: number;
  };
}

export interface PricingOptimizationOutput {
  analysisDate: Date;
  overallHealth: "HEALTHY" | "NEEDS_ATTENTION" | "CRITICAL";
  metrics: {
    totalQuotes: number;
    acceptedQuotes: number;
    acceptanceRate: number;
    averageQuoteValue: number;
    averageDaysToDecision: number;
  };
  recommendations: PricingRecommendation[];
  requiresOwnerApproval: boolean;
  rolloutPlan?: string;
}

export async function runPricingOptimizationAgent(
  input: PricingOptimizationInput
): Promise<PricingOptimizationOutput> {
  const { accountId, period } = input;
  
  // Calculate period (default: last 30 days)
  const endDate = period?.end || new Date();
  const startDate = period?.start || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get quotes for the period
  const allQuotes = await storage.getQuotes(accountId);
  const periodQuotes = allQuotes.filter(q => {
    const createdAt = new Date(q.createdAt);
    return createdAt >= startDate && createdAt <= endDate;
  });

  const acceptedQuotes = periodQuotes.filter(q => q.status === "ACCEPTED");
  const acceptanceRate = periodQuotes.length > 0 
    ? (acceptedQuotes.length / periodQuotes.length) * 100 
    : 0;
  
  const averageQuoteValue = periodQuotes.length > 0
    ? periodQuotes.reduce((sum, q) => sum + q.total, 0) / periodQuotes.length / 100
    : 0;

  // Group by service type for analysis
  const serviceStats = new Map<string, { sent: number; accepted: number; totalValue: number }>();
  for (const quote of periodQuotes) {
    const serviceType = (quote.servicesJson as any)?.primary || "LAWN_MOWING";
    const stats = serviceStats.get(serviceType) || { sent: 0, accepted: 0, totalValue: 0 };
    stats.sent++;
    if (quote.status === "ACCEPTED") stats.accepted++;
    stats.totalValue += quote.total;
    serviceStats.set(serviceType, stats);
  }

  // Determine overall health
  let overallHealth: "HEALTHY" | "NEEDS_ATTENTION" | "CRITICAL" = "HEALTHY";
  if (acceptanceRate < 30) {
    overallHealth = "CRITICAL";
  } else if (acceptanceRate < 50) {
    overallHealth = "NEEDS_ATTENTION";
  }

  // Generate recommendations based on acceptance rates
  const recommendations: PricingRecommendation[] = [];
  
  for (const [serviceType, stats] of serviceStats) {
    const serviceAcceptanceRate = stats.sent > 0 ? (stats.accepted / stats.sent) * 100 : 0;
    const avgValue = stats.sent > 0 ? stats.totalValue / stats.sent / 100 : 0;
    
    if (stats.sent >= 5) { // Only recommend with sufficient data
      if (serviceAcceptanceRate < 40) {
        // Low acceptance - consider lowering prices
        const reduction = Math.min(15, 50 - serviceAcceptanceRate);
        recommendations.push({
          serviceType,
          currentPrice: avgValue,
          recommendedPrice: avgValue * (1 - reduction / 100),
          changePercent: -reduction,
          reason: `Low acceptance rate (${serviceAcceptanceRate.toFixed(1)}%) suggests prices may be too high`,
          confidence: Math.min(0.9, stats.sent / 20),
          expectedImpact: {
            acceptanceRateChange: reduction * 1.5,
            revenueImpact: (reduction * 1.5 - reduction) / 100,
          },
        });
      } else if (serviceAcceptanceRate > 80 && stats.sent >= 10) {
        // Very high acceptance - opportunity to increase prices
        const increase = Math.min(10, (serviceAcceptanceRate - 70) / 3);
        recommendations.push({
          serviceType,
          currentPrice: avgValue,
          recommendedPrice: avgValue * (1 + increase / 100),
          changePercent: increase,
          reason: `High acceptance rate (${serviceAcceptanceRate.toFixed(1)}%) suggests room for price increase`,
          confidence: Math.min(0.85, stats.sent / 25),
          expectedImpact: {
            acceptanceRateChange: -increase * 0.5,
            revenueImpact: increase / 100 * 0.8,
          },
        });
      }
    }
  }

  console.log("[PricingOptimizationAgent] Analysis complete:", {
    quotes: periodQuotes.length,
    acceptanceRate: acceptanceRate.toFixed(1) + "%",
    recommendations: recommendations.length,
  });

  return {
    analysisDate: new Date(),
    overallHealth,
    metrics: {
      totalQuotes: periodQuotes.length,
      acceptedQuotes: acceptedQuotes.length,
      acceptanceRate,
      averageQuoteValue,
      averageDaysToDecision: 3, // Simplified for now
    },
    recommendations,
    requiresOwnerApproval: true, // All pricing changes require approval
    rolloutPlan: recommendations.length > 0 
      ? "Recommend implementing changes gradually over 2 weeks, monitoring acceptance rates closely." 
      : undefined,
  };
}

// ============================================================================
// CAPACITY FORECASTING AGENT (Phase B2)
// Forecasts crew capacity and provides scheduling recommendations
// ============================================================================

export interface CapacityForecastInput {
  accountId: number;
  forecastDays?: number;
  zones?: number[];
}

export interface DailyCapacity {
  date: string;
  availableSlots: number;
  bookedSlots: number;
  utilizationPercent: number;
  recommendation: "ACCEPT_MORE" | "AT_CAPACITY" | "OVERBOOKED" | "PAUSE_INTAKE";
}

export interface CapacityForecastOutput {
  forecastDate: Date;
  overallCapacity: "AVAILABLE" | "LIMITED" | "FULL" | "OVERLOADED";
  dailyForecast: DailyCapacity[];
  zoneRecommendations: {
    zoneId: number;
    zoneName: string;
    status: "ACCEPT" | "PAUSE" | "REDIRECT";
    reason: string;
  }[];
  summary: string;
}

export async function runCapacityForecastingAgent(
  input: CapacityForecastInput
): Promise<CapacityForecastOutput> {
  const { accountId, forecastDays = 7 } = input;

  // Get crews and their schedules
  const crews = await storage.getCrews(accountId);
  const activeCrews = crews.filter(c => c.status === "ACTIVE");
  
  // Get upcoming jobs
  const jobs = await storage.getJobs(accountId);
  const now = new Date();
  const endDate = new Date(now.getTime() + forecastDays * 24 * 60 * 60 * 1000);
  
  const upcomingJobs = jobs.filter(j => {
    if (!j.scheduledDate) return false;
    const jobDate = new Date(j.scheduledDate);
    return jobDate >= now && jobDate <= endDate && j.status !== "COMPLETED" && j.status !== "CANCELLED";
  });

  // Calculate daily capacity
  const dailyForecast: DailyCapacity[] = [];
  const slotsPerCrewPerDay = 4; // Assume 4 job slots per crew per day
  const totalDailySlots = activeCrews.length * slotsPerCrewPerDay;

  for (let i = 0; i < forecastDays; i++) {
    const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayJobs = upcomingJobs.filter(j => {
      const jobDate = new Date(j.scheduledDate!).toISOString().split('T')[0];
      return jobDate === dateStr;
    });
    
    const bookedSlots = dayJobs.length;
    const availableSlots = Math.max(0, totalDailySlots - bookedSlots);
    const utilizationPercent = totalDailySlots > 0 ? (bookedSlots / totalDailySlots) * 100 : 0;
    
    let recommendation: DailyCapacity["recommendation"] = "ACCEPT_MORE";
    if (utilizationPercent >= 100) {
      recommendation = "OVERBOOKED";
    } else if (utilizationPercent >= 90) {
      recommendation = "PAUSE_INTAKE";
    } else if (utilizationPercent >= 75) {
      recommendation = "AT_CAPACITY";
    }

    dailyForecast.push({
      date: dateStr,
      availableSlots,
      bookedSlots,
      utilizationPercent,
      recommendation,
    });
  }

  // Calculate overall capacity status
  const avgUtilization = dailyForecast.reduce((sum, d) => sum + d.utilizationPercent, 0) / dailyForecast.length;
  let overallCapacity: CapacityForecastOutput["overallCapacity"] = "AVAILABLE";
  if (avgUtilization >= 95) {
    overallCapacity = "OVERLOADED";
  } else if (avgUtilization >= 80) {
    overallCapacity = "FULL";
  } else if (avgUtilization >= 60) {
    overallCapacity = "LIMITED";
  }

  // Zone recommendations (simplified)
  const zones = await storage.getServiceZones(accountId);
  const totalCapacity = totalDailySlots * forecastDays;
  const zoneRecommendations = zones.slice(0, 5).map(zone => {
    const zoneJobs = upcomingJobs.filter(j => j.zoneId === zone.id);
    // Guard against division by zero when no crews available
    const zoneUtilization = totalCapacity > 0 ? (zoneJobs.length / totalCapacity) * 100 : 0;
    
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      status: zoneUtilization > 80 ? "PAUSE" as const : zoneUtilization > 50 ? "REDIRECT" as const : "ACCEPT" as const,
      reason: zoneUtilization > 80 
        ? `Zone is at ${zoneUtilization.toFixed(0)}% capacity` 
        : `Zone has availability (${zoneUtilization.toFixed(0)}% utilized)`,
    };
  });

  const summary = `${activeCrews.length} active crews with ${totalDailySlots} daily slots. ` +
    `Average utilization: ${avgUtilization.toFixed(0)}% over next ${forecastDays} days. ` +
    `${dailyForecast.filter(d => d.recommendation === "PAUSE_INTAKE" || d.recommendation === "OVERBOOKED").length} days at or over capacity.`;

  console.log("[CapacityForecastingAgent] Forecast complete:", overallCapacity, avgUtilization.toFixed(1) + "%");

  return {
    forecastDate: new Date(),
    overallCapacity,
    dailyForecast,
    zoneRecommendations,
    summary,
  };
}

// ============================================================================
// CREW PERFORMANCE AGENT (Phase B3)
// Analyzes crew performance and provides coaching insights
// ============================================================================

export interface CrewPerformanceInput {
  accountId: number;
  crewId?: number;
  period?: { start: Date; end: Date };
}

export interface CrewInsight {
  crewId: number;
  crewName: string;
  metrics: {
    jobsCompleted: number;
    avgDurationVariance: number; // Actual vs estimated
    onTimeRate: number;
    customerSatisfaction?: number;
    reworkRate: number;
  };
  coaching: {
    type: "PRAISE" | "IMPROVEMENT" | "TRAINING" | "EQUIPMENT";
    message: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
  }[];
  scheduleAdjustments?: string[];
  equipmentReminders?: string[];
}

export interface CrewPerformanceOutput {
  analysisDate: Date;
  period: { start: Date; end: Date };
  crewInsights: CrewInsight[];
  topPerformers: { crewId: number; crewName: string; highlight: string }[];
  overallRecommendations: string[];
}

export async function runCrewPerformanceAgent(
  input: CrewPerformanceInput
): Promise<CrewPerformanceOutput> {
  const { accountId, crewId, period } = input;

  const endDate = period?.end || new Date();
  const startDate = period?.start || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get crews
  const allCrews = await storage.getCrews(accountId);
  const crews = crewId ? allCrews.filter(c => c.id === crewId) : allCrews.filter(c => c.status === "ACTIVE");

  // Get completed jobs in period
  const jobs = await storage.getJobs(accountId);
  const periodJobs = jobs.filter(j => {
    if (j.status !== "COMPLETED" || !j.completedAt) return false;
    const completedAt = new Date(j.completedAt);
    return completedAt >= startDate && completedAt <= endDate;
  });

  // Analyze each crew
  const crewInsights: CrewInsight[] = [];
  
  for (const crew of crews) {
    const crewJobs = periodJobs.filter(j => j.crewId === crew.id);
    
    if (crewJobs.length === 0) {
      crewInsights.push({
        crewId: crew.id,
        crewName: crew.name,
        metrics: {
          jobsCompleted: 0,
          avgDurationVariance: 0,
          onTimeRate: 0,
          reworkRate: 0,
        },
        coaching: [{
          type: "IMPROVEMENT",
          message: "No completed jobs in this period - check scheduling or availability",
          priority: "HIGH",
        }],
      });
      continue;
    }

    // Calculate metrics
    const onTimeJobs = crewJobs.filter(j => {
      if (!j.scheduledDate || !j.startedAt) return false;
      const scheduled = new Date(j.scheduledDate);
      const started = new Date(j.startedAt);
      const diffMinutes = (started.getTime() - scheduled.getTime()) / (1000 * 60);
      return diffMinutes <= 15; // Within 15 minutes = on time
    });

    const onTimeRate = (onTimeJobs.length / crewJobs.length) * 100;
    const reworkJobs = crewJobs.filter(j => j.notes?.toLowerCase().includes("rework") || j.notes?.toLowerCase().includes("redo"));
    const reworkRate = (reworkJobs.length / crewJobs.length) * 100;

    // Generate coaching insights
    const coaching: CrewInsight["coaching"] = [];
    
    if (onTimeRate >= 90) {
      coaching.push({
        type: "PRAISE",
        message: `Excellent punctuality! ${onTimeRate.toFixed(0)}% on-time arrival rate.`,
        priority: "LOW",
      });
    } else if (onTimeRate < 70) {
      coaching.push({
        type: "IMPROVEMENT",
        message: `On-time rate of ${onTimeRate.toFixed(0)}% needs improvement. Consider reviewing route planning.`,
        priority: "HIGH",
      });
    }

    if (reworkRate > 5) {
      coaching.push({
        type: "TRAINING",
        message: `Rework rate of ${reworkRate.toFixed(0)}% - review quality standards with crew.`,
        priority: "MEDIUM",
      });
    }

    crewInsights.push({
      crewId: crew.id,
      crewName: crew.name,
      metrics: {
        jobsCompleted: crewJobs.length,
        avgDurationVariance: 0, // Would need estimated duration data
        onTimeRate,
        reworkRate,
      },
      coaching,
    });
  }

  // Find top performers
  const topPerformers = crewInsights
    .filter(c => c.metrics.jobsCompleted > 0)
    .sort((a, b) => {
      const scoreA = a.metrics.onTimeRate - a.metrics.reworkRate * 5;
      const scoreB = b.metrics.onTimeRate - b.metrics.reworkRate * 5;
      return scoreB - scoreA;
    })
    .slice(0, 3)
    .map(c => ({
      crewId: c.crewId,
      crewName: c.crewName,
      highlight: `${c.metrics.jobsCompleted} jobs, ${c.metrics.onTimeRate.toFixed(0)}% on-time`,
    }));

  // Overall recommendations
  const overallRecommendations: string[] = [];
  const avgOnTimeRate = crewInsights.reduce((sum, c) => sum + c.metrics.onTimeRate, 0) / crewInsights.length;
  
  if (avgOnTimeRate < 80) {
    overallRecommendations.push("Consider reviewing route optimization settings - overall on-time rates are below target.");
  }
  
  const highReworkCrews = crewInsights.filter(c => c.metrics.reworkRate > 10);
  if (highReworkCrews.length > 0) {
    overallRecommendations.push(`${highReworkCrews.length} crew(s) have elevated rework rates - schedule quality training session.`);
  }

  console.log("[CrewPerformanceAgent] Analysis complete:", crewInsights.length, "crews analyzed");

  return {
    analysisDate: new Date(),
    period: { start: startDate, end: endDate },
    crewInsights,
    topPerformers,
    overallRecommendations,
  };
}

// ============================================================================
// RETENTION AGENT (Phase B4)
// Analyzes customer retention and recommends outreach
// ============================================================================

export interface RetentionInput {
  accountId: number;
  customerId?: number;
}

export interface CustomerRetentionInsight {
  customerId: number;
  customerName: string;
  churnRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  churnRiskScore: number;
  factors: string[];
  lastServiceDate?: Date;
  daysSinceLastService: number;
  totalLifetimeValue: number;
  recommendedAction: {
    type: "FOLLOW_UP_CALL" | "SATISFACTION_SURVEY" | "LOYALTY_OFFER" | "REACTIVATION_CAMPAIGN" | "UPSELL_OPPORTUNITY" | "NO_ACTION";
    message: string;
    timing: "IMMEDIATE" | "NEXT_WEEK" | "NEXT_MONTH";
    channel: "SMS" | "EMAIL" | "PHONE";
  };
}

export interface RetentionOutput {
  analysisDate: Date;
  overallRetentionHealth: "HEALTHY" | "NEEDS_ATTENTION" | "AT_RISK";
  metrics: {
    totalActiveCustomers: number;
    atRiskCustomers: number;
    churnedThisMonth: number;
    averageLifetimeValue: number;
  };
  insights: CustomerRetentionInsight[];
  campaignSuggestions: {
    type: string;
    targetCount: number;
    estimatedImpact: string;
  }[];
}

export async function runRetentionAgent(input: RetentionInput): Promise<RetentionOutput> {
  const { accountId, customerId } = input;

  // Get customers
  const allCustomers = await storage.getCustomers(accountId);
  const customers = customerId 
    ? allCustomers.filter(c => c.id === customerId) 
    : allCustomers;

  // Get jobs for analysis
  const jobs = await storage.getJobs(accountId);
  const now = new Date();

  const insights: CustomerRetentionInsight[] = [];

  for (const customer of customers.slice(0, 50)) { // Limit for performance
    // Find customer's jobs
    const customerJobs = jobs.filter(j => j.customerId === customer.id);
    const completedJobs = customerJobs.filter(j => j.status === "COMPLETED");
    
    // Calculate metrics
    const lastJob = completedJobs
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];
    
    const lastServiceDate = lastJob ? new Date(lastJob.completedAt!) : undefined;
    const daysSinceLastService = lastServiceDate 
      ? Math.floor((now.getTime() - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Simple churn risk calculation
    let churnRiskScore = 0;
    const factors: string[] = [];

    if (daysSinceLastService > 60) {
      churnRiskScore += 30;
      factors.push("No service in 60+ days");
    } else if (daysSinceLastService > 30) {
      churnRiskScore += 15;
      factors.push("No service in 30+ days");
    }

    if (completedJobs.length === 1) {
      churnRiskScore += 20;
      factors.push("Only one completed service");
    }

    // Determine risk level
    let churnRisk: CustomerRetentionInsight["churnRisk"] = "LOW";
    if (churnRiskScore >= 40) churnRisk = "CRITICAL";
    else if (churnRiskScore >= 25) churnRisk = "HIGH";
    else if (churnRiskScore >= 15) churnRisk = "MEDIUM";

    // Determine recommended action
    let recommendedAction: CustomerRetentionInsight["recommendedAction"];
    
    if (churnRisk === "CRITICAL") {
      recommendedAction = {
        type: "REACTIVATION_CAMPAIGN",
        message: "We miss you! Book your next lawn service and receive 15% off.",
        timing: "IMMEDIATE",
        channel: "SMS",
      };
    } else if (churnRisk === "HIGH") {
      recommendedAction = {
        type: "FOLLOW_UP_CALL",
        message: "Check in with customer to ensure satisfaction and discuss upcoming needs.",
        timing: "NEXT_WEEK",
        channel: "PHONE",
      };
    } else if (completedJobs.length >= 5) {
      recommendedAction = {
        type: "UPSELL_OPPORTUNITY",
        message: "Loyal customer - consider seasonal services upsell.",
        timing: "NEXT_MONTH",
        channel: "EMAIL",
      };
    } else {
      recommendedAction = {
        type: "NO_ACTION",
        message: "Customer is healthy, no immediate action needed.",
        timing: "NEXT_MONTH",
        channel: "EMAIL",
      };
    }

    insights.push({
      customerId: customer.id,
      customerName: customer.name,
      churnRisk,
      churnRiskScore,
      factors,
      lastServiceDate,
      daysSinceLastService,
      totalLifetimeValue: completedJobs.length * 75 * 100, // Simplified estimate
      recommendedAction,
    });
  }

  // Calculate overall metrics
  const atRiskCustomers = insights.filter(i => i.churnRisk === "HIGH" || i.churnRisk === "CRITICAL").length;
  const overallHealth = atRiskCustomers > insights.length * 0.3 
    ? "AT_RISK" 
    : atRiskCustomers > insights.length * 0.15 
      ? "NEEDS_ATTENTION" 
      : "HEALTHY";

  console.log("[RetentionAgent] Analysis complete:", insights.length, "customers,", atRiskCustomers, "at risk");

  return {
    analysisDate: new Date(),
    overallRetentionHealth: overallHealth,
    metrics: {
      totalActiveCustomers: insights.length,
      atRiskCustomers,
      churnedThisMonth: 0, // Would need historical data
      averageLifetimeValue: insights.reduce((sum, i) => sum + i.totalLifetimeValue, 0) / insights.length / 100,
    },
    insights: insights.filter(i => i.churnRisk !== "LOW").slice(0, 20), // Return at-risk customers
    campaignSuggestions: [
      {
        type: "REACTIVATION_EMAIL",
        targetCount: insights.filter(i => i.churnRisk === "CRITICAL").length,
        estimatedImpact: "20-30% reactivation rate expected",
      },
      {
        type: "LOYALTY_PROGRAM",
        targetCount: insights.filter(i => i.totalLifetimeValue > 300 * 100).length,
        estimatedImpact: "Increase repeat booking rate by 15%",
      },
    ],
  };
}

// ============================================================================
// COMPLIANCE RISK AGENT (Phase B5) - STUB
// Monitors license/insurance expirations and compliance issues
// ============================================================================

export interface ComplianceRiskInput {
  accountId: number;
}

export interface ComplianceAlert {
  type: "LICENSE_EXPIRING" | "INSURANCE_EXPIRING" | "CERTIFICATION_EXPIRING" | "INCIDENT_REVIEW";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  dueDate?: Date;
  actionRequired: string;
}

export interface ComplianceRiskOutput {
  checkDate: Date;
  overallStatus: "COMPLIANT" | "ATTENTION_NEEDED" | "ACTION_REQUIRED";
  alerts: ComplianceAlert[];
  upcomingDeadlines: { item: string; date: Date; daysRemaining: number }[];
  recommendations: string[];
}

export async function runComplianceRiskAgent(
  input: ComplianceRiskInput
): Promise<ComplianceRiskOutput> {
  const { accountId } = input;

  // Get business profile for license/insurance info
  const businessProfile = await storage.getBusinessProfile(accountId);
  
  const alerts: ComplianceAlert[] = [];
  const upcomingDeadlines: { item: string; date: Date; daysRemaining: number }[] = [];
  const now = new Date();

  // Check license expiration (stub - would need actual license data)
  const licenseExpiry = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // Mock: 45 days from now
  const licenseDaysRemaining = Math.floor((licenseExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (licenseDaysRemaining <= 30) {
    alerts.push({
      type: "LICENSE_EXPIRING",
      severity: licenseDaysRemaining <= 7 ? "CRITICAL" : licenseDaysRemaining <= 14 ? "HIGH" : "MEDIUM",
      message: `Business license expires in ${licenseDaysRemaining} days`,
      dueDate: licenseExpiry,
      actionRequired: "Renew business license before expiration",
    });
  }
  
  upcomingDeadlines.push({
    item: "Business License",
    date: licenseExpiry,
    daysRemaining: licenseDaysRemaining,
  });

  // Check insurance (stub)
  const insuranceExpiry = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // Mock: 90 days
  const insuranceDaysRemaining = Math.floor((insuranceExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  upcomingDeadlines.push({
    item: "Liability Insurance",
    date: insuranceExpiry,
    daysRemaining: insuranceDaysRemaining,
  });

  // Determine overall status
  let overallStatus: ComplianceRiskOutput["overallStatus"] = "COMPLIANT";
  if (alerts.some(a => a.severity === "CRITICAL")) {
    overallStatus = "ACTION_REQUIRED";
  } else if (alerts.some(a => a.severity === "HIGH" || a.severity === "MEDIUM")) {
    overallStatus = "ATTENTION_NEEDED";
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (licenseDaysRemaining <= 60) {
    recommendations.push("Start license renewal process to avoid service interruption");
  }
  if (insuranceDaysRemaining <= 60) {
    recommendations.push("Contact insurance provider to review and renew coverage");
  }
  if (alerts.length === 0) {
    recommendations.push("All compliance items are current. Next review recommended in 30 days.");
  }

  console.log("[ComplianceRiskAgent] Check complete:", overallStatus, alerts.length, "alerts");

  return {
    checkDate: now,
    overallStatus,
    alerts,
    upcomingDeadlines: upcomingDeadlines.sort((a, b) => a.daysRemaining - b.daysRemaining),
    recommendations,
  };
}
