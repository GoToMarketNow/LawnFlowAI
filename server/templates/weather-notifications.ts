// ============================================
// Weather Notification Templates
// SMS and Push notification templates for weather-related communications
// ============================================

import { z } from 'zod';

// Template variable types
export interface ScheduleChangeVars {
  customerName: string;
  businessName: string;
  serviceType: string;
  originalDate: string;
  originalTime: string;
  newDate: string;
  newTime: string;
  weatherReason: string;
  acceptUrl?: string;
  declineUrl?: string;
  supportPhone?: string;
}

export interface WinterOfferVars {
  customerName: string;
  businessName: string;
  eventType: string;  // 'Snow', 'Ice', etc.
  serviceType: string;
  price: string;
  windowStart: string;
  windowEnd: string;
  acceptUrl: string;
  supportPhone?: string;
}

export interface CrewAlertVars {
  crewName: string;
  alertType: string;
  alertMessage: string;
  jobCount: number;
  actionRequired?: string;
}

export interface OwnerApprovalVars {
  operatorName: string;
  planType: string;
  impactedCount: number;
  summary: string;
  approvalUrl: string;
  expiresAt: string;
}

// ============================================
// SMS Templates
// ============================================

export const SMS_TEMPLATES = {
  // Customer schedule change notification
  SCHEDULE_CHANGE_CUSTOMER: {
    id: 'WEATHER_SCHEDULE_CHANGE',
    name: 'Weather Schedule Change',
    template: `Hi {{customerName}}, due to {{weatherReason}}, {{businessName}} needs to reschedule your {{serviceType}} from {{originalDate}} at {{originalTime}} to {{newDate}} at {{newTime}}.

Reply YES to confirm or NO to request a different time.

Questions? Call {{supportPhone}}`,
    variables: ['customerName', 'businessName', 'serviceType', 'originalDate', 'originalTime', 'newDate', 'newTime', 'weatherReason', 'supportPhone'] as const
  },

  // Customer schedule change with link
  SCHEDULE_CHANGE_CUSTOMER_LINK: {
    id: 'WEATHER_SCHEDULE_CHANGE_LINK',
    name: 'Weather Schedule Change (with link)',
    template: `Hi {{customerName}}, {{businessName}} needs to reschedule your {{serviceType}} due to {{weatherReason}}.

New time: {{newDate}} at {{newTime}}

Accept: {{acceptUrl}}
Request different time: {{declineUrl}}`,
    variables: ['customerName', 'businessName', 'serviceType', 'newDate', 'newTime', 'weatherReason', 'acceptUrl', 'declineUrl'] as const
  },

  // Winter service offer
  WINTER_OFFER: {
    id: 'WINTER_SERVICE_OFFER',
    name: 'Winter Service Offer',
    template: `{{eventType}} alert! {{businessName}} offers {{serviceType}} service for ${{price}}.

Available {{windowStart}} - {{windowEnd}}.

Request service: {{acceptUrl}}

Reply STOP to opt out.`,
    variables: ['customerName', 'businessName', 'eventType', 'serviceType', 'price', 'windowStart', 'windowEnd', 'acceptUrl'] as const
  },

  // Weather delay alert (simple)
  WEATHER_DELAY: {
    id: 'WEATHER_DELAY_ALERT',
    name: 'Weather Delay Alert',
    template: `Hi {{customerName}}, {{businessName}} may be delayed today due to {{weatherReason}}. We'll update you with a revised time. Thanks for your patience!`,
    variables: ['customerName', 'businessName', 'weatherReason'] as const
  },

  // Crew weather alert
  CREW_WEATHER_ALERT: {
    id: 'CREW_WEATHER_ALERT',
    name: 'Crew Weather Alert',
    template: `⚠️ WEATHER ALERT: {{alertType}}

{{alertMessage}}

{{jobCount}} jobs affected today.

{{actionRequired}}`,
    variables: ['alertType', 'alertMessage', 'jobCount', 'actionRequired'] as const
  },

  // Owner approval request
  OWNER_APPROVAL_REQUEST: {
    id: 'OWNER_WEATHER_APPROVAL',
    name: 'Owner Approval Request',
    template: `{{operatorName}}, weather action needed: {{planType}} affecting {{impactedCount}} jobs.

{{summary}}

Review & approve: {{approvalUrl}}

Expires: {{expiresAt}}`,
    variables: ['operatorName', 'planType', 'impactedCount', 'summary', 'approvalUrl', 'expiresAt'] as const
  },

  // Job completion despite weather
  JOB_COMPLETED_WEATHER: {
    id: 'JOB_COMPLETED_WEATHER',
    name: 'Job Completed (Weather)',
    template: `Hi {{customerName}}, great news! Despite the weather, {{businessName}} completed your {{serviceType}} today. Thanks for your patience!`,
    variables: ['customerName', 'businessName', 'serviceType'] as const
  }
};

// ============================================
// Push Notification Templates
// ============================================

