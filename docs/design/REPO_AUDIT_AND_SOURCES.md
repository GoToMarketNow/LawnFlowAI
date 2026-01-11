# LawnFlow Customer App - Repository Audit & Sources of Truth

**Date**: January 11, 2026
**Purpose**: Document all sources of truth for customer app audit and design strengthening

---

## A. Original Mobile Designs/Specs (Customer App)

### Primary Specification Documents
| File Path | Content | Status |
|-----------|---------|--------|
| `/mobile/README.md` | Sprint 0 foundation - invite login, notifications, deep linking | ✅ Implemented |
| `/MOBILE_APP_COMPLETE.md` | Staff mobile app (crew/ops focus) | ✅ Implemented (Staff only) |
| `/docs/ux_build_plan.md` | UX V2 build plan (web app focus) | 🔄 Web only |
| `/docs/design-system-spec.md` | Design system specification | 📋 Spec only |

### Original Customer UX Intent (from `/mobile/README.md`)
**Implemented (Sprint 0)**:
- Deep linking: `lawnflow://invite/{token}`, `lawnflow://job/{jobId}`, `lawnflow://review/{jobId}`
- Invite token auto-login with JWT
- Firebase Cloud Messaging for push notifications
- Notification permission handling
- Account-level notification permission banner

**Planned but Not Implemented**:
- Invite landing screen (app not installed → store badges)
- Dashboard reminder banners with Acknowledge action
- Jobs list with upcoming/completed status
- Notification urgency badges
- Onboarding reminder flow (7d, 3d, day-of)

### Customer Screens (Existing Implementation)
| Screen | File Path | Status | Purpose |
|--------|-----------|--------|---------|
| HomeScreen | `/mobile/src/screens/home/HomeScreen.tsx` | ✅ Basic | Welcome + Request Service CTA |
| ServiceCatalogScreen | `/mobile/src/screens/services/ServiceCatalogScreen.tsx` | ✅ Complete | Browse available services |
| RequestServiceScreen | `/mobile/src/screens/services/RequestServiceScreen.tsx` | ✅ Complete | Submit service request |
| ServiceRequestDetailScreen | `/mobile/src/screens/services/ServiceRequestDetailScreen.tsx` | ✅ Complete | View request status |
| ReviewPromptScreen | `/mobile/src/screens/reviews/ReviewPromptScreen.tsx` | ✅ Complete | Submit review + Google redirect |
| NotificationCenterScreen | `/mobile/src/screens/notifications/NotificationCenterScreen.tsx` | ✅ Complete | View all notifications |
| InviteLoginScreen | `/mobile/src/screens/auth/InviteLoginScreen.tsx` | ✅ Complete | Auto-login via invite token |

### Customer Components (Existing)
| Component | File Path | Status | Purpose |
|-----------|-----------|--------|---------|
| ServiceCard | `/mobile/src/components/services/ServiceCard.tsx` | ✅ Complete | Service with instant/approval badges |
| JobCard | `/mobile/src/components/jobs/JobCard.tsx` | ✅ Complete | Job with status and reminder badges |
| ReminderBanner | `/mobile/src/components/jobs/ReminderBanner.tsx` | ✅ Complete | Urgent/upcoming job reminders |
| NotificationBanner | `/mobile/src/components/notifications/NotificationBanner.tsx` | ✅ Complete | Permission request banner |

### Design Tokens (Existing)
- **No formal design system implementation** for mobile
- Inline styles using StyleSheet API
- Ad-hoc colors: `#3B82F6` (blue), `#22C55E` (green), `#FEE2E2` (red bg), `#FEF3C7` (yellow bg)
- No typography scale (hardcoded font sizes: 24px, 18px, 16px, 14px, 13px, 12px, 11px)
- No spacing scale (hardcoded: 4, 8, 12, 16, 20, 24, 32px)
- No component variant system

---

## B. Current Released Implementation (Customer App)

