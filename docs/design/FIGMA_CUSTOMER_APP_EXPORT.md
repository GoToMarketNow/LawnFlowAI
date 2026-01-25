# LawnFlow Customer Mobile App - Figma Design Export

**Version**: 2.0
**Date**: January 11, 2026
**Target**: Figma Make AI Tool
**Purpose**: Complete rebuild of LawnFlow customer mobile front end with payment integration

**Source Documents**:
- `/docs/design/REPO_AUDIT_AND_SOURCES.md` - Repository audit
- `/docs/design/CUSTOMER_APP_GAP_ANALYSIS.md` - Gap analysis
- `/shared/orchestrator/payment-contracts.ts` - Payment agent contracts
- `/mobile/src/screens/**/*.tsx` - Existing customer screens

---

## 1. Figma File Structure

Create a single Figma file named **"LawnFlow Customer App - Master"** with the following pages:

### Page 1: Foundations
- **Purpose**: Design tokens (colors, typography, spacing, radius, shadows)
- **Contents**: Token grid, color palette, typography scale, spacing reference

### Page 2: Components - Primitives
- **Purpose**: Atomic UI elements (buttons, inputs, badges, pills, cards)
- **Contents**: Reusable primitives with variants

### Page 3: Components - Payment
- **Purpose**: Payment-specific components
- **Contents**: Payment method cards, payment status pills, payment forms, receipts

### Page 4: Components - Job & Service
- **Purpose**: Job and service components
- **Contents**: Job cards, service cards, status badges, reminders

### Page 5: Screens - Onboarding & Auth
- **Purpose**: Invite login, onboarding, permissions
- **Contents**: InviteLogin, Welcome, NotificationPermission

### Page 6: Screens - Home & Services
- **Purpose**: Main customer flows
- **Contents**: Home, ServiceCatalog, RequestService, ServiceRequestDetail

### Page 7: Screens - Jobs
- **Purpose**: Job tracking and review
- **Contents**: Jobs, JobDetail, ReviewPrompt

### Page 8: Screens - Payment
- **Purpose**: Payment setup, management, and transactions
- **Contents**: PaymentSetup, PaymentMethods, InAppPayment, Receipt, Invoice

### Page 9: Screens - Settings
- **Purpose**: Account and payment preferences
- **Contents**: Settings, PaymentPreferences, AutopaySettings, Notifications

### Page 10: Overlays & Modals
- **Purpose**: Modals, bottom sheets, alerts
- **Contents**: All overlay patterns

---

## 2. Design Foundations (Figma Styles)

### Color Styles (Semantic)

#### Primary (Brand Blue)
```
Primary/50          #E3F2FD
Primary/100         #BBDEFB
Primary/500         #2196F3    (Main brand color)
Primary/700         #1976D2
Primary/900         #0D47A1
```

#### Success (Green)
```
Success/50          #E8F5E9
Success/500         #4CAF50    (Paid, completed)
Success/700         #388E3C
```

#### Warning (Amber/Yellow)
```
Warning/50          #FFF3E0
Warning/100         #FFE082
Warning/500         #FFC107    (Pending, reminders)
Warning/700         #F57C00
```

#### Error (Red)
```
Error/50            #FFEBEE
Error/500           #F44336    (Failed, urgent)
Error/700           #D32F2F
```

#### Neutral (Grayscale)
```
Neutral/50          #FAFAFA
Neutral/100         #F5F5F5
Neutral/200         #EEEEEE
Neutral/300         #E0E0E0    (Borders)
Neutral/400         #BDBDBD
Neutral/500         #9E9E9E
Neutral/600         #757575
Neutral/700         #616161    (Secondary text)
Neutral/800         #424242
Neutral/900         #212121    (Primary text)
Neutral/White       #FFFFFF
```

#### Payment (Specific)
```
Payment/Autopay-BG      #E8F5E9
Payment/Autopay-Text    #2E7D32
Payment/Manual-BG       #E3F2FD
Payment/Manual-Text     #1565C0
```

### Text Styles (Mobile-First)

#### Display (Large headings)
```
Display/Large
  Font: System (SF Pro / Roboto)
  Size: 28px
  Weight: Bold (700)
  Line Height: 36px
  Color: Neutral/900

Display/Medium
  Size: 24px
  Weight: Bold (700)
  Line Height: 32px
```

#### Heading
```
Heading/H1
  Size: 22px
  Weight: Bold (700)
  Line Height: 28px

Heading/H2
  Size: 18px
  Weight: SemiBold (600)
  Line Height: 24px

Heading/H3
  Size: 16px
  Weight: SemiBold (600)
  Line Height: 22px
```

#### Body
```
Body/Large
  Size: 16px
  Weight: Regular (400)
  Line Height: 24px

Body/Medium
  Size: 15px
  Weight: Regular (400)
  Line Height: 22px

Body/Small
  Size: 14px
  Weight: Regular (400)
  Line Height: 20px

Body/XSmall
  Size: 13px
  Weight: Regular (400)
  Line Height: 18px
```

#### Label (Form labels, buttons)
```
Label/Large
  Size: 16px
  Weight: SemiBold (600)
  Line Height: 22px

Label/Medium
  Size: 14px
  Weight: Medium (500)
  Line Height: 18px

Label/Small
  Size: 13px
  Weight: Medium (500)
  Line Height: 16px
```

