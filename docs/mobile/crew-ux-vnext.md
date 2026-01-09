# LawnFlow Mobile UX - Crew-Focused Refresh (vNext)

## Sprint 0: Discovery & Planning — COMPLETE

### Date: 2026-01-09

---

## Repository Structure Analysis

### Mobile App Framework
- **Framework**: Expo (React Native)
- **Location**: `/mobile/`
- **Package Manager**: npm
- **TypeScript**: Yes
- **Navigation**: React Navigation (Bottom Tabs + Native Stack)
- **State Management**: Zustand (client state) + React Query (server state)
- **API Client**: Axios with command/query pattern
- **Offline Support**: Implemented via `commandQueue.ts`

### Existing Mobile Architecture

```
mobile/
├── App.tsx                              # Root component
├── app.config.js                        # Expo configuration
├── src/
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts               # Axios instance
│   │   │   ├── commands.ts             # State-changing operations
│   │   │   ├── queries.ts              # Read operations
│   │   │   ├── utils.ts                # Trace ID, idempotency
│   │   │   ├── auth.ts                 # Auth endpoints
│   │   │   ├── jobs.ts                 # Job endpoints (legacy)
│   │   │   ├── notifications.ts        # Notification endpoints
│   │   ├── offline/
│   │   │   ├── commandQueue.ts         # Offline command queueing
│   │   ├── notifications/
│   │   │   ├── firebase.ts             # FCM setup
│   │   │   ├── permissions.ts          # Notification permissions
│   │   ├── storage/
│   │   │   ├── secureStorage.ts        # Expo Secure Store wrapper
│   │   │   ├── cache.ts                # AsyncStorage wrapper
│   │   ├── analytics/
│   │   │   ├── index.ts                # Analytics tracking
│   │   │   ├── events.ts               # Event definitions
│   ├── navigation/
│   │   ├── RootNavigator.tsx           # Root navigation
│   │   ├── MainNavigator.tsx           # Customer app navigation (existing)
│   │   ├── AuthNavigator.tsx           # Auth flow
│   │   ├── types.ts                    # Customer nav types
│   │   ├── staff-types.ts              # Staff nav types (CREATED)
│   │   ├── linking.config.ts           # Deep linking
│   ├── screens/
│   │   ├── today/
│   │   │   ├── DashboardScreen.tsx     # Role-adaptive dashboard (CREATED)
│   │   ├── jobs/
│   │   │   ├── JobsScreen.tsx          # Jobs list
│   │   │   ├── JobDetailScreen.tsx     # Job detail view
│   │   ├── home/
│   │   │   ├── HomeScreen.tsx          # Customer home
│   │   ├── auth/
│   │   │   ├── InviteLoginScreen.tsx   # Invite token login
│   │   ├── settings/
│   │   │   ├── SettingsScreen.tsx      # Settings
│   │   ├── notifications/
│   │   │   ├── NotificationCenterScreen.tsx
│   │   ├── services/                   # Customer service requests
│   │   ├── reviews/                    # Customer reviews
│   ├── components/
│   │   ├── common/
│   │   │   ├── LoadingSpinner.tsx
│   │   ├── jobs/
│   │   │   ├── JobCard.tsx
│   │   │   ├── JobActionsPanel.tsx
│   │   │   ├── QAPhotoViewer.tsx
│   │   │   ├── ReminderBanner.tsx
│   │   ├── notifications/
│   │   │   ├── NotificationBanner.tsx
│   │   │   ├── NotificationCard.tsx
│   │   ├── services/
│   │   │   ├── ServiceCard.tsx
│   ├── store/
│   │   ├── authStore.ts                # Zustand auth state
│   │   ├── jobStore.ts                 # Zustand job state
│   │   ├── notificationStore.ts        # Zustand notification state
│   │   ├── serviceStore.ts             # Zustand service state
│   ├── hooks/
│   │   ├── useDeepLink.ts              # Deep link handling
│   │   ├── useJobActions.ts            # Job action mutations
│   │   ├── useNotificationPermission.ts
```

---

## Database Schema Analysis

### User & Role Management

