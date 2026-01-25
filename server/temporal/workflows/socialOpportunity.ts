/**
 * Social Opportunity Workflow
 * 
 * Processes social signals (Nextdoor, Facebook Groups) and decides engagement strategy
 * Includes pre-qualification gate and tiered approval logic
 * 
 * @module server/temporal/workflows/socialOpportunity
 */

import { proxyActivities, setHandler, condition, sleep } from '@temporalio/workflow';
import type * as activities from '../activities';

// Activity configurations
const {
  // Pre-qualification
  extractRequestedServicesActivity,
  inferPropertyTypeActivity,
  resolveLocationActivity,
  checkServiceabilityActivity,
  generateNextQuestionActivity,
  
  // Marketing
  upsertMarketingProspectActivity,
  updateProspectStatusActivity,
  updateProspectActivity,
  decideEngagementActivity,
  createOutreachDraftActivity,
  createApprovalTaskActivity,
  sendSocialReplyActivity,
  recordOutreachAttemptActivity,
  sendPoliteDeclineActivity,
  handoffToLeadIntakeActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    maximumAttempts: 3,
  },
});

// =====================================
// Workflow Input/Output
// =====================================

export interface SocialOpportunityInput {
  signalId: number;
  businessId: number;
  signal: {
    platform: string;
    postId: string;
    text: string;
    authorHandle: string;
    url?: string;
    geoHint?: any;
  };
}

// =====================================
// Workflow Implementation
// =====================================

