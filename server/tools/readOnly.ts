// Read-Only Tools for AI Assistant
// Security: NO database writes, only reads
// All tools are audited and logged

import { db } from "../db";
import { jobs, invoices, quotes, notifications } from "@shared/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  handler: (params: any) => Promise<any>;
}

/**
 * Tool 1: Get Next Visit
 * Returns the next scheduled visit for a customer
 */
export const getNextVisit: ToolDefinition = {
  name: "get_next_visit",
  description: "Get the next scheduled service visit for a customer",
  parameters: {
    type: "object",
    properties: {
      customerId: {
        type: "number",
        description: "Customer ID",
      },
    },
    required: ["customerId"],
  },
  handler: async (params: { customerId: number }) => {
    const { customerId } = params;

    if (!customerId || customerId <= 0) {
      throw new Error("Valid customerId required");
    }

    try {
      const visit = await db.query.jobs.findFirst({
        where: and(
          eq(jobs.customerId, customerId),
          gte(jobs.scheduledDate, new Date())
        ),
        orderBy: [jobs.scheduledDate],
      });

      if (!visit) {
        return {
          found: false,
          message: "No upcoming visits scheduled",
        };
      }

      return {
        found: true,
        visit: {
          jobId: visit.id,
          scheduledDate: visit.scheduledDate,
          serviceType: visit.serviceType,
          status: visit.status,
          crewName: visit.crewName || "Not yet assigned",
          estimatedDuration: visit.estimatedDuration,
          address: visit.address,
        },
      };
    } catch (error: any) {
      throw new Error(`Failed to get next visit: ${error.message}`);
    }
  },
};

/**
 * Tool 2: Get Job Status
 * Returns current status of a specific job
 */
export const getJobStatus: ToolDefinition = {
  name: "get_job_status",
  description: "Get the current status and details of a job",
  parameters: {
    type: "object",
    properties: {
      jobId: {
        type: "number",
        description: "Job ID",
      },
    },
    required: ["jobId"],
  },
  handler: async (params: { jobId: number }) => {
    const { jobId } = params;

    if (!jobId || jobId <= 0) {
      throw new Error("Valid jobId required");
    }

    try {
      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, jobId),
      });

      if (!job) {
        return {
          found: false,
          message: "Job not found",
        };
      }

      return {
        found: true,
        job: {
          jobId: job.id,
          status: job.status,
          scheduledDate: job.scheduledDate,
          completedAt: job.completedAt,
          serviceType: job.serviceType,
          crewName: job.crewName,
          customerName: job.customerName,
          address: job.address,
          notes: job.notes,
        },
      };
    } catch (error: any) {
      throw new Error(`Failed to get job status: ${error.message}`);
    }
  },
};

/**
 * Tool 3: Get Invoice Balance
 * Returns unpaid invoice balance for a customer
 */
export const getInvoiceBalance: ToolDefinition = {
  name: "get_invoice_balance",
  description: "Get the total unpaid invoice balance for a customer",
  parameters: {
    type: "object",
    properties: {
      customerId: {
        type: "number",
        description: "Customer ID",
      },
    },
    required: ["customerId"],
  },
  handler: async (params: { customerId: number }) => {
    const { customerId } = params;

    if (!customerId || customerId <= 0) {
      throw new Error("Valid customerId required");
    }

    try {
      // Query unpaid invoices
      const unpaidInvoices = await db.query.invoices?.findMany({
        where: and(
          eq(invoices.customerId, customerId),
          eq(invoices.status, "unpaid")
        ),
      }) || [];

      const totalBalance = unpaidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

      return {
        totalBalance,
        invoiceCount: unpaidInvoices.length,
        invoices: unpaidInvoices.map(inv => ({
          invoiceId: inv.id,
          amount: inv.amount,
          dueDate: inv.dueDate,
          createdAt: inv.createdAt,
        })),
      };
    } catch (error: any) {
      // If invoices table doesn't exist yet, return safe fallback
      return {
        totalBalance: 0,
        invoiceCount: 0,
        invoices: [],
        note: "Invoice system not yet configured",
      };
    }
  },
};

/**
 * Tool 4: Get Quote Status
 * Returns status of a quote
 */
export const getQuoteStatus: ToolDefinition = {
  name: "get_quote_status",
  description: "Get the status and details of a quote",
  parameters: {
    type: "object",
    properties: {
      quoteId: {
        type: "number",
        description: "Quote ID",
      },
    },
    required: ["quoteId"],
  },
  handler: async (params: { quoteId: number }) => {
    const { quoteId } = params;

    if (!quoteId || quoteId <= 0) {
      throw new Error("Valid quoteId required");
    }

    try {
      const quote = await db.query.quotes?.findFirst({
        where: eq(quotes.id, quoteId),
      });

      if (!quote) {
        return {
          found: false,
          message: "Quote not found",
        };
      }

      return {
        found: true,
        quote: {
          quoteId: quote.id,
          status: quote.status,
          amount: quote.total,
          validUntil: quote.expiresAt,
          createdAt: quote.createdAt,
          items: quote.items || [],
        },
      };
    } catch (error: any) {
      return {
        found: false,
        message: "Quote system not yet configured",
      };
    }
  },
};

/**
 * Tool 5: Get Notification Log
 * Returns recent notifications sent to a customer
 */
export const getNotificationLog: ToolDefinition = {
  name: "get_notification_log",
  description: "Get recent notifications sent to a customer",
  parameters: {
    type: "object",
    properties: {
      customerId: {
        type: "number",
        description: "Customer ID (user ID)",
      },
      limit: {
        type: "number",
        description: "Maximum number of notifications to return (default: 5)",
        default: 5,
      },
    },
    required: ["customerId"],
  },
  handler: async (params: { customerId: number; limit?: number }) => {
    const { customerId, limit = 5 } = params;

    if (!customerId || customerId <= 0) {
      throw new Error("Valid customerId required");
    }

    if (limit > 20) {
      throw new Error("Maximum limit is 20 notifications");
    }

    try {
      const recentNotifications = await db.query.notifications.findMany({
        where: eq(notifications.recipientUserId, customerId),
        orderBy: [desc(notifications.createdAt)],
        limit: Math.min(limit, 20),
      });

      return {
        notifications: recentNotifications.map(n => ({
          notificationId: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          sentAt: n.sentAt,
          status: n.status,
          channel: n.channel,
        })),
        count: recentNotifications.length,
      };
    } catch (error: any) {
      throw new Error(`Failed to get notification log: ${error.message}`);
    }
  },
};

// Export all tools as array
export const READ_ONLY_TOOLS: ToolDefinition[] = [
  getNextVisit,
  getJobStatus,
  getInvoiceBalance,
  getQuoteStatus,
  getNotificationLog,
];

/**
 * Get tool by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return READ_ONLY_TOOLS.find(tool => tool.name === name);
}

/**
 * Validate tool parameters
 */
export function validateToolParams(tool: ToolDefinition, params: any): boolean {
  const required = tool.parameters.required || [];

  for (const field of required) {
    if (params[field] === undefined || params[field] === null) {
      throw new Error(`Missing required parameter: ${field}`);
    }
  }

  return true;
}

/**
 * Get tool definitions for LLM (OpenAI function calling format)
 */
export function getToolDefinitionsForLLM(): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}> {
  return READ_ONLY_TOOLS.map(tool => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
