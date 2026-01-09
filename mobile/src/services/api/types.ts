export interface User {
  id: number;
  email: string;
  phoneE164?: string;
  businessId: number;
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
  status: 'upcoming' | 'completed' | 'cancelled';
  scheduledDate?: string;
  propertyAddress?: string;
  serviceType?: string;
  reminderStage?: '7d' | '3d' | 'dayof';
  hasReminder?: boolean;
  completedDate?: string;
  providerId?: number;
}

export interface QAPhoto {
  url: string;
  expiresAt: string;
}

export interface GoogleReviewLink {
  url: string;
}
