/**
 * LawnFlow AI - Navigation Configuration V3
 * 
 * UX Redesign V2: Complete role-based navigation
 * - "UX Operating System" redesign
 * - Calm operations UI with Work Queue + Approvals focus
 * - Enhanced settings structure with full configuration access
 * - Agent orchestration visibility without complexity
 */

import type { UserRole } from "./tokens";
import { isFeatureEnabled } from "../feature-flags";

export interface NavItemV3 {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: 'count' | 'dot' | 'sla';
  roles: UserRole[];
  shortcut?: string;
  description?: string;
  children?: NavItemV3[];
}

export interface NavGroupV3 {
  id: string;
  label: string;
  collapsed?: boolean;
  items: NavItemV3[];
}

/**
 * V3 Navigation for OWNER/ADMIN roles
 * Full access to all surfaces with enhanced settings structure
 */
const navigationV3Admin: NavGroupV3[] = [
  {
    id: 'command',
    label: 'Command',
    items: [
      { 
        id: 'home', 
        label: 'Command Center', 
        href: '/home', 
        icon: 'LayoutDashboard', 
        roles: ['OWNER', 'ADMIN'],
        shortcut: 'g h',
        description: 'KPIs, action feeds, and ops overview',
      },
      { 
        id: 'work', 
        label: 'Work Queue', 
        href: '/work', 
        icon: 'Inbox', 
        badge: 'count', 
        roles: ['OWNER', 'ADMIN'],
        shortcut: 'g w',
        description: 'Unified inbox for all actionable items',
      },
      { 
        id: 'approvals', 
        label: 'Approvals', 
        href: '/approvals', 
        icon: 'CheckCircle', 
        badge: 'sla', 
        roles: ['OWNER', 'ADMIN'],
        shortcut: 'g a',
        description: 'Fast approval interface - quotes, schedules, billing',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { 
        id: 'schedule', 
        label: 'Schedule', 
        href: '/schedule', 
        icon: 'Calendar', 
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD', 'STAFF'],
        shortcut: 'g s',
        description: 'Today Plan and calendar view',
      },
      { 
        id: 'crews', 
        label: 'Crews', 
        href: '/operations/crews', 
        icon: 'Truck', 
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD'],
        shortcut: 'g r',
        description: 'Roster, live status, and assignments',
      },
      { 
        id: 'comms', 
        label: 'Comms', 
        href: '/comms', 
        icon: 'MessageSquare', 
        badge: 'count',
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD'],
        shortcut: 'g m',
        description: 'Inbox and Studio for customer/crew messaging',
      },
      { 
        id: 'customers', 
        label: 'Customers', 
        href: '/customers', 
        icon: 'Users', 
        roles: ['OWNER', 'ADMIN'],
        shortcut: 'g c',
        description: 'Customer database and preferences',
      },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    items: [
      { 
        id: 'billing-invoices', 
        label: 'Invoices', 
        href: '/billing/invoices', 
        icon: 'FileText', 
        roles: ['OWNER', 'ADMIN'],
        shortcut: 'g i',
        description: 'Draft, sent, paid, and overdue',
      },
      { 
        id: 'billing-issues', 
        label: 'Issues', 
        href: '/billing/issues', 
        icon: 'AlertTriangle', 
        badge: 'count', 
        roles: ['OWNER', 'ADMIN'],
        description: 'Disputes, sync errors, and variances',
      },
      { 
        id: 'billing-payments', 
        label: 'Payments', 
        href: '/billing/payments', 
        icon: 'CreditCard', 
        roles: ['OWNER', 'ADMIN'],
        description: 'Payment status from accounting',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    collapsed: true,
    items: [
      { 
        id: 'settings-overview', 
        label: 'Business Profile', 
        href: '/settings', 
        icon: 'Settings', 
        roles: ['OWNER', 'ADMIN'],
        description: 'Service area, hours, contact channels',
      },
      { 
        id: 'settings-services', 
        label: 'Services', 
        href: '/settings/services', 
        icon: 'Package', 
        roles: ['OWNER', 'ADMIN'],
        description: 'Service catalog and variants',
      },
      { 
        id: 'settings-pricing', 
        label: 'Pricing', 
        href: '/settings/pricing', 
        icon: 'DollarSign', 
        roles: ['OWNER', 'ADMIN'],
        description: 'Pricing models and rules',
      },
      { 
        id: 'settings-templates', 
        label: 'Templates', 
        href: '/settings/templates', 
        icon: 'MessageSquare', 
        roles: ['OWNER', 'ADMIN'],
        description: 'SMS, email, and briefing templates',
      },
      { 
        id: 'settings-users', 
        label: 'Users & Roles', 
        href: '/settings/users', 
        icon: 'Users', 
        roles: ['OWNER', 'ADMIN'],
        description: 'Team management and permissions',
      },
      { 
        id: 'settings-integrations', 
        label: 'Integrations', 
        href: '/settings/integrations', 
        icon: 'Plug', 
        roles: ['OWNER', 'ADMIN'],
        description: 'Jobber, Twilio, QuickBooks',
      },
      { 
        id: 'settings-billing-config', 
        label: 'Billing Config', 
        href: '/settings/billing-config', 
        icon: 'CreditCard', 
        roles: ['OWNER', 'ADMIN'],
        description: 'Invoice terms and collections',
      },
      { 
        id: 'settings-agents', 
        label: 'Agents', 
        href: '/settings/agents', 
        icon: 'Cpu', 
        roles: ['OWNER', 'ADMIN'],
        description: 'AI agent configuration',
      },
      { 
        id: 'settings-policies', 
        label: 'Policies', 
        href: '/settings/policies', 
        icon: 'Shield', 
        roles: ['OWNER', 'ADMIN'],
        description: 'Automation rules and thresholds',
      },
      { 
        id: 'settings-observability', 
        label: 'Observability', 
        href: '/settings/observability', 
        icon: 'Activity', 
        roles: ['OWNER', 'ADMIN'],
        description: 'Audit logs and system health',
      },
      { 
        id: 'settings-exports', 
        label: 'Exports', 
        href: '/settings/exports', 
        icon: 'Download', 
        roles: ['OWNER', 'ADMIN'],
        description: 'Data exports and reports',
      },
    ],
  },
];

/**
 * V3 Navigation for CREW_LEAD role
 * Today Plan focus with crew management and comms
 */
const navigationV3CrewLead: NavGroupV3[] = [
  {
    id: 'work',
    label: 'Work',
    items: [
      { 
        id: 'today', 
        label: 'Today Plan', 
        href: '/schedule', 
        icon: 'CalendarCheck', 
        roles: ['CREW_LEAD'],
        shortcut: 'g t',
        description: "Today's jobs for your crew",
      },
      { 
        id: 'my-crew', 
        label: 'My Crew', 
        href: '/operations/crews', 
        icon: 'Users', 
        roles: ['CREW_LEAD'],
        shortcut: 'g c',
        description: 'Your crew roster and status',
      },
    ],
  },
  {
    id: 'comms',
    label: 'Comms',
    items: [
      { 
        id: 'crew-inbox', 
        label: 'Crew Inbox', 
        href: '/comms', 
        icon: 'MessageSquare', 
        badge: 'count',
        roles: ['CREW_LEAD'],
        shortcut: 'g m',
        description: 'Messages from dispatch and customers',
      },
      { 
        id: 'notifications', 
        label: 'Notifications', 
        href: '/crew-inbox', 
        icon: 'Bell', 
        badge: 'count', 
        roles: ['CREW_LEAD'],
        shortcut: 'g n',
        description: 'Alerts and updates',
      },
    ],
  },
];

/**
 * V3 Navigation for CREW_MEMBER/STAFF role
 * Minimal: Today Plan and notifications only
 */
const navigationV3CrewMember: NavGroupV3[] = [
  {
    id: 'work',
    label: 'Work',
    items: [
      { 
        id: 'today', 
        label: 'Today Plan', 
        href: '/schedule', 
        icon: 'CalendarCheck', 
        roles: ['STAFF'],
        shortcut: 'g t',
        description: 'Your jobs for today',
      },
      { 
        id: 'my-jobs', 
        label: 'My Jobs', 
        href: '/jobs', 
        icon: 'ClipboardList', 
        roles: ['STAFF'],
        shortcut: 'g j',
        description: 'Your assigned jobs',
      },
    ],
  },
  {
    id: 'alerts',
    label: 'Alerts',
    items: [
      { 
        id: 'notifications', 
        label: 'Notifications', 
        href: '/crew-inbox', 
        icon: 'Bell', 
        badge: 'count', 
        roles: ['STAFF'],
        shortcut: 'g n',
        description: 'Important updates',
      },
    ],
  },
];

/**
 * V3 Settings sub-navigation (OWNER/ADMIN only)
 * Organized by purpose per UX Redesign V2 spec
 */
export const settingsNavigationV3: NavItemV3[] = [
  // Business Configuration
  { 
    id: 'settings-profile', 
    label: 'Business Profile', 
    href: '/settings', 
    icon: 'Building', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Service area, hours, contact channels',
  },
  { 
    id: 'settings-services', 
    label: 'Services', 
    href: '/settings/services', 
    icon: 'Layers', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Service catalog and variants',
  },
  { 
    id: 'settings-pricing', 
    label: 'Pricing & Policies', 
    href: '/settings/pricing', 
    icon: 'DollarSign', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Pricing models, thresholds, rules',
  },
  { 
    id: 'settings-promotions', 
    label: 'Promotions', 
    href: '/settings/services', 
    icon: 'Tag', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Discounts and promotion rules',
  },
  
  // Communication & People
  { 
    id: 'settings-templates', 
    label: 'Templates', 
    href: '/settings/templates', 
    icon: 'FileEdit', 
    roles: ['OWNER', 'ADMIN'],
    description: 'SMS, email, and briefing templates',
  },
  { 
    id: 'settings-users', 
    label: 'Users & Roles', 
    href: '/settings/users', 
    icon: 'UserCog', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Team members and permissions',
  },
  
  // Integrations & Technical
  { 
    id: 'settings-integrations', 
    label: 'Integrations', 
    href: '/settings/integrations', 
    icon: 'Plug', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Jobber, Twilio, QuickBooks, Maps',
  },
  { 
    id: 'settings-billing-config', 
    label: 'Billing Config', 
    href: '/settings/billing-config', 
    icon: 'Receipt', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Invoice terms, collections, mappings',
  },
  
  // AI & Automation
  { 
    id: 'settings-agents', 
    label: 'Agents', 
    href: '/settings/agents', 
    icon: 'Bot', 
    roles: ['OWNER', 'ADMIN'],
    description: 'AI agent status and configuration',
  },
  { 
    id: 'settings-policies', 
    label: 'Policies', 
    href: '/settings/policies', 
    icon: 'Brain', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Automation policies and learning',
  },
  
  // Admin Tools
  { 
    id: 'settings-observability', 
    label: 'Observability', 
    href: '/settings/observability', 
    icon: 'Activity', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Agent logs, retries, audit trail',
  },
  { 
    id: 'settings-exports', 
    label: 'Exports', 
    href: '/settings/exports', 
    icon: 'Download', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Data exports and reports',
  },
];

/**
 * Get V3 navigation for a specific role
 */
export function getNavigationV3(role: UserRole): NavGroupV3[] {
  switch (role) {
    case 'OWNER':
    case 'ADMIN':
      return navigationV3Admin;
    case 'CREW_LEAD':
      return navigationV3CrewLead;
    case 'STAFF':
    default:
      return navigationV3CrewMember;
  }
}

/**
 * Get filtered V3 navigation based on role
 */
export function getFilteredNavigationV3(role?: UserRole): NavGroupV3[] {
  const effectiveRole = role || 'STAFF';
  const nav = getNavigationV3(effectiveRole);
  
  return nav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(effectiveRole)),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Check if we should use V3 navigation
 */
export function shouldUseV3Navigation(): boolean {
  return isFeatureEnabled('UI_REDESIGN_V2');
}

/**
 * Get page title for V3 routes
 */
export function getPageTitleV3(pathname: string): string {
  const titles: Record<string, string> = {
    '/home': 'Command Center',
    '/work': 'Work Queue',
    '/approvals': 'Approvals',
    '/schedule': 'Schedule',
    '/customers': 'Customers',
    '/comms': 'Comms',
    '/operations/crews': 'Crews',
    '/jobs': 'Jobs',
    '/crew-inbox': 'Notifications',
    '/billing': 'Billing',
    '/billing/invoices': 'Invoices',
    '/billing/payments': 'Payments',
    '/billing/issues': 'Billing Issues',
    '/settings': 'Business Profile',
    '/settings/services': 'Services',
    '/settings/pricing': 'Pricing & Policies',
    '/settings/agents': 'AI Agents',
    '/settings/policies': 'Policies',
    '/settings/integrations': 'Integrations',
    '/settings/billing-config': 'Billing Config',
    '/settings/users': 'Users & Roles',
    '/settings/templates': 'Templates',
    '/settings/observability': 'Observability',
    '/settings/exports': 'Exports',
  };
  
  if (pathname.startsWith('/operations/crews/')) return 'Crew Details';
  if (pathname.startsWith('/customers/')) return 'Customer Details';
  if (pathname.startsWith('/settings/')) {
    const subPage = settingsNavigationV3.find(item => item.href === pathname);
    if (subPage) return subPage.label;
  }
  
  return titles[pathname] || 'LawnFlow AI';
}

/**
 * Get keyboard shortcuts map for V3
 */
export function getKeyboardShortcutsV3(role: UserRole): Map<string, string> {
  const shortcuts = new Map<string, string>();
  const nav = getNavigationV3(role);
  
  for (const group of nav) {
    for (const item of group.items) {
      if (item.shortcut) {
        shortcuts.set(item.shortcut, item.href);
      }
    }
  }
  
  // Global shortcuts
  shortcuts.set('?', '/help');
  shortcuts.set('/', '/search');
  
  return shortcuts;
}
