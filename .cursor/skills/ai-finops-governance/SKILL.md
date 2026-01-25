---
name: ai-finops-governance
description: Governs AI agent development with cost-effectiveness, monitoring, and security guardrails. Use when building agents, making LLM API calls, handling secrets, or designing AI-driven workflows to ensure cost control and compound customer value.
---

# AI FinOps & Governance

## Core Principles

When building AI-driven agents and workflows:

1. **Cost-effectiveness first**: Every token has a cost; every API call impacts margins
2. **Customer value compounds**: AI should amplify outcomes, not just automate
3. **Fail fast, fail cheap**: Validate before scaling
4. **Secure by default**: Never commit secrets, never log keys
5. **Observable always**: What you can't measure, you can't optimize

## Token Budget Management

### Model Selection Strategy

Choose models based on task complexity and cost:

```markdown
| Task Type | Model | Cost/1M tokens | When to Use |
|-----------|-------|----------------|-------------|
| Simple classification | gpt-4o-mini | $0.15 | Binary decisions, routing |
| Structured extraction | gpt-4o-mini | $0.15 | Parsing, validation |
| Reasoning & planning | gpt-4o | $2.50 | Complex workflows |
| Long context analysis | o1-mini | $3.00 | Deep analysis required |
```

### Cost Control Checklist

Before implementing AI features:

- [ ] Estimated tokens per request (input + output)
- [ ] Expected request volume per day/month
- [ ] Total monthly cost projection
- [ ] Fallback strategy if budget exceeded
- [ ] Caching strategy for repeated queries

### Token Optimization Techniques

**1. Prompt Engineering**
- Use system messages efficiently (reused across requests)
- Minimize examples; rely on model capabilities
- Use structured outputs (JSON mode) to reduce token waste
- Cache unchanging context at system level

**2. Context Management**
```typescript
// ❌ Bad - includes unnecessary context
const prompt = `Here is the entire user history: ${JSON.stringify(history)}
Now analyze their last message: ${lastMessage}`;

// ✅ Good - only relevant context
const prompt = `Last 3 interactions: ${recentHistory}
Current message: ${lastMessage}`;
```

**3. Streaming & Early Termination**
```typescript
// Stream responses to detect completion early
const stream = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages,
  stream: true,
  max_tokens: 500, // Hard limit prevents runaway costs
});

// Stop early if sufficient answer detected
for await (const chunk of stream) {
  if (isAnswerComplete(accumulated)) break;
}
```

## Secure Secret Management

### CRITICAL: Never Commit Secrets

All API keys and secrets MUST be:
1. Loaded from environment variables
2. Validated at startup with zod/joi
3. Redacted in all logs
4. Injected via platform-specific secret managers

### Standard Pattern: Environment Configuration

Use this exact pattern for all services:

**1. Environment Schema** (`src/config/env.ts`)
```typescript
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  
  // OpenAI
  OPENAI_API_KEY: z.string().min(20, "OPENAI_API_KEY required"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_TIMEOUT_MS: z.coerce.number().default(45_000),
  OPENAI_MAX_RETRIES: z.coerce.number().default(3),
  
  // Anthropic (if using Claude)
  ANTHROPIC_API_KEY: z.string().optional(),
  
  // Cost controls
  DAILY_TOKEN_BUDGET: z.coerce.number().default(1_000_000),
  ALERT_THRESHOLD_PCT: z.coerce.number().default(80),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export const env: AppEnv = (() => {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(i => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`❌ Invalid environment:\n${issues}`);
  }
  return parsed.data;
})();
```

**2. Secret Redaction** (`src/lib/redact.ts`)
```typescript
const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,           // OpenAI keys
  /sk-ant-[a-zA-Z0-9-]{20,}/g,      // Anthropic keys
  /Bearer [a-zA-Z0-9._-]+/g,        // Bearer tokens
];

export function redactSecrets(input: unknown): unknown {
  if (typeof input === "string") {
    let redacted = input;
    SECRET_PATTERNS.forEach(pattern => {
      redacted = redacted.replace(pattern, "[REDACTED]");
    });
    return redacted;
  }
  
  if (typeof input === "object" && input !== null) {
    const json = JSON.stringify(input);
    const redacted = redactSecrets(json);
    return JSON.parse(redacted as string);
  }
  
  return input;
}

// Wrap all loggers
export const logger = {
  info: (msg: unknown) => console.log(redactSecrets(msg)),
  error: (msg: unknown) => console.error(redactSecrets(msg)),
  warn: (msg: unknown) => console.warn(redactSecrets(msg)),
};
```

**3. Centralized Client** (`src/lib/openai.ts`)
```typescript
import OpenAI from "openai";
import { env } from "../config/env";

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: env.OPENAI_TIMEOUT_MS,
  maxRetries: env.OPENAI_MAX_RETRIES,
});

// Wrapper with retry logic and error handling
export async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  const maxAttempts = env.OPENAI_MAX_RETRIES;
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.status;
      
      // Don't retry client errors (except rate limits)
      if (status && status < 500 && status !== 429) break;
      
      if (attempt < maxAttempts) {
        const backoff = Math.min(2000 * Math.pow(2, attempt), 15_000);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  }
  
  // Never log the raw error (might contain keys)
  const status = (lastError as any)?.status;
  throw new Error(`OpenAI request failed (status ${status ?? "unknown"})`);
}
```

