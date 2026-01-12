# LawnFlow Web UI - Figma Make Prompts

**Purpose**: Ordered sequence of Figma Make prompts to build complete web application design.

**Date**: January 12, 2026
**Target**: Figma Make AI tool
**Source**: [LAWNFLOW_WEB_UI_FIGMA_SPEC.md](LAWNFLOW_WEB_UI_FIGMA_SPEC.md)

---

## EXECUTION INSTRUCTIONS

1. Execute prompts **in order** (dependencies exist between prompts)
2. Each prompt creates a **new Figma page** (or frame group)
3. Use **consistent naming** as specified
4. Reference **design tokens** from Prompt 1 throughout
5. Validate **component reuse** (avoid duplicates)

---

## PROMPT 1: DESIGN SYSTEM & TOKENS

**Page Name**: "Design System"
**Purpose**: Create foundational design tokens and core components

**Prompt**:

```
Create a comprehensive design system for a lawn care operations web app called LawnFlow.

DESIGN TOKENS:
Create a "Tokens" frame containing:

1. Color Palette (create color swatches):
   - Primary: hsl(142, 76%, 36%) - green
   - Success: hsl(142, 76%, 36%) - same as primary
   - Destructive: hsl(0, 84%, 60%) - red
   - Warning: hsl(38, 92%, 50%) - amber
   - Info: hsl(214, 84%, 56%) - blue
   - Neutral scale: 0 (white) through 900 (black) with 10 steps
   - Label each swatch with variable name (e.g., "--primary-500")

2. Typography Scale:
   - Font: Inter (system fallback)
   - Create text styles for:
     - Display Large: 32px/40px, 700 weight
     - Display Medium: 28px/36px, 700 weight
     - Heading XL: 24px/32px, 600 weight
     - Heading Large: 20px/28px, 600 weight
     - Heading Medium: 18px/26px, 600 weight
     - Heading Small: 16px/24px, 600 weight
     - Body Large: 16px/24px, 400 weight
     - Body Medium: 14px/20px, 400 weight
     - Body Small: 13px/18px, 400 weight
     - Label Large: 14px/20px, 500 weight
     - Label Medium: 13px/18px, 500 weight
     - Label Small: 12px/16px, 500 weight
     - Caption Large: 12px/16px, 400 weight
     - Caption Medium: 11px/14px, 400 weight
   - Show each style with example text

3. Spacing Scale (8pt grid):
   - Create boxes showing: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px, 80px
   - Label each with variable name (--space-1 through --space-20)

4. Border Radius:
   - Show rounded rectangles: 4px, 6px, 8px, 12px, 16px, full circle
   - Label: --radius-sm through --radius-full

5. Shadow Levels:
   - Show 4 cards with increasing shadow: sm, md, lg, xl
   - Use subtle gray shadows

CORE COMPONENTS:
Create components in a "Components" frame:

1. Button Component (create variants):
   - Variants: Primary, Secondary, Destructive, Text
   - Sizes: Small (32px h), Medium (40px h), Large (48px h)
   - States: Default, Hover, Pressed, Disabled, Loading
   - Use primary green for Primary variant
   - Show icon + label option

2. Input Component:
   - Variants: Default, Error, Disabled, Focused
   - Height: 40px
   - Border: 1px, radius 6px
   - Label above, helper text below
   - Show error state with red border + warning icon

3. Badge Component (status pills):
   - Variants: Success, Warning, Error, Info, Neutral
   - Size: 24px height, auto width
   - Border radius: 12px (pill shape)
   - Show with text label

4. Card Component:
   - White background with subtle border
   - Border radius: 8px
   - Padding: 16px or 24px variants
   - Optional header section
   - Shadow: sm level

5. Status Indicator (dot):
   - Variants: Success (green), Warning (amber), Error (red), Neutral (gray)
   - Size: 8px circle
   - Show with and without label

Make this system clean, professional, and data-dense. Use the green primary color sparingly for emphasis. Maintain high contrast for accessibility.
```

---

## PROMPT 2: NAVIGATION SHELL

**Page Name**: "Navigation Shell"
**Purpose**: Create persistent layout structure (sidebar + topbar + main area)

**Prompt**:

