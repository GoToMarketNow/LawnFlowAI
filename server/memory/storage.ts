import { db } from "../db";
import { customerProfiles, customerMemories, type CustomerProfile, type CustomerMemory, type InsertCustomerProfile, type InsertCustomerMemory } from "@shared/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { embedText, getEmbeddingModel } from "./embedder";
import { computeContentHash } from "./formatters";

export interface UpsertCustomerResult {
  customerId: number;
  isNew: boolean;
}

export async function upsertCustomer(
  businessId: number,
  input: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    accountId?: string;
    conversationId?: number;
    jobRequestId?: number;
  }
): Promise<UpsertCustomerResult> {
  const existing = await db
    .select()
    .from(customerProfiles)
    .where(
      and(
        eq(customerProfiles.businessId, businessId),
        eq(customerProfiles.phone, input.phone)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    const existingRecord = existing[0];
    
    await db
      .update(customerProfiles)
      .set({
        name: input.name !== existingRecord.name ? input.name : existingRecord.name,
        email: input.email && input.email !== existingRecord.email ? input.email : existingRecord.email,
        primaryAddress: input.address && input.address !== existingRecord.primaryAddress ? input.address : existingRecord.primaryAddress,
        conversationId: input.conversationId && !existingRecord.conversationId ? input.conversationId : existingRecord.conversationId,
        jobRequestId: input.jobRequestId && !existingRecord.jobRequestId ? input.jobRequestId : existingRecord.jobRequestId,
        lastInteractionAt: new Date(),
      })
      .where(eq(customerProfiles.id, existingRecord.id));
    
    return { customerId: existingRecord.id, isNew: false };
  }
  
  const [newCustomer] = await db
    .insert(customerProfiles)
    .values({
      businessId,
      accountId: input.accountId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      primaryAddress: input.address,
      conversationId: input.conversationId,
      jobRequestId: input.jobRequestId,
      lastInteractionAt: new Date(),
    })
    .returning();
  
  return { customerId: newCustomer.id, isNew: true };
}

export interface CreateMemoryInput {
  businessId: number;
  customerId: number;
  accountId?: string;
  memoryType: string;
  serviceType?: string;
  channel?: string;
  importance?: number;
  sentiment?: number;
  npsScore?: number;
  occurredAt?: Date;
  text: string;
  tagsJson?: Record<string, unknown>;
  sourceEntityType?: string;
  sourceEntityId?: string;
}

export interface CreateMemoryResult {
  memoryId: number;
  isNew: boolean;
  hasEmbedding: boolean;
}

export async function createMemory(
  input: CreateMemoryInput
): Promise<CreateMemoryResult> {
  const contentHash = computeContentHash(input.text, input.customerId, input.memoryType, input.businessId);
  
  const existing = await db
    .select({ id: customerMemories.id })
    .from(customerMemories)
    .where(
      and(
        eq(customerMemories.businessId, input.businessId),
        eq(customerMemories.contentHash, contentHash)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    return { memoryId: existing[0].id, isNew: false, hasEmbedding: false };
  }
  
  const embedding = await embedText(input.text);
  
  const [memory] = await db
    .insert(customerMemories)
    .values({
      businessId: input.businessId,
      customerId: input.customerId,
      accountId: input.accountId,
      memoryType: input.memoryType,
      serviceType: input.serviceType,
      channel: input.channel,
      importance: input.importance ?? 3,
      sentiment: input.sentiment,
      npsScore: input.npsScore,
      occurredAt: input.occurredAt ?? new Date(),
      text: input.text,
      embeddingJson: embedding,
      embeddingModel: embedding ? getEmbeddingModel() : null,
      tagsJson: input.tagsJson ?? {},
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      contentHash,
    })
    .returning();
  
  await db
    .update(customerProfiles)
    .set({ lastInteractionAt: new Date(), updatedAt: new Date() })
    .where(eq(customerProfiles.id, input.customerId));
  
  return {
    memoryId: memory.id,
    isNew: true,
    hasEmbedding: !!embedding,
  };
}

export async function getCustomerById(
  businessId: number,
  customerId: number
): Promise<CustomerProfile | null> {
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
  
  return customer ?? null;
}

export async function getCustomerByPhone(
  businessId: number,
  phone: string
): Promise<CustomerProfile | null> {
  const [customer] = await db
    .select()
    .from(customerProfiles)
    .where(
      and(
        eq(customerProfiles.businessId, businessId),
        eq(customerProfiles.phone, phone)
      )
    )
    .limit(1);
  
  return customer ?? null;
}

export async function getRecentMemories(
  businessId: number,
  customerId: number,
  limit: number = 20
): Promise<CustomerMemory[]> {
  return db
    .select()
    .from(customerMemories)
    .where(
      and(
        eq(customerMemories.businessId, businessId),
        eq(customerMemories.customerId, customerId)
      )
    )
    .orderBy(desc(customerMemories.occurredAt))
    .limit(limit);
}

export async function listCustomers(
  businessId: number,
  options?: {
    limit?: number;
    offset?: number;
    search?: string;
  }
): Promise<{ customers: CustomerProfile[]; total: number }> {
  const { limit = 50, offset = 0, search } = options ?? {};
  
  let query = db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.businessId, businessId))
    .orderBy(desc(customerProfiles.lastInteractionAt))
    .limit(limit)
    .offset(offset);
  
  const customers = await query;
  
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customerProfiles)
    .where(eq(customerProfiles.businessId, businessId));
  
  return { customers, total: Number(count) };
}