### Deployment Secret Injection

**Local Development** (`.env`)
```bash
# .env (NEVER COMMIT - add to .gitignore)
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"
```

**Docker Compose** (inject from shell)
```yaml
services:
  agent-service:
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_MODEL=${OPENAI_MODEL}
```

**Kubernetes** (Secret + envFrom)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ai-secrets
type: Opaque
stringData:
  OPENAI_API_KEY: "${REPLACE_IN_CI}"
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: agent
        envFrom:
        - secretRef:
            name: ai-secrets
```

**GitHub Actions**
```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Cost Monitoring & Observability

### Real-Time Budget Tracking

Implement token tracking middleware:

```typescript
// src/lib/tokenTracker.ts
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: Date;
}

class TokenBudgetTracker {
  private dailyUsage: TokenUsage[] = [];
  
  async track(usage: TokenUsage): Promise<void> {
    this.dailyUsage.push(usage);
    
    const dailyTotal = this.getDailyTotal();
    const budget = env.DAILY_TOKEN_BUDGET;
    const pctUsed = (dailyTotal / budget) * 100;
    
    if (pctUsed >= env.ALERT_THRESHOLD_PCT) {
      await this.alertBudgetThreshold(pctUsed, dailyTotal);
    }
    
    if (dailyTotal >= budget) {
      throw new Error(`Daily token budget exceeded: ${dailyTotal}/${budget}`);
    }
  }
  
  getDailyTotal(): number {
    const today = new Date().toDateString();
    return this.dailyUsage
      .filter(u => new Date(u.timestamp).toDateString() === today)
      .reduce((sum, u) => sum + u.totalTokens, 0);
  }
  
  private async alertBudgetThreshold(pct: number, used: number) {
    // Send alert via Slack/email/PagerDuty
    logger.warn({
      alert: "TOKEN_BUDGET_THRESHOLD",
      percentUsed: pct,
      tokensUsed: used,
      budget: env.DAILY_TOKEN_BUDGET,
    });
  }
}

export const tokenTracker = new TokenBudgetTracker();
```

### Logging Best Practices

**What to Log:**
- Request ID (for tracing)
- Model used
- Token counts (prompt/completion/total)
- Latency (ms)
- Cost estimate
- Success/failure status

**What NOT to Log:**
- User PII (names, emails, phone numbers)
- API keys or secrets
- Full conversation history
- Raw error objects (may contain keys)

**Example Structured Log:**
```typescript
logger.info({
  requestId: uuid(),
  agent: "quote-calculator",
  model: "gpt-4o-mini",
  promptTokens: 120,
  completionTokens: 45,
  totalTokens: 165,
  estimatedCost: 0.00002475, // $0.15 per 1M tokens
  latencyMs: 1240,
  success: true,
  timestamp: new Date().toISOString(),
});
```

## Agent Development Guardrails

### When to Use AI vs. Rules Engine

Use **deterministic rules** for:
- Simple classification (zip code → service area)
- Mathematical calculations (lot size → price)
- Policy enforcement (business hours, service caps)

Use **AI agents** for:
- Natural language understanding
- Context-aware routing
- Complex reasoning with ambiguity
- Adaptive responses based on conversation flow

### Agent Architecture Pattern

```typescript
// Standard agent interface for consistency
interface Agent<TInput, TOutput> {
  name: string;
  model: string;
  estimatedTokensPerCall: number;
  maxRetries: number;
  
  execute(input: TInput): Promise<TOutput>;
  validate(output: unknown): TOutput; // Type guard + validation
}

// Example implementation
class QuoteCalculatorAgent implements Agent<QuoteInput, QuoteOutput> {
  name = "quote-calculator";
  model = env.OPENAI_MODEL;
  estimatedTokensPerCall = 500;
  maxRetries = 2;
  
  async execute(input: QuoteInput): Promise<QuoteOutput> {
    const start = Date.now();
    
    try {
      const response = await withRetries(() => 
        openai.chat.completions.create({
          model: this.model,
          messages: this.buildMessages(input),
          response_format: { type: "json_object" },
          max_tokens: 300, // Cost control
        })
      );
      
      const usage = response.usage!;
      await tokenTracker.track({
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        estimatedCost: this.calculateCost(usage),
        timestamp: new Date(),
      });
      
      const output = JSON.parse(response.choices[0].message.content!);
      return this.validate(output);
      
    } catch (err) {
      logger.error({
        agent: this.name,
        error: "Agent execution failed",
        latencyMs: Date.now() - start,
      });
      throw err;
    }
  }
  
  validate(output: unknown): QuoteOutput {
    // Use zod for runtime validation
    return QuoteOutputSchema.parse(output);
  }
  
  private calculateCost(usage: any): number {
    // Model-specific pricing
    const pricing = {
      "gpt-4o-mini": { input: 0.15, output: 0.60 },
      "gpt-4o": { input: 2.50, output: 10.00 },
    };
    
    const rates = pricing[this.model as keyof typeof pricing];
    return (
      (usage.prompt_tokens * rates.input / 1_000_000) +
      (usage.completion_tokens * rates.output / 1_000_000)
    );
  }
  
  private buildMessages(input: QuoteInput): any[] {
    // Keep prompts minimal and focused
    return [
      { role: "system", content: "You are a lawn care quote calculator." },
      { role: "user", content: JSON.stringify(input) },
    ];
  }
}
```

