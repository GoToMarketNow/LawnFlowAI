# LawnFlow AI - UI Architecture

## Information Architecture (IA) Map

```
LawnFlow AI
├── Authentication Layer
│   ├── /login          - Email/password login
│   ├── /register       - Account creation
│   └── /verify-phone   - Phone verification
│
├── Onboarding
│   └── /onboarding     - Business setup wizard
│
└── Main Application (Authenticated)
    │
    ├── SIDEBAR NAVIGATION
    │   │
    │   ├── [CORE]
    │   │   ├── Dashboard (/)           - Home overview
    │   │   └── Inbox (/inbox)          - Unified approvals queue [BADGE: pending count]
    │   │
    │   ├── [OPERATIONS]
    │   │   ├── Jobs (/jobs)            - Job pipeline management
    │   │   ├── Quotes (/quotes)        - Quote management
    │   │   ├── Schedule (/schedule)    - Calendar & route view
    │   │   └── Customers (/customers)  - Customer CRM with memory
    │   │
    │   ├── [AI & AUTOMATION]
    │   │   └── Agents (/agents)        - Agent directory
    │   │
    │   └── [ADMIN] (OWNER/ADMIN only)
    │       └── Settings (/settings)    - Business configuration
    │
    └── TOPBAR
        ├── Sidebar toggle
        ├── Page title / breadcrumb
        ├── Quick actions (role-based)
        ├── Notifications bell
        └── User menu + Theme toggle
```

## Role-Based Access Matrix

| Route           | OWNER/ADMIN | CREW_LEAD | STAFF |
|-----------------|-------------|-----------|-------|
| Dashboard       | Full        | Limited   | Minimal |
| Inbox           | All items   | Assigned  | Messages only |
| Jobs            | Full CRUD   | View assigned | View assigned |
| Quotes          | Full CRUD   | Create only | Hidden |
| Schedule        | Full view   | My route  | Hidden |
| Customers       | Full CRM    | View only | Hidden |
| Agents          | Full config | View only | Hidden |
| Settings        | Full access | Hidden    | Hidden |

## Route Map (wouter)

```typescript
// Authentication Routes (no layout)
/login                    → LoginPage
/register                 → RegisterPage
/verify-phone             → VerifyPhonePage

// Onboarding (minimal layout)
/onboarding               → OnboardingPage

// Main App Routes (AuthenticatedLayout with sidebar)
/                         → Dashboard (Home)
/inbox                    → InboxPage (Unified Approvals)
/inbox/:taskId            → InboxPage with task detail drawer

/jobs                     → JobsPage (Pipeline view)
/jobs/:id                 → JobDetailPage

/quotes                   → QuotesPage
/quotes/:id               → QuoteDetailPage
/quotes/new               → QuoteBuilderPage

/schedule                 → SchedulePage (Calendar + Route)

/customers                → CustomersPage (List)
/customers/:id            → CustomerDetailPage (with memory viewer)

/agents                   → AgentsDirectoryPage
/agents/:agentId          → AgentsDirectoryPage with detail drawer

/settings                 → SettingsPage
/settings/profile         → ProfilePage
/settings/business        → BusinessProfilePage
/settings/integrations    → IntegrationsPage
/settings/policies        → AutomationPoliciesPage

// Legacy routes (redirect or deprecate)
/conversations            → Redirect to /inbox
/pending-actions          → Redirect to /inbox
/simulator                → Move to /settings/simulator
/audit-log                → Move to /settings/audit
```

## Dashboard Zones

### 1. Today Overview
- Jobs scheduled today (count + list preview)
- Quotes pending customer response
- Revenue metrics (daily/weekly)

### 2. Needs You (Priority)
- Pending approvals requiring action
- Low-confidence AI decisions
- Customer replies needing response
- Integration errors
- **Always visible, max 5 items, link to full Inbox**

### 3. Agent Activity
- Recent agent runs (last 24h)
- Success/error ratio
- Active agents count
- Last error summary if any

### 4. Customer Health
- NPS snapshot (if available)
- New customers this week
- Returning customer rate

## Component Inventory

