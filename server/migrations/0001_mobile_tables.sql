-- ============================================
-- Mobile Crew App Database Migration
-- ============================================
-- Created: 2026-01-09
-- Purpose: Add tables and columns for mobile crew app
--
-- This migration adds:
-- 1. Mobile-specific fields to existing jobs table
-- 2. Six new tables for mobile crew features
-- 3. Necessary indexes for polling performance

-- ============================================
-- Step 1: Create job_crew_assignments table
-- ============================================

CREATE TABLE IF NOT EXISTS job_crew_assignments (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  crew_id INTEGER NOT NULL REFERENCES crews(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  assigned_by INTEGER REFERENCES users(id),
  CONSTRAINT unique_job_crew UNIQUE (job_id, crew_id)
);

CREATE INDEX IF NOT EXISTS job_crew_assign_job_idx ON job_crew_assignments(job_id);
CREATE INDEX IF NOT EXISTS job_crew_assign_crew_idx ON job_crew_assignments(crew_id);

COMMENT ON TABLE job_crew_assignments IS 'Maps jobs to assigned crews';

-- ============================================
-- Step 2: Extend jobs table with mobile fields
-- ============================================

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS customer_notes TEXT,
  ADD COLUMN IF NOT EXISTS access_instructions TEXT,
  ADD COLUMN IF NOT EXISTS what_were_doing TEXT,
  ADD COLUMN IF NOT EXISTS time_window TEXT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL;

-- Update existing rows to have updated_at set
UPDATE jobs SET updated_at = created_at WHERE updated_at IS NULL;

COMMENT ON COLUMN jobs.customer_notes IS 'Customer-provided notes for crew';
COMMENT ON COLUMN jobs.access_instructions IS 'Gate codes, parking instructions, etc.';
COMMENT ON COLUMN jobs.what_were_doing IS 'Job description/instructions for crew';
COMMENT ON COLUMN jobs.time_window IS 'Time window for job (e.g., "9AM-12PM")';
COMMENT ON COLUMN jobs.lat IS 'Property latitude for navigation';
COMMENT ON COLUMN jobs.lng IS 'Property longitude for navigation';

-- ============================================
-- Step 2: Add updated_at to existing tables for polling
-- ============================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL;

ALTER TABLE crews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL;

-- Update existing rows
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE crews SET updated_at = created_at WHERE updated_at IS NULL;

-- ============================================
-- Step 3: Create crew_status_updates table
-- ============================================

CREATE TABLE IF NOT EXISTS crew_status_updates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  crew_id INTEGER NOT NULL REFERENCES crews(id),
  status TEXT NOT NULL CHECK (status IN ('ON_SITE', 'EN_ROUTE', 'ON_BREAK')),
  job_id INTEGER REFERENCES jobs(id),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS crew_status_user_idx ON crew_status_updates(user_id);
CREATE INDEX IF NOT EXISTS crew_status_crew_idx ON crew_status_updates(crew_id);
CREATE INDEX IF NOT EXISTS crew_status_job_idx ON crew_status_updates(job_id);
CREATE INDEX IF NOT EXISTS crew_status_created_idx ON crew_status_updates(created_at);

COMMENT ON TABLE crew_status_updates IS 'Tracks crew member location and work state throughout the day';
COMMENT ON COLUMN crew_status_updates.status IS 'Current crew status: ON_SITE (at job), EN_ROUTE (traveling), ON_BREAK';

-- ============================================
-- Step 4: Create daily_schedule_acceptances table
-- ============================================

CREATE TABLE IF NOT EXISTS daily_schedule_acceptances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL, -- YYYY-MM-DD format
  accepted BOOLEAN NOT NULL,
  accepted_at TIMESTAMP,
  requested_changes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

CREATE UNIQUE INDEX IF NOT EXISTS schedule_acceptance_user_date_idx ON daily_schedule_acceptances(user_id, date);
CREATE INDEX IF NOT EXISTS schedule_acceptance_date_idx ON daily_schedule_acceptances(date);

COMMENT ON TABLE daily_schedule_acceptances IS 'Tracks crew acknowledgment of daily schedules';
COMMENT ON COLUMN daily_schedule_acceptances.requested_changes IS 'Freeform text if crew requests schedule changes';

-- ============================================
-- Step 5: Create work_requests table
-- ============================================

CREATE TABLE IF NOT EXISTS work_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  crew_id INTEGER REFERENCES crews(id),
  timeframe TEXT NOT NULL CHECK (timeframe IN ('today', 'this_week')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'assigned')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS work_request_user_idx ON work_requests(user_id);
CREATE INDEX IF NOT EXISTS work_request_crew_idx ON work_requests(crew_id);
CREATE INDEX IF NOT EXISTS work_request_status_idx ON work_requests(status);
CREATE INDEX IF NOT EXISTS work_request_created_idx ON work_requests(created_at);

COMMENT ON TABLE work_requests IS 'Crew requests for additional work assignments';
COMMENT ON COLUMN work_requests.timeframe IS 'When crew is available: today or this_week';
COMMENT ON COLUMN work_requests.note IS 'Crew availability details and preferences';

-- ============================================
-- Step 6: Create payroll_preferences table
-- ============================================

CREATE TABLE IF NOT EXISTS payroll_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  pay_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (pay_frequency IN ('per_job', 'daily', 'weekly', 'scheduled')),
  pay_methods TEXT[] NOT NULL,
  preferred_method TEXT NOT NULL,
  payout_details_encrypted TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS payroll_pref_user_idx ON payroll_preferences(user_id);

COMMENT ON TABLE payroll_preferences IS 'Crew payment configuration and encrypted payout details';
COMMENT ON COLUMN payroll_preferences.pay_methods IS 'Array of accepted payment methods: cash, zelle, cashapp, ach';
COMMENT ON COLUMN payroll_preferences.payout_details_encrypted IS 'Encrypted JSON with method-specific payout information';

-- ============================================
-- Step 7: Create event_outbox table
-- ============================================

CREATE TABLE IF NOT EXISTS event_outbox (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMP,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS event_outbox_processed_idx ON event_outbox(processed);
CREATE INDEX IF NOT EXISTS event_outbox_type_idx ON event_outbox(event_type);
CREATE INDEX IF NOT EXISTS event_outbox_created_idx ON event_outbox(created_at);
CREATE INDEX IF NOT EXISTS event_outbox_entity_idx ON event_outbox(entity_type, entity_id);

COMMENT ON TABLE event_outbox IS 'Agent integration event queue for mobile crew actions';
COMMENT ON COLUMN event_outbox.event_type IS 'Event type: job_status_changed, crew_status_changed, work_request_submitted, etc.';
COMMENT ON COLUMN event_outbox.payload IS 'Full event data as JSON';
COMMENT ON COLUMN event_outbox.processed IS 'Whether event has been pulled by agent system';
COMMENT ON COLUMN event_outbox.acknowledged_by IS 'Agent ID that acknowledged the event';

-- ============================================
-- Step 8: Create trigger for updated_at timestamps
-- ============================================

-- Function to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to tables with updated_at
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_crews_updated_at ON crews;
CREATE TRIGGER update_crews_updated_at BEFORE UPDATE ON crews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedule_acceptances_updated_at ON daily_schedule_acceptances;
CREATE TRIGGER update_schedule_acceptances_updated_at BEFORE UPDATE ON daily_schedule_acceptances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_requests_updated_at ON work_requests;
CREATE TRIGGER update_work_requests_updated_at BEFORE UPDATE ON work_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payroll_preferences_updated_at ON payroll_preferences;
CREATE TRIGGER update_payroll_preferences_updated_at BEFORE UPDATE ON payroll_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Migration Complete
-- ============================================

-- Verify table creation
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'job_crew_assignments',
      'crew_status_updates',
      'daily_schedule_acceptances',
      'work_requests',
      'payroll_preferences',
      'event_outbox'
    );

  IF table_count = 6 THEN
    RAISE NOTICE 'Migration 0001_mobile_tables.sql completed successfully. All 6 mobile tables created.';
  ELSE
    RAISE EXCEPTION 'Migration incomplete: Expected 6 tables, found %', table_count;
  END IF;
END $$;
