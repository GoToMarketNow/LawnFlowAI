# LawnFlow Customer App - Payment UX Plan (No Direct Gateway Integration)

**Date**: January 11, 2026
**Constraint**: No direct Stripe/payment gateway integration in mobile app
**Approach**: Backend-proxied payment flows + web-based payment sessions

---

## Executive Summary

This plan implements customer payment UX **without requiring direct payment gateway SDK integration** in the mobile app. All sensitive payment operations (tokenization, card entry, Apple Pay/Google Pay) are handled via:

1. **Backend-generated payment session URLs** (Stripe Checkout / Payment Links)
2. **In-app WebView** for secure payment entry
3. **Deep link callbacks** for success/failure handling
4. **Backend Payment Agent** orchestrating all payment logic

**Result**: Customers get full payment functionality with **zero PCI-DSS burden** on mobile app.

---

## Core Strategy: Backend-Proxied Payment Sessions

### How It Works

```
Mobile App                  Backend                    Stripe
    |                          |                          |
    |--POST /payment-sessions->|                          |
    |   {jobId, context}        |                          |
    |                          |---Create Checkout------->|
    |                          |<--Session URL------------|
    |<--Session URL------------|                          |
    |                          |                          |
    |--Open WebView----------->|                          |
    |   (session URL)          |                          |
    |                          |                          |
    |   [Customer enters card] |                          |
    |   [Customer pays]        |                          |
    |                          |<--Webhook: Success-------|
    |                          |                          |
    |<--Deep link callback-----|                          |
    |   lawnflow://payment-success?sessionId=xxx          |
    |                          |                          |
    |--Close WebView-----------|                          |
    |--Navigate to Receipt-----|                          |
```

**Key Benefits**:
- ✅ No Stripe SDK required in mobile app
- ✅ No PCI-DSS compliance burden
- ✅ Stripe handles all card validation, 3DS, Apple Pay/Google Pay
- ✅ Native-like UX (WebView feels like native screen)
- ✅ Backend Payment Agent still orchestrates everything

---

## What We Can Build (Feasible Without Gateway SDK)

### ✅ Tier 1: Backend-Proxied Flows (High Priority)

#### 1. Payment Method Setup (First Service)
**User Flow**:
1. Customer approves service request
2. App shows "Payment method required"
3. Tap "Add Payment Method" → Backend creates Stripe Setup Intent
4. App opens WebView with Stripe Setup Session URL
5. Customer enters card in Stripe-hosted form
6. Stripe validates, tokenizes, redirects to success URL
7. Backend receives webhook, stores payment method token
8. App receives deep link callback, closes WebView
9. Navigate back to Service Request Detail (now shows "Schedule" button enabled)

**Mobile Implementation**:
- Screen: `PaymentSetupScreen` (launches WebView)
- Component: `PaymentWebView` (handles Stripe session)
- Deep link handler: `lawnflow://payment-setup-success`

**Backend Requirements**:
- Endpoint: `POST /api/payment-sessions/setup` → returns Stripe Setup Session URL
- Webhook: Stripe `setup_intent.succeeded` → store payment method token
- Endpoint: `GET /api/payment-methods` → return saved methods (masked)

**Effort**: 3 days mobile + 2 days backend

---

#### 2. In-App Payment (Pay Now)
**User Flow**:
1. Job completed, customer has unpaid job
2. Tap "Pay Now" on job detail
3. Backend creates Stripe Checkout Session with pre-selected payment method
4. App opens WebView with Checkout URL
5. Customer confirms payment (one-tap if saved method)
6. Stripe processes payment, redirects to success URL
7. Backend receives webhook, updates job payment status
8. App receives deep link callback, closes WebView
9. Navigate to Receipt screen

**Mobile Implementation**:
- Screen: `InAppPaymentWebViewScreen` (launches WebView)
- Component: `PaymentWebView` (reused)
- Deep link handler: `lawnflow://payment-success?jobId=123`