#### Caption (Metadata, helper text)
```
Caption/Regular
  Size: 12px
  Weight: Regular (400)
  Line Height: 16px
  Color: Neutral/700

Caption/Bold
  Size: 11px
  Weight: SemiBold (600)
  Line Height: 14px
  Letter Spacing: 0.5px
  Transform: Uppercase
```

### Spacing Scale
```
spacing-2       2px
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
spacing-56      56px
spacing-64      64px
```

### Radius Scale
```
radius-4        4px   (small badges)
radius-6        6px   (buttons small)
radius-8        8px   (buttons, inputs, cards)
radius-12       12px  (large buttons, status pills)
radius-16       16px  (modals top corners)
radius-20       20px  (bottom sheets)
radius-full     9999px (pill shape, circular)
```

### Shadow/Elevation Styles
```
Shadow/1 (Card)
  Y: 1px
  Blur: 2px
  Color: #000000 @ 5%

Shadow/2 (Raised Card)
  Y: 2px
  Blur: 4px
  Color: #000000 @ 8%

Shadow/3 (Modal)
  Y: 4px
  Blur: 12px
  Color: #000000 @ 12%

Shadow/4 (Bottom Sheet)
  Y: -2px
  Blur: 16px
  Color: #000000 @ 16%
```

---

## 3. Component Library - Primitives

### Category: Buttons

#### Component: Button/Primary
**Variants**:
- Size: Small | Medium | Large
- State: Default | Pressed | Disabled | Loading

**Properties** (Size=Medium, State=Default):
- Height: 48px
- Padding: 16px horizontal
- Background: Primary/500
- Text: Label/Large, White
- Corner Radius: 8px
- Auto Layout: Horizontal, Center, Hug

**Size=Small**: Height 36px, Padding 12px horizontal, Label/Medium
**Size=Large**: Height 56px, Padding 20px horizontal, Label/Large

**State=Disabled**: Opacity 50%
**State=Loading**: Spinner icon (animated), text "Processing..."

#### Component: Button/Secondary
Same as Primary, but:
- Background: Neutral/100
- Border: 1px Neutral/300
- Text: Primary/500

#### Component: Button/Text (Link style)
- No background, no border
- Text: Primary/500, underline on press
- Padding: 8px vertical, 4px horizontal

---

### Category: Inputs

#### Component: Input/Text
**Variants**:
- State: Default | Focused | Error | Disabled
- Type: SingleLine | MultiLine

**Properties** (State=Default, Type=SingleLine):
- Height: 48px
- Padding: 12px horizontal, 12px vertical
- Background: White
- Border: 1px Neutral/300
- Corner Radius: 8px
- Text: Body/Medium, Neutral/900
- Placeholder: Body/Medium, Neutral/500

**State=Focused**: Border 2px Primary/500
**State=Error**: Border 2px Error/500
**State=Disabled**: Background Neutral/100, Opacity 60%

**Type=MultiLine**: Min height 100px, align text top

---

### Category: Badges & Pills

#### Component: StatusPill
**Variants**:
- Type: Pending | Completed | Failed | Paid | Unpaid | Approved | Instant
- Size: Small | Medium | Large

**Properties** (Type=Paid, Size=Medium):
- Padding: 4px vertical, 10px horizontal
- Corner Radius: 12px
- Background: Success/50
- Text: Caption/Bold, Success/700, "PAID"
- Auto Layout: Horizontal, Hug

**Type=Pending**: Background Warning/50, Text Warning/700, "PENDING"
**Type=Unpaid**: Background Error/50, Text Error/700, "UNPAID"

**Size=Small**: Padding 3px vertical, 8px horizontal, Caption (10px)
**Size=Large**: Padding 6px vertical, 12px horizontal, Label/Small

#### Component: Badge/Count
**Properties**:
- Min Width: 20px
- Height: 20px
- Padding: 2px horizontal
- Background: Error/500
- Text: Caption/Bold, White, Center
- Corner Radius: 10px (circular)

#### Component: Badge/Dot (Unread indicator)
**Properties**:
- Size: 8px × 8px
- Fill: Primary/500
- Corner Radius: 4px (circle)

---

## 4. Component Library - Payment

### Component: PaymentMethodCard
**Variants**:
- Type: ApplePay | GooglePay | Card
- State: Default | Selected | Default (isDefault=true)

**Properties** (Type=Card, State=Default):
- Auto Layout: Vertical, 12px gap
- Padding: 16px
- Background: White
- Border: 1px Neutral/300
- Corner Radius: 12px
- Shadow: Shadow/1

**Content**:
- Header Row:
  - Left: PaymentMethodIcon (brand logo, 32px)
  - Center: Brand + Last4 (Label/Medium, "Visa ••••1234")
  - Right: DefaultBadge (if isDefault)
- Footer Row:
  - Expiry: "Exp 12/25" (Caption/Regular, Neutral/700)
  - Actions: "Edit" | "Remove" buttons (Button/Text)

**State=Selected**: Border 2px Primary/500
**State=Default**: DefaultBadge visible ("Default", Success/50 bg, Success/700 text)

#### Component: PaymentMethodIcon
**Properties**:
- Size: 32px × 32px (or 24px for small variant)
- Type: Visa | Mastercard | Amex | Discover | ApplePay | GooglePay
- Corner Radius: 4px (for cards), 16px (for digital wallets)

