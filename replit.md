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
- Role-based navigation and conditional visibility.
- Unified Inbox for all pending approvals with SLA indicators.
- Design tokens for consistent styling.
- Desktop-first responsive design with a green primary color.
- Core pages: Dashboard, Inbox, Jobs, Quotes, Schedule, Customers, Agents, Settings.
- User authentication with session management and auth-aware routing.
- Onboarding-aware navigation.
- Interactive Service Area Builder with Google Maps integration.
- **UI Refactor V1** (feature-flagged via `VITE_UI_REFACTOR_V1`):
  - New navigation structure: Command Center (`/home`), Work Queue (`/work`), Approvals (`/approvals`)
  - Settings sub-pages: `/settings/agents`, `/settings/policies`, `/settings/pricing`, `/settings/integrations`, `/settings/observability`, `/settings/exports`
  - Role-based menus in `client/src/lib/ui/nav-v2.ts` for OWNER_ADMIN, CREW_LEAD, CREW_MEMBER
  - Legacy routes remain functional when flag is off; redirects active when flag is on
  - API endpoints: `/api/ops/kpis`, `/api/work-queue`, `/api/approvals`
  - See `docs/ui-refactor.md` for full route mapping and implementation phases

**Technical Implementations & Feature Specifications:**
- **Lead-to-Cash Orchestrator:** A 10-stage deterministic workflow managing the full lead lifecycle from intake to job booking, featuring human-in-the-loop approvals.
- **AI Agents:** Specialized agents for intake, quoting, scheduling, simulation, feasibility, margin analysis, crew locking, and dispatch.
- **Tool Interfaces:** Strictly validated tools for communication, FSM integration, approvals, and auditing.
- **Policy System:** A tiered automation policy system with configurable rules for various business operations and confidence thresholds.
- **Lot Size Resolver:** Multi-tier caching and ArcGIS integration for accurate property data.
- **Jobber Integration:** Full production-ready FSM connector with OAuth 2.0, GraphQL API client, webhook processing, and a Quote-to-Job Orchestrator.
- **Dispatch & Routing Worker:** Intelligent route planning and crew dispatch with event-driven and nightly modes, employing a zone-aware greedy optimization algorithm (v2-zone-aware). Scoring prioritizes primary zones (20-point bonus) and backup zones (10-point bonus) using Haversine distance for circular zones and lat/lng bounds for bounding box zones.
- **Crew Management Module:** Comprehensive CRUD operations for crews, skills, equipment, schedules, and service zones with RBAC enforcement. Includes zone-aware routing, crew-to-zone assignments, and performance analytics.
- **Crew Analytics System:** Daily performance snapshots tracking 15+ metrics including jobs completed, utilization, revenue, zone compliance, drive time efficiency, and on-time arrival rates. API endpoints at `/api/ops/crews/:id/analytics` and `/api/ops/analytics/crews` with period filtering.
- **Route Optimizer:** Multi-agent job assignment system with job request tracking and simulation-based scheduling, including a decision workflow.
- **Optimizer Orchestrator Agent:** Manages the end-to-end decision workflow for job assignments, including creation, approval, and writeback.
- **Reconciliation Worker:** Validates invoice/payment integrity and updates Jobber custom fields, including a Dead Letter Queue for failed webhooks.
- **Customer Comms Worker:** Produces customer-facing messages with strict tone, compliance rules, and templates, handling various job events.
- **Renewal & Upsell Worker:** Weekly scans for upsell opportunities, computes next-best-offers, and creates draft quotes in Jobber.
- **Customer Experience Vector Memory:** Semantic search-enabled customer memory system with pgvector integration for storing and retrieving customer interactions and preferences, using OpenAI embeddings for context enrichment.
- **Communications Manager:** Comprehensive customer messaging system with an intent-based architecture, a template library, custom renderer, and compliance guardrails.
- **Learning System:** Feedback-driven policy improvement system with detailed logging of AI recommendations, human actions, and outcomes, including policy versioning and kill switches.
- **Crew Comms Worker Agent:** Multi-channel notification system for crew communications with bilingual support (EN/ES). Features include:
  - 10 notification types: DAILY_BRIEFING, JOB_ADDED, JOB_UPDATED, JOB_CANCELED, SCOPE_CHANGED, ETA_CHANGED, CUSTOMER_NOTE, EQUIPMENT_ALERT, ACTION_REQUIRED, CREW_BROADCAST
  - Channels: IN_APP (always enabled), PUSH (preference-based), SMS (via Twilio with urgent override)
  - Recipient resolution from crew assignments
  - Quiet hours enforcement (check quietHoursStart/End fields)
  - Language preferences stored in crewCommsPreferences table
  - API endpoints at `/api/crew-comms/*` for notifications, preferences, push subscriptions, and broadcasts
  - UI components: NotificationBell in header, CrewInboxPage at `/crew-inbox`
- **Key Features:** Dashboard with ROI metrics, conversation overview, human approval actions, business profile configuration, event simulator, job tracking, and audit logging.

**System Design Choices:**
- **Idempotency:** Implemented via an `event_receipts` table.
- **Event-Driven Architecture:** Core for orchestration and webhook processing.
- **Strict Validation:** Zod for all tool interfaces.
- **Caching:** Aggressive, multi-tier caching.
- **Tiered Policy:** Flexible automation levels.

## External Dependencies
- **OpenAI:** For AI-powered agents and orchestration (via Replit AI Integrations).
- **PostgreSQL:** Primary database.
- **Google Maps API:** For the interactive Service Area Builder.
- **Twilio:** Production-ready SMS connector with API Key authentication, retry logic, audit logging, and webhook signature validation.
- **Jobber:** Integration for webhooks, GraphQL API, and OAuth for field service management.
- **ArcGIS:** Integrated into the Lot Size Resolver.