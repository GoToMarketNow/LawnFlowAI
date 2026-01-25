import { z } from 'zod';

export const EventSchema = z.object({
  type: z.string(),
  channel: z.string(),
  payload: z.record(z.any()),
  timestamp: z.string()
});

export const StateSummarySchema = z.object({
  customer_id: z.string().optional(),
  job_id: z.string().optional(),
  crew_id: z.string().optional(),
  last_actions: z.array(z.string())
});

export const EnvelopeSchema = z.object({
  status: z.enum(['ok', 'needs_input', 'blocked', 'error']),
  agent: z.string(),
  summary: z.string(),
  cost: z.object({
    estimated_tokens_in: z.number(),
    estimated_tokens_out: z.number(),
    tool_calls: z.number()
  }),
  data: z.any(),
  next_actions: z.array(z.object({
    type: z.enum(['tool_call', 'ask_user', 'handoff']),
    detail: z.string()
  })),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string()
  }))
});

export function validateEnvelope(data: any): boolean {
  try {
    EnvelopeSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

export function validateEvent(data: any): boolean {
  try {
    EventSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}