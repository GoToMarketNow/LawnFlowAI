/**
 * FinOps API Routes
 *
 * REST API for budget management and usage tracking:
 * - GET /budget - Get current budget status
 * - PUT /budget - Update budget configuration
 * - GET /usage - Get usage statistics
 * - GET /usage/daily - Get daily usage breakdown
 * - GET /alerts - Get budget alerts
 * - POST /alerts/:id/acknowledge - Acknowledge an alert
 *
 * @module server/temporal/api-finops
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '@db';
import { eq, and, gte, desc, sql, lte } from 'drizzle-orm';
import {
  usageLedger,
  budgetConfigs,
  budgetAlerts,
  modelRoutingRules,
} from '@shared/schema-finops';

const router = Router();

// ============================================================================
// Budget Management
// ============================================================================

/**
 * GET /api/finops/budget
 * Get current budget status for a business
 */
router.get('/budget', async (req: Request, res: Response) => {
  try {
    const businessId = parseInt(req.query.businessId as string);

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    // Get budget config
    const config = await db.query.budgetConfigs.findFirst({
      where: eq(budgetConfigs.businessId, businessId),
    });

    // Get current month usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usageResult = await db
      .select({
        totalCost: sql<number>`COALESCE(SUM(${usageLedger.costMicrodollars}), 0)`,
        totalTokens: sql<number>`COALESCE(SUM(${usageLedger.totalTokens}), 0)`,
        requestCount: sql<number>`COUNT(*)`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.businessId, businessId),
          gte(usageLedger.requestTimestamp, startOfMonth)
        )
      );

    const usage = usageResult[0] || { totalCost: 0, totalTokens: 0, requestCount: 0 };

    // Default config if none exists
    const budget = config || {
      monthlyBudgetMicrodollars: 10000000, // $10 default
      warningThresholdPercent: 80,
      criticalThresholdPercent: 95,
      hardCapPercent: 100,
      preferredModel: 'gpt-4o-mini',
      fallbackModel: 'gpt-3.5-turbo',
      allowPremiumModels: false,
      onBudgetExceeded: 'downgrade',
    };

    const usagePercent = (usage.totalCost / budget.monthlyBudgetMicrodollars) * 100;
    const remainingBudget = Math.max(0, budget.monthlyBudgetMicrodollars - usage.totalCost);

    let status = 'ok';
    if (usagePercent >= budget.hardCapPercent) status = 'exceeded';
    else if (usagePercent >= budget.criticalThresholdPercent) status = 'critical';
    else if (usagePercent >= budget.warningThresholdPercent) status = 'warning';

    res.json({
      budget: {
        monthlyBudgetMicrodollars: budget.monthlyBudgetMicrodollars,
        monthlyBudgetUsd: budget.monthlyBudgetMicrodollars / 1000000,
        warningThresholdPercent: budget.warningThresholdPercent,
        criticalThresholdPercent: budget.criticalThresholdPercent,
        hardCapPercent: budget.hardCapPercent,
        preferredModel: budget.preferredModel,
        fallbackModel: budget.fallbackModel,
        allowPremiumModels: budget.allowPremiumModels,
        onBudgetExceeded: budget.onBudgetExceeded,
      },
      usage: {
        currentMonthCostMicrodollars: usage.totalCost,
        currentMonthCostUsd: usage.totalCost / 1000000,
        currentMonthTokens: usage.totalTokens,
        currentMonthRequests: usage.requestCount,
        usagePercent: Math.round(usagePercent * 100) / 100,
        remainingBudgetMicrodollars: remainingBudget,
        remainingBudgetUsd: remainingBudget / 1000000,
      },
      status,
      hasConfig: !!config,
    });
  } catch (error) {
    console.error('[FinOps API] Error getting budget:', error);
    res.status(500).json({ error: 'Failed to get budget status' });
  }
});

/**
 * PUT /api/finops/budget
 * Update budget configuration
 */
