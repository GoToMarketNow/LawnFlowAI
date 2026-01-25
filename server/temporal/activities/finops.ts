/**
 * FinOps Activities
 *
 * Temporal Activities for budget management and cost tracking:
 * - Budget checking before LLM calls
 * - Usage recording after LLM calls
 * - Model routing based on budget status
 * - Alert generation
 *
 * @module server/temporal/activities/finops
 */

import { z } from 'zod';
import { db } from '@db';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import {
  usageLedger,
  budgetConfigs,
  budgetAlerts,
  modelRoutingRules,
  BudgetCheckResultSchema,
  UsageRecordInputSchema,
  type BudgetCheckResult,
  type UsageRecordInput,
} from '@shared/schema-finops';

// ============================================================================
// Model Pricing (microdollars per 1K tokens)
// ============================================================================

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2500, output: 10000 },           // $2.50/$10 per 1M
  'gpt-4o-mini': { input: 150, output: 600 },         // $0.15/$0.60 per 1M
  'gpt-4-turbo': { input: 10000, output: 30000 },     // $10/$30 per 1M
  'gpt-3.5-turbo': { input: 500, output: 1500 },      // $0.50/$1.50 per 1M
  'text-embedding-3-small': { input: 20, output: 0 }, // $0.02 per 1M
  'text-embedding-3-large': { input: 130, output: 0 }, // $0.13 per 1M

  // Anthropic
  'claude-3-5-sonnet-20241022': { input: 3000, output: 15000 }, // $3/$15 per 1M
  'claude-3-opus-20240229': { input: 15000, output: 75000 },    // $15/$75 per 1M
  'claude-3-sonnet-20240229': { input: 3000, output: 15000 },   // $3/$15 per 1M
  'claude-3-haiku-20240307': { input: 250, output: 1250 },      // $0.25/$1.25 per 1M

  // Google
  'gemini-1.5-pro': { input: 1250, output: 5000 },    // $1.25/$5 per 1M
  'gemini-1.5-flash': { input: 75, output: 300 },     // $0.075/$0.30 per 1M
};

// Default pricing for unknown models
const DEFAULT_PRICING = { input: 1000, output: 3000 }; // Conservative default

// ============================================================================
// Input Schemas
// ============================================================================

export const CheckBudgetInputSchema = z.object({
  businessId: z.number(),
  accountId: z.string(),
  requestedModel: z.string().optional(),
  estimatedTokens: z.number().optional(),
  activityType: z.string().optional(),
});

export const RecordUsageInputSchema = UsageRecordInputSchema;

export const GetBudgetStatusInputSchema = z.object({
  businessId: z.number(),
});

export const CreateAlertInputSchema = z.object({
  businessId: z.number(),
  accountId: z.string(),
  alertType: z.enum(['warning', 'critical', 'exceeded', 'daily_limit', 'rate_limit']),
  currentUsageMicrodollars: z.number(),
  budgetLimitMicrodollars: z.number(),
  thresholdPercent: z.number().optional(),
});

// ============================================================================
// Types
// ============================================================================

export type CheckBudgetInput = z.infer<typeof CheckBudgetInputSchema>;
export type RecordUsageInput = z.infer<typeof RecordUsageInputSchema>;
export type GetBudgetStatusInput = z.infer<typeof GetBudgetStatusInputSchema>;
export type CreateAlertInput = z.infer<typeof CreateAlertInputSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

function calculateCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[modelId] || DEFAULT_PRICING;

  const inputCost = Math.ceil((promptTokens / 1000) * pricing.input);
  const outputCost = Math.ceil((completionTokens / 1000) * pricing.output);

  return inputCost + outputCost;
}

async function getCurrentMonthUsage(businessId: number): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      totalCost: sql<number>`COALESCE(SUM(${usageLedger.costMicrodollars}), 0)`,
    })
    .from(usageLedger)
    .where(
      and(
        eq(usageLedger.businessId, businessId),
        gte(usageLedger.requestTimestamp, startOfMonth)
      )
    );

  return result[0]?.totalCost || 0;
}

