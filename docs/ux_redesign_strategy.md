# LawnFlow AI - UX Redesign Strategy V2

## Executive Summary

This document defines the "UX Operating System" redesign for LawnFlow AI. The goal is to create a calm, efficient operations interface where:
- Operators spend most time in Work Queue, Approvals, Today Plan, and Comms
- Agents are "invisible but accountable" - every action has clear reasoning
- Settings support configuration, overrides, and safe manual edits
- Orchestration reliably invokes all relevant agents for Lead→Cash workflows

---

## 1. Information Architecture

### Role-Based Navigation

#### OWNER_ADMIN Primary Nav
| Section | Items | Description |
|---------|-------|-------------|
| Core | Home, Work Queue, Approvals | Primary operating surfaces |
| Operations | Schedule, Crews, Comms, Customers | Day-to-day management |
| Billing | Invoices, Issues, Payments | Financial operations |
| Settings | Agents, Policies, Services, Integrations, Users, Templates, Observability, Exports | Configuration |

#### CREW_LEAD Primary Nav
| Section | Items | Description |
|---------|-------|-------------|
| Work | Today Plan, My Crew | Day's work and team |
| Comms | Crew Inbox, Notifications | Communication |

#### CREW_MEMBER Primary Nav
| Section | Items | Description |
|---------|-------|-------------|
| Work | Today Plan, My Jobs | Today's assignments |
| Alerts | Notifications | Updates and alerts |

### Global Layout Patterns

1. **3-Panel Pattern** - Used for Work Queue, Approvals, Billing Issues, Comms Inbox
   - Left: Filterable list with priority indicators
   - Center: Selected item details with full context
   - Right: Agent trace, actions, and suggested resolution

2. **Drawer Pattern** - Quick actions (edit, approve, message)
   - Slides from right
   - Doesn't lose list context
   - Fast keyboard navigation

3. **Status Badges** - Consistent across app
   - Confidence: HIGH (green), MEDIUM (amber), LOW (red)
   - Priority: URGENT (red), HIGH (amber), NORMAL (muted)
   - SLA: On Track (green), At Risk (amber), Overdue (red)

---

## 2. Page Specifications

### A) Home / Command Center (`/home`)

**Purpose**: Single-glance ops health dashboard

**KPI Tiles** (row 1):
- Leads Today (new, converted, pending)
- Quotes Active (sent, accepted, expired)
- Jobs Today (scheduled, completed, issues)
- Crew Status (active, on-route, idle)
- Unpaid Invoices (count, total $, overdue)

**Feeds** (row 2, two columns):
1. **Action Required** - Human tasks needing attention
   - Pending approvals (quotes, schedules, credits)
   - Escalations from agents
   - SLA warnings
   
2. **Agent Activity** - Recent autonomous work
   - Quotes generated
   - Messages sent
   - Schedule adjustments
   - Invoice reminders

### B) Work Queue (`/work`)

**Purpose**: Unified inbox for all actionable items

**Item Types**:
- LEAD - New leads needing qualification
- QUOTE - Quotes needing review/send
- SCHEDULE - Schedule conflicts or changes
- CREW - Crew assignments needing attention
- COMMS - Messages requiring response
- BILLING - Invoice issues or disputes

**Each Item Shows**:
- Type icon + priority badge
- Subject line + customer name
- SLA indicator (time remaining)
- Confidence score (if agent-generated)
- Recommended action

**3-Panel Layout**:
- Left: Filtered list (by type, priority, age)
- Center: Full item details + history
- Right: Agent trace + suggested actions

### C) Approvals (`/approvals`)

**Purpose**: Fast approval interface for human-in-loop decisions

**Approval Types**:
- Quote approvals (variance > threshold, special promos)
- Schedule/crew reassignment approvals
- Billing approvals (credits > $50, adjustments)
- Policy exceptions

**Approval Card Contents**:
- What changed (before/after comparison)
- Why flagged (variance %, confidence, rule triggered)
- Agent reasoning (summary + expand for full trace)
- Actions: Approve / Edit / Reject (with reason dropdown)

**Keyboard Shortcuts**:
- `a` - Approve
- `e` - Edit
- `r` - Reject
- `j/k` - Next/Previous item

