import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const customerMessageSchema = z.object({
  send_now: z.boolean(),
  channel: z.literal("sms"),
  to: z.string(),
  text: z.string().max(320),
});

const leadCaptureSchema = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
  service_requested: z.enum(["mowing", "cleanup", "mulch", "landscaping", "other"]),
  urgency: z.enum(["today", "this_week", "flexible", "unknown"]),
  property_size_hint: z.enum(["small", "medium", "large", "unknown"]),
  preferred_contact_method: z.enum(["sms", "call", "either", "unknown"]),
  notes: z.string(),
});

const proposedSlotSchema = z.object({
  start_iso: z.string(),
  end_iso: z.string(),
  label: z.string(),
});

const nextActionSchema = z.object({
  type: z.enum(["ask_question", "propose_schedule", "handoff_to_human"]),
  questions: z.array(z.string()).default([]),
  proposed_slots: z.array(proposedSlotSchema).default([]),
  handoff_reason: z.string().nullable(),
});

export const inboundResponseSchema = z.object({
  customer_message: customerMessageSchema,
  lead_capture: leadCaptureSchema,
  next_action: nextActionSchema,
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()),
});

export type InboundResponse = z.infer<typeof inboundResponseSchema>;

export interface BusinessProfile {
  businessName: string;
  services: string[];
  serviceArea: string[];
  pricingRules: {
    mowing?: { min: number; max: number };
    cleanup?: { min: number; max: number };
    mulch?: { min: number; max: number };
    landscaping?: { min: number; max: number };
  };
  businessHours: {
    start: string;
    end: string;
    days: string[];
  };
  tone: "professional" | "friendly" | "casual";
  allowEmojis: boolean;
}

export interface PolicyThresholds {
  confidence_threshold: number;
  auto_send_messages: boolean;
  auto_send_quotes: boolean;
  auto_book_jobs: boolean;
}

export interface EventPayload {
  type: "missed_call" | "inbound_sms";
  phone: string;
  message?: string;
  timestamp: string;
}

export interface ConversationMessage {
  role: "customer" | "agent";
  content: string;
  timestamp: string;
}

function stripEmojis(text: string): string {
  const emojiPattern = /[\uD83C-\uDBFF\uDC00-\uDFFF]+|\u2600-\u26FF|\u2700-\u27BF/g;
  return text.replace(emojiPattern, '').replace(/\s+/g, ' ').trim();
}

function enforceQuestionRules(questions: string[], hasAddress: boolean): string[] {
  const addressQuestions = ["What's your address?", "Could you share your address?", "What address should we visit?"];
  
  if (!hasAddress && questions.length > 0) {
    const hasAddressQ = questions.some(q => 
      q.toLowerCase().includes("address") || 
      q.toLowerCase().includes("location") ||
      q.toLowerCase().includes("where")
    );
    
    if (!hasAddressQ) {
      questions = [addressQuestions[0], ...questions];
    } else {
      const addressQ = questions.find(q => 
        q.toLowerCase().includes("address") || 
        q.toLowerCase().includes("location")
      );
      if (addressQ) {
        questions = [addressQ, ...questions.filter(q => q !== addressQ)];
      }
    }
  }
  
  return questions.slice(0, 3);
}

function checkServiceArea(address: string | null, serviceAreaZips: string[]): { inArea: boolean; detectedZip: string | null } {
  if (!address) return { inArea: true, detectedZip: null };
  
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (!zipMatch) return { inArea: true, detectedZip: null };
  
  const zip = zipMatch[1];
  return { 
    inArea: serviceAreaZips.includes(zip), 
    detectedZip: zip 
  };
}