router.put('/budget', async (req: Request, res: Response) => {
  const schema = z.object({
    businessId: z.number(),
    accountId: z.string(),
    monthlyBudgetMicrodollars: z.number().optional(),
    warningThresholdPercent: z.number().min(0).max(100).optional(),
    criticalThresholdPercent: z.number().min(0).max(100).optional(),
    hardCapPercent: z.number().min(0).max(100).optional(),
    preferredModel: z.string().optional(),
    fallbackModel: z.string().optional(),
    allowPremiumModels: z.boolean().optional(),
    onBudgetExceeded: z.enum(['downgrade', 'block', 'alert_only']).optional(),
    dailyLimitMicrodollars: z.number().optional(),
    maxRequestsPerMinute: z.number().optional(),
    alertEmail: z.string().email().optional(),
    alertWebhookUrl: z.string().url().optional(),
  });

  try {
    const validated = schema.parse(req.body);

    // Check if config exists
    const existing = await db.query.budgetConfigs.findFirst({
      where: eq(budgetConfigs.businessId, validated.businessId),
    });

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(budgetConfigs)
        .set({
          ...validated,
          updatedAt: new Date(),
        })
        .where(eq(budgetConfigs.businessId, validated.businessId))
        .returning();

      res.json({ success: true, config: updated });
    } else {
      // Create new
      const [created] = await db
        .insert(budgetConfigs)
        .values(validated)
        .returning();

      res.json({ success: true, config: created });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[FinOps API] Error updating budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

// ============================================================================
// Usage Statistics
// ============================================================================

/**
 * GET /api/finops/usage
 * Get usage statistics
 */
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const businessId = parseInt(req.query.businessId as string);
    const days = parseInt(req.query.days as string) || 30;

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Total usage
    const totalResult = await db
      .select({
        totalCost: sql<number>`COALESCE(SUM(${usageLedger.costMicrodollars}), 0)`,
        totalTokens: sql<number>`COALESCE(SUM(${usageLedger.totalTokens}), 0)`,
        totalPromptTokens: sql<number>`COALESCE(SUM(${usageLedger.promptTokens}), 0)`,
        totalCompletionTokens: sql<number>`COALESCE(SUM(${usageLedger.completionTokens}), 0)`,
        requestCount: sql<number>`COUNT(*)`,
        avgLatency: sql<number>`COALESCE(AVG(${usageLedger.latencyMs}), 0)`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.businessId, businessId),
          gte(usageLedger.requestTimestamp, startDate)
        )
      );

    // By model
    const byModelResult = await db
      .select({
        modelId: usageLedger.modelId,
        modelProvider: usageLedger.modelProvider,
        totalCost: sql<number>`SUM(${usageLedger.costMicrodollars})`,
        totalTokens: sql<number>`SUM(${usageLedger.totalTokens})`,
        requestCount: sql<number>`COUNT(*)`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.businessId, businessId),
          gte(usageLedger.requestTimestamp, startDate)
        )
      )
      .groupBy(usageLedger.modelId, usageLedger.modelProvider)
      .orderBy(desc(sql`SUM(${usageLedger.costMicrodollars})`));

    // By activity type
    const byActivityResult = await db
      .select({
        activityType: usageLedger.activityType,
        totalCost: sql<number>`SUM(${usageLedger.costMicrodollars})`,
        totalTokens: sql<number>`SUM(${usageLedger.totalTokens})`,
        requestCount: sql<number>`COUNT(*)`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.businessId, businessId),
          gte(usageLedger.requestTimestamp, startDate)
        )
      )
      .groupBy(usageLedger.activityType)
      .orderBy(desc(sql`SUM(${usageLedger.costMicrodollars})`));

    const total = totalResult[0];

    res.json({
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days,
      },
      totals: {
        costMicrodollars: total.totalCost,
        costUsd: total.totalCost / 1000000,
        totalTokens: total.totalTokens,
        promptTokens: total.totalPromptTokens,
        completionTokens: total.totalCompletionTokens,
        requestCount: total.requestCount,
        avgLatencyMs: Math.round(total.avgLatency),
      },
      byModel: byModelResult.map((row) => ({
        modelId: row.modelId,
        modelProvider: row.modelProvider,
        costMicrodollars: row.totalCost,
        costUsd: row.totalCost / 1000000,
        totalTokens: row.totalTokens,
        requestCount: row.requestCount,
      })),
      byActivity: byActivityResult.map((row) => ({
        activityType: row.activityType,
        costMicrodollars: row.totalCost,
        costUsd: row.totalCost / 1000000,
        totalTokens: row.totalTokens,
        requestCount: row.requestCount,
      })),
    });
  } catch (error) {
    console.error('[FinOps API] Error getting usage:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
});

/**
 * GET /api/finops/usage/daily
 * Get daily usage breakdown
 */
