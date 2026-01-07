// Intake/Qualify Agent
// Handles initial customer contact and qualification

import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const intakeResultSchema = z.object({
  isQualified: z.boolean().default(true),
  customerName: z.string().nullish(),
  serviceType: z.string().optional(),
  address: z.string().nullish(),
  urgency: z.enum(["low", "medium", "high"]).default("medium"),
  notes: z.string().default(""),
  suggestedResponse: z.string(),
});

export type IntakeResult = z.infer<typeof intakeResultSchema>;

export async function runIntakeAgent(
  customerMessage: string,
  customerPhone: string,
  businessContext: {
    businessName: string;
    services: string[];
    serviceArea: string;
  }
): Promise<IntakeResult> {
  const systemPrompt = `You are an AI intake agent for ${businessContext.businessName}, a landscaping/lawn care company.

Your job is to:
1. Qualify incoming leads based on their message
2. Extract key information (name, service needed, address)
3. Assess urgency
4. Generate a friendly, professional response

Services offered: ${businessContext.services.join(", ")}
Service area: ${businessContext.serviceArea}

Respond in JSON format:
{
  "isQualified": boolean (true if they need landscaping services),
  "customerName": string or null,
  "serviceType": string (the service they need),
  "address": string or null,
  "urgency": "low" | "medium" | "high",
  "notes": string (internal notes about the lead),
  "suggestedResponse": string (friendly SMS response to send)
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Customer phone: ${customerPhone}\nMessage: ${customerMessage}`,
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
    const parsed = intakeResultSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      console.error("[Intake Agent] Invalid response format:", parsed.error);
      throw new Error("Invalid AI response format");
    }

    return parsed.data;
  } catch (error) {
    console.error("[Intake Agent] Error:", error);
    // Return a fallback response
    return {
      isQualified: true,
      urgency: "medium",
      notes: "AI processing failed, manual review needed",
      suggestedResponse: `Thank you for reaching out to ${businessContext.businessName}! We received your message and will get back to you shortly. Is there a specific service you're interested in?`,
    };
  }
}

export async function generateMissedCallResponse(
  businessName: string,
  customerPhone: string
): Promise<string> {
  const prompt = `Generate a short, friendly SMS message from ${businessName} (a landscaping company) to a customer who just called and we missed their call. 
Keep it under 160 characters. Be apologetic and ask how we can help.
Just return the message text, no quotes or formatting.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 100,
    });

    return (
      response.choices[0]?.message?.content ||
      `Hi! Sorry we missed your call at ${businessName}. How can we help you today? Reply here or call us back anytime!`
    );
  } catch (error) {
    console.error("[Intake Agent] Missed call response error:", error);
    return `Hi! Sorry we missed your call at ${businessName}. How can we help you today? Reply here or call us back anytime!`;
  }
}
