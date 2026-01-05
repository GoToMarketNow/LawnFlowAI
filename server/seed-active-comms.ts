import { db } from "./db";
import { opsCommsThreads, opsCommsActionItems } from "@shared/schema";
import { sql } from "drizzle-orm";

async function seedActiveComms() {
  console.log("Seeding Active Comms triage data...");

  await db.delete(opsCommsActionItems);
  await db.delete(opsCommsThreads);

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);

  const threads = await db.insert(opsCommsThreads).values([
    {
      accountId: 1,
      audienceType: "LEAD",
      audienceId: 101,
      audienceName: "Michael Chen",
      phoneE164: "+15552345678",
      email: "mchen@email.com",
      primaryChannel: "SMS",
      status: "NEEDS_RESPONSE",
      urgencyScore: 85,
      urgencyLevel: "CRITICAL",
      urgencyReason: "SLA breach imminent; Hot lead with pending quote",
      lastMessageAt: hoursAgo(0.5),
      lastInboundAt: hoursAgo(0.5),
      lastOutboundAt: hoursAgo(2),
      lastMessageSnippet: "I need the quote ASAP, my HOA meeting is tomorrow!",
      messageCount: 5,
      slaDeadlineAt: hoursFromNow(0.25),
      relatedQuoteId: 501,
      relatedLeadId: 101,
      stage: "quote",
      sentimentScore: -60,
      hasNegativeSentiment: true,
      hasPendingApproval: false,
      pendingActionCount: 2,
      contextJson: { quoteAmount: 450, urgentHOA: true },
    },
    {
      accountId: 1,
      audienceType: "CUSTOMER",
      audienceId: 205,
      audienceName: "Sarah Williams",
      phoneE164: "+15553456789",
      email: "swilliams@home.com",
      primaryChannel: "SMS",
      status: "NEEDS_RESPONSE",
      urgencyScore: 65,
      urgencyLevel: "HIGH",
      urgencyReason: "Negative sentiment detected; Job scheduled - time-sensitive",
      lastMessageAt: hoursAgo(2),
      lastInboundAt: hoursAgo(2),
      lastOutboundAt: hoursAgo(24),
      lastMessageSnippet: "The crew didn't edge along the driveway like I asked",
      messageCount: 12,
      slaDeadlineAt: hoursFromNow(2),
      relatedJobId: 302,
      stage: "billing",
      sentimentScore: -45,
      hasNegativeSentiment: true,
      hasPendingApproval: false,
      pendingActionCount: 2,
      contextJson: { serviceName: "Weekly Mowing", issueType: "missed_edging" },
    },
    {
      accountId: 1,
      audienceType: "LEAD",
      audienceId: 103,
      audienceName: "James Rodriguez",
      phoneE164: "+15554567890",
      primaryChannel: "SMS",
      status: "WAITING_ON_CUSTOMER",
      urgencyScore: 45,
      urgencyLevel: "MEDIUM",
      urgencyReason: "Hot lead with pending quote; Waiting over 4 hours",
      lastMessageAt: hoursAgo(5),
      lastInboundAt: hoursAgo(5),
      lastOutboundAt: hoursAgo(6),
      lastMessageSnippet: "Thanks for the quote, I'm reviewing it now",
      messageCount: 4,
      slaDeadlineAt: hoursFromNow(19),
      relatedQuoteId: 505,
      relatedLeadId: 103,
      stage: "quote",
      sentimentScore: 10,
      hasNegativeSentiment: false,
      hasPendingApproval: false,
      pendingActionCount: 1,
      contextJson: { quoteAmount: 1200 },
    },
    {
      accountId: 1,
      audienceType: "CUSTOMER",
      audienceId: 210,
      audienceName: "Emily Thompson",
      phoneE164: "+15555678901",
      email: "ethompson@company.com",
      primaryChannel: "EMAIL",
      status: "NEEDS_RESPONSE",
      urgencyScore: 30,
      urgencyLevel: "MEDIUM",
      urgencyReason: "Awaiting reply",
      lastMessageAt: hoursAgo(1),
      lastInboundAt: hoursAgo(1),
      lastOutboundAt: hoursAgo(48),
      lastMessageSnippet: "Can you schedule the spring cleanup for next week?",
      messageCount: 3,
      slaDeadlineAt: hoursFromNow(23),
      stage: "schedule",
      sentimentScore: 25,
      hasNegativeSentiment: false,
      hasPendingApproval: false,
      pendingActionCount: 1,
      contextJson: { serviceName: "Spring Cleanup", customerId: 210 },
    },
    {
      accountId: 1,
      audienceType: "CREW",
      audienceId: 50,
      audienceName: "Crew Alpha (Carlos M.)",
      phoneE164: "+15556789012",
      primaryChannel: "SMS",
      status: "NEEDS_RESPONSE",
      urgencyScore: 55,
      urgencyLevel: "HIGH",
      urgencyReason: "Job scheduled - time-sensitive; Awaiting reply",
      lastMessageAt: hoursAgo(0.25),
      lastInboundAt: hoursAgo(0.25),
      lastOutboundAt: hoursAgo(0.5),
      lastMessageSnippet: "Customer not home, gate is locked. Please advise.",
      messageCount: 8,
      slaDeadlineAt: hoursFromNow(0.5),
      relatedJobId: 310,
      stage: "schedule",
      sentimentScore: -20,
      hasNegativeSentiment: false,
      hasPendingApproval: true,
      pendingApprovalCount: 1,
      pendingActionCount: 2,
      contextJson: { customerId: 215, address: "123 Oak Lane", issue: "gate_locked" },
    },
    {
      accountId: 1,
      audienceType: "CUSTOMER",
      audienceId: 220,
      audienceName: "Robert Johnson",
      phoneE164: "+15557890123",
      primaryChannel: "SMS",
      status: "RESOLVED",
      urgencyScore: 10,
      urgencyLevel: "LOW",
      urgencyReason: "Normal priority",
      lastMessageAt: hoursAgo(24),
      lastInboundAt: hoursAgo(24),
      lastOutboundAt: hoursAgo(25),
      lastMessageSnippet: "Great work today, thank you!",
      messageCount: 20,
      relatedJobId: 295,
      stage: "billing",
      sentimentScore: 70,
      hasNegativeSentiment: false,
      hasPendingApproval: false,
      pendingActionCount: 0,
      contextJson: { serviceName: "Lawn Care" },
    },
  ]).returning();

  console.log(`Created ${threads.length} ops comms threads`);

  const threadByName: Record<string, typeof threads[0]> = {};
  for (const t of threads) {
    if (t.audienceName) {
      threadByName[t.audienceName] = t;
    }
  }

  const actionItems = await db.insert(opsCommsActionItems).values([
    {
      accountId: 1,
      threadId: threadByName["Michael Chen"].id,
      type: "SEND_QUOTE",
      state: "OPEN",
      title: "Send finalized quote",
      description: "Customer urgently needs quote for HOA meeting tomorrow",
      priority: 100,
      payloadJson: { quoteId: 501, amount: 450, expiresIn: "2 hours" },
    },
    {
      accountId: 1,
      threadId: threadByName["Michael Chen"].id,
      type: "REPLY_NEEDED",
      state: "OPEN",
      title: "Acknowledge urgency and confirm timeline",
      description: "Respond to frustrated lead about quote timing",
      priority: 90,
      payloadJson: { suggestedReply: "Hi Michael, I'm finalizing your quote now and will send it within the hour!" },
    },
    {
      accountId: 1,
      threadId: threadByName["Sarah Williams"].id,
      type: "SCHEDULE_REDO",
      state: "OPEN",
      title: "Schedule follow-up visit",
      description: "Edging was missed - schedule redo visit at no charge",
      priority: 85,
      payloadJson: { jobId: 302, issueType: "missed_edging", suggestedDate: "tomorrow" },
    },
    {
      accountId: 1,
      threadId: threadByName["Sarah Williams"].id,
      type: "REPLY_NEEDED",
      state: "OPEN",
      title: "Apologize and offer resolution",
      description: "Customer frustrated about missed edging",
      priority: 80,
      payloadJson: { suggestedReply: "So sorry about the missed edging, Sarah. I'm scheduling a free follow-up visit right away." },
    },
    {
      accountId: 1,
      threadId: threadByName["James Rodriguez"].id,
      type: "FOLLOW_UP",
      state: "OPEN",
      title: "Send follow-up message",
      description: "Lead is reviewing quote - check in after 24hrs if no response",
      priority: 50,
      dueAt: hoursFromNow(19),
      payloadJson: { quoteId: 505, daysSinceQuote: 1 },
    },
    {
      accountId: 1,
      threadId: threadByName["Emily Thompson"].id,
      type: "SCHEDULE_VISIT",
      state: "OPEN",
      title: "Schedule spring cleanup",
      description: "Customer requested spring cleanup for next week",
      priority: 55,
      payloadJson: { serviceName: "Spring Cleanup", preferredWeek: "next week" },
    },
    {
      accountId: 1,
      threadId: threadByName["Crew Alpha (Carlos M.)"].id,
      type: "CREW_DISPATCH",
      state: "OPEN",
      title: "Provide gate access instructions",
      description: "Crew is waiting at locked gate - customer not home",
      priority: 95,
      payloadJson: { jobId: 310, address: "123 Oak Lane", issue: "gate_locked" },
    },
    {
      accountId: 1,
      threadId: threadByName["Crew Alpha (Carlos M.)"].id,
      type: "CONTACT_CUSTOMER",
      state: "OPEN",
      title: "Call customer for gate code",
      description: "Try to reach customer for gate access",
      priority: 92,
      payloadJson: { customerId: 215, phone: "+1 (555) 999-0000" },
    },
  ]).returning();

  console.log(`Created ${actionItems.length} ops comms action items`);

  console.log("\nActive Comms seed complete!");
  console.log("Sample threads by urgency:");
  for (const t of threads.sort((a, b) => b.urgencyScore - a.urgencyScore)) {
    console.log(`  [${t.urgencyLevel}] ${t.audienceName}: ${t.urgencyScore} - ${t.urgencyReason}`);
  }
}

seedActiveComms()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
