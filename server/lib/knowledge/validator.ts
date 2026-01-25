// Knowledge Content Validator
// Runtime validation and sanitization
// Security: Input validation, XSS prevention, business rule enforcement

import {
  validateKnowledgeContent,
  validateAndThrow,
  sanitizeKnowledgeContent,
  extractSearchableText,
  type KnowledgeItemTypeSchema,
} from "@shared/knowledge-types";
import { z } from "zod";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedContent?: any;
}

/**
 * Comprehensive validation of knowledge content
 * @param itemType - Type of knowledge item
 * @param content - Content to validate
 * @returns Validation result with errors, warnings, and sanitized content
 */
export function validateContent(itemType: string, content: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Step 1: Schema validation
  const schemaResult = validateKnowledgeContent(itemType, content);
  if (!schemaResult.success) {
    return {
      valid: false,
      errors: [schemaResult.error || "Schema validation failed"],
      warnings: [],
    };
  }

  // Step 2: Sanitization (XSS prevention)
  let sanitized: any;
  try {
    sanitized = sanitizeKnowledgeContent(content);
  } catch (error: any) {
    errors.push(`Sanitization failed: ${error.message}`);
    return { valid: false, errors, warnings };
  }

  // Step 3: Business rule validation
  const businessRuleErrors = validateBusinessRules(itemType, sanitized);
  errors.push(...businessRuleErrors);

  // Step 4: Quality checks (warnings only)
  const qualityWarnings = checkContentQuality(itemType, sanitized);
  warnings.push(...qualityWarnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitizedContent: sanitized,
  };
}

/**
 * Business rule validation
 * @param itemType - Type of knowledge item
 * @param content - Sanitized content
 * @returns Array of error messages
 */
function validateBusinessRules(itemType: string, content: any): string[] {
  const errors: string[] = [];

  switch (itemType) {
    case "policy":
      // Policy must have future effective date or current date
      const effectiveDate = new Date(content.effectiveDate);
      if (isNaN(effectiveDate.getTime())) {
        errors.push("Invalid effective date");
      }

      // Expiration date must be after effective date
      if (content.expirationDate) {
        const expirationDate = new Date(content.expirationDate);
        if (expirationDate <= effectiveDate) {
          errors.push("Expiration date must be after effective date");
        }
      }

      // Critical policies must require consent
      if (['refund', 'cancellation', 'liability'].includes(content.policyType) &&
          !content.requiresCustomerConsent) {
        errors.push(`${content.policyType} policy should require customer consent`);
      }
      break;

    case "service":
      // Pricing model validation
      if (content.pricingModel === "flat_rate" && !content.basePrice) {
        errors.push("Flat rate pricing requires a base price");
      }

      if (content.pricingModel === "per_sqft" && !content.basePrice) {
        errors.push("Per square foot pricing requires a base price");
      }

      // Frequency validation
      if (content.frequency === "seasonal" && !content.seasonalAvailability) {
        errors.push("Seasonal services must specify availability");
      }
      break;

    case "payment":
      // Payment answers must not contain specific dollar amounts (use placeholders)
      if (content.answer.match(/\$\d+/)) {
        errors.push("Payment answers should use placeholders like {{amount}} instead of specific dollar amounts");
      }
      break;

    case "operations":
      // Steps must be sequential
      const stepNumbers = content.steps.map((s: any) => s.stepNumber);
      const sorted = [...stepNumbers].sort((a: number, b: number) => a - b);
      if (JSON.stringify(stepNumbers) !== JSON.stringify(sorted)) {
        errors.push("Operation steps must be in sequential order");
      }

      // Check for duplicate step numbers
      const unique = new Set(stepNumbers);
      if (unique.size !== stepNumbers.length) {
        errors.push("Operation steps must have unique step numbers");
      }
      break;

    case "proof_of_work":
      // Photo requirements must be consistent
      if (content.requiredEvidence.includes("photos") && !content.photoRequirements) {
        errors.push("Photo evidence requires photoRequirements specification");
      }

      if (content.requiredEvidence.includes("before_after_photos") &&
          content.photoRequirements?.minimumCount < 2) {
        errors.push("Before/after photos require minimum 2 photos");
      }
      break;

    case "macro":
      // Body must contain all declared placeholders
      const placeholderKeys = content.placeholders.map((p: any) => p.key);
      const bodyPlaceholders = (content.body.match(/\{\{(\w+)\}\}/g) || [])
        .map(match => match.slice(2, -2));

      for (const key of placeholderKeys) {
        if (!bodyPlaceholders.includes(key)) {
          errors.push(`Declared placeholder {{${key}}} not used in body`);
        }
      }

      for (const key of bodyPlaceholders) {
        if (!placeholderKeys.includes(key)) {
          errors.push(`Placeholder {{${key}}} in body not declared in placeholders array`);
        }
      }

      // Required placeholders must have no default value
      for (const placeholder of content.placeholders) {
        if (placeholder.required && placeholder.defaultValue) {
          errors.push(`Required placeholder ${placeholder.key} cannot have a default value`);
        }
      }
      break;
  }

  return errors;
}

