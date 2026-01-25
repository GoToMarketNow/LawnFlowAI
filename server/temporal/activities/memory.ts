/**
 * Memory/RAG Activities
 *
 * Temporal Activities for memory management and RAG operations:
 * - Document storage with embeddings
 * - Semantic search
 * - Customer preference tracking
 * - Context retrieval for workflows
 *
 * @module server/temporal/activities/memory
 */

import { z } from 'zod';
import { db } from '@db';
import { eq, and, desc, sql, inArray, gte } from 'drizzle-orm';
import OpenAI from 'openai';
import {
  memoryDocs,
  MemoryDocInputSchema,
  MemoryQueryInputSchema,
  type MemoryDocInput,
  type MemoryQueryInput,
} from '@shared/schema-finops';

// ============================================================================
// Configuration
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// ============================================================================
// Input Schemas
// ============================================================================

export const CreateMemoryDocInputSchema = MemoryDocInputSchema;

export const UpdateMemoryDocInputSchema = z.object({
  docId: z.number(),
  content: z.string().optional(),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  importanceScore: z.number().optional(),
  regenerateEmbedding: z.boolean().default(false),
});

export const QueryMemoryInputSchema = MemoryQueryInputSchema;

export const GetContextInputSchema = z.object({
  businessId: z.number(),
  customerId: z.number().optional(),
  entityType: z.string().optional(),
  entityId: z.number().optional(),
  docTypes: z.array(z.string()).optional(),
  limit: z.number().default(5),
});

export const RecordAccessInputSchema = z.object({
  docId: z.number(),
});

// ============================================================================
// Types
// ============================================================================

