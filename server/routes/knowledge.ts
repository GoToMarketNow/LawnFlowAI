// Knowledge Base API Routes
// CRUD operations, approval workflow, search
// Security: Role-based access control, multi-tenant isolation, rate limiting

import { Router, type Request, type Response } from "express";
import { db } from "../db";
import {
  knowledgeItems,
  knowledgeVersions,
  knowledgeApprovals,
  knowledgeReviewsDue,
  type NewKnowledgeItem,
  type NewKnowledgeVersion,
  type NewKnowledgeApproval,
} from "@shared/knowledge-schema";
import { eq, and, desc, isNull, inArray, or, sql } from "drizzle-orm";
import {
  validateContent,
  validateAndThrow,
  checkPermission,
  generateSlug,
  checkOperationRateLimit,
} from "../lib/knowledge/validator";
import { searchKnowledge, getKnowledgeItemById, getKnowledgeBySlug, getRelatedKnowledge } from "../lib/knowledge/search";
import { generateEmbedding } from "../lib/knowledge/embeddings";
import { extractSearchableText } from "@shared/knowledge-types";
import { audit } from "../lib/audit";

const router = Router();

// ============================================
// Middleware: Authentication & Authorization
// ============================================

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    businessId: number;
    role: string;
    email: string;
  };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: Function) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: Function) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// ============================================
// CREATE DRAFT KNOWLEDGE ITEM
// ============================================

router.post("/items", requireAuth, requireRole(["owner", "admin", "staff"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemType, title, category, contentJson, appliesTo, changeNotes } = req.body;

    // Rate limiting
    if (!checkOperationRateLimit(req.user!.id, "create_knowledge", 20, 60000)) {
      return res.status(429).json({ error: "Rate limit exceeded. Maximum 20 items per minute." });
    }

    // Permission check
    if (!checkPermission(req.user!.role, "create")) {
      return res.status(403).json({ error: "You do not have permission to create knowledge items" });
    }

    // Validation
    if (!itemType || !title || !category || !contentJson) {
      return res.status(400).json({ error: "Missing required fields: itemType, title, category, contentJson" });
    }

    // Validate content schema
    const validation = validateContent(itemType, contentJson);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid content",
        validationErrors: validation.errors,
        warnings: validation.warnings,
      });
    }

    // Generate slug
    const slug = generateSlug(title);

    // Check for duplicate slug
    const existing = await db.query.knowledgeItems.findFirst({
      where: and(
        eq(knowledgeItems.businessId, req.user!.businessId),
        eq(knowledgeItems.slug, slug)
      ),
    });

    if (existing) {
      return res.status(409).json({ error: "A knowledge item with this title already exists" });
    }

    // Create item
    const [item] = await db.insert(knowledgeItems).values({
      businessId: req.user!.businessId,
      itemType,
      title,
      slug,
      category,
      appliesTo: appliesTo || {},
      status: "draft",
      createdBy: req.user!.id,
    }).returning();

    // Create version 1
    const contentText = extractSearchableText(itemType, validation.sanitizedContent);
    const contentEmbedding = await generateEmbedding(contentText);

    const [version] = await db.insert(knowledgeVersions).values({
      knowledgeItemId: item.id,
      versionNumber: 1,
      contentJson: validation.sanitizedContent,
      contentText,
      contentEmbedding,
      authorId: req.user!.id,
      changeNotes: changeNotes || "Initial version",
    }).returning();

    // Link item to current version
    await db.update(knowledgeItems)
      .set({ currentVersionId: version.id })
      .where(eq(knowledgeItems.id, item.id));

    // Audit log
    await audit.logEvent({
      action: "knowledge.created",
      actor: req.user!.id,
      businessId: req.user!.businessId,
      metadata: { itemId: item.id, itemType, slug },
    });

    res.status(201).json({
      item: { ...item, currentVersionId: version.id },
      version,
      warnings: validation.warnings,
    });
  } catch (error: any) {
    console.error("Error creating knowledge item:", error);
    res.status(500).json({ error: error.message || "Failed to create knowledge item" });
  }
});

// ============================================
// CREATE NEW VERSION
// ============================================