async function getTodayUsage(businessId: number): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      totalCost: sql<number>`COALESCE(SUM(${usageLedger.costMicrodollars}), 0)`,
    })
    .from(usageLedger)
    .where(
      and(
        eq(usageLedger.businessId, businessId),
        gte(usageLedger.requestTimestamp, startOfDay)
      )
    );

  return result[0]?.totalCost || 0;
}

// ============================================================================
// Activities
// ============================================================================

/**
 * Check budget before making an LLM call
 *
 * Returns:
 * - allowed: Whether the call is allowed
 * - modelToUse: The model to use (may be downgraded)
 * - remainingBudget: Remaining budget in microdollars
 * - usagePercent: Current usage as percentage
 * - status: Budget status ('ok', 'warning', 'critical', 'exceeded')
 *
 * @activity checkBudgetActivity
 */
export async function checkBudgetActivity(
  input: CheckBudgetInput
): Promise<BudgetCheckResult> {
  const validated = CheckBudgetInputSchema.parse(input);

  console.log(`[FinOps Activity] Checking budget for business ${validated.businessId}`);

  // Get budget config
  const config = await db.query.budgetConfigs.findFirst({
    where: eq(budgetConfigs.businessId, validated.businessId),
  });

  // If no config, allow with defaults
  if (!config) {
    console.log(`[FinOps Activity] No budget config found, using defaults`);
    return {
      allowed: true,
      modelToUse: validated.requestedModel || 'gpt-4o-mini',
      remainingBudget: 10000000, // $10 default
      usagePercent: 0,
      status: 'ok',
    };
  }

  // Get current month usage
  const currentUsage = await getCurrentMonthUsage(validated.businessId);
  const usagePercent = (currentUsage / config.monthlyBudgetMicrodollars) * 100;
  const remainingBudget = config.monthlyBudgetMicrodollars - currentUsage;

  // Determine status
  let status: BudgetCheckResult['status'] = 'ok';
  if (usagePercent >= config.hardCapPercent!) {
    status = 'exceeded';
  } else if (usagePercent >= config.criticalThresholdPercent!) {
    status = 'critical';
  } else if (usagePercent >= config.warningThresholdPercent!) {
    status = 'warning';
  }

  // Check daily limit if set
  if (config.dailyLimitMicrodollars) {
    const todayUsage = await getTodayUsage(validated.businessId);
    if (todayUsage >= config.dailyLimitMicrodollars) {
      console.log(`[FinOps Activity] Daily limit exceeded`);
      return {
        allowed: config.onBudgetExceeded === 'alert_only',
        modelToUse: config.fallbackModel || 'gpt-3.5-turbo',
        remainingBudget,
        usagePercent,
        status: 'exceeded',
        reason: 'Daily budget limit exceeded',
      };
    }
  }

  // Handle budget exceeded
  if (status === 'exceeded') {
    const behavior = config.onBudgetExceeded || 'downgrade';

    if (behavior === 'block') {
      console.log(`[FinOps Activity] Budget exceeded, blocking request`);
      return {
        allowed: false,
        modelToUse: config.preferredModel || 'gpt-4o-mini',
        remainingBudget: 0,
        usagePercent,
        status: 'exceeded',
        reason: 'Monthly budget exceeded',
      };
    }

    if (behavior === 'downgrade') {
      console.log(`[FinOps Activity] Budget exceeded, downgrading model`);
      return {
        allowed: true,
        modelToUse: config.fallbackModel || 'gpt-3.5-turbo',
        remainingBudget: 0,
        usagePercent,
        status: 'exceeded',
        reason: 'Using fallback model due to budget',
      };
    }

    // alert_only: allow but flag
    return {
      allowed: true,
      modelToUse: validated.requestedModel || config.preferredModel || 'gpt-4o-mini',
      remainingBudget: 0,
      usagePercent,
      status: 'exceeded',
      reason: 'Budget exceeded (alert only mode)',
    };
  }

  // Check if requested model is premium and not allowed
  const requestedModel = validated.requestedModel || config.preferredModel || 'gpt-4o-mini';
  const premiumModels = (config.premiumModels as string[]) || [];

  if (premiumModels.includes(requestedModel) && !config.allowPremiumModels) {
    console.log(`[FinOps Activity] Premium model not allowed, using preferred`);
    return {
      allowed: true,
      modelToUse: config.preferredModel || 'gpt-4o-mini',
      remainingBudget,
      usagePercent,
      status,
      reason: 'Premium models not enabled',
    };
  }

  // Check model routing rules
  if (validated.activityType) {
    const rules = await db.query.modelRoutingRules.findMany({
      where: and(
        eq(modelRoutingRules.businessId, validated.businessId),
        eq(modelRoutingRules.isActive, true)
      ),
      orderBy: [desc(modelRoutingRules.priority)],
    });

    for (const rule of rules) {
      const conditions = rule.conditions as Record<string, any>;
      if (conditions.activity_type === validated.activityType) {
        console.log(`[FinOps Activity] Using model from routing rule: ${rule.ruleName}`);
        return {
          allowed: true,
          modelToUse: rule.modelId,
          remainingBudget,
          usagePercent,
          status,
        };
      }
    }
  }

  console.log(`[FinOps Activity] Budget check passed`, {
    modelToUse: requestedModel,
    remainingBudget,
    usagePercent,
    status,
  });

  return {
    allowed: true,
    modelToUse: requestedModel,
    remainingBudget,
    usagePercent,
    status,
  };
}

