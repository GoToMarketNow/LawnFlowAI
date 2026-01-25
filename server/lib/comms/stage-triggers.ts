import { 
  CommunicationIntent, 
  createIntent,
  Recipient,
  BusinessContext,
  JobContext,
  QuoteContext,
  ScheduleContext,
} from "@shared/comms-schema";
import { commsOrchestrator } from "./orchestrator";
import { db } from "../../db";
import { businessProfiles } from "@shared/schema";
import { eq } from "drizzle-orm";

type OrchestrationStage = 
  | "LEAD_INTAKE"
  | "QUOTE_BUILD"
  | "QUOTE_CONFIRM"
  | "SCHEDULE_PROPOSE"
  | "SIMULATION_RUN"
  | "FEASIBILITY_CHECK"
  | "MARGIN_VALIDATE"
  | "CREW_LOCK"
  | "DISPATCH_READY"
  | "JOB_BOOKED";

interface StageContext {
  businessId: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  address?: string;
  services?: string[];
  frequency?: string;
  quoteAmount?: number;
  quoteLow?: number;
  quoteHigh?: number;
  lotAreaSqft?: number;
  proposedWindows?: Array<{ date: string; timeWindow: string; startISO?: string; endISO?: string }>;
  selectedWindow?: { date: string; timeWindow: string; startISO?: string; endISO?: string };
  selectedCrewId?: string;
  crewName?: string;
  jobRequestId?: number;
  correlationId?: string;
}

async function getBusinessContext(businessId: number): Promise<BusinessContext | null> {
  const [profile] = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.id, businessId))
    .limit(1);

  if (!profile) return null;

  return {
    businessId: profile.id,
    businessName: profile.name,
    businessPhone: profile.phone,
    businessEmail: profile.email || undefined,
    businessAddress: profile.address || undefined,
  };
}

function buildRecipient(ctx: StageContext): Recipient {
  const [firstName, ...lastParts] = (ctx.customerName || "").split(" ");
  const lastName = lastParts.join(" ");

  return {
    phone: ctx.customerPhone || "",
    firstName: firstName || undefined,
    lastName: lastName || undefined,
  };
}

export async function triggerStageComms(
  stage: OrchestrationStage,
  context: StageContext,
  outcome?: string
): Promise<void> {
  const business = await getBusinessContext(context.businessId);
  if (!business) {
    console.log(`[CommsStage] No business found for ID ${context.businessId}`);
    return;
  }

  if (!context.customerPhone) {
    console.log(`[CommsStage] No customer phone for stage ${stage}`);
    return;
  }

  const recipient = buildRecipient(context);

  try {
    switch (stage) {
      case "LEAD_INTAKE":
        await triggerLeadIntakeComms(recipient, business, context);
        break;

      case "QUOTE_BUILD":
        await triggerQuoteBuildComms(recipient, business, context);
        break;

      case "QUOTE_CONFIRM":
        await triggerQuoteConfirmComms(recipient, business, context, outcome);
        break;

      case "SCHEDULE_PROPOSE":
        await triggerScheduleProposeComms(recipient, business, context);
        break;

      case "CREW_LOCK":
        await triggerCrewLockComms(recipient, business, context, outcome);
        break;

      case "JOB_BOOKED":
        await triggerJobBookedComms(recipient, business, context);
        break;

      default:
        console.log(`[CommsStage] No comms trigger defined for stage ${stage}`);
    }
  } catch (error) {
    console.error(`[CommsStage] Error triggering comms for ${stage}:`, error);
  }
}

async function triggerLeadIntakeComms(
  recipient: Recipient,
  business: BusinessContext,
  context: StageContext
): Promise<void> {
  const intent: CommunicationIntent = createIntent(
    "lead_acknowledgment",
    recipient,
    business,
    {
      orchestratorStage: "LEAD_INTAKE",
      triggeredBy: "orchestrator",
      correlationId: context.correlationId,
      job: {
        serviceType: context.services?.join(", ") || "service",
        propertyAddress: context.address,
      },
    }
  );

  await commsOrchestrator.processIntent(intent);
  console.log(`[CommsStage] Sent lead acknowledgment to ${recipient.phone}`);
}

