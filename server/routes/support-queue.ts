// Support Queue API Routes
// Thread management, SLA tracking, coverage analysis
// Security: Role-based access control, multi-tenant isolation

import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { threadEnrichment, type Priority, type CoverageStatus, type SLAStatus } from "@shared/thread-enrichment-schema";
import { eq, and, desc, isNull, isNotNull, sql, gte } from "drizzle-orm";
import { enrichThread, reenrichThread, markFirstResponse, markThreadResolved } from "../workers/support/enrichmentWorker";
import { suggestKnowledgeItems } from "../lib/support/coverageDetector";
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
// GET SUPPORT QUEUE (with filters)
// ============================================

router.get("/queue", requireAuth, requireRole(["owner", "admin", "staff"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      intent,
      priority,
      coverageStatus,
      assigned,
      slaStatus,
      limit = "50",
      offset = "0",
      sort = "priority_desc",
    } = req.query;

    // Build filters
    const filters: any[] = [eq(threadEnrichment.businessId, req.user!.businessId)];

    if (intent) {
      filters.push(eq(threadEnrichment.intent, intent as string));
    }

    if (priority) {
      filters.push(eq(threadEnrichment.priority, priority as string));
    }

    if (coverageStatus) {
      filters.push(eq(threadEnrichment.coverageStatus, coverageStatus as string));
    }

    if (slaStatus) {
      filters.push(eq(threadEnrichment.slaStatus, slaStatus as string));
    }

    // Assigned filter (requires join with comms_threads - simplified here)
    // In production: JOIN comms_threads and filter on assigned_to

    // Determine sort order
    let orderBy: any;
    switch (sort) {
      case "priority_desc":
        // Urgent > High > Normal > Low
        orderBy = sql`CASE ${threadEnrichment.priority}
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END, ${threadEnrichment.firstResponseDue} ASC NULLS LAST`;
        break;
      case "sla_due_asc":
        orderBy = threadEnrichment.firstResponseDue;
        break;
      case "recent":
        orderBy = desc(threadEnrichment.enrichedAt);
        break;
      default:
        orderBy = threadEnrichment.firstResponseDue;
    }

    const queue = await db.query.threadEnrichment.findMany({
      where: and(...filters),
      orderBy,
      limit: Math.min(parseInt(limit as string), 100),
      offset: parseInt(offset as string),
    });

    // Get total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(threadEnrichment)
      .where(and(...filters));

    const total = totalResult[0]?.count || 0;

    res.json({
      queue,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error: any) {
    console.error("Error fetching support queue:", error);
    res.status(500).json({ error: error.message || "Failed to fetch support queue" });
  }
});

// ============================================
// GET SINGLE THREAD ENRICHMENT
// ============================================

router.get("/queue/:threadId", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;

    const enrichment = await db.query.threadEnrichment.findFirst({
      where: and(
        eq(threadEnrichment.threadId, parseInt(threadId)),
        eq(threadEnrichment.businessId, req.user!.businessId)
      ),
    });

    if (!enrichment) {
      return res.status(404).json({ error: "Thread enrichment not found" });
    }

    res.json({ enrichment });
  } catch (error: any) {
    console.error("Error fetching thread enrichment:", error);
    res.status(500).json({ error: error.message || "Failed to fetch thread enrichment" });
  }
});

// ============================================
// ENRICH THREAD MANUALLY
// ============================================

router.post("/queue/:threadId/enrich", requireAuth, requireRole(["owner", "admin", "staff"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;

    const enrichment = await enrichThread(parseInt(threadId));

    if (!enrichment) {
      return res.status(404).json({ error: "Thread not found or could not be enriched" });
    }

    res.json({ enrichment, message: "Thread enriched successfully" });
  } catch (error: any) {
    console.error("Error enriching thread:", error);
    res.status(500).json({ error: error.message || "Failed to enrich thread" });
  }
});

// ============================================
// RE-ENRICH THREAD (when new messages added)
// ============================================

router.post("/queue/:threadId/reenrich", requireAuth, requireRole(["owner", "admin", "staff"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;

    const enrichment = await reenrichThread(parseInt(threadId));

    if (!enrichment) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json({ enrichment, message: "Thread re-enriched successfully" });
  } catch (error: any) {
    console.error("Error re-enriching thread:", error);
    res.status(500).json({ error: error.message || "Failed to re-enrich thread" });
  }
});

// ============================================
// MARK FIRST RESPONSE SENT
// ============================================

router.post("/queue/:threadId/first-response", requireAuth, requireRole(["owner", "admin", "staff"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;

    await markFirstResponse(parseInt(threadId));

    res.json({ success: true, message: "First response marked" });
  } catch (error: any) {
    console.error("Error marking first response:", error);
    res.status(500).json({ error: error.message || "Failed to mark first response" });
  }
});

// ============================================
// MARK THREAD RESOLVED
// ============================================

router.post("/queue/:threadId/resolve", requireAuth, requireRole(["owner", "admin", "staff"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;
    const { resolutionNotes } = req.body;

    await markThreadResolved(parseInt(threadId));

    // Audit log
    await audit.logEvent({
      action: "support_queue.thread_resolved",
      actor: req.user!.id,
      businessId: req.user!.businessId,
      metadata: { threadId: parseInt(threadId), resolutionNotes },
    });

    res.json({ success: true, message: "Thread marked as resolved" });
  } catch (error: any) {
    console.error("Error resolving thread:", error);
    res.status(500).json({ error: error.message || "Failed to resolve thread" });
  }
});

// ============================================
// UPDATE PRIORITY (manual override)
// ============================================

