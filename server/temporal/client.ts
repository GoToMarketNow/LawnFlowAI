/**
 * Temporal Client
 *
 * Singleton client for starting workflows and sending signals.
 * Used by the Express API to interact with Temporal.
 *
 * @module server/temporal/client
 */

import { Client, Connection, ConnectionOptions } from '@temporalio/client';
import { getTemporalConfig, TemporalConfig } from './config';

let _connection: Connection | null = null;
let _client: Client | null = null;

/**
 * Create a Temporal connection
 */
async function createConnection(config: TemporalConfig): Promise<Connection> {
  const connectionOptions: ConnectionOptions = {
    address: config.address,
  };

  // Add TLS configuration if using Temporal Cloud (address contains .tmprl.cloud)
  if (config.address.includes('.tmprl.cloud')) {
    // For Temporal Cloud, TLS is required
    // Certificate configuration would go here
    console.log('[Temporal] Connecting to Temporal Cloud...');
  } else {
    console.log(`[Temporal] Connecting to local Temporal at ${config.address}...`);
  }

  return Connection.connect(connectionOptions);
}

/**
 * Get the Temporal client (creates connection if needed)
 */
export async function getTemporalClient(): Promise<Client> {
  if (_client) {
    return _client;
  }

  const config = getTemporalConfig();

  if (!_connection) {
    _connection = await createConnection(config);
    console.log(`[Temporal] Connected to ${config.address}`);
  }

  _client = new Client({
    connection: _connection,
    namespace: config.namespace,
  });

  console.log(`[Temporal] Client initialized for namespace: ${config.namespace}`);
  return _client;
}

/**
 * Close the Temporal connection
 */
export async function closeTemporalClient(): Promise<void> {
  if (_client) {
    _client = null;
  }

  if (_connection) {
    await _connection.close();
    _connection = null;
    console.log('[Temporal] Connection closed');
  }
}

/**
 * Get connection status
 */
export function isTemporalConnected(): boolean {
  return _connection !== null && _client !== null;
}

/**
 * Health check for Temporal connection
 */
export async function checkTemporalHealth(): Promise<{
  connected: boolean;
  namespace: string;
  address: string;
  error?: string;
}> {
  const config = getTemporalConfig();

  try {
    const client = await getTemporalClient();

    // Try to describe the namespace to verify connection
    const namespaceInfo = await client.workflowService.describeNamespace({
      namespace: config.namespace,
    });

    return {
      connected: true,
      namespace: namespaceInfo.namespaceInfo?.name || config.namespace,
      address: config.address,
    };
  } catch (error) {
    return {
      connected: false,
      namespace: config.namespace,
      address: config.address,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper to generate a workflow ID
 */
export function generateWorkflowId(prefix: string, entityId: number | string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${entityId}-${timestamp}-${random}`;
}

/**
 * Workflow handle interface for tracking started workflows
 */
export interface WorkflowStartResult {
  workflowId: string;
  runId: string;
}
