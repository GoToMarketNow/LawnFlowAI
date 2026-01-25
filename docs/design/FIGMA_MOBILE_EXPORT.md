# LawnFlow Mobile Design Specification for Figma Make

**Version**: 1.0
**Date**: January 11, 2026
**Target**: Figma Make AI Tool
**Purpose**: Complete rebuild of LawnFlow mobile app front end

---

## 1. Figma File Structure

Create a single Figma file named **"LawnFlow Mobile - Master"** with the following pages:

### Page 1: Foundations
- **Purpose**: Design tokens, color styles, text styles, spacing, radius, shadows
- **Contents**: Color palette grid, typography scale, spacing reference, elevation samples

### Page 2: Primitives
- **Purpose**: Atomic UI elements (buttons, inputs, badges, pills, links)
- **Contents**: All component variants in their simplest form

### Page 3: Molecules
- **Purpose**: Composed components (cards, selectors, lists, modals)
- **Contents**: Reusable component patterns built from primitives

### Page 4: Mobile Screens - Crew Leader
- **Purpose**: Full screens for Crew Leader role
- **Contents**: Home, Jobs, Job Detail, Acceptance, Crew, Settings

### Page 5: Mobile Screens - Crew Member
- **Purpose**: Full screens for Crew Member role
- **Contents**: Home, Jobs, Job Detail, Acceptance, Settings

### Page 6: Mobile Screens - Owner
- **Purpose**: Full screens for Owner/Operator role
- **Contents**: Dashboard, Jobs, Crew Management, Analytics

### Page 7: Overlays & Modals
- **Purpose**: Modals, bottom sheets, alerts, confirmations
- **Contents**: All overlay patterns used across screens

---

## 2. Design Foundations (Figma Styles)

### Color Styles

#### Semantic Colors
```
Primary / Blue-500          #2196F3
Primary / Blue-700          #1976D2
Primary / Blue-50           #E3F2FD
Primary / Blue-100          #90CAF9

Success / Green-500         #4CAF50
Success / Green-700         #388E3C
Success / Green-50          #E8F5E9

Warning / Orange-500        #FF9800
Warning / Orange-700        #F57C00
Warning / Orange-50         #FFF3E0

Error / Red-500             #D32F2F
Error / Red-50              #FFEBEE

Neutral / Gray-900          #333333
Neutral / Gray-700          #666666
Neutral / Gray-500          #999999
Neutral / Gray-300          #E0E0E0
Neutral / Gray-100          #F5F5F5
Neutral / White             #FFFFFF

Accent / Purple-500         #7B1FA2
Accent / Purple-50          #F3E5F5

Accent / Yellow-500         #FFB300
Accent / Yellow-50          #FFF9E6
```

#### Status Colors (Job)
```
Status / Pending-BG         #E3F2FD
Status / Pending-Text       #1976D2

Status / InProgress-BG      #FFF3E0
Status / InProgress-Text    #F57C00

Status / Complete-BG        #E8F5E9
Status / Complete-Text      #388E3C

Status / Delayed-BG         #FFEBEE
Status / Delayed-Text       #D32F2F

Status / Rescheduled-BG     #F3E5F5
Status / Rescheduled-Text   #7B1FA2
```

#### Crew Status Colors
```
CrewStatus / OnSite         #4CAF50
CrewStatus / EnRoute        #FF9800
CrewStatus / OnBreak        #9E9E9E
```

### Text Styles (Mobile-First)

#### Display
```
Display / Large
  Font: System (San Francisco / Roboto)
  Size: 24px
  Weight: Bold (700)
  Line Height: 32px
  Color: Neutral/Gray-900

Display / Medium
  Size: 22px
  Weight: Bold (700)
  Line Height: 28px
```

#### Heading
```
Heading / H1
  Size: 20px
  Weight: Bold (700)
  Line Height: 26px

Heading / H2
  Size: 18px
  Weight: SemiBold (600)
  Line Height: 24px

Heading / H3
  Size: 16px
  Weight: SemiBold (600)
  Line Height: 22px
```

