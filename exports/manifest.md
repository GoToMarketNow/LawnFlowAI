# LawnFlow.ai Screenshot Manifest

**Generated:** 1/4/2026, 9:10:37 PM
**App Version:** 1.0.0-mvp
**Total Screenshots:** 23

## Summary by Journey Stage

| Stage | Count |
|-------|-------|
| Lead Capture | 4 |
| Lead Qualification | 2 |
| Quote Generation | 2 |
| Scheduling | 2 |
| Service Delivery | 4 |
| Invoice & Collection | 2 |
| Ongoing Communications | 2 |
| AI Agents Directory | 2 |
| Settings & Configuration | 3 |

## Summary by Persona

| Persona | Count |
|---------|-------|
| Business Owner/Admin | 20 |
| Crew Lead | 2 |
| Crew Member | 1 |

---

## Screenshots

### Lead Capture

#### Dashboard Overview

**ID:** `dashboard_overview`
**Route:** `/dashboard`
**Persona:** Business Owner/Admin
**Image:** `screenshots/dashboard_overview.png`

> At-a-glance business health and pending actions.

**Description:**

The dashboard provides owners with immediate visibility into key business metrics 
including leads recovered, jobs booked, hours saved, and revenue generated. 
Pending actions requiring human approval are prominently displayed for quick action.
AI agents summarize daily performance and surface recommendations.


**Agents Involved:** OrchestratorAgent, MetricsAgent

**Value Drivers:** `less_admin`, `higher_profit`

**Inputs:**
- business profile
- active leads
- scheduled jobs

**Outputs:**
- ROI metrics
- pending approvals count
- agent activity summary

**Escalation/Approval:**
> Displays count of items needing owner review

---

#### Unified Inbox

**ID:** `inbox_unified`
**Route:** `/inbox`
**Persona:** Business Owner/Admin
**Image:** `screenshots/inbox_unified.png`

> All pending approvals in one place with SLA indicators.

**Description:**

The unified inbox consolidates all items requiring human review across the entire
lead-to-cash workflow. Items are prioritized by urgency with visual SLA indicators
(red=urgent, yellow=warning, green=normal). Owners can approve, edit, or reject
directly from this view with minimal clicks.


**Agents Involved:** InboundLeadAgent, ApprovalQueueAgent

**Value Drivers:** `less_admin`, `happier_customers`

**Inputs:**
- pending quotes
- pending schedules
- pending crew assignments

**Outputs:**
- approved actions
- rejection reasons
- edit overrides

**Escalation/Approval:**
> All items here are already escalated awaiting human decision

---

#### Customer Conversations

**ID:** `conversations_list`
**Route:** `/conversations`
**Persona:** Business Owner/Admin
**Image:** `screenshots/conversations_list.png`

> All customer SMS threads with AI handling status.

**Description:**

View all customer conversations organized by status (active, pending, completed).
Each thread shows the AI agent's current handling state, last message preview,
and any escalation flags. Owners can jump into any conversation to review
the full thread or take over from the AI.


**Agents Involved:** SMSAgent, InboundLeadAgent

**Value Drivers:** `happier_customers`, `less_admin`

**Inputs:**
- inbound SMS
- missed calls
- web leads

**Outputs:**
- conversation status
- agent recommendations
- next actions

**Escalation/Approval:**
> Escalates when customer intent is unclear or requests human

---

#### Conversation Thread Detail

**ID:** `conversation_detail`
**Route:** `/conversations`
**Persona:** Business Owner/Admin
**Image:** `screenshots/conversation_detail.png`

> Full SMS thread with AI annotations and actions.

**Description:**

Deep dive into a specific customer conversation showing the complete message
history with AI agent annotations. Each message shows intent classification,
suggested responses, and action buttons. The agent's reasoning is visible
to help owners understand and override decisions when needed.


**Agents Involved:** SMSAgent, IntentParsingAgent

**Value Drivers:** `happier_customers`, `less_admin`

**Inputs:**
- customer messages
- property info
- service history

**Outputs:**
- classified intent
- suggested reply
- quote trigger

**Escalation/Approval:**
> Manual takeover available at any point

---

### Lead Qualification

#### Leads Management

**ID:** `leads_list`
**Route:** `/leads`
**Persona:** Business Owner/Admin
**Image:** `screenshots/leads_list.png`

> All leads with qualification status and next steps.

**Description:**

Comprehensive lead management showing all prospects with their qualification
status, source (SMS, web, call), property details, and AI-recommended next
action. Leads are scored by the qualification agent based on service fit,
location coverage, and estimated value.


**Agents Involved:** LeadQualificationAgent, PropertyLookupAgent

**Value Drivers:** `less_admin`, `more_lawns`

**Inputs:**
- lead source
- customer contact
- service request

