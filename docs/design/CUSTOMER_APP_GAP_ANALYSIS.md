# LawnFlow Customer App - Gap Analysis

**Date**: January 11, 2026
**Scope**: Customer mobile app only (iOS/Android)
**Purpose**: Identify gaps between original UX intent, current implementation, and payment agent capabilities

---

## Executive Summary

The LawnFlow customer mobile app has a **functional foundation** (Sprint 0 complete) with service requests and reviews implemented, but is **missing the entire payment experience**. The Payment Agent backend is fully implemented and ready, but there is **zero customer-facing payment UI**.

**Key Finding**: The payment gap represents **20+ missing screens and components** that would enable customers to set up payment methods, enable autopay, pay for services, and manage billing preferences.

---

## Gap Category 1: Payment & Billing UX

### P0 (Must Fix - Functional Parity)

#### GAP-P01: Payment Method Setup Flow
**Current State**: ❌ Not implemented
**Required State**: First service requires payment method setup before scheduling
**Impact**: Customers cannot pay for first service → **blocks core business workflow**
**Screens Missing**:
1. Payment Setup Landing (first service context)
2. Payment Method Selector (Apple Pay / Google Pay / Card)
3. Card Entry Form (Stripe Elements)
4. Apple Pay Sheet (native integration)
5. Google Pay Sheet (native integration)
6. Payment Method Confirmation Screen

**Components Missing**:
- PaymentMethodCard (display saved methods)
- PaymentMethodSelector (choose method type)
- CardForm (Stripe integration)
- PaymentSetupSuccess (confirmation)

**Backend Ready**: ✅ `/server/orchestrator/payment/adapters/smsAdapter.ts` - `sendPaymentSetupMessage()`

---

#### GAP-P02: Stored Payment Methods Management
**Current State**: ❌ Not implemented
**Required State**: Customers can view, add, remove, and set default payment methods
**Impact**: Customers stuck with first payment method → poor UX, support burden
**Screens Missing**:
1. Payment Methods List (Settings)
2. Add Payment Method Screen
3. Payment Method Detail (edit/remove)

**Components Missing**:
- PaymentMethodRow (list item with brand/last4/expiry)
- PaymentMethodIcon (Visa/MC/Amex/ApplePay/GooglePay)
- DefaultBadge (indicator for default method)
- RemovePaymentMethodModal (confirmation)

**Backend Ready**: ✅ `/shared/schema-payment.ts` - `paymentMethods` table

---

#### GAP-P03: Autopay Settings
**Current State**: ❌ Not implemented
**Required State**: Customers can enable/disable autopay and see autopay status
**Impact**: Payment Agent makes autopay decisions, but customer has no control → **trust issue**
**Screens Missing**:
1. Autopay Settings Screen (toggle + explanation)

**Components Missing**:
- AutopayToggle (enable/disable with confirmation)
- AutopayExplainer (what autopay does, when it charges)
- AutopayStatusBadge ("Autopay Enabled" on payment methods)

**Backend Ready**: ✅ `/shared/schema-payment.ts` - `customerPaymentProfiles.autopayEnabled`

---

#### GAP-P04: In-App Payment Flow
**Current State**: ❌ Not implemented
**Required State**: Customers can pay outstanding balances in-app (Apple Pay/Google Pay/Card)
**Impact**: Customers cannot pay in-app → forced to wait for text-to-pay or invoice
**Screens Missing**:
1. Payment Screen (amount + method selector)
2. Payment Processing Screen (loading + result)
3. Payment Success Screen (receipt)
4. Payment Failed Screen (retry + error)

**Components Missing**:
- PaymentAmountDisplay (formatted amount)
- PaymentMethodQuickPicker (saved methods)
- PaymentProcessingIndicator (animated spinner)
- PaymentReceiptCard (transaction details)
- PaymentRetryButton (try again)

**Backend Ready**: ✅ `/server/orchestrator/payment/commandHandlers.ts` - `handleCapturePayment()`

---

#### GAP-P05: Payment Status Display
**Current State**: ❌ Not shown on completed jobs
**Required State**: Jobs show payment status (captured/pending/failed/none)
**Impact**: Customers don't know if they've paid → confusion, duplicate payments
**UI Changes Needed**:
- JobCard: Add payment status badge
- JobDetailScreen: Add payment status row
- Jobs List: Filter by payment status (unpaid/paid)

**Components Missing**:
- PaymentStatusPill (captured/pending/failed)
- PaymentStatusIcon (✓/⏳/⚠)
- UnpaidJobsBanner (home screen alert)