**Visual**: Use brand logos (SVG icons)

#### Component: PaymentMethodSelector
**Variants**:
- Type: ApplePay | GooglePay | Card

**Properties**:
- Auto Layout: Vertical, 12px gap
- Each option: TouchableOpacity row with icon + label + radio button

**Content**:
- Apple Pay option: Apple Pay icon + "Apple Pay" + Radio
- Google Pay option: Google Pay icon + "Google Pay" + Radio
- Card option: Card icon + "Credit or Debit Card" + Radio

#### Component: PaymentStatusIndicator
**Variants**:
- Status: Captured | Pending | Failed | Processing

**Properties** (Status=Captured):
- Auto Layout: Horizontal, 8px gap
- Padding: 8px vertical, 12px horizontal
- Background: Success/50
- Corner Radius: 8px
- Icon: ✓ (16px, Success/700)
- Text: Label/Small, Success/700, "Paid"

**Status=Pending**: Icon ⏳, Warning colors, "Payment Pending"
**Status=Failed**: Icon ⚠, Error colors, "Payment Failed"
**Status=Processing**: Animated spinner, Primary colors, "Processing..."

#### Component: PaymentAmountDisplay
**Properties**:
- Auto Layout: Vertical, 4px gap
- Amount: Display/Large, Neutral/900, "$150.00"
- Label: Caption/Regular, Neutral/700, "Amount due"

#### Component: ReceiptCard
**Properties**:
- Auto Layout: Vertical, 16px gap
- Padding: 20px
- Background: White
- Border: 1px Neutral/300
- Corner Radius: 12px
- Shadow: Shadow/2

**Content Rows**:
- Transaction ID: "Trans. #12345" (Caption/Regular)
- Date: "Jan 11, 2026 3:45 PM" (Body/Small)
- Amount: "$150.00" (Heading/H2)
- Payment Method: "Visa ••••1234" (Body/Small)
- Status: PaymentStatusIndicator (Captured)

#### Component: AutopayToggle
**Variants**:
- State: Enabled | Disabled

**Properties**:
- Auto Layout: Horizontal, Space Between
- Left: Auto Layout Vertical (Title + Subtitle)
  - Title: Label/Large, "Autopay"
  - Subtitle: Body/Small, Neutral/700, "Automatically charge after service"
- Right: Toggle Switch (iOS/Android native)

**State=Enabled**: Toggle ON, Green color
**State=Disabled**: Toggle OFF, Neutral color

---

## 5. Component Library - Job & Service

### Component: ServiceCard
(Existing, from `/mobile/src/components/services/ServiceCard.tsx`)

**Properties**:
- Padding: 16px
- Background: White
- Border: 1px Neutral/300
- Corner Radius: 8px

**Content**:
- Header Row: Service name + Badges (Instant / Approval Required)
- Description: Body/Small, Neutral/700

**Badges**:
- Instant: "⚡ Instant", Success/50 bg, Success/700 text
- Approval: "✓ Approval", Warning/50 bg, Warning/700 text

### Component: JobCard
(Existing, from `/mobile/src/components/jobs/JobCard.tsx`, enhanced with payment status)

**Properties**:
- Padding: 16px
- Background: White
- Border: 1px Neutral/300
- Corner Radius: 12px
- Shadow: Shadow/1

**Content**:
- Header Row: Status pill + Reminder badge + Payment status pill
- Service Type: Heading/H3
- Address: Body/Small, Neutral/700
- Date: Caption/Regular, Neutral/700

**New Addition**: Payment status pill (PaymentStatusIndicator, compact)

### Component: ReminderBanner
(Existing, from `/mobile/src/components/jobs/ReminderBanner.tsx`)

**Variants**:
- Urgency: Standard | Urgent

**Properties** (Urgency=Standard):
- Background: Primary/50
- Border: None
- Padding: 16px
- Corner Radius: 8px

**Content**:
- Icon: 📅
- Title: "Upcoming Service"
- Message: "You have 2 jobs requiring attention"
- Action: "View" button (Button/Primary, small)

**Urgency=Urgent**: Background Error/50, Icon 🔔, Title "Urgent Reminder"

### Component: UnpaidJobsBanner
**Properties**:
- Background: Warning/50
- Border: 2px Warning/500
- Padding: 16px
- Corner Radius: 12px

**Content**:
- Icon: 💳
- Title: "Unpaid Jobs"
- Message: "You have 2 jobs with outstanding payments"
- Action: "Pay Now" button (Button/Primary, medium)

---

## 6. Screen Definitions (Customer App)

### Group: Onboarding & Auth

#### Screen: InviteLoginScreen
(Existing, from `/mobile/src/screens/auth/InviteLoginScreen.tsx`)

**Purpose**: Auto-login via invite token deep link
**Components Used**:
- LoadingSpinner (animated)
- Logo (centered, 80px)
- Status text ("Logging you in...")

**States**:
- Loading: Spinner + "Logging you in..."
- Success: Navigate to Home
- Error: Error message + "Try Again" button

**Flow**:
1. Deep link: `lawnflow://invite/{token}`
2. Call `POST /api/auth/invite/exchange`
3. Store JWT in Expo Secure Store
4. Navigate to Home

---

