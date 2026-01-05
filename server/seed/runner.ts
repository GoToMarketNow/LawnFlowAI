import { db } from "../db";
import { 
  crews, crewMembers, jobs, leads, invoices, 
  opsCommsThreads, billingIssues, payments, customerProfiles, quoteProposals
} from "../../shared/schema";
import { sql, eq } from "drizzle-orm";
import { 
  loadAllSeedData, loadSupplementalData, createIdMaps, 
  type SeedData, type IdMaps, type SupplementalData 
} from "./loader";

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

async function seedSupplementalLeads(supp: SupplementalData, maps: IdMaps): Promise<void> {
  if (supp.leads.length === 0) return;
  console.log("Seeding supplemental leads...");
  
  let seeded = 0;
  for (const lead of supp.leads) {
    if (lead.accountId !== `acct_${ACCOUNT_ID}` && lead.accountId !== "acct_1") {
      console.warn(`Skipping lead ${lead.id} - mismatched account ${lead.accountId}`);
      continue;
    }
    
    const [inserted] = await db.insert(leads).values({
      externalId: lead.id,
      name: lead.name,
      phone: lead.phoneE164,
      address: lead.addressText || null,
      serviceRequested: (lead.requestedServices || []).join(", ") || "general inquiry",
      notes: `Source: ${lead.source}${lead.zip ? `, ZIP: ${lead.zip}` : ""}`,
      status: lead.status.toLowerCase(),
    }).onConflictDoNothing().returning();
    
    if (inserted) {
      maps.leads.set(lead.id, inserted.id);
      seeded++;
    } else {
      const existing = await db.select().from(leads)
        .where(eq(leads.externalId, lead.id));
      if (existing[0]) {
        maps.leads.set(lead.id, existing[0].id);
      }
    }
  }
  
  console.log(`Seeded ${seeded} supplemental leads (${supp.leads.length - seeded} skipped)`);
}

async function seedSupplementalCrews(supp: SupplementalData, maps: IdMaps): Promise<void> {
  if (supp.crews.length === 0) return;
  console.log("Seeding supplemental crews...");
  
  let seeded = 0;
  let reused = 0;
  
  for (const crew of supp.crews) {
    if (crew.accountId !== `acct_${ACCOUNT_ID}` && crew.accountId !== "acct_1") {
      console.warn(`Skipping crew ${crew.id} - mismatched account ${crew.accountId}`);
      continue;
    }
    
    const existing = await db.select().from(crews)
      .where(sql`name = ${crew.name} AND business_id = ${BUSINESS_ID}`);
    
    if (existing[0]) {
      maps.crews.set(crew.id, existing[0].id);
      reused++;
      continue;
    }
    
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
    }).returning();
    
    if (inserted) {
      maps.crews.set(crew.id, inserted.id);
      seeded++;
    }
  }
  
  console.log("Seeding supplemental crew members...");
  for (const crew of supp.crews) {
    const crewId = maps.crews.get(crew.id);
    if (!crewId) continue;
    
    const existingMembers = await db.select().from(crewMembers)
      .where(eq(crewMembers.crewId, crewId));
    const existingNames = new Set(existingMembers.map(m => m.displayName));
    
    const leader = supp.users.find(u => u.id === crew.leaderUserId);
    if (leader && !existingNames.has(leader.name)) {
      await db.insert(crewMembers).values({
        crewId,
        displayName: leader.name,
        role: "LEADER",
        isActive: true,
      });
    }
    
    for (const memberId of crew.memberUserIds || []) {
      const member = supp.users.find(u => u.id === memberId);
      if (member && !existingNames.has(member.name)) {
        await db.insert(crewMembers).values({
          crewId,
          displayName: member.name,
          role: "MEMBER",
          isActive: true,
        });
      }
    }
  }
  
  console.log(`Seeded ${seeded} supplemental crews (${reused} reused)`);
}

async function seedSupplementalCustomers(supp: SupplementalData, maps: IdMaps): Promise<void> {
  if (supp.customers.length === 0) return;
  console.log("Seeding supplemental customers...");
  
  let seeded = 0;
  
  for (const cust of supp.customers) {
    if (cust.accountId !== `acct_${ACCOUNT_ID}` && cust.accountId !== "acct_1") {
      console.warn(`Skipping customer ${cust.id} - mismatched account ${cust.accountId}`);
      continue;
    }
    
    const [inserted] = await db.insert(customerProfiles).values({
      businessId: BUSINESS_ID,
      accountId: String(ACCOUNT_ID),
      name: cust.name,
      phone: cust.phoneE164,
      email: cust.email || null,
      primaryAddress: cust.addressText,
      totalJobs: 0,
      totalRevenue: 0,
      tagsJson: { tags: cust.tags || [], zip: cust.zip, source: "supplemental" },
    }).onConflictDoNothing().returning();
    
    if (inserted) {
      maps.customers.set(cust.id, inserted.id);
    } else {
      const existing = await db.select().from(customerProfiles)
        .where(sql`business_id = ${BUSINESS_ID} AND phone = ${cust.phoneE164}`);
      if (existing[0]) {
        maps.customers.set(cust.id, existing[0].id);
      }
    }
  }
  
  console.log(`Seeded ${supp.customers.length} supplemental customers`);
}