/**
 * Record LLM usage after a call completes
 *
 * @activity recordUsageActivity
 */
export async function recordUsageActivity(
  input: RecordUsageInput
): Promise<{ success: boolean; usageId?: number; costMicrodollars: number }> {
  const validated = RecordUsageInputSchema.parse(input);

  // Calculate cost if not provided
  let costMicrodollars = validated.costMicrodollars;
  if (!costMicrodollars || costMicrodollars === 0) {
    costMicrodollars = calculateCost(
      validated.modelId,
      validated.promptTokens,
      validated.completionTokens
    );
  }

  console.log(`[FinOps Activity] Recording usage`, {
    businessId: validated.businessId,
    modelId: validated.modelId,
    totalTokens: validated.totalTokens,
    costMicrodollars,
  });

  try {
    const [record] = await db
      .insert(usageLedger)
      .values({
        businessId: validated.businessId,
        accountId: validated.accountId,
        workflowRunId: validated.workflowRunId,
        workflowStepId: validated.workflowStepId,
        activityType: validated.activityType,
        activityName: validated.activityName,
        modelProvider: validated.modelProvider,
        modelId: validated.modelId,
        promptTokens: validated.promptTokens,
        completionTokens: validated.completionTokens,
        totalTokens: validated.totalTokens,
        costMicrodollars,
        traceId: validated.traceId,
        requestId: validated.requestId,
        latencyMs: validated.latencyMs,
        metadata: validated.metadata || {},
        responseTimestamp: new Date(),
      })
      .returning({ id: usageLedger.id });

    // Check if we need to generate alerts
    await checkAndCreateAlerts(validated.businessId, validated.accountId);

    return {
      success: true,
      usageId: record.id,
      costMicrodollars,
    };
  } catch (error) {
    console.error(`[FinOps Activity] Failed to record usage`, error);
    return {
      success: false,
      costMicrodollars,
    };
  }
}

/**
 * Check and create budget alerts if thresholds crossed
 */
