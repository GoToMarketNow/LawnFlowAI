// Knowledge Search Service
// Hybrid search: semantic (vector) + full-text (PostgreSQL)
// Security: Multi-tenant isolation, published-only results, permission checks

import { db } from "../../db";
import { knowledgeItems, knowledgeVersions } from "@shared/knowledge-schema";
import { sql, and, eq, gte, isNull, inArray } from "drizzle-orm";
import { generateEmbedding } from "./embeddings";
import { CONFIDENCE_THRESHOLDS } from "@shared/knowledge-types";

export interface SearchOptions {
  businessId: number;
  query: string;
  itemTypes?: string[];
  categories?: string[];
  appliesTo?: {
    serviceType?: string;
    location?: string;
    customerTier?: string;
  };
  limit?: number;
  offset?: number;
  minConfidence?: number;
  includeRetired?: boolean;
}

export interface SearchResult {
  knowledgeItemId: number;
  versionId: number;
  title: string;
  slug: string;
  itemType: string;
  category: string;
  contentJson: any;
  contentText: string;
  confidence: number;
  matchType: "semantic" | "keyword" | "hybrid" | "exact";
  matchedTerms?: string[];
  publishedAt: Date | null;
  lastVerifiedAt: Date | null;
}

/**
 * Hybrid search combining semantic and keyword matching
 * Security: Only returns published knowledge for the specified business
 * @param options - Search parameters
 * @returns Array of search results sorted by confidence
 */
