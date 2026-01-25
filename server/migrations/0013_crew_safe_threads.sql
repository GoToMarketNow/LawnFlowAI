-- Migration: Crew-Safe Thread Isolation
-- Adds thread visibility scopes and job-scoped permissions
-- Date: 2026-01-12

-- ============================================
-- Enhance comms_threads with visibility scopes
-- ============================================

ALTER TABLE comms_threads
ADD COLUMN thread_type TEXT DEFAULT 'general' CHECK (thread_type IN ('customer', 'crew_internal', 'ops_internal', 'general')),
ADD COLUMN visibility_scope TEXT DEFAULT 'business' CHECK (visibility_scope IN ('business', 'job', 'crew', 'user')),
ADD COLUMN scope_job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
ADD COLUMN scope_crew_id INTEGER REFERENCES crews(id) ON DELETE CASCADE,
ADD COLUMN scope_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN allows_customer_viewing BOOLEAN DEFAULT false,
ADD COLUMN archived_at TIMESTAMP,
ADD COLUMN archived_by INTEGER REFERENCES users(id);

-- Create indexes for filtering by scope
CREATE INDEX idx_comms_threads_thread_type ON comms_threads(thread_type);
CREATE INDEX idx_comms_threads_visibility_scope ON comms_threads(visibility_scope);
CREATE INDEX idx_comms_threads_scope_job_id ON comms_threads(scope_job_id) WHERE scope_job_id IS NOT NULL;
CREATE INDEX idx_comms_threads_scope_crew_id ON comms_threads(scope_crew_id) WHERE scope_crew_id IS NOT NULL;
CREATE INDEX idx_comms_threads_scope_user_id ON comms_threads(scope_user_id) WHERE scope_user_id IS NOT NULL;

COMMENT ON COLUMN comms_threads.thread_type IS 'Type of thread: customer (customer-facing), crew_internal (crew only), ops_internal (ops only), general';
COMMENT ON COLUMN comms_threads.visibility_scope IS 'Visibility scope: business (all staff), job (job participants), crew (crew only), user (specific user)';
COMMENT ON COLUMN comms_threads.scope_job_id IS 'If visibility_scope=job, this is the job ID';
COMMENT ON COLUMN comms_threads.scope_crew_id IS 'If visibility_scope=crew, this is the crew ID';
COMMENT ON COLUMN comms_threads.scope_user_id IS 'If visibility_scope=user, this is the user ID';
COMMENT ON COLUMN comms_threads.allows_customer_viewing IS 'Whether customer can view this thread (for transparency)';

-- ============================================
-- Enhance comms_messages with internal flags
-- ============================================

ALTER TABLE comms_messages
ADD COLUMN is_internal BOOLEAN DEFAULT false,
ADD COLUMN internal_note TEXT,
ADD COLUMN sanitized_for_customer BOOLEAN DEFAULT false,
ADD COLUMN original_message_id INTEGER REFERENCES comms_messages(id),
ADD COLUMN visible_to_roles TEXT[] DEFAULT '{}',
ADD COLUMN sender_user_id INTEGER REFERENCES users(id),
ADD COLUMN sender_role TEXT;

COMMENT ON COLUMN comms_messages.is_internal IS 'True if message should not be shared with customers';
COMMENT ON COLUMN comms_messages.internal_note IS 'Internal crew/ops notes not visible to customers';
COMMENT ON COLUMN comms_messages.sanitized_for_customer IS 'True if message has been sanitized before sharing';
COMMENT ON COLUMN comms_messages.original_message_id IS 'If sanitized, reference to original internal message';
COMMENT ON COLUMN comms_messages.visible_to_roles IS 'Array of roles that can see this message (e.g., [''crew'', ''ops''])';
COMMENT ON COLUMN comms_messages.sender_user_id IS 'User who sent this message';
COMMENT ON COLUMN comms_messages.sender_role IS 'Role of sender at time of sending';

CREATE INDEX idx_comms_messages_sender_user_id ON comms_messages(sender_user_id);
CREATE INDEX idx_comms_messages_is_internal ON comms_messages(is_internal);

-- ============================================
-- Thread participants junction table
-- ============================================

CREATE TABLE thread_participants (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES comms_threads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  can_read BOOLEAN DEFAULT true,
  can_write BOOLEAN DEFAULT true,
  can_invite BOOLEAN DEFAULT false,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  left_at TIMESTAMP,
  UNIQUE(thread_id, user_id)
);

CREATE INDEX idx_thread_participants_thread_id ON thread_participants(thread_id);
CREATE INDEX idx_thread_participants_user_id ON thread_participants(user_id);
CREATE INDEX idx_thread_participants_active ON thread_participants(thread_id, user_id) WHERE left_at IS NULL;

COMMENT ON TABLE thread_participants IS 'Tracks who has access to which threads with granular permissions';
COMMENT ON COLUMN thread_participants.role IS 'User role in this thread: owner, crew_lead, crew_member, ops, customer';
COMMENT ON COLUMN thread_participants.can_read IS 'Can view messages in thread';
COMMENT ON COLUMN thread_participants.can_write IS 'Can send messages in thread';
COMMENT ON COLUMN thread_participants.can_invite IS 'Can add other participants';

-- ============================================
-- Message sanitization log
-- ============================================

CREATE TABLE message_sanitization_log (
  id SERIAL PRIMARY KEY,
  original_message_id INTEGER NOT NULL REFERENCES comms_messages(id) ON DELETE CASCADE,
  sanitized_message_id INTEGER NOT NULL REFERENCES comms_messages(id) ON DELETE CASCADE,
  sanitization_type TEXT NOT NULL CHECK (sanitization_type IN ('carbon_copy', 'manual_forward', 'auto_share')),
  removed_content_types TEXT[] NOT NULL, -- e.g., ['internal_notes', 'crew_names', 'pricing_details']
  sanitized_by INTEGER REFERENCES users(id),
  sanitized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP
);

