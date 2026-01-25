import { apiClient } from './client';
import { generateTraceId, generateIdempotencyKey, formatApiError } from './utils';
import { secureStorage } from '../storage/secureStorage';
import * as Device from 'expo-device';

// ============================================
// Command API - All state-changing operations
// ============================================

interface CommandPayload {
  traceId: string;
  idempotencyKey: string;
  entityId: string;
  userId?: number;
  deviceId?: string;
  [key: string]: any;
}

interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

let deviceId: string | null = null;

async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;

  try {
    const stored = await secureStorage.getItem('device_id');
    if (stored) {
      deviceId = stored;
      return deviceId;
    }

    const newId = `${Device.osName || 'unknown'}-${Device.modelId || 'unknown'}-${Date.now()}`;
    await secureStorage.setItem('device_id', newId);
    deviceId = newId;
    return deviceId;
  } catch {
    return `unknown-${Date.now()}`;
  }
}

async function getUserId(): Promise<number | undefined> {
  try {
    const userJson = await secureStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      return user.id;
    }
  } catch {
    return undefined;
  }
}

async function executeCommand<T = any>(
  commandType: string,
  payload: Record<string, any>
): Promise<CommandResult<T>> {
  try {
    const traceId = generateTraceId(commandType);
    const idempotencyKey = generateIdempotencyKey(commandType, payload.entityId);
    const userId = await getUserId();
    const devId = await getDeviceId();

    const fullPayload: CommandPayload = {
      ...payload,
      traceId,
      idempotencyKey,
      userId,
      deviceId: devId,
    };

    console.log(`[Commands] Executing: ${commandType}`, { traceId, idempotencyKey });

    const response = await apiClient.post<T>(`/commands/${commandType}`, fullPayload);

    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    console.error(`[Commands] Failed: ${commandType}`, error);

    return {
      success: false,
      error: formatApiError(error),
    };
  }
}

// ============================================
// Crew Assignment Commands
// ============================================

export async function confirmCrewAssignment(params: {
  assignmentId: number;
  crewId: number;
  accept: boolean;
  notes?: string;
}) {
  return executeCommand('confirm-crew-assignment', {
    entityId: `assignment_${params.assignmentId}`,
    ...params,
  });
}

// ============================================
// Job Commands
// ============================================

export async function startJob(jobId: number, startedAt?: string) {
  return executeCommand('start-job', {
    entityId: `job_${jobId}`,
    jobId,
    startedAt: startedAt || new Date().toISOString(),
  });
}

export async function pauseJob(jobId: number, reason?: string) {
  return executeCommand('pause-job', {
    entityId: `job_${jobId}`,
    jobId,
    reason,
    pausedAt: new Date().toISOString(),
  });
}

export async function resumeJob(jobId: number) {
  return executeCommand('resume-job', {
    entityId: `job_${jobId}`,
    jobId,
    resumedAt: new Date().toISOString(),
  });
}

export async function completeJob(jobId: number, params?: {
  completedAt?: string;
  notes?: string;
  photosUploaded?: number;
}) {
  return executeCommand('complete-job', {
    entityId: `job_${jobId}`,
    jobId,
    completedAt: params?.completedAt || new Date().toISOString(),
    notes: params?.notes,
    photosUploaded: params?.photosUploaded,
  });
}

export async function addJobNote(jobId: number, note: string, noteType?: string) {
  return executeCommand('add-job-note', {
    entityId: `job_${jobId}`,
    jobId,
    note,
    noteType: noteType || 'general',
    timestamp: new Date().toISOString(),
  });
}

export async function reportIssue(params: {
  jobId: number;
  issueType: 'equipment' | 'access' | 'scope_mismatch' | 'customer_unavailable' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high';
  requiresEscalation?: boolean;
}) {
  return executeCommand('report-issue', {
    entityId: `job_${params.jobId}`,
    ...params,
    reportedAt: new Date().toISOString(),
  });
}

// ============================================
// QA Photo Commands
// ============================================

export async function uploadQAPhoto(params: {
  jobId: number;
  photoUri: string;
  caption?: string;
  tags?: string[];
  isRequired?: boolean;
}) {
  return executeCommand('upload-qa-photo', {
    entityId: `job_${params.jobId}`,
    ...params,
    uploadedAt: new Date().toISOString(),
  });
}

export async function submitQAChecklist(params: {
  jobId: number;
  checklistItems: Array<{
    id: string;
    completed: boolean;
    notes?: string;
  }>;
}) {
  return executeCommand('submit-qa-checklist', {
    entityId: `job_${params.jobId}`,
    ...params,
    submittedAt: new Date().toISOString(),
  });
}

// ============================================
// Communication Commands
// ============================================