```
Using the LawnFlow design system from the previous page, create the navigation shell for a desktop web application (1440px width).

LAYOUT STRUCTURE:
Create a frame called "App Shell - Desktop" with these sections:

1. LEFT SIDEBAR (240px width, fixed):
   - Background: slightly elevated from main (neutral-50 in light mode)
   - Header section (64px height):
     - Logo: "LawnFlow" text with leaf icon
     - Collapse button (hamburger icon)
   - Navigation sections (vertical stack):
     - Section: "Home & Work"
       - Home (house icon)
       - Work Queue (clipboard icon, badge showing "3")
       - Approvals (checkmark icon)
     - Divider line
     - Section: "Operations"
       - Customers (users icon)
       - Jobs (hammer icon)
       - Quotes (document icon)
       - Schedule (calendar icon)
       - Crews (hard hat icon)
     - Divider line
     - Section: "Finance"
       - Billing (credit card icon)
     - Divider line
     - Section: "Support"
       - Support Queue (message icon, badge "2")
       - Knowledge Base (book icon)
       - Coverage Gaps (chart icon)
     - Divider line
     - Section: "Management" (grayed out for STAFF role)
       - Agents (robot icon)
       - Settings (gear icon)
     - Divider line
     - Section: "Insights"
       - Analytics (trending up icon)
   - Footer section (64px height):
     - User avatar (32px circle)
     - User name "John Smith"
     - Role badge "Owner"

2. TOP BAR (remaining width, 56px height, sticky):
   - Left: Sidebar toggle + Page title "Dashboard"
   - Center: Global search bar (400px width) with Cmd+K hint
   - Right:
     - "+ New" dropdown button
     - Notification bell (badge "5")
     - Theme toggle (sun/moon icon)
     - User menu dropdown

3. MAIN CONTENT AREA:
   - Background: neutral-0 (white) or neutral-900 (dark)
   - Padding: 24px all sides
   - Max width: 1440px, centered

NAVIGATION STYLING:
- Active item: Bold text + 4px left green border + green text color
- Hover: Light gray background
- Icons: 20px size, left-aligned
- Labels: Body medium text
- Badge: Small red circle with count (for notifications)
- Section headers: Caption text, uppercase, gray

RESPONSIVE BEHAVIOR:
Also create "App Shell - Collapsed Sidebar" variant (64px sidebar width, icon-only).

Use the design system tokens. Make it feel professional, clean, and efficient.
```

---

## PROMPT 3: COMMAND CENTER (HOME DASHBOARD)

**Page Name**: "Command Center"
**Purpose**: Dashboard overview with metrics and action cards

**Prompt**:

```
Using the LawnFlow navigation shell, create the Home Dashboard page.

PAGE LAYOUT (inside main content area):
Create a frame called "Dashboard - Home" with:

1. PAGE HEADER:
   - Title: "Home" (Heading XL)
   - Date range dropdown: "Last 30 days" (top right)

2. METRIC CARDS ROW (3 columns):
   Card 1 - Revenue:
   - Large number: "$42,350" (Display Medium)
   - Label: "Revenue" (Caption, gray)
   - Change indicator: "+12% vs last month" (green, with up arrow)
   - Icon: Dollar sign (24px, top right, light green background circle)
   - Size: 320px × 160px
   - Background: white card with border
   - Clickable (show hover state)

   Card 2 - Active Jobs:
   - Large number: "23" (Display Medium)
   - Label: "Active Jobs" (Caption, gray)
   - Change: "+5 this week" (green)
   - Icon: Hammer (24px, light green circle)

   Card 3 - Pending Actions:
   - Large number: "8" (Display Medium)
   - Label: "Pending Actions" (Caption, gray)
   - Urgency indicators:
     - Red dot + "3 urgent"
     - Amber dot + "2 soon"
     - Green dot + "3 normal"
   - Icon: Alert triangle (24px, amber circle)

3. SECOND METRIC ROW (3 columns):
   Card 4 - Avg Margin:
   - Large number: "38%" (Display Medium)
   - Label: "Avg Margin" (Caption, gray)
   - Alert: Amber badge "2 alerts"
   - Icon: Trending up (24px, green circle)

   Card 5 - Pending Quotes:
   - Large number: "12" (Display Medium)
   - Label: "Pending Quotes" (Caption, gray)
   - Value: "$8,450 total value" (Body small, gray)
   - Icon: Document (24px, blue circle)

   Card 6 - Pending Actions Detail (double height):
   - Header: "Pending Actions" + "View All" link
   - List of 3 items:
     Item 1: Red dot + "Quote approval - Smith lawn" + "2m ago"
     Item 2: Amber dot + "Crew assignment - Job #123" + "15m ago"
     Item 3: Green dot + "Payment retry - Jones" + "1h ago"
   - Each item clickable with hover state
   - Size: 320px × 320px

4. ALERTS SECTION (full width):
   Profit Protection Alert Banner:
   - Background: Light amber (warning-50)
   - Left border: 4px amber
   - Icon: Warning triangle (20px)
   - Text: "Job #789: Margin burn detected (-$45 vs expected)"
   - Action: "View Details" link
   - Dismissible: X button right

5. ACTIVITY FEED (full width, 640px):
   - Header: "Latest Activity" + filter dropdown "All"
   - Timeline with 5 events:
     Event 1: Green checkmark + "Job #123 completed" + "2 min ago"
     Event 2: Blue info + "Quote #456 approved" + "15 min ago"
     Event 3: Amber warning + "Payment failed - retry scheduled" + "1h ago"
     Event 4: Green + "New customer - Sarah Jones" + "2h ago"
     Event 5: Blue + "Quote sent - Mike Brown" + "3h ago"
   - Timeline connector: 2px gray vertical line
   - "Load more" button at bottom

Use proper spacing (24px between sections, 16px between cards), shadows on cards, and make everything feel actionable with hover states.
```

---

## PROMPT 4: WORK QUEUE & INBOX

**Page Name**: "Work Queue"
**Purpose**: Task-based view with filters and data table

**Prompt**:

