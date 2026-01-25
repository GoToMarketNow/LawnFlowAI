-- AI Assistant Action Requests Migration
-- Sprint 3: Gated Embedded AI Assistant
-- Security: Confirm-before-write, idempotency, audit trail

-- 1. Assistant Action Requests Table
-- All write actions require explicit confirmation
CREATE TABLE assistant_action_requests (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Who requested the action
  requested_by INTEGER REFERENCES users(id),
  requested_by_role TEXT,

  -- Action details
  action_type TEXT NOT NULL CHECK (action_type IN (
    'reschedule_job',
    'cancel_job',
    'send_message',
    'update_quote',
    'create_service_request',
    'update_payment_method',
    'issue_refund',
    'escalate_to_ops',
    'create_knowledge_item'
  )),
  action_payload JSONB NOT NULL DEFAULT '{}',
  action_reason TEXT,

  -- Confirmation workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'confirmed',
    'rejected',
    'executed',
    'failed',
    'expired'
  )),
  confirmed_by INTEGER REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  rejected_reason TEXT,

  -- Execution tracking
  executed_at TIMESTAMPTZ,
  execution_result JSONB,
  execution_error TEXT,

  -- Idempotency and expiration
  idempotency_key TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK ((status = 'pending' AND confirmed_by IS NULL AND confirmed_at IS NULL AND executed_at IS NULL) OR
         (status = 'confirmed' AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL) OR
         (status = 'rejected' AND rejected_reason IS NOT NULL) OR
         (status = 'executed' AND confirmed_by IS NOT NULL AND executed_at IS NOT NULL) OR
         (status = 'failed' AND execution_error IS NOT NULL) OR
         (status = 'expired'))
);

-- Performance indexes
CREATE INDEX idx_assistant_actions_business ON assistant_action_requests(business_id);
CREATE INDEX idx_assistant_actions_status ON assistant_action_requests(status);
CREATE INDEX idx_assistant_actions_pending ON assistant_action_requests(business_id, status)
  WHERE status = 'pending' AND expires_at > NOW();
CREATE INDEX idx_assistant_actions_conversation ON assistant_action_requests(conversation_id)
  WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_assistant_actions_expires ON assistant_action_requests(expires_at)
  WHERE status = 'pending';

-- 2. Assistant Conversation History Table
-- Tracks assistant interactions for context
CREATE TABLE assistant_conversations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  thread_id INTEGER REFERENCES comms_threads(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  user_role TEXT,

  -- Conversation metadata
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count INTEGER NOT NULL DEFAULT 0,

  -- Context
  context JSONB DEFAULT '{}',

  -- Session tracking
  session_id TEXT UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  ended_at TIMESTAMPTZ,
  end_reason TEXT
);

CREATE INDEX idx_assistant_conversations_business ON assistant_conversations(business_id);
CREATE INDEX idx_assistant_conversations_thread ON assistant_conversations(thread_id);
CREATE INDEX idx_assistant_conversations_user ON assistant_conversations(user_id);
CREATE INDEX idx_assistant_conversations_active ON assistant_conversations(is_active, last_message_at);

-- 3. Assistant Messages Table
CREATE TABLE assistant_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 10000),

  -- Citations (for assistant responses)
  citations JSONB DEFAULT '[]',

  -- Tool usage tracking
  tools_used JSONB DEFAULT '[]',

  -- Action requests generated
  action_request_id INTEGER REFERENCES assistant_action_requests(id),

  -- Feedback
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_text TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_used TEXT,
  token_count INTEGER,
  latency_ms INTEGER
);

CREATE INDEX idx_assistant_messages_conversation ON assistant_messages(conversation_id);
CREATE INDEX idx_assistant_messages_created ON assistant_messages(created_at);
CREATE INDEX idx_assistant_messages_with_citations ON assistant_messages((citations IS NOT NULL AND jsonb_array_length(citations) > 0))
  WHERE role = 'assistant';

