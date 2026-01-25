/**
 * Observability API Routes
 * Sprint 5: Full Migration
 *
 * Provides API endpoints for workflow monitoring and dashboards.
 */

import { Router } from "express";
import {
  getDashboardData,
  getWorkflowMetrics,
  getTaskQueueMetrics,
  getFinOpsMetrics,
  getStepMetrics,
  getRecentActivity,
  checkHealth,
} from "./observability";
import {
  getAdapterConfig,
  updateAdapterConfig,
  getAdapterMetrics,
  shouldUseTemporal,
  queryWorkflowStatus,
  getWorkflowResult,
} from "./adapter";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

// =============================================================================
// Dashboard Endpoints
// =============================================================================

/**
 * GET /api/observability/dashboard
 * Get complete dashboard data for monitoring UI
 */
router.get("/dashboard", async (req, res) => {
  try {
    const data = await getDashboardData();
    res.json({ success: true, data });
  } catch (err) {
    console.error("[ObservabilityAPI] Dashboard error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch dashboard data" });
  }
});

/**
 * GET /api/observability/health
 * Health check endpoint
 */
router.get("/health", async (req, res) => {
  try {
    const health = await checkHealth();
    const statusCode = health.healthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (err) {
    res.status(503).json({
      healthy: false,
      checks: { database: false, temporalConnection: false, activeWorkflows: false, taskQueueHealth: false },
      issues: ["Health check failed: " + String(err)],
    });
  }
});

// =============================================================================
// Metrics Endpoints
// =============================================================================

/**
 * GET /api/observability/metrics/workflows
 * Get workflow-specific metrics
 */
router.get("/metrics/workflows", async (req, res) => {
  try {
    const metrics = await getWorkflowMetrics();
    res.json({ success: true, metrics });
  } catch (err) {
    console.error("[ObservabilityAPI] Workflow metrics error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch workflow metrics" });
  }
});

/**
 * GET /api/observability/metrics/tasks
 * Get human task queue metrics
 */
router.get("/metrics/tasks", async (req, res) => {
  try {
    const metrics = await getTaskQueueMetrics();
    res.json({ success: true, metrics });
  } catch (err) {
    console.error("[ObservabilityAPI] Task metrics error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch task metrics" });
  }
});

/**
 * GET /api/observability/metrics/finops
 * Get FinOps metrics
 */
router.get("/metrics/finops", async (req, res) => {
  try {
    const metrics = await getFinOpsMetrics();
    res.json({ success: true, metrics });
  } catch (err) {
    console.error("[ObservabilityAPI] FinOps metrics error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch FinOps metrics" });
  }
});

/**
 * GET /api/observability/metrics/steps
 * Get workflow step metrics
 */
router.get("/metrics/steps", async (req, res) => {
  try {
    const metrics = await getStepMetrics();
    res.json({ success: true, metrics });
  } catch (err) {
    console.error("[ObservabilityAPI] Step metrics error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch step metrics" });
  }
});

/**
 * GET /api/observability/activity
 * Get recent activity feed
 */
router.get("/activity", async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const activity = await getRecentActivity(limit);
    res.json({ success: true, activity });
  } catch (err) {
    console.error("[ObservabilityAPI] Activity error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch activity" });
  }
});

// =============================================================================
// Adapter Configuration Endpoints
// =============================================================================

/**
 * GET /api/observability/adapter/config
 * Get current adapter configuration
 */
router.get("/adapter/config", async (req, res) => {
  try {
    const config = getAdapterConfig();
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get adapter config" });
  }
});

/**
 * PUT /api/observability/adapter/config
 * Update adapter configuration
 */
router.put("/adapter/config", async (req, res) => {
  try {
    const updates = req.body;

    // Validate updates
    if (updates.rolloutPercent !== undefined) {
      const percent = Number(updates.rolloutPercent);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        return res.status(400).json({ success: false, error: "rolloutPercent must be 0-100" });
      }
      updates.rolloutPercent = percent;
    }

    if (updates.enabled !== undefined) {
      updates.enabled = Boolean(updates.enabled);
    }

    updateAdapterConfig(updates);
    const config = getAdapterConfig();

    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to update adapter config" });
  }
});

/**
 * GET /api/observability/adapter/metrics
 * Get adapter routing metrics
 */
router.get("/adapter/metrics", async (req, res) => {
  try {
    const metrics = getAdapterMetrics();
    res.json({ success: true, metrics });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get adapter metrics" });
  }
});

/**
 * POST /api/observability/adapter/check-routing
 * Check how a specific request would be routed
 */
router.post("/adapter/check-routing", async (req, res) => {
  try {
    const { workflowType, businessId } = req.body;

    if (!workflowType || !businessId) {
      return res.status(400).json({ success: false, error: "workflowType and businessId required" });
    }

    const decision = shouldUseTemporal(workflowType, Number(businessId));
    res.json({ success: true, decision });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to check routing" });
  }
});

// =============================================================================
// Workflow Query Endpoints
// =============================================================================

/**
 * GET /api/observability/workflows
 * List workflows with optional filters
 */
