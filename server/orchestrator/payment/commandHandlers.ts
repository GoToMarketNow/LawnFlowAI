import type { Database } from "@db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import {
  type PaymentCommand,
  type PaymentEvent,
  validatePaymentCommand,
} from "@shared/orchestrator/payment-contracts";
import {
  customerPaymentProfiles,
  paymentMethods,
  paymentTransactions,
  paymentSessions,
  paymentAgentDecisions,
  paymentHumanTasks,
} from "@shared/schema-payment";

// ============================================
// Command Handlers - Enforce Policy & State
// ============================================

/**
 * Command handlers NEVER called directly by agents.
 * Agents propose commands; handlers enforce state, policy, idempotency.
 */

export interface CommandHandlerContext {
  db: Database;
  command: PaymentCommand;
  agentDecisionId?: number;
}

export type CommandResult = {
  success: boolean;
  event?: PaymentEvent;
  error?: string;
  skipReason?: string;
};

// ============================================
// Command Router
// ============================================

export async function executePaymentCommand(
  ctx: CommandHandlerContext
): Promise<CommandResult> {
  const { command } = ctx;

  // Validate command schema
  try {
    validatePaymentCommand(command);
  } catch (error) {
    return { success: false, error: `Invalid command: ${error}` };
  }

  // Check idempotency - has this command already been executed?
  const existing = await checkIdempotency(ctx);
  if (existing) {
    return {
      success: true,
      skipReason: "Command already executed (idempotent)",
      event: existing,
    };
  }

  // Route to appropriate handler
  switch (command.type) {
    case "RequestPaymentSetup":
      return handleRequestPaymentSetup(ctx);
    case "CreatePaymentSession":
      return handleCreatePaymentSession(ctx);
    case "SetPreferredPaymentMethod":
      return handleSetPreferredPaymentMethod(ctx);
    case "EnableAutopay":
      return handleEnableAutopay(ctx);
    case "CapturePayment":
      return handleCapturePayment(ctx);
    case "SendTextToPayLink":
      return handleSendTextToPayLink(ctx);
    case "CreateInvoice":
      return handleCreateInvoice(ctx);
    case "CreateHumanTask":
      return handleCreateHumanTask(ctx);
    default:
      return { success: false, error: `Unknown command type: ${(command as any).type}` };
  }
}

// ============================================
// Idempotency Check
// ============================================

async function checkIdempotency(ctx: CommandHandlerContext): Promise<PaymentEvent | null> {
  const { db, command } = ctx;

  // Check if this idempotency key has already been processed
  // Implementation depends on event store design
  // For now, return null (no duplicate found)
  return null;
}

// ============================================
// Handler: RequestPaymentSetup
// ============================================

async function handleRequestPaymentSetup(
  ctx: CommandHandlerContext
): Promise<CommandResult> {
  const { db, command } = ctx;
  if (command.type !== "RequestPaymentSetup") {
    return { success: false, error: "Invalid command type" };
  }

  const { customerId, businessId, channels, context: setupContext, jobId } = command;

  // Verify customer exists (policy enforcement)
  // TODO: Add customer lookup

  // Create or update payment profile
  await db
    .insert(customerPaymentProfiles)
    .values({
      customerId,
      businessId,
      autopayEnabled: false,
      allowedMethods: ["APPLE_PAY", "GOOGLE_PAY", "CARD"],
      consentRecords: [],
    })
    .onConflictDoNothing();

  // Emit event
  const event: PaymentEvent = {
    eventType: "PaymentSetupRequested",
    timestamp: new Date().toISOString(),
    traceId: command.traceId,
    customerId,
    businessId,
    channels,
    context: setupContext,
    jobId,
  };

  // TODO: Store event in event store
  // TODO: Trigger SMS/in-app notification via adapter

  return { success: true, event };
}

// ============================================
// Handler: CreatePaymentSession
// ============================================

