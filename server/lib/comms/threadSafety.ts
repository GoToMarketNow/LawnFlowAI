// Thread Safety Service
// Implements crew-safe thread isolation and access control
// Ensures sensitive information doesn't leak across job/crew boundaries

import { db } from "../../db";
import { commsThreads, commsMessages, users, crewMembers, jobs } from "../../../shared/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { auditLog } from "../audit";

export type ThreadType = "customer" | "crew_internal" | "ops_internal" | "general";
export type VisibilityScope = "business" | "job" | "crew" | "user";
export type UserRole = "owner" | "admin" | "staff" | "ops" | "crew" | "customer";

export interface ThreadAccessContext {
  userId: number;
  userRole: UserRole;
  businessId: number;
}

export interface CreateThreadOptions {
  businessId: number;
  participantUserId: number;
  participantPhoneE164: string;
  threadType: ThreadType;
  visibilityScope: VisibilityScope;
  scopeJobId?: number;
  scopeCrewId?: number;
  scopeUserId?: number;
  allowsCustomerViewing?: boolean;
  createdBy: number;
}

export interface ThreadAccessCheck {
  hasAccess: boolean;
  reason?: string;
  allowedActions: {
    canRead: boolean;
    canWrite: boolean;
    canInvite: boolean;
    canArchive: boolean;
  };
}

/**
 * Create a crew-safe thread with proper visibility scope
 */
export async function createSafeThread(options: CreateThreadOptions): Promise<number> {
  // Validate visibility scope requirements
  if (options.visibilityScope === "job" && !options.scopeJobId) {
    throw new Error("scopeJobId required for job-scoped threads");
  }
  if (options.visibilityScope === "crew" && !options.scopeCrewId) {
    throw new Error("scopeCrewId required for crew-scoped threads");
  }
  if (options.visibilityScope === "user" && !options.scopeUserId) {
    throw new Error("scopeUserId required for user-scoped threads");
  }

  // Customer-facing threads must allow customer viewing
  if (options.threadType === "customer" && !options.allowsCustomerViewing) {
    options.allowsCustomerViewing = true;
  }

  // Internal threads must not allow customer viewing
  if (
    (options.threadType === "crew_internal" || options.threadType === "ops_internal") &&
    options.allowsCustomerViewing
  ) {
    throw new Error("Internal threads cannot allow customer viewing");
  }

  const [thread] = await db
    .insert(commsThreads)
    .values({
      businessId: options.businessId,
      participantUserId: options.participantUserId,
      participantPhoneE164: options.participantPhoneE164,
      // @ts-ignore - Extended schema fields
      threadType: options.threadType,
      visibilityScope: options.visibilityScope,
      scopeJobId: options.scopeJobId,
      scopeCrewId: options.scopeCrewId,
      scopeUserId: options.scopeUserId,
      allowsCustomerViewing: options.allowsCustomerViewing || false,
    })
    .returning();

  // Auto-add creator as participant
  await addThreadParticipant(thread.id, options.createdBy, "owner", {
    canRead: true,
    canWrite: true,
    canInvite: true,
  });

  // If job-scoped, add crew members as participants
  if (options.visibilityScope === "job" && options.scopeJobId) {
    await addJobCrewToThread(thread.id, options.scopeJobId);
  }

  // If crew-scoped, add crew members as participants
  if (options.visibilityScope === "crew" && options.scopeCrewId) {
    await addCrewMembersToThread(thread.id, options.scopeCrewId);
  }

  await auditLog({
    businessId: options.businessId,
    userId: options.createdBy,
    action: "thread_created",
    entityType: "comms_thread",
    entityId: thread.id,
    metadata: {
      threadType: options.threadType,
      visibilityScope: options.visibilityScope,
      scopeJobId: options.scopeJobId,
      scopeCrewId: options.scopeCrewId,
    },
  });

  return thread.id;
}

/**
 * Check if user can access thread
 */