**Table: `users`**
- Fields: `id`, `email`, `phoneE164`, `businessId`, `role`
- Role enum: `"owner"`, `"admin"`, `"crew_lead"`, `"staff"`
- Note: Schema uses `crew_lead` and `staff`, mobile nav types use `crew_leader` and `crew_member`
- **Action**: Align terminology — use `crew_leader` and `crew_member` consistently

**Table: `crews`**
- Fields: `id`, `businessId`, `name`, `status` (ACTIVE/INACTIVE), `maxJobsPerDay`
- Tracks crew units

**Table: `crew_members`**
- Fields: `id`, `crewId`, `userId`, `name`, `phoneE164`, `role` (LEADER/MEMBER), `isActive`
- Links users to crews with roles

**Table: `jobs`**
- Current status values: `pending`, `scheduled`, `in_progress`, `completed`, `cancelled`
- Fields: `customerName`, `customerPhone`, `customerAddress`, `serviceType`, `scheduledDate`, `status`, `notes`, `assignedCrewId`

---

## Current Mobile App State

### Customer Mobile App (Existing)
- **Purpose**: Customer-facing app for job tracking, notifications, reviews
- **Features**:
  - Invite token login
  - Job list (upcoming/completed)
  - Notification center
  - Review prompts
  - Service requests
- **Navigation**: Home | Jobs | Services | Notifications | Settings

### Staff Mobile App (Partial)
- **Current State**: Command/query infrastructure exists, dashboard screen created
- **Created Components**:
  - `staff-types.ts` — navigation types for operator/ops/crew_leader/crew_member
  - `DashboardScreen.tsx` — role-adaptive today view
  - `commands.ts` — API mutations with offline queueing
  - `queries.ts` — API read operations
  - `commandQueue.ts` — offline command persistence
- **Missing**: Most screens, crew management, job detail enhancements, acceptance flow, payroll

---

## Navigation Structure (Planned)

### Crew Leader Bottom Nav
1. **Home** → Today's jobs, crew status, notifications, crew snapshot
2. **Jobs** → Today/Upcoming/Completed filters, job detail, directions
3. **Crew** → Crew overview, member list, multi-select call/message
4. **Messages** → Crew threads, owner/ops threads, customer threads
5. **Settings** → Profile, notifications, payroll preferences, support

### Crew Member Bottom Nav
1. **Home** → Today's jobs, crew status, accept jobs CTA, notifications
2. **Jobs** → Today/Upcoming/Completed filters, job detail, directions
3. **Messages** → Owner/ops threads, customer threads (job-scoped)
4. **Settings** → Profile, notifications, payroll preferences, support

### Owner Bottom Nav (Compatibility Mode)
- Must support viewing job addresses and opening directions
- Can see job details and status
- If owner mobile view exists, integrate directions behavior

---

## Status Taxonomy

### Crew Status (User-scoped)
Single-select, shown on Home screen:
- `ON_SITE` — Currently at a job location
- `EN_ROUTE` — Traveling to next job
- `ON_BREAK` — On break

**Backend Requirement**:
- Endpoint: `PATCH /api/mobile/crew/status`
- Payload: `{ crewStatus: "ON_SITE" | "EN_ROUTE" | "ON_BREAK" }`
- Persisted per user with timestamp

### Job Status (Job-scoped)
Editable per permissions, shown on job cards/detail:
- `PENDING` — Not yet started
- `IN_PROGRESS` — Currently being worked on
- `COMPLETE` — Finished
- `DELAYED` — Running behind schedule
- `RESCHEDULED` — Moved to another date

**Backend Requirement**:
- Extend existing `jobs` table status enum to include DELAYED, RESCHEDULED
- Endpoint: `PATCH /api/mobile/jobs/:jobId/status`
- Payload: `{ status, reason? }`
- Validate transitions and permissions

---

## API Endpoints Required

### New Endpoints to Create

#### Crew Status Management
- `PATCH /api/mobile/crew/status`
  - Request: `{ crewStatus: "ON_SITE" | "EN_ROUTE" | "ON_BREAK" }`
  - Response: `{ success: true, crewStatus, updatedAt }`

