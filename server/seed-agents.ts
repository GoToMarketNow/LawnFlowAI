import { db } from "./db";
import { agentRegistry } from "@shared/schema";
import type { InsertAgentRegistryEntry } from "@shared/schema";

const agentSeedData: InsertAgentRegistryEntry[] = [
  // Lead Intake Stage
  {
    agentKey: "lead_intake_agent",
    displayName: "Lead Intake Agent",
    purpose: "Capture and qualify incoming leads from all channels",
    description: "Parses inbound messages, missed calls, and web forms to extract customer intent, contact info, and service requests. Routes qualified leads to the quoting stage.",
    category: "ops",
    stage: "lead_intake",
    domains: ["messaging"],
    triggers: ["missed_call", "inbound_sms", "web_lead"],
    status: "active",
    inputSchema: { type: "object", properties: { source: { type: "string" }, phone: { type: "string" }, message: { type: "string" } } },
    outputSchema: { type: "object", properties: { leadId: { type: "number" }, qualified: { type: "boolean" }, intent: { type: "string" } } },
  },
  
  // Quoting Stage
  {
    agentKey: "quote_builder_agent",
    displayName: "Quote Builder Agent",
    purpose: "Calculate and generate accurate service quotes",
    description: "Uses lot size data, service type, and pricing policies to generate price range estimates. Incorporates complexity factors and seasonal adjustments.",
    category: "ops",
    stage: "quoting",
    domains: ["pricing"],
    triggers: ["lead_qualified", "quote_requested"],
    status: "active",
    inputSchema: { type: "object", properties: { lotSqft: { type: "number" }, serviceType: { type: "string" }, frequency: { type: "string" } } },
    outputSchema: { type: "object", properties: { minPrice: { type: "number" }, maxPrice: { type: "number" }, confidence: { type: "string" } } },
  },
  {
    agentKey: "lot_size_resolver",
    displayName: "Lot Size Resolver",
    purpose: "Determine property lot size from address",
    description: "Uses FREE-FIRST resolution strategy with multi-tier caching (geocode, parcel) and ArcGIS integration to provide accurate property data.",
    category: "ops",
    stage: "quoting",
    domains: ["integrations"],
    triggers: ["address_provided"],
    status: "active",
    inputSchema: { type: "object", properties: { address: { type: "string" }, zip: { type: "string" } } },
    outputSchema: { type: "object", properties: { lotSqft: { type: "number" }, source: { type: "string" }, confidence: { type: "string" } } },
  },
  
  // Confirmation Stage
  {
    agentKey: "quote_confirm_agent",
    displayName: "Quote Confirmation Agent",
    purpose: "Parse customer responses to quotes",
    description: "Interprets customer replies to determine acceptance, rejection, modification requests, or questions. Routes to appropriate next stage.",
    category: "ops",
    stage: "confirmation",
    domains: ["messaging"],
    triggers: ["customer_reply"],
    status: "active",
    inputSchema: { type: "object", properties: { quoteId: { type: "number" }, response: { type: "string" } } },
    outputSchema: { type: "object", properties: { action: { type: "string" }, reason: { type: "string" } } },
  },
  
  // Scheduling Stage
  {
    agentKey: "schedule_propose_agent",
    displayName: "Schedule Proposal Agent",
    purpose: "Generate optimal time windows for service",
    description: "Analyzes crew availability, travel distances, and customer preferences to propose available scheduling windows.",
    category: "ops",
    stage: "scheduling",
    domains: ["routing"],
    triggers: ["quote_accepted"],
    status: "active",
    inputSchema: { type: "object", properties: { jobRequestId: { type: "number" }, preferredDays: { type: "array" } } },
    outputSchema: { type: "object", properties: { windows: { type: "array" }, recommended: { type: "object" } } },
  },
  
  // Crew Assignment Stage
  {
    agentKey: "crew_simulation_agent",
    displayName: "Crew Simulation Agent",
    purpose: "Simulate crew assignments for optimal matching",
    description: "Runs simulations to evaluate eligible crews based on skills, equipment, travel time, and margin impact. Produces ranked recommendations.",
    category: "ops",
    stage: "crew_assignment",
    domains: ["routing", "pricing"],
    triggers: ["time_selected"],
    status: "active",
    inputSchema: { type: "object", properties: { jobRequestId: { type: "number" }, targetDate: { type: "string" } } },
    outputSchema: { type: "object", properties: { simulations: { type: "array" }, topPick: { type: "object" } } },
  },
  {
    agentKey: "feasibility_check_agent",
    displayName: "Feasibility Check Agent",
    purpose: "Validate job feasibility before booking",
    description: "Checks crew capacity, equipment availability, travel constraints, and scheduling conflicts to ensure jobs can be completed as planned.",
    category: "ops",
    stage: "crew_assignment",
    domains: ["routing"],
    triggers: ["simulation_complete"],
    status: "active",
    inputSchema: { type: "object", properties: { simulationId: { type: "number" } } },
    outputSchema: { type: "object", properties: { feasible: { type: "boolean" }, issues: { type: "array" } } },
  },
  {
    agentKey: "margin_validate_agent",
    displayName: "Margin Validation Agent",
    purpose: "Ensure jobs meet profitability thresholds",
    description: "Calculates margin score based on travel costs, labor, and revenue. Jobs below 70% threshold require manual approval.",
    category: "finance",
    stage: "crew_assignment",
    domains: ["pricing"],
    triggers: ["feasibility_passed"],
    status: "active",
    inputSchema: { type: "object", properties: { simulationId: { type: "number" }, price: { type: "number" } } },
    outputSchema: { type: "object", properties: { marginScore: { type: "number" }, approved: { type: "boolean" } } },
  },
  
  // Booking Stage
  {
    agentKey: "crew_lock_agent",
    displayName: "Crew Lock Agent",
    purpose: "Finalize crew assignment and create schedule",
    description: "Locks in crew assignment for approved jobs. High confidence assignments (score ≥80, margin ≥70) auto-approve; others queue for ops review.",
    category: "ops",
    stage: "booking",
    domains: ["routing"],
    triggers: ["margin_validated"],
    status: "active",
    inputSchema: { type: "object", properties: { decisionId: { type: "number" } } },
    outputSchema: { type: "object", properties: { scheduleItemId: { type: "number" }, status: { type: "string" } } },
  },
  {
    agentKey: "dispatch_agent",
    displayName: "Dispatch Agent",
    purpose: "Create dispatch tasks and route sequences",
    description: "Generates optimized route sequences for crews. Uses greedy algorithm with Haversine distance for efficient daily routes.",
    category: "ops",
    stage: "booking",
    domains: ["routing", "fsm"],
    triggers: ["crew_locked"],
    status: "active",
    inputSchema: { type: "object", properties: { crewId: { type: "number" }, date: { type: "string" } } },
    outputSchema: { type: "object", properties: { routeSequence: { type: "array" }, totalDistance: { type: "number" } } },
  },
  
  // Retention & Insights Stage
  {
    agentKey: "customer_memory_agent",
    displayName: "Customer Memory Agent",
    purpose: "Build and recall customer context",
    description: "Stores and retrieves customer interactions, preferences, and history using vector embeddings for semantic search. Enriches future interactions.",
    category: "core",
    stage: "retention_insights",
    domains: ["memory"],
    triggers: ["interaction_complete", "context_needed"],
    status: "active",
    inputSchema: { type: "object", properties: { customerId: { type: "number" }, query: { type: "string" } } },
    outputSchema: { type: "object", properties: { memories: { type: "array" }, insights: { type: "object" } } },
  },
  {
    agentKey: "renewal_upsell_agent",
    displayName: "Renewal & Upsell Agent",
    purpose: "Generate renewal offers and upsell opportunities",
    description: "Weekly scan for clients with completed jobs. Computes next-best-offer by service, season, and lot size. Creates draft quotes for qualified leads.",
    category: "finance",
    stage: "retention_insights",
    domains: ["pricing", "messaging"],
    triggers: ["weekly_scan", "job_completed"],
    status: "active",
    inputSchema: { type: "object", properties: { customerId: { type: "number" }, lastService: { type: "string" } } },
    outputSchema: { type: "object", properties: { offers: { type: "array" }, recommended: { type: "object" } } },
  },
  
  // Integrations Stage
  {
    agentKey: "jobber_sync_agent",
    displayName: "Jobber Sync Agent",
    purpose: "Sync data with Jobber FSM",
    description: "Handles bidirectional sync with Jobber. Processes webhooks, enriches data via GraphQL, manages OAuth tokens, and writes job/client updates.",
    category: "integrations",
    stage: "integrations",
    domains: ["integrations", "fsm"],
    triggers: ["jobber_webhook", "sync_requested"],
    status: "needs_config",
    inputSchema: { type: "object", properties: { eventType: { type: "string" }, payload: { type: "object" } } },
    outputSchema: { type: "object", properties: { synced: { type: "boolean" }, jobberIds: { type: "object" } } },
  },
  {
    agentKey: "customer_comms_agent",
    displayName: "Customer Comms Agent",
    purpose: "Send customer-facing messages",
    description: "Produces compliant customer messages with strict tone rules. Uses templates by service category. Writes Jobber comm log pointers.",
    category: "comms",
    stage: "integrations",
    domains: ["messaging", "fsm"],
    triggers: ["schedule_update", "job_completed", "send_notification"],
    status: "active",
    inputSchema: { type: "object", properties: { templateKey: { type: "string" }, customerId: { type: "number" }, data: { type: "object" } } },
    outputSchema: { type: "object", properties: { messageSent: { type: "boolean" }, twilioSid: { type: "string" } } },
  },
  {
    agentKey: "reconciliation_agent",
    displayName: "Reconciliation Agent",
    purpose: "Validate invoice/payment integrity",
    description: "Compares paid_total against sum of payments. Creates alerts for mismatches >$0.01. Updates Jobber RECON_STATUS custom field.",
    category: "finance",
    stage: "integrations",
    domains: ["integrations", "fsm"],
    triggers: ["payment_received", "daily_scan"],
    status: "active",
    inputSchema: { type: "object", properties: { invoiceId: { type: "string" } } },
    outputSchema: { type: "object", properties: { status: { type: "string" }, variance: { type: "number" } } },
  },
  
  // Core (Hidden) - Orchestrators
  {
    agentKey: "lead_to_cash_orchestrator",
    displayName: "Lead-to-Cash Orchestrator",
    purpose: "Manage the full 10-stage lead lifecycle",
    description: "Central orchestrator that coordinates all agents through the deterministic workflow. Handles stage transitions, human-in-loop approvals, and seamless resumption.",
    category: "core",
    stage: "core",
    domains: ["orchestration"],
    triggers: ["new_lead", "stage_complete", "approval_received"],
    status: "active",
    inputSchema: { type: "object", properties: { leadId: { type: "number" }, currentStage: { type: "string" } } },
    outputSchema: { type: "object", properties: { nextStage: { type: "string" }, actionsTriggered: { type: "array" } } },
  },
  {
    agentKey: "optimizer_orchestrator",
    displayName: "Optimizer Orchestrator",
    purpose: "Manage crew assignment decision workflow",
    description: "Coordinates simulation, feasibility, margin validation, and crew lock stages. Enforces RBAC for approvals. Tracks decision lifecycle from draft to written_back.",
    category: "core",
    stage: "core",
    domains: ["orchestration", "routing"],
    triggers: ["job_request_created", "decision_needed"],
    status: "active",
    inputSchema: { type: "object", properties: { jobRequestId: { type: "number" } } },
    outputSchema: { type: "object", properties: { decisionId: { type: "number" }, status: { type: "string" } } },
  },
  {
    agentKey: "supervisor_agent",
    displayName: "Supervisor Agent",
    purpose: "Oversee all agent activities and handle exceptions",
    description: "Monitors agent health, handles failures, manages retries via DLQ, and escalates unresolvable issues to human operators.",
    category: "core",
    stage: "core",
    domains: ["orchestration"],
    triggers: ["agent_error", "health_check"],
    status: "active",
    inputSchema: { type: "object", properties: { agentId: { type: "number" }, eventType: { type: "string" } } },
    outputSchema: { type: "object", properties: { action: { type: "string" }, escalated: { type: "boolean" } } },
  },
  {
    agentKey: "dlq_processor",
    displayName: "Dead Letter Queue Processor",
    purpose: "Retry failed webhook processing",
    description: "Manages failed webhooks with exponential backoff retry strategy. Tracks attempts and escalates persistent failures.",
    category: "core",
    stage: "core",
    domains: ["orchestration", "integrations"],
    triggers: ["dlq_item_added", "retry_scheduled"],
    status: "active",
    inputSchema: { type: "object", properties: { itemId: { type: "number" } } },
    outputSchema: { type: "object", properties: { retried: { type: "boolean" }, nextRetryAt: { type: "string" } } },
  },
];

export async function seedAgents() {
  console.log("Seeding agents...");
  
  const { eq } = await import("drizzle-orm");
  
  for (const agent of agentSeedData) {
    const [existingAgent] = await db
      .select()
      .from(agentRegistry)
      .where(eq(agentRegistry.agentKey, agent.agentKey))
      .limit(1);
    
    if (!existingAgent) {
      await db.insert(agentRegistry).values(agent);
      console.log(`  Created agent: ${agent.displayName}`);
    } else {
      console.log(`  Agent exists: ${agent.displayName}`);
    }
  }
  
  console.log("Agent seeding complete!");
}
