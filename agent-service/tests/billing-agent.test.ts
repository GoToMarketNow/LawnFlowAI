import { runBillingAgent } from "../src/agents/billing";
import { goldenBillingTestCases, BillingTestCase } from "./golden-dataset";

const MIN_CONFIDENCE_THRESHOLD = 0.7; // Example threshold for alerting

describe("Billing Agent Golden Dataset Tests", () => {
  goldenBillingTestCases.forEach((testCase: BillingTestCase) => {
    test(testCase.name, async () => {
      const startTime = process.hrtime.bigint();
      const actualOutput = await runBillingAgent(
        testCase.input.invoice,
        testCase.input.history,
        testCase.input.config,
        testCase.input.policy
      );
      const endTime = process.hrtime.bigint();
      const latencyMs = Number(endTime - startTime) / 1_000_000; // Convert nanoseconds to milliseconds

      // --- Assertions (as before) ---
      expect(actualOutput.message.channel).toEqual(testCase.expected.message.channel);
      expect(actualOutput.message.to).toEqual(testCase.expected.message.to);
      expect(actualOutput.message.text).toContain(testCase.expected.message.text.substring(0, 50));

      expect(actualOutput.action.type).toEqual(testCase.expected.action.type);
      if (testCase.expected.action.payment_link) {
        expect(actualOutput.action.payment_link).toEqual(testCase.expected.action.payment_link);
      }
      expect(actualOutput.action.next_followup_in_days).toEqual(testCase.expected.action.next_followup_in_days);

      // Allow slight confidence variation for assertions
      expect(actualOutput.confidence).toBeGreaterThanOrEqual(testCase.expected.confidence - 0.1);
      expect(actualOutput.confidence).toBeLessThanOrEqual(testCase.expected.confidence + 0.1);
      
      expect(actualOutput.assumptions).toEqual(expect.arrayContaining(testCase.expected.assumptions));

      // --- Metrics Reporting ---
      console.log(`--- Metrics for "${testCase.name}" ---`);
      console.log(`  Confidence: ${actualOutput.confidence.toFixed(2)}`);
      console.log(`  Latency: ${latencyMs.toFixed(2)} ms`);
      console.log(`  Cost: (Placeholder - implement LLM token usage/cost tracking)`);

      // --- Simulated Alerting ---
      if (actualOutput.confidence < MIN_CONFIDENCE_THRESHOLD) {
        console.warn(`!!! SIMULATED ALERT: Confidence (${actualOutput.confidence.toFixed(2)}) is below threshold (${MIN_CONFIDENCE_THRESHOLD}) for test: "${testCase.name}"`);
      }
      console.log('---------------------------------');
    });
  });
});

