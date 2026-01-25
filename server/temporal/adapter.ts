/**
 * Temporal Adapter - Feature Flag Routing
 * Sprint 5: Full Migration
 *
 * This adapter provides a migration path from legacy orchestration to Temporal.
 * It supports gradual rollout via feature flags and percentage-based routing.
 */

import { getTemporalClient } from "./client";
import type { LeadToCashWorkflowInput } from "./workflows/leadToCash";
import type { BillingWorkflowInput } from "./workflows/billing";
import type { OrchestrationContext } from "@shared/orchestrator/contracts";

// =============================================================================
// Configuration
// =============================================================================

export interface TemporalAdapterConfig {
  /** Enable Temporal workflows (master switch) */
  enabled: boolean;
  /** Percentage of traffic to route to Temporal (0-100) */
  rolloutPercent: number;
  /** Business IDs that should always use Temporal */
  alwaysTemporalBusinessIds: number[];
  /** Business IDs that should never use Temporal */
  neverTemporalBusinessIds: number[];
  /** Workflow-specific overrides */
  workflowOverrides: {
    leadToCash?: { enabled?: boolean; rolloutPercent?: number };
    billing?: { enabled?: boolean; rolloutPercent?: number };
  };
}

// Default configuration from environment
function getDefaultConfig(): TemporalAdapterConfig {
  return {
    enabled: process.env.USE_TEMPORAL === "true",
    rolloutPercent: parseInt(process.env.TEMPORAL_ROLLOUT_PERCENT || "0", 10),
    alwaysTemporalBusinessIds: (process.env.TEMPORAL_ALWAYS_BUSINESS_IDS || "")
      .split(",")
      .filter(Boolean)
      .map(Number),
    neverTemporalBusinessIds: (process.env.TEMPORAL_NEVER_BUSINESS_IDS || "")
      .split(",")
      .filter(Boolean)
      .map(Number),
    workflowOverrides: {},
  };
}

let currentConfig: TemporalAdapterConfig = getDefaultConfig();

/**
 * Update adapter configuration at runtime
 */
export function updateAdapterConfig(updates: Partial<TemporalAdapterConfig>): void {
  currentConfig = { ...currentConfig, ...updates };
  console.log("[TemporalAdapter] Config updated:", currentConfig);
}

/**
 * Get current adapter configuration
 */
export function getAdapterConfig(): TemporalAdapterConfig {
  return { ...currentConfig };
}

// =============================================================================
// Routing Logic
// =============================================================================

export type WorkflowType = "leadToCash" | "billing";

interface RoutingDecision {
  useTemporal: boolean;
  reason: string;
}

/**
 * Determine whether to use Temporal for a given workflow
 */
export function shouldUseTemporal(
  workflowType: WorkflowType,
  businessId: number,
  additionalContext?: { forceTemoral?: boolean; forceLegacy?: boolean }
): RoutingDecision {
  // Explicit overrides take precedence
  if (additionalContext?.forceTemoral) {
    return { useTemporal: true, reason: "forced_temporal" };
  }
  if (additionalContext?.forceLegacy) {
    return { useTemporal: false, reason: "forced_legacy" };
  }

  // Master switch
  if (!currentConfig.enabled) {
    return { useTemporal: false, reason: "temporal_disabled" };
  }

  // Never-Temporal business IDs
  if (currentConfig.neverTemporalBusinessIds.includes(businessId)) {
    return { useTemporal: false, reason: "business_excluded" };
  }

  // Always-Temporal business IDs
  if (currentConfig.alwaysTemporalBusinessIds.includes(businessId)) {
    return { useTemporal: true, reason: "business_included" };
  }

  // Workflow-specific overrides
  const workflowConfig = currentConfig.workflowOverrides[workflowType];
  if (workflowConfig?.enabled === false) {
    return { useTemporal: false, reason: "workflow_disabled" };
  }

  // Percentage-based rollout
  const rolloutPercent = workflowConfig?.rolloutPercent ?? currentConfig.rolloutPercent;
  if (rolloutPercent <= 0) {
    return { useTemporal: false, reason: "rollout_zero" };
  }
  if (rolloutPercent >= 100) {
    return { useTemporal: true, reason: "rollout_full" };
  }

  // Use deterministic hash based on businessId for consistent routing
  const hash = businessId % 100;
  const useTemporal = hash < rolloutPercent;

  return {
    useTemporal,
    reason: useTemporal ? "rollout_included" : "rollout_excluded",
  };
}