#### Job Status Updates
- `PATCH /api/mobile/jobs/:jobId/status`
  - Request: `{ status: JobStatus, reason?: string }`
  - Response: `{ success: true, job: Job }`

#### Daily Schedule Acceptance
- `GET /api/mobile/schedule/today`
  - Response: `{ jobs: Job[], acceptanceState: { accepted: boolean, acceptedAt?: string, requestedChanges?: string } }`
- `POST /api/mobile/schedule/today/accept`
  - Request: `{ accepted: true }`
  - Response: `{ success: true, acceptedAt: string }`
- `POST /api/mobile/schedule/today/request-changes`
  - Request: `{ note: string }`
  - Response: `{ success: true, requestId: number }`

#### Request More Work
- `POST /api/mobile/work-requests`
  - Request: `{ timeframe: "today" | "this_week", note?: string }`
  - Response: `{ success: true, requestId: number }`
- `GET /api/admin/work-requests` (for owner/ops to view queue)
  - Response: `[{ id, userId, timeframe, note, createdAt, status }]`

#### Crew Management (Leader Only)
- `GET /api/mobile/crew/me`
  - Response: `{ crewId, name, members: [{ id, name, phoneE164, role }] }`

#### Payroll Preferences
- `GET /api/mobile/payroll/preferences`
  - Response: `{ payFrequency, payMethods, preferredMethod, payoutDetails }`
- `PUT /api/mobile/payroll/preferences`
  - Request: `{ payFrequency, payMethods, preferredMethod, payoutDetails }`
  - Response: `{ success: true, preferences }`

#### Enhanced Job Detail
- `GET /api/mobile/jobs/:jobId` (extend existing)
  - Add fields: `customerNotes`, `accessInstructions`, `whatWereDoing` (tasks/checklist), `timeWindow`

#### Dashboard (extend existing `/today/jobs`)
- `GET /api/mobile/dashboard/today`
  - Response: `{ jobsToday: Job[], notifications: Notification[], crewSnapshot: { crewName, memberCount }, acceptanceState }`

---

## Database Schema Extensions

### New Table: `crew_status_updates`
```sql
CREATE TABLE crew_status_updates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  crew_status TEXT NOT NULL, -- ON_SITE, EN_ROUTE, ON_BREAK
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### New Table: `daily_schedule_acceptances`
```sql
CREATE TABLE daily_schedule_acceptances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  date DATE NOT NULL,
  accepted_at TIMESTAMP,
  request_changes_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);
