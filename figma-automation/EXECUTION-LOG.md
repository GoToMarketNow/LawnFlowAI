# Figma Execution Log - LawnFlow Mobile App UX Layer

**Started:** 2026-01-09
**Status:** Ready for MCP Figma execution

---

## 🎯 STEP 1: CREATE FIGMA FILE & PAGES

### Task
Create a new Figma file with 7 organized pages

### Specifications
```json
{
  "fileName": "LawnFlow Mobile App - Auto-Generated",
  "pages": [
    "📱 Cover & Info",
    "🎨 Component Library",
    "👤 Customer Screens",
    "👔 Owner Screens",
    "👷 Crew Leader Screens",
    "🔧 Crew Screens",
    "🔗 Navigation Flow"
  ]
}
```

### MCP Action Needed
Use your MCP Figma extension to:
1. Create new file: "LawnFlow Mobile App - Auto-Generated"
2. Create 7 pages with the names above
3. Save the file key/URL for reference

### Success Criteria
- [ ] Figma file created
- [ ] All 7 pages visible in sidebar
- [ ] File key obtained: `________________`

---

## 🎯 STEP 2: BUILD COMPONENT LIBRARY

### Task
Create 8 reusable components on "🎨 Component Library" page

### Component Specifications

#### 2.1 LoadingSpinner
```
Size: 375×100px
Structure:
  COMPONENT "LoadingSpinner"
  └─ FRAME (Auto Layout: VERTICAL, center/center)
     └─ ELLIPSE (40×40px)
        Fill: rgb(34, 197, 94) #22C55E
```

#### 2.2 NotificationBanner
```
Size: 375×60px
Structure:
  COMPONENT "NotificationBanner"
  └─ FRAME (Auto Layout: HORIZONTAL, space-between)
     Background: rgb(255, 243, 205) #FFF3CD
     Padding: 12px all sides
     ├─ TEXT "Enable notifications to stay updated on your jobs"
     │  Font: Inter Regular 14px
     │  Color: rgb(133, 100, 4) #856404
     │  Flex: 1
     └─ FRAME (Button)
        Background: rgb(133, 100, 4) #856404
        Padding: 8px horizontal, 8px vertical
        Border radius: 4px
        └─ TEXT "Enable"
           Font: Inter SemiBold 14px
           Color: rgb(255, 255, 255) #FFFFFF
```

#### 2.3 JobCard
```
Size: 343×140px
Structure:
  COMPONENT "JobCard"
  └─ FRAME (Auto Layout: VERTICAL, 12px spacing)
     Background: rgb(255, 255, 255) #FFFFFF
     Padding: 16px
     Border: 1px solid rgb(229, 231, 235) #E5E7EB
     Border radius: 8px
     ├─ FRAME (Badges row - HORIZONTAL, 8px gap)
     │  ├─ FRAME (Status badge)
     │  │  Background: rgb(59, 130, 246) #3B82F6
     │  │  Padding: 4px 12px
     │  │  Border radius: 12px
     │  │  └─ TEXT "scheduled"
     │  │     Font: Inter SemiBold 12px
     │  │     Color: rgb(255, 255, 255)
     │  │     Transform: capitalize
     │  └─ FRAME (Reminder badge - optional)
     │     Background: rgb(254, 243, 199) #FEF3C7
     │     Padding: 4px 8px
     │     Border radius: 8px
     │     └─ TEXT "Reminder Stage 2"
     │        Font: Inter SemiBold 11px
     │        Color: rgb(146, 64, 14) #92400E
     ├─ TEXT "Lawn Mowing"
     │  Font: Inter SemiBold 18px
     │  Color: rgb(0, 0, 0) #000000
     ├─ TEXT "123 Main Street, City, State"
     │  Font: Inter Regular 14px
     │  Color: rgb(102, 102, 102) #666666
     └─ TEXT "Scheduled: Mon, Jan 15, 2026"
        Font: Inter Regular 13px
        Color: rgb(153, 153, 153) #999999
```

#### 2.4 ReminderBanner
```
Size: 343×90px
Structure:
  COMPONENT "ReminderBanner"
  └─ FRAME (Auto Layout: HORIZONTAL, space-between)
     Background: rgb(219, 234, 254) #DBEAFE
     Padding: 16px
     Border radius: 8px
     Border left: 4px solid rgb(59, 130, 246) #3B82F6
     ├─ FRAME (Content - VERTICAL, 4px spacing, flex: 1)
     │  ├─ TEXT "📅 Upcoming Service"
     │  │  Font: Inter SemiBold 16px
     │  │  Color: rgb(30, 58, 138) #1E3A8A
     │  └─ TEXT "You have 2 job(s) requiring attention"
     │     Font: Inter Regular 14px
     │     Color: rgb(30, 64, 175) #1E40AF
     └─ FRAME (Button)
        Background: rgb(59, 130, 246) #3B82F6
        Padding: 10px 20px
        Border radius: 6px
        └─ TEXT "View"
           Font: Inter SemiBold 14px
           Color: rgb(255, 255, 255)
```

#### 2.5 QAPhotoViewer
```
Size: 343×220px
Structure:
  COMPONENT "QAPhotoViewer"
  └─ FRAME (Auto Layout: VERTICAL, 12px spacing)
     Background: rgb(249, 250, 251) #F9FAFB
     Padding: 16px
     Border radius: 8px
     ├─ TEXT "Quality Assurance Photo"
     │  Font: Inter SemiBold 16px
     │  Color: rgb(0, 0, 0) #000000
     ├─ RECTANGLE (Image placeholder)
     │  Width: 100% (311px)
     │  Height: 233px (aspect ratio 1.333)
     │  Fill: rgb(229, 231, 235) #E5E7EB
     │  Border radius: 8px
     └─ TEXT "Expires: Jan 16, 2026, 10:30 AM"
        Font: Inter Regular 12px
        Color: rgb(107, 114, 128) #6B7280
        Align: center
```

