/**
 * LawnFlow AI - Design Tokens
 * 
 * Centralized design system tokens for consistent UI across the application.
 * These complement the Tailwind config and CSS variables in index.css.
 */

// =============================================================================
// SPACING
// =============================================================================

export const spacing = {
  xs: '0.25rem',   // 4px  - tight spacing
  sm: '0.5rem',    // 8px  - component internal
  md: '1rem',      // 16px - standard gap
  lg: '1.5rem',    // 24px - section spacing
  xl: '2rem',      // 32px - major sections
  '2xl': '3rem',   // 48px - page sections
} as const;

export const spacingTailwind = {
  xs: '1',
  sm: '2',
  md: '4',
  lg: '6',
  xl: '8',
  '2xl': '12',
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
  pageTitle: 'text-2xl font-semibold',
  sectionHeader: 'text-lg font-medium',
  cardTitle: 'text-base font-medium',
  body: 'text-sm',
  label: 'text-sm font-medium',
  caption: 'text-xs text-muted-foreground',
  mono: 'font-mono text-sm',
} as const;

// =============================================================================
// USER ROLES
// =============================================================================

export type UserRole = 'OWNER' | 'ADMIN' | 'CREW_LEAD' | 'STAFF';

export const roles = {
  OWNER: { label: 'Owner', level: 100 },
  ADMIN: { label: 'Admin', level: 90 },
  CREW_LEAD: { label: 'Crew Lead', level: 50 },
  STAFF: { label: 'Staff', level: 10 },
} as const;

export function hasAccess(userRole: UserRole, requiredLevel: number): boolean {
  return roles[userRole].level >= requiredLevel;
}

