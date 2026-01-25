-- Thread Enrichment System Migration
-- Sprint 2: Unified Inbox + Support Queue
-- Security: Multi-tenant isolation, SLA tracking, intent classification

-- 1. Thread Enrichment Table
CREATE TABLE thread_enrichment (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER NOT NULL UNIQUE REFERENCES comms_threads(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Classification
  intent TEXT,
  intent_confidence REAL CHECK (intent_confidence >= 0 AND intent_confidence <= 1),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  priority_reason TEXT,

  -- PSKB Coverage Analysis
  coverage_status TEXT NOT NULL DEFAULT 'unknown' CHECK (coverage_status IN ('covered', 'partial', 'uncovered', 'unknown')),
  matched_knowledge_item_ids JSONB DEFAULT '[]',
  coverage_gaps JSONB DEFAULT '[]',

  -- SLA Tracking
  first_response_due TIMESTAMPTZ,
  resolution_due TIMESTAMPTZ,
  sla_status TEXT NOT NULL DEFAULT 'on_track' CHECK (sla_status IN ('on_track', 'at_risk', 'breached', 'resolved')),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  -- Metadata
  enriched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enriched_by TEXT NOT NULL DEFAULT 'system',
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (first_response_due IS NULL OR resolution_due IS NULL OR first_response_due <= resolution_due),
  CHECK (first_response_at IS NULL OR first_response_at <= NOW()),
  CHECK (resolved_at IS NULL OR resolved_at >= first_response_at OR first_response_at IS NULL)
);

-- Performance indexes
CREATE INDEX idx_thread_enrichment_business ON thread_enrichment(business_id);
CREATE INDEX idx_thread_enrichment_priority ON thread_enrichment(priority) WHERE sla_status != 'resolved';
CREATE INDEX idx_thread_enrichment_coverage ON thread_enrichment(coverage_status);
CREATE INDEX idx_thread_enrichment_sla_status ON thread_enrichment(sla_status);
CREATE INDEX idx_thread_enrichment_intent ON thread_enrichment(intent) WHERE intent IS NOT NULL;
CREATE INDEX idx_thread_enrichment_response_due ON thread_enrichment(first_response_due)
  WHERE first_response_due IS NOT NULL AND first_response_at IS NULL;

-- JSONB indexes for coverage analysis
CREATE INDEX idx_thread_enrichment_matched_knowledge ON thread_enrichment
  USING GIN(matched_knowledge_item_ids);
CREATE INDEX idx_thread_enrichment_gaps ON thread_enrichment
  USING GIN(coverage_gaps);

-- Row-level security
ALTER TABLE thread_enrichment ENABLE ROW LEVEL SECURITY;

CREATE POLICY thread_enrichment_isolation ON thread_enrichment
  FOR ALL
  USING (business_id = current_setting('app.current_business_id')::INTEGER);

-- Trigger to update last_updated_at
CREATE OR REPLACE FUNCTION update_thread_enrichment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thread_enrichment_update_timestamp
  BEFORE UPDATE ON thread_enrichment
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_enrichment_timestamp();

-- Audit trigger
CREATE TRIGGER audit_thread_enrichment
  AFTER INSERT OR UPDATE OR DELETE ON thread_enrichment
  FOR EACH ROW EXECUTE FUNCTION audit_knowledge_change();

-- 2. Support Queue Views (for easier querying)

-- Pending support queue (needs first response)
CREATE OR REPLACE VIEW support_queue_pending AS
SELECT
  te.id AS enrichment_id,
  te.thread_id,
  te.business_id,
  te.intent,
  te.priority,
  te.coverage_status,
  te.first_response_due,
  te.sla_status,
  ct.subject,
  ct.last_message_at,
  ct.assigned_to,
  ct.status AS thread_status,
  CASE
    WHEN te.first_response_due < NOW() THEN 'overdue'
    WHEN te.first_response_due < NOW() + INTERVAL '1 hour' THEN 'critical'
    WHEN te.first_response_due < NOW() + INTERVAL '4 hours' THEN 'soon'
    ELSE 'ok'
  END AS response_urgency
FROM thread_enrichment te
JOIN comms_threads ct ON te.thread_id = ct.id
WHERE te.first_response_at IS NULL
  AND te.sla_status != 'resolved'
  AND ct.status != 'closed';

-- Coverage gaps aggregation (for knowledge team)
CREATE OR REPLACE VIEW coverage_gap_analysis AS
SELECT
  te.business_id,
  te.intent,
  te.coverage_status,
  COUNT(*) AS occurrence_count,
  MAX(te.last_updated_at) AS last_seen,
  MIN(te.enriched_at) AS first_seen,
  ARRAY_AGG(DISTINCT te.thread_id) AS affected_thread_ids
FROM thread_enrichment te
WHERE te.coverage_status IN ('uncovered', 'partial')
  AND te.enriched_at > NOW() - INTERVAL '30 days'
GROUP BY te.business_id, te.intent, te.coverage_status
HAVING COUNT(*) >= 3
ORDER BY occurrence_count DESC;

-- SLA breach analysis
CREATE OR REPLACE VIEW sla_breach_report AS
SELECT
  te.business_id,
  te.priority,
  COUNT(*) FILTER (WHERE te.sla_status = 'breached') AS breached_count,
  COUNT(*) FILTER (WHERE te.sla_status = 'at_risk') AS at_risk_count,
  COUNT(*) FILTER (WHERE te.sla_status = 'on_track') AS on_track_count,
  COUNT(*) FILTER (WHERE te.sla_status = 'resolved') AS resolved_count,
  AVG(EXTRACT(EPOCH FROM (te.first_response_at - te.enriched_at))) FILTER (WHERE te.first_response_at IS NOT NULL) / 60 AS avg_first_response_minutes,
  AVG(EXTRACT(EPOCH FROM (te.resolved_at - te.enriched_at))) FILTER (WHERE te.resolved_at IS NOT NULL) / 3600 AS avg_resolution_hours
FROM thread_enrichment te
WHERE te.enriched_at > NOW() - INTERVAL '7 days'
GROUP BY te.business_id, te.priority;

-- Function to auto-calculate SLA deadlines based on priority
CREATE OR REPLACE FUNCTION calculate_sla_deadlines(
  p_priority TEXT,
  p_created_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  first_response_due TIMESTAMPTZ,
  resolution_due TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE p_priority
      WHEN 'urgent' THEN p_created_at + INTERVAL '1 hour'
      WHEN 'high' THEN p_created_at + INTERVAL '2 hours'
      WHEN 'normal' THEN p_created_at + INTERVAL '4 hours'
      WHEN 'low' THEN p_created_at + INTERVAL '8 hours'
      ELSE p_created_at + INTERVAL '4 hours'
    END AS first_response_due,
    CASE p_priority
      WHEN 'urgent' THEN p_created_at + INTERVAL '24 hours'
      WHEN 'high' THEN p_created_at + INTERVAL '48 hours'
      WHEN 'normal' THEN p_created_at + INTERVAL '72 hours'
      WHEN 'low' THEN p_created_at + INTERVAL '120 hours'
      ELSE p_created_at + INTERVAL '72 hours'
    END AS resolution_due;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-update SLA status
CREATE OR REPLACE FUNCTION update_sla_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-update SLA status based on current time
  IF NEW.resolved_at IS NOT NULL THEN
    NEW.sla_status = 'resolved';
  ELSIF NEW.first_response_due < NOW() AND NEW.first_response_at IS NULL THEN
    NEW.sla_status = 'breached';
  ELSIF NEW.first_response_due < NOW() + INTERVAL '30 minutes' AND NEW.first_response_at IS NULL THEN
    NEW.sla_status = 'at_risk';
  ELSIF NEW.first_response_at IS NOT NULL AND NEW.resolution_due < NOW() AND NEW.resolved_at IS NULL THEN
    NEW.sla_status = 'breached';
  ELSIF NEW.first_response_at IS NOT NULL AND NEW.resolution_due < NOW() + INTERVAL '4 hours' AND NEW.resolved_at IS NULL THEN
    NEW.sla_status = 'at_risk';
  ELSE
    NEW.sla_status = 'on_track';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thread_enrichment_sla_update
  BEFORE INSERT OR UPDATE ON thread_enrichment
  FOR EACH ROW
  EXECUTE FUNCTION update_sla_status();

COMMENT ON TABLE thread_enrichment IS 'AI-powered thread classification and SLA tracking';
COMMENT ON COLUMN thread_enrichment.intent IS 'Classified intent (e.g., reschedule_request, price_inquiry)';
COMMENT ON COLUMN thread_enrichment.coverage_status IS 'Whether PSKB has knowledge to answer this thread';
COMMENT ON COLUMN thread_enrichment.matched_knowledge_item_ids IS 'Array of knowledge_items.id that match this thread';
COMMENT ON COLUMN thread_enrichment.coverage_gaps IS 'Array of {topic, reason} objects for uncovered intents';
COMMENT ON VIEW support_queue_pending IS 'Real-time support queue with SLA urgency indicators';
COMMENT ON VIEW coverage_gap_analysis IS 'Aggregated coverage gaps for knowledge team to address';
