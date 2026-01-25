// Coverage Detector Service
// Determines if PSKB has knowledge to answer customer queries
// Security: Multi-tenant isolation, confidence thresholds

import { searchKnowledge } from "../knowledge/search";
import { CONFIDENCE_THRESHOLDS } from "@shared/knowledge-types";
import { type CoverageResult, CoverageStatus } from "@shared/thread-enrichment-schema";

/**
 * Detect if PSKB has knowledge to cover this thread
 * @param businessId - Business ID for multi-tenant isolation
 * @param intent - Classified intent from intent classifier
 * @param query - Last message or thread summary
 * @param context - Optional context for scoped search
 * @returns Coverage result with matched knowledge and gaps
 */
export async function detectCoverage(
  businessId: number,
  intent: string,
  query: string,
  context?: {
    serviceType?: string;
    location?: string;
    customerTier?: string;
  }
): Promise<CoverageResult> {
  // Validation
  if (!businessId || businessId <= 0) {
    throw new Error("Valid businessId required");
  }

  if (!query || query.trim().length === 0) {
    throw new Error("Query text required");
  }

  try {
    // Search PSKB for relevant knowledge
    const searchResults = await searchKnowledge({
      businessId,
      query,
      appliesTo: context,
      limit: 5,
      minConfidence: CONFIDENCE_THRESHOLDS.LOW, // Cast wider net
    });

    if (searchResults.length === 0) {
      return {
        status: CoverageStatus.UNCOVERED,
        matchedKnowledgeItemIds: [],
        coverageGaps: [
          {
            topic: intent,
            reason: "no_matching_knowledge",
          },
        ],
        confidence: 0,
      };
    }

    // Categorize results by confidence
    const highConfidenceMatches = searchResults.filter(
      r => r.confidence >= CONFIDENCE_THRESHOLDS.HIGH
    );

    const mediumConfidenceMatches = searchResults.filter(
      r => r.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM &&
           r.confidence < CONFIDENCE_THRESHOLDS.HIGH
    );

    // High confidence = covered
    if (highConfidenceMatches.length > 0) {
      return {
        status: CoverageStatus.COVERED,
        matchedKnowledgeItemIds: highConfidenceMatches.map(r => r.knowledgeItemId),
        coverageGaps: [],
        confidence: highConfidenceMatches[0].confidence,
      };
    }

    // Medium confidence = partial coverage
    if (mediumConfidenceMatches.length > 0) {
      return {
        status: CoverageStatus.PARTIAL,
        matchedKnowledgeItemIds: mediumConfidenceMatches.map(r => r.knowledgeItemId),
        coverageGaps: [
          {
            topic: intent,
            reason: "low_confidence_match",
          },
        ],
        confidence: mediumConfidenceMatches[0].confidence,
      };
    }

    // Low confidence only = uncovered
    return {
      status: CoverageStatus.UNCOVERED,
      matchedKnowledgeItemIds: searchResults.map(r => r.knowledgeItemId),
      coverageGaps: [
        {
          topic: intent,
          reason: "insufficient_confidence",
        },
      ],
      confidence: searchResults[0]?.confidence || 0,
    };
  } catch (error: any) {
    console.error("Coverage detection failed:", error.message);

    // Fallback: mark as unknown
    return {
      status: CoverageStatus.UNKNOWN,
      matchedKnowledgeItemIds: [],
      coverageGaps: [
        {
          topic: intent,
          reason: `error: ${error.message}`,
        },
      ],
      confidence: 0,
    };
  }
}

/**
 * Detect coverage for specific intent types
 * Uses intent-specific search strategies
 */