### Group: Home & Services

#### Screen: HomeScreen
(Existing, from `/mobile/src/screens/home/HomeScreen.tsx`, enhanced)

**Purpose**: Customer dashboard with quick actions
**Components Used**:
- NotificationBanner (permission request if not granted)
- ReminderBanner (upcoming jobs)
- UnpaidJobsBanner (if unpaid jobs exist) ← **NEW**
- Button/Primary ("Request New Service")
- Upcoming services count

**Layout**:
- Top: Notification permission banner (if needed)
- Header: "Welcome to LawnFlow" (Display/Medium)
- Subtitle: User email (Body/Small, Neutral/700)
- Action: "Request New Service" button (large, primary)
- Banners: ReminderBanner + UnpaidJobsBanner (stacked)
- Section: "Upcoming Services" (count)

**States**:
- Default: All elements visible
- No unpaid jobs: Hide UnpaidJobsBanner
- No reminders: Hide ReminderBanner

**Payment Integration**:
- UnpaidJobsBanner taps → navigate to Jobs (Unpaid filter)

---

#### Screen: ServiceCatalogScreen
(Existing, from `/mobile/src/screens/services/ServiceCatalogScreen.tsx`)

**Purpose**: Browse available services
**Components Used**:
- ServiceCard × N (list)
- LoadingSpinner (while loading)
- Empty state ("No services available")

**Layout**:
- FlatList of ServiceCard components
- Each card tappable → navigate to RequestServiceScreen

**States**:
- Loading: Spinner
- Empty: Empty state message
- Default: List of services

---

#### Screen: RequestServiceScreen
(Existing, from `/mobile/src/screens/services/RequestServiceScreen.tsx`)

**Purpose**: Submit service request
**Components Used**:
- Service info card (name, description)
- Input/Text (preferred date, optional)
- Input/Text (notes, multiline, max 200 chars)
- Button/Primary ("Submit Request")

**Layout**:
- Section: Service details (name, description)
- Section: Preferred date input
- Section: Notes input (character count)
- Footer: Submit button

**States**:
- Default: Form ready
- Submitting: Button loading state
- Success: Navigate to ServiceRequestDetailScreen

**Payment Integration**: None (payment setup happens after approval)

---

#### Screen: ServiceRequestDetailScreen
(Existing, from `/mobile/src/screens/services/ServiceRequestDetailScreen.tsx`)

**Purpose**: Track service request status
**Components Used**:
- StatusPill (pending/approved/scheduled/completed/rejected)
- Service info rows (service name, date, notes)

**Layout**:
- Status card (colored bg, icon, title, message)
- Section: Service details (rows)

**States**:
- Pending: Blue card, "⏳ Request Pending"
- Approved: Green card, "✅ Request Approved"
- Scheduled: Blue card, "📅 Scheduled"
- Completed: Green card, "✨ Completed"
- Rejected: Red card, "❌ Request Declined"

**Payment Integration**: If status=approved, show "Set Up Payment" button (if first service)

---

### Group: Jobs

#### Screen: JobsScreen
(Existing, enhanced with payment filter)

**Purpose**: View all jobs with filters
**Components Used**:
- Tab navigation (Upcoming | Completed | Unpaid) ← **NEW TAB**
- JobCard × N (list)
- Empty state per tab

**Layout**:
- Header: "Jobs" (Heading/H1)
- Tabs: Upcoming | Completed | Unpaid
- FlatList: JobCard components
- Pull-to-refresh

**States**:
- Loading: Skeleton cards
- Empty: "No {tab} jobs" message
- Default: List of jobs

**Payment Integration**:
- Unpaid tab shows jobs with paymentStatus != "captured"
- JobCard shows payment status pill

---

#### Screen: JobDetailScreen
(Existing, from `/mobile/src/screens/jobs/JobDetailScreen.tsx`, enhanced)

**Purpose**: View job details and payment status
**Components Used**:
- StatusPill (job status)
- PaymentStatusIndicator (payment status) ← **NEW**
- Service info rows
- Address (tappable for directions)
- Date/time
- Notes
- Actions: "View Receipt" (if paid), "Pay Now" (if unpaid) ← **NEW**

**Layout**:
- Header: Service type + Job status pill
- Payment row: PaymentStatusIndicator ← **NEW**
- Section: Job details (address, date, notes)
- Section: Actions (View Receipt / Pay Now)

**States**:
- Job completed + paid: Show "View Receipt" button
- Job completed + unpaid: Show "Pay Now" button + PaymentStatusIndicator (Unpaid)
- Job completed + pending: Show PaymentStatusIndicator (Pending)
- Job completed + failed: Show "Retry Payment" button + PaymentStatusIndicator (Failed)

**Payment Integration**:
- "Pay Now" → navigate to InAppPaymentScreen
- "View Receipt" → navigate to ReceiptScreen
- "Retry Payment" → navigate to InAppPaymentScreen (retry mode)

---

#### Screen: ReviewPromptScreen
(Existing, from `/mobile/src/screens/reviews/ReviewPromptScreen.tsx`)

**Purpose**: Submit review after job completion
**Components Used**:
- Star rating (1-5, tappable)
- Input/Text (comment, multiline, optional for high ratings, required for low)
- Button/Primary ("Submit Review")