export const PUSH_TEMPLATES = {
  // Schedule change
  SCHEDULE_CHANGE: {
    id: 'PUSH_SCHEDULE_CHANGE',
    title: 'Service Rescheduled',
    body: `Due to {{weatherReason}}, your {{serviceType}} has been moved to {{newDate}} at {{newTime}}.`,
    data: {
      type: 'WEATHER_SCHEDULE_CHANGE',
      action: 'VIEW_DETAILS'
    }
  },

  // Winter offer
  WINTER_OFFER: {
    id: 'PUSH_WINTER_OFFER',
    title: '{{eventType}} Service Available',
    body: `{{businessName}} offers {{serviceType}} for ${{price}}. Book now before slots fill up!`,
    data: {
      type: 'WINTER_OFFER',
      action: 'VIEW_OFFER'
    }
  },

  // Weather alert for crew
  CREW_ALERT: {
    id: 'PUSH_CREW_ALERT',
    title: '⚠️ Weather Alert',
    body: `{{alertType}}: {{alertMessage}}`,
    data: {
      type: 'CREW_WEATHER_ALERT',
      action: 'VIEW_GUIDELINES'
    }
  },

  // Owner approval needed
  APPROVAL_NEEDED: {
    id: 'PUSH_APPROVAL_NEEDED',
    title: 'Approval Required',
    body: `Weather {{planType}} needs your approval. {{impactedCount}} jobs affected.`,
    data: {
      type: 'WEATHER_APPROVAL',
      action: 'REVIEW_APPROVAL'
    }
  },

  // Schedule change accepted
  CHANGE_ACCEPTED: {
    id: 'PUSH_CHANGE_ACCEPTED',
    title: 'Reschedule Confirmed',
    body: `Your {{serviceType}} is confirmed for {{newDate}} at {{newTime}}.`,
    data: {
      type: 'SCHEDULE_CONFIRMED',
      action: 'VIEW_CALENDAR'
    }
  }
};

// ============================================
// Template Rendering Functions
// ============================================

/**
 * Render an SMS template with variables
 */
export function renderSmsTemplate(
  templateId: keyof typeof SMS_TEMPLATES,
  variables: Record<string, string>
): string {
  const template = SMS_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`SMS template not found: ${templateId}`);
  }

  let message = template.template;
  
  // Replace all variables
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Check for unreplaced variables
  const unreplaced = message.match(/{{[^}]+}}/g);
  if (unreplaced) {
    console.warn(`Unreplaced variables in template ${templateId}:`, unreplaced);
  }

  return message;
}

/**
 * Render a push notification template
 */
export function renderPushTemplate(
  templateId: keyof typeof PUSH_TEMPLATES,
  variables: Record<string, string>
): { title: string; body: string; data: any } {
  const template = PUSH_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Push template not found: ${templateId}`);
  }

  let title = template.title;
  let body = template.body;

  // Replace variables in title and body
  for (const [key, value] of Object.entries(variables)) {
    title = title.replace(new RegExp(`{{${key}}}`, 'g'), value);
    body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  return {
    title,
    body,
    data: {
      ...template.data,
      ...variables
    }
  };
}

// ============================================
// Template Validation
// ============================================

/**
 * Validate that all required variables are provided
 */
export function validateTemplateVars(
  templateId: keyof typeof SMS_TEMPLATES,
  variables: Record<string, string>
): { valid: boolean; missing: string[] } {
  const template = SMS_TEMPLATES[templateId];
  if (!template) {
    return { valid: false, missing: ['TEMPLATE_NOT_FOUND'] };
  }

  const missing = template.variables.filter(v => !variables[v]);
  return {
    valid: missing.length === 0,
    missing
  };
}

// ============================================
// Pre-built Message Builders
// ============================================

/**
 * Build schedule change SMS for customer
 */
export function buildScheduleChangeSms(vars: ScheduleChangeVars): string {
  return renderSmsTemplate('SCHEDULE_CHANGE_CUSTOMER', {
    customerName: vars.customerName,
    businessName: vars.businessName,
    serviceType: vars.serviceType,
    originalDate: vars.originalDate,
    originalTime: vars.originalTime,
    newDate: vars.newDate,
    newTime: vars.newTime,
    weatherReason: vars.weatherReason,
    supportPhone: vars.supportPhone || ''
  });
}

/**
 * Build winter service offer SMS
 */
export function buildWinterOfferSms(vars: WinterOfferVars): string {
  return renderSmsTemplate('WINTER_OFFER', {
    customerName: vars.customerName,
    businessName: vars.businessName,
    eventType: vars.eventType,
    serviceType: vars.serviceType,
    price: vars.price,
    windowStart: vars.windowStart,
    windowEnd: vars.windowEnd,
    acceptUrl: vars.acceptUrl
  });
}

/**
 * Build crew alert SMS
 */
export function buildCrewAlertSms(vars: CrewAlertVars): string {
  return renderSmsTemplate('CREW_WEATHER_ALERT', {
    alertType: vars.alertType,
    alertMessage: vars.alertMessage,
    jobCount: vars.jobCount.toString(),
    actionRequired: vars.actionRequired || 'Check with dispatch for updates.'
  });
}

/**
 * Build owner approval request SMS
 */
export function buildOwnerApprovalSms(vars: OwnerApprovalVars): string {
  return renderSmsTemplate('OWNER_APPROVAL_REQUEST', {
    operatorName: vars.operatorName,
    planType: vars.planType,
    impactedCount: vars.impactedCount.toString(),
    summary: vars.summary,
    approvalUrl: vars.approvalUrl,
    expiresAt: vars.expiresAt
  });
}

// Export all template IDs for reference
export const SMS_TEMPLATE_IDS = Object.keys(SMS_TEMPLATES) as (keyof typeof SMS_TEMPLATES)[];
export const PUSH_TEMPLATE_IDS = Object.keys(PUSH_TEMPLATES) as (keyof typeof PUSH_TEMPLATES)[];
