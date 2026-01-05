// Pricing Agent
// Calculates pricing for services based on lot size, frequency, and pricing tiers

import OpenAI from "openai";
import { z } from "zod";
import { storage } from "../storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const pricingResultSchema = z.object({
  serviceId: z.number(),
  serviceName: z.string(),
  basePrice: z.number(),
  frequencyModifier: z.number(),
  finalPrice: z.number(),
  priceBreakdown: z.object({
    laborCost: z.number(),
    materialCost: z.number().optional(),
    frequencyDiscount: z.number().optional(),
  }),
  pricingModel: z.string(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  requiresManualReview: z.boolean(),
  notes: z.string().optional(),
});

const pricingAgentResultSchema = z.object({
  quotes: z.array(pricingResultSchema),
  totalEstimate: z.number(),
  validUntil: z.string().optional(),
  escalationRequired: z.boolean(),
  escalationReason: z.string().optional(),
});

export type PricingResult = z.infer<typeof pricingResultSchema>;
export type PricingAgentResult = z.infer<typeof pricingAgentResultSchema>;

export interface PricingInput {
  accountId: number;
  serviceRequests: Array<{
    serviceId: number;
    frequency?: string;
  }>;
  propertyContext?: {
    lotSizeSqFt?: number;
    address?: string;
  };
  customerId?: number;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function runPricingAgent(input: PricingInput): Promise<PricingAgentResult> {
  const propertyContext = input.propertyContext ?? {};
  
  const pricingData: Array<{
    service: any;
    pricing: any[];
    frequencies: any[];
    snowPolicy?: any;
  }> = [];

  for (const req of input.serviceRequests) {
    const service = await storage.getService(req.serviceId);
    if (!service || service.accountId !== input.accountId) continue;

    const pricing = await storage.getServicePricing(req.serviceId);
    const frequencies = await storage.getServiceFrequencyOptions(req.serviceId);
    
    let snowPolicy = null;
    if (service.category === "SNOW") {
      snowPolicy = await storage.getSnowServicePolicy(req.serviceId);
    }

    pricingData.push({
      service,
      pricing,
      frequencies,
      snowPolicy,
    });
  }

  if (pricingData.length === 0) {
    return {
      quotes: [],
      totalEstimate: 0,
      escalationRequired: true,
      escalationReason: "No valid services found for pricing",
    };
  }

  let customerPreferencesContext = "No stored preferences";
  if (input.customerId) {
    const prefs = await storage.getCustomerServicePreferences(input.accountId, input.customerId);
    if (prefs.length > 0) {
      const generalPref = prefs.find(p => !p.serviceId);
      customerPreferencesContext = generalPref?.priceFlexibility 
        ? `Price flexibility: ${generalPref.priceFlexibility}` 
        : "No price preference";
      
      const servicePrefs = prefs.filter(p => p.serviceId);
      if (servicePrefs.length > 0) {
        customerPreferencesContext += `. Service preferences: ${JSON.stringify(servicePrefs.map(p => ({
          serviceId: p.serviceId,
          priceFlexibility: p.priceFlexibility,
        })))}`;
      }
    }
  }

  const catalogForAI = pricingData.map(d => ({
    serviceId: d.service.id,
    serviceName: d.service.name,
    category: d.service.category,
    requiresManualQuote: d.service.requiresManualQuote,
    pricingTiers: d.pricing.map(p => ({
      pricingModel: p.pricingModel,
      frequency: p.appliesToFrequency,
      minPrice: formatCents(p.minPrice),
      targetPrice: formatCents(p.targetPrice),
      maxPrice: formatCents(p.maxPrice),
      materialCost: p.materialCostEstimate ? formatCents(p.materialCostEstimate) : null,
      materialIncluded: p.materialCostIncluded,
    })),
    frequencyOptions: d.frequencies.map(f => ({
      frequency: f.frequency,
      priceModifier: `${f.priceModifierPercent}%`,
      isDefault: f.isDefault,
    })),
    snowPolicy: d.snowPolicy ? {
      mode: d.snowPolicy.mode,
      priceModifier: `${d.snowPolicy.priceModifierPercent}%`,
    } : null,
  }));

  const systemPrompt = `You are a pricing AI for a landscaping business.

Your job is to calculate accurate pricing for requested services based on the pricing tiers and property context.

Service catalog with pricing:
${JSON.stringify(catalogForAI, null, 2)}

Property context:
- Lot size: ${propertyContext.lotSizeSqFt ? `${propertyContext.lotSizeSqFt} sq ft` : 'Unknown'}
- Address: ${propertyContext.address ?? 'Not provided'}

Customer preferences:
${customerPreferencesContext}

Requested services:
${JSON.stringify(input.serviceRequests, null, 2)}

Pricing Rules:
1. Use the target price as the base, adjust based on lot size if PER_SQFT model
2. Apply frequency modifiers (negative = discount, positive = surcharge)
3. Include material costs if specified
4. Set confidence=LOW if lot size unknown and PER_SQFT pricing
5. Set requiresManualReview=true for services with requiresManualQuote=true
6. Consider customer price flexibility: BUDGET = use minPrice, PREMIUM = use maxPrice, STANDARD = use targetPrice

All prices should be in cents (integers).

Respond in JSON format:
{
  "quotes": [
    {
      "serviceId": number,
      "serviceName": string,
      "basePrice": number (cents),
      "frequencyModifier": number (cents, can be negative),
      "finalPrice": number (cents),
      "priceBreakdown": {
        "laborCost": number (cents),
        "materialCost": number (cents, optional),
        "frequencyDiscount": number (cents, optional)
      },
      "pricingModel": string,
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "requiresManualReview": boolean,
      "notes": string (optional)
    }
  ],
  "totalEstimate": number (sum of finalPrice in cents),
  "validUntil": string (ISO date, 7 days from now),
  "escalationRequired": boolean,
  "escalationReason": string (if escalation needed)
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Calculate pricing for the requested services" },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = pricingAgentResultSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      console.error("[PricingAgent] Invalid response format:", parsed.error);
      throw new Error("Invalid AI response format");
    }

    return parsed.data;
  } catch (error) {
    console.error("[PricingAgent] Error:", error);
    return {
      quotes: [],
      totalEstimate: 0,
      escalationRequired: true,
      escalationReason: "AI pricing calculation failed, manual review required",
    };
  }
}
