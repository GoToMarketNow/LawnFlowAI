# Execute Figma Generation with MCP

This guide walks through executing the Figma generation plan using your configured MCP Figma extension.

---

## 🎯 STEP 1: Create Figma File & Pages

### Action Required
Use your MCP Figma extension to create a new file with the following structure:

**File Name:** `LawnFlow Mobile App - Auto-Generated`

**Pages to Create (in order):**
1. 📱 Cover & Info
2. 🎨 Component Library
3. 👤 Customer Screens
4. 👔 Owner Screens
5. 👷 Crew Leader Screens
6. 🔧 Crew Screens
7. 🔗 Navigation Flow

### Expected Result
- New Figma file created
- 7 pages visible in left sidebar
- File key/URL ready for next steps

### Reference
```json
execution-plan.json → steps[0].data
```

---

## 🎯 STEP 2: Create Component Library

### Action Required
Navigate to the "🎨 Component Library" page and create 8 components.

### Component 1: LoadingSpinner
**Structure:**
```
COMPONENT: LoadingSpinner
└─ FRAME (Auto Layout: vertical, center, center)
   └─ ELLIPSE (32×32, fill: #22C55E)
```

**Properties:**
- Frame: flex=1, justifyContent=center, alignItems=center
- Ellipse: Large activity indicator, green color

### Component 2: NotificationBanner
**Structure:**
```
COMPONENT: NotificationBanner
└─ FRAME (Auto Layout: horizontal, space-between, center)
   ├─ TEXT (flex=1)
   │  └─ "Enable notifications to stay updated on your jobs"
   └─ FRAME (Button)
      └─ TEXT
         └─ "Enable"
```

**Properties:**
- Background: #FFF3CD (yellow banner)
- Padding: 12px all sides
- Text color: #856404
- Button: #856404 bg, white text

### Component 3: JobCard
**Structure:**
```
COMPONENT: JobCard
└─ FRAME (Auto Layout: vertical)
   ├─ FRAME (Status badges - horizontal)
   │  ├─ FRAME (Status badge)
   │  │  └─ TEXT: [job.status]
   │  └─ FRAME (Reminder badge - conditional)
   │     └─ TEXT: "Reminder [stage]"
   ├─ TEXT (fontSize: 18, fontWeight: 600)
   │  └─ [job.serviceType]
   ├─ TEXT (fontSize: 14, color: #666)
   │  └─ [job.propertyAddress]
   └─ TEXT (fontSize: 13, color: #999)
      └─ "Scheduled: [date]"
```

**Properties:**
- Background: #fff
- Padding: 16px
- Border: 1px solid #E5E7EB
- Border radius: 8px
- Margin bottom: 12px

### Component 4: ReminderBanner
**Structure:**
```
COMPONENT: ReminderBanner
└─ FRAME (Auto Layout: horizontal, space-between, center)
   ├─ FRAME (Content - vertical)
   │  ├─ TEXT (fontSize: 16, fontWeight: 600, color: #1E3A8A)
   │  │  └─ [urgent ? '🔔 Urgent Reminder' : '📅 Upcoming Service']
   │  └─ TEXT (fontSize: 14, color: #1E40AF)
   │     └─ "You have [count] job(s) requiring attention"
   └─ FRAME (Button)
      └─ TEXT
         └─ "View"
```

**Properties:**
- Background: #DBEAFE (light blue)
- Padding: 16px
- Border radius: 8px
- Border left: 4px solid #3B82F6

### Component 5: QAPhotoViewer
**Structure:**
```
COMPONENT: QAPhotoViewer
└─ FRAME (Auto Layout: vertical)
   ├─ TEXT (fontSize: 16, fontWeight: 600)
   │  └─ "Quality Assurance Photo"
   ├─ RECTANGLE (Image placeholder)
   │  └─ Width: 100%, Aspect: 1.333, fill: #E5E7EB
   └─ TEXT (fontSize: 12, color: #6B7280, textAlign: center)
      └─ "Expires: [date]"
```

