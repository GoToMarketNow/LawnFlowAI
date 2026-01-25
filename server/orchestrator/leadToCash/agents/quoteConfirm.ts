import { 
  type QuoteConfirmResult, 
  QuoteConfirmResultSchema,
  type OrchestrationContext,
  validateAgentResult,
} from "@shared/orchestrator/contracts";
import { log } from "../logger";

// Simple keyword-based intent detection for MVP
const INTENT_PATTERNS = {
  accepted: [
    "yes", "accept", "sounds good", "let's do it", "okay", "ok", "sure",
    "go ahead", "approved", "perfect", "great", "book it", "schedule"
  ],
  declined: [
    "no", "too high", "too expensive", "can't afford", "pass", "decline",
    "not interested", "nevermind", "cancel"
  ],
  question: [
    "why", "what", "how", "when", "where", "explain", "?", "clarify",
    "what's included", "what does", "tell me more"
  ],
  modify: [
    "instead", "can you", "change", "modify", "different", "cheaper",
    "less", "reduce", "discount", "lower", "adjust"
  ],
};

function detectIntent(message: string | undefined): {
  outcome: QuoteConfirmResult["outcome"];
  confidence: "high" | "medium" | "low";
} {
  if (!message) {
    return { outcome: "no_response", confidence: "high" };
  }

  const lowerMessage = message.toLowerCase().trim();

  // Check each intent pattern
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerMessage.includes(pattern)) {
        // Higher confidence for longer matches or exact matches
        const confidence = lowerMessage === pattern ? "high" : "medium";
        return { 
          outcome: intent as QuoteConfirmResult["outcome"], 
          confidence 
        };
      }
    }
  }

  // No clear match
  return { outcome: "question", confidence: "low" };
}

export async function runQuoteConfirmAgent(
  customerMessage: string | undefined,
  context: OrchestrationContext
): Promise<QuoteConfirmResult> {
  log("debug", "Running quote confirm agent", { hasMessage: !!customerMessage });

  const { outcome, confidence } = detectIntent(customerMessage);

  const result: QuoteConfirmResult = {
    outcome,
    customerMessage: customerMessage || undefined,
    confidence,
  };

  return validateAgentResult(QuoteConfirmResultSchema, result, "quoteConfirmAgent");
}
