# LawnFlow AI - UI Documentation

## Information Architecture & Routes

### Primary Navigation (Sidebar)

| Route | Page | Description | Access |
|-------|------|-------------|--------|
| `/` | Dashboard | ROI metrics, pending actions, conversation overview | All roles |
| `/inbox` | Inbox | Unified pending approvals with SLA indicators | All roles |
| `/jobs` | Jobs | Job requests, crew assignments, simulation results | All roles |
| `/quotes` | Quotes | Quote management, approval workflows | All roles |
| `/schedule` | Schedule | Calendar view, crew scheduling, job assignments | All roles |
| `/customers` | Customers | Customer list, profiles, interaction history | All roles |
| `/agents` | Agents | Agent directory, configuration, testing | OWNER/ADMIN |
| `/settings` | Settings | Business profile, automation policies | OWNER/ADMIN |

### Role-Based Access Control

| Role | Dashboard | Inbox | Jobs | Quotes | Schedule | Customers | Agents | Settings |
|------|-----------|-------|------|--------|----------|-----------|--------|----------|
| OWNER/ADMIN | Full | All tabs | Full | Full | Full | Full | Full | Full |
| CREW_LEAD | View | Assigned only | Assigned | View | Assigned | View | Hidden | Hidden |
| STAFF | View | Assigned only | Assigned | View | Assigned | View | Hidden | Hidden |

## User Flows

### Flow 1: Owner Approves Quote from Inbox (≤2 clicks)

1. **Dashboard** → See "Pending Actions" card with urgent count
2. **Click pending item** → Navigate to Inbox
3. **Click quote item** → Opens detail drawer
4. **Click "Approve"** → Quote approved, customer notified

### Flow 2: Crew Lead Reviews Assigned Jobs

1. **Jobs page** → Filter by "Assigned" tab
2. **View job details** → Click job card
3. **See crew recommendations** → AI-generated scores
4. **Start job** → Update status to "In Progress"

### Flow 3: Configure AI Agent

1. **Agents page** → Browse by lifecycle stage
2. **Search or filter** → Find specific agent
3. **Click agent card** → Opens config panel
4. **Toggle settings** → Enable/disable, adjust confidence threshold
5. **Test agent** → Run simulation with sample data

### Flow 4: Customer Profile & History

1. **Customers page** → Search by name/phone/email
2. **Click customer row** → Opens profile drawer
3. **View history** → Jobs, quotes, communications
4. **Add note** → Manual annotation for context

## Keyboard Navigation (Inbox)

| Key | Action |
|-----|--------|
| `↓` or `j` | Move focus down |
| `↑` or `k` | Move focus up |
| `Enter` | Open detail drawer |
| `a` | Quick approve focused item |
| `Escape` | Clear focus |

## Component Hierarchy

### Page Layout
```
SidebarProvider
├── AppSidebar (left nav)
│   ├── SidebarHeader (logo, collapsed state)
│   ├── SidebarContent
│   │   ├── SidebarGroup (Main)
│   │   │   └── SidebarMenu → Dashboard, Inbox, Jobs, etc.
│   │   └── SidebarGroup (Settings - role-gated)
│   └── SidebarFooter (user avatar, logout)
└── Main Content Area
    ├── Header (breadcrumbs, actions)
    └── Page Content (ErrorBoundary wrapped)
```

### Key UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `EmptyState` | `components/ui/empty-state.tsx` | Consistent empty views with icon, title, action |
| `ErrorBoundary` | `components/error-boundary.tsx` | Graceful error handling with retry/home options |
| `RoleGate` | `components/role-gate.tsx` | Conditional rendering based on user role |
| `TaskCardSkeleton` | Inline in pages | Loading skeleton for list items |

### Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `142 76% 36%` | Green - CTAs, active states |
| Destructive | `0 84% 60%` | Red - errors, delete actions |
| Warning | `38 92% 50%` | Amber - warnings, SLA indicators |
| Success | `142 76% 36%` | Green - confirmations |

## SLA Indicators (Inbox)

| Priority | Color | Meaning |
|----------|-------|---------|
| Urgent | Red badge | Past SLA, needs immediate action |
| Warning | Amber badge | Approaching SLA |
| Normal | No badge | Within normal timeframe |

## API Endpoints

### Core APIs
- `GET /api/inbox` - Pending approval items
- `POST /api/inbox/:id/resolve` - Approve/reject/retry items
- `GET /api/jobs` - Job requests
- `GET /api/quotes` - Quote list
- `GET /api/ops/crews` - Crew roster
- `GET /api/ops/simulations` - Crew simulations

### Agent APIs
- `GET /api/agents` - List all agents
- `GET /api/agents/:id` - Agent details
- `PATCH /api/agents/:id` - Update agent config
- `POST /api/agents/:id/test` - Test agent execution

### Memory APIs
- `POST /api/memory/upsert` - Store customer memory
- `POST /api/memory/search` - Semantic search
- `GET /api/memory/customer` - Customer profile lookup

## Validation Checklist

- [x] Owner can approve quote from Inbox in ≤2 clicks
- [x] Crew lead sees only assigned jobs/items
- [x] Agent Directory grouped by lifecycle stage
- [x] Customer profiles show interaction history
- [x] Consistent loading skeletons on all pages
- [x] Empty states with actionable CTAs
- [x] Error boundaries with dev-mode details
- [x] Keyboard navigation in Inbox
- [x] Role-based navigation visibility
- [x] Dark mode support throughout
