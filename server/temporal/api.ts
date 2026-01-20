/**
 * Temporal API Routes
 *
 * Express routes for starting workflows, sending signals, and querying status.
 * These are the integration points between the Express API and Temporal.
 *
 * @module server/temporal/api
 */

import { Router, Request, Response } from 'express';
import { getTemporalClient, generateWorkflowId, checkTemporalHealth } from './client';
import { getTemporalConfig, TaskQueues } from './config';
import { JobCloseoutWorkflow } from './workflows/jobCloseout';
import { db } from '../db';
import { humanTasks, workflowRuns } from '@shared/schema-temporal';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

// ============================================================================
// Health Check
// ============================================================================

/**
 * GET /api/temporal/health
 * Check Temporal connection health
 */
router.get('/health', async (_req: Request, res: Response) => {
  const health = await checkTemporalHealth();
  res.status(health.connected ? 200 : 503).json(health);
});

// ============================================================================
// Workflow Endpoints
// ============================================================================

/**
 * POST /api/temporal/workflows/job-closeout
 * Start a JobCloseout workflow
 */
router.post('/workflows/job-closeout', async (req: Request, res: Response) => {
  try {
    const { accountId, businessId, jobId, customerId, amount, serviceType } = req.body;

    // Validate required fields
    if (!accountId || !businessId || !jobId) {
      return res.status(400).json({
        error: 'Missing required fields: accountId, businessId, jobId',
      });
    }

    const client = await getTemporalClient();
    const config = getTemporalConfig();
    const workflowId = generateWorkflowId('job-closeout', jobId);

    const handle = await client.workflow.start(JobCloseoutWorkflow, {
      taskQueue: config.taskQueue,
      workflowId,
      args: [
        {
          accountId: String(accountId),
          businessId: Number(businessId),
          jobId: Number(jobId),
          customerId: customerId ? Number(customerId) : undefined,
          amount: amount ? Number(amount) : undefined,
          serviceType,
          completedAt: new Date().toISOString(),
        },
      ],
    });

    // Return 202 Accepted with run info
    res.status(202).json({
      accepted: true,
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      taskQueue: config.taskQueue,
    });
  } catch (error) {
    console.error('[Temporal API] Error starting JobCloseout workflow:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start workflow',
    });
  }
});

/**
 * GET /api/temporal/workflows/:workflowId
 * Get workflow status
 */
router.get('/workflows/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();

    // Also get from our database for extra context
    const [dbRun] = await db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.workflowId, workflowId))
      .limit(1);

    res.json({
      workflowId: description.workflowId,
      runId: description.runId,
      status: description.status.name,
      type: description.type,
      startTime: description.startTime,
      closeTime: description.closeTime,
      // Include our database state
      dbStatus: dbRun?.status,
      currentStage: dbRun?.currentStage,
      input: dbRun?.inputJson,
      output: dbRun?.outputJson,
      error: dbRun?.errorJson,
    });
  } catch (error) {
    console.error('[Temporal API] Error getting workflow:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get workflow',
    });
  }
});

/**
 * GET /api/temporal/workflows/:workflowId/result
 * Get workflow result (waits for completion)
 */
router.get('/workflows/:workflowId/result', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const timeout = parseInt(req.query.timeout as string) || 30000;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);

    // Wait for result with timeout
    const result = await Promise.race([
      handle.result(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for result')), timeout)
      ),
    ]);

    res.json({ result });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Timeout')) {
      res.status(408).json({ error: 'Timeout waiting for workflow result' });
    } else {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get result',
      });
    }
  }
});

// ============================================================================
// Signal Endpoints
// ============================================================================

/**
 * POST /api/temporal/workflows/:workflowId/signal/:signalName
 * Send a signal to a workflow
 */