router.post("/items/:id/versions", requireAuth, requireRole(["owner", "admin", "staff"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { contentJson, changeNotes } = req.body;

    // Rate limiting
    if (!checkOperationRateLimit(req.user!.id, "update_knowledge", 30, 60000)) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    // Get item (security check)
    const item = await db.query.knowledgeItems.findFirst({
      where: and(
        eq(knowledgeItems.id, parseInt(id)),
        eq(knowledgeItems.businessId, req.user!.businessId)
      ),
    });

    if (!item) {
      return res.status(404).json({ error: "Knowledge item not found" });
    }

    // Permission check
    if (!checkPermission(req.user!.role, "edit")) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    // Validate content
    const validation = validateContent(item.itemType, contentJson);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid content",
        validationErrors: validation.errors,
      });
    }

    // Get latest version number
    const latestVersion = await db.query.knowledgeVersions.findFirst({
      where: eq(knowledgeVersions.knowledgeItemId, item.id),
      orderBy: [desc(knowledgeVersions.versionNumber)],
    });

    const nextVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    // Create new version
    const contentText = extractSearchableText(item.itemType, validation.sanitizedContent);
    const contentEmbedding = await generateEmbedding(contentText);

    const [version] = await db.insert(knowledgeVersions).values({
      knowledgeItemId: item.id,
      versionNumber: nextVersionNumber,
      contentJson: validation.sanitizedContent,
      contentText,
      contentEmbedding,
      authorId: req.user!.id,
      changeNotes: changeNotes || `Version ${nextVersionNumber}`,
    }).returning();

    // Update item to draft (requires re-approval)
    await db.update(knowledgeItems)
      .set({
        status: "draft",
        currentVersionId: version.id,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeItems.id, item.id));

    // Audit log
    await audit.logEvent({
      action: "knowledge.version_created",
      actor: req.user!.id,
      businessId: req.user!.businessId,
      metadata: { itemId: item.id, versionId: version.id, versionNumber: nextVersionNumber },
    });

    res.status(201).json({ version, warnings: validation.warnings });
  } catch (error: any) {
    console.error("Error creating version:", error);
    res.status(500).json({ error: error.message || "Failed to create version" });
  }
});

// ============================================
// SUBMIT FOR REVIEW
// ============================================

router.post("/items/:id/submit", requireAuth, requireRole(["owner", "admin", "staff"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const item = await db.query.knowledgeItems.findFirst({
      where: and(
        eq(knowledgeItems.id, parseInt(id)),
        eq(knowledgeItems.businessId, req.user!.businessId)
      ),
    });

    if (!item) {
      return res.status(404).json({ error: "Knowledge item not found" });
    }

    if (item.status !== "draft") {
      return res.status(400).json({ error: "Only draft items can be submitted for review" });
    }

    if (!item.currentVersionId) {
      return res.status(400).json({ error: "Item has no version to submit" });
    }

    // Update status
    await db.update(knowledgeItems)
      .set({ status: "review", updatedAt: new Date() })
      .where(eq(knowledgeItems.id, item.id));

    // Create approval request
    const [approval] = await db.insert(knowledgeApprovals).values({
      knowledgeItemId: item.id,
      versionId: item.currentVersionId,
      submittedBy: req.user!.id,
    }).returning();

    // Audit log
    await audit.logEvent({
      action: "knowledge.submitted_for_review",
      actor: req.user!.id,
      businessId: req.user!.businessId,
      metadata: { itemId: item.id, approvalId: approval.id },
    });

    // TODO: Send notification to reviewers (owners/admins)

    res.json({ approval, message: "Submitted for review" });
  } catch (error: any) {
    console.error("Error submitting for review:", error);
    res.status(500).json({ error: error.message || "Failed to submit for review" });
  }
});

// ============================================
// APPROVE / REJECT
// ============================================

