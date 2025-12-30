// Schedule Agent
// Handles scheduling and appointment booking

import OpenAI from "openai";
import { z } from "zod";
import { fsmConnector } from "../connectors/fsm-mock";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const scheduleResponseSchema = z.object({
  canSchedule: z.boolean().default(true),
  proposedDateIndex: z.number().default(0),
  suggestedMessage: z.string(),
  needsConfirmation: z.boolean().default(true),
});

export interface ScheduleResult {
  canSchedule: boolean;
  proposedDate?: Date;
  proposedDateISO?: string; // ISO string for serialization
  alternativeSlots?: Date[];
  alternativeSlotsISO?: string[]; // ISO strings for serialization
  suggestedMessage: string;
  needsConfirmation: boolean;
}

export async function proposeSchedule(
  customerMessage: string,
  serviceType: string,
  customerDetails: {
    name?: string;
    phone: string;
    address?: string;
  },
  businessContext: {
    businessName: string;
  }
): Promise<ScheduleResult> {
  // Get available slots from FSM connector
  const availableSlots = fsmConnector.getAvailableSlots(7);
  const nextSlot = fsmConnector.getNextAvailableSlot();

  const systemPrompt = `You are a scheduling agent for ${businessContext.businessName}, a landscaping company.

Available appointment slots:
${availableSlots.slice(0, 6).map((s) => s.toLocaleString()).join("\n")}

Parse the customer's message to understand their scheduling preference and propose a time.

Respond in JSON format:
{
  "canSchedule": boolean,
  "proposedDateIndex": number (0-5 for available slots),
  "suggestedMessage": string (friendly response proposing the time),
  "needsConfirmation": boolean (true if we should ask for approval)
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
Message: ${customerMessage}`,
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
    const validated = scheduleResponseSchema.safeParse(JSON.parse(content));
    if (!validated.success) {
      console.error("[Schedule Agent] Invalid response format:", validated.error);
      throw new Error("Invalid AI response format");
    }

    const parsed = validated.data;
    const proposedIndex = Math.min(parsed.proposedDateIndex, availableSlots.length - 1);
    const proposedDate = availableSlots[proposedIndex];
    const alternativeSlots = availableSlots.slice(0, 4);

    return {
      canSchedule: parsed.canSchedule,
      proposedDate,
      proposedDateISO: proposedDate.toISOString(),
      alternativeSlots,
      alternativeSlotsISO: alternativeSlots.map(d => d.toISOString()),
      suggestedMessage: parsed.suggestedMessage,
      needsConfirmation: parsed.needsConfirmation,
    };
  } catch (error) {
    console.error("[Schedule Agent] Error:", error);
    // Return a fallback schedule
    const fallbackAlternatives = availableSlots.slice(0, 4);
    return {
      canSchedule: true,
      proposedDate: nextSlot,
      proposedDateISO: nextSlot.toISOString(),
      alternativeSlots: fallbackAlternatives,
      alternativeSlotsISO: fallbackAlternatives.map(d => d.toISOString()),
      suggestedMessage: `Great! We'd like to schedule your ${serviceType} service. Our next available slot is ${nextSlot.toLocaleDateString()} at ${nextSlot.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Does that work for you?`,
      needsConfirmation: true,
    };
  }
}

export function formatScheduleConfirmation(
  scheduledDate: Date,
  serviceType: string,
  businessName: string,
  customerName?: string
): string {
  const dateStr = scheduledDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeStr = scheduledDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${customerName ? `Hi ${customerName}! ` : ""}Your ${serviceType} appointment with ${businessName} is confirmed for ${dateStr} at ${timeStr}. We'll send a reminder the day before. Reply CHANGE to reschedule.`;
}
