/**
 * Referral Nurture Workflow
 * 
 * Processes customer referrals from post-job satisfaction
 * Includes pre-qualification gate and automatic outreach for warm leads
 * 
 * @module server/temporal/workflows/referralNurture
 */

import { proxyActivities, setHandler, condition } from '@temporalio/workflow';
import type * as activities from '../activities';

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
  createOutreachDraftActivity,
  recordOutreachAttemptActivity,
  sendPoliteDeclineActivity,
  handoffToLeadIntakeActivity,
  checkConsentActivity,
  
  // Twilio
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

export interface ReferralNurtureInput {
  customerId: number;
  jobId: number;
  businessId: number;
  csatScore?: number;
}

export interface ReferralData {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  services?: string[];
  propertyType?: 'residential' | 'commercial';
  notes?: string;
  consent: boolean;
}

// =====================================
// Workflow Implementation
// =====================================

export async function ReferralNurtureWorkflow(
  input: ReferralNurtureInput
): Promise<void> {
  // STEP 1: Request referral from customer (via SMS or in-app)
  // TODO: Integrate with customer communication system
  // For now, we wait for referral submission signal

  // Wait for referral submission (timeout after 7 days)
  const referralReceived = await condition(() => hasReferral, '7 days');

  if (!referralReceived || !referralData) {
    return; // Customer didn't provide referral
  }

  // STEP 2: Validate consent
  if (!referralData.consent) {
    return; // No consent to contact referral
  }

  // STEP 3: Create marketing prospect
  const prospect = await upsertMarketingProspectActivity({
    businessId: input.businessId,
    source: 'referral',
    sourceContext: {
      referrerCustomerId: input.customerId,
      referrerName: referralData.notes || 'Your neighbor',
      jobId: input.jobId,
    },
    name: referralData.name,
    phone: referralData.phone,
    email: referralData.email,
    address: referralData.address,
    propertyType: referralData.propertyType || 'unknown',
    requestedServices: referralData.services || [],
    detectedServices: referralData.services || [],
    confidence: 0.9, // Referrals are high-confidence
    status: 'identified',
    stage: 'identified',
  });

  // STEP 4: RUN PRE-QUALIFICATION GATE
  const locationResult = await resolveLocationActivity({
    address: prospect.address,
    rawInput: prospect.address || prospect.zip,
    zip: prospect.zip,
    city: prospect.city,
    state: prospect.state,
  });

  // Update prospect with resolved location
  await updateProspectActivity({
    prospectId: prospect.id,
    updates: {
      ...locationResult.normalized,
      geocodeConfidence: locationResult.confidence,
    },
  });

  const serviceabilityResult = await checkServiceabilityActivity({
    businessId: input.businessId,
    location: {
      lat: locationResult.normalized.lat,
      lng: locationResult.normalized.lng,
      zip: locationResult.normalized.zip || prospect.zip,
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
    if (!prospect.requestedServices || prospect.requestedServices.length === 0) {
      missingFields.push('services');
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

  // STEP 5: Check consent to contact
  const hasConsent = await checkConsentActivity({
    businessId: input.businessId,
    contactValue: prospect.phone || '',
    contactType: 'phone',
  });

  if (!hasConsent) {
    await updateProspectStatusActivity({
      prospectId: prospect.id,
      status: 'do_not_contact',
    });
    return;
  }

  // STEP 6: Send referral outreach (fully automatic for referrals - high confidence)
  const draft = await createOutreachDraftActivity({
    prospectId: prospect.id,
    channel: 'sms',
    template: 'referral_outreach',
  });

  if (prospect.phone) {
    await sendSmsActivity({
      to: prospect.phone,
      body: draft.message,
    });

    await recordOutreachAttemptActivity({
      prospectId: prospect.id,
      businessId: input.businessId,
      channel: 'sms',
      messageContent: draft.message,
      status: 'sent',
    });

    await updateProspectStatusActivity({
      prospectId: prospect.id,
      status: 'contacted',
      stage: 'identified',
    });
  }

  // STEP 7: Wait for prospect response (timeout after 14 days)
  const responseReceived = await condition(() => prospectResponded, '14 days');

  if (responseReceived && prospectInterested) {
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
        channel: 'sms',
        attribution: {
          source: 'referral',
          referrerCustomerId: input.customerId,
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
// Signals
// =====================================

let hasReferral = false;
let referralData: ReferralData | undefined;

setHandler('referralSubmitted', (data: ReferralData) => {
  hasReferral = true;
  referralData = data;
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
  console.log('Re-running pre-qual gate for referral');
});
