# LawnFlow AI - UX Build Plan V2

## Overview

This document tracks the implementation of the UX Redesign V2. Each phase is behind the `VITE_UI_REDESIGN_V2` feature flag.

---

## Phase 1: UI Shell & Navigation

**Status**: In Progress

### Tasks

- [x] Create `/docs/ux_redesign_strategy.md`
- [x] Create `/docs/ux_build_plan.md`
- [ ] Add `UI_REDESIGN_V2` feature flag to `client/src/lib/feature-flags.ts`
- [ ] Create `client/src/lib/ui/nav-v3.ts` with complete role-based navigation
- [ ] Update `AppSidebar` to conditionally use nav-v3 when V2 enabled
- [ ] Enhance `/home` (Command Center) with V2 layout
- [ ] Enhance `/work` (Work Queue) with 3-panel layout
- [ ] Enhance `/approvals` with approval cards
- [ ] Add new Settings routes:
  - [ ] `/settings/users` - Users & Roles
  - [ ] `/settings/templates` - Comms & Templates
  - [ ] `/settings/billing-config` - Billing Configuration
  - [ ] `/settings/profile` - Business Profile (redirect from existing)
  - [ ] `/settings/promotions` - Promotions (redirect from existing)

### File Changes

| File | Action | Description |
|------|--------|-------------|
| `client/src/lib/feature-flags.ts` | Edit | Add `UI_REDESIGN_V2` flag |
| `client/src/lib/ui/nav-v3.ts` | Create | V3 navigation config |
| `client/src/components/app-sidebar.tsx` | Edit | Conditional nav switching |
| `client/src/pages/home.tsx` | Edit | Enhanced Command Center |
| `client/src/pages/work-queue.tsx` | Edit | 3-panel unified inbox |
| `client/src/pages/approvals.tsx` | Edit | Approval cards + shortcuts |
| `client/src/pages/settings/users.tsx` | Create | Users & Roles page |
| `client/src/pages/settings/templates.tsx` | Create | Comms templates page |
| `client/src/pages/settings/billing-config.tsx` | Create | Billing config page |
| `client/src/App.tsx` | Edit | Add new routes |

### Test Checklist

#### OWNER/ADMIN
- [ ] See full navigation with all sections
- [ ] Access `/home` with KPI tiles and feeds
- [ ] Access `/work` with 3-panel layout
- [ ] Access `/approvals` with approval cards
- [ ] Access all Settings sub-pages
- [ ] Keyboard shortcuts work in Approvals

#### CREW_LEAD
- [ ] See limited navigation (Today Plan, My Crew, Comms)
- [ ] Cannot access Work Queue, Approvals, or Settings
- [ ] Schedule shows own crew prominently

#### CREW_MEMBER
- [ ] See minimal navigation (Today Plan, Notifications)
- [ ] Cannot access admin functions
- [ ] Schedule shows only own jobs

---

## Phase 2: Work Queue + Approvals Real Data

**Status**: Pending

### Tasks

- [ ] Create unified work queue data model
- [ ] Implement work queue API with filtering
- [ ] Wire Work Queue page to real data
- [ ] Create approvals data model
- [ ] Implement approvals API with actions
- [ ] Wire Approvals page to real data
- [ ] Add deep links from queue items to full views

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/work-queue` | GET | List work queue items |
| `/api/v2/work-queue/:id` | GET | Get item details |
| `/api/v2/work-queue/:id/action` | POST | Take action on item |
| `/api/v2/approvals` | GET | List pending approvals |
| `/api/v2/approvals/:id/approve` | POST | Approve item |
| `/api/v2/approvals/:id/reject` | POST | Reject item |

---

## Phase 3: Billing & Comms Alignment

**Status**: Pending

### Tasks

- [ ] Integrate billing pages with exceptions flow
- [ ] Add billing issues to Work Queue
- [ ] Implement Comms Inbox/Studio split
- [ ] Add agent suggestions to Comms threads
- [ ] Wire escalation state to UI

---

## Phase 4: Settings Restructure

**Status**: Pending

### Tasks

- [ ] Reorganize settings into V2 sections
- [ ] Add impact preview before saving
- [ ] Implement audit trail for settings changes
- [ ] Add service → accounting mapping in billing config
- [ ] Add collections cadence configuration

---

## Phase 5: Observability & Agent Traces

**Status**: Pending

### Tasks

- [ ] Add agent trace panel to Work Queue items
- [ ] Show agent reasoning in Approvals
- [ ] Implement retry controls for failed syncs
- [ ] Add run logs to Observability page
- [ ] Create agent health dashboard

---

## Rollback Plan

If V2 causes issues:
1. Set `VITE_UI_REDESIGN_V2=false` in environment
2. All V2 routes redirect to V1 equivalents
3. V1 functionality preserved
4. No data migration needed

---

## Success Metrics

1. **Approval Speed**: <10 seconds average
2. **Work Queue Latency**: <500ms load time
3. **Navigation Clarity**: Reduced support tickets about "where is X"
4. **Role Satisfaction**: Positive feedback from each role type
