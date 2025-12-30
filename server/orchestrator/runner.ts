import { z } from "zod";
import { storage } from "../storage";
import { comms, fsm, approvals, audit, metrics } from "../tools";
import { runIntakeAgent, generateMissedCallResponse } from "../agents/intake";
import { generateQuote } from "../agents/quote";
import { proposeSchedule, formatScheduleConfirmation } from "../agents/schedule";
import type { SupervisorPlan, Step, StateContext } from "./supervisor";
import type { Conversation } from "@shared/schema";

async function generateReviewRequest(
  businessName: string,
  customerName?: string,
  serviceType?: string
): Promise<string> {
  const greeting = customerName ? `Hi ${customerName}! ` : "";
  return `${greeting}Thanks for choosing ${businessName}! We hope you loved your ${serviceType || "service"}. If you have a moment, we'd really appreciate a review. Thank you!`;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  stopped?: boolean;
  stopReason?: string;
  approvalId?: string;
}

export interface ExecutionResult {
  planId: string;
  success: boolean;
  completedSteps: StepResult[];
  stoppedAtStep?: string;
  stopReason?: string;
  conversationId?: number;
  leadId?: string;
  jobId?: number;
}

export async function execute(
  plan: SupervisorPlan,
  state: StateContext,
  conversation: Conversation | null
): Promise<ExecutionResult> {
  console.log(`[Runner] Executing plan ${plan.planId} with ${plan.steps.length} steps`);

  const completedSteps: StepResult[] = [];
  let currentConversation = conversation;
  let leadId = state.leadId;
  let jobId = state.jobId;

  await audit.logEvent({
    action: "runner.execute.start",
    actor: "system",
    payload: { planId: plan.planId, stepCount: plan.steps.length },
  });

  for (const step of plan.steps) {
    console.log(`[Runner] Executing step ${step.stepId}: ${step.action}`);

    try {
      const stepResult = await executeStep(step, state, currentConversation);
      completedSteps.push(stepResult);

      if (stepResult.output?.conversationId) {
        const convId = Number(stepResult.output.conversationId);
        currentConversation = await storage.getConversation(convId) || currentConversation;
      }
      if (stepResult.output?.leadId) {
        leadId = String(stepResult.output.leadId);
      }
      if (stepResult.output?.jobId) {
        jobId = Number(stepResult.output.jobId);
      }

      if (stepResult.stopped) {
        console.log(`[Runner] Stopped at step ${step.stepId}: ${stepResult.stopReason}`);
        
        await audit.logEvent({
          action: "runner.execute.stopped",
          actor: "system",
          payload: { 
            planId: plan.planId, 
            stepId: step.stepId,
            reason: stepResult.stopReason,
            approvalId: stepResult.approvalId,
          },
        });

        return {
          planId: plan.planId,
          success: true,
          completedSteps,
          stoppedAtStep: step.stepId,
          stopReason: stepResult.stopReason,
          conversationId: currentConversation?.id,
          leadId,
          jobId,
        };
      }

      if (!stepResult.success) {
        console.error(`[Runner] Step ${step.stepId} failed: ${stepResult.error}`);
        
        await audit.logEvent({
          action: "runner.execute.step_failed",
          actor: "system",
          payload: { planId: plan.planId, stepId: step.stepId, error: stepResult.error },
        });

        return {
          planId: plan.planId,
          success: false,
          completedSteps,
          stoppedAtStep: step.stepId,
          stopReason: stepResult.error,
          conversationId: currentConversation?.id,
          leadId,
          jobId,
        };
      }

      await metrics.record({
        name: "step_completed",
        value: 1,
        tags: { agent: step.agent, action: step.action },
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Runner] Error executing step ${step.stepId}:`, error);
      
      completedSteps.push({
        stepId: step.stepId,
        success: false,
        error: errorMessage,
      });

      await audit.logEvent({
        action: "runner.execute.error",
        actor: "system",
        payload: { planId: plan.planId, stepId: step.stepId, error: errorMessage },
      });

      return {
        planId: plan.planId,
        success: false,
        completedSteps,
        stoppedAtStep: step.stepId,
        stopReason: errorMessage,
        conversationId: currentConversation?.id,
        leadId,
        jobId,
      };
    }
  }

  await audit.logEvent({
    action: "runner.execute.complete",
    actor: "system",
    payload: { planId: plan.planId, stepsCompleted: completedSteps.length },
  });

  return {
    planId: plan.planId,
    success: true,
    completedSteps,
    conversationId: currentConversation?.id,
    leadId,
    jobId,
  };
}

async function executeStep(
  step: Step,
  state: StateContext,
  conversation: Conversation | null
): Promise<StepResult> {
  const output: Record<string, unknown> = {};

  switch (step.agent) {
    case "intake":
      return await executeIntakeStep(step, state, conversation, output);
    case "quote":
      return await executeQuoteStep(step, state, conversation, output);
    case "schedule":
      return await executeScheduleStep(step, state, conversation, output);
    case "reviews":
      return await executeReviewsStep(step, state, conversation, output);
    default:
      return { stepId: step.stepId, success: false, error: `Unknown agent: ${step.agent}` };
  }
}

async function executeIntakeStep(
  step: Step,
  state: StateContext,
  conversation: Conversation | null,
  output: Record<string, unknown>
): Promise<StepResult> {
  const phone = String(step.inputs.phone || "");
  const message = step.inputs.message as string | undefined;

  let conv: Conversation | null = conversation;
  if (!conv && phone) {
    conv = await storage.getConversationByPhone(phone) || null;
    if (!conv) {
      conv = await storage.createConversation({
        customerPhone: phone,
        customerName: step.inputs.customerName as string || null,
        source: step.inputs.source as string || "inbound_sms",
        status: "active",
        agentType: "intake",
      });

      await audit.logEvent({
        action: "conversation.created",
        actor: "system",
        payload: { conversationId: conv.id, source: conv.source },
      });
    }
    output.conversationId = conv.id;
  }

  if (step.action.includes("missed call")) {
    const responseMessage = await generateMissedCallResponse(state.businessName, phone);
    
    if (conv) {
      await storage.createMessage({
        conversationId: conv.id,
        role: "system",
        content: `Missed call received from ${phone}`,
      });
      await storage.createMessage({
        conversationId: conv.id,
        role: "ai",
        content: responseMessage,
      });
    }

    await comms.sendSms({ to: phone, text: responseMessage });

    const leadResult = await fsm.createLead({
      name: step.inputs.customerName as string || null,
      phone,
      address: null,
      service_requested: "General inquiry",
      notes: "From missed call",
    });
    output.leadId = leadResult.leadId;

    if (conv) {
      await storage.createLead({
        externalId: leadResult.leadId,
        conversationId: conv.id,
        phone,
        serviceRequested: "General inquiry",
        notes: "From missed call",
        status: "new",
      });
    }

    return { stepId: step.stepId, success: true, output };
  }

  if (message && conv) {
    await storage.createMessage({
      conversationId: conv.id,
      role: "customer",
      content: message,
    });

    const intakeResult = await runIntakeAgent(message, phone, {
      businessName: state.businessName,
      services: state.services,
      serviceArea: state.serviceArea,
    });

    output.intakeResult = intakeResult;

    if (intakeResult.customerName || intakeResult.serviceType) {
      await storage.updateConversation(conv.id, {
        customerName: intakeResult.customerName || conv.customerName,
        status: intakeResult.isQualified ? "qualified" : "active",
      });
    }

    if (!intakeResult.isQualified) {
      await storage.createMessage({
        conversationId: conv.id,
        role: "ai",
        content: intakeResult.suggestedResponse,
      });
      await comms.sendSms({ to: phone, text: intakeResult.suggestedResponse });
    }

    output.isQualified = intakeResult.isQualified;
  }

  return { stepId: step.stepId, success: true, output };
}

async function executeQuoteStep(
  step: Step,
  state: StateContext,
  conversation: Conversation | null,
  output: Record<string, unknown>
): Promise<StepResult> {
  if (!conversation) {
    return { stepId: step.stepId, success: false, error: "No conversation context" };
  }

  const messages = await storage.getMessagesByConversation(conversation.id);
  const lastCustomerMessage = messages.filter(m => m.role === "customer").pop();
  const serviceType = step.inputs.serviceType as string || "General service";

  const quote = await generateQuote(serviceType, {
    name: conversation.customerName || undefined,
    notes: lastCustomerMessage?.content,
  }, {
    businessName: state.businessName,
    services: state.services,
  });

  output.quote = quote;

  if (step.requiresApproval) {
    const approvalResult = await approvals.requestApproval({
      type: "send_quote",
      summary: `Send quote of $${(quote.estimatedPrice / 100).toFixed(2)} for ${serviceType}`,
      payload: {
        estimatedPrice: quote.estimatedPrice,
        serviceType,
        message: quote.suggestedMessage,
        customerName: conversation.customerName,
        phone: conversation.customerPhone,
      },
    }, conversation.id);

    output.approvalId = approvalResult.approvalId;

    await storage.createMessage({
      conversationId: conversation.id,
      role: "system",
      content: `Quote generated for $${(quote.estimatedPrice / 100).toFixed(2)}. Awaiting approval.`,
    });

    return {
      stepId: step.stepId,
      success: true,
      output,
      stopped: true,
      stopReason: "Awaiting quote approval",
      approvalId: approvalResult.approvalId,
    };
  }

  await storage.createMessage({
    conversationId: conversation.id,
    role: "ai",
    content: quote.suggestedMessage,
  });
  await comms.sendSms({ to: conversation.customerPhone, text: quote.suggestedMessage });

  return { stepId: step.stepId, success: true, output };
}

async function executeScheduleStep(
  step: Step,
  state: StateContext,
  conversation: Conversation | null,
  output: Record<string, unknown>
): Promise<StepResult> {
  if (!conversation) {
    return { stepId: step.stepId, success: false, error: "No conversation context" };
  }

  const serviceType = step.inputs.serviceType as string || "General service";
  const messages = await storage.getMessagesByConversation(conversation.id);
  const lastCustomerMessage = messages.filter(m => m.role === "customer").pop();

  const schedule = await proposeSchedule(
    lastCustomerMessage?.content || "Schedule service",
    serviceType,
    { name: conversation.customerName || undefined, phone: conversation.customerPhone },
    { businessName: state.businessName }
  );

  output.schedule = schedule;

  if (step.requiresApproval) {
    const approvalResult = await approvals.requestApproval({
      type: "book_job",
      summary: `Schedule ${serviceType} for ${conversation.customerName || conversation.customerPhone}`,
      payload: {
        customerName: conversation.customerName,
        phone: conversation.customerPhone,
        serviceType,
        proposedDate: schedule.proposedDateISO,
        message: schedule.suggestedMessage,
      },
    }, conversation.id);

    output.approvalId = approvalResult.approvalId;

    await storage.createMessage({
      conversationId: conversation.id,
      role: "system",
      content: `Scheduling proposed for ${schedule.proposedDate?.toLocaleDateString()}. Awaiting approval.`,
    });

    return {
      stepId: step.stepId,
      success: true,
      output,
      stopped: true,
      stopReason: "Awaiting scheduling approval",
      approvalId: approvalResult.approvalId,
    };
  }

  const jobResult = await fsm.createJob({
    leadId: step.inputs.leadId as string || "lead_unknown",
    start_iso: schedule.proposedDateISO || new Date().toISOString(),
    end_iso: new Date(new Date(schedule.proposedDateISO || Date.now()).getTime() + 2 * 60 * 60 * 1000).toISOString(),
    service_type: serviceType,
    notes: `Scheduled for ${conversation.customerName}`,
  });

  output.jobId = jobResult.jobId;

  const confirmMessage = formatScheduleConfirmation(
    schedule.proposedDate || new Date(),
    serviceType,
    state.businessName,
    conversation.customerName || undefined
  );

  await storage.createMessage({
    conversationId: conversation.id,
    role: "ai",
    content: confirmMessage,
  });
  await comms.sendSms({ to: conversation.customerPhone, text: confirmMessage });

  return { stepId: step.stepId, success: true, output };
}

async function executeReviewsStep(
  step: Step,
  state: StateContext,
  conversation: Conversation | null,
  output: Record<string, unknown>
): Promise<StepResult> {
  const jobId = step.inputs.jobId as number;
  const phone = step.inputs.phone as string;
  const customerName = step.inputs.customerName as string | undefined;

  if (!jobId || !phone) {
    return { stepId: step.stepId, success: false, error: "Missing job ID or phone" };
  }

  const reviewMessage = await generateReviewRequest(
    state.businessName,
    customerName,
    step.inputs.serviceType as string || "landscaping service"
  );

  await comms.sendSms({ to: phone, text: reviewMessage });

  if (conversation) {
    await storage.createMessage({
      conversationId: conversation.id,
      role: "ai",
      content: reviewMessage,
    });
    await storage.updateConversation(conversation.id, {
      status: "completed",
      agentType: "reviews",
    });
  }

  output.reviewMessageSent = true;

  await metrics.record({
    name: "review_request_sent",
    value: 1,
    tags: { jobId: String(jobId) },
  });

  return { stepId: step.stepId, success: true, output };
}
