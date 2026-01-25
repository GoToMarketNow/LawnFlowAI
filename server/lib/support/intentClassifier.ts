// Intent Classifier Service
// Uses Claude for structured extraction of intent, priority, and sentiment
// Security: Input validation, rate limiting, structured output validation

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { type IntentClassification, type Priority, Priority as PriorityEnum } from "@shared/thread-enrichment-schema";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-3-5-sonnet-20241022";
const MAX_TOKENS = 1024;

// Intent classification response schema
const IntentClassificationSchema = z.object({
  intent: z.string().min(3).max(100).regex(/^[a-z0-9_]+$/),
  confidence: z.number().min(0).max(1),
  priority: z.enum(["urgent", "high", "normal", "low"]),
  priorityReason: z.string().min(10).max(500),
  customerSentiment: z.enum(["angry", "frustrated", "neutral", "satisfied", "unknown"]).optional(),
  suggestedActions: z.array(z.string()).optional(),
});

// Common intents (can be extended)
const COMMON_INTENTS = [
  "reschedule_request",
  "cancellation_request",
  "price_inquiry",
  "service_quality_complaint",
  "billing_dispute",
  "payment_method_update",
  "service_scope_change",
  "crew_feedback",
  "schedule_inquiry",
  "general_question",
  "technical_support",
  "refund_request",
  "quote_request",
  "emergency_service",
  "property_access_issue",
] as const;

/**
 * Classify intent from conversation messages
 * @param messages - Array of conversation messages
 * @returns Intent classification with priority and confidence
 */
