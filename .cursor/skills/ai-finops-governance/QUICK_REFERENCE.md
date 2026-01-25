# AI FinOps Quick Reference Card

## 🚦 Decision Tree: Which Model?

```
Is the task deterministic? (math, lookups)
├─ YES → Use rules/code (no AI needed)
└─ NO → Continue...

Does it require deep reasoning?
├─ YES → gpt-4o or o1-mini
└─ NO → Continue...

Is it classification/extraction/routing?
├─ YES → gpt-4o-mini ✅
└─ NO → gpt-4o (balanced)
```

## 💰 Cost Cheat Sheet

| Model | Input | Output | 1K requests @1K tokens |
|-------|-------|--------|------------------------|
| gpt-4o-mini | $0.15/1M | $0.60/1M | ~$0.40 |
| gpt-4o | $2.50/1M | $10.00/1M | ~$6.25 |
| o1-mini | $3.00/1M | $12.00/1M | ~$7.50 |

## 🔐 Security Checklist

```typescript
// ✅ DO
import { env } from './config/env';
const apiKey = env.OPENAI_API_KEY;

// ❌ DON'T
const apiKey = "sk-...";
```

**Golden Rules:**
1. Secrets from env vars only
2. Never log API keys
3. Redact all secrets in logs
4. .env in .gitignore
5. .env.example in git (with placeholders)

## 📊 Required Logging

Every AI request must log:
```typescript
logger.info({
  requestId: uuid(),
  agent: "agent-name",
  model: "gpt-4o-mini",
  promptTokens: 120,
  completionTokens: 45,
  totalTokens: 165,
  estimatedCost: 0.0000619,
  latencyMs: 1240,
  success: true,
});
```

## 🎯 Token Optimization

### Prompt Compression
```typescript
// ❌ Bad (130 tokens)
"You are a lawn care quote calculator. You help customers..."

// ✅ Good (20 tokens)
"Quote calculator. 5000 sqft, weekly mowing. Rate: $0.02/sqft."
```

### Limit Output
```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages,
  max_tokens: 300, // ✅ Always set this
});
```

### Cache Repeated Queries
```typescript
const cacheKey = hash(input);
if (cache.has(cacheKey)) return cache.get(cacheKey);
```

## ⚡ Standard Agent Pattern

```typescript
interface Agent<TInput, TOutput> {
  name: string;
  model: string;
  estimatedTokensPerCall: number;
  
  execute(input: TInput): Promise<TOutput>;
  validate(output: unknown): TOutput;
}

class MyAgent implements Agent<Input, Output> {
  name = "my-agent";
  model = "gpt-4o-mini";
  estimatedTokensPerCall = 500;
  
  async execute(input: Input): Promise<Output> {
    const response = await withRetries(() =>
      openai.chat.completions.create({
        model: this.model,
        messages: [...],
        response_format: { type: "json_object" },
        max_tokens: 300,
      })
    );
    
    await tokenTracker.track(response.usage);
    return this.validate(response);
  }
  
  validate(output: unknown): Output {
    return OutputSchema.parse(output);
  }
}
```

## 🚨 Budget Alerts

Set these environment variables:
```bash
DAILY_TOKEN_BUDGET=1000000      # 1M tokens/day
ALERT_THRESHOLD_PCT=80          # Alert at 80%
```

Alert levels:
- 🟡 Warning at 80% → Monitor closely
- 🔴 Critical at 95% → Scale down
- 🚫 Block at 100% → Stop requests

## 📝 Pre-Commit Checklist

Before committing code with AI:
- [ ] No hardcoded API keys
- [ ] Secrets from env vars
- [ ] Token tracking implemented
- [ ] Logging includes token counts
- [ ] max_tokens set on completions
- [ ] Error handling with retries
- [ ] Output validation (Zod)
- [ ] Run: `npx tsx .cursor/skills/ai-finops-governance/scripts/validate.ts`

## 🎨 Response Formats

Prefer structured output:
```typescript
// ✅ Efficient - JSON mode
response_format: { type: "json_object" }

// ✅ Most efficient - Function calling
tools: [{ type: "function", function: {...} }]

// ❌ Wasteful - Parse from text
"Please respond in JSON format..."
```

## 🔄 Retry Pattern

```typescript
async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  const max = 3;
  for (let i = 0; i <= max; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === max || err.status < 500) throw err;
      await sleep(2000 * Math.pow(2, i));
    }
  }
}
```

## 📈 ROI Formula

```
Labor Savings = Manual Cost - AI Cost
Revenue Lift = (New Conversion - Old Conversion) × Avg Customer Value
Total Benefit = Labor Savings + Revenue Lift
ROI = (Total Benefit / AI Cost) × 100
```

## 🔍 Quick Validation

Run this before committing:
```bash
npx tsx .cursor/skills/ai-finops-governance/scripts/validate.ts
```

Checks:
- ✅ No hardcoded keys
- ✅ Environment config exists
- ✅ Token tracking implemented
- ✅ Secret redaction present

## 📞 When to Get Help

Contact team lead if:
- Single request exceeds $0.50
- Daily budget > 80% used
- Error rate > 10%
- Latency > 5 seconds
- Not sure which model to use

## 🎯 Common Use Cases

| Task | Model | Typical Tokens | Cost/Request |
|------|-------|----------------|--------------|
| Route inquiry | mini | 100 | $0.00004 |
| Extract lot size | mini | 150 | $0.00006 |
| Generate quote | mini | 500 | $0.00019 |
| Analyze sentiment | mini | 200 | $0.00008 |
| Complex planning | gpt-4o | 2000 | $0.01250 |

## 🛠️ Debugging Tips

**High costs?**
1. Check prompt size → Compress
2. Check output size → Set max_tokens
3. Check model → Downgrade if possible
4. Add caching

**Slow responses?**
1. Check model load
2. Add streaming
3. Increase timeout
4. Check retry loops

**Low quality?**
1. Add examples to prompt
2. Use structured output
3. Consider upgrading model
4. Add validation

## 📚 Full Documentation

For complete details:
- `.cursor/skills/ai-finops-governance/SKILL.md` - Full guidelines
- `.cursor/skills/ai-finops-governance/reference.md` - Pricing & queries
- `.cursor/skills/ai-finops-governance/examples.md` - Code samples

---

**Print this and keep it handy!** 📌
