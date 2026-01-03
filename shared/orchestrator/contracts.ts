import { z } from "zod";

// ============================================
// Agent Contract Schemas - Lead-to-Cash Orchestrator
// All agents return ONLY structured JSON matching these schemas
// ============================================

// Common confidence enum
export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

// ============================================
// Stage 1: LEAD_INTAKE
// ============================================

export const LeadIntakeResultSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string(),
  address: z.string(),
  services: z.array(z.string()),
  frequency: z.enum(["one_time", "weekly", "biweekly", "monthly", "unknown"]),
  timeline: z.string().optional(),
  missingFields: z.array(z.string()),
  confidence: ConfidenceSchema,
});
export type LeadIntakeResult = z.infer<typeof LeadIntakeResultSchema>;

export const PropertyResolverResultSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  zip: z.string().optional(),
  lotAreaSqft: z.number().optional(),
  lotConfidence: ConfidenceSchema,
  notes: z.string().optional(),
});
export type PropertyResolverResult = z.infer<typeof PropertyResolverResultSchema>;

// ============================================
// Stage 2: QUOTE_BUILD
// ============================================

export const QuoteBuildResultSchema = z.object({
  rangeLow: z.number(),
  rangeHigh: z.number(),
  currency: z.literal("USD"),
  servicesIncluded: z.array(z.string()),
  assumptions: z.array(z.string()),
  nextStep: z.enum(["ready_to_send", "request_photos", "schedule_site_visit"]),
  confidence: ConfidenceSchema,
});
export type QuoteBuildResult = z.infer<typeof QuoteBuildResultSchema>;

// ============================================
// Stage 3: QUOTE_CONFIRM
// ============================================

export const QuoteConfirmResultSchema = z.object({
  outcome: z.enum(["accepted", "question", "modify", "declined", "no_response"]),
  customerMessage: z.string().optional(),
  confidence: ConfidenceSchema,
});
export type QuoteConfirmResult = z.infer<typeof QuoteConfirmResultSchema>;

// ============================================
// Stage 4: SCHEDULE_PROPOSE
// ============================================

export const TimeWindowSchema = z.object({
  startISO: z.string(),
  endISO: z.string(),
});
export type TimeWindow = z.infer<typeof TimeWindowSchema>;

export const ScheduleProposeResultSchema = z.object({
  proposedWindows: z.array(TimeWindowSchema),
  deliveryChannel: z.literal("sms"),
  confidence: ConfidenceSchema,
});
export type ScheduleProposeResult = z.infer<typeof ScheduleProposeResultSchema>;

export const ScheduleSelectResultSchema = z.object({
  outcome: z.enum(["selected", "needs_more_options", "no_response"]),
  selectedWindow: TimeWindowSchema.optional(),
  confidence: ConfidenceSchema,
});
export type ScheduleSelectResult = z.infer<typeof ScheduleSelectResultSchema>;

// ============================================
// Stage 5: CREW_ASSIGN
// ============================================

export const CrewOptionSchema = z.object({
  crewId: z.string(),
  crewName: z.string().optional(),
  proposedStartISO: z.string(),
  travelMinutesDelta: z.number(),
  marginScore: z.number(),
  riskScore: z.number(),
  totalScore: z.number(),
  reasons: z.array(z.string()),
});
export type CrewOption = z.infer<typeof CrewOptionSchema>;

export const CrewAssignResultSchema = z.object({
  topOptions: z.array(CrewOptionSchema),
  selectedOption: z.object({
    crewId: z.string(),
    proposedStartISO: z.string(),
  }).optional(),
  mode: z.enum(["recommend_only", "auto_assign"]),
  confidence: ConfidenceSchema,
});
export type CrewAssignResult = z.infer<typeof CrewAssignResultSchema>;

// ============================================
// Stage 6: JOB_BOOKED
// ============================================

export const JobBookedResultSchema = z.object({
  writeback: z.enum(["success", "failed"]),
  externalProvider: z.literal("jobber"),
  externalId: z.string().optional(),
  confirmationSent: z.boolean(),
  confidence: ConfidenceSchema,
});
export type JobBookedResult = z.infer<typeof JobBookedResultSchema>;

// ============================================
// Orchestrator Decision Schema
// ============================================

export const StepDecisionSchema = z.object({
  advance: z.boolean(),
  nextStage: z.string().optional(),
  confidence: ConfidenceSchema,
  waitReason: z.enum(["customer_response", "ops_approval", "none"]).optional(),
  notes: z.array(z.string()).optional(),
});
export type StepDecision = z.infer<typeof StepDecisionSchema>;

// ============================================
// Intent Parsing for Customer Messages
// ============================================

export const ParsedIntentSchema = z.object({
  intent: z.enum([
    "accepted",
    "declined", 
    "question",
    "modify",
    "schedule_select_1",
    "schedule_select_2",
    "schedule_select_3",
    "schedule_more_options",
    "unclear",
  ]),
  confidence: ConfidenceSchema,
  extractedData: z.record(z.unknown()).optional(),
});
export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

// ============================================
// Context Schemas - Rolling state through orchestration
// ============================================

export const OrchestrationContextSchema = z.object({
  // Lead intake data
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  address: z.string().optional(),
  services: z.array(z.string()).optional(),
  frequency: z.string().optional(),
  
  // Property data
  lat: z.number().optional(),
  lng: z.number().optional(),
  zip: z.string().optional(),
  lotAreaSqft: z.number().optional(),
  
  // Quote data
  rangeLow: z.number().optional(),
  rangeHigh: z.number().optional(),
  quoteAssumptions: z.array(z.string()).optional(),
  
  // Schedule data
  proposedWindows: z.array(TimeWindowSchema).optional(),
  selectedWindow: TimeWindowSchema.optional(),
  
  // Crew assignment
  selectedCrewId: z.string().optional(),
  selectedCrewName: z.string().optional(),
  
  // External references
  externalJobId: z.string().optional(),
  externalQuoteId: z.string().optional(),
});
export type OrchestrationContext = z.infer<typeof OrchestrationContextSchema>;

// ============================================
// Helper functions for validation
// ============================================

export function validateAgentResult<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  agentName: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[${agentName}] Invalid result:`, result.error.format());
    throw new Error(`Agent ${agentName} returned invalid result: ${result.error.message}`);
  }
  return result.data;
}
