import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const proposedSlotSchema = z.object({
  start_iso: z.string(),
  end_iso: z.string(),
  label: z.string(),
});

const customerMessageSchema = z.object({
  recommended_text: z.string().max(500),
});

const proposalSchema = z.object({
  proposed_slots: z.array(proposedSlotSchema).min(2).max(3),
  notes_for_customer: z.string(),
});

const bookingSchema = z.object({
  should_book_now: z.boolean(),
  requires_human_approval: z.boolean(),
  approval_reason: z.string().nullable(),
  fsm_create_job_payload: z.record(z.any()),
});

export const escalationPlanSchema = z.object({
  escalation_required: z.literal(true),
  reason: z.string(),
  customer_message: customerMessageSchema,
  booking: z.object({
    should_book_now: z.literal(false),
    requires_human_approval: z.literal(true),
    approval_reason: z.string(),
    fsm_create_job_payload: z.record(z.any()),
  }),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()),
});

export const schedulePlanSchema = z.object({
  proposal: proposalSchema,
  booking: bookingSchema,
  customer_message: customerMessageSchema,
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()),
});

export type SchedulePlan = z.infer<typeof schedulePlanSchema>;
export type EscalationPlan = z.infer<typeof escalationPlanSchema>;
export type SchedulingResult = SchedulePlan | EscalationPlan;
export type ProposedSlot = z.infer<typeof proposedSlotSchema>;

export interface LeadInfo {
  id: number;
  name: string | null;
  phone: string;
  address: string | null;
  service_requested: string;
  urgency: "today" | "this_week" | "flexible" | "unknown";
  notes: string;
}

export interface BusinessHours {
  monday: { start: string; end: string } | null;
  tuesday: { start: string; end: string } | null;
  wednesday: { start: string; end: string } | null;
  thursday: { start: string; end: string } | null;
  friday: { start: string; end: string } | null;
  saturday: { start: string; end: string } | null;
  sunday: { start: string; end: string } | null;
}

export interface AvailabilitySlot {
  start_iso: string;
  end_iso: string;
  crew_id: string;
  crew_name: string;
}

export interface PolicyThresholds {
  tier: "Owner" | "SMB" | "Commercial";
  confidence_threshold: number;
  auto_book_jobs: boolean;
}

export interface SchedulingContext {
  businessName: string;
  requestedTiming: string | null;
  travelConstraints: string | null;
}

function getDefaultBusinessHours(): BusinessHours {
  const weekday = { start: "08:00", end: "17:00" };
  return {
    monday: weekday,
    tuesday: weekday,
    wednesday: weekday,
    thursday: weekday,
    friday: weekday,
    saturday: { start: "09:00", end: "14:00" },
    sunday: null,
  };
}

function formatSlotLabel(slot: AvailabilitySlot): string {
  const start = new Date(slot.start_iso);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  return start.toLocaleDateString("en-US", options);
}

function selectBestSlots(
  slots: AvailabilitySlot[],
  urgency: string,
  maxSlots: number = 3
): AvailabilitySlot[] {
  if (slots.length === 0) return [];
  
  const sorted = [...slots].sort((a, b) => 
    new Date(a.start_iso).getTime() - new Date(b.start_iso).getTime()
  );
  
  if (urgency === "today") {
    const today = new Date().toISOString().split("T")[0];
    const todaySlots = sorted.filter(s => s.start_iso.startsWith(today));
    if (todaySlots.length > 0) {
      return todaySlots.slice(0, maxSlots);
    }
  }
  
  if (urgency === "this_week") {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    const weekSlots = sorted.filter(s => new Date(s.start_iso) <= weekEnd);
    if (weekSlots.length > 0) {
      return weekSlots.slice(0, maxSlots);
    }
  }
  
  return sorted.slice(0, maxSlots);
}

function shouldBookAutomatically(
  tier: "Owner" | "SMB" | "Commercial",
  autoBookJobs: boolean,
  confidence: number,
  confidenceThreshold: number
): { shouldBook: boolean; requiresApproval: boolean; reason: string | null } {
  if (tier === "Owner") {
    return {
      shouldBook: false,
      requiresApproval: true,
      reason: "Owner tier requires approval for all job bookings",
    };
  }
  
  if (tier === "SMB") {
    return {
      shouldBook: false,
      requiresApproval: true,
      reason: "SMB tier requires approval for job bookings",
    };
  }
  
  if (tier === "Commercial" && autoBookJobs && confidence >= confidenceThreshold) {
    return {
      shouldBook: true,
      requiresApproval: false,
      reason: null,
    };
  }
  
  return {
    shouldBook: false,
    requiresApproval: true,
    reason: `Confidence ${confidence.toFixed(2)} below threshold ${confidenceThreshold}`,
  };
}

function createFsmJobPayload(
  lead: LeadInfo,
  slot: AvailabilitySlot,
  serviceType: string,
  notes: string
): Record<string, any> {
  return {
    leadId: lead.id,
    start_iso: slot.start_iso,
    end_iso: slot.end_iso,
    service_type: serviceType,
    notes: notes,
    crew_id: slot.crew_id,
  };
}

export async function runSchedulingAgent(
  lead: LeadInfo,
  availability: AvailabilitySlot[],
  policy: PolicyThresholds,
  context: SchedulingContext,
  businessHours?: BusinessHours
): Promise<SchedulingResult> {
  const hours = businessHours || getDefaultBusinessHours();
  const bestSlots = selectBestSlots(availability, lead.urgency, 3);
  
  if (bestSlots.length < 2) {
    return createEscalationResponse(lead, bestSlots.length);
  }
  
  const proposedSlots: ProposedSlot[] = bestSlots.map(slot => ({
    start_iso: slot.start_iso,
    end_iso: slot.end_iso,
    label: formatSlotLabel(slot),
  }));

  const systemPrompt = `You are the Scheduling & Dispatch Agent for ${context.businessName}, a landscaping/lawn care company.

INPUTS:
Lead Info:
- Name: ${lead.name || "Customer"}
- Phone: ${lead.phone}
- Address: ${lead.address || "TBD"}
- Service: ${lead.service_requested}
- Urgency: ${lead.urgency}
- Notes: ${lead.notes}

Requested Timing: ${context.requestedTiming || "Not specified"}
Travel Constraints: ${context.travelConstraints || "None"}

AVAILABLE SLOTS:
${bestSlots.map((s, i) => `${i + 1}. ${formatSlotLabel(s)} (Crew: ${s.crew_name})`).join("\n")}

POLICY:
- Tier: ${policy.tier}
- Auto-book jobs: ${policy.auto_book_jobs}
- Confidence threshold: ${policy.confidence_threshold}

BUSINESS HOURS:
${Object.entries(hours)
  .map(([day, h]) => `${day}: ${h ? `${h.start}-${h.end}` : "Closed"}`) // Corrected: escaped backslash in 