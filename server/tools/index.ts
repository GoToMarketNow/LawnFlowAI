import { z } from "zod";
import { storage } from "../storage";
import { randomUUID } from "crypto";

// ============================================================================
// COMMS TOOLS - Communication utilities for SMS and inbound logging
// ============================================================================

const sendSmsInputSchema = z.object({
  to: z.string().min(1),
  text: z.string().min(1),
});

const sendSmsOutputSchema = z.object({
  messageId: z.string(),
  status: z.enum(["queued", "sent", "failed"]),
});

export type SendSmsInput = z.infer<typeof sendSmsInputSchema>;
export type SendSmsOutput = z.infer<typeof sendSmsOutputSchema>;

const logInboundInputSchema = z.object({
  channel: z.enum(["sms", "call", "web"]),
  from: z.string().min(1),
  payload: z.record(z.any()),
  received_at_iso: z.string(),
});

const logInboundOutputSchema = z.object({
  inboundId: z.string(),
});

export type LogInboundInput = z.infer<typeof logInboundInputSchema>;
export type LogInboundOutput = z.infer<typeof logInboundOutputSchema>;

// ============================================================================
// FSM TOOLS - Field Service Management mock implementations
// ============================================================================

const getAvailabilityInputSchema = z.object({
  date_from_iso: z.string(),
  date_to_iso: z.string(),
  service_type: z.string(),
});

const slotSchema = z.object({
  start_iso: z.string(),
  end_iso: z.string(),
  crew_id: z.string(),
  score: z.number(),
});

const getAvailabilityOutputSchema = z.object({
  slots: z.array(slotSchema),
});

export type GetAvailabilityInput = z.infer<typeof getAvailabilityInputSchema>;
export type GetAvailabilityOutput = z.infer<typeof getAvailabilityOutputSchema>;

const createLeadInputSchema = z.object({
  name: z.string().nullable(),
  phone: z.string().min(1),
  address: z.string().nullable(),
  service_requested: z.string(),
  notes: z.string(),
});

const createLeadOutputSchema = z.object({
  leadId: z.string(),
});

export type CreateLeadInput = z.infer<typeof createLeadInputSchema>;
export type CreateLeadOutput = z.infer<typeof createLeadOutputSchema>;

const createJobInputSchema = z.object({
  leadId: z.string(),
  start_iso: z.string(),
  end_iso: z.string(),
  service_type: z.string(),
  notes: z.string(),
});

const createJobOutputSchema = z.object({
  jobId: z.string(),
  status: z.literal("scheduled"),
});

export type CreateJobInput = z.infer<typeof createJobInputSchema>;
export type CreateJobOutput = z.infer<typeof createJobOutputSchema>;

// ============================================================================
// APPROVALS TOOLS - Human-in-the-loop approval workflow
// ============================================================================

const requestApprovalInputSchema = z.object({
  type: z.enum(["send_message", "send_quote", "book_job"]),
  summary: z.string(),
  payload: z.record(z.any()),
});

const requestApprovalOutputSchema = z.object({
  approvalId: z.string(),
  status: z.literal("pending"),
});

export type RequestApprovalInput = z.infer<typeof requestApprovalInputSchema>;
export type RequestApprovalOutput = z.infer<typeof requestApprovalOutputSchema>;

const resolveApprovalInputSchema = z.object({
  approvalId: z.string(),
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().nullable(),
});

const resolveApprovalOutputSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export type ResolveApprovalInput = z.infer<typeof resolveApprovalInputSchema>;
export type ResolveApprovalOutput = z.infer<typeof resolveApprovalOutputSchema>;

// ============================================================================
// AUDIT TOOLS - Audit logging for all system actions
// ============================================================================

const logEventInputSchema = z.object({
  action: z.string(),
  actor: z.string(),
  payload: z.record(z.any()).optional(),
});

export type LogEventInput = z.infer<typeof logEventInputSchema>;

// ============================================================================
// METRICS TOOLS - Metrics recording for analytics
// ============================================================================

const recordMetricInputSchema = z.object({
  name: z.string(),
  value: z.number(),
  tags: z.record(z.string()).optional(),
});

export type RecordMetricInput = z.infer<typeof recordMetricInputSchema>;

// ============================================================================
// COMMS NAMESPACE
// ============================================================================

