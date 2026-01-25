/**
 * @deprecated This adapter forwards to the canonical agent in lawnflow-agents.
 * Import from 'lawnflow-agents/src/agents/inbound-intake' instead.
 * This adapter will be removed in a future version.
 */

import { agentRegistry } from '../../../lawnflow-agents/src/core/registry';
import type { AgentContext, Envelope } from '../../../lawnflow-agents/src/types';

export async function executeIntakeAgent(context: AgentContext): Promise<Envelope> {
  console.warn('[DEPRECATED] agent-service intake agent is deprecated. Use lawnflow-agents/src/agents/inbound-intake instead.');
  
  const agent = agentRegistry.getAgent('inbound_intake');
  if (!agent) {
    throw new Error('Inbound intake agent not found in registry. Ensure lawnflow-agents is properly initialized.');
  }
  
  return agent.execute(context);
}

// Legacy export for backward compatibility
export { executeIntakeAgent as intake };
export { executeIntakeAgent as inboundEngagement };
