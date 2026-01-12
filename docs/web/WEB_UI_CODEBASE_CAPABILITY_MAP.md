# LawnFlow Web UI - Codebase Capability Map

**Purpose**: Inventory of existing capabilities extracted from code, mapped to implementation files and backend endpoints.

**Date**: January 12, 2026
**Source**: Full repository scan of `/workspaces/LawnFlowAI`

---

## 1. FRONT-END APPLICATION ARCHITECTURE

### 1.1 Application Type
- **Framework**: React 18.3.1 + Vite 7.3.0
- **Routing**: Wouter 3.3.5 (lightweight React Router alternative)
- **State Management**: TanStack Query 5.60.5 (React Query)
- **UI Framework**: Radix UI + shadcn/ui patterns
- **Styling**: Tailwind CSS 3.4.17 + CSS Variables
- **TypeScript**: 5.6.3

### 1.2 Entry Points
- **Main App**: [client/src/main.tsx](client/src/main.tsx:1) → mounts React root
- **Root Component**: [client/src/App.tsx](client/src/App.tsx:1) → routing + layout shell
- **Route Registration**: Lines 235-312 in App.tsx

### 1.3 Layout Architecture
```
<QueryClientProvider>
  <ThemeProvider> (light/dark mode)
    <TooltipProvider>
      <AuthProvider> (session management)
        <DrawerProvider> (contextual panels)
          <SidebarProvider> (persistent left nav)
            <AppSidebar /> (navigation)
            <Header>
              <SidebarTrigger />
              <PageTitle />
              <GlobalSearch />
              <NotificationBell />
              <ThemeToggle />
              <UserMenu />
            </Header>
            <Main>
              <ErrorBoundary>
                <Route Components />
              </ErrorBoundary>
            </Main>
            <ContextualDrawer /> (slide-out panels)
```

**Key Files**:
- Layout shell: [client/src/App.tsx](client/src/App.tsx:176-322)
- Sidebar nav: [client/src/components/app-sidebar.tsx](client/src/components/app-sidebar.tsx:1)
- Auth context: [client/src/lib/auth-context.tsx](client/src/lib/auth-context.tsx:1)
- Drawer context: [client/src/lib/drawer-context.tsx](client/src/lib/drawer-context.tsx:1)

---

## 2. DESIGN SYSTEM & COMPONENT LIBRARY

### 2.1 Design Tokens
**Location**: Defined in Tailwind config + CSS variables

**Tokens Available**:
- **Colors**: Primary (green), destructive (red), warning (amber), success (green), muted, accent
- **Typography**: Font families (Inter), scale (display/heading/body/label/caption)
- **Spacing**: 8pt grid (2, 4, 8, 12, 16, 20, 24, 32, 40, 48)
- **Radius**: Border radius scale (2, 4, 6, 8, 12, 16)
- **Shadows**: Elevation levels (sm, default, md, lg, xl)

**Reference**: [docs/design-system-spec.md](docs/design-system-spec.md:1)

### 2.2 UI Components (shadcn/ui)
**Location**: [client/src/components/ui/](client/src/components/ui/)

**Foundation Components** (48 total):
- Layout: Card, Separator, ScrollArea, Resizable, Sidebar
- Inputs: Button, Input, Textarea, Select, Checkbox, RadioGroup, Switch, Slider
- Navigation: Tabs, Breadcrumb, Pagination, NavigationMenu, Menubar
- Feedback: Alert, AlertDialog, Toast, Toaster, Dialog, Sheet, Drawer, HoverCard, Tooltip, Popover
- Data Display: Table, Badge, Avatar, Skeleton, EmptyState, Chart
- Advanced: Command (cmdk), Calendar, Form, Accordion, Collapsible, Carousel, ToggleGroup, DropdownMenu, ContextMenu

**Charts**: Recharts 2.15.2 integration in [client/src/components/ui/chart.tsx](client/src/components/ui/chart.tsx:1)

### 2.3 Custom Business Components
**Location**: [client/src/components/](client/src/components/)

| Component | File | Purpose |
|-----------|------|---------|
| GlobalSearch | [global-search.tsx](client/src/components/global-search.tsx:1) | Command palette (Cmd+K) |
| NotificationBell | [notification-bell.tsx](client/src/components/notification-bell.tsx:1) | Real-time alerts |
| UserMenu | [user-menu.tsx](client/src/components/user-menu.tsx:1) | Profile + logout |
| RoleGate | [role-gate.tsx](client/src/components/role-gate.tsx:1) | RBAC conditional render |
| ErrorBoundary | [error-boundary.tsx](client/src/components/error-boundary.tsx:1) | Graceful error handling |
| ContextualDrawer | [contextual-drawer.tsx](client/src/components/contextual-drawer.tsx:1) | Slide-out detail panels |
| ThemeToggle | [theme-toggle.tsx](client/src/components/theme-toggle.tsx:1) | Light/dark mode switcher |
| MarginAlertTile | [margin-alert-tile.tsx](client/src/components/margin-alert-tile.tsx:1) | Profit protection alerts |
| GrowthAdvisorWidget | [growth-advisor-widget.tsx](client/src/components/growth-advisor-widget.tsx:1) | AI recommendations |
| SystemStatus | [system-status.tsx](client/src/components/system-status.tsx:1) | Health indicators |

