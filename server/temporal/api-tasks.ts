/**
 * Human Task Management API
 *
 * Dedicated API for managing HITL (Human-in-the-Loop) tasks:
 * - List, filter, and search tasks
 * - Assign tasks to users
 * - Resolve tasks (triggers Temporal signals)
 * - Task escalation and SLA tracking
 *
 * @module server/temporal/api-tasks
 */

import { Router, Request, Response } from 'express';
import { getTemporalClient } from './client';
import { db } from '../db';
import { humanTasks, workflowRuns } from '@shared/schema-temporal';
import { users } from '@shared/schema';
import { eq, and, desc, asc, gte, lte, isNull, or, sql } from 'drizzle-orm';

const router = Router();

// ============================================================================
// List Tasks with Filtering
// ============================================================================

/**
 * GET /api/tasks
 * List human tasks with comprehensive filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      businessId,
      status,
      category,
      taskType,
      assignedRole,
      assignedUserId,
      priority,
      overdue,
      limit = '50',
      offset = '0',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build conditions
    const conditions = [];

    if (businessId) {
      conditions.push(eq(humanTasks.businessId, Number(businessId)));
    }
    if (status) {
      // Support comma-separated statuses
      const statuses = String(status).split(',');
      if (statuses.length === 1) {
        conditions.push(eq(humanTasks.status, statuses[0]));
      } else {
        conditions.push(
          or(...statuses.map((s) => eq(humanTasks.status, s)))
        );
      }
    }
    if (category) {
      conditions.push(eq(humanTasks.category, String(category)));
    }
    if (taskType) {
      conditions.push(eq(humanTasks.taskType, String(taskType)));
    }
    if (assignedRole) {
      conditions.push(eq(humanTasks.assignedRole, String(assignedRole)));
    }
    if (assignedUserId) {
      conditions.push(eq(humanTasks.assignedUserId, Number(assignedUserId)));
    }
    if (priority) {
      conditions.push(eq(humanTasks.priority, String(priority)));
    }
    if (overdue === 'true') {
      conditions.push(lte(humanTasks.dueBy, new Date()));
      conditions.push(eq(humanTasks.status, 'pending'));
    }

    // Determine sort order
    const orderColumn = sortBy === 'priority'
      ? humanTasks.priority
      : sortBy === 'dueBy'
      ? humanTasks.dueBy
      : humanTasks.createdAt;

    const order = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    const tasks = await db
      .select({
        id: humanTasks.id,
        taskId: humanTasks.taskId,
        workflowRunId: humanTasks.workflowRunId,
        accountId: humanTasks.accountId,
        businessId: humanTasks.businessId,
        taskType: humanTasks.taskType,
        category: humanTasks.category,
        assignedRole: humanTasks.assignedRole,
        assignedUserId: humanTasks.assignedUserId,
        title: humanTasks.title,
        description: humanTasks.description,
        status: humanTasks.status,
        priority: humanTasks.priority,
        resolution: humanTasks.resolution,
        dueBy: humanTasks.dueBy,
        escalatedAt: humanTasks.escalatedAt,
        createdAt: humanTasks.createdAt,
        updatedAt: humanTasks.updatedAt,
      })
      .from(humanTasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(order)
      .limit(Number(limit))
      .offset(Number(offset));

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(humanTasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({
      tasks,
      pagination: {
        total: Number(countResult?.count || 0),
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    console.error('[Tasks API] Error listing tasks:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list tasks',
    });
  }
});

// ============================================================================
// Get Task Details
// ============================================================================

/**
 * GET /api/tasks/:taskId
 * Get detailed task information including workflow context
 */
router.get('/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    const [task] = await db
      .select()
      .from(humanTasks)
      .where(eq(humanTasks.taskId, taskId))
      .limit(1);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get workflow info if linked
    let workflowInfo = null;
    if (task.workflowRunId) {
      const [run] = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.id, task.workflowRunId))
        .limit(1);

      if (run) {
        workflowInfo = {
          workflowId: run.workflowId,
          workflowType: run.workflowType,
          status: run.status,
          currentStage: run.currentStage,
        };
      }
    }

    // Get assigned user info if assigned
    let assignedUser = null;
    if (task.assignedUserId) {
      const [user] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.id, task.assignedUserId))
        .limit(1);
      assignedUser = user;
    }

    res.json({
      task,
      workflowInfo,
      assignedUser,
    });
  } catch (error) {
    console.error('[Tasks API] Error getting task:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get task',
    });
  }
});

