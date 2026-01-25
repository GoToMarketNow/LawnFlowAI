// Citation Validator
// Security: Enforces that all assistant responses include valid citations
// Fail-closed: No citations = escalate to human

import { type Citation } from "@shared/assistant-schema";
import { getKnowledgeItemById } from "../knowledge/search";

/**
 * Validate that response has required citations
 * @param response - Assistant response text
 * @param citations - Array of citations
 * @returns Validation result
 */
export function validateCitations(
  response: string,
  citations: Citation[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Rule 1: Response must have at least one citation (unless it's a clarifying question)
  if (citations.length === 0 && !isClariifyingQuestion(response)) {
    errors.push("Response must include at least one citation from knowledge base");
  }

  // Rule 2: Response must reference citation IDs
  if (citations.length > 0) {
    const citationPattern = /KB-(\d+)v(\d+)/g;
    const matches = response.match(citationPattern);

    if (!matches) {
      errors.push("Response must include citation markers (e.g., KB-123v1) when citing knowledge");
    } else {
      // Rule 3: All citations must be referenced in response
      for (const citation of citations) {
        const citationMarker = `KB-${citation.knowledgeItemId}v${citation.versionId}`;
        if (!response.includes(citationMarker)) {
          errors.push(`Citation ${citationMarker} provided but not referenced in response`);
        }
      }
    }
  }

  // Rule 4: All citation IDs in response must be in citations array
  const citationMarkers = response.match(/KB-(\d+)v(\d+)/g) || [];
  for (const marker of citationMarkers) {
    const match = marker.match(/KB-(\d+)v(\d+)/);
    if (match) {
      const itemId = parseInt(match[1]);
      const versionId = parseInt(match[2]);

      const found = citations.find(
        c => c.knowledgeItemId === itemId && c.versionId === versionId
      );

      if (!found) {
        errors.push(`Citation ${marker} referenced but not provided in citations array`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if response is a clarifying question (doesn't need citations)
 * @param response - Response text
 * @returns True if it's a clarifying question
 */
function isClariifyingQuestion(response: string): boolean {
  const clarifyingPatterns = [
    /could you (?:please )?(?:clarify|specify|provide more details)/i,
    /which (?:specific |particular )?(?:job|service|date|location)/i,
    /can you (?:please )?(?:confirm|verify|tell me)/i,
    /do you (?:mean|want|need)/i,
    /are you (?:asking|referring|talking) about/i,
  ];

  return clarifyingPatterns.some(pattern => pattern.test(response));
}

/**
 * Verify that citations reference valid, published knowledge
 * @param citations - Array of citations
 * @param businessId - Business ID for security check
 * @returns Validation result with invalid citations
 */
export async function verifyCitationsExist(
  citations: Citation[],
  businessId: number
): Promise<{ valid: boolean; invalidCitations: Citation[] }> {
  const invalidCitations: Citation[] = [];

  for (const citation of citations) {
    try {
      // Check if knowledge item exists and is published
      const knowledgeItem = await getKnowledgeItemById(
        citation.knowledgeItemId,
        businessId
      );

      if (!knowledgeItem) {
        invalidCitations.push(citation);
      } else if (knowledgeItem.versionId !== citation.versionId) {
        // Version mismatch
        invalidCitations.push(citation);
      }
    } catch (error) {
      invalidCitations.push(citation);
    }
  }

  return {
    valid: invalidCitations.length === 0,
    invalidCitations,
  };
}

/**
 * Format citations for display
 * @param citations - Array of citations
 * @returns Formatted citation string
 */
export function formatCitations(citations: Citation[]): string {
  if (citations.length === 0) {
    return "";
  }

  const formatted = citations.map((c, i) => {
    const marker = `KB-${c.knowledgeItemId}v${c.versionId}`;
    return `[${i + 1}] ${c.title} (${marker})`;
  });

  return `\n\n**Sources:**\n${formatted.join("\n")}`;
}

/**
 * Format citations for inline display (compact)
 * @param citations - Array of citations
 * @returns Compact citation string
 */
export function formatCitationsInline(citations: Citation[]): string {
  if (citations.length === 0) {
    return "";
  }

  const markers = citations.map(c => `KB-${c.knowledgeItemId}v${c.versionId}`);
  return ` (Sources: ${markers.join(", ")})`;
}

/**
 * Extract citation IDs from response text
 * @param response - Response text
 * @returns Array of {knowledgeItemId, versionId}
 */
export function extractCitationIds(response: string): Array<{ knowledgeItemId: number; versionId: number }> {
  const citationPattern = /KB-(\d+)v(\d+)/g;
  const matches = [...response.matchAll(citationPattern)];

  return matches.map(match => ({
    knowledgeItemId: parseInt(match[1]),
    versionId: parseInt(match[2]),
  }));
}

/**
 * Add citations to response if missing
 * @param response - Response text
 * @param citations - Array of citations
 * @returns Response with citations appended
 */
export function ensureCitations(response: string, citations: Citation[]): string {
  // Check if citations already formatted
  if (response.includes("**Sources:**")) {
    return response;
  }

  // Append citations footer
  return response + formatCitations(citations);
}

/**
 * Create citation object from knowledge search result
 * @param searchResult - Knowledge search result
 * @returns Citation object
 */
export function createCitationFromSearchResult(searchResult: {
  knowledgeItemId: number;
  versionId: number;
  title: string;
  contentText: string;
}): Citation {
  // Extract excerpt (first 200 chars)
  const excerpt = searchResult.contentText.substring(0, 200).trim() + "...";

  return {
    knowledgeItemId: searchResult.knowledgeItemId,
    versionId: searchResult.versionId,
    title: searchResult.title,
    excerpt,
  };
}

/**
 * Validate and enforce citations (fail-closed)
 * @param response - Assistant response
 * @param citations - Citations array
 * @param businessId - Business ID
 * @returns Validation result with escalation flag
 */
export async function enforcecitations(
  response: string,
  citations: Citation[],
  businessId: number
): Promise<{
  valid: boolean;
  errors: string[];
  shouldEscalate: boolean;
  escalationReason?: string;
}> {
  // Step 1: Validate citation format
  const formatValidation = validateCitations(response, citations);

  if (!formatValidation.valid) {
    return {
      valid: false,
      errors: formatValidation.errors,
      shouldEscalate: true,
      escalationReason: "Citation validation failed: " + formatValidation.errors.join("; "),
    };
  }

  // Step 2: Verify citations exist and are valid
  const existenceValidation = await verifyCitationsExist(citations, businessId);

  if (!existenceValidation.valid) {
    return {
      valid: false,
      errors: [`Invalid citations: ${existenceValidation.invalidCitations.map(c => `KB-${c.knowledgeItemId}v${c.versionId}`).join(", ")}`],
      shouldEscalate: true,
      escalationReason: "Citations reference non-existent or unpublished knowledge",
    };
  }

  return {
    valid: true,
    errors: [],
    shouldEscalate: false,
  };
}

/**
 * Create fallback response when citations are missing
 * @returns Safe fallback response
 */
export function createCitationFailureResponse(): {
  content: string;
  requiresApproval: boolean;
  suggestedActions: Array<{ type: string; description: string; payload: any }>;
} {
  return {
    content: "I apologize, but I cannot provide a definitive answer to that question based on our current knowledge base. Let me connect you with a team member who can help you directly.",
    requiresApproval: true,
    suggestedActions: [
      {
        type: "escalate_to_ops",
        description: "Escalate to operations team",
        payload: {
          reason: "citation_validation_failed",
          priority: "normal",
        },
      },
    ],
  };
}

/**
 * Health check for citation validator
 */
export function testCitationValidator(): boolean {
  try {
    // Test basic validation
    const result = validateCitations(
      "According to our policy KB-1v1, refunds are available within 30 days.",
      [{ knowledgeItemId: 1, versionId: 1, title: "Refund Policy" }]
    );
    return result.valid;
  } catch {
    return false;
  }
}