**Outputs:**
- qualification score
- coverage status
- recommended action

**Escalation/Approval:**
> Escalates leads with low confidence or out-of-area requests

---

#### Service Area Configuration

**ID:** `service_area_map`
**Route:** `/settings`
**Persona:** Business Owner/Admin
**Image:** `screenshots/service_area_map.png`

> Interactive map defining where the business operates.

**Description:**

The service area builder uses Google Maps to let owners draw their coverage
zones visually. Properties are automatically validated against these zones
during lead intake. The AI uses this data to reject or flag out-of-area
requests before they consume valuable time.


**Agents Involved:** CoverageValidationAgent

**Value Drivers:** `more_lawns`, `productive_crews`

**Inputs:**
- business address
- coverage radius
- exclusion zones

**Outputs:**
- coverage validation
- travel time estimates
- zone alerts

**Escalation/Approval:**
> Out-of-area leads automatically flagged for manual review

---

### Quote Generation

#### Quotes Management

**ID:** `quotes_list`
**Route:** `/quotes`
**Persona:** Business Owner/Admin
**Image:** `screenshots/quotes_list.png`

> All quotes with status, value, and customer response.

**Description:**

Central quote management showing all estimates with their status (draft, sent,
accepted, declined), calculated value, and customer response timeline. The
AI agent tracks quote performance to improve future pricing recommendations
and identify patterns in customer acceptance rates.


**Agents Involved:** QuoteBuildAgent, PricingEngine

**Value Drivers:** `higher_profit`, `less_admin`

**Inputs:**
- service request
- property data
- pricing rules

**Outputs:**
- quote amount
- margin estimate
- competitive position

**Escalation/Approval:**
> Quotes above threshold or with unusual parameters need approval

---

#### Quote Builder

**ID:** `quote_builder`
**Route:** `/quotes`
**Persona:** Business Owner/Admin
**Image:** `screenshots/quote_builder.png`

> AI-assisted quote creation with pricing recommendations.

**Description:**

The quote builder uses property data (lot size, complexity, access) combined
with service type and frequency to generate pricing recommendations. The AI
explains its reasoning and shows comparable quotes from similar properties.
Owners can adjust any line item with the AI learning from these edits.


**Agents Involved:** QuoteBuildAgent, LotSizeResolver

**Value Drivers:** `higher_profit`, `less_admin`

**Inputs:**
- lot size
- service type
- frequency
- special conditions

**Outputs:**
- line items
- total price
- margin calculation
- confidence score

**Escalation/Approval:**
> Low-confidence quotes flagged for manual pricing review

---

### Scheduling

#### Master Schedule Calendar

**ID:** `schedule_calendar`
**Route:** `/schedule`
**Persona:** Business Owner/Admin
**Image:** `screenshots/schedule_calendar.png`

> Visual calendar showing all scheduled jobs and crew assignments.

**Description:**

The master schedule provides a calendar view of all upcoming jobs with crew
assignments color-coded. The AI optimizes routes daily and suggests schedule
adjustments when new jobs are added. Drag-and-drop rescheduling triggers
automatic customer notifications and route recalculation.


**Agents Involved:** ScheduleProposalAgent, RouteOptimizer

**Value Drivers:** `productive_crews`, `less_admin`

**Inputs:**
- accepted quotes
- crew availability
- service areas

**Outputs:**
- crew assignments
- optimized routes
- customer confirmations

**Escalation/Approval:**
> Schedule conflicts or overloaded days flagged for review

---

#### Crew Management

**ID:** `crew_assignment`
**Route:** `/crews`
**Persona:** Business Owner/Admin
**Image:** `screenshots/crew_assignment.png`

> Manage crews, skills, equipment, and daily capacity.

**Description:**

Crew management shows all crews with their home base, skills, equipment,
and current utilization. The AI runs simulations to recommend optimal
job assignments based on distance, equipment match, and margin impact.
Skills and certifications are tracked to ensure proper job matching.


**Agents Involved:** CrewIntelligenceAgent, SimulationEngine

**Value Drivers:** `productive_crews`, `higher_profit`

**Inputs:**
- crew profiles
- equipment inventory
- skill certifications

**Outputs:**
- utilization metrics
- assignment recommendations
- capacity alerts

**Escalation/Approval:**
> Overbooked crews or skill mismatches require owner approval

---

### Service Delivery

#### Jobs Overview

**ID:** `jobs_list`
**Route:** `/jobs`
**Persona:** Business Owner/Admin
**Image:** `screenshots/jobs_list.png`

> All jobs with status, crew, and completion progress.

**Description:**

Comprehensive job tracking showing all scheduled, in-progress, and completed
work. Real-time status updates from crews flow through here with the AI
detecting anomalies like delayed starts or extended durations. Customer
communication is automated based on job status changes.


