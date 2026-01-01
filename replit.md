# LawnFlow AI - Landscaping Business Agentic Automation

## Overview
LawnFlow AI is an MVP agentic add-on for landscaping/lawn care businesses. It provides automated customer engagement through AI-powered agents that handle missed calls, inbound SMS, and web leads.

## Tech Stack
- **Frontend**: React + Vite with Shadcn UI components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI (via Replit AI Integrations - no API key required)
- **Routing**: wouter for client-side routing

## Project Structure
```
/client/src/
  /pages          - Dashboard, Conversations, Actions, Jobs, etc.
  /components     - UI components including sidebar
  /lib            - Theme provider, query client
/server/
  /agents         - AI specialist agents (intake, quote, schedule)
  /connectors     - Twilio mock, FSM mock connectors
  /orchestrator   - Event processing and workflow
  /tools          - Validated tool interfaces with Zod schemas
  routes.ts       - API endpoints
  storage.ts      - Database operations
  db.ts           - Drizzle database connection
/shared/
  schema.ts       - All Drizzle models and types
```

## Tool Interfaces (server/tools/index.ts)
All tools have strict Zod validation and audit logging:
- `comms.sendSms(to, text)` - Send SMS (mock/Twilio)
- `comms.logInbound(channel, from, payload, received_at_iso)` - Log inbound messages
- `fsm.getAvailability(date_from_iso, date_to_iso, service_type)` - Get crew availability
- `fsm.createLead(name, phone, address, service_requested, notes)` - Create lead in FSM
- `fsm.createJob(leadId, start_iso, end_iso, service_type, notes)` - Schedule job
- `approvals.requestApproval(type, summary, payload)` - Create human-in-loop approval
- `approvals.resolveApproval(approvalId, decision, notes)` - Approve/reject action
- `audit.logEvent(action, actor, payload)` - Log to audit trail
- `metrics.record(name, value, tags)` - Record metrics

## Orchestration Engine (server/orchestrator/)
The orchestration engine handles event-driven workflow execution with idempotency:

### Entry Point
- `orchestrator.handleEvent(event)` - Main entry, checks idempotency via event_receipts table

### Components
- `supervisor.plan(event, state, policy)` - AI-powered plan generation returning SupervisorPlan JSON
- `runner.execute(plan)` - Sequential step execution with tool calls

### Step Execution Flow
1. Call the agent with inputs
2. Parse JSON response with Zod schema
3. If `requiresApproval` -> create approval record and stop
4. If action allowed -> call tools (comms, fsm, etc.)
5. Persist state updates (conversation messages, leads, jobs)

### End-to-End Flow
```
Missed call -> Intake agent -> comms.sendSms -> fsm.createLead 
-> Schedule agent -> approvals.requestApproval(book_job) 
-> (admin approves) -> fsm.createJob 
-> POST /api/jobs/:id/complete -> Reviews agent sends review request
```

## Key Features
1. **Dashboard**: ROI metrics, conversation overview, pending actions
2. **Conversations**: View all customer interactions with filtering
3. **Pending Actions**: Human-in-the-loop approval for AI actions
4. **Business Profile**: Configure company info for AI agents
5. **Event Simulator**: Test workflows without real Twilio integration
6. **Jobs**: Track scheduled landscaping work
7. **Audit Log**: Complete trail of system actions
8. **Idempotency**: Event receipts prevent duplicate processing
9. **Tiered Policy System**: Configurable automation based on business tier

## Policy System (server/policy.ts)
Tiered automation policy enforcement with configurable rules:

### Tiers
- **Owner Operator**: Basic automation with human approval for quotes/scheduling
  - auto_send_messages: true
  - auto_send_quotes: false
  - auto_book_jobs: false
  - confidence_threshold: 0.85

- **SMB**: Enhanced automation with auto-quotes for range estimates
  - auto_send_messages: true
  - auto_send_quotes: true (range quotes only, confidence >= 0.85)
  - auto_book_jobs: false
  - after_hours_automation: configurable
  - confidence_threshold: 0.85

- **Commercial**: Full automation for high-confidence opportunities
  - auto_send_messages: true
  - auto_send_quotes: true (range/fixed, confidence >= 0.9, within pricing rules)
  - auto_book_jobs: true (confidence >= 0.9, slot_score >= threshold)
  - after_hours_automation: configurable
  - confidence_threshold: 0.90

### Policy Checks
- `policy.check(action, context)` validates all actions before execution
- Service area checks (zip code whitelist)
- Do-not-serve rules (blocked phones/addresses)
- Pricing rule enforcement for Commercial tier

### API Endpoints
- GET /api/policy - Get current policy profile
- GET /api/policy/tiers - Get tier descriptions
- PATCH /api/policy/:id - Update policy settings
- POST /api/policy/blocked-phones - Add blocked phone
- DELETE /api/policy/blocked-phones/:phone - Remove blocked phone
- POST /api/policy/service-area - Update service area

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Replit AI integration (auto-configured)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Replit AI integration (auto-configured)

### Google Maps (Service Area Builder)
To enable the interactive Service Area Builder with Google Maps:
- `VITE_GOOGLE_MAPS_API_KEY` - Your Google Maps API key (client-side)
  - Enable Maps JavaScript API in Google Cloud Console
  - Note: Without this key, the Service Area section will show an error message but other functionality works

### Twilio (Configured)
Real SMS is enabled with API Key authentication:
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_API_KEY` - API Key SID (starts with SK)
- `TWILIO_API_KEY_SECRET` - API Key Secret
- `TWILIO_MESSAGING_SERVICE_SID` - Messaging Service for OTP delivery (MG277f5b29887900045def40b5363a2d1e)
- Falls back to `TWILIO_AUTH_TOKEN` if API Key not configured
- Replit Twilio Integration is also supported as primary source

## Running Locally
```bash
npm run dev
```

## Database Migrations
```bash
npm run db:push
```

## User Preferences
- Dark mode support enabled (toggle in header)
- Modern B2B SaaS design aesthetic
- Clean, efficient admin interface

## Recent Changes
- Service Area Builder with Google Maps integration in Business Profile
- Haversine distance calculation for service area eligibility checks
- Service area evaluation integrated into orchestrator (core/extended/out_of_area tiers)
- Mock geocoder for address-to-coordinates conversion (swap to Google Geocoding API for production)
- Twilio inbound SMS webhook with signature validation (POST /webhooks/twilio/sms)
- Missed call simulation endpoint (POST /api/events/missed-call)
- Real Twilio SMS sending with retries (3 attempts) and failure logging
- Orchestration engine with supervisor planning and runner execution
- Idempotency via event_receipts table
- Tool interfaces with strict Zod validation
- POST /api/jobs/:id/complete endpoint for simulating job completion
- Reviews agent for post-job review requests

## Service Area Builder
The Business Profile now includes a Service Area Builder with:
- Interactive Google Maps for setting business location (drag marker)
- Radius slider for core service area (1-40 miles)
- Max travel limit dropdown (5, 10, 20, or 40 miles)
- Extended area toggle (accept requests beyond core radius)

Service area evaluation during orchestration:
- `core`: Distance within radiusMi - fully automated
- `extended`: Distance between radiusMi and maxMi - requires approval for Owner/SMB tiers
- `out_of_area`: Beyond maxMi - polite decline or handoff to human

## Notes
- Twilio integration was skipped during setup. User can configure later by providing credentials.
- The system uses mock SMS sending until Twilio is configured.
- All AI features use Replit's built-in OpenAI integration (no API key needed).