```
Using the LawnFlow navigation shell, create the Work Queue page.

PAGE LAYOUT:
Create a frame called "Work Queue" with:

1. LEFT FILTER PANEL (240px width):
   - Background: Card (slightly elevated)
   - Header: "Filters" (Label Large) + count "(8)"
   - Sections:
     Status (SLA urgency):
     - Checkbox "Urgent" (checked)
     - Checkbox "Soon" (checked)
     - Checkbox "Normal" (unchecked)

     Type:
     - Checkbox "Quote" (unchecked)
     - Checkbox "Job" (unchecked)
     - Checkbox "Approval" (unchecked)
     - Checkbox "Payment" (unchecked)

     Assigned to:
     - Radio "Me" (selected)
     - Radio "My Team"
     - Radio "Unassigned"
     - Radio "All"
   - Bottom: "Clear Filters" button (secondary)
   - Top: "Saved Views" dropdown showing "My Urgent Items"

2. MAIN TABLE AREA:
   - Toolbar (above table):
     - Left: "Work Queue (8)" title
     - Right: Search input (300px) + kebab menu (bulk actions)

   - Data Table:
     Columns (with sample data):
     1. Checkbox (40px) - Select all checkbox in header
     2. SLA (60px) - Red dot + countdown "28m left"
     3. Type (100px) - Badge "Quote" (blue)
     4. Title (300px) - "Smith lawn mowing service"
     5. Customer (160px) - "John Smith" (clickable link)
     6. Assigned (120px) - Small avatar + "Jane Doe"
     7. Date (140px) - "2m ago" (with absolute time tooltip hint)
     8. Actions (60px) - Kebab menu (3 dots)

     Rows (show 5 sample rows):
     Row 1: Red SLA dot, "Quote" badge, "Smith lawn", "John Smith", avatar + name, "2m ago"
     Row 2: Amber SLA dot, "Approval" badge, "$500+ quote needs approval", "Sarah Jones", "Unassigned" (gray), "15m ago"
     Row 3: Green SLA dot, "Job" badge, "Crew assignment needed", "Mike Brown", avatar + name, "1h ago"
     Row 4: Green SLA dot, "Payment" badge, "Payment retry scheduled", "Jane Doe", avatar + name, "2h ago"
     Row 5: Amber SLA dot, "Job" badge, "Schedule service", "Bob Wilson", "Unassigned", "3h ago"

     Table styling:
     - Header row: Bold labels, sortable (show sort icon on "Date" column)
     - Row height: 48px (comfortable mode)
     - Hover: Row background lightens
     - Striped: Alternating row backgrounds
     - Borders: Subtle gray borders between rows

   - Pagination (bottom):
     - "Showing 1-5 of 8"
     - Page buttons: [<] [1] [2] [>]
     - Pagination centered

3. ROW INTERACTION STATES:
   - Default: White background
   - Hover: Light gray background, cursor pointer
   - Selected: Light green background (primary-50)

Use proper table spacing, sortable column headers with icons, and make the SLA indicators prominent (red/amber/green dots, 8px size).
```

---

## PROMPT 5: CUSTOMERS MODULE

**Page Name**: "Customers"
**Purpose**: Customer list table + profile drawer

**Prompt**:

```
Using the LawnFlow navigation shell, create the Customers page with detail drawer.

MAIN PAGE - CUSTOMER LIST:
Create a frame called "Customers List" with:

1. PAGE HEADER:
   - Title: "Customers (147)" (Heading XL)
   - Right side:
     - Search input (300px) with search icon
     - Segment dropdown: "All Customers"
     - Export button (secondary)

2. CUSTOMER TABLE:
   Columns:
   1. Checkbox (40px)
   2. Customer (240px) - Avatar (32px) + Name + Phone below (gray, small)
   3. Status (120px) - Badge ("Active" green, "At-Risk" amber, "Dormant" gray, "New" blue)
   4. LTV (100px) - "$1,240" (right-aligned, currency format)
   5. Last Contact (140px) - "2 days ago"
   6. Jobs (80px) - Count badge "12"
   7. Satisfaction (100px) - 5 gold stars
   8. Actions (60px) - Kebab menu

   Sample rows (show 5):
   Row 1: Avatar "JS", "John Smith", "(555) 123-4567", "Active" green badge, "$1,240", "2 days ago", "12 jobs", 5 stars
   Row 2: Avatar "SJ", "Sarah Jones", "(555) 234-5678", "At-Risk" amber badge, "$890", "14 days ago", "8 jobs", 4 stars
   Row 3: Avatar "MB", "Mike Brown", "(555) 345-6789", "Dormant" gray badge, "$450", "3 months ago", "3 jobs", 4 stars
   Row 4: Avatar "JD", "Jane Doe", "(555) 456-7890", "New" blue badge, "$0", "Today", "0 jobs", No rating
   Row 5: Avatar "BW", "Bob Wilson", "(555) 567-8901", "Active" green badge, "$2,100", "5 days ago", "18 jobs", 5 stars

DETAIL DRAWER (RIGHT SIDE, 600px width):
Create a frame called "Customer Profile Drawer":

1. DRAWER HEADER:
   - Close X button (top right)
   - Large avatar (48px) "JS"
   - Customer name "John Smith" (Heading Large)
   - Status badge "Active" (green)

2. DRAWER BODY (scrollable content):
   Card 1 - Contact Info:
   - Icon + text rows:
     - Phone icon + "(555) 123-4567"
     - Email icon + "john@example.com"
     - Location icon + "123 Main St, Austin, TX 78701"

   Card 2 - Customer Health:
   - Grid layout (2 columns):
     - "Status: ● Active" + "LTV: $1,240"
     - "Satisfaction: ⭐⭐⭐⭐⭐" (5 gold stars)
     - "Churn Risk: 12% (Low)" with green badge

   Card 3 - Services & Billing:
   - List:
     - "• Mowing (Bi-weekly) - $85/visit"
     - "• Fertilization (Quarterly) - $150/service"
   - Payment info: "Autopay enabled (Card ****1234)"

   Card 4 - Interaction Timeline:
   - Header: "Interaction Timeline" + filter dropdown "All"
   - Timeline (show 4 events):
     Event 1: Circle + line + "2 days ago: Job completed (#789)"
     Event 2: Circle + line + "3 days ago: Payment received ($85)"
     Event 3: Circle + line + "1 week ago: SMS sent (reminder)"
     Event 4: Circle + line + "2 weeks ago: Quote approved (#456)"
   - "Load more" link

   Card 5 - AI-Generated Notes:
   - Light blue background
   - Robot icon
   - Bullet list:
     - "• Prefers morning service (8-10am)"
     - "• Has large oak tree (shade considerations)"
     - "• Always pays on time"

3. DRAWER FOOTER (sticky bottom):
   - Three buttons: "Send Message" (primary), "Add Manual Note" (secondary), "View Jobs" (text)

Use cards with borders, proper spacing (16px between cards), and make the drawer feel like it slides in from the right.
```