export async function checkThreadAccess(
  threadId: number,
  context: ThreadAccessContext
): Promise<ThreadAccessCheck> {
  // Use database function for access check
  const result = await db.execute(sql`
    SELECT can_user_access_thread(${context.userId}, ${threadId}, ${context.userRole}) AS has_access
  `);

  // @ts-ignore
  const hasAccess = result.rows[0]?.has_access || false;

  if (!hasAccess) {
    return {
      hasAccess: false,
      reason: "User does not have permission to access this thread",
      allowedActions: {
        canRead: false,
        canWrite: false,
        canInvite: false,
        canArchive: false,
      },
    };
  }

  // Fetch thread details to determine allowed actions
  const thread = await db.query.commsThreads.findFirst({
    where: eq(commsThreads.id, threadId),
  });

  if (!thread) {
    return {
      hasAccess: false,
      reason: "Thread not found",
      allowedActions: {
        canRead: false,
        canWrite: false,
        canInvite: false,
        canArchive: false,
      },
    };
  }

  // @ts-ignore
  const threadType = thread.threadType as ThreadType;

  // Determine actions based on role and thread type
  const isOwnerOrAdmin = context.userRole === "owner" || context.userRole === "admin";
  const isOps = context.userRole === "ops" || isOwnerOrAdmin;

  return {
    hasAccess: true,
    allowedActions: {
      canRead: true,
      canWrite: threadType !== "ops_internal" || isOps,
      canInvite: isOps,
      canArchive: isOwnerOrAdmin,
    },
  };
}

/**
 * Get accessible threads for user
 */
export async function getAccessibleThreads(
  context: ThreadAccessContext,
  options: {
    limit?: number;
    offset?: number;
    threadType?: ThreadType;
  } = {}
): Promise<any[]> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  const result = await db.execute(sql`
    SELECT * FROM get_accessible_threads_for_user(
      ${context.userId},
      ${context.businessId},
      ${context.userRole},
      ${limit},
      ${offset}
    )
  `);

  // @ts-ignore
  return result.rows;
}

/**
 * Add participant to thread
 */
export async function addThreadParticipant(
  threadId: number,
  userId: number,
  role: string,
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    canInvite: boolean;
  }
): Promise<void> {
  await db.execute(sql`
    INSERT INTO thread_participants (thread_id, user_id, role, can_read, can_write, can_invite)
    VALUES (${threadId}, ${userId}, ${role}, ${permissions.canRead}, ${permissions.canWrite}, ${permissions.canInvite})
    ON CONFLICT (thread_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        can_read = EXCLUDED.can_read,
        can_write = EXCLUDED.can_write,
        can_invite = EXCLUDED.can_invite,
        left_at = NULL
  `);
}

/**
 * Remove participant from thread
 */
export async function removeThreadParticipant(threadId: number, userId: number): Promise<void> {
  await db.execute(sql`
    UPDATE thread_participants
    SET left_at = CURRENT_TIMESTAMP
    WHERE thread_id = ${threadId} AND user_id = ${userId}
  `);
}

/**
 * Add crew members to job-scoped thread
 */
async function addJobCrewToThread(threadId: number, jobId: number): Promise<void> {
  // Get job details
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
  });

  if (!job || !job.assignedCrewId) {
    return;
  }

  // Get crew members
  const members = await db
    .select()
    .from(crewMembers)
    .where(eq(crewMembers.crewId, job.assignedCrewId));

  // Add each member as participant
  for (const member of members) {
    await addThreadParticipant(threadId, member.userId, "crew_member", {
      canRead: true,
      canWrite: true,
      canInvite: false,
    });
  }
}

/**
 * Add crew members to crew-scoped thread
 */
async function addCrewMembersToThread(threadId: number, crewId: number): Promise<void> {
  const members = await db.select().from(crewMembers).where(eq(crewMembers.crewId, crewId));

  for (const member of members) {
    await addThreadParticipant(threadId, member.userId, "crew_member", {
      canRead: true,
      canWrite: true,
      canInvite: false,
    });
  }
}

/**
 * Archive thread (soft delete)
 */
export async function archiveThread(
  threadId: number,
  userId: number,
  context: ThreadAccessContext
): Promise<{ success: boolean; error?: string }> {
  // Check permission
  const access = await checkThreadAccess(threadId, context);

  if (!access.hasAccess || !access.allowedActions.canArchive) {
    return {
      success: false,
      error: "You do not have permission to archive this thread",
    };
  }

  await db.execute(sql`
    UPDATE comms_threads
    SET archived_at = CURRENT_TIMESTAMP,
        archived_by = ${userId}
    WHERE id = ${threadId}
  `);

  await auditLog({
    businessId: context.businessId,
    userId,
    action: "thread_archived",
    entityType: "comms_thread",
    entityId: threadId,
    metadata: {},
  });

  return { success: true };
}

/**
 * Send message with access check
 */