### Mobile App Structure
```
mobile/
├── App.tsx                           # Root component with navigation
├── src/
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts            # Axios HTTP client
│   │   │   ├── services.ts          # Service catalog API
│   │   │   ├── serviceRequests.ts   # Service request API
│   │   │   ├── jobs.ts              # Job API
│   │   │   ├── reviews.ts           # Review API
│   │   │   └── types.ts             # API type definitions
│   │   ├── notifications/           # Firebase FCM
│   │   ├── storage/                 # SecureStore, AsyncStorage
│   │   └── analytics/               # Event tracking
│   ├── screens/                     # 7 customer screens (listed above)
│   ├── components/                  # 4 customer components (listed above)
│   ├── navigation/
│   │   ├── types.ts                 # Navigation param lists
│   │   └── linking.config.ts        # Deep link config
│   ├── store/                       # Zustand stores
│   │   ├── authStore.ts             # User auth state
│   │   ├── jobStore.ts              # Jobs state
│   │   ├── serviceStore.ts          # Services state
│   │   └── notificationStore.ts     # Notifications state
│   └── hooks/
│       ├── useNotificationPermission.ts  # Permission handling
│       └── useDeepLink.ts           # Deep link navigation
```

### Staff App Structure (Crew/Ops Only - NOT Customer)
```
mobile/src/
├── screens/
│   ├── today/DashboardScreen.tsx           # Staff dashboard
│   ├── acceptance/AcceptanceScreen.tsx      # Daily schedule acceptance
│   ├── crew/CrewScreen.tsx                  # Crew management
│   ├── work/RequestMoreWorkScreen.tsx       # Crew work requests
│   └── settings/PayrollPreferencesScreen.tsx # Crew payroll
├── components/
│   ├── crew/CrewStatusSelector.tsx          # Crew status
│   ├── crew/CrewSnapshotCard.tsx            # Crew info
│   ├── jobs/JobStatusSelector.tsx           # Job status
│   ├── jobs/JobActionsPanel.tsx             # Job actions
│   └── common/AddressLink.tsx               # Directions
```

### State Management Patterns
- **React Query** (TanStack): Server state, caching, mutations
- **Zustand**: Client state (auth, notifications, jobs, services)
- **Async Storage**: Persistence layer
- **Expo Secure Store**: Token storage (JWT, refresh token)

### API Integration
- **Base URL**: Configured via `.env` (`API_BASE_URL`)
- **Authentication**: JWT bearer token (from invite exchange)
- **Endpoints Used** (Customer App):
  - `POST /api/auth/invite/exchange` - Exchange invite token for JWT
  - `GET /api/notifications` - Get notifications
  - `POST /api/notifications/:id/read` - Mark notification read
  - `POST /api/notifications/device` - Register FCM token
  - `GET /api/services` (assumed) - Get service catalog
  - `POST /api/service-requests` (assumed) - Create service request
  - `GET /api/service-requests/:id` (assumed) - Get request status
  - `GET /api/jobs` - Get jobs
  - `GET /api/jobs/:id` - Get job detail
  - `POST /api/reviews` - Submit review
  - `GET /api/reviews/google-link/:providerId` - Get Google review URL

### Analytics Events (Customer App)
```typescript
// Implemented events
- invite_link_opened
- invite_exchange_attempt
- invite_exchange_success
- invite_exchange_fail
- reminder_opened
- review_prompt_opened
- review_submitted
- google_review_clicked
- notification_received_foreground
- notification_opened
- notification_opened_from_quit
- service_catalog_opened
- service_selected
- service_request_submitted
- service_request_status_viewed
```

---

## C. Billing/Payments Code + Agent Workflows

### Payment Agent Implementation
| File Path | Purpose | Status |
|-----------|---------|--------|
| `/shared/orchestrator/payment-contracts.ts` | Payment event/command schemas | ✅ Complete |
| `/shared/schema-payment.ts` | Payment database schema | ✅ Complete |
| `/server/orchestrator/payment/paymentAgent.ts` | Payment decision engine | ✅ Complete |
| `/server/orchestrator/payment/commandHandlers.ts` | Payment command handlers | ✅ Complete |
| `/server/orchestrator/payment/paymentSaga.ts` | Job → QA → Payment → Review saga | ✅ Complete |
| `/server/orchestrator/payment/retryPolicy.ts` | Failure handling & backoff | ✅ Complete |
| `/server/orchestrator/payment/adapters/smsAdapter.ts` | Text-to-pay messaging | ✅ Complete |
| `/server/orchestrator/payment/adapters/paymentProviderAdapter.ts` | Stripe integration | ✅ Complete |
| `/server/orchestrator/payment/webhooks/stripeWebhookHandler.ts` | Stripe webhook normalization | ✅ Complete |

