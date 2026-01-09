# Mobile Crew App - Agent Integration Guide

**Status**: Sprint 4 Complete ✅
**Last Updated**: 2026-01-09

## Overview

This document describes how the LawnFlow agent system integrates with mobile crew app events using the event outbox pattern. This enables agents to observe and react to crew actions in real-time.

## Architecture

```
Mobile App (Crew Member)
    ↓
Mobile API Endpoint (e.g., PATCH /api/mobile/jobs/123/status)
    ↓
Database Update (jobs table)
    ↓
Event Outbox Write (event_outbox table)
    ↓
Agent System Polls (/api/agents/mobile-events/pull)
    ↓
Agent Processes Event
    ↓
Agent Acknowledges (/api/agents/mobile-events/ack)
```

## Event Outbox Table

All mobile mutations write events to the `event_outbox` table:

```sql
CREATE TABLE event_outbox (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,           -- Event type identifier
  entity_type TEXT NOT NULL,          -- Entity type (job, crew_status, etc.)
  entity_id INTEGER NOT NULL,         -- ID of the affected entity
  payload JSONB NOT NULL,             -- Full event data

  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMP,
  acknowledged_by TEXT,               -- Agent ID that acked
  acknowledged_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

## Event Types

### 1. `job_status_changed`

Emitted when a crew member updates a job's status.

**Trigger**: `PATCH /api/mobile/jobs/:id/status`

**Payload**:
```json
{
  "jobId": 123,
  "oldStatus": "in_progress",
  "newStatus": "completed",
  "changedBy": 456,
  "changedAt": "2026-01-09T10:30:00Z"
}
```

**Agent Actions**:
- Update crew route optimization
- Notify dispatch of completion
- Trigger customer notification
- Update job scheduling forecasts

### 2. `crew_status_changed`

Emitted when a crew member updates their work status.

**Trigger**: `PATCH /api/mobile/crew/status`

**Payload**:
```json
{
  "userId": 456,
  "crewId": 789,
  "status": "ON_SITE",
  "jobId": 123,
  "lat": 39.7392,
  "lng": -104.9903,
  "timestamp": "2026-01-09T10:30:00Z"
}
```

**Agent Actions**:
- Update real-time crew location tracking
- Recalculate ETAs for upcoming jobs
- Detect anomalies (e.g., crew ON_SITE at wrong location)
- Trigger geofence-based automations

### 3. `schedule_accepted`

Emitted when a crew member accepts or rejects their daily schedule.

**Trigger**: `POST /api/mobile/schedule/accept`

**Payload**:
```json
{
  "userId": 456,
  "date": "2026-01-09",
  "accepted": true,
  "requestedChanges": null,
  "timestamp": "2026-01-09T06:00:00Z"
}
```

**Agent Actions**:
- Update schedule confirmation tracking
- Notify dispatch of pending schedule changes
- Trigger reassignment if schedule rejected

### 4. `schedule_change_requested`

Emitted when a crew member requests changes to their schedule.

**Trigger**: `PATCH /api/mobile/schedule`

**Payload**:
```json
{
  "userId": 456,
  "date": "2026-01-09",
  "requestedChanges": "Need to leave by 2pm for appointment",
  "timestamp": "2026-01-09T06:30:00Z"
}
```

**Agent Actions**:
- Create dispatch notification
- Attempt auto-reschedule using route optimization
- Suggest crew swaps or job reassignments

### 5. `work_request_submitted`

Emitted when a crew member requests additional work.

**Trigger**: `POST /api/mobile/work-requests`

**Payload**:
```json
{
  "userId": 456,
  "crewId": 789,
  "timeframe": "today",
  "note": "Available all day, prefer mowing jobs",
  "timestamp": "2026-01-09T11:00:00Z"
}
```

**Agent Actions**:
- Check unassigned job inventory
- Match crew skills to available jobs
- Suggest job assignments to dispatch
- Auto-assign if within policy thresholds

### 6. `payroll_preferences_updated`

Emitted when a crew member updates payroll preferences.

**Trigger**: `PUT /api/mobile/payroll/preferences`

**Payload**:
```json
{
  "userId": 456,
  "payFrequency": "weekly",
  "payMethods": ["cash", "zelle"],
  "preferredMethod": "zelle",
  "timestamp": "2026-01-09T12:00:00Z"
}
```

**Agent Actions**:
- Update payroll processing configuration
- Validate payout method configuration
- Notify accounting system of changes

## Agent Integration API

### Pull Events

**Endpoint**: `GET /api/agents/mobile-events/pull`

**Query Parameters**:
- `since` (optional): ISO timestamp to filter events created after this time
- `limit` (optional): Max events to return (default: 100, max: 1000)

**Response**:
```json
{
  "events": [
    {
      "id": 123,
      "eventType": "job_status_changed",
      "entityType": "job",
      "entityId": 456,
      "payload": { ... },
      "createdAt": "2026-01-09T10:30:00Z"
    }
  ],
  "count": 1,
  "serverTime": "2026-01-09T10:31:00Z"
}
```

**Behavior**:
- Returns unprocessed events only
- Marks returned events as `processed = true`
- Orders by `created_at` ascending

**Usage Pattern**:
```typescript
// Agent polling loop
setInterval(async () => {
  const response = await fetch('/api/agents/mobile-events/pull?limit=100');
  const { events } = await response.json();

  for (const event of events) {
    await handleMobileEvent(event);
  }

  // Acknowledge after processing
  if (events.length > 0) {
    await fetch('/api/agents/mobile-events/ack', {
      method: 'POST',
      body: JSON.stringify({
        eventIds: events.map(e => e.id),
        agentId: 'crew-intelligence-agent'
      })
    });
  }
}, 5000); // Poll every 5 seconds
```

### Acknowledge Events

**Endpoint**: `POST /api/agents/mobile-events/ack`

**Request Body**:
```json
{
  "eventIds": [123, 124, 125],
  "agentId": "crew-intelligence-agent"
}
```

**Response**:
```json
{
  "success": true,
  "acknowledgedCount": 3,
  "serverTime": "2026-01-09T10:32:00Z"
}
```

**Purpose**:
- Tracks which agent processed each event
- Enables debugging and audit trails
- Allows retry logic for failed processing

## Implementation Examples

### Example 1: Job Completion Handler

```typescript
async function handleJobCompletion(event: MobileEvent) {
  if (event.eventType !== 'job_status_changed') return;
  if (event.payload.newStatus !== 'completed') return;

  const { jobId, changedBy } = event.payload;

  // 1. Update crew route optimization
  await optimizeCrewRoute(event.payload.crewId);

  // 2. Notify dispatch
  await notifyDispatch({
    type: 'job_completed',
    jobId,
    completedBy: changedBy,
    timestamp: event.createdAt,
  });

  // 3. Trigger customer notification
  await sendCustomerSMS(jobId, 'Job completed! Photos and invoice coming soon.');

  // 4. Check for next job assignment
  const nextJob = await findNextAvailableJob(event.payload.crewId);
  if (nextJob) {
    await suggestJobAssignment(nextJob, event.payload.crewId);
  }
}
```

### Example 2: Work Request Matcher

```typescript
async function handleWorkRequest(event: MobileEvent) {
  if (event.eventType !== 'work_request_submitted') return;

  const { userId, crewId, timeframe, note } = event.payload;

  // 1. Get unassigned jobs matching timeframe
  const availableJobs = await getUnassignedJobs({
    timeframe: timeframe === 'today' ? new Date() : getWeekRange(),
    crewId: crewId,
  });

  // 2. Score jobs based on crew skills and proximity
  const scoredJobs = await scoreJobsForCrew(availableJobs, crewId);

  // 3. Auto-assign top job if high confidence
  if (scoredJobs[0]?.score > 0.85) {
    await assignJobToCrew(scoredJobs[0].jobId, crewId, {
      reason: 'auto_assigned_from_work_request',
      requestId: event.id,
    });

    await notifyCrewMember(userId, {
      type: 'job_assigned',
      jobId: scoredJobs[0].jobId,
      message: 'New job assigned based on your request!',
    });
  } else {
    // Send suggestions to dispatch
    await createDispatchSuggestion({
      type: 'work_request_matches',
      userId,
      crewId,
      suggestedJobs: scoredJobs.slice(0, 5),
    });
  }
}
```

### Example 3: Real-Time Crew Tracking

```typescript
async function handleCrewStatusChange(event: MobileEvent) {
  if (event.eventType !== 'crew_status_changed') return;

  const { userId, crewId, status, jobId, lat, lng } = event.payload;

  // 1. Update crew location in cache
  await updateCrewLocation(crewId, { lat, lng, timestamp: event.createdAt });

  // 2. Recalculate ETAs
  if (status === 'EN_ROUTE' && jobId) {
    const eta = await calculateETA({ lat, lng }, jobId);
    await updateJobETA(jobId, eta);

    // Notify customer if ETA changed significantly
    if (eta.minutesChanged > 15) {
      await notifyCustomerETAChange(jobId, eta);
    }
  }

  // 3. Detect anomalies
  if (status === 'ON_SITE' && jobId) {
    const job = await getJob(jobId);
    const distance = calculateDistance({ lat, lng }, job.location);

    if (distance > 0.5) { // More than 0.5 miles from job site
      await createAlert({
        type: 'location_mismatch',
        severity: 'medium',
        crewId,
        jobId,
        message: `Crew marked ON_SITE but ${distance.toFixed(1)} miles from job location`,
      });
    }
  }
}
```

## Event Processing Guidelines

### Polling Frequency

- **Recommended**: 5-10 seconds for production
- **Development**: 30-60 seconds to reduce load
- **Low-priority agents**: 1-5 minutes

### Error Handling

```typescript
async function pollMobileEvents() {
  try {
    const response = await fetch('/api/agents/mobile-events/pull?limit=100');
    const { events } = await response.json();

    for (const event of events) {
      try {
        await processEvent(event);
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        // Log to error tracking, but don't fail entire batch
        await logEventError(event.id, error);
      }
    }

    // Always acknowledge, even if some events failed
    if (events.length > 0) {
      await acknowledgeEvents(events.map(e => e.id));
    }
  } catch (error) {
    console.error('Error polling mobile events:', error);
    // Retry with exponential backoff
  }
}
```

### Idempotency

Events may be delivered more than once. Ensure your handlers are idempotent:

```typescript
async function handleEvent(event: MobileEvent) {
  // Check if already processed
  const processed = await checkEventProcessed(event.id);
  if (processed) {
    console.log(`Event ${event.id} already processed, skipping`);
    return;
  }

  // Process event
  await doWork(event);

  // Mark as processed
  await markEventProcessed(event.id);
}
```

## Monitoring

### Key Metrics

1. **Event Lag**: Time between event creation and processing
2. **Processing Rate**: Events processed per minute
3. **Error Rate**: Failed event processing attempts
4. **Queue Depth**: Unprocessed events in outbox

### Queries

```sql
-- Queue depth
SELECT COUNT(*) FROM event_outbox WHERE processed = false;

