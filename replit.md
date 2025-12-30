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
  /agents         - AI agent prompts and parsing (to be implemented)
  /connectors     - Twilio mock, FSM mock connectors
  /orchestrator   - Event processing and workflow
  routes.ts       - API endpoints
  storage.ts      - Database operations
  db.ts           - Drizzle database connection
/shared/
  schema.ts       - All Drizzle models and types
```

## Key Features
1. **Dashboard**: ROI metrics, conversation overview, pending actions
2. **Conversations**: View all customer interactions with filtering
3. **Pending Actions**: Human-in-the-loop approval for AI actions
4. **Business Profile**: Configure company info for AI agents
5. **Event Simulator**: Test workflows without real Twilio integration
6. **Jobs**: Track scheduled landscaping work
7. **Audit Log**: Complete trail of system actions

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Replit AI integration (auto-configured)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Replit AI integration (auto-configured)

### Twilio (Not Yet Configured)
When ready to enable real SMS:
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number (+1XXXXXXXXXX)

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
- Initial MVP setup with all frontend pages
- PostgreSQL database with full schema
- OpenAI integration for AI agent responses
- Mock Twilio connector (real integration pending user credentials)

## Notes
- Twilio integration was skipped during setup. User can configure later by providing credentials.
- The system uses mock SMS sending until Twilio is configured.
- All AI features use Replit's built-in OpenAI integration (no API key needed).