**Backend Requirements**:
- Endpoint: `POST /api/payment-sessions/checkout` → returns Stripe Checkout URL
- Webhook: Stripe `checkout.session.completed` → capture payment
- Endpoint: `GET /api/transactions/:id` → return receipt data

**Effort**: 2 days mobile + 2 days backend

---

#### 3. Payment Method Management
**User Flow**:
1. Navigate to Settings → Payment Methods
2. App fetches saved payment methods from backend (shows masked data)
3. View list: "Visa ••••1234", "Exp 12/25", "Default" badge
4. Tap "Add Payment Method" → same flow as #1 (Setup Intent)
5. Tap "Remove" → backend deletes token from Stripe
6. Tap "Set as Default" → backend updates default flag

**Mobile Implementation**:
- Screen: `PaymentMethodsScreen` (read-only list + actions)
- Component: `PaymentMethodCard` (displays masked data)
- No WebView needed for view/remove/default actions

**Backend Requirements**:
- Endpoint: `GET /api/payment-methods` → list methods (masked)
- Endpoint: `DELETE /api/payment-methods/:id` → detach from Stripe
- Endpoint: `PATCH /api/payment-methods/:id/default` → update default

**Effort**: 2 days mobile + 1 day backend

---

#### 4. Autopay Settings
**User Flow**:
1. Navigate to Settings → Payment Preferences
2. View autopay toggle (current state fetched from backend)
3. Toggle ON → confirmation modal → backend updates preference
4. Explainer text: "We'll automatically charge your default payment method after service completion (max $500)"
5. View autopay status on payment methods list

**Mobile Implementation**:
- Screen: `PaymentPreferencesScreen` (toggle + explainer)
- Component: `AutopayToggle` (switch with confirmation)
- No WebView needed

**Backend Requirements**:
- Endpoint: `GET /api/payment-preferences` → autopay status
- Endpoint: `PUT /api/payment-preferences` → update autopay
- Payment Agent already implements autopay logic ✅

**Effort**: 1 day mobile + 0.5 days backend

---

#### 5. Payment Status Display
**User Flow**:
1. Job detail screen shows payment status badge
2. If paid: Show "View Receipt" button
3. If unpaid: Show "Pay Now" button
4. If pending: Show "Payment processing..." message
5. If failed: Show "Payment failed" + "Retry" button

**Mobile Implementation**:
- Component: `PaymentStatusIndicator` (badge with icon)
- Screen: Enhanced `JobDetailScreen` (payment status row)
- Screen: Enhanced `JobCard` (payment status pill)

**Backend Requirements**:
- Enhance: `GET /api/jobs/:id` → include `paymentStatus` field
- Already exists in Payment Agent ✅

**Effort**: 1 day mobile + 0.5 days backend

---

#### 6. Receipt View
**User Flow**:
1. After successful payment or from "View Receipt" button
2. App fetches transaction details from backend
3. Display receipt card with:
   - Transaction ID
   - Date/time
   - Service type
   - Amount
   - Payment method (masked)
   - Status
4. Optional: "Share Receipt" → generate PDF on backend, download link

**Mobile Implementation**:
- Screen: `ReceiptScreen` (displays transaction data)
- Component: `ReceiptCard` (formatted transaction details)
- No WebView needed

**Backend Requirements**:
- Endpoint: `GET /api/transactions/:id` → transaction details
- Optional: `GET /api/transactions/:id/pdf` → PDF receipt

**Effort**: 1 day mobile + 1 day backend

---

### ✅ Tier 2: Text-to-Pay & Notifications (Medium Priority)

#### 7. Text-to-Pay Deep Link
**User Flow**:
1. Job completed, Payment Agent decides: `send_text_to_pay`
2. Backend sends SMS: "Pay for your lawn service: [link]"
3. Customer taps link → Opens app via deep link
4. App validates session, opens WebView with Stripe Checkout
5. Same flow as #2 (In-App Payment)