**Properties:**
- Background: #F9FAFB
- Padding: 16px
- Border radius: 8px

### Component 6: ServiceCard
**Structure:**
```
COMPONENT: ServiceCard
└─ FRAME (Auto Layout: vertical)
   ├─ FRAME (Header - horizontal, space-between)
   │  ├─ TEXT (fontSize: 16, fontWeight: 600, flex: 1)
   │  │  └─ [service.name]
   │  ├─ FRAME (Badge - conditional: isInstant)
   │  │  └─ TEXT: "⚡ Instant"
   │  └─ FRAME (Badge - conditional: requiresApproval)
   │     └─ TEXT: "✓ Approval"
   └─ TEXT (fontSize: 14, color: #666)
      └─ [service.description]
```

**Properties:**
- Background: #fff
- Padding: 16px
- Border: 1px solid #E5E7EB
- Border radius: 8px
- Margin bottom: 12px

### Component 7: NotificationCard
**Structure:**
```
COMPONENT: NotificationCard
└─ FRAME (Auto Layout: vertical)
   ├─ FRAME (Header - horizontal, space-between)
   │  ├─ FRAME (Type + Urgency - horizontal)
   │  │  ├─ TEXT (fontSize: 12, uppercase)
   │  │  │  └─ [notification.type]
   │  │  └─ FRAME (Urgency badge - conditional)
   │  │     └─ TEXT: [urgency.label]
   │  └─ ELLIPSE (Unread dot - 8×8, conditional)
   ├─ TEXT (fontSize: 16, fontWeight: 600)
   │  └─ [notification.title]
   ├─ TEXT (fontSize: 14, color: #666)
   │  └─ [notification.body]
   └─ TEXT (fontSize: 12, color: #999)
      └─ [formatted date]
```

**Properties:**
- Background: #fff (or #F9FAFB if unread)
- Padding: 16px
- Border: 1px solid #E5E7EB (#22C55E if unread)
- Border radius: 8px
- Margin bottom: 12px

### Component 8: JobActionsPanel
**Structure:**
```
COMPONENT: JobActionsPanel
└─ FRAME (Auto Layout: vertical)
   ├─ FRAME (Status badge)
   │  └─ TEXT: [job.status]
   ├─ FRAME (Action button - conditional by status)
   │  └─ TEXT: "Start Job" | "Pause" | "Complete" | "Resume"
   └─ FRAME (Metadata - conditional)
      └─ TEXT: "Started: [time]"
```

**Properties:**
- Background: #fff
- Padding: 16px
- Border radius: 8px
- Shadow: 0 2px 4px rgba(0,0,0,0.1)

### Reference
```json
execution-plan.json → steps[1].data[0-7]
```

---

## 🎯 STEP 3: Create Customer Screens

### Action Required
Navigate to "👤 Customer Screens" page and create 10 screen frames.

### Frame Template
- **Width:** 375px
- **Height:** 812px
- **Background:** #FFFFFF
- **Auto Layout:** Vertical
- **Spacing:** 16px

### Screen 1: InviteLoginScreen
**Layout:**
```
FRAME (375×812, center alignment)
├─ ELLIPSE (ActivityIndicator, 32×32, #22C55E)
└─ TEXT (fontSize: 16, color: #666)
   └─ "Signing you in..."
```

### Screen 2: HomeScreen
**Layout:**
```
FRAME (375×812, vertical Auto Layout)
├─ COMPONENT: NotificationBanner
├─ FRAME (ScrollView - vertical)
│  ├─ TEXT (fontSize: 24, fontWeight: bold)
│  │  └─ "Welcome to LawnFlow"
│  ├─ TEXT (fontSize: 16, color: #666)
│  │  └─ "[user.email]"
│  ├─ FRAME (Button - #3B82F6)
│  │  └─ TEXT: "➕ Request New Service"
│  ├─ COMPONENT: ReminderBanner
│  └─ FRAME (Upcoming section)
│     ├─ TEXT: "Upcoming Services"
│     └─ TEXT: "[count] scheduled"
```