router.post("/items/:id/approve", requireAuth, requireRole(["owner", "admin"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { decision, notes } = req.body; // "approved" | "rejected"

    if (!decision || !["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ error: "Decision must be 'approved' or 'rejected'" });
    }

    const item = await db.query.knowledgeItems.findFirst({
      where: and(
        eq(knowledgeItems.id, parseInt(id)),
        eq(knowledgeItems.businessId, req.user!.businessId)
      ),
    });

    if (!item) {
      return res.status(404).json({ error: "Knowledge item not found" });
    }

    if (item.status !== "review") {
      return res.status(400).json({ error: "Item is not in review status" });
    }

    // Get pending approval
    const approval = await db.query.knowledgeApprovals.findFirst({
      where: and(
        eq(knowledgeApprovals.knowledgeItemId, item.id),
        isNull(knowledgeApprovals.decision)
      ),
      orderBy: [desc(knowledgeApprovals.submittedAt)],
    });

    if (!approval) {
      return res.status(404).json({ error: "No pending approval found" });
    }

    // Update approval record
    await db.update(knowledgeApprovals)
      .set({
        reviewerId: req.user!.id,
        decision: decision as "approved" | "rejected",
        decisionNotes: notes,
        decidedAt: new Date(),
      })
      .where(eq(knowledgeApprovals.id, approval.id));

    // Update item status
    if (decision === "approved") {
      await db.update(knowledgeItems)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(knowledgeItems.id, item.id));

      // Mark version as published
      if (item.currentVersionId) {
        await db.update(knowledgeVersions)
          .set({ publishedAt: new Date(), lastVerifiedAt: new Date() })
          .where(eq(knowledgeVersions.id, item.currentVersionId));
      }
    } else {
      await db.update(knowledgeItems)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(knowledgeItems.id, item.id));
    }

    // Audit log
    await audit.logEvent({
      action: `knowledge.${decision}`,
      actor: req.user!.id,
      businessId: req.user!.businessId,
      metadata: { itemId: item.id, approvalId: approval.id, notes },
    });

    res.json({ success: true, decision, message: `Knowledge item ${decision}` });
  } catch (error: any) {
    console.error("Error approving/rejecting:", error);
    res.status(500).json({ error: error.message || "Failed to process approval" });
  }
});

// ============================================
// RETIRE KNOWLEDGE ITEM
// ============================================

router.post("/items/:id/retire", requireAuth, requireRole(["owner", "admin"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const item = await db.query.knowledgeItems.findFirst({
      where: and(
        eq(knowledgeItems.id, parseInt(id)),
        eq(knowledgeItems.businessId, req.user!.businessId)
      ),
    });

    if (!item) {
      return res.status(404).json({ error: "Knowledge item not found" });
    }

    // Update item status
    await db.update(knowledgeItems)
      .set({ status: "retired", updatedAt: new Date() })
      .where(eq(knowledgeItems.id, item.id));

    // Mark current version as retired
    if (item.currentVersionId) {
      await db.update(knowledgeVersions)
        .set({ retiredAt: new Date() })
        .where(eq(knowledgeVersions.id, item.currentVersionId));
    }

    // Audit log
    await audit.logEvent({
      action: "knowledge.retired",
      actor: req.user!.id,
      businessId: req.user!.businessId,
      metadata: { itemId: item.id, reason },
    });

    res.json({ success: true, message: "Knowledge item retired" });
  } catch (error: any) {
    console.error("Error retiring knowledge:", error);
    res.status(500).json({ error: error.message || "Failed to retire knowledge item" });
  }
});

// ============================================
// LIST KNOWLEDGE ITEMS (with filters)
// ============================================

router.get("/items", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, itemType, category, limit = "50", offset = "0" } = req.query;

    const filters: any[] = [eq(knowledgeItems.businessId, req.user!.businessId)];

    if (status) {
      filters.push(eq(knowledgeItems.status, status as string));
    }

    if (itemType) {
      filters.push(eq(knowledgeItems.itemType, itemType as string));
    }

    if (category) {
      filters.push(eq(knowledgeItems.category, category as string));
    }

    const items = await db.query.knowledgeItems.findMany({
      where: and(...filters),
      orderBy: [desc(knowledgeItems.updatedAt)],
      limit: Math.min(parseInt(limit as string), 100),
      offset: parseInt(offset as string),
      with: {
        currentVersion: true,
      },
    });

    res.json({ items, count: items.length });
  } catch (error: any) {
    console.error("Error listing knowledge:", error);
    res.status(500).json({ error: error.message || "Failed to list knowledge items" });
  }
});

// ============================================
// GET SINGLE KNOWLEDGE ITEM
// ============================================