### Layout Components
- `AppLayout` - Main authenticated layout with sidebar + topbar
- `AppSidebar` - Navigation sidebar with role-based items
- `Topbar` - Header with actions and user menu
- `RoleGate` - Conditional render based on user role
- `NavGroup` - Sidebar navigation group with label

### Dashboard Components
- `MetricCard` - Stats display with trend indicator
- `NeedsYouSection` - Priority task preview cards
- `AgentActivityFeed` - Recent agent runs timeline
- `TodayOverview` - Jobs/quotes summary for today

### Inbox Components
- `TaskCard` - Expandable approval item
- `SLABadge` - Time urgency indicator (Urgent/Warning/Normal)
- `TaskTypeIcon` - Icon by task type
- `ApprovalActions` - Approve/Reject button group
- `TaskDetailDrawer` - Slide-out panel with full context

### Agent Directory Components
- `AgentCard` - Agent summary with status pill
- `AgentStatusPill` - Active/Paused/Error/Needs Config
- `PhaseSection` - Agents grouped by lifecycle stage
- `DomainTag` - Badge for agent domain
- `AgentDetailDrawer` - Full agent info + controls

### Shared Components
- `StatusBadge` - Generic status indicator
- `EmptyState` - No data placeholder with CTA
- `LoadingState` - Skeleton loaders
- `DataTable` - Sortable, filterable table
- `DetailDrawer` - Slide-out panel base component

## Acceptance Criteria

### Dashboard (/)
- [ ] Displays 4 metric cards: Jobs Today, Pending Quotes, Revenue, Customers
- [ ] "Needs You" section shows max 5 pending items with SLA badges
- [ ] Each pending item is clickable and resolves in ≤2 clicks
- [ ] Agent Activity shows last 5 runs with status
- [ ] Responsive: 4-col grid on desktop, 2-col on tablet, 1-col on mobile

### Inbox (/inbox)
- [ ] Single unified queue of all human-required actions
- [ ] Task types: Quote Approval, Crew Assignment, Low Confidence, Customer Reply, Error
- [ ] Each task shows: urgency, due-by, customer, job, recommended action
- [ ] One-click primary action: Approve/Send/Confirm/Assign
- [ ] After action: orchestrator resumes automatically
- [ ] Filter by: type, urgency, date range
- [ ] Sort by: urgency (default), date, customer

### Agent Directory (/agents)
- [ ] Grouped by lifecycle: Lead → Quote → Confirm → Schedule → Assign → Book → Post-job
- [ ] Domain tags visible: Messaging, Pricing, Scheduling, Routing, Crew Ops, Memory, Integrations
- [ ] Status pills: Active (green), Paused (yellow), Error (red), Needs Config (gray)
- [ ] Click agent opens detail drawer
- [ ] Detail drawer shows: Purpose, Inputs, Outputs, Triggers, Last 10 runs, Controls

### Jobs (/jobs)
- [ ] Pipeline view with columns: New, Triaged, Scheduled, In Progress, Completed
- [ ] Quick filters by crew, date, status
- [ ] Click job opens detail modal
- [ ] OWNER/ADMIN can reassign, CREW_LEAD views assigned only

### Quotes (/quotes)
- [ ] List view with status: Draft, Sent, Accepted, Declined, Expired
- [ ] OWNER/ADMIN can approve/send quotes
- [ ] CREW_LEAD can create quotes only
- [ ] Click opens quote detail with customer context

### Schedule (/schedule)
- [ ] Calendar view (week/day toggle)
- [ ] Route visualization for selected day
- [ ] Color-coded by crew
- [ ] Click job shows quick details

### Customers (/customers)
- [ ] Searchable list with last interaction date
- [ ] Customer detail shows: profile, memories, interaction history
- [ ] Memory viewer with semantic search
- [ ] OWNER/ADMIN full access, CREW_LEAD view only

### Settings (/settings)
- [ ] OWNER/ADMIN only (hidden from CREW_LEAD, STAFF)
- [ ] Sections: Profile, Business, Service Area, Pricing, Policies, Integrations, Team