### Payment Database Schema
**Tables**:
1. `customer_payment_profiles` - Payment preferences, autopay settings, consent records
2. `payment_methods` - Tokenized payment method references (pm_xxx, never raw PAN)
3. `operator_payment_policies` - Business-level payment rules and thresholds
4. `payment_transactions` - Audit trail of all payment attempts
5. `payment_sessions` - In-app/SMS payment session tracking
6. `payment_agent_decisions` - Agent decision log with reasoning
7. `payment_agent_tasks` - Retry queue for failed payments

### Payment Agent Decisions
**Decision Types**:
- `autopay_capture` - Auto-charge stored payment method (high confidence, ≥ 0.85)
- `request_setup` - First service payment method setup
- `send_text_to_pay` - SMS payment link for customer-initiated pay
- `create_in_app_session` - In-app payment session (Apple Pay/Google Pay/Card)
- `fallback_invoice` - Autopay disabled or amount exceeds threshold
- `escalate` - Low confidence, human review required

### Payment Flow (Job Completion → Payment)
```
1. Crew completes job → `POST /commands/complete-job`
2. QA Agent validates (photos, checklist)
3. Payment Agent evaluates:
   - Is this first service? → request_setup
   - Autopay enabled + amount ≤ $500? → autopay_capture
   - Autopay disabled or amount > $500? → send_text_to_pay or fallback_invoice
   - Low confidence (<0.70)? → escalate to FINANCE/OPS
4. Command handlers execute decision
5. Events emitted:
   - PaymentCaptured (success)
   - PaymentFailed (retry or escalate)
   - InvoiceFallbackTriggered (invoice creation)
6. Customer receives notification (SMS or push)
```

### Payment Methods Supported
**In Payment Agent**:
- `APPLE_PAY` - Apple Pay (Stripe integration)
- `GOOGLE_PAY` - Google Pay (Stripe integration)
- `CARD` - Credit/debit card (Stripe)

**Not Yet in Customer App**:
- ❌ Payment method setup UI
- ❌ Stored payment method management
- ❌ Autopay enable/disable toggle
- ❌ In-app payment session (Apple Pay/Google Pay)
- ❌ Text-to-pay link click handling
- ❌ Payment status display (captured/pending/failed)
- ❌ Receipt view
- ❌ Invoice view (fallback)

### Operator Payment Policies (Business Rules)
**Configurable Thresholds**:
- `maxAutopayAmount` - Max amount for auto-capture (default: $500)
- `requireCustomerConfirmationOver` - Customer must confirm over this amount (default: $200)
- `invoiceOnlyOver` - Force invoice if job exceeds this amount (default: null)
- `firstServiceRequiresSetup` - Require payment method setup before first service (default: true)
- `paymentFailureRetryCount` - Max retry attempts (default: 3)

### Confidence-Based Autonomy
| Confidence Range | Agent Action | Customer UX |
|------------------|--------------|-------------|
| ≥ 0.85 | Full autonomy (autopay capture) | Silent payment, push notification |
| 0.70-0.84 | Customer confirmation required | Text-to-pay or in-app pay |
| < 0.70 | Escalate to FINANCE/OPS | Wait for human review, then notify |

### Risk Flags
- `PAYMENT_RISK` - High-risk transaction detected
- `CONSENT_MISSING` - No explicit consent for autopay
- `POLICY_VIOLATION` - Violates operator policy thresholds
- `AMOUNT_THRESHOLD_EXCEEDED` - Amount exceeds autopay limit
- `METHOD_UNAVAILABLE` - Payment method expired or unavailable
- `CUSTOMER_DISPUTE_HISTORY` - Customer has disputed payments
- `FIRST_SERVICE_NO_SETUP` - First service but no payment method

---

## Gap Analysis Summary

### Missing Customer UX (High Priority)
1. **Payment method setup flow** - First service requires payment method before scheduling
2. **Stored payment method management** - View, add, remove, set default
3. **Autopay settings** - Enable/disable autopay, view autopay status
4. **In-app payment** - Apple Pay/Google Pay/Card payment flow
5. **Text-to-pay handler** - Handle SMS payment link deep links
6. **Payment status display** - Show captured/pending/failed on completed jobs
7. **Receipt view** - View payment receipt after successful payment
8. **Invoice view** - View invoice if payment falls back to invoice
9. **Payment failure recovery** - Retry payment, update payment method

