// Knowledge Content Type Definitions
// Runtime validation schemas using Zod
// Security: Strict validation prevents malformed content

import { z } from "zod";

// Item type enum
export const KnowledgeItemTypeSchema = z.enum([
  "policy",
  "service",
  "payment",
  "operations",
  "proof_of_work",
  "macro"
]);

export const KnowledgeStatusSchema = z.enum(["draft", "review", "published", "retired"]);

// 1. Policy Content Schema
export const PolicyContentSchema = z.object({
  policyType: z.enum(["refund", "cancellation", "guarantee", "liability", "privacy", "terms_of_service"]),
  summary: z.string().min(10, "Summary must be at least 10 characters").max(500, "Summary must not exceed 500 characters"),
  fullText: z.string().min(50, "Policy text must be at least 50 characters").max(5000, "Policy text must not exceed 5000 characters"),
  effectiveDate: z.string().datetime("Invalid datetime format"),
  expirationDate: z.string().datetime("Invalid datetime format").optional(),
  requiresCustomerConsent: z.boolean().default(false),
  legalReferences: z.array(z.string().url("Invalid URL")).optional(),
  policyVersion: z.string().regex(/^\d+\.\d+$/, "Version must be in format X.Y").optional(),
});

export type PolicyContent = z.infer<typeof PolicyContentSchema>;

// 2. Service Content Schema
export const ServiceContentSchema = z.object({
  serviceType: z.string().min(2, "Service type required").max(100),
  displayName: z.string().min(2, "Display name required").max(100),
  description: z.string().min(20, "Description must be at least 20 characters").max(1000, "Description must not exceed 1000 characters"),
  pricingModel: z.enum(["per_sqft", "flat_rate", "hourly", "tiered"]),
  basePrice: z.number().positive("Price must be positive").optional(),
  frequency: z.enum(["one_time", "weekly", "biweekly", "monthly", "seasonal"]),
  estimatedDuration: z.string().regex(/^\d+-\d+\s+(minutes|hours)$/, "Format: '45-60 minutes'").optional(),
  equipmentRequired: z.array(z.string()).default([]),
  seasonalAvailability: z.array(z.enum(["spring", "summer", "fall", "winter"])).optional(),
  upsellServices: z.array(z.string()).optional(),
  requiresApproval: z.boolean().default(false),
});

export type ServiceContent = z.infer<typeof ServiceContentSchema>;

// 3. Payment Content Schema
export const PaymentContentSchema = z.object({
  paymentTopic: z.enum(["autopay", "payment_methods", "invoicing", "late_fees", "refunds", "disputes", "tax"]),
  question: z.string().min(5, "Question required").max(200),
  answer: z.string().min(50, "Answer must be at least 50 characters").max(2000, "Answer must not exceed 2000 characters"),
  relatedPolicySlugs: z.array(z.string().regex(/^[a-z0-9-]+$/, "Invalid slug format")).optional(),
  exampleScenarios: z.array(z.object({
    scenario: z.string().min(10).max(500),
    resolution: z.string().min(10).max(500),
  })).optional(),
  applicableStates: z.array(z.string().length(2, "State codes must be 2 characters")).optional(),
});

export type PaymentContent = z.infer<typeof PaymentContentSchema>;

// 4. Operations Content Schema
export const OperationsContentSchema = z.object({
  operationType: z.enum(["scheduling", "crew_assignment", "route_optimization", "quality_control", "safety", "equipment"]),
  procedure: z.string().min(20, "Procedure description required").max(200),
  steps: z.array(z.object({
    stepNumber: z.number().int().positive(),
    action: z.string().min(10, "Action description required").max(500),
    owner: z.enum(["crew", "ops", "system", "customer"]),
    automationAvailable: z.boolean().default(false),
    requiredTools: z.array(z.string()).optional(),
    safetyNotes: z.string().max(500).optional(),
  })).min(1, "At least one step required"),
  escalationCriteria: z.string().max(1000).optional(),
  slaTarget: z.string().regex(/^\d+\s+(minutes|hours|days)$/, "Format: '2 hours'").optional(),
  requiresTraining: z.boolean().default(false),
});

export type OperationsContent = z.infer<typeof OperationsContentSchema>;

// 5. Proof of Work Content Schema
export const ProofOfWorkContentSchema = z.object({
  workType: z.string().min(2, "Work type required").max(100),
  requiredEvidence: z.array(z.enum(["photos", "gps_checkin", "customer_signature", "crew_notes", "before_after_photos"])).min(1, "At least one evidence type required"),
  photoRequirements: z.object({
    minimumCount: z.number().int().positive("Minimum 1 photo required").max(20, "Maximum 20 photos"),
    requiredAngles: z.array(z.string()).min(1, "At least one angle required"),
    qualityStandards: z.string().min(20).max(500),
    maxFileSizeMB: z.number().positive().max(10, "Max 10MB per photo").optional(),
    acceptedFormats: z.array(z.enum(["jpg", "jpeg", "png", "heic"])).optional(),
  }).optional(),
  autoApprovalCriteria: z.object({
    enabled: z.boolean(),
    confidenceThreshold: z.number().min(0, "Threshold must be 0-1").max(1, "Threshold must be 0-1"),
    requiresQAReview: z.boolean().default(false),
  }).optional(),
  gpsAccuracyMeters: z.number().positive().max(100, "Max 100m accuracy").optional(),
});