### D) Schedule / Today Plan (`/schedule`)

**Views**:
- Week View (default for OWNER_ADMIN)
- Day Plan View (grouped by crew)

**Day Plan Features**:
- Crews as rows, time slots as columns
- Jobs positioned by scheduled time
- Risk flags visible (late arrival, equipment issue)
- Drag-drop for quick reassignment (OWNER_ADMIN only)

**Crew Role Simplification**:
- CREW_LEAD: Own crew only, read-only for others
- CREW_MEMBER: Own jobs only, checklist focus

### E) Crews (`/operations/crews`)

**Roster View** (default):
- Crew card per team
- Leader, members, truck, assets
- Readiness status (Ready, On Site, Running Late, Off Hours)
- Quick actions: Message, View Schedule

**Live Map View**:
- Map with crew markers
- Last known location + timestamp
- Status color coding
- Click for crew detail

### F) Comms (`/comms`)

**Tabs**:
1. **Inbox** - Threads requiring response
   - Customer threads
   - Crew threads
   - Escalation state visible
   
2. **Studio** - Outbound management
   - Sequences
   - Templates
   - Review requests
   - Crew briefings

**Thread View**:
- Context panel (customer, related jobs)
- Agent suggestion (if available)
- Compose with templates

### G) Billing (`/billing`)

**Sub-Pages**:
- `/billing/invoices` - Draft, Sent, Paid, Overdue
- `/billing/issues` - Sync errors, disputes, variances
- `/billing/payments` - Payment status from QuickBooks

**Exception Flow**:
- All exceptions surface in Work Queue
- Critical exceptions also in Approvals
- Resolution tracking with audit trail

---

## 3. Settings Map

Settings organized by purpose: "What agents need to run" vs "Admin utilities"

### 3.1 Business Profile (`/settings/profile`)
- Service area (zip coverage + map)
- Business hours, service days
- Contact channels (phone, SMS, email)

### 3.2 Services Catalog (`/settings/services`)
- Offered services + variants
- Lead time requirements
- Delivery vs install options
- Material profiles (mulch, firewood)

### 3.3 Pricing & Policies (`/settings/pricing`)
- Pricing models (per-visit, per-sqft, per-load)
- Price ranges and frequency modifiers
- Quote variance thresholds
- Approval rules
- Seasonal adjustments

### 3.4 Promotions (`/settings/promotions`)
- Rule-based promotions
- First-time discounts
- Recurring incentives
- Bundle discounts

### 3.5 Comms & Templates (`/settings/templates`)
- SMS/Email templates
- Crew briefing templates
- Language settings (EN/ES)
- Escalation routing rules

### 3.6 Integrations (`/settings/integrations`)
- Jobber (sync, webhooks, source-of-truth)
- Twilio (messaging service, numbers)
- Google Maps (API key, geocoding)
- QuickBooks (OAuth, mappings, sync health)

### 3.7 Billing Configuration (`/settings/billing-config`)
- Invoice terms, tax defaults
- Service → accounting item mapping
- Collections cadence (reminder days)
- Credit approval thresholds

### 3.8 Users & Roles (`/settings/users`)
- User management
- Crew assignments
- Leader designation
- Notification preferences

### 3.9 Agents (`/settings/agents`)
- Agent status and health
- Confidence thresholds
- Kill switches
- Agent-specific overrides

### 3.10 Observability (`/settings/observability`)
- Agent run logs
- Failed sync queue
- Retry controls
- Activity audit trail

### 3.11 Exports (`/settings/exports`)
- Data export tools
- Report generation
- Scheduled exports

---

## 4. Orchestration Map

### Agent Directory by Lifecycle Stage

#### Lead/Qualification Agents
| Agent | Purpose | Trigger |
|-------|---------|---------|
| IntakeAgent | Parse inbound leads, qualify | SMS/Email received |
| ServiceSelectionAgent | Match intent to services | Lead qualified |
| QualificationAgent | Ask missing info | Missing required fields |
| FeasibilityAgent | Check coverage + capacity | Service selected |

