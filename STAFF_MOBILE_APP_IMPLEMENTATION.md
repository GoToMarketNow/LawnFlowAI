# LawnFlow.ai Staff Mobile App - Implementation Summary

## Overview

Building a **crew-first, agent-orchestrated mobile application** for lawn care operators, dispatch staff, crew leaders, and crew members. The app integrates seamlessly with the Payment Agent and existing LawnFlow.ai command/event orchestration system.

## Architecture Principles

✅ **Event-driven command/query pattern** - Commands mutate state, queries read state
✅ **Offline-first** - Queue commands when offline, sync when connected
✅ **Role-based UX** - Adaptive dashboards per user role
✅ **Agent integration** - Surface suggestions with confidence, human-in-the-loop
✅ **Low-latency** - Optimistic UI, async backend processing
✅ **Idempotency** - All commands include idempotency keys
✅ **Observability** - Every action includes trace_id

## Tech Stack (Existing)

- **React Native** + **Expo**
- **TypeScript**
- **React Navigation** (stack + tabs)
- **Tanstack React Query** (server state)
- **Zustand** (client state)
- **Async Storage** (persistence)
- **Expo Secure Store** (tokens)
- **Expo Notifications** (push)
- **Axios** (HTTP)

## Sprint M1 Status: COMPLETED

### ✅ API Client with Command/Query Pattern

**Created Files:**
- [`mobile/src/services/api/utils.ts`](mobile/src/services/api/utils.ts:1) - Trace ID, idempotency key generation
- [`mobile/src/services/api/commands.ts`](mobile/src/services/api/commands.ts:1) - All state-changing operations
- [`mobile/src/services/api/queries.ts`](mobile/src/services/api/queries.ts:1) - All read operations

**Key Features:**
- **Trace ID generation**: `{prefix}_{timestamp}_{random}`
- **Idempotency keys**: Hash-based deduplication with hourly window
- **Device ID tracking**: Persistent device fingerprint
- **Automatic auth token injection**: Via interceptors
- **Error formatting**: Consistent error handling

**Command API Examples:**
```typescript
await startJob(jobId);
await completeJob(jobId, { notes: "Lawn mowed, edges trimmed" });
await uploadQAPhoto({ jobId, photoUri, caption, tags });
await reportIssue({ jobId, issueType: "equipment", severity: "high" });
await confirmCrewAssignment({ assignmentId, crewId, accept: true });
```

**Query API Examples:**
```typescript
const { data: jobs } = await getTodayJobs({ crewId });
const { data: job } = await getJob(jobId);
const { data: suggestions } = await getAgentSuggestions({ entityType: 'job', entityId: '123' });
```

### ✅ Offline Command Queue

**Created Files:**
- [`mobile/src/services/offline/commandQueue.ts`](mobile/src/services/offline/commandQueue.ts:1)

**Features:**
- **Queue commands when offline**: Automatic network detection
- **Periodic sync**: Every 30 seconds when online
- **Retry logic**: Max 3 attempts with exponential backoff
- **Persistent storage**: AsyncStorage with max 100 commands
- **Status tracking**: pending → syncing → success/failed

**Usage:**
```typescript
// In commands.ts, automatically queue if offline
await commandQueue.enqueue('start-job', payload);

// Check pending count
const count = await commandQueue.getPendingCount();

// Retry failed commands
await commandQueue.retryFailed();
```

### ✅ Navigation Types (Role-Based)

**Created Files:**
- [`mobile/src/navigation/staff-types.ts`](mobile/src/navigation/staff-types.ts:1)

**Role-Based Tabs:**
- **Operator/Ops**: Today | Jobs | Crews | Messages | Notifications | More
- **Crew Leader**: Today | Jobs | Messages | Notifications | More
- **Crew Member**: Today | Jobs | Messages | Notifications | More

**Key Stacks:**
- `TodayStackParamList` - Dashboard, crew status, daily route
- `JobsStackParamList` - Job list, detail, QA, photos, camera, issue reporting
- `CrewsStackParamList` - Crew list, detail, assignments, performance
- `MessagesStackParamList` - Threads, chat, customer proxy
- `ModalStackParamList` - Agent suggestions, escalation, offline queue

