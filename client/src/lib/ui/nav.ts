/**
 * LawnFlow AI - Navigation Configuration
 * 
 * Centralized navigation config with role-based permissions and keyboard shortcuts.
 */

import type { UserRole } from "./tokens";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: 'count' | 'dot';
  roles: UserRole[];
  shortcut?: string;
  description?: string;
  readOnly?: boolean;
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
      { 
        id: 'dashboard', 
        label: 'Dashboard', 
        href: '/', 
        icon: 'LayoutDashboard', 
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD', 'STAFF'],
        shortcut: 'g d',
        description: 'Overview and quick actions',
      },
      { 
        id: 'inbox', 
        label: 'Inbox', 
        href: '/inbox', 
        icon: 'Inbox', 
        badge: 'count', 
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD', 'STAFF'],
        shortcut: 'g i',
        description: 'Pending approvals and tasks',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { 
        id: 'jobs', 
        label: 'Jobs', 
        href: '/jobs', 
        icon: 'Briefcase', 
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD', 'STAFF'],
        shortcut: 'g j',
        description: 'Active and scheduled jobs',
      },
      { 
        id: 'quotes', 
        label: 'Quotes', 
        href: '/quotes', 
        icon: 'FileText', 
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD', 'STAFF'],
        shortcut: 'g q',
        description: 'Quote management',
      },
      { 
        id: 'schedule', 
        label: 'Schedule', 
        href: '/schedule', 
        icon: 'Calendar', 
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD'],
        shortcut: 'g s',
        description: 'Calendar and routes',
      },
      { 
        id: 'customers', 
        label: 'Customers', 
        href: '/customers', 
        icon: 'Users', 
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD', 'STAFF'],
        shortcut: 'g c',
        description: 'Customer database',
      },
      { 
        id: 'crews', 
        label: 'Crews', 
        href: '/operations/crews', 
        icon: 'Users', 
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD'],
        shortcut: 'g r',
        description: 'Crew management',
        readOnly: true,
      },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    items: [
      { 
        id: 'agents', 
        label: 'Agents', 
        href: '/agents', 
        icon: 'Bot', 
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD'],
        shortcut: 'g a',
        description: 'AI agent directory',
        readOnly: true,
      },
      { 
        id: 'learning', 
        label: 'Learning', 
        href: '/learning', 
        icon: 'Brain', 
        roles: ['OWNER', 'ADMIN'],
        shortcut: 'g l',
        description: 'AI policy tuning and metrics',
      },
      { 
        id: 'comms', 
        label: 'Comms Studio', 
        href: '/comms', 
        icon: 'MessageSquare', 
        roles: ['OWNER', 'ADMIN'],
        shortcut: 'g m',
        description: 'Message templates and approvals',
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
        roles: ['OWNER', 'ADMIN', 'CREW_LEAD', 'STAFF'],
        description: 'Account and preferences',
      },
    ],
  },
];

export const quickActions = [
  { id: 'new-quote', label: 'New Quote', href: '/quote-builder', icon: 'Plus', roles: ['OWNER', 'ADMIN', 'CREW_LEAD'] as UserRole[] },
  { id: 'new-job', label: 'New Job', href: '/jobs?action=new', icon: 'Plus', roles: ['OWNER', 'ADMIN'] as UserRole[] },
];

export const keyboardShortcuts = [
  { keys: 'g d', action: 'navigate', target: '/', description: 'Go to Dashboard' },
  { keys: 'g i', action: 'navigate', target: '/inbox', description: 'Go to Inbox' },
  { keys: 'g j', action: 'navigate', target: '/jobs', description: 'Go to Jobs' },
  { keys: 'g q', action: 'navigate', target: '/quotes', description: 'Go to Quotes' },
  { keys: 'g s', action: 'navigate', target: '/schedule', description: 'Go to Schedule' },
  { keys: 'g c', action: 'navigate', target: '/customers', description: 'Go to Customers' },
  { keys: 'g a', action: 'navigate', target: '/agents', description: 'Go to Agents' },
  { keys: '/', action: 'search', target: null, description: 'Open global search' },
  { keys: 'Escape', action: 'close', target: null, description: 'Close dialog/drawer' },
] as const;

export function getNavItemById(id: string): NavItem | undefined {
  for (const group of navigation) {
    const item = group.items.find(i => i.id === id);
    if (item) return item;
  }
  return undefined;
}

export function getFilteredNavigation(role?: UserRole): NavGroup[] {
  const effectiveRole = role || 'STAFF';
  return navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(effectiveRole)),
    }))
    .filter((group) => group.items.length > 0);
}

export function getKeyboardShortcutsForRole(role?: UserRole): Array<{ keys: string; target: string }> {
  const effectiveRole = role || 'STAFF';
  const shortcuts: Array<{ keys: string; target: string }> = [];
  
  for (const group of navigation) {
    for (const item of group.items) {
      if (item.shortcut && item.roles.includes(effectiveRole)) {
        shortcuts.push({ keys: item.shortcut, target: item.href });
      }
    }
  }
  
  return shortcuts;
}

export function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    '/': 'Dashboard',
    '/dashboard': 'Dashboard',
    '/inbox': 'Inbox',
    '/jobs': 'Jobs',
    '/quotes': 'Quotes',
    '/quote-builder': 'Quote Builder',
    '/schedule': 'Schedule',
    '/customers': 'Customers',
    '/agents': 'Agents',
    '/settings': 'Settings',
    '/profile': 'Business Profile',
    '/simulator': 'Event Simulator',
    '/audit': 'Audit Log',
    '/pricing': 'Pricing Control',
    '/ops': 'Operations Dashboard',
    '/onboarding': 'Setup',
  };
  
  if (pathname.startsWith('/customers/')) return 'Customer Details';
  if (pathname.startsWith('/agents/')) return 'Agent Details';
  if (pathname.startsWith('/conversations/')) return 'Conversation';
  
  return titles[pathname] || 'LawnFlow AI';
}