```

### New Table: `work_requests`
```sql
CREATE TABLE work_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  timeframe TEXT NOT NULL, -- today, this_week
  note TEXT,
  status TEXT DEFAULT 'pending', -- pending, assigned, declined
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### New Table: `payroll_preferences`
```sql
CREATE TABLE payroll_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE,
  pay_frequency TEXT NOT NULL, -- per_job, daily, weekly, scheduled
  pay_methods JSONB NOT NULL, -- ["cash", "zelle", "cashapp", "ach"]
  preferred_method TEXT NOT NULL,
  payout_details JSONB, -- { zelle: "phone", cashapp: "$handle", ach: { routing, account } }
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Extend Table: `jobs`
- Add fields:
  - `customer_notes TEXT`
  - `access_instructions TEXT`
  - `what_were_doing JSONB` (array of task objects)
  - `time_window TEXT` (e.g., "8am-10am")
  - `lat DOUBLE PRECISION`
  - `lng DOUBLE PRECISION`
- Update status enum to include `DELAYED`, `RESCHEDULED`

### Extend Table: `notifications`
- Add notification types:
  - `daily_schedule_ready`
  - `schedule_change`
  - `job_reassigned`

---

## Implementation Plan (7 Sprints)

### Sprint 1: Shared Primitives (Statuses, Models, Directions)
**Files to Create/Modify**:
- `mobile/src/types/enums.ts` — CrewStatus, JobStatus enums
- `mobile/src/utils/directions.ts` — openDirections() helper
- `mobile/src/components/common/AddressLink.tsx` — Tappable address with directions
- `mobile/src/services/analytics/events.ts` — Add `directions_opened` event

**Backend**:
- Analytics endpoint (stub if not exists)

### Sprint 2: Role-Based Navigation + Crew Home
**Files to Create/Modify**:
- `mobile/src/navigation/StaffNavigator.tsx` — Role-based tab navigator
- `mobile/src/screens/home/CrewLeaderHome.tsx` — Leader home screen
- `mobile/src/screens/home/CrewMemberHome.tsx` — Member home screen
- `mobile/src/components/crew/CrewStatusSelector.tsx` — Status selector
- `mobile/src/components/crew/CrewSnapshotCard.tsx` — Crew info card
- Update `DashboardScreen.tsx` to use new components

**Backend**:
- `PATCH /api/mobile/crew/status`
- `GET /api/mobile/dashboard/today`

### Sprint 3: Daily Job Acceptance Flow
**Files to Create**:
- `mobile/src/screens/acceptance/AcceptanceScreen.tsx` — Job acceptance modal/screen
- `mobile/src/components/acceptance/JobAcceptanceList.tsx` — List of jobs to accept
- `mobile/src/hooks/useScheduleAcceptance.ts` — React Query mutation

**Backend**:
- `GET /api/mobile/schedule/today`
- `POST /api/mobile/schedule/today/accept`
- `POST /api/mobile/schedule/today/request-changes`
- Notification: `daily_schedule_ready`

### Sprint 4: Jobs Tab + Job Detail Execution View
**Files to Create/Modify**:
- `mobile/src/screens/jobs/JobsScreen.tsx` — Update with filters (Today/Upcoming/Completed)
- `mobile/src/screens/jobs/JobDetailScreen.tsx` — Enhance with execution guidance
- `mobile/src/components/jobs/StatusSelector.tsx` — Job status selector
- `mobile/src/components/jobs/TaskChecklist.tsx` — What We're Doing checklist
- `mobile/src/components/jobs/CommunicationShortcuts.tsx` — Message owner/customer
- `mobile/src/components/jobs/CompletionFlow.tsx` — Mark complete with notes/photos

**Backend**:
- `GET /api/mobile/jobs?filter=today|upcoming|completed`
- `PATCH /api/mobile/jobs/:jobId/status`
- Extend `GET /api/mobile/jobs/:jobId` with new fields

### Sprint 5: Crew Tab + Request More Work
**Files to Create**:
- `mobile/src/screens/crew/CrewScreen.tsx` (Leader only)
- `mobile/src/components/crew/CrewMemberList.tsx` — List with call/message
- `mobile/src/components/crew/MultiSelectActions.tsx` — Call/message selected
- `mobile/src/screens/work/RequestMoreWorkScreen.tsx` — Request form
- `mobile/src/hooks/useCrewActions.ts` — Call/message helpers

**Backend**:
- `GET /api/mobile/crew/me`
- `POST /api/mobile/work-requests`
- `GET /api/admin/work-requests`

### Sprint 6: Payroll Preferences
**Files to Create**:
- `mobile/src/screens/settings/PayrollPreferencesScreen.tsx`
- `mobile/src/components/payroll/PayFrequencySelector.tsx`
- `mobile/src/components/payroll/PayMethodsSelector.tsx`
- `mobile/src/components/payroll/PayoutDetailsForm.tsx`

**Backend**:
- `GET /api/mobile/payroll/preferences`
- `PUT /api/mobile/payroll/preferences`

### Sprint 7: Polish, Permissions, Documentation
**Tasks**:
- Add permission checks (crew members: job-scoped only)
- Add analytics for all key events
- Update `docs/mobile/crew-ux-vnext.md` with final architecture
- Create smoke test checklist
- Verify directions work from all surfaces

---

## Key Files to Modify in Upcoming Sprints

### Existing Files That Need Updates
1. [mobile/src/services/api/types.ts](mobile/src/services/api/types.ts:1)
   - Add `CrewStatus`, `JobStatus` enums
   - Extend `Job` interface with new fields
   - Add `AcceptanceState`, `WorkRequest`, `PayrollPreferences` types

2. [mobile/src/services/api/queries.ts](mobile/src/services/api/queries.ts:1)
   - Add new query functions for dashboard, crew, payroll, acceptance

3. [mobile/src/services/api/commands.ts](mobile/src/services/api/commands.ts:1)
   - Add crew status update, job status update, acceptance, work request, payroll commands

4. [mobile/src/navigation/MainNavigator.tsx](mobile/src/navigation/MainNavigator.tsx:1)
   - Add role-based gating for tabs
   - Integrate Crew tab for leaders

5. [mobile/src/store/authStore.ts](mobile/src/store/authStore.ts:1)
   - Store user role, crewId in state

6. [shared/schema.ts](shared/schema.ts:1)
   - Add new tables: `crew_status_updates`, `daily_schedule_acceptances`, `work_requests`, `payroll_preferences`
   - Extend `jobs` table

---

## Platform-Specific Considerations

### iOS Directions
- URL: `http://maps.apple.com/?daddr={encoded_address}`
- Use `Linking.openURL()` from React Native

