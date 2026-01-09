# Backend Integration Guide - Crew Mobile App

**For**: Backend engineers implementing mobile API endpoints
**Mobile Implementation**: Complete and ready for integration
**Reference**: See [CREW_MOBILE_IMPLEMENTATION_COMPLETE.md](../../CREW_MOBILE_IMPLEMENTATION_COMPLETE.md)

---

## Quick Start

The mobile app is ready and expects these 15 new API endpoints. Implement them in priority order:

### Priority 1: Core Job Flow (Week 1)

#### 1. Dashboard Today
```typescript
GET /api/mobile/dashboard/today

Response: {
  jobsToday: Job[],
  notifications: Notification[],
  crewSnapshot?: {
    crewName: string,
    memberCount: number
  },
  acceptanceState?: {
    accepted: boolean,
    acceptedAt?: string,
    requestedChanges?: boolean,
    requestChangesNote?: string
  },
  stats?: {
    jobsScheduled: number,
    jobsInProgress: number,
    jobsCompleted: number,
    unassignedJobs: number,
    crewsAvailable: number,
    crewsOnJob: number,
    escalations: number
  }
}
```

**Business Logic**:
- Filter jobs by user's crew assignment
- Return today's date range (00:00 to 23:59)
- Include acceptance state for current user + date
- Crew members see only job-scoped data

---

#### 2. Jobs List with Filters
```typescript
GET /api/mobile/jobs?filter=today|upcoming|completed

Response: Job[]
```

**Business Logic**:
- `today`: jobs where scheduledDate = today
- `upcoming`: jobs where scheduledDate > today
- `completed`: jobs where status = COMPLETE
- Apply crew assignment filter

---

#### 3. Job Detail (Extended)
```typescript
GET /api/mobile/jobs/:jobId

Response: {
  id: number,
  customerName: string,
  customerPhone?: string,
  address: string,
  coords?: { lat: number, lng: number },
  serviceType: string,
  status: JobStatus,
  customerNotes?: string,
  accessInstructions?: string,
  whatWereDoing?: TaskItem[],
  timeWindow?: string,
  scheduledStartISO: string,
  ...
}
```

**New Fields to Add**:
- `customerNotes`: text
- `accessInstructions`: text
- `whatWereDoing`: JSONB array of `{ id, description }`
- `timeWindow`: text (e.g., "8am-10am")
- `coords.lat`, `coords.lng`: doubles

---

#### 4. Update Job Status
```typescript
PATCH /api/mobile/jobs/:jobId/status

Request: {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'DELAYED' | 'RESCHEDULED',
  reason?: string
}

Response: { success: true, job: Job }
```

