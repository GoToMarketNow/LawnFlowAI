// Knowledge Builder Agent
// Auto-generates knowledge base drafts from business configuration
// Triggered during onboarding or when configuration changes detected

import { db } from "../../db";
import { businessProfiles, services } from "../../../shared/schema";
import { knowledgeItems, knowledgeVersions } from "../../../shared/knowledge-schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";
import {
  PolicyContentSchema,
  ServiceContentSchema,
  PaymentContentSchema,
  OperationsContentSchema,
  ProofOfWorkContentSchema,
  MacroContentSchema,
  type PolicyContent,
  type ServiceContent,
  type PaymentContent,
  type OperationsContent,
  type ProofOfWorkContent,
  type MacroContent,
} from "../../../shared/knowledge-types";
import { generateEmbedding } from "./embeddings";
import { audit } from "../audit";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Builder Agent Response Schema
const PolicyDraftSchema = z.object({
  title: z.string(),
  category: z.string(),
  policyType: z.enum(["refund", "cancellation", "guarantee", "liability", "privacy", "terms_of_service"]),
  summary: z.string(),
  fullText: z.string(),
  effectiveDate: z.string(),
  requiresCustomerConsent: z.boolean(),
  policyVersion: z.string(),
});

const ServiceDraftSchema = z.object({
  title: z.string(),
  category: z.string(),
  serviceType: z.string(),
  displayName: z.string(),
  description: z.string(),
  pricingModel: z.enum(["per_sqft", "flat_rate", "hourly", "tiered"]),
  basePrice: z.number().optional(),
  frequency: z.enum(["one_time", "weekly", "biweekly", "monthly", "seasonal"]),
  estimatedDuration: z.string().optional(),
  equipmentRequired: z.array(z.string()),
  seasonalAvailability: z.array(z.enum(["spring", "summer", "fall", "winter"])).optional(),
  requiresApproval: z.boolean(),
});

const PaymentDraftSchema = z.object({
  title: z.string(),
  category: z.string(),
  paymentTopic: z.enum(["autopay", "payment_methods", "invoicing", "late_fees", "refunds", "disputes", "tax"]),
  question: z.string(),
  answer: z.string(),
  exampleScenarios: z.array(z.object({
    scenario: z.string(),
    resolution: z.string(),
  })).optional(),
});

const OperationsDraftSchema = z.object({
  title: z.string(),
  category: z.string(),
  operationType: z.enum(["scheduling", "crew_assignment", "route_optimization", "quality_control", "safety", "equipment"]),
  procedure: z.string(),
  steps: z.array(z.object({
    stepNumber: z.number(),
    action: z.string(),
    owner: z.enum(["crew", "ops", "system", "customer"]),
    automationAvailable: z.boolean(),
    requiredTools: z.array(z.string()).optional(),
    safetyNotes: z.string().optional(),
  })),
  slaTarget: z.string().optional(),
  requiresTraining: z.boolean(),
});

const ProofOfWorkDraftSchema = z.object({
  title: z.string(),
  category: z.string(),
  workType: z.string(),
  requiredEvidence: z.array(z.enum(["photos", "gps_checkin", "customer_signature", "crew_notes", "before_after_photos"])),
  photoRequirements: z.object({
    minimumCount: z.number(),
    requiredAngles: z.array(z.string()),
    qualityStandards: z.string(),
    maxFileSizeMB: z.number().optional(),
    acceptedFormats: z.array(z.enum(["jpg", "jpeg", "png", "heic"])).optional(),
  }).optional(),
  autoApprovalCriteria: z.object({
    enabled: z.boolean(),
    confidenceThreshold: z.number(),
    requiresQAReview: z.boolean(),
  }).optional(),
  gpsAccuracyMeters: z.number().optional(),
});

