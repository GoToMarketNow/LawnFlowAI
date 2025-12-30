import { storage } from "../storage";
import { plan, getDefaultPolicy, type EventContext, type StateContext } from "./supervisor";
import { execute } from "./runner";
import { audit, metrics, comms, fsm, approvals } from "../tools";
import { twilioConnector } from "../connectors/twilio-mock";
import { formatScheduleConfirmation } from "../agents/schedule";
import type { Conversation, BusinessProfile } from "@shared/schema";
import { randomUUID } from "crypto";

export interface EventPayload {
  type: "missed_call" | "inbound_sms" | "web_lead" | "job_completed";
  data: Record<string, unknown>;
  eventId?: string;
}

export interface ProcessingResult {
  success: boolean;
  message: string;
  conversationId?: number;
  eventId?: number;
  planId?: string;
  actions?: string[];
  stoppedForApproval?: boolean;
  approvalId?: string;
}

async function getBusinessContext(): Promise<{
  businessName: string;
  services: string[];
  serviceArea: string;
}> {
  const profile = await storage.getBusinessProfile();
  return {
    businessName: profile?.name || "Green Thumb Landscaping",
    services: profile?.services || ["Lawn Mowing", "Landscaping", "Tree Trimming"],
    serviceArea: profile?.serviceArea || "Local area",
  };
}

