/**
 * Temporal Observability Setup
 * Sprint 5: Full Migration
 *
 * Provides metrics, tracing, and dashboard data for Temporal workflows.
 */

import { db } from "../db";
import { sql, eq, and, gte, lte, desc, count } from "drizzle-orm";

// =============================================================================
// Types
// =============================================================================

export interface WorkflowMetrics {
  activeWorkflows: number;
  completedToday: number;
  failedToday: number;
  avgDurationMs: number;
  byType: Record<string, { active: number; completed: number; failed: number }>;
  byStatus: Record<string, number>;
}

export interface TaskQueueMetrics {
  pendingTasks: number;
  tasksCompletedToday: number;
  avgResolutionTimeMs: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  oldestPendingTask?: {
    id: number;
    title: string;
    createdAt: Date;
    ageHours: number;
  };
}

export interface FinOpsMetrics {
  totalSpendToday: number;
  totalSpendThisMonth: number;
  avgCostPerWorkflow: number;
  byModel: Record<string, { tokens: number; cost: number }>;
  budgetAlerts: number;
  businessesOverBudget: number;
}

export interface StepMetrics {
  totalStepsToday: number;
  failedStepsToday: number;
  avgStepDurationMs: number;
  byActivity: Record<string, { count: number; avgDuration: number; failureRate: number }>;
}

export interface DashboardData {
  workflows: WorkflowMetrics;
  taskQueue: TaskQueueMetrics;
  finops: FinOpsMetrics;
  steps: StepMetrics;
  recentActivity: Array<{
    timestamp: Date;
    type: string;
    description: string;
    workflowId?: string;
    status: string;
  }>;
}

// =============================================================================
// Metrics Collection
// =============================================================================

/**
 * Get workflow metrics from database
 */