**Agents Involved:** DispatchAgent, JobTrackingAgent

**Value Drivers:** `productive_crews`, `happier_customers`

**Inputs:**
- scheduled jobs
- crew status updates
- completion reports

**Outputs:**
- job status
- duration tracking
- customer notifications

**Escalation/Approval:**
> Jobs running significantly over time trigger alerts

---

#### Today's Jobs (Crew View) [PLACEHOLDER]

**ID:** `crew_today_view`
**Route:** `/dashboard`
**Persona:** Crew Lead
**Image:** `screenshots/crew_today_view_placeholder.png`

> Crew lead sees today's route and job details.

**Description:**

The crew lead dashboard focuses on today's work with jobs listed in
optimized route order. Each job shows address, scope notes, special
instructions, and equipment needed. One-tap navigation and job start/complete
buttons streamline field operations.


**Agents Involved:** DispatchAgent, NavigationAgent

**Value Drivers:** `productive_crews`

**Inputs:**
- assigned jobs
- route sequence
- customer notes

**Outputs:**
- navigation links
- job status updates
- completion forms

**Escalation/Approval:**
> Crew can flag issues or request owner support

---

#### Job Detail (Crew)

**ID:** `job_detail_crew`
**Route:** `/jobs`
**Persona:** Crew Lead
**Image:** `screenshots/job_detail_crew.png`

> Detailed job scope, notes, and completion checklist.

**Description:**

Deep job detail view for crews showing full service scope, property notes,
customer preferences, and any special instructions from the AI or owner.
Before/after photo capture and completion notes feed back into the system
for invoicing and quality tracking.


**Agents Involved:** JobTrackingAgent

**Value Drivers:** `productive_crews`, `happier_customers`

**Inputs:**
- job scope
- property history
- customer preferences

**Outputs:**
- completion status
- photos
- notes
- time tracking

**Escalation/Approval:**
> Issues or change requests escalate to owner

---

#### Mobile Crew App (Planned) [NOT IMPLEMENTED]

**ID:** `mobile_crew_app`
**Route:** `/not-implemented`
**Persona:** Crew Member
**Image:** `screenshots/mobile_crew_app_placeholder.png`

> Native mobile app for field crews (not yet built).

**Description:**

[NOT IMPLEMENTED] A dedicated mobile experience optimized for field
crews with offline support, GPS tracking, and simplified job interaction.
This represents the vision for Phase 2 development.


**Agents Involved:** MobileAgent

**Value Drivers:** `productive_crews`

**Inputs:**
- N/A

**Outputs:**
- N/A

**Escalation/Approval:**
> N/A

---

### Invoice & Collection

#### Ready to Invoice [PLACEHOLDER]

**ID:** `invoicing_ready`
**Route:** `/jobs`
**Persona:** Business Owner/Admin
**Image:** `screenshots/invoicing_ready_placeholder.png`

> Completed jobs ready for invoicing and collection.

**Description:**

Jobs marked complete are automatically queued for invoicing. The AI
validates actual work against the quoted scope, flags discrepancies,
and generates invoices for approval. Payment links can be sent via
SMS or email with automatic follow-up reminders.


**Agents Involved:** InvoiceAgent, ReconciliationWorker

**Value Drivers:** `higher_profit`, `less_admin`

**Inputs:**
- completed jobs
- time logs
- scope changes

**Outputs:**
- invoice drafts
- payment requests
- collection status

**Escalation/Approval:**
> Scope changes or discrepancies need owner approval before invoicing

---

#### Payment Processing (Planned) [NOT IMPLEMENTED]

**ID:** `payment_processing`
**Route:** `/not-implemented`
**Persona:** Business Owner/Admin
**Image:** `screenshots/payment_processing_placeholder.png`

> Integrated payment collection (not yet built).

**Description:**

[NOT IMPLEMENTED] Direct payment collection via Stripe integration
with automatic reconciliation and receipt generation. Currently
invoicing syncs to Jobber where payments are processed.


**Agents Involved:** PaymentAgent

**Value Drivers:** `higher_profit`

**Inputs:**
- N/A

**Outputs:**
- N/A

**Escalation/Approval:**
> N/A

---

### Ongoing Communications

#### Customer Management

**ID:** `customers_list`
**Route:** `/customers`
**Persona:** Business Owner/Admin
**Image:** `screenshots/customers_list.png`

> All customers with service history and renewal status.

**Description:**

Customer relationship management showing all clients with their properties,
service history, and AI-detected opportunities. The renewal agent identifies
customers due for repeat service while the upsell agent suggests seasonal
add-ons based on property characteristics and past purchases.


**Agents Involved:** RenewalAgent, UpsellAgent

**Value Drivers:** `happier_customers`, `more_lawns`

