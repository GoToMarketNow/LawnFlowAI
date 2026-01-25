-- ============================================
-- Weather Agent Database Tables
-- Migration 0020
-- ============================================

-- Weather forecast cache
CREATE TABLE IF NOT EXISTS weather_forecasts (
  id SERIAL PRIMARY KEY,
  geohash VARCHAR(12) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  forecast_data JSONB NOT NULL,
  alerts_data JSONB,
  fetched_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS weather_forecasts_geohash_idx ON weather_forecasts(geohash);
CREATE INDEX IF NOT EXISTS weather_forecasts_expires_idx ON weather_forecasts(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS weather_forecasts_geohash_provider_idx ON weather_forecasts(geohash, provider);

-- Weather risk assessments
CREATE TABLE IF NOT EXISTS weather_risk_assessments (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id),
  operator_id INTEGER NOT NULL,
  service_area_id INTEGER,
  risk_score INTEGER NOT NULL,
  risk_tier VARCHAR(10) NOT NULL,
  drivers JSONB NOT NULL,
  confidence REAL NOT NULL,
  forecast_version VARCHAR(100),
  job_start TIMESTAMP NOT NULL,
  job_end TIMESTAMP NOT NULL,
  assessed_at TIMESTAMP NOT NULL,
  superseded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS weather_risk_job_idx ON weather_risk_assessments(job_id);
CREATE INDEX IF NOT EXISTS weather_risk_operator_idx ON weather_risk_assessments(operator_id);
CREATE INDEX IF NOT EXISTS weather_risk_tier_idx ON weather_risk_assessments(risk_tier);
CREATE INDEX IF NOT EXISTS weather_risk_assessed_idx ON weather_risk_assessments(assessed_at);

-- Schedule change plans
CREATE TABLE IF NOT EXISTS weather_schedule_plans (
  id SERIAL PRIMARY KEY,
  plan_id VARCHAR(100) NOT NULL UNIQUE,
  operator_id INTEGER NOT NULL,
  service_area_id INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  change_set_data JSONB NOT NULL,
  weather_summary TEXT,
  impacted_job_count INTEGER NOT NULL DEFAULT 0,
  approved_by INTEGER,
  approved_at TIMESTAMP,
  applied_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS weather_plan_id_idx ON weather_schedule_plans(plan_id);
CREATE INDEX IF NOT EXISTS weather_plan_operator_idx ON weather_schedule_plans(operator_id);
CREATE INDEX IF NOT EXISTS weather_plan_status_idx ON weather_schedule_plans(status);

-- Winter events detected
CREATE TABLE IF NOT EXISTS winter_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(100) NOT NULL UNIQUE,
  operator_id INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,
  affected_geo_set JSONB NOT NULL,
  confidence REAL NOT NULL,
  drivers JSONB NOT NULL,
  source_alert_ids JSONB,
  detected_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS winter_event_id_idx ON winter_events(event_id);
CREATE INDEX IF NOT EXISTS winter_event_operator_idx ON winter_events(operator_id);
CREATE INDEX IF NOT EXISTS winter_event_window_idx ON winter_events(window_start, window_end);

-- Winter campaigns
CREATE TABLE IF NOT EXISTS winter_campaigns (
  id SERIAL PRIMARY KEY,
  campaign_id VARCHAR(100) NOT NULL UNIQUE,
  event_id VARCHAR(100) NOT NULL,
  operator_id INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  proposal_data JSONB NOT NULL,
  segment_size INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  approved_by INTEGER,
  approved_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS winter_campaign_id_idx ON winter_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS winter_campaign_event_idx ON winter_campaigns(event_id);
CREATE INDEX IF NOT EXISTS winter_campaign_operator_idx ON winter_campaigns(operator_id);
CREATE INDEX IF NOT EXISTS winter_campaign_status_idx ON winter_campaigns(status);

-- Campaign message sends
CREATE TABLE IF NOT EXISTS winter_campaign_messages (
  id SERIAL PRIMARY KEY,
  campaign_id VARCHAR(100) NOT NULL,
  customer_id INTEGER NOT NULL,
  channel VARCHAR(20) NOT NULL,
  template_id VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  responded_at TIMESTAMP,
  response VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS campaign_msg_campaign_idx ON winter_campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_msg_customer_idx ON winter_campaign_messages(customer_id);
CREATE INDEX IF NOT EXISTS campaign_msg_status_idx ON winter_campaign_messages(status);

-- Approval packets (unified for schedule changes and campaigns)
CREATE TABLE IF NOT EXISTS weather_approval_packets (
  id SERIAL PRIMARY KEY,
  packet_id VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL,
  operator_id INTEGER NOT NULL,
  service_area_id INTEGER,
  summary TEXT NOT NULL,
  proposals_data JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  workflow_id VARCHAR(200),
  approved_by INTEGER,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS approval_packet_id_idx ON weather_approval_packets(packet_id);
CREATE INDEX IF NOT EXISTS approval_packet_operator_idx ON weather_approval_packets(operator_id);
CREATE INDEX IF NOT EXISTS approval_packet_status_idx ON weather_approval_packets(status);
CREATE INDEX IF NOT EXISTS approval_packet_workflow_idx ON weather_approval_packets(workflow_id);

-- Weather monitoring runs (for observability)
CREATE TABLE IF NOT EXISTS weather_monitoring_runs (
  id SERIAL PRIMARY KEY,
  operator_id INTEGER NOT NULL,
  service_area_id INTEGER NOT NULL,
  run_type VARCHAR(50) NOT NULL,
  jobs_scanned INTEGER NOT NULL DEFAULT 0,
  high_risk_jobs INTEGER NOT NULL DEFAULT 0,
  plans_triggered INTEGER NOT NULL DEFAULT 0,
  winter_events_detected INTEGER NOT NULL DEFAULT 0,
  api_calls_made INTEGER NOT NULL DEFAULT 0,
  cache_hit_rate REAL,
  duration_ms INTEGER,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  error TEXT
);

CREATE INDEX IF NOT EXISTS monitoring_run_operator_idx ON weather_monitoring_runs(operator_id);
CREATE INDEX IF NOT EXISTS monitoring_run_started_idx ON weather_monitoring_runs(started_at);
