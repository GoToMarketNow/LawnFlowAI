# LawnFlow Web UI - Figma Design Specification

**Purpose**: Complete UI specification for web operations staff application, ready for Figma Make execution.

**Date**: January 12, 2026
**Target Users**: Owners, Operations Staff, Admins
**Platform**: Desktop web (1440px primary, 1920px wide, responsive down to 1024px)
**Design System Base**: Extends mobile design tokens with web-specific data-dense patterns

---

## TABLE OF CONTENTS

1. [Design Principles & Tokens](#1-design-principles--tokens)
2. [Web Design System Extension](#2-web-design-system-extension)
3. [Navigation Structure](#3-navigation-structure)
4. [RBAC Visibility Matrix](#4-rbac-visibility-matrix)
5. [Command Center Module](#5-command-center-module)
6. [Customer Intelligence Module](#6-customer-intelligence-module)
7. [Crew & Jobs Module](#7-crew--jobs-module)
8. [Analytics Module](#8-analytics-module)
9. [Agent Management Studio](#9-agent-management-studio)
10. [Support Queue & PSKB](#10-support-queue--pskb)
11. [Settings Hub](#11-settings-hub)
12. [Empty, Loading, Error States](#12-empty-loading-error-states)

---

## 1. DESIGN PRINCIPLES & TOKENS

### 1.1 Design Principles (Inherited from Mobile)

**From [docs/design-system-spec.md](docs/design-system-spec.md:15-20)**:
- **Clarity**: Interfaces are unambiguous and easy to understand
- **Efficiency**: Users accomplish tasks quickly with minimal effort
- **Empathy**: Designs consider user needs, context, and emotional state
- **Adaptability**: Interfaces are responsive and performant
- **Purposeful Delight**: Strategic use of animation and micro-interactions

**Web-Specific Additions**:
- **Information Density**: Maximize data visibility without overwhelming (comfortable vs compact modes)
- **Keyboard First**: All actions keyboard-accessible (shortcuts, tab navigation, arrow keys)
- **Progressive Disclosure**: Show essentials, reveal details on demand
- **Contextual Actions**: Actions appear where needed (inline edit, hover actions)

### 1.2 Color Tokens (Aligned with Mobile)

**Primary Colors** (Brand):
```css
--primary-50: hsl(142, 76%, 96%)   /* Light green tint */
--primary-100: hsl(142, 76%, 92%)
--primary-500: hsl(142, 76%, 36%)  /* Main brand green */
--primary-600: hsl(142, 76%, 32%)
--primary-700: hsl(142, 76%, 28%)
--primary-900: hsl(142, 76%, 20%)
```

**Semantic Colors**:
```css
/* Success (same as primary) */
--success-500: hsl(142, 76%, 36%)

/* Destructive */
--destructive-500: hsl(0, 84%, 60%)   /* Red */
--destructive-600: hsl(0, 84%, 56%)

/* Warning */
--warning-500: hsl(38, 92%, 50%)      /* Amber */
--warning-600: hsl(38, 92%, 46%)

/* Info */
--info-500: hsl(214, 84%, 56%)        /* Blue */
--info-600: hsl(214, 84%, 52%)
```

**Neutral Colors** (Light Mode):
```css
--neutral-0: hsl(0, 0%, 100%)         /* White */
--neutral-50: hsl(210, 20%, 98%)      /* Off-white */
--neutral-100: hsl(210, 16%, 96%)     /* Light gray */
--neutral-200: hsl(210, 14%, 89%)
--neutral-300: hsl(210, 12%, 82%)
--neutral-400: hsl(210, 10%, 64%)     /* Mid gray */
--neutral-500: hsl(210, 8%, 46%)      /* Text secondary */
--neutral-600: hsl(210, 10%, 28%)
--neutral-700: hsl(210, 12%, 20%)     /* Text primary */
--neutral-800: hsl(210, 14%, 16%)
--neutral-900: hsl(210, 16%, 12%)     /* Near black */
```

**Dark Mode** (auto-inverse neutral scale):
```css
--background: hsl(210, 14%, 11%)      /* Dark bg */
--foreground: hsl(210, 16%, 96%)      /* Light text */
--card: hsl(210, 14%, 14%)            /* Card bg */
--border: hsl(210, 12%, 20%)          /* Borders */
```

### 1.3 Typography Scale (Web)

**Font Family**: Inter (system fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)

**Type Scale**:
```css
/* Display (Hero headlines) */
--text-display-large: 32px / 40px, 700 weight
--text-display-medium: 28px / 36px, 700 weight

/* Heading */
--text-heading-xl: 24px / 32px, 600 weight
--text-heading-large: 20px / 28px, 600 weight
--text-heading-medium: 18px / 26px, 600 weight
--text-heading-small: 16px / 24px, 600 weight

/* Body */
--text-body-large: 16px / 24px, 400 weight    /* Main content */
--text-body-medium: 14px / 20px, 400 weight   /* Standard */
--text-body-small: 13px / 18px, 400 weight    /* Dense tables */

/* Label (Buttons, form labels) */
--text-label-large: 14px / 20px, 500 weight
--text-label-medium: 13px / 18px, 500 weight
--text-label-small: 12px / 16px, 500 weight

/* Caption (Metadata, timestamps) */
--text-caption-large: 12px / 16px, 400 weight
--text-caption-medium: 11px / 14px, 400 weight
--text-caption-small: 10px / 12px, 400 weight

/* Monospace (Code, IDs) */
--text-mono: "SF Mono", Monaco, "Cascadia Code", monospace, 14px / 20px
```

### 1.4 Spacing Scale (8pt Grid)

```css
--space-0: 0px
--space-1: 4px     /* Tight spacing */
--space-2: 8px     /* Base unit */
--space-3: 12px
--space-4: 16px    /* Standard gap */
--space-5: 20px
--space-6: 24px    /* Section spacing */
--space-8: 32px
--space-10: 40px
--space-12: 48px   /* Large section gaps */
--space-16: 64px
--space-20: 80px
```

### 1.5 Border Radius

```css
--radius-sm: 4px      /* Buttons, badges */
--radius-md: 6px      /* Cards, inputs */
--radius-lg: 8px      /* Modals, drawers */
--radius-xl: 12px     /* Feature cards */
--radius-2xl: 16px    /* Hero sections */
--radius-full: 9999px /* Pills, avatars */
```

### 1.6 Shadows (Elevation)

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
```

---

## 2. WEB DESIGN SYSTEM EXTENSION

### 2.1 Layout Grid

**Desktop Grid**:
- **Container Max Width**: 1440px (comfortable), 1920px (wide)
- **Gutter**: 24px between columns
- **Margin**: 32px left/right
- **Columns**: 12-column grid

**Breakpoints**:
```css
--breakpoint-tablet: 768px
--breakpoint-desktop: 1024px
--breakpoint-desktop-lg: 1440px
--breakpoint-desktop-xl: 1920px
```

### 2.2 Sidebar Layout

**Persistent Left Sidebar**:
- **Width**: 240px (expanded), 64px (collapsed)
- **Background**: `var(--card)` (slightly elevated from main bg)
- **Position**: Fixed left
- **Z-index**: 40

**Main Content Area**:
- **Margin-left**: 240px (sidebar expanded) or 64px (collapsed)
- **Padding**: 24px all sides
- **Max-width**: 1440px centered

### 2.3 Data Table Components

**Table Anatomy**:
```
┌─────────────────────────────────────────────┐
│ Table Toolbar (sticky)                      │
│ ┌─────────────┬──────────┬──────────────┐  │
│ │ Search      │ Filters  │ Actions      │  │
│ └─────────────┴──────────┴──────────────┘  │
├─────────────────────────────────────────────┤
│ Column Headers (sortable, sticky)           │
│ ┌──────┬──────────┬───────┬───────┬─────┐ │
│ │ ☐    │ Name ↓   │ Status│ Date  │ ⋯   │ │
│ ├──────┼──────────┼───────┼───────┼─────┤ │
│ │ ☐    │ Row 1    │ Badge │ 1/12  │ ⋮   │ │
│ │ ☐    │ Row 2    │ Badge │ 1/11  │ ⋮   │ │
│ │ ...  │ ...      │ ...   │ ...   │ ... │ │
│ └──────┴──────────┴───────┴───────┴─────┘ │
├─────────────────────────────────────────────┤
│ Pagination (bottom, sticky)                 │
└─────────────────────────────────────────────┘
```

**Table Variants**:
- **Comfortable**: 48px row height, 16px padding
- **Compact**: 36px row height, 12px padding
- **Striped**: Alternating row background (`--neutral-50`)

**Column Types**:
- **Checkbox**: 40px width, select/bulk actions
- **Text**: Auto-width, truncate with tooltip
- **Status Badge**: Fixed 120px, pill-shaped badges
- **Date/Time**: Fixed 140px, relative + absolute tooltip
- **Actions**: Fixed 60px, kebab menu (⋯)
- **Numeric**: Right-aligned, fixed width
- **Avatar + Name**: 200px, avatar + text combo

**Interactive States**:
- **Hover**: Row background `--neutral-100` (light) / `--neutral-800` (dark)
- **Selected**: Row background `--primary-50` / `--primary-900`
- **Focus**: 2px outline `--primary-500`

### 2.4 Filter Panel Component

**Filter Anatomy**:
```
┌─────────────────────────────┐
│ Filters (3)        [Clear]  │
├─────────────────────────────┤
│ Status                      │
│ ☑ Active                    │
│ ☑ Pending                   │
│ ☐ Completed                 │
├─────────────────────────────┤
│ Date Range                  │
│ [From] [To]                 │
├─────────────────────────────┤
│ Priority                    │
│ [Dropdown: All ▾]           │
└─────────────────────────────┘
```

**Filter Types**:
- **Multi-select**: Checkboxes for OR logic
- **Single-select**: Radio or dropdown
- **Date range**: Two date pickers
- **Search**: Text input with debounce
- **Numeric range**: Slider or two inputs

**Saved Views**:
- Users can save filter combinations
- "My Urgent Items", "Overdue Approvals", etc.
- Accessible via dropdown above filter panel

### 2.5 Chart Standard Library

**Chart Types** (using Recharts):

**1. Line Chart** (Trends over time):
- **Use**: Revenue, jobs, margin trends
- **Axes**: Time (X), Metric (Y)
- **Interactions**: Hover tooltip, zoom, pan
- **Colors**: Single line = `--primary-500`, Multi-line = semantic palette

**2. Bar Chart** (Comparisons):
- **Use**: Job counts by crew, revenue by service type
- **Axes**: Category (X), Value (Y)
- **Variants**: Vertical, horizontal, stacked
- **Colors**: Categorical palette

**3. Stacked Area Chart** (Part-to-whole over time):
- **Use**: Revenue breakdown by service type over time
- **Colors**: Diverging palette

**4. Donut Chart** (Proportions):
- **Use**: Job status distribution, payment method adoption
- **Center Label**: Total count or percentage
- **Legend**: Right side or bottom

**5. Cohort Grid** (Retention):
- **Use**: Customer retention by signup month
- **Colors**: Heatmap (green = high retention, red = low)

**6. Funnel Chart** (Conversion):
- **Use**: Lead → Quote → Job → Payment
- **Colors**: Single color with opacity gradient

**Chart Container**:
- **Min Height**: 300px
- **Aspect Ratio**: 16:9 (landscape) or 4:3 (square)
- **Background**: `--card`
- **Border**: 1px `--border`
- **Padding**: 24px
- **Title**: `--text-heading-small` above chart
- **Subtitle**: `--text-body-small` below title

### 2.6 Modal & Drawer Components

**Modal (Center Overlay)**:
- **Sizes**:
  - Small: 400px width
  - Medium: 600px width
  - Large: 800px width
  - X-Large: 1000px width
- **Backdrop**: rgba(0, 0, 0, 0.5)
- **Animation**: Fade in + scale from 0.95 to 1.0
- **Close**: X button top-right, Escape key

**Drawer (Slide-out Panel)**:
- **Sizes**:
  - Narrow: 400px width
  - Wide: 600px width
  - Full: 100% width (mobile)
- **Position**: Right side (default), left/top/bottom optional
- **Animation**: Slide in from edge
- **Close**: X button, click backdrop, Escape key
- **Sticky Header**: Title + close always visible

### 2.7 Empty State Component

**Anatomy**:
```
┌─────────────────────────────┐
│         [Icon]              │
│                             │
│    Heading Text             │
│    Description text         │
│                             │
│    [Primary Action]         │
└─────────────────────────────┘
```

**Variants**:
- **No Data**: "No jobs found. Create your first job."
- **No Results**: "No results match your filters. Try adjusting them."
- **No Access**: "You don't have permission to view this."
- **Error**: "Something went wrong. Try refreshing the page."

**Icon**: 64px size, `--neutral-400` color
**Heading**: `--text-heading-medium`
**Description**: `--text-body-medium`, `--neutral-500`
**Action**: Primary button or link

---

## 3. NAVIGATION STRUCTURE

### 3.1 Primary Navigation (Sidebar)

**Sidebar Sections**:

**1. Home & Work**
- 🏠 Home (dashboard overview)
- 📋 Work Queue (pending actions)
- ✓ Approvals (approval-focused view)

**2. Operations**
- 👥 Customers (customer list + profiles)
- 🔨 Jobs (job requests + tracking)
- 💰 Quotes (quote management)
- 📅 Schedule (calendar view)
- 👷 Crews (crew roster + performance)

**3. Finance**
- 💳 Billing (overview dashboard)
  - Submenu: Invoices, Payments, Issues

**4. Support** (if enabled)
- 💬 Support Queue (enriched threads)
- 📚 Knowledge Base (PSKB management)
- 📊 Coverage Gaps (analytics)

**5. Management** (OWNER/ADMIN only)
- 🤖 Agents (agent studio)
- ⚙️ Settings (all configurations)
  - Submenu: Agents, Policies, Pricing, Services, Users, Integrations, etc.

**6. Insights** (if analytics enabled)
- 📈 Analytics (profit, retention, growth)

**Navigation Behavior**:
- Active item: Bold text + `--primary-500` left border (4px)
- Hover: Background `--neutral-100`
- Icon + Label: Icon 20px, label `--text-label-large`
- Collapsible: Icon-only mode at 64px width

### 3.2 Top Bar (Global)

**Left Section**:
- Sidebar toggle button (hamburger icon)
- Page title (`--text-heading-medium`)
- Breadcrumbs (optional, for deep pages)

**Center Section**:
- Global search (Cmd+K trigger, command palette)

**Right Section**:
- Quick Actions dropdown (+ New Quote, + New Job)
- Notification bell (badge count)
- Theme toggle (light/dark)
- User menu (avatar + dropdown)

**Top Bar Height**: 56px
**Background**: `--background` with blur effect
**Border**: 1px bottom `--border`
**Position**: Sticky top, z-index 50

### 3.3 Contextual Actions (Floating)

**Floating Action Button** (FAB, optional):
- Position: Bottom-right, 24px from edges
- Size: 56px diameter
- Icon: + (plus)
- Use: Quick-create actions on list pages

**Bulk Action Bar** (appears when rows selected):
- Position: Bottom of viewport, sticky
- Background: `--primary-500`
- Text: White
- Actions: "Approve X items", "Delete X items", "Export X items"

---

## 4. RBAC VISIBILITY MATRIX

**Role Definitions** (from capability map):
- **OWNER**: Full system access
- **ADMIN**: Full system access
- **STAFF**: Limited admin access (no settings changes)
- **CREW_LEAD**: Crew operations only
- **CREW**: Job execution only (mobile-only)
- **CUSTOMER**: Customer portal only (separate app)

**Module Visibility by Role**:

| Module | OWNER | ADMIN | STAFF | CREW_LEAD | Notes |
|--------|-------|-------|-------|-----------|-------|
| **Home Dashboard** | Full | Full | View-only | Hidden | Profit metrics hidden from STAFF |
| **Work Queue** | Full | Full | Assigned only | Assigned only | Filtered by assignment |
| **Approvals** | Full | Full | Assigned only | None | |
| **Customers** | Full | Full | View-only | None | No edit for STAFF |
| **Jobs** | Full | Full | Assigned only | Assigned only | |
| **Quotes** | Full | Full | View-only | None | |
| **Schedule** | Full | Full | View-only | View assigned | |
| **Crews** | Full | Full | View-only | View own | |
| **Billing** | Full | Full | View-only | None | |
| **Support Queue** | Full | Full | Full | None | |
| **Knowledge Base** | Approve | Approve | Create/Edit | None | Only OWNER/ADMIN approve |
| **Agents** | Full | Full | None | None | Hidden from STAFF |
| **Analytics** | Full | Full | View-only | None | |
| **Settings** | Full | Full | None | None | Hidden from STAFF |

**Action-Level Permissions**:

| Action | OWNER | ADMIN | STAFF | CREW_LEAD |
|--------|-------|-------|-------|-----------|
| Approve quotes | ✅ | ✅ | ❌ | ❌ |
| Assign jobs to crews | ✅ | ✅ | ❌ | ❌ |
| Override AI decisions | ✅ | ✅ | ❌ | ❌ |
| Configure agents | ✅ | ✅ | ❌ | ❌ |
| Edit pricing rules | ✅ | ✅ | ❌ | ❌ |
| Approve knowledge | ✅ | ✅ | ❌ | ❌ |
| Respond to support | ✅ | ✅ | ✅ | ❌ |
| View profit margins | ✅ | ✅ | ❌ | ❌ |

**Implementation Notes**:
- Role checks use `canAccess(userRole, accessLevel)` helper
- Navigation items conditionally rendered via `<RoleGate>`
- API endpoints enforce role checks server-side
- Graceful degradation: STAFF sees "Contact admin" instead of disabled buttons

---

## 5. COMMAND CENTER MODULE

### 5.1 Home Dashboard (/)

**Page Title**: "Home" or "Dashboard"
**Layout**: 3-column responsive grid
**Purpose**: At-a-glance operational overview + quick access to urgent items

**Frame Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ Home                                        [Date Range ▾]   │
├─────────────────┬─────────────────┬─────────────────────────┤
│ Revenue Card    │ Jobs Card       │ Pending Actions Card    │
│ $X,XXX          │ XX active       │ 🔴 3 urgent             │
│ +X% vs last mo  │ +X this week    │ 🟠 2 soon               │
├─────────────────┼─────────────────┼─────────────────────────┤
│ Margin Card     │ Quotes Card     │ Latest Activity Feed    │
│ XX% avg         │ XX pending      │ • Job #123 completed    │
│ ⚠️ 2 alerts     │ $X,XXX value    │ • Quote #45 approved    │
├─────────────────┴─────────────────┴─────────────────────────┤
│ Profit Protection Alerts (if any)                           │
│ ⚠️ Job #789: Margin burn detected (-$X vs expected)        │
├─────────────────────────────────────────────────────────────┤
│ Growth Advisor Recommendations                              │
│ 💡 Consider upselling aeration to 3 high-LTV customers     │
└─────────────────────────────────────────────────────────────┘
```

**Components**:

**5.1.1 Metric Card** (Reusable)
- **Size**: 320px × 160px (min)
- **Background**: `--card`
- **Border**: 1px `--border`
- **Radius**: `--radius-lg`
- **Padding**: 20px
- **Structure**:
  - Label: `--text-caption-large`, `--neutral-500`
  - Value: `--text-display-medium`, `--foreground`
  - Change indicator: `--text-label-small`, `--success-500` (positive) or `--destructive-500` (negative)
  - Icon: 24px, right-aligned
  - Hover: Shadow `--shadow-md`, cursor pointer (if clickable)
  - Click: Navigate to detail page

**5.1.2 Pending Actions Card**
- **Size**: 320px × 320px (double height)
- **Structure**:
  - Header: "Pending Actions" + "View All" link
  - List: 3-5 items max, scrollable
  - Item:
    - SLA indicator dot (red/amber/green), 8px
    - Title: `--text-label-medium`
    - Meta: `--text-caption-medium`, timestamp
    - Hover: Background `--neutral-100`, full item clickable
  - Empty state: "No pending actions 🎉"

**5.1.3 Activity Feed**
- **Size**: 640px width (spans 2 columns)
- **Structure**:
  - Header: "Latest Activity" + filter dropdown (All / My Actions / AI Actions)
  - Timeline:
    - Icon: 24px circle, semantic color
    - Text: `--text-body-small`
    - Timestamp: `--text-caption-small`, relative time
    - Connector: 2px line `--neutral-300`
  - Limit: 10 items, "Load more" button

**5.1.4 Alert Banner** (Margin/Profit Protection)
- **Width**: Full width (spans all columns)
- **Background**: `--warning-50` (light) / `--warning-900` (dark)
- **Border**: 1px `--warning-500`, left 4px border
- **Icon**: ⚠️ 20px
- **Text**: `--text-body-medium`
- **Action**: "View Details" link
- **Dismissible**: X button right

**5.1.5 Growth Advisor Widget**
- **Width**: Full width
- **Background**: `--info-50`
- **Icon**: 💡 24px
- **Text**: `--text-body-medium`
- **Action**: Primary button "Review Recommendations"

**Data Sources** (from capability map):
- Revenue: `GET /api/dashboard` → `revenue`, `revenueChange`
- Jobs: `GET /api/jobs?status=active` → count
- Pending Actions: `GET /api/inbox?priority=urgent` → count by SLA
- Margin: `GET /api/dashboard` → `avgMargin`, `marginAlerts`
- Quotes: `GET /api/quotes?status=pending` → count, total value
- Activity: `GET /api/events?limit=10`
- Alerts: `GET /api/alerts/profit-protection`
- Growth Advisor: `GET /api/growth-advisor/recommendations`

---

### 5.2 Work Queue (/work)

**Page Title**: "Work Queue"
**Layout**: Full-width table with left filter panel
**Purpose**: Task-based view of all pending work items

**Frame Structure**:
```
┌────────────┬──────────────────────────────────────────────┐
│ Filters    │ Work Queue (8)               [Search] [⋯]    │
│            ├──────────────────────────────────────────────┤
│ Status     │ ☐ │ SLA │ Type      │ Title        │ Date   │
│ ☑ Urgent   │ ☐ │ 🔴  │ Quote     │ Smith lawn   │ 2m ago │
│ ☑ Soon     │ ☐ │ 🟠  │ Approval  │ $500+ quote  │ 15m    │
│ ☐ Normal   │ ☐ │ 🟢  │ Job       │ Crew assign  │ 1h     │
│            │ ... (more rows)                              │
│ Type       ├──────────────────────────────────────────────┤
│ ☐ Quote    │ Showing 1-10 of 8            [< 1 2 3 >]    │
│ ☐ Job      │                                              │
│ ☐ Approval │                                              │
│            │                                              │
│ [Clear]    │                                              │
└────────────┴──────────────────────────────────────────────┘
```

**5.2.1 Filter Panel** (Left Sidebar, 240px width)
- **Background**: `--card`
- **Border**: 1px right `--border`
- **Sections**:
  - Status (SLA urgency): Urgent, Soon, Normal
  - Type: Quote, Job, Approval, Payment, Other
  - Assigned to: Me, My Team, Unassigned, All
  - Date range: Today, This Week, This Month, Custom
- **Clear button**: Bottom, secondary style
- **Saved views dropdown**: Top, "My Urgent Items" default

**5.2.2 Work Queue Table**
- **Columns**:
  1. Checkbox (40px)
  2. SLA Indicator (60px): Dot + icon
  3. Type (100px): Badge with icon
  4. Title (300px): Truncated, bold
  5. Customer (160px): Name, clickable
  6. Assigned (120px): Avatar + name or "Unassigned"
  7. Date (140px): Relative time + absolute tooltip
  8. Actions (60px): Kebab menu

**Interactions**:
- **Row click**: Open detail drawer (right slide-out, 600px)
- **Bulk select**: Checkbox + bulk action bar appears at bottom
- **Keyboard nav**: j/k to move, Enter to open, a to approve (if applicable)
- **Sort**: Click column headers
- **Filter**: Use left panel

**Detail Drawer** (Right, 600px):
- **Header**: Type badge + Title + Close button
- **Body**:
  - Customer info card
  - Item details (quote amount, job description, etc.)
  - Timeline (event history)
  - Related items (linked jobs, quotes)
- **Footer**:
  - Primary action (Approve, Assign, etc.)
  - Secondary actions (Reject, Edit, etc.)

**Data Source**: `GET /api/inbox` with query params (status, type, assigned, dateRange)

---

### 5.3 Approvals Page (/approvals)

**Page Title**: "Approvals"
**Layout**: Similar to Work Queue but filtered to approval-only items
**Purpose**: Focused view for OWNER/ADMIN to bulk-approve pending items

**Differences from Work Queue**:
- Default filter: Type = "Approval" only
- Bulk actions prominent: "Approve All", "Approve Selected"
- Confidence score column (AI recommendation confidence)
- Simplified detail drawer (approve/reject focused)

**Frame Structure**: Same as Work Queue table with approval-specific columns

**Additional Column**:
- **Confidence** (100px): Progress bar 0-100%, color-coded
  - 90%+ = Green
  - 70-89% = Amber
  - <70% = Red (manual review recommended)

**Data Source**: `GET /api/inbox?type=approval`

---

*[Continue to Section 6: Customer Intelligence Module in next response due to length]*

**Status**: Section 1-5 complete (Design System, Navigation, RBAC, Command Center)
**Next**: Customer Intelligence, Crews, Jobs, Analytics modules

## 6. CUSTOMER INTELLIGENCE MODULE

### 6.1 Customers List (/customers)

**Page Title**: "Customers"
**Layout**: Full-width table with search and filters
**Purpose**: Browse, search, and manage all customer profiles

**Frame Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ Customers (147)             [Search] [Segment ▾] [Export]    │
├──────────────────────────────────────────────────────────────┤
│ ☐ │ Customer        │ Status  │ LTV    │ Last Contact │ ⋮   │
│ ☐ │ 👤 John Smith   │ Active  │ $1,240 │ 2 days ago   │ ⋮   │
│ ☐ │ 👤 Sarah Jones  │ At-Risk │ $890   │ 14 days ago  │ ⋮   │
│ ☐ │ 👤 Mike Brown   │ Dormant │ $450   │ 3 months ago │ ⋮   │
│ ... (more rows)                                              │
├──────────────────────────────────────────────────────────────┤
│ Showing 1-25 of 147                     [< 1 2 3 4 5 6 >]   │
└──────────────────────────────────────────────────────────────┘
```

**Columns**:
1. Checkbox (40px)
2. Customer (240px): Avatar (32px) + Name + Phone (secondary)
3. Status Badge (120px): Active, At-Risk, Dormant, New
4. LTV (100px): Lifetime value, right-aligned, currency format
5. Last Contact (140px): Relative time
6. Jobs (80px): Count badge
7. Satisfaction (100px): Star rating (1-5) or emoji
8. Actions (60px): Kebab menu → View Profile, Send Message, Add Note

**Status Badge Colors**:
- **Active**: `--success-500` (green)
- **At-Risk**: `--warning-500` (amber)
- **Dormant**: `--neutral-400` (gray)
- **New**: `--info-500` (blue)

**Search**: Debounced search by name, phone, email, address
**Filters**:
- Segment: All, High-Value, At-Risk, New, Dormant
- Service Type: Mowing, Aeration, Fertilization, etc.
- Last Contact: Today, This Week, This Month, 30+ days ago

**Data Source**: `GET /api/customers` with query params

---

### 6.2 Customer Profile Drawer (Detail View)

**Trigger**: Click row in Customers List
**Type**: Right drawer, 600px width
**Purpose**: View complete customer profile + interaction timeline

**Frame Structure**:
```
┌──────────────────────────────────────────────────┐
│ 👤 John Smith                             [×]    │
├──────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐ │
│ │ Contact Info                                 │ │
│ │ 📞 (555) 123-4567                           │ │
│ │ 📧 john@example.com                         │ │
│ │ 📍 123 Main St, Austin, TX 78701            │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Customer Health                              │ │
│ │ Status: ● Active          LTV: $1,240       │ │
│ │ Satisfaction: ⭐⭐⭐⭐⭐              │ │
│ │ Churn Risk: 12% (Low)                       │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Services & Billing                           │ │
│ │ • Mowing (Bi-weekly)        $85/visit       │ │
│ │ • Fertilization (Quarterly)  $150/service   │ │
│ │ Payment: Autopay enabled (Card ****1234)    │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Interaction Timeline           [Filter ▾]    │ │
│ │ ○───────────────────────────────────────     │ │
│ │ 2 days ago: Job completed (#789)            │ │
│ │ 3 days ago: Payment received ($85)          │ │
│ │ 1 week ago: SMS sent (reminder)             │ │
│ │ 2 weeks ago: Quote approved (#456)          │ │
│ │ [Load more]                                  │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ AI-Generated Notes                           │ │
│ │ • Prefers morning service (8-10am)          │ │
│ │ • Has large oak tree (shade considerations) │ │
│ │ • Always pays on time                       │ │
│ └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│ [Send Message]  [Add Manual Note]  [View Jobs]  │
└──────────────────────────────────────────────────┘
```

**Components**:

**6.2.1 Profile Header**
- **Avatar**: 48px circle with initials or photo
- **Name**: `--text-heading-large`
- **Badge**: Status pill next to name
- **Close**: X button top-right

**6.2.2 Info Cards** (Collapsible Sections)
- **Background**: `--card`
- **Border**: 1px `--border`
- **Radius**: `--radius-md`
- **Padding**: 16px
- **Margin**: 16px between cards
- **Header**: `--text-label-large`, collapsible chevron

**6.2.3 Customer Health Indicators**
- **Status Dot**: 8px circle, semantic color
- **LTV**: Bold, `--text-heading-small`
- **Satisfaction**: Star rating (gold stars) or emoji
- **Churn Risk**: Percentage + label (Low/Medium/High)
  - Low (<20%): Green
  - Medium (20-50%): Amber
  - High (>50%): Red

**6.2.4 Timeline**
- **Icon**: 20px circle, semantic color
- **Connector**: 2px vertical line
- **Text**: `--text-body-small`
- **Timestamp**: `--text-caption-small`, relative
- **Filter dropdown**: All, Jobs, Payments, Communications, Notes
- **Lazy load**: "Load more" button at bottom

**6.2.5 AI Notes Section**
- **Background**: `--info-50` (light blue tint)
- **Icon**: 🤖 or ✨
- **Text**: Bullet list of extracted preferences/behaviors
- **Source**: Customer memory table (from capability map)

**Data Sources**:
- Profile: `GET /api/customers/:id`
- Timeline: `GET /api/customers/:id/timeline`
- AI Notes: `GET /api/memory/customer?customerId=:id`

---

### 6.3 Customer Segmentation Dashboard (Proposed)

**Route**: `/customers/segments` (new)
**Layout**: Grid of segment cards + detailed table
**Purpose**: Analyze customer base by segments for targeted outreach

**Frame Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ Customer Segments                          [Refresh] [Export]│
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────┤
│ High-Value │ At-Risk  │ New       │ Dormant  │ Churned     │
│ 23 (16%)   │ 8 (5%)   │ 34 (23%)  │ 12 (8%)  │ 5 (3%)      │
│ $1,500+    │ 14+ days │ <90 days  │ 90+ days │ Cancelled   │
├────────────┴──────────┴───────────┴──────────┴─────────────┤
│ Segment Details                        [Segment: All ▾]     │
├──────────────────────────────────────────────────────────────┤
│ (Data table with customers in selected segment)             │
└──────────────────────────────────────────────────────────────┘
```

**Segment Cards**:
- **Count**: Large number + percentage
- **Definition**: Criteria shown below
- **Color**: Semantic (green, amber, gray, etc.)
- **Clickable**: Filters table below

**Segment Definitions** (proposing business logic):
- **High-Value**: LTV > $1,500 or >10 jobs
- **At-Risk**: Last contact >14 days, previously active
- **New**: First job <90 days ago
- **Dormant**: No jobs in 90+ days
- **Churned**: Explicitly cancelled or 180+ days inactive

**Data Source**: Proposed endpoint `GET /api/customers/segments`

---

## 7. CREW & JOBS MODULE

### 7.1 Jobs List (/jobs)

**Page Title**: "Jobs"
**Layout**: Full-width table with status tabs and filters
**Purpose**: Track all job requests through lifecycle

**Frame Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ Jobs (34)                              [Search] [+New Job]   │
├──────────────────────────────────────────────────────────────┤
│ [All] [New] [Assigned] [In Progress] [Completed] [Paid]     │
├──────────────────────────────────────────────────────────────┤
│ ☐ │ Job ID │ Customer    │ Service │ Crew   │ Date  │ ⋮    │
│ ☐ │ #123   │ John Smith  │ Mowing  │ Crew A │ Today │ ⋮    │
│ ☐ │ #124   │ Sarah Jones │ Aeration│ Unass. │ Tom.  │ ⋮    │
│ ... (more rows)                                              │
├──────────────────────────────────────────────────────────────┤
│ Showing 1-25 of 34                      [< 1 2 >]           │
└──────────────────────────────────────────────────────────────┘
```

**Status Tabs** (Top of table):
- **All**: Show all jobs
- **New**: Status = "new", needs crew assignment
- **Assigned**: Crew assigned, not started
- **In Progress**: Crew on-site
- **Completed**: Job done, pending payment
- **Paid**: Fully paid

**Tab Styling**:
- Active: Underline 2px `--primary-500`, bold text
- Hover: Background `--neutral-100`
- Badge: Count next to label (e.g., "New (3)")

**Columns**:
1. Checkbox (40px)
2. Job ID (80px): #XXX, monospace
3. Customer (180px): Name, clickable
4. Service (140px): Mowing, Aeration, etc.
5. Crew (120px): Crew name or "Unassigned" (gray)
6. Scheduled Date (120px): Date + time
7. Status Badge (100px): Pill-shaped
8. Amount (100px): Currency, right-aligned
9. Actions (60px): Kebab menu → Assign Crew, View Details, Cancel

**Status Badge Colors**:
- New: `--info-500` (blue)
- Assigned: `--warning-500` (amber)
- In Progress: `--primary-500` (green)
- Completed: `--success-500` (green)
- Paid: `--neutral-400` (gray)

**Data Source**: `GET /api/jobs` with query params (status, crew, date)

---

### 7.2 Job Detail Drawer

**Trigger**: Click row in Jobs List
**Type**: Right drawer, 600px width
**Purpose**: View job details + assign crew + track progress

**Frame Structure**:
```
┌──────────────────────────────────────────────────┐
│ Job #123 - Mowing                         [×]    │
├──────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐ │
│ │ Customer: John Smith                         │ │
│ │ 📍 123 Main St, Austin, TX                  │ │
│ │ 📞 (555) 123-4567                           │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Job Details                                  │ │
│ │ Service: Mowing + Edging                    │ │
│ │ Scheduled: Today, 9:00 AM                   │ │
│ │ Duration: 1.5 hours (estimated)             │ │
│ │ Amount: $85.00                              │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Crew Assignment                              │ │
│ │ [Dropdown: Select Crew ▾]                   │ │
│ │ ┌──────────────────────────────────────────┐ │ │
│ │ │ ✅ Crew A (Recommended)                 │ │ │
│ │ │ Travel: 8 min | Score: 92/100           │ │ │
│ │ ├──────────────────────────────────────────┤ │ │
│ │ │ Crew B                                  │ │ │
│ │ │ Travel: 15 min | Score: 78/100          │ │ │
│ │ └──────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Timeline                                     │ │
│ │ ○─── Created: 2 hours ago (AI Agent)       │ │
│ │ ○─── Quote approved: 1 hour ago            │ │
│ │ ○─── Assigned to Crew A: 30 min ago        │ │
│ └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│ [Assign Crew]  [Edit]  [Cancel Job]             │
└──────────────────────────────────────────────────┘
```

**7.2.1 Crew Recommendation List**
- **Source**: AI-powered crew intelligence agent (from capability map)
- **Scoring**: 0-100 based on travel time, availability, performance
- **Visual**: Progress bar or score badge
- **Recommended badge**: Green checkmark
- **Travel time**: Minutes from current/last location
- **Click**: Select crew for assignment

**Data Sources**:
- Job detail: `GET /api/jobs/:id`
- Crew recommendations: `POST /api/ops/crews/:jobId/eligible`
- Assign: `PATCH /api/jobs/:id` → `{crewId: X}`

---

### 7.3 Crews List (/operations/crews)

**Page Title**: "Crews"
**Layout**: Grid of crew cards + performance table
**Purpose**: Manage crew roster and track performance

**Frame Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ Crews (5)                                  [+Add Crew]        │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────┤
│ Crew A Card  │ Crew B Card  │ Crew C Card  │ Crew D Card    │
│ ● Available  │ 🔴 On Job    │ ● Available  │ ● Available    │
│ 4.8 ⭐       │ 4.6 ⭐       │ 4.9 ⭐       │ 4.2 ⭐         │
│ 12 jobs/wk   │ 10 jobs/wk   │ 14 jobs/wk   │ 8 jobs/wk      │
├──────────────┴──────────────┴──────────────┴────────────────┤
│ Performance Details                        [View: Week ▾]   │
├──────────────────────────────────────────────────────────────┤
│ Crew  │ Jobs  │ Avg Margin │ Avg Time │ Quality │ On-Time  │
│ Crew A│ 12    │ 42%        │ 1.2h     │ 4.8⭐   │ 95%      │
│ Crew B│ 10    │ 38%        │ 1.5h     │ 4.6⭐   │ 90%      │
│ ... (more rows)                                              │
└──────────────────────────────────────────────────────────────┘
```

**Crew Card** (200px × 160px):
- **Header**: Crew name + leader avatar
- **Status Indicator**: Dot + label (Available, On Job, Off Duty)
- **Rating**: Star rating (1-5)
- **Jobs/Week**: Count badge
- **Clickable**: Opens crew detail drawer

**Performance Table Columns**:
1. Crew (120px): Name
2. Jobs (80px): Count this period
3. Avg Margin (100px): Percentage
4. Avg Time (100px): Hours per job
5. Quality (100px): Star rating
6. On-Time % (100px): Percentage

**Data Source**: `GET /api/ops/crews`

---

### 7.4 Crew Detail Drawer

**Trigger**: Click crew card
**Type**: Right drawer, 600px width
**Purpose**: View crew details + assignments + performance trends

**Frame Structure**:
```
┌──────────────────────────────────────────────────┐
│ Crew A - John Smith (Leader)              [×]   │
├──────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐ │
│ │ Status: ● Available                          │ │
│ │ Contact: (555) 987-6543                      │ │
│ │ Service Area: North Austin                   │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Performance (Last 30 Days)                   │ │
│ │ Jobs Completed: 48                           │ │
│ │ Avg Margin: 42% (vs 38% company avg)        │ │
│ │ Quality Rating: 4.8⭐ / 5.0                  │ │
│ │ On-Time Percentage: 95%                      │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Today's Assignments (3)                      │ │
│ │ 9:00 AM  - Job #123 (Mowing)                │ │
│ │ 11:00 AM - Job #124 (Aeration)              │ │
│ │ 2:00 PM  - Job #125 (Fertilization)         │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Margin Trend (Chart)                         │ │
│ │ [Line chart: Last 4 weeks, margin %]        │ │
│ └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│ [View Schedule]  [Edit Profile]  [Contact]      │
└──────────────────────────────────────────────────┘
```

**Data Sources**:
- Crew detail: `GET /api/ops/crews/:id`
- Today's jobs: `GET /api/jobs?crewId=:id&date=today`
- Performance: `GET /api/ops/crews/:id/performance?days=30`

---

*[End of Section 6-7]*

**Status**: Sections 6-7 complete (Customer Intelligence, Crews & Jobs)
**Next**: Analytics Module, Agent Studio, Support/PSKB, Settings

## 8. ANALYTICS MODULE

### 8.1 Analytics Dashboard (/analytics)

**Page Title**: "Analytics"
**Layout**: Multi-tab dashboard with chart grid
**Purpose**: Profit protection, retention tracking, growth insights

**Tab Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ Analytics                          [Date Range: Last 30d ▾]  │
├──────────────────────────────────────────────────────────────┤
│ [Profit] [Retention] [Growth] [Agent Performance]           │
├──────────────────────────────────────────────────────────────┤
│ (Chart grid content based on active tab)                     │
└──────────────────────────────────────────────────────────────┘
```

---

### 8.2 Profit Tab

**Layout**: 2-column grid
**Purpose**: Track margin by job, crew, customer + identify profit burn

**Charts**:

**8.2.1 Margin Trend (Line Chart)**
- **Size**: Full width, 400px height
- **X-Axis**: Date (daily or weekly)
- **Y-Axis**: Margin percentage (0-100%)
- **Lines**: 
  - Actual margin (`--primary-500`)
  - Target margin (`--neutral-400`, dashed)
- **Hover**: Show date, margin %, dollar amount
- **Drilldown**: Click point → jobs on that date

**8.2.2 Margin by Crew (Bar Chart)**
- **Size**: Half width, 300px height
- **X-Axis**: Crew names
- **Y-Axis**: Avg margin %
- **Colors**: Green (>40%), Amber (30-40%), Red (<30%)
- **Hover**: Show crew name, margin %, job count
- **Drilldown**: Click bar → crew detail

**8.2.3 Margin by Service Type (Donut Chart)**
- **Size**: Half width, 300px height
- **Segments**: Mowing, Aeration, Fertilization, etc.
- **Center Label**: Overall avg margin
- **Legend**: Right side
- **Drilldown**: Click segment → jobs of that type

**8.2.4 Profit Protection Alerts (Table)**
- **Size**: Full width
- **Columns**: Job ID, Customer, Crew, Expected Margin, Actual Margin, Variance
- **Highlight**: Rows with margin burn >10% in red background
- **Actions**: View Job, Contact Crew

**Data Sources**:
- Margin trend: Proposed `GET /api/analytics/margin?period=30d`
- Margin by crew: `GET /api/ops/crews` + aggregate
- Margin by service: `GET /api/analytics/margin-by-service`
- Alerts: `GET /api/alerts/profit-protection`

---

### 8.3 Retention Tab

**Layout**: Mixed chart + table layout
**Purpose**: Track customer retention, churn signals, LTV

**Charts**:

**8.3.1 Retention Cohort Grid**
- **Size**: Full width, 500px height
- **Rows**: Signup month (Jan 2025, Feb 2025, etc.)
- **Columns**: Months since signup (M0, M1, M2, ...)
- **Cells**: Retention % for that cohort + month
- **Colors**: Heatmap (dark green = 100%, light green = 75%, yellow = 50%, red = <25%)
- **Hover**: Show exact percentage + customer count

**8.3.2 Churn Rate Trend (Line Chart)**
- **Size**: Half width, 300px height
- **X-Axis**: Month
- **Y-Axis**: Churn rate %
- **Line**: `--destructive-500` (red)
- **Benchmark**: Industry avg 5% (dashed line)

**8.3.3 LTV Distribution (Bar Chart)**
- **Size**: Half width, 300px height
- **X-Axis**: LTV buckets ($0-500, $500-1000, $1000-1500, $1500+)
- **Y-Axis**: Customer count
- **Colors**: Shades of green (darker = higher LTV)

**8.3.4 At-Risk Customers (Table)**
- **Size**: Full width
- **Columns**: Customer, Last Contact, LTV, Churn Risk %, Actions
- **Highlight**: High-risk customers (>50%) in amber background
- **Actions**: Send Message, Schedule Call

**Data Sources**:
- Cohort grid: Proposed `GET /api/analytics/cohorts`
- Churn trend: Proposed `GET /api/analytics/churn`
- LTV distribution: `GET /api/customers/segments` + aggregate
- At-risk table: `GET /api/customers?segment=at-risk`

---

### 8.4 Growth Tab

**Layout**: Metric cards + trend charts
**Purpose**: Track new customers, revenue growth, service adoption

**Metrics Row**:
- **New Customers This Month**: Count + % change
- **Revenue This Month**: Dollar amount + % change
- **Avg Job Value**: Dollar amount + % change
- **Service Adoption Rate**: Percentage + trend arrow

**Charts**:

**8.4.1 Revenue Growth (Stacked Area Chart)**
- **Size**: Full width, 400px height
- **X-Axis**: Month
- **Y-Axis**: Revenue ($)
- **Layers**: Revenue by service type (stacked)
- **Colors**: Categorical palette
- **Legend**: Bottom

**8.4.2 New Customer Acquisition (Line + Bar Combo)**
- **Size**: Full width, 300px height
- **X-Axis**: Month
- **Bars**: New customer count
- **Line**: Acquisition cost per customer ($/customer)

**8.4.3 Service Adoption Funnel**
- **Size**: Half width, 400px height
- **Stages**: Quote Requested → Quote Sent → Quote Approved → Service Completed → Repeat Customer
- **Colors**: Single color with opacity gradient
- **Conversion rates**: Between each stage

**Data Sources**:
- Metrics: Proposed `GET /api/analytics/growth-metrics`
- Revenue: `GET /api/analytics/revenue?period=12m`
- Acquisition: `GET /api/analytics/acquisition`
- Funnel: `GET /api/analytics/funnel`

---

### 8.5 Agent Performance Tab

**Layout**: Agent cards + performance table + event timeline
**Purpose**: Monitor AI agent success rate, latency, cost

**Agent Performance Cards** (Top row):
- **Lead-to-Cash Agent**: Success rate 94%, Avg latency 2.3s
- **Quote Agent**: Success rate 97%, Avg latency 1.8s
- **Billing Agent**: Success rate 89%, Avg latency 3.1s

**Performance Table**:
- **Columns**: Agent, Total Runs, Success %, Avg Latency, Avg Cost, Last 24h Runs
- **Sortable**: Click column headers
- **Highlight**: Success rate <90% in amber
- **Actions**: View Details, View Logs

**Event Timeline** (Bottom):
- **Filter**: By agent type
- **Items**: Agent runs with outcome (success/failure)
- **Click**: Opens detailed log drawer

**Data Sources**:
- Agent metrics: `GET /api/agents` (already exists)
- Agent runs: `GET /api/agent-runs`
- Event timeline: `GET /api/events?type=agent`

---

## 9. AGENT MANAGEMENT STUDIO

### 9.1 Agents List (/agents)

**Page Title**: "Agents"
**Layout**: Grouped cards by lifecycle stage
**Purpose**: Browse, configure, test AI agents

**Frame Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ Agents                                     [+New Agent]       │
├──────────────────────────────────────────────────────────────┤
│ Lead-to-Cash Agents (3)                                      │
│ ┌────────────┬────────────┬────────────┐                    │
│ │ Inbound    │ Quote      │ Job        │                    │
│ │ Orchestr.  │ Generator  │ Scheduler  │                    │
│ │ ● Enabled  │ ● Enabled  │ ● Enabled  │                    │
│ │ 94% success│ 97% success│ 92% success│                    │
│ └────────────┴────────────┴────────────┘                    │
├──────────────────────────────────────────────────────────────┤
│ Operations Agents (2)                                        │
│ ┌────────────┬────────────┐                                 │
│ │ Crew Intel │ Route Cost │                                 │
│ │ ● Enabled  │ ● Enabled  │                                 │
│ └────────────┴────────────┘                                 │
├──────────────────────────────────────────────────────────────┤
│ Billing & Payment Agents (2)                                │
│ ┌────────────┬────────────┐                                 │
│ │ Payment    │ Autopay    │                                 │
│ │ Orchestr.  │ Enrollment │                                 │
│ │ ● Enabled  │ ⚪ Disabled│                                 │
│ └────────────┴────────────┘                                 │
├──────────────────────────────────────────────────────────────┤
│ Post-Job Agents (1)                                          │
│ ┌────────────┐                                              │
│ │ Post-Job QA│                                              │
│ │ ● Enabled  │                                              │
│ └────────────┘                                              │
└──────────────────────────────────────────────────────────────┘
```

**Agent Card** (200px × 160px):
- **Name**: `--text-label-large`
- **Status Toggle**: Enabled (green dot) / Disabled (gray dot)
- **Success Rate**: Percentage badge
- **Last Run**: Relative timestamp
- **Clickable**: Opens agent detail drawer

**Grouping**: By lifecycle stage (as shown in capability map)

**Data Source**: `GET /api/agents`

---

### 9.2 Agent Detail Drawer

**Trigger**: Click agent card
**Type**: Right drawer, 600px width
**Purpose**: Configure agent settings + test execution

**Frame Structure**:
```
┌──────────────────────────────────────────────────┐
│ Quote Generator Agent                     [×]    │
├──────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐ │
│ │ Configuration                                │ │
│ │ Status: [●] Enabled  [ ] Disabled           │ │
│ │ Confidence Threshold: [======= 70%]         │ │
│ │ Auto-approve quotes: [×] Off                │ │
│ │ Max quote value: $500                       │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Performance (Last 30 Days)                   │ │
│ │ Total Runs: 147                              │ │
│ │ Success Rate: 97%                            │ │
│ │ Avg Latency: 1.8s                            │ │
│ │ Avg Cost: $0.03 per run                     │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Test Agent                                   │ │
│ │ Sample Input:                                │ │
│ │ [Text area: customer request]               │ │
│ │ [Run Test]                                   │ │
│ │                                              │ │
│ │ Test Result:                                 │ │
│ │ (Shows generated quote + confidence)        │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Recent Runs (5)                              │ │
│ │ ✅ 2 min ago - Quote #456 ($125)            │ │
│ │ ✅ 15 min ago - Quote #455 ($200)           │ │
│ │ ❌ 1 hour ago - Failed (invalid address)    │ │
│ │ [View All Runs]                              │ │
│ └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│ [Save Changes]  [View Logs]  [Disable Agent]    │
└──────────────────────────────────────────────────┘
```

**9.2.1 Configuration Section**
- **Toggle**: Enable/disable agent
- **Sliders**: Adjust thresholds (0-100%)
- **Checkboxes**: Feature flags (auto-approve, etc.)
- **Inputs**: Numeric limits (max quote value, etc.)

**9.2.2 Test Execution**
- **Input**: Textarea for sample data (JSON or plain text)
- **Button**: "Run Test" (triggers agent)
- **Output**: Pretty-printed result with confidence score
- **Latency**: Show execution time

**9.2.3 Recent Runs Timeline**
- **Icon**: ✅ (success) or ❌ (failure)
- **Text**: Brief description + timestamp
- **Click**: Opens detailed run log modal

**Data Sources**:
- Config: `GET /api/agents/:id`
- Update: `PATCH /api/agents/:id`
- Test: `POST /api/agents/:id/test`
- Recent runs: `GET /api/agent-runs?agentId=:id&limit=5`

---

### 9.3 Agent Event Timeline (/events)

**Page Title**: "Agent Events"
**Layout**: Infinite-scroll timeline with filters
**Purpose**: Audit trail of all agent actions

**Frame Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ Agent Events                      [Agent: All ▾] [Date ▾]    │
├──────────────────────────────────────────────────────────────┤
│ ○────────────────────────────────────────────────────────    │
│ 2 min ago: Quote Generator - Generated quote #456            │
│   Customer: John Smith | Amount: $125 | Confidence: 94%      │
│   [View Details]                                              │
│                                                               │
│ ○────────────────────────────────────────────────────────    │
│ 15 min ago: Crew Intelligence - Recommended Crew A           │
│   Job: #123 | Match Score: 92/100                            │
│   [View Details]                                              │
│                                                               │
│ ○────────────────────────────────────────────────────────    │
│ 1 hour ago: Payment Orchestrator - Failed payment retry      │
│   Customer: Jane Doe | Error: Card declined                  │
│   [View Details] [Retry]                                      │
│                                                               │
│ [Load more]                                                   │
└──────────────────────────────────────────────────────────────┘
```

**Timeline Item Components**:
- **Connector**: 2px vertical line
- **Icon**: 20px circle, semantic color (green = success, red = failure, blue = info)
- **Timestamp**: Relative time
- **Agent Name**: Bold
- **Action**: Description
- **Metadata**: Key details (customer, amount, etc.)
- **Actions**: "View Details" link, optional action button

**Filters**:
- **Agent**: Dropdown (All, Quote Generator, Crew Intelligence, etc.)
- **Outcome**: All, Success, Failure
- **Date Range**: Today, This Week, This Month, Custom

**Data Source**: `GET /api/events?type=agent` with filters

---

*[End of Section 8-9]*

**Status**: Sections 8-9 complete (Analytics, Agent Studio)
**Next**: Support Queue + PSKB, Settings Hub, States

## 10. SUPPORT QUEUE & PSKB

### 10.1 Support Queue (/support/queue)

**Page Title**: "Support Queue"
**Layout**: Full-width table with SLA indicators and filters
**Purpose**: Manage enriched customer support threads

**Frame Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ Support Queue (12)            [Priority ▾] [Coverage ▾]      │
├──────────────────────────────────────────────────────────────┤
│ SLA│ Priority │ Customer    │ Intent    │ Coverage │ Age  │⋮ │
│ 🔴 │ Urgent   │ John Smith  │ Billing   │ ✅ Covered│ 2h  │⋮ │
│ 🟠 │ High     │ Sarah Jones │ Reschd.   │ ⚠️ Partial│ 30m │⋮ │
│ 🟢 │ Normal   │ Mike Brown  │ General   │ ❌ None   │ 5m  │⋮ │
│ ... (more rows)                                              │
├──────────────────────────────────────────────────────────────┤
│ Showing 1-25 of 12                      [< 1 >]             │
└──────────────────────────────────────────────────────────────┘
```

**Columns**:
1. SLA Indicator (40px): Dot + countdown timer
   - 🔴 Overdue: Past SLA
   - 🟠 Critical: <30min to breach
   - 🟡 Soon: <4hr to breach
   - 🟢 OK: Plenty of time
2. Priority (100px): Badge (Urgent, High, Normal, Low)
3. Customer (180px): Name + phone
4. Intent (120px): Auto-classified (Billing, Scheduling, Service Quality, etc.)
5. Coverage (120px): PSKB coverage indicator
   - ✅ Covered: Full knowledge available
   - ⚠️ Partial: Some knowledge available
   - ❌ None: No knowledge match
6. Sentiment (80px): Emoji (😊 positive, 😐 neutral, 😞 negative)
7. Age (80px): Time since thread started
8. Actions (60px): Kebab menu → View Thread, Mark Resolved, Escalate

**Filters** (Top toolbar):
- **Priority**: All, Urgent, High, Normal, Low
- **Coverage**: All, Covered, Partial, None
- **SLA Status**: All, Overdue, Critical, At-Risk, OK
- **Assigned**: Me, My Team, Unassigned, All

**SLA Countdown Timer**:
- Shows remaining time to first response SLA (e.g., "28m remaining")
- Color matches dot indicator

**Data Source**: `GET /api/support/queue` (Sprint 2 backend complete)

---

### 10.2 Thread Detail Drawer

**Trigger**: Click row in Support Queue
**Type**: Right drawer, 600px width
**Purpose**: View thread + AI context + respond

**Frame Structure**:
```
┌──────────────────────────────────────────────────┐
│ Thread #789 - John Smith                  [×]   │
├──────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐ │
│ │ AI Enrichment                                │ │
│ │ Intent: Billing Question (92% confidence)   │ │
│ │ Priority: Urgent                             │ │
│ │ Sentiment: Negative 😞                       │ │
│ │ Coverage: ✅ Covered by KB-12v3              │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Suggested Macros (2)                         │ │
│ │ 📄 Autopay Policy (KB-12v3)                 │ │
│ │ [Insert]                                     │ │
│ │ 📄 Payment Failed FAQ (KB-14v1)             │ │
│ │ [Insert]                                     │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Conversation                                 │ │
│ │ ┌──────────────────────────────────────────┐ │ │
│ │ │ Customer (2h ago):                       │ │ │
│ │ │ "Why was my card charged twice?"         │ │ │
│ │ ├──────────────────────────────────────────┤ │ │
│ │ │ AI Assistant (1h 58m ago):               │ │ │
│ │ │ "Let me check your account..."           │ │ │
│ │ │ [Awaiting staff approval]                │ │ │
│ │ └──────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Your Response                                │ │
│ │ [Text area]                                  │ │
│ │ [Attach Knowledge] [Insert Macro]           │ │
│ └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│ [Send & Resolve]  [Send]  [Escalate]           │
└──────────────────────────────────────────────────┘
```

**10.2.1 AI Enrichment Card**
- **Background**: `--info-50` (blue tint)
- **Icon**: 🤖
- **Fields**: Intent, Priority, Sentiment, Coverage
- **Confidence**: Show percentage next to intent
- **Editable**: Click to override AI classification

**10.2.2 Suggested Macros**
- **List**: Top 2-3 knowledge items matching intent
- **Item**:
  - Icon: 📄 (document)
  - Title: Knowledge item name + version
  - Button: "Insert" (inserts content into response textarea)
- **Source**: PSKB coverage detector (Sprint 2 backend)

**10.2.3 Conversation Thread**
- **Messages**: Customer and AI assistant messages
- **Bubble style**: Left (customer) vs right (AI/staff)
- **Timestamp**: Below each message
- **AI status**: "Awaiting staff approval" if pending action

**10.2.4 Response Composer**
- **Textarea**: Rich text editor (bold, italic, bullets)
- **Buttons**:
  - "Attach Knowledge": Insert citation to PSKB item
  - "Insert Macro": Quick-insert predefined response
- **Actions**:
  - "Send & Resolve": Send + mark thread resolved
  - "Send": Send reply, keep thread open
  - "Escalate": Forward to manager

**Data Sources**:
- Thread detail: `GET /api/support/queue/:threadId`
- Send response: `POST /api/support/queue/:threadId/respond`
- Resolve: `POST /api/support/queue/:threadId/resolve`

---

### 10.3 Knowledge Base List (/knowledge)

**Page Title**: "Knowledge Base"
**Layout**: Full-width table with status tabs
**Purpose**: Browse and manage PSKB items

**Frame Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ Knowledge Base (47)               [Search] [+New Knowledge]  │
├──────────────────────────────────────────────────────────────┤
│ [All] [Published] [Review Pending] [Draft]                  │
├──────────────────────────────────────────────────────────────┤
│ ID    │ Title              │ Type    │ Status    │ Updated │⋮│
│ KB-12 │ Autopay Policy     │ Policy  │ Published │ 2w ago  │⋮│
│ KB-14 │ Payment Failed FAQ │ Payment │ Published │ 1w ago  │⋮│
│ KB-23 │ Refund Process     │ Policy  │ Review    │ 2d ago  │⋮│
│ ... (more rows)                                              │
├──────────────────────────────────────────────────────────────┤
│ Showing 1-25 of 47                      [< 1 2 >]           │
└──────────────────────────────────────────────────────────────┘
```

**Status Tabs**:
- **All**: Show all knowledge items
- **Published**: Live knowledge (status = "published")
- **Review Pending**: Awaiting approval (status = "review")
- **Draft**: Work in progress (status = "draft")

**Columns**:
1. ID (80px): KB-XX, monospace
2. Title (300px): Clickable
3. Type (100px): Badge (Policy, Service, Payment, Operations, Proof of Work, Macro)
4. Status (100px): Badge (Published, Review, Draft, Retired)
5. Version (60px): vX
6. Updated (120px): Relative time
7. Author (120px): Name
8. Actions (60px): Kebab menu → Edit, Retire, Duplicate

**Search**: Full-text search across title, content, tags
**Filters**:
- **Type**: All types or specific (Policy, Service, etc.)
- **Status**: Published, Review, Draft, Retired
- **Author**: Me, All

**Data Source**: `GET /api/knowledge/items` (Sprint 1 backend complete)

---

### 10.4 Knowledge Builder (/knowledge/builder)

**Page Title**: "Create Knowledge" or "Edit Knowledge"
**Layout**: Form with live preview
**Purpose**: Create/edit PSKB items

**Frame Structure**:
```
┌────────────────────┬─────────────────────────────────────────┐
│ Edit Mode          │ Preview                                 │
├────────────────────┤                                         │
│ Type: [Policy ▾]  │ Autopay Policy (KB-12v4)                │
│                    │                                         │
│ Title:             │ Autopay automatically charges your      │
│ [Autopay Policy]   │ default payment method after each       │
│                    │ service. Maximum charge: $500.          │
│ Slug:              │                                         │
│ [autopay-policy]   │ Requirements:                           │
│                    │ • Valid payment method on file          │
│ Content:           │ • Service completed successfully        │
│ [Rich text editor] │                                         │
│                    │ To enable autopay, visit Settings >     │
│ Tags:              │ Billing.                                │
│ [billing, payment] │                                         │
│                    │                                         │
│ Requires Review:   │ Citations:                              │
│ [×] Weekly         │ • Referenced in 12 threads              │
│ [×] Monthly        │ • Last updated: 2 weeks ago             │
│ [×] Quarterly      │                                         │
│ [✓] Annually       │                                         │
│                    │                                         │
│ [Save Draft]       │                                         │
│ [Submit Review]    │                                         │
└────────────────────┴─────────────────────────────────────────┘
```

**10.4.1 Edit Mode (Left, 50%)**
- **Type Dropdown**: 6 knowledge types (Policy, Service, Payment, Operations, Proof of Work, Macro)
- **Title**: Text input
- **Slug**: Auto-generated from title, editable
- **Content**: Rich text editor (Markdown or WYSIWYG)
- **Tags**: Chip input (comma-separated)
- **Review Schedule**: Checkboxes for review frequency
- **Validation**: Real-time validation errors shown inline
  - Errors (red): Blocking issues (e.g., missing required field)
  - Warnings (amber): Non-blocking issues (e.g., long title)

**10.4.2 Preview Mode (Right, 50%)**
- **Live Rendering**: Updates as you type
- **Citation Count**: Show how many threads reference this item
- **Last Updated**: Timestamp

**Actions**:
- **Save Draft**: Save without submitting
- **Submit for Review**: Send to OWNER/ADMIN for approval
- **Publish** (OWNER/ADMIN only): Immediately publish

**Data Sources**:
- Create: `POST /api/knowledge/items`
- Update: `POST /api/knowledge/items/:id/versions` (creates new version)
- Submit: `POST /api/knowledge/items/:id/submit`

---

### 10.5 Knowledge Approvals (/knowledge/approvals)

**Page Title**: "Knowledge Approvals"
**Layout**: List of items pending review
**Purpose**: OWNER/ADMIN approve/reject knowledge submissions

**Frame Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ Knowledge Approvals (3)                                      │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐  │
│ │ KB-23 - Refund Process (Policy)                        │  │
│ │ Submitted by: Jane Doe | 2 days ago                    │  │
│ │ Change Notes: "Added clarification for partial refunds"│  │
│ │                                                         │  │
│ │ [View Diff] [Approve] [Reject]                         │  │
│ └────────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ KB-28 - Aeration FAQ (Service)                         │  │
│ │ Submitted by: John Smith | 5 days ago                  │  │
│ │ Change Notes: "Initial version"                        │  │
│ │                                                         │  │
│ │ [View Diff] [Approve] [Reject]                         │  │
│ └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Approval Card**:
- **Header**: ID + Title + Type badge
- **Meta**: Author + timestamp + change notes
- **Actions**:
  - "View Diff": Opens modal showing old vs new version (side-by-side)
  - "Approve": Publish knowledge immediately
  - "Reject": Return to author with feedback

**View Diff Modal**:
- **Layout**: 2-column side-by-side
- **Left**: Previous version (or "New Item" if first version)
- **Right**: Proposed version
- **Highlighting**: Green = added, Red = removed, Yellow = changed

**Data Source**: `GET /api/knowledge/approvals/pending`

---

### 10.6 Coverage Gaps (/support/gaps)

**Page Title**: "Knowledge Coverage Gaps"
**Layout**: Table of uncovered intents + trend chart
**Purpose**: Identify topics missing from PSKB

**Frame Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ Coverage Gaps                             [Date Range: 30d ▾]│
├──────────────────────────────────────────────────────────────┤
│ Coverage Trend (Chart)                                       │
│ [Line chart: % of threads covered by PSKB over time]        │
├──────────────────────────────────────────────────────────────┤
│ Top Uncovered Intents                                        │
│ Intent               │ Threads │ Avg Sentiment │ Action      │
│ Snow Removal Policy  │ 8       │ 😞 Negative   │ [+Create]  │
│ Weekend Availability │ 5       │ 😐 Neutral    │ [+Create]  │
│ Pet Considerations   │ 3       │ 😐 Neutral    │ [+Create]  │
│ ... (more rows)                                              │
└──────────────────────────────────────────────────────────────┘
```

**Coverage Trend Chart**:
- **X-Axis**: Date (daily or weekly)
- **Y-Axis**: Coverage percentage (0-100%)
- **Line**: `--primary-500`
- **Target Line**: 80% coverage (dashed)

**Gaps Table Columns**:
1. Intent (240px): Auto-detected intent from threads
2. Thread Count (100px): Number of threads with this intent
3. Avg Sentiment (140px): Emoji + label
4. Last Occurrence (120px): Relative time
5. Action (100px): "+ Create Knowledge" button

**Click "+ Create"**: Opens Knowledge Builder with intent pre-filled as title

**Data Source**: `GET /api/support/coverage-gaps`

---

## 11. SETTINGS HUB

### 11.1 Settings Landing (/settings)

**Page Title**: "Settings"
**Layout**: Grid of setting category cards
**Purpose**: Hub for all configuration screens

**Frame Structure**:
```
┌──────────────────────────────────────────────────────────────┐
│ Settings                                                      │
├──────────────────────────────────────────────────────────────┤
│ ┌─────────────┬─────────────┬─────────────┬─────────────┐   │
│ │ 🤖 Agents  │ 📋 Policies│ 💰 Pricing │ 🛠️ Services│   │
│ │ Config AI  │ Business   │ Rules &    │ Offerings   │   │
│ │ agents     │ policies   │ margins    │ management  │   │
│ ├─────────────┼─────────────┼─────────────┼─────────────┤   │
│ │ 👥 Users   │ 🔌 Integr. │ 📊 Observ. │ 📤 Exports │   │
│ │ Staff &    │ Third-party│ Audit logs │ Data export│   │
│ │ permissions│ connections│ monitoring │ tools      │   │
│ ├─────────────┼─────────────┼─────────────┼─────────────┤   │
│ │ 💳 Billing │ 💬 Comms   │ 📝 Template│            │   │
│ │ Config     │ Studio     │ Messages   │            │   │
│ └─────────────┴─────────────┴─────────────┴─────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Setting Card** (240px × 160px):
- **Icon**: 48px emoji or icon
- **Title**: `--text-heading-small`
- **Description**: `--text-body-small`
- **Hover**: Shadow + scale effect
- **Click**: Navigate to setting detail page

---

### 11.2 Settings Structure (Detail Pages)

All settings pages follow consistent structure:
- **Left**: Form fields or table
- **Right**: Live preview or help panel (optional)
- **Bottom**: Save/Cancel buttons (sticky footer)

**Setting Pages** (already implemented in capability map):
- **/settings/agents** → Agent configuration
- **/settings/policies** → Business policies
- **/settings/pricing** → Pricing rules
- **/settings/services** → Service offerings
- **/settings/users** → User management
- **/settings/integrations** → Third-party integrations
- **/settings/observability** → Audit logs + monitoring
- **/settings/exports** → Data export tools
- **/settings/billing-config** → Billing preferences
- **/settings/comms-studio** → Communications settings
- **/settings/templates** → Message templates

**Refer to existing pages** ([client/src/pages/settings/](client/src/pages/settings/)) for current designs.

---

## 12. EMPTY, LOADING, ERROR STATES

### 12.1 Empty State Patterns

**Pattern 1: No Data (Initial State)**
```
┌─────────────────────────────────────────────┐
│               [Icon: 64px]                  │
│                                             │
│     No customers yet                        │
│     Add your first customer to get started │
│                                             │
│          [+ Add Customer]                   │
└─────────────────────────────────────────────┘
```
- **Icon**: Relevant to context (e.g., 👥 for customers)
- **Heading**: `--text-heading-medium`
- **Description**: `--text-body-medium`, `--neutral-500`
- **Action**: Primary button

**Pattern 2: No Results (Filtered)**
```
┌─────────────────────────────────────────────┐
│               [Icon: 64px]                  │
│                                             │
│     No results found                        │
│     Try adjusting your filters              │
│                                             │
│          [Clear Filters]                    │
└─────────────────────────────────────────────┘
```
- **Icon**: 🔍 (search)
- **Action**: "Clear Filters" button (secondary style)

**Pattern 3: No Permission**
```
┌─────────────────────────────────────────────┐
│               [Icon: 64px]                  │
│                                             │
│     Access restricted                       │
│     Contact your admin for access           │
│                                             │
│          [Contact Admin]                    │
└─────────────────────────────────────────────┘
```
- **Icon**: 🔒 (lock)
- **Action**: "Contact Admin" link

---

### 12.2 Loading State Patterns

**Pattern 1: Skeleton Loaders (Tables)**
```
┌──────────────────────────────────────────────┐
│ [████████] [████████] [████████]            │
│ [████████] [████████] [████████]            │
│ [████████] [████████] [████████]            │
└──────────────────────────────────────────────┘
```
- **Use**: Table rows, list items
- **Animation**: Pulse effect (shimmer)
- **Color**: `--neutral-200` background, `--neutral-300` pulse

**Pattern 2: Spinner (Full Page)**
```
┌─────────────────────────────────────────────┐
│                                             │
│            [Spinner: 48px]                  │
│                                             │
└─────────────────────────────────────────────┘
```
- **Use**: Initial page load, large data fetch
- **Icon**: Circular spinner, `--primary-500`
- **Animation**: Rotate 360deg, 1s duration

**Pattern 3: Progress Bar (Long Operations)**
```
┌─────────────────────────────────────────────┐
│ Exporting data... 42%                       │
│ [████████████░░░░░░░░░░░░░░░░░]            │
└─────────────────────────────────────────────┘
```
- **Use**: Exports, bulk operations
- **Bar**: `--primary-500` fill, `--neutral-200` background

---

### 12.3 Error State Patterns

**Pattern 1: Inline Error (Form)**
```
┌─────────────────────────────────────────────┐
│ Email                                       │
│ [invalid@]  ⚠️ Invalid email format        │
└─────────────────────────────────────────────┘
```
- **Icon**: ⚠️ or ⛔ next to field
- **Text**: `--text-caption-medium`, `--destructive-500`
- **Border**: Input border `--destructive-500`

**Pattern 2: Page Error (API Failure)**
```
┌─────────────────────────────────────────────┐
│               [Icon: 64px]                  │
│                                             │
│     Something went wrong                    │
│     Unable to load data. Please try again   │
│                                             │
│          [Retry]  [Go Home]                 │
└─────────────────────────────────────────────┘
```
- **Icon**: ⚠️ (warning)
- **Heading**: `--text-heading-medium`
- **Actions**: Primary "Retry" + Secondary "Go Home"

**Pattern 3: Toast Notification (Transient Error)**
```
┌─────────────────────────────────────────────┐
│ ⛔ Failed to save changes                   │
│ Please check your internet connection   [×]│
└─────────────────────────────────────────────┘
```
- **Position**: Bottom-right corner
- **Background**: `--destructive-500`
- **Text**: White
- **Duration**: 5 seconds, auto-dismiss
- **Close**: X button

---

## CONCLUSION & NEXT STEPS

### Document Status
✅ **COMPLETE** - All 12 sections specified
- Design System & Tokens
- Web Extensions (tables, filters, charts)
- Navigation Structure
- RBAC Matrix
- 7 Major Modules (Command Center, Customers, Crews/Jobs, Analytics, Agents, Support/PSKB, Settings)
- All UI states (empty, loading, error)

### Implementation Readiness
- **Backend APIs**: 95% complete (from capability map)
- **UI Components**: 85% reusable from existing (shadcn/ui)
- **Net New Screens**: ~20 screens (mostly analytics + enhanced views)
- **Design Tokens**: Fully specified, aligned to mobile

### Figma Make Execution
Ready for Figma Make prompts (next document: FIGMA_MAKE_PROMPTS_WEB.md)

### Data Contract Validation
All screen specs reference existing backend endpoints from capability map:
- ✅ Dashboard metrics → `GET /api/dashboard`
- ✅ Jobs list → `GET /api/jobs`
- ✅ Support queue → `GET /api/support/queue`
- ✅ Knowledge base → `GET /api/knowledge/items`
- ✅ Agent config → `GET /api/agents`
- ⚠️ Analytics (proposed) → Need aggregation endpoints

---

**Document Version**: 1.0
**Last Updated**: January 12, 2026
**Maintained By**: Product + Design
**Source**: [WEB_UI_CODEBASE_CAPABILITY_MAP.md](WEB_UI_CODEBASE_CAPABILITY_MAP.md)
