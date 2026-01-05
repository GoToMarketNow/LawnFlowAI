/**
 * LawnFlow AI - Navigation Configuration V2
 * 
 * New navigation structure for UI Refactor V1:
 * - Work Queue + Approvals + Command Center pattern
 * - Agents moved to Settings
 * - Role-based visibility with CREW_MEMBER support
 */

import type { UserRole } from "./tokens";
import { isFeatureEnabled } from "../feature-flags";

export interface NavItemV2 {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: 'count' | 'dot';
  roles: UserRole[];
  shortcut?: string;
  description?: string;
  children?: NavItemV2[];
}

export interface NavGroupV2 {
  id: string;
  label: string;
  items: NavItemV2[];
}

/**
 * V2 Navigation for OWNER/ADMIN roles
 * Full access to Command Center, Work Queue, Approvals, and Settings
 */
const navigationV2Admin: NavGroupV2[] = [
  {
    id: 'core',
    label: 'Core',
    items: [
      { 
        id: 'home', 
        label: 'Home', 
        href: '/home', 
        icon: 'LayoutDashboard', 
        roles: ['OWNER', 'ADMIN'],
        shortcut: 'g h',
        description: 'Ops Command Center',
      },
      { 
        id: 'work', 
        label: 'Work Queue', 
        href: '/work', 
        icon: 'Inbox', 
        badge: 'count', 
        roles: ['OWNER', 'ADMIN'],
        shortcut: 'g w',
        description: 'Unified work inbox',
      },
      { 
        id: 'approvals', 
        label: 'Approvals', 
        href: '/approvals', 
        icon: 'CheckCircle', 
        badge: 'count', 
        roles: ['OWNER', 'ADMIN'],
        shortcut: 'g p',
        description: 'Fast approval interface',
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
        description: 'Day plan and calendar',
      },
      { 
        id: 'crews', 
        label: 'Crews', 
        href: '/operations/crews', 
        icon: 'Users', 
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD'],
        shortcut: 'g r',
        description: 'Crew management',
      },
      { 
        id: 'comms', 
        label: 'Comms', 
        href: '/comms', 
        icon: 'MessageSquare', 
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD'],
        shortcut: 'g m',
        description: 'Customer and crew messaging',
      },
      { 
        id: 'customers', 
        label: 'Customers', 
        href: '/customers', 
        icon: 'Users', 
        roles: ['OWNER', 'ADMIN'],
        shortcut: 'g c',
        description: 'Customer database',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { 
        id: 'settings', 
        label: 'Settings', 
        href: '/settings', 
        icon: 'Settings', 
        roles: ['OWNER', 'ADMIN'],
        description: 'Configuration and admin tools',
      },
    ],
  },
];

/**
 * V2 Navigation for CREW_LEAD role
 * Limited to day plan, own crew, comms, and notifications
 */
const navigationV2CrewLead: NavGroupV2[] = [
  {
    id: 'core',
    label: 'Core',
    items: [
      { 
        id: 'schedule', 
        label: 'Today', 
        href: '/schedule', 
        icon: 'Calendar', 
        roles: ['CREW_LEAD'],
        shortcut: 'g s',
        description: 'Day plan for your crew',
      },
      { 
        id: 'crews', 
        label: 'Crew', 
        href: '/operations/crews', 
        icon: 'Users', 
        roles: ['CREW_LEAD'],
        shortcut: 'g r',
        description: 'Your crew details',
      },
      { 
        id: 'comms', 
        label: 'Comms', 
        href: '/comms', 
        icon: 'MessageSquare', 
        roles: ['CREW_LEAD'],
        shortcut: 'g m',
        description: 'Team messaging',
      },
      { 
        id: 'notifications', 
        label: 'Notifications', 
        href: '/crew-inbox', 
        icon: 'Bell', 
        badge: 'count', 
        roles: ['CREW_LEAD', 'STAFF'],
        shortcut: 'g n',
        description: 'Your notifications',
      },
    ],
  },
];

/**
 * V2 Navigation for CREW_MEMBER/STAFF role
 * Minimal access: today's schedule and notifications only
 */
const navigationV2CrewMember: NavGroupV2[] = [
  {
    id: 'core',
    label: 'Core',
    items: [
      { 
        id: 'schedule', 
        label: 'Today', 
        href: '/schedule', 
        icon: 'Calendar', 
        roles: ['STAFF'],
        shortcut: 'g s',
        description: 'Your schedule for today',
      },
      { 
        id: 'notifications', 
        label: 'Notifications', 
        href: '/crew-inbox', 
        icon: 'Bell', 
        badge: 'count', 
        roles: ['STAFF'],
        shortcut: 'g n',
        description: 'Your notifications',
      },
    ],
  },
];

/**
 * Settings sub-navigation (OWNER/ADMIN only)
 */
export const settingsNavigation: NavItemV2[] = [
  { 
    id: 'settings-general', 
    label: 'General', 
    href: '/settings', 
    icon: 'Settings', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Account settings',
  },
  { 
    id: 'settings-agents', 
    label: 'Agents', 
    href: '/settings/agents', 
    icon: 'Bot', 
    roles: ['OWNER', 'ADMIN'],
    description: 'AI agent configuration',
  },
  { 
    id: 'settings-policies', 
    label: 'Policies', 
    href: '/settings/policies', 
    icon: 'Brain', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Automation policies and learning',
  },
  { 
    id: 'settings-pricing', 
    label: 'Pricing', 
    href: '/settings/pricing', 
    icon: 'DollarSign', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Pricing engine configuration',
  },
  { 
    id: 'settings-integrations', 
    label: 'Integrations', 
    href: '/settings/integrations', 
    icon: 'Plug', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Connected services',
  },
  { 
    id: 'settings-observability', 
    label: 'Observability', 
    href: '/settings/observability', 
    icon: 'Activity', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Audit logs and monitoring',
  },
  { 
    id: 'settings-exports', 
    label: 'Exports', 
    href: '/settings/exports', 
    icon: 'Download', 
    roles: ['OWNER', 'ADMIN'],
    description: 'Data exports',
  },
];

/**
 * Get V2 navigation for a specific role
 */
export function getNavigationV2(role: UserRole): NavGroupV2[] {
  switch (role) {
    case 'OWNER':
    case 'ADMIN':
      return navigationV2Admin;
    case 'CREW_LEAD':
      return navigationV2CrewLead;
    case 'STAFF':
    default:
      return navigationV2CrewMember;
  }
}

/**
 * Get filtered V2 navigation based on role
 */
export function getFilteredNavigationV2(role?: UserRole): NavGroupV2[] {
  const effectiveRole = role || 'STAFF';
  const nav = getNavigationV2(effectiveRole);
  
  return nav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(effectiveRole)),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Check if we should use V2 navigation
 */
export function shouldUseV2Navigation(): boolean {
  return isFeatureEnabled('UI_REFACTOR_V1');
}

/**
 * Get page title for V2 routes
 */
export function getPageTitleV2(pathname: string): string {
  const titles: Record<string, string> = {
    '/home': 'Command Center',
    '/work': 'Work Queue',
    '/approvals': 'Approvals',
    '/schedule': 'Schedule',
    '/customers': 'Customers',
    '/comms': 'Comms',
    '/operations/crews': 'Crews',
    '/settings': 'Settings',
    '/settings/agents': 'AI Agents',
    '/settings/policies': 'Policies',
    '/settings/pricing': 'Pricing',
    '/settings/integrations': 'Integrations',
    '/settings/observability': 'Observability',
    '/settings/exports': 'Exports',
    '/crew-inbox': 'Notifications',
  };
  
  if (pathname.startsWith('/operations/crews/')) return 'Crew Details';
  if (pathname.startsWith('/customers/')) return 'Customer Details';
  if (pathname.startsWith('/settings/')) {
    const subPage = settingsNavigation.find(item => item.href === pathname);
    if (subPage) return subPage.label;
  }
  
  return titles[pathname] || 'LawnFlow AI';
}