#### Quote/Pricing Agents
| Agent | Purpose | Trigger |
|-------|---------|---------|
| PricingAgent | Calculate prices | Service + property known |
| PromotionAgent | Apply eligible discounts | Price calculated |
| QuoteAgent | Assemble quote document | Pricing complete |
| PreferenceAgent | Apply customer preferences | Quote building |

#### Schedule/Crew Assignment Agents
| Agent | Purpose | Trigger |
|-------|---------|---------|
| ScheduleProposalAgent | Propose available slots | Quote accepted |
| CrewIntelligenceAgent | Evaluate crew eligibility | Slot proposed |
| SimulationRankingAgent | Score candidate assignments | Crews identified |
| JobFeasibilityAgent | Evaluate assignment feasibility | Crew selected |
| MarginBurnAgent | Calculate profitability | Assignment proposed |
| OrchestratorAgent | Manage decision workflow | Assignment ready |

#### Comms Agents
| Agent | Purpose | Trigger |
|-------|---------|---------|
| CustomerCommsAgent | Send customer messages | Job events |
| CrewCommsWorkerAgent | Notify crews (EN/ES) | Schedule changes |
| ReviewsAgent | Request reviews | Job completed |

#### Billing Agents
| Agent | Purpose | Trigger |
|-------|---------|---------|
| InvoiceBuildAgent | Generate invoices | Job completed |
| BillingAgent | Send payment reminders | Invoice overdue |
| ReconciliationWorker | Validate integrity | Nightly / webhook |
| InvoiceSyncAgent | Sync to QuickBooks | Invoice created |
| PaymentSyncAgent | Sync payments | QuickBooks webhook |
| RemediationAgent | Handle disputes | Dispute created |

#### Optimization Agents (Async)
| Agent | Purpose | Frequency |
|-------|---------|-----------|
| PricingOptimizationAgent | Recommend price adjustments | Weekly |
| CapacityForecastingAgent | Forecast crew capacity | Daily |
| CrewPerformanceAgent | Analyze crew metrics | Weekly |
| RetentionAgent | Score churn risk | Post-service |

### Orchestration Flow: Lead Intake

```
[Inbound SMS/Call]
      ↓
IntakeAgent (parse + qualify)
      ↓
ServiceSelectionAgent (map to catalog)
      ↓
[Missing info?] → QualificationAgent → [Ask customer]
      ↓
FeasibilityAgent (coverage + capacity)
      ↓
PricingAgent + PromotionAgent
      ↓
QuoteAgent (assemble)
      ↓
[Confidence < threshold?] → Work Queue + Approval
      ↓
CustomerCommsAgent (send quote)
```

### Orchestration Flow: Quote Accept

```
[Customer accepts]
      ↓
ConfirmAgent (capture acceptance)
      ↓
ScheduleProposalAgent (propose slots)
      ↓
CrewIntelligenceAgent (eligible crews)
      ↓
SimulationRankingAgent (score options)
      ↓
OrchestratorAgent (create decision)
      ↓
[Approval needed?] → Approvals queue
      ↓
BookingAgent (create job)
      ↓
CrewCommsWorkerAgent (notify crew)
```

### Orchestration Flow: Job Complete

```
[Job marked complete]
      ↓
InvoiceBuildAgent (generate invoice)
      ↓
[Variance > threshold?] → Approval
      ↓
InvoiceSyncAgent (sync to QuickBooks)
      ↓
CustomerCommsAgent (send invoice)
      ↓
[Days pass] → BillingAgent (reminders)
```

---

## 5. Design Principles

1. **Calm Operations UI** - Minimal noise, high clarity
2. **One Primary Place to Work** - Work Queue + Approvals
3. **Fast Resolution** - Approvals in <10 seconds
4. **Agents Invisible but Accountable** - Every action has "why" and "what happened"
5. **Role-Specific Simplicity**:
   - Owners: outcomes + exceptions + configuration
   - Crew leads: Today Plan + job details + changes
   - Crew members: Today Plan + alerts + checklists
6. **Progressive Disclosure** - Hide complexity until needed
7. **Guardrails** - Settings changes show downstream impacts

---

## 6. Feature Flag

```
VITE_UI_REDESIGN_V2=true|false
```

When `true`: V2 navigation, enhanced pages, and full settings restructure
When `false`: V1 behavior (or legacy if V1 also off)