export async function detectCoverageByIntent(
  businessId: number,
  intent: string,
  query: string
): Promise<CoverageResult> {
  // Map intents to knowledge categories
  const intentToCategoryMap: Record<string, string[]> = {
    price_inquiry: ["services", "billing"],
    reschedule_request: ["operations", "services"],
    cancellation_request: ["policies", "operations"],
    billing_dispute: ["billing", "policies"],
    payment_method_update: ["billing"],
    refund_request: ["policies", "billing"],
    service_quality_complaint: ["operations", "quality"],
    general_question: [], // Search all
  };

  const categories = intentToCategoryMap[intent];

  // If intent has specific categories, search those first
  if (categories && categories.length > 0) {
    const searchResults = await searchKnowledge({
      businessId,
      query,
      categories,
      limit: 3,
      minConfidence: CONFIDENCE_THRESHOLDS.MEDIUM,
    });

    if (searchResults.length > 0 && searchResults[0].confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
      return {
        status: CoverageStatus.COVERED,
        matchedKnowledgeItemIds: searchResults.map(r => r.knowledgeItemId),
        coverageGaps: [],
        confidence: searchResults[0].confidence,
      };
    }
  }

  // Fall back to general coverage detection
  return detectCoverage(businessId, intent, query);
}

/**
 * Suggest knowledge items to create for uncovered intents
 * @param businessId - Business ID
 * @param uncoveredIntents - Array of intents with occurrence counts
 * @returns Suggested knowledge items
 */
export async function suggestKnowledgeItems(
  businessId: number,
  uncoveredIntents: Array<{ intent: string; frequency: number; exampleQuery: string }>
): Promise<Array<{
  intent: string;
  suggestedItemType: string;
  suggestedCategory: string;
  suggestedTitle: string;
  priority: "high" | "medium" | "low";
}>> {
  const suggestions = [];

  for (const { intent, frequency, exampleQuery } of uncoveredIntents) {
    // Determine priority based on frequency
    const priority = frequency >= 10 ? "high" :
                     frequency >= 5 ? "medium" :
                     "low";

    // Map intent to suggested item type
    let itemType = "macro"; // Default
    let category = "support";
    let title = `${intent.replace(/_/g, " ")}`;

    if (intent.includes("policy") || intent.includes("refund") || intent.includes("cancellation")) {
      itemType = "policy";
      category = "policies";
      title = `${intent.replace(/_/g, " ")} policy`;
    } else if (intent.includes("price") || intent.includes("billing") || intent.includes("payment")) {
      itemType = "payment";
      category = "billing";
      title = `FAQ: ${title}`;
    } else if (intent.includes("service") || intent.includes("quality")) {
      itemType = "operations";
      category = "quality";
    }

    suggestions.push({
      intent,
      suggestedItemType: itemType,
      suggestedCategory: category,
      suggestedTitle: title,
      priority: priority as "high" | "medium" | "low",
    });
  }

  return suggestions;
}

/**
 * Analyze coverage trends over time
 * @param businessId - Business ID
 * @param days - Number of days to analyze
 * @returns Coverage statistics
 */
export async function analyzeCoverageTrends(
  businessId: number,
  days: number = 30
): Promise<{
  totalThreads: number;
  coveredCount: number;
  partialCount: number;
  uncoveredCount: number;
  coverageRate: number;
  topUncoveredIntents: Array<{ intent: string; count: number }>;
}> {
  // TODO: Implement coverage trend analysis
  // This would query thread_enrichment table for historical data

  return {
    totalThreads: 0,
    coveredCount: 0,
    partialCount: 0,
    uncoveredCount: 0,
    coverageRate: 0,
    topUncoveredIntents: [],
  };
}

/**
 * Check if specific knowledge item covers a query
 * @param knowledgeItemId - Knowledge item ID
 * @param businessId - Business ID
 * @param query - Query text
 * @returns Coverage check result
 */
export async function checkKnowledgeItemCoverage(
  knowledgeItemId: number,
  businessId: number,
  query: string
): Promise<{ covers: boolean; confidence: number }> {
  const searchResults = await searchKnowledge({
    businessId,
    query,
    limit: 10,
    minConfidence: 0,
  });

  const match = searchResults.find(r => r.knowledgeItemId === knowledgeItemId);

  return {
    covers: match ? match.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM : false,
    confidence: match?.confidence || 0,
  };
}

/**
 * Health check for coverage detection
 */
export async function testCoverageDetection(businessId: number): Promise<boolean> {
  try {
    const result = await detectCoverage(businessId, "test_intent", "test query");
    return result.status !== undefined;
  } catch {
    return false;
  }
}
