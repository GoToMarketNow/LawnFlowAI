# LawnFlow AI - Complete Business Automation Platform

**LawnFlow AI** is an enterprise-grade, AI-powered automation platform for landscaping and lawn care businesses, providing end-to-end automation from initial lead capture through job completion, invoicing, payment collection, and accounting reconciliation.

The platform features a sophisticated **multi-agent orchestration system** that handles the complete **Lead-to-Cash lifecycle**, including intelligent crew assignment, margin validation, feasibility checking, dispatch optimization, billing automation, and customer engagement—all while maintaining human oversight through configurable approval workflows.

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Core Architecture](#core-architecture)
3. [Lead-to-Cash Orchestration](#lead-to-cash-orchestration)
4. [Agent System](#agent-system)
5. [Billing & Quote-to-Cash](#billing--quote-to-cash)
6. [Quick Start](#quick-start)
7. [Configuration & Policies](#configuration--policies)
8. [Admin Dashboard](#admin-dashboard)
9. [API Reference](#api-reference)
10. [Technology Stack](#technology-stack)
11. [Development](#development)
12. [Known Issues & TODOs](#known-issues--todos)

---

## Platform Overview

### What LawnFlow AI Does

LawnFlow AI automates the complete operational workflow for landscaping businesses:

- **Lead Engagement**: Automatically responds to missed calls, inbound SMS, and web form submissions
- **Lead Qualification**: Extracts customer details (name, phone, address, services, timeline)
- **Quote Generation**: Builds price estimates using lot size, service type, and business pricing rules
- **Scheduling**: Proposes time windows and handles customer scheduling preferences
- **Crew Assignment**: Runs intelligent simulations to assign the best crew based on skills, equipment, travel distance, and margin impact
- **Feasibility & Margin Validation**: Ensures jobs are profitable and executable before commitment
- **Dispatch Management**: Creates dispatch tasks with route optimization and crew notifications
- **Job Booking**: Writes back to external FSM systems (Jobber, ServiceAutopilot, etc.)
- **Billing & Invoicing**: Auto-generates invoices post-job with configurable approval workflows
- **Payment Tracking**: Monitors payments, handles overdue invoices, and manages disputes
- **Accounting Sync**: Integrates with QuickBooks for financial reconciliation

### Key Differentiators

1. **Multi-Agent Orchestration**: 13+ specialized agents working in sequence with decision gates
2. **Crew Intelligence**: AI-powered crew assignment considering skills, equipment, margin, and risk
3. **Memory System**: Learns from customer interactions and past decisions to improve over time
4. **Human-in-the-Loop (HITL)**: Configurable approval gates at every critical decision point
5. **Tiered Automation**: Scales from "Owner Operator" (manual approvals) to "Commercial" (full automation)
6. **End-to-End Lifecycle**: Complete automation from first contact to cash collection

---

## Core Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LawnFlow AI Platform                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐         ┌──────────────────┐                │
│  │  Client (React)  │◄────────┤  Admin Dashboard │                │
│  │  - Dashboard     │         │  - ROI Metrics   │                │
│  │  - Conversations │         │  - Approvals     │                │
│  │  - Job Tracking  │         │  - Audit Logs    │                │
│  └────────┬─────────┘         └──────────────────┘                │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Express.js Backend Server                      │  │
│  │  ┌────────────────────────────────────────────────────┐    │  │
│  │  │         Lead-to-Cash Orchestrator Engine           │    │  │
│  │  │  STAGE 1-10: LEAD_INTAKE → JOB_BOOKED             │    │  │
│  │  │  - 12 specialized agents                           │    │  │
│  │  │  - Decision gates at each stage                    │    │  │
│  │  │  - Context accumulation through pipeline           │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  │  ┌────────────────────────────────────────────────────┐    │  │
│  │  │         Billing Orchestrator Engine                │    │  │
│  │  │  - Invoice generation (invoiceBuildAgent)          │    │  │
│  │  │  - Payment tracking & overdue detection            │    │  │
│  │  │  - Dispute management                              │    │  │
│  │  └────────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              External Integrations                      │  │
│  │  - Jobber API, Twilio, QuickBooks, Google Maps        │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │            PostgreSQL Database                          │  │
│  │  - Orchestration Runs, Job Requests, Invoices          │  │
│  │  - Crews, Decisions, Memories, Audit Logs              │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Patterns

1. **Multi-Stage Orchestration**: Sequential pipeline with decision gates at each stage
2. **Context Accumulation**: Rolling context object enriched by each agent
3. **Agent Contracts**: Strongly-typed Zod schemas for all agent inputs/outputs
4. **Human-in-the-Loop (HITL)**: Configurable approval gates (`waiting_customer`, `waiting_ops`)
5. **Memory System**: Customer insights and past decisions stored for future context
6. **Policy-Driven**: Tiered automation policies control auto-approval thresholds

---

## Lead-to-Cash Orchestration

The **Lead-to-Cash Orchestrator** ([server/orchestrator/leadToCash/engine.ts](server/orchestrator/leadToCash/engine.ts)) is the core of LawnFlow AI, managing the complete lifecycle from first customer contact through job booking.

### Orchestration Stages (10 Total)

| # | Stage | Agent(s) | Purpose | Exit Criteria |
|---|-------|----------|---------|---------------|
| 1 | **LEAD_INTAKE** | leadIntakeAgent, propertyResolverAgent | Extract customer details, resolve property | All fields present (phone, address, services) |
| 2 | **QUOTE_BUILD** | quoteBuildAgent | Generate price estimate | Price range calculated with assumptions |
| 3 | **QUOTE_CONFIRM** | quoteConfirmAgent | Parse customer response | Customer accepted/declined/questioned |
| 4 | **SCHEDULE_PROPOSE** | scheduleProposeAgent | Propose time windows | Customer selected a window |
| 5 | **SIMULATION_RUN** | simulationRunAgent, crewIntelligenceAgent, routeCostAgent | Rank crews by score | At least one viable crew (score >= 70) |
| 6 | **FEASIBILITY_CHECK** | feasibilityCheckAgent, jobFeasibilityAgent | Validate execution capability | Crew has skills, equipment, capacity |
| 7 | **MARGIN_VALIDATE** | marginValidateAgent, marginBurnAgent | Ensure profitability | Margin score >= 70 threshold |
| 8 | **CREW_LOCK** | crewLockAgent | Lock crew assignment | Auto-approved or ops-approved |
| 9 | **DISPATCH_READY** | dispatchReadyAgent | Create dispatch task | Dispatch queued, crew notified |
| 10 | **JOB_BOOKED** | jobBookAgent | Write to FSM, confirm | Job in Jobber, SMS sent to customer |

### Key Stage Details

#### QUOTE_BUILD Pricing Logic
- **Base Prices**: mowing ($35-75), cleanup ($150-400), mulch ($200-600)
- **Lot Size Multipliers**: <5k sqft (0.8x), 5k-10k (1.0x), 10k-20k (1.3x), 20k-43k (1.6x), 1+ acre (2.0x)
- **Frequency Discounts**: weekly (15% off), biweekly (10% off)

#### CREW_LOCK Auto-Approval Criteria
Auto-approves if ALL conditions met:
- `topRecommendation.totalScore >= 80`
- `marginResult.meetsThreshold === true`
- `feasibilityResult.feasible === true`

Otherwise waits for ops approval.

### Orchestration Flow Diagram

```
[Lead Source: Call/SMS/Web]
        ↓
LEAD_INTAKE → Extract details, resolve property
        ↓ (wait if missing fields)
QUOTE_BUILD → Calculate price range
        ↓ (wait if low confidence)
QUOTE_CONFIRM → Parse customer response
        ↓ (accepted → continue | declined → stop | question → loop back)
SCHEDULE_PROPOSE → Propose time windows
        ↓ (wait for customer selection)
SIMULATION_RUN → Rank crews (skills, equipment, distance, margin, risk)
        ↓ (wait if no viable crews)
FEASIBILITY_CHECK → Validate crew can execute
        ↓ (wait if not feasible)
MARGIN_VALIDATE → Ensure profitability
        ↓ (wait if margin too low)
CREW_LOCK → Lock crew assignment (auto or manual approval)
        ↓
DISPATCH_READY → Create dispatch task, notify crew
        ↓
JOB_BOOKED → Write to Jobber, send confirmation SMS
        ↓
[Job Execution by Crew]
        ↓
JOB_COMPLETED → Trigger Billing Orchestrator
        ↓
Billing: INVOICE_DRAFT → INVOICE_SENT → PAYMENT_RECEIVED → ACCOUNTING_SYNCED
```

### Context Accumulation Example

```typescript
{
  // LEAD_INTAKE
  customerPhone: "+15551234567",
  address: "123 Main St, Charlottesville, VA 22902",
  services: ["mowing"],

  // Property resolution
  lat: 38.0293,
  lng: -78.4767,
  lotAreaSqft: 8500,

  // QUOTE_BUILD
  rangeLow: 45,
  rangeHigh: 65,

  // SIMULATION_RUN
  topRecommendation: {
    crewId: 1,
    crewName: "Alpha Crew",
    totalScore: 85.3
  },

  // CREW_LOCK
  selectedCrewIdNumeric: 1,
  decisionId: 123,
  crewLockApprovalMode: "auto_approved",

  // JOB_BOOKED
  externalJobId: "jobber_456"
}
```

---

## Agent System

### Specialist Agents (13+)

| Agent | Purpose | Key Output |
|-------|---------|------------|
| **leadIntakeAgent** | Extract customer details | missingFields, confidence |
| **propertyResolverAgent** | Resolve lat/lng, lot size | lat, lng, lotAreaSqft |
| **quoteBuildAgent** | Generate price estimates | rangeLow, rangeHigh, assumptions |
| **quoteConfirmAgent** | Parse customer response | outcome (accepted/declined/question) |
| **scheduleProposeAgent** | Generate time slots | proposedWindows |
| **simulationRunAgent** | Orchestrate crew sims | rankedOptions, topRecommendation |
| **crewIntelligenceAgent** | Score crew skills/equipment | skillMatchScore, equipmentMatchScore |
| **routeCostAgent** | Calculate travel costs | distanceScore, travelMinutes |
| **simulationRankingAgent** | Rank crew options | totalScore, reasons |
| **feasibilityCheckAgent** | Validate execution | feasible, blockers |
| **marginValidateAgent** | Validate profitability | marginScore, meetsThreshold |
| **crewLockAgent** | Lock crew assignment | locked, approvalMode, decisionId |
| **dispatchReadyAgent** | Create dispatch task | dispatchTaskId, routeSequence |
| **jobBookAgent** | Write to FSM | writeback status, externalId |

### Agent Contracts (Zod Schemas)

All agents use strongly-typed schemas in [shared/orchestrator/contracts.ts](shared/orchestrator/contracts.ts):

```typescript
export const QuoteBuildResultSchema = z.object({
  rangeLow: z.number(),
  rangeHigh: z.number(),
  currency: z.literal("USD"),
  servicesIncluded: z.array(z.string()),
  assumptions: z.array(z.string()),
  nextStep: z.enum(["ready_to_send", "request_photos", "schedule_site_visit"]),
  confidence: z.enum(["high", "medium", "low"]),
});
```

Benefits: Type safety, runtime validation, self-documenting APIs, version control.

---

## Billing & Quote-to-Cash

The **Billing Orchestrator** ([server/orchestrator/billing/engine.ts](server/orchestrator/billing/engine.ts)) handles post-job workflows.

### Billing Stages

```
JOB_COMPLETED → INVOICE_DRAFT → INVOICE_PENDING_APPROVAL
→ INVOICE_SENT → PAYMENT_RECEIVED → ACCOUNTING_SYNCED → CLOSED

Exception Paths:
- OVERDUE (auto-detected when dueDate < now)
- DISPUTE (customer disputes charge)
- REMEDIATION (manual resolution)
```

### Key Functions

| Function | Purpose |
|----------|---------|
| **handleJobCompleted()** | Generates invoice via invoiceBuildAgent, applies pricing rules, tax |
| **handlePaymentReceived()** | Records payment, updates invoice status (PAID/PARTIAL) |
| **checkOverdueInvoices()** | Detects overdue invoices, creates billing issues |
| **handleDisputeDetected()** | Creates dispute billing issue for manual resolution |

### Invoice Build Logic

1. Load job details (service type, customer, date)
2. Apply pricing rules from `businessProfiles` and `policyProfiles`
3. Calculate tax: `taxRate = defaultTaxRate / 10000` (e.g., 750 → 7.5%)
4. Generate line items
5. Create invoice record
6. Require approval if confidence < 0.8 OR total > $500

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 13+
- Twilio (optional, for real SMS)

### Installation

```bash
npm install
npm run db:push
npm run dev
```

Navigate to `http://localhost:5000`.

### First-Time Setup

Database auto-seeds with:
- Business: "Green Ridge Lawn Care"
- Services: Mowing ($45), Cleanup ($250+), Mulch ($300+)
- Crews with skills and equipment
- Policy: "Owner Operator" tier

### Demo Workflow

#### 1. Simulate Missed Call
```bash
curl -X POST http://localhost:5000/api/events/missed-call \
  -H "Content-Type: application/json" \
  -d '{"from_phone": "+15551234567"}'
```
**Result**: Creates job request, starts orchestration, sends SMS

#### 2. Customer Replies
```bash
curl -X POST http://localhost:5000/api/events/inbound-sms \
  -H "Content-Type: application/json" \
  -d '{
    "from": "+15551234567",
    "to": "+15559876543",
    "body": "I need weekly mowing at 123 Main St, Charlottesville VA"
  }'
```
**Result**: Parses details, generates quote, sends to customer

#### 3. Customer Accepts
```bash
curl -X POST http://localhost:5000/api/events/inbound-sms \
  -H "Content-Type: application/json" \
  -d '{"from": "+15551234567", "to": "+15559876543", "body": "Sounds good!"}'
```
**Result**: Advances through scheduling, crew assignment, dispatch, booking

#### 4. Complete Job
```bash
curl -X POST http://localhost:5000/api/jobs/1/complete
```
**Result**: Triggers billing orchestrator, generates invoice

#### 5. Record Payment
```bash
curl -X POST http://localhost:5000/api/billing/invoices/1/payment \
  -H "Content-Type: application/json" \
  -d '{"amountCents": 6500, "method": "CARD"}'
```
**Result**: Updates invoice to PAID, syncs to QuickBooks

---

## Configuration & Policies

### Business Profile ([shared/schema.ts](shared/schema.ts))

Stores core business settings:
- Basic info (name, phone, email, address)
- Service area (lat/lng center, radius, ZIP codes)
- Services offered (mowing, cleanup, mulch, etc.)
- Pricing (mowingMinPrice, cleanupMinPrice in cents)
- Billing (taxEnabled, defaultTaxRate, invoiceTerms)
- FSM integration (fsmProvider, fsmConnected)
- Automation flags

### Policy Profiles (Tiered Automation)

| Tier | Auto Messages | Auto Quotes | Auto Book | Approvals |
|------|---------------|-------------|-----------|-----------|
| **Owner Operator** | ✅ | ❌ | ❌ | All actions |
| **SMB** | ✅ | ✅ (if conf >= 85%) | ❌ | High-confidence quotes auto-send |
| **Commercial** | ✅ | ✅ | ✅ (if score >= 80) | Fully automated |

**Key Fields**:
- `confidenceThreshold`: 85 (min confidence for auto-quotes)
- `slotScoreThreshold`: 80 (min crew score for auto-booking)
- `pricingRules`: JSON with baseRates, sqftRate, hourlyRate
- `blockedPhones`, `blockedAddresses`: Do-not-serve lists

---

## Admin Dashboard

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard (ROI metrics, recent activity) |
| `/conversations` | List all customer conversations |
| `/pending-actions` | Approve/reject crew locks, quotes, invoices |
| `/jobs` | List all jobs with status, crew, schedule |
| `/orchestration` | View all orchestration runs |
| `/invoices` | List invoices with payments, due dates |
| `/billing-issues` | Overdue invoices, disputes |
| `/settings/business` | Edit business profile |
| `/settings/policy` | Configure automation tier |
| `/audit` | Complete audit trail |

### Pending Actions

Approve:
- **Crew Locks**: When auto-approval thresholds not met (show scores)
- **Invoices**: When confidence < 80% or amount > $500
- **Quotes**: When confidence < 85% (SMB tier)

---

## API Reference

### Lead-to-Cash Orchestration

```http
POST /api/orchestration/start
{
  "accountId": "acc_123",
  "businessId": 1,
  "jobRequestId": 456
}
```

```http
POST /api/orchestration/run/:runId/next
```

```http
POST /api/orchestration/inbound
{
  "from": "+15551234567",
  "body": "I accept the quote"
}
```

```http
POST /api/orchestration/approve
{
  "runId": "run_abc123",
  "stage": "CREW_LOCK",
  "approvalData": {"selectedCrewId": 1}
}
```

### Billing

```http
POST /api/billing/job-completed
{"accountId": 1, "jobId": 456}
```

```http
POST /api/billing/payment-received
{"accountId": 1, "invoiceId": 789, "amountCents": 6500, "paymentMethod": "CARD"}
```

```http
POST /api/billing/check-overdue
{"accountId": 1}
```

---

## Technology Stack

**Backend**: Node.js 20+, Express.js 4.21+, TypeScript 5.6+, PostgreSQL 13+, Drizzle ORM 0.39+, Zod 3.25+, OpenAI GPT-4, Twilio SDK, Jest 30+

**Frontend**: React 18.3+, Wouter 3.3+, Tailwind CSS 3.4+, Radix UI, React Query 5.60+, Recharts 2.15+

**Infrastructure**: Vite 7.3+, Drizzle Kit 0.31+, PostgreSQL sessions

---

## Development

### Project Structure

```
LawnFlowAI/
├── client/src/           # React frontend
│   ├── pages/            # Dashboard, Conversations, Jobs
│   └── components/       # UI components
├── server/               # Express backend
│   ├── orchestrator/
│   │   ├── leadToCash/   # Lead-to-Cash orchestrator
│   │   │   ├── engine.ts # Core logic (1159 lines)
│   │   │   └── agents/   # 12 stage agents
│   │   └── billing/      # Billing orchestrator
│   ├── agents/           # Standalone agents
│   ├── connectors/       # Jobber, Twilio, etc.
│   ├── lib/              # Comms, crews, learning
│   └── memory/           # Memory system
├── shared/
│   ├── schema.ts         # Drizzle database schema
│   └── orchestrator/contracts.ts  # Agent contracts (372 lines)
└── docs/                 # Documentation
```

### Tests

```bash
npm test
npm test -- --watch
npm test -- --coverage
```

### Database

```bash
npm run db:push          # Push schema changes
npx drizzle-kit generate # Generate migrations
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection |
| `SESSION_SECRET` | ✅ | Session encryption |
| `OPENAI_API_KEY` | ⚠️ | Required for AI |
| `TWILIO_ACCOUNT_SID` | ❌ | Twilio (optional) |
| `JOBBER_API_KEY` | ❌ | Jobber (optional) |
| `QUICKBOOKS_CLIENT_ID` | ❌ | QuickBooks (optional) |

---

## Known Issues & TODOs

### Current Limitations

1. **Memory System**: Read path works, write path partial, search/ranking needs work
2. **Billing**: Invoice/payment work, QuickBooks OAuth needed, no auto-remediation yet
3. **FSM Integration**: Jobber works, needs more error handling
4. **Real-Time**: No WebSocket, UI requires refresh
5. **Mobile**: Dashboard responsive but not optimized

### High-Priority TODOs

- [ ] WebSocket real-time updates
- [ ] RemediationAgent for disputes
- [ ] Complete Memory System (embeddings, similarity search)
- [ ] QuickBooks OAuth flow
- [ ] Agent Configuration UI
- [ ] E2E Playwright tests
- [ ] Redis caching layer
- [ ] Crew capacity management
- [ ] Customer portal

### Future Enhancements

- Multi-tenant support
- Mobile app for crew leaders
- Advanced reporting (BI dashboards)
- Predictive analytics (ML models)
- Review request agent
- Promotion agent
- Route optimization
- Materials management

---

## License

MIT

---

## Support

**GitHub**: [https://github.com/your-org/lawnflow-ai](https://github.com/your-org/lawnflow-ai)

**Documentation**: [docs/](docs/)

---

**Last Updated**: 2026-01-08 | **Version**: 1.0.0 (MVP)