# LawnFlow Mobile Backend Implementation Plan (vNext)

**Sprint 0 Complete**: Repository discovery + Backend Integration Guide analysis
**Date**: 2026-01-09
**Database**: PostgreSQL with Drizzle ORM
**Framework**: Express.js
**Auth**: Session-based (existing) + JWT tokens (to be verified)

---

## Executive Summary

This document maps the [BACKEND_INTEGRATION_GUIDE.md](../mobile/BACKEND_INTEGRATION_GUIDE.md) requirements to the existing LawnFlow repository structure and provides a concrete implementation plan for all 15 mobile API endpoints plus agent integration.

### Repository Analysis Complete ✅

**Backend Framework**: Express.js
**Database**: PostgreSQL via Drizzle ORM (`drizzle-orm/node-postgres`)
**Schema Location**: `shared/schema.ts`
**Main Routes**: `server/routes.ts`
**Storage Layer**: `server/storage.ts` (Drizzle-based persistence)
**Auth System**: `server/auth-routes.ts` (2FA phone verification system)

---

## Key Discoveries from Repository

### 1. Database & ORM

**Connection**: PostgreSQL pool via `server/db.ts`
```typescript
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

**Schema System**: Drizzle ORM with TypeScript types exported from `@shared/schema`
- All tables defined in `shared/schema.ts`
- Includes: `jobs`, `users`, `crews`, `crew_members`, and 40+ other tables
- Uses proper TypeScript inference with `$inferSelect` and `$inferInsert`

### 2. Existing User & Crew Tables

**Already Exists** (from `shared/schema.ts`):
- ✅ `users` table with role: `owner`, `admin`, `crew_lead`, `staff`
- ✅ `crews` table with status (ACTIVE/INACTIVE)
- ✅ `crew_members` table with userId, role (LEADER/MEMBER), phoneE164
- ✅ `jobs` table with customerName, customerPhone, customerAddress, assignedCrewId

**Missing Fields** (need to add to jobs table):
- customer_notes
- access_instructions
- what_were_doing (JSONB)
- time_window
- lat/lng coordinates

### 3. Auth System

**Current Implementation**: Phone verification + session-based auth
- Routes: `server/auth-routes.ts`
- Tables: `users`, `phone_verifications`
- Session management exists

**Mobile Needs**: May need JWT tokens for mobile app
- Mobile guide doesn't specify auth mechanism
- Current system uses sessions; may need to extend for mobile JWT

### 4. Existing API Pattern

**Route Registration**: `server/routes.ts` with Express
```typescript
export async function registerRoutes(httpServer: Server, app: Express): Promise<Server>
```

**Response Pattern**: Direct JSON responses
```typescript
res.json({ success: true, data: ... })
```

**Error Handling**: Try-catch with error responses
```typescript
catch (error) {
  res.status(500).json({ error: error.message });
}
```

### 5. Orchestrator & Agent System

**Exists**: `server/orchestrator/` folder with lead-to-cash flows
- `handleInboundMessage()`, `handleOpsApproval()`, etc.
- Agent registry, decision logs, human action logs
- Event-driven architecture already in place

**Tables**:
- `orchestration_runs`
- `orchestration_steps`
- `agent_runs`
- `agent_registry`
- `human_action_logs`
- `decision_logs`

---

## Endpoint Mapping: Backend Guide → Repository Implementation

### Existing vs. New Endpoint Requirements

| # | Endpoint (from Guide) | Status | Implementation Location |
|---|-----------------------|--------|-------------------------|
| 1 | `GET /api/mobile/dashboard/today` | **NEW** | `server/routes.ts` (mobile section) |
| 2 | `GET /api/mobile/jobs?filter=...` | **NEW** | `server/routes.ts` (mobile section) |
| 3 | `GET /api/mobile/jobs/:jobId` | **EXTEND** | Extend existing `/api/jobs/:id` |
| 4 | `PATCH /api/mobile/jobs/:jobId/status` | **NEW** | `server/routes.ts` (mobile section) |
| 5 | `PATCH /api/mobile/crew/status` | **NEW** | `server/routes.ts` (mobile section) |
| 6 | `GET /api/mobile/crew/me` | **NEW** | `server/routes.ts` (mobile section) |
| 7 | `GET /api/mobile/schedule/today` | **NEW** | `server/routes.ts` (mobile section) |
| 8 | `POST /api/mobile/schedule/today/accept` | **NEW** | `server/routes.ts` (mobile section) |
| 9 | `POST /api/mobile/schedule/today/request-changes` | **NEW** | `server/routes.ts` (mobile section) |
| 10 | `POST /api/mobile/work-requests` | **NEW** | `server/routes.ts` (mobile section) |
| 11 | `GET /api/admin/work-requests` | **NEW** | `server/routes.ts` (admin section) |
| 12 | `GET /api/mobile/payroll/preferences` | **NEW** | `server/routes.ts` (mobile section) |
| 13 | `PUT /api/mobile/payroll/preferences` | **NEW** | `server/routes.ts` (mobile section) |
| 14 | `GET /api/mobile/notifications?since=...` | **NEW** | `server/routes.ts` (mobile section) |
| 15 | `POST /api/mobile/notifications/:id/read` | **NEW** | `server/routes.ts` (mobile section) |

**Note**: Guide doesn't specify messaging endpoints (threads, send). Need to check if required based on prompt requirements.

---

## Polling & Real-Time Requirements

### From Unified Prompt

**Required**: Polling-first approach with `since` parameter
- All list endpoints support `?since=<iso>` for incremental updates
- Responses include `serverTime` and `updatedAt`
- No SSE/WebSockets unless already cleanly implemented

**Implementation Strategy**:
1. Add `updatedAt` timestamps to all mobile-relevant tables
2. Queries filter by `updatedAt > since` when `since` parameter provided
3. Response wrapper includes `{ data, serverTime: new Date().toISOString() }`

---

## Database Schema Changes Required

### New Tables to Create (from Guide)

```sql
-- 1. Crew Status Updates
CREATE TABLE crew_status_updates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  crew_status TEXT NOT NULL CHECK (crew_status IN ('ON_SITE', 'EN_ROUTE', 'ON_BREAK')),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_crew_status_user ON crew_status_updates(user_id);
CREATE INDEX idx_crew_status_updated_at ON crew_status_updates(updated_at DESC);

