// Event Orchestrator
// Handles event-driven workflow execution

import { storage } from "../storage";
import { twilioConnector } from "../connectors/twilio-mock";
import { fsmConnector } from "../connectors/fsm-mock";
import { runIntakeAgent, generateMissedCallResponse } from "../agents/intake";
import { generateQuote } from "../agents/quote";
import { proposeSchedule, formatScheduleConfirmation } from "../agents/schedule";
import type { Conversation, BusinessProfile } from "@shared/schema";

export interface EventPayload {
  type: "missed_call" | "inbound_sms" | "web_lead";
  data: Record<string, unknown>;
}

export interface ProcessingResult {
  success: boolean;
  message: string;
  conversationId?: number;
  eventId?: number;
  actions?: string[];
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

async function logAudit(
  entityType: string,
  entityId: number,
  action: string,
  details?: Record<string, unknown>
) {
  try {
    await storage.createAuditLog({
      entityType,
      entityId,
      action,
      details: details || null,
    });
  } catch (error) {
    console.error("[Orchestrator] Failed to log audit:", error);
  }
}

export async function processEvent(payload: EventPayload): Promise<ProcessingResult> {
  console.log(`[Orchestrator] Processing ${payload.type} event`);
  const businessContext = await getBusinessContext();

  try {
    // Create the event record
    const event = await storage.createEvent({
      type: payload.type,
      payload: payload.data,
      status: "processing",
    });

    let result: ProcessingResult;

    switch (payload.type) {
      case "missed_call":
        result = await handleMissedCall(payload.data, businessContext, event.id);
        break;
      case "inbound_sms":
        result = await handleInboundSMS(payload.data, businessContext, event.id);
        break;
      case "web_lead":
        result = await handleWebLead(payload.data, businessContext, event.id);
        break;
      default:
        result = { success: false, message: "Unknown event type" };
    }

    // Update event status
    await storage.updateEvent(event.id, {
      status: result.success ? "completed" : "failed",
      processedAt: new Date(),
      conversationId: result.conversationId,
    });

    await logAudit("event", event.id, "processed", { type: payload.type, success: result.success });

    return { ...result, eventId: event.id };
  } catch (error) {
    console.error("[Orchestrator] Error processing event:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Processing failed",
    };
  }
}

async function handleMissedCall(
  data: Record<string, unknown>,
  businessContext: { businessName: string; services: string[]; serviceArea: string },
  eventId: number
): Promise<ProcessingResult> {
  const phone = String(data.phone || "");
  const customerName = data.customerName as string | undefined;

  if (!phone) {
    return { success: false, message: "No phone number provided" };
  }

  // Check for existing conversation
  let conversation = await storage.getConversationByPhone(phone);

  if (!conversation) {
    // Create new conversation
    conversation = await storage.createConversation({
      customerPhone: phone,
      customerName: customerName || null,
      source: "missed_call",
      status: "active",
      agentType: "intake",
    });

    await logAudit("conversation", conversation.id, "created", { source: "missed_call" });
  }

  // Generate and "send" missed call SMS
  const responseMessage = await generateMissedCallResponse(businessContext.businessName, phone);

  // Add system message
  await storage.createMessage({
    conversationId: conversation.id,
    role: "system",
    content: `Missed call received from ${phone}`,
  });

  // Add AI response message
  await storage.createMessage({
    conversationId: conversation.id,
    role: "ai",
    content: responseMessage,
  });

  // Mock send SMS
  const smsResult = await twilioConnector.sendSMS(phone, responseMessage);

  await logAudit("conversation", conversation.id, "message_sent", {
    type: "missed_call_response",
    sid: smsResult.sid,
  });

  return {
    success: true,
    message: `Sent missed call response to ${phone}`,
    conversationId: conversation.id,
    actions: ["Created conversation", "Sent SMS response"],
  };
}

async function handleInboundSMS(
  data: Record<string, unknown>,
  businessContext: { businessName: string; services: string[]; serviceArea: string },
  eventId: number
): Promise<ProcessingResult> {
  const phone = String(data.phone || "");
  const message = String(data.message || "");
  const customerName = data.customerName as string | undefined;

  if (!phone || !message) {
    return { success: false, message: "Missing phone or message" };
  }

  // Check for existing conversation or create new
  let conversation = await storage.getConversationByPhone(phone);
  const isNew = !conversation;

  if (!conversation) {
    conversation = await storage.createConversation({
      customerPhone: phone,
      customerName: customerName || null,
      source: "inbound_sms",
      status: "active",
      agentType: "intake",
    });

    await logAudit("conversation", conversation.id, "created", { source: "inbound_sms" });
  }

  // Add customer message
  await storage.createMessage({
    conversationId: conversation.id,
    role: "customer",
    content: message,
  });

  // Run intake agent
  const intakeResult = await runIntakeAgent(message, phone, businessContext);

  // Update conversation with extracted info
  if (intakeResult.customerName || intakeResult.serviceType) {
    await storage.updateConversation(conversation.id, {
      customerName: intakeResult.customerName || conversation.customerName,
      status: intakeResult.isQualified ? "qualified" : "active",
    });
  }

  // If qualified, generate a quote and create pending action
  if (intakeResult.isQualified && intakeResult.serviceType) {
    const quote = await generateQuote(intakeResult.serviceType, {
      name: intakeResult.customerName,
      address: intakeResult.address,
      notes: intakeResult.notes,
    }, businessContext);

    // Create pending action for approval
    await storage.createPendingAction({
      conversationId: conversation.id,
      actionType: "send_quote",
      description: `Send quote of $${(quote.estimatedPrice / 100).toFixed(2)} for ${intakeResult.serviceType} to ${intakeResult.customerName || phone}`,
      payload: {
        estimatedPrice: quote.estimatedPrice,
        serviceType: intakeResult.serviceType,
        message: quote.suggestedMessage,
        customerName: intakeResult.customerName,
        address: intakeResult.address,
      },
      status: "pending",
    });

    await logAudit("conversation", conversation.id, "pending_action_created", {
      type: "send_quote",
      price: quote.estimatedPrice,
    });

    // Add system message about pending action
    await storage.createMessage({
      conversationId: conversation.id,
      role: "system",
      content: `Quote generated for $${(quote.estimatedPrice / 100).toFixed(2)}. Awaiting approval to send.`,
    });
  } else {
    // Send intake response directly (lower risk)
    await storage.createMessage({
      conversationId: conversation.id,
      role: "ai",
      content: intakeResult.suggestedResponse,
    });

    await twilioConnector.sendSMS(phone, intakeResult.suggestedResponse);
  }

  return {
    success: true,
    message: intakeResult.isQualified
      ? "Lead qualified, quote pending approval"
      : "Intake response sent",
    conversationId: conversation.id,
    actions: isNew ? ["Created conversation", "Processed intake"] : ["Processed intake"],
  };
}

async function handleWebLead(
  data: Record<string, unknown>,
  businessContext: { businessName: string; services: string[]; serviceArea: string },
  eventId: number
): Promise<ProcessingResult> {
  const customerName = String(data.customerName || "");
  const phone = String(data.phone || "");
  const email = data.email as string | undefined;
  const serviceRequested = String(data.serviceRequested || "General inquiry");
  const notes = data.notes as string | undefined;

  if (!phone || !customerName) {
    return { success: false, message: "Missing required customer info" };
  }

  // Create conversation
  const conversation = await storage.createConversation({
    customerPhone: phone,
    customerName: customerName,
    source: "web_lead",
    status: "qualified",
    agentType: "quote",
  });

  await logAudit("conversation", conversation.id, "created", { source: "web_lead" });

  // Add system message
  await storage.createMessage({
    conversationId: conversation.id,
    role: "system",
    content: `Web lead received: ${customerName} interested in ${serviceRequested}${notes ? `. Notes: ${notes}` : ""}`,
  });

  // Generate quote
  const quote = await generateQuote(serviceRequested, {
    name: customerName,
    notes: notes,
  }, businessContext);

  // Generate schedule proposal
  const schedule = await proposeSchedule(
    notes || `Interested in ${serviceRequested}`,
    serviceRequested,
    { name: customerName, phone },
    businessContext
  );

  // Create pending action for scheduling
  await storage.createPendingAction({
    conversationId: conversation.id,
    actionType: "schedule_job",
    description: `Schedule ${serviceRequested} for ${customerName} at $${(quote.estimatedPrice / 100).toFixed(2)}`,
    payload: {
      customerName,
      phone,
      email,
      serviceType: serviceRequested,
      estimatedPrice: quote.estimatedPrice,
      proposedDate: schedule.proposedDateISO || null,
      notes,
    },
    status: "pending",
  });

  await logAudit("conversation", conversation.id, "pending_action_created", {
    type: "schedule_job",
  });

  // Add AI message
  await storage.createMessage({
    conversationId: conversation.id,
    role: "ai",
    content: schedule.suggestedMessage,
  });

  return {
    success: true,
    message: `Web lead processed, scheduling action pending`,
    conversationId: conversation.id,
    actions: ["Created conversation", "Generated quote", "Proposed schedule"],
  };
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
          await twilioConnector.sendSMS(conversation.customerPhone, message);
        }
        break;
      }

      case "schedule_job": {
        // Create job in FSM
        const scheduledDate = payload.proposedDate
          ? new Date(String(payload.proposedDate))
          : fsmConnector.getNextAvailableSlot();

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

        await logAudit("job", job.id, "created", { fromAction: actionId });

        // Update conversation status
        if (conversation) {
          await storage.updateConversation(conversation.id, {
            status: "scheduled",
            agentType: "schedule",
          });

          // Send confirmation
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

          await twilioConnector.sendSMS(conversation.customerPhone, confirmMessage);
        }
        break;
      }

      case "send_sms": {
        const message = String(payload.message || "");
        const phone = String(payload.phone || conversation?.customerPhone || "");
        if (phone && message) {
          await twilioConnector.sendSMS(phone, message);
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

    // Update action status
    await storage.updatePendingAction(actionId, {
      status: "approved",
      resolvedAt: new Date(),
      resolvedBy: "admin",
    });

    await logAudit("action", actionId, "approved", { notes });

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

  await storage.updatePendingAction(actionId, {
    status: "rejected",
    resolvedAt: new Date(),
    resolvedBy: "admin",
  });

  await logAudit("action", actionId, "rejected", { notes });

  return { success: true, message: "Action rejected" };
}