#### Body
```
Body / Large
  Size: 16px
  Weight: Regular (400)
  Line Height: 24px

Body / Medium
  Size: 15px
  Weight: Regular (400)
  Line Height: 22px

Body / Small
  Size: 14px
  Weight: Regular (400)
  Line Height: 20px

Body / XSmall
  Size: 13px
  Weight: Regular (400)
  Line Height: 18px
```

#### Label
```
Label / Medium
  Size: 14px
  Weight: Medium (500)
  Line Height: 18px

Label / Small
  Size: 13px
  Weight: Medium (500)
  Line Height: 16px
```

#### Caption
```
Caption / Regular
  Size: 12px
  Weight: Regular (400)
  Line Height: 16px

Caption / Bold
  Size: 11px
  Weight: SemiBold (600)
  Line Height: 14px
  Letter Spacing: 0.5px
  Transform: Uppercase
```

### Spacing Scale
```
spacing-4       4px
spacing-6       6px
spacing-8       8px
spacing-10      10px
spacing-12      12px
spacing-16      16px
spacing-20      20px
spacing-24      24px
spacing-32      32px
spacing-40      40px
spacing-48      48px
```

### Radius Scale
```
radius-4        4px
radius-6        6px
radius-8        8px
radius-12       12px
radius-16       16px
radius-20       20px
radius-full     9999px (pill shape)
```

### Shadow Styles (Elevation)
```
Elevation / 1 (Card)
  Y: 1px
  Blur: 2px
  Color: #000000 @ 5%

Elevation / 2 (Raised)
  Y: 2px
  Blur: 4px
  Color: #000000 @ 8%

Elevation / 3 (Modal)
  Y: 4px
  Blur: 8px
  Color: #000000 @ 12%

Elevation / 4 (Drawer)
  Y: 8px
  Blur: 16px
  Color: #000000 @ 16%
```

---

## 3. Component Library (Authoritative)

### Category: Buttons

#### Component: Button/Primary
**Variants**:
- State: Default | Hover | Pressed | Disabled | Loading
- Size: Small | Medium | Large

**Properties**:
- Size=Medium, State=Default:
  - Height: 48px
  - Padding: 16px horizontal
  - Background: Primary/Blue-500
  - Text: Body/Medium, White, SemiBold
  - Corner Radius: 8px
  - Auto Layout: Horizontal, Space Between, Align Center

- Size=Small:
  - Height: 36px
  - Padding: 12px horizontal

- Size=Large:
  - Height: 56px
  - Padding: 20px horizontal

- State=Disabled:
  - Opacity: 60%

- State=Loading:
  - Include spinner icon (animated)

#### Component: Button/Secondary
Same structure as Primary, but:
- Background: Neutral/Gray-100
- Text: Primary/Blue-500
- Border: 1px solid Neutral/Gray-300

#### Component: Button/Danger
Same structure as Primary, but:
- Background: Error/Red-500
- Text: White

---

### Category: Inputs

#### Component: Input/Text
**Variants**:
- State: Default | Focused | Error | Disabled
- Type: Single Line | Multi Line

**Properties**:
- Height: 48px (single line), min 100px (multi line)
- Padding: 12px horizontal, 12px vertical
- Background: White
- Border: 1px solid Neutral/Gray-300
- Corner Radius: 8px
- Text: Body/Small, Neutral/Gray-900
- Placeholder: Body/Small, Neutral/Gray-500

- State=Focused:
  - Border: 2px solid Primary/Blue-500

- State=Error:
  - Border: 2px solid Error/Red-500

#### Component: Input/Dropdown
Same as Text Input, but:
- Include chevron-down icon on right
- Height: 48px (fixed)

---

### Category: Badges & Pills

#### Component: StatusPill
**Variants**:
- Status: Pending | InProgress | Complete | Delayed | Rescheduled
- Size: Small | Medium | Large

