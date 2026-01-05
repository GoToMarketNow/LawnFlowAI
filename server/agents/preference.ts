import OpenAI from "openai";
import { z } from "zod";
import { storage } from "../storage";
import type { CustomerServicePreference } from "@shared/schema";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const preferenceUpdateSchema = z.object({
  preferredFrequency: z.string().nullable().optional(),
  preferredDayOfWeek: z.string().nullable().optional(),
  preferredTimeWindow: z.string().nullable().optional(),
  priceFlexibility: z.enum(["BUDGET", "STANDARD", "PREMIUM"]).optional(),
  communicationPreference: z.enum(["SMS", "EMAIL", "PHONE"]).optional(),
  specialInstructions: z.string().nullable().optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
});

const learnedPreferencesSchema = z.object({
  preferences: z.array(z.object({
    serviceId: z.number().nullable(),
    preferredFrequency: z.string().nullable(),
    preferredDayOfWeek: z.string().nullable(),
    preferredTimeWindow: z.string().nullable(),
    priceFlexibility: z.enum(["BUDGET", "STANDARD", "PREMIUM"]),
    communicationPreference: z.enum(["SMS", "EMAIL", "PHONE"]),
    specialInstructions: z.string().nullable(),
    confidenceScore: z.number().min(0).max(100),
    reasoning: z.string(),
  })),
  insights: z.array(z.string()),
});

const preferenceApplicationSchema = z.object({
  appliedPreferences: z.array(z.object({
    serviceId: z.number(),
    appliedFrequency: z.string().nullable(),
    appliedTimeWindow: z.string().nullable(),
    appliedPriceFlexibility: z.string(),
    specialNotesForCrew: z.string().nullable(),
    confidenceInApplication: z.number().min(0).max(100),
  })),
  customerContext: z.string(),
  recommendations: z.array(z.string()),
});

export type LearnedPreferences = z.infer<typeof learnedPreferencesSchema>;
export type PreferenceApplication = z.infer<typeof preferenceApplicationSchema>;

export interface LearnPreferencesInput {
  accountId: number;
  customerId: number;
  interactionHistory: Array<{
    type: string; // "quote_accepted", "quote_rejected", "feedback", "job_completed", "reschedule"
    serviceId?: number;
    details: Record<string, any>;
    timestamp: string;
  }>;
}

export interface ApplyPreferencesInput {
  accountId: number;
  customerId: number;
  serviceIds: number[];
  context?: string;
}