**Business Logic**:
- Validate status transitions (e.g., can't go from COMPLETE back to PENDING)
- Crew members can only update jobs assigned to their crew
- Log status change in audit trail
- Trigger notifications on DELAYED/RESCHEDULED

---

### Priority 2: Crew Management (Week 2)

#### 5. Crew Status Update
```typescript
PATCH /api/mobile/crew/status

Request: {
  crewStatus: 'ON_SITE' | 'EN_ROUTE' | 'ON_BREAK'
}

Response: { success: true, crewStatus, updatedAt }
```

**Business Logic**:
- Store in `crew_status_updates` table
- Update user's current status
- Broadcast to crew leader (optional real-time update)

---

#### 6. Get Crew Info
```typescript
GET /api/mobile/crew/me

Response: {
  crewId: number,
  name: string,
  members: [{
    id: number,
    name: string,
    phoneE164?: string,
    role: 'LEADER' | 'MEMBER',
    isActive: boolean
  }]
}
```

**Business Logic**:
- Return crew that user belongs to
- Include active members only
- Mask phone numbers if privacy settings require

---

### Priority 3: Schedule Acceptance (Week 2)

#### 7. Get Today's Schedule
```typescript
GET /api/mobile/schedule/today

Response: {
  jobs: Job[],
  acceptanceState: {
    accepted: boolean,
    acceptedAt?: string,
    requestedChanges?: boolean,
    requestChangesNote?: string
  }
}
```

**Business Logic**:
- Return jobs for user's crew where scheduledDate = today
- Check `daily_schedule_acceptances` table for acceptance state

---

#### 8. Accept Daily Schedule
```typescript
POST /api/mobile/schedule/today/accept

Request: { accepted: true }

Response: { success: true, acceptedAt: string }
```

**Business Logic**:
- Insert/update `daily_schedule_acceptances` record
- Set `accepted_at` timestamp
- Notify dispatch of acceptance

---

#### 9. Request Schedule Changes
```typescript
POST /api/mobile/schedule/today/request-changes

Request: { note: string }

Response: { success: true, requestId: number }
```

**Business Logic**:
- Insert `daily_schedule_acceptances` with `request_changes_note`
- Create notification for dispatch/owner
- Return request ID for tracking

---

### Priority 4: Work Requests & Payroll (Week 3)

#### 10. Submit Work Request
```typescript
POST /api/mobile/work-requests

Request: {
  timeframe: 'today' | 'this_week',
  note?: string
}

Response: { success: true, requestId: number }
```

**Business Logic**:
- Insert into `work_requests` table
- Notify dispatch/owner
- Return request ID

---

#### 11. Get Work Requests (Owner/Ops)
```typescript
GET /api/admin/work-requests

Response: [{
  id: number,
  userId: number,
  userName: string,
  timeframe: string,
  note?: string,
  status: 'pending' | 'assigned' | 'declined',
  createdAt: string
}]
```

**Business Logic**:
- Only accessible to owner/ops roles
- Return all pending requests
- Include user name for display

---

#### 12. Get Payroll Preferences
```typescript
GET /api/mobile/payroll/preferences

Response: {
  payFrequency: 'per_job' | 'daily' | 'weekly' | 'scheduled',
  payMethods: ('cash' | 'zelle' | 'cashapp' | 'ach')[],
  preferredMethod: 'cash' | 'zelle' | 'cashapp' | 'ach',
  payoutDetails: {
    zelle?: string,
    cashapp?: string,
    ach?: {
      routing: string,
      account: string (masked),
      accountType: 'checking' | 'savings'
    }
  },
  lastPayout?: { amount: number, date: string },
  nextPayout?: { amount: number, date: string }
}
```

**Business Logic**:
- Return user's payroll preferences
- Mask sensitive data (show last 4 digits of account number)
- Calculate last/next payout if payroll system integrated

---

#### 13. Update Payroll Preferences
```typescript
PUT /api/mobile/payroll/preferences

Request: {
  payFrequency: string,
  payMethods: string[],
  preferredMethod: string,
  payoutDetails: {
    zelle?: string,
    cashapp?: string,
    ach?: {
      routing: string,
      account: string,
      accountType: string
    }
  }
}

Response: { success: true, preferences: PayrollPreferences }
```

**Business Logic**:
- Validate required fields based on selected pay methods
- **Encrypt sensitive data** (ACH routing/account)
- Store in `payroll_preferences` table
- Update `updated_at` timestamp

---

## Database Migrations

### Step 1: Create New Tables

```sql
-- Crew Status Updates
CREATE TABLE crew_status_updates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  crew_status TEXT NOT NULL CHECK (crew_status IN ('ON_SITE', 'EN_ROUTE', 'ON_BREAK')),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_crew_status_user ON crew_status_updates(user_id);
CREATE INDEX idx_crew_status_updated_at ON crew_status_updates(updated_at DESC);

-- Daily Schedule Acceptances
CREATE TABLE daily_schedule_acceptances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  date DATE NOT NULL,
  accepted_at TIMESTAMP,
  request_changes_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

CREATE INDEX idx_schedule_acceptance_user_date ON daily_schedule_acceptances(user_id, date);

-- Work Requests
CREATE TABLE work_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) NOT NULL,
  timeframe TEXT NOT NULL CHECK (timeframe IN ('today', 'this_week')),
  note TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'declined')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_work_requests_status ON work_requests(status) WHERE status = 'pending';
CREATE INDEX idx_work_requests_user ON work_requests(user_id);

-- Payroll Preferences
CREATE TABLE payroll_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
  pay_frequency TEXT NOT NULL CHECK (pay_frequency IN ('per_job', 'daily', 'weekly', 'scheduled')),
  pay_methods JSONB NOT NULL,
  preferred_method TEXT NOT NULL,
  payout_details JSONB, -- Encrypt this in application layer
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payroll_user ON payroll_preferences(user_id);
```

### Step 2: Extend Jobs Table

```sql
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS customer_notes TEXT,
  ADD COLUMN IF NOT EXISTS access_instructions TEXT,
  ADD COLUMN IF NOT EXISTS what_were_doing JSONB,
  ADD COLUMN IF NOT EXISTS time_window TEXT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Update status enum (method depends on your setup)
-- If using CHECK constraint:
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'PENDING', 'IN_PROGRESS', 'COMPLETE', 'DELAYED', 'RESCHEDULED'));

-- Or migrate existing statuses to new enum values
```

---

## Testing the Integration

### Test Sequence

1. **Start Mobile App**
```bash
cd mobile
npm run ios  # or npm run android
```

2. **Check Console for API Calls**
   - Look for `[Queries] Fetching: /api/mobile/dashboard/today`
   - Look for `[Commands] Executing: accept-daily-schedule`

3. **Implement Stub Endpoints**
   - Return mock data matching the response schemas
   - Test mobile UI renders correctly

4. **Add Business Logic**
   - Connect to database
   - Implement permission checks
   - Add validation

5. **Test Full Flow**
   - Login → Dashboard loads
   - Tap address → native maps open
   - Update crew status → persists
   - Accept schedule → confirmation appears
   - Update job status → reflects in list

---

## Security Considerations

### Permissions Enforcement

```typescript
// Example permission check (pseudo-code)
function canUpdateJobStatus(user, job) {
  if (user.role === 'owner' || user.role === 'admin') {
    return true;
  }

  if (user.role === 'crew_leader' || user.role === 'crew_member') {
    return job.assignedCrewId === user.crewId;
  }

  return false;
}
```

### Data Encryption

```typescript
// Encrypt ACH details before storing
const encryptedDetails = encrypt({
  routing: achRouting,
  account: achAccount,
  accountType: achAccountType
}, process.env.ENCRYPTION_KEY);

// Store encrypted
await db.payrollPreferences.update({
  payoutDetails: { ach: encryptedDetails }
});
```

### Rate Limiting

Apply rate limits to prevent abuse:
- Work requests: 5 per day per user
- Status updates: 100 per hour per user
- Payroll updates: 10 per day per user

---

## Monitoring & Analytics

### Backend Events to Log

```typescript
// Log these events for analytics
- crew_status_changed
- schedule_accepted
- schedule_changes_requested
- job_status_changed
- work_request_submitted
- payroll_preferences_updated
```

### Metrics to Track

- Average time to accept daily schedule
- % of jobs completed on time
- Crew status distribution (on site vs en route vs break)
- Work request fulfillment rate

---

## Support & Questions

**Mobile Implementation**: See [CREW_MOBILE_IMPLEMENTATION_COMPLETE.md](../../CREW_MOBILE_IMPLEMENTATION_COMPLETE.md)
**Planning Doc**: See [docs/mobile/crew-ux-vnext.md](crew-ux-vnext.md:1)
**Mobile Source Code**: [mobile/src/](../../mobile/src/)

---

## Checklist for Backend Team

- [ ] Create 4 new database tables
- [ ] Extend jobs table with 6 new columns
- [ ] Implement 15 API endpoints
- [ ] Add permission checks for crew members
- [ ] Encrypt payroll sensitive data
- [ ] Set up notification triggers
- [ ] Add rate limiting
- [ ] Configure analytics logging
- [ ] Run integration tests
- [ ] Deploy to staging for mobile testing

**Once complete, notify mobile team for end-to-end testing.**
