import { z } from "zod";

export const LineItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
  category: z.string().optional(),
});

export type LineItem = z.infer<typeof LineItemSchema>;

export const QuoteJobRulesSchema = z.object({
  maxLineItemAddRemoveCents: z.number().default(50000),
  maxQuantityChangePercent: z.number().default(25),
  maxPriceChangePercent: z.number().default(0),
  blockedCategories: z.array(z.string()).default(["hardscape install"]),
  allowNewLineItems: z.boolean().default(true),
  allowLineItemRemoval: z.boolean().default(true),
  maxTotalChangePercent: z.number().default(10),
});

export type QuoteJobRules = z.infer<typeof QuoteJobRulesSchema>;

export const DEFAULT_RULES: QuoteJobRules = {
  maxLineItemAddRemoveCents: 50000,
  maxQuantityChangePercent: 25,
  maxPriceChangePercent: 0,
  blockedCategories: ["hardscape install", "hardscaping", "patio", "retaining wall"],
  allowNewLineItems: true,
  allowLineItemRemoval: true,
  maxTotalChangePercent: 10,
};

export interface LineItemDiff {
  type: "added" | "removed" | "modified";
  quoteItem?: LineItem;
  jobItem?: LineItem;
  changes?: {
    quantityChange?: { from: number; to: number; percentChange: number };
    priceChange?: { from: number; to: number; percentChange: number };
    totalChange?: { from: number; to: number };
  };
}

export interface DiffResult {
  diffs: LineItemDiff[];
  totalAdded: number;
  totalRemoved: number;
  totalModified: number;
  quoteTotalDiff: number;
  violatesRules: boolean;
  violations: RuleViolation[];
}

export interface RuleViolation {
  rule: string;
  message: string;
  severity: "warning" | "error";
  item?: LineItem;
}

export function computeLineItemDiff(
  quoteItems: LineItem[],
  jobItems: LineItem[],
): LineItemDiff[] {
  const diffs: LineItemDiff[] = [];
  const matchedJobItemIndices = new Set<number>();

  for (const quoteItem of quoteItems) {
    let bestMatchIdx = -1;
    let bestMatchScore = 0;

    for (let i = 0; i < jobItems.length; i++) {
      if (matchedJobItemIndices.has(i)) continue;

      const jobItem = jobItems[i];
      const nameMatch = quoteItem.name.toLowerCase() === jobItem.name.toLowerCase();
      const descMatch = quoteItem.description?.toLowerCase() === jobItem.description?.toLowerCase();
      
      const score = (nameMatch ? 2 : 0) + (descMatch ? 1 : 0);
      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatchIdx = i;
      }
    }

    if (bestMatchIdx >= 0 && bestMatchScore >= 2) {
      matchedJobItemIndices.add(bestMatchIdx);
      const jobItem = jobItems[bestMatchIdx];

      if (
        quoteItem.quantity !== jobItem.quantity ||
        quoteItem.unitPrice !== jobItem.unitPrice
      ) {
        const quantityChange = quoteItem.quantity !== jobItem.quantity
          ? {
              from: jobItem.quantity,
              to: quoteItem.quantity,
              percentChange: jobItem.quantity > 0
                ? ((quoteItem.quantity - jobItem.quantity) / jobItem.quantity) * 100
                : 100,
            }
          : undefined;

        const priceChange = quoteItem.unitPrice !== jobItem.unitPrice
          ? {
              from: jobItem.unitPrice,
              to: quoteItem.unitPrice,
              percentChange: jobItem.unitPrice > 0
                ? ((quoteItem.unitPrice - jobItem.unitPrice) / jobItem.unitPrice) * 100
                : 100,
            }
          : undefined;

        diffs.push({
          type: "modified",
          quoteItem,
          jobItem,
          changes: {
            quantityChange,
            priceChange,
            totalChange: { from: jobItem.total, to: quoteItem.total },
          },
        });
      }
    } else {
      diffs.push({
        type: "added",
        quoteItem,
      });
    }
  }

  for (let i = 0; i < jobItems.length; i++) {
    if (!matchedJobItemIndices.has(i)) {
      diffs.push({
        type: "removed",
        jobItem: jobItems[i],
      });
    }
  }

  return diffs;
}