---

## PROMPT 6: JOBS & CREWS MODULE

**Page Name**: "Jobs & Crews"
**Purpose**: Job tracking table + crew assignment interface

**Prompt**:

```
Using the LawnFlow navigation shell, create the Jobs page.

JOBS LIST PAGE:
Create a frame called "Jobs List" with:

1. PAGE HEADER:
   - Title: "Jobs (34)" (Heading XL)
   - Right: Search input + "+ New Job" button (primary)

2. STATUS TABS (horizontal):
   - Tabs: "All", "New (3)", "Assigned", "In Progress", "Completed", "Paid"
   - Active tab: "All" with green underline (2px) and bold text
   - Badge counts next to labels

3. JOBS TABLE:
   Columns:
   1. Checkbox (40px)
   2. Job ID (80px) - "#123" (monospace font)
   3. Customer (180px) - "John Smith" (clickable)
   4. Service (140px) - "Mowing"
   5. Crew (120px) - "Crew A" or "Unassigned" (gray)
   6. Scheduled (120px) - "Today, 9:00 AM"
   7. Status (100px) - Badge (blue/amber/green/gray)
   8. Amount (100px) - "$85.00" (right-aligned)
   9. Actions (60px) - Kebab menu

   Sample rows (show 4):
   Row 1: "#123", "John Smith", "Mowing", "Crew A", "Today, 9:00 AM", "In Progress" green badge, "$85.00"
   Row 2: "#124", "Sarah Jones", "Aeration", "Unassigned" gray, "Tomorrow, 10:00 AM", "New" blue badge, "$150.00"
   Row 3: "#125", "Mike Brown", "Fertilization", "Crew B", "Today, 2:00 PM", "Assigned" amber badge, "$120.00"
   Row 4: "#126", "Jane Doe", "Mowing + Edging", "Crew A", "Yesterday", "Completed" green badge, "$95.00"

JOB DETAIL DRAWER (RIGHT SIDE, 600px):
Create a frame called "Job Detail Drawer":

1. HEADER:
   - "Job #123 - Mowing" (Heading Large)
   - Close X button

2. CARDS:
   Customer Card:
   - "Customer: John Smith"
   - Location icon + "123 Main St, Austin, TX"
   - Phone icon + "(555) 123-4567"

   Job Details Card:
   - "Service: Mowing + Edging"
   - "Scheduled: Today, 9:00 AM"
   - "Duration: 1.5 hours (estimated)"
   - "Amount: $85.00"

   Crew Assignment Card:
   - "Crew Assignment"
   - Dropdown: "Select Crew"
   - Recommendation list (2 items):
     Item 1: Checkmark + "Crew A (Recommended)"
       "Travel: 8 min | Score: 92/100"
       Green progress bar (92%)
     Item 2: "Crew B"
       "Travel: 15 min | Score: 78/100"
       Amber progress bar (78%)

   Timeline Card:
   - Circle + line + "Created: 2 hours ago (AI Agent)"
   - Circle + line + "Quote approved: 1 hour ago"
   - Circle + line + "Assigned to Crew A: 30 min ago"

3. FOOTER:
   - "Assign Crew" (primary), "Edit" (secondary), "Cancel Job" (destructive text)

CREWS GRID (separate screen):
Create a frame called "Crews Overview" with:
- Grid of 4 crew cards (200px × 160px each):
  Crew A Card:
  - Header: "Crew A" + avatar
  - Status: Green dot + "Available"
  - Rating: 4.8 stars (gold)
  - Jobs: "12 jobs/week" (badge)
  - Clickable with hover state

Below grid, performance table:
- Columns: Crew, Jobs, Avg Margin, Avg Time, Quality, On-Time %
- Sample data for 4 crews

Use status dots prominently, score bars with colors, and make crew recommendations clear.
```

