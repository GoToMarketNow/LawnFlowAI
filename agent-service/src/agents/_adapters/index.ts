/**
 * Agent Service Adapters
 * 
 * @deprecated ALL adapters in this directory are deprecated.
 * These adapters provide backward compatibility during migration.
 * Please update your imports to use the canonical agent locations.
 * 
 * See agent-service/README.md for migration guide.
 */

// General agents (AI-powered) - forward to lawnflow-agents
export * from './billing';
export * from './orchestrator';
export * from './intake';
export * from './pricing';
export * from './scheduling';

// Orchestrator agents (deterministic) - forward to server/orchestrator
export * from './orchestratorAgents';

// Registry of adapters
export const DEPRECATED_ADAPTERS = {
  billing: './billing',
  orchestrator: './orchestrator',
  intake: './intake',
  'inbound-engagement': './intake',
  pricing: './pricing',
  scheduling: './scheduling',
  schedule: './scheduling',
  jobFeasibility: './orchestratorAgents',
  marginBurn: './orchestratorAgents',
} as const;

console.warn(
  '[DEPRECATED] agent-service adapters are in use. ' +
  'Please migrate to canonical agent locations. ' +
  'See agent-service/README.md for details.'
);