export function canAccess(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

// Role access levels for specific features
export const accessLevels = {
  fullAdmin: ['OWNER', 'ADMIN'] as UserRole[],
  operations: ['OWNER', 'ADMIN', 'CREW_LEAD'] as UserRole[],
  viewOnly: ['OWNER', 'ADMIN', 'CREW_LEAD', 'STAFF'] as UserRole[],
};

// =============================================================================
// AGENT LIFECYCLE PHASES
// =============================================================================

export type AgentPhase = 
  | 'lead'
  | 'quote'
  | 'confirm'
  | 'schedule'
  | 'assign'
  | 'book'
  | 'postjob';

export const agentPhases: Record<AgentPhase, { label: string; order: number; description: string }> = {
  lead: { 
    label: 'Lead Intake', 
    order: 1,
    description: 'Capture and parse incoming leads from calls, SMS, and web forms',
  },
  quote: { 
    label: 'Quote Build', 
    order: 2,
    description: 'Generate pricing based on services, lot size, and frequency',
  },
  confirm: { 
    label: 'Quote Confirm', 
    order: 3,
    description: 'Parse customer responses: accept, decline, modify, or question',
  },
  schedule: { 
    label: 'Schedule', 
    order: 4,
    description: 'Generate time windows and handle customer selection',
  },
  assign: { 
    label: 'Crew Assign', 
    order: 5,
    description: 'Run simulations, check feasibility, and lock crew assignments',
  },
  book: { 
    label: 'Job Booking', 
    order: 6,
    description: 'Create dispatch tasks and sync with Jobber',
  },
  postjob: { 
    label: 'Post-Job', 
    order: 7,
    description: 'Handle renewals, upsells, and retention workflows',
  },
};

// =============================================================================
// AGENT DOMAINS
// =============================================================================

export type AgentDomain = 
  | 'messaging'
  | 'pricing'
  | 'scheduling'
  | 'routing'
  | 'crew_ops'
  | 'memory'
  | 'integrations';

export const agentDomains: Record<AgentDomain, { label: string; color: string }> = {
  messaging: { label: 'Messaging', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  pricing: { label: 'Pricing', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  scheduling: { label: 'Scheduling', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  routing: { label: 'Routing', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  crew_ops: { label: 'Crew Ops', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
  memory: { label: 'Memory', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' },
  integrations: { label: 'Integrations', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' },
};

// =============================================================================
// AGENT STATUS
// =============================================================================

export type AgentStatus = 'active' | 'paused' | 'error' | 'needs_config';

export const agentStatuses: Record<AgentStatus, { label: string; color: string; dotColor: string }> = {
  active: { 
    label: 'Active', 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    dotColor: 'bg-green-500',
  },
  paused: { 
    label: 'Paused', 
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    dotColor: 'bg-yellow-500',
  },
  error: { 
    label: 'Error', 
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    dotColor: 'bg-red-500',
  },
  needs_config: { 
    label: 'Needs Config', 
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    dotColor: 'bg-gray-400',
  },
};

// =============================================================================
// INBOX TASK TYPES
// =============================================================================

export type InboxTaskType = 
  | 'quote_approval'
  | 'crew_assignment'
  | 'low_confidence'
  | 'customer_reply'
  | 'integration_error';

export const inboxTaskTypes: Record<InboxTaskType, { 
  label: string; 
  icon: string;
  primaryAction: string;
  description: string;
}> = {
  quote_approval: { 
    label: 'Quote Approval', 
    icon: 'FileText',
    primaryAction: 'Approve & Send',
    description: 'Review and approve quote before sending to customer',
  },
  crew_assignment: { 
    label: 'Crew Assignment', 
    icon: 'Users',
    primaryAction: 'Confirm Assignment',
    description: 'Confirm or adjust the recommended crew assignment',
  },
  low_confidence: { 
    label: 'Low Confidence', 
    icon: 'AlertTriangle',
    primaryAction: 'Review & Decide',
    description: 'AI confidence is below threshold, human decision needed',
  },
  customer_reply: { 
    label: 'Customer Reply', 
    icon: 'MessageSquare',
    primaryAction: 'Send Response',
    description: 'Customer message requires personalized response',
  },
  integration_error: { 
    label: 'Integration Error', 
    icon: 'AlertCircle',
    primaryAction: 'Retry',
    description: 'External integration failed, review and retry',
  },
};

// =============================================================================
// SLA / URGENCY LEVELS
// =============================================================================

export type SLALevel = 'urgent' | 'warning' | 'normal';

export const slaLevels: Record<SLALevel, { 
  label: string; 
  color: string;
  bgColor: string;
  thresholdMinutes: number;
}> = {
  urgent: { 
    label: 'Urgent', 
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    thresholdMinutes: 30,
  },
  warning: { 
    label: 'Soon', 
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    thresholdMinutes: 120,
  },
  normal: { 
    label: 'Normal', 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    thresholdMinutes: Infinity,
  },
};

export function getSLALevel(dueDate: Date): SLALevel {
  const now = new Date();
  const diffMinutes = (dueDate.getTime() - now.getTime()) / (1000 * 60);
  
  if (diffMinutes <= slaLevels.urgent.thresholdMinutes) return 'urgent';
  if (diffMinutes <= slaLevels.warning.thresholdMinutes) return 'warning';
  return 'normal';
}

export function formatTimeRemaining(dueDate: Date): string {
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  
  if (diffMs < 0) return 'Overdue';
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) return `${diffMinutes}m`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

// =============================================================================
// JOB STATUS
// =============================================================================

export type JobStatus = 'new' | 'triaged' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export const jobStatuses: Record<JobStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  triaged: { label: 'Triaged', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  scheduled: { label: 'Scheduled', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

// =============================================================================
// QUOTE STATUS
// =============================================================================

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

export const quoteStatuses: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  expired: { label: 'Expired', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
};

// =============================================================================
// NAVIGATION ITEMS
// =============================================================================

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: 'count' | 'dot';
  roles: UserRole[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    id: 'core',
    label: 'Core',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/', icon: 'LayoutDashboard', roles: ['OWNER', 'ADMIN', 'CREW_LEAD', 'STAFF'] },
      { id: 'inbox', label: 'Inbox', href: '/inbox', icon: 'Inbox', badge: 'count', roles: ['OWNER', 'ADMIN', 'CREW_LEAD', 'STAFF'] },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'jobs', label: 'Jobs', href: '/jobs', icon: 'Briefcase', roles: ['OWNER', 'ADMIN', 'CREW_LEAD', 'STAFF'] },
      { id: 'quotes', label: 'Quotes', href: '/quotes', icon: 'FileText', roles: ['OWNER', 'ADMIN', 'CREW_LEAD'] },
      { id: 'schedule', label: 'Schedule', href: '/schedule', icon: 'Calendar', roles: ['OWNER', 'ADMIN', 'CREW_LEAD'] },
      { id: 'customers', label: 'Customers', href: '/customers', icon: 'Users', roles: ['OWNER', 'ADMIN', 'CREW_LEAD'] },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    items: [
      { id: 'agents', label: 'Agents', href: '/agents', icon: 'Bot', roles: ['OWNER', 'ADMIN', 'CREW_LEAD'] },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { id: 'settings', label: 'Settings', href: '/settings', icon: 'Settings', roles: ['OWNER', 'ADMIN'] },
    ],
  },
];

// =============================================================================
// AGENT REGISTRY
// =============================================================================

export interface AgentDefinition {
  id: string;
  name: string;
  phase: AgentPhase;
  domains: AgentDomain[];
  purpose: string;
  inputs: string[];
  outputs: string[];
  triggers: string[];
}

export const agentRegistry: AgentDefinition[] = [
  {
    id: 'intake_agent',
    name: 'Intake Agent',
    phase: 'lead',
    domains: ['messaging'],
    purpose: 'Parse and collect customer/property data from inbound messages',
    inputs: ['SMS message', 'Phone number', 'Web form data'],
    outputs: ['Customer profile', 'Property address', 'Service request'],
    triggers: ['New SMS', 'Missed call', 'Web form submission'],
  },
  {
    id: 'quote_agent',
    name: 'Quote Agent',
    phase: 'quote',
    domains: ['pricing'],
    purpose: 'Calculate pricing based on services, lot size, and frequency',
    inputs: ['Service type', 'Lot size', 'Frequency', 'Add-ons'],
    outputs: ['Quote amount', 'Line items', 'Discount applied'],
    triggers: ['Lead intake complete', 'Quote request'],
  },
  {
    id: 'confirm_agent',
    name: 'Confirmation Agent',
    phase: 'confirm',
    domains: ['messaging'],
    purpose: 'Parse customer responses to quotes and handle objections',
    inputs: ['Customer reply', 'Quote context'],
    outputs: ['Response classification', 'Next action'],
    triggers: ['Customer SMS reply', 'Quote timeout'],
  },
  {
    id: 'schedule_agent',
    name: 'Scheduling Agent',
    phase: 'schedule',
    domains: ['scheduling'],
    purpose: 'Generate available time windows and coordinate customer selection',
    inputs: ['Crew availability', 'Customer preferences', 'Service duration'],
    outputs: ['Time window options', 'Selected slot'],
    triggers: ['Quote accepted', 'Reschedule request'],
  },
  {
    id: 'simulation_agent',
    name: 'Simulation Agent',
    phase: 'assign',
    domains: ['routing', 'crew_ops'],
    purpose: 'Run crew simulations to find optimal assignments',
    inputs: ['Job requirements', 'Crew roster', 'Equipment needs'],
    outputs: ['Simulation results', 'Crew recommendations'],
    triggers: ['Schedule confirmed', 'Manual trigger'],
  },
  {
    id: 'feasibility_agent',
    name: 'Feasibility Agent',
    phase: 'assign',
    domains: ['crew_ops'],
    purpose: 'Validate job feasibility based on crew and equipment',
    inputs: ['Simulation results', 'Crew skills', 'Equipment list'],
    outputs: ['Feasibility score', 'Blockers'],
    triggers: ['Simulation complete'],
  },
  {
    id: 'margin_agent',
    name: 'Margin Agent',
    phase: 'assign',
    domains: ['pricing'],
    purpose: 'Compute margin score and validate profitability',
    inputs: ['Quote amount', 'Crew cost', 'Travel time'],
    outputs: ['Margin score', 'Profitability flag'],
    triggers: ['Feasibility passed'],
  },
  {
    id: 'crew_lock_agent',
    name: 'Crew Lock Agent',
    phase: 'assign',
    domains: ['crew_ops'],
    purpose: 'Auto-approve or queue for manual review based on scores',
    inputs: ['Margin score', 'Feasibility score', 'Confidence'],
    outputs: ['Assignment decision', 'Approval status'],
    triggers: ['Margin validated'],
  },
  {
    id: 'dispatch_agent',
    name: 'Dispatch Agent',
    phase: 'book',
    domains: ['routing', 'integrations'],
    purpose: 'Create schedule items and sync with Jobber',
    inputs: ['Locked assignment', 'Route sequence'],
    outputs: ['Dispatch task', 'Jobber sync status'],
    triggers: ['Assignment approved'],
  },
  {
    id: 'comms_agent',
    name: 'Customer Comms Agent',
    phase: 'book',
    domains: ['messaging'],
    purpose: 'Send customer confirmations and updates',
    inputs: ['Job details', 'Customer contact', 'Message template'],
    outputs: ['Message sent', 'Delivery status'],
    triggers: ['Job booked', 'Schedule change', 'Job complete'],
  },
  {
    id: 'renewal_agent',
    name: 'Renewal Agent',
    phase: 'postjob',
    domains: ['pricing', 'messaging'],
    purpose: 'Generate renewal offers and upsell recommendations',
    inputs: ['Customer history', 'Season', 'Service catalog'],
    outputs: ['Renewal quote', 'Upsell offer'],
    triggers: ['Job completed', 'Weekly scan'],
  },
  {
    id: 'memory_agent',
    name: 'Memory Agent',
    phase: 'postjob',
    domains: ['memory'],
    purpose: 'Store and retrieve customer interaction memories',
    inputs: ['Interaction data', 'Customer ID'],
    outputs: ['Memory stored', 'Context enriched'],
    triggers: ['Stage transition', 'Customer interaction'],
  },
];
