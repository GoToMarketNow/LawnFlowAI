# Payment Agent - LawnFlow.ai

Event-driven payment orchestration for lawn care operators.

## Architecture

```
JobCompleted → QA Agent → Payment Agent → Commands → Events
                              ↓
                    [Decision + Confidence]
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
              Autopay Capture     Text-to-Pay
                    ↓                   ↓
              Payment Success    Invoice Fallback
                    ↓
              Review Agent
```

## Core Components

### 1. Payment Agent (`paymentAgent.ts`)
- **Role**: Decision engine
- **Input**: Job/invoice context, customer, amount
- **Output**: Decision + proposed commands
- **Never**: Mutates DB or calls external APIs directly

### 2. Command Handlers (`commandHandlers.ts`)
- **Role**: State enforcement, policy validation, idempotency
- **Input**: Commands from agent
- **Output**: Events (success) or errors
- **Guarantees**: Exactly-once execution via idempotency keys

### 3. Payment Saga (`paymentSaga.ts`)
- **Role**: Orchestrates multi-step payment flows
- **Features**: Retries, compensation, human escalation
- **Integration**: JobCompleted → Payment → Review

### 4. Retry Policy (`retryPolicy.ts`)
- **Role**: Exponential backoff, failure handling
- **Config**: Max retries, delay, retryable error codes
- **Fallback**: Invoice creation or human escalation

## Payment Flows

### A. First Service Payment
```
1. Job completed
2. Agent checks: first_service_requires_setup?
3. If no payment method → RequestPaymentSetup
4. Customer adds method via SMS link
5. CapturePayment immediately
```

### B. Autopay (Regular Service)
```
1. Job completed
2. Agent checks: autopay_enabled + preferred_method?
3. Amount <= max_autopay_amount?
4. CapturePayment (or request confirmation if high value)
```

### C. On-Demand Payment
```
1. Customer clicks "Pay Now" (SMS or in-app)
2. CreatePaymentSession
3. Customer completes payment
4. Webhook → PaymentCaptured event
```

### D. Invoice Fallback
```
1. Payment failed or autopay disabled
2. Policy allows invoice?
3. CreateInvoice
4. Customer pays invoice later
```

## Confidence Scoring

Agent returns confidence score (0.0 - 1.0) based on:

- **Data Completeness** (20%): Profile + method availability
- **Policy Compliance** (25%): Fits within operator policy
- **Consent Certainty** (20%): Customer consent records
- **Method Availability** (20%): Payment method ready
- **Payment Risk** (15%): Amount, history, fraud signals

**Autonomy Rules**:
- `>= 0.85`: Full autonomy
- `0.70 - 0.84`: Customer confirmation required
- `< 0.70`: Escalate to human

## Risk Flags

- `PAYMENT_RISK`: High-value transaction or fraud signals
- `CONSENT_MISSING`: No customer consent on file
- `POLICY_VIOLATION`: Violates operator payment policy
- `AMOUNT_THRESHOLD_EXCEEDED`: Exceeds autopay limit
- `METHOD_UNAVAILABLE`: No payment method available
- `FIRST_SERVICE_NO_SETUP`: First service without setup

## Events

All events follow LawnFlow event schema:

```typescript
PaymentCaptured {
  eventType: "PaymentCaptured",
  timestamp: ISO8601,
  traceId: string,
  customerId: number,
  transactionId: number,
  amount: number,
  methodType: "APPLE_PAY" | "GOOGLE_PAY" | "CARD",
  captureType: "autopay" | "on_demand" | "first_service",
  jobId?: number,
}
```

## Commands

All commands include:
- `idempotencyKey`: SHA-256 hash for deduplication
- `traceId`: End-to-end tracing
- `entityId`: job_123 or invoice_456
- `policySnapshotHash`: Policy version at decision time

## Idempotency

- **Command-level**: Handlers check idempotency key before execution
- **Webhook-level**: Stripe event IDs tracked to prevent duplicate processing
- **Saga-level**: Compensating transactions for rollback

## Retry Logic

**Default Policy**:
- Max retries: 3
- Base delay: 5s
- Max delay: 5min
- Backoff: Exponential (2x)

**Retryable Errors**:
- `card_declined`
- `insufficient_funds`
- `payment_method_unavailable`
- `network_error`

**Non-Retryable**:
- `invalid_card`
- `card_expired`
- `fraud_detected`

## Integration Points

### SMS Adapter (`adapters/smsAdapter.ts`)
- Send text-to-pay links
- Send payment setup links
- Send confirmations and failure notifications

### Payment Provider (`adapters/paymentProviderAdapter.ts`)
- Stripe (primary)
- Square (future)
- Apple Pay, Google Pay tokenization

### Webhooks (`webhooks/stripeWebhookHandler.ts`)
- Normalizes Stripe events → LawnFlow events
- Idempotent processing
- Signature verification

## Database Schema

See [`shared/schema-payment.ts`](../../../shared/schema-payment.ts)

**Key Tables**:
- `customer_payment_profiles`: Autopay preferences
- `payment_methods`: Tokenized payment methods
- `operator_payment_policies`: Business-level rules
- `payment_transactions`: Audit trail
- `payment_agent_decisions`: Agent reasoning log
- `payment_human_tasks`: Manual escalations

## Testing

Run tests:
```bash
npm test -- payment
```

**Test Coverage**:
- ✓ First service flow
- ✓ Autopay decision logic
- ✓ Confidence scoring
- ✓ Risk flag detection
- ✓ Policy enforcement
- ✓ Idempotency
- ✓ Retry logic

## Extensibility

### Future Enhancements
- **Subscriptions**: Recurring billing for route customers
- **Deposits**: Upfront payment for large projects
- **Partial Payments**: Pay-over-time for equipment purchases
- **Refunds**: Automated refund workflows
- **Disputes**: Chargeback handling

### Adding New Payment Methods
1. Add method type to `PaymentMethodTypeSchema`
2. Update provider adapter for tokenization
3. Add method to operator policy allowed list
4. Test end-to-end flow

### Adding New Providers
1. Implement provider adapter interface
2. Add webhook handler
3. Configure provider credentials
4. Map provider events → LawnFlow events

## Monitoring & Observability

**Key Metrics**:
- Payment success rate
- Average confidence score
- Escalation rate
- Retry count distribution
- Time-to-payment (job completion → payment captured)

**Tracing**:
All operations include `traceId` for distributed tracing.

**Logging**:
- Agent decisions logged to `payment_agent_decisions`
- All commands logged with execution status
- Webhooks logged for audit trail

## Production Checklist

- [ ] Stripe API keys configured
- [ ] Webhook endpoint registered with Stripe
- [ ] Webhook signature verification enabled
- [ ] SMS provider configured (Twilio)
- [ ] Retry queue initialized (BullMQ/Redis)
- [ ] Operator payment policies seeded
- [ ] Test customer payment flows end-to-end
- [ ] Monitor payment success rate
- [ ] Set up alerts for high escalation rate

## Support

For questions or issues:
1. Check agent decision logs: `payment_agent_decisions` table
2. Review transaction history: `payment_transactions` table
3. Check human tasks: `payment_human_tasks` table
4. Trace via `traceId` across all tables