-- 2. Daily Schedule Acceptances
CREATE TABLE daily_schedule_acceptances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  date DATE NOT NULL,
  accepted_at TIMESTAMP,
  request_changes_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);
CREATE INDEX idx_schedule_acceptance_user_date ON daily_schedule_acceptances(user_id, date);

-- 3. Work Requests
CREATE TABLE work_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  timeframe TEXT NOT NULL CHECK (timeframe IN ('today', 'this_week')),
  note TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'declined')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_work_requests_status ON work_requests(status) WHERE status = 'pending';
CREATE INDEX idx_work_requests_user ON work_requests(user_id);

-- 4. Payroll Preferences
CREATE TABLE payroll_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
  pay_frequency TEXT NOT NULL CHECK (pay_frequency IN ('per_job', 'daily', 'weekly', 'scheduled')),
  pay_methods JSONB NOT NULL,
  preferred_method TEXT NOT NULL,
  payout_details JSONB, -- Encrypt in application layer
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_payroll_user ON payroll_preferences(user_id);

-- 5. Event Outbox (for agent integration)
CREATE TABLE event_outbox (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES business_profiles(id),
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_event_outbox_topic ON event_outbox(topic);
CREATE INDEX idx_event_outbox_processed ON event_outbox(processed_at) WHERE processed_at IS NULL;
CREATE INDEX idx_event_outbox_updated_at ON event_outbox(updated_at DESC);
```

### Extend Existing Jobs Table

```sql
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS customer_notes TEXT,
  ADD COLUMN IF NOT EXISTS access_instructions TEXT,
  ADD COLUMN IF NOT EXISTS what_were_doing JSONB,
  ADD COLUMN IF NOT EXISTS time_window TEXT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update status constraint to include new mobile statuses
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN (
    'pending', 'scheduled', 'in_progress', 'completed', 'cancelled',
    'PENDING', 'IN_PROGRESS', 'COMPLETE', 'DELAYED', 'RESCHEDULED'
  ));
```

### Add updatedAt to Existing Tables

```sql
-- Add updated_at to notifications (if not exists)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add updated_at to crews (if not exists)
ALTER TABLE crews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add updated_at to crew_members (if not exists)
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

---

## Permissions Model Implementation

### Role Hierarchy

```typescript
enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  CREW_LEADER = 'crew_leader', // Note: schema uses 'crew_lead'
  CREW_MEMBER = 'crew_member',  // Note: schema uses 'staff'
  OPERATOR = 'operator',
  OPS = 'ops'
}

// Mapping: mobile expects crew_leader/crew_member
// Schema has: crew_lead/staff
// Need normalization layer
```

### Permission Checks (Middleware Pattern)

