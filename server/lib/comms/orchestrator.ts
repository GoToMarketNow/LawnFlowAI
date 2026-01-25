import { 
  CommunicationIntent, 
  CommunicationIntentSchema,
  RenderedMessage,
  DeliveryResult,
  INTENT_METADATA,
  CommunicationIntentType,
  CustomerInsights,
  BusinessContext,
  Recipient,
} from "@shared/comms-schema";
import { getTemplate, MessageTemplate } from "./templates";
import { renderTemplate } from "./renderer";
import { twilioConnector } from "../../connectors/twilio-mock";
import { db } from "../../db";
import { customerCommLog, businessProfiles, customerProfiles } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { searchMemories } from "../../memory/search";

interface CommsOrchestratorConfig {
  enforceBusinessHours?: boolean;
  defaultTimezone?: string;
  maxMessagesPerDayPerCustomer?: number;
  requireApprovalForNewTemplates?: boolean;
}

interface ProcessResult {
  success: boolean;
  intentId: string;
  messageId?: string;
  renderedMessage?: RenderedMessage;
  deliveryResult?: DeliveryResult;
  blocked?: boolean;
  blockReason?: string;
  requiresApproval?: boolean;
  error?: string;
}

const DEFAULT_CONFIG: CommsOrchestratorConfig = {
  enforceBusinessHours: false,
  defaultTimezone: "America/New_York",
  maxMessagesPerDayPerCustomer: 10,
  requireApprovalForNewTemplates: true,
};

class CommsOrchestrator {
  private config: CommsOrchestratorConfig;
  private pendingApprovals: Map<string, CommunicationIntent> = new Map();