// =============================================================================
// Lead-to-Cash Adapter
// =============================================================================

export interface StartLeadToCashParams {
  accountId: string;
  businessId: number;
  jobRequestId: number;
  initialContext: OrchestrationContext;
  userId?: number;
  channel?: "sms" | "web" | "ops";
  forceTemporal?: boolean;
  forceLegacy?: boolean;
}

export interface StartLeadToCashResult {
  success: boolean;
  runId: string;
  workflowId?: string;
  useTemporal: boolean;
  routingReason: string;
  message: string;
}

/**
 * Start Lead-to-Cash orchestration with automatic routing
 */
export async function startLeadToCashOrchestration(
  params: StartLeadToCashParams
): Promise<StartLeadToCashResult> {
  const routing = shouldUseTemporal("leadToCash", params.businessId, {
    forceTemoral: params.forceTemporal,
    forceLegacy: params.forceLegacy,
  });

  if (routing.useTemporal) {
    try {
      const client = await getTemporalClient();
      const workflowId = `l2c-${params.businessId}-${params.jobRequestId}-${Date.now()}`;

      const input: LeadToCashWorkflowInput = {
        accountId: params.accountId,
        businessId: params.businessId,
        jobRequestId: params.jobRequestId,
        initialContext: params.initialContext,
        userId: params.userId,
        channel: params.channel,
      };

      const handle = await client.workflow.start("leadToCashWorkflow", {
        taskQueue: "lead-to-cash",
        workflowId,
        args: [input],
      });

      console.log(`[TemporalAdapter] Started Temporal L2C workflow: ${workflowId}`);

      return {
        success: true,
        runId: handle.workflowId,
        workflowId: handle.workflowId,
        useTemporal: true,
        routingReason: routing.reason,
        message: "Temporal workflow started",
      };
    } catch (err) {
      console.error("[TemporalAdapter] Failed to start Temporal workflow:", err);

      // Fallback to legacy on Temporal failure
      return startLegacyLeadToCash(params, `temporal_error: ${err}`);
    }
  }

  return startLegacyLeadToCash(params, routing.reason);
}

async function startLegacyLeadToCash(
  params: StartLeadToCashParams,
  reason: string
): Promise<StartLeadToCashResult> {
  // Import legacy orchestration dynamically to avoid circular deps
  const { startOrchestration } = await import("../orchestrator/leadToCash/engine");

  const result = await startOrchestration({
    accountId: params.accountId,
    businessId: params.businessId,
    jobRequestId: params.jobRequestId,
    userId: params.userId,
    channel: params.channel,
  });

  return {
    success: result.success,
    runId: result.runId,
    useTemporal: false,
    routingReason: reason,
    message: result.message,
  };
}

// =============================================================================
// Billing Adapter
// =============================================================================

export interface StartBillingParams {
  accountId: string;
  businessId: number;
  jobId: number;
  customerId?: number;
  customerPhone?: string;
  customerEmail?: string;
  amount?: number;
  dueInDays?: number;
  forceTemporal?: boolean;
  forceLegacy?: boolean;
}

export interface StartBillingResult {
  success: boolean;
  runId: string;
  workflowId?: string;
  useTemporal: boolean;
  routingReason: string;
  message: string;
}

/**
 * Start Billing workflow with automatic routing
 */
