-- ============================================================================
-- Migration: 0015_finops_tables.sql
-- Description: FinOps tables for token tracking, budget management, and memory/RAG
-- ============================================================================

-- ============================================================================
-- usage_ledger: Token and cost tracking per workflow step
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_ledger (
  id SERIAL PRIMARY KEY,

  -- Business context
  business_id INTEGER REFERENCES business_profiles(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,

  -- Workflow context (optional - can track non-workflow usage too)
  workflow_run_id INTEGER REFERENCES workflow_runs(id) ON DELETE SET NULL,
  workflow_step_id INTEGER REFERENCES workflow_steps(id) ON DELETE SET NULL,

  -- Activity identification
  activity_type TEXT NOT NULL,
  activity_name TEXT,

  -- Model information
  model_provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google', etc.
  model_id TEXT NOT NULL,       -- 'gpt-4o', 'claude-3-opus', etc.

  -- Token counts
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  -- Cost tracking (in microdollars for precision, 1 USD = 1,000,000 microdollars)
  cost_microdollars INTEGER DEFAULT 0,

  -- Request metadata
  trace_id TEXT NOT NULL,
  request_id TEXT,

  -- Timing
  request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  response_timestamp TIMESTAMP WITH TIME ZONE,
  latency_ms INTEGER,

  -- Additional context
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for usage_ledger
CREATE INDEX IF NOT EXISTS idx_usage_ledger_business_id ON usage_ledger(business_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_account_id ON usage_ledger(account_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_workflow_run_id ON usage_ledger(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_request_timestamp ON usage_ledger(request_timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_model_provider ON usage_ledger(model_provider);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_trace_id ON usage_ledger(trace_id);

-- Composite index for daily aggregation queries
CREATE INDEX IF NOT EXISTS idx_usage_ledger_business_day
  ON usage_ledger(business_id, DATE(request_timestamp));

-- ============================================================================
-- budget_configs: Per-business budget limits and policies
-- ============================================================================

CREATE TABLE IF NOT EXISTS budget_configs (
  id SERIAL PRIMARY KEY,

  -- Business reference (unique per business)
  business_id INTEGER REFERENCES business_profiles(id) ON DELETE CASCADE UNIQUE,
  account_id TEXT NOT NULL,

  -- Monthly budget (in microdollars)
  monthly_budget_microdollars INTEGER DEFAULT 10000000, -- $10 default

  -- Alert thresholds (percentages)
  warning_threshold_percent INTEGER DEFAULT 80,
  critical_threshold_percent INTEGER DEFAULT 95,
  hard_cap_percent INTEGER DEFAULT 100,

  -- Model preferences
  preferred_model TEXT DEFAULT 'gpt-4o-mini',
  fallback_model TEXT DEFAULT 'gpt-3.5-turbo',
  allow_premium_models BOOLEAN DEFAULT false,
  premium_models JSONB DEFAULT '["gpt-4o", "claude-3-opus", "claude-3-5-sonnet"]'::jsonb,

  -- Budget exceeded behavior
  on_budget_exceeded TEXT DEFAULT 'downgrade' CHECK (on_budget_exceeded IN ('downgrade', 'block', 'alert_only')),

  -- Daily limits (optional, in microdollars)
  daily_limit_microdollars INTEGER,

  -- Per-workflow limits (optional, in microdollars)
  per_workflow_limit_microdollars INTEGER,

  -- Rate limiting
  max_requests_per_minute INTEGER DEFAULT 60,
  max_tokens_per_minute INTEGER DEFAULT 100000,

  -- Notification settings
  alert_email TEXT,
  alert_webhook_url TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for budget lookups
CREATE INDEX IF NOT EXISTS idx_budget_configs_account_id ON budget_configs(account_id);

-- ============================================================================
-- budget_alerts: Track budget alert history
-- ============================================================================

CREATE TABLE IF NOT EXISTS budget_alerts (
  id SERIAL PRIMARY KEY,

  business_id INTEGER REFERENCES business_profiles(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,

  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN ('warning', 'critical', 'exceeded', 'daily_limit', 'rate_limit')),
  threshold_percent INTEGER,
  current_usage_microdollars INTEGER NOT NULL,
  budget_limit_microdollars INTEGER NOT NULL,

  -- Context
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Resolution
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by_user_id INTEGER REFERENCES users(id),

  -- Notification status
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_budget_alerts_business_id ON budget_alerts(business_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_created_at ON budget_alerts(created_at);

-- ============================================================================
-- model_routing_rules: Custom model routing based on task type
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_routing_rules (
  id SERIAL PRIMARY KEY,

  business_id INTEGER REFERENCES business_profiles(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,

  -- Rule identification
  rule_name TEXT NOT NULL,
  priority INTEGER DEFAULT 0, -- Higher priority rules evaluated first

  -- Matching conditions (JSONB for flexibility)
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Example: {"activity_type": "billing", "task_complexity": "high"}

  -- Model selection
  model_id TEXT NOT NULL,
  model_provider TEXT NOT NULL,

  -- Cost control
  max_tokens INTEGER,
  temperature NUMERIC(3, 2) DEFAULT 0.7,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_model_routing_rules_business_id ON model_routing_rules(business_id);

-- ============================================================================
-- memory_docs: RAG document storage with embeddings
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_docs (
  id SERIAL PRIMARY KEY,

  -- Business and customer context
  business_id INTEGER REFERENCES business_profiles(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  customer_id INTEGER, -- Optional: customer-specific memory

  -- Document identification
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'conversation_summary',
    'job_summary',
    'customer_preference',
    'service_history',
    'complaint_resolution',
    'policy_document',
    'faq',
    'custom'
  )),

  -- Content
  title TEXT,
  content TEXT NOT NULL,

  -- Vector embedding (using pgvector if available, otherwise store as JSON)
  embedding JSONB, -- Store as JSON array if pgvector not installed
  embedding_model TEXT DEFAULT 'text-embedding-3-small',

  -- Source tracking
  source_entity_type TEXT, -- 'conversation', 'job', 'workflow', etc.
  source_entity_id INTEGER,
  source_workflow_id TEXT,

  -- Metadata
  tags JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Importance and relevance
  importance_score NUMERIC(3, 2) DEFAULT 0.5,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,

  -- TTL and expiration
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for memory_docs
CREATE INDEX IF NOT EXISTS idx_memory_docs_business_id ON memory_docs(business_id);
CREATE INDEX IF NOT EXISTS idx_memory_docs_customer_id ON memory_docs(customer_id);
CREATE INDEX IF NOT EXISTS idx_memory_docs_doc_type ON memory_docs(doc_type);
CREATE INDEX IF NOT EXISTS idx_memory_docs_source ON memory_docs(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_memory_docs_tags ON memory_docs USING GIN(tags);

-- ============================================================================
-- workflow_summaries: Post-workflow writeback summaries
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_summaries (
  id SERIAL PRIMARY KEY,

  -- Workflow reference
  workflow_run_id INTEGER REFERENCES workflow_runs(id) ON DELETE CASCADE UNIQUE,
  workflow_id TEXT NOT NULL,
  workflow_type TEXT NOT NULL,

  -- Business context
  business_id INTEGER REFERENCES business_profiles(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,

  -- Entity context
  primary_entity_type TEXT,
  primary_entity_id INTEGER,
  customer_id INTEGER,

  -- Summary content
  summary TEXT NOT NULL,
  key_decisions JSONB DEFAULT '[]'::jsonb,
  outcomes JSONB DEFAULT '{}'::jsonb,

  -- Metrics
  total_steps INTEGER,
  human_interventions INTEGER DEFAULT 0,
  total_duration_ms INTEGER,
  total_cost_microdollars INTEGER DEFAULT 0,

  -- Model usage breakdown
  model_usage JSONB DEFAULT '{}'::jsonb,
  -- Example: {"gpt-4o": {"tokens": 5000, "cost": 150000}, "gpt-4o-mini": {"tokens": 2000, "cost": 2000}}

  -- Generated memory doc (if created)
  memory_doc_id INTEGER REFERENCES memory_docs(id),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_summaries_workflow_run_id ON workflow_summaries(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_summaries_business_id ON workflow_summaries(business_id);
CREATE INDEX IF NOT EXISTS idx_workflow_summaries_customer_id ON workflow_summaries(customer_id);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_budget_configs_updated_at ON budget_configs;
CREATE TRIGGER update_budget_configs_updated_at
  BEFORE UPDATE ON budget_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_model_routing_rules_updated_at ON model_routing_rules;
CREATE TRIGGER update_model_routing_rules_updated_at
  BEFORE UPDATE ON model_routing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_memory_docs_updated_at ON memory_docs;
CREATE TRIGGER update_memory_docs_updated_at
  BEFORE UPDATE ON memory_docs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Helper Views
-- ============================================================================

-- Daily usage summary by business
CREATE OR REPLACE VIEW daily_usage_summary AS
SELECT
  business_id,
  account_id,
  DATE(request_timestamp) as usage_date,
  model_provider,
  model_id,
  COUNT(*) as request_count,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(cost_microdollars) as total_cost_microdollars,
  AVG(latency_ms) as avg_latency_ms
FROM usage_ledger
GROUP BY business_id, account_id, DATE(request_timestamp), model_provider, model_id;

-- Monthly usage summary by business
CREATE OR REPLACE VIEW monthly_usage_summary AS
SELECT
  business_id,
  account_id,
  DATE_TRUNC('month', request_timestamp) as usage_month,
  COUNT(*) as request_count,
  SUM(total_tokens) as total_tokens,
  SUM(cost_microdollars) as total_cost_microdollars,
  COUNT(DISTINCT workflow_run_id) as workflow_count
FROM usage_ledger
GROUP BY business_id, account_id, DATE_TRUNC('month', request_timestamp);

-- Budget status view
CREATE OR REPLACE VIEW budget_status AS
SELECT
  bc.business_id,
  bc.account_id,
  bc.monthly_budget_microdollars,
  bc.warning_threshold_percent,
  bc.critical_threshold_percent,
  bc.hard_cap_percent,
  bc.preferred_model,
  bc.on_budget_exceeded,
  COALESCE(mu.total_cost_microdollars, 0) as current_month_usage,
  ROUND(COALESCE(mu.total_cost_microdollars, 0)::numeric / bc.monthly_budget_microdollars * 100, 2) as usage_percent,
  bc.monthly_budget_microdollars - COALESCE(mu.total_cost_microdollars, 0) as remaining_budget,
  CASE
    WHEN COALESCE(mu.total_cost_microdollars, 0) >= bc.monthly_budget_microdollars * bc.hard_cap_percent / 100 THEN 'exceeded'
    WHEN COALESCE(mu.total_cost_microdollars, 0) >= bc.monthly_budget_microdollars * bc.critical_threshold_percent / 100 THEN 'critical'
    WHEN COALESCE(mu.total_cost_microdollars, 0) >= bc.monthly_budget_microdollars * bc.warning_threshold_percent / 100 THEN 'warning'
    ELSE 'ok'
  END as budget_status
FROM budget_configs bc
LEFT JOIN (
  SELECT
    business_id,
    SUM(cost_microdollars) as total_cost_microdollars
  FROM usage_ledger
  WHERE request_timestamp >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
  GROUP BY business_id
) mu ON bc.business_id = mu.business_id
WHERE bc.is_active = true;
