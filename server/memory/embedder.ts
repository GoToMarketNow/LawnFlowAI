import OpenAI from "openai";
import pRetry from "p-retry";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSION = 1536;
const MAX_INPUT_CHARS = 8000;

let openaiClient: OpenAI | null = null;
let embeddingsAvailable = false;

function getOpenAIClient(): OpenAI | null {
  if (openaiClient) return openaiClient;
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[Embedder] OPENAI_API_KEY not set - embeddings will be disabled, using keyword fallback");
    return null;
  }
  
  openaiClient = new OpenAI({ apiKey });
  embeddingsAvailable = true;
  console.log("[Embedder] OpenAI embeddings initialized");
  return openaiClient;
}

function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_INPUT_CHARS);
}

export async function embedText(text: string): Promise<number[] | null> {
  const client = getOpenAIClient();
  if (!client) {
    return null;
  }
  
  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    return null;
  }
  
  try {
    const result = await pRetry(
      async () => {
        const response = await client.embeddings.create({
          model: EMBEDDING_MODEL,
          input: normalizedText,
        });
        return response.data[0]?.embedding || null;
      },
      {
        retries: 2,
        minTimeout: 500,
        maxTimeout: 2000,
        onFailedAttempt: (error) => {
          console.warn(`[Embedder] Retry attempt ${error.attemptNumber} failed:`, String(error));
        },
      }
    );
    
    return result;
  } catch (error) {
    console.error("[Embedder] Failed to generate embedding:", error);
    return null;
  }
}

export function isEmbeddingsAvailable(): boolean {
  getOpenAIClient();
  return embeddingsAvailable;
}

export function getEmbeddingDimension(): number {
  return EMBEDDING_DIMENSION;
}

export function getEmbeddingModel(): string {
  return EMBEDDING_MODEL;
}