export const orchestrator = {
  async handleEvent(payload: EventPayload): Promise<ProcessingResult> {
    const eventId = payload.eventId || `evt_${randomUUID()}`;
    console.log(`[Orchestrator] Handling event ${eventId}: ${payload.type}`);

    try {
      const existingReceipt = await storage.getEventReceipt(eventId);
      if (existingReceipt) {
        console.log(`[Orchestrator] Event ${eventId} already processed (idempotency check)`);
        return {
          success: true,
          message: "Event already processed",
          eventId: existingReceipt.id,
        };
      }

      await storage.createEventReceipt({
        eventId,
        eventType: payload.type,
        status: "processing",
      });

      const event = await storage.createEvent({
        type: payload.type,
        payload: payload.data,
        status: "processing",
      });

      await audit.logEvent({
        action: "orchestrator.handleEvent.start",
        actor: "system",
        payload: { eventId, type: payload.type },
      });

      const businessContext = await getBusinessContext();

      const phone = payload.data.phone as string | undefined;
      let conversation: Conversation | undefined;
      let messagesList: any[] = [];
      
      if (phone) {
        conversation = await storage.getConversationByPhone(phone);
        if (conversation) {
          messagesList = await storage.getMessagesByConversation(conversation.id);
        }
      }

      const eventContext: EventContext = {
        type: payload.type as any,
        data: payload.data,
        eventId,
      };

      const stateContext: StateContext = {
        conversation,
        messages: messagesList,
        businessName: businessContext.businessName,
        services: businessContext.services,
        serviceArea: businessContext.serviceArea,
      };

      const policy = getDefaultPolicy();
      const supervisorPlan = await plan(eventContext, stateContext, policy);
      const executionResult = await execute(supervisorPlan, stateContext, conversation || null);

      await storage.updateEvent(event.id, {
        status: executionResult.success ? "completed" : "failed",
        processedAt: new Date(),
        conversationId: executionResult.conversationId,
      });

      await storage.updateEventReceipt(eventId, {
        status: executionResult.success ? "completed" : "failed",
        result: executionResult as any,
        completedAt: new Date(),
      });

      await metrics.record({
        name: "event_processed",
        value: 1,
        tags: { type: payload.type, success: String(executionResult.success) },
      });

      return {
        success: executionResult.success,
        message: executionResult.stopReason || "Event processed successfully",
        conversationId: executionResult.conversationId,
        eventId: event.id,
        planId: executionResult.planId,
        stoppedForApproval: !!executionResult.stoppedAtStep,
        approvalId: executionResult.completedSteps.find(s => s.approvalId)?.approvalId,
        actions: executionResult.completedSteps.map(s => s.stepId),
      };

    } catch (error) {
      console.error("[Orchestrator] Error handling event:", error);
      
      await storage.updateEventReceipt(eventId, {
        status: "failed",
        result: { error: error instanceof Error ? error.message : "Unknown error" },
        completedAt: new Date(),
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : "Event processing failed",
      };
    }
  },
};

export async function processEvent(payload: EventPayload): Promise<ProcessingResult> {
  return orchestrator.handleEvent(payload);
}

export async function approveAction(
  actionId: number,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  const action = await storage.getPendingAction(actionId);
  if (!action) {
    return { success: false, message: "Action not found" };
  }

  if (action.status !== "pending") {
    return { success: false, message: "Action already resolved" };
  }

  const payload = action.payload as Record<string, unknown>;
  const conversation = await storage.getConversation(action.conversationId);
  const businessProfile = await storage.getBusinessProfile();

  try {
    switch (action.actionType) {
      case "send_quote": {
        const message = String(payload.message || "");
        if (conversation) {
          await storage.createMessage({
            conversationId: conversation.id,
            role: "ai",
            content: message,
          });
          await comms.sendSms({ to: conversation.customerPhone, text: message });
        }
        break;
      }

      case "schedule_job": {
        const scheduledDate = payload.proposedDate
          ? new Date(String(payload.proposedDate))
          : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

        const job = await storage.createJob({
          conversationId: action.conversationId,
          businessId: businessProfile?.id || null,
          customerName: String(payload.customerName || ""),
          customerPhone: String(payload.phone || conversation?.customerPhone || ""),
          customerAddress: payload.address as string || null,
          serviceType: String(payload.serviceType || ""),
          scheduledDate,
          estimatedPrice: Number(payload.estimatedPrice) || null,
          status: "scheduled",
          notes: notes || (payload.notes as string) || null,
        });

        const jobResult = await fsm.createJob({
          leadId: payload.leadId as string || `lead_${action.conversationId}`,
          start_iso: scheduledDate.toISOString(),
          end_iso: new Date(scheduledDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
          service_type: String(payload.serviceType || ""),
          notes: `Job ${job.id} for ${payload.customerName}`,
        });

        await audit.logEvent({
          action: "job.created",
          actor: "operator",
          payload: { jobId: job.id, fsmJobId: jobResult.jobId, fromAction: actionId },
        });

        if (conversation) {
          await storage.updateConversation(conversation.id, {
            status: "scheduled",
            agentType: "schedule",
          });

          const confirmMessage = formatScheduleConfirmation(
            scheduledDate,
            String(payload.serviceType),
            businessProfile?.name || "Our team",
            String(payload.customerName)
          );

          await storage.createMessage({
            conversationId: conversation.id,
            role: "ai",
            content: confirmMessage,
          });

          await comms.sendSms({ to: conversation.customerPhone, text: confirmMessage });
        }
        break;
      }

      case "send_sms": {
        const message = String(payload.message || "");
        const phone = String(payload.phone || conversation?.customerPhone || "");
        if (phone && message) {
          await comms.sendSms({ to: phone, text: message });
          if (conversation) {
            await storage.createMessage({
              conversationId: conversation.id,
              role: "ai",
              content: message,
            });
          }
        }
        break;
      }
    }

    await approvals.resolveApproval({
      approvalId: `approval_${actionId}`,
      decision: "approved",
      notes: notes || null,
    });

    await audit.logEvent({
      action: "action.approved",
      actor: "operator",
      payload: { actionId, notes },
    });

    return { success: true, message: "Action approved and executed" };
  } catch (error) {
    console.error("[Orchestrator] Error approving action:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Approval failed",
    };
  }
}

export async function rejectAction(
  actionId: number,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  const action = await storage.getPendingAction(actionId);
  if (!action) {
    return { success: false, message: "Action not found" };
  }

  if (action.status !== "pending") {
    return { success: false, message: "Action already resolved" };
  }

  await approvals.resolveApproval({
    approvalId: `approval_${actionId}`,
    decision: "rejected",
    notes: notes || null,
  });

  await audit.logEvent({
    action: "action.rejected",
    actor: "operator",
    payload: { actionId, notes },
  });

  return { success: true, message: "Action rejected" };
}

export async function simulateJobCompleted(jobId: number): Promise<ProcessingResult> {
  const job = await storage.getJob(jobId);
  if (!job) {
    return { success: false, message: "Job not found" };
  }

  await storage.updateJob(jobId, {
    status: "completed",
  });

  await audit.logEvent({
    action: "job.completed",
    actor: "system",
    payload: { jobId },
  });

  const result = await orchestrator.handleEvent({
    type: "job_completed",
    data: {
      jobId,
      phone: job.customerPhone,
      customerName: job.customerName,
      serviceType: job.serviceType,
    },
    eventId: `job_completed_${jobId}_${Date.now()}`,
  });

  return result;
}

export { plan } from "./supervisor";
export { execute } from "./runner";