**Properties**:
- Size=Medium:
  - Padding: 4px vertical, 10px horizontal
  - Corner Radius: 12px
  - Text: Caption/Bold, Status-specific color
  - Auto Layout: Horizontal, Hug Contents

- Size=Small:
  - Padding: 3px vertical, 8px horizontal
  - Text: 10px

- Status=Pending:
  - Background: Status/Pending-BG
  - Text: Status/Pending-Text

- (Repeat for all status types)

#### Component: Badge/Count
**Properties**:
- Min Width: 24px
- Height: 24px
- Padding: 4px horizontal
- Background: Primary/Blue-500
- Text: Caption/Regular, White, Center
- Corner Radius: 12px
- Auto Layout: Horizontal, Hug, Center

#### Component: Badge/Dot (Unread Indicator)
**Properties**:
- Size: 8px × 8px
- Fill: Primary/Blue-500
- Corner Radius: 4px (circle)

---

### Category: Navigation

#### Component: AddressLink
**Variants**:
- Type: Full | Compact

**Properties (Type=Full)**:
- Auto Layout: Horizontal, Space Between, Align Center
- Padding: 12px vertical, 16px horizontal
- Background: Neutral/Gray-100
- Border: 1px solid Neutral/Gray-300
- Corner Radius: 8px

- Left: Icon (📍) + Address text (Body/Small, 2 lines max)
- Right: "Directions" button
  - Background: Primary/Blue-500
  - Text: Label/Small, White, "Directions ›"
  - Padding: 6px vertical, 12px horizontal
  - Corner Radius: 6px

**Properties (Type=Compact)**:
- Auto Layout: Horizontal, Hug
- Text: Body/Small, Primary/Blue-500, Underline
- Icon: 📍 prefix

---

### Category: Selectors

#### Component: CrewStatusSelector
**Structure**:
- Button (trigger):
  - Auto Layout: Horizontal, Space Between
  - Padding: 12px vertical, 16px horizontal
  - Background: White
  - Border: 1px solid Neutral/Gray-300
  - Corner Radius: 8px
  - Left: "My Status:" label + colored badge
  - Right: Chevron-down icon

- Modal (Bottom Sheet):
  - Background: White
  - Corner Radius: 20px (top corners only)
  - Padding: 20px
  - Header: Title + Close button
  - List: 3 options (On Site, En Route, On Break)
    - Each option: Status indicator (16px circle) + Label + Checkmark (if selected)

**Variants**:
- CurrentStatus: OnSite | EnRoute | OnBreak
- State: Default | Disabled

#### Component: JobStatusSelector
Same structure as CrewStatusSelector, but:
- 5 status options (Pending, In Progress, Complete, Delayed, Rescheduled)
- Status indicator: 36px circle with bg color + 12px inner dot

---

### Category: Cards

#### Component: JobCard
**Variants**:
- Context: List | Detail

**Properties (Context=List)**:
- Auto Layout: Vertical, 12px gap
- Padding: 16px
- Background: White
- Border: 1px solid Neutral/Gray-300
- Corner Radius: 12px
- Shadow: Elevation/1

- Header: Customer name (Heading/H3) + StatusPill (right)
- Address: AddressLink component
- Meta: Service type (left) + Time window (right)

#### Component: NotificationCard
**Properties**:
- Padding: 12px
- Background: White
- Border: 1px solid Neutral/Gray-300
- Corner Radius: 8px

- Header: Title (Label/Medium) + Unread dot (if unread)
- Body: Body text (Body/Small, 2 lines max)

#### Component: CrewSnapshotCard
**Properties**:
- Padding: 16px
- Background: White
- Border: 1px solid Neutral/Gray-300
- Corner Radius: 12px

- Crew name (Heading/H3)
- Member count (Body/Small)
- "View Crew" button (text link)

---

### Category: Modals & Overlays

