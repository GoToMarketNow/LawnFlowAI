/**
 * Temporal Configuration
 *
 * Environment-based configuration for Temporal connection and worker settings.
 *
 * @module server/temporal/config
 */

import { z } from 'zod';

/**
 * Temporal configuration schema with validation
 */
const temporalConfigSchema = z.object({
  // Connection settings
  address: z.string().default('localhost:7233'),
  namespace: z.string().default('default'),

  // Worker settings
  taskQueue: z.string().default('lawnflow-main'),
  maxConcurrentActivityExecutions: z.number().int().positive().default(100),
  maxConcurrentWorkflowExecutions: z.number().int().positive().default(100),

  // Timeout defaults
  defaultActivityTimeout: z.string().default('2m'),
  defaultWorkflowTimeout: z.string().default('24h'),

  // Retry defaults
  defaultMaxAttempts: z.number().int().positive().default(3),
  defaultInitialInterval: z.string().default('1s'),
  defaultBackoffCoefficient: z.number().positive().default(2),

  // Feature flags
  enableOpenTelemetry: z.boolean().default(false),
  enableDebugLogging: z.boolean().default(false),
});

export type TemporalConfig = z.infer<typeof temporalConfigSchema>;

/**
 * Load Temporal configuration from environment variables
 */
export function loadTemporalConfig(): TemporalConfig {
  const rawConfig = {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'lawnflow-main',
    maxConcurrentActivityExecutions: parseInt(
      process.env.TEMPORAL_MAX_CONCURRENT_ACTIVITIES || '100',
      10
    ),
    maxConcurrentWorkflowExecutions: parseInt(
      process.env.TEMPORAL_MAX_CONCURRENT_WORKFLOWS || '100',
      10
    ),
    defaultActivityTimeout: process.env.TEMPORAL_DEFAULT_ACTIVITY_TIMEOUT || '2m',
    defaultWorkflowTimeout: process.env.TEMPORAL_DEFAULT_WORKFLOW_TIMEOUT || '24h',
    defaultMaxAttempts: parseInt(process.env.TEMPORAL_DEFAULT_MAX_ATTEMPTS || '3', 10),
    defaultInitialInterval: process.env.TEMPORAL_DEFAULT_INITIAL_INTERVAL || '1s',
    defaultBackoffCoefficient: parseFloat(
      process.env.TEMPORAL_DEFAULT_BACKOFF_COEFFICIENT || '2'
    ),
    enableOpenTelemetry: process.env.TEMPORAL_ENABLE_OTEL === 'true',
    enableDebugLogging: process.env.TEMPORAL_DEBUG === 'true',
  };

  return temporalConfigSchema.parse(rawConfig);
}

/**
 * Task queue names for different workflow types
 */
export const TaskQueues = {
  MAIN: 'lawnflow-main',
  BILLING: 'lawnflow-billing',
  PAYMENT: 'lawnflow-payment',
  NOTIFICATIONS: 'lawnflow-notifications',
  WEATHER: 'lawnflow-weather',
} as const;

/**
 * Workflow type identifiers
 */
export const WorkflowTypes = {
  JOB_CLOSEOUT: 'JobCloseoutWorkflow',
  LEAD_TO_CASH: 'LeadToCashWorkflow',
  BILLING: 'BillingWorkflow',
  PAYMENT_COLLECTION: 'PaymentCollectionWorkflow',
  CUSTOMER_NOTIFICATION: 'CustomerNotificationWorkflow',
  // Weather workflows
  WEATHER_MONITORING: 'WeatherMonitoringWorkflow',
  SCHEDULE_IMPACT_PLANNING: 'ScheduleImpactPlanningWorkflow',
  WINTER_EVENT_ACTIVATION: 'WinterEventActivationWorkflow',
  SNOW_ICE_FULFILLMENT: 'SnowIceRequestFulfillmentWorkflow',
} as const;

/**
 * Activity retry policy presets
 */
export const RetryPolicies = {
  /**
   * Default policy for most activities
   */
  DEFAULT: {
    maximumAttempts: 3,
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
  },

  /**
   * Policy for external service calls (Stripe, Twilio)
   */
  EXTERNAL_SERVICE: {
    maximumAttempts: 5,
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    nonRetryableErrorTypes: ['ApplicationError'],
  },

  /**
   * Policy for database operations
   */
  DATABASE: {
    maximumAttempts: 3,
    initialInterval: '500ms',
    backoffCoefficient: 2,
    maximumInterval: '10s',
  },

  /**
   * Policy for LLM/AI operations (can be slow and expensive)
   */
  LLM: {
    maximumAttempts: 2,
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
  },

  /**
   * No retry - for operations that should not be retried
   */
  NO_RETRY: {
    maximumAttempts: 1,
  },

  /**
   * Policy for weather API calls (external service with rate limits)
   */
  WEATHER_API: {
    maximumAttempts: 3,
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    nonRetryableErrorTypes: ['BudgetExceeded', 'InvalidLocation'],
  },
} as const;

/**
 * Activity timeout presets
 */
export const ActivityTimeouts = {
  /** Quick operations (DB reads, cache) */
  SHORT: '30s',
  /** Standard operations (most activities) */
  MEDIUM: '2m',
  /** Long operations (LLM calls, complex processing) */
  LONG: '5m',
  /** Very long operations (bulk processing, report generation) */
  EXTENDED: '10m',
} as const;

/**
 * Default configuration instance
 */
let _config: TemporalConfig | null = null;

/**
 * Get the current Temporal configuration (cached)
 */
export function getTemporalConfig(): TemporalConfig {
  if (!_config) {
    _config = loadTemporalConfig();
  }
  return _config;
}

/**
 * Reset configuration (useful for testing)
 */
export function resetTemporalConfig(): void {
  _config = null;
}