router.patch("/queue/:threadId/priority", requireAuth, requireRole(["owner", "admin", "staff"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;
    const { priority, reason } = req.body;

    if (!priority || !["urgent", "high", "normal", "low"].includes(priority)) {
      return res.status(400).json({ error: "Valid priority required (urgent, high, normal, low)" });
    }

    // Get enrichment
    const enrichment = await db.query.threadEnrichment.findFirst({
      where: and(
        eq(threadEnrichment.threadId, parseInt(threadId)),
        eq(threadEnrichment.businessId, req.user!.businessId)
      ),
    });

    if (!enrichment) {
      return res.status(404).json({ error: "Thread enrichment not found" });
    }

    // Update priority
    await db.update(threadEnrichment)
      .set({
        priority: priority as Priority,
        priorityReason: reason || `Manual override by ${req.user!.email}`,
        lastUpdatedAt: new Date(),
      })
      .where(eq(threadEnrichment.id, enrichment.id));

    // Audit log
    await audit.logEvent({
      action: "support_queue.priority_updated",
      actor: req.user!.id,
      businessId: req.user!.businessId,
      metadata: {
        threadId: parseInt(threadId),
        oldPriority: enrichment.priority,
        newPriority: priority,
        reason,
      },
    });

    res.json({ success: true, message: "Priority updated" });
  } catch (error: any) {
    console.error("Error updating priority:", error);
    res.status(500).json({ error: error.message || "Failed to update priority" });
  }
});

// ============================================
// GET COVERAGE GAPS (for knowledge team)
// ============================================

router.get("/coverage-gaps", requireAuth, requireRole(["owner", "admin"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = "20", minOccurrences = "3" } = req.query;

    // Query for uncovered/partial intents
    const gaps = await db.execute(sql`
      SELECT
        intent,
        coverage_status,
        COUNT(*) as frequency,
        MAX(last_updated_at) as last_seen,
        MIN(enriched_at) as first_seen,
        ARRAY_AGG(DISTINCT thread_id) as affected_thread_ids
      FROM thread_enrichment
      WHERE business_id = ${req.user!.businessId}
        AND coverage_status IN ('uncovered', 'partial')
        AND enriched_at > NOW() - INTERVAL '30 days'
      GROUP BY intent, coverage_status
      HAVING COUNT(*) >= ${parseInt(minOccurrences as string)}
      ORDER BY frequency DESC
      LIMIT ${parseInt(limit as string)}
    `);

    // Get suggestions for knowledge items
    const uncoveredIntents = (gaps.rows as any[]).map(row => ({
      intent: row.intent,
      frequency: parseInt(row.frequency),
      exampleQuery: "", // Would fetch from thread messages
    }));

    const suggestions = await suggestKnowledgeItems(req.user!.businessId, uncoveredIntents);

    res.json({
      gaps: gaps.rows,
      suggestions,
      count: gaps.rows.length,
    });
  } catch (error: any) {
    console.error("Error fetching coverage gaps:", error);
    res.status(500).json({ error: error.message || "Failed to fetch coverage gaps" });
  }
});

// ============================================
// GET SLA METRICS
// ============================================

router.get("/sla-metrics", requireAuth, requireRole(["owner", "admin"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { days = "7" } = req.query;

    const metrics = await db.execute(sql`
      SELECT
        priority,
        COUNT(*) FILTER (WHERE sla_status = 'breached') as breached_count,
        COUNT(*) FILTER (WHERE sla_status = 'at_risk') as at_risk_count,
        COUNT(*) FILTER (WHERE sla_status = 'on_track') as on_track_count,
        COUNT(*) FILTER (WHERE sla_status = 'resolved') as resolved_count,
        AVG(EXTRACT(EPOCH FROM (first_response_at - enriched_at))) FILTER (WHERE first_response_at IS NOT NULL) / 60 as avg_first_response_minutes,
        AVG(EXTRACT(EPOCH FROM (resolved_at - enriched_at))) FILTER (WHERE resolved_at IS NOT NULL) / 3600 as avg_resolution_hours
      FROM thread_enrichment
      WHERE business_id = ${req.user!.businessId}
        AND enriched_at > NOW() - INTERVAL '${parseInt(days as string)} days'
      GROUP BY priority
      ORDER BY CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END
    `);

    res.json({ metrics: metrics.rows });
  } catch (error: any) {
    console.error("Error fetching SLA metrics:", error);
    res.status(500).json({ error: error.message || "Failed to fetch SLA metrics" });
  }
});

// ============================================
// GET QUEUE STATISTICS
// ============================================

router.get("/stats", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE sla_status != 'resolved') as active_threads,
        COUNT(*) FILTER (WHERE priority = 'urgent' AND sla_status != 'resolved') as urgent_count,
        COUNT(*) FILTER (WHERE sla_status = 'breached') as breached_count,
        COUNT(*) FILTER (WHERE sla_status = 'at_risk') as at_risk_count,
        COUNT(*) FILTER (WHERE coverage_status = 'covered') as covered_count,
        COUNT(*) FILTER (WHERE coverage_status = 'uncovered') as uncovered_count,
        COUNT(*) FILTER (WHERE first_response_at IS NULL AND sla_status != 'resolved') as needs_first_response
      FROM thread_enrichment
      WHERE business_id = ${req.user!.businessId}
        AND enriched_at > NOW() - INTERVAL '30 days'
    `);

    res.json({ stats: stats.rows[0] || {} });
  } catch (error: any) {
    console.error("Error fetching queue stats:", error);
    res.status(500).json({ error: error.message || "Failed to fetch queue stats" });
  }
});

export default router;
