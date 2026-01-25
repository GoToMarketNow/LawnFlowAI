# Import Migration Guide

This guide helps you update imports from deprecated agent locations to canonical locations.

## Quick Reference

### Agent-Service Imports (DEPRECATED)
```typescript
// ❌ OLD (deprecated)
import { executeBillingAgent } from '../agent-service/src/agents/billing';

// ✅ NEW (canonical)
import { agentRegistry } from '../lawnflow-agents/src/core/registry';
const billingAgent = agentRegistry.getAgent('billing');
await billingAgent.execute(context);
```

### Server/Agents Imports (DEPRECATED)
```typescript
// ❌ OLD (deprecated)
import { jobFeasibility } from '../server/agents/jobFeasibility';

// ✅ NEW (canonical)
import { runFeasibilityCheckAgent } from '../server/orchestrator/leadToCash/agents/feasibilityCheck';
```

## Files Requiring Updates

### From agent-service (3 files):
1. `agent-service/src/agents/_adapters/orchestratorAgents.ts` - Already an adapter, keep as-is
2. `agent-service/src/index.ts` - Update exports
3. `LawnFlowAI/LawnFlowAI-main/agent-service/src/index.ts` - Duplicate, same update

### From server/agents (10 files):
Test files that need updating:
1. `tests/billing.test.ts`
2. `tests/inbound-engagement.test.ts`
3. `tests/quoting.test.ts`
4. `tests/reviews.test.ts`
5. `tests/scheduling.test.ts`

(Plus duplicates in LawnFlowAI/LawnFlowAI-main/ directory)

## Agent Migration Map

| Old Import | New Import |
|------------|-----------|
| `agent-service/src/agents/billing` | `lawnflow-agents` registry → `billing` |
| `agent-service/src/agents/orchestrator` | `lawnflow-agents/src/core/orchestrator` |
| `agent-service/src/agents/intake` | `lawnflow-agents` registry → `inbound_intake` |
| `agent-service/src/agents/pricing` | `lawnflow-agents` registry → `pricing_profit` |
| `agent-service/src/agents/scheduling` | `lawnflow-agents` registry → `scheduling_dispatch` |
| `server/agents/jobFeasibility` | `server/orchestrator/leadToCash/agents/feasibilityCheck` |
| `server/agents/marginBurn` | `server/orchestrator/leadToCash/agents/marginValidate` |
| `server/agents/orchestrator` | `lawnflow-agents/src/core/orchestrator` |

## Search Commands

### Find all agent-service imports:
```bash
grep -r "from.*agent-service" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules
```

### Find all server/agents imports:
```bash
grep -r "from.*server/agents" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=_adapters
```

### Find specific deprecated functions:
```bash
grep -r "executeBillingAgent\|executeOrchestrator\|jobFeasibility" --include="*.ts" --exclude-dir=node_modules
```

## Step-by-Step Update Process

### 1. Update Test Files

For each test file in `tests/`:

```typescript
// Before
import { billing } from '../server/agents/billing';

// After
import { agentRegistry } from '../lawnflow-agents/src/core/registry';
const billing = agentRegistry.getAgent('billing');
```

### 2. Update Agent Service Index

File: `agent-service/src/index.ts`

```typescript
// Before
export * from './agents/billing';
export * from './agents/orchestrator';

// After
export * from './agents/_adapters';
// Or simply remove exports if no longer needed
```

### 3. Update Any Runtime References

If agents are invoked at runtime (check routes, workflows, etc.):

```typescript
// Before
import { executeAgent } from '../server/agents/someAgent';
await executeAgent(context);

// After
import { agentRegistry } from '../lawnflow-agents/src/core/registry';
const agent = agentRegistry.getAgent('someAgent');
await agent.execute(context);
```

## Testing After Updates

1. **Run TypeScript compiler**:
   ```bash
   npx tsc --noEmit
   ```

2. **Run tests**:
   ```bash
   npm test
   ```

3. **Check for deprecation warnings**:
   Look for console warnings when running the app

4. **Verify workflows**:
   Test lead-to-cash workflow end-to-end

## Gradual Migration Strategy

You can migrate gradually:

1. ✅ **Adapters are in place** - old imports still work
2. Update **test files first** - low risk, easy to verify
3. Update **route handlers** - medium risk, test carefully
4. Update **workflow files** - high impact, test thoroughly
5. Remove **deprecated directories** - final cleanup

## Common Issues

### Issue: "Agent not found in registry"
**Solution**: Ensure the agent is registered in `lawnflow-agents/src/core/registry.ts`

### Issue: "Cannot find module"
**Solution**: Check relative path from import location to agent location

### Issue: "Type mismatch"
**Solution**: Orchestrator agents return typed results, general agents return Envelope

## Rollback Plan

If issues arise:
1. Revert import changes
2. Adapters will continue to work
3. Fix issues incrementally
4. Re-apply updates

---

**Status**: Manual review required for 13 unique files across codebase.

**Estimated effort**: 30-60 minutes to update all imports + testing.