**Ops-Specific Components**:
- [client/src/components/ops/job-queue.tsx](client/src/components/ops/job-queue.tsx:1) - Job list with filters
- [client/src/components/ops/simulation-cards.tsx](client/src/components/ops/simulation-cards.tsx:1) - Crew simulation results
- [client/src/components/ops/ops-map.tsx](client/src/components/ops/ops-map.tsx:1) - Geographic visualization

**Onboarding Components**:
- [client/src/components/onboarding/OnboardingWizard.tsx](client/src/components/onboarding/OnboardingWizard.tsx:1) - Multi-step wizard
- [client/src/components/onboarding/QuestionRenderer.tsx](client/src/components/onboarding/QuestionRenderer.tsx:1) - Dynamic form builder
- [client/src/components/onboarding/ReviewStep.tsx](client/src/components/onboarding/ReviewStep.tsx:1) - Summary review

---

## 3. EXISTING SCREEN INVENTORY (50+ PAGES)

### 3.1 Core Operations Pages

#### Dashboard & Command Center
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/` or `/dashboard` | [dashboard.tsx](client/src/pages/dashboard.tsx:1) | ROI metrics, pending actions, conversation overview | `GET /api/dashboard` |
| `/home` | [home.tsx](client/src/pages/home.tsx:1) | Simplified owner view (UI_REFACTOR_V1) | `GET /api/dashboard` |
| `/ops` | [ops-dashboard.tsx](client/src/pages/ops-dashboard.tsx:1) | Operations command center | `GET /api/ops/*` |

**Capabilities**:
- Real-time metrics (jobs, quotes, revenue, margin)
- Pending action widgets
- Conversation overview
- Profit protection alerts
- Growth advisor recommendations

#### Inbox & Work Queue
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/inbox` | [inbox.tsx](client/src/pages/inbox.tsx:1) | Unified pending approvals with SLA indicators | `GET /api/inbox` |
| `/work` | [work-queue.tsx](client/src/pages/work-queue.tsx:1) | Task-based work queue (UI_REFACTOR_V1) | `GET /api/inbox` |
| `/approvals` | [approvals.tsx](client/src/pages/approvals.tsx:1) | Approval-focused view | `GET /api/inbox` |
| `/actions` | [pending-actions.tsx](client/src/pages/pending-actions.tsx:1) | Pending AI actions requiring approval | `GET /api/actions` |

**Capabilities**:
- SLA urgency indicators (red/amber/yellow/green)
- Keyboard navigation (j/k, Enter, a for approve)
- Filter by type, priority, SLA status
- Bulk actions
- Inline approval/rejection

### 3.2 Customer & Communications

#### Customer Management
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/customers` | [customers.tsx](client/src/pages/customers.tsx:1) | Customer list with search | `GET /api/customers` |
| `/customers/:id` | [conversation-detail.tsx](client/src/pages/conversation-detail.tsx:1) | Customer profile + interaction history | `GET /api/customers/:id` |
| `/conversations` | [conversations.tsx](client/src/pages/conversations.tsx:1) | All customer conversations | `GET /api/conversations` |

**Capabilities**:
- Search by name/phone/email
- Customer profile detail drawer
- Interaction timeline (SMS, calls, jobs, payments)
- Add manual notes
- Customer sentiment indicators

#### Communications Studio
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/comms` | [comms-studio.tsx](client/src/pages/comms-studio.tsx:1) | Template builder, message history | `GET /api/comms/templates` |
| `/sms` | [sms-sessions.tsx](client/src/pages/sms-sessions.tsx:1) | SMS session manager | `GET /api/sms/sessions` |
| `/operations/comms` | [operations/comms.tsx](client/src/pages/operations/comms.tsx:1) | Active communications monitoring | `GET /api/comms/active` |
| `/operations/comms/active` | [operations/comms/active.tsx](client/src/pages/operations/comms/active.tsx:1) | Real-time comms feed | WebSocket + `GET /api/comms/active` |

**Capabilities**:
- SMS template creation
- Message preview
- Send history
- Active session monitoring
- Carbon copy routing

### 3.3 Jobs, Quotes, Scheduling

#### Jobs Management
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/jobs` | [jobs.tsx](client/src/pages/jobs.tsx:1) | Job requests, crew assignments, status tracking | `GET /api/jobs` |
| `/schedule` | [schedule.tsx](client/src/pages/schedule.tsx:1) | Calendar view, crew scheduling | `GET /api/schedule` |

**Capabilities**:
- Job lifecycle (new → assigned → in_progress → completed → paid)
- Crew assignment recommendations (AI-driven)
- Simulation results (crew-to-job matching)
- Status filters
- Map view of job locations

#### Quotes Management
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/quotes` | [quotes.tsx](client/src/pages/quotes.tsx:1) | Quote list, approval workflows | `GET /api/quotes` |
| `/quote-builder` | [quote-builder.tsx](client/src/pages/quote-builder.tsx:1) | Interactive quote creation | `POST /api/quotes` |

**Capabilities**:
- Quote approval workflow
- Pricing simulation
- Service selection
- Frequency options
- Auto-send on approval

### 3.4 Crews & Operations

#### Crew Management
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/operations/crews` | [crews.tsx](client/src/pages/crews.tsx:1) | Crew roster, performance metrics | `GET /api/ops/crews` |
| `/operations/crews/:id` | [crew-detail.tsx](client/src/pages/crew-detail.tsx:1) | Crew leader profile, assignments, performance | `GET /api/ops/crews/:id` |
| `/crew-inbox` | [crew-inbox.tsx](client/src/pages/crew-inbox.tsx:1) | Crew leader view (mobile-optimized) | `GET /api/crew/inbox` |
| `/operations/zones` | [zones.tsx](client/src/pages/zones.tsx:1) | Service area zones | `GET /api/ops/zones` |

**Capabilities**:
- Crew roster management
- Performance tracking (margin, speed, quality)
- Assignment history
- Crew-to-job simulations
- Zone-based routing

### 3.5 Billing & Payments

#### Billing Management
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/billing` | [billing.tsx](client/src/pages/billing.tsx:1) | Billing overview dashboard | `GET /api/billing` |
| `/billing/invoices` | [billing-invoices.tsx](client/src/pages/billing-invoices.tsx:1) | Invoice list | `GET /api/billing/invoices` |
| `/billing/payments` | [billing-payments.tsx](client/src/pages/billing-payments.tsx:1) | Payment history | `GET /api/billing/payments` |
| `/billing/issues` | [billing-issues.tsx](client/src/pages/billing-issues.tsx:1) | Failed payments, AR aging | `GET /api/billing/issues` |

**Capabilities**:
- AR aging report
- Failed payment tracking
- Autopay adoption metrics
- Payment retry actions
- Invoice generation

### 3.6 Agent Management Studio

#### Agent Configuration & Monitoring
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/agents` | [agents.tsx](client/src/pages/agents.tsx:1) | Agent directory grouped by lifecycle stage | `GET /api/agents` |
| `/agents/:id` | [agent-detail.tsx](client/src/pages/agent-detail.tsx:1) | Agent config panel, test execution | `GET /api/agents/:id`, `PATCH /api/agents/:id` |
| `/agent-setup` | [agent-setup.tsx](client/src/pages/agent-setup.tsx:1) | Initial agent configuration wizard | `POST /api/agents/setup` |
| `/events` | [events-feed.tsx](client/src/pages/events-feed.tsx:1) | Agent event timeline | `GET /api/events` |

**Capabilities**:
- Agent catalog (Lead-to-Cash, Quote, Billing, Post-Job QA, Crew Intelligence)
- Enable/disable agents
- Confidence threshold adjustment
- Test agent execution with sample data
- Event timeline (all agent actions)
- Failure triage

### 3.7 Knowledge Base & Support Queue

#### Knowledge Management (PSKB)
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/knowledge` | [knowledge-list.tsx](client/src/pages/knowledge-list.tsx:1) | Knowledge item list with filters | `GET /api/knowledge/items` |
| `/knowledge/builder` | [knowledge-builder.tsx](client/src/pages/knowledge-builder.tsx:1) | Create/edit knowledge items | `POST /api/knowledge/items` |
| `/knowledge/approvals` | [knowledge-approvals.tsx](client/src/pages/knowledge-approvals.tsx:1) | Approval queue for knowledge | `GET /api/knowledge/approvals/pending` |
| `/knowledge/reviews` | [knowledge-reviews.tsx](client/src/pages/knowledge-reviews.tsx:1) | Scheduled review calendar | `GET /api/knowledge/reviews/due` |

**Capabilities** (Sprint 1 Backend Complete):
- 6 knowledge types: Policy, Service, Payment, Operations, Proof of Work, Macro
- Version control (immutable history)
- Approval workflow (draft → review → published)
- Hybrid search (semantic + keyword)
- Citation enforcement
- Review scheduling

#### Support Queue
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/support/queue` | [support-queue.tsx](client/src/pages/support-queue.tsx:1) | Enriched support threads with SLA tracking | `GET /api/support/queue` |
| `/support/thread/:id` | [thread-detail.tsx](client/src/pages/thread-detail.tsx:1) | Thread detail with AI assistant context | `GET /api/support/queue/:threadId` |
| `/support/gaps` | [coverage-gaps.tsx](client/src/pages/coverage-gaps.tsx:1) | Knowledge coverage gap analysis | `GET /api/support/coverage-gaps` |

**Capabilities** (Sprint 2 Backend Complete):
- Thread enrichment (intent classification, priority, sentiment)
- SLA tracking (first response, resolution)
- PSKB coverage detection
- Macro suggestions
- Coverage gap trends

### 3.8 Settings & Configuration

#### Settings Hub
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/settings` | [settings.tsx](client/src/pages/settings.tsx:1) | Settings hub (UI_REFACTOR_V1) | - |
| `/settings/agents` | [settings/agents.tsx](client/src/pages/settings/agents.tsx:1) | Agent configuration | `GET /api/agents` |
| `/settings/policies` | [settings/policies.tsx](client/src/pages/settings/policies.tsx:1) | Business policy management | `GET /api/policies` |
| `/settings/pricing` | [settings/pricing.tsx](client/src/pages/settings/pricing.tsx:1) | Pricing rules | `GET /api/pricing/rules` |
| `/settings/integrations` | [settings/integrations.tsx](client/src/pages/settings/integrations.tsx:1) | Third-party integrations | `GET /api/integrations` |
| `/settings/observability` | [settings/observability.tsx](client/src/pages/settings/observability.tsx:1) | Audit logs, monitoring | `GET /api/audit` |
| `/settings/exports` | [settings/exports.tsx](client/src/pages/settings/exports.tsx:1) | Data export tools | `POST /api/exports` |
| `/settings/services` | [settings/services.tsx](client/src/pages/settings/services.tsx:1) | Service offerings | `GET /api/services` |
| `/settings/users` | [settings/users.tsx](client/src/pages/settings/users.tsx:1) | User management | `GET /api/users` |
| `/settings/templates` | [settings/templates.tsx](client/src/pages/settings/templates.tsx:1) | Message templates | `GET /api/comms/templates` |
| `/settings/billing-config` | [settings/billing-config.tsx](client/src/pages/settings/billing-config.tsx:1) | Billing preferences | `GET /api/billing/config` |
| `/settings/comms-studio` | [settings/comms-studio.tsx](client/src/pages/settings/comms-studio.tsx:1) | Communications settings | `GET /api/comms/config` |

**Legacy Settings Pages** (pre-UI_REFACTOR_V1):
- `/profile` → [business-profile.tsx](client/src/pages/business-profile.tsx:1) - Business profile editing
- `/pricing` → [pricing-control-center.tsx](client/src/pages/pricing-control-center.tsx:1) - Pricing control
- `/audit` → [audit-log.tsx](client/src/pages/audit-log.tsx:1) - Audit log viewer
- `/learning` → [learning.tsx](client/src/pages/learning.tsx:1) - ML learning insights
- `/admin/coverage` → [admin-coverage.tsx](client/src/pages/admin-coverage.tsx:1) - Service area coverage
- `/simulator` → [simulator.tsx](client/src/pages/simulator.tsx:1) - Agent simulator

### 3.9 Onboarding & Setup

#### Onboarding Wizard
| Route | Component | Capability | Backend API |
|-------|-----------|------------|-------------|
| `/onboarding` | [onboarding.tsx](client/src/pages/onboarding.tsx:1) | Multi-step onboarding wizard | `GET /api/onboarding`, `POST /api/onboarding` |

**Capabilities**:
- Business profile setup
- Service offerings configuration
- Pricing setup
- Policy configuration
- Initial knowledge base population
- Agent activation

---

## 4. BACKEND API CAPABILITIES

### 4.1 Core APIs (server/routes.ts)

#### Authentication & Authorization
- `POST /api/auth/login` - Login with phone + password
- `POST /api/auth/send-otp` - Send 2FA code
- `POST /api/auth/verify-otp` - Verify 2FA code
- `GET /api/auth/check` - Session check
- `POST /api/auth/logout` - Logout

**Implementation**: [server/auth-routes.ts](server/auth-routes.ts:1)

#### Orchestration APIs
- `POST /api/orchestration/start` - Start lead-to-cash workflow
- `GET /api/orchestration/:runId` - Get orchestration run
- `POST /api/orchestration/:runId/next` - Execute next step
- `POST /api/orchestration/message` - Handle inbound message
- `POST /api/orchestration/approve` - Ops approval
- `POST /api/orchestration/override` - Ops override

**Implementation**: [server/orchestrator/leadToCash.ts](server/orchestrator/leadToCash.ts:1)

#### Agent Execution APIs
- `GET /api/agents` - List all agents
- `GET /api/agents/:id` - Get agent details
- `PATCH /api/agents/:id` - Update agent config
- `POST /api/agents/:id/test` - Test agent execution
- `GET /api/agent-runs` - List agent executions
- `GET /api/events` - Agent event timeline

**Implementation**: [server/routes.ts](server/routes.ts:1) (lines 300+)

#### Jobs & Quotes APIs
- `GET /api/jobs` - List jobs
- `GET /api/jobs/:id` - Get job detail
- `POST /api/jobs` - Create job
- `PATCH /api/jobs/:id` - Update job
- `GET /api/quotes` - List quotes
- `POST /api/quotes` - Create quote
- `PATCH /api/quotes/:id/approve` - Approve quote
- `PATCH /api/quotes/:id/reject` - Reject quote

**Implementation**: [server/routes.ts](server/routes.ts:1)

#### Crew & Operations APIs
- `GET /api/ops/crews` - List crews
- `GET /api/ops/crews/:id` - Get crew detail
- `POST /api/ops/crews/:jobId/eligible` - Get eligible crews for job
- `POST /api/ops/crews/simulations` - Run crew-to-job simulations
- `GET /api/ops/travel/:crewId/:jobId` - Get travel estimate
- `POST /api/ops/margin` - Compute margin burn

**Implementation**: [server/routes.ts](server/routes.ts:1) + [server/agents/crewIntelligence.ts](server/agents/crewIntelligence.ts:1)

### 4.2 Knowledge Base APIs (Sprint 1 Complete)

**Endpoint Reference**: [server/routes/knowledge.ts](server/routes/knowledge.ts:1)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/knowledge/items` | List knowledge items (with filters) |
| GET | `/api/knowledge/items/:id` | Get single knowledge item |
| POST | `/api/knowledge/items` | Create draft knowledge item |
| POST | `/api/knowledge/items/:id/versions` | Create new version |
| POST | `/api/knowledge/items/:id/submit` | Submit for review |
| POST | `/api/knowledge/items/:id/approve` | Approve/reject knowledge |
| POST | `/api/knowledge/items/:id/retire` | Retire knowledge |
| GET | `/api/knowledge/search` | Hybrid search (semantic + keyword) |
| GET | `/api/knowledge/approvals/pending` | Approval queue |
| GET | `/api/knowledge/reviews/due` | Review calendar |
| POST | `/api/knowledge/reviews/:id/complete` | Mark review completed |

**Backend Files**:
- Routes: [server/routes/knowledge.ts](server/routes/knowledge.ts:1)
- Embeddings: [server/lib/knowledge/embeddings.ts](server/lib/knowledge/embeddings.ts:1)
- Validator: [server/lib/knowledge/validator.ts](server/lib/knowledge/validator.ts:1)
- Search: [server/lib/knowledge/search.ts](server/lib/knowledge/search.ts:1)
- Builder Agent: [server/lib/knowledge/builderAgent.ts](server/lib/knowledge/builderAgent.ts:1)
- Steward Agent: [server/lib/knowledge/stewardAgent.ts](server/lib/knowledge/stewardAgent.ts:1)

**Database Schema**: [shared/knowledge-schema.ts](shared/knowledge-schema.ts:1)

### 4.3 Support Queue APIs (Sprint 2 Complete)

**Endpoint Reference**: [server/routes/support-queue.ts](server/routes/support-queue.ts:1)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/support/queue` | Support queue with filters |
| GET | `/api/support/queue/:threadId` | Single thread enrichment |
| POST | `/api/support/queue/:threadId/enrich` | Manual enrich |
| POST | `/api/support/queue/:threadId/reenrich` | Re-enrich |
| POST | `/api/support/queue/:threadId/first-response` | Mark first response |
| POST | `/api/support/queue/:threadId/resolve` | Mark resolved |
| PATCH | `/api/support/queue/:threadId/priority` | Update priority |
| GET | `/api/support/coverage-gaps` | Gap analysis |
| GET | `/api/support/sla-metrics` | SLA performance |
| GET | `/api/support/stats` | Queue statistics |

**Backend Files**:
- Routes: [server/routes/support-queue.ts](server/routes/support-queue.ts:1)
- Intent Classifier: [server/lib/support/intentClassifier.ts](server/lib/support/intentClassifier.ts:1)
- Coverage Detector: [server/lib/support/coverageDetector.ts](server/lib/support/coverageDetector.ts:1)

**Database Schema**: [shared/thread-enrichment-schema.ts](shared/thread-enrichment-schema.ts:1)

### 4.4 AI Assistant APIs (Sprint 3 Complete)

**Endpoint Reference**: [server/routes/assistant.ts](server/routes/assistant.ts:1)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/assistant/conversations` | Start conversation |
| POST | `/api/assistant/conversations/:id/messages` | Send message |
| GET | `/api/assistant/conversations/:id/messages` | Get history |
| POST | `/api/assistant/conversations/:id/end` | End conversation |
| GET | `/api/assistant/actions/pending` | Pending actions |
| POST | `/api/assistant/actions/:id/confirm` | Confirm action |
| POST | `/api/assistant/actions/:id/reject` | Reject action |
| GET | `/api/assistant/actions/:id` | Action details |
| GET | `/api/assistant/conversations/:id/tools` | Tool history |
| POST | `/api/assistant/messages/:id/feedback` | Submit feedback |

**Backend Files**:
- Routes: [server/routes/assistant.ts](server/routes/assistant.ts:1)
- Agent: [server/lib/assistant/agent.ts](server/lib/assistant/agent.ts:1)
- Tool Router: [server/lib/assistant/toolRouter.ts](server/lib/assistant/toolRouter.ts:1)
- Action Handler: [server/lib/assistant/actionHandler.ts](server/lib/assistant/actionHandler.ts:1)
- Citation Validator: [server/lib/assistant/citationValidator.ts](server/lib/assistant/citationValidator.ts:1)

**Database Schema**: [shared/assistant-schema.ts](shared/assistant-schema.ts:1)

**Read-Only Tools** (5 implemented):
- `get_next_visit` - Next scheduled service visit
- `get_job_status` - Current job status
- `get_invoice_balance` - Unpaid invoice total
- `get_quote_status` - Quote status and amount
- `get_notification_log` - Recent notifications

### 4.5 Payment Agent APIs

**Endpoint Reference**: [server/orchestrator/payment/index.ts](server/orchestrator/payment/index.ts:1)

**Backend Files**:
- Payment Agent: [server/orchestrator/payment/paymentAgent.ts](server/orchestrator/payment/paymentAgent.ts:1)
- Payment Saga: [server/orchestrator/payment/paymentSaga.ts](server/orchestrator/payment/paymentSaga.ts:1)
- Command Handlers: [server/orchestrator/payment/commandHandlers.ts](server/orchestrator/payment/commandHandlers.ts:1)
- Stripe Webhook: [server/orchestrator/payment/webhooks/stripeWebhookHandler.ts](server/orchestrator/payment/webhooks/stripeWebhookHandler.ts:1)

**Capabilities**:
- Autopay enrollment
- Text-to-pay (SMS payment links)
- Payment retry logic
- Failed payment handling
- Stripe integration

**Database Schema**: [shared/schema-payment.ts](shared/schema-payment.ts:1)

### 4.6 Post-Job QA APIs

**Endpoint Reference**: [server/routes-postjob-qa.ts](server/routes-postjob-qa.ts:1)

**Backend Files**:
- Routes: [server/routes-postjob-qa.ts](server/routes-postjob-qa.ts:1)
- Engine: [server/orchestrator/postJobQA/engine.ts](server/orchestrator/postJobQA/engine.ts:1)
- Agent: [server/orchestrator/postJobQA/postJobQAAgent.ts](server/orchestrator/postJobQA/postJobQAAgent.ts:1)
- Review Management: [server/orchestrator/postJobQA/reviewManagementAgent.ts](server/orchestrator/postJobQA/reviewManagementAgent.ts:1)

**Capabilities**:
- Automated job quality checks
- Photo verification
- GPS verification
- Customer feedback collection
- Review management

**Database Schema**: [shared/schema-postjob-qa.ts](shared/schema-postjob-qa.ts:1)

### 4.7 Mobile Crew APIs

**Endpoint Reference**: [server/routes-mobile.ts](server/routes-mobile.ts:1)

**Capabilities**:
- Crew login
- Job assignments
- Job status updates
- Photo uploads
- GPS tracking

---

## 5. STATE MANAGEMENT & DATA LAYER

### 5.1 React Query Integration
**Implementation**: [client/src/lib/queryClient.ts](client/src/lib/queryClient.ts:1)

**Query Keys Used** (examples):
- `["/api/dashboard"]` - Dashboard metrics
- `["/api/inbox"]` - Inbox items
- `["payment-methods"]` - Payment methods
- `["job", jobId]` - Job detail
- `["customer", customerId]` - Customer profile
- `["/api/onboarding"]` - Onboarding status

**Patterns**:
- Automatic background refetching
- Optimistic updates
- Cache invalidation on mutations
- Stale-while-revalidate

### 5.2 Context Providers
| Context | File | Purpose |
|---------|------|---------|
| AuthProvider | [lib/auth-context.tsx](client/src/lib/auth-context.tsx:1) | Session + user role |
| ThemeProvider | [lib/theme-provider.tsx](client/src/lib/theme-provider.tsx:1) | Light/dark mode |
| DrawerProvider | [lib/drawer-context.tsx](client/src/lib/drawer-context.tsx:1) | Contextual panels |
| SidebarProvider | [components/ui/sidebar.tsx](client/src/components/ui/sidebar.tsx:1) | Sidebar state |

### 5.3 Custom Hooks
| Hook | File | Purpose |
|------|------|---------|
| useAuth | [lib/auth-context.tsx](client/src/lib/auth-context.tsx:1) | Auth state |
| useUserRole | [components/role-gate.tsx](client/src/components/role-gate.tsx:1) | RBAC checks |
| useMobile | [hooks/use-mobile.tsx](client/src/hooks/use-mobile.tsx:1) | Mobile detection |
| useKeyboardShortcuts | [hooks/use-keyboard-shortcuts.ts](client/src/hooks/use-keyboard-shortcuts.ts:1) | Global shortcuts |

---

## 6. RBAC & PERMISSIONS

### 6.1 Role Definitions
**Implementation**: [client/src/lib/ui/tokens.ts](client/src/lib/ui/tokens.ts:1)

**Roles**:
- `OWNER` - Full system access
- `ADMIN` - Full system access
- `STAFF` - Limited admin access
- `CREW_LEAD` - Crew operations only
- `CREW` - Job execution only
- `CUSTOMER` - Customer portal only

### 6.2 Access Levels
**Implementation**: [client/src/lib/ui/tokens.ts](client/src/lib/ui/tokens.ts:1)

```typescript
accessLevels = {
  fullAdmin: ["OWNER", "ADMIN"],
  operations: ["OWNER", "ADMIN", "STAFF"],
  crewLead: ["OWNER", "ADMIN", "STAFF", "CREW_LEAD"],
  crewMember: ["CREW"],
}
```

### 6.3 Route-Level Gating
**Implementation**: Navigation visibility controlled by `canAccess()` checks in [client/src/components/app-sidebar.tsx](client/src/components/app-sidebar.tsx:1)

**Gated Routes**:
- `/agents` - OWNER/ADMIN only
- `/settings` - OWNER/ADMIN only
- `/pricing` - OWNER/ADMIN only
- `/audit` - OWNER/ADMIN only
- `/crew-inbox` - CREW_LEAD only

---

## 7. FEATURE FLAGS

### 7.1 Implementation
**File**: [client/src/lib/feature-flags.ts](client/src/lib/feature-flags.ts:1)

**Active Flags**:
- `UI_REFACTOR_V1` - New navigation structure
  - Changes `/dashboard` → `/home`
  - Changes `/inbox` → `/work`
  - Adds `/approvals` dedicated view
  - Reorganizes settings into hub

---

## 8. REAL-TIME CAPABILITIES

### 8.1 WebSocket Support
**Status**: Planned (see [docs/real-time-updates.md](docs/real-time-updates.md:1))

**Proposed Use Cases**:
- Live inbox updates
- Job status changes
- Crew location tracking
- Agent execution notifications

### 8.2 Polling Fallback
**Current Implementation**: React Query refetchInterval for pseudo-real-time updates

---

## 9. ANALYTICS & OBSERVABILITY

### 9.1 Audit Logging
**Backend**: [server/lib/audit.ts](server/lib/audit.ts:1)

**Logged Events**:
- Knowledge CRUD operations
- Approval workflow actions
- Thread enrichment
- AI assistant interactions
- Tool executions
- Action confirmations/rejections

### 9.2 Decision Logging (Learning System)
**Backend**: [server/lib/learning/](server/lib/learning/index.ts:1)

**Capabilities**:
- Log AI decisions
- Log human actions (override, approve, reject)
- Log outcomes (success, failure, margin impact)
- Generate tuning suggestions
- Diff detection (expected vs actual)

**Database Tables**:
- `decisionLogs` - AI decisions
- `humanActionLogs` - Human overrides
- `outcomeLogs` - Results
- `policyTuningSuggestions` - ML suggestions

---

## 10. GAPS & PROPOSED FEATURES

### 10.1 Missing Web-Only Capabilities (Need Implementation)

#### Analytics Dashboards
**Status**: PROPOSED

**Screens Needed**:
- Profit protection dashboard (margin by job/crew/customer)
- Retention analytics (churn signals, LTV, risk scores)
- Growth metrics (new customers, service adoption, revenue trends)
- Agent performance dashboard (success rate, latency, cost)
- AR aging report (enhanced version of billing-issues.tsx)

**Data Available**: Backend has metrics, needs aggregation endpoints

#### Customer Intelligence Module
**Status**: PROPOSED

**Screens Needed**:
- Customer segmentation (high-value, at-risk, new, dormant)
- LTV calculator
- Churn prediction
- Satisfaction tracking
- Communication frequency analysis

**Data Available**: Customer memories exist ([shared/schema.ts](shared/schema.ts:1) - `customerMemories` table), needs enrichment

#### Crew Route Optimization
**Status**: PARTIAL

**Existing**:
- Travel estimates ([server/agents/routeCost.ts](server/agents/routeCost.ts:1))
- Crew eligibility ([server/agents/crewIntelligence.ts](server/agents/crewIntelligence.ts:1))

**Missing**:
- Visual route planner (map-based)
- Multi-job route optimization
- Real-time crew location tracking
- Schedule adherence tracking

#### Agent Workflow Builder
**Status**: PROPOSED

**Current**: Agent config is code-based
**Needed**: Visual workflow builder for non-technical users

**Capabilities Required**:
- Drag-drop step builder
- Condition branching
- Human-in-the-loop insertion points
- Test execution with sample data

### 10.2 Mobile vs Web Feature Parity

**Mobile-Only Features** (from [docs/design/CUSTOMER_APP_UI_IMPLEMENTATION_PLAN.md](docs/design/CUSTOMER_APP_UI_IMPLEMENTATION_PLAN.md:1)):
- Payment method setup (Apple Pay, Google Pay, Card)
- In-app payment flow
- Receipt viewing
- Payment history
- Autopay enrollment

**Web Equivalent**: Needs customer-facing portal (out of scope for ops staff web app)

---

## 11. TECHNICAL DEBT & REFACTORING

### 11.1 UI Refactor V1 Migration
**Status**: IN PROGRESS

**Completed**:
- New navigation structure
- Settings hub
- Work queue concept

**Remaining**:
- Migrate all pages to new patterns
- Remove legacy routes
- Update all tests

### 11.2 Design System Consolidation
**Status**: PARTIAL

**Completed**:
- shadcn/ui components installed
- CSS variables for theming
- Basic component library

**Remaining**:
- Formalize design tokens (colors, typography, spacing)
- Component variant system
- Storybook or similar documentation
- Web-specific extensions (data tables, filters, charts)

---

## 12. INTEGRATION POINTS

### 12.1 External Services

#### Twilio (SMS)
- **Adapter**: [server/connectors/twilio-mock.ts](server/connectors/twilio-mock.ts:1)
- **Usage**: SMS sending, inbound webhook handling

#### Stripe (Payments)
- **Adapter**: [server/orchestrator/payment/adapters/paymentProviderAdapter.ts](server/orchestrator/payment/adapters/paymentProviderAdapter.ts:1)
- **Usage**: Payment intents, webhooks, autopay

#### OpenAI
- **Usage**: Embeddings (text-embedding-3-small), chat completion
- **Files**: [server/lib/knowledge/embeddings.ts](server/lib/knowledge/embeddings.ts:1)

#### Anthropic (Claude)
- **Usage**: Intent classification, thread enrichment
- **Files**: [server/lib/support/intentClassifier.ts](server/lib/support/intentClassifier.ts:1)

#### Google Maps
- **Usage**: Geocoding, distance calculations
- **Integration**: @googlemaps/js-api-loader

### 12.2 Database
- **Type**: PostgreSQL with pgvector extension
- **ORM**: Drizzle ORM
- **Schemas**: [shared/schema.ts](shared/schema.ts:1) + domain-specific schemas

---

## 13. TESTING INFRASTRUCTURE

### 13.1 Backend Tests
**Framework**: Jest + ts-jest

**Test Files**:
- [server/orchestrator/payment/__tests__/paymentAgent.test.ts](server/orchestrator/payment/__tests__/paymentAgent.test.ts:1)

**Coverage**: Unit tests for payment agent

### 13.2 Frontend Tests
**Status**: Test infrastructure ready (React Testing Library), but minimal coverage

**Needed**:
- Component unit tests
- Integration tests (user flows)
- E2E tests (Playwright configured)

---

## 14. DEPLOYMENT & DEVOPS

### 14.1 Build System
- **Bundler**: Vite 7.3.0
- **Dev Server**: tsx + Vite HMR
- **Production Build**: `npm run build`

### 14.2 Environment Configuration
**Required Variables**:
- `DATABASE_URL` - PostgreSQL connection
- `OPENAI_API_KEY` - OpenAI API
- `ANTHROPIC_API_KEY` - Claude API
- `TWILIO_ACCOUNT_SID` - Twilio
- `TWILIO_AUTH_TOKEN` - Twilio
- `STRIPE_SECRET_KEY` - Stripe
- `NODE_ENV` - Environment

---

## 15. SUMMARY: CAPABILITY MATRIX

| Capability Domain | Existing Features | Missing Features | Backend Ready | UI Ready |
|-------------------|-------------------|------------------|---------------|----------|
| **Authentication** | Login, 2FA, logout | Multi-tenant switching | ✅ | ✅ |
| **Dashboard** | ROI metrics, pending actions | Profit analytics, retention | ✅ | ⚠️ Partial |
| **Inbox/Work Queue** | Pending approvals, SLA tracking | Bulk actions, saved filters | ✅ | ✅ |
| **Customers** | List, profile, interaction history | Segmentation, LTV, churn | ⚠️ Partial | ⚠️ Partial |
| **Jobs** | List, detail, crew assignment | Route optimization, tracking | ✅ | ✅ |
| **Quotes** | List, approval, builder | Analytics, conversion tracking | ✅ | ✅ |
| **Crews** | Roster, performance, assignments | Real-time location, route planner | ⚠️ Partial | ⚠️ Partial |
| **Billing** | Invoices, payments, AR aging | Payment analytics, autopay dashboard | ✅ | ✅ |
| **Agents** | Catalog, config, testing | Workflow builder, performance dashboard | ✅ | ⚠️ Partial |
| **Knowledge Base** | Full CRUD, approval, search | Auto-generation, trends | ✅ | ✅ |
| **Support Queue** | Enrichment, SLA, coverage | Macro library, escalation rules | ✅ | ✅ |
| **AI Assistant** | Chat, citations, actions | Widget integration, customer portal | ✅ | ❌ |
| **Settings** | All config screens | Unified hub (in progress) | ✅ | ⚠️ Partial |
| **Analytics** | Basic metrics | Profit, retention, growth dashboards | ⚠️ Partial | ❌ |

**Legend**:
- ✅ **Complete**: Feature exists and production-ready
- ⚠️ **Partial**: Feature exists but incomplete or needs enhancement
- ❌ **Missing**: Feature does not exist, needs implementation

---

## CONCLUSION

This capability map demonstrates that LawnFlow has:
- **50+ pages** already implemented
- **48 UI components** (shadcn/ui library)
- **100+ backend endpoints** across 8 API domains
- **Complete backend infrastructure** for knowledge base, support queue, and AI assistant (Sprints 1-3)
- **RBAC system** with 6 roles
- **Agent orchestration** framework

**Primary Gaps for Web App**:
1. Analytics dashboards (profit, retention, agent performance)
2. Customer intelligence (segmentation, LTV, churn)
3. Agent workflow builder (visual configuration)
4. Enhanced crew route optimization (map-based)
5. Design system formalization (web-specific extensions)

All backend capabilities exist or are trivially extractable from existing agent logic. The web UI design task is primarily about:
- **Data-dense table design** (filters, sorting, bulk actions)
- **Chart/visualization design** (profit, retention, AR, agent metrics)
- **Responsive layout** for large screens (1440px+, 1920px)
- **Design system extension** (web-specific components)

---

**Document Status**: ✅ Complete
**Last Updated**: January 12, 2026
**Maintained By**: Product + Engineering
