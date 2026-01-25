# AI FinOps Governance - Examples

## Example 1: Cost-Optimized Quote Calculator Agent

**Scenario:** Calculate lawn care quote from customer inquiry

**Before Optimization:**
```typescript
// ❌ Inefficient - 1200 tokens per request
async function generateQuote(customer: Customer, inquiry: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // Overprovisioned
    messages: [
      {
        role: "system",
        content: `You are a helpful lawn care quote calculator. You should analyze 
        customer inquiries and provide detailed quotes. Always be friendly and include
        explanations of your calculations. Consider factors like lot size, service
        frequency, seasonal adjustments, and regional pricing variations.`
      },
      {
        role: "user",
        content: `Customer: ${customer.name}
        Address: ${customer.address}
        Previous services: ${JSON.stringify(customer.history)}
        Current inquiry: ${inquiry}
        
        Please calculate a quote and explain your reasoning.`
      }
    ],
  });
  
  return completion.choices[0].message.content;
}

// Cost: ~$0.0075 per quote (gpt-4o rates)
// Monthly (1000 quotes): $7.50
```

**After Optimization:**
```typescript
// ✅ Optimized - 250 tokens per request
async function generateQuote(customer: Customer, inquiry: string) {
  const lotSize = await getLotSizeFromAddress(customer.address); // Cached lookup
  const frequency = extractFrequency(inquiry); // Simple regex
  
  // Use deterministic pricing for base calculation
  const basePrice = calculateBasePrice(lotSize, frequency);
  
  // Only use AI for add-ons and special requests
  const addons = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Right-sized
    messages: [
      { role: "system", content: "Extract lawn care add-ons from request. JSON output." },
      { role: "user", content: inquiry }
    ],
    response_format: { type: "json_object" },
    max_tokens: 100, // Limit output
  });
  
  const addonCost = calculateAddons(JSON.parse(addons.choices[0].message.content!));
  
  return {
    basePrice,
    addons: addonCost,
    total: basePrice + addonCost,
  };
}

// Cost: ~$0.0001 per quote (90% rules, 10% AI)
// Monthly (1000 quotes): $0.10
// Savings: 98.7%
```

**Key Changes:**
- Switched from gpt-4o to gpt-4o-mini (85% cost reduction)
- Moved deterministic logic out of AI (lot size lookup, base pricing)
- Used AI only for ambiguous tasks (extracting add-ons)
- Reduced prompt size by 80%
- Limited output tokens with max_tokens

---

## Example 2: Conversation Routing with Token Budget

**Scenario:** Route customer inquiries to appropriate handler

**Implementation:**
```typescript
// src/agents/router.ts
import { z } from "zod";
import { openai } from "../lib/openai";
import { tokenTracker } from "../lib/tokenTracker";

const RouteSchema = z.object({
  intent: z.enum(["quote", "scheduling", "support", "billing"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export async function routeInquiry(message: string): Promise<z.infer<typeof RouteSchema>> {
  const startTime = Date.now();
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Route customer inquiry. Output: { intent, confidence, reasoning }"
        },
        {
          role: "user",
          content: message
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 50, // Routing needs minimal output
    });
    
    const usage = completion.usage!;
    
    // Track token usage
    await tokenTracker.track({
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      estimatedCost: (usage.total_tokens * 0.375) / 1_000_000,
      timestamp: new Date(),
    });
    
    const result = JSON.parse(completion.choices[0].message.content!);
    
    // Log structured data
    logger.info({
      agent: "router",
      intent: result.intent,
      confidence: result.confidence,
      tokens: usage.total_tokens,
      latencyMs: Date.now() - startTime,
    });
    
    return RouteSchema.parse(result);
    
  } catch (error) {
    logger.error({
      agent: "router",
      error: "Routing failed",
      message: redactSecrets(error),
    });
    
    // Fallback to support queue
    return { intent: "support", confidence: 0.5 };
  }
}
```

**Token Budget:**
- Estimated: 100 tokens per route (50 input + 50 output)
- Cost: $0.0000375 per route
- Daily budget: 10,000 routes = $0.375/day = $11.25/month

---

## Example 3: Caching Frequently Requested Information

**Scenario:** Weather-aware scheduling requires daily forecasts

**Without Caching:**
```typescript
// ❌ Fetches forecast for every request
async function canScheduleService(date: Date, zipCode: string) {
  const forecast = await getWeatherForecast(zipCode, date); // AI analysis
  return forecast.precipitationChance < 0.3;
}

// If 100 customers request same zip/date:
// Cost: 100 × $0.001 = $0.10
```

