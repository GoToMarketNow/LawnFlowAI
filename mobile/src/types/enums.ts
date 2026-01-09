// ============================================
// Crew & Job Status Enums
// ============================================

export const CrewStatus = {
  ON_SITE: 'ON_SITE',
  EN_ROUTE: 'EN_ROUTE',
  ON_BREAK: 'ON_BREAK',
} as const;

export type CrewStatusType = typeof CrewStatus[keyof typeof CrewStatus];

export const CrewStatusLabels: Record<CrewStatusType, string> = {
  [CrewStatus.ON_SITE]: 'On Site',
  [CrewStatus.EN_ROUTE]: 'En Route',
  [CrewStatus.ON_BREAK]: 'On Break',
};

export const CrewStatusColors: Record<CrewStatusType, string> = {
  [CrewStatus.ON_SITE]: '#4CAF50', // Green
  [CrewStatus.EN_ROUTE]: '#FF9800', // Orange
  [CrewStatus.ON_BREAK]: '#9E9E9E', // Gray
};

// ============================================
// Job Status
// ============================================

export const JobStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETE: 'COMPLETE',
  DELAYED: 'DELAYED',
  RESCHEDULED: 'RESCHEDULED',
} as const;

export type JobStatusType = typeof JobStatus[keyof typeof JobStatus];

export const JobStatusLabels: Record<JobStatusType, string> = {
  [JobStatus.PENDING]: 'Pending',
  [JobStatus.IN_PROGRESS]: 'In Progress',
  [JobStatus.COMPLETE]: 'Complete',
  [JobStatus.DELAYED]: 'Delayed',
  [JobStatus.RESCHEDULED]: 'Rescheduled',
};

export const JobStatusColors: Record<JobStatusType, { bg: string; text: string }> = {
  [JobStatus.PENDING]: { bg: '#E3F2FD', text: '#1976D2' },
  [JobStatus.IN_PROGRESS]: { bg: '#FFF3E0', text: '#F57C00' },
  [JobStatus.COMPLETE]: { bg: '#E8F5E9', text: '#388E3C' },
  [JobStatus.DELAYED]: { bg: '#FFEBEE', text: '#D32F2F' },
  [JobStatus.RESCHEDULED]: { bg: '#F3E5F5', text: '#7B1FA2' },
};

// ============================================
// User Roles
// ============================================

export const UserRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  CREW_LEADER: 'crew_leader',
  CREW_MEMBER: 'crew_member',
  OPERATOR: 'operator',
  OPS: 'ops',
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// ============================================
// Helper Functions
// ============================================

export function getCrewStatusLabel(status: CrewStatusType): string {
  return CrewStatusLabels[status] || status;
}

export function getCrewStatusColor(status: CrewStatusType): string {
  return CrewStatusColors[status] || '#9E9E9E';
}

export function getJobStatusLabel(status: JobStatusType): string {
  return JobStatusLabels[status] || status;
}

export function getJobStatusColors(status: JobStatusType): { bg: string; text: string } {
  return JobStatusColors[status] || { bg: '#F5F5F5', text: '#666666' };
}
