/**
 * @deprecated This agent has been migrated to server/orchestrator/leadToCash/agents/feasibilityCheck.ts
 * Import from '@server/orchestrator/leadToCash/agents/feasibilityCheck' instead.
 */

import { runFeasibilityCheckAgent } from '../../orchestrator/leadToCash/agents/feasibilityCheck';

export { runFeasibilityCheckAgent };
export { runFeasibilityCheckAgent as executeFeasibilityAgent };

console.warn('[DEPRECATED] server/agents/jobFeasibility.ts is deprecated. Use server/orchestrator/leadToCash/agents/feasibilityCheck.ts');