**With Caching:**
```typescript
// ✅ Cache forecasts by zip+date
import { createHash } from "crypto";

const forecastCache = new Map<string, { 
  forecast: WeatherForecast, 
  timestamp: Date 
}>();

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function getCacheKey(zipCode: string, date: Date): string {
  return createHash("md5")
    .update(`${zipCode}-${date.toISOString().split('T')[0]}`)
    .digest("hex");
}

async function canScheduleService(date: Date, zipCode: string) {
  const cacheKey = getCacheKey(zipCode, date);
  const cached = forecastCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp.getTime() < CACHE_TTL_MS) {
    logger.info({ agent: "weather", cacheHit: true });
    return cached.forecast.precipitationChance < 0.3;
  }
  
  const forecast = await getWeatherForecast(zipCode, date);
  forecastCache.set(cacheKey, { forecast, timestamp: new Date() });
  
  return forecast.precipitationChance < 0.3;
}

// If 100 customers request same zip/date:
// Cost: 1 × $0.001 = $0.001
// Savings: 99%
```

---

## Example 4: Streaming Responses for Early Termination

**Scenario:** Generate service recommendations until sufficient options found

**Implementation:**
```typescript
async function generateServiceRecommendations(
  customer: Customer,
  minRecommendations: number = 3
) {
  const recommendations: string[] = [];
  let accumulated = "";
  
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Suggest lawn care services. One per line."
      },
      {
        role: "user",
        content: `Customer: ${customer.preferences}, lot: ${customer.lotSize} sqft`
      }
    ],
    stream: true,
    max_tokens: 500,
  });
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    accumulated += content;
    
    // Parse recommendations as they arrive
    const lines = accumulated.split("\n").filter(l => l.trim().length > 0);
    
    if (lines.length >= minRecommendations) {
      // Stop stream early - we have enough
      stream.controller.abort();
      logger.info({
        agent: "recommendations",
        earlyTermination: true,
        tokensSaved: Math.floor((500 - accumulated.length / 4))
      });
      break;
    }
  }
  
  return accumulated.split("\n").slice(0, minRecommendations);
}

// Typical savings: 30-50% of output tokens
```

---

## Example 5: Secure Deployment Configuration

**Production Kubernetes Setup:**

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ai-secrets
  namespace: lawnflow
type: Opaque
stringData:
  OPENAI_API_KEY: "${OPENAI_API_KEY}" # Injected by CI/CD
  ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
  DAILY_TOKEN_BUDGET: "5000000"
  ALERT_THRESHOLD_PCT: "80"

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-service
  namespace: lawnflow
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: agent
        image: lawnflow/agent-service:latest
        envFrom:
        - secretRef:
            name: ai-secrets
        env:
        - name: NODE_ENV
          value: "production"
        - name: OPENAI_MODEL
          value: "gpt-4o-mini"
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
```

**GitHub Actions CI/CD:**

```yaml
# .github/workflows/deploy.yml
name: Deploy Agent Service

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build and test
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY_DEV }}
        run: |
          npm install
          npm test
          npm run build
      
      - name: Deploy to production
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY_PROD }}
          KUBECONFIG: ${{ secrets.KUBECONFIG }}
        run: |
          # Inject secret into k8s manifest
          envsubst < k8s/secrets.yaml | kubectl apply -f -
          kubectl apply -f k8s/deployment.yaml
          kubectl rollout status deployment/agent-service -n lawnflow
```

---

## Example 6: Cost Alerting System

**Implementation:**

```typescript
// src/lib/costAlerts.ts
import { env } from "../config/env";
import { logger } from "../lib/redact";
import { sendSlackAlert } from "./slack";

interface DailyUsage {
  totalTokens: number;
  totalCost: number;
  byAgent: Record<string, { tokens: number; cost: number }>;
}

export class CostAlertSystem {
  private readonly budget = env.DAILY_TOKEN_BUDGET;
  private readonly alertThreshold = env.ALERT_THRESHOLD_PCT;
  private alertSent = false;
  
  async checkAndAlert(usage: DailyUsage): Promise<void> {
    const pctUsed = (usage.totalTokens / this.budget) * 100;
    
    // Reset alert flag at midnight
    if (this.isNewDay()) {
      this.alertSent = false;
    }
    
    if (pctUsed >= 100) {
      await this.sendCriticalAlert(usage);
      throw new Error("Daily token budget exceeded - blocking requests");
    }
    
    if (pctUsed >= this.alertThreshold && !this.alertSent) {
      await this.sendWarningAlert(usage, pctUsed);
      this.alertSent = true;
    }
  }
  
  private async sendWarningAlert(usage: DailyUsage, pctUsed: number) {
    const topAgents = Object.entries(usage.byAgent)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 5)
      .map(([name, data]) => `• ${name}: $${data.cost.toFixed(4)}`)
      .join("\n");
    
