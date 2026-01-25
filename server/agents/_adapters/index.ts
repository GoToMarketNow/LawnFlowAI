/**
 * Server Agents Adapters
 * 
 * @deprecated ALL files in server/agents/ are deprecated.
 * 
 * Orchestrator agents → server/orchestrator/{workflow}/agents/
 * General agents → lawnflow-agents/src/agents/
 * 
 * See server/agents/README.md for migration guide.
 */

export * from './jobFeasibility';
export * from './marginBurn';
export * from './orchestrator';

console.warn(
  '[DEPRECATED] server/agents/ directory adapters are in use. ' +
  'Please migrate to canonical locations. ' +
  'See server/agents/README.md for details.'
);