## Sprint M2: TODO - Today Dashboard & Job Actions

### Files to Create:

**1. screens/today/DashboardScreen.tsx**
- Role-adaptive dashboard
- Operator/Ops: Jobs overview, crew status grid, alerts
- Crew Leader: Today's route, assigned jobs, ETAs
- Crew Member: My assignments, shift status

**2. screens/jobs/JobActionsPanel.tsx**
- Start/Pause/Resume/Complete buttons
- Optimistic UI with pending states
- Offline queue indicator
- Command execution with error handling

**3. screens/jobs/JobDetailScreen.tsx** (enhance existing)
- Job info card: customer, address, map
- Service details, notes, crew info
- Actions panel
- Agent suggestions panel (collapsible)
- Status timeline

**4. hooks/useJobActions.ts**
- Wrapper around command API
- React Query mutations with optimistic updates
- Error handling and rollback

## Sprint M3: TODO - Crew Management & Notifications

### Files to Create:

**1. screens/crews/CrewsListScreen.tsx** (Operator/Ops only)
- Crew cards with status indicators
- Filter: all | available | on_job | offline
- Tap to view crew detail

**2. screens/crews/CrewDetailScreen.tsx**
- Crew info: name, members, skills, equipment
- Current job (if any)
- Today's assignments
- Performance stats
- "Assign Job" action

**3. screens/crews/AssignmentConfirmScreen.tsx** (Crew Leader)
- Assignment proposal notification
- Job details
- Accept/Decline buttons
- Notes field

**4. services/notifications/pushHandler.ts**
- Expo Notifications setup
- Deep link routing (assignment → crew detail, job → job detail)
- Notification action handlers

## Sprint M4: TODO - QA Photos & Checklist

### Files to Create:

**1. screens/jobs/JobQAScreen.tsx**
- Checklist items with checkboxes
- Required photo count indicator
- Photo grid (uploaded + pending)
- "Complete Job" button (gated by policy)

**2. screens/jobs/CameraCaptureScreen.tsx**
- Expo Camera for photo capture
- Before/After/Issue photo types
- AI caption generation (optional)
- Offline queue for uploads

**3. hooks/usePhotoUpload.ts**
- Upload to backend (pre-signed URL workflow)
- Optimistic UI (show photo immediately)
- Retry on failure
- Track upload progress

**4. components/jobs/PhotoUploadQueue.tsx**
- Show pending uploads
- Retry/Cancel actions
- Upload progress indicators

## Sprint M5: TODO - Agent Suggestions & Comms

### Files to Create:

**1. components/agent/AgentSuggestionsPanel.tsx**
- Collapsible panel on job detail screen
- Confidence score with visual indicator
- Risk flags (badges)
- Suggested actions (buttons)
- Rationale (short explanation)
- "Send to Ops" escalation button

**2. screens/agent/ConfirmAgentActionModal.tsx**
- Action confirmation dialog
- Show command details
- Confidence breakdown
- Risk warnings
- Confirm/Cancel buttons

**3. screens/messages/ThreadScreen.tsx**
- Message list (reverse chronological)
- Send message input
- Customer proxy indicator (shows when thread type is customer_proxy)
- Agent-assisted reply suggestions (optional)

**4. screens/messages/ThreadsListScreen.tsx**
- Crew threads, Ops threads, Customer proxy threads
- Unread badge
- Last message preview
- Tap to open thread

**5. hooks/useAgentSuggestions.ts**
- React Query hook for fetching suggestions
- Poll for updates every 30s when job is in progress
- Cache suggestions locally

## Backend API Endpoints Required

### Commands (POST /commands/*)

