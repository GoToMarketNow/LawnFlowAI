/**
 * Human Tasks Activities
 *
 * Activities for creating and managing human-in-the-loop (HITL) tasks.
 * These tasks pause workflows and wait for human approval/decisions.
 *
 * @module server/temporal/activities/humanTasks
 */

import { db } from '../../db';
import {
  humanTasks,
  workflowRuns,
  InsertHumanTask,
  HumanTask,
} from '@shared/schema-temporal';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// ============================================================================
// Create Human Task Activity
// ============================================================================

export interface CreateHumanTaskInput {
  workflowId: string;
  taskType: 'approval' | 'review' | 'decision' | 'correction' | 'escalation';
  category: 'billing' | 'payment' | 'scheduling' | 'quote' | 'support' | 'crew';
  assignedRole: string;
  title: string;
  description?: string;
  context: Record<string, unknown>;
  options?: Array<{ value: string; label: string }>;
  signalName: string;
  dueBy?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface CreateHumanTaskOutput {
  taskId: string;
  id: number;
}

/**
 * Create a human task that will pause the workflow until resolved
 */
export async function createHumanTaskActivity(
  input: CreateHumanTaskInput
): Promise<CreateHumanTaskOutput> {
  const taskId = randomUUID();

  // Get workflow run to link the task
  const [workflowRun] = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.workflowId, input.workflowId))
    .limit(1);

  // Extract accountId and businessId from context
  const accountId = (input.context.accountId as string) || '';
  const businessId = (input.context.businessId as number) || null;

  const insertData: InsertHumanTask = {
    taskId,
    workflowRunId: workflowRun?.id || null,
    accountId,
    businessId,
    taskType: input.taskType,
    category: input.category,
    assignedRole: input.assignedRole,
    title: input.title,
    description: input.description,
    contextJson: input.context,
    optionsJson: input.options,
    signalName: input.signalName,
    dueBy: input.dueBy ? new Date(input.dueBy) : null,
    priority: input.priority || 'normal',
    status: 'pending',
    sourceType: 'workflow',
    sourceId: input.workflowId,
  };

  const [result] = await db.insert(humanTasks).values(insertData).returning();

  console.log(`[HumanTask] Created task ${taskId} for workflow ${input.workflowId}`);

  return {
    taskId,
    id: result.id,
  };
}

// ============================================================================
// Get Human Task Activity
// ============================================================================

export interface GetHumanTaskInput {
  taskId: string;
}

export interface GetHumanTaskOutput {
  task: HumanTask | null;
}

/**
 * Get a human task by its taskId
 */
export async function getHumanTaskActivity(
  input: GetHumanTaskInput
): Promise<GetHumanTaskOutput> {
  const [task] = await db
    .select()
    .from(humanTasks)
    .where(eq(humanTasks.taskId, input.taskId))
    .limit(1);

  return { task: task || null };
}

// ============================================================================
// Update Human Task Activity
// ============================================================================

export interface UpdateHumanTaskInput {
  taskId: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
  resolution?: 'approved' | 'rejected' | 'modified' | 'escalated';
  resolutionData?: Record<string, unknown>;
  resolvedByUserId?: number;
  resolutionNotes?: string;
}

export interface UpdateHumanTaskOutput {
  success: boolean;
  error?: string;
}

/**
 * Update a human task (typically when resolving it)
 */
export async function updateHumanTaskActivity(
  input: UpdateHumanTaskInput
): Promise<UpdateHumanTaskOutput> {
  try {
    const updateData: Partial<HumanTask> = {
      updatedAt: new Date(),
    };

    if (input.status) updateData.status = input.status;
    if (input.resolution) updateData.resolution = input.resolution;
    if (input.resolutionData) updateData.resolutionData = input.resolutionData;
    if (input.resolvedByUserId) updateData.resolvedByUserId = input.resolvedByUserId;
    if (input.resolutionNotes) updateData.resolutionNotes = input.resolutionNotes;

    if (input.status === 'completed' || input.resolution) {
      updateData.resolvedAt = new Date();
    }

    await db
      .update(humanTasks)
      .set(updateData)
      .where(eq(humanTasks.taskId, input.taskId));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Update failed',
    };
  }
}
