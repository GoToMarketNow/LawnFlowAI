-- Marketing Agent Tables Migration
-- Creates all tables for marketing prospects, pre-qualification, service areas, and tracking

-- Marketing Prospects - discovered opportunities from social + referrals
CREATE TABLE IF NOT EXISTS marketing_prospects (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES business_profiles(id),
  
  -- Source tracking
  source VARCHAR(50) NOT NULL,
  source_context JSONB NOT NULL,
  
  -- Status pipeline
  status VARCHAR(50) NOT NULL DEFAULT 'identified',
  stage VARCHAR(50) NOT NULL DEFAULT 'identified',
  
  -- Contact info
  name TEXT,
  phone TEXT,
  email TEXT,
  
  -- Location (enhanced for pre-qualification)
  location_raw_input TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  geocode_confidence DOUBLE PRECISION,
  
  -- Property classification
  property_type VARCHAR(20),
  
  -- Intent analysis
  detected_services TEXT[],
  requested_services TEXT[],
  urgency VARCHAR(20),
  confidence DOUBLE PRECISION NOT NULL,
  
  -- Pre-Qualification
  serviceability_status VARCHAR(30),
  serviceability_reasons TEXT[],
  matched_service_area_id TEXT,
  distance_from_service_area_miles DOUBLE PRECISION,
  serviceability_decided_at TIMESTAMP,
  
  -- Qualification tracking
  qualification_stage VARCHAR(30) DEFAULT 'unqualified',
  missing_fields TEXT[],
  last_question_asked TEXT,
  last_question_asked_at TIMESTAMP,
  
  -- Engagement tracking
  last_outreach_at TIMESTAMP,
  last_response_at TIMESTAMP,
  outreach_attempts INTEGER DEFAULT 0,
  
  -- Handoff tracking
  lead_id INTEGER,
  conversation_id INTEGER,
  converted_at TIMESTAMP,
  
  -- Outcome tracking
  close_outcome VARCHAR(20),
  close_reason TEXT,
  estimated_value_cents INTEGER,
  actual_revenue_cents INTEGER,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for marketing_prospects
CREATE INDEX IF NOT EXISTS marketing_prospects_business_id_idx ON marketing_prospects(business_id);
CREATE INDEX IF NOT EXISTS marketing_prospects_status_idx ON marketing_prospects(status);
CREATE INDEX IF NOT EXISTS marketing_prospects_stage_idx ON marketing_prospects(stage);
CREATE INDEX IF NOT EXISTS marketing_prospects_phone_idx ON marketing_prospects(phone);
CREATE INDEX IF NOT EXISTS marketing_prospects_serviceability_idx ON marketing_prospects(serviceability_status);
CREATE INDEX IF NOT EXISTS marketing_prospects_qualification_idx ON marketing_prospects(qualification_stage);

-- Outreach Attempts - every outbound touch
CREATE TABLE IF NOT EXISTS outreach_attempts (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER NOT NULL REFERENCES marketing_prospects(id),
  business_id INTEGER NOT NULL REFERENCES business_profiles(id),
  
  channel VARCHAR(20) NOT NULL,
  message_content TEXT NOT NULL,
  
  -- Delivery tracking
  status VARCHAR(50) NOT NULL,
  external_message_id TEXT,
  delivered_at TIMESTAMP,
  failure_reason TEXT,
  
  -- Cost tracking
  cost_cents INTEGER,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for outreach_attempts
CREATE INDEX IF NOT EXISTS outreach_attempts_prospect_id_idx ON outreach_attempts(prospect_id);
CREATE INDEX IF NOT EXISTS outreach_attempts_business_id_idx ON outreach_attempts(business_id);

-- Marketing Consent - opt-in/opt-out tracking
CREATE TABLE IF NOT EXISTS marketing_consent (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES business_profiles(id),
  
  -- Contact identifier
  contact_type VARCHAR(20) NOT NULL,
  contact_value TEXT NOT NULL,
  
  -- Consent status
  opted_in BOOLEAN NOT NULL DEFAULT true,
  opted_out_at TIMESTAMP,
  opted_out_reason TEXT,
  
  -- Channel preferences
  allow_sms BOOLEAN DEFAULT true,
  allow_email BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT marketing_consent_contact_unique UNIQUE (business_id, contact_type, contact_value)
);

-- Marketing Approvals - pending approvals for outreach
CREATE TABLE IF NOT EXISTS marketing_approvals (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER NOT NULL REFERENCES marketing_prospects(id),
  business_id INTEGER NOT NULL REFERENCES business_profiles(id),
  
  approval_type VARCHAR(50) NOT NULL,
  
  -- Proposal details
  proposed_message TEXT NOT NULL,
  proposed_channel VARCHAR(20) NOT NULL,
  context_data JSONB,
  confidence DOUBLE PRECISION NOT NULL,
  reasoning TEXT,
  
  -- Approval tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for marketing_approvals
CREATE INDEX IF NOT EXISTS marketing_approvals_business_status_idx ON marketing_approvals(business_id, status);
CREATE INDEX IF NOT EXISTS marketing_approvals_prospect_id_idx ON marketing_approvals(prospect_id);

-- Social Signals - raw social platform signals
CREATE TABLE IF NOT EXISTS social_signals (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES business_profiles(id),
  
  platform VARCHAR(50) NOT NULL,
  post_id TEXT NOT NULL,
  comment_id TEXT,
  
  -- Content
  author_handle TEXT NOT NULL,
  author_display_name TEXT,
  text TEXT NOT NULL,
  url TEXT,
  
  -- Location hints
  community_id TEXT,
  geo_hint JSONB,
  
  -- Processing
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_result VARCHAR(50),
  prospect_id INTEGER REFERENCES marketing_prospects(id),
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT social_signals_post_unique UNIQUE (platform, post_id, comment_id)
);

-- Indexes for social_signals
CREATE INDEX IF NOT EXISTS social_signals_business_processed_idx ON social_signals(business_id, processed);

-- Provider Service Areas Configuration
CREATE TABLE IF NOT EXISTS provider_service_areas (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES business_profiles(id),
  
  name TEXT NOT NULL,
  area_type VARCHAR(20) NOT NULL,
  
  -- Area definition (JSON based on type)
  polygon_coords JSONB,
  zip_codes TEXT[],
  radius_center JSONB,
  radius_miles DOUBLE PRECISION,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Provider Service Capabilities
CREATE TABLE IF NOT EXISTS provider_capabilities (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES business_profiles(id),
  
  -- Services offered (canonical list)
  services_offered TEXT[] NOT NULL,
  
  -- Property type support
  supports_residential BOOLEAN NOT NULL DEFAULT true,
  supports_commercial BOOLEAN NOT NULL DEFAULT false,
  
  -- Commercial constraints
  commercial_min_lot_size_sq_ft INTEGER,
  commercial_min_contract_months INTEGER,
  
  -- Seasonal availability
  winter_services TEXT[],
  spring_services TEXT[],
  summer_services TEXT[],
  fall_services TEXT[],
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT provider_capabilities_business_unique UNIQUE (business_id)
);

-- Canonical Services Mapping (for normalization)
CREATE TABLE IF NOT EXISTS canonical_services (
  id SERIAL PRIMARY KEY,
  service_key VARCHAR(50) NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  aliases TEXT[],
  category VARCHAR(30)
);

-- Seed canonical services
INSERT INTO canonical_services (service_key, display_name, aliases, category) VALUES
  ('mowing', 'Lawn Mowing', ARRAY['mow', 'cut grass', 'lawn cutting', 'grass cutting'], 'lawn_care'),
  ('edging', 'Edging', ARRAY['edge', 'trim edges', 'edge trimming'], 'lawn_care'),
  ('trimming', 'Trimming', ARRAY['trim', 'weed eating', 'weed whacking', 'string trimming'], 'lawn_care'),
  ('blowing', 'Blowing', ARRAY['blow', 'leaf blowing', 'debris removal'], 'lawn_care'),
  ('mulching', 'Mulching', ARRAY['mulch', 'mulch installation', 'mulch bed'], 'landscaping'),
  ('leaf_cleanup', 'Leaf Cleanup', ARRAY['leaves', 'fall cleanup', 'leaf removal'], 'seasonal'),
  ('aeration', 'Aeration', ARRAY['aerate', 'core aeration', 'lawn aeration'], 'lawn_care'),
  ('fertilization', 'Fertilization', ARRAY['fertilize', 'lawn fertilizer', 'feeding'], 'lawn_care'),
  ('weed_control', 'Weed Control', ARRAY['weeding', 'weed killer', 'herbicide'], 'lawn_care'),
  ('pest_control', 'Pest Control', ARRAY['pest management', 'insect control'], 'lawn_care'),
  ('irrigation', 'Irrigation', ARRAY['sprinkler', 'watering system', 'irrigation repair'], 'landscaping'),
  ('landscaping', 'Landscaping', ARRAY['landscape design', 'planting', 'garden'], 'landscaping'),
  ('hardscaping', 'Hardscaping', ARRAY['patio', 'walkway', 'retaining wall', 'stone work'], 'landscaping'),
  ('snow_removal', 'Snow Removal', ARRAY['snow', 'snow plowing', 'snow clearing'], 'winter'),
  ('ice_management', 'Ice Management', ARRAY['ice', 'salt', 'de-icing', 'ice melt'], 'winter')
ON CONFLICT (service_key) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE marketing_prospects IS 'Stores discovered prospects from social signals and referrals with pre-qualification data';
COMMENT ON TABLE provider_service_areas IS 'Defines serviceable geographic areas for pre-qualification checks';
COMMENT ON TABLE provider_capabilities IS 'Defines service offerings and property type support for pre-qualification';
COMMENT ON COLUMN marketing_prospects.serviceability_status IS 'Result of pre-qualification gate: serviceable, maybe_serviceable, or not_serviceable';
COMMENT ON COLUMN marketing_prospects.qualification_stage IS 'Tracks qualification progress: unqualified, needs_info, prequalified, or disqualified';