| Endpoint | Payload | Description |
|----------|---------|-------------|
| `/commands/confirm-crew-assignment` | `{ assignmentId, crewId, accept, notes }` | Crew leader accepts/declines assignment |
| `/commands/start-job` | `{ jobId, startedAt }` | Start job timer |
| `/commands/pause-job` | `{ jobId, reason, pausedAt }` | Pause job |
| `/commands/resume-job` | `{ jobId, resumedAt }` | Resume job |
| `/commands/complete-job` | `{ jobId, completedAt, notes, photosUploaded }` | Complete job (triggers Payment Agent) |
| `/commands/upload-qa-photo` | `{ jobId, photoUri, caption, tags }` | Upload job photo |
| `/commands/submit-qa-checklist` | `{ jobId, checklistItems }` | Submit checklist |
| `/commands/add-job-note` | `{ jobId, note, noteType }` | Add note to job |
| `/commands/report-issue` | `{ jobId, issueType, description, severity }` | Report issue, escalate |
| `/commands/send-message` | `{ threadId, threadType, message }` | Send crew/ops/customer message |
| `/commands/mark-message-read` | `{ messageId, threadId }` | Mark message as read |
| `/commands/ack-notification` | `{ notificationId }` | Acknowledge notification |
| `/commands/execute-agent-suggestion` | `{ suggestionId, action, confirmed }` | Execute agent suggestion |
| `/commands/escalate-to-human` | `{ entityType, entityId, reason, priority }` | Escalate to ops/finance |
| `/commands/update-crew-status` | `{ crewId, status, location }` | Update crew availability |

### Queries (GET /*)

| Endpoint | Query Params | Response |
|----------|--------------|----------|
| `/me` | - | User profile + role |
| `/today/jobs` | `{ crewId?, status?, date? }` | Today's jobs |
| `/jobs/:id` | - | Job details |
| `/jobs/:id/photos` | - | Job photos |
| `/jobs/:id/qa-checklist` | - | QA checklist |
| `/crews` | - | All crews |
| `/crews/:id` | - | Crew details |
| `/crews/:id/assignments` | `{ date?, status? }` | Crew assignments |
| `/messages` | `{ thread_id }` | Messages in thread |
| `/threads` | `{ threadType?, unreadOnly? }` | Message threads |
| `/notifications` | `{ unreadOnly?, limit? }` | Notifications |
| `/notifications/unread-count` | - | Unread count |
| `/agent-suggestions` | `{ entityType, entityId }` | Agent suggestions |
| `/dashboard/stats` | `{ date? }` | Dashboard stats (ops/operator) |

## Integration with Payment Agent

### JobCompleted → Payment Flow

```
1. Crew Leader taps "Complete Job" in app
2. App calls: POST /commands/complete-job { jobId, completedAt }
3. Backend:
   - QA Agent validates (photos, checklist)
   - Payment Agent evaluates payment path
   - Executes autopay/text-to-pay/invoice
4. App receives: PaymentCaptured or InvoiceFallbackTriggered event
5. App shows: "Job Complete - Payment Processed" or "Job Complete - Invoice Sent"
6. If payment failed: Show "Payment Issue - Contact Ops"
```

### Payment Status in App

**Job Detail Screen**:
```typescript
<JobCard>
  <Status>Completed</Status>
  <PaymentStatus status={job.paymentStatus}>
    {job.paymentStatus === 'captured' && '✓ Paid'}
    {job.paymentStatus === 'pending' && '⏳ Payment Pending'}
    {job.paymentStatus === 'failed' && '⚠ Payment Issue'}
  </PaymentStatus>
</JobCard>
```

**Dashboard Stats** (Operator/Ops):
```typescript
<StatCard>
  <Label>Unpaid Jobs</Label>
  <Value>{stats.unpaidJobs}</Value>
  <Action onPress={() => navigate('Jobs', { filter: 'unpaid' })}>
    View
  </Action>
</StatCard>
```

## Offline-First Strategy

### Offline Capabilities:
✅ View cached jobs (read-only)
✅ Queue job actions (start/pause/complete)
✅ Capture photos (queue uploads)
✅ Complete checklist (sync later)
✅ Add notes (queue)

### Online-Only:
❌ Fetch new jobs
❌ Receive real-time notifications
❌ View agent suggestions (requires backend reasoning)
❌ Send messages (queue, but no confirmation until online)

### UI Indicators:
- Offline banner at top
- "Pending sync" badge on queued commands
- "X actions pending" in settings
- Auto-dismiss on successful sync

## Security & Permissions

