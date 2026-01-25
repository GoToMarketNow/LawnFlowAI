// Quote Agent
// Generates and proposes price quotes for services

import OpenAI from "openai";
import { z } from "zod";
import { fsmConnector } from "../connectors/fsm-mock";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const quoteResultSchema = z.object({
  estimatedPrice: z.number(),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  breakdown: z.string().default(""),
  suggestedMessage: z.string(),
  needsMoreInfo: z.boolean().default(false),
  questionsToAsk: z.array(z.string()).optional(),
});

export type QuoteResult = z.infer<typeof quoteResultSchema>;

export async function generateQuote(
  serviceType: string,
  customerDetails: {
    name?: string;
    address?: string;
    notes?: string;
  },
  businessContext: {
    businessName: string;
    services: string[];
  }
): Promise<QuoteResult> {
  // Get base price from FSM connector
  const basePrice = fsmConnector.estimatePrice(
    serviceType,
    customerDetails.notes
  );

  const systemPrompt = `You are a quote generation agent for ${businessContext.businessName}, a landscaping company.

Based on the service requested, generate a quote response.

Available services: ${businessContext.services.join(", ")}

Respond in JSON format:
{
  "estimatedPrice": number (price in cents, base estimate is ${basePrice}),
  "confidence": "low" | "medium" | "high",
  "breakdown": string (brief explanation of pricing),
  "suggestedMessage": string (friendly message to send with the quote),
  "needsMoreInfo": boolean,
  "questionsToAsk": string[] (if more info needed)
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Service: ${serviceType}
Customer: ${customerDetails.name || "Unknown"}
Address: ${customerDetails.address || "Not provided"}
Notes: ${customerDetails.notes || "None"}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse and validate with Zod
    const parsed = quoteResultSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      console.error("[Quote Agent] Invalid response format:", parsed.error);
      throw new Error("Invalid AI response format");
    }

    return parsed.data;
  } catch (error) {
    console.error("[Quote Agent] Error:", error);
    // Return a fallback quote
    return {
      estimatedPrice: basePrice,
      confidence: "medium",
      breakdown: `Standard ${serviceType} service`,
      suggestedMessage: `Thanks for your interest! Based on your request for ${serviceType}, our estimated price starts at $${(basePrice / 100).toFixed(2)}. Would you like to schedule a free on-site estimate?`,
      needsMoreInfo: true,
      questionsToAsk: ["What is your property address?", "What is the approximate size of the area?"],
    };
  }
}

export function formatQuoteMessage(
  quote: QuoteResult,
  businessName: string
): string {
  const priceStr = `$${(quote.estimatedPrice / 100).toFixed(2)}`;
  
  if (quote.needsMoreInfo && quote.questionsToAsk?.length) {
    return `${quote.suggestedMessage}\n\nTo give you a more accurate quote, could you tell us: ${quote.questionsToAsk[0]}`;
  }
  
  return quote.suggestedMessage;
}