**Layout**:
- Title: "How was your service?" (Display/Medium)
- Subtitle: Service type + address
- Star rating row (5 stars, 48px each)
- Feedback section (shows if rating ≤ 3)
- Submit button (shows if rating > 0)

**States**:
- No rating: Only stars shown
- Low rating (≤3): Feedback section shown (required)
- High rating (≥4): Optional comment section + Google review prompt
- Submitting: Button loading state
- Success: Alert + Navigate back or to Google review

**Payment Integration**: None (review happens after payment)

---

### Group: Payment

#### Screen: PaymentSetupScreen (First Service)
**Purpose**: Set up first payment method before scheduling
**Components Used**:
- PaymentMethodSelector (ApplePay/GooglePay/Card)
- Button/Primary ("Continue")

**Layout**:
- Header: "Set Up Payment" (Heading/H1)
- Subtitle: "Add a payment method to schedule your service" (Body/Small, Neutral/700)
- PaymentMethodSelector (3 options)
- Footer: "Continue" button

**States**:
- Default: Selector ready, button disabled
- Method selected: Button enabled
- Continue tapped: Navigate to method-specific flow

**Flow**:
- ApplePay selected → Apple Pay sheet (native)
- GooglePay selected → Google Pay sheet (native)
- Card selected → CardEntryScreen

**Payment Integration**:
- After payment method added, enable "Schedule" button on ServiceRequestDetailScreen

---

#### Screen: CardEntryScreen
**Purpose**: Enter credit card details (Stripe integration)
**Components Used**:
- Input/Text (card number, with auto-formatting)
- Input/Text (expiry, MM/YY)
- Input/Text (CVC)
- Input/Text (ZIP code)
- Button/Primary ("Add Card")

**Layout**:
- Header: "Add Card" (Heading/H1)
- Card preview (animated card UI showing entered digits)
- Form fields (stacked, 16px gap)
- Footer: "Add Card" button + Security note

**States**:
- Default: Form empty, button disabled
- Valid input: Button enabled
- Submitting: Button loading state, "Adding..."
- Success: Navigate to PaymentMethodsScreen
- Error: Show error message below button

**Payment Integration**:
- Use Stripe Elements for secure card entry
- Call `POST /api/payment-methods` → returns Stripe setup intent
- Confirm setup intent → tokenize card → save token

---

#### Screen: PaymentMethodsScreen
**Purpose**: Manage stored payment methods
**Components Used**:
- PaymentMethodCard × N (list)
- Button/Secondary ("+ Add Payment Method")
- Empty state ("No payment methods")

**Layout**:
- Header: "Payment Methods" (Heading/H1)
- List: PaymentMethodCard components
- Footer: "Add Payment Method" button

**States**:
- Loading: Skeleton cards
- Empty: Empty state + "Add Payment Method" button
- Default: List of payment methods

**Actions per card**:
- Tap card → PaymentMethodDetailScreen
- "Set as Default" (if not default)
- "Remove" → confirmation modal

**Payment Integration**:
- Fetch: `GET /api/payment-methods`
- Add: Navigate to PaymentSetupScreen
- Remove: `DELETE /api/payment-methods/:id`
- Set default: `PATCH /api/payment-methods/:id/default`

---

#### Screen: InAppPaymentScreen
**Purpose**: Pay for job in-app (Apple Pay/Google Pay/Card)
**Components Used**:
- PaymentAmountDisplay (amount due)
- PaymentMethodQuickPicker (saved methods)
- Button/Primary ("Pay $150.00")
- PaymentProcessingIndicator (loading state)

**Layout**:
- Header: "Pay for Service" (Heading/H1)
- Amount card: PaymentAmountDisplay (large, centered)
- Section: "Payment Method" + PaymentMethodQuickPicker
- Footer: "Pay" button (large, primary)

**States**:
- Default: Method selected, button enabled
- Processing: PaymentProcessingIndicator shown
- Success: Navigate to PaymentSuccessScreen
- Failed: Navigate to PaymentFailedScreen

**Payment Integration**:
- Fetch amount: From job detail
- Fetch methods: From payment methods list
- Pay: `POST /api/payments` with jobId + paymentMethodId
- Show native payment sheet if ApplePay/GooglePay

---

#### Screen: PaymentSuccessScreen
**Purpose**: Confirm payment success and show receipt
**Components Used**:
- Success icon (✓, 64px, green)
- ReceiptCard (transaction details)
- Button/Primary ("View Receipt")
- Button/Text ("Done")

**Layout**:
- Icon: Success checkmark (centered, animated)
- Title: "Payment Successful!" (Display/Medium, center)
- ReceiptCard (transaction summary)
- Actions: "View Receipt" (primary) + "Done" (text)

**Flow**:
- "View Receipt" → navigate to ReceiptScreen
- "Done" → navigate back to JobDetailScreen

**Payment Integration**:
- Fetch transaction: `GET /api/transactions/:id`

---

#### Screen: PaymentFailedScreen
**Purpose**: Handle payment failure and offer retry
**Components Used**:
- Error icon (⚠, 64px, red)
- Error message (explain why)
- Button/Primary ("Try Again")
- Button/Secondary ("Use Different Method")
- Button/Text ("Contact Support")