async function handleCreatePaymentSession(
  ctx: CommandHandlerContext
): Promise<CommandResult> {
  const { db, command } = ctx;
  if (command.type !== "CreatePaymentSession") {
    return { success: false, error: "Invalid command type" };
  }

  const {
    customerId,
    businessId,
    amount,
    currency,
    allowedMethods,
    channel,
    jobId,
    invoiceId,
  } = command;

  // Generate session ID
  const sessionId = crypto.randomUUID();

  // Calculate expiration (24 hours from now)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Create session URL (placeholder - integrate with payment provider)
  const sessionUrl = `https://pay.lawnflow.ai/s/${sessionId}`;

  // Insert payment session
  await db.insert(paymentSessions).values({
    sessionId,
    businessId,
    customerId,
    jobId,
    invoiceId,
    amount,
    currency,
    allowedMethods,
    channel,
    sessionUrl,
    status: "created",
    expiresAt,
    traceId: command.traceId,
  });

  // Emit event
  const event: PaymentEvent = {
    eventType: "PaymentSessionCreated",
    timestamp: new Date().toISOString(),
    traceId: command.traceId,
    customerId,
    businessId,
    sessionId,
    amount,
    currency,
    allowedMethods,
    channel,
    sessionUrl,
    expiresAt: expiresAt.toISOString(),
    jobId,
    invoiceId,
  };

  return { success: true, event };
}

// ============================================
// Handler: SetPreferredPaymentMethod
// ============================================

async function handleSetPreferredPaymentMethod(
  ctx: CommandHandlerContext
): Promise<CommandResult> {
  const { db, command } = ctx;
  if (command.type !== "SetPreferredPaymentMethod") {
    return { success: false, error: "Invalid command type" };
  }

  const { customerId, businessId, paymentMethodId } = command;

  // Verify payment method belongs to customer
  const method = await db.query.paymentMethods.findFirst({
    where: (methods, { eq, and }) =>
      and(eq(methods.id, paymentMethodId), eq(methods.customerId, customerId)),
  });

  if (!method) {
    return { success: false, error: "Payment method not found or does not belong to customer" };
  }

  // Update profile
  await db
    .update(customerPaymentProfiles)
    .set({
      preferredPaymentMethodId: paymentMethodId,
      updatedAt: new Date(),
    })
    .where(eq(customerPaymentProfiles.customerId, customerId));

  // Update isDefault on payment methods
  await db
    .update(paymentMethods)
    .set({ isDefault: false })
    .where(eq(paymentMethods.customerId, customerId));

  await db
    .update(paymentMethods)
    .set({ isDefault: true })
    .where(eq(paymentMethods.id, paymentMethodId));

  // Emit event
  const event: PaymentEvent = {
    eventType: "PaymentPreferenceUpdated",
    timestamp: new Date().toISOString(),
    traceId: command.traceId,
    customerId,
    businessId,
    preferredMethodId: paymentMethodId,
    autopayEnabled: true, // Placeholder - should read from DB
    autoBillingEnabled: false,
    allowedMethods: ["APPLE_PAY", "GOOGLE_PAY", "CARD"],
  };

  return { success: true, event };
}

// ============================================
// Handler: EnableAutopay
// ============================================

async function handleEnableAutopay(ctx: CommandHandlerContext): Promise<CommandResult> {
  const { db, command } = ctx;
  if (command.type !== "EnableAutopay") {
    return { success: false, error: "Invalid command type" };
  }

  const { customerId, businessId, enabled } = command;

  // Verify customer has a preferred payment method
  const profile = await db.query.customerPaymentProfiles.findFirst({
    where: (profiles, { eq }) => eq(profiles.customerId, customerId),
  });

  if (enabled && !profile?.preferredPaymentMethodId) {
    return {
      success: false,
      error: "Cannot enable autopay without a preferred payment method",
    };
  }

  // Update profile
  await db
    .update(customerPaymentProfiles)
    .set({
      autopayEnabled: enabled,
      updatedAt: new Date(),
    })
    .where(eq(customerPaymentProfiles.customerId, customerId));

  // Emit event
  const event: PaymentEvent = {
    eventType: "PaymentPreferenceUpdated",
    timestamp: new Date().toISOString(),
    traceId: command.traceId,
    customerId,
    businessId,
    preferredMethodId: profile?.preferredPaymentMethodId ?? null,
    autopayEnabled: enabled,
    autoBillingEnabled: profile?.autoBillingEnabled ?? false,
    allowedMethods: (profile?.allowedMethods as any[]) ?? ["APPLE_PAY", "GOOGLE_PAY", "CARD"],
  };

  return { success: true, event };
}

// ============================================
// Handler: CapturePayment
// ============================================

