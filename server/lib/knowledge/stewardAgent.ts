// Knowledge Steward Agent
// Monitors business configuration changes and proposes knowledge updates
// Ensures knowledge base stays in sync with actual business settings

import { db } from "../../db";
import { businessProfiles, services, pricingPolicies } from "../../../shared/schema";
import { knowledgeItems, knowledgeVersions, knowledgeReviewsDue } from "../../../shared/knowledge-schema";
import { eq, and, or, lt } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";
import { generateEmbedding } from "./embeddings";
import { audit } from "../audit";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Change detection result
export interface ConfigChange {
  entityType: "business_profile" | "service" | "pricing_policy";
  entityId: number;
  changeType: "created" | "updated" | "deleted";
  field: string;
  oldValue: any;
  newValue: any;
  detectedAt: Date;
}

export interface KnowledgeUpdateProposal {
  knowledgeItemId: number | null; // null if new item should be created
  action: "create" | "update" | "retire";
  itemType: "policy" | "service" | "payment" | "operations" | "proof_of_work" | "macro";
  title: string;
  category: string;
  contentDiff?: {
    fieldsChanged: string[];
    oldContent?: any;
    newContent: any;
  };
  rationale: string;
  urgency: "high" | "medium" | "low";
  autoApprovable: boolean;
}

export interface StewardResult {
  changesDetected: number;
  proposalsCreated: number;
  proposals: KnowledgeUpdateProposal[];
  errors: string[];
}

/**
 * Detect configuration changes and propose knowledge updates
 */
export async function detectConfigChangesAndPropose(
  businessId: number,
  userId: number,
  sinceTimestamp?: Date
): Promise<StewardResult> {
  const errors: string[] = [];
  const proposals: KnowledgeUpdateProposal[] = [];

  try {
    // Use 24 hours ago as default
    const since = sinceTimestamp || new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch current business profile
    const [business] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.id, businessId))
      .limit(1);

    if (!business) {
      throw new Error("Business profile not found");
    }

    // Detect changes in business profile
    const businessChanges = await detectBusinessProfileChanges(businessId, since);

    // Detect changes in services
    const serviceChanges = await detectServiceChanges(businessId, since);

    // Detect changes in pricing policies
    const pricingChanges = await detectPricingChanges(businessId, since);

    const allChanges = [...businessChanges, ...serviceChanges, ...pricingChanges];

    // Generate proposals for each change
    for (const change of allChanges) {
      try {
        const changeProposals = await generateProposalsForChange(businessId, business, change, userId);
        proposals.push(...changeProposals);
      } catch (error: any) {
        errors.push(`Failed to generate proposal for ${change.entityType} change: ${error.message}`);
      }
    }

    // Create knowledge review tasks for proposals
    for (const proposal of proposals) {
      if (proposal.knowledgeItemId) {
        await scheduleKnowledgeReview(businessId, proposal.knowledgeItemId, userId, proposal.urgency);
      }
    }

    await auditLog({
      businessId,
      userId,
      action: "knowledge_steward_run",
      entityType: "knowledge",
      entityId: null,
      metadata: {
        changesDetected: allChanges.length,
        proposalsCreated: proposals.length,
        errors: errors.length,
        sinceTimestamp: since.toISOString(),
      },
    });

    return {
      changesDetected: allChanges.length,
      proposalsCreated: proposals.length,
      proposals,
      errors,
    };
  } catch (error: any) {
    console.error("Knowledge steward failed:", error);
    throw new Error(`Knowledge steward failed: ${error.message}`);
  }
}

/**
 * Detect business profile changes (simplified - in production, use audit log)
 */
async function detectBusinessProfileChanges(businessId: number, since: Date): Promise<ConfigChange[]> {
  // In a production system, this would query an audit log table
  // For now, we'll return an empty array as a placeholder
  // Real implementation would track field-level changes with timestamps
  return [];
}

/**
 * Detect service changes
 */
async function detectServiceChanges(businessId: number, since: Date): Promise<ConfigChange[]> {
  // Placeholder - would check services.updatedAt > since
  // And compare against previous snapshot to detect field changes
  return [];
}

/**
 * Detect pricing policy changes
 */
async function detectPricingChanges(businessId: number, since: Date): Promise<ConfigChange[]> {
  // Placeholder - would check pricingPolicies.updatedAt > since
  return [];
}

/**
 * Generate knowledge update proposals for a config change
 */