#### Component: Modal/BottomSheet
**Structure**:
- Overlay: Black @ 50% opacity, full screen
- Content:
  - Background: White
  - Corner Radius: 20px (top corners only)
  - Padding: 20px horizontal, 16px top
  - Bottom padding: 34px (safe area)

- Header:
  - Auto Layout: Horizontal, Space Between
  - Title (Heading/H2) + Close button (✕)
  - Border Bottom: 1px Neutral/Gray-300

- Body:
  - Scrollable content area

- Footer (optional):
  - Action buttons, fixed to bottom

#### Component: Alert/Banner
**Variants**:
- Type: Info | Success | Warning | Error

**Properties**:
- Auto Layout: Horizontal, 12px gap
- Padding: 16px
- Corner Radius: 12px
- Border Left: 4px solid (type color)

- Type=Warning:
  - Background: Warning/Orange-50
  - Border: Warning/Orange-500
  - Icon: ⚠️
  - Text: Warning/Orange-700

---

### Category: Agent UI (Payment & Job)

#### Component: PaymentStatusIndicator
**Variants**:
- Status: Captured | Pending | Failed

**Properties**:
- Auto Layout: Horizontal, 8px gap
- Padding: 8px vertical, 12px horizontal
- Corner Radius: 8px

- Status=Captured:
  - Background: Success/Green-50
  - Icon: ✓
  - Text: "Paid" (Success/Green-700)

- Status=Pending:
  - Background: Warning/Orange-50
  - Icon: ⏳
  - Text: "Payment Pending"

- Status=Failed:
  - Background: Error/Red-50
  - Icon: ⚠
  - Text: "Payment Issue"

#### Component: AcceptanceBanner
**Properties**:
- Auto Layout: Horizontal, Space Between
- Padding: 16px
- Background: Warning/Orange-50
- Border: 2px solid Warning/Orange-500
- Corner Radius: 12px

- Left: Title (Heading/H3, Orange) + Subtitle (Body/Small)
- Right: Large arrow icon (›, 32px)

---

## 4. Screen Definitions (Mobile)

### Owner/Operator Screens

#### Screen: Dashboard (Owner)
**Components Used**:
- Header: Title + Date subtitle
- Stat Cards (grid): Jobs Today, Unpaid Jobs, Active Crews
- Crew Status Grid (3 columns): Crew cards with status indicators
- Alert Banners (if any)
- Bottom Tab Navigation

**States**:
- Loading: Skeleton cards
- Empty: "No active jobs today"
- Default: Full data display

**Agent Interactions**:
- Payment issues highlighted in stat cards
- Suggested crew assignments in alerts

---

### Crew Leader Screens

#### Screen: Home (Crew Leader)
**Components Used**:
- Header: "Today's Command Center" + Date
- CrewStatusSelector (My Status)
- AcceptanceBanner (if schedule not accepted)
- Jobs Today Section:
  - Section header with job count badge
  - JobCard (list variant) × N
- Notifications Section (first 3)
- CrewSnapshotCard

**States**:
- Loading: "Loading jobs..."
- Empty: "No jobs scheduled for today"
- Default: Full list

**Agent Interactions**:
- Acceptance banner triggers acceptance flow
- Job completion triggers payment agent

#### Screen: Jobs (Enhanced)
**Components Used**:
- Header: Title + Filter tabs (Today | Upcoming | Completed)
- JobCard (list variant) × N
- Empty state per tab

**States**:
- Loading per tab
- Empty per tab
- Default: Jobs list with pull-to-refresh

#### Screen: Job Detail (Enhanced)
**Components Used**:
- Header: Customer name + Service type + StatusPill
- Location Section: AddressLink
- Time Window Info Row
- JobStatusSelector
- "What We're Doing" Section (expandable):
  - Task items with bullet points
- Customer Notes Card (yellow bg)
- Access Instructions Card (green bg with 🔑)
- Communication Section:
  - Button: "Call Customer"
  - Button: "Message Customer"
  - Button: "Message Owner"