export async function learnCustomerPreferences(input: LearnPreferencesInput): Promise<LearnedPreferences> {
  const existingPrefs = await storage.getCustomerServicePreferences(input.accountId, input.customerId);
  
  const systemPrompt = `You are a customer preference learning agent for a landscaping business.
Analyze customer interaction history to learn and update their service preferences.

Current stored preferences:
${JSON.stringify(existingPrefs, null, 2)}

Interaction history to analyze:
${JSON.stringify(input.interactionHistory, null, 2)}

Based on this history, determine:
1. Service-specific preferences (frequency, timing, price sensitivity)
2. General preferences (communication style, special instructions)
3. Confidence score for each preference (0-100 based on how much evidence supports it)

Return preferences that should be stored/updated for this customer.
Higher interaction counts and consistent patterns = higher confidence scores.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze the interaction history and extract customer preferences." },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    const validated = learnedPreferencesSchema.parse(parsed);

    const existingPrefMap = new Map(
      existingPrefs.map(p => [`${p.serviceId ?? 'general'}`, p])
    );
    
    for (const pref of validated.preferences) {
      const key = `${pref.serviceId ?? 'general'}`;
      const existing = existingPrefMap.get(key);
      
      if (existing && (existing.confidenceScore ?? 0) > pref.confidenceScore) {
        console.log(`[PreferenceAgent] Skipping lower-confidence update for ${key}: existing=${existing.confidenceScore}, new=${pref.confidenceScore}`);
        continue;
      }
      
      await storage.upsertCustomerServicePreference({
        accountId: input.accountId,
        customerId: input.customerId,
        serviceId: pref.serviceId,
        preferredFrequency: pref.preferredFrequency,
        preferredDayOfWeek: pref.preferredDayOfWeek,
        preferredTimeWindow: pref.preferredTimeWindow,
        priceFlexibility: pref.priceFlexibility,
        communicationPreference: pref.communicationPreference,
        specialInstructions: pref.specialInstructions,
        confidenceScore: pref.confidenceScore,
      });
    }

    return validated;
  } catch (error) {
    console.error("[PreferenceAgent] Learn error:", error);
    return {
      preferences: [],
      insights: ["Unable to learn preferences from interaction history at this time."],
    };
  }
}

export async function applyCustomerPreferences(input: ApplyPreferencesInput): Promise<PreferenceApplication> {
  const allPrefs = await storage.getCustomerServicePreferences(input.accountId, input.customerId);
  
  const services = await Promise.all(
    input.serviceIds.map(async (id) => {
      const service = await storage.getService(id);
      return service;
    })
  );
  const validServices = services.filter(Boolean);

  const serviceSpecificPrefs = allPrefs.filter(p => input.serviceIds.includes(p.serviceId || 0));
  const generalPrefs = allPrefs.find(p => p.serviceId === null);

  const systemPrompt = `You are a customer preference application agent for a landscaping business.
Apply stored customer preferences to the requested services.

Customer preferences:
${JSON.stringify({ serviceSpecific: serviceSpecificPrefs, general: generalPrefs }, null, 2)}

Requested services:
${JSON.stringify(validServices, null, 2)}

Context: ${input.context || "Standard service quote request"}

For each service, determine:
1. Which preferences apply
2. How to combine service-specific and general preferences
3. Notes for the crew based on preferences
4. Confidence in the application (how well preferences match request)

Also provide:
- Customer context summary for sales/crew
- Recommendations for improving customer experience`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Apply preferences to the requested services." },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return preferenceApplicationSchema.parse(parsed);
  } catch (error) {
    console.error("[PreferenceAgent] Apply error:", error);
    return {
      appliedPreferences: input.serviceIds.map(id => ({
        serviceId: id,
        appliedFrequency: generalPrefs?.preferredFrequency ?? null,
        appliedTimeWindow: generalPrefs?.preferredTimeWindow ?? null,
        appliedPriceFlexibility: generalPrefs?.priceFlexibility ?? "STANDARD",
        specialNotesForCrew: generalPrefs?.specialInstructions ?? null,
        confidenceInApplication: 30,
      })),
      customerContext: "Customer preferences could not be fully analyzed.",
      recommendations: ["Consider gathering more preference data from this customer."],
    };
  }
}

export async function getCustomerPreferenceSummary(
  accountId: number, 
  customerId: number
): Promise<{
  hasPreferences: boolean;
  preferences: CustomerServicePreference[];
  summary: string;
}> {
  const prefs = await storage.getCustomerServicePreferences(accountId, customerId);
  
  if (prefs.length === 0) {
    return {
      hasPreferences: false,
      preferences: [],
      summary: "No preferences stored for this customer yet.",
    };
  }

  const generalPref = prefs.find(p => !p.serviceId);
  const servicePrefs = prefs.filter(p => p.serviceId);

  let summary = "";
  
  if (generalPref) {
    summary += `General: ${generalPref.preferredFrequency || "any"} frequency, ${generalPref.preferredTimeWindow || "any"} time preferred. `;
    if (generalPref.specialInstructions) {
      summary += `Notes: ${generalPref.specialInstructions}. `;
    }
  }

  if (servicePrefs.length > 0) {
    summary += `Has ${servicePrefs.length} service-specific preferences. `;
  }

  const avgConfidence = prefs.reduce((sum, p) => sum + (p.confidenceScore || 50), 0) / prefs.length;
  summary += `Confidence: ${Math.round(avgConfidence)}%`;

  return {
    hasPreferences: true,
    preferences: prefs,
    summary,
  };
}