### Screen 3: JobsScreen
**Layout:**
```
FRAME (375×812, vertical Auto Layout)
├─ FRAME (Tab bar - horizontal)
│  ├─ FRAME (Tab - Upcoming)
│  │  └─ TEXT: "Upcoming ([count])"
│  └─ FRAME (Tab - Completed)
│     └─ TEXT: "Completed ([count])"
└─ FRAME (List - vertical, spacing: 12px)
   ├─ COMPONENT: JobCard
   ├─ COMPONENT: JobCard
   └─ COMPONENT: JobCard
```

### Screen 4: JobDetailScreen
**Layout:**
```
FRAME (375×812, vertical Auto Layout, ScrollView)
├─ FRAME (Header - horizontal, space-between)
│  ├─ TEXT (fontSize: 24, fontWeight: bold)
│  │  └─ "[job.serviceType]"
│  └─ FRAME (Status badge)
│     └─ TEXT: "[job.status]"
├─ FRAME (Reminder CTA - conditional, yellow)
│  ├─ TEXT: "⏰ Reminder: [stage]"
│  ├─ TEXT: "Your service is scheduled soon..."
│  └─ FRAME (Button): "Acknowledge"
├─ FRAME (Review CTA - conditional, blue)
│  ├─ TEXT: "✨ How was your service?"
│  ├─ TEXT: "Share your feedback..."
│  └─ FRAME (Button): "Leave a Review"
├─ COMPONENT: QAPhotoViewer (conditional)
└─ FRAME (Details section)
   ├─ TEXT: "Details"
   ├─ FRAME (Address)
   └─ FRAME (Scheduled date)
```

### Screen 5: ReviewPromptScreen
**Layout:**
```
FRAME (375×812, vertical Auto Layout, padding: 20px)
├─ TEXT (fontSize: 24, fontWeight: bold, center)
│  └─ "How was your service?"
├─ TEXT (fontSize: 14, color: #666, center)
│  └─ "[job.serviceType] at [address]"
├─ FRAME (Star rating - horizontal, center)
│  ├─ TEXT (fontSize: 48): "☆"
│  ├─ TEXT (fontSize: 48): "☆"
│  ├─ TEXT (fontSize: 48): "☆"
│  ├─ TEXT (fontSize: 48): "☆"
│  └─ TEXT (fontSize: 48): "☆"
├─ FRAME (Feedback input - conditional if rating ≤ 3)
│  ├─ TEXT: "We're sorry to hear that..."
│  └─ FRAME (TextInput, multiline, minHeight: 100px)
└─ FRAME (Submit button - conditional if rating > 0)
   └─ TEXT: "Submit Review"
```

### Screen 6: ServiceCatalogScreen
**Layout:**
```
FRAME (375×812, vertical Auto Layout)
└─ FRAME (List - vertical, padding: 16px)
   ├─ COMPONENT: ServiceCard
   ├─ COMPONENT: ServiceCard
   ├─ COMPONENT: ServiceCard
   └─ COMPONENT: ServiceCard
```

### Screen 7: RequestServiceScreen
**Layout:**
```
FRAME (375×812, vertical Auto Layout, ScrollView)
├─ FRAME (Service info section)
│  ├─ TEXT: "Service"
│  ├─ TEXT (fontSize: 18, fontWeight: 600): "[service.name]"
│  └─ TEXT (fontSize: 14, color: #666): "[description]"
├─ FRAME (Date input section)
│  ├─ TEXT: "Preferred Date (optional)"
│  └─ FRAME (TextInput): "ASAP (or YYYY-MM-DD)"
├─ FRAME (Notes section)
│  ├─ TEXT: "Notes (optional, max 200 chars)"
│  ├─ FRAME (TextInput, multiline, minHeight: 100px)
│  └─ TEXT (fontSize: 12, color: #999): "[count]/200"
└─ FRAME (Submit button - #3B82F6)
   └─ TEXT: "Submit Request"
```

