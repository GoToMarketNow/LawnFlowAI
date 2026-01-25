# Design Guidelines: Landscaping Business Agentic Admin Dashboard

## Design Approach
**System-Based Approach** - This utility-focused admin dashboard prioritizes clarity, efficiency, and data density. Drawing inspiration from modern B2B SaaS tools like Linear, Vercel Dashboard, and Retool for their clean, functional interfaces optimized for business operations.

## Core Design Principles
- **Clarity First**: Information hierarchy that makes critical data immediately scannable
- **Workflow Efficiency**: Minimize clicks for common tasks (approving actions, viewing conversations)
- **Trust & Control**: Visual indicators for AI actions requiring approval, clear audit trails
- **Progressive Disclosure**: Show essentials first, details on demand

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8 for consistency
- Component padding: p-4, p-6
- Section spacing: gap-4, gap-6, gap-8
- Container margins: mx-4, mx-6

**Grid Structure**:
- Sidebar navigation: Fixed 240px width (hidden on mobile)
- Main content area: max-w-7xl with responsive padding
- Dashboard cards: Grid of 2-4 columns (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Conversation list: Single column with max-w-4xl for readability

## Typography Hierarchy

**Font Selection**: System fonts for performance
- Primary: Inter or -apple-system, system-ui
- Monospace: For IDs, timestamps, technical data

**Type Scale**:
- Page titles: text-2xl font-semibold
- Section headers: text-lg font-medium
- Body text: text-base font-normal
- Labels/metadata: text-sm font-medium
- Secondary info: text-sm text-muted

## Component Library

### Navigation
**Sidebar Layout**:
- Company logo/name at top (h-16)
- Primary nav items with icons (py-2, px-3)
- Active state: Bold text + subtle background
- User profile/settings at bottom

**Top Bar**:
- Page context breadcrumbs
- Quick actions (refresh, notifications)
- Profile menu

### Dashboard Cards (ROI Metrics)
- Elevated cards: border, rounded-lg, p-6
- Metric display: Large number (text-3xl font-bold), label below (text-sm)
- Trend indicators: Small arrow + percentage change
- 4-column grid on desktop, stacked on mobile

### Conversation View
**List Layout**:
- Card-based list with subtle borders
- Left column: Customer name + phone (font-medium)
- Center: Latest message preview (truncated, text-sm)
- Right: Status badge + timestamp
- Click to expand: Full conversation thread below

**Conversation Thread**:
- Alternating message bubbles (customer vs AI)
- Timestamp for each message group
- System actions in distinct style (dashed border, italic)
- "Pending Approval" actions highlighted with yellow accent

### Human-in-the-Loop Approval Interface
**Action Cards**:
- Prominent header: "Action Requires Approval"
- Summary of proposed action (quote amount, schedule time, etc.)
- Context: Conversation snippet that led to action
- Two-button layout: "Approve" (primary) + "Reject" (secondary)
- Optional textarea for modification notes

### Business Profile Setup
**Form Layout**:
- Single column, max-w-2xl
- Grouped sections with headers
- Input groups: Label above, helper text below
- Progressive form: Start with essentials, expand for advanced

### Data Tables (Audit Trail)
- Sticky header row
- Zebra striping for rows
- Sortable columns
- Row actions on hover (view details, copy)
- Pagination at bottom

## Interaction Patterns

**States & Feedback**:
- Loading states: Skeleton screens for data-heavy views
- Empty states: Helpful illustrations + CTA to get started
- Success: Toast notifications (top-right)
- Errors: Inline validation + banner for critical issues

**Badges & Status**:
- Conversation status: Rounded badges (pending, active, completed)
- AI confidence: Color-coded (high=green, medium=yellow, low=red)
- Agent type: Small pill indicating specialist (intake, quote, schedule, etc.)

## Responsive Behavior

**Mobile (<768px)**:
- Hamburger menu for sidebar
- Stack dashboard cards vertically
- Simplified conversation list (hide preview text)
- Full-width action approval cards

**Tablet (768-1024px)**:
- Collapsible sidebar
- 2-column dashboard grid
- Maintain card-based layouts

**Desktop (>1024px)**:
- Full sidebar visible
- 4-column dashboard grid
- Multi-column data tables

## Images

**No Hero Images Required** - This is an admin dashboard, not a marketing site.

**Icon Usage**:
- Use Heroicons (outline style) via CDN
- Navigation items: 20x20px icons
- Dashboard cards: 24x24px metric icons
- Status indicators: 16x16px
- Action buttons: 16x16px leading icons

**Data Visualization**:
- Simple bar/line charts for ROI metrics (use Chart.js or Recharts)
- Sparklines for trend indicators within metric cards

## Accessibility

- Form inputs: Proper labels, aria-describedby for errors
- Focus visible on all interactive elements
- Color not sole indicator for status (use icons + text)
- Keyboard navigation for conversation list and approvals
- ARIA labels for icon-only buttons

This design creates a clean, professional admin interface that prioritizes the business user's workflow efficiency while maintaining clarity for AI-driven operations requiring human oversight.