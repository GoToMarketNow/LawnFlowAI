import { z } from "zod";
import OpenAI from "openai";

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