**Backend Ready**: ✅ `paymentTransactions.status` field

---

### P1 (Should Fix - UX Quality)

#### GAP-P06: Text-to-Pay Deep Link Handling
**Current State**: ❌ Deep link exists (`lawnflow://pay/{sessionId}`), no handler
**Required State**: SMS payment link opens app and shows payment screen
**Impact**: Customers must pay in browser → friction, lower conversion
**Screens Missing**:
1. Text-to-Pay Landing Screen (session validation)

**Components Missing**:
- PaymentSessionLoader (validate session, fetch details)

**Backend Ready**: ✅ `paymentSessions` table, `/api/payment-sessions/:sessionId`

---

#### GAP-P07: Receipt View
**Current State**: ❌ Not implemented
**Required State**: Customers can view receipt after payment
**Impact**: Customers cannot prove payment → support burden
**Screens Missing**:
1. Receipt Detail Screen (transaction details)
2. Receipt List Screen (payment history)

**Components Missing**:
- ReceiptCard (transaction summary)
- TransactionRow (itemized charges)
- ReceiptPDF (export/share)

**Backend Ready**: ✅ `paymentTransactions` table with full audit trail

---

#### GAP-P08: Invoice View (Fallback)
**Current State**: ❌ Not implemented
**Required State**: Customers can view invoice if payment falls back to invoice
**Impact**: Customers don't know they have an invoice → late payment
**Screens Missing**:
1. Invoice Detail Screen
2. Invoice List Screen (unpaid invoices)

**Components Missing**:
- InvoiceCard (invoice summary)
- InvoicePayButton ("Pay Now" → in-app payment)

**Backend Ready**: ✅ `InvoiceFallbackTriggered` event emitted

---

#### GAP-P09: Payment Failure Recovery
**Current State**: ❌ Not implemented
**Required State**: Customers can retry failed payment or update payment method
**Impact**: Failed payments require support intervention → **churn risk**
**Screens Missing**:
1. Payment Failed Screen (error + retry)
2. Update Payment Method Screen (replace failed method)

**Components Missing**:
- PaymentErrorMessage (explain why it failed)
- RetryPaymentButton (try again with same method)
- UpdateMethodButton (switch to different method)

**Backend Ready**: ✅ `/server/orchestrator/payment/retryPolicy.ts` - Retry logic

---

### P2 (Nice-to-Have - Polish)

#### GAP-P10: Payment Notifications
**Current State**: ✅ Push notifications work, ❌ no payment-specific actions
**Required State**: Payment notifications have deep link actions
**Impact**: Customers must manually open app → extra friction
**Enhancements Needed**:
- "Payment Successful" notification → tap to view receipt
- "Payment Failed" notification → tap to retry
- "Payment Method Expiring" notification → tap to update

**Backend Ready**: ✅ Firebase FCM integrated

---

#### GAP-P11: Payment History
**Current State**: ❌ Not implemented
**Required State**: Customers can view all past payments
**Impact**: Customers cannot track spending → support tickets
**Screens Missing**:
1. Payment History Screen (list of transactions)
2. Payment Detail Screen (transaction detail)

**Components Missing**:
- PaymentHistoryRow (date, amount, status, method)
- PaymentFilter (date range, status, method type)

**Backend Ready**: ✅ `paymentTransactions` table

---

## Gap Category 2: Job Lifecycle Integration

### P0 (Must Fix)

#### GAP-J01: Job Detail - Payment Status
**Current State**: ❌ No payment info shown
**Required State**: Completed jobs show payment status
**Impact**: Customers don't know if job is paid → confusion
**Changes Needed**:
- Add payment status row to JobDetailScreen
- Add "View Receipt" button if paid
- Add "Pay Now" button if unpaid

**Components Missing**:
- JobPaymentCard (payment summary on job detail)

**Backend Ready**: ✅ Job has `paymentTransactionId` FK

---

#### GAP-J02: Jobs List - Payment Filter
**Current State**: ❌ No payment filtering
**Required State**: Filter jobs by payment status (unpaid/paid/failed)
**Impact**: Customers cannot find unpaid jobs → missed payments
**Changes Needed**:
- Add "Unpaid" tab to Jobs screen
- Add payment status badge to JobCard

**Backend Ready**: ✅ Query jobs by payment status

---

### P1 (Should Fix)

#### GAP-J03: Home Dashboard - Unpaid Jobs Alert
**Current State**: ❌ No unpaid jobs banner
**Required State**: Show alert if customer has unpaid jobs
**Impact**: Customers forget to pay → late payment fees
**Changes Needed**:
- Add UnpaidJobsBanner to HomeScreen
- Banner shows count of unpaid jobs
- Tap to navigate to Jobs (Unpaid filter)