#### 2.6 ServiceCard
```
Size: 343×100px
Structure:
  COMPONENT "ServiceCard"
  └─ FRAME (Auto Layout: VERTICAL, 8px spacing)
     Background: rgb(255, 255, 255) #FFFFFF
     Padding: 16px
     Border: 1px solid rgb(229, 231, 235) #E5E7EB
     Border radius: 8px
     ├─ FRAME (Header - HORIZONTAL, space-between, 8px gap)
     │  ├─ TEXT "Lawn Mowing"
     │  │  Font: Inter SemiBold 16px
     │  │  Color: rgb(0, 0, 0) #000000
     │  │  Flex: 1
     │  ├─ FRAME (Badge - optional)
     │  │  Background: rgb(209, 250, 229) #D1FAE5
     │  │  Padding: 4px 8px
     │  │  Border radius: 4px
     │  │  └─ TEXT "⚡ Instant"
     │  │     Font: Inter SemiBold 11px
     │  │     Color: rgb(6, 95, 70) #065F46
     │  └─ FRAME (Badge - optional)
     │     Background: rgb(254, 243, 199) #FEF3C7
     │     Padding: 4px 8px
     │     Border radius: 4px
     │     └─ TEXT "✓ Approval"
     │        Font: Inter SemiBold 11px
     │        Color: rgb(6, 95, 70) #065F46
     └─ TEXT "Regular lawn cutting and trimming service"
        Font: Inter Regular 14px
        Color: rgb(102, 102, 102) #666666
```

#### 2.7 NotificationCard
```
Size: 343×120px
Structure:
  COMPONENT "NotificationCard"
  └─ FRAME (Auto Layout: VERTICAL, 8px spacing)
     Background: rgb(255, 255, 255) #FFFFFF
     Padding: 16px
     Border: 1px solid rgb(229, 231, 235) #E5E7EB
     Border radius: 8px
     ├─ FRAME (Header - HORIZONTAL, space-between)
     │  ├─ FRAME (Type + Urgency - HORIZONTAL, 8px gap)
     │  │  ├─ TEXT "JOB_ADDED"
     │  │  │  Font: Inter SemiBold 12px
     │  │  │  Color: rgb(102, 102, 102) #666666
     │  │  │  Transform: uppercase
     │  │  └─ FRAME (Urgency badge - optional)
     │  │     Background: rgb(239, 68, 68) #EF4444
     │  │     Padding: 2px 6px
     │  │     Border radius: 4px
     │  │     └─ TEXT "URGENT"
     │  │        Font: Inter Bold 10px
     │  │        Color: rgb(255, 255, 255)
     │  └─ ELLIPSE (Unread dot - optional)
     │     Size: 8×8px
     │     Fill: rgb(34, 197, 94) #22C55E
     ├─ TEXT "New Job Assigned"
     │  Font: Inter SemiBold 16px
     │  Color: rgb(0, 0, 0) #000000
     ├─ TEXT "You have been assigned a new lawn mowing job at 123 Main St"
     │  Font: Inter Regular 14px
     │  Color: rgb(102, 102, 102) #666666
     └─ TEXT "Jan 9, 2026"
        Font: Inter Regular 12px
        Color: rgb(153, 153, 153) #999999
```

#### 2.8 JobActionsPanel
```
Size: 343×180px
Structure:
  COMPONENT "JobActionsPanel"
  └─ FRAME (Auto Layout: VERTICAL, 12px spacing)
     Background: rgb(255, 255, 255) #FFFFFF
     Padding: 16px
     Border radius: 8px
     Shadow: 0 2px 4px rgba(0, 0, 0, 0.1)
     ├─ FRAME (Status badge)
     │  Background: rgb(227, 242, 253) #E3F2FD
     │  Padding: 4px 12px
     │  Border radius: 12px
     │  Self-align: flex-start
     │  └─ TEXT "in_progress"
     │     Font: Inter SemiBold 12px
     │     Color: rgb(25, 118, 210) #1976D2
     ├─ FRAME (Button)
     │  Background: rgb(76, 175, 80) #4CAF50
     │  Padding: 12px 16px
     │  Border radius: 8px
     │  └─ TEXT "Start Job"
     │     Font: Inter SemiBold 16px
     │     Color: rgb(255, 255, 255)
     │     Align: center
     └─ FRAME (Metadata row - optional)
        Auto Layout: HORIZONTAL, space-between
        Padding top: 12px
        Border top: 1px solid rgb(224, 224, 224) #E0E0E0
        ├─ TEXT "Started:"
        │  Font: Inter Regular 14px
        │  Color: rgb(102, 102, 102) #666666
        └─ TEXT "10:30 AM"
           Font: Inter SemiBold 14px
           Color: rgb(51, 51, 51) #333333
```

### MCP Actions Needed
For each component 2.1-2.8:
1. Navigate to "🎨 Component Library" page
2. Create component with specified structure
3. Apply Auto Layout where indicated
4. Set colors, typography, spacing per specs
5. Name component correctly
6. Mark as reusable Figma component

### Success Criteria
- [ ] All 8 components created on Component Library page
- [ ] Each component uses Auto Layout
- [ ] All styles match specifications
- [ ] Components are marked as Figma components (not just frames)

---

## 🎯 STEP 3: CREATE CUSTOMER SCREENS

### Task
Create 10 screen frames on "👤 Customer Screens" page

### Frame Template
- Width: 375px
- Height: 812px
- Background: #FFFFFF
- Auto Layout: VERTICAL
- Name pattern: "[ScreenName]"

### Screen Specifications

