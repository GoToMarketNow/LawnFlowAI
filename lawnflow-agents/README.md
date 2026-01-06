# LawnFlow.ai Agent Prompt Pack

An agentic operations and revenue platform for lawn care companies, powered by OpenAI GPT models.

## Features

- **12 Core Agents**: Orchestrator, inbound intake, qualification, pricing/profit, scheduling/dispatch, route optimization, crew management, job execution, invoicing/payment, retention/upsell, reviews/referrals, profit analytics
- **6 Subagents**: Entity resolver, SMS copywriter, data validator, summarizer, policy guard, cost estimator
- **SMS-First Lifecycle**: Complete automation from inbound demand to payment collection
- **Profit Protection**: Built-in margin safeguards and pricing intelligence
- **FinOps Discipline**: Token budgeting, tool call limits, deterministic routing
- **OpenAI Integration**: GPT-4 powered with structured JSON outputs

## Quick Start

### Prerequisites
- Node.js 18+
- OpenAI API key

### Installation

```bash
cd lawnflow-agents
npm install
cp .env.example .env
# Edit .env with your OPENAI_API_KEY
```

### Usage

```typescript
import { AgentRunner } from './runtime';

const runner = new AgentRunner();

const result = await runner.runAgent('orchestrator', event, stateSummary, finopsConfig);
console.log(result);
```

### CLI Usage

```bash
npm run build
npm start
```

## Architecture

### Agent System
- **Orchestrator**: Routes events to appropriate agents based on deterministic rules
- **Specialized Agents**: Handle specific business functions with domain expertise
- **Subagents**: Provide supporting capabilities (validation, messaging, etc.)

### Data Flow
1. Event received (SMS, web, etc.)
2. Orchestrator routes to appropriate agent
3. Agent processes with tools and returns structured output
4. Tools execute (state management, communications, operations)
5. Results fed back for next actions

### FinOps Features
- Token budget enforcement
- Tool call limitations
- Deterministic routing to minimize costs
- Cost estimation and tracking

## Configuration

### Environment Variables
- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `OPENAI_MODEL`: Model to use (default: gpt-4)
- `MAX_TOKENS`: Max tokens per request (default: 1000)
- `TEMPERATURE`: Response temperature (default: 0.1)

### FinOps Config
```typescript
const finops: FinOpsConfig = {
  token_budget: 2000,
  allowed_tools: ['state.get', 'comms.send_sms'],
  max_tool_calls: 1
};
```

## Agent Prompts

All prompts are located in `prompts/` and follow a consistent structure:
- System context and core principles
- Input/output schemas
- Deterministic processing rules
- Error handling and stop conditions
- FinOps guidelines

## Tool Contracts

The system uses a standardized tool interface:
- `state.*`: Entity management
- `comms.*`: SMS/email communications
- `ops.*`: Operations and scheduling
- `billing.*`: Quotes and invoices
- `analytics.*`: Event logging

## Development

### Building
```bash
npm run build
```

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
```

## API Reference

### AgentRunner
Main class for executing agents.

```typescript
runAgent(
  agentName: string,
  event: Event,
  stateSummary: StateSummary,
  finops: FinOpsConfig
): Promise<Envelope>
```

### Envelope Schema
All agent responses follow this structure:
```typescript
{
  status: 'ok' | 'needs_input' | 'blocked' | 'error',
  agent: string,
  summary: string,
  cost: Cost,
  data: any,
  next_actions: NextAction[],
  errors: Error[]
}
```

## Contributing

1. Follow the established prompt structure
2. Include comprehensive error handling
3. Add FinOps considerations
4. Test with various input scenarios
5. Update documentation

## License

MIT