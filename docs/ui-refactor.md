# LawnFlow AI - UI Refactor v1

## Overview

This document maps the UI restructure from the current navigation to the new operating model:
- **Work Queue** - Unified inbox for all actionable items
- **Approvals** - Dedicated fast approval interface
- **Command Center** - Ops-first home dashboard
- **Day Plan** - Crew-grouped schedule view
- **Crews** - Team management with live status
- **Comms** - Customer and crew communications
- **Agents in Settings** - AI agents moved to admin section

## Feature Flag

```
UI_REFACTOR_V1=true|false
```

When `true`: New navigation and routes are active.
When `false`: Legacy navigation remains (default).

## Route Mapping

### Existing Routes → New Routes

| Existing Route | New Route | Status | Notes |
|---------------|-----------|--------|-------|
| `/` (Dashboard) | `/home` | New | Ops Command Center |
| `/dashboard` | `/home` | Redirect | Keep working |
| `/inbox` | `/work` | New | Unified Work Queue |
| `/jobs` | `/jobs` | Keep | No change |
| `/quotes` | `/quotes` | Keep | No change |
| `/schedule` | `/schedule` | Enhanced | Add Day Plan view |
| `/customers` | `/customers` | Keep | No change |
| `/operations/crews` | `/operations/crews` | Keep | Enhanced with status |
| `/operations/zones` | `/operations/zones` | Keep | No change |
| `/agents` | `/settings/agents` | Move | Under Settings |
| `/learning` | `/settings/policies` | Move | Renamed to Policies |
| `/comms` | `/comms` | Keep | Enhanced tabs |
| `/settings` | `/settings` | Keep | Expanded with sub-routes |
| `/pricing` | `/settings/pricing` | Move | Under Settings |
| `/audit` | `/settings/observability` | Move | Under Settings |
| - | `/approvals` | New | Dedicated approvals |
| - | `/notifications` | New | Crew notifications |

### New Routes to Create

| Route | Component | Purpose |
|-------|-----------|---------|
| `/home` | `HomePage` | Ops Command Center with KPIs |
| `/work` | `WorkQueuePage` | Unified inbox for all actionable items |
| `/approvals` | `ApprovalsPage` | Fast approval interface |
| `/notifications` | `NotificationsPage` | Crew member notifications |
| `/settings/agents` | `SettingsAgentsPage` | AI agents (moved from /agents) |
| `/settings/policies` | `SettingsPoliciesPage` | Policies + Learning |
| `/settings/integrations` | `SettingsIntegrationsPage` | External integrations |
| `/settings/observability` | `SettingsObservabilityPage` | Audit + Logs |
| `/settings/exports` | `SettingsExportsPage` | Data exports |

## Components to Reuse

### Pages (Reuse with minimal changes)
- `dashboard.tsx` → Base for `/home` Command Center (enhance with KPI tiles)
- `inbox.tsx` → Base for `/work` Work Queue (enhance with unified model)
- `agents.tsx` → Move to `/settings/agents` (minimal changes)
- `schedule.tsx` → Enhance with Day Plan view toggle
- `crews.tsx` → Add readiness status and quick actions
- `comms-studio.tsx` → Add Inbox/Studio tabs
- `audit-log.tsx` → Move to `/settings/observability`
- `learning.tsx` → Move to `/settings/policies`

### Shared Components (Reuse as-is)
- `app-sidebar.tsx` → Update nav config, keep structure
- `notification-bell.tsx` → Use for crew notifications
- `user-menu.tsx` → No changes
- `theme-toggle.tsx` → No changes
- `role-gate.tsx` → Extend for new CREW_MEMBER checks
- `contextual-drawer.tsx` → Reuse for detail panels

## RBAC Navigation Matrix

| Route | OWNER | ADMIN | CREW_LEAD | CREW_MEMBER |
|-------|-------|-------|-----------|-------------|
| `/home` | Y | Y | - | - |
| `/work` | Y | Y | - | - |
| `/approvals` | Y | Y | - | - |
| `/schedule` | Y | Y | Y | Y |
| `/operations/crews` | Y | Y | Y (own) | - |
| `/comms` | Y | Y | Y | - |
| `/customers` | Y | Y | - | - |
| `/notifications` | - | - | Y | Y |
| `/settings` | Y | Y | - | - |
| `/settings/*` | Y | Y | - | - |

Note: CREW_MEMBER is a new role-level (below STAFF in the refactor context).

## Implementation Phases

1. **Phase 0 (Prep)**: This document + feature flag - COMPLETE
2. **Phase 1**: New navigation config + route setup - COMPLETE
   - Feature flag system in `client/src/lib/feature-flags.ts`
   - Nav config with role-based menus in `client/src/lib/ui/nav-v2.ts`
   - Updated `AppSidebar` with conditional rendering
   - New routes in `App.tsx` with redirects
   - Settings sub-pages created
   - Backend API stubs: `/api/ops/kpis`, `/api/work-queue`, `/api/approvals`
3. **Phase 2**: Home (Command Center) - COMPLETE
   - `HomePage` with KPI tiles, Work Queue preview, Approval queue preview
4. **Phase 3**: Work Queue unified inbox - COMPLETE
   - `WorkQueuePage` with filtering by status/priority
5. **Phase 4**: Approvals interface - COMPLETE  
   - `ApprovalsPage` with fast approve/reject actions
6. **Phase 5**: Schedule (Day Plan) - Pending
7. **Phase 6**: Crews + Comms polish + Agents to Settings - Pending
8. **Phase 7**: Cleanup + QA - Pending

## Testing by Role

### OWNER/ADMIN
1. See full navigation: Home, Work, Approvals, Schedule, Crews, Comms, Customers, Settings
2. Access all Settings sub-pages including Agents
3. View all KPIs and queues

### CREW_LEAD
1. See limited navigation: Schedule, Crews (own), Comms, Notifications
2. Cannot access Work Queue, Approvals, or Settings
3. Schedule shows only their crew

### CREW_MEMBER  
1. See minimal navigation: Schedule (Today), Notifications
2. Schedule shows only their jobs for today
3. No access to admin functions
