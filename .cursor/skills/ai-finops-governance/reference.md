# AI FinOps Reference

## Model Pricing (Updated Jan 2026)

### OpenAI Models

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Context Window | Best For |
|-------|----------------------|------------------------|----------------|----------|
| gpt-4o-mini | $0.15 | $0.60 | 128K | Classification, extraction, routing |
| gpt-4o | $2.50 | $10.00 | 128K | Complex reasoning, multi-step tasks |
| o1-mini | $3.00 | $12.00 | 128K | Deep analysis, planning |
| o1 | $15.00 | $60.00 | 200K | Advanced reasoning (use sparingly) |

### Anthropic Claude Models

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Context Window | Best For |
|-------|----------------------|------------------------|----------------|----------|
| claude-3-haiku | $0.25 | $1.25 | 200K | Fast responses, simple tasks |
| claude-3-sonnet | $3.00 | $15.00 | 200K | Balanced performance |
| claude-3-opus | $15.00 | $75.00 | 200K | Highest quality (premium) |
| claude-3.5-sonnet | $3.00 | $15.00 | 200K | Latest, recommended for most use cases |

## Token Estimation Guide

### Average Token Counts

**Text:**
- 1 token ≈ 4 characters (English)
- 1 token ≈ 0.75 words
- 100 words ≈ 133 tokens

**Structured Data:**
- JSON overhead: ~10-20% extra tokens vs raw text
- CSV: More efficient than JSON
- XML: Least efficient (verbose tags)

### Common Prompt Token Estimates

| Prompt Type | Typical Tokens | Notes |
|-------------|----------------|-------|
| System message | 50-200 | Reused across conversation |
| User query (simple) | 20-100 | "Check weather for tomorrow" |
| User query (detailed) | 100-500 | With context and history |
| Agent response | 50-300 | Structured JSON output |
| Function calling definition | 100-400 | Tool schemas add overhead |

### LawnFlow-Specific Estimates

Based on typical interactions:

```typescript
// Inbound customer inquiry
const estimatedTokens = {
  systemPrompt: 150,        // Agent role and capabilities
  conversationHistory: 400,  // Last 5 messages
  customerQuery: 80,         // "Need quote for weekly mowing"
  lotSizeContext: 50,        // Property details
  serviceOptions: 100,       // Available services
  response: 200,             // Quote + explanation
  total: 980,
};

// Cost per interaction (gpt-4o-mini)
const cost = (980 * 0.75 / 1_000_000); // ~$0.000735
```

## Cost Optimization Strategies

### 1. Prompt Compression

**Before:**
```typescript
const prompt = `
You are a lawn care quote calculator agent. You help customers 
understand pricing for various lawn care services. You should always 
be friendly and professional. When calculating quotes, consider the 
lot size, service frequency, and any add-ons the customer requests.

Customer information:
- Name: John Doe
- Property: 5000 sq ft
- Location: 12345 Main St
- Previous services: None

Available services:
- Mowing: $0.02 per sq ft
- Edging: $0.01 per sq ft
- Fertilization: $0.03 per sq ft

Calculate a quote for weekly mowing.
`;
// ~130 tokens
```

**After:**
```typescript
const prompt = `Quote calculator. 5000 sqft, weekly mowing. Rate: $0.02/sqft.`;
// ~20 tokens (85% reduction)
```

### 2. Function Calling vs. Text Generation

Function calling is more token-efficient than parsing text:

**Text Generation:**
```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "Extract lot size from: 'My yard is about 5000 square feet'" }
  ],
});
// Response: "The lot size is 5000 square feet."
// Output tokens: ~10-15
```

**Function Calling:**
```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "My yard is about 5000 square feet" }
  ],
  tools: [{
    type: "function",
    function: {
      name: "extract_lot_size",
      parameters: {
        type: "object",
        properties: { sqft: { type: "number" } },
      },
    },
  }],
  tool_choice: "required",
});
// Response: { sqft: 5000 }
// Output tokens: ~5
```

### 3. Caching System Prompts (OpenAI)

OpenAI caches system messages automatically if unchanged:

```typescript
// This system message is cached after first use
const systemMessage = {
  role: "system",
  content: longSystemPrompt, // Can be up to 64K tokens
};

// First request: Full cost
// Subsequent requests: 50% discount on cached portion
```

**Requirements for caching:**
- System message must be identical across requests
- Applies to first 64K tokens of system message
- Cache persists for 5-10 minutes

### 4. Batch Processing

For non-real-time tasks, use batch API (50% discount):

```typescript
// Example: Nightly customer outreach analysis
const batch = await openai.batches.create({
  input_file_id: fileId,
  endpoint: "/v1/chat/completions",
  completion_window: "24h",
});

// 50% cost reduction, but up to 24h latency
```

## Budget Allocation Examples

### Small Business (500 customers/month)

**Assumptions:**
- 10 AI interactions per customer per month
- Average 1000 tokens per interaction (in + out)
- Using gpt-4o-mini