router.get("/workflows", async (req, res) => {
  try {
    const {
      status,
      type,
      businessId,
      limit = "50",
      offset = "0",
    } = req.query;

    let query = `
      SELECT
        id, workflow_id, run_id, workflow_type, account_id, business_id,
        primary_entity_type, primary_entity_id, status, current_stage,
        task_queue, started_at, completed_at
      FROM workflow_runs
      WHERE 1=1
    `;

    const params: any[] = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (type) {
      params.push(type);
      query += ` AND workflow_type = $${params.length}`;
    }

    if (businessId) {
      params.push(Number(businessId));
      query += ` AND business_id = $${params.length}`;
    }

    query += ` ORDER BY started_at DESC`;

    params.push(Number(limit));
    query += ` LIMIT $${params.length}`;

    params.push(Number(offset));
    query += ` OFFSET $${params.length}`;

    const result = await db.execute(sql.raw(query));

    res.json({ success: true, workflows: result.rows });
  } catch (err) {
    console.error("[ObservabilityAPI] List workflows error:", err);
    res.status(500).json({ success: false, error: "Failed to list workflows" });
  }
});

/**
 * GET /api/observability/workflows/:workflowId
 * Get workflow details including steps
 */
router.get("/workflows/:workflowId", async (req, res) => {
  try {
    const { workflowId } = req.params;

    // Get workflow
    const workflowResult = await db.execute(sql`
      SELECT * FROM workflow_runs WHERE workflow_id = ${workflowId} LIMIT 1
    `);

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Workflow not found" });
    }

    const workflow = workflowResult.rows[0];

    // Get steps
    const stepsResult = await db.execute(sql`
      SELECT * FROM workflow_steps
      WHERE workflow_run_id = ${(workflow as any).id}
      ORDER BY step_index ASC
    `);

    // Get human tasks
    const tasksResult = await db.execute(sql`
      SELECT * FROM human_tasks
      WHERE workflow_run_id = ${(workflow as any).id}
      ORDER BY created_at ASC
    `);

    // Try to query live status from Temporal
    let liveStatus = null;
    try {
      const statusResult = await queryWorkflowStatus(workflowId);
      if (statusResult.success) {
        liveStatus = statusResult.result;
      }
    } catch (err) {
      // Ignore - workflow may not be running in Temporal
    }

    res.json({
      success: true,
      workflow,
      steps: stepsResult.rows,
      humanTasks: tasksResult.rows,
      liveStatus,
    });
  } catch (err) {
    console.error("[ObservabilityAPI] Get workflow error:", err);
    res.status(500).json({ success: false, error: "Failed to get workflow" });
  }
});

/**
 * GET /api/observability/workflows/:workflowId/result
 * Get workflow result (for completed workflows)
 */
router.get("/workflows/:workflowId/result", async (req, res) => {
  try {
    const { workflowId } = req.params;
    const result = await getWorkflowResult(workflowId);

    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[ObservabilityAPI] Get workflow result error:", err);
    res.status(500).json({ success: false, error: "Failed to get workflow result" });
  }
});

// =============================================================================
// Daily Summary Endpoint
// =============================================================================

/**
 * GET /api/observability/summary/daily
 * Get daily usage summary
 */
router.get("/summary/daily", async (req, res) => {
  try {
    const days = Math.min(30, Math.max(1, parseInt(req.query.days as string) || 7));
    const businessId = req.query.businessId ? Number(req.query.businessId) : undefined;

    let query = `
      SELECT
        DATE(request_timestamp) as date,
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(cost_microdollars) as total_cost_microdollars,
        COUNT(DISTINCT workflow_run_id) as unique_workflows
      FROM usage_ledger
      WHERE request_timestamp >= CURRENT_DATE - INTERVAL '${days} days'
    `;

    if (businessId) {
      query += ` AND business_id = ${businessId}`;
    }

    query += ` GROUP BY DATE(request_timestamp) ORDER BY date DESC`;

    const result = await db.execute(sql.raw(query));

    // Convert microdollars to dollars for readability
    const summary = (result.rows as any[]).map(row => ({
      date: row.date,
      totalRequests: Number(row.total_requests),
      totalTokens: Number(row.total_tokens),
      totalCostUsd: Number(row.total_cost_microdollars) / 1000000,
      uniqueWorkflows: Number(row.unique_workflows),
    }));

    res.json({ success: true, summary });
  } catch (err) {
    console.error("[ObservabilityAPI] Daily summary error:", err);
    res.status(500).json({ success: false, error: "Failed to get daily summary" });
  }
});

/**
 * GET /api/observability/summary/monthly
 * Get monthly usage summary
 */
router.get("/summary/monthly", async (req, res) => {
  try {
    const months = Math.min(12, Math.max(1, parseInt(req.query.months as string) || 3));
    const businessId = req.query.businessId ? Number(req.query.businessId) : undefined;

    let query = `
      SELECT
        DATE_TRUNC('month', request_timestamp) as month,
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(cost_microdollars) as total_cost_microdollars,
        COUNT(DISTINCT workflow_run_id) as unique_workflows,
        COUNT(DISTINCT business_id) as active_businesses
      FROM usage_ledger
      WHERE request_timestamp >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '${months} months'
    `;

    if (businessId) {
      query += ` AND business_id = ${businessId}`;
    }

    query += ` GROUP BY DATE_TRUNC('month', request_timestamp) ORDER BY month DESC`;

    const result = await db.execute(sql.raw(query));

    const summary = (result.rows as any[]).map(row => ({
      month: row.month,
      totalRequests: Number(row.total_requests),
      totalTokens: Number(row.total_tokens),
      totalCostUsd: Number(row.total_cost_microdollars) / 1000000,
      uniqueWorkflows: Number(row.unique_workflows),
      activeBusinesses: Number(row.active_businesses),
    }));

    res.json({ success: true, summary });
  } catch (err) {
    console.error("[ObservabilityAPI] Monthly summary error:", err);
    res.status(500).json({ success: false, error: "Failed to get monthly summary" });
  }
});

export default router;
