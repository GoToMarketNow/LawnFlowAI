# LawnFlow Figma Integration Guide

## 🎉 Status: READY FOR FIGMA GENERATION

The complete UX metadata extraction and Figma automation pipeline is now ready to use with your MCP Figma extension.

---

## 📦 Generated Artifacts

### 1. UX Metadata (Source of Truth)
**Location:** `/workspaces/LawnFlowAI/figma-ux-metadata.json`

Complete extracted metadata from the React Native mobile app:
- **12 screens** across 4 user roles (Customer, Owner, Crew Leader, Crew)
- **8 reusable components** with full layout trees
- **15 navigation flows** with triggers and destinations
- Complete style metadata (colors, typography, spacing, shadows)
- Auto Layout instructions derived from flexbox

### 2. Execution Plan
**Location:** `/workspaces/LawnFlowAI/figma-automation/output/execution-plan.json`

Ready-to-execute Figma generation plan with 5 steps:
1. **CREATE_FILE** - File and page structure
2. **CREATE_COMPONENTS** - 8 component definitions
3. **CREATE_SCREENS** - 12 screen frames with Auto Layout
4. **APPLY_STYLES** - 60 design system styles (colors, text, effects)
5. **CREATE_PROTOTYPES** - 15 interactive navigation links

### 3. Human-Readable Summary
**Location:** `/workspaces/LawnFlowAI/figma-automation/output/generation-summary.md`

Detailed breakdown of all screens, components, and implementation options.

### 4. Configuration Files
- **Theme:** `/workspaces/LawnFlowAI/figma-automation/config/theme.json`
- **Component Mappings:** `/workspaces/LawnFlowAI/figma-automation/config/component-mappings.json`

---

## 🚀 Using MCP Figma Extension

### Prerequisites
✅ MCP Figma extension is configured
✅ Figma Personal Access Token is set
✅ Execution plan is generated

### Execution Steps

#### Step 1: Create Figma File
Use MCP to create a new Figma file with the structure from the execution plan:

```json
{
  "name": "LawnFlow Mobile App - Auto-Generated",
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

#### Step 2: Generate Component Library
Create 8 reusable components on the "Component Library" page:

**Components to create:**
1. LoadingSpinner
2. NotificationBanner
3. JobCard
4. ReminderBanner
5. QAPhotoViewer
6. ServiceCard
7. NotificationCard
8. JobActionsPanel

Each component structure is available in:
```
execution-plan.json → steps[1].data[component_index]
```

#### Step 3: Generate Screen Frames
Create screen frames organized by user role:

**Customer Screens (10):**
- InviteLoginScreen
- HomeScreen
- JobsScreen
- JobDetailScreen
- ReviewPromptScreen
- ServiceCatalogScreen
- RequestServiceScreen
- ServiceRequestDetailScreen
- NotificationCenterScreen
- SettingsScreen

**Staff Screens (2):**
- DashboardScreen (Owner variant)
- DashboardScreen (Crew Leader variant)

Frame specifications:
- Width: 375px (iPhone 13 Pro)
- Height: 812px
- Background: #FFFFFF
- Auto Layout enabled

#### Step 4: Apply Design System Styles

**Color Styles (24):**
- Primary: main, light, dark
- Success: main, light, dark
- Warning: main, light, dark
- Error: main, light, dark
- Neutral: white → gray900, black

**Text Styles (32):**
- Sizes: xs (10px) → 3xl (32px)
- Weights: regular (400), medium (500), semibold (600), bold (700)
- Font: Inter

**Effect Styles (4):**
- Shadow: sm, base, md, lg

#### Step 5: Link Prototypes
Add interactive navigation between screens:

**Key Flows:**
1. Login → Home (auto-navigation)
2. Home → Services (button tap)
3. Services → Request Form (card tap)
4. Jobs List → Job Detail (card tap)
5. Job Detail → Review (button tap)

See `execution-plan.json → steps[4].data` for all 15 flows.

---

## 📋 Execution Plan Structure

The execution plan JSON contains 5 top-level steps. Here's how to use each:

### Step 1: CREATE_FILE
```json
{
  "step": 1,
  "action": "CREATE_FILE",
  "data": {
    "name": "LawnFlow Mobile App - Auto-Generated",
    "pages": [...]
  }
}
```

**MCP Action:** Create new Figma file with specified pages

---

### Step 2: CREATE_COMPONENTS
```json
{
  "step": 2,
  "action": "CREATE_COMPONENTS",
  "data": [
    {
      "name": "JobCard",
      "type": "COMPONENT",
      "children": [ ... nested layout tree ... ]
    }
  ]
}
```

**MCP Action:** For each component:
1. Create component frame on "Component Library" page
2. Build nested layout from `children` array
3. Apply styles from each child node's `styles` object
4. Set Auto Layout properties where `layoutMode` is defined

---

### Step 3: CREATE_SCREENS
```json
{
  "step": 3,
  "action": "CREATE_SCREENS",
  "data": {
    "Customer": [ ... array of screen frames ... ],
    "Owner": [ ... ],
    "CrewLeader": [ ... ],
    "Crew": [ ... ]
  }
}
```

**MCP Action:** For each user role:
1. Navigate to the role's page
2. For each screen in the role's array:
   - Create a 375×812px frame
   - Build nested layout from `children` array
   - Apply Auto Layout (layoutMode, alignment, spacing)
   - Apply fills, strokes, corner radius, effects
   - Add text content where `characters` is present

---

### Step 4: APPLY_STYLES
```json
{
  "step": 4,
  "action": "APPLY_STYLES",
  "data": {
    "colorStyles": [ ... ],
    "textStyles": [ ... ],
    "effectStyles": [ ... ]
  }
}
```

**MCP Action:**
1. Create color styles from `colorStyles` array
2. Create text styles from `textStyles` array
3. Create effect styles (shadows) from `effectStyles` array
4. Organize with "/" separators for hierarchy (e.g., "Primary/main")

---

### Step 5: CREATE_PROTOTYPES
```json
{
  "step": 5,
  "action": "CREATE_PROTOTYPES",
  "data": [
    {
      "from": "HomeScreen",
      "to": "ServiceCatalogScreen",
      "trigger": "request-service-button",
      "transitionType": "ON_CLICK",
      "animation": "SMART_ANIMATE",
      "duration": 300
    }
  ]
}
```

**MCP Action:** For each link:
1. Find the source frame (from screen)
2. Find the target frame (to screen)
3. Add prototype interaction with specified trigger
4. Set transition animation and duration

---

## 🎨 Design System Reference

### Color Palette
```
Primary:   #3B82F6  (Blue)
Success:   #22C55E  (Green)
Warning:   #F59E0B  (Amber)
Error:     #EF4444  (Red)