**Mobile Implementation**:
- Deep link handler: `lawnflow://pay/{sessionId}`
- Reuse: `InAppPaymentWebViewScreen`

**Backend Requirements**:
- SMS adapter already exists ✅
- Endpoint: `GET /api/payment-sessions/:sessionId` → validate session

**Effort**: 1 day mobile + 0.5 days backend

---

#### 8. Payment Notifications with Actions
**User Flow**:
1. Payment succeeds → Push notification: "Payment successful! Tap to view receipt"
2. Payment fails → Push notification: "Payment failed. Tap to retry"
3. Tap notification → Deep link to appropriate screen

**Mobile Implementation**:
- Enhance: Notification handler with payment-specific actions
- Deep links: `lawnflow://receipt/{transactionId}`, `lawnflow://pay-retry/{jobId}`

**Backend Requirements**:
- Webhook: After payment event, send push notification via Firebase FCM
- Already have FCM integration ✅

**Effort**: 1 day mobile + 1 day backend

---

#### 9. Invoice Fallback View
**User Flow**:
1. Payment Agent decides: `fallback_invoice` (amount > $500 or autopay disabled)
2. Backend creates invoice, sends notification
3. Customer taps notification → Invoice detail screen
4. View invoice: Amount, due date, line items
5. Tap "Pay Now" → launches payment flow (#2)

**Mobile Implementation**:
- Screen: `InvoiceScreen` (displays invoice data)
- Deep link: `lawnflow://invoice/{invoiceId}`
- Reuse payment flow for "Pay Now"

**Backend Requirements**:
- Invoice Agent already creates invoices ✅
- Endpoint: `GET /api/invoices/:id` → invoice details

**Effort**: 1 day mobile + 0.5 days backend

---

### ✅ Tier 3: Polish & Edge Cases (Low Priority)

#### 10. Unpaid Jobs Banner (Home Screen)
**User Flow**:
1. Home screen checks for unpaid jobs
2. If unpaid jobs > 0: Show banner "You have 2 unpaid jobs. Pay now"
3. Tap banner → Navigate to Jobs screen (Unpaid filter)

**Mobile Implementation**:
- Component: `UnpaidJobsBanner` (similar to `ReminderBanner`)
- Enhance: `HomeScreen`

**Backend Requirements**:
- Endpoint: `GET /api/jobs?paymentStatus=unpaid` → count unpaid jobs
- Already can filter by payment status ✅

**Effort**: 0.5 days mobile + 0 days backend

---

#### 11. Jobs List - Unpaid Filter
**User Flow**:
1. Jobs screen shows tabs: Upcoming | Completed | Unpaid
2. Tap "Unpaid" tab → Show only jobs with unpaid status
3. Each job card shows payment status pill

**Mobile Implementation**:
- Enhance: `JobsScreen` (add Unpaid tab)
- Enhance: `JobCard` (show payment status pill)

**Backend Requirements**:
- Already can filter jobs by payment status ✅

**Effort**: 1 day mobile + 0 days backend

---

#### 12. Payment Failure Retry
**User Flow**:
1. Job detail shows "Payment failed" status
2. Tap "Retry Payment" → Backend creates new Checkout session
3. Same flow as #2 (In-App Payment)
4. Option to "Use Different Method" → Add new payment method flow (#1)

**Mobile Implementation**:
- Enhance: `JobDetailScreen` (retry button)
- Reuse: Payment flows

**Backend Requirements**:
- Retry logic already exists in Payment Agent ✅

**Effort**: 0.5 days mobile + 0 days backend

---

#### 13. Payment History
**User Flow**:
1. Settings → Payment History
2. List of all past payments with date, amount, method, status
3. Tap row → Navigate to Receipt screen

**Mobile Implementation**:
- Screen: `PaymentHistoryScreen` (list)
- Component: `PaymentHistoryRow` (list item)

**Backend Requirements**:
- Endpoint: `GET /api/transactions` → list all transactions

**Effort**: 1 day mobile + 1 day backend

---

## What We CAN'T Build (Requires Gateway SDK)

### ❌ Native Apple Pay / Google Pay Buttons
**Why**: Requires native SDK integration (PassKit for iOS, Google Pay API for Android)

**Workaround**: Stripe Checkout in WebView supports Apple Pay/Google Pay natively
- Customer opens WebView → Stripe detects device → Shows Apple Pay button
- Customer taps Apple Pay → Native sheet appears
- Payment completes → Success callback to app

**UX Impact**: Slightly less seamless (one extra tap), but fully functional

---

### ❌ Card Entry with Real-Time Validation
**Why**: Requires Stripe Elements SDK for inline card validation

**Workaround**: Stripe Checkout handles all validation in WebView
- Stripe validates card number, expiry, CVC in real-time
- Stripe handles 3D Secure authentication
- Mobile app just displays WebView

**UX Impact**: Minimal (Stripe Checkout is mobile-optimized)

---

### ❌ Saved Payment Method Quick-Pick (Without WebView)
**Why**: Charging a saved payment method requires Stripe SDK or server-side API

**Workaround**: Backend creates Checkout session with pre-selected payment method
- Customer opens WebView → Stripe shows "Pay with Visa ••••1234"
- One-tap to confirm payment
- No re-entering card details

**UX Impact**: Still fast (one-tap), just via WebView

---

## Mobile App Architecture (No Gateway SDK)

### Core Components

#### 1. PaymentWebView Component
```typescript
interface PaymentWebViewProps {
  sessionUrl: string;
  successUrl: string;
  cancelUrl: string;
  onSuccess: (sessionId: string) => void;
  onCancel: () => void;
  onError: (error: string) => void;
}

export function PaymentWebView({ sessionUrl, successUrl, cancelUrl, onSuccess, onCancel, onError }: PaymentWebViewProps) {
  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    const { url } = navState;

    if (url.startsWith(successUrl)) {
      // Extract session ID from success URL
      const sessionId = extractSessionId(url);
      onSuccess(sessionId);
    } else if (url.startsWith(cancelUrl)) {
      onCancel();
    }
  };

  return (
    <WebView
      source={{ uri: sessionUrl }}
      onNavigationStateChange={handleNavigationStateChange}
      onError={(syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        onError(nativeEvent.description);
      }}
      style={{ flex: 1 }}
    />
  );
}
```

**Usage**: All payment flows (setup, checkout, text-to-pay) use this component

---

#### 2. Deep Link Handler (Payment Callbacks)
```typescript
// navigation/deepLinkHandlers.ts
export function handlePaymentDeepLinks(url: string, navigation: any) {
  if (url.startsWith('lawnflow://payment-setup-success')) {
    const sessionId = extractParam(url, 'sessionId');
    // Fetch updated payment methods
    queryClient.invalidateQueries(['payment-methods']);
    // Navigate back to originating screen
    navigation.goBack();
    Alert.alert('Success', 'Payment method added successfully');
  }

  if (url.startsWith('lawnflow://payment-success')) {
    const jobId = extractParam(url, 'jobId');
    const transactionId = extractParam(url, 'transactionId');
    // Navigate to Receipt screen
    navigation.navigate('Receipt', { transactionId });
  }

  if (url.startsWith('lawnflow://payment-cancel')) {
    // Navigate back
    navigation.goBack();
    Alert.alert('Cancelled', 'Payment was cancelled');
  }

  if (url.startsWith('lawnflow://pay')) {
    // Text-to-pay link
    const sessionId = extractParam(url, 'sessionId');
    // Fetch session details
    fetchPaymentSession(sessionId).then((session) => {
      navigation.navigate('InAppPaymentWebView', { sessionUrl: session.url });
    });
  }
}
```

---

### Updated Screen Implementations

#### PaymentSetupScreen (WebView Approach)
```typescript
export function PaymentSetupScreen({ route, navigation }) {
  const { context } = route.params; // 'first_service' | 'payment_method_update'
  const [loading, setLoading] = useState(false);

  const handleAddPaymentMethod = async () => {
    setLoading(true);
    try {
      // Backend creates Stripe Setup Intent and returns session URL
      const { sessionUrl, sessionId } = await createPaymentSetupSession({ context });

      // Navigate to WebView screen
      navigation.navigate('PaymentWebView', {
        sessionUrl,
        sessionId,
        type: 'setup',
        successCallback: 'lawnflow://payment-setup-success',
        cancelCallback: 'lawnflow://payment-setup-cancel',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to start payment setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set Up Payment</Text>
      <Text style={styles.subtitle}>Add a payment method to schedule your service</Text>

      <Card style={styles.infoCard}>
        <Text style={styles.infoText}>
          💳 We accept all major credit cards, Apple Pay, and Google Pay
        </Text>
      </Card>

      <Button variant="primary" size="large" onPress={handleAddPaymentMethod} loading={loading}>
        Add Payment Method
      </Button>

      <Text style={styles.secureText}>
        🔒 Secured by Stripe. Your card details are never stored on our servers.
      </Text>
    </View>
  );
}
```

---

#### InAppPaymentWebViewScreen
```typescript
export function InAppPaymentWebViewScreen({ route, navigation }) {
  const { sessionUrl, sessionId, jobId } = route.params;

  const handleSuccess = (transactionId: string) => {
    // Close WebView, navigate to success screen
    navigation.replace('PaymentSuccess', { transactionId, jobId });
  };

  const handleCancel = () => {
    navigation.goBack();
    Alert.alert('Cancelled', 'Payment was cancelled');
  };

  const handleError = (error: string) => {
    navigation.goBack();
    Alert.alert('Error', error);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕ Cancel</Text>
        </TouchableOpacity>
      </View>
      <PaymentWebView
        sessionUrl={sessionUrl}
        successUrl="lawnflow://payment-success"
        cancelUrl="lawnflow://payment-cancel"
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        onError={handleError}
      />
    </View>
  );
}
```

---

## Backend API Implementation

### New Endpoints Required

#### 1. Create Payment Setup Session
```typescript
// POST /api/payment-sessions/setup
router.post('/payment-sessions/setup', authenticate, async (req, res) => {
  const { context } = req.body; // 'first_service' | 'payment_method_update'
  const customerId = req.user.id;

  // Create Stripe Setup Intent
  const setupIntent = await stripe.setupIntents.create({
    customer: getStripeCustomerId(customerId),
    payment_method_types: ['card'],
    metadata: {
      customerId,
      context,
    },
  });

  // Create Stripe Checkout Session for setup
  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer: getStripeCustomerId(customerId),
    payment_method_types: ['card'],
    success_url: `lawnflow://payment-setup-success?sessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `lawnflow://payment-setup-cancel?sessionId={CHECKOUT_SESSION_ID}`,
    metadata: {
      customerId,
      context,
    },
  });

  res.json({
    sessionUrl: session.url,
    sessionId: session.id,
  });
});
```

---

#### 2. Create Payment Checkout Session
```typescript
// POST /api/payment-sessions/checkout
router.post('/payment-sessions/checkout', authenticate, async (req, res) => {
  const { jobId, amount } = req.body;
  const customerId = req.user.id;

  // Get customer's default payment method
  const defaultMethod = await getDefaultPaymentMethod(customerId);

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: getStripeCustomerId(customerId),
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(amount * 100), // Convert to cents
        product_data: {
          name: `Lawn Service - Job #${jobId}`,
        },
      },
      quantity: 1,
    }],
    payment_intent_data: {
      setup_future_usage: 'off_session', // Save for future use
    },
    success_url: `lawnflow://payment-success?sessionId={CHECKOUT_SESSION_ID}&jobId=${jobId}`,
    cancel_url: `lawnflow://payment-cancel?sessionId={CHECKOUT_SESSION_ID}`,
    metadata: {
      customerId,
      jobId,
    },
  });

  res.json({
    sessionUrl: session.url,
    sessionId: session.id,
  });
});
```

---

#### 3. Stripe Webhook Handler (Enhanced)
```typescript
// POST /webhooks/stripe
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case 'setup_intent.succeeded': {
      const setupIntent = event.data.object;
      const customerId = setupIntent.metadata.customerId;
      const paymentMethod = setupIntent.payment_method;

      // Save payment method to database
      await savePaymentMethod(customerId, paymentMethod);

      // Send push notification (optional)
      await sendPushNotification(customerId, {
        title: 'Payment method added',
        body: 'Your payment method was added successfully',
      });
      break;
    }

    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerId = session.metadata.customerId;
      const jobId = session.metadata.jobId;
      const paymentIntentId = session.payment_intent;

      if (session.mode === 'payment') {
        // Payment completed, update job status
        await updateJobPaymentStatus(jobId, 'captured', paymentIntentId);

        // Send push notification
        await sendPushNotification(customerId, {
          title: 'Payment successful',
          body: 'Your payment was processed successfully',
          data: {
            type: 'payment_success',
            jobId,
            transactionId: paymentIntentId,
          },
        });
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object;
      const jobId = paymentIntent.metadata.jobId;
      const customerId = paymentIntent.metadata.customerId;

      // Update job payment status
      await updateJobPaymentStatus(jobId, 'failed', paymentIntent.id);

      // Send push notification
      await sendPushNotification(customerId, {
        title: 'Payment failed',
        body: 'Your payment could not be processed. Please try again.',
        data: {
          type: 'payment_failed',
          jobId,
        },
      });
      break;
    }
  }

  res.json({ received: true });
});
```

---

## Implementation Timeline (No Gateway SDK)

### Phase 1: Core Payment Flows (Sprint 1-2)

#### Sprint 1: Setup & Infrastructure
- [ ] Install `react-native-webview` (if not installed)
- [ ] Create `PaymentWebView` component
- [ ] Implement deep link handlers for payment callbacks
- [ ] Backend: Implement `/payment-sessions/setup` endpoint
- [ ] Backend: Implement `/payment-sessions/checkout` endpoint
- [ ] Backend: Enhance Stripe webhook handler

**Effort**: 4 days mobile + 3 days backend

---

#### Sprint 2: Payment Setup & Management
- [ ] Create `PaymentSetupScreen` (launches WebView)
- [ ] Create `PaymentMethodsScreen` (list saved methods)
- [ ] Create `PaymentPreferencesScreen` (autopay toggle)
- [ ] Enhance `ServiceRequestDetailScreen` (payment method check)
- [ ] Backend: Implement payment methods API (GET/DELETE/PATCH)
- [ ] Backend: Implement payment preferences API (GET/PUT)

**Effort**: 5 days mobile + 2 days backend

---

### Phase 2: In-App Payment (Sprint 3-4)

#### Sprint 3: Payment Flow
- [ ] Create `InAppPaymentWebViewScreen`
- [ ] Create `PaymentSuccessScreen`
- [ ] Create `PaymentFailedScreen`
- [ ] Create `ReceiptScreen`
- [ ] Backend: Enhance job API (include payment status)
- [ ] Backend: Implement transaction API (GET details)

**Effort**: 4 days mobile + 2 days backend

---

#### Sprint 4: Job Integration
- [ ] Enhance `JobDetailScreen` (payment status + actions)
- [ ] Enhance `JobCard` (payment status pill)
- [ ] Enhance `JobsScreen` (Unpaid tab)
- [ ] Enhance `HomeScreen` (Unpaid jobs banner)
- [ ] Backend: No changes needed (already supports filtering)

**Effort**: 3 days mobile + 0 days backend

---

### Phase 3: Advanced Features (Sprint 5)

#### Sprint 5: Text-to-Pay, Notifications, Polish
- [ ] Implement text-to-pay deep link handler
- [ ] Enhance notification handler (payment-specific actions)
- [ ] Create `InvoiceScreen` (invoice fallback)
- [ ] Create `PaymentHistoryScreen` (optional)
- [ ] Edge case handling (expired sessions, network errors)
- [ ] Backend: Invoice API (GET details)

**Effort**: 3 days mobile + 2 days backend

---

## Total Effort Summary

| Phase | Mobile Days | Backend Days | Total Days |
|-------|-------------|--------------|------------|
| Phase 1 (Sprint 1-2) | 9 | 5 | 14 |
| Phase 2 (Sprint 3-4) | 7 | 2 | 9 |
| Phase 3 (Sprint 5) | 3 | 2 | 5 |
| **Total** | **19** | **9** | **28** |

**Timeline**: 5 sprints (10 weeks) with 2 mobile engineers + 1 backend engineer

**Compare to Original Plan**: 14 weeks → 10 weeks (4 weeks faster due to no SDK integration)

---

## Advantages of WebView Approach

### ✅ Pros
1. **No PCI-DSS compliance burden** - Stripe handles all card data
2. **Faster implementation** - No SDK integration, testing, or certification
3. **Apple Pay / Google Pay work automatically** - Stripe Checkout supports them natively
4. **3D Secure handled by Stripe** - No custom implementation needed
5. **Smaller app bundle** - No additional SDKs to include
6. **Cross-platform consistency** - Same WebView component for iOS/Android
7. **Easier maintenance** - Stripe updates Checkout, no app updates needed
8. **Backend-first architecture** - Payment Agent retains full control

### ❌ Cons
1. **Slightly less seamless UX** - WebView transition instead of native screens
2. **Network dependency** - Requires internet for WebView to load
3. **Limited customization** - Stripe Checkout styling is limited
4. **Potential for WebView bugs** - Edge cases with deep link callbacks

**Overall**: Pros heavily outweigh cons for a v1 payment implementation

---

## UX Comparison: Native SDK vs WebView

### Native SDK Approach
```
Customer flow:
1. Tap "Add Payment Method"
2. Native screen appears instantly
3. Enter card details in native inputs
4. Instant validation feedback
5. Submit → Native success screen