export async function startBillingWorkflow(
  params: StartBillingParams
): Promise<StartBillingResult> {
  const routing = shouldUseTemporal("billing", params.businessId, {
    forceTemoral: params.forceTemporal,
    forceLegacy: params.forceLegacy,
  });

  if (routing.useTemporal) {
    try {
      const client = await getTemporalClient();
      const workflowId = `billing-${params.businessId}-${params.jobId}-${Date.now()}`;

      const input: BillingWorkflowInput = {
        accountId: params.accountId,
        businessId: params.businessId,
        jobId: params.jobId,
        customerId: params.customerId,
        customerPhone: params.customerPhone,
        customerEmail: params.customerEmail,
        amount: params.amount,
        dueInDays: params.dueInDays,
      };

      const handle = await client.workflow.start("billingWorkflow", {
        taskQueue: "billing",
        workflowId,
        args: [input],
      });

      console.log(`[TemporalAdapter] Started Temporal Billing workflow: ${workflowId}`);

      return {
        success: true,
        runId: handle.workflowId,
        workflowId: handle.workflowId,
        useTemporal: true,
        routingReason: routing.reason,
        message: "Temporal workflow started",
      };
    } catch (err) {
      console.error("[TemporalAdapter] Failed to start Temporal billing workflow:", err);

      // Fallback to legacy
      return startLegacyBilling(params, `temporal_error: ${err}`);
    }
  }

  return startLegacyBilling(params, routing.reason);
}

async function startLegacyBilling(
  params: StartBillingParams,
  reason: string
): Promise<StartBillingResult> {
  // Legacy billing would be called here
  // For now, return a stub indicating legacy is not yet implemented
  console.log(`[TemporalAdapter] Legacy billing for job ${params.jobId} (${reason})`);

  return {
    success: true,
    runId: `legacy-billing-${params.jobId}-${Date.now()}`,
    useTemporal: false,
    routingReason: reason,
    message: "Legacy billing stub (not yet implemented)",
  };
}

// =============================================================================
// Signal Forwarding (for webhook integration)
// =============================================================================

export interface ForwardSignalParams {
  workflowId: string;
  signalName: string;
  signalArgs: unknown[];
}

/**
 * Forward a signal to a running Temporal workflow
 */
export async function forwardSignalToWorkflow(
  params: ForwardSignalParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(params.workflowId);

    await handle.signal(params.signalName, ...params.signalArgs);

    console.log(`[TemporalAdapter] Forwarded signal ${params.signalName} to ${params.workflowId}`);

    return { success: true };
  } catch (err) {
    console.error("[TemporalAdapter] Failed to forward signal:", err);
    return { success: false, error: String(err) };
  }
}

// =============================================================================
// Query Helpers
// =============================================================================

/**
 * Query a running workflow's status
 */
export async function queryWorkflowStatus(
  workflowId: string,
  queryName: string = "getStatus"
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);

    const result = await handle.query(queryName);

    return { success: true, result };
  } catch (err) {
    console.error("[TemporalAdapter] Failed to query workflow:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get workflow execution result (for completed workflows)
 */
export async function getWorkflowResult(
  workflowId: string
): Promise<{ success: boolean; result?: unknown; status?: string; error?: string }> {
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);

    const description = await handle.describe();
    const status = description.status.name;

    if (status === "COMPLETED") {
      const result = await handle.result();
      return { success: true, result, status };
    }

    return { success: true, status };
  } catch (err) {
    console.error("[TemporalAdapter] Failed to get workflow result:", err);
    return { success: false, error: String(err) };
  }
}

// =============================================================================
// Metrics for Observability
// =============================================================================

export interface AdapterMetrics {
  totalRequests: number;
  temporalRequests: number;
  legacyRequests: number;
  temporalErrors: number;
  routingBreakdown: Record<string, number>;
}

const metrics: AdapterMetrics = {
  totalRequests: 0,
  temporalRequests: 0,
  legacyRequests: 0,
  temporalErrors: 0,
  routingBreakdown: {},
};

/**
 * Get adapter metrics
 */
export function getAdapterMetrics(): AdapterMetrics {
  return { ...metrics };
}

/**
 * Reset adapter metrics (for testing)
 */
export function resetAdapterMetrics(): void {
  metrics.totalRequests = 0;
  metrics.temporalRequests = 0;
  metrics.legacyRequests = 0;
  metrics.temporalErrors = 0;
  metrics.routingBreakdown = {};
}
