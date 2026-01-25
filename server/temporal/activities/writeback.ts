/**
 * Writeback Activities
 *
 * Temporal Activities for post-workflow operations:
 * - Generate workflow summaries
 * - Create memory documents from completed workflows
 * - Update customer context
 *
 * @module server/temporal/activities/writeback
 */

import { z } from 'zod';
import { db } from '@db';
import { eq, and, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { workflowRuns, workflowSteps, humanTasks } from '@shared/schema-temporal';
import {
  workflowSummaries,
  memoryDocs,
  usageLedger,
} from '@shared/schema-finops';

// ============================================================================
// Configuration
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ============================================================================
// Input Schemas
// ============================================================================

export const GenerateSummaryInputSchema = z.object({
  workflowRunId: z.number(),
  workflowId: z.string(),
  workflowType: z.string(),
  businessId: z.number(),
  accountId: z.string(),
  primaryEntityType: z.string().optional(),
  primaryEntityId: z.number().optional(),
  customerId: z.number().optional(),
  generateMemoryDoc: z.boolean().default(true),
});

export const CreateWorkflowSummaryInputSchema = z.object({
  workflowRunId: z.number(),
  workflowId: z.string(),
  workflowType: z.string(),
  businessId: z.number(),
  accountId: z.string(),
  primaryEntityType: z.string().optional(),
  primaryEntityId: z.number().optional(),
  customerId: z.number().optional(),
  summary: z.string(),
  keyDecisions: z.array(z.object({
    step: z.string(),
    decision: z.string(),
    reason: z.string().optional(),
  })).optional(),
  outcomes: z.record(z.any()).optional(),
});

export const UpdateCustomerContextInputSchema = z.object({
  businessId: z.number(),
  accountId: z.string(),
  customerId: z.number(),
  contextType: z.enum([
    'service_completed',
    'payment_received',
    'issue_resolved',
    'preference_noted',
    'complaint_filed',
  ]),
  content: z.string(),
  sourceWorkflowId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().default(0.5),
});

// ============================================================================
// Types
// ============================================================================

export type GenerateSummaryInput = z.infer<typeof GenerateSummaryInputSchema>;
export type CreateWorkflowSummaryInput = z.infer<typeof CreateWorkflowSummaryInputSchema>;
export type UpdateCustomerContextInput = z.infer<typeof UpdateCustomerContextInputSchema>;

// ============================================================================
// Activities
// ============================================================================

/**
 * Generate a summary for a completed workflow using LLM
 *
 * @activity generateWorkflowSummaryActivity
 */
export async function generateWorkflowSummaryActivity(
  input: GenerateSummaryInput
): Promise<{
  success: boolean;
  summaryId?: number;
  memoryDocId?: number;
  summary?: string;
  error?: string;
}> {
  const validated = GenerateSummaryInputSchema.parse(input);

  console.log(`[Writeback Activity] Generating summary for workflow ${validated.workflowId}`);

  try {
    // Get workflow run details
    const workflowRun = await db.query.workflowRuns.findFirst({
      where: eq(workflowRuns.id, validated.workflowRunId),
    });

    if (!workflowRun) {
      return { success: false, error: 'Workflow run not found' };
    }

    // Get all steps
    const steps = await db.query.workflowSteps.findMany({
      where: eq(workflowSteps.workflowRunId, validated.workflowRunId),
      orderBy: (steps, { asc }) => [asc(steps.stepIndex)],
    });

    // Get human tasks
    const tasks = await db.query.humanTasks.findMany({
      where: eq(humanTasks.workflowRunId, validated.workflowRunId),
    });

    // Get usage metrics
    const usageResult = await db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(${usageLedger.totalTokens}), 0)`,
        totalCost: sql<number>`COALESCE(SUM(${usageLedger.costMicrodollars}), 0)`,
      })
      .from(usageLedger)
      .where(eq(usageLedger.workflowRunId, validated.workflowRunId));

    const usage = usageResult[0] || { totalTokens: 0, totalCost: 0 };

    // Build context for LLM
    const workflowContext = {
      type: validated.workflowType,
      status: workflowRun.status,
      startedAt: workflowRun.startedAt,
      completedAt: workflowRun.completedAt,
      input: workflowRun.inputJson,
      output: workflowRun.outputJson,
      steps: steps.map((s) => ({
        activity: s.activityType,
        status: s.status,
        duration: s.durationMs,
        output: s.outputJson,
      })),
      humanTasks: tasks.map((t) => ({
        type: t.taskType,
        title: t.title,
        status: t.status,
        resolution: t.resolution,
      })),
      metrics: {
        totalSteps: steps.length,
        humanInterventions: tasks.length,
        totalTokens: usage.totalTokens,
        totalCostUsd: usage.totalCost / 1000000,
      },
    };

    // Generate summary using LLM
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a workflow summarization assistant. Generate concise, factual summaries of completed workflows.
Focus on:
1. What the workflow accomplished
2. Key decisions made (especially human approvals)
3. Notable outcomes or results
4. Any issues encountered

Keep summaries under 200 words. Be specific and actionable.`,
        },
        {
          role: 'user',
          content: `Summarize this ${validated.workflowType} workflow:\n\n${JSON.stringify(workflowContext, null, 2)}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const summary = response.choices[0]?.message?.content || 'Summary generation failed.';

    // Extract key decisions
    const keyDecisions = tasks
      .filter((t) => t.resolution)
      .map((t) => ({
        step: t.taskType,
        decision: t.resolution || '',
        reason: (t.resolutionData as any)?.reason || undefined,
      }));

    // Calculate duration
    const durationMs = workflowRun.completedAt && workflowRun.startedAt
      ? new Date(workflowRun.completedAt).getTime() - new Date(workflowRun.startedAt).getTime()
      : undefined;

    // Get model usage breakdown
    const modelUsageResult = await db
      .select({
        modelId: usageLedger.modelId,
        totalTokens: sql<number>`SUM(${usageLedger.totalTokens})`,
        totalCost: sql<number>`SUM(${usageLedger.costMicrodollars})`,
      })
      .from(usageLedger)
      .where(eq(usageLedger.workflowRunId, validated.workflowRunId))
      .groupBy(usageLedger.modelId);

    const modelUsage: Record<string, { tokens: number; cost: number }> = {};
    for (const row of modelUsageResult) {
      modelUsage[row.modelId] = {
        tokens: row.totalTokens,
        cost: row.totalCost,
      };
    }

    // Create workflow summary
    const [summaryRecord] = await db
      .insert(workflowSummaries)
      .values({
        workflowRunId: validated.workflowRunId,
        workflowId: validated.workflowId,
        workflowType: validated.workflowType,
        businessId: validated.businessId,
        accountId: validated.accountId,
        primaryEntityType: validated.primaryEntityType,
        primaryEntityId: validated.primaryEntityId,
        customerId: validated.customerId,
        summary,
        keyDecisions,
        outcomes: workflowRun.outputJson || {},
        totalSteps: steps.length,
        humanInterventions: tasks.length,
        totalDurationMs: durationMs,
        totalCostMicrodollars: usage.totalCost,
        modelUsage,
      })
      .returning({ id: workflowSummaries.id });

    console.log(`[Writeback Activity] Created summary ${summaryRecord.id}`);

    // Create memory doc if requested
    let memoryDocId: number | undefined;

    if (validated.generateMemoryDoc && validated.customerId) {
      const [memoryDoc] = await db
        .insert(memoryDocs)
        .values({
          businessId: validated.businessId,
          accountId: validated.accountId,
          customerId: validated.customerId,
          docType: getDocTypeForWorkflow(validated.workflowType),
          title: `${validated.workflowType} - ${new Date().toLocaleDateString()}`,
          content: summary,
          sourceEntityType: validated.primaryEntityType,
          sourceEntityId: validated.primaryEntityId,
          sourceWorkflowId: validated.workflowId,
          tags: [validated.workflowType, workflowRun.status || 'unknown'],
          metadata: {
            workflowRunId: validated.workflowRunId,
            duration: durationMs,
            humanInterventions: tasks.length,
          },
          importanceScore: calculateImportance(validated.workflowType, tasks.length),
        })
        .returning({ id: memoryDocs.id });

      memoryDocId = memoryDoc.id;

      // Update summary with memory doc reference
      await db
        .update(workflowSummaries)
        .set({ memoryDocId })
        .where(eq(workflowSummaries.id, summaryRecord.id));

      console.log(`[Writeback Activity] Created memory doc ${memoryDocId}`);
    }

    return {
      success: true,
      summaryId: summaryRecord.id,
      memoryDocId,
      summary,
    };
  } catch (error: any) {
    console.error(`[Writeback Activity] Summary generation failed`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Create a workflow summary without LLM (use provided summary)
 *
 * @activity createWorkflowSummaryActivity
 */
export async function createWorkflowSummaryActivity(
  input: CreateWorkflowSummaryInput
): Promise<{ success: boolean; summaryId?: number; error?: string }> {
  const validated = CreateWorkflowSummaryInputSchema.parse(input);

  console.log(`[Writeback Activity] Creating summary for workflow ${validated.workflowId}`);

  try {
    // Get metrics
    const steps = await db.query.workflowSteps.findMany({
      where: eq(workflowSteps.workflowRunId, validated.workflowRunId),
    });

    const tasks = await db.query.humanTasks.findMany({
      where: eq(humanTasks.workflowRunId, validated.workflowRunId),
    });

    const usageResult = await db
      .select({
        totalCost: sql<number>`COALESCE(SUM(${usageLedger.costMicrodollars}), 0)`,
      })
      .from(usageLedger)
      .where(eq(usageLedger.workflowRunId, validated.workflowRunId));

    const [summaryRecord] = await db
      .insert(workflowSummaries)
      .values({
        workflowRunId: validated.workflowRunId,
        workflowId: validated.workflowId,
        workflowType: validated.workflowType,
        businessId: validated.businessId,
        accountId: validated.accountId,
        primaryEntityType: validated.primaryEntityType,
        primaryEntityId: validated.primaryEntityId,
        customerId: validated.customerId,
        summary: validated.summary,
        keyDecisions: validated.keyDecisions || [],
        outcomes: validated.outcomes || {},
        totalSteps: steps.length,
        humanInterventions: tasks.length,
        totalCostMicrodollars: usageResult[0]?.totalCost || 0,
      })
      .returning({ id: workflowSummaries.id });

    console.log(`[Writeback Activity] Created summary ${summaryRecord.id}`);

    return {
      success: true,
      summaryId: summaryRecord.id,
    };
  } catch (error: any) {
    console.error(`[Writeback Activity] Create summary failed`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update customer context after a workflow event
 *
 * @activity updateCustomerContextActivity
 */
export async function updateCustomerContextActivity(
  input: UpdateCustomerContextInput
): Promise<{ success: boolean; docId?: number; error?: string }> {
  const validated = UpdateCustomerContextInputSchema.parse(input);

  console.log(`[Writeback Activity] Updating customer ${validated.customerId} context`);

  try {
    const docType = contextTypeToDocType(validated.contextType);

    const [doc] = await db
      .insert(memoryDocs)
      .values({
        businessId: validated.businessId,
        accountId: validated.accountId,
        customerId: validated.customerId,
        docType,
        title: getContextTitle(validated.contextType),
        content: validated.content,
        sourceWorkflowId: validated.sourceWorkflowId,
        tags: validated.tags || [validated.contextType],
        importanceScore: validated.importance.toString(),
      })
      .returning({ id: memoryDocs.id });

    console.log(`[Writeback Activity] Created context doc ${doc.id}`);

    return {
      success: true,
      docId: doc.id,
    };
  } catch (error: any) {
    console.error(`[Writeback Activity] Update customer context failed`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get workflow summary
 *
 * @activity getWorkflowSummaryActivity
 */
export async function getWorkflowSummaryActivity(
  input: { workflowRunId: number }
): Promise<{
  success: boolean;
  summary?: {
    id: number;
    summary: string;
    keyDecisions: any;
    outcomes: any;
    totalSteps: number | null;
    humanInterventions: number | null;
    totalCostMicrodollars: number | null;
    createdAt: Date | null;
  };
}> {
  try {
    const summary = await db.query.workflowSummaries.findFirst({
      where: eq(workflowSummaries.workflowRunId, input.workflowRunId),
      columns: {
        id: true,
        summary: true,
        keyDecisions: true,
        outcomes: true,
        totalSteps: true,
        humanInterventions: true,
        totalCostMicrodollars: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      summary: summary || undefined,
    };
  } catch (error) {
    console.error(`[Writeback Activity] Get summary failed`, error);
    return { success: false };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDocTypeForWorkflow(workflowType: string): string {
  const typeMap: Record<string, string> = {
    'job-closeout': 'job_summary',
    'lead-to-cash': 'service_history',
    'billing': 'service_history',
    'payment': 'service_history',
    'support': 'complaint_resolution',
  };

  return typeMap[workflowType.toLowerCase()] || 'custom';
}

function calculateImportance(workflowType: string, humanInterventions: number): string {
  // Base importance by workflow type
  const baseImportance: Record<string, number> = {
    'job-closeout': 0.6,
    'billing': 0.5,
    'payment': 0.7,
    'support': 0.8,
  };

  let importance = baseImportance[workflowType.toLowerCase()] || 0.5;

  // Increase importance if human intervention was required
  if (humanInterventions > 0) {
    importance = Math.min(1, importance + 0.1 * humanInterventions);
  }

  return importance.toString();
}

function contextTypeToDocType(contextType: string): string {
  const typeMap: Record<string, string> = {
    service_completed: 'service_history',
    payment_received: 'service_history',
    issue_resolved: 'complaint_resolution',
    preference_noted: 'customer_preference',
    complaint_filed: 'complaint_resolution',
  };

  return typeMap[contextType] || 'custom';
}

function getContextTitle(contextType: string): string {
  const titleMap: Record<string, string> = {
    service_completed: 'Service Completed',
    payment_received: 'Payment Received',
    issue_resolved: 'Issue Resolved',
    preference_noted: 'Customer Preference',
    complaint_filed: 'Complaint Filed',
  };

  return titleMap[contextType] || 'Customer Update';
}