### Screen 8: ServiceRequestDetailScreen
**Layout:**
```
FRAME (375×812, vertical Auto Layout, ScrollView)
├─ FRAME (Status card - #DBEAFE, blue left border)
│  ├─ TEXT (fontSize: 18, fontWeight: 600, color: #1E3A8A)
│  │  └─ "[statusConfig.title]"
│  └─ TEXT (fontSize: 14, color: #1E40AF)
│     └─ "[statusConfig.message]"
└─ FRAME (Details section)
   ├─ TEXT: "Service Details"
   ├─ FRAME (Service row)
   ├─ FRAME (Date row - conditional)
   ├─ FRAME (Notes row - conditional)
   └─ FRAME (Submitted row)
```

### Screen 9: NotificationCenterScreen
**Layout:**
```
FRAME (375×812, vertical Auto Layout)
└─ FRAME (List - vertical, padding: 16px)
   ├─ COMPONENT: NotificationCard
   ├─ COMPONENT: NotificationCard
   ├─ COMPONENT: NotificationCard
   └─ COMPONENT: NotificationCard
```

### Screen 10: SettingsScreen
**Layout:**
```
FRAME (375×812, vertical Auto Layout, padding: 20px)
├─ TEXT (fontSize: 24, fontWeight: bold)
│  └─ "Settings"
├─ FRAME (Email section)
│  ├─ TEXT (fontSize: 14, color: #666): "Email"
│  └─ TEXT (fontSize: 16): "[user.email]"
└─ FRAME (Logout button - #EF4444)
   └─ TEXT (color: #fff): "Logout"
```

### Reference
```json
execution-plan.json → steps[2].data.Customer[0-9]
```

---

## 🎯 STEP 4: Create Owner/Staff Screens

### Action Required
Navigate to "👔 Owner Screens" and "👷 Crew Leader Screens" pages.

### Screen 11: DashboardScreen (Owner Variant)
**Page:** 👔 Owner Screens

**Layout:**
```
FRAME (375×812, vertical Auto Layout, ScrollView)
├─ FRAME (Header)
│  ├─ TEXT (fontSize: 24, fontWeight: bold): "Today's Overview"
│  └─ TEXT (fontSize: 14, color: #666): "[formatted date]"
├─ FRAME (Pending sync warning - conditional, #FFF3E0)
│  └─ TEXT: "⚠ [count] action(s) pending sync"
├─ FRAME (Stats grid - 2 columns, wrap)
│  ├─ FRAME (Stat card - blue left border)
│  │  ├─ TEXT (fontSize: 32, fontWeight: bold): "[jobsScheduled]"
│  │  └─ TEXT (fontSize: 12, color: #666): "Jobs Today"
│  ├─ FRAME (Stat card - orange left border)
│  │  ├─ TEXT (fontSize: 32): "[jobsInProgress]"
│  │  └─ TEXT: "In Progress"
│  ├─ FRAME (Stat card - green left border)
│  │  ├─ TEXT (fontSize: 32): "[jobsCompleted]"
│  │  └─ TEXT: "Completed"
│  └─ FRAME (Stat card - red left border)
│     ├─ TEXT (fontSize: 32): "[unassignedJobs]"
│     └─ TEXT: "Unassigned"
└─ FRAME (Crew status card)
   ├─ TEXT: "Crew Status"
   ├─ FRAME (Available row)
   ├─ FRAME (On Job row)
   └─ FRAME (Button): "View Crews"
```

### Screen 12: DashboardScreen (Crew Leader Variant)
**Page:** 👷 Crew Leader Screens

