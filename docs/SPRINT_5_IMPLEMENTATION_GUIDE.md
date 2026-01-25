# Sprint 5: Frontend UI - Implementation Guide

**Status**: 🟡 In Progress (3/10 screens complete)
**Date**: January 12, 2026

---

## ✅ Completed Screens (3/10)

### 1. Knowledge List Page ✅
**File**: [/client/src/pages/knowledge-list.tsx](../client/src/pages/knowledge-list.tsx)

**Features**:
- Grid view of all knowledge items with stats cards
- Search by title, category, or slug
- Filter by status (draft, review, published, retired)
- Filter by type (policy, service, payment, operations, proof_of_work, macro)
- Actions: View, Edit, Retire
- Empty state with CTA to create or auto-generate
- Real-time stats: Total, Published, Review, Draft counts

**API Integration**:
- `GET /api/knowledge/items?status=&type=`
- `POST /api/knowledge/items/:id/retire`

---

### 2. Knowledge Builder Page ✅
**File**: [/client/src/pages/knowledge-builder.tsx](../client/src/pages/knowledge-builder.tsx)

**Features**:
- Interactive type selection (checkboxes for 6 types)
- Each type shows: icon, estimated count, description, examples
- Generate button triggers AI generation
- Loading state with progress indicator
- Success screen with generated items list
- Error handling with retry option
- Links to review drafts after generation

**API Integration**:
- `POST /api/knowledge/builder/generate`
  - Body: `{ includeTypes: string[], overwrite: boolean }`
  - Response: `{ draftsCreated, drafts[], errors[] }`

**Types Available**:
1. Policies (3-5 items)
2. Services (based on catalog)
3. Payment FAQs (5-7 items)
4. Operations (2-3 procedures)
5. Proof of Work (per service)
6. Macro Templates (5-8 templates)

---

### 3. Knowledge Approval Queue Page ✅
**File**: [/client/src/pages/knowledge-approvals.tsx](../client/src/pages/knowledge-approvals.tsx)

**Features**:
- Tabs: In Review, Drafts, All
- Approve & Publish button (green)
- Reject button with reason textarea
- Review link to view full content
- Change notes display
- Time ago indicators
- Stats cards: Total Pending, In Review, Drafts
- Help alert with approval tips

**API Integration**:
- `GET /api/knowledge/approvals/pending`
- `POST /api/knowledge/items/:id/approve`
  - Body: `{ versionId, decision: 'approved' | 'rejected', rejectionReason? }`

---

## 🔨 Remaining Screens (7/10)

### 4. Knowledge Reviews Due Page
**File**: `/client/src/pages/knowledge-reviews.tsx` (TO BE CREATED)

**Purpose**: Calendar view of scheduled knowledge reviews

**Features Needed**:
- Calendar/list view of reviews due
- Filter by urgency (high: 1 day, medium: 7 days, low: 30 days)
- SLA indicators (overdue, due soon, ok)
- Mark as reviewed action
- Schedule new review
- Stats: Overdue, Due This Week, Due This Month

**API Integration**:
```typescript
GET /api/knowledge/reviews/due
POST /api/knowledge/reviews/:id/complete
```

**UI Components**:
- Calendar view (optional, can use list)
- Review cards with due date badges
- "Mark Reviewed" button
- Schedule review modal

---

### 5. Support Queue Page
**File**: `/client/src/pages/support-queue.tsx` (TO BE CREATED)

**Purpose**: Main support queue with SLA tracking and coverage detection

**Features Needed**:
- Queue table/list with columns:
  - Customer name/phone
  - Intent classification
  - Priority (urgent, high, normal, low)
  - Coverage status (covered, partial, uncovered, unknown)
  - SLA urgency indicator (🔴🟠🟡🟢)
  - Time to SLA breach
  - Actions: View, Claim, Respond
- Filters:
  - Priority
  - Coverage status
  - SLA status
  - Intent type
- Stats cards:
  - Total in queue
  - Overdue SLA
  - Uncovered (no knowledge)
  - Avg response time
- Macro suggestions for covered intents

**API Integration**:
```typescript
GET /api/support/queue?priority=&coverageStatus=&slaStatus=
POST /api/support/queue/:threadId/claim
POST /api/support/queue/:threadId/first-response
POST /api/support/queue/:threadId/resolve
PATCH /api/support/queue/:threadId/priority
GET /api/support/stats
```

