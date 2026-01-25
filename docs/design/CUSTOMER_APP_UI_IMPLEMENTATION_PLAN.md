# LawnFlow Customer App - UI Implementation Plan

**Date**: January 11, 2026
**Scope**: Customer mobile app (iOS/Android)
**Goal**: Implement payment UX to match Payment Agent backend capabilities

**Source Documents**:
- `/docs/design/REPO_AUDIT_AND_SOURCES.md` - Repository audit
- `/docs/design/CUSTOMER_APP_GAP_ANALYSIS.md` - Gap analysis
- `/docs/design/FIGMA_CUSTOMER_APP_EXPORT.md` - Figma design spec

---

## Executive Summary

This plan implements **20+ missing payment screens and components** to enable customers to set up payment methods, enable autopay, pay for services, and manage billing preferences. The Payment Agent backend is fully implemented; this plan builds the customer-facing UI.

**Timeline**: 6 sprints (12 weeks)
**Team Size**: 2 mobile engineers + 1 backend engineer (for new endpoints)
**Risk**: Low (backend ready, patterns established)

---

## Phase 1: Foundation & Design System (Sprint 1-2)

### Sprint 1: Design Tokens & Component System

#### Objective
Create formal design system to replace inline styles and establish component variant system.

#### Tasks

##### 1.1: Design Tokens
**Files to Create**:
- `/mobile/src/styles/tokens.ts` - Master token export
- `/mobile/src/styles/colors.ts` - Semantic color palette
- `/mobile/src/styles/typography.ts` - Text style definitions
- `/mobile/src/styles/spacing.ts` - Spacing scale
- `/mobile/src/styles/radius.ts` - Border radius scale
- `/mobile/src/styles/shadows.ts` - Shadow/elevation definitions

**Implementation**:
```typescript
// colors.ts
export const colors = {
  primary: {
    50: '#E3F2FD',
    500: '#2196F3',
    700: '#1976D2',
    900: '#0D47A1',
  },
  success: {
    50: '#E8F5E9',
    500: '#4CAF50',
    700: '#388E3C',
  },
  // ... all semantic colors
};

// typography.ts
export const typography = {
  display: {
    large: {
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '700',
    },
    // ... all text styles
  },
};

// spacing.ts
export const spacing = {
  2: 2,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
};
```

**Effort**: 2 days
**Dependencies**: None
**Success Criteria**: All tokens defined, exported, documented

---

##### 1.2: Component Variant System
**Files to Create**:
- `/mobile/src/components/primitives/Button.tsx` - Variant-based button
- `/mobile/src/components/primitives/Input.tsx` - Variant-based input
- `/mobile/src/components/primitives/StatusPill.tsx` - Variant-based status pill
- `/mobile/src/components/primitives/Card.tsx` - Card container

**Implementation Pattern**:
```typescript
// Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'text';
  size: 'small' | 'medium' | 'large';
  state?: 'default' | 'pressed' | 'disabled' | 'loading';
  onPress: () => void;
  children: React.ReactNode;
}

export function Button({ variant, size, state = 'default', onPress, children }: ButtonProps) {
  const styles = getButtonStyles(variant, size, state);
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} disabled={state === 'disabled' || state === 'loading'}>
      {state === 'loading' ? <ActivityIndicator /> : <Text style={styles.text}>{children}</Text>}
    </TouchableOpacity>
  );
}

function getButtonStyles(variant: string, size: string, state: string) {
  // Build styles from tokens
  const baseStyle = {
    container: {
      borderRadius: radius[8],
      paddingVertical: spacing[size === 'large' ? 20 : size === 'medium' ? 16 : 12],
      paddingHorizontal: spacing[size === 'large' ? 20 : size === 'medium' ? 16 : 12],
      backgroundColor: variant === 'primary' ? colors.primary[500] : colors.neutral[100],
      opacity: state === 'disabled' ? 0.5 : 1,
    },
    text: {
      ...typography.label[size === 'large' ? 'large' : 'medium'],
      color: variant === 'primary' ? colors.neutral.white : colors.primary[500],
    },
  };
  return baseStyle;
}
```

**Files to Refactor**:
- Refactor existing components to use new primitives:
  - `/mobile/src/components/services/ServiceCard.tsx` → use Card primitive
  - `/mobile/src/components/jobs/JobCard.tsx` → use Card primitive
  - All screens → replace inline StyleSheet with tokens

**Effort**: 5 days
**Dependencies**: 1.1 (Design Tokens)
**Success Criteria**: All primitives created, 80% of existing components refactored

---

### Sprint 2: Payment Primitives & Backend Endpoints

#### Objective
Build payment-specific components and add backend endpoints for payment management.