    await sendSlackAlert({
      level: "warning",
      title: "⚠️ AI Token Budget Warning",
      message: `${pctUsed.toFixed(1)}% of daily budget used\n\nTop agents:\n${topAgents}`,
    });
    
    logger.warn({
      alert: "TOKEN_BUDGET_WARNING",
      percentUsed: pctUsed,
      tokensUsed: usage.totalTokens,
      budget: this.budget,
    });
  }
  
  private async sendCriticalAlert(usage: DailyUsage) {
    await sendSlackAlert({
      level: "critical",
      title: "🚨 AI Token Budget EXCEEDED",
      message: `Daily budget of ${this.budget} tokens exceeded. Blocking new requests.`,
    });
    
    logger.error({
      alert: "TOKEN_BUDGET_EXCEEDED",
      tokensUsed: usage.totalTokens,
      budget: this.budget,
    });
  }
  
  private isNewDay(): boolean {
    // Implementation depends on timezone handling
    return new Date().getHours() === 0;
  }
}

export const costAlertSystem = new CostAlertSystem();
```

**Usage in Agent Middleware:**

```typescript
// src/middleware/tokenBudget.ts
import { costAlertSystem } from "../lib/costAlerts";
import { getDailyUsage } from "../lib/tokenTracker";

export async function tokenBudgetMiddleware(req: Request, res: Response, next: Next) {
  try {
    const usage = await getDailyUsage();
    await costAlertSystem.checkAndAlert(usage);
    next();
  } catch (error) {
    if (error.message.includes("budget exceeded")) {
      res.status(429).json({
        error: "Service temporarily unavailable",
        retryAfter: getSecondsUntilMidnight(),
      });
    } else {
      next(error);
    }
  }
}
```

---

## Example 7: Multi-Model Routing Based on Complexity

**Scenario:** Route requests to appropriate model based on complexity

**Implementation:**

```typescript
// src/lib/modelRouter.ts
import { z } from "zod";
import { openai } from "./openai";

const ComplexitySchema = z.object({
  level: z.enum(["simple", "moderate", "complex"]),
  reasoning: z.string(),
});

async function assessComplexity(query: string): Promise<string> {
  // Use mini model to assess complexity (cheap)
  const assessment = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Assess query complexity. Output: { level: 'simple'|'moderate'|'complex', reasoning }"
      },
      { role: "user", content: query }
    ],
    response_format: { type: "json_object" },
    max_tokens: 50,
  });
  
  const result = ComplexitySchema.parse(
    JSON.parse(assessment.choices[0].message.content!)
  );
  
  // Route to appropriate model
  const modelMap = {
    simple: "gpt-4o-mini",      // $0.375/1M tokens
    moderate: "gpt-4o-mini",    // Still sufficient
    complex: "gpt-4o",          // $6.25/1M tokens (only when needed)
  };
  
  return modelMap[result.level];
}

export async function routedCompletion(query: string) {
  const model = await assessComplexity(query);
  
  logger.info({
    agent: "model_router",
    selectedModel: model,
    query: query.slice(0, 50) + "...",
  });
  
  return await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content: query }],
  });
}
```

**Results:**
- 80% of queries route to gpt-4o-mini (85% cost savings)
- 20% route to gpt-4o (when complexity justifies it)
- Overall cost reduction: ~70%

---

## Example 8: Temporal Workflow with Cost Tracking

**Scenario:** Multi-step customer onboarding with AI at each stage

**Implementation:**

```typescript
// workflows/customerOnboarding.ts
import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

const { analyzeInquiry, generateQuote, scheduleService, sendConfirmation } = 
  proxyActivities<typeof activities>({
    startToCloseTimeout: "5 minutes",
  });

export async function customerOnboardingWorkflow(
  inquiry: CustomerInquiry
): Promise<OnboardingResult> {
  const costTracker = { totalTokens: 0, totalCost: 0 };
  
  // Step 1: Analyze inquiry (AI)
  const analysis = await analyzeInquiry(inquiry);
  costTracker.totalTokens += analysis.tokensUsed;
  costTracker.totalCost += analysis.cost;
  
  // Step 2: Generate quote (hybrid - rules + AI)
  const quote = await generateQuote(analysis);
  costTracker.totalTokens += quote.tokensUsed;
  costTracker.totalCost += quote.cost;
  
  // Step 3: Schedule service (deterministic)
  const schedule = await scheduleService(quote);
  // No AI cost
  
  // Step 4: Send confirmation (templated)
  await sendConfirmation({ customer: inquiry.customer, schedule });
  // No AI cost
  
  // Log workflow cost
  console.log({
    workflow: "customer_onboarding",
    totalTokens: costTracker.totalTokens,
    totalCost: costTracker.totalCost,
    customerId: inquiry.customer.id,
  });
  
  return { quote, schedule, cost: costTracker };
}
```

**Activity Implementation:**

```typescript
// activities/analyzeInquiry.ts
import { openai, withRetries } from "../lib/openai";
import { tokenTracker } from "../lib/tokenTracker";