#### 3.1 InviteLoginScreen (375×812px)
```
FRAME "InviteLoginScreen" (VERTICAL, center/center)
Background: rgb(255, 255, 255)
├─ ELLIPSE (40×40px)
│  Fill: rgb(34, 197, 94) #22C55E
└─ TEXT "Signing you in..."
   Font: Inter Regular 16px
   Color: rgb(102, 102, 102) #666666
   Margin top: 16px
```

#### 3.2 HomeScreen (375×812px)
```
FRAME "HomeScreen" (VERTICAL, stretch)
Background: rgb(255, 255, 255)
├─ INSTANCE: NotificationBanner (from Component Library)
└─ FRAME (ScrollView - VERTICAL, 20px spacing)
   Padding: 20px
   ├─ TEXT "Welcome to LawnFlow"
   │  Font: Inter Bold 24px
   │  Color: rgb(0, 0, 0)
   ├─ TEXT "user@example.com"
   │  Font: Inter Regular 16px
   │  Color: rgb(102, 102, 102)
   ├─ FRAME (Button)
   │  Background: rgb(59, 130, 246) #3B82F6
   │  Padding: 16px
   │  Border radius: 8px
   │  Align items: center
   │  └─ TEXT "➕ Request New Service"
   │     Font: Inter SemiBold 16px
   │     Color: rgb(255, 255, 255)
   ├─ INSTANCE: ReminderBanner (from Component Library)
   └─ FRAME (Upcoming section - VERTICAL, 8px spacing)
      ├─ TEXT "Upcoming Services"
      │  Font: Inter SemiBold 18px
      │  Color: rgb(0, 0, 0)
      └─ TEXT "3 scheduled"
         Font: Inter Regular 14px
         Color: rgb(102, 102, 102)
```

#### 3.3 JobsScreen (375×812px)
```
FRAME "JobsScreen" (VERTICAL, stretch)
Background: rgb(249, 250, 251) #F9FAFB
├─ FRAME (Tab bar - HORIZONTAL, stretch)
│  Background: rgb(255, 255, 255)
│  Border bottom: 1px solid rgb(229, 231, 235) #E5E7EB
│  ├─ FRAME (Tab - Upcoming, flex: 1)
│  │  Padding: 16px vertical
│  │  Align: center
│  │  Border bottom: 2px solid rgb(59, 130, 246) #3B82F6
│  │  └─ TEXT "Upcoming (5)"
│  │     Font: Inter Medium 15px
│  │     Color: rgb(59, 130, 246) #3B82F6
│  └─ FRAME (Tab - Completed, flex: 1)
│     Padding: 16px vertical
│     Align: center
│     └─ TEXT "Completed (12)"
│        Font: Inter Medium 15px
│        Color: rgb(107, 114, 128) #6B7280
└─ FRAME (List - VERTICAL, 12px spacing)
   Padding: 16px
   ├─ INSTANCE: JobCard (from Component Library)
   ├─ INSTANCE: JobCard (from Component Library)
   └─ INSTANCE: JobCard (from Component Library)
```

#### 3.4 JobDetailScreen (375×812px)
```
FRAME "JobDetailScreen" (VERTICAL, stretch, ScrollView)
Background: rgb(255, 255, 255)
├─ FRAME (Header - HORIZONTAL, space-between)
│  Padding: 20px
│  Border bottom: 1px solid rgb(229, 231, 235) #E5E7EB
│  ├─ TEXT "Lawn Mowing"
│  │  Font: Inter Bold 24px
│  │  Color: rgb(0, 0, 0)
│  └─ FRAME (Status badge)
│     Background: rgb(59, 130, 246) #3B82F6
│     Padding: 6px 12px
│     Border radius: 12px
│     └─ TEXT "scheduled"
│        Font: Inter SemiBold 12px
│        Color: rgb(255, 255, 255)
│        Transform: capitalize
├─ FRAME (Reminder CTA - VERTICAL, 12px spacing)
│  Background: rgb(254, 243, 199) #FEF3C7
│  Padding: 16px
│  Margin: 16px
│  Border radius: 8px
│  Border left: 4px solid rgb(245, 158, 11) #F59E0B
│  ├─ TEXT "⏰ Reminder: Stage 2"
│  │  Font: Inter SemiBold 16px
│  │  Color: rgb(146, 64, 14) #92400E
│  ├─ TEXT "Your service is scheduled soon. Please confirm you're ready."
│  │  Font: Inter Regular 14px
│  │  Color: rgb(120, 53, 15) #78350F
│  └─ FRAME (Button)
│     Background: rgb(245, 158, 11) #F59E0B
│     Padding: 10px vertical
│     Border radius: 6px
│     Align: center
│     └─ TEXT "Acknowledge"
│        Font: Inter SemiBold 14px
│        Color: rgb(255, 255, 255)
├─ FRAME (Review CTA - VERTICAL, 12px spacing)
│  Background: rgb(219, 234, 254) #DBEAFE
│  Padding: 16px
│  Margin: 16px
│  Border radius: 8px
│  Border left: 4px solid rgb(59, 130, 246) #3B82F6
│  ├─ TEXT "✨ How was your service?"
│  │  Font: Inter SemiBold 16px
│  │  Color: rgb(30, 58, 138) #1E3A8A
│  ├─ TEXT "Share your feedback to help us improve"
│  │  Font: Inter Regular 14px
│  │  Color: rgb(30, 64, 175) #1E40AF
│  └─ FRAME (Button)
│     Background: rgb(59, 130, 246) #3B82F6
│     Padding: 10px vertical
│     Border radius: 6px
│     Align: center
│     └─ TEXT "Leave a Review"
│        Font: Inter SemiBold 14px
│        Color: rgb(255, 255, 255)
├─ INSTANCE: QAPhotoViewer (from Component Library)
│  Margin: 16px horizontal
└─ FRAME (Details - VERTICAL, 16px spacing)
   Padding: 20px
   ├─ TEXT "Details"
   │  Font: Inter SemiBold 18px
   │  Color: rgb(0, 0, 0)
   ├─ FRAME (Row - VERTICAL, 4px spacing)
   │  ├─ TEXT "Address:"
   │  │  Font: Inter Regular 14px
   │  │  Color: rgb(102, 102, 102)
   │  └─ TEXT "123 Main Street, City, State 12345"
   │     Font: Inter Regular 16px
   │     Color: rgb(0, 0, 0)
   └─ FRAME (Row - VERTICAL, 4px spacing)
      ├─ TEXT "Scheduled:"
      │  Font: Inter Regular 14px
      │  Color: rgb(102, 102, 102)
      └─ TEXT "Monday, January 15, 2026 at 10:00 AM"
         Font: Inter Regular 16px
         Color: rgb(0, 0, 0)
```