### Android Directions
- URL: `https://www.google.com/maps/dir/?api=1&destination={encoded_address}`
- Use `Linking.openURL()` from React Native

### Cross-Platform Helper
```typescript
import { Linking, Platform } from 'react-native';

export async function openDirections(address: string, coords?: { lat: number; lng: number }) {
  const encodedAddress = encodeURIComponent(address);

  let url: string;
  if (Platform.OS === 'ios') {
    url = coords
      ? `http://maps.apple.com/?daddr=${coords.lat},${coords.lng}`
      : `http://maps.apple.com/?daddr=${encodedAddress}`;
  } else {
    url = coords
      ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
  }

  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
    // Track analytics
    trackEvent('directions_opened', { address, platform: Platform.OS });
  } else {
    console.error('Cannot open maps URL');
  }
}
```

---

## Component Inventory (New Components to Build)

### Common
- `AddressLink.tsx` — Tappable address, opens directions
- `StatusPill.tsx` — Colored status badge
- `StatusSelector.tsx` — Dropdown/modal for status selection

### Crew
- `CrewStatusSelector.tsx` — On Site / En Route / On Break selector
- `CrewSnapshotCard.tsx` — Crew name, member count, CTA
- `CrewMemberList.tsx` — List with call/message actions
- `MultiSelectActions.tsx` — Call Selected / Message Selected

### Jobs
- `TaskChecklist.tsx` — What We're Doing checklist
- `CommunicationShortcuts.tsx` — Message owner/customer buttons
- `CompletionFlow.tsx` — Complete job modal with notes/photos

### Acceptance
- `JobAcceptanceList.tsx` — List of jobs to accept
- `AcceptanceActions.tsx` — Accept / Request Changes buttons

### Payroll
- `PayFrequencySelector.tsx` — Per job / Daily / Weekly / Scheduled
- `PayMethodsSelector.tsx` — Cash / Zelle / CashApp / ACH
- `PayoutDetailsForm.tsx` — Form for payout details

---

## Screen Inventory (New Screens to Build)

### Home
- `CrewLeaderHome.tsx` (Sprint 2)
- `CrewMemberHome.tsx` (Sprint 2)

### Acceptance
- `AcceptanceScreen.tsx` (Sprint 3)

### Jobs
- Enhanced `JobDetailScreen.tsx` (Sprint 4)

### Crew (Leader Only)
- `CrewScreen.tsx` (Sprint 5)

### Work Requests
- `RequestMoreWorkScreen.tsx` (Sprint 5)

### Settings/Payroll
- `PayrollPreferencesScreen.tsx` (Sprint 6)

---

## Summary

**Sprint 0 Complete**. The codebase has:
- ✅ Expo React Native mobile app with TypeScript
- ✅ Command/query API pattern with offline queueing
- ✅ Role-based navigation types defined
- ✅ Dashboard screen with role-adaptive views
- ✅ Comprehensive backend schema with crews, users, roles

**Ready for Sprint 1**:
- Create shared primitives (statuses, models, directions helper)
- Integrate AddressLink component across all address renders
- Set up analytics for directions_opened event

All future sprints have clear file paths and implementation targets identified.