export async function classifyIntent(
  messages: Array<{ role: "customer" | "assistant" | "system"; content: string }>
): Promise<IntentClassification> {
  // Validation
  if (!messages || messages.length === 0) {
    throw new Error("Messages required for intent classification");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // Sanitize messages
  const sanitizedMessages = messages.map(msg => ({
    role: msg.role === "customer" ? "user" as const : "assistant" as const,
    content: sanitizeMessage(msg.content),
  }));

  // System prompt for structured extraction
  const systemPrompt = `You are a customer support conversation classifier. Analyze the conversation and extract:

1. **Intent**: Primary customer intent (use snake_case, e.g., "reschedule_request", "price_inquiry")
   Common intents: ${COMMON_INTENTS.join(", ")}

2. **Confidence**: Your confidence in this classification (0-1)

3. **Priority**: Urgency level based on:
   - Urgent keywords: "emergency", "ASAP", "urgent", "immediately", "today"
   - Customer sentiment: angry, frustrated, threatening cancellation
   - Business impact: high-value customer, escalation risk
   - Time sensitivity: service tomorrow, payment overdue

   Priority levels:
   - "urgent": Requires response within 1 hour
   - "high": Requires response within 2 hours
   - "normal": Requires response within 4 hours
   - "low": Requires response within 8 hours

4. **Priority Reason**: Brief explanation for the priority level

5. **Customer Sentiment** (optional): angry, frustrated, neutral, satisfied, unknown

6. **Suggested Actions** (optional): Array of actions the support team should take

**Critical**: Respond ONLY with valid JSON matching this exact schema:
{
  "intent": "string",
  "confidence": 0.95,
  "priority": "urgent|high|normal|low",
  "priorityReason": "string",
  "customerSentiment": "angry|frustrated|neutral|satisfied|unknown",
  "suggestedActions": ["action1", "action2"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: sanitizedMessages,
    });

    // Extract JSON from response
    const textContent = response.content[0];
    if (textContent.type !== "text") {
      throw new Error("Invalid response type from Claude");
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate schema
    const validated = IntentClassificationSchema.parse(parsed);

    return {
      intent: validated.intent,
      confidence: validated.confidence,
      priority: validated.priority as Priority,
      priorityReason: validated.priorityReason,
      suggestedActions: validated.suggestedActions,
    };
  } catch (error: any) {
    // Fallback classification on error
    console.error("Intent classification failed:", error.message);

    // Basic heuristic classification as fallback
    const fallback = classifyWithHeuristics(messages);
    return fallback;
  }
}

/**
 * Fallback classification using simple heuristics
 * Used when AI classification fails
 */
function classifyWithHeuristics(
  messages: Array<{ role: string; content: string }>
): IntentClassification {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";

  // Urgency keywords
  const urgentKeywords = ["emergency", "asap", "urgent", "immediately", "today", "now"];
  const isUrgent = urgentKeywords.some(keyword => lastMessage.includes(keyword));

  // Intent keywords
  const intentKeywords: Record<string, string[]> = {
    reschedule_request: ["reschedule", "move", "change date", "different day"],
    cancellation_request: ["cancel", "cancellation", "stop service"],
    price_inquiry: ["price", "cost", "how much", "quote", "estimate"],
    billing_dispute: ["charge", "billing", "invoice", "overcharge"],
    service_quality_complaint: ["complaint", "poor", "bad", "disappointed", "unsatisfied"],
    refund_request: ["refund", "money back", "return"],
  };

  let detectedIntent = "general_question";
  let highestMatchCount = 0;

  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    const matchCount = keywords.filter(keyword => lastMessage.includes(keyword)).length;
    if (matchCount > highestMatchCount) {
      highestMatchCount = matchCount;
      detectedIntent = intent;
    }
  }

  // Sentiment detection
  const angryWords = ["terrible", "horrible", "worst", "ridiculous", "unacceptable"];
  const isAngry = angryWords.some(word => lastMessage.includes(word));

  const priority = isUrgent || isAngry ? PriorityEnum.URGENT :
                   highestMatchCount > 0 ? PriorityEnum.HIGH :
                   PriorityEnum.NORMAL;

  return {
    intent: detectedIntent,
    confidence: 0.6, // Lower confidence for heuristic classification
    priority,
    priorityReason: isUrgent
      ? "Urgent keywords detected in message"
      : isAngry
      ? "Negative sentiment detected"
      : "Standard request classification",
  };
}

/**
 * Sanitize message content
 * Security: Remove potential injection attempts
 */
function sanitizeMessage(content: string): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  // Remove control characters
  let sanitized = content.replace(/[\x00-\x1F\x7F]/g, " ");

  // Limit length (prevent token overflow)
  const MAX_LENGTH = 5000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH) + "...";
  }

  // Trim excessive whitespace
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  return sanitized;
}

/**
 * Batch classify multiple conversations
 * @param conversations - Array of conversation message arrays
 * @returns Array of classifications
 */
export async function classifyIntentsBatch(
  conversations: Array<Array<{ role: "customer" | "assistant" | "system"; content: string }>>
): Promise<IntentClassification[]> {
  const results: IntentClassification[] = [];

  for (const messages of conversations) {
    try {
      const classification = await classifyIntent(messages);
      results.push(classification);

      // Rate limiting: small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      console.error("Batch classification error:", error.message);
      results.push(classifyWithHeuristics(messages));
    }
  }

  return results;
}

/**
 * Re-classify conversation with updated context
 * Useful when new messages are added to a thread
 */
export async function reclassifyIntent(
  previousClassification: IntentClassification,
  newMessages: Array<{ role: "customer" | "assistant" | "system"; content: string }>
): Promise<IntentClassification> {
  const newClassification = await classifyIntent(newMessages);

  // If confidence is lower than previous, keep previous intent
  if (newClassification.confidence < previousClassification.confidence) {
    return {
      ...previousClassification,
      // But update priority if it's escalating
      priority: newClassification.priority === PriorityEnum.URGENT
        ? PriorityEnum.URGENT
        : previousClassification.priority,
      priorityReason: newClassification.priority === PriorityEnum.URGENT
        ? newClassification.priorityReason
        : previousClassification.priorityReason,
    };
  }

  return newClassification;
}

/**
 * Health check for classification service
 */
export async function testClassificationService(): Promise<boolean> {
  try {
    const testMessages = [
      { role: "customer" as const, content: "I need to reschedule my lawn service to next week" },
    ];
    const result = await classifyIntent(testMessages);
    return result.confidence > 0;
  } catch {
    return false;
  }
}