function isWithinBusinessHours(hours: BusinessProfile["businessHours"]):
boolean {
  const now = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDay = dayNames[now.getDay()];
  
  if (!hours.days.includes(currentDay)) {
    return false;
  }
  
  const [startHour, startMin] = hours.start.split(":").map(Number);
  const [endHour, endMin] = hours.end.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function getNextBusinessSlots(hours: BusinessProfile["businessHours"]):
Array<{ start_iso: string; end_iso: string; label: string }> {
  const slots: Array<{ start_iso: string; end_iso: string; label: string }> = [];
  const now = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  for (let i = 1; i <= 7 && slots.length < 3; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(now.getDate() + i);
    const dayName = dayNames[checkDate.getDay()];
    
    if (hours.days.includes(dayName)) {
      const [startHour] = hours.start.split(":").map(Number);
      const slotDate = new Date(checkDate);
      slotDate.setHours(startHour, 0, 0, 0);
      
      const endDate = new Date(slotDate);
      endDate.setHours(startHour + 2);
      
      slots.push({
        start_iso: slotDate.toISOString(),
        end_iso: endDate.toISOString(),
        label: `${dayName} ${hours.start}`,
      });
    }
  }
  
  return slots;
}

export async function runInboundEngagementAgent(
  event: EventPayload,
  businessProfile: BusinessProfile,
  conversationHistory: ConversationMessage[],
  policyThresholds: PolicyThresholds
): Promise<InboundResponse> {
  const isAfterHours = !isWithinBusinessHours(businessProfile.businessHours);
  const proposedSlots = isAfterHours ? getNextBusinessSlots(businessProfile.businessHours) : [];
  
  const systemPrompt = `You are the Inbound Engagement Agent for ${businessProfile.businessName}, a landscaping/lawn care company.

GOAL:
- Recover missed calls & inbound texts
- Qualify the lead quickly
- Propose the next best action (estimate visit, call back time, or quick quote range)

BUSINESS CONTEXT:
- Business Name: ${businessProfile.businessName}
- Services: ${businessProfile.services.join(", ")}
- Service Area (ZIP codes): ${businessProfile.serviceArea.join(", ")}
- Business Hours: ${businessProfile.businessHours.start} - ${businessProfile.businessHours.end} on ${businessProfile.businessHours.days.join(", ")}
- Current Time: ${new Date().toISOString()}
- Is After Hours: ${isAfterHours}
- Tone: ${businessProfile.tone}
- Allow Emojis: ${businessProfile.allowEmojis}

PRICING RULES:
${JSON.stringify(businessProfile.pricingRules, null, 2)}

POLICY THRESHOLDS:
- Confidence threshold: ${policyThresholds.confidence_threshold}
- Auto send messages: ${policyThresholds.auto_send_messages}
- Auto send quotes: ${policyThresholds.auto_send_quotes}
- Auto book jobs: ${policyThresholds.auto_book_jobs}

CONVERSATION HISTORY:
${conversationHistory.length > 0 ? conversationHistory.map(m => `${m.role}: ${m.content}`).join("\n") : "No prior conversation"}

${isAfterHours ? `AVAILABLE CALLBACK SLOTS (after hours):
${proposedSlots.map(s => `- ${s.label}`).join("\n")}` : ""}

RULES:
1. Ask max 3 questions total across the conversation. If missing address, ask it first.
2. If the address/ZIP is outside service area (${businessProfile.serviceArea.join(", ")}), politely decline and set next_action.type to "handoff_to_human".
3. If after business hours, offer to schedule a callback/estimate using the available slots above.
4. Keep customer_message.text under 320 characters.
5. ${businessProfile.allowEmojis ? "Emojis are allowed based on business tone." : "Do NOT use emojis."}
6. Extract as much lead information as possible from the message.

OUTPUT JSON SCHEMA:
{
  "customer_message": {
    "send_now": boolean,
    "channel": "sms",
    "to": "customer phone",
    "text": "response text (max 320 chars)"
  },
  "lead_capture": {
    "name": "string or null",
    "address": "string or null", 
    "service_requested": "mowing|cleanup|mulch|landscaping|other",
    "urgency": "today|this_week|flexible|unknown",
    "property_size_hint": "small|medium|large|unknown",
    "preferred_contact_method": "sms|call|either|unknown",
    "notes": "internal notes about the lead"
  },
  "next_action": {
    "type": "ask_question|propose_schedule|handoff_to_human",
    "questions": ["array of questions to ask, max 3 total"],
    "proposed_slots": [{"start_iso": "ISO date", "end_iso": "ISO date", "label": "Day Time"}],
    "handoff_reason": "reason or null"
  },
  "confidence": 0.0-1.0,
  "assumptions": ["list of assumptions made"]
}`;

  const userMessage = event.type === "missed_call"
    ? `Missed call from ${event.phone} at ${event.timestamp}. No voicemail left.`
    : `Inbound SMS from ${event.phone}: "${event.message}"`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    
    parsed.customer_message.to = event.phone;
    parsed.customer_message.channel = "sms";
    
    if (!businessProfile.allowEmojis) {
      parsed.customer_message.text = stripEmojis(parsed.customer_message.text);
    }
    parsed.customer_message.text = parsed.customer_message.text.slice(0, 320);
    
    const hasAddress = !!parsed.lead_capture?.address;
    if (parsed.next_action?.questions) {
      parsed.next_action.questions = enforceQuestionRules(parsed.next_action.questions, hasAddress);
    }
    
    const serviceAreaCheck = checkServiceArea(parsed.lead_capture?.address, businessProfile.serviceArea);
    if (!serviceAreaCheck.inArea) {
      parsed.next_action = {
        type: "handoff_to_human",
        questions: [],
        proposed_slots: [],
        handoff_reason: `Customer location (ZIP: ${serviceAreaCheck.detectedZip}) is outside service area`,
      };
      parsed.lead_capture.notes = (parsed.lead_capture.notes || "") + ` [Outside service area: ${serviceAreaCheck.detectedZip}]`;
    }
    
    if (isAfterHours && parsed.next_action.type !== "handoff_to_human") {
      parsed.next_action.type = "propose_schedule";
      parsed.next_action.proposed_slots = proposedSlots;
    }

    const validated = inboundResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[InboundEngagement] Validation error:", validated.error.errors);
      throw new Error("Invalid AI response format");
    }

    return validated.data;
  } catch (error) {
    console.error("[InboundEngagement] Error:", error);
    
    return createFallbackResponse(event, businessProfile, isAfterHours, proposedSlots);
  }
}