// ============================================================================
// Assign Task
// ============================================================================

/**
 * POST /api/tasks/:taskId/assign
 * Assign a task to a specific user
 */
router.post('/:taskId/assign', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { userId, notes } = req.body;

    // Get the task
    const [task] = await db
      .select()
      .from(humanTasks)
      .where(eq(humanTasks.taskId, taskId))
      .limit(1);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status === 'completed' || task.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot assign a completed or cancelled task' });
    }

    // Verify user exists
    if (userId) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    // Update task assignment
    await db
      .update(humanTasks)
      .set({
        assignedUserId: userId || null,
        status: userId ? 'in_progress' : 'pending',
        updatedAt: new Date(),
      })
      .where(eq(humanTasks.taskId, taskId));

    res.json({
      success: true,
      taskId,
      assignedUserId: userId,
      status: userId ? 'in_progress' : 'pending',
    });
  } catch (error) {
    console.error('[Tasks API] Error assigning task:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to assign task',
    });
  }
});

// ============================================================================
// Resolve Task
// ============================================================================

/**
 * POST /api/tasks/:taskId/resolve
 * Resolve a task and send signal to workflow
 */
router.post('/:taskId/resolve', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { resolution, data, notes } = req.body;
    const userId = (req as any).user?.id || 0;

    if (!resolution) {
      return res.status(400).json({ error: 'Resolution is required' });
    }

    // Validate resolution value
    const validResolutions = ['approved', 'rejected', 'modified', 'escalated'];
    if (!validResolutions.includes(resolution)) {
      return res.status(400).json({
        error: `Invalid resolution. Must be one of: ${validResolutions.join(', ')}`,
      });
    }

    // Get the task
    const [task] = await db
      .select()
      .from(humanTasks)
      .where(eq(humanTasks.taskId, taskId))
      .limit(1);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status === 'completed') {
      return res.status(400).json({ error: 'Task already resolved' });
    }

    if (task.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot resolve a cancelled task' });
    }

    // Send signal to workflow if linked
    if (task.workflowRunId && task.signalName) {
      const [run] = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.id, task.workflowRunId))
        .limit(1);

      if (run && run.status === 'running') {
        try {
          const client = await getTemporalClient();
          const handle = client.workflow.getHandle(run.workflowId);

          await handle.signal(task.signalName, {
            approved: resolution === 'approved',
            data,
            userId,
            notes,
          });

          console.log(`[Tasks API] Signal '${task.signalName}' sent to workflow ${run.workflowId}`);
        } catch (signalError) {
          console.error('[Tasks API] Error sending signal:', signalError);
          // Don't fail the resolution if signal fails - workflow might have completed
        }
      }
    }

    // Update task
    await db
      .update(humanTasks)
      .set({
        status: 'completed',
        resolution,
        resolutionData: data,
        resolvedByUserId: userId,
        resolvedAt: new Date(),
        resolutionNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(humanTasks.taskId, taskId));

    res.json({
      success: true,
      taskId,
      resolution,
      signalSent: !!(task.workflowRunId && task.signalName),
    });
  } catch (error) {
    console.error('[Tasks API] Error resolving task:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to resolve task',
    });
  }
});

// ============================================================================
// Escalate Task
// ============================================================================

/**
 * POST /api/tasks/:taskId/escalate
 * Escalate a task to a higher role
 */
