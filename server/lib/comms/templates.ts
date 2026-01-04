import { CommunicationIntentType, ServiceCategory } from "@shared/comms-schema";

export interface MessageTemplate {
  id: string;
  intentType: CommunicationIntentType;
  serviceCategory: ServiceCategory;
  version: string;
  name: string;
  description: string;
  template: string;
  subject?: string;
  requiredTokens: string[];
  optionalTokens: string[];
  toneGuidelines: string;
  complianceNotes?: string;
  maxLength?: number;
  active: boolean;
}

const TONE_PROFESSIONAL = "Professional, friendly, and concise. Use customer's first name. Be helpful without being overly casual.";
const TONE_URGENT = "Clear, direct, and action-oriented. Convey importance without causing alarm.";
const TONE_WARM = "Warm and appreciative. Thank the customer and show genuine care for their satisfaction.";

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "lead_ack_v1",
    intentType: "lead_acknowledgment",
    serviceCategory: "general",
    version: "1.0",
    name: "Lead Acknowledgment",
    description: "Immediate response when a new lead comes in",
    template: `Hi {{firstName}}, thanks for reaching out to {{businessName}}! We received your inquiry and will get back to you shortly with a quote.

Questions? Reply here or call {{businessPhone}}.`,
    requiredTokens: ["firstName", "businessName", "businessPhone"],
    optionalTokens: ["serviceType"],
    toneGuidelines: TONE_PROFESSIONAL,
    maxLength: 160,
    active: true,
  },
  {
    id: "lead_followup_v1",
    intentType: "lead_followup",
    serviceCategory: "general",
    version: "1.0",
    name: "Lead Follow-up",
    description: "Follow-up for leads that haven't responded",
    template: `Hi {{firstName}}, following up on your {{serviceType}} inquiry. We'd love to help! Ready to get your free quote?

Reply YES or call {{businessPhone}}.

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "businessPhone"],
    optionalTokens: ["serviceType"],
    toneGuidelines: TONE_PROFESSIONAL,
    active: true,
  },
  {
    id: "quote_delivery_v1",
    intentType: "quote_delivery",
    serviceCategory: "general",
    version: "1.0",
    name: "Quote Delivery",
    description: "Sending a quote to the customer",
    template: `Hi {{firstName}}, here's your quote from {{businessName}}:

{{serviceType}}: {{formattedTotal}}
{{#if frequency}}Frequency: {{frequency}}{{/if}}

To approve, reply YES or view details: {{quoteUrl}}

Questions? Reply here or call {{businessPhone}}.`,
    requiredTokens: ["firstName", "businessName", "businessPhone", "serviceType", "formattedTotal"],
    optionalTokens: ["frequency", "quoteUrl", "validUntil"],
    toneGuidelines: TONE_PROFESSIONAL,
    active: true,
  },
  {
    id: "quote_delivery_lawn_v1",
    intentType: "quote_delivery",
    serviceCategory: "lawn_maintenance",
    version: "1.0",
    name: "Lawn Quote Delivery",
    description: "Quote for lawn maintenance services",
    template: `Hi {{firstName}}, here's your lawn care quote from {{businessName}}:

{{serviceType}}: {{formattedTotal}}{{#if frequency}}/{{frequency}}{{/if}}
{{#if lotSize}}Property: {{lotSize}}{{/if}}

To approve, reply YES.
Questions? Reply here or call {{businessPhone}}.`,
    requiredTokens: ["firstName", "businessName", "businessPhone", "serviceType", "formattedTotal"],
    optionalTokens: ["frequency", "lotSize", "quoteUrl"],
    toneGuidelines: TONE_PROFESSIONAL,
    active: true,
  },
  {
    id: "quote_reminder_v1",
    intentType: "quote_reminder",
    serviceCategory: "general",
    version: "1.0",
    name: "Quote Reminder",
    description: "Reminder about a pending quote",
    template: `Hi {{firstName}}, just checking in on your {{serviceType}} quote for {{formattedTotal}}.

Ready to get started? Reply YES to approve.
{{#if validUntil}}Quote valid until {{validUntil}}.{{/if}}

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "serviceType", "formattedTotal"],
    optionalTokens: ["validUntil"],
    toneGuidelines: TONE_PROFESSIONAL,
    active: true,
  },
  {
    id: "quote_approved_v1",
    intentType: "quote_approved",
    serviceCategory: "general",
    version: "1.0",
    name: "Quote Approved Confirmation",
    description: "Confirmation when customer approves quote",
    template: `Great news, {{firstName}}! Your quote has been approved. We'll be in touch shortly to schedule your {{serviceType}}.

Thanks for choosing {{businessName}}!`,
    requiredTokens: ["firstName", "businessName", "serviceType"],
    optionalTokens: [],
    toneGuidelines: TONE_WARM,
    active: true,
  },
  {
    id: "quote_declined_v1",
    intentType: "quote_declined",
    serviceCategory: "general",
    version: "1.0",
    name: "Quote Declined Acknowledgment",
    description: "Response when customer declines quote",
    template: `Hi {{firstName}}, we understand. If you change your mind or have questions about the quote, we're here to help.

Thanks for considering {{businessName}}. Have a great day!`,
    requiredTokens: ["firstName", "businessName"],
    optionalTokens: [],
    toneGuidelines: TONE_WARM,
    active: true,
  },
  {
    id: "schedule_proposal_v1",
    intentType: "schedule_proposal",
    serviceCategory: "general",
    version: "1.0",
    name: "Schedule Proposal",
    description: "Proposing available time slots",
    template: `Hi {{firstName}}, ready to schedule your {{serviceType}}! Here are our available times:

{{#each proposedWindows}}
{{@index}}. {{date}} - {{timeWindow}}
{{/each}}

Reply with your preferred option (1, 2, or 3) or suggest another time.

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "serviceType", "proposedWindows"],
    optionalTokens: [],
    toneGuidelines: TONE_PROFESSIONAL,
    active: true,
  },
  {
    id: "schedule_confirmation_v1",
    intentType: "schedule_confirmation",
    serviceCategory: "general",
    version: "1.0",
    name: "Schedule Confirmation",
    description: "Confirming scheduled service",
    template: `Hi {{firstName}}, you're all set! Your {{serviceType}} is scheduled for:

{{scheduledDate}} - {{scheduledTimeWindow}}
{{#if propertyAddress}}Location: {{propertyAddress}}{{/if}}

We'll text you when our crew is on the way.

Need to reschedule? Reply RESCHEDULE or call {{businessPhone}}.

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "serviceType", "scheduledDate", "scheduledTimeWindow", "businessPhone"],
    optionalTokens: ["propertyAddress", "crewName"],
    toneGuidelines: TONE_PROFESSIONAL,
    active: true,
  },
  {
    id: "schedule_change_v1",
    intentType: "schedule_change",
    serviceCategory: "general",
    version: "1.0",
    name: "Schedule Change",
    description: "Notifying customer of schedule change",
    template: `Hi {{firstName}}, your {{serviceType}} has been rescheduled to {{scheduledDate}} - {{scheduledTimeWindow}}.
{{#if rescheduleReason}}Reason: {{rescheduleReason}}{{/if}}

Need a different time? Reply RESCHEDULE or call {{businessPhone}}.

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "serviceType", "scheduledDate", "scheduledTimeWindow", "businessPhone"],
    optionalTokens: ["previousDate", "rescheduleReason"],
    toneGuidelines: TONE_URGENT,
    active: true,
  },
  {
    id: "schedule_reminder_v1",
    intentType: "schedule_reminder",
    serviceCategory: "general",
    version: "1.0",
    name: "Schedule Reminder",
    description: "Reminder about upcoming service",
    template: `Hi {{firstName}}, reminder: Your {{serviceType}} is scheduled for tomorrow, {{scheduledDate}}.

Our crew will arrive during your {{scheduledTimeWindow}} window.

Need to change? Reply RESCHEDULE.

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "serviceType", "scheduledDate", "scheduledTimeWindow"],
    optionalTokens: [],
    toneGuidelines: TONE_PROFESSIONAL,
    active: true,
  },
  {
    id: "job_eta_v1",
    intentType: "job_eta",
    serviceCategory: "general",
    version: "1.0",
    name: "Job ETA",
    description: "Crew is on the way",
    template: `Hi {{firstName}}, our crew is on the way! Expected arrival: {{estimatedArrival}}.
{{#if crewName}}Crew: {{crewName}}{{/if}}

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "estimatedArrival"],
    optionalTokens: ["crewName", "crewLeadName"],
    toneGuidelines: TONE_PROFESSIONAL,
    maxLength: 160,
    active: true,
  },
  {
    id: "job_crew_arrival_v1",
    intentType: "job_crew_arrival",
    serviceCategory: "general",
    version: "1.0",
    name: "Crew Arrival",
    description: "Crew has arrived",
    template: `Hi {{firstName}}, our crew has arrived for your {{serviceType}}. We'll get started right away!

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "serviceType"],
    optionalTokens: ["crewName"],
    toneGuidelines: TONE_PROFESSIONAL,
    maxLength: 160,
    active: true,
  },
  {
    id: "job_complete_v1",
    intentType: "job_complete",
    serviceCategory: "general",
    version: "1.0",
    name: "Job Complete",
    description: "Job completed notification",
    template: `Hi {{firstName}}, your {{serviceType}} at {{propertyAddress}} is complete!
{{#if jobNotes}}Notes: {{jobNotes}}{{/if}}

Questions? Reply here or call {{businessPhone}}.

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "serviceType", "propertyAddress", "businessPhone"],
    optionalTokens: ["jobNotes", "crewName"],
    toneGuidelines: TONE_WARM,
    active: true,
  },
  {
    id: "job_complete_lawn_v1",
    intentType: "job_complete",
    serviceCategory: "lawn_maintenance",
    version: "1.0",
    name: "Lawn Job Complete",
    description: "Lawn service completed notification",
    template: `Hi {{firstName}}, your lawn looks great! We just finished at {{propertyAddress}}.
{{#if jobNotes}}Notes: {{jobNotes}}{{/if}}

To schedule your next service, reply SCHEDULE.

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "propertyAddress"],
    optionalTokens: ["jobNotes", "crewName"],
    toneGuidelines: TONE_WARM,
    active: true,
  },
  {
    id: "job_followup_v1",
    intentType: "job_followup",
    serviceCategory: "general",
    version: "1.0",
    name: "Job Follow-up",
    description: "Follow-up after job completion",
    template: `Hi {{firstName}}, hope you're enjoying your freshly serviced property! Any feedback or questions about your recent {{serviceType}}?

Thanks for choosing {{businessName}}!`,
    requiredTokens: ["firstName", "businessName", "serviceType"],
    optionalTokens: [],
    toneGuidelines: TONE_WARM,
    active: true,
  },
  {
    id: "invoice_sent_v1",
    intentType: "invoice_sent",
    serviceCategory: "general",
    version: "1.0",
    name: "Invoice Sent",
    description: "Invoice delivery notification",
    template: `Hi {{firstName}}, your invoice #{{invoiceNumber}} for {{formattedAmountDue}} is ready.
{{#if paymentUrl}}Pay online: {{paymentUrl}}{{/if}}
{{#if dueDate}}Due by: {{dueDate}}{{/if}}

Questions? Reply here or call {{businessPhone}}.

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "invoiceNumber", "formattedAmountDue", "businessPhone"],
    optionalTokens: ["paymentUrl", "dueDate"],
    toneGuidelines: TONE_PROFESSIONAL,
    active: true,
  },
  {
    id: "payment_reminder_v1",
    intentType: "payment_reminder",
    serviceCategory: "general",
    version: "1.0",
    name: "Payment Reminder",
    description: "Reminder about outstanding payment",
    template: `Hi {{firstName}}, friendly reminder: Invoice #{{invoiceNumber}} for {{formattedAmountDue}} is due {{dueDate}}.
{{#if paymentUrl}}Pay now: {{paymentUrl}}{{/if}}

Questions? Call {{businessPhone}}.

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "invoiceNumber", "formattedAmountDue", "dueDate", "businessPhone"],
    optionalTokens: ["paymentUrl"],
    toneGuidelines: TONE_PROFESSIONAL,
    complianceNotes: "Be polite, no threatening language",
    active: true,
  },
  {
    id: "payment_received_v1",
    intentType: "payment_received",
    serviceCategory: "general",
    version: "1.0",
    name: "Payment Received",
    description: "Payment confirmation",
    template: `Hi {{firstName}}, we received your payment of {{formattedAmountPaid}}. Thank you!
{{#if balanceRemaining}}Remaining balance: {{balanceRemaining}}{{/if}}

Thanks for your business!

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "formattedAmountPaid"],
    optionalTokens: ["balanceRemaining"],
    toneGuidelines: TONE_WARM,
    active: true,
  },
  {
    id: "review_request_v1",
    intentType: "review_request",
    serviceCategory: "general",
    version: "1.0",
    name: "Review Request",
    description: "Request for customer review",
    template: `Hi {{firstName}}, thanks for choosing {{businessName}}! We'd love to hear about your experience.

Leave a quick review: {{reviewUrl}}

It helps us serve you better!`,
    requiredTokens: ["firstName", "businessName"],
    optionalTokens: ["reviewUrl"],
    toneGuidelines: TONE_WARM,
    active: true,
  },
  {
    id: "upsell_offer_v1",
    intentType: "upsell_offer",
    serviceCategory: "general",
    version: "1.0",
    name: "Upsell Offer",
    description: "Offering additional services",
    template: `Hi {{firstName}}, based on your {{previousService}}, you might be interested in our {{offerName}} - {{offerDescription}}.

Special rate: {{offerPrice}}

Interested? Reply YES or call {{businessPhone}}.

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "businessPhone", "previousService", "offerName", "offerDescription", "offerPrice"],
    optionalTokens: [],
    toneGuidelines: TONE_PROFESSIONAL,
    complianceNotes: "Only send to customers who haven't opted out of marketing",
    active: true,
  },
  {
    id: "general_inquiry_v1",
    intentType: "general_inquiry_response",
    serviceCategory: "general",
    version: "1.0",
    name: "General Inquiry Response",
    description: "Response to general customer questions",
    template: `Hi {{firstName}}, thanks for your question! {{responseMessage}}

Need more info? Reply here or call {{businessPhone}}.

- {{businessName}}`,
    requiredTokens: ["firstName", "businessName", "businessPhone", "responseMessage"],
    optionalTokens: [],
    toneGuidelines: TONE_PROFESSIONAL,
    active: true,
  },
];

export function getTemplate(
  intentType: CommunicationIntentType,
  serviceCategory?: ServiceCategory
): MessageTemplate | null {
  const category = serviceCategory || "general";
  
  const categoryMatch = MESSAGE_TEMPLATES.find(
    t => t.intentType === intentType && t.serviceCategory === category && t.active
  );
  
  if (categoryMatch) return categoryMatch;
  
  const generalMatch = MESSAGE_TEMPLATES.find(
    t => t.intentType === intentType && t.serviceCategory === "general" && t.active
  );
  
  return generalMatch || null;
}

export function getAllTemplatesForIntent(intentType: CommunicationIntentType): MessageTemplate[] {
  return MESSAGE_TEMPLATES.filter(t => t.intentType === intentType && t.active);
}

export function getTemplateById(templateId: string): MessageTemplate | null {
  return MESSAGE_TEMPLATES.find(t => t.id === templateId) || null;
}
