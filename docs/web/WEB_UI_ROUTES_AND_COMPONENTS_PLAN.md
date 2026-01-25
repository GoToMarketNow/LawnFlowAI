# LawnFlow Web UI - Routes & Components Implementation Plan

**Purpose**: Technical implementation guide mapping Figma designs to React components and routes.

**Date**: January 12, 2026
**Framework**: React 18.3 + Wouter 3.3.5 + TanStack Query 5.60.5
**UI Library**: shadcn/ui (Radix UI + Tailwind CSS)
**Source Documents**:
- [WEB_UI_CODEBASE_CAPABILITY_MAP.md](WEB_UI_CODEBASE_CAPABILITY_MAP.md)
- [LAWNFLOW_WEB_UI_FIGMA_SPEC.md](LAWNFLOW_WEB_UI_FIGMA_SPEC.md)

---

## TABLE OF CONTENTS

1. [Routing Structure](#1-routing-structure)
2. [Component Architecture](#2-component-architecture)
3. [New Components Needed](#3-new-components-needed)
4. [Component Enhancement Plan](#4-component-enhancement-plan)
5. [State Management Patterns](#5-state-management-patterns)
6. [Implementation Phases](#6-implementation-phases)

---

## 1. ROUTING STRUCTURE

### 1.1 Existing Routes (Reuse)

**Already Implemented** (from [client/src/App.tsx](client/src/App.tsx:235-312)):

```typescript
// Command Center
"/" or "/home" → HomePage (existing: home.tsx)
"/dashboard" → Dashboard (existing: dashboard.tsx, redirect to /home if UI_REFACTOR_V1)

// Work & Inbox
"/work" → WorkQueuePage (existing: inbox.tsx logic, new wrapper needed)
"/inbox" → InboxPage (existing: inbox.tsx)
"/approvals" → ApprovalsPage (existing: approvals.tsx)
"/actions" → PendingActionsPage (existing: pending-actions.tsx)

// Operations
"/customers" → CustomersPage (existing: customers.tsx)
"/customers/:id" → ConversationDetailPage (existing: conversation-detail.tsx)
"/jobs" → JobsPage (existing: jobs.tsx)
"/quotes" → QuotesPage (existing: quotes.tsx)
"/quote-builder" → QuoteBuilder (existing: quote-builder.tsx)
"/schedule" → SchedulePage (existing: schedule.tsx)
"/operations/crews" → CrewsPage (existing: crews.tsx)
"/operations/crews/:id" → CrewDetailPage (existing: crew-detail.tsx)

// Finance
"/billing" → BillingPage (existing: billing.tsx)
"/billing/invoices" → BillingInvoicesPage (existing: billing-invoices.tsx)
"/billing/payments" → BillingPaymentsPage (existing: billing-payments.tsx)
"/billing/issues" → BillingIssuesPage (existing: billing-issues.tsx)

// Support & Knowledge
"/support/queue" → SupportQueuePage (existing: support-queue.tsx)
"/support/thread/:id" → ThreadDetailPage (existing: thread-detail.tsx)
"/support/gaps" → CoverageGapsPage (existing: coverage-gaps.tsx)
"/knowledge" → KnowledgeListPage (existing: knowledge-list.tsx)
"/knowledge/builder" → KnowledgeBuilderPage (existing: knowledge-builder.tsx)
"/knowledge/approvals" → KnowledgeApprovalsPage (existing: knowledge-approvals.tsx)
"/knowledge/reviews" → KnowledgeReviewsPage (existing: knowledge-reviews.tsx)

// Agents
"/agents" → AgentsPage (existing: agents.tsx)
"/agents/:id" → AgentDetailPage (existing: agent-detail.tsx)
"/events" → EventsFeedPage (existing: events-feed.tsx)

// Settings
"/settings" → SettingsPage (existing: settings.tsx)
"/settings/agents" → SettingsAgentsPage (existing: settings/agents.tsx)
"/settings/policies" → SettingsPoliciesPage (existing: settings/policies.tsx)
"/settings/pricing" → SettingsPricingPage (existing: settings/pricing.tsx)
"/settings/integrations" → SettingsIntegrationsPage (existing: settings/integrations.tsx)
"/settings/observability" → SettingsObservabilityPage (existing: settings/observability.tsx)
"/settings/exports" → SettingsExportsPage (existing: settings/exports.tsx)
"/settings/services" → SettingsServicesPage (existing: settings/services.tsx)
"/settings/users" → SettingsUsersPage (existing: settings/users.tsx)
"/settings/templates" → SettingsTemplatesPage (existing: settings/templates.tsx)
"/settings/billing-config" → SettingsBillingConfigPage (existing: settings/billing-config.tsx)
"/settings/comms-studio" → SettingsCommsStudioPage (existing: settings/comms-studio.tsx)
```

### 1.2 New Routes Needed

**Analytics Module** (NEW):

```typescript
// Create new pages
"/analytics" → AnalyticsDashboardPage (NEW)
  - Tabs: Profit, Retention, Growth, Agent Performance
  - Component: client/src/pages/analytics-dashboard.tsx

// Optional: Deep-link to specific tabs
"/analytics/profit" → AnalyticsDashboardPage (tab=profit)
"/analytics/retention" → AnalyticsDashboardPage (tab=retention)
"/analytics/growth" → AnalyticsDashboardPage (tab=growth)
"/analytics/agents" → AnalyticsDashboardPage (tab=agents)
```

**Customer Intelligence** (ENHANCE EXISTING):

```typescript
// Enhance existing route
"/customers" → CustomersPage (ENHANCE with segmentation)

// Add new route
"/customers/segments" → CustomerSegmentsPage (NEW)
  - Component: client/src/pages/customer-segments.tsx
```

**Implementation**:

```tsx
// In client/src/App.tsx, add to <Switch>:

<Route path="/analytics" component={AnalyticsDashboardPage} />
<Route path="/analytics/:tab" component={AnalyticsDashboardPage} />
<Route path="/customers/segments" component={CustomerSegmentsPage} />
```

---

## 2. COMPONENT ARCHITECTURE

### 2.1 Existing Component Inventory (Reusable)

**From [client/src/components/ui/](client/src/components/ui/)**:

✅ **Layout Components**:
- Card, Separator, ScrollArea, Sidebar, Sheet, Drawer, Dialog, Tabs

✅ **Form Components**:
- Button, Input, Textarea, Select, Checkbox, RadioGroup, Switch, Slider, Label, Form

✅ **Data Display**:
- Table, Badge, Avatar, Skeleton, EmptyState, Progress, Pagination

✅ **Navigation**:
- Tabs, Breadcrumb, NavigationMenu, Menubar, DropdownMenu, ContextMenu

✅ **Feedback**:
- Alert, AlertDialog, Toast, Toaster, HoverCard, Tooltip, Popover

✅ **Advanced**:
- Chart (Recharts wrapper), Command (cmdk), Calendar, Carousel, Accordion, Collapsible

**From [client/src/components/](client/src/components/)**:

✅ **Business Components**:
- GlobalSearch, NotificationBell, UserMenu, RoleGate, ErrorBoundary, ContextualDrawer, ThemeToggle
- MarginAlertTile, GrowthAdvisorWidget, SystemStatus

✅ **Ops Components**:
- JobQueue, SimulationCards, OpsMap

✅ **Onboarding Components**:
- OnboardingWizard, QuestionRenderer, ReviewStep

---

## 3. NEW COMPONENTS NEEDED

### 3.1 Web-Specific Data Components

**Priority: HIGH** (Required for analytics + enhanced tables)

#### 3.1.1 DataTable Component (Enhanced)

**File**: `client/src/components/ui/data-table.tsx`

**Purpose**: Feature-rich table with sorting, filtering, pagination, bulk actions

**Features**:
- Column sorting (click headers)
- Column resizing (drag borders)
- Row selection (checkboxes)
- Bulk actions bar (appears when rows selected)
- Sticky header + pagination
- Density modes (comfortable/compact)
- Empty state integration
- Loading skeleton
- Export to CSV

**Props**:
```typescript
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  sortable?: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  density?: 'comfortable' | 'compact';
  bulkActions?: React.ReactNode;
}
```

**Dependencies**: @tanstack/react-table

**Extends**: Existing [table.tsx](client/src/components/ui/table.tsx:1)

---

#### 3.1.2 FilterPanel Component

**File**: `client/src/components/ui/filter-panel.tsx`

**Purpose**: Left sidebar or dropdown with filter controls

**Features**:
- Multi-select filters (checkboxes)
- Single-select filters (radio or dropdown)
- Date range picker
- Search filter
- Tag filter (chip input)
- Clear all button
- Saved views dropdown
- Collapsible sections

**Props**:
```typescript
interface FilterPanelProps {
  filters: FilterDefinition[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  savedViews?: SavedView[];
  onSaveView?: (name: string) => void;
  onClear?: () => void;
}

type FilterDefinition = {
  id: string;
  label: string;
  type: 'multi-select' | 'single-select' | 'date-range' | 'search' | 'tags';
  options?: { label: string; value: string }[];
};
```

---

#### 3.1.3 MetricCard Component

**File**: `client/src/components/ui/metric-card.tsx`

**Purpose**: Dashboard metric display with trend indicator

**Features**:
- Large value display
- Label + icon
- Change indicator (+/- with color)
- Clickable (navigate to detail)
- Loading skeleton
- Tooltip with explanation

**Props**:
```typescript
interface MetricCardProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    period: string; // "vs last month"
    direction: 'up' | 'down';
  };
  icon?: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  formatter?: (value: number) => string; // currency, percentage, etc.
}
```

---

#### 3.1.4 Chart Components (Enhanced)

**Files**:
- `client/src/components/charts/line-chart.tsx`
- `client/src/components/charts/bar-chart.tsx`
- `client/src/components/charts/donut-chart.tsx`
- `client/src/components/charts/area-chart.tsx`
- `client/src/components/charts/cohort-grid.tsx`
- `client/src/components/charts/funnel-chart.tsx`

**Purpose**: Standardized chart wrappers around Recharts

**Common Features**:
- Consistent styling (colors, fonts, spacing)
- Responsive sizing
- Loading state
- Empty state
- Tooltip formatting
- Legend positioning
- Export to image

**Extends**: Existing [chart.tsx](client/src/components/ui/chart.tsx:1)

**Props Pattern**:
```typescript
interface BaseChartProps {
  data: any[];
  loading?: boolean;
  height?: number;
  title?: string;
  subtitle?: string;
  onDataPointClick?: (dataPoint: any) => void;
}

interface LineChartProps extends BaseChartProps {
  xKey: string;
  yKeys: string[];
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
}

// Similar for other chart types
```

---

#### 3.1.5 StatusIndicator Component

**File**: `client/src/components/ui/status-indicator.tsx`

**Purpose**: Colored dot + label (SLA, status, etc.)

**Variants**:
- Dot only (8px circle)
- Dot + label
- Dot + label + countdown timer (for SLA)

**Props**:
```typescript
interface StatusIndicatorProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  label?: string;
  showDot?: boolean;
  countdown?: {
    targetTime: Date;
    onExpire?: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
}
```

---

#### 3.1.6 TimelineItem Component

**File**: `client/src/components/ui/timeline-item.tsx`

**Purpose**: Vertical timeline for events, conversations, history

**Features**:
- Icon + connector line
- Timestamp (relative + absolute tooltip)
- Title + description
- Action buttons (optional)
- Expandable detail

**Props**:
```typescript
interface TimelineItemProps {
  icon?: React.ReactNode;
  iconColor?: string;
  timestamp: Date;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  expandable?: boolean;
  children?: React.ReactNode;
}
```

---

### 3.2 Business Logic Components

**Priority: MEDIUM** (Enhance UX but not critical for MVP)

#### 3.2.1 SLAIndicator Component

**File**: `client/src/components/business/sla-indicator.tsx`

**Purpose**: Specialized status indicator for support queue SLA tracking

**Features**:
- Color-coded urgency (red/amber/yellow/green)
- Countdown timer with auto-refresh
- Tooltip with SLA details
- Visual progression (progress ring)

**Props**:
```typescript
interface SLAIndicatorProps {
  targetTime: Date;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  type: 'first_response' | 'resolution';
  onExpire?: () => void;
}
```

---

#### 3.2.2 CustomerHealthBadge Component

**File**: `client/src/components/business/customer-health-badge.tsx`

**Purpose**: Customer health status (Active, At-Risk, Dormant, New)

**Features**:
- Semantic color coding
- Icon + label
- Tooltip with criteria
- Churn risk percentage

**Props**:
```typescript
interface CustomerHealthBadgeProps {
  status: 'active' | 'at-risk' | 'dormant' | 'new';
  churnRisk?: number; // 0-100
  ltv?: number;
  lastContact?: Date;
}
```

---

#### 3.2.3 AgentConfigPanel Component

**File**: `client/src/components/business/agent-config-panel.tsx`

**Purpose**: Agent configuration form in drawer

**Features**:
- Toggle enable/disable
- Threshold sliders
- Feature flag checkboxes
- Numeric input limits
- Test execution button
- Save/cancel actions

**Props**:
```typescript
interface AgentConfigPanelProps {
  agentId: string;
  config: AgentConfig;
  onSave: (config: AgentConfig) => Promise<void>;
  onTest: (input: string) => Promise<TestResult>;
  onClose: () => void;
}
```

---

#### 3.2.4 KnowledgeSearchBar Component

**File**: `client/src/components/business/knowledge-search-bar.tsx`

**Purpose**: Hybrid search with instant results dropdown

**Features**:
- Debounced search
- Semantic + keyword search
- Result preview (title + snippet)
- Keyboard navigation
- Recent searches
- Filter by type

**Props**:
```typescript
interface KnowledgeSearchBarProps {
  onSelect: (item: KnowledgeItem) => void;
  placeholder?: string;
  types?: KnowledgeType[];
  limit?: number;
}
```

---

### 3.3 Layout Components (Web-Specific)

**Priority: HIGH** (Required for consistent layout)

#### 3.3.1 PageHeader Component

**File**: `client/src/components/layout/page-header.tsx`

**Purpose**: Consistent page header with title + actions

**Features**:
- Page title
- Breadcrumbs (optional)
- Right-aligned action buttons
- Optional subtitle or description

**Props**:
```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}
```

---

#### 3.3.2 FilteredListLayout Component

**File**: `client/src/components/layout/filtered-list-layout.tsx`

**Purpose**: Layout with left filter panel + right table/grid

**Features**:
- Responsive (filter panel collapses on mobile)
- Sticky filter panel
- Scrollable main content
- Filter panel toggle button

**Props**:
```typescript
interface FilteredListLayoutProps {
  filterPanel: React.ReactNode;
  listContent: React.ReactNode;
  filterPanelWidth?: number; // Default 240px
  filterPanelCollapsible?: boolean;
}
```

---

#### 3.3.3 TabbedLayout Component

**File**: `client/src/components/layout/tabbed-layout.tsx`

**Purpose**: Page with tab navigation (Analytics, Settings, etc.)

**Features**:
- Horizontal tabs with active state
- Tab badges (counts)
- URL sync (tab in query param)
- Lazy load tab content
- Keyboard navigation

**Props**:
```typescript
interface TabbedLayoutProps {
  tabs: TabDefinition[];
  defaultTab?: string;
  onTabChange?: (tabId: string) => void;
}

type TabDefinition = {
  id: string;
  label: string;
  badge?: number;
  content: React.ReactNode;
};
```

---

## 4. COMPONENT ENHANCEMENT PLAN

### 4.1 Enhance Existing Components

#### 4.1.1 Table Component → DataTable

**Current**: [table.tsx](client/src/components/ui/table.tsx:1)

**Enhancements Needed**:
- Add sorting logic (use @tanstack/react-table)
- Add column resizing
- Add row selection with checkboxes
- Add sticky header positioning
- Add pagination integration
- Add density variants (comfortable/compact)
- Add bulk action bar
- Add loading skeleton rows
- Add empty state slot

**Implementation**:
```tsx
// Create new DataTable component wrapping existing Table
// client/src/components/ui/data-table.tsx

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './table';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';

export function DataTable<T>({ columns, data, ... }: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // ... more config
  });

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className={header.column.getCanSort() ? 'cursor-pointer' : ''}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {/* Add sort icon */}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {/* Add pagination controls */}
    </div>
  );
}
```

---

#### 4.1.2 Chart Component → Chart Library

**Current**: [chart.tsx](client/src/components/ui/chart.tsx:1)

**Enhancements Needed**:
- Add standard chart types (line, bar, donut, area, cohort, funnel)
- Add consistent color palette
- Add responsive container
- Add loading state
- Add empty state
- Add export to image
- Add tooltip formatting
- Add legend positioning options

**Implementation**:
```tsx
// Extend existing Chart component with specific chart types
// client/src/components/charts/line-chart.tsx

import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

export function LineChart({ data, xKey, yKeys, colors, ... }: LineChartProps) {
  if (loading) return <Skeleton className="h-[400px]" />;
  if (!data || data.length === 0) return <EmptyState icon={ChartIcon} message="No data to display" />;

  return (
    <ChartContainer config={{ /* theme config */ }}>
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} />
        <YAxis />
        <ChartTooltip />
        <Legend />
        {yKeys.map((key, index) => (
          <Line key={key} type="monotone" dataKey={key} stroke={colors[index]} />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  );
}
```

---

#### 4.1.3 Badge Component → StatusBadge

**Current**: [badge.tsx](client/src/components/ui/badge.tsx:1)

**Enhancements Needed**:
- Add semantic variants (success, warning, error, info, neutral)
- Add size variants (sm, md, lg)
- Add icon slot
- Add dot-only variant
- Add pill shape (full border radius)
- Add outline variant

**Implementation**: Extend existing Badge with new variants using `class-variance-authority`

---

#### 4.1.4 EmptyState Component → Enhanced

**Current**: [empty-state.tsx](client/src/components/ui/empty-state.tsx:1)

**Enhancements Needed**:
- Add variants (no-data, no-results, no-permission, error)
- Add action slot (primary + secondary buttons)
- Add size variants
- Add illustration/icon customization

---

### 4.2 Drawer vs Modal Usage Pattern

**Guideline**:
- **Drawer (Right slide-out)**: Detail views, forms, configuration (600px width)
  - Examples: Customer profile, Job detail, Agent config, Thread detail
- **Modal (Center overlay)**: Confirmations, alerts, short forms (400-800px width)
  - Examples: Delete confirmation, Quick create, Error messages

**Existing**: [drawer.tsx](client/src/components/ui/drawer.tsx:1) and [dialog.tsx](client/src/components/ui/dialog.tsx:1)

---

## 5. STATE MANAGEMENT PATTERNS

### 5.1 Data Fetching Pattern (TanStack Query)

**All data fetching uses React Query** (already implemented, see [queryClient.ts](client/src/lib/queryClient.ts:1))

**Pattern**:
```tsx
// In page component
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function CustomersPage() {
  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['/api/customers', filters],
    queryFn: () => fetchCustomers(filters),
    staleTime: 30000, // 30 seconds
  });

  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      toast.success('Customer created');
    },
  });

  // Render with loading/error states
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorState />;
  return <DataTable data={customers} ... />;
}
```

**Query Keys Convention**:
- API endpoint path: `['/api/customers']`
- With params: `['/api/customers', { status: 'active' }]`
- With ID: `['/api/customers', customerId]`
- Nested: `['/api/customers', customerId, 'timeline']`

---

### 5.2 Form State Pattern (React Hook Form)

**Use React Hook Form for all forms** (already installed, see package.json)

**Pattern**:
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Invalid email'),
});

type FormData = z.infer<typeof schema>;

export function CustomerForm({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

---

### 5.3 Filter State Pattern (URL Sync)

**Use URL search params for filters** (allows bookmarking/sharing filtered views)

**Pattern**:
```tsx
import { useLocation, useSearch } from 'wouter';

export function FilteredListPage() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);

  const filters = {
    status: searchParams.get('status') || 'all',
    dateRange: searchParams.get('dateRange') || '30d',
  };

  const updateFilter = (key: string, value: string) => {
    searchParams.set(key, value);
    setLocation(`${location.split('?')[0]}?${searchParams.toString()}`);
  };

  // Use filters in query
  const { data } = useQuery({
    queryKey: ['/api/items', filters],
    queryFn: () => fetchItems(filters),
  });

  return <FilterPanel filters={filters} onChange={updateFilter} />;
}
```

---

### 5.4 Drawer State Pattern (Context)

**Use existing DrawerContext** (see [drawer-context.tsx](client/src/lib/drawer-context.tsx:1))

**Pattern**:
```tsx
import { useDrawer } from '@/lib/drawer-context';

export function CustomerRow({ customer }) {
  const { openDrawer } = useDrawer();

  const handleClick = () => {
    openDrawer({
      component: <CustomerProfileDrawer customerId={customer.id} />,
      title: customer.name,
    });
  };

  return <TableRow onClick={handleClick}>...</TableRow>;
}
```

---

## 6. IMPLEMENTATION PHASES

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Web-specific component library + routing structure

**Tasks**:
1. Create DataTable component (with sorting, pagination, selection)
2. Create FilterPanel component
3. Create MetricCard component
4. Create enhanced Chart components (line, bar, donut)
5. Create PageHeader layout component
6. Create TabbedLayout component
7. Add analytics routes to App.tsx
8. Add customer segments route

**Deliverables**:
- New components in `client/src/components/ui/` and `client/src/components/charts/`
- New layout components in `client/src/components/layout/`
- Updated routing in `client/src/App.tsx`

---

### Phase 2: Command Center & Work Queue (Weeks 3-4)

**Goal**: Enhanced dashboard + work queue with new table

**Tasks**:
1. Enhance HomePage with MetricCard components
2. Replace InboxPage table with DataTable
3. Add FilterPanel to Work Queue
4. Implement bulk actions bar
5. Add SLA countdown timers
6. Enhance drawer detail views

**Deliverables**:
- Enhanced `client/src/pages/home.tsx`
- Enhanced `client/src/pages/inbox.tsx` or new `client/src/pages/work-queue.tsx`
- Enhanced `client/src/pages/approvals.tsx`

---

### Phase 3: Customer Intelligence (Week 5)

**Goal**: Customer segmentation + enhanced profiles

**Tasks**:
1. Create CustomerSegmentsPage with segment cards
2. Enhance CustomersPage with status badges + filters
3. Enhance CustomerProfileDrawer with health indicators
4. Add customer timeline with TimelineItem component
5. Add AI notes section

**Deliverables**:
- New `client/src/pages/customer-segments.tsx`
- Enhanced `client/src/pages/customers.tsx`
- Enhanced `client/src/pages/conversation-detail.tsx` (drawer)

---

### Phase 4: Analytics Dashboards (Weeks 6-7)

**Goal**: Full analytics module with charts

**Tasks**:
1. Create AnalyticsDashboardPage with tabs
2. Implement Profit tab (margin trend, crew chart, service donut, alerts table)
3. Implement Retention tab (cohort grid, churn trend, LTV distribution)
4. Implement Growth tab (revenue area chart, acquisition chart, funnel)
5. Implement Agent Performance tab (agent cards, performance table, timeline)
6. Add proposed analytics API endpoints (backend work)

**Deliverables**:
- New `client/src/pages/analytics-dashboard.tsx`
- Chart components in `client/src/components/charts/`
- Proposed backend endpoints documented

---

### Phase 5: Crews & Jobs Enhancement (Week 8)

**Goal**: Enhanced job management + crew performance

**Tasks**:
1. Enhance JobsPage with status tabs + new table
2. Enhance JobDetailDrawer with crew recommendations
3. Enhance CrewsPage with performance table
4. Enhance CrewDetailDrawer with margin trend chart
5. Add crew assignment simulation UI

**Deliverables**:
- Enhanced `client/src/pages/jobs.tsx`
- Enhanced `client/src/pages/crews.tsx`
- Enhanced drawer components

---

### Phase 6: Agent Studio Enhancement (Week 9)

**Goal**: Enhanced agent configuration + testing

**Tasks**:
1. Enhance AgentsPage with grouped cards by lifecycle
2. Enhance AgentDetailDrawer with config panel
3. Add test execution UI
4. Add recent runs timeline
5. Enhance EventsFeedPage with filters

**Deliverables**:
- Enhanced `client/src/pages/agents.tsx`
- Enhanced `client/src/pages/agent-detail.tsx` (drawer)
- Enhanced `client/src/pages/events-feed.tsx`

---

### Phase 7: Support & PSKB Polish (Week 10)

**Goal**: Refined support queue + knowledge management

**Tasks**:
1. Enhance SupportQueuePage with SLA indicators
2. Enhance ThreadDetailDrawer with AI enrichment + macros
3. Enhance KnowledgeListPage with status tabs
4. Enhance KnowledgeBuilderPage with live preview
5. Enhance KnowledgeApprovalsPage with diff view
6. Enhance CoverageGapsPage with trend chart

**Deliverables**:
- Enhanced support queue pages
- Enhanced knowledge pages
- Diff view modal component

---

### Phase 8: Settings & Polish (Week 11-12)

**Goal**: Settings hub + final polish

**Tasks**:
1. Enhance SettingsPage as hub with cards
2. Polish all settings detail pages
3. Add responsive variants (tablet breakpoints)
4. Add keyboard shortcuts (beyond existing Cmd+K)
5. Add empty/loading/error states to all pages
6. Accessibility audit (contrast, focus, ARIA)
7. Performance optimization (lazy load, code split)

**Deliverables**:
- Enhanced settings hub
- Responsive layouts
- Accessibility improvements
- Performance optimizations

---

## 7. TESTING STRATEGY

### 7.1 Unit Tests (Jest + React Testing Library)

**Test Coverage Goals**:
- All new components: 80% coverage
- Business logic functions: 90% coverage
- State management hooks: 90% coverage

**Example Test**:
```tsx
// client/src/components/ui/__tests__/data-table.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from '../data-table';

describe('DataTable', () => {
  const mockData = [
    { id: 1, name: 'John', status: 'active' },
    { id: 2, name: 'Jane', status: 'inactive' },
  ];

  const mockColumns = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'status', header: 'Status' },
  ];

  it('renders table with data', () => {
    render(<DataTable columns={mockColumns} data={mockData} />);
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', () => {
    const handleClick = jest.fn();
    render(<DataTable columns={mockColumns} data={mockData} onRowClick={handleClick} />);
    fireEvent.click(screen.getByText('John'));
    expect(handleClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('shows empty state when no data', () => {
    render(<DataTable columns={mockColumns} data={[]} emptyState={<div>No data</div>} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});
```

---

### 7.2 Integration Tests (Playwright)

**Test Key User Flows**:
- Login → Navigate to Customers → View profile drawer
- Create quote → Approve → View in Jobs
- Filter support queue → View thread → Send response
- Configure agent → Test execution → Save changes
- View analytics dashboard → Switch tabs → Drilldown to detail

**Example Test**:
```typescript
// tests/e2e/work-queue.spec.ts

import { test, expect } from '@playwright/test';

test('work queue filter and open detail', async ({ page }) => {
  await page.goto('http://localhost:5000/work');

  // Check page loaded
  await expect(page.locator('h1')).toContainText('Work Queue');

  // Apply filter
  await page.click('text=Urgent');
  await expect(page.locator('table tbody tr')).toHaveCount(3);

  // Open first row detail
  await page.click('table tbody tr:first-child');
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expect(page.locator('[role="dialog"] h2')).toContainText('Job');

  // Close drawer
  await page.click('[role="dialog"] button[aria-label="Close"]');
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
});
```

---

### 7.3 Visual Regression Tests (Percy or Chromatic)

**Snapshot Key Screens**:
- Home dashboard (all metric cards)
- Work queue (with filters applied)
- Customer list (with segments)
- Job detail drawer
- Analytics dashboard (all tabs)
- Agent config drawer
- Support queue (with SLA indicators)
- Knowledge base list
- Settings hub

---

## 8. DEPENDENCIES TO INSTALL

**New NPM Packages Needed**:

```json
{
  "dependencies": {
    "@tanstack/react-table": "^8.20.5",  // Enhanced tables
    "recharts": "^2.15.2",  // Already installed ✅
    "date-fns": "^3.6.0",  // Already installed ✅
    "lucide-react": "^0.453.0",  // Already installed ✅
    "class-variance-authority": "^0.7.1",  // Already installed ✅
    "clsx": "^2.1.1",  // Already installed ✅
    "tailwind-merge": "^2.6.0",  // Already installed ✅
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",  // Testing
    "@testing-library/user-event": "^14.0.0",  // Testing
    "@playwright/test": "^1.57.0",  // Already installed ✅
    "jest": "^30.2.0",  // Already installed ✅
    "ts-jest": "^29.4.6",  // Already installed ✅
  }
}
```

**All dependencies already installed!** ✅

---

## 9. CODEBASE ALIGNMENT

### 9.1 File Naming Conventions (Match Existing)

**Existing Pattern** (from codebase):
- Pages: `kebab-case.tsx` (e.g., `customer-segments.tsx`)
- Components: `kebab-case.tsx` (e.g., `data-table.tsx`)
- UI components: `client/src/components/ui/`
- Business components: `client/src/components/` (no subdirectory) or `client/src/components/business/`
- Hooks: `use-*.tsx` (e.g., `use-mobile.tsx`)

**Match this pattern** for all new files.

---

### 9.2 Import Path Conventions

**Use @ alias** (configured in `tsconfig.json`):
```tsx
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
```

---

### 9.3 Styling Conventions

**Use Tailwind classes** with `cn()` utility for conditional classes:
```tsx
import { cn } from '@/lib/utils';

<div className={cn(
  'p-4 rounded-lg',
  isActive && 'bg-primary text-white',
  isDisabled && 'opacity-50 pointer-events-none'
)} />
```

**CSS Variables** for theming (see existing pattern in `index.css`):
```css
:root {
  --primary: 142 76% 36%;
  --background: 0 0% 100%;
  --foreground: 210 12% 20%;
}
```

---

## 10. SUCCESS CRITERIA

### Definition of Done (Per Phase)

✅ **Component Checklist**:
- [ ] Component implemented with all variants
- [ ] TypeScript types defined
- [ ] Props documented (JSDoc)
- [ ] Accessibility tested (keyboard nav, ARIA, contrast)
- [ ] Responsive tested (desktop 1440px, 1920px, tablet 1024px)
- [ ] Unit tests written (80% coverage)
- [ ] Storybook story added (if applicable)
- [ ] Integrated into at least one page

✅ **Page Checklist**:
- [ ] Page component implemented
- [ ] Route added to App.tsx
- [ ] Data fetching with React Query
- [ ] Loading state (skeleton)
- [ ] Empty state
- [ ] Error state (with retry)
- [ ] RBAC checks (role-gated if needed)
- [ ] Responsive layout
- [ ] E2E test written

✅ **Integration Checklist**:
- [ ] Backend API endpoint verified (or proposed if new)
- [ ] API types match backend schema
- [ ] Error handling for API failures
- [ ] Optimistic updates where appropriate
- [ ] Cache invalidation on mutations

---

## 11. NEXT STEPS TO IMPLEMENT

**Immediate Actions** (Post-Design):

1. **Install Dependencies** ✅ (All already installed)
2. **Create Component Library** (Phase 1):
   - Start with DataTable (most critical)
   - Then FilterPanel
   - Then MetricCard
   - Then Chart library
3. **Enhance Existing Pages** (Phases 2-7):
   - Prioritize high-value screens (Dashboard, Work Queue, Analytics)
   - Use feature flags for gradual rollout
4. **Build New Pages** (Phases 3-4):
   - Customer Segments
   - Analytics Dashboard
5. **Testing & Polish** (Phase 8):
   - Write tests as you go
   - Final accessibility audit
   - Performance optimization

---

## 12. TEAM STRUCTURE RECOMMENDATION

**For 12-Week Timeline**:

**Frontend Team** (2-3 engineers):
- Engineer 1: Component library + layout (Phases 1, 8)
- Engineer 2: Command center + customers (Phases 2, 3)
- Engineer 3: Analytics + agents + support (Phases 4, 6, 7)

**Backend Team** (1 engineer):
- Analytics aggregation endpoints (Phase 4)
- Customer segmentation endpoint (Phase 3)
- Any missing API endpoints identified

**QA Engineer** (1):
- Write E2E tests during implementation
- Accessibility testing
- Cross-browser testing
- Performance testing

---

**Document Status**: ✅ Complete
**Total New Components**: ~20
**Total Enhanced Components**: ~15
**Total New Pages**: 2 (Analytics, Customer Segments)
**Total Enhanced Pages**: ~20
**Estimated Timeline**: 12 weeks (3 engineers)
**Last Updated**: January 12, 2026
**Maintained By**: Engineering Team