async function generateProposalsForChange(
  businessId: number,
  business: any,
  change: ConfigChange,
  userId: number
): Promise<KnowledgeUpdateProposal[]> {
  const systemPrompt = `You are a knowledge base steward for ${business.name}.
A configuration change has been detected. Analyze if this change requires updating the customer-facing knowledge base.

Change Details:
- Entity: ${change.entityType}
- Field: ${change.field}
- Old Value: ${JSON.stringify(change.oldValue)}
- New Value: ${JSON.stringify(change.newValue)}

Determine:
1. Does this change affect customer-facing information?
2. Which knowledge items should be updated?
3. What specific content changes are needed?
4. How urgent is this update?
5. Can it be auto-approved (simple factual update) or needs human review?`;

  const userPrompt = `Analyze the configuration change and generate update proposals as JSON.

Return format:
{
  "proposals": [
    {
      "action": "update" | "create" | "retire",
      "itemType": "policy" | "service" | "payment" | "operations" | "proof_of_work" | "macro",
      "title": "Knowledge item title",
      "category": "category name",
      "fieldsChanged": ["field1", "field2"],
      "newContent": { ...updated content fields... },
      "rationale": "Why this update is needed",
      "urgency": "high" | "medium" | "low",
      "autoApprovable": boolean
    }
  ]
}

If no knowledge update is needed, return { "proposals": [] }`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent analysis
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0].message.content || "{}";
    const parsed = JSON.parse(responseText);
    const proposalsArray = parsed.proposals || [];

    // Find related knowledge items
    const proposals: KnowledgeUpdateProposal[] = [];

    for (const proposalData of proposalsArray) {
      // Try to find existing knowledge item
      let knowledgeItemId: number | null = null;

      if (proposalData.action === "update" || proposalData.action === "retire") {
        const existingItems = await db
          .select()
          .from(knowledgeItems)
          .where(
            and(
              eq(knowledgeItems.businessId, businessId),
              eq(knowledgeItems.itemType, proposalData.itemType),
              or(
                eq(knowledgeItems.title, proposalData.title),
                eq(knowledgeItems.slug, generateSlug(proposalData.title))
              )
            )
          )
          .limit(1);

        if (existingItems.length > 0) {
          knowledgeItemId = existingItems[0].id;
        }
      }

      proposals.push({
        knowledgeItemId,
        action: proposalData.action,
        itemType: proposalData.itemType,
        title: proposalData.title,
        category: proposalData.category,
        contentDiff: {
          fieldsChanged: proposalData.fieldsChanged || [],
          newContent: proposalData.newContent,
        },
        rationale: proposalData.rationale,
        urgency: proposalData.urgency || "medium",
        autoApprovable: proposalData.autoApprovable || false,
      });
    }

    return proposals;
  } catch (error: any) {
    console.error("Failed to generate proposals:", error);
    return [];
  }
}

/**
 * Schedule a knowledge review task
 */
async function scheduleKnowledgeReview(
  businessId: number,
  knowledgeItemId: number,
  userId: number,
  urgency: "high" | "medium" | "low"
): Promise<void> {
  // Calculate due date based on urgency
  const daysUntilDue = urgency === "high" ? 1 : urgency === "medium" ? 7 : 30;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysUntilDue);

  // Check if review already scheduled
  const existing = await db
    .select()
    .from(knowledgeReviewsDue)
    .where(
      and(
        eq(knowledgeReviewsDue.knowledgeItemId, knowledgeItemId),
        eq(knowledgeReviewsDue.status, "pending")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing review with earlier date if more urgent
    if (dueDate < new Date(existing[0].dueDate)) {
      await db
        .update(knowledgeReviewsDue)
        .set({
          dueDate,
          reason: "config_change_detected",
        })
        .where(eq(knowledgeReviewsDue.id, existing[0].id));
    }
  } else {
    // Create new review task
    await db.insert(knowledgeReviewsDue).values({
      businessId,
      knowledgeItemId,
      dueDate,
      reason: "config_change_detected",
      status: "pending",
      assignedTo: userId,
    });
  }

  await auditLog({
    businessId,
    userId,
    action: "knowledge_review_scheduled",
    entityType: "knowledge",
    entityId: knowledgeItemId,
    metadata: {
      urgency,
      dueDate: dueDate.toISOString(),
      reason: "config_change_detected",
    },
  });
}

/**
 * Apply a knowledge update proposal
 */