Neutral:
  White:   #FFFFFF
  Gray 50: #F9FAFB
  Gray 100: #F5F5F5
  Gray 200: #E5E7EB
  Gray 600: #666666
  Gray 900: #111827
  Black:   #000000
```

### Typography
```
Font Family: Inter
Sizes: 10, 12, 14, 15, 16, 18, 24, 32px
Weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
Line Heights: tight (1.25), normal (1.5), relaxed (1.75)
```

### Spacing Scale
```
4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px
```

### Border Radius
```
4px (sm), 6px (base), 8px (md), 12px (lg), 16px (xl), 9999px (full)
```

### Shadows
```
sm:   y=1px  blur=2px
base: y=2px  blur=4px
md:   y=4px  blur=6px
lg:   y=10px blur=15px
```

---

## 🔄 React Native → Figma Component Mapping

| React Native | Figma Type | Auto Layout | Notes |
|--------------|------------|-------------|-------|
| `View` | `FRAME` | ✅ | Container with flexbox |
| `ScrollView` | `FRAME` | ✅ | Vertical scrolling enabled |
| `Text` | `TEXT` | ❌ | Text node with fills |
| `TextInput` | `FRAME` | ❌ | Frame with border + text placeholder |
| `TouchableOpacity` | `FRAME` | ✅ | Interactive button area |
| `Image` | `RECTANGLE` | ❌ | Image fill placeholder |
| `ActivityIndicator` | `ELLIPSE` | ❌ | Loading spinner |
| `FlatList` | `FRAME` | ✅ | Vertical Auto Layout with spacing |

### Flexbox → Auto Layout Mapping

| React Native Flexbox | Figma Auto Layout |
|----------------------|-------------------|
| `flexDirection: row` | `layoutMode: HORIZONTAL` |
| `flexDirection: column` | `layoutMode: VERTICAL` |
| `justifyContent: flex-start` | `primaryAxisAlignItems: MIN` |
| `justifyContent: center` | `primaryAxisAlignItems: CENTER` |
| `justifyContent: space-between` | `primaryAxisAlignItems: SPACE_BETWEEN` |
| `alignItems: flex-start` | `counterAxisAlignItems: MIN` |
| `alignItems: center` | `counterAxisAlignItems: CENTER` |
| `alignItems: stretch` | `counterAxisAlignItems: STRETCH` |
| `gap: N` | `itemSpacing: N` |

---

## 🛠️ Troubleshooting

### Issue: "Cannot find execution plan"
**Solution:** Run `npm run generate` from `/workspaces/LawnFlowAI/figma-automation`

### Issue: "Missing component definition"
**Solution:** Check `execution-plan.json → steps[1].data` for component structures

### Issue: "Auto Layout not applying"
**Solution:** Verify node has `layoutMode` property (HORIZONTAL or VERTICAL)

### Issue: "Text not rendering"
**Solution:** Ensure node has `characters` property with text content

### Issue: "Colors not matching"
**Solution:** Color values are in RGB 0-1 format. Multiply by 255 for 0-255 range.

---

## 📊 Generation Statistics

- **Total Screens:** 12
- **Reusable Components:** 8
- **Navigation Flows:** 15
- **Color Styles:** 24
- **Text Styles:** 32
- **Effect Styles:** 4
- **Total Figma Nodes:** ~500+ (estimated)

---

## 🎯 Next Steps

1. **Use MCP Figma Extension** to execute the plan step-by-step
2. **Validate** each screen matches the mobile app layout
3. **Test prototypes** to ensure navigation flows work correctly
4. **Export** design specs for developer handoff
5. **Share** Figma file URL with stakeholders

---

## 📞 Support

For questions about:
- **UX Metadata:** Review `/workspaces/LawnFlowAI/figma-ux-metadata.json`
- **Execution Plan:** Review `/workspaces/LawnFlowAI/figma-automation/output/execution-plan.json`
- **Generation Process:** Review `/workspaces/LawnFlowAI/figma-automation/README.md`

---

**Generated:** 2026-01-09
**Source Code:** `/workspaces/LawnFlowAI/mobile/`
**Figma Automation:** `/workspaces/LawnFlowAI/figma-automation/`
