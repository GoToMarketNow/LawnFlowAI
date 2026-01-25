/**
 * @deprecated This adapter forwards to the canonical agent in lawnflow-agents.
 * Import from 'lawnflow-agents/src/agents/pricing-profit' instead.
 * This adapter will be removed in a future version.
 */

import { agentRegistry } from '../../../lawnflow-agents/src/core/registry';
import type { AgentContext, Envelope } from '../../../lawnflow-agents/src/types';

export async function executePricingAgent(context: AgentContext): Promise<Envelope> {
  console.warn('[DEPRECATED] agent-service pricing agent is deprecated. Use lawnflow-agents/src/agents/pricing-profit instead.');
  
  const agent = agentRegistry.getAgent('pricing_profit');
  if (!agent) {
    throw new Error('Pricing agent not found in registry. Ensure lawnflow-agents is properly initialized.');
  }
  
  return agent.execute(context);
}

// Legacy export for backward compatibility
export { executePricingAgent as pricing };