export type ProofOfWorkContent = z.infer<typeof ProofOfWorkContentSchema>;

// 6. Macro (Support Reply Template) Content Schema
export const MacroContentSchema = z.object({
  intent: z.string().min(3, "Intent required").max(100).regex(/^[a-z0-9_]+$/, "Use lowercase with underscores"),
  shortcut: z.string().min(2, "Shortcut required").max(50).regex(/^[a-z0-9_]+$/, "Use lowercase with underscores"),
  subject: z.string().max(200).optional(),
  body: z.string().min(20, "Body must be at least 20 characters").max(2000, "Body must not exceed 2000 characters"),
  placeholders: z.array(z.object({
    key: z.string().regex(/^[a-zA-Z0-9_]+$/, "Use alphanumeric with underscores"),
    description: z.string().min(3, "Description required").max(100),
    required: z.boolean(),
    defaultValue: z.string().max(200).optional(),
    validationRegex: z.string().optional(),
  })),
  requiresApproval: z.boolean().default(false),
  tags: z.array(z.string().max(50)).optional(),
  availableChannels: z.array(z.enum(["email", "sms", "in_app", "push"])).optional(),
});

export type MacroContent = z.infer<typeof MacroContentSchema>;

// Union type for discriminated union validation
export const KnowledgeContentSchema = z.discriminatedUnion("itemType", [
  z.object({ itemType: z.literal("policy"), content: PolicyContentSchema }),
  z.object({ itemType: z.literal("service"), content: ServiceContentSchema }),
  z.object({ itemType: z.literal("payment"), content: PaymentContentSchema }),
  z.object({ itemType: z.literal("operations"), content: OperationsContentSchema }),
  z.object({ itemType: z.literal("proof_of_work"), content: ProofOfWorkContentSchema }),
  z.object({ itemType: z.literal("macro"), content: MacroContentSchema }),
]);

export type KnowledgeContent = z.infer<typeof KnowledgeContentSchema>;

// Validation helper functions
export function validateKnowledgeContent(itemType: string, content: unknown): {
  success: boolean;
  error?: string;
  data?: any;
} {
  try {
    const result = KnowledgeContentSchema.parse({ itemType, content });
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

export function validateAndThrow(itemType: string, content: unknown): void {
  const result = validateKnowledgeContent(itemType, content);
  if (!result.success) {
    throw new Error(`Invalid knowledge content for type ${itemType}: ${result.error}`);
  }
}

// Content sanitization (security: prevent XSS)
export function sanitizeKnowledgeContent(content: any): any {
  if (typeof content === 'string') {
    // Remove script tags and event handlers
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '');
  }

  if (Array.isArray(content)) {
    return content.map(sanitizeKnowledgeContent);
  }

  if (typeof content === 'object' && content !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(content)) {
      sanitized[key] = sanitizeKnowledgeContent(value);
    }
    return sanitized;
  }

  return content;
}

// Applies-to scope validation
export const AppliesToSchema = z.object({
  serviceTypes: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  customerTiers: z.array(z.enum(["bronze", "silver", "gold", "platinum"])).optional(),
  minimumAccountAge: z.number().int().nonnegative().optional(),
}).strict();

export type AppliesTo = z.infer<typeof AppliesToSchema>;

// Search result confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,    // Auto-respond with this knowledge
  MEDIUM: 0.70,  // Suggest to operator
  LOW: 0.50,     // Show as related content
} as const;

// Content extraction for search indexing
export function extractSearchableText(itemType: string, content: any): string {
  const parts: string[] = [];

  switch (itemType) {
    case 'policy':
      parts.push(content.summary, content.fullText);
      break;
    case 'service':
      parts.push(content.displayName, content.description);
      if (content.equipmentRequired) parts.push(...content.equipmentRequired);
      break;
    case 'payment':
      parts.push(content.question, content.answer);
      break;
    case 'operations':
      parts.push(content.procedure);
      parts.push(...content.steps.map((s: any) => s.action));
      break;
    case 'proof_of_work':
      parts.push(content.workType);
      if (content.photoRequirements) parts.push(content.photoRequirements.qualityStandards);
      break;
    case 'macro':
      parts.push(content.intent, content.body);
      if (content.subject) parts.push(content.subject);
      break;
  }

  return parts.filter(Boolean).join(' ');
}
