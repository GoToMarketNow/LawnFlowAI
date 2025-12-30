# LawnFlow AI - Landscaping Business Automation

An MVP agentic add-on for landscaping/lawn care businesses that automates customer engagement through AI-powered agents handling missed calls, inbound SMS, and web leads.

## Quick Start (< 5 minutes)

### Prerequisites
- Node.js 20+
- PostgreSQL database (automatically configured on Replit)

### Setup

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Set up the database**
   ```bash
   npm run db:push
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open the app**
   Navigate to `http://localhost:5000` (or your Replit URL)

### First-Time Setup

The app will automatically seed the database with Green Ridge Lawn Care business profile on first run.

## Features

### AI Agents
- **Intake Agent**: Qualifies missed calls and inbound messages
- **Quote Agent**: Generates price estimates for services
- **Schedule Agent**: Proposes available time slots
- **Reviews Agent**: Sends post-job review requests

### Admin Dashboard
- **Dashboard**: ROI metrics, leads recovered, jobs booked, hours saved
- **Events Feed**: Real-time view of all incoming events
- **Conversations**: Full conversation history with customers
- **Pending Actions**: Approve/reject AI-proposed actions
- **Jobs**: Track all scheduled and completed work
- **Audit Log**: Complete system activity trail

### Tiered Automation Policy
- **Owner Operator**: Basic automation, human approval for quotes/scheduling
- **SMB**: Auto-send range quotes when confidence >= 85%
- **Commercial**: Full automation including auto-booking

## Demo Script

### End-to-End Flow

1. **Simulate a missed call**
   ```bash
   curl -X POST http://localhost:5000/api/events/missed-call \
     -H "Content-Type: application/json" \
     -d '{"from_phone": "+15551234567"}'
   ```

2. **Check the conversation was created**
   - Go to Dashboard → Recent Conversations
   - Or check Conversations page

3. **View the SMS that was sent** (logged in console)
   - Check server logs for `[SMS Mock]` messages

4. **Check lead was created**
   - The system automatically creates a lead in the mock FSM

5. **View pending booking approval**
   - Go to Pending Actions page
   - Approve the scheduling action

6. **Complete a job (triggers review request)**
   ```bash
   curl -X POST http://localhost:5000/api/jobs/1/complete
   ```

### Using the Event Simulator UI

1. Navigate to **Simulator** in the sidebar
2. Select event type (Missed Call, Inbound SMS, Web Lead)
3. Fill in the details
4. Click "Simulate Event"
5. Watch the workflow execute in real-time

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-configured on Replit |
| `SESSION_SECRET` | Session encryption key | Auto-configured |

### Optional: Twilio Integration

For real SMS messaging (not required for testing):

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone (+1XXXXXXXXXX) |

Without Twilio credentials, the system uses mock SMS logging.

## API Endpoints

### Events
- `POST /api/events/missed-call` - Simulate missed call
- `POST /api/simulate-event` - Generic event simulation
- `GET /api/events` - List all events

### Conversations
- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get conversation details
- `GET /api/conversations/:id/messages` - Get messages

### Pending Actions
- `GET /api/pending-actions` - List pending approvals
- `POST /api/pending-actions/:id/approve` - Approve action
- `POST /api/pending-actions/:id/reject` - Reject action

### Jobs
- `GET /api/jobs` - List jobs
- `POST /api/jobs/:id/complete` - Mark job complete

### Policy
- `GET /api/policy` - Get current policy
- `PATCH /api/policy/:id` - Update policy settings
- `GET /api/policy/tiers` - Get tier descriptions

## Running Tests

```bash
npm test
```

Tests cover:
- Supervisor plan validation
- Agent JSON parsing and truncation
- Policy gating logic

## Business Configuration

### Seed Data: Green Ridge Lawn Care
- **Services**: Mowing ($45/visit), Cleanup (min $250), Mulch (min $300)
- **Hours**: Monday-Friday 8AM-5PM
- **Service Area**: Charlottesville + 20 miles

### Modifying the Business Profile

1. Go to **Business Profile** in the sidebar
2. Update company name, services, hours, etc.
3. Changes apply immediately to AI agents

## Architecture

```
client/src/
  pages/          # Dashboard, Conversations, Actions, Jobs, etc.
  components/     # UI components including sidebar

server/
  agents/         # AI specialist agents (intake, quote, schedule)
  connectors/     # Twilio mock, FSM mock connectors
  orchestrator/   # Event processing and workflow
  tools/          # Validated tool interfaces
  policy.ts       # Tiered policy enforcement

shared/
  schema.ts       # Database models and types
```

## License

MIT
