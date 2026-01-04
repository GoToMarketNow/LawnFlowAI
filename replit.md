# LawnFlow AI - Landscaping Business Agentic Automation

## Overview
LawnFlow AI is an MVP agentic add-on designed for landscaping and lawn care businesses. Its primary purpose is to automate customer engagement through AI-powered agents, handling interactions such as missed calls, inbound SMS, and web leads. The project aims to provide a modern B2B SaaS platform with a clean, efficient admin interface, ultimately enhancing business efficiency and customer satisfaction.

## User Preferences
- Dark mode support enabled (toggle in header)
- Modern B2B SaaS design aesthetic
- Clean, efficient admin interface

## System Architecture
The system is built on a React + Vite frontend with Shadcn UI, an Express.js and TypeScript backend, and a PostgreSQL database utilizing Drizzle ORM. AI capabilities are powered by OpenAI via Replit AI Integrations.

**UI/UX Decisions:**
- Role-based navigation (OWNER/ADMIN, CREW_LEAD, STAFF) with conditional visibility
- Unified Inbox for all pending approvals with SLA indicators (urgent/warning/normal)
- Design tokens system (`client/src/lib/ui/tokens.ts`) for consistent styling
- Agent lifecycle phases: Lead → Quote → Confirm → Schedule → Assign → Book → Post-job
- Desktop-first responsive design with green primary color (142 76% 36%)
- Key pages: Dashboard, Inbox, Jobs, Quotes, Schedule, Customers, Agents, Settings
- RoleGate component for role-based conditional rendering
- User authentication with session management and auth-aware routing
- Onboarding-aware navigation that gates features until setup is complete
- Interactive Service Area Builder with Google Maps integration

**Technical Implementations & Feature Specifications:**
- **Lead-to-Cash Orchestrator:** Expanded 10-stage deterministic workflow managing the full lead lifecycle:
  1. LEAD_INTAKE - Customer/property data collection with AI-powered parsing
  2. QUOTE_BUILD - Automated price calculation based on services, lot size, frequency
  3. QUOTE_CONFIRM - Customer response parsing (accept/decline/modify/question)
  4. SCHEDULE_PROPOSE - Time window generation and customer selection
  5. SIMULATION_RUN - Crew simulations via getEligibleCrews() and runSimulations()
  6. FEASIBILITY_CHECK - Job feasibility validation via evaluateFeasibility()
  7. MARGIN_VALIDATE - Margin scoring with 70% threshold via computeMarginScore()
  8. CREW_LOCK - Auto-approval (score ≥80, margin ≥70) or ops queue, creates decision records
  9. DISPATCH_READY - Schedule item creation, route sequencing, dispatch task generation
  10. JOB_BOOKED - Jobber writeback and customer confirmation
  
  Features human-in-the-loop approvals at any stage with seamless resumption after customer responses or operator overrides.
- **AI Agents:** Specialized agents for intake, quoting, scheduling, simulation, feasibility, margin, crew lock, and dispatch.
- **Tool Interfaces:** Strictly validated tools for communication (SMS), FSM integration (lead/job creation, availability), approvals (human-in-loop), and auditing.
- **Policy System:** A tiered automation policy system (Owner Operator, SMB, Commercial) with configurable rules for message sending, quoting, job booking, and confidence thresholds. Includes checks for service area and do-not-serve rules.
- **Lot Size Resolver:** FREE-FIRST lot size resolution with multi-tier caching (geocode, parcel) and ArcGIS integration to provide accurate property data for quoting.
- **Jobber Integration:** Asynchronous webhook processing for Jobber events, GraphQL API integration for data enrichment, OAuth token management, and idempotent webhook handling. Includes a Quote-to-Job Orchestrator for syncing approved quote changes to jobs based on a configurable rules engine.
- **Dispatch & Routing Worker:** Intelligent route planning and crew dispatch with event-driven and nightly modes. Employs a greedy route optimization algorithm using Haversine distance. Manages crew rosters, equipment capabilities, and applies plans to Jobber.
- **Route Optimizer:** Multi-agent job assignment system with crew management, job request tracking, and intelligent simulation-based scheduling. Features:
  - Crew management with home base location, service radius, daily capacity, skills, and equipment
  - Job request workflow: new → triaged → simulated → recommended → assigned
  - Simulation engine with skill/equipment matching, Haversine distance scoring, and composite margin/risk scoring
  - Decision workflow with draft → approved → written_back states
  - Distance caching for travel time optimization
  - API endpoints: /api/ops/crews, /api/ops/jobs, /api/ops/simulations, /api/optimizer/simulate, /api/optimizer/decide, /api/optimizer/approve
- **Optimizer Orchestrator Agent:** Manages end-to-end decision workflow for job assignments:
  - createDecision: Creates draft decisions from selected simulations with rich reasoningJson (scoring breakdown, selection rationale, alternatives considered)
  - approveDecision: RBAC-enforced approval with configurable allowCrewLeadApprove flag
  - writebackDecision: Placeholder stub for Jobber integration (logs only, updates status to written_back)
  - RBAC enforcement: OWNER/ADMIN can create and approve; CREW_LEAD can create but not approve unless flag enabled; STAFF denied
  - Status transitions visible in API responses: draft → approved → written_back with timestamps and user attribution
