// Service Selection Agent
// Matches customer intent to appropriate services from the catalog

import OpenAI from "openai";
import { z } from "zod";
import { storage } from "../storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const serviceRecommendationSchema = z.object({
  serviceId: z.number(),
  serviceName: z.string(),
  category: z.string(),
  confidenceScore: z.number().min(0).max(1),
  matchReason: z.string(),
  requiresManualQuote: z.boolean(),
  meetsLeadTime: z.boolean(),
  suggestedFrequency: z.string().optional(),
});

const serviceSelectionResultSchema = z.object({
  recommendedServices: z.array(serviceRecommendationSchema),
  bundleOpportunity: z.object({
    available: z.boolean(),
    bundleServices: z.array(z.number()).optional(),
    estimatedSavingsPercent: z.number().optional(),
  }).optional(),
  escalationRequired: z.boolean(),
  escalationReason: z.string().optional(),
});

export type ServiceRecommendation = z.infer<typeof serviceRecommendationSchema>;
export type ServiceSelectionResult = z.infer<typeof serviceSelectionResultSchema>;

export interface ServiceSelectionInput {
  accountId: number;
  customerId?: number;
  customerIntent: string;
  propertyContext?: {
    lotSizeSqFt?: number;
    hasSnowRemoval?: boolean;
    hasRecurringService?: boolean;
    lastServiceDate?: string;
  };
  requestedDate?: string;
}

export async function runServiceSelectionAgent(
  input: ServiceSelectionInput
): Promise<ServiceSelectionResult> {
  const services = await storage.getServices(input.accountId, { isActive: true });
  const activeServices = services;

  if (activeServices.length === 0) {
    return {
      recommendedServices: [],
      escalationRequired: true,
      escalationReason: "No active services configured for this account",
    };
  }

  const serviceCatalog = activeServices.map(s => ({
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.description,
    serviceType: s.serviceType,
    requiresManualQuote: s.requiresManualQuote,
    defaultDurationMinutes: s.defaultDurationMinutes,
    requiresLeadTime: s.requiresLeadTime,
    defaultLeadTimeDays: s.defaultLeadTimeDays,
  }));

  let customerPreferencesContext = "No stored preferences";
  if (input.customerId) {
    const prefs = await storage.getCustomerServicePreferences(input.accountId, input.customerId);
    if (prefs.length > 0) {
      const generalPref = prefs.find(p => !p.serviceId);
      const servicePrefs = prefs.filter(p => p.serviceId);
      
      const enrichedServicePrefs = await Promise.all(
        servicePrefs.map(async (p) => {
          const service = p.serviceId ? await storage.getService(p.serviceId) : null;
          return {
            serviceName: service?.name ?? `Service #${p.serviceId}`,
            serviceId: p.serviceId,
            frequency: p.preferredFrequency,
            dayOfWeek: p.preferredDayOfWeek,
            timeWindow: p.preferredTimeWindow,
          };
        })
      );
      
      customerPreferencesContext = `
General preferences: ${generalPref ? JSON.stringify({
        frequency: generalPref.preferredFrequency,
        dayOfWeek: generalPref.preferredDayOfWeek,
        timeWindow: generalPref.preferredTimeWindow,
        priceFlexibility: generalPref.priceFlexibility,
      }) : 'None'}
Service-specific preferences: ${enrichedServicePrefs.length > 0 ? JSON.stringify(enrichedServicePrefs) : 'None'}`;
    }
  }

  const systemPrompt = `You are a service selection AI for a landscaping business.

Your job is to match customer requests to the most appropriate services from the catalog.

Available services:
${JSON.stringify(serviceCatalog, null, 2)}

Customer context:
- Lot size: ${input.propertyContext?.lotSizeSqFt ? `${input.propertyContext.lotSizeSqFt} sq ft` : 'Unknown'}
- Has snow removal: ${input.propertyContext?.hasSnowRemoval ?? 'Unknown'}
- Has recurring service: ${input.propertyContext?.hasRecurringService ?? 'Unknown'}
- Last service date: ${input.propertyContext?.lastServiceDate ?? 'Unknown'}
- Requested date: ${input.requestedDate ?? 'Not specified'}

Customer preferences:
${customerPreferencesContext}

Rules:
1. Only recommend services that are active
2. Check lead time requirements if a date is specified
3. Prefer recurring services over one-time for eligible customers
4. Identify bundle opportunities when multiple services are recommended
5. Set escalationRequired=true if customer intent is unclear or no matching services
6. Use customer preferences to suggest appropriate frequency and timing when available
7. If customer has price flexibility preference, factor that into recommendations

Respond in JSON format:
{
  "recommendedServices": [
    {
      "serviceId": number,
      "serviceName": string,
      "category": string,
      "confidenceScore": 0-1,
      "matchReason": string,
      "requiresManualQuote": boolean,
      "meetsLeadTime": boolean,
      "suggestedFrequency": string (optional, e.g., "WEEKLY", "BIWEEKLY")
    }
  ],
  "bundleOpportunity": {
    "available": boolean,
    "bundleServices": [serviceId array],
    "estimatedSavingsPercent": number
  },
  "escalationRequired": boolean,
  "escalationReason": string (if escalation required)
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Customer request: ${input.customerIntent}` },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = serviceSelectionResultSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      console.error("[ServiceSelectionAgent] Invalid response format:", parsed.error);
      throw new Error("Invalid AI response format");
    }

    return parsed.data;
  } catch (error) {
    console.error("[ServiceSelectionAgent] Error:", error);
    return {
      recommendedServices: [],
      escalationRequired: true,
      escalationReason: "AI processing failed, manual review required",
    };
  }
}