#### Tasks

##### 2.1: Payment Components (Frontend)
**Files to Create**:
- `/mobile/src/components/payment/PaymentMethodCard.tsx`
- `/mobile/src/components/payment/PaymentMethodIcon.tsx`
- `/mobile/src/components/payment/PaymentMethodSelector.tsx`
- `/mobile/src/components/payment/PaymentStatusIndicator.tsx`
- `/mobile/src/components/payment/PaymentAmountDisplay.tsx`
- `/mobile/src/components/payment/ReceiptCard.tsx`
- `/mobile/src/components/payment/AutopayToggle.tsx`

**Implementation Example**:
```typescript
// PaymentMethodCard.tsx
interface PaymentMethodCardProps {
  method: {
    id: number;
    type: 'APPLE_PAY' | 'GOOGLE_PAY' | 'CARD';
    brandLast4?: string;
    expMonth?: number;
    expYear?: number;
    isDefault: boolean;
  };
  onPress?: () => void;
  onRemove?: () => void;
  onSetDefault?: () => void;
}

export function PaymentMethodCard({ method, onPress, onRemove, onSetDefault }: PaymentMethodCardProps) {
  return (
    <Card>
      <View style={styles.header}>
        <PaymentMethodIcon type={method.type} size="medium" />
        <Text style={styles.label}>{getMethodLabel(method)}</Text>
        {method.isDefault && <StatusPill type="default" size="small">Default</StatusPill>}
      </View>
      {method.type === 'CARD' && (
        <Text style={styles.expiry}>Exp {method.expMonth}/{method.expYear}</Text>
      )}
      <View style={styles.actions}>
        {!method.isDefault && <Button variant="text" size="small" onPress={onSetDefault}>Set as Default</Button>}
        <Button variant="text" size="small" onPress={onRemove}>Remove</Button>
      </View>
    </Card>
  );
}
```

**Effort**: 4 days
**Dependencies**: 1.1 (Design Tokens), 1.2 (Component System)
**Success Criteria**: All payment components created, tested in Storybook (if available)

---

##### 2.2: Backend API Endpoints
**Files to Create**:
- `/server/routes/api/paymentMethods.ts` - Payment method management
- `/server/routes/api/paymentPreferences.ts` - Autopay/billing preferences
- `/server/routes/api/paymentSessions.ts` - In-app payment sessions
- `/server/routes/api/transactions.ts` - Payment transaction details

**Endpoints to Implement**:
```
GET    /api/payment-methods              - List customer payment methods
POST   /api/payment-methods              - Add payment method (returns Stripe setup intent)
DELETE /api/payment-methods/:id          - Remove payment method
PATCH  /api/payment-methods/:id/default  - Set default payment method

GET    /api/payment-preferences          - Get autopay/billing preferences
PUT    /api/payment-preferences          - Update autopay/billing preferences

GET    /api/payment-sessions/:sessionId  - Get payment session status (for text-to-pay)
POST   /api/payments                     - Initiate in-app payment

GET    /api/transactions/:id             - Get payment transaction details
GET    /api/transactions                 - List payment history

GET    /api/invoices/:id                 - Get invoice details
```

**Implementation Notes**:
- Reuse existing `/server/orchestrator/payment/` logic
- Add route handlers that call existing payment agent functions
- Ensure proper authentication (JWT bearer token)
- Add request validation (zod schemas)

**Files to Enhance**:
- `/server/routes/api/jobs.ts` - Add `paymentStatus` and `invoiceId` to job response

**Effort**: 5 days
**Dependencies**: None (payment agent already exists)
**Success Criteria**: All endpoints implemented, tested with Postman, documented

---

## Phase 2: Payment Setup & Management (Sprint 3-4)

### Sprint 3: Payment Method Setup

#### Objective
Enable customers to set up their first payment method (required for first service).

#### Tasks

##### 3.1: Payment Setup Screens
**Files to Create**:
- `/mobile/src/screens/payment/PaymentSetupScreen.tsx` - Payment method selector
- `/mobile/src/screens/payment/CardEntryScreen.tsx` - Card entry form
- `/mobile/src/screens/payment/ApplePayHandler.tsx` - Apple Pay integration
- `/mobile/src/screens/payment/GooglePayHandler.tsx` - Google Pay integration