export async function searchKnowledge(options: SearchOptions): Promise<SearchResult[]> {
  const {
    businessId,
    query,
    itemTypes,
    categories,
    appliesTo,
    limit = 10,
    offset = 0,
    minConfidence = CONFIDENCE_THRESHOLDS.LOW,
    includeRetired = false,
  } = options;

  // Validation
  if (!businessId || businessId <= 0) {
    throw new Error("Valid businessId required");
  }

  if (!query || query.trim().length === 0) {
    throw new Error("Search query required");
  }

  if (limit > 100) {
    throw new Error("Maximum limit is 100 results");
  }

  // Generate query embedding for semantic search
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch (error: any) {
    console.warn("Embedding generation failed, falling back to keyword search:", error.message);
  }

  // Build filters
  const filters: any[] = [
    eq(knowledgeItems.businessId, businessId),
    eq(knowledgeItems.status, "published"),
  ];

  if (!includeRetired) {
    filters.push(isNull(knowledgeVersions.retiredAt));
  }

  if (itemTypes && itemTypes.length > 0) {
    filters.push(inArray(knowledgeItems.itemType, itemTypes as any));
  }

  if (categories && categories.length > 0) {
    filters.push(inArray(knowledgeItems.category, categories as any));
  }

  // Applies-to scoping (JSONB filter)
  if (appliesTo?.serviceType) {
    filters.push(sql`${knowledgeItems.appliesTo}->>'serviceTypes' @> ${JSON.stringify([appliesTo.serviceType])}`);
  }

  if (appliesTo?.location) {
    filters.push(sql`${knowledgeItems.appliesTo}->>'locations' @> ${JSON.stringify([appliesTo.location])}`);
  }

  if (appliesTo?.customerTier) {
    filters.push(sql`${knowledgeItems.appliesTo}->>'customerTiers' @> ${JSON.stringify([appliesTo.customerTier])}`);
  }

  // Execute hybrid search query
  const results = await db.execute(sql`
    SELECT
      ki.id as knowledge_item_id,
      kv.id as version_id,
      ki.title,
      ki.slug,
      ki.item_type,
      ki.category,
      kv.content_json,
      kv.content_text,
      kv.published_at,
      kv.last_verified_at,
      ${queryEmbedding
        ? sql`(1 - (kv.content_embedding <=> ${formatVector(queryEmbedding)}::vector)) as semantic_score`
        : sql`0 as semantic_score`
      },
      ts_rank(
        to_tsvector('english', kv.content_text),
        plainto_tsquery('english', ${query})
      ) as keyword_score,
      ${queryEmbedding
        ? sql`(
            (1 - (kv.content_embedding <=> ${formatVector(queryEmbedding)}::vector)) * 0.7 +
            ts_rank(to_tsvector('english', kv.content_text), plainto_tsquery('english', ${query})) * 0.3
          ) as confidence`
        : sql`ts_rank(to_tsvector('english', kv.content_text), plainto_tsquery('english', ${query})) as confidence`
      },
      ts_headline(
        'english',
        kv.content_text,
        plainto_tsquery('english', ${query}),
        'MaxWords=20, MinWords=10, MaxFragments=1'
      ) as headline
    FROM knowledge_items ki
    JOIN knowledge_versions kv ON ki.current_version_id = kv.id
    WHERE ${sql.join(filters, sql` AND `)}
      AND kv.published_at IS NOT NULL
      ${queryEmbedding
        ? sql`AND ((1 - (kv.content_embedding <=> ${formatVector(queryEmbedding)}::vector)) >= ${minConfidence}
               OR ts_rank(to_tsvector('english', kv.content_text), plainto_tsquery('english', ${query})) > 0)`
        : sql`AND ts_rank(to_tsvector('english', kv.content_text), plainto_tsquery('english', ${query})) > 0`
      }
    ORDER BY confidence DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  // Map results
  return (results.rows as any[]).map((row) => ({
    knowledgeItemId: row.knowledge_item_id,
    versionId: row.version_id,
    title: row.title,
    slug: row.slug,
    itemType: row.item_type,
    category: row.category,
    contentJson: row.content_json,
    contentText: row.content_text,
    confidence: parseFloat(row.confidence || 0),
    matchType: determineMatchType(
      parseFloat(row.semantic_score || 0),
      parseFloat(row.keyword_score || 0)
    ),
    publishedAt: row.published_at,
    lastVerifiedAt: row.last_verified_at,
  }));
}

/**
 * Get exact knowledge item by ID
 * Security: Verifies business ownership and published status
 * @param itemId - Knowledge item ID
 * @param businessId - Business ID for security check
 * @returns Search result or null
 */
export async function getKnowledgeItemById(
  itemId: number,
  businessId: number
): Promise<SearchResult | null> {
  const results = await db
    .select({
      knowledgeItemId: knowledgeItems.id,
      versionId: knowledgeVersions.id,
      title: knowledgeItems.title,
      slug: knowledgeItems.slug,
      itemType: knowledgeItems.itemType,
      category: knowledgeItems.category,
      contentJson: knowledgeVersions.contentJson,
      contentText: knowledgeVersions.contentText,
      publishedAt: knowledgeVersions.publishedAt,
      lastVerifiedAt: knowledgeVersions.lastVerifiedAt,
    })
    .from(knowledgeItems)
    .innerJoin(
      knowledgeVersions,
      eq(knowledgeItems.currentVersionId, knowledgeVersions.id)
    )
    .where(
      and(
        eq(knowledgeItems.id, itemId),
        eq(knowledgeItems.businessId, businessId),
        eq(knowledgeItems.status, "published"),
        isNull(knowledgeVersions.retiredAt)
      )
    )
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  const item = results[0];

  return {
    knowledgeItemId: item.knowledgeItemId,
    versionId: item.versionId,
    title: item.title,
    slug: item.slug,
    itemType: item.itemType,
    category: item.category,
    contentJson: item.contentJson,
    contentText: item.contentText,
    confidence: 1.0, // Exact match
    matchType: "exact",
    publishedAt: item.publishedAt,
    lastVerifiedAt: item.lastVerifiedAt,
  };
}

/**
 * Find knowledge by slug
 * @param slug - Knowledge item slug
 * @param businessId - Business ID
 * @returns Search result or null
 */
export async function getKnowledgeBySlug(
  slug: string,
  businessId: number
): Promise<SearchResult | null> {
  const results = await db
    .select({
      knowledgeItemId: knowledgeItems.id,
      versionId: knowledgeVersions.id,
      title: knowledgeItems.title,
      slug: knowledgeItems.slug,
      itemType: knowledgeItems.itemType,
      category: knowledgeItems.category,
      contentJson: knowledgeVersions.contentJson,
      contentText: knowledgeVersions.contentText,
      publishedAt: knowledgeVersions.publishedAt,
      lastVerifiedAt: knowledgeVersions.lastVerifiedAt,
    })
    .from(knowledgeItems)
    .innerJoin(
      knowledgeVersions,
      eq(knowledgeItems.currentVersionId, knowledgeVersions.id)
    )
    .where(
      and(
        eq(knowledgeItems.slug, slug),
        eq(knowledgeItems.businessId, businessId),
        eq(knowledgeItems.status, "published")
      )
    )
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  const item = results[0];

  return {
    knowledgeItemId: item.knowledgeItemId,
    versionId: item.versionId,
    title: item.title,
    slug: item.slug,
    itemType: item.itemType,
    category: item.category,
    contentJson: item.contentJson,
    contentText: item.contentText,
    confidence: 1.0,
    matchType: "exact",
    publishedAt: item.publishedAt,
    lastVerifiedAt: item.lastVerifiedAt,
  };
}

/**
 * Get related knowledge items
 * @param itemId - Base knowledge item ID
 * @param businessId - Business ID
 * @param limit - Maximum results
 * @returns Array of related items
 */
export async function getRelatedKnowledge(
  itemId: number,
  businessId: number,
  limit: number = 5
): Promise<SearchResult[]> {
  // Get base item embedding
  const baseItem = await db
    .select({
      contentEmbedding: knowledgeVersions.contentEmbedding,
      category: knowledgeItems.category,
      itemType: knowledgeItems.itemType,
    })
    .from(knowledgeItems)
    .innerJoin(
      knowledgeVersions,
      eq(knowledgeItems.currentVersionId, knowledgeVersions.id)
    )
    .where(eq(knowledgeItems.id, itemId))
    .limit(1);

  if (baseItem.length === 0 || !baseItem[0].contentEmbedding) {
    return [];
  }

  const embedding = baseItem[0].contentEmbedding;

  // Find similar items (same category preferred)
  const results = await db.execute(sql`
    SELECT
      ki.id as knowledge_item_id,
      kv.id as version_id,
      ki.title,
      ki.slug,
      ki.item_type,
      ki.category,
      kv.content_json,
      kv.content_text,
      kv.published_at,
      kv.last_verified_at,
      (1 - (kv.content_embedding <=> ${formatVector(embedding as any)}::vector)) as confidence
    FROM knowledge_items ki
    JOIN knowledge_versions kv ON ki.current_version_id = kv.id
    WHERE ki.business_id = ${businessId}
      AND ki.id != ${itemId}
      AND ki.status = 'published'
      AND kv.retired_at IS NULL
      AND kv.content_embedding IS NOT NULL
    ORDER BY
      CASE WHEN ki.category = ${baseItem[0].category} THEN 0 ELSE 1 END,
      confidence DESC
    LIMIT ${limit}
  `);

  return (results.rows as any[]).map((row) => ({
    knowledgeItemId: row.knowledge_item_id,
    versionId: row.version_id,
    title: row.title,
    slug: row.slug,
    itemType: row.item_type,
    category: row.category,
    contentJson: row.content_json,
    contentText: row.content_text,
    confidence: parseFloat(row.confidence),
    matchType: "semantic" as const,
    publishedAt: row.published_at,
    lastVerifiedAt: row.last_verified_at,
  }));
}

// Helper functions

function determineMatchType(
  semanticScore: number,
  keywordScore: number
): "semantic" | "keyword" | "hybrid" {
  if (semanticScore === 0 && keywordScore > 0) return "keyword";
  if (semanticScore > 0 && keywordScore === 0) return "semantic";
  return "hybrid";
}

function formatVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Search suggestions (autocomplete)
 * @param businessId - Business ID
 * @param prefix - Search prefix
 * @param limit - Max suggestions
 * @returns Array of suggestion strings
 */
export async function getSearchSuggestions(
  businessId: number,
  prefix: string,
  limit: number = 5
): Promise<string[]> {
  if (!prefix || prefix.length < 2) {
    return [];
  }

  const results = await db
    .select({ title: knowledgeItems.title })
    .from(knowledgeItems)
    .where(
      and(
        eq(knowledgeItems.businessId, businessId),
        eq(knowledgeItems.status, "published"),
        sql`${knowledgeItems.title} ILIKE ${prefix + "%"}`
      )
    )
    .limit(limit);

  return results.map((r) => r.title);
}

/**
 * Count knowledge items by category
 * @param businessId - Business ID
 * @returns Category counts
 */
export async function getKnowledgeCategoryCounts(
  businessId: number
): Promise<Record<string, number>> {
  const results = await db.execute(sql`
    SELECT
      category,
      COUNT(*) as count
    FROM knowledge_items
    WHERE business_id = ${businessId}
      AND status = 'published'
    GROUP BY category
    ORDER BY count DESC
  `);

  const counts: Record<string, number> = {};
  for (const row of results.rows as any[]) {
    counts[row.category] = parseInt(row.count);
  }

  return counts;
}
