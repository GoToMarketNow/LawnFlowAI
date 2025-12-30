import { z } from "zod";
import OpenAI from "openai";

const customerMessageSchema = z.object({
  channel: z.literal("sms"),
  to: z.string().min(1),
  text: z.string().min(1).max(320),
});

const escalationSchema = z.object({
  should_escalate: z.boolean(),
  reason: z.string().nullable(),
  summary: z.string().nullable(),
});

export const reviewActionSchema = z.object({
  send_request: z.boolean(),
  customer_message: customerMessageSchema,
  escalation: escalationSchema,
  confidence: z.number().min(0).max(1),
});

export type ReviewAction = z.infer<typeof reviewActionSchema>;

export interface JobCompletionEvent {
  job_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  service_type: string;
  completion_date: string;
  crew_notes?: string;
  job_rating?: number;
}

export interface SentimentSignals {
  has_complaint: boolean;
  complaint_text?: string;
  customer_feedback?: string;
  previous_reviews?: { rating: number; text?: string }[];
}

export interface ReviewConfig {
  business_name: string;
  review_link: string;
  google_business_link?: string;
}

const NEGATIVE_SENTIMENT_PATTERNS = [
  /unhappy/i,
  /disappointed/i,
  /terrible/i,
  /awful/i,
  /horrible/i,
  /worst/i,
  /never again/i,
  /refund/i,
  /complaint/i,
  /not satisfied/i,
  /dissatisfied/i,
  /poor quality/i,
  /damaged/i,
  /broken/i,
  /ruined/i,
  /unprofessional/i,
  /late/i,
  /didn't show/i,
  /no show/i,
  /missed/i,
];

function detectNegativeSentiment(signals: SentimentSignals): { isNegative: boolean; reason: string | null } {
  if (signals.has_complaint) {
    return {
      isNegative: true,
      reason: signals.complaint_text || "Customer filed a complaint",
    };
  }

  if (signals.customer_feedback) {
    for (const pattern of NEGATIVE_SENTIMENT_PATTERNS) {
      if (pattern.test(signals.customer_feedback)) {
        return {
          isNegative: true,
          reason: `Negative sentiment detected: "${signals.customer_feedback.slice(0, 100)}"`,
        };
      }
    }
  }

  if (signals.previous_reviews) {
    const recentBadReview = signals.previous_reviews.find(r => r.rating <= 2);
    if (recentBadReview) {
      return {
        isNegative: true,
        reason: `Previous low rating (${recentBadReview.rating}/5)${recentBadReview.text ? `: "${recentBadReview.text.slice(0, 50)}"` : ""}`,
      };
    }
  }

  return { isNegative: false, reason: null };
}

function buildSystemPrompt(config: ReviewConfig): string {
  return `You are a customer success assistant for ${config.business_name}, a landscaping/lawn care company.

Your role is to request reviews from satisfied customers after job completion.

Guidelines:
1. Be warm and appreciative of their business
2. Keep the message brief and friendly
3. Make it easy to leave a review with a direct link
4. Personalize when possible (use their name, mention the service)
5. Don't be pushy - one polite ask is enough

Review link to include: ${config.review_link}
${config.google_business_link ? `Google Business link: ${config.google_business_link}` : ""}

For SMS, keep under 160 characters when possible.
For email, you can be slightly more detailed but still concise.

Respond with a JSON object matching the ReviewAction schema.`;
}

function buildUserPrompt(
  job: JobCompletionEvent,
  signals: SentimentSignals,
  config: ReviewConfig
): string {
  const feedbackInfo = signals.customer_feedback
    ? `Customer feedback: "${signals.customer_feedback}"`
    : "No customer feedback received";

  const crewNotes = job.crew_notes
    ? `Crew notes: ${job.crew_notes}`
    : "";

  return `Generate a review request for this completed job:

JOB DETAILS:
- Customer: ${job.customer_name}
- Phone: ${job.customer_phone}
- Email: ${job.customer_email || "not provided"}
- Service: ${job.service_type}
- Completed: ${job.completion_date}
${crewNotes}

SENTIMENT:
- ${feedbackInfo}
- Has complaint: ${signals.has_complaint}

CHANNEL: SMS

Generate a friendly review request message. The review link is: ${config.review_link}

If there are any concerns about customer satisfaction, set send_request to false and set escalation.should_escalate to true with a reason.`;
}

function createEscalationResponse(
  job: JobCompletionEvent,
  reason: string
): ReviewAction {
  return {
    send_request: false,
    customer_message: {
      channel: "sms",
      to: job.customer_phone,
      text: "N/A",
    },
    escalation: {
      should_escalate: true,
      reason,
      summary: `Customer ${job.customer_name} (Job #${job.job_id}) requires follow-up before review request. ${reason}`,
    },
    confidence: 1.0,
  };
}

function sanitizeMessage(text: string): string {
  return text
    .replace(/[\u{1F600}-\u{1F6FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
}

function createFallbackReviewRequest(
  job: JobCompletionEvent,
  config: ReviewConfig
): ReviewAction {
  const text = `Hi ${job.customer_name}! Thanks for choosing ${config.business_name}. We'd love your feedback: ${config.review_link}`;

  return {
    send_request: true,
    customer_message: {
      channel: "sms",
      to: job.customer_phone,
      text: sanitizeMessage(text),
    },
    escalation: {
      should_escalate: false,
      reason: null,
      summary: null,
    },
    confidence: 0.8,
  };
}

export async function runReviewsAgent(
  job: JobCompletionEvent,
  signals: SentimentSignals,
  config: ReviewConfig
): Promise<ReviewAction> {
  const sentimentCheck = detectNegativeSentiment(signals);

  if (sentimentCheck.isNegative) {
    return createEscalationResponse(job, sentimentCheck.reason!);
  }

  if (job.job_rating !== undefined && job.job_rating <= 2) {
    return createEscalationResponse(job, `Low job rating: ${job.job_rating}/5`);
  }

  const openai = new OpenAI();
  const systemPrompt = buildSystemPrompt(config);
  const userPrompt = buildUserPrompt(job, signals, config);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return createFallbackReviewRequest(job, config);
    }

    const parsed = JSON.parse(content);
    const validated = reviewActionSchema.parse(parsed);

    if (validated.escalation.should_escalate) {
      return {
        ...validated,
        send_request: false,
        customer_message: {
          ...validated.customer_message,
          text: "N/A",
        },
      };
    }

    return {
      ...validated,
      customer_message: {
        ...validated.customer_message,
        text: sanitizeMessage(validated.customer_message.text),
      },
    };
  } catch (error) {
    console.error("[ReviewsAgent] Error:", error);
    return createFallbackReviewRequest(job, config);
  }
}

export async function generateReviewRequest(
  businessName: string,
  customerName?: string,
  serviceType?: string
): Promise<string> {
  const job: JobCompletionEvent = {
    job_id: 0,
    customer_name: customerName || "Valued customer",
    customer_phone: "",
    service_type: serviceType || "landscaping service",
    completion_date: new Date().toISOString(),
  };

  const signals: SentimentSignals = {
    has_complaint: false,
  };

  const config: ReviewConfig = {
    business_name: businessName,
    review_link: "",
  };

  const result = await runReviewsAgent(job, signals, config);
  return result.customer_message.text;
}