async function checkAndCreateAlerts(
  businessId: number,
  accountId: string
): Promise<void> {
  const config = await db.query.budgetConfigs.findFirst({
    where: eq(budgetConfigs.businessId, businessId),
  });

  if (!config) return;

  const currentUsage = await getCurrentMonthUsage(businessId);
  const usagePercent = (currentUsage / config.monthlyBudgetMicrodollars) * 100;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Check for existing alerts this period
  const existingAlerts = await db.query.budgetAlerts.findMany({
    where: and(
      eq(budgetAlerts.businessId, businessId),
      gte(budgetAlerts.createdAt, periodStart)
    ),
  });

  const alertTypes = existingAlerts.map((a) => a.alertType);

  // Create alerts for crossed thresholds
  if (usagePercent >= config.hardCapPercent! && !alertTypes.includes('exceeded')) {
    await createAlertActivity({
      businessId,
      accountId,
      alertType: 'exceeded',
      currentUsageMicrodollars: currentUsage,
      budgetLimitMicrodollars: config.monthlyBudgetMicrodollars,
      thresholdPercent: config.hardCapPercent!,
    });
  } else if (usagePercent >= config.criticalThresholdPercent! && !alertTypes.includes('critical')) {
    await createAlertActivity({
      businessId,
      accountId,
      alertType: 'critical',
      currentUsageMicrodollars: currentUsage,
      budgetLimitMicrodollars: config.monthlyBudgetMicrodollars,
      thresholdPercent: config.criticalThresholdPercent!,
    });
  } else if (usagePercent >= config.warningThresholdPercent! && !alertTypes.includes('warning')) {
    await createAlertActivity({
      businessId,
      accountId,
      alertType: 'warning',
      currentUsageMicrodollars: currentUsage,
      budgetLimitMicrodollars: config.monthlyBudgetMicrodollars,
      thresholdPercent: config.warningThresholdPercent!,
    });
  }
}

/**
 * Create a budget alert
 *
 * @activity createAlertActivity
 */
export async function createAlertActivity(
  input: CreateAlertInput
): Promise<{ success: boolean; alertId?: number }> {
  const validated = CreateAlertInputSchema.parse(input);

  console.log(`[FinOps Activity] Creating ${validated.alertType} alert`, {
    businessId: validated.businessId,
    currentUsage: validated.currentUsageMicrodollars,
    limit: validated.budgetLimitMicrodollars,
  });

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  try {
    const [alert] = await db
      .insert(budgetAlerts)
      .values({
        businessId: validated.businessId,
        accountId: validated.accountId,
        alertType: validated.alertType,
        thresholdPercent: validated.thresholdPercent,
        currentUsageMicrodollars: validated.currentUsageMicrodollars,
        budgetLimitMicrodollars: validated.budgetLimitMicrodollars,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      })
      .returning({ id: budgetAlerts.id });

    // TODO: Send notification (email/webhook)

    return {
      success: true,
      alertId: alert.id,
    };
  } catch (error) {
    console.error(`[FinOps Activity] Failed to create alert`, error);
    return { success: false };
  }
}

/**
 * Get current budget status for a business
 *
 * @activity getBudgetStatusActivity
 */