const MacroDraftSchema = z.object({
  title: z.string(),
  category: z.string(),
  intent: z.string(),
  shortcut: z.string(),
  subject: z.string().optional(),
  body: z.string(),
  placeholders: z.array(z.object({
    key: z.string(),
    description: z.string(),
    required: z.boolean(),
    defaultValue: z.string().optional(),
  })),
  availableChannels: z.array(z.enum(["email", "sms", "in_app", "push"])).optional(),
});

// Knowledge draft generation result
export interface KnowledgeDraft {
  itemType: "policy" | "service" | "payment" | "operations" | "proof_of_work" | "macro";
  title: string;
  category: string;
  content: PolicyContent | ServiceContent | PaymentContent | OperationsContent | ProofOfWorkContent | MacroContent;
  appliesTo?: {
    serviceTypes?: string[];
    locations?: string[];
  };
  rationale: string;
}

export interface BuilderResult {
  draftsCreated: number;
  drafts: Array<{
    knowledgeItemId: number;
    versionId: number;
    itemType: string;
    title: string;
    status: "draft";
  }>;
  errors: string[];
}

/**
 * Build knowledge base from business profile
 * Creates draft knowledge items ready for owner review
 */
export async function buildKnowledgeBase(
  businessId: number,
  userId: number,
  options: {
    includeTypes?: Array<"policy" | "service" | "payment" | "operations" | "proof_of_work" | "macro">;
    overwrite?: boolean;
  } = {}
): Promise<BuilderResult> {
  const errors: string[] = [];
  const drafts: BuilderResult["drafts"] = [];

  try {
    // Fetch business profile
    const businessResult = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.id, businessId))
      .limit(1);

    if (businessResult.length === 0) {
      throw new Error("Business profile not found");
    }

    const business = businessResult[0];

    // Fetch services
    const businessServices = await db
      .select()
      .from(services)
      .where(eq(services.businessId, businessId));

    const includeTypes = options.includeTypes || ["policy", "service", "payment", "operations", "proof_of_work", "macro"];

    // Generate policy drafts
    if (includeTypes.includes("policy")) {
      try {
        const policyDrafts = await generatePolicyDrafts(business, userId);
        for (const draft of policyDrafts) {
          const result = await createKnowledgeDraft(businessId, userId, draft);
          drafts.push(result);
        }
      } catch (error: any) {
        errors.push(`Policy generation failed: ${error.message}`);
      }
    }

    // Generate service drafts
    if (includeTypes.includes("service")) {
      try {
        const serviceDrafts = await generateServiceDrafts(business, businessServices, userId);
        for (const draft of serviceDrafts) {
          const result = await createKnowledgeDraft(businessId, userId, draft);
          drafts.push(result);
        }
      } catch (error: any) {
        errors.push(`Service generation failed: ${error.message}`);
      }
    }

    // Generate payment FAQ drafts
    if (includeTypes.includes("payment")) {
      try {
        const paymentDrafts = await generatePaymentDrafts(business, userId);
        for (const draft of paymentDrafts) {
          const result = await createKnowledgeDraft(businessId, userId, draft);
          drafts.push(result);
        }
      } catch (error: any) {
        errors.push(`Payment FAQ generation failed: ${error.message}`);
      }
    }

    // Generate operations procedure drafts
    if (includeTypes.includes("operations")) {
      try {
        const operationsDrafts = await generateOperationsDrafts(business, businessServices, userId);
        for (const draft of operationsDrafts) {
          const result = await createKnowledgeDraft(businessId, userId, draft);
          drafts.push(result);
        }
      } catch (error: any) {
        errors.push(`Operations generation failed: ${error.message}`);
      }
    }

    // Generate proof of work drafts
    if (includeTypes.includes("proof_of_work")) {
      try {
        const powDrafts = await generateProofOfWorkDrafts(business, businessServices, userId);
        for (const draft of powDrafts) {
          const result = await createKnowledgeDraft(businessId, userId, draft);
          drafts.push(result);
        }
      } catch (error: any) {
        errors.push(`Proof of work generation failed: ${error.message}`);
      }
    }

    // Generate macro template drafts
    if (includeTypes.includes("macro")) {
      try {
        const macroDrafts = await generateMacroDrafts(business, userId);
        for (const draft of macroDrafts) {
          const result = await createKnowledgeDraft(businessId, userId, draft);
          drafts.push(result);
        }
      } catch (error: any) {
        errors.push(`Macro generation failed: ${error.message}`);
      }
    }

    await auditLog({
      businessId,
      userId,
      action: "knowledge_builder_run",
      entityType: "knowledge",
      entityId: null,
      metadata: {
        draftsCreated: drafts.length,
        errors: errors.length,
        types: includeTypes,
      },
    });

    return {
      draftsCreated: drafts.length,
      drafts,
      errors,
    };
  } catch (error: any) {
    console.error("Knowledge builder failed:", error);
    throw new Error(`Knowledge builder failed: ${error.message}`);
  }
}

