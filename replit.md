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
- **Billing Agents (Phase B1):**
  - **InvoiceBuildAgent:** AI-powered invoice generation from completed job data with configurable pricing rules and fallback calculations
  - **ReconciliationWorker (Billing):** Validates invoice/payment integrity, detects status mismatches, overpayments, and creates billing issues for HIGH severity problems. Uses batched payment retrieval and dedupe keys to prevent duplicate issues.
  - **BillingAgent:** AI-driven reminder generation with tone control and escalation cadence
  - API endpoints: `POST /api/billing/invoices/generate`, `POST /api/billing/reconcile`, `POST /api/billing/actions/reminder`
- **QuickBooks Sync Agent (Phase B2):**
  - **QuickBooksClient:** API client class with OAuth token refresh placeholder, customer/invoice/payment CRUD operations
  - **InvoiceSyncAgent:** Syncs local invoices to QuickBooks, handles already-synced detection via externalInvoiceId, creates billing issues on sync failure
  - **PaymentSyncAgent:** Syncs payments from QuickBooks to local storage, uses pre-loaded data with O(1) Map lookups to avoid N^2 performance, batches invoice status updates at end
  - Currency conversion: cents to dollars for QuickBooks API, dollars to cents for local storage
  - API endpoints: `POST /api/billing/sync/invoice/:id`, `POST /api/billing/sync/invoices`, `POST /api/billing/sync/payments`, `GET /api/billing/integrations`
- **RemediationAgent (Phase A6):**
  - AI-powered dispute resolution analyzing billing issues and recommending actions
  - Root cause analysis: SCOPE_MISMATCH, QUALITY_ISSUE, PRICING_SURPRISE, PAYMENT_ERROR, COMMUNICATION_BREAKDOWN
  - Resolution options: CREDIT, REDO_VISIT, CALL_CUSTOMER, ADJUST_INVOICE, WAIVE_FEES
  - Human approval required for credits above threshold ($50)
  - API endpoint: `POST /api/billing/remediate`
- **Accretive Agents (Phase B):**
  - **PricingOptimizationAgent (B1):** Analyzes quote acceptance rates, recommends pricing adjustments with confidence scores and expected impact. All changes require owner approval.
  - **CapacityForecastingAgent (B2):** Forecasts crew capacity, provides daily utilization predictions, zone-based accept/pause recommendations
  - **CrewPerformanceAgent (B3):** Analyzes crew metrics (on-time rate, rework rate), generates coaching insights, identifies top performers
  - **RetentionAgent (B4):** Customer churn risk scoring, retention outreach recommendations, campaign suggestions for reactivation
  - **ComplianceRiskAgent (B5):** License/insurance expiration monitoring, compliance alerts (stub implementation for MVP)
  - API endpoints: `POST /api/agents/pricing-optimization`, `POST /api/agents/capacity-forecast`, `POST /api/agents/crew-performance`, `POST /api/agents/retention`, `POST /api/agents/compliance-risk`
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
- **Service Catalog System (Sprint 1):**
  - 7 database tables: services, servicePricing, serviceFrequencyOptions, promotionRules, snowServicePolicies, mulchProfiles, firewoodProfiles
  - 10 seeded services covering lawn care, cleanup, snow removal, mulch, firewood, custom projects
  - 4 promotion rules: seasonal, bundle discounts, new customer offers
  - Pricing models: per-visit, per-sqft, per-load, per-event with frequency modifiers
  - Snow service policies for ROTATION vs ON_DEMAND modes
  - Material tracking for mulch (type, color, cubic yards) and firewood (cord sizes, species)
  - Lead-time requirements for specialized services
  - Agent contracts: ServiceSelectionAgent, PricingAgent, PromotionAgent
  - API endpoints at `/api/services`, `/api/services/:id/pricing`, `/api/promotions`, etc.
  - Settings UI at `/settings/services` with service cards and promotion display
- **Customer Service Preferences System (Sprint 4):**
  - Database table: `customerServicePreferences` with 20+ tracked fields
  - Per-customer/per-service preference tracking: frequency, timing, crew, price flexibility
  - Communication preferences: SMS/EMAIL/PHONE, do-not-contact flags
  - Confidence scoring (0-100) for AI-learned vs manually set preferences
  - **PreferenceAgent:** AI-powered preference learning from interaction history
    - `learn`: Extracts preferences from conversation/booking patterns with confidence checks
    - `apply`: Enriches service requests with stored preferences for personalization
    - `summary`: Generates human-readable preference summaries for operators
  - Integration with ServiceSelectionAgent (enriches service names for context)
  - Integration with PricingAgent (uses minPriceCents/targetPriceCents/maxPriceCents based on priceFlexibility)
  - CRUD API endpoints at `/api/customers/:customerId/preferences` with Zod validation and ownership checks
  - Agent API endpoints at `/api/agents/preference/learn`, `/api/agents/preference/apply`, `/api/agents/preference/summary/:customerId`
- **Key Features:** Dashboard with ROI metrics, conversation overview, human approval actions, business profile configuration, event simulator, job tracking, and audit logging.
- **Comms Studio (Unified Communications Control Plane):**
  - Database tables: `commsAutomations`, `commsTemplateSets`, `commsDeliveryLogs`, `commsAudienceIndex`
  - Audience types: CUSTOMER, LEAD, CREW
  - Automation types: LEAD_QUALIFICATION, QUOTE_FOLLOWUP, APPOINTMENT_REMINDER, REVIEW_REQUEST, RETENTION_NUDGE, CREW_DAILY_BRIEFING, CREW_SCHEDULE_CHANGE, CREW_NEW_JOB_ADDED, CREW_SCOPE_CHANGE, CUSTOM
  - Trigger types: EVENT (e.g., JOB_ASSIGNED), SCHEDULED (cron + delay), MANUAL
  - States: ACTIVE, PAUSED, INACTIVE (paused automations don't send)
  - Channels: SMS, EMAIL, IN_APP, PUSH
  - Language modes: AUTO, EN, ES
  - Template sets with bilingual support (EN/ES) and message variants (default, short, followup)
  - Delivery logging with status tracking (QUEUED, SENT, DELIVERED, FAILED, ACKED)
  - Seeded 6 default automations: Lead Qualification, Quote Follow-up, Crew Daily Briefing, Crew New Job Added, Crew Schedule Change, Review Request
  - Storage methods for CRUD operations on automations, template sets, delivery logs, and audience index
  - Seed script: `server/seed-comms-studio.ts`

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

## Agent Documentation
- **Agent Directory:** `docs/agents/README.md` - Overview of all agents with triggers, I/O, and escalation rules
- **Agent Contracts:** `docs/agents/contracts/*.json` - JSON Schema contracts for each agent
- **Onboarding Billing Step:** Optional step in wizard for QuickBooks integration, invoice terms, and tax settings