# Agent Service (DEPRECATED)

⚠️ **This service has been consolidated into the `lawnflow-agents` package and `server/orchestrator` workflows.**

## Migration Path

All agents previously in this directory have been migrated to their canonical locations:

### General-Purpose AI Agents
**Location**: `lawnflow-agents/src/agents/`

These agents use AI for decision-making and autonomous operations:
- billing → `lawnflow-agents/src/agents/billing.ts`
- crewIntelligence → `lawnflow-agents/src/agents/crew-intelligence.ts`  
- inbound-engagement → `lawnflow-agents/src/agents/inbound-intake.ts`
- intake → `lawnflow-agents/src/agents/inbound-intake.ts`
- jobFeasibility → Use orchestrator agent instead
- marginBurn → Use orchestrator agent instead
- orchestrator → `lawnflow-agents/src/core/orchestrator.ts`
- preference → `lawnflow-agents/src/agents/preference.ts`
- pricing → `lawnflow-agents/src/agents/pricing-profit.ts`
- promotion → `lawnflow-agents/src/agents/promotion.ts`
- quote → `lawnflow-agents/src/agents/quote.ts`
- quoting → `lawnflow-agents/src/agents/quoting.ts`
- reviews → `lawnflow-agents/src/agents/reviews.ts`
- routeCost → `lawnflow-agents/src/agents/route-cost.ts`
- schedule → `lawnflow-agents/src/agents/schedule.ts`
- scheduling → `lawnflow-agents/src/agents/scheduling-dispatch.ts`
- service-selection → `lawnflow-agents/src/agents/service-selection.ts`
- simulationRanking → `lawnflow-agents/src/agents/crew-intelligence.ts`

### Orchestrator Agents  
**Location**: `server/orchestrator/{workflow}/agents/`

These are deterministic workflow steps:
- jobFeasibility → `server/orchestrator/leadToCash/agents/feasibilityCheck.ts`
- marginBurn → `server/orchestrator/leadToCash/agents/marginValidate.ts`
- billing (workflow) → `server/orchestrator/billing/billingAgent.ts`

## Update Your Imports

### Before (deprecated):
```typescript
import { executeBillingAgent } from 'agent-service/src/agents/billing';
```

### After (canonical):
```typescript
import { agentRegistry } from 'lawnflow-agents/src/core/registry';

const billingAgent = agentRegistry.getAgent('billing');
await billingAgent.execute(context);
```

Or for orchestrator agents:
```typescript
import { runFeasibilityCheckAgent } from 'server/orchestrator/leadToCash/agents/feasibilityCheck';

const result = await runFeasibilityCheckAgent(jobRequest, context);
```

## Backward Compatibility

Temporary adapter shims are available in `agent-service/src/agents/_adapters/` for backward compatibility during the migration period. However, these adapters are also deprecated and will be removed in a future version.

**Please update your imports to use the canonical locations as soon as possible.**

## Questions?

See the consolidation decisions document: `artifacts/agent-audit/decisions.md`