-- 4. Read-only Tool Execution Log
CREATE TABLE assistant_tool_executions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER REFERENCES assistant_messages(id) ON DELETE CASCADE,
  conversation_id INTEGER NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Tool details
  tool_name TEXT NOT NULL,
  tool_params JSONB NOT NULL,
  tool_result JSONB,

  -- Execution tracking
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_time_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,

  -- Security
  is_read_only BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (is_read_only = TRUE) -- Enforce read-only constraint
);

CREATE INDEX idx_assistant_tool_executions_message ON assistant_tool_executions(message_id);
CREATE INDEX idx_assistant_tool_executions_conversation ON assistant_tool_executions(conversation_id);
CREATE INDEX idx_assistant_tool_executions_business ON assistant_tool_executions(business_id);
CREATE INDEX idx_assistant_tool_executions_tool ON assistant_tool_executions(tool_name);

-- Row-level security
ALTER TABLE assistant_action_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_tool_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY assistant_actions_isolation ON assistant_action_requests
  FOR ALL
  USING (business_id = current_setting('app.current_business_id')::INTEGER);

CREATE POLICY assistant_conversations_isolation ON assistant_conversations
  FOR ALL
  USING (business_id = current_setting('app.current_business_id')::INTEGER);

CREATE POLICY assistant_messages_isolation ON assistant_messages
  FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM assistant_conversations
      WHERE business_id = current_setting('app.current_business_id')::INTEGER
    )
  );

CREATE POLICY assistant_tools_isolation ON assistant_tool_executions
  FOR ALL
  USING (business_id = current_setting('app.current_business_id')::INTEGER);

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_assistant_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assistant_actions_update_timestamp
  BEFORE UPDATE ON assistant_action_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_assistant_timestamp();

-- Trigger to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE assistant_conversations
  SET last_message_at = NOW(),
      message_count = message_count + 1
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assistant_messages_update_conversation
  AFTER INSERT ON assistant_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- Audit triggers
CREATE TRIGGER audit_assistant_actions
  AFTER INSERT OR UPDATE OR DELETE ON assistant_action_requests
  FOR EACH ROW EXECUTE FUNCTION audit_knowledge_change();

CREATE TRIGGER audit_assistant_tools
  AFTER INSERT ON assistant_tool_executions
  FOR EACH ROW EXECUTE FUNCTION audit_knowledge_change();

-- Cleanup expired action requests (cron job function)
CREATE OR REPLACE FUNCTION cleanup_expired_action_requests()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE assistant_action_requests
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- View for pending action requests (needs confirmation)
CREATE OR REPLACE VIEW pending_assistant_actions AS
SELECT
  aar.id,
  aar.business_id,
  aar.action_type,
  aar.action_payload,
  aar.action_reason,
  aar.requested_by,
  aar.requested_by_role,
  aar.created_at,
  aar.expires_at,
  EXTRACT(EPOCH FROM (aar.expires_at - NOW())) / 3600 AS hours_until_expiry,
  ac.thread_id,
  ac.user_id
FROM assistant_action_requests aar
LEFT JOIN assistant_conversations ac ON aar.conversation_id = ac.id
WHERE aar.status = 'pending'
  AND aar.expires_at > NOW()
ORDER BY aar.created_at ASC;

COMMENT ON TABLE assistant_action_requests IS 'Gated AI assistant action requests requiring explicit confirmation';
COMMENT ON TABLE assistant_conversations IS 'AI assistant conversation sessions with context';
COMMENT ON TABLE assistant_messages IS 'Individual messages in assistant conversations with citations';
COMMENT ON TABLE assistant_tool_executions IS 'Read-only tool execution log for transparency and debugging';
COMMENT ON COLUMN assistant_action_requests.idempotency_key IS 'Prevents duplicate action execution';
COMMENT ON COLUMN assistant_messages.citations IS 'Array of {knowledgeItemId, versionId, title} for answer traceability';
COMMENT ON COLUMN assistant_tool_executions.is_read_only IS 'Enforced TRUE - assistant can only read, never write directly';
