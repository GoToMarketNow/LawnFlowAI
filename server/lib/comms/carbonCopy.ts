// Carbon Copy Guardrails
// Sanitizes internal crew/ops messages before sharing with customers
// Prevents sensitive information leakage (pricing, crew names, internal notes)

import { db } from "../../db";
import { commsMessages, users } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";
import { auditLog } from "../audit";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Content types that should be removed
export type SensitiveContentType =
  | "internal_notes"
  | "crew_names"
  | "pricing_details"
  | "internal_costs"
  | "profit_margins"
  | "customer_complaints"
  | "technical_jargon"
  | "system_ids"
  | "personal_info";

export interface SanitizationOptions {
  removeAllInternalNotes?: boolean;
  preserveCustomerFacingInfo?: boolean;
  replacementStrategy?: "remove" | "replace" | "generalize";
  approvalRequired?: boolean;
}

export interface SanitizationResult {
  success: boolean;
  sanitizedMessage: string;
  originalMessage: string;
  removedContentTypes: SensitiveContentType[];
  changes: Array<{
    type: SensitiveContentType;
    original: string;
    replacement: string;
    reason: string;
  }>;
  requiresApproval: boolean;
  confidence: number; // 0-1, how confident AI is in sanitization
  warnings: string[];
}

/**
 * Sanitize message for customer viewing
 */