```typescript
// Location: server/middleware/mobileAuth.ts
export function requireMobileAuth(req, res, next) {
  // Check session or JWT token
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

export function requireCrewMembership(req, res, next) {
  // Verify user belongs to a crew
  if (!req.user.crewId) {
    return res.status(403).json({ error: 'Not assigned to a crew' });
  }
  next();
}
```

### Resource-Level Authorization

```typescript
// Location: server/services/authorization.ts
export function canAccessJob(user: User, job: Job): boolean {
  if (user.role === 'owner' || user.role === 'admin') return true;
  if (user.role === 'crew_leader' || user.role === 'crew_member') {
    return job.assignedCrewId === user.crewId;
  }
  return false;
}

export function canUpdateJobStatus(user: User, job: Job): boolean {
  if (user.role === 'owner' || user.role === 'admin') return true;
  if (user.role === 'crew_leader' || user.role === 'crew_member') {
    return job.assignedCrewId === user.crewId;
  }
  return false;
}
```

---

## File Structure for Implementation

### New Files to Create

```
server/
├── routes-mobile.ts                    # All 15 mobile endpoints
├── middleware/
│   └── mobileAuth.ts                   # Auth & permissions middleware
├── services/
│   ├── mobile/
│   │   ├── dashboard.ts                # Dashboard logic
│   │   ├── jobs.ts                     # Jobs queries & updates
│   │   ├── crew.ts                     # Crew status & info
│   │   ├── schedule.ts                 # Schedule acceptance
│   │   ├── workRequests.ts             # Work request handling
│   │   ├── payroll.ts                  # Payroll preferences
│   │   └── notifications.ts            # Notification queries
│   └── authorization.ts                # Permission helpers
├── agents/
│   └── mobileEventHandlers.ts          # Agent event handlers for mobile events
└── migrations/
    └── 0001_mobile_tables.sql          # Database migration
```

### Modified Files

```
server/
├── routes.ts                           # Register mobile routes
└── db.ts                               # No changes needed

shared/
└── schema.ts                           # Add new table definitions
```

---

## Implementation Priority (Sprint Breakdown)

### Sprint 1: Schema & Persistence (Week 1)
**Goal**: Add all database tables and migrations

1. **Add to `shared/schema.ts`**:
   - `crewStatusUpdates` table
   - `dailyScheduleAcceptances` table
   - `workRequests` table
   - `payrollPreferences` table
   - `eventOutbox` table
   - Extend `jobs` table with new columns

2. **Create migration**: `server/migrations/0001_mobile_tables.sql`

3. **Add updatedAt fields** to existing tables

**Acceptance**: All tables created, drizzle types available

---

### Sprint 2: Read-Only Endpoints (Week 1-2)
**Goal**: Implement GET endpoints with polling support

**Endpoints to implement**:
1. `GET /api/mobile/dashboard/today?since=...`
2. `GET /api/mobile/jobs?filter=...&since=...`
3. `GET /api/mobile/jobs/:jobId`
4. `GET /api/mobile/crew/me`
5. `GET /api/mobile/schedule/today`
6. `GET /api/mobile/work-requests/mine` (added to match prompt)
7. `GET /api/mobile/payroll/preferences`
8. `GET /api/mobile/notifications?since=...`

**File**: `server/routes-mobile.ts`

