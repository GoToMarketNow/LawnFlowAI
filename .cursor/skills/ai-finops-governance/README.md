# AI FinOps & Governance Skill

## Purpose

This skill ensures cost-effective AI development for LawnFlow while maintaining compound customer value. It provides guardrails for token budgets, secret management, monitoring, and agent architecture.

## Quick Start

The agent automatically applies this skill when you're:
- Building or modifying AI agents
- Making LLM API calls
- Handling API keys or secrets
- Designing AI-driven workflows
- Optimizing costs or performance

## Files

- **SKILL.md** - Core guidelines and patterns (read first)
- **reference.md** - Pricing tables, cost calculations, monitoring queries
- **examples.md** - Real-world implementations and code samples

## Key Principles

1. **Cost-effectiveness first** - Every token has a cost
2. **Customer value compounds** - AI amplifies outcomes
3. **Fail fast, fail cheap** - Validate before scaling
4. **Secure by default** - Never commit secrets
5. **Observable always** - Measure to optimize

## Common Use Cases

### Model Selection
```typescript
// Simple tasks → gpt-4o-mini ($0.15/1M tokens)
// Complex reasoning → gpt-4o ($2.50/1M tokens)
```

### Secret Management
```typescript
// ✅ Always from environment
import { env } from "./config/env";
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
```

### Cost Monitoring
```typescript
// Track every request
await tokenTracker.track({
  promptTokens, completionTokens, totalTokens,
  estimatedCost, timestamp: new Date()
});
```

### Agent Pattern
```typescript
interface Agent<TInput, TOutput> {
  name: string;
  model: string;
  estimatedTokensPerCall: number;
  execute(input: TInput): Promise<TOutput>;
  validate(output: unknown): TOutput;
}
```

## Pre-Deployment Checklist

Before shipping AI features:

- [ ] Secrets loaded from environment (never hardcoded)
- [ ] Token budget calculated and configured
- [ ] Cost monitoring implemented
- [ ] Model selection justified (not over-provisioned)
- [ ] Max token limits set
- [ ] Caching implemented for repeated queries
- [ ] Structured logging with request IDs
- [ ] No PII in logs
- [ ] Unit tests cover agent logic

## Budget Examples

**Small Business (500 customers/month):**
- 10 interactions × 1000 tokens = 5M tokens/month
- Cost: ~$2/month (gpt-4o-mini)

**Medium Business (5000 customers/month):**
- 15 interactions × 1200 tokens = 90M tokens/month
- Cost: ~$140/month (80% mini, 20% gpt-4o)

**Enterprise (50k customers/month):**
- 20 interactions × 2000 tokens = 2B tokens/month
- Cost: ~$5700/month (60% mini, 30% gpt-4o, 10% o1-mini)

## Support

Questions about:
- **Cost optimization** - See examples.md for patterns
- **Pricing** - See reference.md for model rates
- **Secret management** - See SKILL.md security section
- **Monitoring** - See reference.md for SQL queries

## Updates

This skill is versioned with LawnFlowAI. Check git history for changes.

Last updated: January 2026
