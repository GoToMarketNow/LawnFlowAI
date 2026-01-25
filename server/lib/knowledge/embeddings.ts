// OpenAI Embeddings Service
// Generates vector embeddings for semantic search
// Security: Rate limiting, input validation, error handling

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000, // 30 second timeout
});

// Model configuration
const EMBEDDING_MODEL = "text-embedding-ada-002";
const MAX_TOKEN_LENGTH = 8191; // OpenAI's ada-002 limit
const EMBEDDING_DIMENSIONS = 1536;

// Rate limiting (simple in-memory, production should use Redis)
const rateLimiter = {
  requests: [] as number[],
  maxRequests: 100,
  windowMs: 60000, // 1 minute
};

function checkRateLimit(): boolean {
  const now = Date.now();
  rateLimiter.requests = rateLimiter.requests.filter(
    (timestamp) => now - timestamp < rateLimiter.windowMs
  );

  if (rateLimiter.requests.length >= rateLimiter.maxRequests) {
    return false;
  }

  rateLimiter.requests.push(now);
  return true;
}

// Input sanitization
function sanitizeInput(text: string): string {
  // Remove null bytes and control characters (security)
  let sanitized = text.replace(/[\x00-\x1F\x7F]/g, ' ');

  // Trim excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Truncate to max length (rough token estimate: 1 token ≈ 4 chars)
  const maxChars = MAX_TOKEN_LENGTH * 4;
  if (sanitized.length > maxChars) {
    sanitized = sanitized.substring(0, maxChars);
  }

  return sanitized;
}

/**
 * Generate embedding vector for text using OpenAI
 * @param text - Input text to embed
 * @returns 1536-dimension vector array
 * @throws Error if rate limited or API fails
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Validation
  if (!text || typeof text !== 'string') {
    throw new Error("Text input required for embedding");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Rate limiting check
  if (!checkRateLimit()) {
    throw new Error("Rate limit exceeded for embeddings. Please retry in 1 minute.");
  }

  // Sanitize input
  const sanitized = sanitizeInput(text);

  if (sanitized.length === 0) {
    throw new Error("Input text is empty after sanitization");
  }

  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: sanitized,
      encoding_format: "float",
    });

    const embedding = response.data[0]?.embedding;

    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Invalid embedding response: expected ${EMBEDDING_DIMENSIONS} dimensions`);
    }

    return embedding;
  } catch (error: any) {
    // Enhanced error handling
    if (error.code === 'insufficient_quota') {
      throw new Error("OpenAI API quota exceeded. Please check billing.");
    }

    if (error.code === 'invalid_api_key') {
      throw new Error("Invalid OpenAI API key");
    }

    if (error.status === 429) {
      throw new Error("OpenAI rate limit exceeded. Please retry later.");
    }

    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

/**
 * Batch generate embeddings for multiple texts
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  // OpenAI supports batch embedding (up to 2048 inputs)
  const BATCH_SIZE = 100; // Conservative batch size

  if (texts.length === 0) {
    return [];
  }

  if (texts.length > 2048) {
    throw new Error("Batch size exceeds OpenAI limit of 2048 inputs");
  }

  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const sanitized = batch.map(sanitizeInput).filter(t => t.length > 0);

    if (sanitized.length === 0) {
      continue;
    }

    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: sanitized,
        encoding_format: "float",
      });

      embeddings.push(...response.data.map(d => d.embedding));
    } catch (error: any) {
      throw new Error(`Batch embedding failed at index ${i}: ${error.message}`);
    }

    // Rate limiting: small delay between batches
    if (i + BATCH_SIZE < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return embeddings;
}

/**
 * Calculate cosine similarity between two vectors
 * @param vecA - First vector
 * @param vecB - Second vector
 * @returns Similarity score (0-1, higher is more similar)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have same dimensions");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Format vector for PostgreSQL insertion
 * @param embedding - Embedding vector
 * @returns PostgreSQL-compatible vector string
 */
export function formatVectorForPostgres(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Parse vector from PostgreSQL
 * @param vectorStr - Vector string from database
 * @returns Number array
 */
export function parseVectorFromPostgres(vectorStr: string): number[] {
  if (!vectorStr || typeof vectorStr !== 'string') {
    throw new Error("Invalid vector string");
  }

  const trimmed = vectorStr.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    throw new Error("Vector must be in format [x,y,z,...]");
  }

  const values = trimmed.slice(1, -1).split(',').map(v => parseFloat(v.trim()));

  if (values.some(isNaN)) {
    throw new Error("Vector contains invalid numbers");
  }

  return values;
}

// Health check function
export async function testEmbeddingService(): Promise<boolean> {
  try {
    const testEmbedding = await generateEmbedding("test");
    return testEmbedding.length === EMBEDDING_DIMENSIONS;
  } catch {
    return false;
  }
}