/**
 * Content quality checks (non-blocking warnings)
 * @param itemType - Type of knowledge item
 * @param content - Sanitized content
 * @returns Array of warning messages
 */
function checkContentQuality(itemType: string, content: any): string[] {
  const warnings: string[] = [];

  // Check for common quality issues
  const searchableText = extractSearchableText(itemType, content);

  // Warning: Content too short
  if (searchableText.length < 100) {
    warnings.push("Content may be too brief for effective search");
  }

  // Warning: No examples or scenarios (for payment/operations)
  if (itemType === "payment" && !content.exampleScenarios?.length) {
    warnings.push("Consider adding example scenarios for better customer understanding");
  }

  if (itemType === "operations" && !content.escalationCriteria) {
    warnings.push("Consider adding escalation criteria for this procedure");
  }

  // Warning: Service has no upsell recommendations
  if (itemType === "service" && !content.upsellServices?.length) {
    warnings.push("Consider adding upsell service recommendations");
  }

  // Warning: Macro has no tags
  if (itemType === "macro" && !content.tags?.length) {
    warnings.push("Consider adding tags for easier discovery");
  }

  // Warning: Policy has no legal references
  if (itemType === "policy" && content.policyType === "liability" && !content.legalReferences?.length) {
    warnings.push("Liability policies should reference applicable laws or regulations");
  }

  // Check for spelling/grammar issues (basic)
  const commonTypos = [
    /\bthe\s+the\b/i,
    /\byou\s+you\b/i,
    /\band\s+and\b/i,
    /\bor\s+or\b/i,
  ];

  for (const pattern of commonTypos) {
    if (pattern.test(searchableText)) {
      warnings.push("Possible duplicate word detected");
      break;
    }
  }

  return warnings;
}

/**
 * Validate slug format
 * @param slug - Slug to validate
 * @returns True if valid
 */
export function validateSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 3 && slug.length <= 100;
}

/**
 * Generate slug from title
 * @param title - Title to convert
 * @returns URL-safe slug
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')         // Spaces to hyphens
    .replace(/-+/g, '-')          // Collapse multiple hyphens
    .replace(/^-|-$/g, '')        // Trim hyphens
    .substring(0, 100);           // Max length
}

/**
 * Validate applies-to scope
 * @param appliesTo - Scope object
 * @returns True if valid
 */
export function validateAppliesTo(appliesTo: any): boolean {
  if (!appliesTo || typeof appliesTo !== 'object') {
    return false;
  }

  // Must have at least one constraint
  const hasConstraints = Boolean(
    appliesTo.serviceTypes?.length ||
    appliesTo.locations?.length ||
    appliesTo.customerTiers?.length
  );

  return hasConstraints;
}

/**
 * Check if user has permission to perform action
 * @param userRole - User's role
 * @param action - Action to perform
 * @returns True if permitted
 */
export function checkPermission(userRole: string, action: "create" | "edit" | "submit" | "approve" | "publish" | "retire"): boolean {
  const permissions: Record<string, string[]> = {
    owner: ["create", "edit", "submit", "approve", "publish", "retire"],
    admin: ["create", "edit", "submit", "approve", "publish", "retire"],
    staff: ["create", "edit", "submit"],
    crew_lead: [],
    crew_member: [],
    customer: [],
  };

  return permissions[userRole]?.includes(action) || false;
}

/**
 * Sanitize user input for display
 * @param input - User input
 * @returns Sanitized string
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Encode special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return sanitized;
}

/**
 * Rate limit check for knowledge operations
 * Simple in-memory implementation (use Redis in production)
 */
const operationLimits = new Map<string, number[]>();

export function checkOperationRateLimit(
  userId: number,
  operation: string,
  maxOps: number = 10,
  windowMs: number = 60000
): boolean {
  const key = `${userId}:${operation}`;
  const now = Date.now();

  let timestamps = operationLimits.get(key) || [];
  timestamps = timestamps.filter(ts => now - ts < windowMs);

  if (timestamps.length >= maxOps) {
    return false;
  }

  timestamps.push(now);
  operationLimits.set(key, timestamps);
  return true;
}

export { validateAndThrow };