### Caching Strategy

Implement caching for repeated queries:

```typescript
import { createHash } from "crypto";

class CachedAgent<TInput, TOutput> implements Agent<TInput, TOutput> {
  constructor(
    private innerAgent: Agent<TInput, TOutput>,
    private cache: Map<string, { output: TOutput, timestamp: Date }>,
    private ttlMs: number = 3600_000 // 1 hour default
  ) {}
  
  async execute(input: TInput): Promise<TOutput> {
    const cacheKey = this.getCacheKey(input);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp.getTime() < this.ttlMs) {
      logger.info({ agent: this.innerAgent.name, cacheHit: true });
      return cached.output;
    }
    
    const output = await this.innerAgent.execute(input);
    this.cache.set(cacheKey, { output, timestamp: new Date() });
    
    return output;
  }
  
  private getCacheKey(input: TInput): string {
    return createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
  }
}
```

## Pre-Deployment Checklist

Before deploying AI features:

### Security
- [ ] All secrets loaded from environment variables
- [ ] No hardcoded API keys in code
- [ ] Secret redaction applied to all loggers
- [ ] .env added to .gitignore
- [ ] .env.example committed (with placeholders)

### Cost Control
- [ ] Token budget calculated and configured
- [ ] Cost monitoring/alerting implemented
- [ ] Model selection justified (not over-provisioned)
- [ ] Max token limits set on all completions
- [ ] Caching implemented for repeated queries

### Quality
- [ ] Agent outputs validated with zod/joi schemas
- [ ] Retry logic with exponential backoff
- [ ] Timeout configured (prevent hung requests)
- [ ] Fallback behavior defined for failures
- [ ] Unit tests cover agent logic

### Observability
- [ ] Structured logging with request IDs
- [ ] Token usage tracked per request
- [ ] Latency metrics captured
- [ ] Success/failure rates monitored
- [ ] No PII in logs

## Monitoring Dashboards

Track these metrics in your observability platform:

**Cost Metrics:**
- Daily token usage (by agent, by model)
- Daily cost estimate
- Cost per customer interaction
- Budget utilization percentage

**Performance Metrics:**
- Agent latency (p50, p95, p99)
- Success rate by agent
- Retry rate
- Cache hit rate

**Quality Metrics:**
- Validation failure rate
- Fallback invocation rate
- User satisfaction scores
- Agent output consistency

## Anti-Patterns to Avoid

### ❌ Don't: Unbounded Context Windows
```typescript
// Bad - includes entire conversation history
const messages = allMessages.map(m => ({ role: m.role, content: m.content }));
```

### ✅ Do: Sliding Window + Summarization
```typescript
// Good - keep only recent context
const messages = [
  { role: "system", content: systemPrompt },
  { role: "assistant", content: conversationSummary },
  ...lastNMessages(5),
];
```

### ❌ Don't: Synchronous AI in Critical Path
```typescript
// Bad - blocks user experience
const response = await aiAgent.execute(input);
return response;
```

### ✅ Do: Async Processing with Immediate Feedback
```typescript
// Good - immediate response, AI processes async
await queue.enqueue({ userId, input });
return { status: "processing", estimatedTime: "30s" };
```

### ❌ Don't: Over-Engineering Simple Logic
```typescript
// Bad - AI for deterministic calculation
const quote = await aiAgent.calculate({ sqft: 5000, frequency: "weekly" });
```

### ✅ Do: Rules for Deterministic, AI for Ambiguous
```typescript
// Good - simple math, no AI needed
const basePrice = sqft * 0.02 * frequencyMultiplier;
```

## Compound Value Framework

AI should amplify customer outcomes, not just replace humans:

**Value Multipliers:**
1. **Personalization at scale**: Tailored recommendations for each customer
2. **Proactive engagement**: Anticipate needs before they're expressed
3. **Continuous learning**: Improve based on interaction patterns
4. **24/7 availability**: Instant responses outside business hours
5. **Consistency**: Same quality experience for every customer

**Measure Impact:**
- Customer satisfaction scores
- Time-to-resolution
- Conversion rates (quote → booking)
- Retention rates
- Cost per acquisition (with AI vs. without)

## Summary

Follow this skill to ensure:
1. **Cost-effective AI**: Right model for the task, token budgets enforced
2. **Secure by default**: Secrets never committed, always redacted
3. **Observable operations**: Track costs, performance, and quality
4. **Customer value focus**: AI amplifies outcomes, not just automation

When in doubt, optimize for **customer value per dollar spent**, not just feature completeness.