**Layout:**
```
FRAME (375×812, vertical Auto Layout, ScrollView)
├─ FRAME (Header)
│  ├─ TEXT (fontSize: 24, fontWeight: bold): "Today's Route"
│  └─ TEXT (fontSize: 14, color: #666): "[formatted date]"
├─ FRAME (Summary card)
│  ├─ FRAME (Total jobs row)
│  └─ FRAME (Completed row)
└─ FRAME (Jobs list)
   ├─ TEXT: "Today's Jobs"
   ├─ FRAME (Job card)
   │  ├─ FRAME (Header - customer + status)
   │  ├─ TEXT: "[address]"
   │  ├─ TEXT: "[serviceType]"
   │  └─ TEXT: "[time]"
   └─ FRAME (Job card)
```

### Reference
```json
execution-plan.json → steps[2].data.Owner[0]
execution-plan.json → steps[2].data.CrewLeader[0]
```

---

## 🎯 STEP 5: Apply Design System Styles

### Action Required
Create color styles, text styles, and effect styles.

### Color Styles (24 total)

**Primary Colors:**
- Primary/main: `rgb(59, 130, 246)` → #3B82F6
- Primary/light: `rgb(219, 234, 254)` → #DBEAFE
- Primary/dark: `rgb(30, 64, 175)` → #1E40AF

**Success Colors:**
- Success/main: `rgb(34, 197, 94)` → #22C55E
- Success/light: `rgb(209, 250, 229)` → #D1FAE5
- Success/dark: `rgb(6, 95, 70)` → #065F46

**Warning Colors:**
- Warning/main: `rgb(245, 158, 11)` → #F59E0B
- Warning/light: `rgb(254, 243, 199)` → #FEF3C7
- Warning/dark: `rgb(146, 64, 14)` → #92400E

**Error Colors:**
- Error/main: `rgb(239, 68, 68)` → #EF4444
- Error/light: `rgb(254, 226, 226)` → #FEE2E2
- Error/dark: `rgb(153, 27, 27)` → #991B1B

**Neutral Colors:**
- Neutral/white: #FFFFFF
- Neutral/gray50: #F9FAFB
- Neutral/gray100: #F5F5F5
- Neutral/gray200: #E5E7EB
- Neutral/gray300: #D1D5DB
- Neutral/gray500: #6B7280
- Neutral/gray600: #666666
- Neutral/gray700: #333333
- Neutral/gray900: #111827
- Neutral/black: #000000

### Text Styles (32 total)

Create combinations of size × weight:

**Sizes:** xs (10px), sm (12px), base (14px), md (15px), lg (16px), xl (18px), 2xl (24px), 3xl (32px)

**Weights:** regular (400), medium (500), semibold (600), bold (700)

**Font Family:** Inter

**Examples:**
- xs/regular: 10px Inter Regular
- sm/medium: 12px Inter Medium
- base/semibold: 14px Inter SemiBold
- xl/bold: 18px Inter Bold
- 2xl/bold: 24px Inter Bold

### Effect Styles (4 total)

**Shadow/sm:**
- Type: Drop Shadow
- Offset: x=0, y=1
- Blur: 2px
- Color: rgba(0, 0, 0, 0.1)

**Shadow/base:**
- Type: Drop Shadow
- Offset: x=0, y=2
- Blur: 4px
- Color: rgba(0, 0, 0, 0.1)

**Shadow/md:**
- Type: Drop Shadow
- Offset: x=0, y=4
- Blur: 6px
- Color: rgba(0, 0, 0, 0.1)

**Shadow/lg:**
- Type: Drop Shadow
- Offset: x=0, y=10
- Blur: 15px
- Color: rgba(0, 0, 0, 0.15)

### Reference
```json
execution-plan.json → steps[3].data
```

---

## 🎯 STEP 6: Link Navigation Prototypes

### Action Required
Add prototype interactions between screens using the navigation flows.

### Navigation Flows (15 total)

1. **InviteLoginScreen → HomeScreen**
   - Trigger: Auto (on success)
   - Animation: Dissolve, 300ms