### Token Storage:
- `auth_token` → Expo Secure Store (encrypted)
- `refresh_token` → Expo Secure Store (encrypted)
- `user` → Expo Secure Store (profile info)
- `device_id` → Expo Secure Store (persistent)

### RBAC Enforcement:
- Server-side permission checks on all commands
- App hides features based on role (e.g., Crews tab only for operator/ops)
- No sensitive PII cached beyond what's needed for offline

### Biometric Auth (Optional):
- Use `expo-local-authentication` for re-auth on sensitive actions
- Operator actions (reassign crew, override agent) require biometric

## Next Steps

1. **Backend Integration**: Implement command/query endpoints
2. **Implement Sprint M2**: Today dashboard + job actions
3. **Implement Sprint M3**: Crew management + notifications
4. **Implement Sprint M4**: QA photos + checklist
5. **Implement Sprint M5**: Agent suggestions + comms
6. **Testing**: E2E flows for crew workflows
7. **Release**: TestFlight/Play Store beta

## File Structure

```
mobile/
├── src/
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts               (existing, enhanced)
│   │   │   ├── utils.ts                ✅ CREATED
│   │   │   ├── commands.ts             ✅ CREATED
│   │   │   ├── queries.ts              ✅ CREATED
│   │   ├── offline/
│   │   │   ├── commandQueue.ts         ✅ CREATED
│   │   ├── notifications/
│   │   │   ├── pushHandler.ts          TODO
│   │   ├── storage/
│   │   │   ├── secureStorage.ts        (existing)
│   ├── navigation/
│   │   ├── staff-types.ts              ✅ CREATED
│   │   ├── StaffNavigator.tsx          TODO
│   │   ├── RoleBasedTabs.tsx           TODO
│   ├── screens/
│   │   ├── today/
│   │   │   ├── DashboardScreen.tsx     TODO
│   │   ├── jobs/
│   │   │   ├── JobsListScreen.tsx      (existing, enhance)
│   │   │   ├── JobDetailScreen.tsx     (existing, enhance)
│   │   │   ├── JobActionsPanel.tsx     TODO
│   │   │   ├── JobQAScreen.tsx         TODO
│   │   │   ├── CameraCaptureScreen.tsx TODO
│   │   ├── crews/
│   │   │   ├── CrewsListScreen.tsx     TODO
│   │   │   ├── CrewDetailScreen.tsx    TODO
│   │   ├── messages/
│   │   │   ├── ThreadsListScreen.tsx   TODO
│   │   │   ├── ThreadScreen.tsx        TODO
│   │   ├── agent/
│   │   │   ├── ConfirmActionModal.tsx  TODO
│   │   │   ├── EscalateModal.tsx       TODO
│   ├── components/
│   │   ├── agent/
│   │   │   ├── AgentSuggestionsPanel.tsx TODO
│   │   │   ├── ConfidenceIndicator.tsx TODO
│   │   ├── jobs/
│   │   │   ├── PhotoUploadQueue.tsx    TODO
│   │   ├── common/
│   │   │   ├── OfflineBanner.tsx       TODO
│   ├── hooks/
│   │   ├── useJobActions.ts            TODO
│   │   ├── usePhotoUpload.ts           TODO
│   │   ├── useAgentSuggestions.ts      TODO
│   │   ├── useOfflineQueue.ts          TODO
│   ├── store/
│   │   ├── authStore.ts                (existing, enhance)
│   │   ├── offlineStore.ts             TODO
```

## Summary

**Sprint M1 Complete**:
- ✅ Command/Query API client with trace IDs and idempotency
- ✅ Offline command queue with retry logic
- ✅ Role-based navigation types

**Remaining Sprints**:
- Sprint M2: Dashboard + job actions (core UX)
- Sprint M3: Crew management + notifications
- Sprint M4: QA photos + checklist (gate job completion)
- Sprint M5: Agent suggestions + human-in-the-loop

**Integration Points**:
- Payment Agent triggered on job completion
- Agent Suggestions API for recommended actions
- Push notifications for assignments and escalations

All code follows LawnFlow.ai's event-driven, command/query architecture with offline-first capabilities and role-based access control. Ready for Sprint M2 implementation.
