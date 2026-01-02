import { processQuoteJobEvent } from "./jobber-quote-job-worker";
import {
  computeLineItemDiff,
  evaluateRules,
  canAutoApply,
  getChangeOrderReason,
  DEFAULT_RULES,
  LineItem,
  QuoteJobRules,
} from "./jobber-rules";

const SAMPLE_WEBHOOK_PAYLOADS = {
  quoteApproved: {
    webhookEventId: "test-evt-001",
    accountId: "test-account-123",
    topic: "QUOTE_APPROVED",
    appId: "lawnflow-test",
    data: { webUri: "https://app.getjobber.com/quotes/123" },
    resourceId: "quote-123",
    occurredAt: new Date().toISOString(),
  },
  quoteUpdated: {
    webhookEventId: "test-evt-002",
    accountId: "test-account-123",
    topic: "QUOTE_UPDATED",
    appId: "lawnflow-test",
    data: { webUri: "https://app.getjobber.com/quotes/123" },
    resourceId: "quote-123",
    occurredAt: new Date().toISOString(),
  },
  jobCreated: {
    webhookEventId: "test-evt-003",
    accountId: "test-account-123",
    topic: "JOB_CREATED",
    appId: "lawnflow-test",
    data: { webUri: "https://app.getjobber.com/jobs/456" },
    resourceId: "job-456",
    occurredAt: new Date().toISOString(),
  },
};

const SAMPLE_LINE_ITEMS = {
  quoteItems: [
    { name: "Weekly Mowing", description: "Front and back yard", quantity: 4, unitPrice: 7500, total: 30000 },
    { name: "Edge Trimming", description: "All walkways", quantity: 4, unitPrice: 2500, total: 10000 },
    { name: "Leaf Cleanup", description: "Fall cleanup", quantity: 1, unitPrice: 15000, total: 15000 },
  ] as LineItem[],
  jobItems: [
    { name: "Weekly Mowing", description: "Front and back yard", quantity: 4, unitPrice: 7500, total: 30000 },
    { name: "Edge Trimming", description: "All walkways", quantity: 4, unitPrice: 2500, total: 10000 },
  ] as LineItem[],
};

const SAMPLE_CHANGES = {
  withinRules: {
    quoteItems: [
      { name: "Weekly Mowing", description: "Front and back", quantity: 5, unitPrice: 7500, total: 37500 },
      { name: "Edge Trimming", description: "All walkways", quantity: 4, unitPrice: 2500, total: 10000 },
      { name: "Mulch Application", description: "2 yards", quantity: 1, unitPrice: 35000, total: 35000 },
    ] as LineItem[],
    jobItems: [
      { name: "Weekly Mowing", description: "Front and back", quantity: 4, unitPrice: 7500, total: 30000 },
      { name: "Edge Trimming", description: "All walkways", quantity: 4, unitPrice: 2500, total: 10000 },
    ] as LineItem[],
  },
  outsideRules: {
    quoteItems: [
      { name: "Weekly Mowing", description: "Front and back", quantity: 10, unitPrice: 9000, total: 90000 },
      { name: "Hardscape Install", description: "Patio installation", quantity: 1, unitPrice: 500000, total: 500000 },
    ] as LineItem[],
    jobItems: [
      { name: "Weekly Mowing", description: "Front and back", quantity: 4, unitPrice: 7500, total: 30000 },
    ] as LineItem[],
  },
};

