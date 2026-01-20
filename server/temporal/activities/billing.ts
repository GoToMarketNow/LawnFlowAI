/**
 * Billing Activities
 *
 * Activities that wrap the existing billing agent for invoice generation
 * and billing operations.
 *
 * @module server/temporal/activities/billing
 */

import {
  runInvoiceBuildAgent,
  PricingRules,
  JobDataForInvoice,
  InvoiceBuildResult,
} from '../../agents/billing';
import { storage } from '../../storage';
import type { Job, Invoice, BusinessProfile } from '@shared/schema';

// ============================================================================
// Build Invoice Activity
// ============================================================================

export interface BuildInvoiceInput {
  accountId: string;
  businessId: number;
  jobId: number;
  amount?: number;
  serviceType?: string;
}

export interface BuildInvoiceOutput {
  success: boolean;
  invoiceId?: number;
  total?: number;
  requiresApproval: boolean;
  confidence?: number;
  error?: string;
  lineItems?: Array<{
    description: string;
    amount: number;
    quantity: number;
  }>;
}

/**
 * Build an invoice for a completed job
 *
 * Wraps the existing runInvoiceBuildAgent function as a Temporal activity.
 */
export async function buildInvoiceActivity(
  input: BuildInvoiceInput
): Promise<BuildInvoiceOutput> {
  const { accountId, businessId, jobId } = input;

  try {
    // Load job data
    const job = await storage.getJob(jobId);
    if (!job) {
      return {
        success: false,
        requiresApproval: false,
        error: `Job ${jobId} not found`,
      };
    }

    // Load business profile for pricing
    const profile = await storage.getBusinessProfile(businessId);
    if (!profile) {
      return {
        success: false,
        requiresApproval: false,
        error: `Business profile ${businessId} not found`,
      };
    }

    // Build pricing rules from business profile
    const pricing: PricingRules = {
      baseRates: {
        mowing: profile.mowingMinPrice ?? 4500,
        cleanup: profile.cleanupMinPrice ?? 15000,
        mulch: profile.mulchMinPrice ?? 20000,
        general: 5000,
      },
      taxRate:
        profile.taxEnabled && profile.defaultTaxRate
          ? profile.defaultTaxRate / 10000
          : 0,
    };

    // Prepare job data for the agent
    const jobData: JobDataForInvoice = {
      id: job.id,
      title: job.serviceType || 'Lawn Service',
      description: job.notes || undefined,
      customerName: job.customerName || undefined,
      customerPhone: job.customerPhone || undefined,
      serviceType: job.serviceType || 'general',
      scheduledDate: job.scheduledDate,
      completedDate: job.scheduledDate, // Using scheduled date as completed date
      notes: job.notes || undefined,
      status: 'COMPLETED',
      quoteAmount: job.estimatedPrice || undefined,
    };

    // Run the existing billing agent
    const result = await runInvoiceBuildAgent(
      jobData,
      parseInt(accountId),
      pricing,
      profile.name || 'LawnFlow'
    );

    if (!result.success || !result.invoice) {
      return {
        success: false,
        requiresApproval: false,
        error: result.error || 'Invoice generation failed',
        confidence: result.confidence,
      };
    }

    // Determine if approval is needed based on confidence and amount
    const total = result.invoice.total || 0;
    const requiresApproval =
      (result.confidence !== undefined && result.confidence < 0.8) ||
      total > 50000 || // $500+
      (job.estimatedPrice && Math.abs(total - job.estimatedPrice) > job.estimatedPrice * 0.2); // >20% variance

    return {
      success: true,
      invoiceId: result.invoice.id,
      total: result.invoice.total,
      requiresApproval,
      confidence: result.confidence,
      lineItems: result.invoice.lineItems?.map((item) => ({
        description: item.description,
        amount: item.amount,
        quantity: item.quantity,
      })),
    };
  } catch (error) {
    return {
      success: false,
      requiresApproval: false,
      error: error instanceof Error ? error.message : 'Unknown error in billing activity',
    };
  }
}

// ============================================================================
// Get Invoice Activity
// ============================================================================

export interface GetInvoiceInput {
  invoiceId: number;
}

export interface GetInvoiceOutput {
  invoice: Invoice | null;
}

/**
 * Get an invoice by ID
 */
export async function getInvoiceActivity(
  input: GetInvoiceInput
): Promise<GetInvoiceOutput> {
  const invoice = await storage.getInvoice(input.invoiceId);
  return { invoice: invoice || null };
}