#### 3.5 ReviewPromptScreen (375×812px)
```
FRAME "ReviewPromptScreen" (VERTICAL, 20px spacing)
Background: rgb(255, 255, 255)
Padding: 20px
├─ TEXT "How was your service?"
│  Font: Inter Bold 24px
│  Color: rgb(0, 0, 0)
│  Align: center
├─ TEXT "Lawn Mowing at 123 Main St"
│  Font: Inter Regular 14px
│  Color: rgb(102, 102, 102)
│  Align: center
├─ FRAME (Star rating - HORIZONTAL, 12px gap, center)
│  ├─ TEXT "☆" (Font: Inter Regular 48px, Color: rgb(209, 213, 219) #D1D5DB)
│  ├─ TEXT "☆"
│  ├─ TEXT "☆"
│  ├─ TEXT "☆"
│  └─ TEXT "☆"
├─ FRAME (Feedback section - VERTICAL, 12px spacing)
│  ├─ TEXT "We're sorry to hear that. What could we improve?"
│  │  Font: Inter SemiBold 16px
│  │  Color: rgb(0, 0, 0)
│  └─ FRAME (TextInput)
│     Background: rgb(255, 255, 255)
│     Border: 1px solid rgb(209, 213, 219) #D1D5DB
│     Border radius: 8px
│     Padding: 12px
│     Min height: 100px
│     └─ TEXT "Tell us what went wrong..."
│        Font: Inter Regular 16px
│        Color: rgb(156, 163, 175) #9CA3AF
└─ FRAME (Submit button)
   Background: rgb(59, 130, 246) #3B82F6
   Padding: 16px
   Border radius: 8px
   Align: center
   └─ TEXT "Submit Review"
      Font: Inter SemiBold 16px
      Color: rgb(255, 255, 255)
```

#### 3.6 ServiceCatalogScreen (375×812px)
```
FRAME "ServiceCatalogScreen" (VERTICAL, stretch)
Background: rgb(249, 250, 251) #F9FAFB
└─ FRAME (List - VERTICAL, 12px spacing)
   Padding: 16px
   ├─ INSTANCE: ServiceCard (from Component Library)
   ├─ INSTANCE: ServiceCard (from Component Library)
   ├─ INSTANCE: ServiceCard (from Component Library)
   └─ INSTANCE: ServiceCard (from Component Library)
```

#### 3.7 RequestServiceScreen (375×812px)
```
FRAME "RequestServiceScreen" (VERTICAL, stretch, ScrollView)
Background: rgb(255, 255, 255)
├─ FRAME (Service info - VERTICAL, 8px spacing)
│  Padding: 20px
│  Border bottom: 1px solid rgb(229, 231, 235) #E5E7EB
│  ├─ TEXT "Service"
│  │  Font: Inter SemiBold 14px
│  │  Color: rgb(102, 102, 102)
│  ├─ TEXT "Lawn Mowing"
│  │  Font: Inter SemiBold 18px
│  │  Color: rgb(0, 0, 0)
│  └─ TEXT "Regular lawn cutting and trimming service"
│     Font: Inter Regular 14px
│     Color: rgb(102, 102, 102)
├─ FRAME (Date section - VERTICAL, 8px spacing)
│  Padding: 20px
│  Border bottom: 1px solid rgb(229, 231, 235) #E5E7EB
│  ├─ TEXT "Preferred Date (optional)"
│  │  Font: Inter SemiBold 14px
│  │  Color: rgb(102, 102, 102)
│  └─ FRAME (TextInput)
│     Background: rgb(255, 255, 255)
│     Border: 1px solid rgb(209, 213, 219) #D1D5DB
│     Border radius: 8px
│     Padding: 12px
│     └─ TEXT "ASAP (or YYYY-MM-DD)"
│        Font: Inter Regular 16px
│        Color: rgb(156, 163, 175) #9CA3AF
├─ FRAME (Notes section - VERTICAL, 8px spacing)
│  Padding: 20px
│  Border bottom: 1px solid rgb(229, 231, 235) #E5E7EB
│  ├─ TEXT "Notes (optional, max 200 chars)"
│  │  Font: Inter SemiBold 14px
│  │  Color: rgb(102, 102, 102)
│  ├─ FRAME (TextInput)
│  │  Background: rgb(255, 255, 255)
│  │  Border: 1px solid rgb(209, 213, 219) #D1D5DB
│  │  Border radius: 8px
│  │  Padding: 12px
│  │  Min height: 100px
│  │  └─ TEXT "Any special instructions..."
│  │     Font: Inter Regular 16px
│  │     Color: rgb(156, 163, 175) #9CA3AF
│  └─ TEXT "0/200"
│     Font: Inter Regular 12px
│     Color: rgb(153, 153, 153) #999999
│     Align: right
└─ FRAME (Submit button)
   Background: rgb(59, 130, 246) #3B82F6
   Margin: 20px
   Padding: 16px
   Border radius: 8px
   Align: center
   └─ TEXT "Submit Request"
      Font: Inter SemiBold 16px
      Color: rgb(255, 255, 255)
```

