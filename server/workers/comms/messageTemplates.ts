export type ServiceCategory = "lawn_maintenance" | "hardscape" | "general";

export interface MessageTemplate {
  id: string;
  name: string;
  category: ServiceCategory;
  messageType: "job_rescheduled" | "job_completed" | "reminder" | "follow_up";
  template: string;
  requiredVariables: string[];
  optionalVariables: string[];
}

export const LAWN_MAINTENANCE_TEMPLATES: MessageTemplate[] = [
  {
    id: "lawn_rescheduled_v1",
    name: "Lawn Job Rescheduled",
    category: "lawn_maintenance",
    messageType: "job_rescheduled",
    template: `Hi {{customerFirstName}}, your lawn service has been rescheduled to {{newDate}}. Our crew will arrive during your scheduled window.

Need to change? Reply RESCHEDULE or call us at {{businessPhone}}.

- {{businessName}}`,
    requiredVariables: ["customerFirstName", "newDate", "businessPhone", "businessName"],
    optionalVariables: ["originalDate", "reason"],
  },
  {
    id: "lawn_completed_v1",
    name: "Lawn Job Completed",
    category: "lawn_maintenance",
    messageType: "job_completed",
    template: `Hi {{customerFirstName}}, great news! Your lawn service at {{propertyAddress}} has been completed.

{{#if serviceNotes}}Notes: {{serviceNotes}}{{/if}}

Questions? Reply to this message or call {{businessPhone}}.

To reschedule your next visit, reply RESCHEDULE.

- {{businessName}}`,
    requiredVariables: ["customerFirstName", "propertyAddress", "businessPhone", "businessName"],
    optionalVariables: ["serviceNotes", "crewName"],
  },
  {
    id: "lawn_reminder_v1",
    name: "Lawn Service Reminder",
    category: "lawn_maintenance",
    messageType: "reminder",
    template: `Hi {{customerFirstName}}, just a reminder that your lawn service is scheduled for {{scheduledDate}}.

Our crew will arrive during your service window. We'll text you when we're on our way.

Need to change? Reply RESCHEDULE or call {{businessPhone}}.

- {{businessName}}`,
    requiredVariables: ["customerFirstName", "scheduledDate", "businessPhone", "businessName"],
    optionalVariables: [],
  },
];

export const HARDSCAPE_TEMPLATES: MessageTemplate[] = [
  {
    id: "hardscape_rescheduled_v1",
    name: "Hardscape Job Rescheduled",
    category: "hardscape",
    messageType: "job_rescheduled",
    template: `Hi {{customerFirstName}}, your hardscape project has been rescheduled to {{newDate}}. Our team will arrive during your scheduled window.

{{#if reason}}Reason: {{reason}}{{/if}}

Need to discuss? Reply RESCHEDULE or call us at {{businessPhone}}.

- {{businessName}}`,
    requiredVariables: ["customerFirstName", "newDate", "businessPhone", "businessName"],
    optionalVariables: ["originalDate", "reason", "projectType"],
  },
  {
    id: "hardscape_completed_v1",
    name: "Hardscape Job Completed",
    category: "hardscape",
    messageType: "job_completed",
    template: `Hi {{customerFirstName}}, your hardscape project at {{propertyAddress}} has been completed!

{{#if serviceNotes}}Crew notes: {{serviceNotes}}{{/if}}

We hope you love the results. Any questions or concerns? Reply to this message or call {{businessPhone}}.

- {{businessName}}`,
    requiredVariables: ["customerFirstName", "propertyAddress", "businessPhone", "businessName"],
    optionalVariables: ["serviceNotes", "projectType"],
  },
];

export const GENERAL_TEMPLATES: MessageTemplate[] = [
  {
    id: "general_rescheduled_v1",
    name: "General Job Rescheduled",
    category: "general",
    messageType: "job_rescheduled",
    template: `Hi {{customerFirstName}}, your service has been rescheduled to {{newDate}}. Our crew will arrive during your scheduled window.

Need to change? Reply RESCHEDULE or call us at {{businessPhone}}.

- {{businessName}}`,
    requiredVariables: ["customerFirstName", "newDate", "businessPhone", "businessName"],
    optionalVariables: ["originalDate", "reason", "serviceType"],
  },
  {
    id: "general_completed_v1",
    name: "General Job Completed",
    category: "general",
    messageType: "job_completed",
    template: `Hi {{customerFirstName}}, your service at {{propertyAddress}} has been completed.

{{#if serviceNotes}}Notes: {{serviceNotes}}{{/if}}

Questions? Reply to this message or call {{businessPhone}}.

To schedule your next service, reply RESCHEDULE.

- {{businessName}}`,
    requiredVariables: ["customerFirstName", "propertyAddress", "businessPhone", "businessName"],
    optionalVariables: ["serviceNotes", "serviceType"],
  },
];

export const ALL_TEMPLATES = [
  ...LAWN_MAINTENANCE_TEMPLATES,
  ...HARDSCAPE_TEMPLATES,
  ...GENERAL_TEMPLATES,
];

export function getTemplate(
  messageType: string,
  serviceCategory?: ServiceCategory
): MessageTemplate | null {
  const category = serviceCategory || "general";
  
  const categoryTemplates = ALL_TEMPLATES.filter(
    t => t.category === category && t.messageType === messageType
  );
  
  if (categoryTemplates.length > 0) {
    return categoryTemplates[0];
  }
  
  const generalTemplates = ALL_TEMPLATES.filter(
    t => t.category === "general" && t.messageType === messageType
  );
  
  return generalTemplates.length > 0 ? generalTemplates[0] : null;
}

export function detectServiceCategory(serviceType?: string): ServiceCategory {
  if (!serviceType) return "general";
  
  const lower = serviceType.toLowerCase();
  
  const lawnKeywords = ["lawn", "mowing", "mow", "grass", "turf", "fertiliz", "weed", "aerat"];
  if (lawnKeywords.some(kw => lower.includes(kw))) {
    return "lawn_maintenance";
  }
  
  const hardscapeKeywords = ["hardscape", "patio", "paver", "retaining", "wall", "walkway", "driveway", "stone", "brick", "concrete"];
  if (hardscapeKeywords.some(kw => lower.includes(kw))) {
    return "hardscape";
  }
  
  return "general";
}