---

## PROMPT 7: ANALYTICS DASHBOARDS

**Page Name**: "Analytics"
**Purpose**: Data visualization for profit, retention, growth

**Prompt**:

```
Using the LawnFlow navigation shell, create the Analytics page with multiple tabs.

ANALYTICS PAGE LAYOUT:
Create a frame called "Analytics - Profit Tab" with:

1. PAGE HEADER:
   - Title: "Analytics" (Heading XL)
   - Date range dropdown: "Last 30 days" (top right)

2. TAB NAVIGATION:
   - Tabs: "Profit", "Retention", "Growth", "Agent Performance"
   - Active: "Profit" with green underline

3. PROFIT TAB CONTENT (2-column grid):

   Chart 1 - Margin Trend (Full width, 400px height):
   - Title: "Margin Trend" (Heading Small)
   - Line chart:
     - X-axis: Date labels (last 30 days, show every 5 days)
     - Y-axis: Percentage (0% to 50%)
     - Green line showing margin trend (wavy line starting at 40%, dipping to 32%, rising to 42%)
     - Dashed gray line at 38% (target line, labeled "Target")
     - Hover state: Show tooltip with date + exact margin %
   - Card background with border

   Chart 2 - Margin by Crew (Half width, 300px height):
   - Title: "Margin by Crew"
   - Vertical bar chart:
     - X-axis: Crew A, Crew B, Crew C, Crew D
     - Y-axis: Percentage (0% to 50%)
     - Bars colored by performance:
       Crew A: 42% (green bar)
       Crew B: 38% (green bar)
       Crew C: 28% (amber bar)
       Crew D: 35% (green bar)
     - Hover: Show exact percentage

   Chart 3 - Margin by Service (Half width, 300px height):
   - Title: "Margin by Service Type"
   - Donut chart:
     - Segments: Mowing (40%), Aeration (25%), Fertilization (20%), Other (15%)
     - Center label: "38%" (overall avg margin)
     - Legend on right side with colors
     - Use green shades for segments

   Table - Profit Protection Alerts (Full width):
   - Title: "Profit Protection Alerts"
   - Columns: Job ID, Customer, Crew, Expected Margin, Actual Margin, Variance
   - Sample rows (3):
     Row 1: "#789", "John Smith", "Crew B", "40%", "28%", "-12%" (red background row)
     Row 2: "#790", "Sarah Jones", "Crew C", "38%", "32%", "-6%" (light red)
     Row 3: "#791", "Mike Brown", "Crew A", "42%", "39%", "-3%" (normal)

RETENTION TAB (create separate frame "Analytics - Retention Tab"):

   Chart 1 - Cohort Grid (Full width, 500px height):
   - Title: "Customer Retention by Cohort"
   - Grid layout:
     - Rows: Jan 2025, Feb 2025, Mar 2025, Apr 2025 (signup months)
     - Columns: M0, M1, M2, M3, M4, M5 (months since signup)
     - Cells: Heatmap colors (dark green = 100%, light green = 75%, yellow = 50%, red = 25%)
     - Sample data:
       Jan 2025: 100%, 85%, 78%, 72%, 68%, 65%
       Feb 2025: 100%, 88%, 82%, 76%, 71%
       Mar 2025: 100%, 90%, 85%, 80%
       Apr 2025: 100%, 92%, 87%

   Chart 2 - Churn Rate (Half width, 300px height):
   - Title: "Churn Rate Trend"
   - Line chart:
     - X-axis: Last 6 months
     - Y-axis: Percentage (0% to 10%)
     - Red line showing churn (wavy, averaging around 5%)
     - Dashed gray line at 5% (industry avg)

   Chart 3 - LTV Distribution (Half width, 300px height):
   - Title: "Customer LTV Distribution"
   - Horizontal bar chart:
     - Y-axis: $0-500, $500-1000, $1000-1500, $1500+ (LTV buckets)
     - X-axis: Customer count (0 to 60)
     - Bars in shades of green (darker = higher LTV)
     - Sample: 45, 52, 38, 12 customers

Use chart containers with white card backgrounds, subtle borders, 24px padding, and consistent styling. Make charts interactive-looking with hover states.
```

---

## PROMPT 8: AGENT MANAGEMENT STUDIO

**Page Name**: "Agent Studio"
**Purpose**: Agent catalog, configuration, and testing interface

**Prompt**:

