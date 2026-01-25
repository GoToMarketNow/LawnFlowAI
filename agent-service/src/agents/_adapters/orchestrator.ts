/**
 * @deprecated This adapter forwards to the canonical orchestrator in lawnflow-agents.
 * Import from 'lawnflow-agents/src/core/orchestrator' instead.
 * This adapter will be removed in a future version.
 */

import { OrchestratorAgent } from '../../../lawnflow-agents/src/core/orchestrator';
import type { AgentContext, Envelope } from '../../../lawnflow-agents/src/types';

const orchestratorInstance = new OrchestratorAgent();

export async function executeOrchestratorAgent(context: AgentContext): Promise<Envelope> {
  console.warn('[DEPRECATED] agent-service orchestrator agent is deprecated. Use lawnflow-agents/src/core/orchestrator instead.');
  
  return orchestratorInstance.execute(context);
}

// Legacy export for backward compatibility
export { executeOrchestratorAgent as orchestrator };