export async function sanitizeForCustomer(
  originalMessage: string,
  options: SanitizationOptions = {}
): Promise<SanitizationResult> {
  const replacementStrategy = options.replacementStrategy || "generalize";

  // Build sanitization prompt
  const systemPrompt = `You are a message sanitization expert for lawn care businesses.
Your job is to remove or generalize sensitive internal information before messages are shared with customers.

SENSITIVE CONTENT TO REMOVE/GENERALIZE:
1. Internal Notes: Anything marked as (internal), [private], or clearly internal discussion
2. Crew Names: First and last names of crew members (replace with "our team" or "your service technician")
3. Pricing Details: Internal costs, markup percentages, profit margins
4. Customer Complaints: References to other customers or their issues
5. Technical Jargon: Internal codes, system IDs, technical terminology customers won't understand
6. Personal Info: Phone numbers, addresses, emails of crew members
7. Internal Costs: Fuel costs, equipment costs, labor costs
8. Profit Margins: Any discussion of profitability or margins

REPLACEMENT STRATEGY: "${replacementStrategy}"
- "remove": Simply remove sensitive content
- "replace": Replace with neutral placeholder like "[redacted]"
- "generalize": Replace with customer-friendly generalized version

PRESERVE:
- Job status updates
- Service quality information
- Schedule changes
- Weather delays
- Customer-facing explanations

Return a sanitized version that is professional and customer-appropriate.`;

  const userPrompt = `Sanitize this message for customer viewing:

"""
${originalMessage}
"""

Return JSON with:
{
  "sanitizedMessage": "the cleaned message",
  "removedContentTypes": ["internal_notes", "crew_names", ...],
  "changes": [
    {
      "type": "crew_names",
      "original": "John Smith",
      "replacement": "your service technician",
      "reason": "Crew member name removed for privacy"
    }
  ],
  "requiresApproval": boolean (true if significant changes made),
  "confidence": 0.0-1.0 (how confident you are),
  "warnings": ["any concerns about this message"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for consistent sanitization
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0].message.content || "{}";
    const parsed = JSON.parse(responseText);

    // Validate response structure
    const result: SanitizationResult = {
      success: true,
      sanitizedMessage: parsed.sanitizedMessage || originalMessage,
      originalMessage,
      removedContentTypes: parsed.removedContentTypes || [],
      changes: parsed.changes || [],
      requiresApproval: parsed.requiresApproval || false,
      confidence: parsed.confidence || 0.5,
      warnings: parsed.warnings || [],
    };

    // Additional safety checks
    if (options.approvalRequired) {
      result.requiresApproval = true;
    }

    // If low confidence, require approval
    if (result.confidence < 0.7) {
      result.requiresApproval = true;
      result.warnings.push("Low confidence in sanitization, human review recommended");
    }

    // Check if message is mostly removed (red flag)
    if (result.sanitizedMessage.length < originalMessage.length * 0.3) {
      result.requiresApproval = true;
      result.warnings.push(
        "Message heavily sanitized (>70% removed), verify customer will understand context"
      );
    }

    return result;
  } catch (error: any) {
    console.error("Sanitization failed:", error);

    // Fail-safe: if AI sanitization fails, require manual approval
    return {
      success: false,
      sanitizedMessage: originalMessage,
      originalMessage,
      removedContentTypes: [],
      changes: [],
      requiresApproval: true,
      confidence: 0,
      warnings: [`AI sanitization failed: ${error.message}. Manual review required.`],
    };
  }
}

/**
 * Create carbon-copy message (forward to customer with sanitization)
 */
export async function createCarbonCopy(
  originalMessageId: number,
  targetCustomerPhone: string,
  sanitizedBy: number,
  businessId: number,
  options: SanitizationOptions = {}
): Promise<{
  success: boolean;
  sanitizedMessageId?: number;
  requiresApproval?: boolean;
  error?: string;
  sanitizationResult?: SanitizationResult;
}> {
  try {
    // Fetch original message
    const originalMessage = await db.query.commsMessages.findFirst({
      where: eq(commsMessages.id, originalMessageId),
    });

    if (!originalMessage) {
      return { success: false, error: "Original message not found" };
    }

    // Sanitize message
    const sanitizationResult = await sanitizeForCustomer(originalMessage.body, options);

    if (!sanitizationResult.success) {
      return {
        success: false,
        requiresApproval: true,
        error: "Sanitization failed, manual review required",
        sanitizationResult,
      };
    }

    // If requires approval, don't send yet
    if (sanitizationResult.requiresApproval) {
      return {
        success: true,
        requiresApproval: true,
        sanitizationResult,
      };
    }

    // Create sanitized message record
    const [sanitizedMessage] = await db
      .insert(commsMessages)
      .values({
        threadId: originalMessage.threadId,
        direction: "OUTBOUND",
        channel: "SMS",
        body: sanitizationResult.sanitizedMessage,
        // @ts-ignore - Extended schema
        sanitizedForCustomer: true,
        originalMessageId: originalMessageId,
      })
      .returning();

    // Log sanitization
    await db.execute(sql`
      INSERT INTO message_sanitization_log (
        original_message_id,
        sanitized_message_id,
        sanitization_type,
        removed_content_types,
        sanitized_by
      ) VALUES (
        ${originalMessageId},
        ${sanitizedMessage.id},
        'carbon_copy',
        ${sanitizationResult.removedContentTypes}::text[],
        ${sanitizedBy}
      )
    `);

    await auditLog({
      businessId,
      userId: sanitizedBy,
      action: "message_sanitized",
      entityType: "comms_message",
      entityId: sanitizedMessage.id,
      metadata: {
        originalMessageId,
        removedContentTypes: sanitizationResult.removedContentTypes,
        confidence: sanitizationResult.confidence,
        changesCount: sanitizationResult.changes.length,
      },
    });

    return {
      success: true,
      sanitizedMessageId: sanitizedMessage.id,
      requiresApproval: false,
      sanitizationResult,
    };
  } catch (error: any) {
    console.error("Carbon copy failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Approve sanitized message and send to customer
 */
export async function approveSanitizedMessage(
  sanitizationLogId: number,
  approvedBy: number,
  businessId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch sanitization log
    const logResult = await db.execute(sql`
      SELECT * FROM message_sanitization_log WHERE id = ${sanitizationLogId}
    `);

    // @ts-ignore
    if (logResult.rows.length === 0) {
      return { success: false, error: "Sanitization log not found" };
    }

    // Update approval
    await db.execute(sql`
      UPDATE message_sanitization_log
      SET approved_by = ${approvedBy},
          approved_at = CURRENT_TIMESTAMP
      WHERE id = ${sanitizationLogId}
    `);

    await auditLog({
      businessId,
      userId: approvedBy,
      action: "sanitized_message_approved",
      entityType: "sanitization_log",
      entityId: sanitizationLogId,
      metadata: {},
    });

    return { success: true };
  } catch (error: any) {
    console.error("Approval failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Batch sanitize multiple messages
 */
export async function batchSanitize(
  messageIds: number[],
  options: SanitizationOptions = {}
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  requiresApproval: number;
  results: Array<{
    messageId: number;
    success: boolean;
    requiresApproval: boolean;
    sanitizationResult?: SanitizationResult;
  }>;
}> {
  const results = [];
  let succeeded = 0;
  let failed = 0;
  let requiresApproval = 0;

  for (const messageId of messageIds) {
    const message = await db.query.commsMessages.findFirst({
      where: eq(commsMessages.id, messageId),
    });

    if (!message) {
      results.push({
        messageId,
        success: false,
        requiresApproval: false,
      });
      failed++;
      continue;
    }

    const sanitizationResult = await sanitizeForCustomer(message.body, options);

    if (!sanitizationResult.success) {
      results.push({
        messageId,
        success: false,
        requiresApproval: true,
        sanitizationResult,
      });
      failed++;
      requiresApproval++;
    } else if (sanitizationResult.requiresApproval) {
      results.push({
        messageId,
        success: true,
        requiresApproval: true,
        sanitizationResult,
      });
      requiresApproval++;
    } else {
      results.push({
        messageId,
        success: true,
        requiresApproval: false,
        sanitizationResult,
      });
      succeeded++;
    }
  }

  return {
    total: messageIds.length,
    succeeded,
    failed,
    requiresApproval,
    results,
  };
}

/**
 * Detect if message contains sensitive content (pre-check)
 */
export async function detectSensitiveContent(
  message: string
): Promise<{
  hasSensitiveContent: boolean;
  detectedTypes: SensitiveContentType[];
  confidence: number;
}> {
  const systemPrompt = `You are a sensitive content detector for lawn care business messages.
Analyze the message and identify if it contains any sensitive internal information that should not be shared with customers.

SENSITIVE CONTENT TYPES:
- internal_notes: Internal discussion or notes
- crew_names: Names of crew members
- pricing_details: Internal pricing or costs
- internal_costs: Equipment, fuel, labor costs
- profit_margins: Profitability discussion
- customer_complaints: References to other customers
- technical_jargon: Internal codes or technical terms
- system_ids: Database IDs or system identifiers
- personal_info: Phone numbers, addresses of staff

Return JSON with quick assessment.`;

  const userPrompt = `Analyze this message:

"""
${message}
"""

Return JSON:
{
  "hasSensitiveContent": boolean,
  "detectedTypes": ["type1", "type2"],
  "confidence": 0.0-1.0
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use faster model for detection
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0].message.content || "{}";
    const parsed = JSON.parse(responseText);

    return {
      hasSensitiveContent: parsed.hasSensitiveContent || false,
      detectedTypes: parsed.detectedTypes || [],
      confidence: parsed.confidence || 0.5,
    };
  } catch (error: any) {
    console.error("Detection failed:", error);
    // Fail-safe: assume sensitive if detection fails
    return {
      hasSensitiveContent: true,
      detectedTypes: [],
      confidence: 0,
    };
  }
}