**Implementation**:
```typescript
// PaymentSetupScreen.tsx
export function PaymentSetupScreen({ route, navigation }) {
  const { context } = route.params; // 'first_service' | 'autopay_enrollment' | 'payment_method_update'
  const [selectedMethod, setSelectedMethod] = useState<'APPLE_PAY' | 'GOOGLE_PAY' | 'CARD' | null>(null);

  const handleContinue = () => {
    if (selectedMethod === 'CARD') {
      navigation.navigate('CardEntry');
    } else if (selectedMethod === 'APPLE_PAY') {
      // Show Apple Pay sheet (native)
      showApplePaySheet();
    } else if (selectedMethod === 'GOOGLE_PAY') {
      // Show Google Pay sheet (native)
      showGooglePaySheet();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set Up Payment</Text>
      <Text style={styles.subtitle}>Add a payment method to schedule your service</Text>
      <PaymentMethodSelector selected={selectedMethod} onSelect={setSelectedMethod} />
      <Button variant="primary" size="large" onPress={handleContinue} disabled={!selectedMethod}>
        Continue
      </Button>
    </View>
  );
}
```

**Dependencies**:
- Install `expo-apple-pay` and `expo-google-pay` (or `@stripe/stripe-react-native` for all-in-one)
- Install `@stripe/stripe-react-native` for card entry

**Effort**: 6 days
**Dependencies**: 2.1 (Payment Components), 2.2 (Backend Endpoints)
**Success Criteria**: Customers can add payment methods via all 3 methods

---

##### 3.2: Service Request Enhancement (First Service Payment)
**Files to Modify**:
- `/mobile/src/screens/services/ServiceRequestDetailScreen.tsx` - Add payment method check

**Changes**:
```typescript
// ServiceRequestDetailScreen.tsx (enhanced)
export function ServiceRequestDetailScreen({ route, navigation }) {
  const { requestId } = route.params;
  const { data: request } = useQuery(['service-request', requestId], () => getServiceRequest(requestId));
  const { data: paymentMethods } = useQuery(['payment-methods'], () => fetchPaymentMethods());

  const hasPaymentMethod = paymentMethods && paymentMethods.length > 0;
  const isApproved = request?.status === 'approved';
  const canSchedule = isApproved && hasPaymentMethod;

  return (
    <View style={styles.container}>
      {/* Existing status card */}

      {isApproved && !hasPaymentMethod && (
        <Card style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Payment Method Required</Text>
          <Text style={styles.paymentSubtitle}>Add a payment method to schedule your service</Text>
          <Button variant="primary" onPress={() => navigation.navigate('PaymentSetup', { context: 'first_service' })}>
            Add Payment Method
          </Button>
        </Card>
      )}

      {canSchedule && (
        <Button variant="primary" size="large" onPress={handleSchedule}>
          Schedule Service
        </Button>
      )}
    </View>
  );
}
```

**Effort**: 2 days
**Dependencies**: 3.1 (Payment Setup Screens)
**Success Criteria**: First-time customers prompted to add payment method before scheduling

---

### Sprint 4: Payment Method Management

#### Objective
Enable customers to view, add, remove, and manage stored payment methods.

#### Tasks

##### 4.1: Payment Methods Screen
**Files to Create**:
- `/mobile/src/screens/settings/PaymentMethodsScreen.tsx` - List of payment methods
- `/mobile/src/services/api/paymentMethods.ts` - API client functions

**Implementation**:
```typescript
// PaymentMethodsScreen.tsx
export function PaymentMethodsScreen({ navigation }) {
  const queryClient = useQueryClient();
  const { data: methods, isLoading } = useQuery(['payment-methods'], fetchPaymentMethods);

  const removeMutation = useMutation({
    mutationFn: (methodId: number) => removePaymentMethod(methodId),
    onSuccess: () => {
      queryClient.invalidateQueries(['payment-methods']);
      Alert.alert('Success', 'Payment method removed');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (methodId: number) => setDefaultPaymentMethod(methodId),
    onSuccess: () => {
      queryClient.invalidateQueries(['payment-methods']);
      Alert.alert('Success', 'Default payment method updated');
    },
  });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Payment Methods</Text>
      {methods?.map((method) => (
        <PaymentMethodCard
          key={method.id}
          method={method}
          onRemove={() => removeMutation.mutate(method.id)}
          onSetDefault={() => setDefaultMutation.mutate(method.id)}
        />
      ))}
      <Button variant="secondary" onPress={() => navigation.navigate('PaymentSetup', { context: 'payment_method_update' })}>
        + Add Payment Method
      </Button>
    </ScrollView>
  );
}
```

**Effort**: 3 days
**Dependencies**: 2.1 (Payment Components), 2.2 (Backend Endpoints)
**Success Criteria**: Customers can view, add, remove, set default payment methods

---

##### 4.2: Autopay Settings
**Files to Create**:
- `/mobile/src/screens/settings/PaymentPreferencesScreen.tsx` - Autopay settings
- `/mobile/src/services/api/paymentPreferences.ts` - API client functions

