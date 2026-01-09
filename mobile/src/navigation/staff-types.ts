// ============================================
// Staff Mobile App - Navigation Types
// ============================================

export type UserRole = 'operator' | 'ops' | 'crew_leader' | 'crew_member';

// ============================================
// Root Navigation
// ============================================

export type StaffRootStackParamList = {
  Auth: undefined;
  RoleSelect: undefined;
  StaffMain: undefined;
};

export type StaffAuthStackParamList = {
  Login: undefined;
  InviteLogin: { token: string };
};

// ============================================
// Role-Based Main Tabs
// ============================================

export type StaffMainTabParamList = {
  Today: undefined;
  Jobs: undefined;
  Crews?: undefined; // Operator/Ops only
  Messages: undefined;
  Notifications: undefined;
  More: undefined;
};

// ============================================
// Today/Dashboard Stack (Role-Adaptive)
// ============================================

export type TodayStackParamList = {
  Dashboard: undefined;
  CrewStatus: { crewId: number };
  DailyRoute: { crewId: number; date: string };
};

// ============================================
// Jobs Stack
// ============================================

export type JobsStackParamList = {
  JobsList: { filter?: 'all' | 'today' | 'upcoming' | 'completed' };
  JobDetail: { jobId: number };
  JobStart: { jobId: number };
  JobQA: { jobId: number };
  JobPhotos: { jobId: number };
  CameraCapture: { jobId: number; photoType: 'before' | 'after' | 'issue' };
  ReportIssue: { jobId: number };
  JobNotes: { jobId: number };
  AgentSuggestions: { jobId: number };
};

// ============================================
// Crews Stack (Operator/Ops only)
// ============================================

export type CrewsStackParamList = {
  CrewsList: undefined;
  CrewDetail: { crewId: number };
  CrewAssignments: { crewId: number; date?: string };
  AssignmentProposal: { crewId: number; jobId: number };
  CrewPerformance: { crewId: number; period?: 'week' | 'month' };
  CrewMembers: { crewId: number };
};

// ============================================
// Messages Stack
// ============================================

export type MessagesStackParamList = {
  ThreadsList: undefined;
  Thread: {
    threadId: string;
    threadType: 'crew' | 'ops' | 'customer_proxy';
    jobId?: number;
  };
  NewThread: {
    recipientType: 'crew' | 'ops';
    crewId?: number;
  };
};

// ============================================
// Notifications Stack
// ============================================

export type NotificationsStackParamList = {
  NotificationsList: undefined;
  NotificationDetail: { notificationId: number };
  NotificationSettings: undefined;
};

// ============================================
// More/Settings Stack
// ============================================

export type MoreStackParamList = {
  MoreMenu: undefined;
  Profile: undefined;
  Settings: undefined;
  Help: undefined;
  About: undefined;
};

// ============================================
// Modals (Presented over navigation)
// ============================================

export type ModalStackParamList = {
  AgentSuggestionsPanel: {
    entityType: 'job' | 'crew_assignment' | 'message';
    entityId: string;
  };
  ConfirmAgentAction: {
    suggestionId: string;
    action: string;
    entityType: string;
    entityId: string;
    confidence: number;
  };
  EscalateToHuman: {
    entityType: 'job' | 'crew_assignment' | 'payment';
    entityId: string;
    suggestedReason?: string;
  };
  OfflineQueue: undefined;
};