/**
 * Generate customer-friendly version of crew message
 * Use case: Crew sends "Job done, looks good", transform to professional customer message
 */
export async function professionalizeCrewMessage(
  crewMessage: string,
  jobContext?: {
    serviceType?: string;
    customerName?: string;
    jobAddress?: string;
  }
): Promise<{
  professionalMessage: string;
  originalMessage: string;
  improvements: string[];
}> {
  const systemPrompt = `You are a professional communication expert for lawn care businesses.
Transform casual crew messages into polished, professional customer-facing messages.

IMPROVEMENTS TO MAKE:
- Add professional greeting if missing
- Expand abbreviations (e.g., "ur" → "your")
- Fix grammar and spelling
- Add context where helpful
- Maintain friendly but professional tone
- Add closing if appropriate

PRESERVE:
- The core message and intent
- Any specific details or measurements
- Time references
- Status updates

Context:
${jobContext ? JSON.stringify(jobContext, null, 2) : "No additional context"}`;

  const userPrompt = `Transform this crew message into a professional customer message:

"""
${crewMessage}
"""

Return JSON:
{
  "professionalMessage": "the improved message",
  "originalMessage": "the input",
  "improvements": ["list of improvements made"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0].message.content || "{}";
    const parsed = JSON.parse(responseText);

    return {
      professionalMessage: parsed.professionalMessage || crewMessage,
      originalMessage: crewMessage,
      improvements: parsed.improvements || [],
    };
  } catch (error: any) {
    console.error("Professionalization failed:", error);
    return {
      professionalMessage: crewMessage,
      originalMessage: crewMessage,
      improvements: [],
    };
  }
}

// Import sql for database queries
import { sql } from "drizzle-orm";