- Completion Section (if IN_PROGRESS):
  - Multi-line text input (notes)
  - "Mark Complete" button (green)

**States**:
- Loading: Full-screen spinner
- Error: "Job not found"
- Default: All sections visible based on data
- In Progress: Show completion flow

**Agent Interactions**:
- Job completion submits to QA Agent → Payment Agent
- Payment status shown after completion

#### Screen: Acceptance (Daily Schedule)
**Components Used**:
- Header: "Review Today's Schedule" + Date
- Summary Card: Job count badge
- Jobs List: JobCard × N with numbered badges (#1, #2...)
- Instructions Card (blue info banner)
- Fixed Action Bar:
  - Button: "Request Changes" (secondary)
  - Button: "Accept Jobs" (primary, green)

**Modal: Request Changes**:
- BottomSheet Modal
- Title: "Request Schedule Changes"
- Multi-line input: "What changes do you need?"
- Actions: Cancel | Submit Request

**States**:
- Loading: "Loading schedule..."
- Already Accepted: Success message + timestamp
- Default: Review state with actions

**Agent Interactions**:
- Acceptance triggers notification to dispatch
- Request changes escalates to ops

#### Screen: Crew (Leader Only)
**Components Used**:
- Header: "My Crew"
- Crew member cards:
  - Name + Role
  - Status indicator (OnSite/EnRoute/OnBreak)
  - Actions: Call | Message (icons)
- Multi-select mode toggle
- Action buttons when selected

**States**:
- Loading
- Empty: "No crew members assigned"
- Default: List with actions

---

### Crew Member Screens

#### Screen: Home (Crew Member)
**Components Used**:
- Header: "Today's Jobs" + Date
- CrewStatusSelector (My Status)
- AcceptanceBanner (if needed)
- Jobs Today (simplified):
  - JobCard (compact) × N

**States**:
- Same as Crew Leader, but simplified

**Agent Interactions**:
- Same acceptance flow
- No crew management access

#### Screen: Settings (Payroll)
**Components Used**:
- Header: "Payroll & Pay Preferences" + Subtitle
- Pay Frequency Section:
  - Radio cards: Per Job | Daily | Weekly | Scheduled
- Payment Methods Section:
  - Checkbox cards: Cash | Zelle | Cash App | ACH
  - Conditional inputs per method:
    - Zelle: Email/phone input
    - Cash App: $handle input
    - ACH: Routing + Account + Type toggle
- Preferred Method Section (if multiple selected):
  - Radio cards for selected methods
- Info Card (green, 🔒): Security message
- Save Button (green, fixed bottom)

**States**:
- Loading: "Loading preferences..."
- Default: Form with saved values
- Saving: Button shows "Saving..."

**Agent Interactions**:
- Payment preferences used by Payment Agent for autopay/payouts

#### Screen: Request More Work
**Components Used**:
- Header: "Request More Work"
- Timeframe Section:
  - Radio cards: Today | This Week
- Note Input (multi-line, optional)
- Submit Button (primary)

**States**:
- Default: Form ready
- Submitting: "Submitting..."
- Success: Alert + navigate back

**Agent Interactions**:
- Request routed to dispatch for assignment

---

## 5. Navigation & Flow Rules

### Bottom Tab Navigation

#### Crew Leader Tabs
1. **Today** (Home icon)
   - Entry: CrewLeaderHome
   - Badge: Unaccepted schedule count

2. **Jobs** (List icon)
   - Entry: EnhancedJobsScreen (Today tab default)
   - Badge: In-progress job count

3. **Crew** (People icon)
   - Entry: CrewScreen
   - Badge: None

4. **Messages** (Chat icon)
   - Entry: ThreadsListScreen
   - Badge: Unread message count

5. **More** (Menu icon)
   - Entry: Settings menu

#### Crew Member Tabs
Same as Crew Leader, but **without Crew tab**.

#### Owner Tabs
1. **Dashboard**
2. **Jobs**
3. **Crews**
4. **Messages**
5. **More**

### Conditional Flows

#### Job Completion Flow
```
IN_PROGRESS job → User taps "Mark Complete"
  ↓
Agent runs QA validation
  ↓
If QA passes → Payment Agent runs
  ↓
Payment captured/pending/failed → Show status in job detail
  ↓
If failed → Alert: "Payment Issue - Contact Ops"
```

#### Daily Acceptance Flow
```
App launch (morning) → Check acceptance state
  ↓
If not accepted → Show AcceptanceBanner on Home
  ↓
User taps banner → Navigate to AcceptanceScreen
  ↓
User reviews jobs → Accept or Request Changes
  ↓
If accepted → Dismiss banner, unlock job actions
If changes requested → Escalate to ops, show pending state
```

#### Schedule Change Request
```
User not satisfied with schedule → Taps "Request Changes"
  ↓
BottomSheet modal opens
  ↓
User enters note → Submits
  ↓
Backend escalates to OPS role
  ↓
Ops reviews and responds via message
```

### Human-in-the-Loop Moments

1. **Schedule Acceptance**: Required before starting jobs
2. **Job Completion**: Requires explicit "Mark Complete" action
3. **Payment Failures**: Crew sees alert, ops must resolve
4. **Schedule Changes**: Crew requests, ops approves/denies

---

## 6. Figma Make Instructions

### Step 1: Create Figma File & Pages
```
1. Create new Figma file: "LawnFlow Mobile - Master"
2. Add 7 pages as specified in Section 1
3. Set page backgrounds to #F9FAFB (light gray)
```

### Step 2: Build Foundations (Page 1)
```
1. Create color styles grid:
   - 8 columns, 4px gap
   - Each color: 64px square with name label
   - Group by category (Primary, Success, Warning, etc.)

2. Create text styles reference:
   - List all text styles with samples
   - Show font size, weight, line height

3. Create spacing scale ruler:
   - Visual spacing increments with labels

4. Create corner radius samples:
   - Rectangles with different radii labeled

5. Create shadow samples:
   - 4 cards showing elevation levels
```

### Step 3: Build Primitives (Page 2)
```
1. Create Button/Primary component:
   - Use Auto Layout (horizontal, space-between, padding)
   - Add variants for Size (Small/Medium/Large)
   - Add variants for State (Default/Hover/Pressed/Disabled/Loading)
   - Apply text styles and color styles (not hard-coded colors)

2. Create Button/Secondary (same structure)

3. Create Input/Text component:
   - Auto Layout vertical for label + input
   - Add State variants (Default/Focused/Error/Disabled)
   - Use 1px stroke for borders

4. Create StatusPill component:
   - Auto Layout horizontal, hug contents
   - Add Status variants (5 job statuses)
   - Add Size variants (Small/Medium/Large)
   - Apply color styles for background and text

5. Create Badge/Count component:
   - Auto Layout horizontal, center
   - Use min-width constraint

6. Create Badge/Dot (8px circle)

7. Create AddressLink component:
   - Frame with Auto Layout
   - Add Type variants (Full/Compact)
   - Nest Button/Primary for "Directions" CTA
```

### Step 4: Build Molecules (Page 3)
```
1. Create CrewStatusSelector:
   - Build trigger button using nested Auto Layout
   - Create BottomSheet modal frame (375px width, auto height)
   - Add modal content: header + list + actions
   - Use existing Badge and Text styles

2. Create JobStatusSelector (same pattern)

3. Create JobCard:
   - Frame with Auto Layout vertical, 12px gap
   - Nest StatusPill in header
   - Nest AddressLink in body
   - Apply shadow effect (Elevation/1)
   - Add Context variant (List/Detail)

4. Create NotificationCard (similar structure)

5. Create CrewSnapshotCard

6. Create Modal/BottomSheet template:
   - 375px frame (mobile width)
   - Top corners radius 20px
   - Header with border-bottom
   - Scrollable body area
   - Fixed footer (optional)

7. Create Alert/Banner:
   - Auto Layout horizontal
   - Left border 4px
   - Add Type variants (Info/Success/Warning/Error)
```

### Step 5: Build Screens (Pages 4-6)
```
For each screen:

1. Create mobile frame (375px × 812px, iPhone X/11/12 dimensions)
2. Add screen name as text layer above frame
3. Build screen using ONLY library components:
   - Header section
   - Body content (scrollable region)
   - Fixed action bar (if applicable)
   - Bottom tab navigation

4. Create screen variants for states:
   - Default state (with sample data)
   - Loading state (with skeleton UI)
   - Empty state (with empty message)
   - Error state (if applicable)

5. Link screens via prototype connectors:
   - Job card tap → Job Detail
   - Acceptance banner tap → Acceptance screen
   - Tab tap → Tab screen

6. Use frame constraints for responsive behavior:
   - Top/Left for fixed elements
   - Left/Right stretch for full-width elements
```

### Step 6: Build Overlays (Page 7)
```
1. Create modal overlays:
   - Full-screen gray overlay (50% opacity)
   - Centered or bottom-aligned modal content
   - Use BottomSheet component

2. Create specific modals:
   - Request Changes Modal (from Acceptance screen)
   - Status Selector Modals (from selectors)

3. Apply backdrop blur effect (optional, if tool supports)
```

### Step 7: Apply Auto Layout Rules
```
For ALL components and screens:

1. Use Auto Layout everywhere (no absolute positioning)
2. Set appropriate resizing rules:
   - Hug contents for badges, pills, buttons (text-based sizing)
   - Fill container for full-width elements (cards, inputs)
   - Fixed size for icons, avatars

3. Set spacing modes:
   - Space between: For headers with title + action
   - Packed: For content groups

4. Set alignment:
   - Center: For modals, empty states
   - Top: For scrollable content
   - Left/Right: For text alignment

5. Use constraints:
   - Left & Right for full-width cards
   - Top & Left for floating elements
   - Scale for images (if any)
```

### Step 8: Apply Visual Consistency
```
1. Colors: Use styles ONLY (no hard-coded hex values)
2. Text: Use text styles ONLY (no custom font sizes)
3. Spacing: Use spacing scale values (4/8/12/16/20/24/32/40/48)
4. Radius: Use radius scale values (4/6/8/12/16/20/full)
5. Shadows: Use elevation styles (1/2/3/4)
6. Borders: Consistently 1px or 2px (focused states)
```

### Step 9: Create Prototypes
```
1. Link key flows:
   - Home → Job Detail → Complete Job → Success
   - Home → Acceptance → Accept → Home (updated)
   - Home → Crew → Member Detail
   - Settings → Payroll → Edit → Save

2. Use "Smart Animate" for transitions where applicable:
   - Modal open/close
   - Status selector expand/collapse

3. Set appropriate transition timing:
   - Instant: For tab switches
   - 200ms ease: For modals, bottom sheets
   - 150ms ease: For button presses
```

### Step 10: Quality Checks
```
Before finalizing:

1. Verify all components use Auto Layout (no absolute positioning)
2. Verify all colors use color styles (no detached styles)
3. Verify all text uses text styles (no overrides except color)
4. Verify spacing consistency (use spacing scale)
5. Verify touch targets (min 44px height for interactive elements)
6. Verify contrast ratios (WCAG AA minimum: 4.5:1 for text)
7. Verify screen names match specification
8. Verify all screens fit 375px width (iPhone standard)
9. Test prototype flows (click through key paths)
10. Document any deviations in separate notes frame
```

---

## Constraints & Rules

### Mobile-First Requirements
- **Single-column layout**: All content stacks vertically
- **Touch targets**: Minimum 44px height for all interactive elements
- **Thumb zones**: Primary actions at bottom (within reach)
- **Safe areas**: 34px bottom padding on iOS for home indicator
- **Font size**: Minimum 14px for body text, 12px for captions

### Auto Layout Requirements
- **No absolute positioning**: Everything uses Auto Layout
- **No magic numbers**: All spacing from spacing scale
- **Hug vs Fill**: Hug for content-sized, Fill for full-width
- **Constraints**: Use for responsive behavior (stretch, scale, fixed)

### Component Composition
- **Atomic design**: Build molecules from primitives, screens from molecules
- **No duplication**: Reuse components, don't recreate
- **Variants over copies**: Use component variants, not separate components
- **Instance overrides**: Allow text/icon overrides, not structure

### Visual Consistency
- **Colors**: Semantic naming (Primary, Success, Error), not descriptive (Blue, Green)
- **Typography**: System fonts (San Francisco on iOS, Roboto on Android)
- **Icons**: Emoji for now (📍, ⏰, 🔧, etc.), replace with icon set if available
- **Photography**: None (lawn care app is data-driven, not image-heavy)

### Agent-Driven UI
- **Payment status**: Always visible on completed jobs
- **Confidence indicators**: Not shown to crew (backend decision)
- **Human escalation**: Transparent (e.g., "Sent to Ops")
- **Async updates**: Loading states for all agent actions

### Data Integrity
- **Match backend enums**: Job status, crew status, payment status
- **Match API contracts**: Component data structure mirrors API responses
- **Match role permissions**: Crew tab only for leaders, payroll for all

---

## Design Philosophy

### Clarity Over Cleverness
- Use plain language ("Mark Complete", not "Finalize")
- Show explicit actions ("Accept Jobs", not just checkmark)
- Avoid jargon (except industry-standard: "ACH", "Zelle")

### Speed Over Features
- Minimize taps to complete job (Home → Job → Complete = 2 taps)
- One-tap directions (AddressLink)
- Status updates in-place (no separate screen)

### Trust Through Transparency
- Show payment status on every completed job
- Explain why schedule must be accepted
- Show who will see change requests (Ops)

### Offline Graceful
- Show loading states (not blank screens)
- Queue actions when offline (show "Pending sync" badge)
- Cache job data for offline viewing

### Mobile Native
- Bottom sheets for modals (iOS/Android pattern)
- System fonts (platform consistency)
- Pull-to-refresh on lists
- Haptic feedback on actions (implementation detail)

---

## Success Criteria

This design is **Figma-ready** if:

✅ All screens can be built using only library components
✅ All components use Auto Layout (no absolute positioning)
✅ All colors and text styles use Figma styles (no hard-coded values)
✅ All interactive elements meet 44px minimum touch target
✅ All screens fit 375px width (iPhone standard)
✅ All flows match backend API and agent behavior
✅ All role-specific screens respect permission boundaries
✅ All states (loading, empty, error) are designed
✅ All agent interactions (payment, job lifecycle) are reflected in UI
✅ Prototype flows work end-to-end for key user journeys

---

## Handoff Notes

### For Developers
- Component names match React Native component names in codebase
- Screen names match navigation route names
- Color style names match design token variable names
- Spacing values match theme spacing scale

### For Figma Make
- This document is the **single source of truth**
- Do not add features not specified here
- Do not create screens beyond the listed screens
- Do not invent new color/text styles beyond the foundation
- Do not use images or illustrations (not in current implementation)

### For Product Team
- This design reflects **implemented** mobile specs (CREW_MOBILE_IMPLEMENTATION_COMPLETE.md, STAFF_MOBILE_APP_IMPLEMENTATION.md)
- This design includes **Payment Agent integration** (PAYMENT_AGENT_IMPLEMENTATION.md)
- This design is **mobile-first, touch-optimized, offline-capable**
- This design is **agent-orchestrated, human-in-the-loop where required**

---

**End of Specification**

**Total Components**: 25+
**Total Screens**: 15+ (across 3 roles)
**Total States**: 50+ (loading, empty, error, success)
**Design System**: Complete (colors, text, spacing, radius, shadows)
**Ready for Figma Make**: ✅