**Components Missing**:
- UnpaidJobsBanner (similar to ReminderBanner)

**Backend Ready**: ✅ Query unpaid jobs count

---

## Gap Category 3: Design System & Components

### P0 (Must Fix - Technical Debt)

#### GAP-D01: No Formal Design Tokens
**Current State**: ❌ Inline styles with hardcoded values
**Required State**: Semantic design tokens (colors, text, spacing, radius)
**Impact**: Inconsistent UI, hard to maintain, can't rebrand
**Files to Create**:
- `/mobile/src/styles/tokens.ts` - Design tokens
- `/mobile/src/styles/colors.ts` - Semantic color palette
- `/mobile/src/styles/typography.ts` - Text styles
- `/mobile/src/styles/spacing.ts` - Spacing scale
- `/mobile/src/styles/radius.ts` - Border radius scale

**Reference**: `/docs/design/FIGMA_MOBILE_EXPORT.md` - Staff app design system

---

#### GAP-D02: No Component Variant System
**Current State**: ❌ Duplicate components with inline style overrides
**Required State**: Variant-based component system
**Impact**: Code duplication, maintenance burden
**Pattern Needed**:
```typescript
<Button variant="primary" size="large" state="disabled" />
```

**Reference**: Staff app StatusPill, JobStatusSelector

---

#### GAP-D03: No Payment UI Components
**Current State**: ❌ Zero payment components exist
**Required State**: 15+ payment components (listed in GAP-P01 through GAP-P09)
**Impact**: Cannot build payment UX without components
**Components to Create**: See Gap Category 1 (Payment & Billing UX)

---

### P1 (Should Fix)

#### GAP-D04: No Auto-Layout Patterns
**Current State**: ❌ Inconsistent spacing and layout
**Required State**: Flexbox-based auto-layout patterns
**Impact**: UI breaks on different screen sizes
**Patterns Needed**:
- Stack (vertical/horizontal spacing)
- Spacer (fixed/flexible spacing)
- Card (container with consistent padding/radius/shadow)

**Reference**: Staff app uses consistent spacing (4/8/12/16/20/24/32px)

---

## Gap Category 4: Agent Integration

### P2 (Nice-to-Have - Transparency)

#### GAP-A01: No Agent Decision Visibility
**Current State**: ❌ Customer doesn't know payment agent made a decision
**Required State**: Optional transparency into agent reasoning
**Impact**: Customer may distrust autopay
**UI Concept**:
- "Why was I charged?" link on receipt
- Shows agent confidence score and decision type
- Educational, not alarming

**Backend Ready**: ✅ `payment_agent_decisions` table stores full reasoning

---

#### GAP-A02: No Escalation Visibility
**Current State**: ❌ Customer doesn't know payment is under review
**Required State**: Show "Payment under review" status
**Impact**: Customer confused why payment hasn't processed
**UI Concept**:
- PaymentStatusPill variant: "Under Review"
- Explanation: "Our team is reviewing this payment. You'll be notified within 24 hours."

**Backend Ready**: ✅ `handoffToRole: "FINANCE"` in agent decision

---

## Gap Category 5: Original Mobile Spec (Sprint 1+)

### P1 (Should Fix - Original Roadmap)

#### GAP-O01: Reminder Flow (7d, 3d, day-of)
**Current State**: ❌ ReminderBanner exists, but no reminder flow state machine
**Required State**: Multi-stage reminder workflow
**Impact**: Customers miss appointments → no-shows
**Changes Needed**:
- Reminder stage tracking (7d → 3d → day-of)
- Acknowledge reminder action
- Reminder acknowledged state

**Backend Needed**: Reminder stage field on jobs

---

#### GAP-O02: Notification Urgency Badges
**Current State**: ❌ All notifications treated equally
**Required State**: Urgent notifications highlighted
**Impact**: Customers miss important notifications
**Changes Needed**:
- Urgent badge on notification cards
- Sort by urgency

**Backend Ready**: ✅ Notification type can imply urgency

---

#### GAP-O03: Invite Landing Screen
**Current State**: ❌ No landing screen if app not installed
**Required State**: Web landing page with app store badges
**Impact**: Invite link doesn't work if app not installed
**Changes Needed**:
- Web landing page at `lawnflow.app/invite/{token}`
- App Store + Google Play badges
- "Open in app" button if app installed

**Backend Ready**: ✅ Deep link config exists