#### 3.8 ServiceRequestDetailScreen (375×812px)
```
FRAME "ServiceRequestDetailScreen" (VERTICAL, stretch, ScrollView)
Background: rgb(255, 255, 255)
├─ FRAME (Status card - VERTICAL, 8px spacing)
│  Background: rgb(219, 234, 254) #DBEAFE
│  Padding: 20px
│  Margin: 16px
│  Border radius: 8px
│  Border left: 4px solid rgb(59, 130, 246) #3B82F6
│  ├─ TEXT "⏳ Request Pending"
│  │  Font: Inter SemiBold 18px
│  │  Color: rgb(30, 58, 138) #1E3A8A
│  └─ TEXT "Your request is being reviewed. We'll notify you once it's processed."
│     Font: Inter Regular 14px
│     Color: rgb(30, 64, 175) #1E40AF
└─ FRAME (Details - VERTICAL, 16px spacing)
   Padding: 20px
   ├─ TEXT "Service Details"
   │  Font: Inter SemiBold 18px
   │  Color: rgb(0, 0, 0)
   ├─ FRAME (Row - VERTICAL, 4px spacing)
   │  ├─ TEXT "Service:"
   │  │  Font: Inter Regular 14px
   │  │  Color: rgb(102, 102, 102)
   │  └─ TEXT "Lawn Mowing"
   │     Font: Inter Regular 16px
   │     Color: rgb(0, 0, 0)
   └─ FRAME (Row - VERTICAL, 4px spacing)
      ├─ TEXT "Submitted:"
      │  Font: Inter Regular 14px
      │  Color: rgb(102, 102, 102)
      └─ TEXT "January 9, 2026, 1:30 PM"
         Font: Inter Regular 16px
         Color: rgb(0, 0, 0)
```

#### 3.9 NotificationCenterScreen (375×812px)
```
FRAME "NotificationCenterScreen" (VERTICAL, stretch)
Background: rgb(249, 250, 251) #F9FAFB
└─ FRAME (List - VERTICAL, 12px spacing)
   Padding: 16px
   ├─ INSTANCE: NotificationCard (from Component Library)
   ├─ INSTANCE: NotificationCard (from Component Library)
   ├─ INSTANCE: NotificationCard (from Component Library)
   └─ INSTANCE: NotificationCard (from Component Library)
```

#### 3.10 SettingsScreen (375×812px)
```
FRAME "SettingsScreen" (VERTICAL, 24px spacing)
Background: rgb(255, 255, 255)
Padding: 20px
├─ TEXT "Settings"
│  Font: Inter Bold 24px
│  Color: rgb(0, 0, 0)
├─ FRAME (Email section - VERTICAL, 4px spacing)
│  ├─ TEXT "Email"
│  │  Font: Inter Regular 14px
│  │  Color: rgb(102, 102, 102)
│  └─ TEXT "user@example.com"
│     Font: Inter Regular 16px
│     Color: rgb(0, 0, 0)
└─ FRAME (Logout button)
   Background: rgb(239, 68, 68) #EF4444
   Padding: 16px
   Border radius: 8px
   Align: center
   └─ TEXT "Logout"
      Font: Inter SemiBold 16px
      Color: rgb(255, 255, 255)
```

### MCP Actions Needed
For each screen 3.1-3.10:
1. Navigate to "👤 Customer Screens" page
2. Create 375×812px frame with screen name
3. Build nested structure per specifications
4. Insert component instances where specified
5. Apply Auto Layout, spacing, colors, typography
6. Position screens in organized grid (2 columns)

### Success Criteria
- [ ] All 10 Customer screens created
- [ ] All screens are 375×812px
- [ ] Component instances properly linked
- [ ] Auto Layout applied correctly
- [ ] All text, colors, spacing match specs

---

## 🎯 STEP 4: CREATE OWNER/STAFF SCREENS

### Task
Create 2 staff screen variants

### Screen Specifications

#### 4.1 DashboardScreen (Owner) - 375×812px
**Page:** "👔 Owner Screens"

```
FRAME "DashboardScreen (Owner)" (VERTICAL, stretch, ScrollView)
Background: rgb(245, 245, 245) #F5F5F5
├─ FRAME (Header - VERTICAL, 4px spacing)
│  Background: rgb(255, 255, 255)
│  Padding: 16px
│  Border bottom: 1px solid rgb(224, 224, 224) #E0E0E0
│  ├─ TEXT "Today's Overview"
│  │  Font: Inter Bold 24px
│  │  Color: rgb(51, 51, 51) #333333
│  └─ TEXT "Monday, January 9, 2026"
│     Font: Inter Regular 14px
│     Color: rgb(102, 102, 102) #666666
├─ FRAME (Warning banner - optional)
│  Background: rgb(255, 243, 224) #FFF3E0
│  Padding: 16px
│  Margin: 16px
│  Border radius: 8px
│  └─ TEXT "⚠ 3 action(s) pending sync"
│     Font: Inter SemiBold 14px
│     Color: rgb(230, 81, 0) #E65100
├─ FRAME (Stats grid - 2 columns, wrap, 8px gap)
│  Padding: 8px
│  ├─ FRAME (Stat card - VERTICAL, center)
│  │  Background: rgb(255, 255, 255)
│  │  Padding: 16px
│  │  Border radius: 8px
│  │  Border left: 4px solid rgb(33, 150, 243) #2196F3
│  │  Min width: 47%
│  │  Margin: 8px
│  │  Shadow: 0 1px 3px rgba(0, 0, 0, 0.1)
│  │  ├─ TEXT "8"
│  │  │  Font: Inter Bold 32px
│  │  │  Color: rgb(51, 51, 51) #333333
│  │  └─ TEXT "Jobs Today"
│  │     Font: Inter Regular 12px
│  │     Color: rgb(102, 102, 102) #666666
│  ├─ FRAME (Stat card - orange border)
│  │  ├─ TEXT "3"
│  │  └─ TEXT "In Progress"
│  ├─ FRAME (Stat card - green border)
│  │  ├─ TEXT "2"
│  │  └─ TEXT "Completed"
│  └─ FRAME (Stat card - red border)
│     ├─ TEXT "1"
│     └─ TEXT "Unassigned"
└─ FRAME (Crew card - VERTICAL, 12px spacing)
   Background: rgb(255, 255, 255)
   Padding: 16px
   Margin: 16px
   Border radius: 8px
   Shadow: 0 1px 3px rgba(0, 0, 0, 0.1)
   ├─ TEXT "Crew Status"
   │  Font: Inter SemiBold 16px
   │  Color: rgb(0, 0, 0)
   ├─ FRAME (Row - HORIZONTAL, space-between)
   │  Padding: 8px vertical
   │  ├─ TEXT "Available:"
   │  │  Font: Inter Regular 14px
   │  │  Color: rgb(102, 102, 102)
   │  └─ TEXT "4"
   │     Font: Inter SemiBold 14px
   │     Color: rgb(51, 51, 51)
   ├─ FRAME (Row - HORIZONTAL, space-between)
   │  Padding: 8px vertical
   │  ├─ TEXT "On Job:"
   │  │  Font: Inter Regular 14px
   │  │  Color: rgb(102, 102, 102)
   │  └─ TEXT "2"
   │     Font: Inter SemiBold 14px
   │     Color: rgb(51, 51, 51)
   └─ FRAME (Button)
      Background: rgb(59, 130, 246) #3B82F6
      Padding: 12px
      Border radius: 6px
      Align: center
      └─ TEXT "View Crews"
         Font: Inter SemiBold 14px
         Color: rgb(255, 255, 255)
```

