import { z } from "zod";
import OpenAI from "openai";
import type { Conversation, Message } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const classificationSchema = z.object({
  category: z.enum(["inbound_lead", "quote_request", "schedule_change", "billing", "review", "unknown"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  reason: z.string(),
});

export const stepSchema = z.object({
  step_id: z.string(),
  agent: z.enum(["InboundEngagement", "Quoting", "Scheduling", "Billing", "Reviews"]),
  goal: z.string(),
  inputs: z.record(z.any()),
  requires_human_approval: z.boolean(),
  approval_reason: z.string().nullable(),
  tools_to_use: z.array(z.string()).default([]),
});

export const planBlockSchema = z.object({
  steps: z.array(stepSchema),
  stop_conditions: z.array(z.string()),
});

export const policyBlockSchema = z.object({
  tier: z.enum(["Owner", "SMB", "Commercial"]),
  confidence_threshold: z.number(),
  notes: z.string(),
});

export const supervisorPlanSchema = z.object({
  event_id: z.string(),
  plan_id: z.string(),
  classification: classificationSchema,
  plan: planBlockSchema,
  policy: policyBlockSchema,
});

export type Classification = z.infer<typeof classificationSchema>;
export type Step = z.infer<typeof stepSchema>;
export type PlanBlock = z.infer<typeof planBlockSchema>;
export type PolicyBlock = z.infer<typeof policyBlockSchema>;
export type SupervisorPlan = z.infer<typeof supervisorPlanSchema>;

export interface EventContext {
  type: "missed_call" | "inbound_sms" | "web_lead" | "job_completed";
  channel: string;
  payload: Record<string, unknown>;
  eventId: string;
}

export interface StateContext {
  conversation?: Conversation;
  messages: Message[];
  leadId?: string;
  jobId?: number;
  businessId?: number;
  businessName: string;
  services: string[];
  serviceArea: string;
  businessHours?: string;
  pricingRules?: Record<string, unknown>;
}

export interface BusinessProfile {
  services: string[];
  serviceArea: string;
  hours: string;
  pricingRules: Record<string, unknown>;
  tier: "Owner" | "SMB" | "Commercial";
  permissions: {
    autoDispatch: boolean;
    afterHours: boolean;
    autoQuote: boolean;
    autoBook: boolean;
  };
}

export interface PolicySettings {
  tier: "Owner" | "SMB" | "Commercial";
  confidenceThreshold: number;
  autoSendMessages: boolean;
  autoSendQuotes: boolean;
  autoBookJobs: boolean;
  afterHoursAutomation: boolean;
}

const AVAILABLE_TOOLS = [
  "comms.sendSms",
  "comms.logInbound",
  "fsm.getAvailability",
  "fsm.createLead",
  "fsm.createJob",
  "approvals.requestApproval",
  "audit.logEvent",
  "metrics.record",
];

function mapTierToPolicy(tier: "Owner" | "SMB" | "Commercial"): PolicySettings {
  switch (tier) {
    case "Owner":
      return {
        tier: "Owner",
        confidenceThreshold: 0.85,
        autoSendMessages: true,
        autoSendQuotes: false,
        autoBookJobs: false,
        afterHoursAutomation: false,
      };
    case "SMB":
      return {
        tier: "SMB",
        confidenceThreshold: 0.85,
        autoSendMessages: true,
        autoSendQuotes: true,
        autoBookJobs: false,
        afterHoursAutomation: true,
      };
    case "Commercial":
      return {
        tier: "Commercial",
        confidenceThreshold: 0.90,
        autoSendMessages: true,
        autoSendQuotes: true,
        autoBookJobs: true,
        afterHoursAutomation: true,
      };
  }
}

export async function plan(
  event: EventContext,
  state: StateContext,
  businessProfile: BusinessProfile
): Promise<SupervisorPlan> {
  const policySettings = mapTierToPolicy(businessProfile.tier);
  
  console.log(`[Supervisor] Planning for event: ${event.type}, tier: ${businessProfile.tier}`);
  
  try {
    const systemPrompt = `ROLE: Supervisor Agent (Router + Policy Enforcer)

You receive:
- event: {type, channel, payload}
- business_profile: services, service_area, hours, pricing_rules, tier, permissions
- current_state: open conversations, open jobs, pending approvals
- tools: available tool list and schemas
- policy: risk thresholds & tier gates

Task:
1) Classify the event
2) Choose which specialist agent(s) to invoke
3) Produce an execution plan (steps) with:
   - which agent to call
   - inputs to that agent
   - whether human approval is required
   - which tools will be used
4) Enforce tier permissions:
   - Owner tier: no auto-dispatch, no after-hours unless configured
   - SMB tier: allow scheduling proposals; require approval to create jobs
   - Commercial tier: allow auto actions within policy thresholds

Return JSON exactly matching this schema:

{
  "event_id": "string",
  "classification": {
    "category": "inbound_lead|quote_request|schedule_change|billing|review|unknown",
    "priority": "low|normal|high|urgent",
    "reason": "string"
  },
  "plan": {
    "steps": [
      {
        "step_id": "string",
        "agent": "InboundEngagement|Quoting|Scheduling|Billing|Reviews",
        "goal": "string",
        "inputs": { "any": "json" },
        "requires_human_approval": true,
        "approval_reason": "string|null",
        "tools_to_use": ["string"]
      }
    ],
    "stop_conditions": ["string"]
  },
  "policy": {
    "tier": "Owner|SMB|Commercial",
    "confidence_threshold": 0.0,
    "notes": "string"
  }
}

Important:
- Be conservative: if address/service area mismatch or missing key info -> ask human approval or ask customer.
- Do not hallucinate tool availability. Only use tools provided in the tool list.
- Keep steps minimal; prefer 1-3 steps.

Available tools: ${AVAILABLE_TOOLS.join(", ")}

Current policy settings:
- Tier: ${policySettings.tier}
- Confidence threshold: ${policySettings.confidenceThreshold}
- Auto-send messages: ${policySettings.autoSendMessages}
- Auto-send quotes: ${policySettings.autoSendQuotes}
- Auto-book jobs: ${policySettings.autoBookJobs}
- After-hours automation: ${policySettings.afterHoursAutomation}`;

    const userPrompt = `Event:
{
  "type": "${event.type}",
  "channel": "${event.channel}",
  "payload": ${JSON.stringify(event.payload)}
}
Event ID: ${event.eventId}

Business Profile:
{
  "services": ${JSON.stringify(businessProfile.services)},
  "service_area": "${businessProfile.serviceArea}",
  "hours": "${businessProfile.hours}",
  "tier": "${businessProfile.tier}",
  "permissions": ${JSON.stringify(businessProfile.permissions)}
}

Current State:
- Has existing conversation: ${!!state.conversation}
- Conversation ID: ${state.conversation?.id || "N/A"}
- Customer phone: ${state.conversation?.customerPhone || event.payload.phone || "Unknown"}
- Customer name: ${state.conversation?.customerName || event.payload.customerName || "Unknown"}
- Message count: ${state.messages.length}
- Lead ID: ${state.leadId || "None"}
- Job ID: ${state.jobId || "None"}

Recent messages:
${state.messages.slice(-5).map(m => `[${m.role}]: ${m.content}`).join("\n") || "(none)"}

Create an execution plan for this event.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    parsed.event_id = event.eventId;
    parsed.plan_id = parsed.plan_id || `plan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const validated = supervisorPlanSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[Supervisor] Invalid plan format:", validated.error);
      return createFallbackPlan(event, state, businessProfile, policySettings);
    }

    console.log(`[Supervisor] Created plan with ${validated.data.plan.steps.length} steps, priority: ${validated.data.classification.priority}`);
    return validated.data;

  } catch (error) {
    console.error("[Supervisor] Error creating plan:", error);
    return createFallbackPlan(event, state, businessProfile, policySettings);
  }
}

function createFallbackPlan(
  event: EventContext,
  state: StateContext,
  businessProfile: BusinessProfile,
  policySettings: PolicySettings
): SupervisorPlan {
  const steps: Step[] = [];
  let category: Classification["category"] = "unknown";
  let priority: Classification["priority"] = "normal";
  let reason = "Fallback plan generated";

  const requiresApprovalForQuotes = !policySettings.autoSendQuotes;
  const requiresApprovalForBooking = !policySettings.autoBookJobs;

  switch (event.type) {
    case "missed_call":
      category = "inbound_lead";
      priority = "high";
      reason = "Missed call requires immediate response to capture lead";
      steps.push({
        step_id: `${event.eventId}_step_1`,
        agent: "InboundEngagement",
        goal: "Send missed call auto-response and create lead",
        inputs: {
          phone: event.payload.phone,
          businessName: state.businessName,
        },
        requires_human_approval: false,
        approval_reason: null,
        tools_to_use: ["comms.sendSms", "fsm.createLead", "audit.logEvent"],
      });
      break;

    case "inbound_sms":
      category = "inbound_lead";
      priority = "normal";
      reason = "Inbound SMS from customer needs qualification and response";
      steps.push({
        step_id: `${event.eventId}_step_1`,
        agent: "InboundEngagement",
        goal: "Process inbound SMS, qualify lead, and gather customer info",
        inputs: {
          phone: event.payload.phone,
          message: event.payload.body || event.payload.message,
        },
        requires_human_approval: false,
        approval_reason: null,
        tools_to_use: ["comms.logInbound", "comms.sendSms", "fsm.createLead"],
      });
      steps.push({
        step_id: `${event.eventId}_step_2`,
        agent: "Quoting",
        goal: "Generate quote if lead is qualified",
        inputs: {},
        requires_human_approval: requiresApprovalForQuotes,
        approval_reason: requiresApprovalForQuotes ? "Quote sending requires approval per policy" : null,
        tools_to_use: ["comms.sendSms", "approvals.requestApproval"],
      });
      break;

    case "web_lead":
      category = "inbound_lead";
      priority = "high";
      reason = "Web lead submission requires prompt follow-up";
      steps.push({
        step_id: `${event.eventId}_step_1`,
        agent: "InboundEngagement",
        goal: "Create lead from web form submission",
        inputs: event.payload,
        requires_human_approval: false,
        approval_reason: null,
        tools_to_use: ["fsm.createLead", "audit.logEvent"],
      });
      steps.push({
        step_id: `${event.eventId}_step_2`,
        agent: "Quoting",
        goal: "Generate and send quote based on service requested",
        inputs: {},
        requires_human_approval: requiresApprovalForQuotes,
        approval_reason: requiresApprovalForQuotes ? "Quote requires approval per tier policy" : null,
        tools_to_use: ["comms.sendSms", "approvals.requestApproval"],
      });
      steps.push({
        step_id: `${event.eventId}_step_3`,
        agent: "Scheduling",
        goal: "Propose available scheduling slots",
        inputs: {},
        requires_human_approval: requiresApprovalForBooking,
        approval_reason: requiresApprovalForBooking ? "Job booking requires approval per tier policy" : null,
        tools_to_use: ["fsm.getAvailability", "fsm.createJob", "approvals.requestApproval"],
      });
      break;

    case "job_completed":
      category = "review";
      priority = "low";
      reason = "Job completed - send review request";
      steps.push({
        step_id: `${event.eventId}_step_1`,
        agent: "Reviews",
        goal: "Send review request to customer",
        inputs: {
          jobId: event.payload.jobId,
          phone: event.payload.phone,
          customerName: event.payload.customerName,
        },
        requires_human_approval: false,
        approval_reason: null,
        tools_to_use: ["comms.sendSms", "metrics.record"],
      });
      break;
  }

  const stopConditions: string[] = [];
  if (category === "inbound_lead") {
    stopConditions.push("Customer declines service");
    stopConditions.push("Address outside service area");
    stopConditions.push("Customer unresponsive after 3 attempts");
  }
  if (steps.some(s => s.requires_human_approval)) {
    stopConditions.push("Awaiting human approval");
  }

  const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  return {
    event_id: event.eventId,
    plan_id: planId,
    classification: {
      category,
      priority,
      reason,
    },
    plan: {
      steps,
      stop_conditions: stopConditions,
    },
    policy: {
      tier: businessProfile.tier,
      confidence_threshold: policySettings.confidenceThreshold,
      notes: `Fallback plan for ${event.type}. Tier: ${businessProfile.tier}.`,
    },
  };
}

export function getDefaultBusinessProfile(): BusinessProfile {
  return {
    services: ["Mowing", "Cleanup", "Mulch"],
    serviceArea: "Charlottesville + 20 miles",
    hours: "Mon-Fri 8AM-5PM",
    pricingRules: {},
    tier: "Owner",
    permissions: {
      autoDispatch: false,
      afterHours: false,
      autoQuote: false,
      autoBook: false,
    },
  };
}

export { stepSchema as legacyStepSchema };