export async function sendMessage(params: {
  threadId: string;
  threadType: 'crew' | 'ops' | 'customer_proxy';
  message: string;
  attachments?: string[];
}) {
  return executeCommand('send-message', {
    entityId: `thread_${params.threadId}`,
    ...params,
    sentAt: new Date().toISOString(),
  });
}

export async function markMessageRead(messageId: number, threadId: string) {
  return executeCommand('mark-message-read', {
    entityId: `thread_${threadId}`,
    messageId,
    threadId,
    readAt: new Date().toISOString(),
  });
}

// ============================================
// Notification Commands
// ============================================

export async function ackNotification(notificationId: number) {
  return executeCommand('ack-notification', {
    entityId: `notification_${notificationId}`,
    notificationId,
    ackedAt: new Date().toISOString(),
  });
}

export async function dismissNotification(notificationId: number) {
  return executeCommand('dismiss-notification', {
    entityId: `notification_${notificationId}`,
    notificationId,
    dismissedAt: new Date().toISOString(),
  });
}

// ============================================
// Agent Suggestion Commands
// ============================================

export async function executeAgentSuggestion(params: {
  suggestionId: string;
  entityType: 'job' | 'crew_assignment' | 'message';
  entityId: string;
  action: string;
  confirmed: boolean;
}) {
  return executeCommand('execute-agent-suggestion', {
    entityId: `${params.entityType}_${params.entityId}`,
    ...params,
    executedAt: new Date().toISOString(),
  });
}

export async function escalateToHuman(params: {
  entityType: 'job' | 'crew_assignment' | 'payment';
  entityId: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}) {
  return executeCommand('escalate-to-human', {
    entityId: `${params.entityType}_${params.entityId}`,
    ...params,
    escalatedAt: new Date().toISOString(),
  });
}

// ============================================
// Crew Status Commands
// ============================================

export async function updateCrewStatus(params: {
  crewId: number;
  status: 'available' | 'on_job' | 'on_break' | 'offline';
  location?: { lat: number; lng: number };
}) {
  return executeCommand('update-crew-status', {
    entityId: `crew_${params.crewId}`,
    ...params,
    timestamp: new Date().toISOString(),
  });
}

export async function requestAssignmentChange(params: {
  jobId: number;
  currentCrewId: number;
  reason: string;
  suggestedCrewId?: number;
}) {
  return executeCommand('request-assignment-change', {
    entityId: `job_${params.jobId}`,
    ...params,
    requestedAt: new Date().toISOString(),
  });
}

// ============================================
// Schedule Acceptance Commands (NEW)
// ============================================

export async function acceptSchedule(): Promise<CommandResult<{ acceptedAt: string }>> {
  const userId = await getUserId();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  return executeCommand('accept-daily-schedule', {
    entityId: `schedule_${userId}_${date}`,
    accepted: true,
    acceptedAt: new Date().toISOString(),
  });
}

export async function requestScheduleChanges(note: string): Promise<CommandResult<{ requestId: number }>> {
  const userId = await getUserId();
  const date = new Date().toISOString().split('T')[0];

  return executeCommand('request-schedule-changes', {
    entityId: `schedule_${userId}_${date}`,
    note,
    requestedAt: new Date().toISOString(),
  });
}

// ============================================
// Work Request Commands (NEW)
// ============================================

export async function submitWorkRequest(params: {
  timeframe: 'today' | 'this_week';
  note?: string;
}): Promise<CommandResult<{ requestId: number }>> {
  const userId = await getUserId();

  return executeCommand('submit-work-request', {
    entityId: `work_request_${userId}_${Date.now()}`,
    ...params,
    submittedAt: new Date().toISOString(),
  });
}

// ============================================
// Payroll Preferences Commands (NEW)
// ============================================

export async function updatePayrollPreferences(params: {
  payFrequency: 'per_job' | 'daily' | 'weekly' | 'scheduled';
  payMethods: ('cash' | 'zelle' | 'cashapp' | 'ach')[];
  preferredMethod: 'cash' | 'zelle' | 'cashapp' | 'ach';
  payoutDetails: Record<string, any>;
}): Promise<CommandResult<any>> {
  const userId = await getUserId();

  return executeCommand('update-payroll-preferences', {
    entityId: `payroll_${userId}`,
    ...params,
    updatedAt: new Date().toISOString(),
  });
}

// ============================================
// Job Status Commands (NEW)
// ============================================

export async function updateJobStatus(params: {
  jobId: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'DELAYED' | 'RESCHEDULED';
  reason?: string;
}): Promise<CommandResult<any>> {
  return executeCommand('update-job-status', {
    entityId: `job_${params.jobId}`,
    ...params,
    updatedAt: new Date().toISOString(),
  });
}