-- Average processing lag
SELECT AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_lag_seconds
FROM event_outbox
WHERE processed_at IS NOT NULL;

-- Unacknowledged events
SELECT COUNT(*) FROM event_outbox
WHERE processed = true AND acknowledged_at IS NULL;

-- Event type distribution (last hour)
SELECT event_type, COUNT(*) as count
FROM event_outbox
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type
ORDER BY count DESC;
```

## Testing

### Manual Event Creation

```typescript
// Trigger a test event
await fetch('/api/mobile/jobs/123/status', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'completed' })
});

// Verify event in outbox
const events = await db.select()
  .from(eventOutbox)
  .where(eq(eventOutbox.entityId, 123))
  .orderBy(desc(eventOutbox.createdAt))
  .limit(1);

console.log('Created event:', events[0]);
```

### Integration Test

```typescript
describe('Mobile Event Integration', () => {
  it('should create outbox event on job status change', async () => {
    const jobId = 123;

    // Update job status
    await updateJobStatus(jobId, 'completed');

    // Check outbox
    const events = await getUnprocessedEvents();
    const jobEvent = events.find(e =>
      e.eventType === 'job_status_changed' &&
      e.entityId === jobId
    );

    expect(jobEvent).toBeDefined();
    expect(jobEvent.payload.newStatus).toBe('completed');
  });

  it('should mark event as processed when pulled', async () => {
    const response = await fetch('/api/agents/mobile-events/pull');
    const { events } = await response.json();

    // Verify events marked as processed
    for (const event of events) {
      const updated = await getEvent(event.id);
      expect(updated.processed).toBe(true);
      expect(updated.processedAt).toBeTruthy();
    }
  });
});
```

## Next Steps

1. Implement specific agent handlers for each event type
2. Add retry logic for failed event processing
3. Create monitoring dashboard for event metrics
4. Implement dead letter queue for permanently failed events
5. Add webhook support for external system integrations