**Pattern**:
```typescript
app.get('/api/mobile/dashboard/today', requireMobileAuth, async (req, res) => {
  try {
    const { since } = req.query;
    const userId = req.user.id;

    const data = await getDashboardToday(userId, since);

    res.json({
      ...data,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Acceptance**: Mobile app can poll and receive data

---

### Sprint 3: Mutation Endpoints + Outbox Events (Week 2)
**Goal**: Implement POST/PATCH endpoints with event outbox

**Endpoints**:
1. `PATCH /api/mobile/jobs/:jobId/status`
2. `PATCH /api/mobile/crew/status`
3. `POST /api/mobile/schedule/today/accept`
4. `POST /api/mobile/schedule/today/request-changes`
5. `POST /api/mobile/work-requests`
6. `PUT /api/mobile/payroll/preferences`
7. `POST /api/mobile/notifications/:id/read`

**Event Outbox Topics** (emit on each mutation):
- `mobile.job.status_changed`
- `mobile.crew.status_changed`
- `mobile.schedule.accepted`
- `mobile.schedule.change_requested`
- `mobile.work_request.created`
- `mobile.payroll.updated`
- `mobile.notification.read`

**Pattern**:
```typescript
app.patch('/api/mobile/jobs/:jobId/status', requireMobileAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, reason } = req.body;
    const userId = req.user.id;

    // Validate permissions
    const job = await getJob(jobId);
    if (!canUpdateJobStatus(req.user, job)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Update job
    const updatedJob = await updateJobStatus(jobId, status, reason, userId);

    // Write to event outbox
    await writeOutboxEvent({
      businessId: req.user.businessId,
      topic: 'mobile.job.status_changed',
      payload: { jobId, status, reason, userId }
    });

    res.json({ success: true, job: updatedJob });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Acceptance**: Mobile mutations work, events appear in outbox

---

### Sprint 4: Agent Integration (Week 3)
**Goal**: Agent plane can pull events and apply actions

**Internal Endpoints**:
1. `POST /api/internal/events/pull`
   - Returns unprocessed events from outbox
   - Agent provides last seen event ID or timestamp

2. `POST /api/internal/events/:id/ack`
   - Marks event as processed

3. `POST /api/internal/agent-actions/apply`
   - Receives agent actions
   - Updates database state
   - Actions appear in next mobile poll

**Action Types to Support**:
- `DAILY_SCHEDULE_READY`: Create notification + set acceptance state
- `DISPATCH_ASSIGNMENT_CREATED`: Create job assignment + notification
- `MESSAGE_SENT`: Insert message into thread
- `JOB_STATUS_SET`: Update job status (agent-driven)
- `CREW_MEMBERSHIP_UPDATED`: Update crew roster
- `WORK_REQUEST_ASSIGNED`: Update work request status + notify user

**File**: `server/agents/mobileEventHandlers.ts`

**Acceptance**: Agent can read mobile events and update state

---

### Sprint 5: Messaging Endpoints (Week 3-4)
**Note**: Guide doesn't specify messaging, but prompt mentions it

**If Required** (pending prompt clarification):
1. `GET /api/mobile/messages/threads?since=...`
2. `GET /api/mobile/messages/threads/:threadId?since=...`
3. `POST /api/mobile/messages/threads/:threadId/send`

**Use existing schema**:
- Check if `conversations` and `messages` tables work
- Or use crew comms tables: `comms_threads`, `comms_messages`

**Acceptance**: Crew can message (if required)

---

## Polling Implementation Details

### Since Parameter Pattern

```typescript
interface PollableQuery {
  since?: string; // ISO timestamp
}

interface PollableResponse<T> {
  data: T;
  serverTime: string;
  hasMore?: boolean;
}

// Implementation
async function getJobsSince(userId: number, since?: string): Promise<Job[]> {
  const query = db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.assignedCrewId, userCrewId),
        since ? gte(jobs.updatedAt, new Date(since)) : undefined
      )
    );

  return await query;
}
```

### UpdatedAt Triggers (PostgreSQL)

```sql
-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all relevant tables
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Repeat for: crew_status_updates, daily_schedule_acceptances, work_requests, etc.
```

---

## Security Implementation

### Encryption for Payroll Data

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.PAYROLL_ENCRYPTION_KEY; // 32 bytes
const ALGORITHM = 'aes-256-gcm';

export function encryptPayoutDetails(details: any): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(JSON.stringify(details), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted,
    tag: authTag.toString('hex')
  });
}

export function decryptPayoutDetails(encrypted: string): any {
  const { iv, data, tag } = JSON.parse(encrypted);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

// Mask account numbers
export function maskAccountNumber(account: string): string {
  if (!account || account.length < 4) return '****';
  return '*'.repeat(account.length - 4) + account.slice(-4);
}
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

export const workRequestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // 5 requests per day
  message: 'Too many work requests. Please try again tomorrow.'
});

export const statusUpdateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour
  message: 'Too many status updates. Please slow down.'
});

