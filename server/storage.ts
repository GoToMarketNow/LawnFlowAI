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
}

export const storage = new DatabaseStorage();