export function evaluateRules(
  diffs: LineItemDiff[],
  rules: QuoteJobRules = DEFAULT_RULES,
): DiffResult {
  const violations: RuleViolation[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  let totalModified = 0;
  let quoteTotalDiff = 0;

  for (const diff of diffs) {
    if (diff.type === "added") {
      totalAdded++;
      const itemTotal = diff.quoteItem!.total;
      quoteTotalDiff += itemTotal;

      if (!rules.allowNewLineItems) {
        violations.push({
          rule: "allowNewLineItems",
          message: `New line items not allowed: ${diff.quoteItem!.name}`,
          severity: "error",
          item: diff.quoteItem,
        });
      }

      if (itemTotal > rules.maxLineItemAddRemoveCents) {
        violations.push({
          rule: "maxLineItemAddRemoveCents",
          message: `Added item exceeds $${(rules.maxLineItemAddRemoveCents / 100).toFixed(2)}: ${diff.quoteItem!.name} ($${(itemTotal / 100).toFixed(2)})`,
          severity: "error",
          item: diff.quoteItem,
        });
      }

      const category = diff.quoteItem!.category?.toLowerCase() || "";
      const name = diff.quoteItem!.name.toLowerCase();
      for (const blocked of rules.blockedCategories) {
        if (category.includes(blocked.toLowerCase()) || name.includes(blocked.toLowerCase())) {
          violations.push({
            rule: "blockedCategories",
            message: `Blocked category "${blocked}": ${diff.quoteItem!.name}`,
            severity: "error",
            item: diff.quoteItem,
          });
          break;
        }
      }
    }

    if (diff.type === "removed") {
      totalRemoved++;
      const itemTotal = diff.jobItem!.total;
      quoteTotalDiff -= itemTotal;

      if (!rules.allowLineItemRemoval) {
        violations.push({
          rule: "allowLineItemRemoval",
          message: `Line item removal not allowed: ${diff.jobItem!.name}`,
          severity: "error",
          item: diff.jobItem,
        });
      }

      if (itemTotal > rules.maxLineItemAddRemoveCents) {
        violations.push({
          rule: "maxLineItemAddRemoveCents",
          message: `Removed item exceeds $${(rules.maxLineItemAddRemoveCents / 100).toFixed(2)}: ${diff.jobItem!.name} ($${(itemTotal / 100).toFixed(2)})`,
          severity: "error",
          item: diff.jobItem,
        });
      }
    }

    if (diff.type === "modified" && diff.changes) {
      totalModified++;

      if (diff.changes.quantityChange) {
        const pctChange = Math.abs(diff.changes.quantityChange.percentChange);
        if (pctChange > rules.maxQuantityChangePercent) {
          violations.push({
            rule: "maxQuantityChangePercent",
            message: `Quantity change ${pctChange.toFixed(1)}% exceeds ${rules.maxQuantityChangePercent}%: ${diff.quoteItem!.name}`,
            severity: "error",
            item: diff.quoteItem,
          });
        }
      }

      if (diff.changes.priceChange) {
        const pctChange = Math.abs(diff.changes.priceChange.percentChange);
        if (pctChange > rules.maxPriceChangePercent) {
          violations.push({
            rule: "maxPriceChangePercent",
            message: `Price change ${pctChange.toFixed(1)}% exceeds ${rules.maxPriceChangePercent}%: ${diff.quoteItem!.name}`,
            severity: "error",
            item: diff.quoteItem,
          });
        }
      }

      if (diff.changes.totalChange) {
        quoteTotalDiff += diff.changes.totalChange.to - diff.changes.totalChange.from;
      }
    }
  }

  const originalJobTotal = diffs
    .filter(d => d.jobItem)
    .reduce((sum, d) => sum + (d.jobItem?.total || 0), 0);
  
  const newQuoteTotal = diffs
    .filter(d => d.quoteItem)
    .reduce((sum, d) => sum + (d.quoteItem?.total || 0), 0);
  
  const baseTotal = Math.max(originalJobTotal, 1);
  
  if (rules.maxTotalChangePercent > 0) {
    const totalChangePercent = Math.abs(quoteTotalDiff / baseTotal) * 100;
    if (totalChangePercent > rules.maxTotalChangePercent) {
      violations.push({
        rule: "maxTotalChangePercent",
        message: `Total change ${totalChangePercent.toFixed(1)}% exceeds ${rules.maxTotalChangePercent}%`,
        severity: "error",
      });
    }
    
    if (originalJobTotal === 0 && newQuoteTotal > 0) {
      violations.push({
        rule: "maxTotalChangePercent",
        message: `Addition of $${(newQuoteTotal / 100).toFixed(2)} to empty job requires review`,
        severity: "error",
      });
    }
  }

  return {
    diffs,
    totalAdded,
    totalRemoved,
    totalModified,
    quoteTotalDiff,
    violatesRules: violations.filter(v => v.severity === "error").length > 0,
    violations,
  };
}

export function canAutoApply(diffResult: DiffResult): boolean {
  return !diffResult.violatesRules && diffResult.violations.length === 0;
}

export function getChangeOrderReason(violations: RuleViolation[]): string {
  if (violations.length === 0) return "";
  
  const errorViolations = violations.filter(v => v.severity === "error");
  if (errorViolations.length === 0) return "";

  return errorViolations.map(v => v.message).join("; ");
}
