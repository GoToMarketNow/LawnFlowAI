// Tool Router for AI Assistant
// Security: Executes read-only tools, logs all executions, validates params
// No direct database writes allowed

import { db } from "../../db";
import { assistantToolExecutions, type NewAssistantToolExecution } from "@shared/assistant-schema";
import { getToolByName, validateToolParams } from "../../tools/readOnly";
import { audit } from "../audit";

export interface ToolExecutionContext {
  conversationId: number;
  messageId?: number;
  businessId: number;
  userId?: number;
}

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTimeMs: number;
}

/**
 * Execute a read-only tool
 * @param toolName - Name of the tool to execute
 * @param params - Tool parameters
 * @param context - Execution context
 * @returns Tool execution result
 */
export async function executeReadOnlyTool(
  toolName: string,
  params: any,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    // 1. Get tool definition
    const tool = getToolByName(toolName);

    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // 2. Validate parameters
    validateToolParams(tool, params);

    // 3. Execute tool handler
    const result = await tool.handler(params);

    const executionTimeMs = Date.now() - startTime;

    // 4. Log execution (audit trail)
    await logToolExecution({
      conversationId: context.conversationId,
      messageId: context.messageId,
      businessId: context.businessId,
      toolName,
      toolParams: params,
      toolResult: result,
      executionTimeMs,
      success: true,
      isReadOnly: true,
    });

    // 5. Audit log
    await audit.logEvent({
      action: "assistant.tool_executed",
      actor: context.userId || "system",
      businessId: context.businessId,
      metadata: {
        toolName,
        conversationId: context.conversationId,
        executionTimeMs,
      },
    });

    return {
      toolName,
      success: true,
      result,
      executionTimeMs,
    };
  } catch (error: any) {
    const executionTimeMs = Date.now() - startTime;

    // Log failed execution
    await logToolExecution({
      conversationId: context.conversationId,
      messageId: context.messageId,
      businessId: context.businessId,
      toolName,
      toolParams: params,
      executionTimeMs,
      success: false,
      errorMessage: error.message,
      isReadOnly: true,
    });

    // Audit log
    await audit.logEvent({
      action: "assistant.tool_failed",
      actor: context.userId || "system",
      businessId: context.businessId,
      metadata: {
        toolName,
        error: error.message,
        conversationId: context.conversationId,
      },
    });

    return {
      toolName,
      success: false,
      error: error.message,
      executionTimeMs,
    };
  }
}

/**
 * Execute multiple tools in sequence
 * @param toolCalls - Array of tool calls
 * @param context - Execution context
 * @returns Array of execution results
 */
export async function executeToolsBatch(
  toolCalls: Array<{ name: string; params: any }>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];

  for (const call of toolCalls) {
    const result = await executeReadOnlyTool(call.name, call.params, context);
    results.push(result);

    // Small delay between calls to prevent rate limit issues
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Log tool execution to database
 * @param execution - Tool execution data
 */
async function logToolExecution(execution: NewAssistantToolExecution): Promise<void> {
  try {
    await db.insert(assistantToolExecutions).values(execution);
  } catch (error: any) {
    console.error("Failed to log tool execution:", error.message);
    // Don't throw - logging failure shouldn't break tool execution
  }
}

/**
 * Get tool execution history for a conversation
 * @param conversationId - Conversation ID
 * @param limit - Maximum results
 * @returns Tool execution history
 */
export async function getToolExecutionHistory(
  conversationId: number,
  limit: number = 10
): Promise<typeof assistantToolExecutions.$inferSelect[]> {
  try {
    const history = await db.query.assistantToolExecutions.findMany({
      where: eq(assistantToolExecutions.conversationId, conversationId),
      orderBy: [desc(assistantToolExecutions.executedAt)],
      limit: Math.min(limit, 50),
    });

    return history;
  } catch (error: any) {
    console.error("Failed to get tool execution history:", error.message);
    return [];
  }
}

/**
 * Get tool usage statistics
 * @param businessId - Business ID
 * @param days - Number of days to analyze
 * @returns Tool usage statistics
 */
export async function getToolUsageStats(
  businessId: number,
  days: number = 7
): Promise<{
  toolName: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  avgExecutionTimeMs: number;
}[]> {
  try {
    const stats = await db.execute(sql`
      SELECT
        tool_name,
        COUNT(*) as execution_count,
        COUNT(*) FILTER (WHERE success = true) as success_count,
        COUNT(*) FILTER (WHERE success = false) as failure_count,
        AVG(execution_time_ms) as avg_execution_time_ms
      FROM assistant_tool_executions
      WHERE business_id = ${businessId}
        AND executed_at > NOW() - INTERVAL '${days} days'
      GROUP BY tool_name
      ORDER BY execution_count DESC
    `);

    return (stats.rows as any[]).map(row => ({
      toolName: row.tool_name,
      executionCount: parseInt(row.execution_count),
      successCount: parseInt(row.success_count),
      failureCount: parseInt(row.failure_count),
      avgExecutionTimeMs: parseFloat(row.avg_execution_time_ms),
    }));
  } catch (error: any) {
    console.error("Failed to get tool usage stats:", error.message);
    return [];
  }
}

/**
 * Format tool result for display to user
 * @param result - Tool execution result
 * @returns Human-readable string
 */
export function formatToolResult(result: ToolExecutionResult): string {
  if (!result.success) {
    return `Tool ${result.toolName} failed: ${result.error}`;
  }

  switch (result.toolName) {
    case "get_next_visit":
      if (!result.result.found) {
        return "You don't have any upcoming visits scheduled.";
      }
      return `Your next visit is scheduled for ${new Date(result.result.visit.scheduledDate).toLocaleDateString()} for ${result.result.visit.serviceType}.`;

    case "get_job_status":
      if (!result.result.found) {
        return "Job not found.";
      }
      return `Job status: ${result.result.job.status}. Scheduled for ${new Date(result.result.job.scheduledDate).toLocaleDateString()}.`;

    case "get_invoice_balance":
      if (result.result.totalBalance === 0) {
        return "You have no outstanding invoices.";
      }
      return `You have ${result.result.invoiceCount} unpaid invoice(s) totaling $${result.result.totalBalance.toFixed(2)}.`;

    case "get_quote_status":
      if (!result.result.found) {
        return "Quote not found.";
      }
      return `Quote status: ${result.result.quote.status}. Amount: $${result.result.quote.amount.toFixed(2)}.`;

    case "get_notification_log":
      return `Found ${result.result.count} recent notification(s).`;

    default:
      return JSON.stringify(result.result, null, 2);
  }
}

/**
 * Health check for tool router
 */
export async function testToolRouter(): Promise<boolean> {
  try {
    // Test tool lookup
    const tool = getToolByName("get_next_visit");
    return tool !== undefined;
  } catch {
    return false;
  }
}

// Import statements for Drizzle
import { eq, desc, sql } from "drizzle-orm";
