/**
 * Crew Comms Message Templates
 * Bilingual support: English (en) and Spanish (es)
 * 
 * All notification types with templates for SMS, Push, and In-App channels
 */

export type NotificationType = 
  | "DAILY_BRIEFING"
  | "JOB_ADDED"
  | "JOB_UPDATED"
  | "JOB_CANCELED"
  | "SCOPE_CHANGED"
  | "ETA_CHANGED"
  | "CUSTOMER_NOTE"
  | "EQUIPMENT_ALERT"
  | "ACTION_REQUIRED"
  | "CREW_BROADCAST";

export type Language = "en" | "es";
export type Channel = "SMS" | "PUSH" | "IN_APP";

export interface TemplateContext {
  // Common fields
  businessName?: string;
  crewName?: string;
  recipientName?: string;
  
  // Job-related fields
  jobId?: string;
  jobTitle?: string;
  customerName?: string;
  customerAddress?: string;
  scheduledTime?: string;
  scheduledDate?: string;
  
  // Daily briefing fields
  jobCount?: number;
  totalMinutes?: number;
  startTime?: string;
  firstJobAddress?: string;
  
  // Change fields
  changeDescription?: string;
  oldValue?: string;
  newValue?: string;
  
  // Equipment fields
  equipmentName?: string;
  alertReason?: string;
  
  // Note fields
  noteContent?: string;
  noteAuthor?: string;
  
  // Action fields
  actionType?: string;
  actionDeadline?: string;
  
  // Broadcast fields
  broadcastMessage?: string;
  senderName?: string;
}

interface TemplateSet {
  title: string;
  body: string;
  sms?: string;
}

type TemplateLibrary = {
  [key in NotificationType]: {
    [lang in Language]: TemplateSet;
  };
};

/**
 * Full template library for all notification types
 */
export const templates: TemplateLibrary = {
  DAILY_BRIEFING: {
    en: {
      title: "Daily Schedule",
      body: "Good morning {{recipientName}}! You have {{jobCount}} jobs today starting at {{startTime}}. First stop: {{firstJobAddress}}. Estimated {{totalMinutes}} min of work.",
      sms: "LawnFlow Daily: {{jobCount}} jobs today, starting {{startTime}}. First: {{firstJobAddress}}. ~{{totalMinutes}}min work. View schedule in app.",
    },
    es: {
      title: "Horario Diario",
      body: "Buenos dias {{recipientName}}! Tienes {{jobCount}} trabajos hoy comenzando a las {{startTime}}. Primera parada: {{firstJobAddress}}. Estimado {{totalMinutes}} min de trabajo.",
      sms: "LawnFlow Diario: {{jobCount}} trabajos hoy, empezando {{startTime}}. Primero: {{firstJobAddress}}. ~{{totalMinutes}}min trabajo. Ver horario en app.",
    },
  },

  JOB_ADDED: {
    en: {
      title: "New Job Added",
      body: "A new job has been added to your schedule: {{jobTitle}} at {{customerAddress}} on {{scheduledDate}} at {{scheduledTime}}.",
      sms: "LawnFlow: New job added - {{jobTitle}} at {{customerAddress}}, {{scheduledDate}} {{scheduledTime}}. Check app for details.",
    },
    es: {
      title: "Nuevo Trabajo Agregado",
      body: "Se ha agregado un nuevo trabajo a tu horario: {{jobTitle}} en {{customerAddress}} el {{scheduledDate}} a las {{scheduledTime}}.",
      sms: "LawnFlow: Nuevo trabajo - {{jobTitle}} en {{customerAddress}}, {{scheduledDate}} {{scheduledTime}}. Ver detalles en app.",
    },
  },

  JOB_UPDATED: {
    en: {
      title: "Job Updated",
      body: "Job {{jobTitle}} has been updated: {{changeDescription}}",
      sms: "LawnFlow: Job {{jobTitle}} updated - {{changeDescription}}. Check app for details.",
    },
    es: {
      title: "Trabajo Actualizado",
      body: "El trabajo {{jobTitle}} ha sido actualizado: {{changeDescription}}",
      sms: "LawnFlow: Trabajo {{jobTitle}} actualizado - {{changeDescription}}. Ver detalles en app.",
    },
  },

  JOB_CANCELED: {
    en: {
      title: "Job Canceled",
      body: "Job {{jobTitle}} at {{customerAddress}} scheduled for {{scheduledDate}} has been canceled.",
      sms: "LawnFlow: CANCELED - {{jobTitle}} at {{customerAddress}} on {{scheduledDate}}. Your schedule has been updated.",
    },
    es: {
      title: "Trabajo Cancelado",
      body: "El trabajo {{jobTitle}} en {{customerAddress}} programado para {{scheduledDate}} ha sido cancelado.",
      sms: "LawnFlow: CANCELADO - {{jobTitle}} en {{customerAddress}} el {{scheduledDate}}. Tu horario ha sido actualizado.",
    },
  },

  SCOPE_CHANGED: {
    en: {
      title: "Scope Change",
      body: "The scope for job {{jobTitle}} has changed. {{changeDescription}}",
      sms: "LawnFlow: Scope change for {{jobTitle}} - {{changeDescription}}. Review in app before arrival.",
    },
    es: {
      title: "Cambio de Alcance",
      body: "El alcance del trabajo {{jobTitle}} ha cambiado. {{changeDescription}}",
      sms: "LawnFlow: Cambio de alcance para {{jobTitle}} - {{changeDescription}}. Revisar en app antes de llegar.",
    },
  },

  ETA_CHANGED: {
    en: {
      title: "Time Change",
      body: "Job {{jobTitle}} time has changed from {{oldValue}} to {{newValue}}.",
      sms: "LawnFlow: Time change - {{jobTitle}} moved from {{oldValue}} to {{newValue}}.",
    },
    es: {
      title: "Cambio de Hora",
      body: "La hora del trabajo {{jobTitle}} ha cambiado de {{oldValue}} a {{newValue}}.",
      sms: "LawnFlow: Cambio de hora - {{jobTitle}} movido de {{oldValue}} a {{newValue}}.",
    },
  },

  CUSTOMER_NOTE: {
    en: {
      title: "Customer Note",
      body: "Note from {{noteAuthor}} for job {{jobTitle}}: \"{{noteContent}}\"",
      sms: "LawnFlow Note for {{jobTitle}}: \"{{noteContent}}\" - {{noteAuthor}}",
    },
    es: {
      title: "Nota del Cliente",
      body: "Nota de {{noteAuthor}} para el trabajo {{jobTitle}}: \"{{noteContent}}\"",
      sms: "LawnFlow Nota para {{jobTitle}}: \"{{noteContent}}\" - {{noteAuthor}}",
    },
  },

  EQUIPMENT_ALERT: {
    en: {
      title: "Equipment Alert",
      body: "Equipment alert for {{equipmentName}}: {{alertReason}}. Please address before next job.",
      sms: "LawnFlow ALERT: {{equipmentName}} - {{alertReason}}. Address before next job.",
    },
    es: {
      title: "Alerta de Equipo",
      body: "Alerta de equipo para {{equipmentName}}: {{alertReason}}. Por favor atiende antes del proximo trabajo.",
      sms: "LawnFlow ALERTA: {{equipmentName}} - {{alertReason}}. Atender antes del proximo trabajo.",
    },
  },

  ACTION_REQUIRED: {
    en: {
      title: "Action Required",
      body: "{{actionType}} is needed. {{changeDescription}}. Deadline: {{actionDeadline}}",
      sms: "LawnFlow ACTION: {{actionType}} needed by {{actionDeadline}}. {{changeDescription}}",
    },
    es: {
      title: "Accion Requerida",
      body: "Se necesita {{actionType}}. {{changeDescription}}. Fecha limite: {{actionDeadline}}",
      sms: "LawnFlow ACCION: {{actionType}} necesario antes de {{actionDeadline}}. {{changeDescription}}",
    },
  },

  CREW_BROADCAST: {
    en: {
      title: "Team Message",
      body: "{{senderName}}: {{broadcastMessage}}",
      sms: "LawnFlow from {{senderName}}: {{broadcastMessage}}",
    },
    es: {
      title: "Mensaje del Equipo",
      body: "{{senderName}}: {{broadcastMessage}}",
      sms: "LawnFlow de {{senderName}}: {{broadcastMessage}}",
    },
  },
};

