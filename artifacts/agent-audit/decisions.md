# Agent Consolidation Decisions

Generated: 2026-01-24

## Audit Summary

- **Total agent candidates found**: 324
- **Classification breakdown**:
  - Capability modules: 215
  - Orchestrator agents: 37
  - Deprecated (agent-service): 33
  - General agents: 29
  - Workflows: 10

- **Duplicate groups**: 38
  - agent-service duplicates: 26
  - server/agents duplicates: 19
  - cross-package duplicates: 2

## Key Findings

### 1. Agent-Service Directory (33 files) - **DEPRECATE ENTIRELY**
**Decision**: Mark entire directory as deprecated and create forwarding adapters

**Rationale**:
- All 33 files in agent-service are classified as "deprecated"
- 26 duplicate groups involve agent-service
- Functionality is duplicated in lawnflow-agents and server/orchestrator
- No unique functionality that can't be found elsewhere

**Action**: 
- Create README.md deprecation notice
- Create adapter shims in `agent-service/src/agents/_adapters/` for backward compatibility
- Update imports across codebase

### 2. Server/Agents Directory (19 duplicates) - **MIGRATE TO ORCHESTRATORS**
**Decision**: Migrate to appropriate orchestrator workflow directories

**Key duplicates to consolidate**:

#### billing (4 copies):
- `server/agents/billing.ts` → Keep, migrate to `server/orchestrator/billing/billingAgent.ts`
- `agent-service/src/agents/billing.ts` → Deprecate
- `server/temporal/activities/billing.ts` → Keep (different purpose - activity)
- `server/temporal/workflows/billing.ts` → Keep (different purpose - workflow)

#### orchestrator (4 copies):
- `lawnflow-agents/src/core/orchestrator.ts` → **CANONICAL** (event routing orchestrator)
- `server/agents/orchestrator.ts` → Deprecate, use lawnflow-agents version
- `agent-service/src/agents/orchestrator.ts` → Deprecate
- `server/lib/comms/orchestrator.ts` → Keep (different purpose - comms orchestration)

#### marketing (3 copies):
- `server/agents/marketing.ts` → Keep as general agent, migrate to lawnflow-agents
- `server/routes/marketing.ts` → Keep (different purpose - API routes)
- `server/temporal/activities/marketing.ts` → Keep (different purpose - activity)

### 3. Cross-Package Patterns

**Pattern**: Some agents have both orchestrator and general versions (AI-powered)

Examples to **PRESERVE BOTH**:
- `server/orchestrator/leadToCash/agents/leadIntake.ts` (deterministic) + `lawnflow-agents/src/agents/inbound-intake.ts` (AI-powered)
- Orchestrator version: Simple data extraction for workflow
- General version: AI-powered interpretation and enrichment

### 4. False Positives (Not Real Duplicates)

These are actually different files with same name:
- **index.ts** files (19 copies) - All different exports, not duplicates
- **config.ts** files (8 copies) - All different configs, not duplicates
- **index.test.ts** files (8 copies) - All different tests, not duplicates

## Consolidation Actions

### Phase 1: Deprecate Agent-Service
- [ ] Create `agent-service/README.md` with deprecation notice
- [ ] Create adapters in `agent-service/src/agents/_adapters/`
- [ ] Mark all agent-service files with JSDoc @deprecated tags

### Phase 2: Consolidate Duplicates

#### High Priority (Real Duplicates):
1. **billing** → Migrate `server/agents/billing.ts` to `server/orchestrator/billing/`
2. **orchestrator** → Remove `server/agents/orchestrator.ts`, use lawnflow-agents version
3. **crewIntelligence** → Migrate to `server/orchestrator/leadToCash/agents/`
4. **intake** → Deprecate duplicates, preserve both orchestrator and general versions
5. **pricing** → Deprecate duplicates, preserve both orchestrator and general versions
6. **scheduling** → Deprecate duplicates, preserve both orchestrator and general versions

#### Medium Priority (Server/Agents Migration):
- **jobFeasibility** → Already exists as `leadToCash/agents/feasibilityCheck.ts`
- **marginBurn** → Already exists as `leadToCash/agents/marginValidate.ts`
- **simulationRanking** → Migrate to `leadToCash/agents/crewIntelligence.ts` or standalone
- **routeCost** → Migrate to `leadToCash/agents/` or shared utility

### Phase 3: Standardize Patterns

**Orchestrator Agents** (deterministic functions):
- Location: `server/orchestrator/{workflow}/agents/`
- Pattern: `export async function run{Name}Agent(input, context): Promise<Result>`
- Examples: leadIntake, quoteBuild, feasibilityCheck

**General Agents** (AI-powered classes):
- Location: `lawnflow-agents/src/agents/`
- Pattern: `export class {Name}Agent extends BaseAgent`
- Examples: inbound-intake, marketing, customer-follow-up

### Phase 4: Registry Updates

**Add to lawnflow-agents registry**:
- marketing (recently implemented)
- retention_upsell (if exists)
- review_management (if exists)
- knowledge_assistant (from server/lib/assistant)
- knowledge_steward (from server/lib/knowledge)

**Remove from registry**:
- Deprecated agent-service agents

## Migration Map

| Source | Destination | Type | Status |
|--------|-------------|------|--------|
| agent-service/* | DEPRECATED | - | Pending |
| server/agents/billing.ts | server/orchestrator/billing/billingAgent.ts | orchestrator | Pending |
| server/agents/orchestrator.ts | DEPRECATED (use lawnflow-agents) | - | Pending |
| server/agents/crewIntelligence.ts | server/orchestrator/leadToCash/agents/crewIntelligence.ts | orchestrator | Pending |
| server/agents/jobFeasibility.ts | DEPRECATED (exists in leadToCash) | - | Pending |
| server/agents/marginBurn.ts | DEPRECATED (exists in leadToCash) | - | Pending |
| server/agents/marketing.ts | lawnflow-agents/src/agents/marketing.ts | general | Pending |
| server/lib/assistant/agent.ts | lawnflow-agents/src/agents/knowledge-assistant.ts | general | Pending |
| server/lib/knowledge/stewardAgent.ts | lawnflow-agents/src/agents/knowledge-steward.ts | general | Pending |

## Preservation Rules

**DO NOT consolidate these - they serve different purposes**:

1. **Activities vs Agents**: Temporal activities (server/temporal/activities/) are NOT agents
2. **Workflows vs Agents**: Temporal workflows (server/temporal/workflows/) are NOT agents
3. **Routes vs Agents**: API route handlers (server/routes/) are NOT agents
4. **Engines vs Agents**: Workflow engines (server/orchestrator/*/engine.ts) are NOT agents
5. **Index files**: Export files named index.ts serve different purposes
6. **Config files**: Configuration files are not duplicates

## Success Criteria

- [ ] Zero agents in agent-service/src/agents/ (only adapters)
- [ ] Zero agents in server/agents/ (except _adapters)
- [ ] All orchestrator agents in server/orchestrator/{workflow}/agents/
- [ ] All general agents in lawnflow-agents/src/agents/
- [ ] Registry matches actual codebase
- [ ] All tests passing
- [ ] No broken imports
