export interface User {
  id: number;
  email: string;
  phoneE164?: string;
  businessId: number;
  role?: 'owner' | 'admin' | 'crew_leader' | 'crew_member' | 'operator' | 'ops';
  crewId?: number;
  name?: string;
}

export interface InviteTokenResponse {
  token: string; // JWT
  user: User;
}

export interface Notification {
  id: number;
  type: string;
  createdAt: string;
  read: boolean;
  refId?: number;
  title?: string;
  body?: string;
  meta?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface Job {
  id: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'DELAYED' | 'RESCHEDULED' | 'upcoming' | 'completed' | 'cancelled';
  scheduledDate?: string;
  scheduledStartISO?: string;
  propertyAddress?: string;
  address?: string;
  serviceType?: string;
  reminderStage?: '7d' | '3d' | 'dayof';
  hasReminder?: boolean;
  completedDate?: string;
  providerId?: number;

  // Crew-focused fields
  customerName?: string;
  customerNotes?: string;
  accessInstructions?: string;
  whatWereDoing?: TaskItem[];
  timeWindow?: string;
  assignedCrewId?: number;
  coords?: {
    lat: number;
    lng: number;
  };
}

export interface TaskItem {
  id: string;
  description: string;
  completed?: boolean;
}

export interface QAPhoto {
  url: string;
  expiresAt: string;
}

export interface GoogleReviewLink {
  url: string;
}

// ============================================
// Crew Mobile Types
// ============================================

export type CrewStatusType = 'ON_SITE' | 'EN_ROUTE' | 'ON_BREAK';

export interface CrewMember {
  id: number;
  name: string;
  phoneE164?: string;
  role: 'LEADER' | 'MEMBER';
  isActive: boolean;
}

export interface Crew {
  crewId: number;
  name: string;
  members: CrewMember[];
  memberCount?: number;
}

export interface DashboardData {
  jobsToday: Job[];
  notifications: Notification[];
  crewSnapshot?: {
    crewName: string;
    memberCount: number;
  };
  acceptanceState?: AcceptanceState;
  stats?: DashboardStats;
}

export interface DashboardStats {
  jobsScheduled: number;
  jobsInProgress: number;
  jobsCompleted: number;
  unassignedJobs: number;
  crewsAvailable: number;
  crewsOnJob: number;
  escalations: number;
}

export interface AcceptanceState {
  accepted: boolean;
  acceptedAt?: string;
  requestedChanges?: boolean;
  requestChangesNote?: string;
}

export interface WorkRequest {
  id: number;
  timeframe: 'today' | 'this_week';
  note?: string;
  status: 'pending' | 'assigned' | 'declined';
  createdAt: string;
}

export interface PayrollPreferences {
  payFrequency: 'per_job' | 'daily' | 'weekly' | 'scheduled';
  payMethods: ('cash' | 'zelle' | 'cashapp' | 'ach')[];
  preferredMethod: 'cash' | 'zelle' | 'cashapp' | 'ach';
  payoutDetails: {
    zelle?: string;
    cashapp?: string;
    ach?: {
      routing: string;
      account: string;
      accountType: 'checking' | 'savings';
    };
  };
  lastPayout?: {
    amount: number;
    date: string;
  };
  nextPayout?: {
    amount: number;
    date: string;
  };
}