---

## Priority Matrix

| Gap ID | Category | Priority | Impact | Effort | Risk |
|--------|----------|----------|--------|--------|------|
| GAP-P01 | Payment Setup | P0 | 🔴 High | 🟡 Med | Low |
| GAP-P02 | Payment Methods | P0 | 🔴 High | 🟡 Med | Low |
| GAP-P03 | Autopay | P0 | 🔴 High | 🟢 Low | Low |
| GAP-P04 | In-App Payment | P0 | 🔴 High | 🟡 Med | Med |
| GAP-P05 | Payment Status | P0 | 🔴 High | 🟢 Low | Low |
| GAP-J01 | Job Payment Status | P0 | 🔴 High | 🟢 Low | Low |
| GAP-J02 | Job Payment Filter | P0 | 🟡 Med | 🟢 Low | Low |
| GAP-D01 | Design Tokens | P0 | 🟡 Med | 🟢 Low | Low |
| GAP-D02 | Component Variants | P0 | 🟡 Med | 🟡 Med | Low |
| GAP-D03 | Payment Components | P0 | 🔴 High | 🔴 High | Low |
| GAP-P06 | Text-to-Pay | P1 | 🟡 Med | 🟢 Low | Low |
| GAP-P07 | Receipt View | P1 | 🟡 Med | 🟢 Low | Low |
| GAP-P08 | Invoice View | P1 | 🟡 Med | 🟡 Med | Low |
| GAP-P09 | Payment Retry | P1 | 🔴 High | 🟢 Low | Low |
| GAP-J03 | Unpaid Jobs Alert | P1 | 🟡 Med | 🟢 Low | Low |
| GAP-O01 | Reminder Flow | P1 | 🟡 Med | 🟡 Med | Low |

**Legend**:
- 🔴 High Impact: Blocks core workflow or causes user confusion
- 🟡 Medium Impact: Poor UX but workaround exists
- 🟢 Low Impact: Polish or nice-to-have
- Low/Med/High Effort: Development time estimate

---

## Recommended Implementation Order

### Phase 1: Payment Foundation (2 sprints)
1. GAP-D01: Design tokens
2. GAP-D02: Component variant system
3. GAP-P01: Payment method setup flow
4. GAP-P02: Stored payment methods
5. GAP-P03: Autopay settings

**Deliverable**: Customers can set up payment methods and enable autopay

---

### Phase 2: Payment Lifecycle (2 sprints)
6. GAP-P04: In-app payment flow
7. GAP-P05: Payment status display
8. GAP-J01: Job payment status integration
9. GAP-J02: Job payment filter
10. GAP-P07: Receipt view

**Deliverable**: Customers can pay for jobs and see payment status

---

### Phase 3: Payment Recovery & History (1 sprint)
11. GAP-P09: Payment failure recovery
12. GAP-P08: Invoice view
13. GAP-J03: Unpaid jobs alert
14. GAP-P11: Payment history

**Deliverable**: Customers can manage failed payments and view history

---

### Phase 4: Polish & Advanced Features (1 sprint)
15. GAP-P06: Text-to-pay deep link
16. GAP-P10: Payment notifications with actions
17. GAP-O01: Reminder flow state machine
18. GAP-O02: Notification urgency badges

**Deliverable**: Full-featured payment and job management experience

---

## Success Metrics

### Payment Adoption
- **Payment method setup rate**: % of first-time customers who complete payment setup
- **Autopay adoption**: % of customers with autopay enabled
- **In-app payment rate**: % of payments completed in-app vs. text-to-pay/invoice
- **Payment success rate**: % of payment attempts that succeed on first try

### Customer Satisfaction
- **Payment UX NPS**: Net Promoter Score for payment experience
- **Support ticket reduction**: % decrease in payment-related support tickets
- **Payment failure recovery**: % of failed payments retried successfully

### Business Impact
- **Days to payment**: Average time from job completion to payment captured
- **Payment method reuse**: % of repeat customers using stored payment methods
- **Invoice fallback rate**: % of payments that fall back to invoice (target: <5%)

---

## Conclusion

The LawnFlow customer mobile app has a **strong foundation** but is **missing the entire payment experience**. The Payment Agent backend is fully implemented, but there is **zero customer-facing UI** to set up payment methods, enable autopay, or pay for services.

**Total Gaps Identified**: 20+
**P0 Gaps (Must Fix)**: 11
**Estimated Effort**: 6 sprints (12 weeks)

**Next Step**: Define strengthened customer UX incorporating payment flows and create Figma-ready design export.
