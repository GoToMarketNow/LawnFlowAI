import { db } from "../db";
import { 
  crews, crewMembers, jobs, leads, invoices, 
  opsCommsThreads, billingIssues, payments
} from "../../shared/schema";
import { sql, eq } from "drizzle-orm";
import { loadAllSeedData, createIdMaps, type SeedData, type IdMaps } from "./loader";

const ACCOUNT_ID = 1;
const BUSINESS_ID = 1;

async function seedCrews(data: SeedData, maps: IdMaps): Promise<void> {
  console.log("Seeding crews...");
  
  for (const crew of data.crews) {
    const [inserted] = await db.insert(crews).values({
      businessId: BUSINESS_ID,
      name: crew.name,
      status: crew.status,
      homeBaseLat: crew.homeBase.lat,
      homeBaseLng: crew.homeBase.lng,
      homeBaseAddress: crew.homeBase.label,
      serviceRadiusMiles: 20,
      dailyCapacityMinutes: 420,
      maxJobsPerDay: 8,
    }).onConflictDoNothing().returning();
    
    if (inserted) {
      maps.crews.set(crew.id, inserted.id);
    } else {
      const existing = await db.select().from(crews)
        .where(sql`name = ${crew.name} AND business_id = ${BUSINESS_ID}`);
      if (existing[0]) {
        maps.crews.set(crew.id, existing[0].id);
      }
    }
  }
  
  console.log("Seeding crew members...");
  for (const crew of data.crews) {
    const crewId = maps.crews.get(crew.id);
    if (!crewId) continue;
    
    const leader = data.users.find(u => u.id === crew.leaderUserId);
    if (leader) {
      await db.insert(crewMembers).values({
        crewId,
        displayName: leader.name,
        role: "LEADER",
        isActive: true,
      }).onConflictDoNothing();
    }
    
    for (const memberId of crew.memberUserIds || []) {
      const member = data.users.find(u => u.id === memberId);
      if (member) {
        await db.insert(crewMembers).values({
          crewId,
          displayName: member.name,
          role: "MEMBER",
          isActive: true,
        }).onConflictDoNothing();
      }
    }
  }
  
  console.log(`Seeded ${data.crews.length} crews`);
}

async function seedLeads(data: SeedData, maps: IdMaps): Promise<void> {
  console.log("Seeding leads...");
  
  for (const lead of data.leads) {
    const [inserted] = await db.insert(leads).values({
      externalId: lead.id,
      name: lead.name,
      phone: lead.phoneE164,
      address: lead.addressText,
      serviceRequested: (lead.requestedServices || []).join(", ") || "general inquiry",
      notes: `Source: ${lead.source}`,
      status: lead.status.toLowerCase(),
    }).onConflictDoNothing().returning();
    
    if (inserted) {
      maps.leads.set(lead.id, inserted.id);
    } else {
      const existing = await db.select().from(leads)
        .where(eq(leads.externalId, lead.id));
      if (existing[0]) {
        maps.leads.set(lead.id, existing[0].id);
      }
    }
  }
  
  console.log(`Seeded ${data.leads.length} leads`);
}

async function seedJobs(data: SeedData, maps: IdMaps): Promise<void> {
  console.log("Seeding jobs...");
  
  for (const job of data.jobs) {
    const address = job.address 
      ? `${job.address.line1}, ${job.address.city}, ${job.address.state} ${job.address.zip}`
      : null;
    
    const [inserted] = await db.insert(jobs).values({
      customerName: job.title.split(" - ")[1] || job.title,
      customerPhone: "+14345550000",
      customerAddress: address,
      serviceType: (job.serviceCodes || []).join(", ") || "general",
      scheduledDate: job.scheduledStartAt ? new Date(job.scheduledStartAt) : null,
      status: job.status.toLowerCase(),
      notes: job.notes,
    }).onConflictDoNothing().returning();
    
    if (inserted) {
      maps.jobs.set(job.id, inserted.id);
    }
  }
  
  console.log(`Seeded ${data.jobs.length} jobs`);
}

async function seedInvoices(data: SeedData, maps: IdMaps): Promise<void> {
  console.log("Seeding invoices...");
  
  for (const inv of data.invoices) {
    const jobId = inv.jobId ? maps.jobs.get(inv.jobId) : null;
    
    const [inserted] = await db.insert(invoices).values({
      accountId: ACCOUNT_ID,
      invoiceNumber: inv.id,
      jobId: jobId || undefined,
      status: inv.status,
      currency: inv.currency,
      subtotal: Math.round(inv.subtotal * 100),
      tax: Math.round(inv.tax * 100),
      total: Math.round(inv.total * 100),
      dueDate: inv.dueDate ? new Date(inv.dueDate) : undefined,
      sentAt: inv.sentAt ? new Date(inv.sentAt) : undefined,
      paidAt: inv.paidAt ? new Date(inv.paidAt) : undefined,
      externalProvider: inv.externalProvider,
      externalInvoiceId: inv.externalInvoiceId,
      lastSyncedAt: inv.lastSyncedAt ? new Date(inv.lastSyncedAt) : undefined,
    }).onConflictDoNothing().returning();
    
    if (inserted) {
      maps.invoices.set(inv.id, inserted.id);
    } else {
      const existing = await db.select().from(invoices)
        .where(eq(invoices.invoiceNumber, inv.id));
      if (existing[0]) {
        maps.invoices.set(inv.id, existing[0].id);
      }
    }
  }
  
  console.log(`Seeded ${data.invoices.length} invoices`);
}

