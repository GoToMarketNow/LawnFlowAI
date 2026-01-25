/**
 * Marketing Agent Activities
 * 
 * Core activities for managing prospects, outreach, and approvals
 * 
 * @module server/temporal/activities/marketing
 */

import { Context } from '@temporalio/activity';
import { db } from '../../db';
import { 
  marketingProspects,
  outreachAttempts,
  marketingApprovals,
  socialSignals,
  marketingConsent,
  type MarketingProspect,
  type InsertMarketingProspect,
  type InsertOutreachAttempt,
  type InsertMarketingApproval,
} from '../../../shared/schema-marketing';
import { leads, conversations } from '../../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

// =====================================
// Prospect Management
// =====================================

export async function upsertMarketingProspectActivity(
  data: Partial<InsertMarketingProspect> & { businessId: number }
): Promise<MarketingProspect> {
  // Check if prospect already exists (by phone or email)
  let existingProspect: MarketingProspect | undefined;

  if (data.phone) {
    const results = await db.select().from(marketingProspects).where(
      and(
        eq(marketingProspects.businessId, data.businessId),
        eq(marketingProspects.phone, data.phone)
      )
    ).limit(1);
    existingProspect = results[0];
  }

  if (existingProspect) {
    // Update existing prospect
    const [updated] = await db.update(marketingProspects)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(marketingProspects.id, existingProspect.id))
      .returning();
    
    return updated;
  } else {
    // Create new prospect
    const [created] = await db.insert(marketingProspects)
      .values({
        ...data as InsertMarketingProspect,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    return created;
  }
}

export async function getMarketingProspectActivity(
  prospectId: number
): Promise<MarketingProspect | null> {
  const results = await db.select().from(marketingProspects)
    .where(eq(marketingProspects.id, prospectId))
    .limit(1);
  
  return results[0] || null;
}

export async function updateProspectStatusActivity(data: {
  prospectId: number;
  status?: string;
  stage?: string;
  qualificationStage?: string;
  serviceabilityStatus?: string;
  serviceabilityReasons?: string[];
  missingFields?: string[];
}): Promise<void> {
  await db.update(marketingProspects)
    .set({
      ...(data.status && { status: data.status }),
      ...(data.stage && { stage: data.stage }),
      ...(data.qualificationStage && { qualificationStage: data.qualificationStage }),
      ...(data.serviceabilityStatus && { serviceabilityStatus: data.serviceabilityStatus }),
      ...(data.serviceabilityReasons && { serviceabilityReasons: data.serviceabilityReasons }),
      ...(data.missingFields && { missingFields: data.missingFields }),
      updatedAt: new Date(),
    })
    .where(eq(marketingProspects.id, data.prospectId));
}

export async function updateProspectActivity(data: {
  prospectId: number;
  updates: Partial<MarketingProspect>;
}): Promise<void> {
  await db.update(marketingProspects)
    .set({
      ...data.updates,
      updatedAt: new Date(),
    })
    .where(eq(marketingProspects.id, data.prospectId));
}

// =====================================
// Outreach Management
// =====================================

export async function createOutreachDraftActivity(input: {
  prospectId: number;
  channel: 'sms' | 'email' | 'social';
  template?: string;
  customMessage?: string;
}): Promise<{ message: string; channel: string }> {
  const prospect = await getMarketingProspectActivity(input.prospectId);
  
  if (!prospect) {
    throw new Error(`Prospect ${input.prospectId} not found`);
  }

  // If custom message provided, use it
  if (input.customMessage) {
    return {
      message: input.customMessage,
      channel: input.channel,
    };
  }

  // Generate message based on template
  let message = '';

  if (input.template === 'social_reply') {
    message = `Happy to help! We do ${prospect.requestedServices?.join(', ') || 'lawn care'} in your area. If you share your zip code, I can give you a fast estimate and schedule options.`;
  } else if (input.template === 'referral_outreach') {
    const referrerName = (prospect.sourceContext as any)?.referrerName || 'a neighbor';
    message = `Hi ${prospect.name || 'there'} — ${referrerName} mentioned you might need help with lawn care. Want a quick quote? Reply YES + what you need, or STOP to opt out.`;
  } else {
    // Default generic outreach
    message = `Hi ${prospect.name || 'there'}! I'm with a local lawn care service. We can help with ${prospect.requestedServices?.join(', ') || 'your lawn care needs'}. Interested in a quote?`;
  }

  // If prospect has missing info, append question
  if (prospect.lastQuestionAsked) {
    message += `\n\n${prospect.lastQuestionAsked}`;
  }

  return {
    message,
    channel: input.channel,
  };
}

export async function recordOutreachAttemptActivity(data: {
  prospectId: number;
  businessId: number;
  channel: string;
  messageContent: string;
  status: string;
  externalMessageId?: string;
  costCents?: number;
}): Promise<void> {
  await db.insert(outreachAttempts).values({
    prospectId: data.prospectId,
    businessId: data.businessId,
    channel: data.channel,
    messageContent: data.messageContent,
    status: data.status,
    externalMessageId: data.externalMessageId,
    costCents: data.costCents,
    createdAt: new Date(),
  });

  // Update prospect outreach tracking
  await db.update(marketingProspects)
    .set({
      lastOutreachAt: new Date(),
      outreachAttempts: db.$count(outreachAttempts, eq(outreachAttempts.prospectId, data.prospectId)) + 1,
      updatedAt: new Date(),
    })
    .where(eq(marketingProspects.id, data.prospectId));
}

export async function sendSocialReplyActivity(draft: {
  message: string;
  prospectId: number;
}): Promise<void> {
  // TODO: Implement social platform posting when APIs are available
  // For now, log the action
  console.log(`[Marketing] Would send social reply to prospect ${draft.prospectId}:`, draft.message);
  
  const prospect = await getMarketingProspectActivity(draft.prospectId);
  if (!prospect) return;

  await recordOutreachAttemptActivity({
    prospectId: draft.prospectId,
    businessId: prospect.businessId,
    channel: 'social',
    messageContent: draft.message,
    status: 'sent',
  });
}

// =====================================
// Approval Management
// =====================================

export async function createApprovalTaskActivity(data: {
  prospectId: number;
  businessId: number;
  approvalType: 'outreach' | 'campaign';
  proposedMessage: string;
  proposedChannel: string;
  confidence: number;
  reasoning?: string;
  contextData?: Record<string, any>;
}): Promise<number> {
  const [approval] = await db.insert(marketingApprovals).values({
    prospectId: data.prospectId,
    businessId: data.businessId,
    approvalType: data.approvalType,
    proposedMessage: data.proposedMessage,
    proposedChannel: data.proposedChannel,
    confidence: data.confidence,
    reasoning: data.reasoning,
    contextData: data.contextData,
    status: 'pending',
    createdAt: new Date(),
  }).returning();

  return approval.id;
}

// =====================================
// Decision Logic
// =====================================

export async function decideEngagementActivity(input: {
  prospectId: number;
  confidence: number;
  urgency?: string;
}): Promise<{ action: 'AUTO_REPLY' | 'APPROVAL_REQUIRED' | 'IGNORE' }> {
  // Tiered decision based on confidence
  // High confidence (>0.8): Auto-send
  // Medium confidence (0.5-0.8): Require approval
  // Low confidence (<0.5): Ignore

  if (input.confidence >= 0.8) {
    return { action: 'AUTO_REPLY' };
  } else if (input.confidence >= 0.5) {
    return { action: 'APPROVAL_REQUIRED' };
  } else {
    return { action: 'IGNORE' };
  }
}

// =====================================
// Consent Management
// =====================================

export async function checkConsentActivity(input: {
  businessId: number;
  contactValue: string;
  contactType: 'phone' | 'email';
}): Promise<boolean> {
  const results = await db.select().from(marketingConsent).where(
    and(
      eq(marketingConsent.businessId, input.businessId),
      eq(marketingConsent.contactType, input.contactType),
      eq(marketingConsent.contactValue, input.contactValue)
    )
  ).limit(1);

  const consent = results[0];
  
  // If no record, assume opted in (implicit consent)
  if (!consent) return true;
  
  return consent.optedIn;
}

export async function setOptOutActivity(input: {
  businessId: number;
  contactValue: string;
  contactType: 'phone' | 'email';
  reason?: string;
}): Promise<void> {
  // Upsert consent record
  const existing = await db.select().from(marketingConsent).where(
    and(
      eq(marketingConsent.businessId, input.businessId),
      eq(marketingConsent.contactType, input.contactType),
      eq(marketingConsent.contactValue, input.contactValue)
    )
  ).limit(1);

  if (existing[0]) {
    await db.update(marketingConsent)
      .set({
        optedIn: false,
        optedOutAt: new Date(),
        optedOutReason: input.reason,
        updatedAt: new Date(),
      })
      .where(eq(marketingConsent.id, existing[0].id));
  } else {
    await db.insert(marketingConsent).values({
      businessId: input.businessId,
      contactType: input.contactType,
      contactValue: input.contactValue,
      optedIn: false,
      optedOutAt: new Date(),
      optedOutReason: input.reason,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Also mark prospect as DNC if exists
  if (input.contactType === 'phone') {
    await db.update(marketingProspects)
      .set({
        status: 'do_not_contact',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(marketingProspects.businessId, input.businessId),
          eq(marketingProspects.phone, input.contactValue)
        )
      );
  }
}

// =====================================
// Lead Handoff
// =====================================

export async function handoffToLeadIntakeActivity(payload: {
  prospectId: number;
  channel: string;
  transcript?: Array<{ direction: string; text: string; at: string }>;
  attribution: {
    source: 'social' | 'referral';
    referrerCustomerId?: number;
    platform?: string;
    url?: string;
  };
  requestedServices?: string[];
}): Promise<{ leadId: number; conversationId: number }> {
  const prospect = await getMarketingProspectActivity(payload.prospectId);
  
  if (!prospect) {
    throw new Error(`Prospect ${payload.prospectId} not found`);
  }

  // Create conversation
  const [conversation] = await db.insert(conversations).values({
    businessId: prospect.businessId,
    customerPhone: prospect.phone || '',
    customerName: prospect.name,
    status: 'active',
    channel: payload.channel,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  // Create lead record
  const [lead] = await db.insert(leads).values({
    externalId: `mkt-${prospect.id}`,
    conversationId: conversation.id,
    name: prospect.name,
    phone: prospect.phone || '',
    address: prospect.address,
    serviceRequested: payload.requestedServices?.join(', ') || prospect.requestedServices?.join(', ') || 'General inquiry',
    status: 'new',
    notes: JSON.stringify({
      marketingSource: payload.attribution.source,
      referrer: payload.attribution.referrerCustomerId,
      platform: payload.attribution.platform,
      confidence: prospect.confidence,
      serviceabilityStatus: prospect.serviceabilityStatus,
    }),
    createdAt: new Date(),
  }).returning();

  // Link prospect to lead
  await db.update(marketingProspects)
    .set({
      leadId: lead.id,
      conversationId: conversation.id,
      status: 'handed_off',
      stage: 'engaged',
      updatedAt: new Date(),
    })
    .where(eq(marketingProspects.id, payload.prospectId));

  return {
    leadId: lead.id,
    conversationId: conversation.id,
  };
}

// =====================================
// Polite Decline
// =====================================

export async function sendPoliteDeclineActivity(input: {
  prospectId: number;
  reasons: string[];
}): Promise<void> {
  const prospect = await getMarketingProspectActivity(input.prospectId);
  if (!prospect) return;

  // Generate appropriate decline message based on reason
  let message = 'Thanks for reaching out!';

  if (input.reasons.includes('out_of_area')) {
    message = `Thanks for reaching out! We'd love to help, but we don't currently service your area. I hope you find a great provider nearby!`;
  } else if (input.reasons.includes('service_not_offered')) {
    message = `Thanks for your interest! We don't offer that particular service, but I'd recommend checking with a specialist in that area.`;
  } else if (input.reasons.includes('commercial_not_supported')) {
    message = `Thanks for contacting us! We currently focus on residential properties. I'd recommend reaching out to a commercial landscaping provider for your needs.`;
  }

  // Log the decline (don't actually send if no contact method or opt-out)
  console.log(`[Marketing] Polite decline for prospect ${input.prospectId}:`, message);

  // Record as attempted outreach
  if (prospect.phone) {
    await recordOutreachAttemptActivity({
      prospectId: input.prospectId,
      businessId: prospect.businessId,
      channel: 'sms',
      messageContent: message,
      status: 'declined',
    });
  }
}

// =====================================
// Response Classification
// =====================================

export async function matchConversationToProspectActivity(input: {
  phone?: string;
  email?: string;
  businessId: number;
}): Promise<MarketingProspect | null> {
  if (input.phone) {
    const results = await db.select().from(marketingProspects)
      .where(
        and(
          eq(marketingProspects.businessId, input.businessId),
          eq(marketingProspects.phone, input.phone)
        )
      )
      .orderBy(desc(marketingProspects.updatedAt))
      .limit(1);
    
    return results[0] || null;
  }

  if (input.email) {
    const results = await db.select().from(marketingProspects)
      .where(
        and(
          eq(marketingProspects.businessId, input.businessId),
          eq(marketingProspects.email, input.email)
        )
      )
      .orderBy(desc(marketingProspects.updatedAt))
      .limit(1);
    
    return results[0] || null;
  }

  return null;
}

export interface ClassifyResponseResult {
  intent: 'interested' | 'not_now' | 'stop' | 'wrong_number' | 'needs_callback' | 'answered_question';
  extractedServices?: string[];
  extractedLocation?: string;
}

export async function classifyResponseActivity(
  message: string
): Promise<ClassifyResponseResult> {
  const messageLower = message.toLowerCase();

  // Check for opt-out keywords
  if (/\b(stop|unsubscribe|remove|opt[-\s]?out)\b/.test(messageLower)) {
    return { intent: 'stop' };
  }

  // Check for wrong number
  if (/\b(wrong number|not interested|don'?t contact)\b/.test(messageLower)) {
    return { intent: 'wrong_number' };
  }

  // Check for not now
  if (/\b(not now|maybe later|not right now|busy)\b/.test(messageLower)) {
    return { intent: 'not_now' };
  }

  // Check for callback request
  if (/\b(call me|phone|callback)\b/.test(messageLower)) {
    return { intent: 'needs_callback' };
  }

  // Check for interest indicators
  if (/\b(yes|yeah|sure|interested|tell me more|how much|quote|price)\b/.test(messageLower)) {
    return { intent: 'interested' };
  }

  // Check if they answered a question (contains address/zip or service name)
  const hasZip = /\b\d{5}\b/.test(message);
  const hasAddress = /\b\d+\s+\w+\s+(st|street|ave|avenue|rd|road|dr|drive|ln|lane)\b/i.test(message);
  const hasServiceKeyword = /\b(mow|lawn|landscape|cleanup|mulch|aeration)\b/i.test(messageLower);

  if (hasZip || hasAddress || hasServiceKeyword) {
    return { 
      intent: 'answered_question',
      extractedLocation: hasZip ? message.match(/\b\d{5}\b/)?.[0] : undefined,
    };
  }

  // Default: assume interested
  return { intent: 'interested' };
}
