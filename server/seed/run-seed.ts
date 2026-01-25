import { db } from "../db";
import { 
  crews, crewMembers, jobs, leads, invoices, 
  opsCommsThreads, opsCommsActionItems 
} from "../../shared/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const seedDir = path.dirname(import.meta.url.replace("file://", ""));

async function loadJson<T>(relativePath: string): Promise<T> {
  const fullPath = path.join(seedDir, relativePath);
  const content = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(content);
}

async function seed() {
  console.log("Starting seed import...");
  
  const accountId = 1;
  const businessId = 1;
  
  const crewsData = await loadJson<any[]>("crews/crews.json");
  const usersData = await loadJson<any[]>("users/users.json");
  const leadsData = await loadJson<any[]>("leads/leads.json");
  const jobsData = await loadJson<any[]>("jobs/jobs.json");
  const invoicesData = await loadJson<any[]>("invoices/invoices.json");
  const threadsData = await loadJson<any[]>("comms/threads.json");
  const messagesData = await loadJson<any[]>("comms/messages.json");
  
  console.log("Seeding crews...");
  for (const crew of crewsData) {
    await db.insert(crews).values({
      businessId,
      name: crew.name,
      status: crew.status,
      homeBaseLat: crew.homeBase?.lat,
      homeBaseLng: crew.homeBase?.lng,
      homeBaseAddress: crew.homeBase?.label,
      serviceRadiusMiles: 20,
      dailyCapacityMinutes: 420,
      maxJobsPerDay: 8,
    }).onConflictDoNothing();
  }
  console.log(`Inserted ${crewsData.length} crews`);
  
  const insertedCrews = await db.select().from(crews).where(sql`business_id = ${businessId}`);
  const crewMap: Record<string, number> = {};
  for (const seedCrew of crewsData) {
    const dbCrew = insertedCrews.find(c => c.name === seedCrew.name);
    if (dbCrew) {
      crewMap[seedCrew.id] = dbCrew.id;
    }
  }
  
  console.log("Seeding crew members...");
  for (const crew of crewsData) {
    const crewId = crewMap[crew.id];
    if (!crewId) continue;
    
    const leader = usersData.find(u => u.id === crew.leaderUserId);
    if (leader) {
      await db.insert(crewMembers).values({
        crewId,
        displayName: leader.name,
        role: "LEADER",
        isActive: true,
      }).onConflictDoNothing();
    }
    
    for (const memberId of crew.memberUserIds || []) {
      const member = usersData.find(u => u.id === memberId);
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
  console.log("Inserted crew members");
  
  console.log("Seeding leads...");
  for (const lead of leadsData) {
    await db.insert(leads).values({
      externalId: lead.id,
      name: lead.name,
      phone: lead.phoneE164,
      address: lead.addressText,
      serviceRequested: (lead.requestedServices || []).join(", "),
      notes: `Source: ${lead.source}`,
      status: lead.status.toLowerCase(),
    }).onConflictDoNothing();
  }
  console.log(`Inserted ${leadsData.length} leads`);
  
  console.log("Seeding jobs...");
  for (const job of jobsData) {
    const crewId = job.assignedCrewId ? crewMap[job.assignedCrewId] : null;
    await db.insert(jobs).values({
      businessId,
      customerName: job.title.split(" - ")[1] || job.title,
      customerPhone: "+14345550000",
      customerAddress: job.address ? `${job.address.line1}, ${job.address.city}, ${job.address.state} ${job.address.zip}` : null,
      serviceType: (job.serviceCodes || []).join(", "),
      scheduledDate: job.scheduledStartAt ? new Date(job.scheduledStartAt) : null,
      status: job.status.toLowerCase(),
      notes: job.notes,
    }).onConflictDoNothing();
  }
  console.log(`Inserted ${jobsData.length} jobs`);
  
  console.log("Seeding invoices...");
  for (const inv of invoicesData) {
    await db.insert(invoices).values({
      accountId,
      invoiceNumber: inv.id,
      status: inv.status,
      total: Math.round(inv.total * 100),
      subtotal: Math.round(inv.total * 100),
      tax: 0,
      dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
      sentAt: inv.sentAt ? new Date(inv.sentAt) : null,
      paidAt: inv.paidAt ? new Date(inv.paidAt) : null,
    }).onConflictDoNothing();
  }
  console.log(`Inserted ${invoicesData.length} invoices`);
  
  console.log("Seeding ops comms threads...");
  const urgencyMap: Record<string, number> = {
    "HIGH": 75,
    "MED": 50,
    "LOW": 25,
  };
  
  const customersData = await loadJson<any[]>("customers/customers.json").catch(() => []);
  
  for (const thread of threadsData) {
    const threadMessages = messagesData.filter(m => m.threadId === thread.id);
    const lastMsg = threadMessages[threadMessages.length - 1];
    
    let audienceName = "Unknown";
    let phoneE164 = null;
    
    if (thread.audienceType === "LEAD") {
      const lead = leadsData.find(l => l.id === thread.audienceId);
      audienceName = lead?.name || "Unknown Lead";
      phoneE164 = lead?.phoneE164;
    } else if (thread.audienceType === "CREW") {
      const crew = crewsData.find(c => c.id === thread.audienceId);
      audienceName = crew?.name || "Unknown Crew";
    } else if (thread.audienceType === "CUSTOMER") {
      const customer = customersData.find(c => c.id === thread.audienceId);
      audienceName = customer?.name || "Customer";
      phoneE164 = customer?.phoneE164;
    }
    
    await db.insert(opsCommsThreads).values({
      accountId,
      audienceType: thread.audienceType,
      audienceName,
      phoneE164,
      primaryChannel: thread.primaryChannel,
      urgencyScore: urgencyMap[thread.urgencyLevel] || 25,
      urgencyLevel: thread.urgencyLevel === "MED" ? "MEDIUM" : thread.urgencyLevel,
      status: thread.status === "NEEDS_RESPONSE" ? "NEEDS_RESPONSE"
        : thread.status === "APPROVAL_NEEDED" ? "PENDING_APPROVAL"
        : "OPEN",
      lastMessageAt: thread.lastMessageAt ? new Date(thread.lastMessageAt) : new Date(),
      lastMessageSnippet: lastMsg?.body?.substring(0, 100),
      messageCount: threadMessages.length,
      sentimentScore: thread.urgencyLevel === "HIGH" ? -20 : 0,
      hasNegativeSentiment: thread.urgencyLevel === "HIGH",
      slaDeadlineAt: new Date(Date.now() + (thread.urgencyLevel === "HIGH" ? 3600000 : 14400000)),
    }).onConflictDoNothing();
  }
  console.log(`Inserted ${threadsData.length} threads`);
  
  const insertedThreads = await db.select().from(opsCommsThreads).where(sql`account_id = ${accountId}`);
  
  console.log("Seeding action items...");
  for (const thread of insertedThreads) {
    if (thread.status === "PENDING_APPROVAL") {
      await db.insert(opsCommsActionItems).values({
        accountId,
        threadId: thread.id,
        type: "APPROVE_SCOPE_CHANGE",
        title: "Approve scope change request",
        payloadJson: JSON.stringify({ threadId: thread.id, context: "Customer requested additional work" }),
        state: "OPEN",
      }).onConflictDoNothing();
    }
    
    if (thread.status === "NEEDS_RESPONSE") {
      await db.insert(opsCommsActionItems).values({
        accountId,
        threadId: thread.id,
        type: "REPLY_TO_MESSAGE",
        title: "Reply to customer message",
        payloadJson: JSON.stringify({ threadId: thread.id, context: "Awaiting response" }),
        state: "OPEN",
      }).onConflictDoNothing();
    }
  }
  console.log("Inserted action items");
  
  console.log("Seed import complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