**Layout**:
- Icon: Error icon (centered)
- Title: "Payment Failed" (Display/Medium, center)
- Message: Error explanation (Body/Small, Neutral/700)
- Actions (stacked):
  - "Try Again" (same method)
  - "Use Different Method" (choose new method)
  - "Contact Support" (open support chat)

**Error Types**:
- Insufficient funds: "Your card was declined due to insufficient funds."
- Card expired: "Your card has expired. Please update your payment method."
- Generic: "We couldn't process your payment. Please try again."

**Payment Integration**:
- "Try Again" → retry with same method
- "Use Different Method" → navigate to PaymentMethodsScreen

---

#### Screen: ReceiptScreen
**Purpose**: View payment receipt
**Components Used**:
- ReceiptCard (full details)
- Button/Secondary ("Share Receipt")
- Button/Text ("Done")

**Layout**:
- Header: "Receipt" (Heading/H1)
- ReceiptCard (full transaction details):
  - Transaction ID
  - Date/time
  - Service type
  - Amount
  - Payment method
  - Status
- Actions: "Share Receipt" (PDF export) + "Done"

**Payment Integration**:
- Fetch: `GET /api/transactions/:id`
- Share: Generate PDF receipt

---

#### Screen: InvoiceScreen
**Purpose**: View invoice if payment fell back to invoice
**Components Used**:
- Invoice card (invoice details)
- Button/Primary ("Pay Now")
- Button/Text ("Download Invoice")

**Layout**:
- Header: "Invoice" (Heading/H1)
- Invoice card:
  - Invoice number
  - Issue date
  - Due date
  - Amount due
  - Line items (service breakdown)
  - Payment status
- Actions: "Pay Now" (if unpaid) + "Download Invoice" (PDF)

**Payment Integration**:
- Fetch: `GET /api/invoices/:id`
- "Pay Now" → navigate to InAppPaymentScreen
- Download: PDF export

---

#### Screen: PaymentHistoryScreen
**Purpose**: View all past payments
**Components Used**:
- PaymentHistoryRow × N (list)
- Filter tabs (All | Paid | Failed)
- Empty state ("No payments yet")

**Layout**:
- Header: "Payment History" (Heading/H1)
- Tabs: All | Paid | Failed
- List: PaymentHistoryRow components
  - Date
  - Amount
  - Method (last4)
  - Status pill
- Tap row → navigate to ReceiptScreen

**Payment Integration**:
- Fetch: `GET /api/transactions` (with filters)

---

### Group: Settings

#### Screen: SettingsScreen
**Purpose**: Account and app settings
**Components Used**:
- Settings rows (tappable list items)
- Section headers

**Layout**:
- Section: Payment
  - "Payment Methods" → PaymentMethodsScreen
  - "Payment Preferences" → PaymentPreferencesScreen
- Section: Notifications
  - "Notification Settings" → NotificationSettingsScreen
- Section: Account
  - "Profile" (if available)
  - "Log Out"

**Payment Integration**:
- Payment section prominently placed

---

#### Screen: PaymentPreferencesScreen
**Purpose**: Manage autopay and billing preferences
**Components Used**:
- AutopayToggle
- Explainer text
- Button/Primary ("Save Changes")

**Layout**:
- Header: "Payment Preferences" (Heading/H1)
- Section: Autopay
  - AutopayToggle
  - Explainer: "We'll automatically charge your default payment method after each service is completed."
  - Limit: "Maximum autopay amount: $500"
- Section: Auto-billing
  - Toggle: "Auto-billing for future services"
  - Explainer: "Automatically create and send invoices for future services."
- Footer: "Save Changes" button

**States**:
- Default: Current preferences loaded
- Changed: Button enabled
- Saving: Button loading state
- Success: Alert + navigate back

**Payment Integration**:
- Fetch: `GET /api/payment-preferences`
- Save: `PUT /api/payment-preferences`

---

### Group: Overlays & Modals

#### Modal: PaymentMethodSetupModal (Bottom Sheet)
**Purpose**: Choose payment method type for setup
**Components Used**:
- Modal header (title + close button)
- PaymentMethodSelector (ApplePay/GooglePay/Card)
- Button/Primary ("Continue")

**Layout**:
- Top bar: Title "Add Payment Method" + Close (✕)
- Body: PaymentMethodSelector
- Footer: "Continue" button

**Flow**:
- User selects method → taps Continue → navigate to method-specific flow
- Close → dismiss modal

---

#### Modal: RemovePaymentMethodModal
**Purpose**: Confirm payment method removal
**Components Used**:
- Alert icon (⚠)
- Title + message
- Button/Primary ("Remove", destructive style)
- Button/Secondary ("Cancel")

**Layout**:
- Icon: Warning icon (centered)
- Title: "Remove Payment Method?" (Heading/H2)
- Message: "This will remove Visa ••••1234. You can add it back later."
- Actions: "Remove" (red) + "Cancel" (gray)

**Flow**:
- "Remove" → call API → dismiss modal → refresh list
- "Cancel" → dismiss modal

---

## 7. Navigation & Flow Rules

### Bottom Tab Navigation (Customer App)

#### Customer Tabs
1. **Home** (House icon)
   - Entry: HomeScreen
   - Badge: Unpaid jobs count (if > 0)

2. **Jobs** (List icon)
   - Entry: JobsScreen (Upcoming tab)
   - Badge: Reminder count (if > 0)