async function seedSupplementalQuotes(supp: SupplementalData, maps: IdMaps): Promise<void> {
  if (supp.quotes.length === 0) return;
  console.log("Seeding supplemental quotes...");
  
  let seeded = 0;
  let reused = 0;
  
  for (const q of supp.quotes) {
    if (q.accountId !== `acct_${ACCOUNT_ID}` && q.accountId !== "acct_1") {
      console.warn(`Skipping quote ${q.id} - mismatched account ${q.accountId}`);
      continue;
    }
    
    let existing = await db.select().from(quoteProposals)
      .where(sql`property_signals->>'sourceQuoteId' = ${q.id} AND business_id = ${BUSINESS_ID}`);
    
    if (!existing[0] && q.leadId) {
      const mappedLeadId = maps.leads.get(q.leadId);
      if (mappedLeadId) {
        existing = await db.select().from(quoteProposals)
          .where(sql`lead_id = ${mappedLeadId} AND business_id = ${BUSINESS_ID} AND status = ${q.status}`);
      }
    }
    
    if (existing[0]) {
      maps.quotes.set(q.id, existing[0].id);
      reused++;
      continue;
    }
    
    const leadId = q.leadId ? maps.leads.get(q.leadId) : null;
    const customerId = q.customerId ? maps.customers.get(q.customerId) : null;
    
    if (q.customerId && !customerId) {
      console.warn(`Quote ${q.id} references missing customer ${q.customerId} - skipping`);
      continue;
    }
    
    const customerData = customerId 
      ? supp.customers.find(c => c.id === q.customerId) 
      : null;
    
    const priceRange = q.priceRange;
    if (!priceRange) {
      console.warn(`Skipping quote ${q.id} - missing priceRange`);
      continue;
    }
    
    const rangeLow = Math.round(priceRange.low * 100);
    const rangeHigh = Math.round(priceRange.high * 100);
    
    const servicesRequested = (q.services || []).map(s => ({
      serviceType: s,
      frequency: "one-time",
      notes: null,
    }));
    
    const propertySignals = {
      source: "supplemental_seed",
      confidence: q.confidence || 0.8,
      assumptions: q.assumptions || [],
      linkedCustomerId: customerId || undefined,
      sourceQuoteId: q.id,
    };
    
    const [inserted] = await db.insert(quoteProposals).values({
      businessId: BUSINESS_ID,
      leadId: leadId || undefined,
      customerName: customerData?.name || undefined,
      customerPhone: customerData?.phoneE164 || undefined,
      customerAddress: customerData?.addressText || undefined,
      servicesRequested,
      propertySignals,
      rangeLow,
      rangeHigh,
      status: q.status,
      confidenceScore: q.confidence || 0.8,
    }).returning();
    
    if (inserted) {
      maps.quotes.set(q.id, inserted.id);
      seeded++;
    }
  }
  
  console.log(`Seeded ${seeded} supplemental quotes (${reused} reused)`);
}

