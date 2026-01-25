/**
 * @deprecated This adapter forwards to the canonical agent in lawnflow-agents.
 * Import from 'lawnflow-agents/src/agents/billing' instead.
 * This adapter will be removed in a future version.
 */

import { agentRegistry } from '../../../lawnflow-agents/src/core/registry';
import type { AgentContext, Envelope } from '../../../lawnflow-agents/src/types';

export async function executeBillingAgent(context: AgentContext): Promise<Envelope> {
  console.warn('[DEPRECATED] agent-service billing agent is deprecated. Use lawnflow-agents instead.');
  
  const agent = agentRegistry.getAgent('billing');
  if (!agent) {
    throw new Error('Billing agent not found in registry. Ensure lawnflow-agents is properly initialized.');
  }
  
  return agent.execute(context);
}

// Legacy export for backward compatibility
export { executeBillingAgent as billing };