/**
 * Generate policy drafts from business profile
 */
async function generatePolicyDrafts(business: any, userId: number): Promise<KnowledgeDraft[]> {
  const systemPrompt = `You are a legal compliance expert for lawn care and landscaping businesses.
Generate standard business policies based on the provided business configuration.

Business: ${business.name}
Location: ${business.address || "Not specified"}
Services: ${business.serviceTypes?.join(", ") || "General lawn care"}
Invoice Terms: ${business.invoiceTerms || 30} days

Generate 3-5 essential policies covering: refund, cancellation, guarantee, liability.
Make policies specific to lawn care industry best practices.
Use plain language that customers can understand.
Include effective dates starting today.`;

  const userPrompt = `Generate policy drafts as a JSON array. Each policy must include:
- title: Clear policy name (e.g., "Refund Policy")
- category: "policies"
- policyType: one of [refund, cancellation, guarantee, liability, privacy, terms_of_service]
- summary: 1-2 sentence overview (50-200 chars)
- fullText: Complete policy text (500-2000 chars)
- effectiveDate: ISO datetime (today's date)
- requiresCustomerConsent: boolean
- policyVersion: "1.0"

Return ONLY valid JSON array, no markdown or explanation.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0].message.content || "{}";
  const parsed = JSON.parse(responseText);
  const policiesArray = parsed.policies || [];

  const drafts: KnowledgeDraft[] = [];

  for (const policyData of policiesArray) {
    try {
      const validated = PolicyDraftSchema.parse(policyData);
      const content: PolicyContent = {
        policyType: validated.policyType,
        summary: validated.summary,
        fullText: validated.fullText,
        effectiveDate: validated.effectiveDate || new Date().toISOString(),
        requiresCustomerConsent: validated.requiresCustomerConsent,
        policyVersion: validated.policyVersion,
      };

      drafts.push({
        itemType: "policy",
        title: validated.title,
        category: validated.category,
        content,
        rationale: `Generated from business profile for ${business.name}`,
      });
    } catch (error: any) {
      console.warn("Invalid policy draft:", error.message);
    }
  }

  return drafts;
}

/**
 * Generate service knowledge drafts
 */
async function generateServiceDrafts(business: any, businessServices: any[], userId: number): Promise<KnowledgeDraft[]> {
  if (businessServices.length === 0) return [];

  const systemPrompt = `You are a lawn care service expert.
Generate detailed service descriptions for customer knowledge base.

Business: ${business.name}
Services offered: ${businessServices.map(s => s.name).join(", ")}

Create comprehensive service descriptions that help customers understand:
- What's included
- Pricing structure
- Frequency options
- Equipment used
- Seasonal availability`;

  const servicesData = businessServices.map(s => ({
    name: s.name,
    description: s.description,
    basePrice: s.basePriceCents,
    category: s.category,
  }));

  const userPrompt = `Generate service knowledge drafts as JSON array for these services:
${JSON.stringify(servicesData, null, 2)}

Each service draft must include:
- title: Service name
- category: "services"
- serviceType: service identifier (lowercase with underscores)
- displayName: Customer-facing name
- description: Detailed description (200-500 chars)
- pricingModel: one of [per_sqft, flat_rate, hourly, tiered]
- basePrice: price in dollars (optional)
- frequency: one of [one_time, weekly, biweekly, monthly, seasonal]
- estimatedDuration: format "45-60 minutes" (optional)
- equipmentRequired: array of equipment names
- seasonalAvailability: array of seasons [spring, summer, fall, winter] (optional)
- requiresApproval: boolean

Return ONLY valid JSON array.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0].message.content || "{}";
  const parsed = JSON.parse(responseText);
  const servicesArray = parsed.services || [];

  const drafts: KnowledgeDraft[] = [];

  for (const serviceData of servicesArray) {
    try {
      const validated = ServiceDraftSchema.parse(serviceData);
      const content: ServiceContent = {
        serviceType: validated.serviceType,
        displayName: validated.displayName,
        description: validated.description,
        pricingModel: validated.pricingModel,
        basePrice: validated.basePrice,
        frequency: validated.frequency,
        estimatedDuration: validated.estimatedDuration,
        equipmentRequired: validated.equipmentRequired,
        seasonalAvailability: validated.seasonalAvailability,
        requiresApproval: validated.requiresApproval,
      };

      drafts.push({
        itemType: "service",
        title: validated.title,
        category: validated.category,
        content,
        appliesTo: {
          serviceTypes: [validated.serviceType],
        },
        rationale: `Generated from service configuration`,
      });
    } catch (error: any) {
      console.warn("Invalid service draft:", error.message);
    }
  }

  return drafts;
}