export function runDiffTests(): void {
  console.log("\n=== QUOTE-JOB DIFF TESTS ===\n");

  console.log("Test 1: Simple addition (within rules)");
  const diff1 = computeLineItemDiff(SAMPLE_LINE_ITEMS.quoteItems, SAMPLE_LINE_ITEMS.jobItems);
  const result1 = evaluateRules(diff1, DEFAULT_RULES);
  console.log(`  Added: ${result1.totalAdded}, Removed: ${result1.totalRemoved}, Modified: ${result1.totalModified}`);
  console.log(`  Total diff: $${(result1.quoteTotalDiff / 100).toFixed(2)}`);
  console.log(`  Can auto-apply: ${canAutoApply(result1)}`);
  console.log(`  Violations: ${result1.violations.length}`);
  result1.violations.forEach(v => console.log(`    - ${v.message}`));

  console.log("\nTest 2: Quantity increase (within 25%)");
  const diff2 = computeLineItemDiff(SAMPLE_CHANGES.withinRules.quoteItems, SAMPLE_CHANGES.withinRules.jobItems);
  const result2 = evaluateRules(diff2, DEFAULT_RULES);
  console.log(`  Added: ${result2.totalAdded}, Removed: ${result2.totalRemoved}, Modified: ${result2.totalModified}`);
  console.log(`  Total diff: $${(result2.quoteTotalDiff / 100).toFixed(2)}`);
  console.log(`  Can auto-apply: ${canAutoApply(result2)}`);
  console.log(`  Violations: ${result2.violations.length}`);
  result2.violations.forEach(v => console.log(`    - ${v.message}`));

  console.log("\nTest 3: Major changes (outside rules)");
  const diff3 = computeLineItemDiff(SAMPLE_CHANGES.outsideRules.quoteItems, SAMPLE_CHANGES.outsideRules.jobItems);
  const result3 = evaluateRules(diff3, DEFAULT_RULES);
  console.log(`  Added: ${result3.totalAdded}, Removed: ${result3.totalRemoved}, Modified: ${result3.totalModified}`);
  console.log(`  Total diff: $${(result3.quoteTotalDiff / 100).toFixed(2)}`);
  console.log(`  Can auto-apply: ${canAutoApply(result3)}`);
  console.log(`  Violations: ${result3.violations.length}`);
  result3.violations.forEach(v => console.log(`    - ${v.message}`));
  console.log(`  Change order reason: ${getChangeOrderReason(result3.violations)}`);

  console.log("\n=== DIFF TESTS COMPLETE ===\n");
}

export async function replayWebhook(
  payloadName: keyof typeof SAMPLE_WEBHOOK_PAYLOADS,
  options: { rules?: QuoteJobRules } = {},
): Promise<void> {
  const payload = { ...SAMPLE_WEBHOOK_PAYLOADS[payloadName] };
  payload.occurredAt = new Date().toISOString();
  payload.webhookEventId = `test-evt-${Date.now()}`;

  console.log(`\n=== REPLAYING WEBHOOK: ${payloadName} ===`);
  console.log(`Topic: ${payload.topic}`);
  console.log(`Resource ID: ${payload.resourceId}`);
  console.log(`Account ID: ${payload.accountId}`);

  try {
    await processQuoteJobEvent(payload, options);
    console.log(`=== REPLAY COMPLETE ===\n`);
  } catch (error: any) {
    console.error(`=== REPLAY FAILED: ${error.message} ===\n`);
  }
}

export async function replayCustomPayload(
  payload: any,
  options: { rules?: QuoteJobRules } = {},
): Promise<void> {
  console.log(`\n=== REPLAYING CUSTOM WEBHOOK ===`);
  console.log(`Topic: ${payload.topic}`);
  console.log(`Resource ID: ${payload.resourceId}`);

  try {
    await processQuoteJobEvent(payload, options);
    console.log(`=== REPLAY COMPLETE ===\n`);
  } catch (error: any) {
    console.error(`=== REPLAY FAILED: ${error.message} ===\n`);
  }
}

export async function runFullTestSuite(): Promise<void> {
  console.log("\n========================================");
  console.log("QUOTE-TO-JOB ORCHESTRATOR TEST SUITE");
  console.log("========================================\n");

  runDiffTests();

  console.log("\nNote: Webhook replay tests require a configured Jobber account.");
  console.log("Use replayWebhook() or replayCustomPayload() to test with real data.\n");
}

export {
  SAMPLE_WEBHOOK_PAYLOADS,
  SAMPLE_LINE_ITEMS,
  SAMPLE_CHANGES,
};
