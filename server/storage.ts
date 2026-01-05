import {
  businessProfiles,
  conversations,
  messages,
  events,
  pendingActions,
  jobs,
  auditLogs,
  eventReceipts,
  leads,
  policyProfiles,
  zipGeoCache,
  accountPackages,
  aiActionUsage,
  growthRecommendations,
  users,
  phoneVerifications,
  parcelCoverageRegistry,
  propertyQuoteContext,
  countySources,
  smsSessions,
  smsEvents,
  handoffTickets,
  clickToCallTokens,
  callEvents,
  pricingPolicies,
  quoteProposals,
  quoteAdjustmentLogs,
  type BusinessProfile,
  type InsertBusinessProfile,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Event,
  type InsertEvent,
  type PendingAction,
  type InsertPendingAction,
  type Job,
  type InsertJob,
  type AuditLog,
  type InsertAuditLog,
  type EventReceipt,
  type InsertEventReceipt,
  type Lead,
  type InsertLead,
  type PolicyProfile,
  type InsertPolicyProfile,
  type ZipGeoCache,
  type InsertZipGeoCache,
  type AccountPackage,
  type InsertAccountPackage,
  type AiActionUsage,
  type InsertAiActionUsage,
  type GrowthRecommendation,
  type InsertGrowthRecommendation,
  type User,
  type InsertUser,
  type PhoneVerification,
  type InsertPhoneVerification,
  type ParcelCoverageRegistry,
  type InsertParcelCoverageRegistry,
  type PropertyQuoteContext,
  type InsertPropertyQuoteContext,
  type CountySource,
  type InsertCountySource,
  type SmsSession,
  type InsertSmsSession,
  type SmsEvent,
  type InsertSmsEvent,
  type HandoffTicket,
  type InsertHandoffTicket,
  type ClickToCallToken,
  type InsertClickToCallToken,
  type CallEvent,
  type InsertCallEvent,
  type PricingPolicy,
  type InsertPricingPolicy,
  type QuoteProposal,
  type InsertQuoteProposal,
  type QuoteAdjustmentLog,
  type InsertQuoteAdjustmentLog,
  businessRbacPolicies,
  quoteDrafts,
  type BusinessRbacPolicy,
  type InsertBusinessRbacPolicy,
  type QuoteDraft,
  type InsertQuoteDraft,
  crews,
  crewMembers,
  skills,
  equipment,
  crewSkills,
  crewEquipment,
  crewAvailability,
  timeOffRequests,
  serviceZones,
  crewZoneAssignments,
  jobRequests,
  scheduleItems,
  assignmentSimulations,
  assignmentDecisions,
  distanceCache,
  type Crew,
  type InsertCrew,
  type CrewMember,
  type InsertCrewMember,
  type Skill,
  type InsertSkill,
  type Equipment,
  type InsertEquipment,
  type CrewSkill,
  type InsertCrewSkill,
  type CrewEquipment,
  type InsertCrewEquipment,
  type CrewAvailability,
  type InsertCrewAvailability,
  type TimeOffRequest,
  type InsertTimeOffRequest,
  type ServiceZone,
  type InsertServiceZone,
  type CrewZoneAssignment,
  type InsertCrewZoneAssignment,
  type CrewAnalyticsSnapshot,
  type InsertCrewAnalyticsSnapshot,
  crewAnalyticsSnapshots,
  type JobRequest,
  type InsertJobRequest,
  type ScheduleItem,
  type InsertScheduleItem,
  type AssignmentSimulation,
  type InsertAssignmentSimulation,
  type AssignmentDecision,
  type InsertAssignmentDecision,
  type DistanceCache,
  type InsertDistanceCache,
  agentRegistry,
  agentRuns,
  type AgentRegistryEntry,
  type InsertAgentRegistryEntry,
  type AgentRunEntry,
  type InsertAgentRunEntry,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, inArray, sql, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Business Profile
  getBusinessProfile(id?: number): Promise<BusinessProfile | undefined>;
  createBusinessProfile(profile: InsertBusinessProfile): Promise<BusinessProfile>;
  updateBusinessProfile(id: number, profile: Partial<InsertBusinessProfile>): Promise<BusinessProfile>;

  // Conversations
  getConversations(): Promise<Conversation[]>;
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationByPhone(phone: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: number, updates: Partial<InsertConversation>): Promise<Conversation>;

  // Messages
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Events
  getEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, updates: Partial<Event>): Promise<Event>;

  // Pending Actions
  getPendingActions(): Promise<PendingAction[]>;
  getPendingAction(id: number): Promise<PendingAction | undefined>;
  createPendingAction(action: InsertPendingAction): Promise<PendingAction>;
  updatePendingAction(id: number, updates: Partial<PendingAction>): Promise<PendingAction>;

  // Jobs
  getJobs(): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, updates: Partial<InsertJob>): Promise<Job>;

  // Audit Logs
  getAuditLogs(): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Event Receipts (idempotency)
  getEventReceipt(eventId: string): Promise<EventReceipt | undefined>;
  createEventReceipt(receipt: InsertEventReceipt): Promise<EventReceipt>;
  updateEventReceipt(eventId: string, updates: Partial<EventReceipt>): Promise<EventReceipt>;

  // Leads
  getLeads(): Promise<Lead[]>;
  getLead(id: number): Promise<Lead | undefined>;
  getLeadByExternalId(externalId: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead>;

  // Policy Profiles
  getPolicyProfile(businessId: number): Promise<PolicyProfile | undefined>;
  getPolicyProfileById(id: number): Promise<PolicyProfile | undefined>;
  createPolicyProfile(profile: InsertPolicyProfile): Promise<PolicyProfile>;
  updatePolicyProfile(id: number, updates: Partial<InsertPolicyProfile>): Promise<PolicyProfile>;

  // ZIP Geo Cache
  getZipGeo(zip: string): Promise<ZipGeoCache | undefined>;
  getZipGeos(zips: string[]): Promise<ZipGeoCache[]>;
  upsertZipGeo(geo: InsertZipGeoCache): Promise<ZipGeoCache>;
  
  // Account Packages
  getAccountPackage(businessId: number): Promise<AccountPackage | undefined>;
  createAccountPackage(pkg: InsertAccountPackage): Promise<AccountPackage>;
  updateAccountPackage(id: number, updates: Partial<InsertAccountPackage>): Promise<AccountPackage>;
  
  // AI Action Usage
  getAiActionUsage(businessId: number, startDate: Date, endDate: Date): Promise<AiActionUsage[]>;
  getTodayUsage(businessId: number): Promise<AiActionUsage | undefined>;
  upsertAiActionUsage(usage: InsertAiActionUsage): Promise<AiActionUsage>;
  incrementActionUsage(businessId: number, actionType: string): Promise<void>;
  
  // Growth Recommendations
  getGrowthRecommendations(businessId: number): Promise<GrowthRecommendation[]>;
  getLatestRecommendation(businessId: number): Promise<GrowthRecommendation | undefined>;
  createGrowthRecommendation(rec: InsertGrowthRecommendation): Promise<GrowthRecommendation>;
  updateGrowthRecommendation(id: number, updates: Partial<GrowthRecommendation>): Promise<GrowthRecommendation>;

  // Parcel Coverage Registry
  getParcelCoverage(state: string, countyFips: string): Promise<ParcelCoverageRegistry | undefined>;
  getAllParcelCoverage(): Promise<ParcelCoverageRegistry[]>;
  upsertParcelCoverage(coverage: InsertParcelCoverageRegistry): Promise<ParcelCoverageRegistry>;

  // Property Quote Context
  getPropertyQuoteContext(id: number): Promise<PropertyQuoteContext | undefined>;
  getPropertyQuoteContextByLead(leadId: number): Promise<PropertyQuoteContext | undefined>;
  getPropertyQuoteContextByConversation(conversationId: number): Promise<PropertyQuoteContext | undefined>;
  createPropertyQuoteContext(ctx: InsertPropertyQuoteContext): Promise<PropertyQuoteContext>;
  updatePropertyQuoteContext(id: number, updates: Partial<InsertPropertyQuoteContext>): Promise<PropertyQuoteContext>;

  // County Sources (FREE-FIRST Lot Size Resolver)
  getAllCountySources(): Promise<CountySource[]>;
  getCountySource(countyFips: string): Promise<CountySource | undefined>;
  createCountySource(source: InsertCountySource): Promise<CountySource>;
  updateCountySource(countyFips: string, updates: Partial<InsertCountySource>): Promise<CountySource | undefined>;
  deleteCountySource(countyFips: string): Promise<boolean>;

  // SMS Sessions
  getSmsSessions(): Promise<SmsSession[]>;
  getSmsSessionById(sessionId: string): Promise<SmsSession | undefined>;
  getSmsSessionByPhone(fromPhone: string): Promise<SmsSession | undefined>;
  upsertSmsSession(session: Partial<InsertSmsSession> & { sessionId: string }): Promise<SmsSession>;
  
  // SMS Events
  getSmsEventsBySession(sessionId: string): Promise<SmsEvent[]>;
  createSmsEvent(event: Partial<InsertSmsEvent> & { eventId: string; sessionId: string; direction: string; text: string }): Promise<SmsEvent>;
  
  // Handoff Tickets
  getHandoffTickets(): Promise<HandoffTicket[]>;
  getHandoffTicket(ticketId: string): Promise<HandoffTicket | undefined>;
  createHandoffTicket(ticket: Partial<InsertHandoffTicket> & { ticketId: string; sessionId: string; accountId: string }): Promise<HandoffTicket>;
  updateHandoffTicket(ticketId: string, updates: Partial<HandoffTicket>): Promise<HandoffTicket | undefined>;
  
  // Click-to-Call Tokens
  getClickToCallToken(token: string): Promise<ClickToCallToken | undefined>;
  createClickToCallToken(token: Partial<InsertClickToCallToken> & { tokenId: string; sessionId: string; token: string; expiresAt: Date }): Promise<ClickToCallToken>;
  markClickToCallTokenUsed(token: string): Promise<void>;
  
  // Call Events
  createCallEvent(event: Partial<InsertCallEvent> & { callEventId: string; sessionId: string; type: string }): Promise<CallEvent>;

  // Pricing Policies
  getPricingPolicies(businessId: number): Promise<PricingPolicy[]>;
  getActivePricingPolicy(businessId: number): Promise<PricingPolicy | undefined>;
  getPricingPolicy(id: number): Promise<PricingPolicy | undefined>;
  createPricingPolicy(policy: InsertPricingPolicy): Promise<PricingPolicy>;
  updatePricingPolicy(id: number, updates: Partial<InsertPricingPolicy>): Promise<PricingPolicy>;
  
  // Quote Proposals
  getQuoteProposals(businessId: number): Promise<QuoteProposal[]>;
  getPendingQuoteProposals(businessId: number): Promise<QuoteProposal[]>;
  getQuoteProposal(id: number): Promise<QuoteProposal | undefined>;
  createQuoteProposal(proposal: InsertQuoteProposal): Promise<QuoteProposal>;
  updateQuoteProposal(id: number, updates: Partial<QuoteProposal>): Promise<QuoteProposal>;
  
  // Quote Adjustment Logs
  getQuoteAdjustmentLogs(quoteProposalId: number): Promise<QuoteAdjustmentLog[]>;
  createQuoteAdjustmentLog(log: InsertQuoteAdjustmentLog): Promise<QuoteAdjustmentLog>;
  
  // RBAC Policies
  getBusinessRbacPolicy(businessId: number): Promise<BusinessRbacPolicy | undefined>;
  upsertBusinessRbacPolicy(businessId: number, updates: Partial<InsertBusinessRbacPolicy>): Promise<BusinessRbacPolicy>;
  
  // Quote Drafts (UQB)
  getQuoteDrafts(businessId: number): Promise<QuoteDraft[]>;
  getQuoteDraft(id: number): Promise<QuoteDraft | undefined>;
  createQuoteDraft(draft: InsertQuoteDraft): Promise<QuoteDraft>;
  updateQuoteDraft(id: number, updates: Partial<QuoteDraft>): Promise<QuoteDraft>;

  // Route Optimizer - Crews
  getCrews(businessId: number): Promise<Crew[]>;
  getCrew(id: number): Promise<Crew | undefined>;
  createCrew(crew: InsertCrew): Promise<Crew>;
  updateCrew(id: number, updates: Partial<InsertCrew>): Promise<Crew>;
  deleteCrew(id: number): Promise<boolean>;
  
  // Route Optimizer - Crew Members
  getCrewMembers(crewId: number): Promise<CrewMember[]>;
  addCrewMember(member: InsertCrewMember): Promise<CrewMember>;
  updateCrewMember(id: number, updates: Partial<InsertCrewMember>): Promise<CrewMember | null>;
  removeCrewMember(id: number): Promise<CrewMember | null>;
  setCrewLeader(crewId: number, memberId: number): Promise<void>;
  
  // Skills Management
  getSkills(businessId: number): Promise<Skill[]>;
  getSkill(id: number): Promise<Skill | undefined>;
  createSkill(skill: InsertSkill): Promise<Skill>;
  updateSkill(id: number, updates: Partial<InsertSkill>): Promise<Skill>;
  deleteSkill(id: number): Promise<boolean>;
  
  // Equipment Management
  getEquipment(businessId: number): Promise<Equipment[]>;
  getEquipmentItem(id: number): Promise<Equipment | undefined>;
  createEquipment(equip: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, updates: Partial<InsertEquipment>): Promise<Equipment>;
  deleteEquipment(id: number): Promise<boolean>;
  
  // Crew Skills Assignment
  getCrewSkills(crewId: number): Promise<(CrewSkill & { skill: Skill })[]>;
  addCrewSkill(crewId: number, skillId: number, proficiencyLevel?: number): Promise<CrewSkill>;
  removeCrewSkill(crewId: number, skillId: number): Promise<boolean>;
  
  // Crew Equipment Assignment
  getCrewEquipment(crewId: number): Promise<(CrewEquipment & { equipment: Equipment })[]>;
  addCrewEquipment(crewId: number, equipmentId: number): Promise<CrewEquipment>;
  removeCrewEquipment(crewId: number, equipmentId: number): Promise<boolean>;
  
  // Crew Availability
  getCrewAvailability(crewId: number): Promise<CrewAvailability[]>;
  setCrewAvailability(crewId: number, availability: InsertCrewAvailability[]): Promise<CrewAvailability[]>;
  updateCrewAvailabilitySlot(id: number, updates: Partial<InsertCrewAvailability>): Promise<CrewAvailability>;
  
  // Time-Off Requests
  getTimeOffRequests(crewId?: number, status?: string): Promise<TimeOffRequest[]>;
  getTimeOffRequest(id: number): Promise<TimeOffRequest | undefined>;
  createTimeOffRequest(request: InsertTimeOffRequest): Promise<TimeOffRequest>;
  updateTimeOffRequest(id: number, updates: Partial<TimeOffRequest>): Promise<TimeOffRequest>;
  approveTimeOffRequest(id: number, approvedBy: number, notes?: string): Promise<TimeOffRequest>;
  denyTimeOffRequest(id: number, approvedBy: number, notes?: string): Promise<TimeOffRequest>;
  deleteTimeOffRequest(id: number): Promise<boolean>;
  
  // Service Zones
  getServiceZones(businessId: number): Promise<ServiceZone[]>;
  getServiceZone(id: number): Promise<ServiceZone | undefined>;
  createServiceZone(zone: InsertServiceZone): Promise<ServiceZone>;
  updateServiceZone(id: number, updates: Partial<InsertServiceZone>): Promise<ServiceZone>;
  deleteServiceZone(id: number): Promise<boolean>;
  
  // Crew Zone Assignments
  getCrewZoneAssignments(crewId: number): Promise<(CrewZoneAssignment & { zone: ServiceZone })[]>;
  getZoneCrewAssignments(zoneId: number): Promise<(CrewZoneAssignment & { crew: Crew })[]>;
  assignCrewToZone(crewId: number, zoneId: number, isPrimary?: boolean, priority?: number, assignedBy?: number): Promise<CrewZoneAssignment>;
  updateCrewZoneAssignment(id: number, updates: Partial<InsertCrewZoneAssignment>): Promise<CrewZoneAssignment>;
  removeCrewFromZone(crewId: number, zoneId: number): Promise<boolean>;
  
  // Crew Analytics
  getCrewAnalytics(crewId: number, startDate: Date, endDate: Date): Promise<CrewAnalyticsSnapshot[]>;
  getCrewAnalyticsSummary(crewId: number, days: number): Promise<{
    totalJobsCompleted: number;
    totalRevenue: number;
    averageUtilization: number;
    averageZoneCompliance: number;
    totalDriveMinutes: number;
  }>;
  getAllCrewsAnalytics(businessId: number, startDate: Date, endDate: Date): Promise<CrewAnalyticsSnapshot[]>;
  upsertCrewAnalyticsSnapshot(snapshot: InsertCrewAnalyticsSnapshot): Promise<CrewAnalyticsSnapshot>;
  
  // Route Optimizer - Job Requests
  getJobRequests(businessId: number): Promise<JobRequest[]>;
  getJobRequest(id: number): Promise<JobRequest | undefined>;
  getJobRequestsByStatus(businessId: number, status: string): Promise<JobRequest[]>;
  createJobRequest(request: InsertJobRequest): Promise<JobRequest>;
  updateJobRequest(id: number, updates: Partial<JobRequest>): Promise<JobRequest>;
  
  // Route Optimizer - Schedule Items
  getScheduleItems(businessId: number, crewId?: number): Promise<ScheduleItem[]>;
  getScheduleItemsByDate(businessId: number, date: Date): Promise<ScheduleItem[]>;
  createScheduleItem(item: InsertScheduleItem): Promise<ScheduleItem>;
  updateScheduleItem(id: number, updates: Partial<ScheduleItem>): Promise<ScheduleItem>;
  
  // Route Optimizer - Assignment Simulations
  getSimulationsForJobRequest(jobRequestId: number): Promise<AssignmentSimulation[]>;
  getSimulation(id: number): Promise<AssignmentSimulation | undefined>;
  createSimulation(sim: InsertAssignmentSimulation): Promise<AssignmentSimulation>;
  deleteSimulationsForJobRequest(jobRequestId: number): Promise<void>;
  
  // Route Optimizer - Assignment Decisions
  getDecision(id: number): Promise<AssignmentDecision | undefined>;
  getDecisionForJobRequest(jobRequestId: number): Promise<AssignmentDecision | undefined>;
  createDecision(decision: InsertAssignmentDecision): Promise<AssignmentDecision>;
  updateDecision(id: number, updates: Partial<AssignmentDecision>): Promise<AssignmentDecision>;
  deleteDecisionsForJobRequest(jobRequestId: number): Promise<void>;
  
  // Route Optimizer - Distance Cache
  getDistanceCache(originKey: string, destKey: string): Promise<DistanceCache | undefined>;
  upsertDistanceCache(entry: InsertDistanceCache): Promise<DistanceCache>;
  
  // Agent Registry
  getAgents(): Promise<AgentRegistryEntry[]>;
  getAgent(id: number): Promise<AgentRegistryEntry | undefined>;
  getAgentByKey(agentKey: string): Promise<AgentRegistryEntry | undefined>;
  createAgent(agent: InsertAgentRegistryEntry): Promise<AgentRegistryEntry>;
  updateAgent(id: number, updates: Partial<InsertAgentRegistryEntry>): Promise<AgentRegistryEntry>;
  
  // Agent Runs
  getAgentRuns(agentId: number, limit?: number): Promise<AgentRunEntry[]>;
  getAgentRun(id: number): Promise<AgentRunEntry | undefined>;
  createAgentRun(run: InsertAgentRunEntry): Promise<AgentRunEntry>;
  updateAgentRun(id: number, updates: Partial<AgentRunEntry>): Promise<AgentRunEntry>;
}