**Implementation**:
```typescript
// PaymentPreferencesScreen.tsx
export function PaymentPreferencesScreen() {
  const { data: preferences, isLoading } = useQuery(['payment-preferences'], fetchPaymentPreferences);
  const [autopayEnabled, setAutopayEnabled] = useState(preferences?.autopayEnabled ?? false);

  const saveMutation = useMutation({
    mutationFn: () => updatePaymentPreferences({ autopayEnabled }),
    onSuccess: () => {
      Alert.alert('Success', 'Payment preferences updated');
    },
  });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Payment Preferences</Text>

      <Card>
        <AutopayToggle enabled={autopayEnabled} onToggle={setAutopayEnabled} />
        <Text style={styles.explainer}>
          We'll automatically charge your default payment method after each service is completed.
        </Text>
        <Text style={styles.limit}>Maximum autopay amount: $500</Text>
      </Card>

      <Button variant="primary" onPress={() => saveMutation.mutate()} loading={saveMutation.isLoading}>
        Save Changes
      </Button>
    </ScrollView>
  );
}
```

**Effort**: 2 days
**Dependencies**: 2.1 (Payment Components), 2.2 (Backend Endpoints)
**Success Criteria**: Customers can enable/disable autopay

---

## Phase 3: In-App Payment & Job Integration (Sprint 5-6)

### Sprint 5: In-App Payment Flow

#### Objective
Enable customers to pay for jobs in-app (Apple Pay/Google Pay/Card).

#### Tasks

##### 5.1: In-App Payment Screens
**Files to Create**:
- `/mobile/src/screens/payment/InAppPaymentScreen.tsx` - Payment flow
- `/mobile/src/screens/payment/PaymentProcessingScreen.tsx` - Processing state
- `/mobile/src/screens/payment/PaymentSuccessScreen.tsx` - Success state
- `/mobile/src/screens/payment/PaymentFailedScreen.tsx` - Failure state

**Implementation**:
```typescript
// InAppPaymentScreen.tsx
export function InAppPaymentScreen({ route, navigation }) {
  const { jobId, amount } = route.params;
  const { data: methods } = useQuery(['payment-methods'], fetchPaymentMethods);
  const [selectedMethod, setSelectedMethod] = useState(methods?.[0]?.id);

  const paymentMutation = useMutation({
    mutationFn: () => createPayment({ jobId, paymentMethodId: selectedMethod, amount }),
    onSuccess: (transaction) => {
      navigation.replace('PaymentSuccess', { transactionId: transaction.id });
    },
    onError: (error) => {
      navigation.replace('PaymentFailed', { error: error.message, jobId, amount });
    },
  });

  return (
    <View style={styles.container}>
      <PaymentAmountDisplay amount={amount} label="Amount due" />

      <Text style={styles.sectionTitle}>Payment Method</Text>
      {methods?.map((method) => (
        <TouchableOpacity key={method.id} onPress={() => setSelectedMethod(method.id)}>
          <PaymentMethodCard method={method} selected={selectedMethod === method.id} />
        </TouchableOpacity>
      ))}

      <Button
        variant="primary"
        size="large"
        onPress={() => paymentMutation.mutate()}
        loading={paymentMutation.isLoading}
      >
        Pay ${amount.toFixed(2)}
      </Button>
    </View>
  );
}
```

**Effort**: 5 days
**Dependencies**: 2.1 (Payment Components), 2.2 (Backend Endpoints), 4.1 (Payment Methods)
**Success Criteria**: Customers can pay for jobs using stored payment methods

---

##### 5.2: Receipt & Invoice Screens
**Files to Create**:
- `/mobile/src/screens/payment/ReceiptScreen.tsx` - Payment receipt
- `/mobile/src/screens/payment/InvoiceScreen.tsx` - Invoice view
- `/mobile/src/screens/payment/PaymentHistoryScreen.tsx` - Payment history

**Implementation**:
```typescript
// ReceiptScreen.tsx
export function ReceiptScreen({ route }) {
  const { transactionId } = route.params;
  const { data: transaction } = useQuery(['transaction', transactionId], () => fetchTransaction(transactionId));

  const handleShare = async () => {
    // Generate PDF receipt and share
    const pdfUrl = await generateReceiptPDF(transaction);
    Share.share({ url: pdfUrl });
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Receipt</Text>
      <ReceiptCard transaction={transaction} />
      <Button variant="secondary" onPress={handleShare}>Share Receipt</Button>
      <Button variant="text" onPress={() => navigation.goBack()}>Done</Button>
    </ScrollView>
  );
}
```

**Effort**: 3 days
**Dependencies**: 2.1 (Payment Components), 2.2 (Backend Endpoints)
**Success Criteria**: Customers can view receipts and invoices