**Inputs:**
- customer profiles
- service history
- seasonal calendar

**Outputs:**
- renewal reminders
- upsell suggestions
- review requests

**Escalation/Approval:**
> High-value renewals may be flagged for personal outreach

---

#### Review Request Automation

**ID:** `review_request`
**Route:** `/conversations`
**Persona:** Business Owner/Admin
**Image:** `screenshots/review_request.png`

> Automated review requests after service completion.

**Description:**

After job completion, the AI sends appropriately timed review requests
via SMS. The message is personalized based on the service performed
and customer history. Positive responses can trigger referral requests
while negative feedback routes to owner for immediate attention.


**Agents Involved:** ReviewRequestAgent, SMSAgent

**Value Drivers:** `happier_customers`, `more_lawns`

**Inputs:**
- completed job
- customer satisfaction signals
- timing rules

**Outputs:**
- review request sent
- response tracking
- rating aggregation

**Escalation/Approval:**
> Negative feedback immediately escalates to owner

---

### AI Agents Directory

#### AI Agents Directory

**ID:** `agents_directory`
**Route:** `/agents`
**Persona:** Business Owner/Admin
**Image:** `screenshots/agents_directory.png`

> Catalog of all AI agents with capabilities and status.

**Description:**

The agents directory provides visibility into all AI agents powering
LawnFlow. Each agent shows its purpose, current activity level, success
metrics, and configuration options. Owners can enable/disable specific
agents and adjust automation thresholds without code changes.


**Agents Involved:** All

**Value Drivers:** `less_admin`

**Inputs:**
- agent configurations
- activity logs
- performance metrics

**Outputs:**
- agent status
- automation levels
- kill switches

**Escalation/Approval:**
> Agents can be disabled instantly via kill switch

---

#### Agent Detail & Configuration

**ID:** `agent_detail`
**Route:** `/agents`
**Persona:** Business Owner/Admin
**Image:** `screenshots/agent_detail.png`

> Deep dive into individual agent performance and settings.

**Description:**

Detailed view of a specific agent showing recent activity, success rate,
common escalation reasons, and configurable parameters. Owners can adjust
confidence thresholds, approval requirements, and message templates
without developer involvement.


**Agents Involved:** ConfiguredAgent

**Value Drivers:** `less_admin`

**Inputs:**
- agent metrics
- decision history
- configuration options

**Outputs:**
- updated thresholds
- template changes
- enable/disable state

**Escalation/Approval:**
> Configuration changes take effect immediately

---

### Settings & Configuration

#### Business Profile

**ID:** `business_profile`
**Route:** `/settings`
**Persona:** Business Owner/Admin
**Image:** `screenshots/business_profile.png`

> Core business information and branding.

**Description:**

Business profile configuration including company name, contact info,
service area, operating hours, and branding. This information flows
through to all customer communications and agent behaviors. Changes
here immediately update how AI represents the business.


**Agents Involved:** ConfigurationAgent

**Value Drivers:** `less_admin`

**Inputs:**
- business details
- contact info
- branding assets

**Outputs:**
- profile updates
- agent context refresh

**Escalation/Approval:**
> N/A - owner-only configuration

---

#### Automation Policies

**ID:** `policy_configuration`
**Route:** `/settings`
**Persona:** Business Owner/Admin
**Image:** `screenshots/policy_configuration.png`

> Configure automation levels and approval thresholds.

**Description:**

The policy system lets owners choose their automation comfort level
across a spectrum from "always ask me" to "fully autonomous." Tiered
presets (Owner Operator, SMB, Commercial) provide sensible defaults
while individual rules can be customized per workflow stage.


**Agents Involved:** PolicyEngine

**Value Drivers:** `less_admin`, `higher_profit`

**Inputs:**
- automation preferences
- approval thresholds
- risk tolerance

**Outputs:**
- policy configuration
- agent behavior changes

**Escalation/Approval:**
> Policy changes are owner-only

---

#### Learning System Dashboard

**ID:** `learning_dashboard`
**Route:** `/learning`
**Persona:** Business Owner/Admin
**Image:** `screenshots/learning_dashboard.png`

> AI learning metrics and policy improvement suggestions.

**Description:**

The learning dashboard shows how AI decisions are performing over time.
When owners consistently override AI recommendations, the system detects
patterns and suggests policy adjustments. Kill switches provide immediate
control while suggestions offer gradual refinement.


**Agents Involved:** LearningAgent, PolicyTuner

**Value Drivers:** `higher_profit`, `less_admin`

**Inputs:**
- decision logs
- human overrides
- outcome tracking

**Outputs:**
- performance metrics
- policy suggestions
- kill switch controls

**Escalation/Approval:**
> Suggestions require explicit owner approval to apply

---