export async function SocialOpportunityWorkflow(
  input: SocialOpportunityInput
): Promise<void> {
  // STEP 1: Extract information from social signal
  const servicesResult = await extractRequestedServicesActivity({
    text: input.signal.text,
  });

  if (servicesResult.confidence < 0.5) {
    // Low confidence - ignore this signal
    return;
  }

  const propertyTypeResult = await inferPropertyTypeActivity({
    text: input.signal.text,
  });

  // STEP 2: Create or update prospect
  const prospect = await upsertMarketingProspectActivity({
    businessId: input.businessId,
    source: 'social',
    sourceContext: {
      platform: input.signal.platform,
      postId: input.signal.postId,
      url: input.signal.url,
      signalId: input.signalId,
    },
    detectedServices: servicesResult.services,
    requestedServices: servicesResult.services,
    confidence: servicesResult.confidence,
    propertyType: propertyTypeResult.propertyType,
    locationRawInput: input.signal.geoHint?.city || input.signal.geoHint?.zip,
    city: input.signal.geoHint?.city,
    state: input.signal.geoHint?.state,
    zip: input.signal.geoHint?.zip,
    status: 'identified',
    stage: 'identified',
  });

  // STEP 3: RUN PRE-QUALIFICATION GATE
  const locationResult = await resolveLocationActivity({
    rawInput: prospect.locationRawInput,
    zip: prospect.zip,
    city: prospect.city,
    state: prospect.state,
  });

  const serviceabilityResult = await checkServiceabilityActivity({
    businessId: input.businessId,
    location: {
      lat: locationResult.normalized.lat,
      lng: locationResult.normalized.lng,
      zip: locationResult.normalized.zip,
    },
    propertyType: prospect.propertyType || undefined,
    requestedServices: prospect.requestedServices || [],
  });

  // Update prospect with serviceability results
  await updateProspectStatusActivity({
    prospectId: prospect.id,
    serviceabilityStatus: serviceabilityResult.status,
    serviceabilityReasons: serviceabilityResult.reasons,
    qualificationStage: 
      serviceabilityResult.status === 'serviceable' ? 'prequalified' :
      serviceabilityResult.status === 'maybe_serviceable' ? 'needs_info' :
      'disqualified',
  });

  // DECISION POINT: Based on serviceability
  if (serviceabilityResult.status === 'not_serviceable') {
    // Send polite decline and exit
    await sendPoliteDeclineActivity({
      prospectId: prospect.id,
      reasons: serviceabilityResult.reasons,
    });
    return; // EXIT - Do not proceed to engagement
  }

  if (serviceabilityResult.status === 'maybe_serviceable') {
    // Determine what's missing
    const missingFields: string[] = [];
    if (serviceabilityResult.reasons.includes('location_missing')) {
      missingFields.push('location');
    }
    if (prospect.propertyType === 'unknown' && propertyTypeResult.confidence < 0.7) {
      missingFields.push('propertyType');
    }

    await updateProspectActivity({
      prospectId: prospect.id,
      updates: { missingFields },
    });

    // Generate question to ask
    const question = await generateNextQuestionActivity({
      missingFields,
      prospectContext: prospect,
    });

    await updateProspectActivity({
      prospectId: prospect.id,
      updates: {
        lastQuestionAsked: question.message,
        lastQuestionAskedAt: new Date(),
      },
    });
  }

  // STEP 4: Decide engagement strategy (tiered by confidence)
  const engagement = await decideEngagementActivity({
    prospectId: prospect.id,
    confidence: prospect.confidence,
    urgency: prospect.urgency || undefined,
  });

  if (engagement.action === 'IGNORE') {
    return; // Low confidence, do not engage
  }

  // STEP 5: Create outreach draft
  const draft = await createOutreachDraftActivity({
    prospectId: prospect.id,
    channel: 'social',
    template: 'social_reply',
  });

  if (engagement.action === 'AUTO_REPLY') {
    // High confidence (>0.8): Auto-send
    await sendSocialReplyActivity({
      message: draft.message,
      prospectId: prospect.id,
    });

    await updateProspectStatusActivity({
      prospectId: prospect.id,
      status: 'contacted',
      stage: 'identified',
    });

  } else if (engagement.action === 'APPROVAL_REQUIRED') {
    // Medium confidence (0.5-0.8): Require approval
    await createApprovalTaskActivity({
      prospectId: prospect.id,
      businessId: input.businessId,
      approvalType: 'outreach',
      proposedMessage: draft.message,
      proposedChannel: 'social',
      confidence: prospect.confidence,
      reasoning: `Social signal from ${input.signal.platform}. Services: ${prospect.requestedServices?.join(', ')}. Serviceability: ${serviceabilityResult.status}.`,
      contextData: {
        postSnippet: input.signal.text.substring(0, 200),
        platform: input.signal.platform,
        url: input.signal.url,
      },
    });

    // Wait for approval signal (timeout after 7 days)
    const approved = await condition(() => approvalReceived, '7 days');

    if (approved && approvalDecision === 'approved') {
      await sendSocialReplyActivity({
        message: approvedMessage || draft.message,
        prospectId: prospect.id,
      });

      await updateProspectStatusActivity({
        prospectId: prospect.id,
        status: 'contacted',
        stage: 'identified',
      });
    }
  }

  // STEP 6: Wait for response (timeout after 14 days)
  const responseReceived = await condition(() => prospectResponded, '14 days');

  if (responseReceived && prospectInterested) {
    // Update status
    await updateProspectStatusActivity({
      prospectId: prospect.id,
      status: 'responded',
      stage: 'engaged',
    });

    // If pre-qualified, hand off to Lead Intake
    if (serviceabilityResult.status === 'serviceable' || 
        (serviceabilityResult.status === 'maybe_serviceable' && prospectAnsweredQuestions)) {
      await handoffToLeadIntakeActivity({
        prospectId: prospect.id,
        channel: 'social',
        attribution: {
          source: 'social',
          platform: input.signal.platform,
          url: input.signal.url,
        },
        requestedServices: prospect.requestedServices || undefined,
      });

      await updateProspectStatusActivity({
        prospectId: prospect.id,
        status: 'handed_off',
        stage: 'converted',
      });
    }
  }
}

// =====================================
// Signals (for human-in-the-loop)
// =====================================

let approvalReceived = false;
let approvalDecision: 'approved' | 'rejected' = 'rejected';
let approvedMessage: string | undefined;

setHandler('approval', (decision: string, message?: string) => {
  approvalReceived = true;
  approvalDecision = decision as 'approved' | 'rejected';
  if (message) approvedMessage = message;
});

let prospectResponded = false;
let prospectInterested = false;
let prospectAnsweredQuestions = false;

setHandler('prospectResponse', (interested: boolean, answeredQuestions?: boolean) => {
  prospectResponded = true;
  prospectInterested = interested;
  if (answeredQuestions) prospectAnsweredQuestions = answeredQuestions;
});

setHandler('rerunPreQual', () => {
  // Trigger re-evaluation (implementation TBD)
  console.log('Re-running pre-qual gate');
});