/**
 * Render a template with context values
 */
export function renderTemplate(
  template: string,
  context: TemplateContext
): string {
  let rendered = template;
  
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.split(placeholder).join(String(value));
    }
  }
  
  // Remove any unreplaced placeholders
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, "");
  
  return rendered.trim();
}

/**
 * Get rendered notification content for a specific type, language, and channel
 */
export function getNotificationContent(
  type: NotificationType,
  language: Language,
  channel: Channel,
  context: TemplateContext
): { title: string; body: string } {
  const templateSet = templates[type]?.[language] ?? templates[type]?.en;
  
  if (!templateSet) {
    return {
      title: "Notification",
      body: "You have a new notification.",
    };
  }
  
  let body: string;
  if (channel === "SMS" && templateSet.sms) {
    body = renderTemplate(templateSet.sms, context);
  } else {
    body = renderTemplate(templateSet.body, context);
  }
  
  return {
    title: renderTemplate(templateSet.title, context),
    body,
  };
}

/**
 * Get default channel preferences for a notification type
 */
export function getDefaultChannels(type: NotificationType): Channel[] {
  switch (type) {
    case "DAILY_BRIEFING":
      return ["PUSH", "IN_APP"];
    case "JOB_ADDED":
    case "JOB_CANCELED":
    case "SCOPE_CHANGED":
      return ["PUSH", "IN_APP", "SMS"];
    case "JOB_UPDATED":
    case "ETA_CHANGED":
    case "CUSTOMER_NOTE":
      return ["PUSH", "IN_APP"];
    case "EQUIPMENT_ALERT":
    case "ACTION_REQUIRED":
      return ["PUSH", "IN_APP", "SMS"];
    case "CREW_BROADCAST":
      return ["PUSH", "IN_APP"];
    default:
      return ["IN_APP"];
  }
}

/**
 * Check if a notification should be sent via SMS based on urgency
 */
export function isUrgentNotification(type: NotificationType): boolean {
  const urgentTypes: NotificationType[] = [
    "JOB_CANCELED",
    "SCOPE_CHANGED",
    "EQUIPMENT_ALERT",
    "ACTION_REQUIRED",
  ];
  return urgentTypes.includes(type);
}

/**
 * Get SMS character count for template (for preview)
 */
export function getSmsCharacterCount(
  type: NotificationType,
  language: Language,
  context: TemplateContext
): number {
  const { body } = getNotificationContent(type, language, "SMS", context);
  return body.length;
}