  constructor(config: CommsOrchestratorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async processIntent(intent: CommunicationIntent): Promise<ProcessResult> {
    const intentId = intent.id || `intent_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    try {
      const validatedIntent = CommunicationIntentSchema.parse({
        ...intent,
        id: intentId,
      });

      console.log(`[CommsOrchestrator] Processing intent: ${validatedIntent.intentType} for ${validatedIntent.recipient.phone}`);

      const complianceCheck = await this.checkCompliance(validatedIntent);
      if (!complianceCheck.allowed) {
        console.log(`[CommsOrchestrator] Intent blocked: ${complianceCheck.reason}`);
        return {
          success: false,
          intentId,
          blocked: true,
          blockReason: complianceCheck.reason,
        };
      }

      if (validatedIntent.requiresApproval) {
        this.pendingApprovals.set(intentId, validatedIntent);
        console.log(`[CommsOrchestrator] Intent queued for approval: ${intentId}`);
        return {
          success: true,
          intentId,
          requiresApproval: true,
        };
      }

      const enrichedIntent = await this.enrichWithCustomerInsights(validatedIntent);
      const renderedMessage = await this.renderMessage(enrichedIntent);
      
      if (!renderedMessage) {
        return {
          success: false,
          intentId,
          error: "Failed to render message - no template found",
        };
      }

      const deliveryResult = await this.deliverMessage(renderedMessage, enrichedIntent);
      await this.logCommunication(enrichedIntent, renderedMessage, deliveryResult);

      return {
        success: deliveryResult.status !== "failed",
        intentId,
        messageId: deliveryResult.messageId,
        renderedMessage,
        deliveryResult,
      };
    } catch (error: any) {
      console.error(`[CommsOrchestrator] Error processing intent:`, error);
      return {
        success: false,
        intentId,
        error: error.message,
      };
    }
  }

  async approveIntent(intentId: string, approvedBy: number): Promise<ProcessResult> {
    const intent = this.pendingApprovals.get(intentId);
    if (!intent) {
      return {
        success: false,
        intentId,
        error: "Intent not found in pending approvals",
      };
    }

    this.pendingApprovals.delete(intentId);
    
    const approvedIntent = {
      ...intent,
      requiresApproval: false,
    };

    console.log(`[CommsOrchestrator] Intent ${intentId} approved by user ${approvedBy}`);
    return this.processIntent(approvedIntent);
  }

  async rejectIntent(intentId: string, rejectedBy: number, reason?: string): Promise<void> {
    const intent = this.pendingApprovals.get(intentId);
    if (intent) {
      this.pendingApprovals.delete(intentId);
      console.log(`[CommsOrchestrator] Intent ${intentId} rejected by user ${rejectedBy}: ${reason || 'No reason provided'}`);
    }
  }

  getPendingApprovals(businessId?: number): CommunicationIntent[] {
    const approvals = Array.from(this.pendingApprovals.values());
    if (businessId) {
      return approvals.filter(i => i.business.businessId === businessId);
    }
    return approvals;
  }

  private async checkCompliance(intent: CommunicationIntent): Promise<{ allowed: boolean; reason?: string }> {
    if (intent.recipient.optedOut) {
      return { allowed: false, reason: "Customer has opted out of communications" };
    }

    if (!intent.recipient.phone || intent.recipient.phone.length < 10) {
      return { allowed: false, reason: "Invalid phone number" };
    }

    if (intent.expiresAt && new Date(intent.expiresAt) < new Date()) {
      return { allowed: false, reason: "Intent has expired" };
    }

    if (intent.sendAfter && new Date(intent.sendAfter) > new Date()) {
      return { allowed: false, reason: "Send time not yet reached" };
    }

    if (this.config.enforceBusinessHours) {
      const businessHoursCheck = this.checkBusinessHours(intent);
      if (!businessHoursCheck.allowed) {
        return businessHoursCheck;
      }
    }

    const frequencyCheck = await this.checkMessageFrequency(intent);
    if (!frequencyCheck.allowed) {
      return frequencyCheck;
    }

    return { allowed: true };
  }

  private checkBusinessHours(intent: CommunicationIntent): { allowed: boolean; reason?: string } {
    const timezone = this.config.defaultTimezone || "America/New_York";
    const now = new Date();
    
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const dayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    });

    const currentHour = parseInt(formatter.format(now));
    const dayOfWeek = dayFormatter.format(now);
    
    const isSunday = dayOfWeek === "Sun";
    const isSaturday = dayOfWeek === "Sat";

    const startHour = 8;
    const endHour = isSaturday ? 17 : (isSunday ? 12 : 20);
    const actualStartHour = isSunday ? 10 : startHour;

    if (currentHour < actualStartHour || currentHour >= endHour) {
      const metadata = INTENT_METADATA[intent.intentType];
      if (metadata?.defaultPriority === "urgent") {
        console.log(`[CommsOrchestrator] Allowing urgent message outside business hours`);
        return { allowed: true };
      }
      
      return { 
        allowed: false, 
        reason: `Outside business hours (${actualStartHour}:00 - ${endHour}:00 ${timezone})` 
      };
    }

    return { allowed: true };
  }

  private async checkMessageFrequency(intent: CommunicationIntent): Promise<{ allowed: boolean; reason?: string }> {
    const maxPerDay = this.config.maxMessagesPerDayPerCustomer || 10;
    
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    try {
      const recentMessages = await db
        .select()
        .from(customerCommLog)
        .where(
          and(
            eq(customerCommLog.businessId, intent.business.businessId),
            eq(customerCommLog.recipientPhone, intent.recipient.phone),
            sql`${customerCommLog.createdAt} >= ${startOfDay}`
          )
        );

      if (recentMessages.length >= maxPerDay) {
        const metadata = INTENT_METADATA[intent.intentType];
        if (metadata?.defaultPriority === "urgent") {
          console.log(`[CommsOrchestrator] Allowing urgent message despite frequency limit`);
          return { allowed: true };
        }

        return {
          allowed: false,
          reason: `Daily message limit reached (${maxPerDay}/day). Customer has received ${recentMessages.length} messages today.`,
        };
      }

      const duplicateCheck = recentMessages.some(
        msg => msg.messageType === intent.intentType && 
               new Date(msg.createdAt!).getTime() > now.getTime() - 1000 * 60 * 5
      );

      if (duplicateCheck) {
        return {
          allowed: false,
          reason: `Duplicate message detected. Same intent type sent within last 5 minutes.`,
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error(`[CommsOrchestrator] Error checking message frequency:`, error);
      return { allowed: true };
    }
  }

  private async enrichWithCustomerInsights(intent: CommunicationIntent): Promise<CommunicationIntent> {
    if (intent.customerInsights) {
      return intent;
    }

    try {
      const profile = await this.getCustomerProfileByPhone(
        intent.business.businessId,
        intent.recipient.phone
      );

      if (profile) {
        const memories = await searchMemories({
          businessId: intent.business.businessId,
          customerId: profile.id,
          queryText: "preferences and past interactions",
          limit: 5,
        });

        const insights: CustomerInsights = {
          isReturningCustomer: true,
          communicationNotes: memories.map(m => m.memory.text).join("; "),
        };

        console.log(`[CommsOrchestrator] Enriched intent with customer insights`);
        return {
          ...intent,
          customerInsights: insights,
          recipient: {
            ...intent.recipient,
            preferredName: intent.recipient.preferredName || intent.recipient.firstName,
          },
        };
      }
    } catch (error) {
      console.log(`[CommsOrchestrator] Could not fetch customer insights:`, error);
    }

    return intent;
  }

  private async getCustomerProfileByPhone(businessId: number, phone: string) {
    const normalizedPhone = phone.replace(/\D/g, "");
    const [profile] = await db
      .select()
      .from(customerProfiles)
      .where(
        and(
          eq(customerProfiles.businessId, businessId),
          eq(customerProfiles.phone, normalizedPhone)
        )
      )
      .limit(1);
    return profile || null;
  }

  private async renderMessage(intent: CommunicationIntent): Promise<RenderedMessage | null> {
    const serviceCategory = intent.job?.serviceCategory || "general";
    const template = getTemplate(intent.intentType, serviceCategory);

    if (!template) {
      console.error(`[CommsOrchestrator] No template found for ${intent.intentType}`);
      return null;
    }

    const context = this.buildRenderContext(intent);
    const renderedBody = renderTemplate(template.template, context);

    return {
      intentId: intent.id!,
      intentType: intent.intentType,
      channel: intent.channel,
      templateId: template.id,
      templateVersion: template.version,
      recipientPhone: intent.recipient.phone,
      recipientEmail: intent.recipient.email,
      subject: template.subject ? renderTemplate(template.subject, context) : undefined,
      body: renderedBody,
      characterCount: renderedBody.length,
      estimatedSegments: Math.ceil(renderedBody.length / 160),
      personalizationTokensUsed: this.extractUsedTokens(template, context),
      renderedAt: new Date(),
    };
  }

  private buildRenderContext(intent: CommunicationIntent): Record<string, any> {
    const context: Record<string, any> = {
      firstName: intent.recipient.preferredName || intent.recipient.firstName || "there",
      lastName: intent.recipient.lastName || "",
      customerName: `${intent.recipient.firstName || ""} ${intent.recipient.lastName || ""}`.trim() || "Customer",
      businessName: intent.business.businessName,
      businessPhone: intent.business.businessPhone,
      businessEmail: intent.business.businessEmail,
      businessWebsite: intent.business.businessWebsite,
      ...intent.customVariables,
    };

    if (intent.job) {
      Object.assign(context, {
        serviceType: intent.job.serviceType || intent.job.jobTitle || "service",
        scheduledDate: intent.job.scheduledDate,
        scheduledTimeWindow: intent.job.scheduledTimeWindow,
        propertyAddress: intent.job.propertyAddress,
        crewName: intent.job.crewName,
        crewLeadName: intent.job.crewLeadName,
        estimatedDuration: intent.job.estimatedDuration,
        jobNotes: intent.job.jobNotes,
        previousDate: intent.job.previousDate,
        rescheduleReason: intent.job.rescheduleReason,
      });
    }

    if (intent.quote) {
      Object.assign(context, {
        quoteNumber: intent.quote.quoteNumber,
        formattedTotal: intent.quote.formattedTotal || `$${intent.quote.totalAmount?.toFixed(2)}`,
        lineItems: intent.quote.lineItems,
        validUntil: intent.quote.validUntil,
        quoteUrl: intent.quote.quoteUrl,
        lotSize: intent.quote.lotSize,
        frequency: intent.quote.frequency,
        proposedStartDate: intent.quote.proposedStartDate,
      });
    }

    if (intent.payment) {
      Object.assign(context, {
        invoiceNumber: intent.payment.invoiceNumber,
        formattedAmountDue: intent.payment.formattedAmountDue || `$${intent.payment.amountDue?.toFixed(2)}`,
        dueDate: intent.payment.dueDate,
        paymentUrl: intent.payment.paymentUrl,
        formattedAmountPaid: `$${intent.payment.amountPaid?.toFixed(2)}`,
        balanceRemaining: intent.payment.balanceRemaining ? `$${intent.payment.balanceRemaining.toFixed(2)}` : undefined,
      });
    }

    if (intent.schedule) {
      Object.assign(context, {
        proposedWindows: intent.schedule.proposedWindows,
        selectedWindow: intent.schedule.selectedWindow,
        originalSchedule: intent.schedule.originalSchedule,
        changeReason: intent.schedule.changeReason,
      });
    }

    return context;
  }

  private extractUsedTokens(template: MessageTemplate, context: Record<string, any>): string[] {
    const allTokens = [...template.requiredTokens, ...template.optionalTokens];
    return allTokens.filter(token => context[token] !== undefined && context[token] !== null);
  }

  private async deliverMessage(
    message: RenderedMessage,
    intent: CommunicationIntent
  ): Promise<DeliveryResult> {
    if (intent.channel === "sms") {
      try {
        const result = await twilioConnector.sendSMS(message.recipientPhone, message.body);
        
        return {
          intentId: message.intentId,
          messageId: result.sid,
          channel: "sms",
          status: result.success ? "sent" : "failed",
          providerMessageId: result.sid,
          sentAt: result.success ? new Date() : undefined,
          failureReason: result.error,
        };
      } catch (error: any) {
        return {
          intentId: message.intentId,
          channel: "sms",
          status: "failed",
          failureReason: error.message,
        };
      }
    }

    return {
      intentId: message.intentId,
      channel: intent.channel,
      status: "failed",
      failureReason: `Channel ${intent.channel} not implemented`,
    };
  }

  private async logCommunication(
    intent: CommunicationIntent,
    message: RenderedMessage,
    delivery: DeliveryResult
  ): Promise<void> {
    try {
      await db.insert(customerCommLog).values({
        businessId: intent.business.businessId,
        jobberJobId: intent.job?.jobberJobId || null,
        messageType: intent.intentType,
        serviceCategory: intent.job?.serviceCategory || "general",
        templateId: message.templateId,
        recipientPhone: message.recipientPhone,
        recipientName: `${intent.recipient.firstName || ""} ${intent.recipient.lastName || ""}`.trim() || null,
        messageContent: message.body,
        deliveryStatus: delivery.status,
        twilioMessageSid: delivery.providerMessageId || null,
        deliveredAt: delivery.deliveredAt || null,
        failureReason: delivery.failureReason || null,
      });
    } catch (error) {
      console.error(`[CommsOrchestrator] Failed to log communication:`, error);
    }
  }

  async getBusinessContext(businessId: number): Promise<BusinessContext | null> {
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

  async sendQuickMessage(
    intentType: CommunicationIntentType,
    businessId: number,
    recipientPhone: string,
    recipientName: string,
    additionalContext?: Record<string, any>
  ): Promise<ProcessResult> {
    const businessContext = await this.getBusinessContext(businessId);
    if (!businessContext) {
      return {
        success: false,
        intentId: "",
        error: "Business not found",
      };
    }

    const [firstName, ...lastParts] = recipientName.split(" ");
    const lastName = lastParts.join(" ");

    const recipient: Recipient = {
      phone: recipientPhone,
      firstName,
      lastName: lastName || undefined,
    };

    const metadata = INTENT_METADATA[intentType];
    
    const intent: CommunicationIntent = {
      intentType,
      channel: "sms",
      priority: metadata.defaultPriority,
      recipient,
      business: businessContext,
      requiresApproval: metadata.requiresApprovalDefault,
      triggeredBy: "manual",
      customVariables: additionalContext,
      createdAt: new Date(),
    };

    return this.processIntent(intent);
  }
}

export const commsOrchestrator = new CommsOrchestrator();

export async function sendCommunication(intent: CommunicationIntent): Promise<ProcessResult> {
  return commsOrchestrator.processIntent(intent);
}

export async function sendQuickSMS(
  intentType: CommunicationIntentType,
  businessId: number,
  recipientPhone: string,
  recipientName: string,
  context?: Record<string, any>
): Promise<ProcessResult> {
  return commsOrchestrator.sendQuickMessage(intentType, businessId, recipientPhone, recipientName, context);
}
