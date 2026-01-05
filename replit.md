# LawnFlow AI - Landscaping Business Agentic Automation

## Overview
LawnFlow AI is an MVP agentic add-on for landscaping and lawn care businesses. Its core purpose is to automate customer engagement through AI, handling interactions like missed calls, inbound SMS, and web leads. The project aims to deliver a modern B2B SaaS platform with a clean, efficient admin interface to boost business efficiency and customer satisfaction.

## User Preferences
- Dark mode support enabled (toggle in header)
- Modern B2B SaaS design aesthetic
- Clean, efficient admin interface

## System Architecture
The system utilizes a React + Vite frontend with Shadcn UI, an Express.js and TypeScript backend, and a PostgreSQL database managed by Drizzle ORM. AI capabilities are powered by OpenAI via Replit AI Integrations.

**UI/UX Decisions:**
- Role-based navigation and conditional visibility.
- Unified Inbox with SLA indicators.
- Design tokens for consistent styling.
- Desktop-first responsive design with a green primary color.
- Core pages: Dashboard, Inbox, Jobs, Quotes, Schedule, Customers, Agents, Settings.
- User authentication with session management and auth-aware routing.
- Onboarding-aware navigation.
- Interactive Service Area Builder with Google Maps integration.
- UI Refactor V1 introduces new navigation for Command Center, Work Queue, and Approvals, with granular settings sub-pages and role-based menus.

**Technical Implementations & Feature Specifications:**
- **Lead-to-Cash Orchestrator:** A 10-stage deterministic workflow for lead management with human-in-the-loop approvals.
- **AI Agents:** Specialized agents for intake, quoting, scheduling, simulation, feasibility, margin analysis, crew locking, and dispatch.
- **Tool Interfaces:** Strictly validated tools for various system interactions.
- **Policy System:** Tiered automation policies with configurable rules and confidence thresholds.
- **Lot Size Resolver:** Multi-tier caching and ArcGIS integration for property data.
- **Jobber Integration:** Production-ready FSM connector with OAuth 2.0, GraphQL API, webhooks, and Quote-to-Job Orchestrator.
- **Dispatch & Routing Worker:** Intelligent route planning using a zone-aware greedy optimization algorithm, prioritizing primary and backup zones.
- **Crew Management Module:** CRUD for crews, skills, equipment, schedules, and service zones with RBAC, zone-aware routing, and analytics.
- **Crew Analytics System:** Tracks 15+ daily performance metrics for crews.
- **Route Optimizer:** Multi-agent job assignment system with simulation-based scheduling.
- **Optimizer Orchestrator Agent:** Manages job assignment decisions from creation to writeback.
- **Reconciliation Worker:** Validates invoice/payment integrity and updates Jobber custom fields, including a Dead Letter Queue.
- **Billing Agents (Phase B1):** InvoiceBuildAgent, ReconciliationWorker (Billing), and BillingAgent for invoice generation, integrity checks, and reminder generation.
- **QuickBooks Sync Agent (Phase B2):** QuickBooksClient, InvoiceSyncAgent, and PaymentSyncAgent for syncing invoices and payments between the system and QuickBooks.
- **RemediationAgent (Phase A6):** AI-powered dispute resolution, root cause analysis, and resolution recommendations.
- **Accretive Agents (Phase B):** PricingOptimizationAgent, CapacityForecastingAgent, CrewPerformanceAgent, RetentionAgent, ComplianceRiskAgent for strategic business optimizations.
- **Customer Comms Worker:** Produces customer-facing messages with tone, compliance, and templates.
- **Renewal & Upsell Worker:** Identifies upsell opportunities and creates draft Jobber quotes.
- **Customer Experience Vector Memory:** Semantic search-enabled customer interaction memory with pgvector and OpenAI embeddings.
- **Communications Manager:** Comprehensive intent-based messaging system with templates and compliance guardrails.
- **Learning System:** Feedback-driven policy improvement with logging, versioning, and kill switches.
- **Crew Comms Worker Agent:** Multi-channel notification system for crews with bilingual support, quiet hours enforcement, and 10 notification types.
- **Service Catalog System (Sprint 1):** Manages services, pricing, promotions, and specialized policies for various offerings.
- **Customer Service Preferences System (Sprint 4):** Tracks per-customer/per-service preferences, communication preferences, and uses a PreferenceAgent for AI-powered learning and application of preferences.
- **Key Features:** Dashboard with ROI, conversation overview, human approval, business profile config, event simulator, job tracking, audit logging.
- **Comms Studio:** Unified communications control plane for managing automations, template sets, delivery logs, and audience targeting across various channels and languages.
- **Active Comms (Ops Triage View):** Provides an operational view of communications threads, urgency scoring, SLA monitoring, sentiment analysis, and AI-suggested action items for operators.

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
- **Twilio:** Production-ready SMS connector.
- **Jobber:** Integration for webhooks, GraphQL API, and OAuth for field service management.
- **ArcGIS:** Integrated into the Lot Size Resolver.