// Apply to routes
app.post('/api/mobile/work-requests', requireMobileAuth, workRequestLimiter, ...);
app.patch('/api/mobile/crew/status', requireMobileAuth, statusUpdateLimiter, ...);
```

---

## Testing Strategy

### Unit Tests

```typescript
// server/__tests__/mobile/dashboard.test.ts
describe('GET /api/mobile/dashboard/today', () => {
  it('returns dashboard data for crew member', async () => {
    const response = await request(app)
      .get('/api/mobile/dashboard/today')
      .set('Authorization', `Bearer ${crewMemberToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('jobsToday');
    expect(response.body).toHaveProperty('serverTime');
  });

  it('filters jobs by crew assignment', async () => {
    const response = await request(app)
      .get('/api/mobile/dashboard/today')
      .set('Authorization', `Bearer ${crewMemberToken}`);

    const jobs = response.body.jobsToday;
    expect(jobs.every(j => j.assignedCrewId === crewMember.crewId)).toBe(true);
  });
});
```

### Integration Tests

```typescript
// Test full flow: accept schedule → event emitted → agent processes
describe('Schedule Acceptance Flow', () => {
  it('creates outbox event when schedule accepted', async () => {
    await request(app)
      .post('/api/mobile/schedule/today/accept')
      .set('Authorization', `Bearer ${token}`)
      .send({ accepted: true });

    const events = await db.select().from(eventOutbox)
      .where(eq(eventOutbox.topic, 'mobile.schedule.accepted'));

    expect(events.length).toBeGreaterThan(0);
  });
});
```

---

## Deployment Checklist

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
PAYROLL_ENCRYPTION_KEY=<32-byte-hex-string>

# Optional
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=100
```

### Database Migration

```bash
# Run migration
psql $DATABASE_URL < server/migrations/0001_mobile_tables.sql

# Verify tables
psql $DATABASE_URL -c "\dt crew_status_updates"
psql $DATABASE_URL -c "\dt daily_schedule_acceptances"
psql $DATABASE_URL -c "\dt work_requests"
psql $DATABASE_URL -c "\dt payroll_preferences"
psql $DATABASE_URL -c "\dt event_outbox"
```

### Server Start

```bash
npm run dev  # Development
npm run build && npm start  # Production
```

---

## API Endpoint Summary Table

| Endpoint | Method | Auth | Role | Description |
|----------|--------|------|------|-------------|
| `/api/mobile/dashboard/today` | GET | ✅ | All | Dashboard with jobs, notifications, crew snapshot |
| `/api/mobile/jobs` | GET | ✅ | All | Filtered job list (today/upcoming/completed) |
| `/api/mobile/jobs/:id` | GET | ✅ | All | Job detail with execution info |
| `/api/mobile/jobs/:id/status` | PATCH | ✅ | Crew | Update job status |
| `/api/mobile/crew/status` | PATCH | ✅ | Crew | Update crew presence status |
| `/api/mobile/crew/me` | GET | ✅ | Crew | Get crew info & members |
| `/api/mobile/schedule/today` | GET | ✅ | Crew | Today's schedule + acceptance state |
| `/api/mobile/schedule/today/accept` | POST | ✅ | Crew | Accept daily schedule |
| `/api/mobile/schedule/today/request-changes` | POST | ✅ | Crew | Request schedule changes |
| `/api/mobile/work-requests` | POST | ✅ | Crew | Submit work request |
| `/api/mobile/work-requests/mine` | GET | ✅ | Crew | Get my work requests |
| `/api/admin/work-requests` | GET | ✅ | Owner/Admin | View all work requests |
| `/api/mobile/payroll/preferences` | GET | ✅ | Crew | Get payroll preferences |
| `/api/mobile/payroll/preferences` | PUT | ✅ | Crew | Update payroll preferences |
| `/api/mobile/notifications` | GET | ✅ | All | Get notifications (with since) |
| `/api/mobile/notifications/:id/read` | POST | ✅ | All | Mark notification as read |
| `/api/internal/events/pull` | POST | 🔒 | Internal | Agent pulls events from outbox |
| `/api/internal/events/:id/ack` | POST | 🔒 | Internal | Agent acks processed event |
| `/api/internal/agent-actions/apply` | POST | 🔒 | Internal | Agent applies actions |

---

## Next Steps

1. ✅ Sprint 0 complete - Repository discovered, guide analyzed
2. ⏳ Sprint 1 - Add database tables to `shared/schema.ts`
3. ⏳ Sprint 2 - Implement read-only endpoints
4. ⏳ Sprint 3 - Implement mutations + event outbox
5. ⏳ Sprint 4 - Agent integration
6. ⏳ Sprint 5 - Messaging (if required)

---

## Questions for Clarification

1. **Messaging Endpoints**: Prompt mentions messaging threads but guide doesn't specify. Should we implement or defer?

2. **Auth Tokens**: Current system uses sessions. Do we need JWT for mobile or extend session-based auth?

3. **Notifications Table**: Does `notifications` table in schema map to mobile notifications or is it separate?

4. **Role Mapping**: Schema has `crew_lead`/`staff`, mobile expects `crew_leader`/`crew_member`. Normalize or update schema?

---

**Document Status**: Sprint 0 Complete ✅
**Ready for**: Sprint 1 implementation
**Last Updated**: 2026-01-09