async function triggerQuoteBuildComms(
  recipient: Recipient,
  business: BusinessContext,
  context: StageContext
): Promise<void> {
  const quoteAmount = context.quoteAmount || 
    (context.quoteLow && context.quoteHigh ? Math.round((context.quoteLow + context.quoteHigh) / 2) : undefined);

  if (!quoteAmount) {
    console.log(`[CommsStage] No quote amount available for quote delivery`);
    return;
  }

  const intent: CommunicationIntent = createIntent(
    "quote_delivery",
    recipient,
    business,
    {
      orchestratorStage: "QUOTE_BUILD",
      triggeredBy: "orchestrator",
      correlationId: context.correlationId,
      job: {
        serviceType: context.services?.join(", ") || "service",
        propertyAddress: context.address,
      },
      quote: {
        totalAmount: quoteAmount,
        formattedTotal: `$${quoteAmount}`,
        lotSize: context.lotAreaSqft ? `${context.lotAreaSqft.toLocaleString()} sq ft` : undefined,
        frequency: context.frequency,
      },
    }
  );

  await commsOrchestrator.processIntent(intent);
  console.log(`[CommsStage] Sent quote delivery to ${recipient.phone}`);
}

async function triggerQuoteConfirmComms(
  recipient: Recipient,
  business: BusinessContext,
  context: StageContext,
  outcome?: string
): Promise<void> {
  if (outcome === "accepted") {
    const intent: CommunicationIntent = createIntent(
      "quote_approved",
      recipient,
      business,
      {
        orchestratorStage: "QUOTE_CONFIRM",
        triggeredBy: "orchestrator",
        correlationId: context.correlationId,
        job: {
          serviceType: context.services?.join(", ") || "service",
        },
      }
    );

    await commsOrchestrator.processIntent(intent);
    console.log(`[CommsStage] Sent quote approved confirmation to ${recipient.phone}`);
  } else if (outcome === "declined") {
    const intent: CommunicationIntent = createIntent(
      "quote_declined",
      recipient,
      business,
      {
        orchestratorStage: "QUOTE_CONFIRM",
        triggeredBy: "orchestrator",
        correlationId: context.correlationId,
      }
    );

    await commsOrchestrator.processIntent(intent);
    console.log(`[CommsStage] Sent quote declined acknowledgment to ${recipient.phone}`);
  }
}

async function triggerScheduleProposeComms(
  recipient: Recipient,
  business: BusinessContext,
  context: StageContext
): Promise<void> {
  if (!context.proposedWindows || context.proposedWindows.length === 0) {
    console.log(`[CommsStage] No proposed windows for schedule proposal`);
    return;
  }

  const intent: CommunicationIntent = createIntent(
    "schedule_proposal",
    recipient,
    business,
    {
      orchestratorStage: "SCHEDULE_PROPOSE",
      triggeredBy: "orchestrator",
      correlationId: context.correlationId,
      job: {
        serviceType: context.services?.join(", ") || "service",
      },
      schedule: {
        proposedWindows: context.proposedWindows.map(w => ({
          date: w.date,
          timeWindow: w.timeWindow,
          available: true,
        })),
      },
    }
  );

  await commsOrchestrator.processIntent(intent);
  console.log(`[CommsStage] Sent schedule proposal to ${recipient.phone}`);
}

async function triggerCrewLockComms(
  recipient: Recipient,
  business: BusinessContext,
  context: StageContext,
  outcome?: string
): Promise<void> {
  if (outcome === "auto_approved" || outcome === "ops_approved") {
    const intent: CommunicationIntent = createIntent(
      "approval_confirmation",
      recipient,
      business,
      {
        orchestratorStage: "CREW_LOCK",
        triggeredBy: "orchestrator",
        correlationId: context.correlationId,
        job: {
          serviceType: context.services?.join(", ") || "service",
          crewName: context.crewName,
        },
      }
    );

    await commsOrchestrator.processIntent(intent);
    console.log(`[CommsStage] Sent crew lock approval confirmation to ${recipient.phone}`);
  }
}