export async function getWorkflowMetrics(): Promise<WorkflowMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Active workflows
    const activeResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM workflow_runs WHERE status IN ('running', 'waiting_customer', 'waiting_ops')
    `);
    const activeWorkflows = Number((activeResult.rows[0] as any)?.count || 0);

    // Completed today
    const completedResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM workflow_runs
      WHERE status = 'completed' AND completed_at >= ${today}
    `);
    const completedToday = Number((completedResult.rows[0] as any)?.count || 0);

    // Failed today
    const failedResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM workflow_runs
      WHERE status = 'failed' AND completed_at >= ${today}
    `);
    const failedToday = Number((failedResult.rows[0] as any)?.count || 0);

    // Average duration
    const avgDurationResult = await db.execute(sql`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000) as avg_ms
      FROM workflow_runs
      WHERE completed_at IS NOT NULL AND started_at IS NOT NULL
      AND completed_at >= ${today}
    `);
    const avgDurationMs = Number((avgDurationResult.rows[0] as any)?.avg_ms || 0);

    // By type
    const byTypeResult = await db.execute(sql`
      SELECT
        workflow_type,
        COUNT(*) FILTER (WHERE status IN ('running', 'waiting_customer', 'waiting_ops')) as active,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= ${today}) as completed,
        COUNT(*) FILTER (WHERE status = 'failed' AND completed_at >= ${today}) as failed
      FROM workflow_runs
      GROUP BY workflow_type
    `);

    const byType: Record<string, { active: number; completed: number; failed: number }> = {};
    for (const row of byTypeResult.rows as any[]) {
      byType[row.workflow_type] = {
        active: Number(row.active || 0),
        completed: Number(row.completed || 0),
        failed: Number(row.failed || 0),
      };
    }

    // By status
    const byStatusResult = await db.execute(sql`
      SELECT status, COUNT(*) as count FROM workflow_runs GROUP BY status
    `);

    const byStatus: Record<string, number> = {};
    for (const row of byStatusResult.rows as any[]) {
      byStatus[row.status] = Number(row.count || 0);
    }

    return {
      activeWorkflows,
      completedToday,
      failedToday,
      avgDurationMs,
      byType,
      byStatus,
    };
  } catch (err) {
    console.error("[Observability] Error getting workflow metrics:", err);
    return {
      activeWorkflows: 0,
      completedToday: 0,
      failedToday: 0,
      avgDurationMs: 0,
      byType: {},
      byStatus: {},
    };
  }
}

/**
 * Get human task queue metrics
 */
export async function getTaskQueueMetrics(): Promise<TaskQueueMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Pending tasks
    const pendingResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM human_tasks WHERE status = 'pending'
    `);
    const pendingTasks = Number((pendingResult.rows[0] as any)?.count || 0);

    // Completed today
    const completedResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM human_tasks
      WHERE status IN ('resolved', 'completed') AND resolved_at >= ${today}
    `);
    const tasksCompletedToday = Number((completedResult.rows[0] as any)?.count || 0);

    // Average resolution time
    const avgTimeResult = await db.execute(sql`
      SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000) as avg_ms
      FROM human_tasks
      WHERE resolved_at IS NOT NULL AND created_at IS NOT NULL
      AND resolved_at >= ${today}
    `);
    const avgResolutionTimeMs = Number((avgTimeResult.rows[0] as any)?.avg_ms || 0);

    // By category
    const byCategoryResult = await db.execute(sql`
      SELECT category, COUNT(*) as count FROM human_tasks
      WHERE status = 'pending' GROUP BY category
    `);

    const byCategory: Record<string, number> = {};
    for (const row of byCategoryResult.rows as any[]) {
      byCategory[row.category] = Number(row.count || 0);
    }

    // By priority
    const byPriorityResult = await db.execute(sql`
      SELECT priority, COUNT(*) as count FROM human_tasks
      WHERE status = 'pending' GROUP BY priority
    `);

    const byPriority: Record<string, number> = {};
    for (const row of byPriorityResult.rows as any[]) {
      byPriority[row.priority || "normal"] = Number(row.count || 0);
    }

    // Oldest pending task
    const oldestResult = await db.execute(sql`
      SELECT id, title, created_at
      FROM human_tasks
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `);

    let oldestPendingTask: TaskQueueMetrics["oldestPendingTask"];
    if (oldestResult.rows.length > 0) {
      const row = oldestResult.rows[0] as any;
      const createdAt = new Date(row.created_at);
      const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      oldestPendingTask = {
        id: row.id,
        title: row.title,
        createdAt,
        ageHours,
      };
    }

    return {
      pendingTasks,
      tasksCompletedToday,
      avgResolutionTimeMs,
      byCategory,
      byPriority,
      oldestPendingTask,
    };
  } catch (err) {
    console.error("[Observability] Error getting task queue metrics:", err);
    return {
      pendingTasks: 0,
      tasksCompletedToday: 0,
      avgResolutionTimeMs: 0,
      byCategory: {},
      byPriority: {},
    };
  }
}

/**
 * Get FinOps metrics
 */
export async function getFinOpsMetrics(): Promise<FinOpsMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  try {
    // Total spend today
    const todaySpendResult = await db.execute(sql`
      SELECT COALESCE(SUM(cost_microdollars), 0) as total
      FROM usage_ledger
      WHERE request_timestamp >= ${today}
    `);
    const totalSpendToday = Number((todaySpendResult.rows[0] as any)?.total || 0);

    // Total spend this month
    const monthSpendResult = await db.execute(sql`
      SELECT COALESCE(SUM(cost_microdollars), 0) as total
      FROM usage_ledger
      WHERE request_timestamp >= ${monthStart}
    `);
    const totalSpendThisMonth = Number((monthSpendResult.rows[0] as any)?.total || 0);

    // Average cost per workflow
    const avgCostResult = await db.execute(sql`
      SELECT AVG(total_cost) as avg_cost FROM (
        SELECT workflow_run_id, SUM(cost_microdollars) as total_cost
        FROM usage_ledger
        WHERE workflow_run_id IS NOT NULL AND request_timestamp >= ${monthStart}
        GROUP BY workflow_run_id
      ) sub
    `);
    const avgCostPerWorkflow = Number((avgCostResult.rows[0] as any)?.avg_cost || 0);

    // By model
    const byModelResult = await db.execute(sql`
      SELECT
        model_id,
        SUM(total_tokens) as tokens,
        SUM(cost_microdollars) as cost
      FROM usage_ledger
      WHERE request_timestamp >= ${monthStart}
      GROUP BY model_id
    `);

    const byModel: Record<string, { tokens: number; cost: number }> = {};
    for (const row of byModelResult.rows as any[]) {
      byModel[row.model_id] = {
        tokens: Number(row.tokens || 0),
        cost: Number(row.cost || 0),
      };
    }

    // Budget alerts
    const alertsResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM budget_alerts
      WHERE created_at >= ${today} AND acknowledged_at IS NULL
    `);
    const budgetAlerts = Number((alertsResult.rows[0] as any)?.count || 0);

    // Businesses over budget
    const overBudgetResult = await db.execute(sql`
      SELECT COUNT(DISTINCT bc.business_id) as count
      FROM budget_configs bc
      JOIN (
        SELECT business_id, SUM(cost_microdollars) as monthly_spend
        FROM usage_ledger
        WHERE request_timestamp >= ${monthStart}
        GROUP BY business_id
      ) usage ON bc.business_id = usage.business_id
      WHERE usage.monthly_spend > bc.monthly_budget_microdollars
    `);
    const businessesOverBudget = Number((overBudgetResult.rows[0] as any)?.count || 0);

    return {
      totalSpendToday,
      totalSpendThisMonth,
      avgCostPerWorkflow,
      byModel,
      budgetAlerts,
      businessesOverBudget,
    };
  } catch (err) {
    console.error("[Observability] Error getting FinOps metrics:", err);
    return {
      totalSpendToday: 0,
      totalSpendThisMonth: 0,
      avgCostPerWorkflow: 0,
      byModel: {},
      budgetAlerts: 0,
      businessesOverBudget: 0,
    };
  }
}