**Calculation:**
```
Monthly tokens: 500 customers × 10 interactions × 1000 tokens = 5M tokens
Monthly cost: 5M × ($0.15 + $0.60) / 2 / 1M = $1.88
Annual cost: $22.56
```

**Budget recommendation:** $50/month (2.5x buffer for growth/spikes)

### Medium Business (5000 customers/month)

**Assumptions:**
- 15 AI interactions per customer per month
- Mix of models: 80% mini, 20% gpt-4o
- Average 1200 tokens per interaction

**Calculation:**
```
Monthly tokens: 5000 × 15 × 1200 = 90M tokens

gpt-4o-mini (80%): 72M tokens × $0.375/M = $27
gpt-4o (20%): 18M tokens × $6.25/M = $112.50

Total monthly cost: $139.50
Annual cost: $1,674
```

**Budget recommendation:** $250/month (1.8x buffer)

### Enterprise (50k customers/month)

**Assumptions:**
- 20 AI interactions per customer per month
- Complex workflows with multiple agents
- Average 2000 tokens per interaction
- Model mix: 60% mini, 30% gpt-4o, 10% o1-mini

**Calculation:**
```
Monthly tokens: 50000 × 20 × 2000 = 2B tokens

gpt-4o-mini (60%): 1.2B × $0.375/M = $450
gpt-4o (30%): 600M × $6.25/M = $3,750
o1-mini (10%): 200M × $7.50/M = $1,500

Total monthly cost: $5,700
Annual cost: $68,400
```

**Budget recommendation:** $8,000/month (1.4x buffer + room for experimentation)

## Cost Monitoring Queries

### Daily Cost Tracking (SQL)

```sql
-- Aggregate daily costs by agent and model
SELECT
  DATE(timestamp) as date,
  agent_name,
  model,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(estimated_cost) as total_cost_usd
FROM agent_logs
WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date, agent_name, model
ORDER BY date DESC, total_cost_usd DESC;
```

### Top Cost Drivers

```sql
-- Find most expensive agents
SELECT
  agent_name,
  COUNT(*) as invocations,
  AVG(total_tokens) as avg_tokens,
  SUM(estimated_cost) as total_cost_usd,
  SUM(estimated_cost) / COUNT(*) as cost_per_invocation
FROM agent_logs
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY agent_name
ORDER BY total_cost_usd DESC
LIMIT 10;
```

### Budget Burn Rate

```sql
-- Track budget utilization over time
SELECT
  DATE(timestamp) as date,
  SUM(estimated_cost) as daily_cost,
  SUM(SUM(estimated_cost)) OVER (
    ORDER BY DATE(timestamp)
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) as cumulative_cost,
  (SUM(SUM(estimated_cost)) OVER (
    ORDER BY DATE(timestamp)
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) / EXTRACT(DAY FROM CURRENT_DATE) * 30) as projected_monthly_cost
FROM agent_logs
WHERE timestamp >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY date
ORDER BY date;
```

## Alert Thresholds

### Recommended Alert Levels

| Metric | Warning (🟡) | Critical (🔴) | Action |
|--------|-------------|--------------|--------|
| Daily budget used | 80% | 95% | Scale down non-critical agents |
| Single request cost | $0.10 | $0.50 | Review prompt size |
| Error rate | 5% | 10% | Investigate model/prompt issues |
| Avg latency | 3s | 5s | Check model load, consider caching |
| Tokens per request | 5K | 10K | Compress prompts, limit context |

### Alert Implementation Example

```typescript
interface CostAlert {
  level: "warning" | "critical";
  metric: string;
  threshold: number;
  actual: number;
  recommendation: string;
}

async function checkCostAlerts(): Promise<CostAlert[]> {
  const alerts: CostAlert[] = [];
  const dailyUsage = await getDailyTokenUsage();
  const budget = env.DAILY_TOKEN_BUDGET;
  
  const pctUsed = (dailyUsage.totalTokens / budget) * 100;
  
  if (pctUsed >= 95) {
    alerts.push({
      level: "critical",
      metric: "daily_budget",
      threshold: 95,
      actual: pctUsed,
      recommendation: "Disable non-essential agents immediately",
    });
  } else if (pctUsed >= 80) {
    alerts.push({
      level: "warning",
      metric: "daily_budget",
      threshold: 80,
      actual: pctUsed,
      recommendation: "Monitor closely, consider scaling down",
    });
  }
  
  return alerts;
}

// Run every hour
setInterval(checkCostAlerts, 3600_000);
```

## ROI Calculation Framework

### Customer Lifetime Value (CLV) Impact

