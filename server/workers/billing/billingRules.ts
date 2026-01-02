export interface BillingMilestone {
  milestone: string;
  invoiceType: "deposit" | "progress" | "final";
  percentageOfTotal: number;
  description: string;
}

export interface BillingRule {
  serviceType: string;
  displayName: string;
  requiresDeposit: boolean;
  requiresProgress: boolean;
  milestones: BillingMilestone[];
  billingStageField: string;
  billingStageValues: {
    depositSent: string;
    depositPaid: string;
    progressSent: string;
    progressPaid: string;
    finalSent: string;
    finalPaid: string;
  };
}

export const BILLING_RULES: Record<string, BillingRule> = {
  hardscape_install: {
    serviceType: "hardscape_install",
    displayName: "Hardscape Installation",
    requiresDeposit: true,
    requiresProgress: true,
    milestones: [
      {
        milestone: "scheduled",
        invoiceType: "deposit",
        percentageOfTotal: 30,
        description: "Deposit - 30% due at scheduling",
      },
      {
        milestone: "in_progress",
        invoiceType: "progress",
        percentageOfTotal: 40,
        description: "Progress Payment - 40% at 50% completion",
      },
      {
        milestone: "complete",
        invoiceType: "final",
        percentageOfTotal: 30,
        description: "Final Payment - 30% upon completion",
      },
    ],
    billingStageField: "Billing Stage",
    billingStageValues: {
      depositSent: "Deposit Invoiced",
      depositPaid: "Deposit Received",
      progressSent: "Progress Invoiced",
      progressPaid: "Progress Received",
      finalSent: "Final Invoiced",
      finalPaid: "Fully Paid",
    },
  },
  
  landscape_design: {
    serviceType: "landscape_design",
    displayName: "Landscape Design",
    requiresDeposit: true,
    requiresProgress: false,
    milestones: [
      {
        milestone: "scheduled",
        invoiceType: "deposit",
        percentageOfTotal: 50,
        description: "Deposit - 50% due at project start",
      },
      {
        milestone: "complete",
        invoiceType: "final",
        percentageOfTotal: 50,
        description: "Final Payment - 50% upon delivery",
      },
    ],
    billingStageField: "Billing Stage",
    billingStageValues: {
      depositSent: "Deposit Invoiced",
      depositPaid: "Deposit Received",
      progressSent: "N/A",
      progressPaid: "N/A",
      finalSent: "Final Invoiced",
      finalPaid: "Fully Paid",
    },
  },
  
  lawn_maintenance: {
    serviceType: "lawn_maintenance",
    displayName: "Lawn Maintenance",
    requiresDeposit: false,
    requiresProgress: false,
    milestones: [
      {
        milestone: "complete",
        invoiceType: "final",
        percentageOfTotal: 100,
        description: "Payment due upon service completion",
      },
    ],
    billingStageField: "Billing Stage",
    billingStageValues: {
      depositSent: "N/A",
      depositPaid: "N/A",
      progressSent: "N/A",
      progressPaid: "N/A",
      finalSent: "Invoiced",
      finalPaid: "Paid",
    },
  },
  
  irrigation_install: {
    serviceType: "irrigation_install",
    displayName: "Irrigation Installation",
    requiresDeposit: true,
    requiresProgress: true,
    milestones: [
      {
        milestone: "scheduled",
        invoiceType: "deposit",
        percentageOfTotal: 25,
        description: "Deposit - 25% for materials",
      },
      {
        milestone: "in_progress",
        invoiceType: "progress",
        percentageOfTotal: 50,
        description: "Progress Payment - 50% at rough-in complete",
      },
      {
        milestone: "complete",
        invoiceType: "final",
        percentageOfTotal: 25,
        description: "Final Payment - 25% upon testing",
      },
    ],
    billingStageField: "Billing Stage",
    billingStageValues: {
      depositSent: "Deposit Invoiced",
      depositPaid: "Deposit Received",
      progressSent: "Progress Invoiced",
      progressPaid: "Progress Received",
      finalSent: "Final Invoiced",
      finalPaid: "Fully Paid",
    },
  },
};

export function getBillingRule(serviceType: string): BillingRule | null {
  const normalizedType = serviceType.toLowerCase().replace(/[\s-]+/g, "_");
  return BILLING_RULES[normalizedType] || null;
}

export function getMilestoneForEvent(topic: string): string | null {
  const milestoneMap: Record<string, string> = {
    JOB_CREATE: "created",
    JOB_SCHEDULE_UPDATE: "scheduled",
    JOB_UPDATE: "in_progress",
    JOB_COMPLETED: "complete",
  };
  return milestoneMap[topic] || null;
}

export function getMilestoneForVisitEvent(topic: string): string | null {
  const visitMilestoneMap: Record<string, string> = {
    VISIT_COMPLETED: "in_progress",
    VISIT_APPROVED: "in_progress",
  };
  return visitMilestoneMap[topic] || null;
}

export function getInvoiceTypeForMilestone(
  rule: BillingRule,
  milestone: string
): BillingMilestone | null {
  return rule.milestones.find((m) => m.milestone === milestone) || null;
}

export function getBillingStageForEvent(
  rule: BillingRule,
  invoiceType: "deposit" | "progress" | "final",
  isPaid: boolean
): string {
  const stageValues = rule.billingStageValues;
  
  if (invoiceType === "deposit") {
    return isPaid ? stageValues.depositPaid : stageValues.depositSent;
  } else if (invoiceType === "progress") {
    return isPaid ? stageValues.progressPaid : stageValues.progressSent;
  } else {
    return isPaid ? stageValues.finalPaid : stageValues.finalSent;
  }
}