export async function analyzeInquiry(
  inquiry: CustomerInquiry
): Promise<InquiryAnalysis & { tokensUsed: number; cost: number }> {
  const completion = await withRetries(() =>
    openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Analyze customer inquiry. Extract intent, urgency, lot size." },
        { role: "user", content: inquiry.message }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    })
  );
  
  const usage = completion.usage!;
  const cost = (usage.total_tokens * 0.375) / 1_000_000;
  
  await tokenTracker.track({
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    estimatedCost: cost,
    timestamp: new Date(),
  });
  
  const analysis = JSON.parse(completion.choices[0].message.content!);
  
  return {
    ...analysis,
    tokensUsed: usage.total_tokens,
    cost,
  };
}
```

---

## Example 9: A/B Testing Model Performance vs. Cost

**Scenario:** Test if gpt-4o justifies 10x cost over gpt-4o-mini

**Implementation:**

```typescript
// src/lib/abTest.ts
interface ABTestConfig {
  testName: string;
  controlModel: string;  // gpt-4o-mini
  treatmentModel: string; // gpt-4o
  trafficSplit: number;  // 0.0-1.0 (% to treatment)
  metrics: string[];     // ["accuracy", "latency", "cost"]
}

export class ModelABTest {
  constructor(private config: ABTestConfig) {}
  
  async execute(input: string): Promise<ABTestResult> {
    const variant = Math.random() < this.config.trafficSplit 
      ? "treatment" 
      : "control";
    
    const model = variant === "treatment" 
      ? this.config.treatmentModel 
      : this.config.controlModel;
    
    const startTime = Date.now();
    
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: input }],
    });
    
    const latency = Date.now() - startTime;
    const usage = completion.usage!;
    const cost = this.calculateCost(model, usage);
    
    // Log to analytics
    await this.logExperiment({
      testName: this.config.testName,
      variant,
      model,
      latency,
      tokens: usage.total_tokens,
      cost,
      output: completion.choices[0].message.content,
    });
    
    return {
      variant,
      model,
      output: completion.choices[0].message.content!,
      metrics: { latency, tokens: usage.total_tokens, cost },
    };
  }
  
  private calculateCost(model: string, usage: any): number {
    const pricing = {
      "gpt-4o-mini": 0.375,
      "gpt-4o": 6.25,
    };
    return (usage.total_tokens * pricing[model]) / 1_000_000;
  }
  
  private async logExperiment(data: any) {
    // Send to analytics platform (Mixpanel, Amplitude, etc.)
    await analytics.track("ab_test_model_selection", data);
  }
}

// Usage
const quoteABTest = new ModelABTest({
  testName: "quote_calculator_model",
  controlModel: "gpt-4o-mini",
  treatmentModel: "gpt-4o",
  trafficSplit: 0.1, // 10% to gpt-4o
  metrics: ["accuracy", "latency", "cost"],
});

// Run for 1000 requests, then analyze
const result = await quoteABTest.execute(customerQuery);
```

**Analysis Query:**

```sql
-- Compare control vs treatment after 1000 samples
SELECT
  variant,
  model,
  COUNT(*) as samples,
  AVG(latency) as avg_latency_ms,
  AVG(cost) as avg_cost,
  AVG(tokens) as avg_tokens,
  -- Assume separate accuracy scoring
  AVG(accuracy_score) as avg_accuracy
FROM ab_test_logs
WHERE test_name = 'quote_calculator_model'
  AND timestamp >= NOW() - INTERVAL '7 days'
GROUP BY variant, model;

-- Result interpretation:
-- If gpt-4o accuracy is only 2% better but 10x cost → not worth it
-- If gpt-4o accuracy is 20% better → may justify for premium customers
```

---

## Summary

These examples demonstrate:

1. **Model selection** - Use the cheapest model that meets quality requirements
2. **Caching** - Avoid redundant AI calls for identical inputs
3. **Streaming** - Terminate early when sufficient output received
4. **Hybrid approaches** - Combine rules and AI for optimal cost/quality
5. **Monitoring** - Track token usage and costs in real-time
6. **Security** - Never commit secrets, always use env vars
7. **Testing** - A/B test model performance vs. cost

Apply these patterns throughout LawnFlow to maintain cost-effectiveness while delivering excellent customer experiences.