Time: ~30 seconds
Taps: 4-5
```

### WebView Approach (Our Plan)
```
Customer flow:
1. Tap "Add Payment Method"
2. Loading spinner (0.5s)
3. WebView loads Stripe Checkout (1-2s)
4. Enter card details in Stripe form
5. Instant validation feedback (Stripe)
6. Submit → Redirect to success callback
7. WebView closes, native success message

Time: ~35 seconds
Taps: 4-5
```

**Delta**: +5 seconds, +1 loading state

**Acceptable**: Yes, especially for v1 where speed to market is critical

---

## Migration Path (Future Native SDK Integration)

If you later decide to integrate native Stripe SDK:

1. **Backend stays the same** - Payment Agent logic unchanged
2. **Replace WebView screens** - Swap out WebView components with native SDK screens
3. **Keep same APIs** - Backend endpoints remain compatible
4. **Gradual rollout** - Feature flag to A/B test native vs WebView

**Effort to migrate**: ~2 weeks (just mobile app changes)

**When to migrate**:
- If payment volume grows significantly (>1000 payments/month)
- If customer feedback indicates UX friction
- If you want to deeply customize payment UI
- If you add subscription/recurring billing (better native experience)

---

## Risk Mitigation

### Risk: WebView Deep Link Callbacks Fail
**Mitigation**:
- Backend tracks session status via Stripe webhooks (source of truth)
- If customer closes app during payment, webhook still processes payment
- On app reopen, poll for updated payment status
- Show "Checking payment status..." screen

### Risk: Stripe Checkout URL Doesn't Load
**Mitigation**:
- Implement timeout (10s) with retry prompt
- Fallback to SMS text-to-pay link if WebView fails repeatedly
- Analytics: Track WebView load failures

### Risk: Customer Confusion About Stripe Branding
**Mitigation**:
- Add explainer text: "🔒 Secured by Stripe. Your card details are never stored on our servers."
- Stripe Checkout can be customized with your logo/branding (limited)

### Risk: iOS/Android WebView Inconsistencies
**Mitigation**:
- Use `react-native-webview` library (well-maintained, 20k+ stars)
- Test on multiple OS versions (iOS 14+, Android 10+)
- Fallback to external browser if WebView fails (`Linking.openURL`)

---

## Testing Plan

### Unit Tests
- [ ] `PaymentWebView` component (navigation state changes)
- [ ] Deep link handlers (payment callbacks)
- [ ] API client functions (session creation)

### Integration Tests
- [ ] Payment setup flow (end-to-end)
- [ ] In-app payment flow (end-to-end)
- [ ] Text-to-pay flow (end-to-end)

### Manual QA Checklist
- [ ] Add payment method (card) via WebView
- [ ] Add payment method (Apple Pay) via WebView
- [ ] Add payment method (Google Pay) via WebView
- [ ] View saved payment methods
- [ ] Remove payment method
- [ ] Set default payment method
- [ ] Enable autopay
- [ ] Pay for job (saved method) via WebView
- [ ] Payment success flow
- [ ] Payment failure flow
- [ ] Payment retry flow
- [ ] Text-to-pay link opens in app
- [ ] Receipt view
- [ ] Invoice view (fallback)
- [ ] Unpaid jobs banner
- [ ] Unpaid jobs filter
- [ ] Payment notifications tap to correct screen
- [ ] WebView cancellation (back button)
- [ ] WebView timeout handling
- [ ] Offline mode (graceful error)

---

## Success Metrics (Same as Original Plan)

### Payment Adoption
- **Payment method setup rate**: Target 90%
- **Autopay adoption**: Target 60%
- **In-app payment rate**: Target 70%
- **Payment success rate**: Target 95%

### Customer Satisfaction
- **Payment UX NPS**: Target +40
- **Support ticket reduction**: Target 50% decrease
- **Payment failure recovery**: Target 80%

### Technical
- **WebView load time**: Target <2 seconds
- **Deep link callback success**: Target >95%
- **Payment session completion**: Target >90%

---

## Conclusion

**Feasibility**: ✅ High - All features implementable without direct gateway SDK

**Timeline**: 10 weeks (vs 14 weeks with SDK integration)

**Cost**: Lower (no PCI compliance, smaller bundle, faster development)

**UX**: Acceptable (slightly less seamless, but fully functional)

**Risk**: Low (Stripe Checkout is battle-tested, WebView is stable)

**Recommendation**: **Proceed with WebView approach for v1**, evaluate native SDK migration after 6 months based on metrics

---

## Next Steps

1. **Week 1**: Kickoff Sprint 1 (WebView infrastructure)
2. **Week 2**: Complete Sprint 1 (setup sessions + deep links)
3. **Week 3-4**: Sprint 2 (payment setup + management screens)
4. **Week 5-6**: Sprint 3 (in-app payment flow)
5. **Week 7-8**: Sprint 4 (job integration)
6. **Week 9-10**: Sprint 5 (text-to-pay, notifications, polish)

**MVP Ready**: Week 6 (payment setup + in-app payment working)
**Full Feature Set**: Week 10 (all advanced features complete)

---

**End of Plan**