**SLA Urgency Indicators**:
- 🔴 Overdue (past SLA deadline)
- 🟠 Critical (within 30 minutes)
- 🟡 Soon (within 4 hours)
- 🟢 OK (plenty of time)

**SLA Targets by Priority**:
- Urgent: 1 hour first response, 24 hours resolution
- High: 2 hours first response, 48 hours resolution
- Normal: 4 hours first response, 72 hours resolution
- Low: 8 hours first response, 120 hours resolution

---

### 6. Thread Detail Page
**File**: `/client/src/pages/thread-detail.tsx` (TO BE CREATED)

**Purpose**: View and respond to customer thread with AI assistance

**Features Needed**:
- Message thread display (customer + AI + staff messages)
- Thread metadata sidebar:
  - Customer info
  - Intent classification
  - Priority
  - Coverage status
  - SLA countdown
  - Assigned to
- Rich message composer with:
  - Macro insertion dropdown
  - Knowledge base search/insert
  - AI-suggested responses (from PSKB)
  - Attachment support
- Message actions:
  - Mark as first response
  - Mark as resolved
  - Escalate
  - Change priority
- Knowledge suggestions panel:
  - Relevant KB items based on intent
  - Insert KB content into reply
  - Citation previews

**API Integration**:
```typescript
GET /api/support/queue/:threadId
GET /api/assistant/conversations/:id/messages
POST /api/assistant/conversations/:id/messages
POST /api/support/queue/:threadId/first-response
POST /api/support/queue/:threadId/resolve
GET /api/knowledge/search?query=&scope=
```

**Components**:
- MessageThread (scrollable chat)
- MessageComposer (rich textarea with toolbar)
- MacroDropdown (quick insert)
- KnowledgeSuggestions (sidebar)
- SLACountdown (badge/timer)

---

### 7. Coverage Gaps Page
**File**: `/client/src/pages/coverage-gaps.tsx` (TO BE CREATED)

**Purpose**: Identify uncovered intents and recommend knowledge creation

**Features Needed**:
- Gap analysis table:
  - Intent (uncovered)
  - Frequency (last 30 days)
  - Example questions
  - Suggested action
  - Create knowledge button
- Trend chart (30-day coverage over time)
- Filter by:
  - Time range (7d, 30d, 90d)
  - Min frequency threshold
- Stats cards:
  - Total gaps
  - High-frequency gaps (>10/week)
  - Recently emerged gaps
- Batch action: Create multiple knowledge items

**API Integration**:
```typescript
GET /api/support/coverage-gaps?timeRange=30d&minFrequency=5
POST /api/knowledge/items (for each gap)
```

**Gap Analysis Structure**:
```typescript
interface CoverageGap {
  intent: string;
  frequency: number;
  exampleQuestions: string[];
  suggestedKnowledgeType: "policy" | "service" | "payment" | "operations";
  suggestedTitle: string;
  priority: "high" | "medium" | "low";
}
```

---

### 8. Customer Chat Widget
**File**: `/client/src/components/customer-chat-widget.tsx` (TO BE CREATED)

**Purpose**: Floating chat widget for customer-facing assistant

**Features Needed**:
- Floating button (bottom-right corner)
- Expandable chat window
- Message thread with citations
- Citation indicators (e.g., "[1]")
- Citation expansion on hover/click
- Action confirmation UI:
  - Pending actions listed
  - Confirm/Cancel buttons
  - Explanation of what will happen
- Typing indicators
- Online/offline status
- Close/minimize controls
- Responsive design (mobile-friendly)

**API Integration**:
```typescript
POST /api/assistant/conversations (start session)
POST /api/assistant/conversations/:id/messages
GET /api/assistant/conversations/:id/messages
GET /api/assistant/actions/pending
POST /api/assistant/actions/:id/confirm
POST /api/assistant/actions/:id/reject
```

**Message Format with Citations**:
```typescript
interface AssistantMessage {
  role: "assistant" | "customer";
  content: string;
  citations?: Array<{
    knowledgeItemId: number;
    versionId: number;
    title: string;
    itemType: string;
    snippet: string;
  }>;
  actionRequest?: {
    actionId: string;
    actionType: string;
    description: string;
    parameters: any;
  };
  timestamp: string;
}
```

**Example Conversation**:
```
Customer: "How does autopay work?"