/**
 * Temporal Worker
 *
 * Worker process that executes workflows and activities.
 * Run this as a separate process: `npm run temporal:worker`
 *
 * @module server/temporal/worker
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import { getTemporalConfig, TaskQueues } from './config';
import * as activities from './activities';

/**
 * Run the Temporal worker
 */
async function runWorker(): Promise<void> {
  const config = getTemporalConfig();

  console.log('[Temporal Worker] Starting...');
  console.log(`[Temporal Worker] Address: ${config.address}`);
  console.log(`[Temporal Worker] Namespace: ${config.namespace}`);
  console.log(`[Temporal Worker] Task Queue: ${config.taskQueue}`);

  // Create connection to Temporal
  const connection = await NativeConnection.connect({
    address: config.address,
  });

  console.log('[Temporal Worker] Connected to Temporal server');

  // Create worker
  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: config.taskQueue,

    // Register workflows (bundled separately for determinism)
    workflowsPath: require.resolve('./workflows'),

    // Register activities
    activities,

    // Worker capacity
    maxConcurrentActivityTaskExecutions: config.maxConcurrentActivityExecutions,
    maxConcurrentWorkflowTaskExecutions: config.maxConcurrentWorkflowExecutions,

    // Enable debug mode if configured
    ...(config.enableDebugLogging && {
      debugMode: true,
    }),
  });

  console.log('[Temporal Worker] Worker created, starting execution...');

  // Handle shutdown signals
  const shutdown = async () => {
    console.log('[Temporal Worker] Shutdown signal received');
    worker.shutdown();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Run the worker
  try {
    await worker.run();
    console.log('[Temporal Worker] Worker stopped');
  } catch (error) {
    console.error('[Temporal Worker] Worker error:', error);
    process.exit(1);
  }
}

// Run worker if this is the main module
runWorker().catch((error) => {
  console.error('[Temporal Worker] Fatal error:', error);
  process.exit(1);
});