router.get("/items/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const item = await db.query.knowledgeItems.findFirst({
      where: and(
        eq(knowledgeItems.id, parseInt(id)),
        eq(knowledgeItems.businessId, req.user!.businessId)
      ),
      with: {
        currentVersion: true,
        versions: {
          orderBy: [desc(knowledgeVersions.versionNumber)],
        },
        approvals: {
          orderBy: [desc(knowledgeApprovals.submittedAt)],
          limit: 5,
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: "Knowledge item not found" });
    }

    res.json({ item });
  } catch (error: any) {
    console.error("Error getting knowledge item:", error);
    res.status(500).json({ error: error.message || "Failed to get knowledge item" });
  }
});

// ============================================
// SEARCH KNOWLEDGE (published only)
// ============================================

router.get("/search", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, itemTypes, categories, limit = "10", minConfidence = "0.5" } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Query parameter 'q' required" });
    }

    const results = await searchKnowledge({
      businessId: req.user!.businessId,
      query: q,
      itemTypes: itemTypes ? (itemTypes as string).split(",") : undefined,
      categories: categories ? (categories as string).split(",") : undefined,
      limit: Math.min(parseInt(limit as string), 50),
      minConfidence: parseFloat(minConfidence as string),
    });

    res.json({ results, count: results.length });
  } catch (error: any) {
    console.error("Error searching knowledge:", error);
    res.status(500).json({ error: error.message || "Search failed" });
  }
});

// ============================================
// GET APPROVAL QUEUE
// ============================================

router.get("/approvals/pending", requireAuth, requireRole(["owner", "admin"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pending = await db.query.knowledgeApprovals.findMany({
      where: and(
        isNull(knowledgeApprovals.decision),
        sql`${knowledgeApprovals.knowledgeItemId} IN (
          SELECT id FROM knowledge_items WHERE business_id = ${req.user!.businessId}
        )`
      ),
      orderBy: [desc(knowledgeApprovals.submittedAt)],
      with: {
        item: true,
        version: true,
        submitter: {
          columns: { id: true, email: true },
        },
      },
    });

    res.json({ pending, count: pending.length });
  } catch (error: any) {
    console.error("Error getting approval queue:", error);
    res.status(500).json({ error: error.message || "Failed to get approval queue" });
  }
});

// ============================================
// GET REVIEWS DUE
// ============================================

router.get("/reviews/due", requireAuth, requireRole(["owner", "admin"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reviews = await db.query.knowledgeReviewsDue.findMany({
      where: and(
        isNull(knowledgeReviewsDue.completedAt),
        sql`${knowledgeReviewsDue.knowledgeItemId} IN (
          SELECT id FROM knowledge_items WHERE business_id = ${req.user!.businessId}
        )`
      ),
      orderBy: [knowledgeReviewsDue.reviewDueDate],
      with: {
        item: true,
      },
    });

    res.json({ reviews, count: reviews.length });
  } catch (error: any) {
    console.error("Error getting reviews due:", error);
    res.status(500).json({ error: error.message || "Failed to get reviews due" });
  }
});

// ============================================
// MARK REVIEW AS COMPLETED
// ============================================

router.post("/reviews/:id/complete", requireAuth, requireRole(["owner", "admin"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await db.update(knowledgeReviewsDue)
      .set({
        completedAt: new Date(),
        completedBy: req.user!.id,
      })
      .where(eq(knowledgeReviewsDue.id, parseInt(id)));

    // Update last verified timestamp
    const review = await db.query.knowledgeReviewsDue.findFirst({
      where: eq(knowledgeReviewsDue.id, parseInt(id)),
    });

    if (review?.knowledgeItemId) {
      const item = await db.query.knowledgeItems.findFirst({
        where: eq(knowledgeItems.id, review.knowledgeItemId),
      });

      if (item?.currentVersionId) {
        await db.update(knowledgeVersions)
          .set({ lastVerifiedAt: new Date() })
          .where(eq(knowledgeVersions.id, item.currentVersionId));
      }
    }

    res.json({ success: true, message: "Review completed" });
  } catch (error: any) {
    console.error("Error completing review:", error);
    res.status(500).json({ error: error.message || "Failed to complete review" });
  }
});

export default router;