export async function sendThreadMessage(
  threadId: number,
  senderId: number,
  senderRole: UserRole,
  messageBody: string,
  options: {
    isInternal?: boolean;
    internalNote?: string;
    visibleToRoles?: UserRole[];
  } = {}
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  // Check write permission
  const access = await checkThreadAccess(threadId, {
    userId: senderId,
    userRole: senderRole,
    businessId: 0, // Will be fetched from thread
  });

  if (!access.hasAccess || !access.allowedActions.canWrite) {
    return {
      success: false,
      error: "You do not have permission to send messages in this thread",
    };
  }

  // Get thread details for business ID
  const thread = await db.query.commsThreads.findFirst({
    where: eq(commsThreads.id, threadId),
  });

  if (!thread) {
    return { success: false, error: "Thread not found" };
  }

  // Insert message
  const [message] = await db
    .insert(commsMessages)
    .values({
      threadId,
      direction: "OUTBOUND",
      channel: "IN_APP",
      body: messageBody,
      // @ts-ignore - Extended schema
      isInternal: options.isInternal || false,
      internalNote: options.internalNote,
      visibleToRoles: options.visibleToRoles || [],
      senderUserId: senderId,
      senderRole,
    })
    .returning();

  // Update thread last message
  await db
    .update(commsThreads)
    .set({
      lastMessageAt: new Date(),
      lastMessagePreview: messageBody.substring(0, 100),
    })
    .where(eq(commsThreads.id, threadId));

  await auditLog({
    businessId: thread.businessId,
    userId: senderId,
    action: "message_sent",
    entityType: "comms_message",
    entityId: message.id,
    metadata: {
      threadId,
      isInternal: options.isInternal || false,
    },
  });

  return {
    success: true,
    messageId: message.id,
  };
}

/**
 * Get thread messages with access filtering
 */
export async function getThreadMessages(
  threadId: number,
  context: ThreadAccessContext,
  options: {
    limit?: number;
    offset?: number;
    includeInternal?: boolean;
  } = {}
): Promise<any[]> {
  // Check read permission
  const access = await checkThreadAccess(threadId, context);

  if (!access.hasAccess) {
    throw new Error("You do not have permission to view messages in this thread");
  }

  const limit = options.limit || 100;
  const offset = options.offset || 0;

  // Fetch messages
  const messages = await db
    .select()
    .from(commsMessages)
    .where(eq(commsMessages.threadId, threadId))
    .limit(limit)
    .offset(offset)
    .orderBy(commsMessages.createdAt);

  // Filter based on user role and internal flags
  const filtered = messages.filter((msg) => {
    // @ts-ignore
    const isInternal = msg.isInternal || false;
    // @ts-ignore
    const visibleToRoles = msg.visibleToRoles || [];

    // If message is not internal, everyone can see it
    if (!isInternal) {
      return true;
    }

    // If internal, check if user role is in visible_to_roles
    if (visibleToRoles.length > 0 && visibleToRoles.includes(context.userRole)) {
      return true;
    }

    // Owner and admin can see all internal messages
    if (context.userRole === "owner" || context.userRole === "admin") {
      return true;
    }

    // Otherwise, hide internal messages
    return false;
  });

  // Log thread access
  await db.execute(sql`
    INSERT INTO thread_access_log (thread_id, user_id, action)
    VALUES (${threadId}, ${context.userId}, 'view')
  `);

  return filtered;
}

/**
 * Bulk create job-scoped threads for all active jobs
 * Useful for initial setup or migration
 */
export async function createJobScopedThreadsForAllJobs(
  businessId: number,
  createdBy: number
): Promise<{ threadsCreated: number; errors: string[] }> {
  const errors: string[] = [];
  let threadsCreated = 0;

  // Get all active jobs
  const activeJobs = await db.select().from(jobs).where(eq(jobs.businessId, businessId));

  for (const job of activeJobs) {
    if (!job.assignedCrewId) continue;

    try {
      // Check if thread already exists
      const existing = await db.query.commsThreads.findFirst({
        where: and(
          eq(commsThreads.businessId, businessId),
          // @ts-ignore
          eq(commsThreads.scopeJobId, job.id)
        ),
      });

      if (existing) continue;

      // Get crew lead or first crew member
      const members = await db
        .select()
        .from(crewMembers)
        .where(eq(crewMembers.crewId, job.assignedCrewId))
        .limit(1);

      if (members.length === 0) continue;

      const crewMember = members[0];
      const user = await db.query.users.findFirst({
        where: eq(users.id, crewMember.userId),
      });

      if (!user) continue;

      await createSafeThread({
        businessId,
        participantUserId: user.id,
        participantPhoneE164: user.phone || `+1000000${user.id}`,
        threadType: "crew_internal",
        visibilityScope: "job",
        scopeJobId: job.id,
        allowsCustomerViewing: false,
        createdBy,
      });

      threadsCreated++;
    } catch (error: any) {
      errors.push(`Job ${job.id}: ${error.message}`);
    }
  }

  return { threadsCreated, errors };
}