router.get('/usage/daily', async (req: Request, res: Response) => {
  try {
    const businessId = parseInt(req.query.businessId as string);
    const days = parseInt(req.query.days as string) || 30;

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const dailyResult = await db
      .select({
        date: sql<string>`DATE(${usageLedger.requestTimestamp})`,
        totalCost: sql<number>`SUM(${usageLedger.costMicrodollars})`,
        totalTokens: sql<number>`SUM(${usageLedger.totalTokens})`,
        requestCount: sql<number>`COUNT(*)`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.businessId, businessId),
          gte(usageLedger.requestTimestamp, startDate)
        )
      )
      .groupBy(sql`DATE(${usageLedger.requestTimestamp})`)
      .orderBy(sql`DATE(${usageLedger.requestTimestamp})`);

    res.json({
      daily: dailyResult.map((row) => ({
        date: row.date,
        costMicrodollars: row.totalCost,
        costUsd: row.totalCost / 1000000,
        totalTokens: row.totalTokens,
        requestCount: row.requestCount,
      })),
    });
  } catch (error) {
    console.error('[FinOps API] Error getting daily usage:', error);
    res.status(500).json({ error: 'Failed to get daily usage' });
  }
});

// ============================================================================
// Alerts
// ============================================================================

/**
 * GET /api/finops/alerts
 * Get budget alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const businessId = parseInt(req.query.businessId as string);
    const acknowledged = req.query.acknowledged === 'true';
    const limit = parseInt(req.query.limit as string) || 20;

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const conditions = [eq(budgetAlerts.businessId, businessId)];

    if (!acknowledged) {
      conditions.push(sql`${budgetAlerts.acknowledgedAt} IS NULL`);
    }

    const alerts = await db.query.budgetAlerts.findMany({
      where: and(...conditions),
      orderBy: [desc(budgetAlerts.createdAt)],
      limit,
    });

    res.json({
      alerts: alerts.map((alert) => ({
        id: alert.id,
        alertType: alert.alertType,
        thresholdPercent: alert.thresholdPercent,
        currentUsageMicrodollars: alert.currentUsageMicrodollars,
        currentUsageUsd: alert.currentUsageMicrodollars / 1000000,
        budgetLimitMicrodollars: alert.budgetLimitMicrodollars,
        budgetLimitUsd: alert.budgetLimitMicrodollars / 1000000,
        usagePercent: Math.round(
          (alert.currentUsageMicrodollars / alert.budgetLimitMicrodollars) * 10000
        ) / 100,
        periodStart: alert.periodStart,
        periodEnd: alert.periodEnd,
        acknowledgedAt: alert.acknowledgedAt,
        createdAt: alert.createdAt,
      })),
    });
  } catch (error) {
    console.error('[FinOps API] Error getting alerts:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * POST /api/finops/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const alertId = parseInt(req.params.alertId);
    const userId = req.body.userId; // Optional: user who acknowledged

    if (!alertId) {
      return res.status(400).json({ error: 'alertId is required' });
    }

    const [updated] = await db
      .update(budgetAlerts)
      .set({
        acknowledgedAt: new Date(),
        acknowledgedByUserId: userId,
      })
      .where(eq(budgetAlerts.id, alertId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ success: true, alert: updated });
  } catch (error) {
    console.error('[FinOps API] Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// ============================================================================
// Model Routing Rules
// ============================================================================

/**
 * GET /api/finops/routing-rules
 * Get model routing rules
 */
router.get('/routing-rules', async (req: Request, res: Response) => {
  try {
    const businessId = parseInt(req.query.businessId as string);

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    const rules = await db.query.modelRoutingRules.findMany({
      where: eq(modelRoutingRules.businessId, businessId),
      orderBy: [desc(modelRoutingRules.priority)],
    });

    res.json({ rules });
  } catch (error) {
    console.error('[FinOps API] Error getting routing rules:', error);
    res.status(500).json({ error: 'Failed to get routing rules' });
  }
});

/**
 * POST /api/finops/routing-rules
 * Create a model routing rule
 */
router.post('/routing-rules', async (req: Request, res: Response) => {
  const schema = z.object({
    businessId: z.number(),
    accountId: z.string(),
    ruleName: z.string(),
    priority: z.number().default(0),
    conditions: z.record(z.any()),
    modelId: z.string(),
    modelProvider: z.string(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
  });

  try {
    const validated = schema.parse(req.body);

    const [rule] = await db
      .insert(modelRoutingRules)
      .values(validated)
      .returning();

    res.json({ success: true, rule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[FinOps API] Error creating routing rule:', error);
    res.status(500).json({ error: 'Failed to create routing rule' });
  }
});

/**
 * DELETE /api/finops/routing-rules/:ruleId
 * Delete a model routing rule
 */
router.delete('/routing-rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const ruleId = parseInt(req.params.ruleId);

    if (!ruleId) {
      return res.status(400).json({ error: 'ruleId is required' });
    }

    await db
      .delete(modelRoutingRules)
      .where(eq(modelRoutingRules.id, ruleId));

    res.json({ success: true });
  } catch (error) {
    console.error('[FinOps API] Error deleting routing rule:', error);
    res.status(500).json({ error: 'Failed to delete routing rule' });
  }
});

export default router;