async function seedSupplementalJobs(supp: SupplementalData, maps: IdMaps): Promise<void> {
  if (supp.jobs.length === 0) return;
  console.log("Seeding supplemental jobs...");
  
  let seeded = 0;
  let reused = 0;
  
  for (const job of supp.jobs) {
    if (job.accountId !== `acct_${ACCOUNT_ID}` && job.accountId !== "acct_1") {
      console.warn(`Skipping job ${job.id} - mismatched account ${job.accountId}`);
      continue;
    }
    
    let existing = await db.select().from(jobs)
      .where(sql`notes LIKE ${'%srcJob:' + job.id + '%'} AND business_id = ${BUSINESS_ID}`);
    
    if (!existing[0] && job.scheduledStart) {
      const schedDate = new Date(job.scheduledStart);
      existing = await db.select().from(jobs)
        .where(sql`business_id = ${BUSINESS_ID} AND service_type = ${job.service} AND scheduled_date = ${schedDate}`);
    }
    
    if (existing[0]) {
      maps.jobs.set(job.id, existing[0].id);
      reused++;
      continue;
    }
    
    const crewId = job.crewId ? maps.crews.get(job.crewId) : null;
    const customerId = job.customerId ? maps.customers.get(job.customerId) : null;
    const quoteId = job.quoteId ? maps.quotes.get(job.quoteId) : null;
    const leadId = job.leadId ? maps.leads.get(job.leadId) : null;
    
    if (job.customerId && !customerId) {
      console.warn(`Job ${job.id} references missing customer ${job.customerId} - skipping`);
      continue;
    }
    
    const customerData = job.customerId 
      ? supp.customers.find(c => c.id === job.customerId) 
      : null;
    
    const address = customerData?.addressText || job.location?.addressText || null;
    
    const linkedInfo: string[] = [];
    if (crewId) linkedInfo.push(`crewId:${crewId}`);
    if (quoteId) linkedInfo.push(`quoteId:${quoteId}`);
    if (leadId) linkedInfo.push(`leadId:${leadId}`);
    if (customerId) linkedInfo.push(`customerId:${customerId}`);
    linkedInfo.push(`srcJob:${job.id}`);
    
    const [inserted] = await db.insert(jobs).values({
      businessId: BUSINESS_ID,
      customerName: customerData?.name || job.service,
      customerPhone: customerData?.phoneE164 || "+14345550000",
      customerAddress: address,
      serviceType: job.service,
      scheduledDate: job.scheduledStart ? new Date(job.scheduledStart) : null,
      status: job.status.toLowerCase(),
      notes: linkedInfo.length > 0 ? `Links: ${linkedInfo.join(", ")}` : "No relationships",
    }).returning();
    
    if (inserted) {
      maps.jobs.set(job.id, inserted.id);
      seeded++;
    }
  }
  
  console.log(`Seeded ${seeded} supplemental jobs (${reused} reused)`);
}

async function seedSupplementalInvoices(supp: SupplementalData, maps: IdMaps): Promise<void> {
  if (supp.invoices.length === 0) return;
  console.log("Seeding supplemental invoices...");
  
  let seeded = 0;
  let reused = 0;
  
  for (const inv of supp.invoices) {
    if (inv.accountId !== `acct_${ACCOUNT_ID}` && inv.accountId !== "acct_1") {
      console.warn(`Skipping invoice ${inv.id} - mismatched account ${inv.accountId}`);
      continue;
    }
    
    const existing = await db.select().from(invoices)
      .where(sql`invoice_number = ${inv.id} AND account_id = ${ACCOUNT_ID}`);
    
    if (existing[0]) {
      maps.invoices.set(inv.id, existing[0].id);
      reused++;
      continue;
    }
    
    const jobId = inv.jobId ? maps.jobs.get(inv.jobId) : null;
    const customerId = inv.customerId ? maps.customers.get(inv.customerId) : null;
    const quoteId = inv.quoteId ? maps.quotes.get(inv.quoteId) : null;
    
    const amount = Math.round(inv.amount * 100);
    
    const [inserted] = await db.insert(invoices).values({
      accountId: ACCOUNT_ID,
      customerId: customerId || undefined,
      invoiceNumber: inv.id,
      jobId: jobId || undefined,
      quoteId: quoteId || undefined,
      status: inv.status,
      currency: inv.currency,
      subtotal: amount,
      tax: 0,
      total: amount,
      dueDate: inv.dueDate ? new Date(inv.dueDate) : undefined,
      sentAt: inv.sentAt ? new Date(inv.sentAt) : undefined,
      paidAt: inv.paidAt ? new Date(inv.paidAt) : undefined,
    }).returning();
    
    if (inserted) {
      maps.invoices.set(inv.id, inserted.id);
      seeded++;
    }
  }
  
  console.log(`Seeded ${seeded} supplemental invoices (${reused} reused)`);
}

export async function runSeed(): Promise<void> {
  console.log("=== LawnFlow Unified Seed Runner ===");
  console.log("Loading seed data...");
  
  const data = loadAllSeedData();
  const supplemental = loadSupplementalData();
  const maps = createIdMaps();
  
  console.log(`Loaded: ${data.customers.length} customers, ${data.leads.length} leads, ${data.jobs.length} jobs, ${data.invoices.length} invoices`);
  
  await seedCrews(data, maps);
  await seedLeads(data, maps);
  await seedJobs(data, maps);
  await seedInvoices(data, maps);
  await seedPayments(data, maps);
  await seedBillingIssues(data, maps);
  await seedCommsThreads(data, maps);
  
  console.log("\n--- Seeding supplemental data ---");
  await seedSupplementalLeads(supplemental, maps);
  await seedSupplementalCrews(supplemental, maps);
  await seedSupplementalCustomers(supplemental, maps);
  await seedSupplementalQuotes(supplemental, maps);
  await seedSupplementalJobs(supplemental, maps);
  await seedSupplementalInvoices(supplemental, maps);
  
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