3. **Notifications** (Bell icon)
   - Entry: NotificationCenterScreen
   - Badge: Unread count

4. **More** (Menu icon)
   - Entry: SettingsScreen
   - No badge

### Deep Link Routes
```
lawnflow://invite/{token}        → InviteLoginScreen
lawnflow://job/{jobId}           → JobDetailScreen
lawnflow://review/{jobId}        → ReviewPromptScreen
lawnflow://pay/{sessionId}       → Text-to-Pay handler → InAppPaymentScreen
lawnflow://receipt/{transactionId} → ReceiptScreen
```

### Conditional Flows

#### First Service Flow
```
ServiceRequestDetailScreen (status=approved)
  ↓
If customer has no payment methods:
  ↓
PaymentSetupScreen → CardEntryScreen / ApplePay / GooglePay
  ↓
Payment method saved
  ↓
Navigate back to ServiceRequestDetailScreen
  ↓
"Schedule" button enabled
```

#### Job Completion → Payment Flow
```
Job completed by crew
  ↓
Backend: QA Agent validates
  ↓
Backend: Payment Agent evaluates
  ↓
Decision: autopay_capture (high confidence)
  ↓
Payment processed automatically
  ↓
Customer receives push notification: "Payment successful for [service]"
  ↓
Tap notification → JobDetailScreen (shows payment status: Paid)
  ↓
Tap "View Receipt" → ReceiptScreen
```

#### Job Completion → Payment Failure Flow
```
Job completed by crew
  ↓
Backend: Payment Agent attempts autopay_capture
  ↓
Payment failed (card declined)
  ↓
Backend: Retry policy (3 attempts with backoff)
  ↓
All retries failed
  ↓
Customer receives push notification: "Payment failed for [service]"
  ↓
Tap notification → JobDetailScreen (shows payment status: Failed)
  ↓
Tap "Retry Payment" → InAppPaymentScreen
  ↓
Customer selects different method → Pay
  ↓
Success → PaymentSuccessScreen → ReceiptScreen
```

#### Text-to-Pay Flow
```
Job completed, autopay disabled or low confidence
  ↓
Backend: Payment Agent decision: send_text_to_pay
  ↓
Customer receives SMS: "Pay for your [service]: [link]"
  ↓
Customer taps link → Deep link opens app
  ↓
Deep link handler: lawnflow://pay/{sessionId}
  ↓
Validate session → InAppPaymentScreen
  ↓
Customer pays → PaymentSuccessScreen
```

#### Invoice Fallback Flow
```
Job completed, amount > $500 or autopay disabled
  ↓
Backend: Payment Agent decision: fallback_invoice
  ↓
Backend: Invoice Agent creates invoice
  ↓
Customer receives push notification: "Invoice ready for [service]"
  ↓
Tap notification → InvoiceScreen
  ↓
Tap "Pay Now" → InAppPaymentScreen
  ↓
Payment succeeds → Invoice marked paid
```

---

## 8. Figma Make Instructions

### Step 1: Create File & Foundations
```
1. Create Figma file: "LawnFlow Customer App - Master"
2. Add 10 pages as specified in Section 1
3. Page 1: Create color palette grid
   - 8 columns, semantic naming
   - Primary, Success, Warning, Error, Neutral, Payment colors
4. Create text styles for all type scales
5. Create spacing/radius/shadow styles
```

### Step 2: Build Primitive Components
```
1. Create Button/Primary with Size and State variants
2. Create Button/Secondary (same structure)
3. Create Button/Text
4. Create Input/Text with State and Type variants
5. Create StatusPill with Type and Size variants
6. Create Badge/Count and Badge/Dot
7. Apply Auto Layout to all components
8. Use only Figma color/text styles (no hard-coded values)
```

### Step 3: Build Payment Components
```
1. Create PaymentMethodCard with Type and State variants
2. Create PaymentMethodIcon (32px, brand logos)
3. Create PaymentMethodSelector (radio list)
4. Create PaymentStatusIndicator with Status variants
5. Create PaymentAmountDisplay
6. Create ReceiptCard (transaction details)
7. Create AutopayToggle
8. Apply Auto Layout and spacing scale
```

### Step 4: Build Job & Service Components
```
1. Create ServiceCard (reuse existing pattern)
2. Create JobCard (enhanced with payment status)
3. Create ReminderBanner (existing, with variants)
4. Create UnpaidJobsBanner (new, similar to ReminderBanner)
5. Ensure consistent spacing (16px card padding, 12px internal gaps)
```

### Step 5: Build Screens - Onboarding & Auth
```
1. Create InviteLoginScreen (375px × 812px frame)
2. Components: Logo + LoadingSpinner + Status text
3. Create states: Loading, Success, Error
```

### Step 6: Build Screens - Home & Services
```
1. Create HomeScreen
   - Components: NotificationBanner, ReminderBanner, UnpaidJobsBanner, Button/Primary
   - Layout: Single column, 20px padding
2. Create ServiceCatalogScreen
   - FlatList: ServiceCard × N, 16px padding
3. Create RequestServiceScreen
   - Form: Service info + Input/Text × 2 + Button/Primary
4. Create ServiceRequestDetailScreen
   - Status card + Details rows
```