2. **HomeScreen → ServiceCatalogScreen**
   - Trigger: Tap on "Request New Service" button
   - Animation: Smart Animate, 300ms

3. **HomeScreen → JobsScreen**
   - Trigger: Tap on ReminderBanner "View" button
   - Animation: Smart Animate, 300ms

4. **JobsScreen → JobDetailScreen**
   - Trigger: Tap on JobCard
   - Animation: Smart Animate, 300ms

5. **JobDetailScreen → ReviewPromptScreen**
   - Trigger: Tap on "Leave a Review" button
   - Animation: Smart Animate, 300ms

6. **ReviewPromptScreen → JobDetailScreen**
   - Trigger: Tap on "Submit Review" button
   - Animation: Smart Animate, 300ms (back)

7. **ServiceCatalogScreen → RequestServiceScreen**
   - Trigger: Tap on ServiceCard
   - Animation: Smart Animate, 300ms

8. **RequestServiceScreen → ServiceRequestDetailScreen**
   - Trigger: Tap on "Submit Request" button
   - Animation: Smart Animate, 300ms

9. **NotificationCenterScreen → JobDetailScreen**
   - Trigger: Tap on NotificationCard (type: JOB_ADDED)
   - Animation: Smart Animate, 300ms

10. **NotificationCenterScreen → ServiceRequestDetailScreen**
    - Trigger: Tap on NotificationCard (type: service_request_update)
    - Animation: Smart Animate, 300ms

11. **SettingsScreen → InviteLoginScreen**
    - Trigger: Tap on "Logout" button
    - Animation: Dissolve, 300ms

12. **DashboardScreen (Owner) → JobDetailScreen**
    - Trigger: Tap on job card
    - Animation: Smart Animate, 300ms

13. **DashboardScreen (Owner) → CrewsScreen**
    - Trigger: Tap on "View Crews" button
    - Animation: Smart Animate, 300ms

14. **DashboardScreen (Crew Leader) → JobDetailScreen**
    - Trigger: Tap on job card
    - Animation: Smart Animate, 300ms

15. **DashboardScreen (Crew) → JobDetailScreen**
    - Trigger: Tap on job card
    - Animation: Smart Animate, 300ms

### Reference
```json
execution-plan.json → steps[4].data[0-14]
```

---

## 🎯 STEP 7: Validate & Share

### Validation Checklist

- [ ] All 7 pages exist
- [ ] All 8 components created on Component Library page
- [ ] All 12 screens created (10 Customer + 2 Staff)
- [ ] All screens are 375×812px
- [ ] Auto Layout is applied to container frames
- [ ] Color styles match design system (24 styles)
- [ ] Text styles use Inter font (32 styles)
- [ ] Shadow effects are created (4 styles)
- [ ] Prototype links work between screens (15 flows)
- [ ] Components are properly instantiated in screens

### Share Figma File

1. Copy Figma file URL
2. Set sharing permissions (View/Edit as needed)
3. Document the file location
4. Notify stakeholders

---

## 📊 Final Statistics

**Created:**
- 1 Figma file
- 7 pages
- 8 reusable components
- 12 screen frames (375×812px)
- 60 design system styles
- 15 prototype interactions
- ~500+ total nodes

**Time Estimate:** 2-4 hours (manual execution) or 5-10 minutes (automated with MCP)

---

## 🆘 Troubleshooting

**Issue:** Can't find execution plan
→ Run: `cd figma-automation && npm run generate`

**Issue:** Component structure unclear
→ Reference: `execution-plan.json → steps[1].data[component_index]`

**Issue:** Auto Layout not working
→ Ensure parent frame has `layoutMode` set to HORIZONTAL or VERTICAL

**Issue:** Colors don't match
→ RGB values are 0-1 range, multiply by 255 for standard RGB

**Issue:** Text not showing
→ Ensure node has `characters` property with text content

---

**Ready to Execute!** Follow each step sequentially using your MCP Figma extension.