export const comms = {
  async sendSms(input: unknown): Promise<SendSmsOutput> {
    const validated = sendSmsInputSchema.parse(input);
    
    const messageId = `msg_${randomUUID()}`;
    
    // Mock SMS sending - in production would use Twilio
    const status: "queued" | "sent" | "failed" = process.env.TWILIO_ACCOUNT_SID 
      ? "queued" 
      : "sent"; // Mock always succeeds
    
    console.log(`[comms.sendSms] To: ${validated.to}, Status: ${status}`);
    
    // Audit log the tool call
    await audit.logEvent({
      action: "comms.sendSms",
      actor: "system",
      payload: { to: validated.to, messageId, status, textLength: validated.text.length },
    });
    
    const result = { messageId, status };
    return sendSmsOutputSchema.parse(result);
  },

  async logInbound(input: unknown): Promise<LogInboundOutput> {
    const validated = logInboundInputSchema.parse(input);
    
    const inboundId = `inb_${randomUUID()}`;
    
    console.log(`[comms.logInbound] Channel: ${validated.channel}, From: ${validated.from}`);
    
    // Audit log the tool call
    await audit.logEvent({
      action: "comms.logInbound",
      actor: "system",
      payload: { channel: validated.channel, from: validated.from, inboundId },
    });
    
    const result = { inboundId };
    return logInboundOutputSchema.parse(result);
  },
};

// ============================================================================
// FSM NAMESPACE (Mock implementations for PoC)
// ============================================================================

