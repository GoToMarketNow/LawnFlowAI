-- Knowledge Base System Migration
-- Sprint 1: Provider Support Knowledge Base (PSKB)
-- Security: Multi-tenant isolation, versioning, approval workflow

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Core knowledge items (immutable versions)
CREATE TABLE knowledge_items (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('policy', 'service', 'payment', 'operations', 'proof_of_work', 'macro')),
  title TEXT NOT NULL CHECK (length(title) >= 3 AND length(title) <= 200),
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
  category TEXT NOT NULL CHECK (length(category) >= 2 AND length(category) <= 50),
  applies_to JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'retired')),
  current_version_id INTEGER,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, slug)
);

-- 2. Versioned content (immutable once published)
CREATE TABLE knowledge_versions (
  id SERIAL PRIMARY KEY,
  knowledge_item_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  content_json JSONB NOT NULL,
  content_text TEXT NOT NULL CHECK (length(content_text) >= 10),
  content_embedding VECTOR(1536), -- OpenAI ada-002 embeddings
  author_id INTEGER NOT NULL REFERENCES users(id),
  change_notes TEXT,
  published_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(knowledge_item_id, version_number),
  CHECK (retired_at IS NULL OR retired_at > published_at)
);

-- 3. Approval workflow (audit trail)
CREATE TABLE knowledge_approvals (
  id SERIAL PRIMARY KEY,
  knowledge_item_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  version_id INTEGER NOT NULL REFERENCES knowledge_versions(id) ON DELETE CASCADE,
  submitted_by INTEGER NOT NULL REFERENCES users(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewer_id INTEGER REFERENCES users(id),
  decision TEXT CHECK (decision IN ('approved', 'rejected') OR decision IS NULL),
  decision_notes TEXT,
  decided_at TIMESTAMPTZ,
  CHECK ((decision IS NULL AND reviewer_id IS NULL AND decided_at IS NULL) OR
         (decision IS NOT NULL AND reviewer_id IS NOT NULL AND decided_at IS NOT NULL))
);

-- 4. Review schedule tracking
CREATE TABLE knowledge_reviews_due (
  id SERIAL PRIMARY KEY,
  knowledge_item_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  review_due_date DATE NOT NULL,
  review_reason TEXT NOT NULL CHECK (review_reason IN ('periodic', 'policy_change', 'config_change', 'incident')),
  assigned_to INTEGER REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  completed_by INTEGER REFERENCES users(id),
  CHECK ((completed_at IS NULL AND completed_by IS NULL) OR
         (completed_at IS NOT NULL AND completed_by IS NOT NULL))
);

-- Performance indexes
CREATE INDEX idx_knowledge_items_business ON knowledge_items(business_id) WHERE status != 'retired';
CREATE INDEX idx_knowledge_items_status ON knowledge_items(status);
CREATE INDEX idx_knowledge_items_category ON knowledge_items(business_id, category);
CREATE INDEX idx_knowledge_versions_item ON knowledge_versions(knowledge_item_id);
CREATE INDEX idx_knowledge_versions_published ON knowledge_versions(knowledge_item_id, published_at)
  WHERE published_at IS NOT NULL AND retired_at IS NULL;
CREATE INDEX idx_knowledge_approvals_pending ON knowledge_approvals(knowledge_item_id)
  WHERE decision IS NULL;
CREATE INDEX idx_knowledge_reviews_due_date ON knowledge_reviews_due(review_due_date)
  WHERE completed_at IS NULL;

-- Full-text search index
CREATE INDEX idx_knowledge_content_text ON knowledge_versions
  USING GIN(to_tsvector('english', content_text));

-- Vector similarity search index (IVFFlat for performance)
CREATE INDEX idx_knowledge_content_embedding ON knowledge_versions
  USING ivfflat(content_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Foreign key constraint (circular reference)
ALTER TABLE knowledge_items
  ADD CONSTRAINT fk_knowledge_items_current_version
  FOREIGN KEY (current_version_id)
  REFERENCES knowledge_versions(id)
  ON DELETE SET NULL;

-- Row-level security policies
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_reviews_due ENABLE ROW LEVEL SECURITY;

-- Security: Users can only access knowledge for their business
CREATE POLICY knowledge_items_isolation ON knowledge_items
  FOR ALL
  USING (business_id = current_setting('app.current_business_id')::INTEGER);

CREATE POLICY knowledge_versions_isolation ON knowledge_versions
  FOR ALL
  USING (
    knowledge_item_id IN (
      SELECT id FROM knowledge_items
      WHERE business_id = current_setting('app.current_business_id')::INTEGER
    )
  );

CREATE POLICY knowledge_approvals_isolation ON knowledge_approvals
  FOR ALL
  USING (
    knowledge_item_id IN (
      SELECT id FROM knowledge_items
      WHERE business_id = current_setting('app.current_business_id')::INTEGER
    )
  );

CREATE POLICY knowledge_reviews_isolation ON knowledge_reviews_due
  FOR ALL
  USING (
    knowledge_item_id IN (
      SELECT id FROM knowledge_items
      WHERE business_id = current_setting('app.current_business_id')::INTEGER
    )
  );

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_knowledge_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_by,
    changed_at
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    to_jsonb(OLD),
    to_jsonb(NEW),
    current_setting('app.current_user_id', true)::INTEGER,
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers
CREATE TRIGGER audit_knowledge_items
  AFTER INSERT OR UPDATE OR DELETE ON knowledge_items
  FOR EACH ROW EXECUTE FUNCTION audit_knowledge_change();

CREATE TRIGGER audit_knowledge_versions
  AFTER INSERT OR UPDATE OR DELETE ON knowledge_versions
  FOR EACH ROW EXECUTE FUNCTION audit_knowledge_change();

CREATE TRIGGER audit_knowledge_approvals
  AFTER INSERT OR UPDATE OR DELETE ON knowledge_approvals
  FOR EACH ROW EXECUTE FUNCTION audit_knowledge_change();

-- Comments for documentation
COMMENT ON TABLE knowledge_items IS 'Core knowledge base items with versioning and approval workflow';
COMMENT ON TABLE knowledge_versions IS 'Immutable versions of knowledge content with vector embeddings';
COMMENT ON TABLE knowledge_approvals IS 'Approval workflow tracking for knowledge publication';
COMMENT ON TABLE knowledge_reviews_due IS 'Scheduled knowledge reviews triggered by config changes or periodic review';
COMMENT ON COLUMN knowledge_versions.content_embedding IS 'OpenAI ada-002 1536-dim vector for semantic search';
