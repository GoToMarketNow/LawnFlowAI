/**
 * @deprecated This adapter forwards to the canonical agent in lawnflow-agents.
 * Import from 'lawnflow-agents/src/agents/scheduling-dispatch' instead.
 * This adapter will be removed in a future version.
 */

import { agentRegistry } from '../../../lawnflow-agents/src/core/registry';
import type { AgentContext, Envelope } from '../../../lawnflow-agents/src/types';

export async function executeSchedulingAgent(context: AgentContext): Promise<Envelope> {
  console.warn('[DEPRECATED] agent-service scheduling agent is deprecated. Use lawnflow-agents/src/agents/scheduling-dispatch instead.');
  
  const agent = agentRegistry.getAgent('scheduling_dispatch');
  if (!agent) {
    throw new Error('Scheduling agent not found in registry. Ensure lawnflow-agents is properly initialized.');
  }
  
  return agent.execute(context);
}

// Legacy export for backward compatibility
export { executeSchedulingAgent as scheduling };
export { executeSchedulingAgent as schedule };