```
Using the LawnFlow navigation shell, create the Agents page.

AGENTS LIST PAGE:
Create a frame called "Agents List" with:

1. PAGE HEADER:
   - Title: "Agents" (Heading XL)
   - Right: "+ New Agent" button (primary, grayed out)

2. AGENT GROUPS (vertical sections):

   Section 1 - Lead-to-Cash Agents:
   - Header: "Lead-to-Cash Agents (3)"
   - Grid of 3 cards (200px × 160px each):

     Card 1 - Inbound Orchestrator:
     - Name: "Inbound Orchestrator" (Label Large)
     - Status: Green dot + "Enabled"
     - Metric: "94% success rate" (badge)
     - Last run: "2 min ago" (Caption, gray)
     - Robot icon (32px, top right, light green circle)

     Card 2 - Quote Generator:
     - Name: "Quote Generator"
     - Status: Green dot + "Enabled"
     - Metric: "97% success rate"
     - Last run: "15 min ago"

     Card 3 - Job Scheduler:
     - Name: "Job Scheduler"
     - Status: Green dot + "Enabled"
     - Metric: "92% success rate"
     - Last run: "1h ago"

   Section 2 - Operations Agents:
   - Header: "Operations Agents (2)"
   - 2 cards: "Crew Intelligence", "Route Cost Analyzer"

   Section 3 - Billing & Payment Agents:
   - Header: "Billing & Payment Agents (2)"
   - Card 1: "Payment Orchestrator" (green dot, Enabled)
   - Card 2: "Autopay Enrollment" (gray dot, Disabled)

   Section 4 - Post-Job Agents:
   - Header: "Post-Job Agents (1)"
   - Card: "Post-Job QA" (green dot, Enabled)

AGENT DETAIL DRAWER (600px width):
Create a frame called "Agent Detail Drawer - Quote Generator":

1. HEADER:
   - Title: "Quote Generator Agent" (Heading Large)
   - Close X

2. CONFIGURATION CARD:
   - "Configuration" header
   - Toggle switch: "Status: [●] Enabled [ ] Disabled"
   - Slider: "Confidence Threshold: 70%" (with slider track showing position)
   - Checkbox: "[×] Auto-approve quotes"
   - Input: "Max quote value: $500"

3. PERFORMANCE CARD:
   - "Performance (Last 30 Days)" header
   - Metrics (grid):
     - "Total Runs: 147"
     - "Success Rate: 97%"
     - "Avg Latency: 1.8s"
     - "Avg Cost: $0.03 per run"

4. TEST AGENT CARD:
   - "Test Agent" header
   - Label: "Sample Input:"
   - Textarea: (placeholder: "Enter customer request...")
   - Button: "Run Test" (primary)
   - Result section (gray background):
     - "Test Result:"
     - JSON output: {"quote_amount": 125, "confidence": 94%}
     - Success checkmark icon

5. RECENT RUNS CARD:
   - "Recent Runs (5)" header
   - List:
     - Green checkmark + "2 min ago - Quote #456 ($125)"
     - Green checkmark + "15 min ago - Quote #455 ($200)"
     - Red X + "1 hour ago - Failed (invalid address)"
     - Green checkmark + "2 hours ago - Quote #453 ($95)"
     - Green checkmark + "3 hours ago - Quote #452 ($180)"
   - "View All Runs" link

3. FOOTER:
   - Buttons: "Save Changes" (primary), "View Logs" (secondary), "Disable Agent" (destructive text)

Use robot icons for agent cards, green/gray status dots, and make configuration controls interactive-looking.
```

---

## PROMPT 9: SUPPORT QUEUE & KNOWLEDGE BASE

**Page Name**: "Support & PSKB"
**Purpose**: Support queue table + knowledge base management

**Prompt**:

