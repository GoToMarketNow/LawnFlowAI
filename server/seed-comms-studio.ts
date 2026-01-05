import { db } from "./db";
import { commsAutomations, commsTemplateSets, businessProfiles } from "@shared/schema";
import { eq } from "drizzle-orm";

const DEFAULT_TEMPLATE_SETS = {
  LEAD_QUALIFICATION: {
    EN: {
      default: "Hi {{customer_name}}! Thanks for reaching out to {{business_name}}. We'd love to help with your {{service_type}} needs. Can you share your address so we can provide an accurate quote?",
      short: "Hi! Thanks for contacting {{business_name}}. What's your address?",
      followup: "Just checking in - still interested in getting a quote for {{service_type}}?",
    },
    ES: {
      default: "Hola {{customer_name}}! Gracias por contactar a {{business_name}}. Nos encantaría ayudarte con tus necesidades de {{service_type}}. ¿Puedes compartir tu dirección para darte un presupuesto preciso?",
      short: "Hola! Gracias por contactar a {{business_name}}. ¿Cuál es tu dirección?",
      followup: "Solo verificando - ¿sigues interesado en obtener un presupuesto para {{service_type}}?",
    },
  },
  QUOTE_FOLLOWUP: {
    EN: {
      default: "Hi {{customer_name}}, just following up on the quote we sent for {{service_type}}. Let us know if you have any questions or are ready to schedule!",
      short: "Quick check on your quote - any questions?",
      followup: "Your quote is still available. Ready to book?",
    },
    ES: {
      default: "Hola {{customer_name}}, solo dando seguimiento al presupuesto que enviamos para {{service_type}}. ¡Avísanos si tienes preguntas o estás listo para programar!",
      short: "Verificando tu presupuesto - ¿alguna pregunta?",
      followup: "Tu presupuesto sigue disponible. ¿Listo para agendar?",
    },
  },
  CREW_DAILY_BRIEFING: {
    EN: {
      default: "Good morning team! Today's schedule: {{job_count}} jobs. First stop: {{first_job_address}} at {{first_job_time}}. Check the app for full details. Have a great day!",
      short: "{{job_count}} jobs today. First: {{first_job_address}} at {{first_job_time}}",
    },
    ES: {
      default: "Buenos días equipo! Horario de hoy: {{job_count}} trabajos. Primera parada: {{first_job_address}} a las {{first_job_time}}. Revisa la app para detalles. ¡Que tengan un buen día!",
      short: "{{job_count}} trabajos hoy. Primero: {{first_job_address}} a las {{first_job_time}}",
    },
  },
  CREW_NEW_JOB_ADDED: {
    EN: {
      default: "New job added to your schedule: {{service_type}} at {{job_address}} on {{job_date}}. Customer: {{customer_name}}. Check app for details.",
      short: "New job: {{service_type}} at {{job_address}}, {{job_date}}",
    },
    ES: {
      default: "Nuevo trabajo agregado: {{service_type}} en {{job_address}} el {{job_date}}. Cliente: {{customer_name}}. Revisa la app para detalles.",
      short: "Nuevo trabajo: {{service_type}} en {{job_address}}, {{job_date}}",
    },
  },
  CREW_SCHEDULE_CHANGE: {
    EN: {
      default: "Schedule update: Your {{job_date}} job at {{job_address}} has been changed. New time: {{new_time}}. Check app for details.",
      short: "Schedule change: {{job_address}} now at {{new_time}}",
    },
    ES: {
      default: "Actualización de horario: Tu trabajo del {{job_date}} en {{job_address}} ha cambiado. Nueva hora: {{new_time}}. Revisa la app.",
      short: "Cambio de horario: {{job_address}} ahora a las {{new_time}}",
    },
  },
  REVIEW_REQUEST: {
    EN: {
      default: "Hi {{customer_name}}! We hope you're happy with your recent {{service_type}} service. Would you mind leaving us a quick review? It helps other customers find us. {{review_link}}",
      short: "Thanks for choosing us! Mind leaving a review? {{review_link}}",
    },
    ES: {
      default: "Hola {{customer_name}}! Esperamos que estés contento con tu servicio reciente de {{service_type}}. ¿Te importaría dejarnos una reseña rápida? Ayuda a otros clientes a encontrarnos. {{review_link}}",
      short: "¡Gracias por elegirnos! ¿Puedes dejarnos una reseña? {{review_link}}",
    },
  },
};