### Step 7: Build Screens - Jobs
```
1. Create JobsScreen
   - Tab navigation: Upcoming | Completed | Unpaid
   - FlatList: JobCard × N
2. Create JobDetailScreen
   - Header + Payment row + Details + Actions
   - Variants: Paid, Unpaid, Pending, Failed
3. Create ReviewPromptScreen
   - Star rating + Comment input + Submit button
```

### Step 8: Build Screens - Payment (Critical)
```
1. Create PaymentSetupScreen
   - PaymentMethodSelector + Continue button
2. Create CardEntryScreen
   - Card inputs + Add Card button
3. Create PaymentMethodsScreen
   - List: PaymentMethodCard × N + Add button
4. Create InAppPaymentScreen
   - Amount display + Method picker + Pay button
5. Create PaymentSuccessScreen
   - Success icon + ReceiptCard + Actions
6. Create PaymentFailedScreen
   - Error icon + Message + Retry/Switch buttons
7. Create ReceiptScreen
   - ReceiptCard (full) + Share/Done buttons
8. Create InvoiceScreen
   - Invoice card + Pay Now/Download buttons
```

### Step 9: Build Screens - Settings
```
1. Create SettingsScreen
   - Section list: Payment, Notifications, Account
2. Create PaymentPreferencesScreen
   - AutopayToggle + Explainers + Save button
```

### Step 10: Build Modals
```
1. Create PaymentMethodSetupModal (bottom sheet)
2. Create RemovePaymentMethodModal (alert)
3. Apply Shadow/4 to modals
4. Use 50% black overlay for background
```

### Step 11: Link Screens with Prototypes
```
1. Link Home → ServiceCatalog → RequestService → ServiceRequestDetail
2. Link Jobs → JobDetail → ReviewPrompt
3. Link Jobs → JobDetail → InAppPayment → PaymentSuccess → Receipt
4. Link Settings → PaymentMethods → CardEntry
5. Link Settings → PaymentPreferences
6. Use "Smart Animate" for modals and transitions
7. Set transition timing: 200ms ease for modals, instant for tabs
```

### Step 12: Quality Checks
```
1. Verify all components use Auto Layout (no absolute positioning)
2. Verify all colors use color styles (no hex codes)
3. Verify all text uses text styles (no size overrides)
4. Verify spacing uses spacing scale (4/8/12/16/20/24/32px)
5. Verify touch targets ≥ 44px height
6. Verify contrast ratios WCAG AA (4.5:1 for text)
7. Verify all payment flows are linked
8. Test prototype: Home → Service → Payment → Receipt
```

---

## 9. Constraints & Rules

### Mobile-First Requirements
- **Single-column layout**: All content stacks vertically
- **Touch targets**: Minimum 44px height for all buttons/inputs
- **Thumb zones**: Primary actions at bottom (within reach)
- **Safe areas**: 34px bottom padding on iOS (home indicator)
- **Font size**: Minimum 14px for body text, 12px for captions

### Auto Layout Requirements
- **No absolute positioning**: Everything uses Auto Layout
- **Spacing scale**: All gaps from spacing scale (4/8/12/16/20/24/32px)
- **Hug vs Fill**: Hug for content-sized (buttons), Fill for full-width (inputs, cards)
- **Constraints**: Stretch for responsive behavior

### Payment UX Requirements
- **Secure by default**: Never show full card numbers (always mask)
- **Clear pricing**: Always show amount before payment
- **Confirmation**: Always show success/failure state after payment
- **Retry**: Always offer retry on failure
- **Transparency**: Always explain autopay before enabling

### Component Consistency
- **Reuse patterns**: Use existing components from staff app where applicable
- **Variant system**: Use variants, not duplicate components
- **Semantic naming**: Colors by purpose (Primary, Success, Error), not appearance (Blue, Green, Red)

---

## 10. Success Criteria

This design is **Figma-ready** if:

✅ All screens can be built using only library components
✅ All components use Auto Layout (no absolute positioning)
✅ All colors and text use Figma styles (no hard-coded values)
✅ All touch targets ≥ 44px height
✅ All screens fit 375px width (iPhone standard)
✅ All payment flows are complete (setup → pay → receipt → retry)
✅ All states designed (loading, empty, error, success)
✅ Prototype flows work end-to-end for key customer journeys
✅ Payment agent integration points are clear in UI

---

## Handoff Notes

### For Developers
- Component names match React Native component file names
- Screen names match navigation route names
- Color style names match design token variable names
- Payment flow matches backend payment agent decisions

### For Figma Make
- This document is the **single source of truth**
- Do not add features not specified here
- Do not create screens beyond the listed screens
- Do not invent new color/text styles beyond the foundation
- Payment components are critical - build these first

### For Product Team
- This design reflects **existing customer app** + **payment agent integration**
- This design is **mobile-first, touch-optimized, payment-first**
- This design is **agent-orchestrated** (autopay with customer control)
- This design fills **20+ identified gaps** in customer payment UX

---

**End of Specification**

**Total Components**: 30+ (primitives + payment + job/service)
**Total Screens**: 25+ (onboarding + home + services + jobs + payment + settings)
**Total States**: 60+ (loading, empty, error, success, payment states)
**Design System**: Complete (colors, text, spacing, radius, shadows)
**Payment Integration**: ✅ Complete (setup, autopay, in-app, receipt, invoice, retry)
**Ready for Figma Make**: ✅
