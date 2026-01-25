/**
 * @deprecated Orchestrator agents from agent-service have been moved.
 * Use the canonical orchestrator agent functions instead:
 * 
 * - For feasibility: import { runFeasibilityCheckAgent } from 'server/orchestrator/leadToCash/agents/feasibilityCheck'
 * - For margin: import { runMarginValidateAgent } from 'server/orchestrator/leadToCash/agents/marginValidate'
 * 
 * These adapters will be removed in a future version.
 */

import type { JobRequest } from '../../../shared/schema';
import type { OrchestrationContext } from '../../../shared/orchestrator/contracts';
import { runFeasibilityCheckAgent } from '../../../server/orchestrator/leadToCash/agents/feasibilityCheck';
import { runMarginValidateAgent } from '../../../server/orchestrator/leadToCash/agents/marginValidate';

export async function executeFeasibilityAgent(jobRequest: JobRequest, context: OrchestrationContext) {
  console.warn('[DEPRECATED] agent-service feasibility agent is deprecated. Use server/orchestrator/leadToCash/agents/feasibilityCheck instead.');
  
  return runFeasibilityCheckAgent(jobRequest, context);
}

export async function executeMarginBurnAgent(jobRequest: JobRequest, context: OrchestrationContext) {
  console.warn('[DEPRECATED] agent-service marginBurn agent is deprecated. Use server/orchestrator/leadToCash/agents/marginValidate instead.');
  
  return runMarginValidateAgent(jobRequest, context);
}

// Legacy exports
export { executeFeasibilityAgent as jobFeasibility };
export { executeMarginBurnAgent as marginBurn };
