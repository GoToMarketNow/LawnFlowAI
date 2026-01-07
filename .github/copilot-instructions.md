# LawnFlow AI - Copilot Instructions

## Project Overview
LawnFlow AI is a full-stack TypeScript application that automates customer engagement for landscaping businesses using AI agents. It handles missed calls, inbound SMS, and web leads through specialized agents (intake, quote, schedule, reviews) with tiered approval policies.

## Architecture
- **Frontend**: React + Vite, Tailwind CSS, Radix UI components (shadcn/ui)
- **Backend**: Express.js with TypeScript, PostgreSQL database via Drizzle ORM
- **AI Layer**: OpenAI-powered agents with structured JSON outputs using Zod schemas
- **Key Directories**:
  - `client/src/`: React app (pages in `pages/`, components in `components/`)
  - `server/`: Express API, agents in `agents/`, orchestrator in `orchestrator/`
  - `shared/`: Database schemas and types in `schema.ts`
  - `tests/`: Jest test suite

## Development Workflow
- **Start dev server**: `npm run dev` (runs `tsx server/index.ts`, serves both API and client)
- **Database setup**: `npm run db:push` (Drizzle push to PostgreSQL)
- **Build**: `npm run build` (Vite build to `dist/`)
- **Type check**: `npm run check` (TypeScript)
- **Test**: `npm test` (Jest, covers agents, supervisor, policy logic)
- **Seed data**: Auto-seeds "Green Ridge Lawn Care" business profile on first run

## AI Agent Patterns
Agents follow consistent structure:
- Use OpenAI API with system prompts defining role and JSON response format
- Validate outputs with Zod schemas (e.g., `intakeResultSchema`)
- Access business context (services, service area) for personalized responses
- Example: `server/agents/intake.ts` - qualifies leads, extracts info, generates response

## Event Processing Flow
1. Inbound events (missed_call, inbound_sms, web_lead) hit `/api/events/*`
2. Orchestrator (`server/orchestrator/`) calls supervisor to plan actions
3. Supervisor evaluates policy tier (Owner Operator/SMB/Commercial) for automation level
4. Executes approved actions: send SMS, create leads, generate quotes
5. High-confidence actions auto-execute; others require approval in Pending Actions UI

## Database Schema Highlights
- `businessProfiles`: Company settings, service area, pricing, automation prefs
- `conversations`: Customer threads with status (active/qualified/scheduled/completed)
- `messages`: Individual messages (customer/ai/system)
- `events`: Inbound triggers with metadata
- `leads/customers/quotes/jobs`: CRM entities with AI-generated data
- Relations defined in `shared/schema.ts` with Drizzle ORM

## UI Patterns
- Dashboard-first design: High data density, scannable metrics
- Sidebar navigation with page-specific actions
- Approval workflows: Pending Actions page for human oversight
- Event simulator (`/simulator`) for testing agent flows
- Responsive grid layouts (Tailwind classes: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`)

## Testing Approach
- Unit tests for agent logic, supervisor plans, policy gating
- Mock connectors (Twilio, FSM) for isolated testing
- Event simulation endpoints for integration testing
- Coverage focuses on server-side logic (`server/**/*.ts`)

## Key Conventions
- **Imports**: Absolute paths with `@shared/` for shared code, `@/` for client
- **API responses**: JSON with consistent error handling
- **Logging**: Custom `log()` function with timestamps and source tags
- **Session auth**: Express-session with auto-login for super admin in dev
- **Environment**: Replit-optimized (ports, database URL auto-configured)
- **Mock vs Real**: Twilio connector mocks SMS unless credentials provided

## Common Tasks
- **Add new agent**: Create in `server/agents/`, add to supervisor plan logic
- **Modify UI**: Update `client/src/pages/` or `components/`, use shadcn/ui primitives
- **Database changes**: Update `shared/schema.ts`, run `npm run db:push`
- **Test agent**: Use simulator UI or curl events, check console logs for `[SMS Mock]`
- **Policy changes**: Update `server/policy.ts` for tiered automation rules</content>
<parameter name="filePath">/workspaces/LawnFlowAI/.github/copilot-instructions.md