/**
 * Get workflow step metrics
 */
export async function getStepMetrics(): Promise<StepMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Total steps today
    const totalResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM workflow_steps
      WHERE started_at >= ${today}
    `);
    const totalStepsToday = Number((totalResult.rows[0] as any)?.count || 0);

    // Failed steps today
    const failedResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM workflow_steps
      WHERE status = 'failed' AND started_at >= ${today}
    `);
    const failedStepsToday = Number((failedResult.rows[0] as any)?.count || 0);

    // Average step duration
    const avgDurationResult = await db.execute(sql`
      SELECT AVG(duration_ms) as avg_ms FROM workflow_steps
      WHERE duration_ms IS NOT NULL AND started_at >= ${today}
    `);
    const avgStepDurationMs = Number((avgDurationResult.rows[0] as any)?.avg_ms || 0);

    // By activity
    const byActivityResult = await db.execute(sql`
      SELECT
        activity_type,
        COUNT(*) as total,
        AVG(duration_ms) as avg_duration,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM workflow_steps
      WHERE started_at >= ${today}
      GROUP BY activity_type
    `);

    const byActivity: Record<string, { count: number; avgDuration: number; failureRate: number }> = {};
    for (const row of byActivityResult.rows as any[]) {
      const total = Number(row.total || 0);
      const failed = Number(row.failed || 0);
      byActivity[row.activity_type] = {
        count: total,
        avgDuration: Number(row.avg_duration || 0),
        failureRate: total > 0 ? (failed / total) * 100 : 0,
      };
    }

    return {
      totalStepsToday,
      failedStepsToday,
      avgStepDurationMs,
      byActivity,
    };
  } catch (err) {
    console.error("[Observability] Error getting step metrics:", err);
    return {
      totalStepsToday: 0,
      failedStepsToday: 0,
      avgStepDurationMs: 0,
      byActivity: {},
    };
  }
}

/**
 * Get recent activity for dashboard
 */
