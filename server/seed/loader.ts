import fs from "fs";
import path from "path";
import { z } from "zod";

const dataDir = path.join(path.dirname(import.meta.url.replace("file://", "")), "data");
const supplementalDir = path.join(dataDir, "supplemental");

export function loadJson<T>(relativePath: string): T {
  const fullPath = path.join(dataDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Seed file not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(content);
}

export function loadSupplementalJson<T>(filename: string): T[] {
  const fullPath = path.join(supplementalDir, filename);
  if (!fs.existsSync(fullPath)) {
    return [];
  }
  const content = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(content);
}

const AddressSchema = z.object({
  line1: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  timezone: z.string(),
  createdAt: z.string().optional(),
  serviceArea: z.object({
    homeBase: z.object({
      city: z.string(),
      state: z.string(),
      lat: z.number(),
      lng: z.number(),
    }),
    primaryRadiusMiles: z.number(),
    zips: z.array(z.string()),
  }).optional(),
});

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  phoneE164: z.string(),
  email: z.string().optional(),
  language: z.string().optional(),
});

const CrewSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  homeBase: z.object({
    lat: z.number(),
    lng: z.number(),
    label: z.string(),
  }),
  leaderUserId: z.string(),
  memberUserIds: z.array(z.string()),
});

const CustomerSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  phoneE164: z.string(),
  email: z.string().nullable().optional(),
  address: AddressSchema,
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
  sitePreferences: z.record(z.any()).optional(),
  createdAt: z.string(),
});

const LeadSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  phoneE164: z.string(),
  email: z.string().nullable().optional(),
  addressText: z.string().nullable().optional(),
  source: z.string(),
  status: z.string(),
  requestedServices: z.array(z.string()).nullable().optional(),
  createdAt: z.string(),
});

const JobSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  customerId: z.string().nullable().optional(),
  quoteId: z.string().nullable().optional(),
  assignedCrewId: z.string().nullable().optional(),
  title: z.string(),
  serviceCodes: z.array(z.string()).nullable().optional(),
  status: z.string(),
  scheduledStartAt: z.string().nullable().optional(),
  scheduledEndAt: z.string().nullable().optional(),
  address: AddressSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
});

const QuoteSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  customerId: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  status: z.string(),
  minPrice: z.number().optional(),
  targetPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  serviceCodes: z.array(z.string()).optional(),
  createdAt: z.string(),
});

const InvoiceSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  customerId: z.string(),
  jobId: z.string().nullable().optional(),
  quoteId: z.string().nullable().optional(),
  status: z.string(),
  currency: z.string(),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  dueDate: z.string().nullable().optional(),
  sentAt: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  externalProvider: z.string().nullable().optional(),
  externalInvoiceId: z.string().nullable().optional(),
  lastSyncedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const PaymentSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  invoiceId: z.string(),
  status: z.string(),
  amount: z.number(),
  method: z.string(),
  externalProvider: z.string().nullable().optional(),
  externalPaymentId: z.string().nullable().optional(),
  occurredAt: z.string(),
  createdAt: z.string(),
});

const BillingIssueSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  type: z.string(),
  severity: z.string(),
  status: z.string(),
  relatedInvoiceId: z.string().nullable().optional(),
  summary: z.string(),
  detailsJson: z.record(z.any()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CommsThreadSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  audienceType: z.enum(["LEAD", "CUSTOMER", "CREW"]),
  audienceId: z.string().nullable().optional(),
  audienceName: z.string().optional(),
  phoneE164: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  primaryChannel: z.string(),
  lastMessageAt: z.string(),
  lastInboundAt: z.string().nullable().optional(),
  lastOutboundAt: z.string().nullable().optional(),
  lastMessageSnippet: z.string().optional(),
  messageCount: z.number().optional(),
  urgencyScore: z.number().optional(),
  urgencyLevel: z.string(),
  urgencyReason: z.string().nullable().optional(),
  status: z.string(),
  slaDeadlineAt: z.string().nullable().optional(),
  relatedJobId: z.string().nullable().optional(),
  relatedQuoteId: z.string().nullable().optional(),
  relatedInvoiceId: z.string().nullable().optional(),
  relatedLeadId: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  sentimentScore: z.number().optional(),
  hasNegativeSentiment: z.boolean().optional(),
  hasPendingApproval: z.boolean().optional(),
  pendingApprovalCount: z.number().optional(),
  pendingActionCount: z.number().optional(),
  contextJson: z.record(z.any()).nullable().optional(),
  createdAt: z.string().optional(),
});

const CommsMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  channel: z.string(),
  senderType: z.string().optional(),
  senderId: z.string().nullable().optional(),
  senderName: z.string().nullable().optional(),
  body: z.string(),
  sentAt: z.string().optional(),
  deliveredAt: z.string().nullable().optional(),
  readAt: z.string().nullable().optional(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
});

const ServiceSchema = z.object({
  serviceCode: z.string(),
  name: z.string(),
  category: z.string(),
  serviceType: z.string(),
  requiresLeadTime: z.boolean().optional(),
  defaultLeadTimeDays: z.number().optional(),
});

const SupplementalLeadSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  phoneE164: z.string(),
  email: z.string().nullable().optional(),
  addressText: z.string().nullable().optional(),
  zip: z.string().optional(),
  source: z.string(),
  status: z.string(),
  requestedServices: z.array(z.string()).nullable().optional(),
  createdAt: z.string(),
});

const SupplementalUserSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  role: z.string(),
  phoneE164: z.string(),
  email: z.string().optional(),
  language: z.string().optional(),
  createdAt: z.string().optional(),
  reportsToUserId: z.string().optional(),
});

const SupplementalCrewSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  status: z.string(),
  homeBase: z.object({
    lat: z.number(),
    lng: z.number(),
    label: z.string(),
  }),
  leaderUserId: z.string(),
  memberUserIds: z.array(z.string()),
  vehicle: z.object({
    name: z.string(),
    plate: z.string(),
  }).optional(),
  assets: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
});

const SupplementalCustomerSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  phoneE164: z.string(),
  email: z.string().nullable().optional(),
  addressText: z.string(),
  zip: z.string(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string(),
});

const SupplementalQuoteSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  leadId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  status: z.string(),
  services: z.array(z.string()).optional(),
  priceRange: z.object({
    low: z.number(),
    high: z.number(),
    currency: z.string(),
  }).optional(),
  assumptions: z.array(z.string()).optional(),
  confidence: z.number().optional(),
  createdAt: z.string(),
});

const SupplementalJobSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  leadId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  quoteId: z.string().nullable().optional(),
  status: z.string(),
  service: z.string(),
  scheduledStart: z.string().nullable().optional(),
  scheduledEnd: z.string().nullable().optional(),
  crewId: z.string().nullable().optional(),
  location: z.object({
    addressText: z.string(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }).optional(),
  createdAt: z.string(),
});

const SupplementalInvoiceSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  customerId: z.string(),
  jobId: z.string().nullable().optional(),
  quoteId: z.string().nullable().optional(),
  status: z.string(),
  amount: z.number(),
  currency: z.string(),
  issueStatus: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  sentAt: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  createdAt: z.string(),
  lineItems: z.array(z.object({
    name: z.string(),
    qty: z.number(),
    unitPrice: z.number(),
  })).optional(),
  notes: z.string().optional(),
});

export type SeedSupplementalLead = z.infer<typeof SupplementalLeadSchema>;
export type SeedSupplementalUser = z.infer<typeof SupplementalUserSchema>;
export type SeedSupplementalCrew = z.infer<typeof SupplementalCrewSchema>;
export type SeedSupplementalCustomer = z.infer<typeof SupplementalCustomerSchema>;
export type SeedSupplementalQuote = z.infer<typeof SupplementalQuoteSchema>;
export type SeedSupplementalJob = z.infer<typeof SupplementalJobSchema>;
export type SeedSupplementalInvoice = z.infer<typeof SupplementalInvoiceSchema>;

export type SeedAccount = z.infer<typeof AccountSchema>;
export type SeedUser = z.infer<typeof UserSchema>;
export type SeedCrew = z.infer<typeof CrewSchema>;
export type SeedCustomer = z.infer<typeof CustomerSchema>;
export type SeedLead = z.infer<typeof LeadSchema>;
export type SeedJob = z.infer<typeof JobSchema>;
export type SeedQuote = z.infer<typeof QuoteSchema>;
export type SeedInvoice = z.infer<typeof InvoiceSchema>;
export type SeedPayment = z.infer<typeof PaymentSchema>;
export type SeedBillingIssue = z.infer<typeof BillingIssueSchema>;
export type SeedCommsThread = z.infer<typeof CommsThreadSchema>;
export type SeedCommsMessage = z.infer<typeof CommsMessageSchema>;
export type SeedService = z.infer<typeof ServiceSchema>;

export interface SeedData {
  account: SeedAccount;
  users: SeedUser[];
  crews: SeedCrew[];
  customers: SeedCustomer[];
  leads: SeedLead[];
  jobs: SeedJob[];
  quotes: SeedQuote[];
  invoices: SeedInvoice[];
  payments: SeedPayment[];
  billingIssues: SeedBillingIssue[];
  commsThreads: SeedCommsThread[];
  commsMessages: SeedCommsMessage[];
  services: SeedService[];
}