export class DatabaseStorage implements IStorage {
  // Business Profile
  async getBusinessProfile(id?: number): Promise<BusinessProfile | undefined> {
    if (id !== undefined) {
      const [profile] = await db.select().from(businessProfiles).where(eq(businessProfiles.id, id));
      return profile;
    }
    const [profile] = await db.select().from(businessProfiles).limit(1);
    return profile;
  }

  async createBusinessProfile(profile: InsertBusinessProfile): Promise<BusinessProfile> {
    const [created] = await db.insert(businessProfiles).values(profile).returning();
    return created;
  }

  async updateBusinessProfile(id: number, profile: Partial<InsertBusinessProfile>): Promise<BusinessProfile> {
    const [updated] = await db
      .update(businessProfiles)
      .set(profile)
      .where(eq(businessProfiles.id, id))
      .returning();
    return updated;
  }

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async getConversationByPhone(phone: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.customerPhone, phone))
      .orderBy(desc(conversations.createdAt))
      .limit(1);
    return conversation;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [created] = await db.insert(conversations).values(conversation).returning();
    return created;
  }

  async updateConversation(id: number, updates: Partial<InsertConversation>): Promise<Conversation> {
    const [updated] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  // Messages
  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return db.select().from(events).orderBy(desc(events.createdAt));
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [created] = await db.insert(events).values(event).returning();
    return created;
  }

  async updateEvent(id: number, updates: Partial<Event>): Promise<Event> {
    const [updated] = await db
      .update(events)
      .set(updates)
      .where(eq(events.id, id))
      .returning();
    return updated;
  }

  // Pending Actions
  async getPendingActions(): Promise<PendingAction[]> {
    return db.select().from(pendingActions).orderBy(desc(pendingActions.createdAt));
  }

  async getPendingAction(id: number): Promise<PendingAction | undefined> {
    const [action] = await db.select().from(pendingActions).where(eq(pendingActions.id, id));
    return action;
  }

  async createPendingAction(action: InsertPendingAction): Promise<PendingAction> {
    const [created] = await db.insert(pendingActions).values(action).returning();
    return created;
  }

  async updatePendingAction(id: number, updates: Partial<PendingAction>): Promise<PendingAction> {
    const [updated] = await db
      .update(pendingActions)
      .set(updates)
      .where(eq(pendingActions.id, id))
      .returning();
    return updated;
  }

  // Jobs
  async getJobs(): Promise<Job[]> {
    return db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }

  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [created] = await db.insert(jobs).values(job).returning();
    return created;
  }

  async updateJob(id: number, updates: Partial<InsertJob>): Promise<Job> {
    const [updated] = await db
      .update(jobs)
      .set(updates)
      .where(eq(jobs.id, id))
      .returning();
    return updated;
  }

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  // Event Receipts (idempotency)
  async getEventReceipt(eventId: string): Promise<EventReceipt | undefined> {
    const [receipt] = await db.select().from(eventReceipts).where(eq(eventReceipts.eventId, eventId));
    return receipt;
  }

  async createEventReceipt(receipt: InsertEventReceipt): Promise<EventReceipt> {
    const [created] = await db.insert(eventReceipts).values(receipt).returning();
    return created;
  }

  async updateEventReceipt(eventId: string, updates: Partial<EventReceipt>): Promise<EventReceipt> {
    const [updated] = await db
      .update(eventReceipts)
      .set(updates)
      .where(eq(eventReceipts.eventId, eventId))
      .returning();
    return updated;
  }

  // Leads
  async getLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async getLeadByExternalId(externalId: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.externalId, externalId));
    return lead;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [created] = await db.insert(leads).values(lead).returning();
    return created;
  }

  async updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead> {
    const [updated] = await db
      .update(leads)
      .set(updates)
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  // Policy Profiles
  async getPolicyProfile(businessId: number): Promise<PolicyProfile | undefined> {
    const [profile] = await db
      .select()
      .from(policyProfiles)
      .where(eq(policyProfiles.businessId, businessId))
      .limit(1);
    return profile;
  }

  async getPolicyProfileById(id: number): Promise<PolicyProfile | undefined> {
    const [profile] = await db.select().from(policyProfiles).where(eq(policyProfiles.id, id));
    return profile;
  }

  async createPolicyProfile(profile: InsertPolicyProfile): Promise<PolicyProfile> {
    const [created] = await db.insert(policyProfiles).values(profile).returning();
    return created;
  }

  async updatePolicyProfile(id: number, updates: Partial<InsertPolicyProfile>): Promise<PolicyProfile> {
    const [updated] = await db
      .update(policyProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(policyProfiles.id, id))
      .returning();
    return updated;
  }

  // ZIP Geo Cache
  async getZipGeo(zip: string): Promise<ZipGeoCache | undefined> {
    const [geo] = await db.select().from(zipGeoCache).where(eq(zipGeoCache.zip, zip));
    return geo;
  }

  async getZipGeos(zips: string[]): Promise<ZipGeoCache[]> {
    if (zips.length === 0) return [];
    return db.select().from(zipGeoCache).where(inArray(zipGeoCache.zip, zips));
  }

  async upsertZipGeo(geo: InsertZipGeoCache): Promise<ZipGeoCache> {
    const [result] = await db
      .insert(zipGeoCache)
      .values(geo)
      .onConflictDoUpdate({
        target: zipGeoCache.zip,
        set: {
          centerLat: geo.centerLat,
          centerLng: geo.centerLng,
          viewportNorth: geo.viewportNorth,
          viewportSouth: geo.viewportSouth,
          viewportEast: geo.viewportEast,
          viewportWest: geo.viewportWest,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      })
      .returning();
    return result;
  }

  // Account Packages
  async getAccountPackage(businessId: number): Promise<AccountPackage | undefined> {
    const [pkg] = await db
      .select()
      .from(accountPackages)
      .where(eq(accountPackages.businessId, businessId))
      .limit(1);
    return pkg;
  }

  async createAccountPackage(pkg: InsertAccountPackage): Promise<AccountPackage> {
    const [created] = await db.insert(accountPackages).values(pkg).returning();
    return created;
  }

  async updateAccountPackage(id: number, updates: Partial<InsertAccountPackage>): Promise<AccountPackage> {
    const [updated] = await db
      .update(accountPackages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(accountPackages.id, id))
      .returning();
    return updated;
  }

  // AI Action Usage
  async getAiActionUsage(businessId: number, startDate: Date, endDate: Date): Promise<AiActionUsage[]> {
    return db
      .select()
      .from(aiActionUsage)
      .where(
        and(
          eq(aiActionUsage.businessId, businessId),
          gte(aiActionUsage.date, startDate),
          lte(aiActionUsage.date, endDate)
        )
      )
      .orderBy(desc(aiActionUsage.date));
  }

  async getTodayUsage(businessId: number): Promise<AiActionUsage | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [usage] = await db
      .select()
      .from(aiActionUsage)
      .where(
        and(
          eq(aiActionUsage.businessId, businessId),
          eq(aiActionUsage.date, today)
        )
      )
      .limit(1);
    return usage;
  }

  async upsertAiActionUsage(usage: InsertAiActionUsage): Promise<AiActionUsage> {
    const [result] = await db.insert(aiActionUsage).values(usage).returning();
    return result;
  }

  async incrementActionUsage(businessId: number, actionType: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const validActions = [
      "InboundQualification",
      "SupervisorOrchestration", 
      "QuoteGeneration",
      "SchedulingProposal",
      "BillingFollowup",
      "ReviewRequest",
    ] as const;
    
    if (!validActions.includes(actionType as typeof validActions[number])) {
      console.warn(`Unknown action type: ${actionType}`);
      return;
    }
    
    const baseValues = {
      businessId,
      date: today,
      inboundQualification: 0,
      supervisorOrchestration: 0,
      quoteGeneration: 0,
      schedulingProposal: 0,
      billingFollowup: 0,
      reviewRequest: 0,
      totalActions: 1,
    };
    
    if (actionType === "InboundQualification") {
      baseValues.inboundQualification = 1;
      await db.insert(aiActionUsage).values(baseValues)
        .onConflictDoUpdate({
          target: [aiActionUsage.businessId, aiActionUsage.date],
          set: {
            inboundQualification: sql`${aiActionUsage.inboundQualification} + 1`,
            totalActions: sql`${aiActionUsage.totalActions} + 1`,
          },
        });
    } else if (actionType === "SupervisorOrchestration") {
      baseValues.supervisorOrchestration = 1;
      await db.insert(aiActionUsage).values(baseValues)
        .onConflictDoUpdate({
          target: [aiActionUsage.businessId, aiActionUsage.date],
          set: {
            supervisorOrchestration: sql`${aiActionUsage.supervisorOrchestration} + 1`,
            totalActions: sql`${aiActionUsage.totalActions} + 1`,
          },
        });
    } else if (actionType === "QuoteGeneration") {
      baseValues.quoteGeneration = 1;
      await db.insert(aiActionUsage).values(baseValues)
        .onConflictDoUpdate({
          target: [aiActionUsage.businessId, aiActionUsage.date],
          set: {
            quoteGeneration: sql`${aiActionUsage.quoteGeneration} + 1`,
            totalActions: sql`${aiActionUsage.totalActions} + 1`,
          },
        });
    } else if (actionType === "SchedulingProposal") {
      baseValues.schedulingProposal = 1;
      await db.insert(aiActionUsage).values(baseValues)
        .onConflictDoUpdate({
          target: [aiActionUsage.businessId, aiActionUsage.date],
          set: {
            schedulingProposal: sql`${aiActionUsage.schedulingProposal} + 1`,
            totalActions: sql`${aiActionUsage.totalActions} + 1`,
          },
        });
    } else if (actionType === "BillingFollowup") {
      baseValues.billingFollowup = 1;
      await db.insert(aiActionUsage).values(baseValues)
        .onConflictDoUpdate({
          target: [aiActionUsage.businessId, aiActionUsage.date],
          set: {
            billingFollowup: sql`${aiActionUsage.billingFollowup} + 1`,
            totalActions: sql`${aiActionUsage.totalActions} + 1`,
          },
        });
    } else if (actionType === "ReviewRequest") {
      baseValues.reviewRequest = 1;
      await db.insert(aiActionUsage).values(baseValues)
        .onConflictDoUpdate({
          target: [aiActionUsage.businessId, aiActionUsage.date],
          set: {
            reviewRequest: sql`${aiActionUsage.reviewRequest} + 1`,
            totalActions: sql`${aiActionUsage.totalActions} + 1`,
          },
        });
    }
  }

  // Growth Recommendations
  async getGrowthRecommendations(businessId: number): Promise<GrowthRecommendation[]> {
    return db
      .select()
      .from(growthRecommendations)
      .where(eq(growthRecommendations.businessId, businessId))
      .orderBy(desc(growthRecommendations.createdAt));
  }

  async getLatestRecommendation(businessId: number): Promise<GrowthRecommendation | undefined> {
    const [rec] = await db
      .select()
      .from(growthRecommendations)
      .where(eq(growthRecommendations.businessId, businessId))
      .orderBy(desc(growthRecommendations.createdAt))
      .limit(1);
    return rec;
  }

  async createGrowthRecommendation(rec: InsertGrowthRecommendation): Promise<GrowthRecommendation> {
    const [created] = await db.insert(growthRecommendations).values(rec).returning();
    return created;
  }

  async updateGrowthRecommendation(id: number, updates: Partial<GrowthRecommendation>): Promise<GrowthRecommendation> {
    const [updated] = await db
      .update(growthRecommendations)
      .set(updates)
      .where(eq(growthRecommendations.id, id))
      .returning();
    return updated;
  }

  // User Authentication
  async getUsers(businessId?: number): Promise<User[]> {
    if (businessId) {
      return db.select().from(users).where(eq(users.businessId, businessId));
    }
    return db.select().from(users);
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return user;
  }

  async getUserByPhone(phoneE164: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phoneE164, phoneE164)).limit(1);
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...userData,
      email: userData.email.toLowerCase(),
    }).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  // Phone Verifications
  async getActivePhoneVerification(userId: number): Promise<PhoneVerification | undefined> {
    const now = new Date();
    const [verification] = await db
      .select()
      .from(phoneVerifications)
      .where(
        and(
          eq(phoneVerifications.userId, userId),
          gte(phoneVerifications.expiresAt, now)
        )
      )
      .orderBy(desc(phoneVerifications.createdAt))
      .limit(1);
    return verification;
  }

  async createPhoneVerification(data: InsertPhoneVerification): Promise<PhoneVerification> {
    const [verification] = await db.insert(phoneVerifications).values(data).returning();
    return verification;
  }

  async updatePhoneVerification(id: number, updates: Partial<PhoneVerification>): Promise<PhoneVerification> {
    const [updated] = await db
      .update(phoneVerifications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(phoneVerifications.id, id))
      .returning();
    return updated;
  }

  async getPhoneVerificationSendCount(phoneE164: string): Promise<{ count: number; windowStart: Date | null }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [result] = await db
      .select()
      .from(phoneVerifications)
      .where(
        and(
          eq(phoneVerifications.phoneE164, phoneE164),
          gte(phoneVerifications.sendWindowStart, oneHourAgo)
        )
      )
      .orderBy(desc(phoneVerifications.createdAt))
      .limit(1);
    
    if (result) {
      return { count: result.sendsUsedHour, windowStart: result.sendWindowStart };
    }
    return { count: 0, windowStart: null };
  }

  async expirePhoneVerifications(userId: number): Promise<void> {
    const past = new Date(Date.now() - 1000);
    await db
      .update(phoneVerifications)
      .set({ expiresAt: past, updatedAt: new Date() })
      .where(eq(phoneVerifications.userId, userId));
  }

  // Parcel Coverage Registry
  async getParcelCoverage(state: string, countyFips: string): Promise<ParcelCoverageRegistry | undefined> {
    const [coverage] = await db
      .select()
      .from(parcelCoverageRegistry)
      .where(and(
        eq(parcelCoverageRegistry.state, state),
        eq(parcelCoverageRegistry.countyFips, countyFips)
      ))
      .limit(1);
    return coverage;
  }

  async getAllParcelCoverage(): Promise<ParcelCoverageRegistry[]> {
    return db.select().from(parcelCoverageRegistry).orderBy(parcelCoverageRegistry.state, parcelCoverageRegistry.countyName);
  }

  async upsertParcelCoverage(coverage: InsertParcelCoverageRegistry): Promise<ParcelCoverageRegistry> {
    const existing = await this.getParcelCoverage(coverage.state, coverage.countyFips);
    if (existing) {
      const [updated] = await db
        .update(parcelCoverageRegistry)
        .set({ ...coverage, updatedAt: new Date() })
        .where(eq(parcelCoverageRegistry.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(parcelCoverageRegistry).values(coverage).returning();
    return created;
  }

  // Property Quote Context
  async getPropertyQuoteContext(id: number): Promise<PropertyQuoteContext | undefined> {
    const [ctx] = await db.select().from(propertyQuoteContext).where(eq(propertyQuoteContext.id, id)).limit(1);
    return ctx;
  }

  async getPropertyQuoteContextByLead(leadId: number): Promise<PropertyQuoteContext | undefined> {
    const [ctx] = await db
      .select()
      .from(propertyQuoteContext)
      .where(eq(propertyQuoteContext.leadId, leadId))
      .orderBy(desc(propertyQuoteContext.createdAt))
      .limit(1);
    return ctx;
  }

  async getPropertyQuoteContextByConversation(conversationId: number): Promise<PropertyQuoteContext | undefined> {
    const [ctx] = await db
      .select()
      .from(propertyQuoteContext)
      .where(eq(propertyQuoteContext.conversationId, conversationId))
      .orderBy(desc(propertyQuoteContext.createdAt))
      .limit(1);
    return ctx;
  }

  async createPropertyQuoteContext(ctx: InsertPropertyQuoteContext): Promise<PropertyQuoteContext> {
    const [created] = await db.insert(propertyQuoteContext).values(ctx).returning();
    return created;
  }

  async updatePropertyQuoteContext(id: number, updates: Partial<InsertPropertyQuoteContext>): Promise<PropertyQuoteContext> {
    const [updated] = await db
      .update(propertyQuoteContext)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(propertyQuoteContext.id, id))
      .returning();
    return updated;
  }

  // County Sources (FREE-FIRST Lot Size Resolver)
  async getAllCountySources(): Promise<CountySource[]> {
    return db.select().from(countySources).orderBy(countySources.countyName);
  }

  async getCountySource(countyFips: string): Promise<CountySource | undefined> {
    const [source] = await db
      .select()
      .from(countySources)
      .where(eq(countySources.countyFips, countyFips))
      .limit(1);
    return source;
  }

  async createCountySource(source: InsertCountySource): Promise<CountySource> {
    const [created] = await db.insert(countySources).values(source).returning();
    return created;
  }

  async updateCountySource(countyFips: string, updates: Partial<InsertCountySource>): Promise<CountySource | undefined> {
    const [updated] = await db
      .update(countySources)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(countySources.countyFips, countyFips))
      .returning();
    return updated;
  }

  async deleteCountySource(countyFips: string): Promise<boolean> {
    const result = await db
      .delete(countySources)
      .where(eq(countySources.countyFips, countyFips))
      .returning();
    return result.length > 0;
  }

  // SMS Sessions
  async getSmsSessions(): Promise<SmsSession[]> {
    return db.select().from(smsSessions).orderBy(desc(smsSessions.updatedAt));
  }

  async getSmsSessionById(sessionId: string): Promise<SmsSession | undefined> {
    const [session] = await db
      .select()
      .from(smsSessions)
      .where(eq(smsSessions.sessionId, sessionId))
      .limit(1);
    return session;
  }

  async getSmsSessionByPhone(fromPhone: string): Promise<SmsSession | undefined> {
    const [session] = await db
      .select()
      .from(smsSessions)
      .where(eq(smsSessions.fromPhone, fromPhone))
      .orderBy(desc(smsSessions.updatedAt))
      .limit(1);
    return session;
  }

  async upsertSmsSession(session: Partial<InsertSmsSession> & { sessionId: string }): Promise<SmsSession> {
    const existing = await this.getSmsSessionById(session.sessionId);
    if (existing) {
      const [updated] = await db
        .update(smsSessions)
        .set({
          ...session,
          updatedAt: new Date(),
          stateEnteredAt: new Date(),
        })
        .where(eq(smsSessions.sessionId, session.sessionId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(smsSessions).values({
      sessionId: session.sessionId,
      accountId: session.accountId || "",
      fromPhone: session.fromPhone || "",
      toPhone: session.toPhone || "",
      status: session.status || "active",
      serviceTemplateId: session.serviceTemplateId || "lawncare_v1",
      state: session.state || "INTENT",
      businessId: session.businessId,
      attemptCounters: session.attemptCounters || {},
      confidence: session.confidence || {},
      collected: session.collected || {},
      derived: session.derived || {},
      quote: session.quote || {},
      scheduling: session.scheduling || {},
      handoff: session.handoff || {},
      audit: session.audit || {},
    }).returning();
    return created;
  }

  // SMS Events
  async getSmsEventsBySession(sessionId: string): Promise<SmsEvent[]> {
    return db
      .select()
      .from(smsEvents)
      .where(eq(smsEvents.sessionId, sessionId))
      .orderBy(smsEvents.ts);
  }

  async createSmsEvent(event: Partial<InsertSmsEvent> & { eventId: string; sessionId: string; direction: string; text: string }): Promise<SmsEvent> {
    const [created] = await db.insert(smsEvents).values({
      eventId: event.eventId,
      sessionId: event.sessionId,
      direction: event.direction,
      text: event.text,
      providerMessageId: event.providerMessageId,
      type: event.type || "sms",
      payloadJson: event.payloadJson,
      nlpJson: event.nlpJson,
      stateBefore: event.stateBefore,
      stateAfter: event.stateAfter,
    }).returning();
    return created;
  }

  // Handoff Tickets
  async getHandoffTickets(): Promise<HandoffTicket[]> {
    return db.select().from(handoffTickets).orderBy(desc(handoffTickets.createdAt));
  }

  async getHandoffTicket(ticketId: string): Promise<HandoffTicket | undefined> {
    const [ticket] = await db
      .select()
      .from(handoffTickets)
      .where(eq(handoffTickets.ticketId, ticketId))
      .limit(1);
    return ticket;
  }

  async createHandoffTicket(ticket: Partial<InsertHandoffTicket> & { ticketId: string; sessionId: string; accountId: string }): Promise<HandoffTicket> {
    const [created] = await db.insert(handoffTickets).values({
      ticketId: ticket.ticketId,
      sessionId: ticket.sessionId,
      accountId: ticket.accountId,
      businessId: ticket.businessId,
      status: ticket.status || "open",
      priority: ticket.priority || "normal",
      reasonCodes: ticket.reasonCodes || [],
      summary: ticket.summary,
      assignedTo: ticket.assignedTo,
    }).returning();
    return created;
  }

  async updateHandoffTicket(ticketId: string, updates: Partial<HandoffTicket>): Promise<HandoffTicket | undefined> {
    const [updated] = await db
      .update(handoffTickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(handoffTickets.ticketId, ticketId))
      .returning();
    return updated;
  }

  // Click-to-Call Tokens
  async getClickToCallToken(token: string): Promise<ClickToCallToken | undefined> {
    const [tokenRecord] = await db
      .select()
      .from(clickToCallTokens)
      .where(eq(clickToCallTokens.token, token))
      .limit(1);
    return tokenRecord;
  }

  async createClickToCallToken(token: Partial<InsertClickToCallToken> & { tokenId: string; sessionId: string; token: string; expiresAt: Date }): Promise<ClickToCallToken> {
    const [created] = await db.insert(clickToCallTokens).values({
      tokenId: token.tokenId,
      sessionId: token.sessionId,
      token: token.token,
      expiresAt: token.expiresAt,
    }).returning();
    return created;
  }

  async markClickToCallTokenUsed(token: string): Promise<void> {
    await db
      .update(clickToCallTokens)
      .set({ usedAt: new Date() })
      .where(eq(clickToCallTokens.token, token));
  }

  // Call Events
  async createCallEvent(event: Partial<InsertCallEvent> & { callEventId: string; sessionId: string; type: string }): Promise<CallEvent> {
    const [created] = await db.insert(callEvents).values({
      callEventId: event.callEventId,
      sessionId: event.sessionId,
      type: event.type,
      metadataJson: event.metadataJson,
    }).returning();
    return created;
  }

  // Pricing Policies
  async getPricingPolicies(businessId: number): Promise<PricingPolicy[]> {
    return db
      .select()
      .from(pricingPolicies)
      .where(eq(pricingPolicies.businessId, businessId))
      .orderBy(desc(pricingPolicies.version));
  }

  async getActivePricingPolicy(businessId: number): Promise<PricingPolicy | undefined> {
    const [policy] = await db
      .select()
      .from(pricingPolicies)
      .where(and(
        eq(pricingPolicies.businessId, businessId),
        eq(pricingPolicies.isActive, true)
      ))
      .orderBy(desc(pricingPolicies.version))
      .limit(1);
    return policy;
  }

  async getPricingPolicy(id: number): Promise<PricingPolicy | undefined> {
    const [policy] = await db
      .select()
      .from(pricingPolicies)
      .where(eq(pricingPolicies.id, id))
      .limit(1);
    return policy;
  }

  async createPricingPolicy(policy: InsertPricingPolicy): Promise<PricingPolicy> {
    const [created] = await db.insert(pricingPolicies).values(policy).returning();
    return created;
  }

  async updatePricingPolicy(id: number, updates: Partial<InsertPricingPolicy>): Promise<PricingPolicy> {
    const [updated] = await db
      .update(pricingPolicies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pricingPolicies.id, id))
      .returning();
    return updated;
  }

  // Quote Proposals
  async getQuoteProposals(businessId: number): Promise<QuoteProposal[]> {
    return db
      .select()
      .from(quoteProposals)
      .where(eq(quoteProposals.businessId, businessId))
      .orderBy(desc(quoteProposals.createdAt));
  }

  async getPendingQuoteProposals(businessId: number): Promise<QuoteProposal[]> {
    return db
      .select()
      .from(quoteProposals)
      .where(and(
        eq(quoteProposals.businessId, businessId),
        eq(quoteProposals.status, "pending")
      ))
      .orderBy(desc(quoteProposals.createdAt));
  }

  async getQuoteProposal(id: number): Promise<QuoteProposal | undefined> {
    const [proposal] = await db
      .select()
      .from(quoteProposals)
      .where(eq(quoteProposals.id, id))
      .limit(1);
    return proposal;
  }

  async createQuoteProposal(proposal: InsertQuoteProposal): Promise<QuoteProposal> {
    const [created] = await db.insert(quoteProposals).values(proposal).returning();
    return created;
  }

  async updateQuoteProposal(id: number, updates: Partial<QuoteProposal>): Promise<QuoteProposal> {
    const [updated] = await db
      .update(quoteProposals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quoteProposals.id, id))
      .returning();
    return updated;
  }

  // Quote Adjustment Logs
  async getQuoteAdjustmentLogs(quoteProposalId: number): Promise<QuoteAdjustmentLog[]> {
    return db
      .select()
      .from(quoteAdjustmentLogs)
      .where(eq(quoteAdjustmentLogs.quoteProposalId, quoteProposalId))
      .orderBy(desc(quoteAdjustmentLogs.createdAt));
  }

  async createQuoteAdjustmentLog(log: InsertQuoteAdjustmentLog): Promise<QuoteAdjustmentLog> {
    const [created] = await db.insert(quoteAdjustmentLogs).values(log).returning();
    return created;
  }

  // RBAC Policies
  async getBusinessRbacPolicy(businessId: number): Promise<BusinessRbacPolicy | undefined> {
    const [policy] = await db
      .select()
      .from(businessRbacPolicies)
      .where(eq(businessRbacPolicies.businessId, businessId))
      .limit(1);
    return policy;
  }

  async upsertBusinessRbacPolicy(businessId: number, updates: Partial<InsertBusinessRbacPolicy>): Promise<BusinessRbacPolicy> {
    const existing = await this.getBusinessRbacPolicy(businessId);
    if (existing) {
      const [updated] = await db
        .update(businessRbacPolicies)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(businessRbacPolicies.businessId, businessId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(businessRbacPolicies)
      .values({ businessId, ...updates })
      .returning();
    return created;
  }

  // Quote Drafts (UQB)
  async getQuoteDrafts(businessId: number): Promise<QuoteDraft[]> {
    return db
      .select()
      .from(quoteDrafts)
      .where(eq(quoteDrafts.businessId, businessId))
      .orderBy(desc(quoteDrafts.createdAt));
  }

  async getQuoteDraft(id: number): Promise<QuoteDraft | undefined> {
    const [draft] = await db
      .select()
      .from(quoteDrafts)
      .where(eq(quoteDrafts.id, id))
      .limit(1);
    return draft;
  }

  async createQuoteDraft(draft: InsertQuoteDraft): Promise<QuoteDraft> {
    const [created] = await db.insert(quoteDrafts).values(draft).returning();
    return created;
  }

  async updateQuoteDraft(id: number, updates: Partial<QuoteDraft>): Promise<QuoteDraft> {
    const [updated] = await db
      .update(quoteDrafts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quoteDrafts.id, id))
      .returning();
    return updated;
  }

  // Route Optimizer - Crews
  async getCrews(businessId: number): Promise<Crew[]> {
    return db
      .select()
      .from(crews)
      .where(eq(crews.businessId, businessId))
      .orderBy(crews.name);
  }

  async getCrew(id: number): Promise<Crew | undefined> {
    const [crew] = await db
      .select()
      .from(crews)
      .where(eq(crews.id, id))
      .limit(1);
    return crew;
  }

  async createCrew(crew: InsertCrew): Promise<Crew> {
    const [created] = await db.insert(crews).values(crew).returning();
    return created;
  }

  async updateCrew(id: number, updates: Partial<InsertCrew>): Promise<Crew> {
    const [updated] = await db
      .update(crews)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crews.id, id))
      .returning();
    return updated;
  }

  async deleteCrew(id: number): Promise<boolean> {
    await db
      .update(crewMembers)
      .set({ isActive: false, endAt: new Date() })
      .where(eq(crewMembers.crewId, id));
    
    const [crew] = await db
      .update(crews)
      .set({ status: "INACTIVE", isActive: false, updatedAt: new Date() })
      .where(eq(crews.id, id))
      .returning();
    
    return !!crew;
  }

  // Route Optimizer - Crew Members
  async getCrewMembers(crewId: number): Promise<CrewMember[]> {
    return db
      .select()
      .from(crewMembers)
      .where(and(eq(crewMembers.crewId, crewId), eq(crewMembers.isActive, true)));
  }

  async addCrewMember(member: InsertCrewMember): Promise<CrewMember> {
    const [created] = await db.insert(crewMembers).values({
      ...member,
      role: member.role ?? "MEMBER",
      isActive: true,
      startAt: new Date(),
    }).returning();
    return created;
  }

  async updateCrewMember(id: number, updates: Partial<InsertCrewMember>): Promise<CrewMember | null> {
    const [updated] = await db
      .update(crewMembers)
      .set(updates)
      .where(eq(crewMembers.id, id))
      .returning();
    return updated ?? null;
  }

  async removeCrewMember(id: number): Promise<CrewMember | null> {
    const [updated] = await db
      .update(crewMembers)
      .set({ isActive: false, endAt: new Date() })
      .where(eq(crewMembers.id, id))
      .returning();
    return updated ?? null;
  }

  async setCrewLeader(crewId: number, memberId: number): Promise<void> {
    await db
      .update(crewMembers)
      .set({ role: "MEMBER" })
      .where(and(eq(crewMembers.crewId, crewId), eq(crewMembers.role, "LEADER")));
    
    await db
      .update(crewMembers)
      .set({ role: "LEADER" })
      .where(eq(crewMembers.id, memberId));
  }

  // Skills Management
  async getSkills(businessId: number): Promise<Skill[]> {
    return db
      .select()
      .from(skills)
      .where(and(eq(skills.businessId, businessId), eq(skills.isActive, true)))
      .orderBy(skills.name);
  }

  async getSkill(id: number): Promise<Skill | undefined> {
    const [skill] = await db
      .select()
      .from(skills)
      .where(eq(skills.id, id));
    return skill;
  }

  async createSkill(skill: InsertSkill): Promise<Skill> {
    const [created] = await db
      .insert(skills)
      .values(skill)
      .returning();
    return created;
  }

  async updateSkill(id: number, updates: Partial<InsertSkill>): Promise<Skill> {
    const [updated] = await db
      .update(skills)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(skills.id, id))
      .returning();
    return updated;
  }

  async deleteSkill(id: number): Promise<boolean> {
    const [deleted] = await db
      .update(skills)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(skills.id, id))
      .returning();
    return !!deleted;
  }

  // Equipment Management
  async getEquipment(businessId: number): Promise<Equipment[]> {
    return db
      .select()
      .from(equipment)
      .where(and(eq(equipment.businessId, businessId), eq(equipment.isActive, true)))
      .orderBy(equipment.name);
  }

  async getEquipmentItem(id: number): Promise<Equipment | undefined> {
    const [item] = await db
      .select()
      .from(equipment)
      .where(eq(equipment.id, id));
    return item;
  }

  async createEquipment(equip: InsertEquipment): Promise<Equipment> {
    const [created] = await db
      .insert(equipment)
      .values(equip)
      .returning();
    return created;
  }

  async updateEquipment(id: number, updates: Partial<InsertEquipment>): Promise<Equipment> {
    const [updated] = await db
      .update(equipment)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(equipment.id, id))
      .returning();
    return updated;
  }

  async deleteEquipment(id: number): Promise<boolean> {
    const [deleted] = await db
      .update(equipment)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(equipment.id, id))
      .returning();
    return !!deleted;
  }

  // Crew Skills Assignment
  async getCrewSkills(crewId: number): Promise<(CrewSkill & { skill: Skill })[]> {
    const results = await db
      .select({
        id: crewSkills.id,
        crewId: crewSkills.crewId,
        skillId: crewSkills.skillId,
        proficiencyLevel: crewSkills.proficiencyLevel,
        createdAt: crewSkills.createdAt,
        skill: skills,
      })
      .from(crewSkills)
      .innerJoin(skills, eq(crewSkills.skillId, skills.id))
      .where(eq(crewSkills.crewId, crewId));
    return results;
  }

  async addCrewSkill(crewId: number, skillId: number, proficiencyLevel: number = 1): Promise<CrewSkill> {
    const [created] = await db
      .insert(crewSkills)
      .values({ crewId, skillId, proficiencyLevel })
      .onConflictDoNothing()
      .returning();
    return created;
  }

  async removeCrewSkill(crewId: number, skillId: number): Promise<boolean> {
    const result = await db
      .delete(crewSkills)
      .where(and(eq(crewSkills.crewId, crewId), eq(crewSkills.skillId, skillId)));
    return true;
  }

  // Crew Equipment Assignment
  async getCrewEquipment(crewId: number): Promise<(CrewEquipment & { equipment: Equipment })[]> {
    const results = await db
      .select({
        id: crewEquipment.id,
        crewId: crewEquipment.crewId,
        equipmentId: crewEquipment.equipmentId,
        assignedAt: crewEquipment.assignedAt,
        isActive: crewEquipment.isActive,
        equipment: equipment,
      })
      .from(crewEquipment)
      .innerJoin(equipment, eq(crewEquipment.equipmentId, equipment.id))
      .where(and(eq(crewEquipment.crewId, crewId), eq(crewEquipment.isActive, true)));
    return results;
  }

  async addCrewEquipment(crewId: number, equipmentId: number): Promise<CrewEquipment> {
    const [created] = await db
      .insert(crewEquipment)
      .values({ crewId, equipmentId })
      .onConflictDoNothing()
      .returning();
    return created;
  }

  async removeCrewEquipment(crewId: number, equipmentId: number): Promise<boolean> {
    await db
      .update(crewEquipment)
      .set({ isActive: false })
      .where(and(eq(crewEquipment.crewId, crewId), eq(crewEquipment.equipmentId, equipmentId)));
    return true;
  }

  // Crew Availability
  async getCrewAvailability(crewId: number): Promise<CrewAvailability[]> {
    return db
      .select()
      .from(crewAvailability)
      .where(eq(crewAvailability.crewId, crewId))
      .orderBy(crewAvailability.dayOfWeek);
  }

  async setCrewAvailability(crewId: number, availability: InsertCrewAvailability[]): Promise<CrewAvailability[]> {
    // Delete existing availability for this crew
    await db.delete(crewAvailability).where(eq(crewAvailability.crewId, crewId));
    
    // Insert new availability records
    if (availability.length === 0) {
      return [];
    }
    
    const toInsert = availability.map(slot => ({
      ...slot,
      crewId,
    }));
    
    return db.insert(crewAvailability).values(toInsert).returning();
  }

  async updateCrewAvailabilitySlot(id: number, updates: Partial<InsertCrewAvailability>): Promise<CrewAvailability> {
    const [updated] = await db
      .update(crewAvailability)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(crewAvailability.id, id))
      .returning();
    return updated;
  }

  // Time-Off Requests
  async getTimeOffRequests(crewId?: number, status?: string): Promise<TimeOffRequest[]> {
    let conditions = [];
    if (crewId !== undefined) {
      conditions.push(eq(timeOffRequests.crewId, crewId));
    }
    if (status !== undefined) {
      conditions.push(eq(timeOffRequests.status, status));
    }
    
    if (conditions.length === 0) {
      return db.select().from(timeOffRequests).orderBy(desc(timeOffRequests.createdAt));
    }
    
    return db
      .select()
      .from(timeOffRequests)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(timeOffRequests.createdAt));
  }

  async getTimeOffRequest(id: number): Promise<TimeOffRequest | undefined> {
    const [request] = await db
      .select()
      .from(timeOffRequests)
      .where(eq(timeOffRequests.id, id))
      .limit(1);
    return request;
  }

  async createTimeOffRequest(request: InsertTimeOffRequest): Promise<TimeOffRequest> {
    // Validate dates at storage layer to protect all entry points
    // Use shared validator to ensure all dates come in as validated ISO strings or Date objects
    const startDate = this.validateAndParseDateInput(request.startDate, "startDate");
    const endDate = this.validateAndParseDateInput(request.endDate, "endDate");
    
    if (startDate > endDate) {
      throw new Error("startDate must be before or equal to endDate");
    }
    
    const [created] = await db.insert(timeOffRequests).values({
      ...request,
      startDate,
      endDate,
    }).returning();
    return created;
  }
  
  // Shared date validation helper - ONLY accepts ISO YYYY-MM-DD strings to prevent format ambiguity
  // Date objects are rejected to ensure all dates pass through format validation
  private validateAndParseDateInput(input: any, fieldName: string): Date {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    
    // Reject Date objects - they bypass ISO format validation
    if (input instanceof Date) {
      throw new Error(`${fieldName} must be an ISO YYYY-MM-DD string, not a Date object`);
    }
    
    if (typeof input !== 'string') {
      throw new Error(`${fieldName} must be an ISO YYYY-MM-DD string`);
    }
    
    if (!isoDateRegex.test(input)) {
      throw new Error(`${fieldName} must be in ISO YYYY-MM-DD format`);
    }
    
    const parsed = new Date(input);
    if (isNaN(parsed.getTime())) {
      throw new Error(`${fieldName} is not a valid date`);
    }
    
    return parsed;
  }

  async updateTimeOffRequest(id: number, updates: Partial<TimeOffRequest>): Promise<TimeOffRequest> {
    const [updated] = await db
      .update(timeOffRequests)
      .set({ ...updates, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(timeOffRequests.id, id))
      .returning();
    return updated;
  }

  async approveTimeOffRequest(id: number, approvedBy: number, notes?: string): Promise<TimeOffRequest> {
    const [updated] = await db
      .update(timeOffRequests)
      .set({
        status: "approved",
        approvedBy,
        approvedAt: sql`CURRENT_TIMESTAMP`,
        notes: notes || null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(timeOffRequests.id, id))
      .returning();
    return updated;
  }

  async denyTimeOffRequest(id: number, approvedBy: number, notes?: string): Promise<TimeOffRequest> {
    const [updated] = await db
      .update(timeOffRequests)
      .set({
        status: "denied",
        approvedBy,
        approvedAt: sql`CURRENT_TIMESTAMP`,
        notes: notes || null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(timeOffRequests.id, id))
      .returning();
    return updated;
  }

  async deleteTimeOffRequest(id: number): Promise<boolean> {
    const result = await db.delete(timeOffRequests).where(eq(timeOffRequests.id, id));
    return true;
  }

  // Service Zones
  async getServiceZones(businessId: number): Promise<ServiceZone[]> {
    return db
      .select()
      .from(serviceZones)
      .where(and(
        eq(serviceZones.businessId, businessId),
        eq(serviceZones.isActive, true)
      ))
      .orderBy(desc(serviceZones.priority), serviceZones.name);
  }

  async getServiceZone(id: number): Promise<ServiceZone | undefined> {
    const [zone] = await db.select().from(serviceZones).where(eq(serviceZones.id, id));
    return zone;
  }

  async createServiceZone(zone: InsertServiceZone): Promise<ServiceZone> {
    const [created] = await db.insert(serviceZones).values(zone).returning();
    return created;
  }

  async updateServiceZone(id: number, updates: Partial<InsertServiceZone>): Promise<ServiceZone> {
    const [updated] = await db
      .update(serviceZones)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(serviceZones.id, id))
      .returning();
    return updated;
  }

  async deleteServiceZone(id: number): Promise<boolean> {
    // Soft delete by setting isActive to false
    await db.update(serviceZones).set({ isActive: false, updatedAt: new Date() }).where(eq(serviceZones.id, id));
    return true;
  }

  // Crew Zone Assignments
  async getCrewZoneAssignments(crewId: number): Promise<(CrewZoneAssignment & { zone: ServiceZone })[]> {
    const results = await db
      .select()
      .from(crewZoneAssignments)
      .innerJoin(serviceZones, eq(crewZoneAssignments.zoneId, serviceZones.id))
      .where(eq(crewZoneAssignments.crewId, crewId))
      .orderBy(desc(crewZoneAssignments.isPrimary), desc(crewZoneAssignments.priority));
    
    return results.map(r => ({
      ...r.crew_zone_assignments,
      zone: r.service_zones,
    }));
  }

  async getZoneCrewAssignments(zoneId: number): Promise<(CrewZoneAssignment & { crew: Crew })[]> {
    const results = await db
      .select()
      .from(crewZoneAssignments)
      .innerJoin(crews, eq(crewZoneAssignments.crewId, crews.id))
      .where(eq(crewZoneAssignments.zoneId, zoneId))
      .orderBy(desc(crewZoneAssignments.isPrimary), desc(crewZoneAssignments.priority));
    
    return results.map(r => ({
      ...r.crew_zone_assignments,
      crew: r.crews,
    }));
  }

  async assignCrewToZone(
    crewId: number, 
    zoneId: number, 
    isPrimary: boolean = true, 
    priority: number = 0, 
    assignedBy?: number
  ): Promise<CrewZoneAssignment> {
    const [assignment] = await db
      .insert(crewZoneAssignments)
      .values({ crewId, zoneId, isPrimary, priority, assignedBy })
      .returning();
    return assignment;
  }

  async updateCrewZoneAssignment(id: number, updates: Partial<InsertCrewZoneAssignment>): Promise<CrewZoneAssignment> {
    const [updated] = await db
      .update(crewZoneAssignments)
      .set(updates)
      .where(eq(crewZoneAssignments.id, id))
      .returning();
    return updated;
  }

  async removeCrewFromZone(crewId: number, zoneId: number): Promise<boolean> {
    await db
      .delete(crewZoneAssignments)
      .where(and(
        eq(crewZoneAssignments.crewId, crewId),
        eq(crewZoneAssignments.zoneId, zoneId)
      ));
    return true;
  }

  // Crew Analytics
  async getCrewAnalytics(crewId: number, startDate: Date, endDate: Date): Promise<CrewAnalyticsSnapshot[]> {
    return db
      .select()
      .from(crewAnalyticsSnapshots)
      .where(and(
        eq(crewAnalyticsSnapshots.crewId, crewId),
        gte(crewAnalyticsSnapshots.snapshotDate, startDate),
        lte(crewAnalyticsSnapshots.snapshotDate, endDate)
      ))
      .orderBy(desc(crewAnalyticsSnapshots.snapshotDate));
  }

  async getCrewAnalyticsSummary(crewId: number, days: number): Promise<{
    totalJobsCompleted: number;
    totalRevenue: number;
    averageUtilization: number;
    averageZoneCompliance: number;
    totalDriveMinutes: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const snapshots = await db
      .select()
      .from(crewAnalyticsSnapshots)
      .where(and(
        eq(crewAnalyticsSnapshots.crewId, crewId),
        gte(crewAnalyticsSnapshots.snapshotDate, startDate)
      ));
    
    if (snapshots.length === 0) {
      return {
        totalJobsCompleted: 0,
        totalRevenue: 0,
        averageUtilization: 0,
        averageZoneCompliance: 0,
        totalDriveMinutes: 0,
      };
    }
    
    const totalJobsCompleted = snapshots.reduce((sum, s) => sum + (s.jobsCompleted || 0), 0);
    const totalRevenue = snapshots.reduce((sum, s) => sum + (s.revenueGenerated || 0), 0);
    const totalDriveMinutes = snapshots.reduce((sum, s) => sum + (s.totalDriveMinutes || 0), 0);
    const averageUtilization = snapshots.reduce((sum, s) => sum + (s.utilizationPercent || 0), 0) / snapshots.length;
    const averageZoneCompliance = snapshots.reduce((sum, s) => sum + (s.zoneCompliancePercent || 0), 0) / snapshots.length;
    
    return {
      totalJobsCompleted,
      totalRevenue,
      averageUtilization: Math.round(averageUtilization),
      averageZoneCompliance: Math.round(averageZoneCompliance),
      totalDriveMinutes,
    };
  }

  async getAllCrewsAnalytics(businessId: number, startDate: Date, endDate: Date): Promise<CrewAnalyticsSnapshot[]> {
    return db
      .select()
      .from(crewAnalyticsSnapshots)
      .where(and(
        eq(crewAnalyticsSnapshots.businessId, businessId),
        gte(crewAnalyticsSnapshots.snapshotDate, startDate),
        lte(crewAnalyticsSnapshots.snapshotDate, endDate)
      ))
      .orderBy(desc(crewAnalyticsSnapshots.snapshotDate));
  }

  async upsertCrewAnalyticsSnapshot(snapshot: InsertCrewAnalyticsSnapshot): Promise<CrewAnalyticsSnapshot> {
    const [result] = await db
      .insert(crewAnalyticsSnapshots)
      .values(snapshot)
      .onConflictDoUpdate({
        target: [crewAnalyticsSnapshots.crewId, crewAnalyticsSnapshots.snapshotDate],
        set: {
          jobsCompleted: snapshot.jobsCompleted,
          jobsAssigned: snapshot.jobsAssigned,
          jobsCancelled: snapshot.jobsCancelled,
          totalServiceMinutes: snapshot.totalServiceMinutes,
          totalDriveMinutes: snapshot.totalDriveMinutes,
          totalAvailableMinutes: snapshot.totalAvailableMinutes,
          utilizationPercent: snapshot.utilizationPercent,
          revenueGenerated: snapshot.revenueGenerated,
          averageJobRevenue: snapshot.averageJobRevenue,
          inZoneJobCount: snapshot.inZoneJobCount,
          outOfZoneJobCount: snapshot.outOfZoneJobCount,
          zoneCompliancePercent: snapshot.zoneCompliancePercent,
          averageDriveMinutesPerJob: snapshot.averageDriveMinutesPerJob,
          onTimeArrivalPercent: snapshot.onTimeArrivalPercent,
        },
      })
      .returning();
    return result;
  }

  // Route Optimizer - Job Requests
  async getJobRequests(businessId: number): Promise<JobRequest[]> {
    return db
      .select()
      .from(jobRequests)
      .where(eq(jobRequests.businessId, businessId))
      .orderBy(desc(jobRequests.createdAt));
  }

  async getJobRequest(id: number): Promise<JobRequest | undefined> {
    const [request] = await db
      .select()
      .from(jobRequests)
      .where(eq(jobRequests.id, id))
      .limit(1);
    return request;
  }

  async getJobRequestsByStatus(businessId: number, status: string): Promise<JobRequest[]> {
    return db
      .select()
      .from(jobRequests)
      .where(and(
        eq(jobRequests.businessId, businessId),
        eq(jobRequests.status, status)
      ))
      .orderBy(desc(jobRequests.createdAt));
  }

  async createJobRequest(request: InsertJobRequest): Promise<JobRequest> {
    const [created] = await db.insert(jobRequests).values(request).returning();
    return created;
  }

  async updateJobRequest(id: number, updates: Partial<JobRequest>): Promise<JobRequest> {
    const [updated] = await db
      .update(jobRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobRequests.id, id))
      .returning();
    return updated;
  }

  // Route Optimizer - Schedule Items
  async getScheduleItems(businessId: number, crewId?: number): Promise<ScheduleItem[]> {
    if (crewId) {
      return db
        .select()
        .from(scheduleItems)
        .where(and(
          eq(scheduleItems.businessId, businessId),
          eq(scheduleItems.crewId, crewId)
        ))
        .orderBy(scheduleItems.startAt);
    }
    return db
      .select()
      .from(scheduleItems)
      .where(eq(scheduleItems.businessId, businessId))
      .orderBy(scheduleItems.startAt);
  }

  async getScheduleItemsByDate(businessId: number, date: Date): Promise<ScheduleItem[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return db
      .select()
      .from(scheduleItems)
      .where(and(
        eq(scheduleItems.businessId, businessId),
        gte(scheduleItems.startAt, startOfDay),
        lte(scheduleItems.startAt, endOfDay)
      ))
      .orderBy(scheduleItems.startAt);
  }

  async createScheduleItem(item: InsertScheduleItem): Promise<ScheduleItem> {
    const [created] = await db.insert(scheduleItems).values(item).returning();
    return created;
  }

  async updateScheduleItem(id: number, updates: Partial<ScheduleItem>): Promise<ScheduleItem> {
    const [updated] = await db
      .update(scheduleItems)
      .set(updates)
      .where(eq(scheduleItems.id, id))
      .returning();
    return updated;
  }

  // Route Optimizer - Assignment Simulations
  async getSimulationsForJobRequest(jobRequestId: number): Promise<AssignmentSimulation[]> {
    return db
      .select()
      .from(assignmentSimulations)
      .where(eq(assignmentSimulations.jobRequestId, jobRequestId))
      .orderBy(desc(assignmentSimulations.totalScore));
  }

  async getSimulation(id: number): Promise<AssignmentSimulation | undefined> {
    const [sim] = await db
      .select()
      .from(assignmentSimulations)
      .where(eq(assignmentSimulations.id, id))
      .limit(1);
    return sim;
  }

  async createSimulation(sim: InsertAssignmentSimulation): Promise<AssignmentSimulation> {
    const [created] = await db.insert(assignmentSimulations).values(sim).returning();
    return created;
  }

  async deleteSimulationsForJobRequest(jobRequestId: number): Promise<void> {
    await db
      .delete(assignmentSimulations)
      .where(eq(assignmentSimulations.jobRequestId, jobRequestId));
  }

  // Route Optimizer - Assignment Decisions
  async getDecision(id: number): Promise<AssignmentDecision | undefined> {
    const [decision] = await db
      .select()
      .from(assignmentDecisions)
      .where(eq(assignmentDecisions.id, id))
      .limit(1);
    return decision;
  }

  async getDecisionForJobRequest(jobRequestId: number): Promise<AssignmentDecision | undefined> {
    const [decision] = await db
      .select()
      .from(assignmentDecisions)
      .where(eq(assignmentDecisions.jobRequestId, jobRequestId))
      .orderBy(desc(assignmentDecisions.createdAt))
      .limit(1);
    return decision;
  }

  async createDecision(decision: InsertAssignmentDecision): Promise<AssignmentDecision> {
    const [created] = await db.insert(assignmentDecisions).values(decision).returning();
    return created;
  }

  async updateDecision(id: number, updates: Partial<AssignmentDecision>): Promise<AssignmentDecision> {
    const [updated] = await db
      .update(assignmentDecisions)
      .set(updates)
      .where(eq(assignmentDecisions.id, id))
      .returning();
    return updated;
  }

  async deleteDecisionsForJobRequest(jobRequestId: number): Promise<void> {
    await db
      .delete(assignmentDecisions)
      .where(eq(assignmentDecisions.jobRequestId, jobRequestId));
  }

  // Route Optimizer - Distance Cache
  async getDistanceCache(originKey: string, destKey: string): Promise<DistanceCache | undefined> {
    const [cached] = await db
      .select()
      .from(distanceCache)
      .where(and(
        eq(distanceCache.originKey, originKey),
        eq(distanceCache.destKey, destKey)
      ))
      .limit(1);
    
    if (cached && cached.expiresAt > new Date()) {
      return cached;
    }
    return undefined;
  }

  async upsertDistanceCache(entry: InsertDistanceCache): Promise<DistanceCache> {
    const [upserted] = await db
      .insert(distanceCache)
      .values(entry)
      .onConflictDoUpdate({
        target: [distanceCache.originKey, distanceCache.destKey],
        set: {
          travelMinutes: entry.travelMinutes,
          distanceMeters: entry.distanceMeters,
          expiresAt: entry.expiresAt,
        },
      })
      .returning();
    return upserted;
  }

  // Agent Registry
  async getAgents(): Promise<AgentRegistryEntry[]> {
    return await db.select().from(agentRegistry).orderBy(agentRegistry.stage, agentRegistry.displayName);
  }

  async getAgent(id: number): Promise<AgentRegistryEntry | undefined> {
    const [agent] = await db.select().from(agentRegistry).where(eq(agentRegistry.id, id)).limit(1);
    return agent;
  }

  async getAgentByKey(agentKey: string): Promise<AgentRegistryEntry | undefined> {
    const [agent] = await db.select().from(agentRegistry).where(eq(agentRegistry.agentKey, agentKey)).limit(1);
    return agent;
  }

  async createAgent(agent: InsertAgentRegistryEntry): Promise<AgentRegistryEntry> {
    const [created] = await db.insert(agentRegistry).values(agent).returning();
    return created;
  }

  async updateAgent(id: number, updates: Partial<InsertAgentRegistryEntry>): Promise<AgentRegistryEntry> {
    const [updated] = await db
      .update(agentRegistry)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agentRegistry.id, id))
      .returning();
    return updated;
  }

  // Agent Runs
  async getAgentRuns(agentId: number, limit: number = 10): Promise<AgentRunEntry[]> {
    return await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.agentId, agentId))
      .orderBy(desc(agentRuns.startedAt))
      .limit(limit);
  }

  async getAgentRun(id: number): Promise<AgentRunEntry | undefined> {
    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1);
    return run;
  }

  async createAgentRun(run: InsertAgentRunEntry): Promise<AgentRunEntry> {
    const [created] = await db.insert(agentRuns).values(run).returning();
    return created;
  }

  async updateAgentRun(id: number, updates: Partial<AgentRunEntry>): Promise<AgentRunEntry> {
    const [updated] = await db
      .update(agentRuns)
      .set(updates)
      .where(eq(agentRuns.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