async function seedPayments(data: SeedData, maps: IdMaps): Promise<void> {
  console.log("Seeding payments...");
  
  for (const pmt of data.payments) {
    const invoiceId = maps.invoices.get(pmt.invoiceId);
    if (!invoiceId) continue;
    
    await db.insert(payments).values({
      accountId: ACCOUNT_ID,
      invoiceId,
      amount: Math.round(pmt.amount * 100),
      method: pmt.method,
      status: pmt.status,
      occurredAt: new Date(pmt.occurredAt),
      externalPaymentId: pmt.externalPaymentId || pmt.id,
    }).onConflictDoNothing();
  }
  
  console.log(`Seeded ${data.payments.length} payments`);
}

async function seedBillingIssues(data: SeedData, maps: IdMaps): Promise<void> {
  console.log("Seeding billing issues...");
  
  for (const issue of data.billingIssues) {
    const invoiceId = issue.relatedInvoiceId ? maps.invoices.get(issue.relatedInvoiceId) : null;
    
    await db.insert(billingIssues).values({
      accountId: ACCOUNT_ID,
      type: issue.type,
      severity: issue.severity,
      status: issue.status,
      relatedInvoiceId: invoiceId || undefined,
      summary: issue.summary,
      detailsJson: issue.detailsJson,
    }).onConflictDoNothing();
  }
  
  console.log(`Seeded ${data.billingIssues.length} billing issues`);
}

async function seedCommsThreads(data: SeedData, maps: IdMaps): Promise<void> {
  console.log("Seeding comms threads...");
  
  for (const thread of data.commsThreads) {
    let audienceId: number | null = null;
    if (thread.audienceId) {
      if (thread.audienceType === "LEAD") {
        audienceId = maps.leads.get(thread.audienceId) || null;
      } else if (thread.audienceType === "CREW") {
        audienceId = maps.crews.get(thread.audienceId) || null;
      }
    }
    
    const relatedJobId = thread.relatedJobId ? maps.jobs.get(thread.relatedJobId) : null;
    const relatedInvoiceId = thread.relatedInvoiceId ? maps.invoices.get(thread.relatedInvoiceId) : null;
    const relatedLeadId = thread.relatedLeadId ? maps.leads.get(thread.relatedLeadId) : null;
    
    const [inserted] = await db.insert(opsCommsThreads).values({
      accountId: ACCOUNT_ID,
      audienceType: thread.audienceType,
      audienceId,
      audienceName: thread.audienceName,
      phoneE164: thread.phoneE164,
      email: thread.email,
      primaryChannel: thread.primaryChannel,
      lastMessageAt: new Date(thread.lastMessageAt),
      lastInboundAt: thread.lastInboundAt ? new Date(thread.lastInboundAt) : undefined,
      lastOutboundAt: thread.lastOutboundAt ? new Date(thread.lastOutboundAt) : undefined,
      lastMessageSnippet: thread.lastMessageSnippet,
      messageCount: thread.messageCount,
      urgencyScore: thread.urgencyScore,
      urgencyLevel: thread.urgencyLevel,
      urgencyReason: thread.urgencyReason,
      status: thread.status,
      slaDeadlineAt: thread.slaDeadlineAt ? new Date(thread.slaDeadlineAt) : undefined,
      relatedJobId: relatedJobId || undefined,
      relatedQuoteId: undefined,
      relatedInvoiceId: relatedInvoiceId || undefined,
      relatedLeadId: relatedLeadId || undefined,
      stage: thread.stage,
      sentimentScore: thread.sentimentScore,
      hasNegativeSentiment: thread.hasNegativeSentiment,
      hasPendingApproval: thread.hasPendingApproval,
      pendingApprovalCount: thread.pendingApprovalCount,
      pendingActionCount: thread.pendingActionCount,
      contextJson: thread.contextJson,
    }).onConflictDoNothing().returning();
    
    if (inserted) {
      maps.threads.set(thread.id, inserted.id);
    }
  }
  
  console.log(`Seeded ${data.commsThreads.length} comms threads`);
}

export async function runSeed(): Promise<void> {
  console.log("=== LawnFlow Unified Seed Runner ===");
  console.log("Loading seed data...");
  
  const data = loadAllSeedData();
  const maps = createIdMaps();
  
  console.log(`Loaded: ${data.customers.length} customers, ${data.leads.length} leads, ${data.jobs.length} jobs, ${data.invoices.length} invoices`);
  
  await seedCrews(data, maps);
  await seedLeads(data, maps);
  await seedJobs(data, maps);
  await seedInvoices(data, maps);
  await seedPayments(data, maps);
  await seedBillingIssues(data, maps);
  await seedCommsThreads(data, maps);
  
  console.log("=== Seed complete ===");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
