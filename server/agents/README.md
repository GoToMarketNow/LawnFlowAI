/**
 * Server Agents Directory - DEPRECATED
 * 
 * All agents have been migrated to their canonical locations:
 * 
 * - **Orchestrator agents** (deterministic workflow steps):
 *   Location: server/orchestrator/{workflow}/agents/
 *   Examples: feasibilityCheck, marginValidate, leadIntake
 * 
 * - **General agents** (AI-powered):
 *   Location: lawnflow-agents/src/agents/
 *   Examples: billing, marketing, inbound-intake
 * 
 * - **Event routing orchestrator**:
 *   Location: lawnflow-agents/src/core/orchestrator.ts
 * 
 * ## Migration Guide
 * 
 * ### Orchestrator Agents (already migrated):
 * - jobFeasibility.ts → server/orchestrator/leadToCash/agents/feasibilityCheck.ts
 * - marginBurn.ts → server/orchestrator/leadToCash/agents/marginValidate.ts
 * - crewIntelligence.ts → server/orchestrator/leadToCash/agents/ (simulation, crew assignment)
 * 
 * ### General Agents (use lawnflow-agents):
 * - billing.ts → lawnflow-agents/src/agents/billing.ts (to be created)
 * - marketing.ts → lawnflow-agents/src/agents/marketing.ts
 * - orchestrator.ts → lawnflow-agents/src/core/orchestrator.ts
 * - intake.ts → lawnflow-agents/src/agents/inbound-intake.ts
 * - pricing.ts → lawnflow-agents/src/agents/pricing-profit.ts
 * - scheduling.ts → lawnflow-agents/src/agents/scheduling-dispatch.ts
 * 
 * ## Backward Compatibility
 * 
 * Adapters are available in `_adapters/` directory for temporary backward compatibility.
 * Please update your imports as soon as possible.
 */

export const DEPRECATED_SERVER_AGENTS_NOTICE = `
⚠️ server/agents/ directory is deprecated.

Orchestrator agents → server/orchestrator/{workflow}/agents/
General agents → lawnflow-agents/src/agents/
Event orchestrator → lawnflow-agents/src/core/orchestrator.ts

See artifacts/agent-audit/decisions.md for details.
`;

console.warn(DEPRECATED_SERVER_AGENTS_NOTICE);