#### 4.2 DashboardScreen (Crew Leader) - 375×812px
**Page:** "👷 Crew Leader Screens"

```
FRAME "DashboardScreen (Crew Leader)" (VERTICAL, stretch, ScrollView)
Background: rgb(245, 245, 245) #F5F5F5
├─ FRAME (Header - VERTICAL, 4px spacing)
│  Background: rgb(255, 255, 255)
│  Padding: 16px
│  Border bottom: 1px solid rgb(224, 224, 224) #E0E0E0
│  ├─ TEXT "Today's Route"
│  │  Font: Inter Bold 24px
│  │  Color: rgb(51, 51, 51) #333333
│  └─ TEXT "Monday, January 9, 2026"
│     Font: Inter Regular 14px
│     Color: rgb(102, 102, 102) #666666
├─ FRAME (Summary card - VERTICAL, 8px spacing)
│  Background: rgb(255, 255, 255)
│  Padding: 16px
│  Margin: 16px
│  Border radius: 8px
│  Shadow: 0 1px 3px rgba(0, 0, 0, 0.1)
│  ├─ FRAME (Row - HORIZONTAL, space-between)
│  │  Padding: 8px vertical
│  │  ├─ TEXT "Total Jobs:"
│  │  │  Font: Inter Regular 16px
│  │  │  Color: rgb(102, 102, 102)
│  │  └─ TEXT "5"
│  │     Font: Inter SemiBold 16px
│  │     Color: rgb(51, 51, 51)
│  └─ FRAME (Row - HORIZONTAL, space-between)
│     Padding: 8px vertical
│     ├─ TEXT "Completed:"
│     │  Font: Inter Regular 16px
│     │  Color: rgb(102, 102, 102)
│     └─ TEXT "2"
│        Font: Inter SemiBold 16px
│        Color: rgb(51, 51, 51)
└─ FRAME (Jobs list - VERTICAL, 12px spacing)
   Padding: 16px
   ├─ TEXT "Today's Jobs"
   │  Font: Inter SemiBold 18px
   │  Color: rgb(51, 51, 51)
   └─ FRAME (Job card - VERTICAL, 8px spacing)
      Background: rgb(255, 255, 255)
      Padding: 16px
      Border radius: 8px
      Shadow: 0 1px 3px rgba(0, 0, 0, 0.1)
      ├─ FRAME (Header - HORIZONTAL, space-between)
      │  ├─ TEXT "John Smith"
      │  │  Font: Inter SemiBold 16px
      │  │  Color: rgb(51, 51, 51)
      │  └─ FRAME (Status badge)
      │     Background: rgb(227, 242, 253) #E3F2FD
      │     Padding: 4px 8px
      │     Border radius: 12px
      │     └─ TEXT "scheduled"
      │        Font: Inter SemiBold 10px
      │        Color: rgb(51, 51, 51)
      ├─ TEXT "123 Main Street, City, State"
      │  Font: Inter Regular 14px
      │  Color: rgb(102, 102, 102)
      ├─ TEXT "Lawn Mowing"
      │  Font: Inter Regular 14px
      │  Color: rgb(33, 150, 243) #2196F3
      └─ TEXT "10:00 AM"
         Font: Inter Regular 12px
         Color: rgb(153, 153, 153)
```

### MCP Actions Needed
1. Navigate to "👔 Owner Screens" page, create screen 4.1
2. Navigate to "👷 Crew Leader Screens" page, create screen 4.2
3. Build structures per specifications
4. Apply responsive stat card grid layout

### Success Criteria
- [ ] Owner Dashboard created on Owner Screens page
- [ ] Crew Leader Dashboard created on Crew Leader Screens page
- [ ] Both screens are 375×812px
- [ ] Stat cards use 2-column responsive grid
- [ ] All typography and colors match

---

## 🎯 STEP 5: APPLY DESIGN SYSTEM STYLES

### Task
Create 60 reusable design system styles

### 5.1 Color Styles (24 total)

**Primary Colors:**
- `Primary/main` → rgb(59, 130, 246) #3B82F6
- `Primary/light` → rgb(219, 234, 254) #DBEAFE
- `Primary/dark` → rgb(30, 64, 175) #1E40AF