async function handleCapturePayment(ctx: CommandHandlerContext): Promise<CommandResult> {
  const { db, command, agentDecisionId } = ctx;
  if (command.type !== "CapturePayment") {
    return { success: false, error: "Invalid command type" };
  }

  const {
    customerId,
    businessId,
    paymentMethodId,
    amount,
    currency,
    captureType,
    jobId,
    invoiceId,
  } = command;

  // Verify payment method
  const method = await db.query.paymentMethods.findFirst({
    where: (methods, { eq, and }) =>
      and(
        eq(methods.id, paymentMethodId),
        eq(methods.customerId, customerId),
        eq(methods.isActive, true)
      ),
  });

  if (!method) {
    return { success: false, error: "Payment method not found or inactive" };
  }

  // Create payment transaction record
  const [transaction] = await db
    .insert(paymentTransactions)
    .values({
      businessId,
      customerId,
      jobId,
      invoiceId,
      amount,
      currency,
      paymentMethodId,
      methodType: method.type,
      status: "pending",
      provider: method.provider,
      captureType,
      initiatedBy: "agent",
      idempotencyKey: command.idempotencyKey,
      traceId: command.traceId,
      agentDecisionId,
      retryCount: 0,
    })
    .returning();

  // TODO: Integrate with payment provider (Stripe, Square, etc.)
  // For now, simulate successful capture
  const providerTransactionId = `pi_${crypto.randomUUID().substring(0, 24)}`;

  await db
    .update(paymentTransactions)
    .set({
      status: "captured",
      providerTransactionId,
      capturedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(paymentTransactions.id, transaction.id));

  // Update last method used
  await db
    .update(customerPaymentProfiles)
    .set({
      lastMethodUsedId: paymentMethodId,
      lastMethodUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(customerPaymentProfiles.customerId, customerId));

  // Emit event
  const event: PaymentEvent = {
    eventType: "PaymentCaptured",
    timestamp: new Date().toISOString(),
    traceId: command.traceId,
    customerId,
    businessId,
    transactionId: transaction.id,
    amount,
    currency,
    paymentMethodId,
    methodType: method.type as any,
    captureType,
    provider: method.provider,
    providerTransactionId,
    jobId,
    invoiceId,
  };

  return { success: true, event };
}

// ============================================
// Handler: SendTextToPayLink
// ============================================

async function handleSendTextToPayLink(ctx: CommandHandlerContext): Promise<CommandResult> {
  const { db, command } = ctx;
  if (command.type !== "SendTextToPayLink") {
    return { success: false, error: "Invalid command type" };
  }

  const { customerId, businessId, customerPhone, paymentSessionUrl, amount } = command;

  // TODO: Integrate with SMS provider (Twilio, etc.)
  // For now, log the action
  console.log(`[SMS] Sending text-to-pay link to ${customerPhone}: ${paymentSessionUrl}`);

  // Update session status
  // TODO: Implement session status update

  // Emit event (reuse PaymentSessionCreated or create new event)
  // For simplicity, return success without event
  return { success: true };
}

// ============================================
// Handler: CreateInvoice
// ============================================

async function handleCreateInvoice(ctx: CommandHandlerContext): Promise<CommandResult> {
  const { db, command } = ctx;
  if (command.type !== "CreateInvoice") {
    return { success: false, error: "Invalid command type" };
  }

  const { customerId, businessId, jobId, amount, currency, reason } = command;

  // TODO: Integrate with invoice/billing system
  console.log(`[Invoice] Creating invoice for job ${jobId}, customer ${customerId}, amount ${amount}`);

  // Emit event
  const event: PaymentEvent = {
    eventType: "InvoiceFallbackTriggered",
    timestamp: new Date().toISOString(),
    traceId: command.traceId,
    customerId,
    businessId,
    jobId,
    amount,
    reason,
  };

  return { success: true, event };
}

// ============================================
// Handler: CreateHumanTask
// ============================================

async function handleCreateHumanTask(ctx: CommandHandlerContext): Promise<CommandResult> {
  const { db, command, agentDecisionId } = ctx;
  if (command.type !== "CreateHumanTask") {
    return { success: false, error: "Invalid command type" };
  }

  const { customerId, businessId, role, reason, context, jobId, invoiceId } = command;

  if (!agentDecisionId) {
    return { success: false, error: "CreateHumanTask requires agentDecisionId" };
  }

  // Create human task
  await db.insert(paymentHumanTasks).values({
    businessId,
    customerId,
    agentDecisionId,
    jobId,
    invoiceId,
    role,
    reason,
    context,
    status: "pending",
  });

  // No event emitted for human tasks
  return { success: true };
}
