import { z } from "zod";
import OpenAI from "openai";
import type { Conversation, Message } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const stepSchema = z.object({
  stepId: z.string(),
  agent: z.enum(["intake", "quote", "schedule", "reviews"]),
  action: z.string(),
  inputs: z.record(z.any()),
  requiresApproval: z.boolean(),
  approvalType: z.enum(["send_message", "send_quote", "book_job"]).optional(),
  toolCalls: z.array(z.object({
    tool: z.string(),
    args: z.record(z.any()),
  })).optional(),
});

export const supervisorPlanSchema = z.object({
  planId: z.string(),
  eventType: z.string(),
  steps: z.array(stepSchema),
  shouldStop: z.boolean(),
  stopReason: z.string().optional(),
});

export type Step = z.infer<typeof stepSchema>;
export type SupervisorPlan = z.infer<typeof supervisorPlanSchema>;

export interface EventContext {
  type: "missed_call" | "inbound_sms" | "web_lead" | "job_completed";
  data: Record<string, unknown>;
  eventId: string;
}

export interface StateContext {
  conversation?: Conversation;
  messages: Message[];
  leadId?: string;
  jobId?: number;
  businessName: string;
  services: string[];
  serviceArea: string;
}

export interface PolicyContext {
  autoRespondMissedCalls: boolean;
  requireApprovalForQuotes: boolean;
  requireApprovalForScheduling: boolean;
  maxMessagesPerConversation: number;
}

const DEFAULT_POLICY: PolicyContext = {
  autoRespondMissedCalls: true,
  requireApprovalForQuotes: true,
  requireApprovalForScheduling: true,
  maxMessagesPerConversation: 50,
};

export async function plan(
  event: EventContext,
  state: StateContext,
  policy: PolicyContext = DEFAULT_POLICY
): Promise<SupervisorPlan> {
  const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  console.log(`[Supervisor] Planning for event: ${event.type}`);
  
  try {
    const systemPrompt = `You are a workflow supervisor for a landscaping business automation system.
Your job is to create execution plans for handling customer events.

Available agents:
- intake: Qualifies leads, extracts customer info, handles initial conversations
- quote: Generates service quotes based on customer needs
- schedule: Proposes and manages appointment scheduling
- reviews: Sends review requests after job completion

Available tools:
- comms.sendSms: Send SMS messages
- comms.logInbound: Log inbound messages
- fsm.getAvailability: Get crew availability slots
- fsm.createLead: Create a lead in the FSM system
- fsm.createJob: Schedule a job
- approvals.requestApproval: Request human approval
- audit.logEvent: Log an audit event
- metrics.record: Record a metric

Policy settings:
- Auto-respond to missed calls: ${policy.autoRespondMissedCalls}
- Require approval for quotes: ${policy.requireApprovalForQuotes}
- Require approval for scheduling: ${policy.requireApprovalForScheduling}

Create a plan with sequential steps. Each step should specify:
1. Which agent handles it
2. What action to take
3. Input parameters
4. Whether approval is needed
5. What tool calls to make

Return a JSON object matching this schema:
{
  "planId": "string",
  "eventType": "string",
  "steps": [
    {
      "stepId": "string",
      "agent": "intake|quote|schedule|reviews",
      "action": "description of action",
      "inputs": { ... },
      "requiresApproval": boolean,
      "approvalType": "send_message|send_quote|book_job" (if requiresApproval),
      "toolCalls": [{ "tool": "tool.method", "args": { ... } }]
    }
  ],
  "shouldStop": boolean,
  "stopReason": "string" (if shouldStop)
}`;

    const userPrompt = `Event: ${event.type}
Event Data: ${JSON.stringify(event.data)}
Event ID: ${event.eventId}

Current State:
- Has existing conversation: ${!!state.conversation}
- Conversation ID: ${state.conversation?.id || "N/A"}
- Customer phone: ${state.conversation?.customerPhone || event.data.phone || "Unknown"}
- Customer name: ${state.conversation?.customerName || event.data.customerName || "Unknown"}
- Message count: ${state.messages.length}
- Lead ID: ${state.leadId || "None"}
- Job ID: ${state.jobId || "None"}

Business Context:
- Business name: ${state.businessName}
- Services: ${state.services.join(", ")}
- Service area: ${state.serviceArea}

Recent messages:
${state.messages.slice(-5).map(m => `[${m.role}]: ${m.content}`).join("\n")}

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
    parsed.planId = planId;
    parsed.eventType = event.type;
    
    const validated = supervisorPlanSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[Supervisor] Invalid plan format:", validated.error);
      return createFallbackPlan(event, state, planId);
    }

    console.log(`[Supervisor] Created plan with ${validated.data.steps.length} steps`);
    return validated.data;

  } catch (error) {
    console.error("[Supervisor] Error creating plan:", error);
    return createFallbackPlan(event, state, planId);
  }
}

function createFallbackPlan(
  event: EventContext,
  state: StateContext,
  planId: string
): SupervisorPlan {
  const steps: Step[] = [];

  switch (event.type) {
    case "missed_call":
      steps.push({
        stepId: `${planId}_step_1`,
        agent: "intake",
        action: "Send missed call auto-response",
        inputs: {
          phone: event.data.phone,
          businessName: state.businessName,
        },
        requiresApproval: false,
        toolCalls: [
          { tool: "comms.sendSms", args: { to: event.data.phone, text: "auto_response" } },
          { tool: "fsm.createLead", args: { phone: event.data.phone, service_requested: "General inquiry" } },
        ],
      });
      break;

    case "inbound_sms":
      steps.push({
        stepId: `${planId}_step_1`,
        agent: "intake",
        action: "Process inbound SMS and qualify lead",
        inputs: {
          phone: event.data.phone,
          message: event.data.message,
        },
        requiresApproval: false,
        toolCalls: [
          { tool: "comms.logInbound", args: { channel: "sms", from: event.data.phone, payload: event.data } },
        ],
      });
      steps.push({
        stepId: `${planId}_step_2`,
        agent: "quote",
        action: "Generate quote if lead is qualified",
        inputs: {},
        requiresApproval: true,
        approvalType: "send_quote",
        toolCalls: [],
      });
      break;

    case "web_lead":
      steps.push({
        stepId: `${planId}_step_1`,
        agent: "intake",
        action: "Create lead from web form",
        inputs: event.data,
        requiresApproval: false,
        toolCalls: [
          { tool: "fsm.createLead", args: { ...event.data } },
        ],
      });
      steps.push({
        stepId: `${planId}_step_2`,
        agent: "quote",
        action: "Generate and send quote",
        inputs: {},
        requiresApproval: true,
        approvalType: "send_quote",
        toolCalls: [],
      });
      steps.push({
        stepId: `${planId}_step_3`,
        agent: "schedule",
        action: "Propose scheduling",
        inputs: {},
        requiresApproval: true,
        approvalType: "book_job",
        toolCalls: [],
      });
      break;

    case "job_completed":
      steps.push({
        stepId: `${planId}_step_1`,
        agent: "reviews",
        action: "Send review request",
        inputs: {
          jobId: event.data.jobId,
        },
        requiresApproval: false,
        toolCalls: [
          { tool: "comms.sendSms", args: { to: event.data.phone, text: "review_request" } },
        ],
      });
      break;
  }

  return {
    planId,
    eventType: event.type,
    steps,
    shouldStop: false,
  };
}

export function getDefaultPolicy(): PolicyContext {
  return { ...DEFAULT_POLICY };
}