CREATE INDEX idx_sanitization_log_original ON message_sanitization_log(original_message_id);
CREATE INDEX idx_sanitization_log_sanitized ON message_sanitization_log(sanitized_message_id);
CREATE INDEX idx_sanitization_log_type ON message_sanitization_log(sanitization_type);

COMMENT ON TABLE message_sanitization_log IS 'Audit trail for messages sanitized before customer sharing';
COMMENT ON COLUMN message_sanitization_log.sanitization_type IS 'How message was sanitized: carbon_copy (automatic), manual_forward, auto_share';
COMMENT ON COLUMN message_sanitization_log.removed_content_types IS 'Types of content removed during sanitization';

-- ============================================
-- Thread access audit log
-- ============================================

CREATE TABLE thread_access_log (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES comms_threads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('view', 'send', 'invite', 'leave', 'archive', 'access_denied')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_thread_access_log_thread_id ON thread_access_log(thread_id);
CREATE INDEX idx_thread_access_log_user_id ON thread_access_log(user_id);
CREATE INDEX idx_thread_access_log_created_at ON thread_access_log(created_at);
CREATE INDEX idx_thread_access_log_action ON thread_access_log(action);

COMMENT ON TABLE thread_access_log IS 'Audit log for thread access and actions (security & compliance)';

-- ============================================
-- Helper functions
-- ============================================

-- Check if user can access thread
CREATE OR REPLACE FUNCTION can_user_access_thread(
  p_user_id INTEGER,
  p_thread_id INTEGER,
  p_user_role TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_thread RECORD;
  v_participant RECORD;
BEGIN
  -- Fetch thread details
  SELECT * INTO v_thread FROM comms_threads WHERE id = p_thread_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Owner and admin can access all threads in their business
  IF p_user_role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;

  -- Check thread visibility scope
  IF v_thread.visibility_scope = 'business' THEN
    -- All staff can see business-wide threads
    RETURN p_user_role IN ('owner', 'admin', 'staff', 'ops');
  END IF;

  IF v_thread.visibility_scope = 'user' AND v_thread.scope_user_id = p_user_id THEN
    -- User-specific thread
    RETURN true;
  END IF;

  -- Check explicit participant access
  SELECT * INTO v_participant FROM thread_participants
  WHERE thread_id = p_thread_id AND user_id = p_user_id AND left_at IS NULL;

  IF FOUND AND v_participant.can_read THEN
    RETURN true;
  END IF;

  -- Check crew-scoped access
  IF v_thread.visibility_scope = 'crew' AND v_thread.scope_crew_id IS NOT NULL THEN
    -- Check if user is member of this crew
    IF EXISTS (
      SELECT 1 FROM crew_members
      WHERE crew_id = v_thread.scope_crew_id AND user_id = p_user_id
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- Check job-scoped access
  IF v_thread.visibility_scope = 'job' AND v_thread.scope_job_id IS NOT NULL THEN
    -- Check if user is assigned to this job
    IF EXISTS (
      SELECT 1 FROM jobs j
      JOIN crew_members cm ON cm.crew_id = j.assigned_crew_id
      WHERE j.id = v_thread.scope_job_id AND cm.user_id = p_user_id
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_user_access_thread IS 'Check if user has permission to access a thread based on role and scope';

-- Get accessible threads for user
CREATE OR REPLACE FUNCTION get_accessible_threads_for_user(
  p_user_id INTEGER,
  p_business_id INTEGER,
  p_user_role TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  thread_id INTEGER,
  thread_type TEXT,
  visibility_scope TEXT,
  last_message_at TIMESTAMP,
  last_message_preview TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.id AS thread_id,
    ct.thread_type,
    ct.visibility_scope,
    ct.last_message_at,
    ct.last_message_preview
  FROM comms_threads ct
  WHERE ct.business_id = p_business_id
    AND ct.archived_at IS NULL
    AND (
      -- Owner/admin see all
      p_user_role IN ('owner', 'admin')
      OR
      -- Business-wide threads visible to staff
      (ct.visibility_scope = 'business' AND p_user_role IN ('staff', 'ops'))
      OR
      -- User-specific thread
      (ct.visibility_scope = 'user' AND ct.scope_user_id = p_user_id)
      OR
      -- Explicit participant
      EXISTS (
        SELECT 1 FROM thread_participants tp
        WHERE tp.thread_id = ct.id AND tp.user_id = p_user_id AND tp.left_at IS NULL AND tp.can_read = true
      )
      OR
      -- Crew member accessing crew thread
      (ct.visibility_scope = 'crew' AND EXISTS (
        SELECT 1 FROM crew_members cm WHERE cm.crew_id = ct.scope_crew_id AND cm.user_id = p_user_id
      ))
      OR
      -- Job participant accessing job thread
      (ct.visibility_scope = 'job' AND EXISTS (
        SELECT 1 FROM jobs j
        JOIN crew_members cm ON cm.crew_id = j.assigned_crew_id
        WHERE j.id = ct.scope_job_id AND cm.user_id = p_user_id
      ))
    )
  ORDER BY ct.last_message_at DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_accessible_threads_for_user IS 'Get all threads accessible to a user based on permissions';

-- ============================================
-- Triggers for audit logging
-- ============================================

-- Log thread access
CREATE OR REPLACE FUNCTION log_thread_access()
RETURNS TRIGGER AS $$
BEGIN
  -- This would be called from application layer with context
  -- Placeholder for future implementation
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update metadata when migration complete
INSERT INTO schema_migrations (version, applied_at)
VALUES ('0013_crew_safe_threads', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