router.post('/workflows/:workflowId/signal/:signalName', async (req: Request, res: Response) => {
  try {
    const { workflowId, signalName } = req.params;
    const signalData = req.body;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);

    await handle.signal(signalName, signalData);

    res.json({ success: true, workflowId, signalName });
  } catch (error) {
    console.error('[Temporal API] Error sending signal:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to send signal',
    });
  }
});

/**
 * POST /api/temporal/workflows/:workflowId/cancel
 * Cancel a running workflow
 */
router.post('/workflows/:workflowId/cancel', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const { reason } = req.body;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);

    // Send cancel signal first (gives workflow chance to clean up)
    await handle.signal('cancel', { reason: reason || 'Cancelled via API' });

    res.json({ success: true, workflowId });
  } catch (error) {
    console.error('[Temporal API] Error cancelling workflow:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to cancel workflow',
    });
  }
});

// ============================================================================
// Human Task Endpoints
// ============================================================================

/**
 * GET /api/temporal/tasks
 * List human tasks
 */
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const {
      businessId,
      status = 'pending',
      role,
      category,
      limit = '50',
      offset = '0',
    } = req.query;

    let query = db.select().from(humanTasks);

    // Build where conditions
    const conditions = [];
    if (businessId) conditions.push(eq(humanTasks.businessId, Number(businessId)));
    if (status) conditions.push(eq(humanTasks.status, String(status)));
    if (role) conditions.push(eq(humanTasks.assignedRole, String(role)));
    if (category) conditions.push(eq(humanTasks.category, String(category)));

    const tasks = await db
      .select()
      .from(humanTasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(humanTasks.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json({ tasks, count: tasks.length });
  } catch (error) {
    console.error('[Temporal API] Error listing tasks:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list tasks',
    });
  }
});

/**
 * GET /api/temporal/tasks/:taskId
 * Get a specific task
 */
router.get('/tasks/:taskId', async (req: Request, res: Response) => {
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

    res.json({ task });
  } catch (error) {
    console.error('[Temporal API] Error getting task:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get task',
    });
  }
});

/**
 * POST /api/temporal/tasks/:taskId/resolve
 * Resolve a human task (sends signal to workflow)
 */
router.post('/tasks/:taskId/resolve', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { resolution, data, notes } = req.body;
    const userId = (req as any).user?.id || 0; // Get from auth middleware

    // Get the task
    const [task] = await db
      .select()
      .from(humanTasks)
      .where(eq(humanTasks.taskId, taskId))
      .limit(1);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status !== 'pending' && task.status !== 'in_progress') {
      return res.status(400).json({ error: 'Task already resolved' });
    }

    // Get the workflow
    if (task.workflowRunId) {
      const [run] = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.id, task.workflowRunId))
        .limit(1);

      if (run && task.signalName) {
        // Send signal to workflow
        const client = await getTemporalClient();
        const handle = client.workflow.getHandle(run.workflowId);

        await handle.signal(task.signalName, {
          approved: resolution === 'approved',
          data,
          userId,
          notes,
        });
      }
    }

    // Update task status
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

    res.json({ success: true, taskId, resolution });
  } catch (error) {
    console.error('[Temporal API] Error resolving task:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to resolve task',
    });
  }
});

// ============================================================================
// Workflow Run Endpoints (from our database)
// ============================================================================

/**
 * GET /api/temporal/runs
 * List workflow runs from our database
 */
router.get('/runs', async (req: Request, res: Response) => {
  try {
    const {
      businessId,
      status,
      workflowType,
      limit = '50',
      offset = '0',
    } = req.query;

    const conditions = [];
    if (businessId) conditions.push(eq(workflowRuns.businessId, Number(businessId)));
    if (status) conditions.push(eq(workflowRuns.status, String(status)));
    if (workflowType) conditions.push(eq(workflowRuns.workflowType, String(workflowType)));

    const runs = await db
      .select()
      .from(workflowRuns)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(workflowRuns.startedAt))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json({ runs, count: runs.length });
  } catch (error) {
    console.error('[Temporal API] Error listing runs:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list runs',
    });
  }
});

export default router;