```
Using the LawnFlow navigation shell, create the Support Queue page.

SUPPORT QUEUE PAGE:
Create a frame called "Support Queue" with:

1. PAGE HEADER:
   - Title: "Support Queue (12)" (Heading XL)
   - Filters: Priority dropdown + Coverage dropdown

2. SUPPORT TABLE:
   Columns:
   1. SLA (40px) - Colored dot + countdown timer
   2. Priority (100px) - Badge (Urgent/High/Normal/Low)
   3. Customer (180px) - Name + phone
   4. Intent (120px) - Auto-classified (Billing, Scheduling, etc.)
   5. Coverage (120px) - Status indicator (✅ Covered, ⚠️ Partial, ❌ None)
   6. Sentiment (80px) - Emoji (😊 positive, 😐 neutral, 😞 negative)
   7. Age (80px) - Time since thread started
   8. Actions (60px) - Kebab menu

   Sample rows (show 3):
   Row 1: Red dot "28m left", "Urgent" red badge, "John Smith (555) 123-4567", "Billing", "✅ Covered", "😞 Negative", "2h", kebab
   Row 2: Amber dot "45m left", "High" amber badge, "Sarah Jones (555) 234-5678", "Rescheduling", "⚠️ Partial", "😐 Neutral", "30m", kebab
   Row 3: Green dot "3h left", "Normal" green badge, "Mike Brown (555) 345-6789", "General", "❌ None", "😊 Positive", "5m", kebab

THREAD DETAIL DRAWER (600px width):
Create a frame called "Thread Detail Drawer":

1. HEADER:
   - "Thread #789 - John Smith"
   - Close X

2. AI ENRICHMENT CARD (light blue background):
   - Robot icon
   - "AI Enrichment"
   - Grid:
     - "Intent: Billing Question (92% confidence)"
     - "Priority: Urgent"
     - "Sentiment: Negative 😞"
     - "Coverage: ✅ Covered by KB-12v3"

3. SUGGESTED MACROS CARD:
   - "Suggested Macros (2)"
   - Macro 1:
     - Document icon + "Autopay Policy (KB-12v3)"
     - "Insert" button (secondary, small)
   - Macro 2:
     - Document icon + "Payment Failed FAQ (KB-14v1)"
     - "Insert" button

4. CONVERSATION CARD:
   - "Conversation"
   - Message bubbles:
     Bubble 1 (left, customer):
     - "2h ago"
     - "Why was my card charged twice?"
     - Gray background

     Bubble 2 (right, AI):
     - "1h 58m ago"
     - "Let me check your account..."
     - Light blue background
     - Badge: "Awaiting staff approval"

5. RESPONSE COMPOSER:
   - "Your Response" label
   - Large textarea (150px height)
   - Buttons below: "Attach Knowledge" (icon button), "Insert Macro" (icon button)

6. FOOTER:
   - Buttons: "Send & Resolve" (primary), "Send" (secondary), "Escalate" (text)

KNOWLEDGE BASE LIST (separate screen):
Create a frame called "Knowledge Base List":

1. PAGE HEADER:
   - Title: "Knowledge Base (47)"
   - Search + "+ New Knowledge" button

2. STATUS TABS:
   - "All", "Published", "Review Pending", "Draft"
   - Active: "All"

3. KNOWLEDGE TABLE:
   Columns:
   1. ID (80px) - "KB-12" (monospace)
   2. Title (300px) - "Autopay Policy"
   3. Type (100px) - Badge (Policy/Service/Payment/etc.)
   4. Status (100px) - Badge (Published/Review/Draft)
   5. Version (60px) - "v3"
   6. Updated (120px) - "2w ago"
   7. Author (120px) - "Jane Doe"
   8. Actions (60px) - Kebab

   Sample rows (show 3):
   Row 1: "KB-12", "Autopay Policy", "Policy" green badge, "Published" green badge, "v3", "2w ago", "Jane Doe"
   Row 2: "KB-14", "Payment Failed FAQ", "Payment" blue badge, "Published" green badge, "v1", "1w ago", "John Smith"
   Row 3: "KB-23", "Refund Process", "Policy" green badge, "Review" amber badge, "v2", "2d ago", "Sarah Jones"

Use SLA urgency colors prominently (red/amber/green dots), sentiment emojis, and coverage checkmarks/warnings/X marks clearly.
```

---

## PROMPT 10: SETTINGS HUB

**Page Name**: "Settings"
**Purpose**: Settings landing page with category cards

**Prompt**:

```
Using the LawnFlow navigation shell, create the Settings Hub landing page.

SETTINGS HUB PAGE:
Create a frame called "Settings Hub" with:

1. PAGE HEADER:
   - Title: "Settings" (Heading XL)
   - Subtitle: "Configure your LawnFlow workspace" (Body Medium, gray)

2. SETTINGS GRID (3 columns × 4 rows):

   Row 1:
   Card 1 - Agents:
   - Icon: Robot emoji 🤖 (48px, centered top)
   - Title: "Agents" (Heading Small)
   - Description: "Configure AI agents" (Body Small, gray)
   - Size: 240px × 160px
   - Background: White card with border
   - Hover: Shadow + slight scale

   Card 2 - Policies:
   - Icon: Clipboard emoji 📋 (48px)
   - Title: "Policies"
   - Description: "Business policies"

   Card 3 - Pricing:
   - Icon: Money bag emoji 💰 (48px)
   - Title: "Pricing"
   - Description: "Rules & margins"

   Row 2:
   Card 4 - Services:
   - Icon: Wrench emoji 🛠️ (48px)
   - Title: "Services"
   - Description: "Offerings management"

   Card 5 - Users:
   - Icon: People emoji 👥 (48px)
   - Title: "Users"
   - Description: "Staff & permissions"

   Card 6 - Integrations:
   - Icon: Plug emoji 🔌 (48px)
   - Title: "Integrations"
   - Description: "Third-party connections"

   Row 3:
   Card 7 - Observability:
   - Icon: Chart emoji 📊 (48px)
   - Title: "Observability"
   - Description: "Audit logs & monitoring"

   Card 8 - Exports:
   - Icon: Download emoji 📤 (48px)
   - Title: "Exports"
   - Description: "Data export tools"

   Card 9 - Billing Config:
   - Icon: Credit card emoji 💳 (48px)
   - Title: "Billing Config"
   - Description: "Billing preferences"

   Row 4:
   Card 10 - Comms Studio:
   - Icon: Speech bubble emoji 💬 (48px)
   - Title: "Comms Studio"
   - Description: "Communications settings"

   Card 11 - Templates:
   - Icon: Document emoji 📝 (48px)
   - Title: "Templates"
   - Description: "Message templates"

3. CARD INTERACTION STATES:
   - Default: White background, subtle border
   - Hover: Shadow (md level), scale 1.02, cursor pointer
   - Active: Green border (2px)

Use consistent card sizing, center-aligned content, and generous spacing (24px between cards). Make icons colorful and prominent.
```

---

## PROMPT 11: EMPTY & ERROR STATES

**Page Name**: "States Library"
**Purpose**: Reusable empty, loading, and error state components