function createFallbackResponse(
  event: EventPayload,
  businessProfile: BusinessProfile,
  isAfterHours: boolean,
  proposedSlots: Array<{ start_iso: string; end_iso: string; label: string }>
): InboundResponse {
  const isMissedCall = event.type === "missed_call";
  
  let text: string;
  if (isMissedCall) {
    text = isAfterHours
      ? `Hi! Sorry we missed your call at ${businessProfile.businessName}. We're currently closed but will call you back first thing tomorrow. What service can we help you with?`
      : `Hi! Sorry we missed your call at ${businessProfile.businessName}. How can we help you today? Reply here or call us back anytime!`;
  } else {
    text = `Thank you for contacting ${businessProfile.businessName}! We received your message and will respond shortly. Could you share your address so we can provide an accurate quote?`;
  }

  return {
    customer_message: {
      send_now: true,
      channel: "sms",
      to: event.phone,
      text: text.slice(0, 320),
    },
    lead_capture: {
      name: null,
      address: null,
      service_requested: "other",
      urgency: "unknown",
      property_size_hint: "unknown",
      preferred_contact_method: "sms",
      notes: `Fallback response generated. Event: ${event.type}`,
    },
    next_action: {
      type: isAfterHours ? "propose_schedule" : "ask_question",
      questions: isAfterHours ? [] : ["What's your address?", "What service do you need?"],
      proposed_slots: isAfterHours ? proposedSlots : [],
      handoff_reason: null,
    },
    confidence: 0.5,
    assumptions: ["Fallback response - AI processing failed"],
  };
}
