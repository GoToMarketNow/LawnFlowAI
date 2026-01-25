-- Migration: 0014_temporal_tables.sql
-- Description: Create tables for Temporal workflow tracking, steps, and human tasks
-- Sprint: 1 - Temporal Foundation

-- ============================================================================
-- workflow_runs: Track Temporal workflow executions with correlation to entities
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_runs (
  id SERIAL PRIMARY KEY,

  -- Temporal identifiers
  workflow_id TEXT NOT NULL UNIQUE,           -- Temporal workflowId (e.g., "job-closeout-123-uuid")
  run_id TEXT NOT NULL,                       -- Temporal runId (for continue-as-new tracking)
  workflow_type TEXT NOT NULL,                -- JobCloseoutWorkflow, LeadToCashWorkflow, BillingWorkflow, etc.

  -- Account/business context
  account_id TEXT NOT NULL,
  business_id INTEGER REFERENCES business_profiles(id),

  -- Entity references (what this workflow is processing)
  primary_entity_type TEXT NOT NULL,          -- job, job_request, invoice, customer
  primary_entity_id INTEGER NOT NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'running',     -- running, completed, failed, cancelled, timed_out, continued_as_new
  current_stage TEXT,                         -- Current stage in workflow (for multi-stage workflows)

  -- Context/IO
  input_json JSONB NOT NULL,                  -- Workflow input parameters
  output_json JSONB,                          -- Workflow output (on completion)
  error_json JSONB,                           -- Error details (on failure)

  -- Temporal metadata
  task_queue TEXT NOT NULL,                   -- lawnflow-main, lawnflow-billing, etc.
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  timeout_seconds INTEGER,

  -- Correlation to legacy system (for migration period)
  legacy_run_id TEXT,                         -- orchestrationRuns.runId if migrated from legacy

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for workflow_runs
CREATE UNIQUE INDEX IF NOT EXISTS workflow_runs_workflow_id_idx ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS workflow_runs_business_idx ON workflow_runs(business_id);
CREATE INDEX IF NOT EXISTS workflow_runs_status_idx ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS workflow_runs_type_idx ON workflow_runs(workflow_type);
CREATE INDEX IF NOT EXISTS workflow_runs_entity_idx ON workflow_runs(primary_entity_type, primary_entity_id);
CREATE INDEX IF NOT EXISTS workflow_runs_started_idx ON workflow_runs(started_at DESC);

-- ============================================================================
-- workflow_steps: Deep audit trail for activity executions within workflows
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_steps (
  id SERIAL PRIMARY KEY,
  workflow_run_id INTEGER REFERENCES workflow_runs(id) ON DELETE CASCADE NOT NULL,

  -- Activity identification
  activity_type TEXT NOT NULL,                -- buildInvoiceActivity, checkPolicyActivity, sendSmsActivity, etc.
  activity_id TEXT NOT NULL,                  -- Temporal activityId (unique within workflow)
  step_index INTEGER NOT NULL,                -- Sequential order within workflow

  -- Execution state
  status TEXT NOT NULL DEFAULT 'pending',     -- pending, running, completed, failed, retrying, cancelled
  attempt_number INTEGER NOT NULL DEFAULT 1,  -- Current attempt (for retries)

  -- Input/Output
  input_json JSONB,                           -- Activity input parameters
  output_json JSONB,                          -- Activity output (on success)
  error_message TEXT,                         -- Error message (on failure)
  error_stack TEXT,                           -- Stack trace (for debugging)
  error_type TEXT,                            -- Error classification (ApplicationError, TimeoutError, etc.)

  -- Timing
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,                        -- Actual execution time

  -- LLM/Model usage (for FinOps tracking)
  model_used TEXT,                            -- gpt-4o, gpt-4o-mini, claude-3-opus, etc.
  model_provider TEXT,                        -- openai, anthropic
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for workflow_steps
CREATE INDEX IF NOT EXISTS workflow_steps_run_idx ON workflow_steps(workflow_run_id);
CREATE INDEX IF NOT EXISTS workflow_steps_status_idx ON workflow_steps(status);
CREATE INDEX IF NOT EXISTS workflow_steps_activity_idx ON workflow_steps(activity_type);
CREATE INDEX IF NOT EXISTS workflow_steps_started_idx ON workflow_steps(started_at DESC);

-- ============================================================================
-- human_tasks: Unified HITL (Human-in-the-Loop) approval queue
-- Replaces scattered pendingActions and paymentHumanTasks tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS human_tasks (
  id SERIAL PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,               -- UUID for external reference (stable across retries)

  -- Workflow correlation (optional - some tasks may be standalone)
  workflow_run_id INTEGER REFERENCES workflow_runs(id) ON DELETE SET NULL,

  -- Context
  account_id TEXT NOT NULL,
  business_id INTEGER REFERENCES business_profiles(id),

  -- Task classification
  task_type TEXT NOT NULL,                    -- approval, review, decision, correction, escalation
  category TEXT NOT NULL,                     -- billing, payment, scheduling, quote, support, crew

  -- Assignment
  assigned_role TEXT NOT NULL,                -- ops, finance, owner, admin, crew_lead
  assigned_user_id INTEGER REFERENCES users(id),

  -- Content
  title TEXT NOT NULL,                        -- Human-readable task title
  description TEXT,                           -- Detailed description/instructions
  context_json JSONB NOT NULL,                -- Full context for human review (job details, customer info, etc.)
  options_json JSONB,                         -- Available resolution options (e.g., [{value: 'approve', label: 'Approve'}, ...])

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',     -- pending, in_progress, completed, cancelled, expired
  priority TEXT NOT NULL DEFAULT 'normal',    -- low, normal, high, urgent

  -- Resolution
  resolution TEXT,                            -- approved, rejected, modified, escalated
  resolution_data JSONB,                      -- Data returned by human (modified values, notes, etc.)
  resolved_by_user_id INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,

  -- SLA and escalation
  due_by TIMESTAMP WITH TIME ZONE,            -- When task should be resolved by
  escalated_at TIMESTAMP WITH TIME ZONE,      -- When task was escalated
  escalation_reason TEXT,

  -- Temporal signal integration
  signal_name TEXT,                           -- Temporal signal to send on resolution (e.g., 'approval')

  -- Source tracking (where did this task come from?)
  source_type TEXT,                           -- workflow, manual, webhook, agent
  source_id TEXT,                             -- ID of source (workflow_id, agent_run_id, etc.)

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for human_tasks
CREATE UNIQUE INDEX IF NOT EXISTS human_tasks_task_id_idx ON human_tasks(task_id);
CREATE INDEX IF NOT EXISTS human_tasks_status_idx ON human_tasks(status);
CREATE INDEX IF NOT EXISTS human_tasks_workflow_idx ON human_tasks(workflow_run_id);
CREATE INDEX IF NOT EXISTS human_tasks_business_idx ON human_tasks(business_id);
CREATE INDEX IF NOT EXISTS human_tasks_assigned_idx ON human_tasks(assigned_role, assigned_user_id);
CREATE INDEX IF NOT EXISTS human_tasks_priority_idx ON human_tasks(priority, due_by);
CREATE INDEX IF NOT EXISTS human_tasks_pending_idx ON human_tasks(status, priority, created_at) WHERE status = 'pending';

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_temporal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS workflow_runs_updated_at ON workflow_runs;
CREATE TRIGGER workflow_runs_updated_at
  BEFORE UPDATE ON workflow_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_temporal_updated_at();

DROP TRIGGER IF EXISTS human_tasks_updated_at ON human_tasks;
CREATE TRIGGER human_tasks_updated_at
  BEFORE UPDATE ON human_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_temporal_updated_at();

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE workflow_runs IS 'Tracks Temporal workflow executions with full context and correlation';
COMMENT ON TABLE workflow_steps IS 'Audit trail for individual activity executions within workflows';
COMMENT ON TABLE human_tasks IS 'Unified HITL queue for human approvals, reviews, and decisions';

COMMENT ON COLUMN workflow_runs.workflow_id IS 'Unique Temporal workflowId - stable across retries';
COMMENT ON COLUMN workflow_runs.run_id IS 'Temporal runId - changes on continue-as-new';
COMMENT ON COLUMN workflow_runs.legacy_run_id IS 'Reference to orchestrationRuns.runId for migrated workflows';

COMMENT ON COLUMN workflow_steps.attempt_number IS 'Current retry attempt (starts at 1)';
COMMENT ON COLUMN workflow_steps.model_used IS 'LLM model used if activity involves AI (for FinOps)';

COMMENT ON COLUMN human_tasks.signal_name IS 'Temporal signal name to invoke when task is resolved';
COMMENT ON COLUMN human_tasks.options_json IS 'Pre-defined resolution options displayed to user';