async function triggerJobBookedComms(
  recipient: Recipient,
  business: BusinessContext,
  context: StageContext
): Promise<void> {
  if (!context.selectedWindow) {
    console.log(`[CommsStage] No selected window for job booked confirmation`);
    return;
  }

  const intent: CommunicationIntent = createIntent(
    "schedule_confirmation",
    recipient,
    business,
    {
      orchestratorStage: "JOB_BOOKED",
      triggeredBy: "orchestrator",
      correlationId: context.correlationId,
      job: {
        serviceType: context.services?.join(", ") || "service",
        scheduledDate: context.selectedWindow.date,
        scheduledTimeWindow: context.selectedWindow.timeWindow,
        propertyAddress: context.address,
        crewName: context.crewName,
      },
    }
  );

  await commsOrchestrator.processIntent(intent);
  console.log(`[CommsStage] Sent job booked confirmation to ${recipient.phone}`);
}

export async function triggerQuoteReminder(
  businessId: number,
  customerPhone: string,
  customerName: string,
  serviceType: string,
  quoteAmount: number
): Promise<void> {
  const business = await getBusinessContext(businessId);
  if (!business) return;

  const [firstName, ...lastParts] = customerName.split(" ");
  const recipient: Recipient = {
    phone: customerPhone,
    firstName,
    lastName: lastParts.join(" ") || undefined,
  };

  const intent: CommunicationIntent = createIntent(
    "quote_reminder",
    recipient,
    business,
    {
      triggeredBy: "scheduled",
      job: { serviceType },
      quote: {
        totalAmount: quoteAmount,
        formattedTotal: `$${quoteAmount}`,
      },
    }
  );

  await commsOrchestrator.processIntent(intent);
}

export async function triggerScheduleReminder(
  businessId: number,
  customerPhone: string,
  customerName: string,
  serviceType: string,
  scheduledDate: string,
  timeWindow: string
): Promise<void> {
  const business = await getBusinessContext(businessId);
  if (!business) return;

  const [firstName, ...lastParts] = customerName.split(" ");
  const recipient: Recipient = {
    phone: customerPhone,
    firstName,
    lastName: lastParts.join(" ") || undefined,
  };

  const intent: CommunicationIntent = createIntent(
    "schedule_reminder",
    recipient,
    business,
    {
      triggeredBy: "scheduled",
      job: {
        serviceType,
        scheduledDate,
        scheduledTimeWindow: timeWindow,
      },
    }
  );

  await commsOrchestrator.processIntent(intent);
}

export async function triggerJobComplete(
  businessId: number,
  customerPhone: string,
  customerName: string,
  serviceType: string,
  propertyAddress: string,
  jobNotes?: string
): Promise<void> {
  const business = await getBusinessContext(businessId);
  if (!business) return;

  const [firstName, ...lastParts] = customerName.split(" ");
  const recipient: Recipient = {
    phone: customerPhone,
    firstName,
    lastName: lastParts.join(" ") || undefined,
  };

  const intent: CommunicationIntent = createIntent(
    "job_complete",
    recipient,
    business,
    {
      triggeredBy: "worker",
      job: {
        serviceType,
        propertyAddress,
        jobNotes,
      },
    }
  );

  await commsOrchestrator.processIntent(intent);
}

export async function triggerReviewRequest(
  businessId: number,
  customerPhone: string,
  customerName: string,
  reviewUrl?: string
): Promise<void> {
  const business = await getBusinessContext(businessId);
  if (!business) return;

  const [firstName, ...lastParts] = customerName.split(" ");
  const recipient: Recipient = {
    phone: customerPhone,
    firstName,
    lastName: lastParts.join(" ") || undefined,
  };

  const intent: CommunicationIntent = createIntent(
    "review_request",
    recipient,
    business,
    {
      triggeredBy: "worker",
      customVariables: reviewUrl ? { reviewUrl } : undefined,
    }
  );

  await commsOrchestrator.processIntent(intent);
}