export type CreateMemoryDocInput = z.infer<typeof CreateMemoryDocInputSchema>;
export type UpdateMemoryDocInput = z.infer<typeof UpdateMemoryDocInputSchema>;
export type QueryMemoryInput = z.infer<typeof QueryMemoryInputSchema>;
export type GetContextInput = z.infer<typeof GetContextInputSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate embedding for text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error(`[Memory Activity] Failed to generate embedding`, error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// Activities
// ============================================================================

/**
 * Create a new memory document with embedding
 *
 * @activity createMemoryDocActivity
 */
export async function createMemoryDocActivity(
  input: CreateMemoryDocInput
): Promise<{ success: boolean; docId?: number; error?: string }> {
  const validated = CreateMemoryDocInputSchema.parse(input);

  console.log(`[Memory Activity] Creating memory doc`, {
    businessId: validated.businessId,
    docType: validated.docType,
    contentLength: validated.content.length,
  });

  try {
    // Generate embedding
    const textForEmbedding = validated.title
      ? `${validated.title}\n\n${validated.content}`
      : validated.content;

    const embedding = await generateEmbedding(textForEmbedding);

    // Insert document
    const [doc] = await db
      .insert(memoryDocs)
      .values({
        businessId: validated.businessId,
        accountId: validated.accountId,
        customerId: validated.customerId,
        docType: validated.docType,
        title: validated.title,
        content: validated.content,
        embedding: embedding,
        embeddingModel: EMBEDDING_MODEL,
        sourceEntityType: validated.sourceEntityType,
        sourceEntityId: validated.sourceEntityId,
        sourceWorkflowId: validated.sourceWorkflowId,
        tags: validated.tags || [],
        metadata: validated.metadata || {},
        importanceScore: validated.importanceScore?.toString() || '0.5',
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : undefined,
      })
      .returning({ id: memoryDocs.id });

    console.log(`[Memory Activity] Created memory doc ${doc.id}`);

    return {
      success: true,
      docId: doc.id,
    };
  } catch (error: any) {
    console.error(`[Memory Activity] Failed to create memory doc`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update an existing memory document
 *
 * @activity updateMemoryDocActivity
 */
export async function updateMemoryDocActivity(
  input: UpdateMemoryDocInput
): Promise<{ success: boolean; error?: string }> {
  const validated = UpdateMemoryDocInputSchema.parse(input);

  console.log(`[Memory Activity] Updating memory doc ${validated.docId}`);

  try {
    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (validated.title !== undefined) updates.title = validated.title;
    if (validated.content !== undefined) updates.content = validated.content;
    if (validated.tags !== undefined) updates.tags = validated.tags;
    if (validated.metadata !== undefined) updates.metadata = validated.metadata;
    if (validated.importanceScore !== undefined) {
      updates.importanceScore = validated.importanceScore.toString();
    }

    // Regenerate embedding if content changed or requested
    if (validated.regenerateEmbedding || validated.content !== undefined) {
      const doc = await db.query.memoryDocs.findFirst({
        where: eq(memoryDocs.id, validated.docId),
      });

      if (doc) {
        const content = validated.content || doc.content;
        const title = validated.title !== undefined ? validated.title : doc.title;
        const textForEmbedding = title ? `${title}\n\n${content}` : content;
        updates.embedding = await generateEmbedding(textForEmbedding);
      }
    }

    await db
      .update(memoryDocs)
      .set(updates)
      .where(eq(memoryDocs.id, validated.docId));

    console.log(`[Memory Activity] Updated memory doc ${validated.docId}`);

    return { success: true };
  } catch (error: any) {
    console.error(`[Memory Activity] Failed to update memory doc`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Query memory documents using semantic search
 *
 * @activity queryMemoryActivity
 */
export async function queryMemoryActivity(
  input: QueryMemoryInput
): Promise<{
  success: boolean;
  results?: Array<{
    id: number;
    docType: string;
    title: string | null;
    content: string;
    similarity: number;
    metadata: any;
    tags: any;
  }>;
  error?: string;
}> {
  const validated = QueryMemoryInputSchema.parse(input);

  console.log(`[Memory Activity] Querying memory`, {
    businessId: validated.businessId,
    query: validated.query.substring(0, 50) + '...',
    limit: validated.limit,
  });

  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(validated.query);

    // Build base query conditions
    const conditions = [
      eq(memoryDocs.businessId, validated.businessId),
      eq(memoryDocs.isActive, true),
    ];

    if (validated.customerId) {
      conditions.push(eq(memoryDocs.customerId, validated.customerId));
    }

    if (validated.docTypes && validated.docTypes.length > 0) {
      conditions.push(inArray(memoryDocs.docType, validated.docTypes));
    }

    // Get all matching documents (we'll filter by similarity in memory)
    // In production, use pgvector for efficient vector search
    const docs = await db.query.memoryDocs.findMany({
      where: and(...conditions),
      orderBy: [desc(memoryDocs.importanceScore), desc(memoryDocs.createdAt)],
      limit: validated.limit * 3, // Get more to filter by similarity
    });

    // Calculate similarity scores and sort
    const scoredDocs = docs
      .map((doc) => {
        const docEmbedding = doc.embedding as number[] | null;
        const similarity = docEmbedding
          ? cosineSimilarity(queryEmbedding, docEmbedding)
          : 0;

        return {
          id: doc.id,
          docType: doc.docType,
          title: doc.title,
          content: doc.content,
          similarity,
          metadata: doc.metadata,
          tags: doc.tags,
        };
      })
      .filter((doc) => doc.similarity > 0.3) // Minimum similarity threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, validated.limit);

    // Record access for returned docs
    for (const doc of scoredDocs) {
      await recordAccessActivity({ docId: doc.id });
    }

    console.log(`[Memory Activity] Found ${scoredDocs.length} relevant documents`);

    return {
      success: true,
      results: scoredDocs,
    };
  } catch (error: any) {
    console.error(`[Memory Activity] Query failed`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get context for a specific entity (customer, job, etc.)
 *
 * @activity getContextActivity
 */
export async function getContextActivity(
  input: GetContextInput
): Promise<{
  success: boolean;
  context?: Array<{
    id: number;
    docType: string;
    title: string | null;
    content: string;
    importanceScore: string | null;
    createdAt: Date | null;
  }>;
  error?: string;
}> {
  const validated = GetContextInputSchema.parse(input);

  console.log(`[Memory Activity] Getting context`, {
    businessId: validated.businessId,
    customerId: validated.customerId,
    entityType: validated.entityType,
  });

  try {
    const conditions = [
      eq(memoryDocs.businessId, validated.businessId),
      eq(memoryDocs.isActive, true),
    ];

    if (validated.customerId) {
      conditions.push(eq(memoryDocs.customerId, validated.customerId));
    }

    if (validated.entityType && validated.entityId) {
      conditions.push(eq(memoryDocs.sourceEntityType, validated.entityType));
      conditions.push(eq(memoryDocs.sourceEntityId, validated.entityId));
    }

    if (validated.docTypes && validated.docTypes.length > 0) {
      conditions.push(inArray(memoryDocs.docType, validated.docTypes));
    }

    const docs = await db.query.memoryDocs.findMany({
      where: and(...conditions),
      orderBy: [desc(memoryDocs.importanceScore), desc(memoryDocs.createdAt)],
      limit: validated.limit,
      columns: {
        id: true,
        docType: true,
        title: true,
        content: true,
        importanceScore: true,
        createdAt: true,
      },
    });

    // Record access
    for (const doc of docs) {
      await recordAccessActivity({ docId: doc.id });
    }

    console.log(`[Memory Activity] Retrieved ${docs.length} context documents`);

    return {
      success: true,
      context: docs,
    };
  } catch (error: any) {
    console.error(`[Memory Activity] Get context failed`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Record document access (for tracking usage)
 *
 * @activity recordAccessActivity
 */
export async function recordAccessActivity(
  input: { docId: number }
): Promise<{ success: boolean }> {
  try {
    await db
      .update(memoryDocs)
      .set({
        lastAccessedAt: new Date(),
        accessCount: sql`${memoryDocs.accessCount} + 1`,
      })
      .where(eq(memoryDocs.id, input.docId));

    return { success: true };
  } catch (error) {
    console.error(`[Memory Activity] Record access failed`, error);
    return { success: false };
  }
}

/**
 * Delete a memory document
 *
 * @activity deleteMemoryDocActivity
 */
export async function deleteMemoryDocActivity(
  input: { docId: number }
): Promise<{ success: boolean }> {
  console.log(`[Memory Activity] Deleting memory doc ${input.docId}`);

  try {
    // Soft delete
    await db
      .update(memoryDocs)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(memoryDocs.id, input.docId));

    return { success: true };
  } catch (error) {
    console.error(`[Memory Activity] Delete failed`, error);
    return { success: false };
  }
}

/**
 * Get customer preferences from memory
 *
 * @activity getCustomerPreferencesActivity
 */
export async function getCustomerPreferencesActivity(
  input: { businessId: number; customerId: number }
): Promise<{
  success: boolean;
  preferences?: Array<{
    id: number;
    title: string | null;
    content: string;
    tags: any;
    createdAt: Date | null;
  }>;
}> {
  console.log(`[Memory Activity] Getting preferences for customer ${input.customerId}`);

  try {
    const prefs = await db.query.memoryDocs.findMany({
      where: and(
        eq(memoryDocs.businessId, input.businessId),
        eq(memoryDocs.customerId, input.customerId),
        eq(memoryDocs.docType, 'customer_preference'),
        eq(memoryDocs.isActive, true)
      ),
      orderBy: [desc(memoryDocs.importanceScore), desc(memoryDocs.createdAt)],
      columns: {
        id: true,
        title: true,
        content: true,
        tags: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      preferences: prefs,
    };
  } catch (error) {
    console.error(`[Memory Activity] Get preferences failed`, error);
    return { success: false };
  }
}

/**
 * Bulk create memory documents (for batch imports)
 *
 * @activity bulkCreateMemoryDocsActivity
 */
export async function bulkCreateMemoryDocsActivity(
  input: { docs: CreateMemoryDocInput[] }
): Promise<{ success: boolean; createdCount: number; errors: string[] }> {
  console.log(`[Memory Activity] Bulk creating ${input.docs.length} memory docs`);

  const errors: string[] = [];
  let createdCount = 0;

  for (const doc of input.docs) {
    const result = await createMemoryDocActivity(doc);
    if (result.success) {
      createdCount++;
    } else {
      errors.push(result.error || 'Unknown error');
    }
  }

  console.log(`[Memory Activity] Bulk create completed: ${createdCount}/${input.docs.length}`);

  return {
    success: errors.length === 0,
    createdCount,
    errors,
  };
}

/**
 * Clean up expired memory documents
 *
 * @activity cleanupExpiredDocsActivity
 */
export async function cleanupExpiredDocsActivity(
  input: { businessId?: number }
): Promise<{ success: boolean; cleanedCount: number }> {
  console.log(`[Memory Activity] Cleaning up expired docs`);

  try {
    const conditions = [
      eq(memoryDocs.isActive, true),
      sql`${memoryDocs.expiresAt} IS NOT NULL AND ${memoryDocs.expiresAt} < NOW()`,
    ];

    if (input.businessId) {
      conditions.push(eq(memoryDocs.businessId, input.businessId));
    }

    const result = await db
      .update(memoryDocs)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(...conditions));

    const cleanedCount = (result as any).rowCount || 0;

    console.log(`[Memory Activity] Cleaned ${cleanedCount} expired docs`);

    return {
      success: true,
      cleanedCount,
    };
  } catch (error) {
    console.error(`[Memory Activity] Cleanup failed`, error);
    return {
      success: false,
      cleanedCount: 0,
    };
  }
}