### Missing Customer UX (Medium Priority)
10. **Job detail screen** - No payment status shown on completed jobs
11. **Jobs list** - No payment status badges
12. **Home dashboard** - No unpaid jobs banner
13. **Notification handling** - No payment-related notification actions

### Design System Gaps
14. **No formal design tokens** - Inline styles, no semantic color/text/spacing scale
15. **No component variant system** - No shared variant properties
16. **No payment UI components** - No payment method card, payment status pill, etc.
17. **No auto-layout patterns** - Inconsistent spacing and layout

### Agent Integration Gaps
18. **No agent state visualization** - Customer can't see agent decisions (by design?)
19. **No confidence indicators** - Customer doesn't know why action was taken
20. **No escalation visibility** - Customer doesn't know payment is under review

---

## Recommended Source Files for Design Strengthening

### Customer Flow References (Existing)
1. `/mobile/src/screens/services/ServiceCatalogScreen.tsx` - Browse services
2. `/mobile/src/screens/services/RequestServiceScreen.tsx` - Request service
3. `/mobile/src/screens/services/ServiceRequestDetailScreen.tsx` - Track request
4. `/mobile/src/screens/reviews/ReviewPromptScreen.tsx` - Submit review

### Staff Flow References (Reusable Patterns)
5. `/mobile/src/screens/settings/PayrollPreferencesScreen.tsx` - Payment method selector pattern
6. `/mobile/src/components/common/StatusPill.tsx` - Status badge pattern
7. `/mobile/src/components/common/AddressLink.tsx` - Actionable link pattern

### Payment Agent References (Backend)
8. `/shared/orchestrator/payment-contracts.ts` - Payment event/command schemas
9. `/shared/schema-payment.ts` - Payment data model
10. `/server/orchestrator/payment/paymentAgent.ts` - Payment decision logic

### Design System References
11. `/docs/design-system-spec.md` - Design system specification (aspirational)
12. `/docs/design/FIGMA_MOBILE_EXPORT.md` - Staff app Figma export (for patterns)

---

## Engineering Context

### Tech Stack (Customer Mobile)
- **Framework**: React Native (Expo SDK 51)
- **Navigation**: React Navigation 6
- **State**: Zustand (client), React Query (server)
- **HTTP**: Axios
- **Storage**: Expo Secure Store, AsyncStorage
- **Push**: Firebase Cloud Messaging
- **Language**: TypeScript
- **Testing**: Jest, React Testing Library (not yet implemented)

### Deployment
- **iOS**: TestFlight → App Store
- **Android**: Google Play Console
- **Web**: Expo web build (dev only)

### Backend Requirements (for Customer Payment UX)
**New Endpoints Needed**:
- `GET /api/payment-methods` - Get customer's stored payment methods
- `POST /api/payment-methods` - Add payment method (returns setup session URL)
- `DELETE /api/payment-methods/:id` - Remove payment method
- `PATCH /api/payment-methods/:id/default` - Set default payment method
- `GET /api/payment-preferences` - Get autopay/billing preferences
- `PUT /api/payment-preferences` - Update autopay/billing preferences
- `GET /api/payment-sessions/:sessionId` - Get payment session status
- `POST /api/payments/retry` - Retry failed payment
- `GET /api/transactions/:id` - Get payment transaction details
- `GET /api/invoices/:id` - Get invoice details

**Existing Endpoints to Enhance**:
- `GET /api/jobs/:id` - Add `paymentStatus` field (captured/pending/failed/none)
- `GET /api/jobs/:id` - Add `invoiceId` field (if payment fell back to invoice)

---

## Conclusion

**Current State**: Customer app has basic service request and review flows, but **zero payment UX**.

**Payment Agent State**: Fully implemented backend, ready for customer UI integration.

**Gap**: Customer cannot set up payment methods, enable autopay, pay for services, or see payment status.

**Opportunity**: Strengthen customer app by surfacing payment agent workflows in a mobile-first, touch-optimized UX that matches the staff app's design patterns.

**Next Step**: Define strengthened customer UX and create Figma-ready design export.