**Success Colors:**
- `Success/main` → rgb(34, 197, 94) #22C55E
- `Success/light` → rgb(209, 250, 229) #D1FAE5
- `Success/dark` → rgb(6, 95, 70) #065F46

**Warning Colors:**
- `Warning/main` → rgb(245, 158, 11) #F59E0B
- `Warning/light` → rgb(254, 243, 199) #FEF3C7
- `Warning/dark` → rgb(146, 64, 14) #92400E

**Error Colors:**
- `Error/main` → rgb(239, 68, 68) #EF4444
- `Error/light` → rgb(254, 226, 226) #FEE2E2
- `Error/dark` → rgb(153, 27, 27) #991B1B

**Neutral Colors:**
- `Neutral/white` → rgb(255, 255, 255) #FFFFFF
- `Neutral/gray50` → rgb(249, 250, 251) #F9FAFB
- `Neutral/gray100` → rgb(245, 245, 245) #F5F5F5
- `Neutral/gray200` → rgb(229, 231, 235) #E5E7EB
- `Neutral/gray300` → rgb(209, 213, 219) #D1D5DB
- `Neutral/gray500` → rgb(107, 114, 128) #6B7280
- `Neutral/gray600` → rgb(102, 102, 102) #666666
- `Neutral/gray700` → rgb(51, 51, 51) #333333
- `Neutral/gray900` → rgb(17, 24, 39) #111827
- `Neutral/black` → rgb(0, 0, 0) #000000

### 5.2 Text Styles (32 total)

**Font:** Inter
**Combinations:** 8 sizes × 4 weights

| Name | Size | Weight | Font |
|------|------|--------|------|
| xs/regular | 10px | 400 | Inter Regular |
| xs/medium | 10px | 500 | Inter Medium |
| xs/semibold | 10px | 600 | Inter SemiBold |
| xs/bold | 10px | 700 | Inter Bold |
| sm/regular | 12px | 400 | Inter Regular |
| sm/medium | 12px | 500 | Inter Medium |
| sm/semibold | 12px | 600 | Inter SemiBold |
| sm/bold | 12px | 700 | Inter Bold |
| base/regular | 14px | 400 | Inter Regular |
| base/medium | 14px | 500 | Inter Medium |
| base/semibold | 14px | 600 | Inter SemiBold |
| base/bold | 14px | 700 | Inter Bold |
| md/regular | 15px | 400 | Inter Regular |
| md/medium | 15px | 500 | Inter Medium |
| md/semibold | 15px | 600 | Inter SemiBold |
| md/bold | 15px | 700 | Inter Bold |
| lg/regular | 16px | 400 | Inter Regular |
| lg/medium | 16px | 500 | Inter Medium |
| lg/semibold | 16px | 600 | Inter SemiBold |
| lg/bold | 16px | 700 | Inter Bold |
| xl/regular | 18px | 400 | Inter Regular |
| xl/medium | 18px | 500 | Inter Medium |
| xl/semibold | 18px | 600 | Inter SemiBold |
| xl/bold | 18px | 700 | Inter Bold |
| 2xl/regular | 24px | 400 | Inter Regular |
| 2xl/medium | 24px | 500 | Inter Medium |
| 2xl/semibold | 24px | 600 | Inter SemiBold |
| 2xl/bold | 24px | 700 | Inter Bold |
| 3xl/regular | 32px | 400 | Inter Regular |
| 3xl/medium | 32px | 500 | Inter Medium |
| 3xl/semibold | 32px | 600 | Inter SemiBold |
| 3xl/bold | 32px | 700 | Inter Bold |

### 5.3 Effect Styles (4 total)

**Shadow/sm:**
- Type: Drop Shadow
- X: 0, Y: 1
- Blur: 2px
- Color: rgba(0, 0, 0, 0.1)

**Shadow/base:**
- Type: Drop Shadow
- X: 0, Y: 2
- Blur: 4px
- Color: rgba(0, 0, 0, 0.1)

**Shadow/md:**
- Type: Drop Shadow
- X: 0, Y: 4
- Blur: 6px
- Color: rgba(0, 0, 0, 0.1)

**Shadow/lg:**
- Type: Drop Shadow
- X: 0, Y: 10
- Blur: 15px
- Color: rgba(0, 0, 0, 0.15)

### MCP Actions Needed
1. Open Figma file styles panel
2. Create all 24 color styles with "/" hierarchy
3. Create all 32 text styles with "/" hierarchy
4. Create all 4 effect (shadow) styles with "/" hierarchy
5. Apply styles to existing components/screens where applicable

### Success Criteria
- [ ] All 24 color styles created
- [ ] All 32 text styles created
- [ ] All 4 effect styles created
- [ ] Styles organized with "/" separators
- [ ] Styles applied to components where possible

---

## 🎯 STEP 6: LINK NAVIGATION PROTOTYPES

### Task
Add 15 interactive prototype links between screens

### Prototype Links

**1. InviteLoginScreen → HomeScreen**
- From: InviteLoginScreen frame
- To: HomeScreen frame
- Trigger: After delay (2 seconds) or On Load
- Animation: Dissolve
- Duration: 300ms
- Easing: Ease Out

**2. HomeScreen → ServiceCatalogScreen**
- From: "Request New Service" button in HomeScreen
- To: ServiceCatalogScreen frame
- Trigger: On Click
- Animation: Smart Animate
- Duration: 300ms
- Easing: Ease In Out

**3. HomeScreen → JobsScreen**
- From: "View" button in ReminderBanner (HomeScreen)
- To: JobsScreen frame
- Trigger: On Click
- Animation: Smart Animate
- Duration: 300ms

**4. JobsScreen → JobDetailScreen**
- From: Any JobCard instance in JobsScreen
- To: JobDetailScreen frame
- Trigger: On Click
- Animation: Smart Animate
- Duration: 300ms