router.post('/:taskId/escalate', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { targetRole, reason } = req.body;
    const userId = (req as any).user?.id || 0;

    if (!targetRole) {
      return res.status(400).json({ error: 'Target role is required' });
    }

    // Get the task
    const [task] = await db
      .select()
      .from(humanTasks)
      .where(eq(humanTasks.taskId, taskId))
      .limit(1);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status === 'completed' || task.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot escalate a completed or cancelled task' });
    }

    // Update task with escalation
    await db
      .update(humanTasks)
      .set({
        assignedRole: targetRole,
        assignedUserId: null, // Clear assignment on escalation
        priority: task.priority === 'urgent' ? 'urgent' : 'high', // Increase priority
        escalatedAt: new Date(),
        escalationReason: reason,
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(humanTasks.taskId, taskId));

    res.json({
      success: true,
      taskId,
      escalatedTo: targetRole,
      newPriority: task.priority === 'urgent' ? 'urgent' : 'high',
    });
  } catch (error) {
    console.error('[Tasks API] Error escalating task:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to escalate task',
    });
  }
});

// ============================================================================
// Cancel Task
// ============================================================================

/**
 * POST /api/tasks/:taskId/cancel
 * Cancel a pending task
 */
router.post('/:taskId/cancel', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.id || 0;

    // Get the task
    const [task] = await db
      .select()
      .from(humanTasks)
      .where(eq(humanTasks.taskId, taskId))
      .limit(1);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status === 'completed') {
      return res.status(400).json({ error: 'Cannot cancel a completed task' });
    }

    // If workflow is waiting, send cancel signal
    if (task.workflowRunId) {
      const [run] = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.id, task.workflowRunId))
        .limit(1);

      if (run && run.status === 'running') {
        try {
          const client = await getTemporalClient();
          const handle = client.workflow.getHandle(run.workflowId);
          await handle.signal('cancel', { reason: reason || 'Task cancelled' });
        } catch (signalError) {
          console.error('[Tasks API] Error sending cancel signal:', signalError);
        }
      }
    }

    // Update task
    await db
      .update(humanTasks)
      .set({
        status: 'cancelled',
        resolutionNotes: reason,
        resolvedByUserId: userId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(humanTasks.taskId, taskId));

    res.json({ success: true, taskId });
  } catch (error) {
    console.error('[Tasks API] Error cancelling task:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to cancel task',
    });
  }
});

// ============================================================================
// Task Statistics
// ============================================================================

/**
 * GET /api/tasks/stats
 * Get task queue statistics
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.query;

    const baseCondition = businessId
      ? eq(humanTasks.businessId, Number(businessId))
      : undefined;

    // Count by status
    const statusCounts = await db
      .select({
        status: humanTasks.status,
        count: sql<number>`count(*)`,
      })
      .from(humanTasks)
      .where(baseCondition)
      .groupBy(humanTasks.status);

    // Count by category (pending only)
    const categoryCounts = await db
      .select({
        category: humanTasks.category,
        count: sql<number>`count(*)`,
      })
      .from(humanTasks)
      .where(
        baseCondition
          ? and(baseCondition, eq(humanTasks.status, 'pending'))
          : eq(humanTasks.status, 'pending')
      )
      .groupBy(humanTasks.category);

    // Count by priority (pending only)
    const priorityCounts = await db
      .select({
        priority: humanTasks.priority,
        count: sql<number>`count(*)`,
      })
      .from(humanTasks)
      .where(
        baseCondition
          ? and(baseCondition, eq(humanTasks.status, 'pending'))
          : eq(humanTasks.status, 'pending')
      )
      .groupBy(humanTasks.priority);

    // Count overdue
    const [overdueCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(humanTasks)
      .where(
        and(
          baseCondition || sql`true`,
          eq(humanTasks.status, 'pending'),
          lte(humanTasks.dueBy, new Date())
        )
      );

    res.json({
      byStatus: Object.fromEntries(statusCounts.map((r) => [r.status, Number(r.count)])),
      byCategory: Object.fromEntries(categoryCounts.map((r) => [r.category, Number(r.count)])),
      byPriority: Object.fromEntries(priorityCounts.map((r) => [r.priority, Number(r.count)])),
      overdue: Number(overdueCount?.count || 0),
    });
  } catch (error) {
    console.error('[Tasks API] Error getting stats:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get stats',
    });
  }
});

export default router;