export async function getRecentActivity(limit: number = 20): Promise<DashboardData["recentActivity"]> {
  try {
    const result = await db.execute(sql`
      (
        SELECT
          started_at as timestamp,
          'workflow_started' as type,
          CONCAT('Started ', workflow_type, ' workflow') as description,
          workflow_id,
          status
        FROM workflow_runs
        WHERE started_at IS NOT NULL
        ORDER BY started_at DESC
        LIMIT ${limit}
      )
      UNION ALL
      (
        SELECT
          completed_at as timestamp,
          'workflow_completed' as type,
          CONCAT('Completed ', workflow_type, ' workflow') as description,
          workflow_id,
          status
        FROM workflow_runs
        WHERE completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT ${limit}
      )
      UNION ALL
      (
        SELECT
          created_at as timestamp,
          'task_created' as type,
          title as description,
          NULL as workflow_id,
          status
        FROM human_tasks
        ORDER BY created_at DESC
        LIMIT ${limit}
      )
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `);

    return (result.rows as any[]).map(row => ({
      timestamp: new Date(row.timestamp),
      type: row.type,
      description: row.description,
      workflowId: row.workflow_id || undefined,
      status: row.status,
    }));
  } catch (err) {
    console.error("[Observability] Error getting recent activity:", err);
    return [];
  }
}

/**
 * Get complete dashboard data
 */
export async function getDashboardData(): Promise<DashboardData> {
  const [workflows, taskQueue, finops, steps, recentActivity] = await Promise.all([
    getWorkflowMetrics(),
    getTaskQueueMetrics(),
    getFinOpsMetrics(),
    getStepMetrics(),
    getRecentActivity(),
  ]);

  return {
    workflows,
    taskQueue,
    finops,
    steps,
    recentActivity,
  };
}

// =============================================================================
// Health Check
// =============================================================================

export interface HealthStatus {
  healthy: boolean;
  checks: {
    database: boolean;
    temporalConnection: boolean;
    activeWorkflows: boolean;
    taskQueueHealth: boolean;
  };
  issues: string[];
}

/**
 * Check system health
 */
export async function checkHealth(): Promise<HealthStatus> {
  const issues: string[] = [];
  const checks = {
    database: false,
    temporalConnection: false,
    activeWorkflows: true,
    taskQueueHealth: true,
  };

  // Database check
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = true;
  } catch (err) {
    issues.push("Database connection failed");
  }

  // Temporal connection check
  try {
    const { getTemporalClient } = await import("./client");
    const client = await getTemporalClient();
    // Simple check - try to describe a nonexistent workflow (should throw specific error)
    try {
      await client.workflow.getHandle("health-check-nonexistent").describe();
    } catch (err: any) {
      // If we get "not found" error, Temporal is working
      if (err.message?.includes("not found") || err.code === "NOT_FOUND") {
        checks.temporalConnection = true;
      }
    }
  } catch (err) {
    issues.push("Temporal connection failed");
  }

  // Check for stuck workflows (active > 1 hour with no progress)
  try {
    const stuckResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM workflow_runs
      WHERE status IN ('running', 'waiting_customer', 'waiting_ops')
      AND updated_at < NOW() - INTERVAL '6 hours'
    `);
    const stuckCount = Number((stuckResult.rows[0] as any)?.count || 0);
    if (stuckCount > 0) {
      issues.push(`${stuckCount} workflows may be stuck (no progress in 6+ hours)`);
      checks.activeWorkflows = false;
    }
  } catch (err) {
    // Ignore
  }

  // Check task queue health (tasks pending > 24 hours)
  try {
    const oldTasksResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM human_tasks
      WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '24 hours'
    `);
    const oldTasksCount = Number((oldTasksResult.rows[0] as any)?.count || 0);
    if (oldTasksCount > 5) {
      issues.push(`${oldTasksCount} tasks pending for 24+ hours`);
      checks.taskQueueHealth = false;
    }
  } catch (err) {
    // Ignore
  }

  return {
    healthy: issues.length === 0,
    checks,
    issues,
  };
}