/**
 * Generate payment FAQ drafts
 */
async function generatePaymentDrafts(business: any, userId: number): Promise<KnowledgeDraft[]> {
  const systemPrompt = `You are a billing expert for service businesses.
Generate payment FAQs for customer knowledge base.

Business: ${business.name}
Invoice Terms: ${business.invoiceTerms || 30} days
Tax Enabled: ${business.taxEnabled ? "Yes" : "No"}
Tax Rate: ${business.defaultTaxRate ? (business.defaultTaxRate / 100).toFixed(2) + "%" : "N/A"}
QuickBooks: ${business.quickBooksConnected ? "Connected" : "Not connected"}

Generate 5-7 essential payment FAQs covering common customer questions.`;

  const userPrompt = `Generate payment FAQ drafts as JSON array. Each FAQ must include:
- title: Question as title
- category: "payments"
- paymentTopic: one of [autopay, payment_methods, invoicing, late_fees, refunds, disputes, tax]
- question: Customer question (50-150 chars)
- answer: Clear answer (200-800 chars)
- exampleScenarios: array of {scenario, resolution} (optional, 1-2 examples)

Return ONLY valid JSON array.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0].message.content || "{}";
  const parsed = JSON.parse(responseText);
  const faqsArray = parsed.faqs || [];

  const drafts: KnowledgeDraft[] = [];

  for (const faqData of faqsArray) {
    try {
      const validated = PaymentDraftSchema.parse(faqData);
      const content: PaymentContent = {
        paymentTopic: validated.paymentTopic,
        question: validated.question,
        answer: validated.answer,
        exampleScenarios: validated.exampleScenarios,
      };

      drafts.push({
        itemType: "payment",
        title: validated.title,
        category: validated.category,
        content,
        rationale: `Generated from billing configuration`,
      });
    } catch (error: any) {
      console.warn("Invalid payment FAQ draft:", error.message);
    }
  }

  return drafts;
}

/**
 * Generate operations procedure drafts
 */
async function generateOperationsDrafts(business: any, businessServices: any[], userId: number): Promise<KnowledgeDraft[]> {
  // Generate 2-3 essential operations procedures
  const systemPrompt = `You are an operations manager for lawn care businesses.
Generate standard operating procedures (SOPs) for internal operations.

Business: ${business.name}
Services: ${businessServices.map(s => s.name).join(", ")}

Create 2-3 essential procedures covering: scheduling, crew_assignment, quality_control.`;

  const userPrompt = `Generate operations procedure drafts as JSON array. Each procedure must include:
- title: Procedure name
- category: "operations"
- operationType: one of [scheduling, crew_assignment, route_optimization, quality_control, safety, equipment]
- procedure: Brief description (50-150 chars)
- steps: array of {stepNumber, action, owner, automationAvailable, requiredTools, safetyNotes}
  - stepNumber: integer starting from 1
  - action: What to do (50-300 chars)
  - owner: one of [crew, ops, system, customer]
  - automationAvailable: boolean
  - requiredTools: array of tool names (optional)
  - safetyNotes: safety information (optional)
- slaTarget: format "2 hours" (optional)
- requiresTraining: boolean

Return ONLY valid JSON array.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0].message.content || "{}";
  const parsed = JSON.parse(responseText);
  const proceduresArray = parsed.procedures || [];

  const drafts: KnowledgeDraft[] = [];

  for (const procData of proceduresArray) {
    try {
      const validated = OperationsDraftSchema.parse(procData);
      const content: OperationsContent = {
        operationType: validated.operationType,
        procedure: validated.procedure,
        steps: validated.steps,
        slaTarget: validated.slaTarget,
        requiresTraining: validated.requiresTraining,
      };

      drafts.push({
        itemType: "operations",
        title: validated.title,
        category: validated.category,
        content,
        rationale: `Generated from business operations configuration`,
      });
    } catch (error: any) {
      console.warn("Invalid operations draft:", error.message);
    }
  }

  return drafts;
}

