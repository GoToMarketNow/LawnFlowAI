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
  notifications,
  crewCommsPreferences,
  commsThreads,
  commsMessages,
  pushSubscriptions,
  onboardingFlows,
  onboardingSessions,
  onboardingAnswers,
  type Notification,
  type InsertNotification,
  type CrewCommsPreference,
  type InsertCrewCommsPreference,
  type CommsThread,
  type InsertCommsThread,
  type CommsMessage,
  type InsertCommsMessage,
  type PushSubscription,
  type InsertPushSubscription,
  type OnboardingFlow,
  type InsertOnboardingFlow,
  type OnboardingSession,
  type InsertOnboardingSession,
  type OnboardingAnswer,
  type InsertOnboardingAnswer,
  type OnboardingSessionWithAnswers,
  accountIntegrations,
  invoices,
  invoiceLineItems,
  payments,
  billingIssues,
  billingCustomers,
  type AccountIntegration,
  type InsertAccountIntegration,
  type Invoice,
  type InsertInvoice,
  type InvoiceLineItem,
  type InsertInvoiceLineItem,
  type Payment,
  type InsertPayment,
  type BillingIssue,
  type InsertBillingIssue,
  type BillingCustomer,
  type InsertBillingCustomer,
  type BillingOverview,
  // Service Catalog
  services,
  servicePricing,
  serviceFrequencyOptions,
  promotionRules,
  snowServicePolicies,
  mulchProfiles,
  firewoodProfiles,
  type Service,
  type InsertService,
  type ServicePricing as ServicePricingType,
  type InsertServicePricing,
  type ServiceFrequencyOption,
  type InsertServiceFrequencyOption,
  type PromotionRule,
  type InsertPromotionRule,
  type SnowServicePolicy,
  type InsertSnowServicePolicy,
  type MulchProfile,
  type InsertMulchProfile,
  type FirewoodProfile,
  type InsertFirewoodProfile,
  customerServicePreferences,
  type CustomerServicePreference,
  type InsertCustomerServicePreference,
  // Message Templates & Billing Config (Phase 2 Settings)
  messageTemplates,
  type MessageTemplate,
  type InsertMessageTemplate,
  billingConfigs,
  type BillingConfig,
  type InsertBillingConfig,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, inArray, sql, and, gte, lte } from "drizzle-orm";

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
  
  // Crew Comms - Notifications
  getNotifications(userId: number, limit?: number): Promise<Notification[]>;
  getNotification(id: number): Promise<Notification | undefined>;
  getUnreadNotifications(userId: number): Promise<Notification[]>;
  getNotificationsByBusiness(businessId: number, options?: { type?: string; status?: string; limit?: number }): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: number, updates: Partial<Notification>): Promise<Notification>;
  ackNotification(id: number): Promise<Notification>;
  markNotificationsSeen(userId: number, notificationIds: number[]): Promise<void>;
  
  // Crew Comms - Preferences
  getCrewCommsPreference(userId: number): Promise<CrewCommsPreference | undefined>;
  getCrewCommsPreferences(businessId: number): Promise<CrewCommsPreference[]>;
  createCrewCommsPreference(pref: InsertCrewCommsPreference): Promise<CrewCommsPreference>;
  updateCrewCommsPreference(userId: number, updates: Partial<InsertCrewCommsPreference>): Promise<CrewCommsPreference>;
  
  // Crew Comms - Threads
  getCommsThreads(businessId: number, limit?: number): Promise<CommsThread[]>;
  getCommsThread(id: number): Promise<CommsThread | undefined>;
  getCommsThreadByPhone(phoneE164: string): Promise<CommsThread | undefined>;
  getCommsThreadByUser(userId: number): Promise<CommsThread | undefined>;
  createCommsThread(thread: InsertCommsThread): Promise<CommsThread>;
  updateCommsThread(id: number, updates: Partial<InsertCommsThread>): Promise<CommsThread>;
  
  // Crew Comms - Messages
  getCommsMessages(threadId: number, limit?: number): Promise<CommsMessage[]>;
  getCommsMessage(id: number): Promise<CommsMessage | undefined>;
  createCommsMessage(message: InsertCommsMessage): Promise<CommsMessage>;
  
  // Push Subscriptions
  getPushSubscriptions(userId: number): Promise<PushSubscription[]>;
  getPushSubscription(endpoint: string): Promise<PushSubscription | undefined>;
  createPushSubscription(sub: InsertPushSubscription): Promise<PushSubscription>;
  deletePushSubscription(endpoint: string): Promise<boolean>;
  updatePushSubscriptionLastUsed(endpoint: string): Promise<void>;
  
  // Billing - Account Integrations
  getAccountIntegration(businessId: number, provider: string): Promise<AccountIntegration | undefined>;
  getAccountIntegrations(businessId: number): Promise<AccountIntegration[]>;
  createAccountIntegration(integration: InsertAccountIntegration): Promise<AccountIntegration>;
  updateAccountIntegration(id: number, updates: Partial<InsertAccountIntegration>): Promise<AccountIntegration>;
  
  // Billing - Invoices
  getInvoices(businessId: number, options?: { status?: string; limit?: number }): Promise<Invoice[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  getInvoiceByExternalId(externalId: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, updates: Partial<InsertInvoice>): Promise<Invoice>;
  
  // Billing - Invoice Line Items
  getInvoiceLineItems(invoiceId: number): Promise<InvoiceLineItem[]>;
  createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem>;
  
  // Billing - Payments
  getPayments(businessId: number, options?: { status?: string; limit?: number }): Promise<Payment[]>;
  getPayment(id: number): Promise<Payment | undefined>;
  getPaymentsByInvoice(invoiceId: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, updates: Partial<InsertPayment>): Promise<Payment>;
  
  // Billing - Issues
  getBillingIssues(businessId: number, options?: { status?: string; limit?: number }): Promise<BillingIssue[]>;
  getBillingIssue(id: number): Promise<BillingIssue | undefined>;
  createBillingIssue(issue: InsertBillingIssue): Promise<BillingIssue>;
  updateBillingIssue(id: number, updates: Partial<InsertBillingIssue>): Promise<BillingIssue>;
  
  // Billing - Customers
  getBillingCustomers(businessId: number): Promise<BillingCustomer[]>;
  getBillingCustomer(id: number): Promise<BillingCustomer | undefined>;
  getBillingCustomerByExternalId(externalId: string): Promise<BillingCustomer | undefined>;
  createBillingCustomer(customer: InsertBillingCustomer): Promise<BillingCustomer>;
  updateBillingCustomer(id: number, updates: Partial<InsertBillingCustomer>): Promise<BillingCustomer>;
  
  // Billing - Overview (computed)
  getBillingOverview(businessId: number): Promise<BillingOverview>;
  
  // Service Catalog - Services
  getServices(businessId: number, options?: { category?: string; isActive?: boolean }): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, updates: Partial<InsertService>): Promise<Service>;
  deleteService(id: number): Promise<boolean>;
  
  // Service Catalog - Pricing
  getServicePricing(serviceId: number): Promise<ServicePricingType[]>;
  createServicePricing(pricing: InsertServicePricing): Promise<ServicePricingType>;
  updateServicePricing(id: number, updates: Partial<InsertServicePricing>): Promise<ServicePricingType>;
  deleteServicePricing(id: number): Promise<boolean>;
  
  // Service Catalog - Frequency Options
  getServiceFrequencyOptions(serviceId: number): Promise<ServiceFrequencyOption[]>;
  createServiceFrequencyOption(option: InsertServiceFrequencyOption): Promise<ServiceFrequencyOption>;
  updateServiceFrequencyOption(id: number, updates: Partial<InsertServiceFrequencyOption>): Promise<ServiceFrequencyOption>;
  deleteServiceFrequencyOption(id: number): Promise<boolean>;
  
  // Service Catalog - Promotions
  getPromotionRules(businessId: number, options?: { isActive?: boolean }): Promise<PromotionRule[]>;
  getPromotionRule(id: number): Promise<PromotionRule | undefined>;
  createPromotionRule(rule: InsertPromotionRule): Promise<PromotionRule>;
  updatePromotionRule(id: number, updates: Partial<InsertPromotionRule>): Promise<PromotionRule>;
  deletePromotionRule(id: number): Promise<boolean>;
  
  // Service Catalog - Snow Policies
  getSnowServicePolicy(serviceId: number): Promise<SnowServicePolicy | undefined>;
  createSnowServicePolicy(policy: InsertSnowServicePolicy): Promise<SnowServicePolicy>;
  updateSnowServicePolicy(id: number, updates: Partial<InsertSnowServicePolicy>): Promise<SnowServicePolicy>;
  deleteSnowServicePolicy(id: number): Promise<boolean>;
  
  // Service Catalog - Mulch Profiles
  getMulchProfiles(businessId: number, customerId?: number): Promise<MulchProfile[]>;
  getMulchProfile(id: number): Promise<MulchProfile | undefined>;
  createMulchProfile(profile: InsertMulchProfile): Promise<MulchProfile>;
  updateMulchProfile(id: number, updates: Partial<InsertMulchProfile>): Promise<MulchProfile>;
  
  // Service Catalog - Firewood Profiles
  getFirewoodProfiles(businessId: number, customerId?: number): Promise<FirewoodProfile[]>;
  getFirewoodProfile(id: number): Promise<FirewoodProfile | undefined>;
  createFirewoodProfile(profile: InsertFirewoodProfile): Promise<FirewoodProfile>;
  updateFirewoodProfile(id: number, updates: Partial<InsertFirewoodProfile>): Promise<FirewoodProfile>;
  
  // Customer Service Preferences
  getCustomerServicePreferences(accountId: number, customerId: number): Promise<CustomerServicePreference[]>;
  getCustomerServicePreference(id: number): Promise<CustomerServicePreference | undefined>;
  getCustomerServicePreferenceByService(accountId: number, customerId: number, serviceId: number): Promise<CustomerServicePreference | undefined>;
  createCustomerServicePreference(pref: InsertCustomerServicePreference): Promise<CustomerServicePreference>;
  updateCustomerServicePreference(id: number, updates: Partial<InsertCustomerServicePreference>): Promise<CustomerServicePreference>;
  deleteCustomerServicePreference(id: number): Promise<boolean>;
  upsertCustomerServicePreference(pref: InsertCustomerServicePreference): Promise<CustomerServicePreference>;
  
  // Message Templates (Phase 2 Settings)
  getMessageTemplates(accountId: number, options?: { type?: string; category?: string; isActive?: boolean }): Promise<MessageTemplate[]>;
  getMessageTemplate(id: number): Promise<MessageTemplate | undefined>;
  createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate>;
  updateMessageTemplate(id: number, updates: Partial<InsertMessageTemplate>): Promise<MessageTemplate>;
  deleteMessageTemplate(id: number): Promise<boolean>;
  
  // Billing Configuration (Phase 2 Settings)
  getBillingConfig(accountId: number): Promise<BillingConfig | undefined>;
  createBillingConfig(config: InsertBillingConfig): Promise<BillingConfig>;
  updateBillingConfig(id: number, updates: Partial<InsertBillingConfig>): Promise<BillingConfig>;
  upsertBillingConfig(accountId: number, config: Partial<InsertBillingConfig>): Promise<BillingConfig>;
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

  // Crew Comms - Notifications
  async getNotifications(userId: number, limit: number = 50): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientUserId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getNotification(id: number): Promise<Notification | undefined> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);
    return notification;
  }

  async getUnreadNotifications(userId: number): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.recipientUserId, userId),
        eq(notifications.status, "QUEUED")
      ))
      .orderBy(desc(notifications.createdAt));
  }

  async getNotificationsByBusiness(businessId: number, options?: { type?: string; status?: string; limit?: number }): Promise<Notification[]> {
    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.businessId, businessId))
      .orderBy(desc(notifications.createdAt));
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    return query;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async updateNotification(id: number, updates: Partial<Notification>): Promise<Notification> {
    const [updated] = await db
      .update(notifications)
      .set(updates)
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async ackNotification(id: number): Promise<Notification> {
    const [updated] = await db
      .update(notifications)
      .set({ status: "ACKED", ackedAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markNotificationsSeen(userId: number, notificationIds: number[]): Promise<void> {
    if (notificationIds.length === 0) return;
    await db
      .update(notifications)
      .set({ status: "DELIVERED", deliveredAt: new Date() })
      .where(and(
        eq(notifications.recipientUserId, userId),
        inArray(notifications.id, notificationIds),
        eq(notifications.status, "SENT")
      ));
  }

  // Crew Comms - Preferences
  async getCrewCommsPreference(userId: number): Promise<CrewCommsPreference | undefined> {
    const [pref] = await db
      .select()
      .from(crewCommsPreferences)
      .where(eq(crewCommsPreferences.userId, userId))
      .limit(1);
    return pref;
  }

  async getCrewCommsPreferences(businessId: number): Promise<CrewCommsPreference[]> {
    return db
      .select()
      .from(crewCommsPreferences)
      .where(eq(crewCommsPreferences.businessId, businessId));
  }

  async createCrewCommsPreference(pref: InsertCrewCommsPreference): Promise<CrewCommsPreference> {
    const [created] = await db.insert(crewCommsPreferences).values(pref).returning();
    return created;
  }

  async updateCrewCommsPreference(userId: number, updates: Partial<InsertCrewCommsPreference>): Promise<CrewCommsPreference> {
    const [updated] = await db
      .update(crewCommsPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crewCommsPreferences.userId, userId))
      .returning();
    return updated;
  }

  // Crew Comms - Threads
  async getCommsThreads(businessId: number, limit: number = 50): Promise<CommsThread[]> {
    return db
      .select()
      .from(commsThreads)
      .where(eq(commsThreads.businessId, businessId))
      .orderBy(desc(commsThreads.lastMessageAt))
      .limit(limit);
  }

  async getCommsThread(id: number): Promise<CommsThread | undefined> {
    const [thread] = await db
      .select()
      .from(commsThreads)
      .where(eq(commsThreads.id, id))
      .limit(1);
    return thread;
  }

  async getCommsThreadByPhone(phoneE164: string): Promise<CommsThread | undefined> {
    const [thread] = await db
      .select()
      .from(commsThreads)
      .where(eq(commsThreads.participantPhoneE164, phoneE164))
      .limit(1);
    return thread;
  }

  async getCommsThreadByUser(userId: number): Promise<CommsThread | undefined> {
    const [thread] = await db
      .select()
      .from(commsThreads)
      .where(eq(commsThreads.participantUserId, userId))
      .limit(1);
    return thread;
  }

  async createCommsThread(thread: InsertCommsThread): Promise<CommsThread> {
    const [created] = await db.insert(commsThreads).values(thread).returning();
    return created;
  }

  async updateCommsThread(id: number, updates: Partial<InsertCommsThread>): Promise<CommsThread> {
    const [updated] = await db
      .update(commsThreads)
      .set(updates)
      .where(eq(commsThreads.id, id))
      .returning();
    return updated;
  }

  // Crew Comms - Messages
  async getCommsMessages(threadId: number, limit: number = 100): Promise<CommsMessage[]> {
    return db
      .select()
      .from(commsMessages)
      .where(eq(commsMessages.threadId, threadId))
      .orderBy(desc(commsMessages.createdAt))
      .limit(limit);
  }

  async getCommsMessage(id: number): Promise<CommsMessage | undefined> {
    const [message] = await db
      .select()
      .from(commsMessages)
      .where(eq(commsMessages.id, id))
      .limit(1);
    return message;
  }

  async createCommsMessage(message: InsertCommsMessage): Promise<CommsMessage> {
    const [created] = await db.insert(commsMessages).values(message).returning();
    return created;
  }

  // Push Subscriptions
  async getPushSubscriptions(userId: number): Promise<PushSubscription[]> {
    return db
      .select()
      .from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.isActive, true)
      ));
  }

  async getPushSubscription(endpoint: string): Promise<PushSubscription | undefined> {
    const [sub] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);
    return sub;
  }

  async createPushSubscription(sub: InsertPushSubscription): Promise<PushSubscription> {
    const [created] = await db
      .insert(pushSubscriptions)
      .values(sub)
      .onConflictDoUpdate({
        target: [pushSubscriptions.endpoint],
        set: {
          keysJson: sub.keysJson,
          userAgent: sub.userAgent,
          isActive: true,
          lastUsedAt: new Date(),
        },
      })
      .returning();
    return created;
  }

  async deletePushSubscription(endpoint: string): Promise<boolean> {
    const result = await db
      .update(pushSubscriptions)
      .set({ isActive: false })
      .where(eq(pushSubscriptions.endpoint, endpoint));
    return true;
  }

  async updatePushSubscriptionLastUsed(endpoint: string): Promise<void> {
    await db
      .update(pushSubscriptions)
      .set({ lastUsedAt: new Date() })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  // =============================================
  // ONBOARDING STORAGE FUNCTIONS (Sprint 1)
  // =============================================
  
  // Onboarding Flow
  async getOnboardingFlow(id: number): Promise<OnboardingFlow | undefined> {
    const [flow] = await db
      .select()
      .from(onboardingFlows)
      .where(eq(onboardingFlows.id, id))
      .limit(1);
    return flow;
  }

  async getOnboardingFlowByVersion(version: string): Promise<OnboardingFlow | undefined> {
    const [flow] = await db
      .select()
      .from(onboardingFlows)
      .where(eq(onboardingFlows.version, version))
      .limit(1);
    return flow;
  }

  async getActiveOnboardingFlow(): Promise<OnboardingFlow | undefined> {
    const [flow] = await db
      .select()
      .from(onboardingFlows)
      .where(eq(onboardingFlows.isActive, true))
      .limit(1);
    return flow;
  }

  async createOnboardingFlow(flow: InsertOnboardingFlow): Promise<OnboardingFlow> {
    const [created] = await db
      .insert(onboardingFlows)
      .values(flow)
      .returning();
    return created;
  }

  async upsertOnboardingFlow(version: string, name: string, definitionJson: any): Promise<OnboardingFlow> {
    const [upserted] = await db
      .insert(onboardingFlows)
      .values({
        version,
        name,
        definitionJson,
        isActive: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [onboardingFlows.version],
        set: {
          name,
          definitionJson,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  // Onboarding Session
  async getOnboardingSession(sessionId: number): Promise<OnboardingSession | undefined> {
    const [session] = await db
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.id, sessionId))
      .limit(1);
    return session;
  }

  async getOnboardingSessionByUser(userId: number): Promise<OnboardingSession | undefined> {
    const [session] = await db
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.userId, userId))
      .orderBy(desc(onboardingSessions.createdAt))
      .limit(1);
    return session;
  }

  async getOnboardingSessionByAccount(accountId: number): Promise<OnboardingSession | undefined> {
    const [session] = await db
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.accountId, accountId))
      .orderBy(desc(onboardingSessions.createdAt))
      .limit(1);
    return session;
  }

  async createOnboardingSession(session: InsertOnboardingSession): Promise<OnboardingSession> {
    const [created] = await db
      .insert(onboardingSessions)
      .values(session)
      .returning();
    return created;
  }

  async updateOnboardingSession(sessionId: number, updates: Partial<OnboardingSession>): Promise<OnboardingSession | undefined> {
    const [updated] = await db
      .update(onboardingSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(onboardingSessions.id, sessionId))
      .returning();
    return updated;
  }

  // Onboarding Answer
  async getOnboardingAnswers(sessionId: number): Promise<OnboardingAnswer[]> {
    return await db
      .select()
      .from(onboardingAnswers)
      .where(eq(onboardingAnswers.sessionId, sessionId))
      .orderBy(asc(onboardingAnswers.createdAt));
  }

  async getOnboardingAnswerByNode(sessionId: number, nodeId: string): Promise<OnboardingAnswer | undefined> {
    const [answer] = await db
      .select()
      .from(onboardingAnswers)
      .where(and(
        eq(onboardingAnswers.sessionId, sessionId),
        eq(onboardingAnswers.nodeId, nodeId)
      ))
      .limit(1);
    return answer;
  }

  async createOnboardingAnswer(answer: InsertOnboardingAnswer): Promise<OnboardingAnswer> {
    const [created] = await db
      .insert(onboardingAnswers)
      .values(answer)
      .returning();
    return created;
  }

  async updateOnboardingAnswer(answerId: number, updates: Partial<OnboardingAnswer>): Promise<OnboardingAnswer | undefined> {
    const [updated] = await db
      .update(onboardingAnswers)
      .set(updates)
      .where(eq(onboardingAnswers.id, answerId))
      .returning();
    return updated;
  }

  async getOnboardingSessionWithAnswers(sessionId: number): Promise<OnboardingSessionWithAnswers | null> {
    const session = await this.getOnboardingSession(sessionId);
    if (!session) return null;
    const answers = await this.getOnboardingAnswers(sessionId);
    return { ...session, answers };
  }

  // Billing - Account Integrations
  async getAccountIntegration(businessId: number, provider: string): Promise<AccountIntegration | undefined> {
    const [integration] = await db
      .select()
      .from(accountIntegrations)
      .where(and(
        eq(accountIntegrations.accountId, businessId),
        eq(accountIntegrations.provider, provider)
      ))
      .limit(1);
    return integration;
  }

  async getAccountIntegrations(businessId: number): Promise<AccountIntegration[]> {
    return db
      .select()
      .from(accountIntegrations)
      .where(eq(accountIntegrations.accountId, businessId))
      .orderBy(desc(accountIntegrations.createdAt));
  }

  async createAccountIntegration(integration: InsertAccountIntegration): Promise<AccountIntegration> {
    const [created] = await db
      .insert(accountIntegrations)
      .values(integration)
      .returning();
    return created;
  }

  async updateAccountIntegration(id: number, updates: Partial<InsertAccountIntegration>): Promise<AccountIntegration> {
    const [updated] = await db
      .update(accountIntegrations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(accountIntegrations.id, id))
      .returning();
    return updated;
  }

  // Billing - Invoices
  async getInvoices(businessId: number, options?: { status?: string; limit?: number }): Promise<Invoice[]> {
    const conditions = [eq(invoices.accountId, businessId)];
    if (options?.status) {
      conditions.push(eq(invoices.status, options.status));
    }
    
    return db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt))
      .limit(options?.limit ?? 100);
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id))
      .limit(1);
    return invoice;
  }

  async getInvoiceByExternalId(externalId: string): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.externalInvoiceId, externalId))
      .limit(1);
    return invoice;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [created] = await db
      .insert(invoices)
      .values(invoice)
      .returning();
    return created;
  }

  async updateInvoice(id: number, updates: Partial<InsertInvoice>): Promise<Invoice> {
    const [updated] = await db
      .update(invoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  // Billing - Invoice Line Items
  async getInvoiceLineItems(invoiceId: number): Promise<InvoiceLineItem[]> {
    return db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(asc(invoiceLineItems.createdAt));
  }

  async createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    const [created] = await db
      .insert(invoiceLineItems)
      .values(item)
      .returning();
    return created;
  }

  // Billing - Payments
  async getPayments(businessId: number, options?: { status?: string; limit?: number }): Promise<Payment[]> {
    const conditions = [eq(payments.accountId, businessId)];
    if (options?.status) {
      conditions.push(eq(payments.status, options.status));
    }
    
    return db
      .select()
      .from(payments)
      .where(and(...conditions))
      .orderBy(desc(payments.createdAt))
      .limit(options?.limit ?? 100);
  }

  async getPayment(id: number): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    return payment;
  }

  async getPaymentsByInvoice(invoiceId: number): Promise<Payment[]> {
    return db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [created] = await db
      .insert(payments)
      .values(payment)
      .returning();
    return created;
  }

  async updatePayment(id: number, updates: Partial<InsertPayment>): Promise<Payment> {
    const [updated] = await db
      .update(payments)
      .set(updates)
      .where(eq(payments.id, id))
      .returning();
    return updated;
  }

  // Billing - Issues
  async getBillingIssues(businessId: number, options?: { status?: string; limit?: number }): Promise<BillingIssue[]> {
    const conditions = [eq(billingIssues.accountId, businessId)];
    if (options?.status) {
      conditions.push(eq(billingIssues.status, options.status));
    }
    
    return db
      .select()
      .from(billingIssues)
      .where(and(...conditions))
      .orderBy(desc(billingIssues.createdAt))
      .limit(options?.limit ?? 100);
  }

  async getBillingIssue(id: number): Promise<BillingIssue | undefined> {
    const [issue] = await db
      .select()
      .from(billingIssues)
      .where(eq(billingIssues.id, id))
      .limit(1);
    return issue;
  }

  async createBillingIssue(issue: InsertBillingIssue): Promise<BillingIssue> {
    const [created] = await db
      .insert(billingIssues)
      .values(issue)
      .returning();
    return created;
  }

  async updateBillingIssue(id: number, updates: Partial<InsertBillingIssue>): Promise<BillingIssue> {
    const [updated] = await db
      .update(billingIssues)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(billingIssues.id, id))
      .returning();
    return updated;
  }

  // Billing - Customers
  async getBillingCustomers(businessId: number): Promise<BillingCustomer[]> {
    return db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.accountId, businessId))
      .orderBy(desc(billingCustomers.createdAt));
  }

  async getBillingCustomer(id: number): Promise<BillingCustomer | undefined> {
    const [customer] = await db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.id, id))
      .limit(1);
    return customer;
  }

  async getBillingCustomerByExternalId(externalId: string): Promise<BillingCustomer | undefined> {
    const [customer] = await db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.externalCustomerId, externalId))
      .limit(1);
    return customer;
  }

  async createBillingCustomer(customer: InsertBillingCustomer): Promise<BillingCustomer> {
    const [created] = await db
      .insert(billingCustomers)
      .values(customer)
      .returning();
    return created;
  }

  async updateBillingCustomer(id: number, updates: Partial<InsertBillingCustomer>): Promise<BillingCustomer> {
    const [updated] = await db
      .update(billingCustomers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(billingCustomers.id, id))
      .returning();
    return updated;
  }

  // Billing - Overview (computed from real data)
  async getBillingOverview(businessId: number): Promise<BillingOverview> {
    // Get integration status
    const integration = await this.getAccountIntegration(businessId, 'QUICKBOOKS');
    
    // Count invoices by status
    const draftInvoices = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(and(
        eq(invoices.accountId, businessId),
        eq(invoices.status, 'DRAFT')
      ));
    
    const overdueInvoices = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(and(
        eq(invoices.accountId, businessId),
        eq(invoices.status, 'OVERDUE')
      ));
    
    // Count pending payments
    const pendingPaymentsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(and(
        eq(payments.accountId, businessId),
        eq(payments.status, 'PENDING')
      ));
    
    // Count open issues
    const openIssues = await db
      .select({ count: sql<number>`count(*)` })
      .from(billingIssues)
      .where(and(
        eq(billingIssues.accountId, businessId),
        eq(billingIssues.status, 'OPEN')
      ));
    
    // Calculate total outstanding (invoice totals minus completed/received payments)
    // Get total of unpaid invoices
    const invoiceTotals = await db
      .select({ total: sql<number>`coalesce(sum(total), 0)` })
      .from(invoices)
      .where(and(
        eq(invoices.accountId, businessId),
        inArray(invoices.status, ['SENT', 'OVERDUE', 'PARTIAL'])
      ));
    
    // Get total of completed payments for those invoices
    const completedPayments = await db
      .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(and(
        eq(payments.accountId, businessId),
        inArray(payments.status, ['COMPLETED', 'RECEIVED']),
        inArray(invoices.status, ['SENT', 'OVERDUE', 'PARTIAL'])
      ));
    
    const totalOutstanding = Number(invoiceTotals[0]?.total ?? 0) - Number(completedPayments[0]?.total ?? 0);

    return {
      lastSyncStatus: integration?.status as any ?? null,
      lastSyncAt: integration?.lastSyncAt ?? null,
      totalOutstanding: Math.max(0, totalOutstanding), // Never negative
      draftInvoices: Number(draftInvoices[0]?.count ?? 0),
      overdueInvoices: Number(overdueInvoices[0]?.count ?? 0),
      pendingPayments: Number(pendingPaymentsCount[0]?.count ?? 0),
      openIssues: Number(openIssues[0]?.count ?? 0),
    };
  }

  // ============================================================================
  // SERVICE CATALOG IMPLEMENTATIONS
  // ============================================================================

  // Services
  async getServices(businessId: number, options?: { category?: string; isActive?: boolean }): Promise<Service[]> {
    let query = db.select().from(services).where(eq(services.accountId, businessId));
    
    if (options?.category) {
      query = query.where(and(eq(services.accountId, businessId), eq(services.category, options.category))) as any;
    }
    if (options?.isActive !== undefined) {
      query = query.where(and(eq(services.accountId, businessId), eq(services.isActive, options.isActive))) as any;
    }
    
    return query.orderBy(asc(services.name));
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async createService(service: InsertService): Promise<Service> {
    const [created] = await db.insert(services).values(service).returning();
    return created;
  }

  async updateService(id: number, updates: Partial<InsertService>): Promise<Service> {
    const [updated] = await db.update(services).set({ ...updates, updatedAt: new Date() }).where(eq(services.id, id)).returning();
    return updated;
  }

  async deleteService(id: number): Promise<boolean> {
    const result = await db.delete(services).where(eq(services.id, id));
    return true;
  }

  // Service Pricing
  async getServicePricing(serviceId: number): Promise<ServicePricingType[]> {
    return db.select().from(servicePricing).where(eq(servicePricing.serviceId, serviceId));
  }

  async createServicePricing(pricing: InsertServicePricing): Promise<ServicePricingType> {
    const [created] = await db.insert(servicePricing).values(pricing).returning();
    return created;
  }

  async updateServicePricing(id: number, updates: Partial<InsertServicePricing>): Promise<ServicePricingType> {
    const [updated] = await db.update(servicePricing).set({ ...updates, updatedAt: new Date() }).where(eq(servicePricing.id, id)).returning();
    return updated;
  }

  async deleteServicePricing(id: number): Promise<boolean> {
    await db.delete(servicePricing).where(eq(servicePricing.id, id));
    return true;
  }

  // Service Frequency Options
  async getServiceFrequencyOptions(serviceId: number): Promise<ServiceFrequencyOption[]> {
    return db.select().from(serviceFrequencyOptions).where(eq(serviceFrequencyOptions.serviceId, serviceId));
  }

  async createServiceFrequencyOption(option: InsertServiceFrequencyOption): Promise<ServiceFrequencyOption> {
    const [created] = await db.insert(serviceFrequencyOptions).values(option).returning();
    return created;
  }

  async updateServiceFrequencyOption(id: number, updates: Partial<InsertServiceFrequencyOption>): Promise<ServiceFrequencyOption> {
    const [updated] = await db.update(serviceFrequencyOptions).set({ ...updates, updatedAt: new Date() }).where(eq(serviceFrequencyOptions.id, id)).returning();
    return updated;
  }

  async deleteServiceFrequencyOption(id: number): Promise<boolean> {
    await db.delete(serviceFrequencyOptions).where(eq(serviceFrequencyOptions.id, id));
    return true;
  }

  // Promotion Rules
  async getPromotionRules(businessId: number, options?: { isActive?: boolean }): Promise<PromotionRule[]> {
    let conditions = [eq(promotionRules.accountId, businessId)];
    if (options?.isActive !== undefined) {
      conditions.push(eq(promotionRules.isActive, options.isActive));
    }
    return db.select().from(promotionRules).where(and(...conditions)).orderBy(desc(promotionRules.createdAt));
  }

  async getPromotionRule(id: number): Promise<PromotionRule | undefined> {
    const [rule] = await db.select().from(promotionRules).where(eq(promotionRules.id, id));
    return rule;
  }

  async createPromotionRule(rule: InsertPromotionRule): Promise<PromotionRule> {
    const [created] = await db.insert(promotionRules).values(rule).returning();
    return created;
  }

  async updatePromotionRule(id: number, updates: Partial<InsertPromotionRule>): Promise<PromotionRule> {
    const [updated] = await db.update(promotionRules).set({ ...updates, updatedAt: new Date() }).where(eq(promotionRules.id, id)).returning();
    return updated;
  }

  async deletePromotionRule(id: number): Promise<boolean> {
    await db.delete(promotionRules).where(eq(promotionRules.id, id));
    return true;
  }

  // Snow Service Policies
  async getSnowServicePolicy(serviceId: number): Promise<SnowServicePolicy | undefined> {
    const [policy] = await db.select().from(snowServicePolicies).where(eq(snowServicePolicies.serviceId, serviceId));
    return policy;
  }

  async createSnowServicePolicy(policy: InsertSnowServicePolicy): Promise<SnowServicePolicy> {
    const [created] = await db.insert(snowServicePolicies).values(policy).returning();
    return created;
  }

  async updateSnowServicePolicy(id: number, updates: Partial<InsertSnowServicePolicy>): Promise<SnowServicePolicy> {
    const [updated] = await db.update(snowServicePolicies).set({ ...updates, updatedAt: new Date() }).where(eq(snowServicePolicies.id, id)).returning();
    return updated;
  }

  async deleteSnowServicePolicy(id: number): Promise<boolean> {
    await db.delete(snowServicePolicies).where(eq(snowServicePolicies.id, id));
    return true;
  }

  // Mulch Profiles
  async getMulchProfiles(businessId: number, customerId?: number): Promise<MulchProfile[]> {
    let conditions = [eq(mulchProfiles.accountId, businessId)];
    if (customerId !== undefined) {
      conditions.push(eq(mulchProfiles.customerId, customerId));
    }
    return db.select().from(mulchProfiles).where(and(...conditions));
  }

  async getMulchProfile(id: number): Promise<MulchProfile | undefined> {
    const [profile] = await db.select().from(mulchProfiles).where(eq(mulchProfiles.id, id));
    return profile;
  }

  async createMulchProfile(profile: InsertMulchProfile): Promise<MulchProfile> {
    const [created] = await db.insert(mulchProfiles).values(profile).returning();
    return created;
  }

  async updateMulchProfile(id: number, updates: Partial<InsertMulchProfile>): Promise<MulchProfile> {
    const [updated] = await db.update(mulchProfiles).set({ ...updates, updatedAt: new Date() }).where(eq(mulchProfiles.id, id)).returning();
    return updated;
  }

  // Firewood Profiles
  async getFirewoodProfiles(businessId: number, customerId?: number): Promise<FirewoodProfile[]> {
    let conditions = [eq(firewoodProfiles.accountId, businessId)];
    if (customerId !== undefined) {
      conditions.push(eq(firewoodProfiles.customerId, customerId));
    }
    return db.select().from(firewoodProfiles).where(and(...conditions));
  }

  async getFirewoodProfile(id: number): Promise<FirewoodProfile | undefined> {
    const [profile] = await db.select().from(firewoodProfiles).where(eq(firewoodProfiles.id, id));
    return profile;
  }

  async createFirewoodProfile(profile: InsertFirewoodProfile): Promise<FirewoodProfile> {
    const [created] = await db.insert(firewoodProfiles).values(profile).returning();
    return created;
  }

  async updateFirewoodProfile(id: number, updates: Partial<InsertFirewoodProfile>): Promise<FirewoodProfile> {
    const [updated] = await db.update(firewoodProfiles).set({ ...updates, updatedAt: new Date() }).where(eq(firewoodProfiles.id, id)).returning();
    return updated;
  }

  // Customer Service Preferences
  async getCustomerServicePreferences(accountId: number, customerId: number): Promise<CustomerServicePreference[]> {
    return db.select().from(customerServicePreferences)
      .where(and(
        eq(customerServicePreferences.accountId, accountId),
        eq(customerServicePreferences.customerId, customerId)
      ));
  }

  async getCustomerServicePreference(id: number): Promise<CustomerServicePreference | undefined> {
    const [pref] = await db.select().from(customerServicePreferences).where(eq(customerServicePreferences.id, id));
    return pref;
  }

  async getCustomerServicePreferenceByService(accountId: number, customerId: number, serviceId: number): Promise<CustomerServicePreference | undefined> {
    const [pref] = await db.select().from(customerServicePreferences)
      .where(and(
        eq(customerServicePreferences.accountId, accountId),
        eq(customerServicePreferences.customerId, customerId),
        eq(customerServicePreferences.serviceId, serviceId)
      ));
    return pref;
  }

  async createCustomerServicePreference(pref: InsertCustomerServicePreference): Promise<CustomerServicePreference> {
    const [created] = await db.insert(customerServicePreferences).values(pref).returning();
    return created;
  }

  async updateCustomerServicePreference(id: number, updates: Partial<InsertCustomerServicePreference>): Promise<CustomerServicePreference> {
    const [updated] = await db.update(customerServicePreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customerServicePreferences.id, id))
      .returning();
    return updated;
  }

  async deleteCustomerServicePreference(id: number): Promise<boolean> {
    const result = await db.delete(customerServicePreferences).where(eq(customerServicePreferences.id, id));
    return true;
  }

  async upsertCustomerServicePreference(pref: InsertCustomerServicePreference): Promise<CustomerServicePreference> {
    const existing = pref.serviceId 
      ? await this.getCustomerServicePreferenceByService(pref.accountId, pref.customerId, pref.serviceId)
      : undefined;
    
    if (existing) {
      return this.updateCustomerServicePreference(existing.id, {
        ...pref,
        learnedFromInteractions: (existing.learnedFromInteractions || 0) + 1,
      });
    }
    return this.createCustomerServicePreference(pref);
  }

  // Message Templates (Phase 2 Settings)
  async getMessageTemplates(accountId: number, options?: { type?: string; category?: string; isActive?: boolean }): Promise<MessageTemplate[]> {
    let query = db.select().from(messageTemplates).where(eq(messageTemplates.accountId, accountId));
    
    if (options?.type) {
      query = query.where(and(
        eq(messageTemplates.accountId, accountId),
        eq(messageTemplates.type, options.type)
      )) as typeof query;
    }
    if (options?.category) {
      query = query.where(and(
        eq(messageTemplates.accountId, accountId),
        eq(messageTemplates.category, options.category)
      )) as typeof query;
    }
    if (options?.isActive !== undefined) {
      query = query.where(and(
        eq(messageTemplates.accountId, accountId),
        eq(messageTemplates.isActive, options.isActive)
      )) as typeof query;
    }
    
    return query.orderBy(asc(messageTemplates.type), asc(messageTemplates.name));
  }

  async getMessageTemplate(id: number): Promise<MessageTemplate | undefined> {
    const [template] = await db.select().from(messageTemplates).where(eq(messageTemplates.id, id));
    return template;
  }

  async createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate> {
    const [created] = await db.insert(messageTemplates).values(template).returning();
    return created;
  }

  async updateMessageTemplate(id: number, updates: Partial<InsertMessageTemplate>): Promise<MessageTemplate> {
    const [updated] = await db.update(messageTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(messageTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteMessageTemplate(id: number): Promise<boolean> {
    const [template] = await db.select().from(messageTemplates).where(eq(messageTemplates.id, id));
    if (template?.isSystem) {
      throw new Error("Cannot delete system templates");
    }
    await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
    return true;
  }

  // Billing Configuration (Phase 2 Settings)
  async getBillingConfig(accountId: number): Promise<BillingConfig | undefined> {
    const [config] = await db.select().from(billingConfigs).where(eq(billingConfigs.accountId, accountId));
    return config;
  }

  async createBillingConfig(config: InsertBillingConfig): Promise<BillingConfig> {
    const [created] = await db.insert(billingConfigs).values(config).returning();
    return created;
  }

  async updateBillingConfig(id: number, updates: Partial<InsertBillingConfig>): Promise<BillingConfig> {
    const [updated] = await db.update(billingConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(billingConfigs.id, id))
      .returning();
    return updated;
  }

  async upsertBillingConfig(accountId: number, config: Partial<InsertBillingConfig>): Promise<BillingConfig> {
    const existing = await this.getBillingConfig(accountId);
    if (existing) {
      return this.updateBillingConfig(existing.id, config);
    }
    return this.createBillingConfig({ accountId, ...config } as InsertBillingConfig);
  }
}

export const storage = new DatabaseStorage();