export interface SupplementalData {
  leads: SeedSupplementalLead[];
  users: SeedSupplementalUser[];
  crews: SeedSupplementalCrew[];
  customers: SeedSupplementalCustomer[];
  quotes: SeedSupplementalQuote[];
  jobs: SeedSupplementalJob[];
  invoices: SeedSupplementalInvoice[];
}

export interface IdMaps {
  crews: Map<string, number>;
  customers: Map<string, number>;
  leads: Map<string, number>;
  jobs: Map<string, number>;
  quotes: Map<string, number>;
  invoices: Map<string, number>;
  threads: Map<string, number>;
  users: Map<string, number>;
}

export function loadAllSeedData(): SeedData {
  const account = AccountSchema.parse(loadJson<any>("accounts/account.json"));
  const users = z.array(UserSchema).parse(loadJson<any[]>("users/users.json"));
  const crews = z.array(CrewSchema).parse(loadJson<any[]>("crews/crews.json"));
  const customers = z.array(CustomerSchema).parse(loadJson<any[]>("customers/customers.json"));
  const leads = z.array(LeadSchema).parse(loadJson<any[]>("leads/leads.json"));
  const jobs = z.array(JobSchema).parse(loadJson<any[]>("jobs/jobs.json"));
  const quotes = z.array(QuoteSchema).parse(loadJson<any[]>("quotes/quotes.json"));
  const invoices = z.array(InvoiceSchema).parse(loadJson<any[]>("billing/invoices/invoices.json"));
  const payments = z.array(PaymentSchema).parse(loadJson<any[]>("billing/payments/payments.json"));
  const billingIssues = z.array(BillingIssueSchema).parse(loadJson<any[]>("billing/issues/issues.json"));
  const commsThreads = z.array(CommsThreadSchema).parse(loadJson<any[]>("comms/threads.json"));
  const commsMessages = z.array(CommsMessageSchema).parse(loadJson<any[]>("comms/messages.json"));
  const services = z.array(ServiceSchema).parse(loadJson<any[]>("services.json"));

  return {
    account,
    users,
    crews,
    customers,
    leads,
    jobs,
    quotes,
    invoices,
    payments,
    billingIssues,
    commsThreads,
    commsMessages,
    services,
  };
}

export function loadSupplementalData(): SupplementalData {
  const leadsRaw = loadSupplementalJson<any>("leads_supplemental.json");
  const usersRaw = loadSupplementalJson<any>("users_supplemental.json");
  const crewsRaw = loadSupplementalJson<any>("crews_supplemental.json");
  const customersRaw = loadSupplementalJson<any>("customers_from_leads.json");
  const quotesRaw = loadSupplementalJson<any>("quotes_supplemental.json");
  const jobsRaw = loadSupplementalJson<any>("jobs_supplemental.json");
  const invoicesRaw = loadSupplementalJson<any>("invoices_supplemental.json");

  const leads = leadsRaw.length > 0 
    ? z.array(SupplementalLeadSchema).parse(leadsRaw) 
    : [];
  const users = usersRaw.length > 0 
    ? z.array(SupplementalUserSchema).parse(usersRaw) 
    : [];
  const crews = crewsRaw.length > 0 
    ? z.array(SupplementalCrewSchema).parse(crewsRaw) 
    : [];
  const customers = customersRaw.length > 0 
    ? z.array(SupplementalCustomerSchema).parse(customersRaw) 
    : [];
  const quotes = quotesRaw.length > 0 
    ? z.array(SupplementalQuoteSchema).parse(quotesRaw) 
    : [];
  const jobs = jobsRaw.length > 0 
    ? z.array(SupplementalJobSchema).parse(jobsRaw) 
    : [];
  const invoices = invoicesRaw.length > 0 
    ? z.array(SupplementalInvoiceSchema).parse(invoicesRaw) 
    : [];

  console.log(`Loaded supplemental data: ${leads.length} leads, ${users.length} users, ${crews.length} crews, ${customers.length} customers, ${quotes.length} quotes, ${jobs.length} jobs, ${invoices.length} invoices`);

  return {
    leads,
    users,
    crews,
    customers,
    quotes,
    jobs,
    invoices,
  };
}

export function createIdMaps(): IdMaps {
  return {
    crews: new Map(),
    customers: new Map(),
    leads: new Map(),
    jobs: new Map(),
    quotes: new Map(),
    invoices: new Map(),
    threads: new Map(),
    users: new Map(),
  };
}
