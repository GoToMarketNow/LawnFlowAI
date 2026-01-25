import { BillingAction, InvoiceData, CustomerHistory, BillingConfig, PolicyThresholds } from "../src/agents/billing";

// Define a structure for your test cases
export interface BillingTestCase {
  name: string;
  input: {
    invoice: InvoiceData;
    history: CustomerHistory;
    config: BillingConfig;
    policy: PolicyThresholds;
  };
  expected: BillingAction;
}

// Golden Dataset
export const goldenBillingTestCases: BillingTestCase[] = [
  {
    name: "Standard Reminder - Friendly Tone - On Time",
    input: {
      invoice: {
        id: 1,
        customer_name: "Alice Smith",
        customer_phone: "+15551234567",
        customer_email: "alice@example.com",
        amount: 7500, // $75.00
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Due in 2 days
        status: "pending",
        days_overdue: 0,
      },
      history: {
        previous_delinquencies: 0,
        total_lifetime_value: 50000, // $500
      },
      config: {
        business_name: "GreenFlow Lawn Care",
        payment_link_base_url: "https://pay.greenflow.com",
        include_late_fee_language: false,
        escalation_cadence_days: [7, 14, 21],
        tone: "friendly",
      },
      policy: {
        tier: "owner",
        auto_send_reminders: true,
        max_auto_followups: 3,
      },
    },
    expected: {
      message: {
        channel: "sms",
        to: "+15551234567",
        text: "Hi Alice! This is GreenFlow Lawn Care. Just a friendly reminder that your invoice for $75.00 is due. You can pay online at: https://pay.greenflow.com/pay/1. Let us know if you have questions! Thanks!",
      },
      action: {
        type: "offer_payment_link",
        payment_link: "https://pay.greenflow.com/pay/1",
        next_followup_in_days: 7,
      },
      confidence: 0.9,
      assumptions: ["Using standard reminder template", "Customer prefers sms"],
    },
  },
  {
    name: "Overdue Reminder - Professional Tone - 8 Days Overdue",
    input: {
      invoice: {
        id: 2,
        customer_name: "Bob Johnson",
        customer_phone: "+15559876543",
        customer_email: "bob@example.com",
        amount: 12000, // $120.00
        due_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days overdue
        status: "overdue",
        days_overdue: 8,
      },
      history: {
        previous_delinquencies: 1,
        last_payment_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        total_lifetime_value: 100000, // $1000
      },
      config: {
        business_name: "GreenFlow Lawn Care",
        payment_link_base_url: "https://pay.greenflow.com",
        include_late_fee_language: true,
        escalation_cadence_days: [7, 14, 21, 30],
        tone: "professional",
      },
      policy: {
        tier: "smb",
        auto_send_reminders: true,
        max_auto_followups: 3,
      },
    },
    expected: {
      message: {
        channel: "sms",
        to: "+15559876543",
        text: "This is GreenFlow Lawn Care. Your invoice #2 for $120.00 is 8 days overdue. Please remit payment at your earliest convenience. Pay online: https://pay.greenflow.com/pay/2.",
      },
      action: {
        type: "offer_payment_link",
        payment_link: "https://pay.greenflow.com/pay/2",
        next_followup_in_days: 14, // Next step in cadence after 7 days
      },
      confidence: 0.85,
      assumptions: ["Using professional reminder template", "Customer prefers sms"],
    },
  },
  {
    name: "Handoff to Human - Disputed Invoice",
    input: {
      invoice: {
        id: 3,
        customer_name: "Charlie Brown",
        customer_phone: "+15551112233",
        customer_email: "charlie@example.com",
        amount: 30000, // $300.00
        due_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        status: "disputed",
        days_overdue: 10,
      },
      history: {
        previous_delinquencies: 0,
        total_lifetime_value: 200000, // $2000
        notes: "Customer called to dispute service quality on 2026-01-05.",
      },
      config: {
        business_name: "GreenFlow Lawn Care",
        payment_link_base_url: "https://pay.greenflow.com",
        include_late_fee_language: false,
        escalation_cadence_days: [7, 14, 21],
        tone: "friendly",
      },
      policy: {
        tier: "owner",
        auto_send_reminders: true,
        max_auto_followups: 3,
      },
    },
    expected: {
      message: {
        channel: "email",
        to: "charlie@example.com",
        text: "Billing case for Charlie Brown requires human review.",
      },
      action: {
        type: "handoff_to_human",
        payment_link: null,
        next_followup_in_days: 0,
      },
      confidence: 1.0,
      assumptions: ["Invoice is disputed - requires human review"],
    },
  },
];
