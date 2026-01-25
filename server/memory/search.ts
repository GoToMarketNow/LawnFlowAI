import { db } from "../db";
import { customerMemories, customerProfiles } from "@shared/schema";
import { and, eq, desc, ilike, inArray, sql } from "drizzle-orm";
import { embedText, isEmbeddingsAvailable } from "./embedder";
import type { CustomerMemory, MemoryType } from "@shared/schema";

export interface MemorySearchParams {
  businessId: number;
  customerId?: number;
  queryText: string;
  limit?: number;
  memoryTypes?: MemoryType[];
  serviceType?: string;
}

export interface MemorySearchResult {
  memory: CustomerMemory;
  similarity?: number;
  matchType: "vector" | "keyword";
}

export async function searchMemories(
  params: MemorySearchParams
): Promise<MemorySearchResult[]> {
  const { businessId, customerId, queryText, limit = 8, memoryTypes, serviceType } = params;
  
  if (isEmbeddingsAvailable()) {
    const vectorResults = await searchByVector(params);
    if (vectorResults.length > 0) {
      return vectorResults;
    }
  }
  
  return searchByKeyword(params);
}

async function searchByVector(
  params: MemorySearchParams
): Promise<MemorySearchResult[]> {
  const { businessId, customerId, queryText, limit = 8, memoryTypes, serviceType } = params;
  
  const queryEmbedding = await embedText(queryText);
  if (!queryEmbedding) {
    console.warn("[MemorySearch] Failed to embed query, falling back to keyword search");
    return [];
  }
  
  const embeddingStr = `[${queryEmbedding.join(",")}]`;
  
  try {
    let baseQuery = sql`
      SELECT 
        id, business_id, account_id, customer_id, memory_type, service_type, channel,
        importance, sentiment, nps_score, occurred_at, text, embedding_json, embedding_model,
        tags_json, source_entity_type, source_entity_id, content_hash, created_at, updated_at,
        1 - (embedding_json::vector <=> ${embeddingStr}::vector) as similarity
      FROM customer_memories
      WHERE business_id = ${businessId}
        AND embedding_json IS NOT NULL
    `;
    
    if (customerId) {
      baseQuery = sql`${baseQuery} AND customer_id = ${customerId}`;
    }
    
    if (memoryTypes && memoryTypes.length > 0) {
      baseQuery = sql`${baseQuery} AND memory_type = ANY(${memoryTypes})`;
    }
    
    if (serviceType) {
      baseQuery = sql`${baseQuery} AND service_type = ${serviceType}`;
    }
    
    baseQuery = sql`${baseQuery} ORDER BY embedding_json::vector <=> ${embeddingStr}::vector LIMIT ${limit}`;
    
    const results = await db.execute(baseQuery);
    
    return (results.rows as any[]).map(row => ({
      memory: {
        id: row.id,
        businessId: row.business_id,
        accountId: row.account_id,
        customerId: row.customer_id,
        memoryType: row.memory_type,
        serviceType: row.service_type,
        channel: row.channel,
        importance: row.importance,
        sentiment: row.sentiment,
        npsScore: row.nps_score,
        occurredAt: row.occurred_at,
        text: row.text,
        embeddingJson: row.embedding_json,
        embeddingModel: row.embedding_model,
        tagsJson: row.tags_json,
        sourceEntityType: row.source_entity_type,
        sourceEntityId: row.source_entity_id,
        contentHash: row.content_hash,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      } as CustomerMemory,
      similarity: row.similarity,
      matchType: "vector" as const,
    }));
  } catch (error) {
    console.error("[MemorySearch] Vector search failed:", error);
    return [];
  }
}

async function searchByKeyword(
  params: MemorySearchParams
): Promise<MemorySearchResult[]> {
  const { businessId, customerId, queryText, limit = 8, memoryTypes, serviceType } = params;
  
  const keywords = queryText
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 5);
  
  if (keywords.length === 0) {
    return [];
  }
  
  const conditions = [eq(customerMemories.businessId, businessId)];
  
  if (customerId) {
    conditions.push(eq(customerMemories.customerId, customerId));
  }
  
  if (memoryTypes && memoryTypes.length > 0) {
    conditions.push(inArray(customerMemories.memoryType, memoryTypes));
  }
  
  if (serviceType) {
    conditions.push(eq(customerMemories.serviceType, serviceType));
  }
  
  const results = await db
    .select()
    .from(customerMemories)
    .where(and(...conditions))
    .orderBy(desc(customerMemories.occurredAt))
    .limit(limit * 3);
  
  const scored = results
    .map(memory => {
      const textLower = memory.text.toLowerCase();
      const matchCount = keywords.filter(kw => textLower.includes(kw)).length;
      return { memory, matchCount };
    })
    .filter(({ matchCount }) => matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, limit);
  
  return scored.map(({ memory, matchCount }) => ({
    memory,
    similarity: matchCount / keywords.length,
    matchType: "keyword" as const,
  }));
}

export async function getCustomerWithMemories(
  businessId: number,
  customerId: number
): Promise<{
  customer: typeof customerProfiles.$inferSelect | null;
  memories: CustomerMemory[];
  preferences: CustomerMemory[];
}> {
  const [customer] = await db
    .select()
    .from(customerProfiles)
    .where(
      and(
        eq(customerProfiles.businessId, businessId),
        eq(customerProfiles.id, customerId)
      )
    )
    .limit(1);
  
  if (!customer) {
    return { customer: null, memories: [], preferences: [] };
  }
  
  const memories = await db
    .select()
    .from(customerMemories)
    .where(
      and(
        eq(customerMemories.businessId, businessId),
        eq(customerMemories.customerId, customerId)
      )
    )
    .orderBy(desc(customerMemories.occurredAt))
    .limit(50);
  
  const preferences = memories.filter(m => m.memoryType === "preference");
  
  return { customer, memories, preferences };
}