---

### Sprint 6: Job Payment Integration

#### Objective
Integrate payment status into job screens and enable payment actions.

#### Tasks

##### 6.1: Job Detail Enhancement
**Files to Modify**:
- `/mobile/src/screens/jobs/JobDetailScreen.tsx` - Add payment status + actions

**Changes**:
```typescript
// JobDetailScreen.tsx (enhanced)
export function JobDetailScreen({ route, navigation }) {
  const { jobId } = route.params;
  const { data: job } = useQuery(['job', jobId], () => fetchJob(jobId));

  const isPaid = job?.paymentStatus === 'captured';
  const isPending = job?.paymentStatus === 'pending';
  const isFailed = job?.paymentStatus === 'failed';
  const isUnpaid = job?.status === 'completed' && !job?.paymentStatus;

  return (
    <ScrollView style={styles.container}>
      {/* Existing job details */}

      {/* NEW: Payment Status Row */}
      {(isPaid || isPending || isFailed || isUnpaid) && (
        <Card style={styles.paymentCard}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <PaymentStatusIndicator status={job.paymentStatus || 'unpaid'} />

          {isPaid && (
            <Button variant="text" onPress={() => navigation.navigate('Receipt', { transactionId: job.transactionId })}>
              View Receipt
            </Button>
          )}

          {(isUnpaid || isFailed) && (
            <Button variant="primary" onPress={() => navigation.navigate('InAppPayment', { jobId, amount: job.amount })}>
              {isFailed ? 'Retry Payment' : 'Pay Now'}
            </Button>
          )}
        </Card>
      )}

      {/* Existing review/actions */}
    </ScrollView>
  );
}
```

**Effort**: 2 days
**Dependencies**: 5.1 (In-App Payment Screens)
**Success Criteria**: Job detail shows payment status and actions

---

##### 6.2: Jobs List Enhancement
**Files to Modify**:
- `/mobile/src/screens/jobs/JobsScreen.tsx` - Add Unpaid tab

**Changes**:
```typescript
// JobsScreen.tsx (enhanced)
export function JobsScreen() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'unpaid'>('upcoming');

  const { data: jobs } = useQuery(['jobs', activeTab], () => fetchJobs({ filter: activeTab }));

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TabButton label="Upcoming" active={activeTab === 'upcoming'} onPress={() => setActiveTab('upcoming')} />
        <TabButton label="Completed" active={activeTab === 'completed'} onPress={() => setActiveTab('completed')} />
        <TabButton label="Unpaid" active={activeTab === 'unpaid'} onPress={() => setActiveTab('unpaid')} badge={unpaidCount} />
      </View>

      <FlatList
        data={jobs}
        renderItem={({ item }) => <JobCard job={item} showPaymentStatus />}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
}
```

**Effort**: 2 days
**Dependencies**: 5.1 (In-App Payment Screens)
**Success Criteria**: Customers can filter jobs by payment status

---

##### 6.3: Home Dashboard Enhancement
**Files to Modify**:
- `/mobile/src/screens/home/HomeScreen.tsx` - Add UnpaidJobsBanner

**Changes**:
```typescript
// HomeScreen.tsx (enhanced)
export function HomeScreen({ navigation }) {
  const { data: unpaidCount } = useQuery(['jobs', 'unpaid-count'], () => fetchUnpaidJobsCount());

  return (
    <ScrollView style={styles.container}>
      <NotificationBanner />
      <Text style={styles.title}>Welcome to LawnFlow</Text>

      {/* NEW: Unpaid Jobs Banner */}
      {unpaidCount > 0 && (
        <UnpaidJobsBanner
          count={unpaidCount}
          onPress={() => navigation.navigate('Jobs', { initialTab: 'unpaid' })}
        />
      )}

      <ReminderBanner />
      <Button variant="primary" size="large" onPress={() => navigation.navigate('Services')}>
        Request New Service
      </Button>
    </ScrollView>
  );
}
```

**Effort**: 1 day
**Dependencies**: 6.1 (Job Detail Enhancement)
**Success Criteria**: Home shows unpaid jobs alert

---

## Phase 4: Advanced Features & Polish (Sprint 7)

### Sprint 7: Text-to-Pay, Notifications, Edge Cases

#### Objective
Handle text-to-pay deep links, payment notifications, and edge cases.

#### Tasks

##### 7.1: Text-to-Pay Deep Link Handler
**Files to Create**:
- `/mobile/src/navigation/deepLinkHandlers.ts` - Deep link routing logic