const DEFAULT_AUTOMATIONS = [
  {
    name: "Lead Qualification",
    description: "Automatically qualify new leads with initial outreach",
    audienceType: "LEAD",
    automationType: "LEAD_QUALIFICATION",
    triggerType: "EVENT",
    triggerEvent: "LEAD_CREATED",
    scheduleJson: null,
    state: "ACTIVE",
    channelsJson: ["SMS"],
    languageMode: "AUTO",
    filtersJson: null,
  },
  {
    name: "Quote Follow-up",
    description: "Follow up on quotes after 2 hours if no response",
    audienceType: "CUSTOMER",
    automationType: "QUOTE_FOLLOWUP",
    triggerType: "SCHEDULED",
    triggerEvent: "QUOTE_SENT",
    scheduleJson: { delayMinutes: 120, timezone: "America/New_York" },
    state: "ACTIVE",
    channelsJson: ["SMS"],
    languageMode: "AUTO",
    filtersJson: null,
  },
  {
    name: "Crew Daily Briefing",
    description: "Send daily schedule briefing to crews at 6:30 AM",
    audienceType: "CREW",
    automationType: "CREW_DAILY_BRIEFING",
    triggerType: "SCHEDULED",
    triggerEvent: null,
    scheduleJson: { cron: "30 6 * * *", timezone: "America/New_York", quietHoursStart: "20:00", quietHoursEnd: "06:00" },
    state: "ACTIVE",
    channelsJson: ["SMS", "IN_APP"],
    languageMode: "AUTO",
    filtersJson: null,
  },
  {
    name: "Crew New Job Added",
    description: "Notify crews when a new job is assigned",
    audienceType: "CREW",
    automationType: "CREW_NEW_JOB_ADDED",
    triggerType: "EVENT",
    triggerEvent: "JOB_ASSIGNED",
    scheduleJson: null,
    state: "ACTIVE",
    channelsJson: ["SMS", "PUSH"],
    languageMode: "AUTO",
    filtersJson: null,
  },
  {
    name: "Crew Schedule Change",
    description: "Notify crews when job times are updated",
    audienceType: "CREW",
    automationType: "CREW_SCHEDULE_CHANGE",
    triggerType: "EVENT",
    triggerEvent: "JOB_UPDATED",
    scheduleJson: null,
    state: "ACTIVE",
    channelsJson: ["SMS", "PUSH"],
    languageMode: "AUTO",
    filtersJson: null,
  },
  {
    name: "Review Request",
    description: "Request reviews after job completion",
    audienceType: "CUSTOMER",
    automationType: "REVIEW_REQUEST",
    triggerType: "EVENT",
    triggerEvent: "JOB_COMPLETED",
    scheduleJson: { delayMinutes: 60 },
    state: "ACTIVE",
    channelsJson: ["SMS"],
    languageMode: "AUTO",
    filtersJson: null,
  },
];

export async function seedCommsStudio() {
  console.log("Seeding Comms Studio data...");

  const [business] = await db.select().from(businessProfiles).limit(1);
  if (!business) {
    console.log("No business profile found, skipping Comms Studio seed");
    return;
  }

  const accountId = business.id;

  const existingAutomations = await db.select().from(commsAutomations).where(eq(commsAutomations.accountId, accountId));
  if (existingAutomations.length > 0) {
    console.log(`Found ${existingAutomations.length} existing automations, skipping seed`);
    return;
  }

  console.log("Creating template sets...");
  const templateSetMap: Record<string, number> = {};

  for (const [automationType, templates] of Object.entries(DEFAULT_TEMPLATE_SETS)) {
    for (const [lang, content] of Object.entries(templates)) {
      const audienceType = automationType.startsWith("CREW_") ? "CREW" : automationType === "LEAD_QUALIFICATION" ? "LEAD" : "CUSTOMER";
      
      const [templateSet] = await db.insert(commsTemplateSets).values({
        accountId,
        name: `${automationType} (${lang})`,
        audienceType,
        language: lang,
        templatesJson: content,
        isDefault: lang === "EN",
        isSystem: true,
      }).returning();

      if (lang === "EN") {
        templateSetMap[automationType] = templateSet.id;
      }
    }
  }
  console.log(`Created ${Object.keys(templateSetMap).length * 2} template sets (EN + ES)`);

  console.log("Creating automations...");
  for (const automation of DEFAULT_AUTOMATIONS) {
    const templateSetId = templateSetMap[automation.automationType] || null;
    
    await db.insert(commsAutomations).values({
      accountId,
      name: automation.name,
      description: automation.description,
      audienceType: automation.audienceType,
      automationType: automation.automationType,
      triggerType: automation.triggerType,
      triggerEvent: automation.triggerEvent,
      scheduleJson: automation.scheduleJson,
      state: automation.state,
      channelsJson: automation.channelsJson,
      languageMode: automation.languageMode,
      templateSetId,
      filtersJson: automation.filtersJson,
    });
  }
  console.log(`Created ${DEFAULT_AUTOMATIONS.length} automations`);

  console.log("Comms Studio seed complete!");
}

seedCommsStudio()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