```typescript
interface ROIMetrics {
  // Before AI
  manualHandlingCost: number;      // Staff time per customer
  conversionRate: number;          // Quote → booking %
  avgCustomerValue: number;        // Revenue per customer
  
  // After AI
  aiCostPerCustomer: number;       // Token costs
  newConversionRate: number;       // Improved with AI
  customerSatisfaction: number;    // CSAT score
  
  // Calculated
  netBenefit: number;
  roi: number;
}

function calculateAIROI(metrics: ROIMetrics): number {
  // Cost savings from automation
  const laborSavings = metrics.manualHandlingCost - metrics.aiCostPerCustomer;
  
  // Revenue lift from improved conversion
  const revenueLift = 
    (metrics.newConversionRate - metrics.conversionRate) * 
    metrics.avgCustomerValue;
  
  const totalBenefit = laborSavings + revenueLift;
  const totalCost = metrics.aiCostPerCustomer;
  
  return (totalBenefit / totalCost) * 100; // ROI percentage
}

// Example: LawnFlow AI ROI
const lawnflowROI = calculateAIROI({
  manualHandlingCost: 5.00,        // $5 staff time per inquiry
  conversionRate: 0.25,            // 25% baseline
  avgCustomerValue: 500,           // $500 annual value
  
  aiCostPerCustomer: 0.10,         // $0.10 in tokens
  newConversionRate: 0.35,         // 35% with AI (10% lift)
  customerSatisfaction: 4.5,       // Out of 5
});

// Result: 49,900% ROI
// Every $1 spent on AI returns $499 in value
```

## Advanced Optimization: Prompt Templating

Use template system to avoid reconstructing prompts:

```typescript
interface PromptTemplate {
  id: string;
  systemMessage: string;
  userTemplate: string;
  variables: string[];
}

const templates: Record<string, PromptTemplate> = {
  quoteCalculation: {
    id: "quote_calc_v1",
    systemMessage: "Quote calculator. Output JSON: { total, breakdown }",
    userTemplate: "{{sqft}} sqft, {{frequency}} service, {{addons}}",
    variables: ["sqft", "frequency", "addons"],
  },
};

function renderPrompt(
  templateId: string, 
  vars: Record<string, string>
): string {
  const template = templates[templateId];
  let rendered = template.userTemplate;
  
  template.variables.forEach(v => {
    rendered = rendered.replace(`{{${v}}}`, vars[v] ?? "");
  });
  
  return rendered;
}

// Usage - minimal token overhead
const prompt = renderPrompt("quoteCalculation", {
  sqft: "5000",
  frequency: "weekly",
  addons: "edging",
});
```

## Secret Rotation Policy

### Recommended Rotation Schedule

| Secret Type | Rotation Frequency | Automation |
|-------------|-------------------|------------|
| Development keys | 90 days | Manual |
| Staging keys | 30 days | Semi-automated |
| Production keys | 14 days | Automated |
| Compromised keys | Immediately | Automated |

### Rotation Automation Example

```typescript
// tools/rotate-openai-key.ts
import { SecretsManagerClient, UpdateSecretCommand } from "@aws-sdk/client-secrets-manager";

async function rotateOpenAIKey() {
  // 1. Generate new key via OpenAI API
  const newKey = await createNewOpenAIKey();
  
  // 2. Update secret manager
  const client = new SecretsManagerClient({ region: "us-east-1" });
  await client.send(new UpdateSecretCommand({
    SecretId: "prod/openai/api-key",
    SecretString: newKey,
  }));
  
  // 3. Trigger rolling deployment (Kubernetes)
  await kubectl("rollout restart deployment/agent-service");
  
  // 4. Wait for health checks
  await waitForHealthy("agent-service");
  
  // 5. Revoke old key
  await revokeOpenAIKey(oldKey);
  
  console.log("✅ Key rotation complete");
}

// Schedule: Every 14 days
```

## Compliance & Governance

### Audit Trail Requirements

Every AI interaction should log:

```typescript
interface AIAuditLog {
  requestId: string;
  timestamp: Date;
  agentName: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number;
  success: boolean;
  errorType?: string;
  
  // Compliance
  userId?: string;              // If authenticated
  containsPII: boolean;         // Flagged by scanner
  dataRetentionDays: number;    // Auto-delete after N days
  complianceFlags: string[];    // GDPR, CCPA, etc.
}
```

### PII Detection

Implement PII scanning before logging:

```typescript
import { patterns } from "./pii-patterns";

function detectPII(text: string): boolean {
  const piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/,           // SSN
    /\b[\w.%+-]+@[\w.-]+\.[A-Z]{2,}\b/i, // Email
    /\b\d{3}-\d{3}-\d{4}\b/,           // Phone
    /\b\d{16}\b/,                      // Credit card (simple)
  ];
  
  return piiPatterns.some(pattern => pattern.test(text));
}

// Before logging
if (detectPII(userInput)) {
  logger.info({
    requestId,
    containsPII: true,
    input: "[REDACTED - PII DETECTED]",
  });
} else {
  logger.info({ requestId, input: userInput });
}
```

## Summary

Use this reference for:
- **Accurate cost projections** before building features
- **Budget allocation** across agents and models
- **Monitoring queries** to track spend in real-time
- **ROI calculations** to justify AI investments
- **Compliance** with data governance requirements

Keep costs predictable, value measurable, and operations secure.
