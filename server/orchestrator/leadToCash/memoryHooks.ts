import { type OrchestrationContext } from "@shared/orchestrator/contracts";
import { type OrchestrationRun, type OrchestrationStage } from "@shared/schema";
import { upsertCustomer, createMemory } from "../../memory/storage";
import { formatInteractionMemory, formatPreferenceMemory, formatOutcomeMemory } from "../../memory/formatters";

export async function writeMemoryForStage(
  run: OrchestrationRun,
  stage: OrchestrationStage,
  context: OrchestrationContext,
  outcome: "success" | "waiting" | "failed"
): Promise<{ customerId?: number; memoriesWritten: number }> {
  if (!run.businessId || !context.customerPhone) {
    return { memoriesWritten: 0 };
  }

  let memoriesWritten = 0;

  try {
    const customerResult = await upsertCustomer(run.businessId, {
      name: context.customerName || "Unknown Customer",
      phone: context.customerPhone,
      address: context.address,
      accountId: run.accountId,
      jobRequestId: run.primaryEntityId,
    });

    const customerId = customerResult.customerId;

    switch (stage) {
      case "LEAD_INTAKE":
        if (outcome === "success" && context.services && context.services.length > 0) {
          const intakeText = formatInteractionMemory({
            customerName: context.customerName || "Customer",
            serviceType: context.services.join(", "),
            channel: run.channel || "web",
            keyPoints: [
              `Address: ${context.address || "Not provided"}`,
              `Frequency: ${context.frequency || "Not specified"}`,
              context.lotAreaSqft ? `Lot size: ${context.lotAreaSqft} sqft` : null,
            ].filter(Boolean) as string[],
          });
          
          await createMemory({
            businessId: run.businessId,
            customerId,
            accountId: run.accountId,
            memoryType: "interaction",
            channel: run.channel,
            importance: 4,
            text: intakeText,
            sourceEntityType: "orchestration_run",
            sourceEntityId: run.runId,
            tagsJson: { stage: "LEAD_INTAKE", services: context.services },
          });
          memoriesWritten++;
        }
        break;

      case "QUOTE_CONFIRM":
        if (context.rangeLow && context.rangeHigh) {
          let sentiment = 0;
          let importance = 4;
          let outcomeType: "accepted" | "declined" | "question" = "question";
          
          if (outcome === "success") {
            outcomeType = "accepted";
            sentiment = 1;
            importance = 5;
          } else if (outcome === "failed") {
            outcomeType = "declined";
            sentiment = -1;
          }
          
          const outcomeText = formatOutcomeMemory({
            customerName: context.customerName || "Customer",
            serviceType: context.services?.join(", "),
            outcome: outcomeType,
            quoteLow: context.rangeLow,
            quoteHigh: context.rangeHigh,
          });
          
          await createMemory({
            businessId: run.businessId,
            customerId,
            accountId: run.accountId,
            memoryType: "outcome",
            importance,
            sentiment,
            text: outcomeText,
            sourceEntityType: "orchestration_run",
            sourceEntityId: run.runId,
            tagsJson: { stage: "QUOTE_CONFIRM", outcome },
          });
          memoriesWritten++;
        }
        break;

      case "SCHEDULE_PROPOSE":
        if (outcome === "success" && context.selectedWindow) {
          const preferenceText = formatPreferenceMemory({
            customerName: context.customerName || "Customer",
            preferredTimeWindow: context.selectedWindow.startISO,
            notes: "Selected from proposed time windows",
          });
          
          await createMemory({
            businessId: run.businessId,
            customerId,
            accountId: run.accountId,
            memoryType: "preference",
            importance: 4,
            text: preferenceText,
            sourceEntityType: "orchestration_run",
            sourceEntityId: run.runId,
            tagsJson: { 
              stage: "SCHEDULE_PROPOSE", 
              selectedWindow: context.selectedWindow,
            },
          });
          memoriesWritten++;
        }
        break;

      case "CREW_LOCK":
        if (outcome === "success" && context.selectedCrewName) {
          const crewPreferenceText = formatPreferenceMemory({
            customerName: context.customerName || "Customer",
            notes: `Assigned crew: ${context.selectedCrewName}`,
          });
          
          await createMemory({
            businessId: run.businessId,
            customerId,
            accountId: run.accountId,
            memoryType: "preference",
            importance: 3,
            text: crewPreferenceText,
            sourceEntityType: "orchestration_run",
            sourceEntityId: run.runId,
            tagsJson: { 
              stage: "CREW_LOCK", 
              crewId: context.selectedCrewId,
              crewName: context.selectedCrewName,
            },
          });
          memoriesWritten++;
        }
        break;

      case "JOB_BOOKED":
        if (outcome === "success") {
          const jobBookedText = formatOutcomeMemory({
            customerName: context.customerName || "Customer",
            serviceType: context.services?.join(", "),
            outcome: "completed",
            feedback: `Job booked with ${context.selectedCrewName || "crew"} for ${context.scheduledStartISO || "TBD"}`,
          });
          
          await createMemory({
            businessId: run.businessId,
            customerId,
            accountId: run.accountId,
            memoryType: "outcome",
            importance: 5,
            sentiment: 1,
            text: jobBookedText,
            serviceType: context.services?.[0],
            sourceEntityType: "orchestration_run",
            sourceEntityId: run.runId,
            tagsJson: { 
              stage: "JOB_BOOKED", 
              externalJobId: context.externalJobId,
            },
          });
          memoriesWritten++;
        }
        break;
    }

    return { customerId, memoriesWritten };
  } catch (error) {
    console.error(`[MemoryHooks] Error writing memory for stage ${stage}:`, error);
    return { memoriesWritten };
  }
}