export const fsm = {
  async getAvailability(input: unknown): Promise<GetAvailabilityOutput> {
    const validated = getAvailabilityInputSchema.parse(input);
    
    const fromDate = new Date(validated.date_from_iso);
    const toDate = new Date(validated.date_to_iso);
    
    // Generate mock slots
    const slots: z.infer<typeof slotSchema>[] = [];
    const crewIds = ["crew_alpha", "crew_beta", "crew_gamma"];
    
    let currentDate = new Date(fromDate);
    while (currentDate <= toDate && slots.length < 10) {
      // Skip weekends
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        // Morning slot (8am-12pm)
        const morningStart = new Date(currentDate);
        morningStart.setHours(8, 0, 0, 0);
        const morningEnd = new Date(currentDate);
        morningEnd.setHours(12, 0, 0, 0);
        
        slots.push({
          start_iso: morningStart.toISOString(),
          end_iso: morningEnd.toISOString(),
          crew_id: crewIds[Math.floor(Math.random() * crewIds.length)],
          score: Math.floor(Math.random() * 50) + 50, // 50-100 score
        });
        
        // Afternoon slot (1pm-5pm)
        const afternoonStart = new Date(currentDate);
        afternoonStart.setHours(13, 0, 0, 0);
        const afternoonEnd = new Date(currentDate);
        afternoonEnd.setHours(17, 0, 0, 0);
        
        slots.push({
          start_iso: afternoonStart.toISOString(),
          end_iso: afternoonEnd.toISOString(),
          crew_id: crewIds[Math.floor(Math.random() * crewIds.length)],
          score: Math.floor(Math.random() * 50) + 50,
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Sort by score descending
    slots.sort((a, b) => b.score - a.score);
    
    console.log(`[fsm.getAvailability] Found ${slots.length} slots for ${validated.service_type}`);
    
    // Audit log the tool call
    await audit.logEvent({
      action: "fsm.getAvailability",
      actor: "system",
      payload: { 
        date_from: validated.date_from_iso, 
        date_to: validated.date_to_iso,
        service_type: validated.service_type,
        slots_found: slots.length,
      },
    });
    
    const result = { slots };
    return getAvailabilityOutputSchema.parse(result);
  },

  async createLead(input: unknown): Promise<CreateLeadOutput> {
    const validated = createLeadInputSchema.parse(input);
    
    const leadId = `lead_${randomUUID()}`;
    
    console.log(`[fsm.createLead] Created lead ${leadId} for ${validated.name || "Unknown"}`);
    
    // Audit log the tool call
    await audit.logEvent({
      action: "fsm.createLead",
      actor: "system",
      payload: { 
        leadId,
        name: validated.name,
        phone: validated.phone,
        service_requested: validated.service_requested,
      },
    });
    
    const result = { leadId };
    return createLeadOutputSchema.parse(result);
  },

  async createJob(input: unknown): Promise<CreateJobOutput> {
    const validated = createJobInputSchema.parse(input);
    
    const jobId = `job_${randomUUID()}`;
    
    console.log(`[fsm.createJob] Created job ${jobId} for lead ${validated.leadId}`);
    
    // Audit log the tool call
    await audit.logEvent({
      action: "fsm.createJob",
      actor: "system",
      payload: { 
        jobId,
        leadId: validated.leadId,
        start_iso: validated.start_iso,
        end_iso: validated.end_iso,
        service_type: validated.service_type,
      },
    });
    
    const result = { jobId, status: "scheduled" as const };
    return createJobOutputSchema.parse(result);
  },
};

// ============================================================================
// APPROVALS NAMESPACE
// ============================================================================

export const approvals = {
  async requestApproval(input: unknown, conversationId?: number): Promise<RequestApprovalOutput> {
    const validated = requestApprovalInputSchema.parse(input);
    
    // Map type to actionType for database
    const actionTypeMap: Record<string, string> = {
      send_message: "send_sms",
      send_quote: "send_quote",
      book_job: "schedule_job",
    };
    
    // Create pending action in database
    const pendingAction = await storage.createPendingAction({
      conversationId: conversationId || null,
      actionType: actionTypeMap[validated.type] || validated.type,
      description: validated.summary,
      payload: validated.payload,
      status: "pending",
    });
    
    const approvalId = `approval_${pendingAction.id}`;
    
    console.log(`[approvals.requestApproval] Created approval ${approvalId} type=${validated.type}`);
    
    // Audit log the tool call
    await audit.logEvent({
      action: "approvals.requestApproval",
      actor: "system",
      payload: { 
        approvalId,
        type: validated.type,
        summary: validated.summary,
      },
    });
    
    const result = { approvalId, status: "pending" as const };
    return requestApprovalOutputSchema.parse(result);
  },

  async resolveApproval(input: unknown): Promise<ResolveApprovalOutput> {
    const validated = resolveApprovalInputSchema.parse(input);
    
    // Extract numeric ID from approvalId
    const idMatch = validated.approvalId.match(/approval_(\d+)/);
    if (!idMatch) {
      throw new Error(`Invalid approvalId format: ${validated.approvalId}`);
    }
    const pendingActionId = parseInt(idMatch[1], 10);
    
    // Update pending action in database
    await storage.updatePendingAction(pendingActionId, {
      status: validated.decision,
      notes: validated.notes || undefined,
      resolvedAt: new Date(),
    });
    
    console.log(`[approvals.resolveApproval] Resolved ${validated.approvalId} as ${validated.decision}`);
    
    // Audit log the tool call
    await audit.logEvent({
      action: "approvals.resolveApproval",
      actor: "operator",
      payload: { 
        approvalId: validated.approvalId,
        decision: validated.decision,
        notes: validated.notes,
      },
    });
    
    const result = { status: validated.decision };
    return resolveApprovalOutputSchema.parse(result);
  },
};

// ============================================================================
// AUDIT NAMESPACE
// ============================================================================

export const audit = {
  async logEvent(input: unknown): Promise<void> {
    const validated = logEventInputSchema.parse(input);
    
    // Store in database audit log
    await storage.createAuditLog({
      entityType: "tool",
      entityId: 0,
      action: validated.action,
      details: {
        actor: validated.actor,
        ...validated.payload,
      },
    });
    
    console.log(`[audit.logEvent] ${validated.action} by ${validated.actor}`);
  },
};

// ============================================================================
// METRICS NAMESPACE
// ============================================================================

// In-memory metrics store (in production would use a time-series database)
const metricsStore: Array<{
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
}> = [];

export const metrics = {
  async record(input: unknown): Promise<void> {
    const validated = recordMetricInputSchema.parse(input);
    
    metricsStore.push({
      name: validated.name,
      value: validated.value,
      tags: validated.tags || {},
      timestamp: new Date(),
    });
    
    console.log(`[metrics.record] ${validated.name}=${validated.value}`);
    
    // Also audit log metric recording
    await audit.logEvent({
      action: "metrics.record",
      actor: "system",
      payload: { 
        name: validated.name, 
        value: validated.value,
        tags: validated.tags,
      },
    });
  },

  getMetrics(): typeof metricsStore {
    return [...metricsStore];
  },

  clearMetrics(): void {
    metricsStore.length = 0;
  },
};

// ============================================================================
// EXPORT ALL SCHEMAS FOR EXTERNAL USE
// ============================================================================

export const schemas = {
  comms: {
    sendSmsInput: sendSmsInputSchema,
    sendSmsOutput: sendSmsOutputSchema,
    logInboundInput: logInboundInputSchema,
    logInboundOutput: logInboundOutputSchema,
  },
  fsm: {
    getAvailabilityInput: getAvailabilityInputSchema,
    getAvailabilityOutput: getAvailabilityOutputSchema,
    createLeadInput: createLeadInputSchema,
    createLeadOutput: createLeadOutputSchema,
    createJobInput: createJobInputSchema,
    createJobOutput: createJobOutputSchema,
  },
  approvals: {
    requestApprovalInput: requestApprovalInputSchema,
    requestApprovalOutput: requestApprovalOutputSchema,
    resolveApprovalInput: resolveApprovalInputSchema,
    resolveApprovalOutput: resolveApprovalOutputSchema,
  },
  audit: {
    logEventInput: logEventInputSchema,
  },
  metrics: {
    recordMetricInput: recordMetricInputSchema,
  },
};