**Implementation**:
```typescript
// deepLinkHandlers.ts
export function handlePayDeepLink(sessionId: string, navigation: any) {
  // Validate payment session
  fetchPaymentSession(sessionId).then((session) => {
    if (session.status === 'expired') {
      Alert.alert('Session Expired', 'This payment link has expired. Please request a new one.');
      return;
    }

    navigation.navigate('InAppPayment', {
      sessionId: session.id,
      jobId: session.jobId,
      amount: session.amount,
    });
  }).catch((error) => {
    Alert.alert('Error', 'Invalid payment link.');
  });
}
```

**Files to Modify**:
- `/mobile/src/navigation/linking.config.ts` - Add `lawnflow://pay/{sessionId}` route

**Effort**: 2 days
**Dependencies**: 5.1 (In-App Payment Screens)
**Success Criteria**: SMS payment links open in-app payment screen

---

##### 7.2: Payment Notifications
**Files to Modify**:
- `/mobile/src/services/notifications/pushHandler.ts` - Add payment notification handlers

**Changes**:
```typescript
// pushHandler.ts (enhanced)
export function setupNotificationHandlers(navigation: any) {
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;

    if (data.type === 'payment_success' && data.transactionId) {
      navigation.navigate('Receipt', { transactionId: data.transactionId });
    } else if (data.type === 'payment_failed' && data.jobId) {
      navigation.navigate('JobDetail', { jobId: data.jobId });
    } else if (data.type === 'invoice_ready' && data.invoiceId) {
      navigation.navigate('Invoice', { invoiceId: data.invoiceId });
    }
    // ... existing handlers
  });
}
```

**Effort**: 1 day
**Dependencies**: 5.1 (In-App Payment Screens), 5.2 (Receipt Screen)
**Success Criteria**: Payment notifications open correct screens

---

##### 7.3: Edge Cases & Error Handling
**Tasks**:
1. Handle expired payment methods (show update prompt)
2. Handle payment failures (show retry prompt)
3. Handle network errors (show offline banner)
4. Handle payment method removal (update default)
5. Handle autopay disabled mid-flow (show manual pay option)

**Files to Modify**:
- All payment screens - Add error states
- `/mobile/src/components/common/OfflineBanner.tsx` - Create offline banner

**Effort**: 2 days
**Dependencies**: All previous tasks
**Success Criteria**: All edge cases handled gracefully

---

## Backend Integration Points

### Required Backend Enhancements

#### 1. Job API Enhancement
**File**: `/server/routes/api/jobs.ts`

**Changes**:
```typescript
// Add payment fields to job response
interface JobResponse {
  // ... existing fields
  paymentStatus?: 'pending' | 'authorized' | 'captured' | 'failed' | null;
  paymentTransactionId?: number;
  invoiceId?: number;
  amount?: number;
}
```

**Effort**: 1 day

---

#### 2. Payment Webhook Handler Enhancement
**File**: `/server/orchestrator/payment/webhooks/stripeWebhookHandler.ts`

**Changes**:
- Add push notification triggers after payment success/failure
- Send notifications via Firebase FCM

**Effort**: 2 days

---

## Component-Level Change Summary

### Create (New Components)
| Component | File | Priority | Effort |
|-----------|------|----------|--------|
| Button (variants) | `/mobile/src/components/primitives/Button.tsx` | P0 | 1d |
| Input (variants) | `/mobile/src/components/primitives/Input.tsx` | P0 | 1d |
| Card | `/mobile/src/components/primitives/Card.tsx` | P0 | 0.5d |
| StatusPill (variants) | `/mobile/src/components/primitives/StatusPill.tsx` | P0 | 0.5d |
| PaymentMethodCard | `/mobile/src/components/payment/PaymentMethodCard.tsx` | P0 | 1d |
| PaymentMethodIcon | `/mobile/src/components/payment/PaymentMethodIcon.tsx` | P0 | 0.5d |
| PaymentMethodSelector | `/mobile/src/components/payment/PaymentMethodSelector.tsx` | P0 | 1d |
| PaymentStatusIndicator | `/mobile/src/components/payment/PaymentStatusIndicator.tsx` | P0 | 0.5d |
| PaymentAmountDisplay | `/mobile/src/components/payment/PaymentAmountDisplay.tsx` | P0 | 0.5d |
| ReceiptCard | `/mobile/src/components/payment/ReceiptCard.tsx` | P1 | 1d |
| AutopayToggle | `/mobile/src/components/payment/AutopayToggle.tsx` | P0 | 0.5d |
| UnpaidJobsBanner | `/mobile/src/components/jobs/UnpaidJobsBanner.tsx` | P1 | 0.5d |

**Total New Components**: 12
**Total Effort**: 9 days

---

