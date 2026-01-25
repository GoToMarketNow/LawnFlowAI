/**
 * @deprecated This agent has been migrated to server/orchestrator/leadToCash/agents/marginValidate.ts
 * Import from '@server/orchestrator/leadToCash/agents/marginValidate' instead.
 */

import { runMarginValidateAgent } from '../../orchestrator/leadToCash/agents/marginValidate';

export { runMarginValidateAgent };
export { runMarginValidateAgent as executeMarginBurnAgent };

console.warn('[DEPRECATED] server/agents/marginBurn.ts is deprecated. Use server/orchestrator/leadToCash/agents/marginValidate.ts');
