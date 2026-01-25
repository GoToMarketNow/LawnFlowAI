# LawnFlow AI Agent Directory

This document provides a comprehensive overview of all AI agents in the LawnFlow platform.

## Agent Architecture

All agents follow a consistent contract-based pattern:
- **Input**: Structured JSON matching a Zod schema
- **Output**: Structured JSON matching a Zod schema
- **Behavior**: Deterministic with human-in-the-loop escalation
- **Audit**: All decisions logged to audit trail

## Billing & Collections Agents

### InvoiceBuildAgent
**Purpose**: Generates invoice drafts from completed jobs with configurable pricing rules.

**Trigger**: Job completion event

**Input**: `{ accountId, jobId, job?, quote?, customer?, lineItemOverrides? }`

**Output**: `{ invoice, lineItems[], summary, requiresApproval, approvalReasons[] }`

**Escalation**: Requires approval if variance exceeds 15% from quote

---

### ReconciliationWorker (Billing)
**Purpose**: Validates invoice/payment integrity, detects mismatches.

**Trigger**: Scheduled (daily) or on payment webhook

**Input**: `{ accountId, invoiceIds?, checkOverpayments? }`

**Output**: `{ processed, issues[], summary }`

**Escalation**: Creates BillingIssue for HIGH severity problems

---

### BillingAgent (Collections)
**Purpose**: AI-driven reminder generation with tone control.

**Trigger**: Overdue invoice detection

**Input**: `{ accountId, invoiceId, invoice?, customer?, reminderCount? }`

**Output**: `{ message, suggestedChannel, tone, escalationNeeded, nextReminderDate? }`

**Escalation**: Escalates to RemediationAgent if dispute detected

---

### RemediationAgent
**Purpose**: Dispute resolution with root cause analysis.

**Trigger**: Customer dispute, payment failure, negative sentiment

**Input**: `{ accountId, billingIssueId, invoice?, job?, customerMessages?, crewNotes? }`

**Output**: `{ rootCause, resolutionOptions[], recommended, requiresHumanApproval, confidence, nextAction }`

**Root Causes**: SCOPE_MISMATCH, QUALITY_ISSUE, PRICING_SURPRISE, PAYMENT_ERROR, COMMUNICATION_BREAKDOWN, UNKNOWN

**Resolution Types**: CREDIT, REDO_VISIT, CALL_CUSTOMER, ADJUST_INVOICE, WAIVE_FEES

**Escalation**: Credits above $50 require human approval

---

## QuickBooks Sync Agents

### InvoiceSyncAgent
**Purpose**: Syncs local invoices to QuickBooks.

**Trigger**: Invoice sent, manual sync

**Input**: `{ accountId, invoiceId }`

**Output**: `{ success, externalInvoiceId?, error? }`

**Notes**: Skips already-synced invoices, creates BillingIssue on failure

---

### PaymentSyncAgent
**Purpose**: Syncs payments from QuickBooks to local storage.

**Trigger**: Scheduled (hourly) or manual

**Input**: `{ accountId }`

**Output**: `{ synced, updated, errors[] }`

**Performance**: O(1) Map lookups for invoice matching

---

## Accretive Agents (Phase B)

### PricingOptimizationAgent (B1)
**Purpose**: Analyzes quote acceptance rates and recommends pricing adjustments.

**Trigger**: Weekly scheduled, on-demand analysis

**Input**: `{ accountId, period?, serviceTypes? }`

**Output**: `{ analysisDate, overallHealth, metrics, recommendations[], requiresOwnerApproval, rolloutPlan? }`

**Approval**: All pricing changes require owner approval

---

### CapacityForecastingAgent (B2)
**Purpose**: Forecasts crew capacity and provides scheduling recommendations.

**Trigger**: Daily (early morning), on schedule changes

**Input**: `{ accountId, forecastDays?, zones? }`

**Output**: `{ forecastDate, overallCapacity, dailyForecast[], zoneRecommendations[], summary }`

**Recommendations**: ACCEPT_MORE, AT_CAPACITY, OVERBOOKED, PAUSE_INTAKE per day/zone

---

### CrewPerformanceAgent (B3)
**Purpose**: Analyzes crew metrics and generates coaching insights.

**Trigger**: After job completion, weekly summary

**Input**: `{ accountId, crewId?, period? }`

**Output**: `{ analysisDate, crews[], topPerformers[], improvementAreas[], coachingInsights[], overallScore }`

**Metrics**: On-time rate, completion rate, rework rate, customer satisfaction

---

### RetentionAgent (B4)
**Purpose**: Customer churn risk scoring and retention outreach.

**Trigger**: Post-service follow-up, monthly scan

**Input**: `{ accountId, customerId?, includeInactive? }`

**Output**: `{ analysisDate, atRiskCustomers[], campaigns[], overallChurnRisk, recommendations[] }`

**Risk Levels**: LOW, MEDIUM, HIGH, CRITICAL

---

### ComplianceRiskAgent (B5)
**Purpose**: License/insurance expiration monitoring.

**Trigger**: Monthly scheduled

**Input**: `{ accountId }`

**Output**: `{ checkDate, overallStatus, alerts[], upcomingDeadlines[], recommendations[] }`

**Status**: COMPLIANT, ATTENTION_NEEDED, NON_COMPLIANT

**Note**: Stub implementation for MVP - reminder only

---

## Core Orchestration Agents

### IntakeAgent
**Purpose**: Qualifies inbound leads from missed calls, SMS, web forms.

**Trigger**: Inbound event (missed_call, inbound_sms, web_lead)

**Output**: Qualified lead with service type, urgency, contact info

---

### QuoteAgent
**Purpose**: Generates price estimates based on lot size, service type, and policy.

**Trigger**: Lead qualified, quote requested

**Output**: Quote with price range, valid dates, T&C

---

### ScheduleAgent
**Purpose**: Proposes appointment times based on crew availability.

**Trigger**: Quote accepted, scheduling requested

**Output**: Available time slots, recommended slot

---

## Agent Orchestration Flow

```
Lead-to-Cash Pipeline:
Lead → IntakeAgent → QuoteAgent → ScheduleAgent → Book Job
                                                    ↓
Complete Job → InvoiceBuildAgent → [Approval?] → AccountingSyncAgent
                                                    ↓
                                    CollectionsAgent ← Overdue?
                                                    ↓
                                    RemediationAgent ← Dispute?
```

## API Endpoints

| Agent | Endpoint | Method |
|-------|----------|--------|
| InvoiceBuildAgent | `/api/billing/invoices/generate` | POST |
| ReconciliationWorker | `/api/billing/reconcile` | POST |
| BillingAgent | `/api/billing/actions/reminder` | POST |
| RemediationAgent | `/api/billing/remediate` | POST |
| InvoiceSyncAgent | `/api/billing/sync/invoice/:id` | POST |
| PaymentSyncAgent | `/api/billing/sync/payments` | POST |
| PricingOptimizationAgent | `/api/agents/pricing-optimization` | POST |
| CapacityForecastingAgent | `/api/agents/capacity-forecast` | POST |
| CrewPerformanceAgent | `/api/agents/crew-performance` | POST |
| RetentionAgent | `/api/agents/retention` | POST |
| ComplianceRiskAgent | `/api/agents/compliance-risk` | POST |

## Safety Rules

1. **No hallucinated amounts**: Agents never invent money amounts beyond policy bounds
2. **Escalation on uncertainty**: When confidence is low, escalate to human
3. **Audit trail**: All decisions logged with reasoning
4. **Policy bounds**: All actions constrained by business policy settings
5. **Human-in-the-loop**: High-value decisions require approval