### Modify (Existing Components)
| Component | File | Changes | Effort |
|-----------|------|---------|--------|
| ServiceCard | `/mobile/src/components/services/ServiceCard.tsx` | Use Card primitive | 0.5d |
| JobCard | `/mobile/src/components/jobs/JobCard.tsx` | Add payment status pill, use Card primitive | 1d |
| ReminderBanner | `/mobile/src/components/jobs/ReminderBanner.tsx` | Use design tokens | 0.5d |
| NotificationBanner | `/mobile/src/components/notifications/NotificationBanner.tsx` | Use design tokens | 0.5d |

**Total Modified Components**: 4
**Total Effort**: 2.5 days

---

## Screen-Level Change Summary

### Create (New Screens)
| Screen | File | Priority | Effort |
|--------|------|----------|--------|
| PaymentSetupScreen | `/mobile/src/screens/payment/PaymentSetupScreen.tsx` | P0 | 2d |
| CardEntryScreen | `/mobile/src/screens/payment/CardEntryScreen.tsx` | P0 | 2d |
| PaymentMethodsScreen | `/mobile/src/screens/settings/PaymentMethodsScreen.tsx` | P0 | 2d |
| PaymentPreferencesScreen | `/mobile/src/screens/settings/PaymentPreferencesScreen.tsx` | P0 | 1d |
| InAppPaymentScreen | `/mobile/src/screens/payment/InAppPaymentScreen.tsx` | P0 | 2d |
| PaymentProcessingScreen | `/mobile/src/screens/payment/PaymentProcessingScreen.tsx` | P0 | 1d |
| PaymentSuccessScreen | `/mobile/src/screens/payment/PaymentSuccessScreen.tsx` | P0 | 1d |
| PaymentFailedScreen | `/mobile/src/screens/payment/PaymentFailedScreen.tsx` | P0 | 1d |
| ReceiptScreen | `/mobile/src/screens/payment/ReceiptScreen.tsx` | P1 | 1d |
| InvoiceScreen | `/mobile/src/screens/payment/InvoiceScreen.tsx` | P1 | 1d |
| PaymentHistoryScreen | `/mobile/src/screens/payment/PaymentHistoryScreen.tsx` | P2 | 1d |

**Total New Screens**: 11
**Total Effort**: 15 days

---

### Modify (Existing Screens)
| Screen | File | Changes | Effort |
|--------|------|---------|--------|
| HomeScreen | `/mobile/src/screens/home/HomeScreen.tsx` | Add UnpaidJobsBanner | 0.5d |
| ServiceRequestDetailScreen | `/mobile/src/screens/services/ServiceRequestDetailScreen.tsx` | Add payment method check | 1d |
| JobsScreen | `/mobile/src/screens/jobs/JobsScreen.tsx` | Add Unpaid tab | 1d |
| JobDetailScreen | `/mobile/src/screens/jobs/JobDetailScreen.tsx` | Add payment status + actions | 1d |
| SettingsScreen | `/mobile/src/screens/settings/SettingsScreen.tsx` | Add Payment section | 0.5d |

**Total Modified Screens**: 5
**Total Effort**: 4 days

---

## Testing Strategy

### Unit Tests
- All payment components (12 components)
- All payment API client functions
- Deep link handlers
- Payment flow logic

**Tool**: Jest + React Testing Library
**Effort**: 5 days

---

### Integration Tests
- Payment method setup flow (E2E)
- In-app payment flow (E2E)
- Payment failure retry flow (E2E)
- Text-to-pay flow (E2E)

**Tool**: Detox (React Native E2E testing)
**Effort**: 5 days

---

### Manual QA Checklist
- [ ] First service payment method setup
- [ ] Add/remove payment methods
- [ ] Set default payment method
- [ ] Enable/disable autopay
- [ ] In-app payment (Apple Pay)
- [ ] In-app payment (Google Pay)
- [ ] In-app payment (Card)
- [ ] Payment success flow
- [ ] Payment failure flow
- [ ] Payment retry flow
- [ ] Receipt view
- [ ] Invoice view (fallback)
- [ ] Payment history
- [ ] Unpaid jobs banner
- [ ] Unpaid jobs filter
- [ ] Job detail payment status
- [ ] Text-to-pay deep link
- [ ] Payment notifications
- [ ] Offline mode (queue actions)
- [ ] Expired payment method handling
- [ ] Network error handling

**Effort**: 3 days

---

## Definition of Done

### Phase 1 (Foundation)
✅ Design tokens implemented and exported
✅ Component variant system implemented
✅ 80% of existing components refactored to use tokens
✅ Backend payment endpoints implemented and tested
✅ All payment components created and tested

### Phase 2 (Payment Setup)
✅ Payment setup flow implemented (ApplePay/GooglePay/Card)
✅ Payment methods screen implemented
✅ Autopay settings implemented
✅ First service payment check implemented
✅ Customers can add/remove/manage payment methods

