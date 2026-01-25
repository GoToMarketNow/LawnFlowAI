/**
 * Response Router Workflow
 * 
 * Classifies and routes inbound prospect replies (SMS, email, social)
 * Handles opt-outs, answers to questions, and interest signals
 * 
 * @module server/temporal/workflows/responseRouter
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  matchConversationToProspectActivity,
  classifyResponseActivity,
  extractRequestedServicesActivity,
  resolveLocationActivity,
  checkServiceabilityActivity,
  updateProspectActivity,
  updateProspectStatusActivity,
  setOptOutActivity,
  handoffToLeadIntakeActivity,
  sendSmsActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    maximumAttempts: 3,
  },
});

// =====================================
// Workflow Input
// =====================================

export interface ResponseRouterInput {
  businessId: number;
  inboundMessage: string;
  channel: 'sms' | 'email' | 'social';
  from: {
    phone?: string;
    email?: string;
  };
  externalMessageId?: string;
}

// =====================================
// Workflow Implementation
// =====================================

export async function ResponseRouterWorkflow(
  input: ResponseRouterInput
): Promise<void> {
  // STEP 1: Match conversation to prospect
  const prospect = await matchConversationToProspectActivity({
    phone: input.from.phone,
    email: input.from.email,
    businessId: input.businessId,
  });

  if (!prospect) {
    // Unknown prospect - log and exit
    console.log(`[ResponseRouter] Unknown prospect: ${input.from.phone || input.from.email}`);
    return;
  }

  // STEP 2: Classify response
  const classification = await classifyResponseActivity(input.inboundMessage);

  // Update last response time
  await updateProspectActivity({
    prospectId: prospect.id,
    updates: {
      lastResponseAt: new Date(),
    },
  });

  // STEP 3: Handle based on intent
  if (classification.intent === 'stop') {
    // Handle opt-out
    await setOptOutActivity({
      businessId: input.businessId,
      contactValue: input.from.phone || input.from.email || '',
      contactType: input.from.phone ? 'phone' : 'email',
      reason: 'customer_request',
    });

    // Send confirmation
    if (input.from.phone && input.channel === 'sms') {
      await sendSmsActivity({
        to: input.from.phone,
        body: `Got it! You've been removed from our list.`,
      });
    }

    await updateProspectStatusActivity({
      prospectId: prospect.id,
      status: 'do_not_contact',
    });
    
    return;
  }

  if (classification.intent === 'wrong_number' || classification.intent === 'not_now') {
    // Mark as not interested
    await updateProspectStatusActivity({
      prospectId: prospect.id,
      status: 'closed_lost',
      stage: 'identified',
    });

    await updateProspectActivity({
      prospectId: prospect.id,
      updates: {
        closeOutcome: 'lost',
        closeReason: classification.intent === 'wrong_number' ? 'Wrong number' : 'Not interested',
      },
    });

    return;
  }

  if (classification.intent === 'answered_question') {
    // They answered a pre-qual question - extract info
    
    // Check if they provided location
    if (classification.extractedLocation) {
      const locationResult = await resolveLocationActivity({
        rawInput: classification.extractedLocation,
        zip: classification.extractedLocation,
      });

      await updateProspectActivity({
        prospectId: prospect.id,
        updates: {
          ...locationResult.normalized,
          geocodeConfidence: locationResult.confidence,
        },
      });

      // Re-run serviceability check
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

      await updateProspectStatusActivity({
        prospectId: prospect.id,
        serviceabilityStatus: serviceabilityResult.status,
        serviceabilityReasons: serviceabilityResult.reasons,
        qualificationStage: 
          serviceabilityResult.status === 'serviceable' ? 'prequalified' :
          serviceabilityResult.status === 'maybe_serviceable' ? 'needs_info' :
          'disqualified',
      });

      // If now serviceable and interested, hand off
      if (serviceabilityResult.status === 'serviceable') {
        await handleInterestedProspect(prospect, input);
      }
    }

    // Check if they provided service info
    if (input.inboundMessage.length > 5) {
      const servicesResult = await extractRequestedServicesActivity({
        text: input.inboundMessage,
        detectedServices: prospect.requestedServices || undefined,
      });

      if (servicesResult.services.length > 0) {
        await updateProspectActivity({
          prospectId: prospect.id,
          updates: {
            requestedServices: servicesResult.services,
          },
        });
      }
    }

    return;
  }

  if (classification.intent === 'interested' || classification.intent === 'needs_callback') {
    // They're interested!
    await handleInterestedProspect(prospect, input);
  }
}

// =====================================
// Helper Functions
// =====================================

async function handleInterestedProspect(
  prospect: any,
  input: ResponseRouterInput
): Promise<void> {
  await updateProspectStatusActivity({
    prospectId: prospect.id,
    status: 'responded',
    stage: 'engaged',
  });

  // If pre-qualified (serviceable), hand off to Lead Intake
  if (prospect.serviceabilityStatus === 'serviceable' || 
      (prospect.serviceabilityStatus === 'maybe_serviceable' && prospect.qualificationStage === 'prequalified')) {
    
    await handoffToLeadIntakeActivity({
      prospectId: prospect.id,
      channel: input.channel,
      transcript: [{
        direction: 'in',
        text: input.inboundMessage,
        at: new Date().toISOString(),
      }],
      attribution: {
        source: prospect.source as 'social' | 'referral',
        referrerCustomerId: (prospect.sourceContext as any)?.referrerCustomerId,
        platform: (prospect.sourceContext as any)?.platform,
        url: (prospect.sourceContext as any)?.url,
      },
      requestedServices: prospect.requestedServices || undefined,
    });

    await updateProspectStatusActivity({
      prospectId: prospect.id,
      status: 'handed_off',
      stage: 'converted',
    });
  } else {
    // Not yet pre-qualified - send a follow-up question
    if (input.from.phone && input.channel === 'sms') {
      await sendSmsActivity({
        to: input.from.phone,
        body: `Great! ${prospect.lastQuestionAsked || "What's your property address so I can give you an accurate quote?"}`,
      });
    }
  }
}
