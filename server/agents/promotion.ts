// Promotion Agent
// Applies eligible promotions and calculates discounts

import OpenAI from "openai";
import { z } from "zod";
import { storage } from "../storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const appliedPromotionSchema = z.object({
  promotionId: z.number(),
  promotionName: z.string(),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.number(),
  appliedToServiceId: z.number().optional(),
  discountAmount: z.number(),
  reason: z.string(),
});

const promotionAgentResultSchema = z.object({
  appliedPromotions: z.array(appliedPromotionSchema),
  originalTotal: z.number(),
  totalDiscount: z.number(),
  finalTotal: z.number(),
  savingsMessage: z.string().optional(),
  additionalOffersAvailable: z.array(z.object({
    promotionId: z.number(),
    promotionName: z.string(),
    requirement: z.string(),
    potentialSavings: z.number(),
  })).optional(),
});

export type AppliedPromotion = z.infer<typeof appliedPromotionSchema>;
export type PromotionAgentResult = z.infer<typeof promotionAgentResultSchema>;

export interface PromotionInput {
  accountId: number;
  customerId?: number;
  isFirstTimeCustomer: boolean;
  serviceQuotes: Array<{
    serviceId: number;
    serviceName: string;
    category: string;
    price: number;
    frequency?: string;
  }>;
  totalBeforeDiscount: number;
}

export async function runPromotionAgent(input: PromotionInput): Promise<PromotionAgentResult> {
  const promotions = await storage.getPromotionRules(input.accountId, { isActive: true });
  const activePromotions = promotions;

  if (activePromotions.length === 0) {
    return {
      appliedPromotions: [],
      originalTotal: input.totalBeforeDiscount,
      totalDiscount: 0,
      finalTotal: input.totalBeforeDiscount,
    };
  }

  const promotionCatalog = activePromotions.map(p => ({
    id: p.id,
    name: p.name,
    appliesToServiceId: p.appliesToServiceId,
    appliesToCategory: p.appliesToCategory,
    condition: p.condition,
    discountType: p.discountType,
    discountValue: p.discountValue,
    requiresFrequency: p.requiresFrequency,
    startAt: p.startAt,
    endAt: p.endAt,
  }));

  const systemPrompt = `You are a promotion calculation AI for a landscaping business.

Your job is to determine which promotions apply to the customer's order and calculate the discounts.

Available promotions:
${JSON.stringify(promotionCatalog, null, 2)}

Customer context:
- First-time customer: ${input.isFirstTimeCustomer}
- Customer ID: ${input.customerId ?? 'New customer'}

Services in order:
${JSON.stringify(input.serviceQuotes, null, 2)}

Original total: ${input.totalBeforeDiscount} cents

Promotion conditions:
- FIRST_TIME_CUSTOMER: Only applies if isFirstTimeCustomer=true
- RECURRING_COMMITMENT: Only applies if service has a recurring frequency
- BUNDLE: Applies when multiple services are purchased together
- SEASONAL: Check current date against startAt/endAt if specified

Eligibility rules:
1. appliesToServiceId: Only that specific service
2. appliesToCategory: All services in that category
3. Both null: Applies to entire order
4. requiresFrequency: Service must have matching frequency

Discount calculation:
- PERCENT: (price * discountValue / 100)
- FIXED: discountValue (in cents)
- Negative discountValue = surcharge (e.g., -20 means +20% for on-demand)

Note: Do not apply surcharges (negative discounts) as promotions.

Respond in JSON format:
{
  "appliedPromotions": [
    {
      "promotionId": number,
      "promotionName": string,
      "discountType": "PERCENT" | "FIXED",
      "discountValue": number,
      "appliedToServiceId": number (optional),
      "discountAmount": number (cents saved),
      "reason": string (why this promotion applies)
    }
  ],
  "originalTotal": number (cents),
  "totalDiscount": number (cents),
  "finalTotal": number (cents, after discount),
  "savingsMessage": string (e.g., "You saved 15% with our new customer discount!"),
  "additionalOffersAvailable": [
    {
      "promotionId": number,
      "promotionName": string,
      "requirement": string (what customer needs to do to qualify),
      "potentialSavings": number (cents)
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Calculate applicable promotions and discounts" },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = promotionAgentResultSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      console.error("[PromotionAgent] Invalid response format:", parsed.error);
      throw new Error("Invalid AI response format");
    }

    return parsed.data;
  } catch (error) {
    console.error("[PromotionAgent] Error:", error);
    return {
      appliedPromotions: [],
      originalTotal: input.totalBeforeDiscount,
      totalDiscount: 0,
      finalTotal: input.totalBeforeDiscount,
    };
  }
}