export async function applyProposal(
  businessId: number,
  userId: number,
  proposal: KnowledgeUpdateProposal
): Promise<{ success: boolean; knowledgeItemId?: number; versionId?: number; error?: string }> {
  try {
    if (proposal.action === "create") {
      // Create new knowledge item
      const slug = generateSlug(proposal.title);
      const searchText = `${proposal.title} ${JSON.stringify(proposal.contentDiff?.newContent)}`;
      const embedding = await generateEmbedding(searchText);

      const [knowledgeItem] = await db
        .insert(knowledgeItems)
        .values({
          businessId,
          itemType: proposal.itemType,
          title: proposal.title,
          slug,
          category: proposal.category,
          status: proposal.autoApprovable ? "published" : "review",
          appliesTo: {},
          createdBy: userId,
          currentVersionId: null,
        })
        .returning();

      const [version] = await db
        .insert(knowledgeVersions)
        .values({
          knowledgeItemId: knowledgeItem.id,
          versionNumber: 1,
          content: proposal.contentDiff?.newContent || {},
          changeNotes: proposal.rationale,
          embedding,
          createdBy: userId,
          status: proposal.autoApprovable ? "published" : "review",
        })
        .returning();

      await db
        .update(knowledgeItems)
        .set({ currentVersionId: version.id })
        .where(eq(knowledgeItems.id, knowledgeItem.id));

      await auditLog({
        businessId,
        userId,
        action: "knowledge_created_from_proposal",
        entityType: "knowledge",
        entityId: knowledgeItem.id,
        metadata: {
          versionId: version.id,
          source: "steward_agent",
          autoApproved: proposal.autoApprovable,
        },
      });

      return {
        success: true,
        knowledgeItemId: knowledgeItem.id,
        versionId: version.id,
      };
    } else if (proposal.action === "update" && proposal.knowledgeItemId) {
      // Update existing knowledge item with new version
      const [existingItem] = await db
        .select()
        .from(knowledgeItems)
        .where(eq(knowledgeItems.id, proposal.knowledgeItemId))
        .limit(1);

      if (!existingItem) {
        return { success: false, error: "Knowledge item not found" };
      }

      // Get current version to determine next version number
      const versions = await db
        .select()
        .from(knowledgeVersions)
        .where(eq(knowledgeVersions.knowledgeItemId, proposal.knowledgeItemId))
        .orderBy(knowledgeVersions.versionNumber);

      const nextVersionNumber = versions.length > 0 ? Math.max(...versions.map(v => v.versionNumber)) + 1 : 1;

      const searchText = `${proposal.title} ${JSON.stringify(proposal.contentDiff?.newContent)}`;
      const embedding = await generateEmbedding(searchText);

      const [newVersion] = await db
        .insert(knowledgeVersions)
        .values({
          knowledgeItemId: proposal.knowledgeItemId,
          versionNumber: nextVersionNumber,
          content: proposal.contentDiff?.newContent || {},
          changeNotes: proposal.rationale,
          embedding,
          createdBy: userId,
          status: proposal.autoApprovable ? "published" : "review",
        })
        .returning();

      if (proposal.autoApprovable) {
        await db
          .update(knowledgeItems)
          .set({
            currentVersionId: newVersion.id,
            status: "published",
          })
          .where(eq(knowledgeItems.id, proposal.knowledgeItemId));
      } else {
        await db
          .update(knowledgeItems)
          .set({ status: "review" })
          .where(eq(knowledgeItems.id, proposal.knowledgeItemId));
      }

      await auditLog({
        businessId,
        userId,
        action: "knowledge_updated_from_proposal",
        entityType: "knowledge",
        entityId: proposal.knowledgeItemId,
        metadata: {
          versionId: newVersion.id,
          source: "steward_agent",
          autoApproved: proposal.autoApprovable,
          fieldsChanged: proposal.contentDiff?.fieldsChanged || [],
        },
      });

      return {
        success: true,
        knowledgeItemId: proposal.knowledgeItemId,
        versionId: newVersion.id,
      };
    } else if (proposal.action === "retire" && proposal.knowledgeItemId) {
      // Retire knowledge item
      await db
        .update(knowledgeItems)
        .set({ status: "retired" })
        .where(eq(knowledgeItems.id, proposal.knowledgeItemId));

      await auditLog({
        businessId,
        userId,
        action: "knowledge_retired_from_proposal",
        entityType: "knowledge",
        entityId: proposal.knowledgeItemId,
        metadata: {
          source: "steward_agent",
          rationale: proposal.rationale,
        },
      });

      return {
        success: true,
        knowledgeItemId: proposal.knowledgeItemId,
      };
    }

    return { success: false, error: "Invalid proposal action" };
  } catch (error: any) {
    console.error("Failed to apply proposal:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 100);
}

/**
 * Run periodic steward check (call from cron job)
 */
export async function runPeriodicStewardCheck(
  businessId: number,
  userId: number
): Promise<StewardResult> {
  // Check for changes in last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return detectConfigChangesAndPropose(businessId, userId, since);
}
