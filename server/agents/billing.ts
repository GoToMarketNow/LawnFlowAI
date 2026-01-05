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
  customerId: number;
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
