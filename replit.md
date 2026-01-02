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
- Persistent navigation featuring Dashboard and My Profile.
- User authentication with session management and auth-aware routing.
- Mobile-responsive navigation.
- Onboarding-aware navigation that gates features until setup is complete.
- Interactive Service Area Builder with Google Maps integration.

**Technical Implementations & Feature Specifications:**
- **Orchestration Engine:** Event-driven workflow execution with idempotency, handling events from missed calls to job completion. It uses an AI-powered supervisor for plan generation and a runner for sequential step execution and tool calls.
- **AI Agents:** Specialized agents for intake, quoting, and scheduling.
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
- **Reconciliation Worker:** Validates invoice/payment integrity by comparing paid_total against sum of payments. Creates alerts for mismatches >$0.01 variance and handles deposit consistency checks. Updates Jobber RECON_STATUS custom field (NEEDS_REVIEW/OK) and includes a Dead Letter Queue (DLQ) pipeline for failed webhooks with exponential backoff retry.
- **Customer Comms Worker:** Produces customer-facing messages with strict tone and compliance rules. Uses templates by service category (lawn_maintenance, hardscape, general). Compliance rules: never promise exact arrival unless GPS-driven ETA, always include reschedule options. Writes Jobber-visible log pointer via LAWNFLOW_COMM_LOG custom field. Handles JOB_SCHEDULE_UPDATE (rescheduled) and JOB_COMPLETED events.
- **Renewal & Upsell Worker:** Weekly scan for clients with completed jobs, computes next-best-offer by service + season + lot size using deterministic rules engine. Creates draft quotes in Jobber. Gated by UPSELL_OPT_IN custom field. Tracks offered packages via LAWNFLOW_LAST_OFFER custom field to prevent duplicates. Includes offer catalog JSON with 15+ seasonal service offers.
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