export async function enrichContextWithCustomerInsights(
  businessId: number,
  context: OrchestrationContext
): Promise<OrchestrationContext> {
  if (!context.customerPhone) {
    return context;
  }

  try {
    const { getCustomerByPhone, getRecentMemories } = await import("../../memory/storage");
    
    const customer = await getCustomerByPhone(businessId, context.customerPhone);
    if (!customer) {
      return context;
    }

    const memories = await getRecentMemories(businessId, customer.id, 10);
    
    const preferenceMemories = memories.filter(m => m.memoryType === "preference");
    const preferredCrews: string[] = [];
    const preferredTimeSlots: string[] = [];
    const notablePreferences: string[] = [];
    
    for (const mem of preferenceMemories) {
      const tags = mem.tagsJson as Record<string, unknown> | null;
      if (tags?.crewName) {
        preferredCrews.push(tags.crewName as string);
      }
      if (tags?.selectedWindow) {
        const window = tags.selectedWindow as { startISO?: string };
        if (window.startISO) {
          const hour = new Date(window.startISO).getHours();
          if (hour < 10) preferredTimeSlots.push("morning");
          else if (hour < 14) preferredTimeSlots.push("midday");
          else preferredTimeSlots.push("afternoon");
        }
      }
      notablePreferences.push(mem.text);
    }

    const outcomeMemories = memories.filter(m => m.memoryType === "outcome");
    const priorServices: string[] = [];
    for (const mem of outcomeMemories) {
      const tags = mem.tagsJson as Record<string, unknown> | null;
      if (tags?.stage === "JOB_BOOKED" && context.services) {
        priorServices.push(...context.services);
      }
    }

    const lastInteraction = memories[0];
    
    return {
      ...context,
      customerId: customer.id,
      customerInsights: {
        preferredCrew: preferredCrews[0],
        preferredTimeSlots: Array.from(new Set(preferredTimeSlots)),
        priorServices: Array.from(new Set(priorServices)),
        notablePreferences: notablePreferences.slice(0, 3),
        lastInteractionSummary: lastInteraction?.text,
      },
    };
  } catch (error) {
    console.error("[MemoryHooks] Error enriching context:", error);
    return context;
  }
}