export async function getBudgetStatusActivity(
  input: GetBudgetStatusInput
): Promise<{
  success: boolean;
  status?: {
    monthlyBudget: number;
    currentUsage: number;
    remainingBudget: number;
    usagePercent: number;
    status: string;
    preferredModel: string;
    alerts: Array<{ type: string; createdAt: string }>;
  };
}> {
  const validated = GetBudgetStatusInputSchema.parse(input);

  console.log(`[FinOps Activity] Getting budget status for business ${validated.businessId}`);

  try {
    const config = await db.query.budgetConfigs.findFirst({
      where: eq(budgetConfigs.businessId, validated.businessId),
    });

    if (!config) {
      return {
        success: true,
        status: {
          monthlyBudget: 10000000,
          currentUsage: 0,
          remainingBudget: 10000000,
          usagePercent: 0,
          status: 'ok',
          preferredModel: 'gpt-4o-mini',
          alerts: [],
        },
      };
    }

    const currentUsage = await getCurrentMonthUsage(validated.businessId);
    const usagePercent = (currentUsage / config.monthlyBudgetMicrodollars) * 100;
    const remainingBudget = Math.max(0, config.monthlyBudgetMicrodollars - currentUsage);

    let status = 'ok';
    if (usagePercent >= config.hardCapPercent!) status = 'exceeded';
    else if (usagePercent >= config.criticalThresholdPercent!) status = 'critical';
    else if (usagePercent >= config.warningThresholdPercent!) status = 'warning';

    // Get recent alerts
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const alerts = await db.query.budgetAlerts.findMany({
      where: and(
        eq(budgetAlerts.businessId, validated.businessId),
        gte(budgetAlerts.createdAt, periodStart)
      ),
      orderBy: [desc(budgetAlerts.createdAt)],
      limit: 10,
    });

    return {
      success: true,
      status: {
        monthlyBudget: config.monthlyBudgetMicrodollars,
        currentUsage,
        remainingBudget,
        usagePercent: Math.round(usagePercent * 100) / 100,
        status,
        preferredModel: config.preferredModel || 'gpt-4o-mini',
        alerts: alerts.map((a) => ({
          type: a.alertType,
          createdAt: a.createdAt?.toISOString() || '',
        })),
      },
    };
  } catch (error) {
    console.error(`[FinOps Activity] Failed to get budget status`, error);
    return { success: false };
  }
}

/**
 * Get usage summary for a workflow
 *
 * @activity getWorkflowUsageActivity
 */
export async function getWorkflowUsageActivity(
  input: { workflowRunId: number }
): Promise<{
  success: boolean;
  usage?: {
    totalTokens: number;
    totalCostMicrodollars: number;
    byModel: Record<string, { tokens: number; cost: number }>;
    byActivity: Record<string, { tokens: number; cost: number }>;
  };
}> {
  console.log(`[FinOps Activity] Getting usage for workflow ${input.workflowRunId}`);

  try {
    const records = await db.query.usageLedger.findMany({
      where: eq(usageLedger.workflowRunId, input.workflowRunId),
    });

    if (records.length === 0) {
      return {
        success: true,
        usage: {
          totalTokens: 0,
          totalCostMicrodollars: 0,
          byModel: {},
          byActivity: {},
        },
      };
    }

    const byModel: Record<string, { tokens: number; cost: number }> = {};
    const byActivity: Record<string, { tokens: number; cost: number }> = {};
    let totalTokens = 0;
    let totalCost = 0;

    for (const record of records) {
      totalTokens += record.totalTokens || 0;
      totalCost += record.costMicrodollars || 0;

      // By model
      const modelKey = record.modelId;
      if (!byModel[modelKey]) {
        byModel[modelKey] = { tokens: 0, cost: 0 };
      }
      byModel[modelKey].tokens += record.totalTokens || 0;
      byModel[modelKey].cost += record.costMicrodollars || 0;

      // By activity
      const activityKey = record.activityType;
      if (!byActivity[activityKey]) {
        byActivity[activityKey] = { tokens: 0, cost: 0 };
      }
      byActivity[activityKey].tokens += record.totalTokens || 0;
      byActivity[activityKey].cost += record.costMicrodollars || 0;
    }

    return {
      success: true,
      usage: {
        totalTokens,
        totalCostMicrodollars: totalCost,
        byModel,
        byActivity,
      },
    };
  } catch (error) {
    console.error(`[FinOps Activity] Failed to get workflow usage`, error);
    return { success: false };
  }
}

/**
 * Calculate cost for given token counts
 *
 * @activity calculateCostActivity
 */
export async function calculateCostActivity(
  input: { modelId: string; promptTokens: number; completionTokens: number }
): Promise<{ costMicrodollars: number }> {
  const cost = calculateCost(input.modelId, input.promptTokens, input.completionTokens);
  return { costMicrodollars: cost };
}