/**
 * Generate proof of work requirement drafts
 */
async function generateProofOfWorkDrafts(business: any, businessServices: any[], userId: number): Promise<KnowledgeDraft[]> {
  const systemPrompt = `You are a quality assurance expert for lawn care businesses.
Generate proof of work requirements for service verification.

Business: ${business.name}
Services: ${businessServices.map(s => s.name).join(", ")}

Define evidence requirements for each service type to verify completion.`;

  const servicesData = businessServices.map(s => ({ name: s.name, category: s.category }));

  const userPrompt = `Generate proof of work requirement drafts as JSON array for services:
${JSON.stringify(servicesData, null, 2)}

Each requirement must include:
- title: Service name + " - Proof of Work"
- category: "proof_of_work"
- workType: service name
- requiredEvidence: array of [photos, gps_checkin, customer_signature, crew_notes, before_after_photos]
- photoRequirements: {minimumCount, requiredAngles, qualityStandards, maxFileSizeMB, acceptedFormats} (optional)
- autoApprovalCriteria: {enabled, confidenceThreshold, requiresQAReview} (optional)
- gpsAccuracyMeters: number (optional)

Return ONLY valid JSON array.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0].message.content || "{}";
  const parsed = JSON.parse(responseText);
  const powArray = parsed.requirements || [];

  const drafts: KnowledgeDraft[] = [];

  for (const powData of powArray) {
    try {
      const validated = ProofOfWorkDraftSchema.parse(powData);
      const content: ProofOfWorkContent = {
        workType: validated.workType,
        requiredEvidence: validated.requiredEvidence,
        photoRequirements: validated.photoRequirements,
        autoApprovalCriteria: validated.autoApprovalCriteria,
        gpsAccuracyMeters: validated.gpsAccuracyMeters,
      };

      drafts.push({
        itemType: "proof_of_work",
        title: validated.title,
        category: validated.category,
        content,
        appliesTo: {
          serviceTypes: [validated.workType],
        },
        rationale: `Generated from service configuration for quality assurance`,
      });
    } catch (error: any) {
      console.warn("Invalid proof of work draft:", error.message);
    }
  }

  return drafts;
}

/**
 * Generate macro template drafts
 */
async function generateMacroDrafts(business: any, userId: number): Promise<KnowledgeDraft[]> {
  const systemPrompt = `You are a customer support expert for lawn care businesses.
Generate support message templates (macros) for common customer interactions.

Business: ${business.name}

Create 5-8 essential macros for common scenarios like:
- Appointment confirmations
- Rescheduling
- Payment reminders
- Service completion notifications
- Weather delays`;

  const userPrompt = `Generate macro template drafts as JSON array. Each macro must include:
- title: Macro name
- category: "macros"
- intent: intent identifier (lowercase_with_underscores)
- shortcut: shortcut code (lowercase_with_underscores)
- subject: email subject (optional)
- body: template text with {{placeholder}} syntax (100-800 chars)
- placeholders: array of {key, description, required, defaultValue}
  - key: placeholder name (alphanumeric_with_underscores)
  - description: what this placeholder is for
  - required: boolean
  - defaultValue: default text (optional)
- availableChannels: array of [email, sms, in_app, push] (optional)

Return ONLY valid JSON array.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0].message.content || "{}";
  const parsed = JSON.parse(responseText);
  const macrosArray = parsed.macros || [];

  const drafts: KnowledgeDraft[] = [];

  for (const macroData of macrosArray) {
    try {
      const validated = MacroDraftSchema.parse(macroData);
      const content: MacroContent = {
        intent: validated.intent,
        shortcut: validated.shortcut,
        subject: validated.subject,
        body: validated.body,
        placeholders: validated.placeholders,
        requiresApproval: false,
        availableChannels: validated.availableChannels,
      };

      drafts.push({
        itemType: "macro",
        title: validated.title,
        category: validated.category,
        content,
        rationale: `Generated support template for common customer interactions`,
      });
    } catch (error: any) {
      console.warn("Invalid macro draft:", error.message);
    }
  }

  return drafts;
}