**5. JobDetailScreen → ReviewPromptScreen**
- From: "Leave a Review" button in JobDetailScreen
- To: ReviewPromptScreen frame
- Trigger: On Click
- Animation: Smart Animate
- Duration: 300ms

**6. ReviewPromptScreen → JobDetailScreen**
- From: "Submit Review" button in ReviewPromptScreen
- To: JobDetailScreen frame
- Trigger: On Click
- Animation: Smart Animate (back)
- Duration: 300ms
- Direction: Back/Previous

**7. ServiceCatalogScreen → RequestServiceScreen**
- From: Any ServiceCard instance in ServiceCatalogScreen
- To: RequestServiceScreen frame
- Trigger: On Click
- Animation: Smart Animate
- Duration: 300ms

**8. RequestServiceScreen → ServiceRequestDetailScreen**
- From: "Submit Request" button in RequestServiceScreen
- To: ServiceRequestDetailScreen frame
- Trigger: On Click
- Animation: Smart Animate
- Duration: 300ms

**9. NotificationCenterScreen → JobDetailScreen**
- From: First NotificationCard in NotificationCenterScreen
- To: JobDetailScreen frame
- Trigger: On Click
- Animation: Smart Animate
- Duration: 300ms
- Note: Represents JOB_ADDED notification type

**10. NotificationCenterScreen → ServiceRequestDetailScreen**
- From: Second NotificationCard in NotificationCenterScreen
- To: ServiceRequestDetailScreen frame
- Trigger: On Click
- Animation: Smart Animate
- Duration: 300ms
- Note: Represents service_request_update notification type

**11. SettingsScreen → InviteLoginScreen**
- From: "Logout" button in SettingsScreen
- To: InviteLoginScreen frame
- Trigger: On Click
- Animation: Dissolve
- Duration: 300ms

**12. DashboardScreen (Owner) → JobDetailScreen**
- From: Any job reference in Owner Dashboard
- To: JobDetailScreen frame
- Trigger: On Click
- Animation: Smart Animate
- Duration: 300ms

**13. DashboardScreen (Owner) → [Future CrewsScreen]**
- From: "View Crews" button in Owner Dashboard
- To: Placeholder or JobsScreen
- Trigger: On Click
- Animation: Smart Animate
- Duration: 300ms
- Note: CrewsScreen not implemented yet

**14. DashboardScreen (Crew Leader) → JobDetailScreen**
- From: Job card in Crew Leader Dashboard
- To: JobDetailScreen frame
- Trigger: On Click
- Animation: Smart Animate
- Duration: 300ms

**15. HomeScreen → JobDetailScreen** (Alternative flow)
- From: Job reference in "Upcoming Services" section
- To: JobDetailScreen frame
- Trigger: On Click
- Animation: Smart Animate
- Duration: 300ms

### MCP Actions Needed
1. Switch to Prototype mode in Figma
2. For each link 1-15:
   - Select source element/frame
   - Add interaction
   - Set trigger type (On Click, After Delay, etc.)
   - Select destination frame
   - Set animation (Smart Animate, Dissolve, etc.)
   - Set duration (300ms)
   - Set easing (Ease In Out)
3. Test prototype flows

### Success Criteria
- [ ] All 15 prototype links created
- [ ] Correct triggers set (On Click, After Delay)
- [ ] Smart Animate used for most transitions
- [ ] All durations set to 300ms
- [ ] Prototype mode preview works correctly

---

## 🎯 STEP 7: VALIDATE & SHARE

### Validation Checklist

**File Structure:**
- [ ] File named "LawnFlow Mobile App - Auto-Generated"
- [ ] All 7 pages created and named correctly

**Component Library:**
- [ ] 8 components exist on Component Library page
- [ ] All components marked as Figma components
- [ ] Components use Auto Layout where specified

**Customer Screens:**
- [ ] All 10 Customer screens created (375×812px)
- [ ] Component instances properly linked
- [ ] Auto Layout applied correctly
- [ ] All text content present

**Staff Screens:**
- [ ] Owner Dashboard created
- [ ] Crew Leader Dashboard created
- [ ] Stat cards use responsive grid

**Design System:**
- [ ] 24 color styles created and organized
- [ ] 32 text styles created (Inter font)
- [ ] 4 shadow effects created

**Prototypes:**
- [ ] All 15 navigation links working
- [ ] Smart Animate transitions smooth
- [ ] Prototype flows make sense

**Quality:**
- [ ] No overlapping elements
- [ ] Consistent spacing throughout
- [ ] All colors match design system
- [ ] Typography consistent (Inter font)
- [ ] Components reused effectively

### Share Figma File

**Steps:**
1. Click "Share" button in Figma
2. Set permissions:
   - Viewer: Anyone with link can view
   - Editor: Specific team members only
3. Copy share link
4. Document file URL below:

```
Figma File URL: ________________________________
```

**Share with:**
- [ ] Product team
- [ ] Design team
- [ ] Engineering team
- [ ] Stakeholders

### Final Documentation

**Update project documentation:**
- [ ] Add Figma file link to project README
- [ ] Document component usage guidelines
- [ ] Create developer handoff notes
- [ ] Export design tokens/specifications

---

## ✅ EXECUTION COMPLETE

**Final Statistics:**
- ✅ 1 Figma file created
- ✅ 7 pages organized
- ✅ 8 reusable components
- ✅ 12 screen frames (375×812px)
- ✅ 60 design system styles
- ✅ 15 interactive prototypes
- ✅ ~500+ total Figma nodes

**Next Steps:**
1. Review with stakeholders
2. Gather feedback
3. Iterate on designs
4. Begin developer handoff
5. Maintain sync with mobile codebase

---

**Execution Log Complete**
**Date:** 2026-01-09
**Status:** ✅ Ready for execution with MCP Figma extension
