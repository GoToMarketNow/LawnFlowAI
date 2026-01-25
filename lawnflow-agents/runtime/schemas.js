"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvelopeSchema = exports.StateSummarySchema = exports.EventSchema = void 0;
exports.validateEnvelope = validateEnvelope;
exports.validateEvent = validateEvent;
var zod_1 = require("zod");
exports.EventSchema = zod_1.z.object({
    type: zod_1.z.string(),
    channel: zod_1.z.string(),
    payload: zod_1.z.record(zod_1.z.any()),
    timestamp: zod_1.z.string()
});
exports.StateSummarySchema = zod_1.z.object({
    customer_id: zod_1.z.string().optional(),
    job_id: zod_1.z.string().optional(),
    crew_id: zod_1.z.string().optional(),
    last_actions: zod_1.z.array(zod_1.z.string())
});
exports.EnvelopeSchema = zod_1.z.object({
    status: zod_1.z.enum(['ok', 'needs_input', 'blocked', 'error']),
    agent: zod_1.z.string(),
    summary: zod_1.z.string(),
    cost: zod_1.z.object({
        estimated_tokens_in: zod_1.z.number(),
        estimated_tokens_out: zod_1.z.number(),
        tool_calls: zod_1.z.number()
    }),
    data: zod_1.z.any(),
    next_actions: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['tool_call', 'ask_user', 'handoff']),
        detail: zod_1.z.string()
    })),
    errors: zod_1.z.array(zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string()
    }))
});
function validateEnvelope(data) {
    try {
        exports.EnvelopeSchema.parse(data);
        return true;
    }
    catch (_a) {
        return false;
    }
}
function validateEvent(data) {
    try {
        exports.EventSchema.parse(data);
        return true;
    }
    catch (_a) {
        return false;
    }
}
