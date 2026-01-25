import { apiClient } from './client';
import { generateTraceId, formatApiError } from './utils';

// ============================================
// Query API - All read operations
// ============================================

interface QueryResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

async function executeQuery<T = any>(
  endpoint: string,
  params?: Record<string, any>
): Promise<QueryResult<T>> {
  try {
    const traceId = generateTraceId('query');

    console.log(`[Queries] Fetching: ${endpoint}`, params);

    const response = await apiClient.get<T>(endpoint, {
      params,
      headers: {
        'X-Trace-Id': traceId,
      },
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    console.error(`[Queries] Failed: ${endpoint}`, error);

    return {
      success: false,
      error: formatApiError(error),
    };
  }
}

// ============================================
// User Queries
// ============================================

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'operator' | 'ops' | 'crew_leader' | 'crew_member';
  crewId?: number;
  permissions: string[];
}

export async function getMe(): Promise<QueryResult<User>> {
  return executeQuery<User>('/me');
}

// ============================================
// Job Queries
// ============================================

export interface Job {
  id: number;
  customerName: string;
  customerPhone?: string;
  address: string;
  lat?: number;
  lng?: number;
  serviceType: string;
  status: 'scheduled' | 'in_progress' | 'paused' | 'completed' | 'closed';
  scheduledStartISO: string;
  scheduledEndISO?: string;
  actualStartISO?: string;
  actualEndISO?: string;
  crewId?: number;
  crewName?: string;
  assignedTo?: number[];
  estimatedDuration?: number;
  notes?: string;
  requiredPhotos?: number;
  uploadedPhotos?: number;
  checklistComplete?: boolean;
  amount?: number;
  paymentStatus?: 'pending' | 'captured' | 'failed';
}

export async function getTodayJobs(params?: {
  crewId?: number;
  status?: string;
  date?: string;
}): Promise<QueryResult<Job[]>> {
  return executeQuery<Job[]>('/today/jobs', params);
}

export async function getJob(jobId: number): Promise<QueryResult<Job>> {
  return executeQuery<Job>(`/jobs/${jobId}`);
}

export async function getJobHistory(params?: {
  crewId?: number;
  limit?: number;
  offset?: number;
}): Promise<QueryResult<Job[]>> {
  return executeQuery<Job[]>('/jobs/history', params);
}

// ============================================
// Crew Queries
// ============================================

export interface Crew {
  id: number;
  name: string;
  status: 'available' | 'on_job' | 'on_break' | 'offline';
  currentJobId?: number;
  members: CrewMember[];
  skills: string[];
  equipment: string[];
  location?: { lat: number; lng: number };
  lastUpdate?: string;
}

export interface CrewMember {
  id: number;
  name: string;
  role: 'leader' | 'member';
  phone?: string;
  skills: string[];
}

export async function getCrews(): Promise<QueryResult<Crew[]>> {
  return executeQuery<Crew[]>('/crews');
}

export async function getCrew(crewId: number): Promise<QueryResult<Crew>> {
  return executeQuery<Crew>(`/crews/${crewId}`);
}

export async function getCrewAssignments(crewId: number, params?: {
  date?: string;
  status?: string;
}): Promise<QueryResult<any[]>> {
  return executeQuery(`/crews/${crewId}/assignments`, params);
}

// ============================================
// Messages Queries
// ============================================

export interface Message {
  id: number;
  threadId: string;
  threadType: 'crew' | 'ops' | 'customer_proxy';
  senderId: number;
  senderName: string;
  senderRole: string;
  message: string;
  attachments?: string[];
  sentAt: string;
  readAt?: string;
  isSystemMessage?: boolean;
}

export async function getMessages(threadId: string, params?: {
  limit?: number;
  before?: string;
}): Promise<QueryResult<Message[]>> {
  return executeQuery<Message[]>('/messages', {
    thread_id: threadId,
    ...params,
  });
}

export async function getThreads(params?: {
  threadType?: string;
  unreadOnly?: boolean;
}): Promise<QueryResult<any[]>> {
  return executeQuery('/threads', params);
}

// ============================================
// Notifications Queries
// ============================================

export interface Notification {
  id: number;
  type: 'assignment' | 'dispatch' | 'reminder' | 'escalation' | 'payment' | 'message';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  entityType?: string;
  entityId?: string;
  actionRequired?: boolean;
  actionUrl?: string;
  read: boolean;
  acked: boolean;
  createdAt: string;
}

export async function getNotifications(params?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<QueryResult<Notification[]>> {
  return executeQuery<Notification[]>('/notifications', params);
}

export async function getUnreadCount(): Promise<QueryResult<{ count: number }>> {
  return executeQuery<{ count: number }>('/notifications/unread-count');
}

// ============================================
// Agent Suggestions Queries
// ============================================

export interface AgentSuggestion {
  id: string;
  entityType: 'job' | 'crew_assignment' | 'message';
  entityId: string;
  decision: string;
  suggestedActions: Array<{
    type: string;
    label: string;
    description: string;
    command: string;
    params: Record<string, any>;
  }>;
  confidence: number;
  confidenceBreakdown: {
    dataCompleteness: number;
    policyCompliance: number;
    [key: string]: number;
  };
  riskFlags: string[];
  humanRequired: boolean;
  handoffReason?: string;
  rationale: string;
}

export async function getAgentSuggestions(params: {
  entityType: 'job' | 'crew_assignment' | 'message';
  entityId: string;
}): Promise<QueryResult<AgentSuggestion>> {
  return executeQuery<AgentSuggestion>('/agent-suggestions', params);
}

// ============================================
// QA & Photos Queries
// ============================================

export interface JobPhoto {
  id: number;
  jobId: number;
  photoUrl: string;
  thumbnailUrl?: string;
  aiCaption?: string;
  aiTags?: string[];
  uploadedByCrewMemberId?: number;
  uploadedAt: string;
  status: 'pending_upload' | 'uploaded' | 'failed';
}

export async function getJobPhotos(jobId: number): Promise<QueryResult<JobPhoto[]>> {
  return executeQuery<JobPhoto[]>(`/jobs/${jobId}/photos`);
}

export interface QAChecklist {
  id: number;
  jobId: number;
  items: Array<{
    id: string;
    label: string;
    required: boolean;
    completed: boolean;
    notes?: string;
  }>;
  requiredPhotos: number;
  uploadedPhotos: number;
  completionGate: boolean;
}

export async function getQAChecklist(jobId: number): Promise<QueryResult<QAChecklist>> {
  return executeQuery<QAChecklist>(`/jobs/${jobId}/qa-checklist`);
}

// ============================================
// Analytics & Stats (for operator/ops)
// ============================================

export async function getCrewPerformance(crewId: number, params?: {
  startDate?: string;
  endDate?: string;
}): Promise<QueryResult<any>> {
  return executeQuery(`/crews/${crewId}/performance`, params);
}

export async function getDashboardStats(params?: {
  date?: string;
}): Promise<QueryResult<{
  jobsScheduled: number;
  jobsInProgress: number;
  jobsCompleted: number;
  crewsAvailable: number;
  crewsOnJob: number;
  unassignedJobs: number;
  escalations: number;
}>> {
  return executeQuery('/dashboard/stats', params);
}

// ============================================
// Crew Mobile Queries (NEW)
// ============================================

import type {
  DashboardData,
  AcceptanceState,
  Crew as CrewDetail,
  WorkRequest,
  PayrollPreferences,
  CrewStatusType,
} from './types';

export async function getDashboardToday(): Promise<QueryResult<DashboardData>> {
  return executeQuery<DashboardData>('/api/mobile/dashboard/today');
}

export async function getScheduleToday(): Promise<QueryResult<{
  jobs: Job[];
  acceptanceState: AcceptanceState;
}>> {
  return executeQuery('/api/mobile/schedule/today');
}

export async function getCrewMe(): Promise<QueryResult<CrewDetail>> {
  return executeQuery<CrewDetail>('/api/mobile/crew/me');
}

export async function getPayrollPreferences(): Promise<QueryResult<PayrollPreferences>> {
  return executeQuery<PayrollPreferences>('/api/mobile/payroll/preferences');
}

export async function getWorkRequests(): Promise<QueryResult<WorkRequest[]>> {
  return executeQuery<WorkRequest[]>('/api/mobile/work-requests');
}

// Crew status update (could be a command, but implemented as query for simplicity)
export async function updateCrewStatus(status: CrewStatusType): Promise<QueryResult<any>> {
  try {
    const traceId = generateTraceId('crew_status');
    const response = await apiClient.patch('/api/mobile/crew/status', {
      crewStatus: status,
    }, {
      headers: {
        'X-Trace-Id': traceId,
      },
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    console.error('[Queries] Failed to update crew status', error);
    return {
      success: false,
      error: formatApiError(error),
    };
  }
}