**Prompt**:

```
Create a library of UI states for the LawnFlow web app.

EMPTY STATES (create 4 variants):

1. No Data (Initial):
   - Icon: Users icon (64px, gray)
   - Heading: "No customers yet" (Heading Medium)
   - Description: "Add your first customer to get started" (Body Medium, gray)
   - Button: "+ Add Customer" (primary)
   - Centered vertically and horizontally
   - Size: 400px × 300px container

2. No Results (Filtered):
   - Icon: Search icon (64px, gray)
   - Heading: "No results found"
   - Description: "Try adjusting your filters"
   - Button: "Clear Filters" (secondary)

3. No Permission:
   - Icon: Lock icon (64px, gray)
   - Heading: "Access restricted"
   - Description: "Contact your admin for access"
   - Button: "Contact Admin" (secondary)

4. Error State:
   - Icon: Warning triangle (64px, red)
   - Heading: "Something went wrong"
   - Description: "Unable to load data. Please try again"
   - Buttons: "Retry" (primary) + "Go Home" (secondary)

LOADING STATES (create 3 variants):

1. Skeleton Table Rows:
   - Show 5 rows of skeleton loaders
   - Each row: Gray rounded rectangles (varying widths) with pulse animation
   - Row height: 48px
   - Use neutral-200 background with lighter pulse overlay
   - Simulate table structure (checkbox, name, status, date columns)

2. Full Page Spinner:
   - Circular spinner (48px diameter)
   - Green color (primary)
   - Centered on white background
   - Rotating animation (360deg, 1s duration, infinite)

3. Progress Bar (Export):
   - Text: "Exporting data... 42%"
   - Progress bar below:
     - Total width: 400px
     - Height: 8px
     - Filled: Green (primary), 42% width
     - Unfilled: Light gray (neutral-200)
     - Border radius: 4px

INLINE ERROR STATES (create 2 variants):

1. Form Field Error:
   - Input field with red border (destructive color)
   - Warning icon (16px) to the right of input
   - Error text below: "Invalid email format" (Caption, red)

2. Toast Notification:
   - Size: 400px × 80px
   - Background: Destructive color (red)
   - Text: White
   - Icon: X in circle (24px, left)
   - Message: "Failed to save changes"
   - Submessage: "Please check your internet connection"
   - Close X button (top right)
   - Position hint: Bottom-right corner (show with padding from edges)

Use consistent sizing, colors from design system (neutral grays, primary green, destructive red), and make animations subtle but noticeable. Center-align empty states. Make loading states feel smooth with pulse/rotation animations.
```

---

## PROMPT 12: RESPONSIVE VARIANTS

**Page Name**: "Responsive"
**Purpose**: Show how layouts adapt to different screen sizes

**Prompt**:

```
Create responsive variants of key layouts for the LawnFlow web app.

DESKTOP - 1440px (Primary):
Show the full Work Queue layout:
- Left sidebar (240px)
- Main content with table (remaining width)
- All columns visible in table
- Comfortable row spacing (48px)

DESKTOP - 1920px (Wide):
Show the same Work Queue layout:
- Everything wider, more breathing room
- Max content width: 1440px, centered
- Extra space on left/right margins (gray background)

TABLET - 1024px (Minimum supported):
Show Work Queue adapted:
- Sidebar collapsed to icon-only (64px)
- Table columns reduced (hide "Assigned" column)
- Compact row spacing (36px)
- Search moved to dropdown/overlay

SIDEBAR STATES (show both):

1. Expanded Sidebar (240px):
   - Full navigation with icons + labels
   - Section headers visible
   - User avatar + name shown in footer

2. Collapsed Sidebar (64px):
   - Icons only, no labels
   - Tooltips on hover (show with dotted outline)
   - User avatar only in footer
   - Main content shifts left to fill space

Use consistent breakpoints, maintain readability at all sizes, and show how content reflows gracefully. Use gray background for margins to indicate viewport edges.
```

---

## EXECUTION CHECKLIST

After completing all 12 prompts, validate:

- [ ] All frames created and named consistently
- [ ] Design system tokens used throughout (colors, typography, spacing)
- [ ] Components reused (buttons, badges, cards, tables)
- [ ] Accessibility: Sufficient color contrast, readable text sizes
- [ ] Hover states shown for interactive elements
- [ ] Loading/empty/error states included
- [ ] Responsive variants created
- [ ] Navigation consistent across all pages
- [ ] Data-dense tables formatted correctly
- [ ] Charts readable with clear labels and legends

---

## NEXT STEPS AFTER FIGMA MAKE

1. **Export Assets**: Export icons, logos at multiple sizes (16px, 24px, 32px, 48px, 64px)
2. **Generate Code**: Use Figma's code export for CSS variables (colors, spacing, typography)
3. **Create Component Library**: Build React components matching Figma components
4. **Handoff**: Share Figma file with engineering team with inspect mode enabled
5. **Iterate**: Refine based on user testing and technical constraints

---

**Document Status**: ✅ Complete
**Total Prompts**: 12
**Estimated Figma Make Execution Time**: 2-3 hours (automated generation)
**Maintainer**: Product + Design Team
