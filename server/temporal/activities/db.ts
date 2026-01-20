/**
 * Database Activities
 *
 * Activities for database operations - reading/writing workflow state,
 * loading entity data, and recording audit trails.
 *
 * @module server/temporal/activities/db
 */

import { db } from '../../db';
import { storage } from '../../storage';
import {
  workflowRuns,
  workflowSteps,
  InsertWorkflowRun,
  InsertWorkflowStep,
  WorkflowRun,
  WorkflowStep,
} from '@shared/schema-temporal';
import { eq } from 'drizzle-orm';
import type { Job, BusinessProfile } from '@shared/schema';

// ============================================================================
// Workflow Run Operations
// ============================================================================

export interface RecordWorkflowRunInput {
  workflowId: string;
  runId: string;
  workflowType: string;
  accountId: string;
  businessId: number;
  primaryEntityType: string;
  primaryEntityId: number;
  taskQueue: string;
  inputJson: Record<string, unknown>;
  legacyRunId?: string;
}

export interface RecordWorkflowRunOutput {
  id: number;
  workflowId: string;
}

/**
 * Record a new workflow run in the database
 */
export async function recordWorkflowRunActivity(
  input: RecordWorkflowRunInput
): Promise<RecordWorkflowRunOutput> {
  const insertData: InsertWorkflowRun = {
    workflowId: input.workflowId,
    runId: input.runId,
    workflowType: input.workflowType,
    accountId: input.accountId,
    businessId: input.businessId,
    primaryEntityType: input.primaryEntityType,
    primaryEntityId: input.primaryEntityId,
    taskQueue: input.taskQueue,
    inputJson: input.inputJson,
    status: 'running',
    legacyRunId: input.legacyRunId,
  };

  const [result] = await db.insert(workflowRuns).values(insertData).returning();

  return {
    id: result.id,
    workflowId: result.workflowId,
  };
}

export interface UpdateWorkflowRunInput {
  workflowId: string;
  status?: string;
  currentStage?: string;
  outputJson?: Record<string, unknown>;
  errorJson?: Record<string, unknown>;
  completedAt?: Date;
}

/**
 * Update an existing workflow run
 */
export async function updateWorkflowRunActivity(
  input: UpdateWorkflowRunInput
): Promise<void> {
  const updateData: Partial<WorkflowRun> = {
    updatedAt: new Date(),
  };

  if (input.status) updateData.status = input.status;
  if (input.currentStage) updateData.currentStage = input.currentStage;
  if (input.outputJson) updateData.outputJson = input.outputJson;
  if (input.errorJson) updateData.errorJson = input.errorJson;
  if (input.completedAt) updateData.completedAt = input.completedAt;

  await db
    .update(workflowRuns)
    .set(updateData)
    .where(eq(workflowRuns.workflowId, input.workflowId));
}

// ============================================================================
// Workflow Step Operations
// ============================================================================

export interface RecordWorkflowStepInput {
  workflowRunId: number;
  activityType: string;
  activityId: string;
  stepIndex: number;
  status: string;
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  errorMessage?: string;
  errorStack?: string;
  errorType?: string;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  modelUsed?: string;
  modelProvider?: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface RecordWorkflowStepOutput {
  id: number;
}

/**
 * Record a workflow step execution
 */
export async function recordWorkflowStepActivity(
  input: RecordWorkflowStepInput
): Promise<RecordWorkflowStepOutput> {
  const insertData: InsertWorkflowStep = {
    workflowRunId: input.workflowRunId,
    activityType: input.activityType,
    activityId: input.activityId,
    stepIndex: input.stepIndex,
    status: input.status,
    inputJson: input.inputJson,
    outputJson: input.outputJson,
    errorMessage: input.errorMessage,
    errorStack: input.errorStack,
    errorType: input.errorType,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: input.durationMs,
    modelUsed: input.modelUsed,
    modelProvider: input.modelProvider,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
  };

  const [result] = await db.insert(workflowSteps).values(insertData).returning();

  return { id: result.id };
}

// ============================================================================
// Entity Loading Operations
// ============================================================================

export interface LoadJobInput {
  jobId: number;
}

export interface LoadJobOutput {
  job: Job | null;
}

/**
 * Load a job by ID
 */
export async function loadJobActivity(input: LoadJobInput): Promise<LoadJobOutput> {
  const job = await storage.getJob(input.jobId);
  return { job: job || null };
}

export interface LoadJobRequestInput {
  jobRequestId: number;
}

export interface LoadJobRequestOutput {
  jobRequest: Record<string, unknown> | null;
}

/**
 * Load a job request by ID
 */
export async function loadJobRequestActivity(
  input: LoadJobRequestInput
): Promise<LoadJobRequestOutput> {
  const jobRequest = await storage.getJobRequest(input.jobRequestId);
  return { jobRequest: jobRequest ? (jobRequest as unknown as Record<string, unknown>) : null };
}

export interface LoadBusinessProfileInput {
  businessId: number;
}

export interface LoadBusinessProfileOutput {
  profile: BusinessProfile | null;
}

/**
 * Load a business profile by ID
 */
export async function loadBusinessProfileActivity(
  input: LoadBusinessProfileInput
): Promise<LoadBusinessProfileOutput> {
  const profile = await storage.getBusinessProfile(input.businessId);
  return { profile: profile || null };
}

export interface LoadCustomerInput {
  customerId: number;
}

export interface LoadCustomerOutput {
  customer: Record<string, unknown> | null;
}

/**
 * Load a customer by ID (from conversations or leads)
 */
export async function loadCustomerActivity(
  input: LoadCustomerInput
): Promise<LoadCustomerOutput> {
  // Try to get from conversations first
  const conversation = await storage.getConversation(input.customerId);
  if (conversation) {
    return {
      customer: {
        id: conversation.id,
        name: conversation.customerName,
        phone: conversation.customerPhone,
        source: 'conversation',
      },
    };
  }

  // Try leads
  const lead = await storage.getLead(input.customerId);
  if (lead) {
    return {
      customer: {
        id: lead.id,
        name: lead.customerName,
        phone: lead.customerPhone,
        email: lead.email,
        address: lead.address,
        source: 'lead',
      },
    };
  }

  return { customer: null };
}