- **Reconciliation Worker:** Validates invoice/payment integrity by comparing paid_total against sum of payments. Creates alerts for mismatches >$0.01 variance and handles deposit consistency checks. Updates Jobber RECON_STATUS custom field (NEEDS_REVIEW/OK) and includes a Dead Letter Queue (DLQ) pipeline for failed webhooks with exponential backoff retry.
- **Customer Comms Worker:** Produces customer-facing messages with strict tone and compliance rules. Uses templates by service category (lawn_maintenance, hardscape, general). Compliance rules: never promise exact arrival unless GPS-driven ETA, always include reschedule options. Writes Jobber-visible log pointer via LAWNFLOW_COMM_LOG custom field. Handles JOB_SCHEDULE_UPDATE (rescheduled) and JOB_COMPLETED events.
- **Renewal & Upsell Worker:** Weekly scan for clients with completed jobs, computes next-best-offer by service + season + lot size using deterministic rules engine. Creates draft quotes in Jobber. Gated by UPSELL_OPT_IN custom field. Tracks offered packages via LAWNFLOW_LAST_OFFER custom field to prevent duplicates. Includes offer catalog JSON with 15+ seasonal service offers.
- **Customer Experience Vector Memory:** Semantic search-enabled customer memory system with pgvector integration:
  - Customer profiles (`customerProfiles` table) with phone-based lookup and tenant-scoped isolation
  - Customer memories (`customerMemories` table) storing interactions, preferences, outcomes, and summaries
  - OpenAI embeddings (text-embedding-3-small, 1536 dimensions) with graceful degradation to keyword search
  - Idempotent memory writes using SHA-256 content hash to prevent duplicates
  - Memory formatters for structured text generation from interaction/preference/outcome data
  - Semantic search via cosine similarity with keyword fallback when embeddings unavailable
  - Orchestrator integration: memories written at key stage completions (LEAD_INTAKE, QUOTE_CONFIRM, SCHEDULE_PROPOSE, CREW_LOCK, JOB_BOOKED)
  - Context enrichment: returning customers get customerInsights populated (preferred crew, time slots, prior services)
  - API endpoints: POST /api/memory/upsert, POST /api/memory/search, GET /api/memory/customer, GET /api/memory/customers, GET /api/memory/status
- **Learning System:** Feedback-driven policy improvement system with comprehensive logging and admin dashboard:
  - Decision Logs (`decisionLogs` table): Captures every AI recommendation with inputs snapshot, recommended action, confidence level, and policy version
  - Human Action Logs (`humanActionLogs` table): Records operator decisions (approve/edit/reject) with edit deltas and reason codes
  - Outcome Logs (`outcomeLogs` table): Tracks downstream results (customer_accepted, job_completed, margin_realized)
  - Reason Codes (`reasonCodes` table): 15 default codes (LOT_SIZE_UNCERTAIN, MARGIN_TOO_LOW, etc.) for structured feedback
  - Policy Versions (`policyVersions` table): Versioned policy configurations with thresholds, pricing, routing, and channel rules
  - Policy Tuning Suggestions (`policyTuningSuggestions` table): Auto-generated policy adjustments based on override patterns
  - Kill Switches (`killSwitches` table): Emergency controls to pause automation by scope (global, agent, stage, decision_type)
  - JSON Diff Engine: Computes edit deltas between AI recommendations and human actions
  - Logging helpers: logDecision(), logHumanAction(), logOutcome() in server/lib/learning/
  - Admin Dashboard (/learning): Metrics overview, policy versions, suggestions, and kill switch management
  - API endpoints: /api/learning/seed, /api/learning/metrics, /api/learning/reason-codes, /api/learning/policy-versions, /api/learning/suggestions, /api/learning/kill-switches
- **Key Features:** Dashboard with ROI metrics, conversation overview, pending actions for human approval, business profile configuration, event simulator, job tracking, and audit logging.

**System Design Choices:**
- **Idempotency:** Implemented via an `event_receipts` table to prevent duplicate processing.
- **Event-Driven Architecture:** Core of the orchestration and webhook processing.
- **Strict Validation:** All tool interfaces use Zod for validation.
- **Caching:** Aggressive, multi-tier caching strategy for lot size resolution.
- **Tiered Policy:** Allows for flexible automation levels based on business needs.

## External Dependencies
- **OpenAI:** Used for AI-powered agents and orchestration (via Replit AI Integrations).
- **PostgreSQL:** Primary database.
- **Google Maps API:** For the interactive Service Area Builder (requires `VITE_GOOGLE_MAPS_API_KEY`).
- **Twilio:** For real SMS capabilities (requires `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_KEY_SECRET`, `TWILIO_MESSAGING_SERVICE_SID`). Falls back to mock SMS if not configured.
- **Jobber:** Integration for webhooks, GraphQL API access, and OAuth for field service management (requires `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`, `JOBBER_REDIRECT_URI`).
- **ArcGIS:** Integrated into the Lot Size Resolver for parcel data and county sources.