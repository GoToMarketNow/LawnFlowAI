/**
 * @deprecated This agent has been migrated to lawnflow-agents/src/core/orchestrator.ts
 * Import from 'lawnflow-agents/src/core/orchestrator' instead.
 */

import { OrchestratorAgent } from '../../lawnflow-agents/src/core/orchestrator';
import type { AgentContext, Envelope } from '../../lawnflow-agents/src/types';

const orchestratorInstance = new OrchestratorAgent();

export async function executeOrchestrator(context: AgentContext): Promise<Envelope> {
  console.warn('[DEPRECATED] server/agents/orchestrator.ts is deprecated. Use lawnflow-agents/src/core/orchestrator.ts');
  return orchestratorInstance.execute(context);
}

export { OrchestratorAgent };
export { orchestratorInstance as orchestrator };