### Phase 3 (In-App Payment)
✅ In-app payment flow implemented
✅ Receipt and invoice screens implemented
✅ Job detail shows payment status and actions
✅ Jobs list has Unpaid filter
✅ Home dashboard shows unpaid jobs banner
✅ Customers can pay for jobs in-app

### Phase 4 (Advanced Features)
✅ Text-to-pay deep link handler implemented
✅ Payment notifications implemented
✅ All edge cases handled (expired methods, failures, etc.)
✅ All unit tests passing
✅ All integration tests passing
✅ Manual QA checklist 100% completed

---

## Risk Mitigation

### Risk: Stripe Integration Complexity
**Mitigation**: Use `@stripe/stripe-react-native` library (official SDK), follow Stripe's React Native integration guide

### Risk: Apple Pay/Google Pay Native Integration
**Mitigation**: Use Expo modules for native integrations, test on physical devices early

### Risk: Payment Agent Backend Not Ready
**Mitigation**: Backend payment agent already implemented and tested, only need new API endpoints

### Risk: Payment Failures in Production
**Mitigation**: Implement comprehensive retry logic, fallback to invoice, monitor payment success rate

### Risk: Timeline Slippage
**Mitigation**: Phase-based approach, can ship Phase 1-2 for MVP, Phase 3-4 as enhancements

---

## Sprint Breakdown & Effort

| Sprint | Phase | Tasks | Effort (Days) | Team |
|--------|-------|-------|---------------|------|
| Sprint 1 | Foundation | Design tokens, component system | 7 days | 2 mobile engineers |
| Sprint 2 | Foundation | Payment components, backend endpoints | 9 days | 2 mobile + 1 backend |
| Sprint 3 | Payment Setup | Payment setup screens, service request enhancement | 8 days | 2 mobile engineers |
| Sprint 4 | Payment Management | Payment methods, autopay settings | 5 days | 2 mobile engineers |
| Sprint 5 | In-App Payment | In-app payment flow, receipt/invoice screens | 8 days | 2 mobile engineers |
| Sprint 6 | Job Integration | Job detail, jobs list, home dashboard enhancements | 5 days | 2 mobile engineers |
| Sprint 7 | Advanced Features | Text-to-pay, notifications, edge cases, testing | 5 days | 2 mobile engineers |

**Total**: 7 sprints (14 weeks) including testing
**MVP** (Phase 1-2): 4 sprints (8 weeks)
**Full Feature Set**: 7 sprints (14 weeks)

---

## Dependencies & Prerequisites

### Mobile App
- Expo SDK 51 (already installed)
- `@stripe/stripe-react-native` (install)
- `expo-apple-pay` (install if not using Stripe SDK)
- `expo-google-pay` (install if not using Stripe SDK)

### Backend
- Payment Agent already implemented ✅
- Stripe account configured ✅
- Firebase FCM configured ✅

### Design
- Figma design export complete ✅
- Design tokens defined ✅

---

## Success Metrics

### Payment Adoption
- **Payment method setup rate**: Target 90% (first-time customers complete setup)
- **Autopay adoption**: Target 60% (customers enable autopay)
- **In-app payment rate**: Target 70% (payments completed in-app vs. text-to-pay/invoice)
- **Payment success rate**: Target 95% (payment attempts succeed on first try)

### Customer Satisfaction
- **Payment UX NPS**: Target +40 (Net Promoter Score for payment experience)
- **Support ticket reduction**: Target 50% decrease in payment-related support tickets
- **Payment failure recovery**: Target 80% (failed payments retried successfully)

### Business Impact
- **Days to payment**: Target <24 hours (average time from job completion to payment captured)
- **Payment method reuse**: Target 90% (repeat customers use stored payment methods)
- **Invoice fallback rate**: Target <5% (payments that fall back to invoice)

---

## Conclusion

This implementation plan addresses **all 20+ identified gaps** in the customer payment UX by building on the existing Payment Agent backend. The phased approach allows for MVP delivery in 8 weeks (payment setup + management), with full feature parity in 14 weeks.

**Key Success Factors**:
1. Backend payment agent already implemented ✅
2. Design system and components reusable from staff app ✅
3. Existing mobile app foundation (Sprint 0 complete) ✅
4. Clear requirements from gap analysis ✅
5. Stripe integration well-documented ✅

**Next Steps**:
1. Kickoff Sprint 1 (design tokens + component system)
2. Backend engineer starts on payment API endpoints
3. Mobile engineers prototype payment setup flow
4. QA engineer prepares test plan

---

**End of Implementation Plan**