/**
 * Create knowledge draft in database
 */
async function createKnowledgeDraft(
  businessId: number,
  userId: number,
  draft: KnowledgeDraft
): Promise<{ knowledgeItemId: number; versionId: number; itemType: string; title: string; status: "draft" }> {
  // Generate slug
  const slug = draft.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 100);

  // Generate embedding for search
  const searchText = `${draft.title} ${JSON.stringify(draft.content)}`;
  const embedding = await generateEmbedding(searchText);

  // Create knowledge item
  const [knowledgeItem] = await db
    .insert(knowledgeItems)
    .values({
      businessId,
      itemType: draft.itemType,
      title: draft.title,
      slug,
      category: draft.category,
      status: "draft",
      appliesTo: draft.appliesTo || {},
      createdBy: userId,
      currentVersionId: null, // Will be set after version created
    })
    .returning();

  // Create version
  const [version] = await db
    .insert(knowledgeVersions)
    .values({
      knowledgeItemId: knowledgeItem.id,
      versionNumber: 1,
      content: draft.content,
      changeNotes: draft.rationale,
      embedding,
      createdBy: userId,
      status: "draft",
    })
    .returning();

  // Update knowledge item with current version
  await db
    .update(knowledgeItems)
    .set({ currentVersionId: version.id })
    .where(eq(knowledgeItems.id, knowledgeItem.id));

  await auditLog({
    businessId,
    userId,
    action: "knowledge_draft_created",
    entityType: "knowledge",
    entityId: knowledgeItem.id,
    metadata: {
      itemType: draft.itemType,
      title: draft.title,
      versionId: version.id,
      source: "builder_agent",
    },
  });

  return {
    knowledgeItemId: knowledgeItem.id,
    versionId: version.id,
    itemType: draft.itemType,
    title: draft.title,
    status: "draft",
  };
}
