import { db } from "../db";
import { jobberAccounts, jobberWebhookEvents, jobberEnrichments } from "@shared/schema";
import { eq, and, lt, or } from "drizzle-orm";

const JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql";
const TOKEN_REFRESH_BUFFER_SECONDS = 300;

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: any }>;
}

interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export class JobberClient {
  private accountId: string;

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  private async getAccount() {
    const [account] = await db
      .select()
      .from(jobberAccounts)
      .where(eq(jobberAccounts.jobberAccountId, this.accountId))
      .limit(1);
    return account;
  }

  private async refreshTokenIfNeeded(): Promise<string> {
    const account = await this.getAccount();
    if (!account) {
      throw new Error(`Jobber account not found: ${this.accountId}`);
    }

    const now = new Date();
    const bufferTime = new Date(now.getTime() + TOKEN_REFRESH_BUFFER_SECONDS * 1000);

    if (account.tokenExpiresAt > bufferTime) {
      return account.accessToken;
    }

    console.log(`[Jobber] Refreshing token for account ${this.accountId}`);
    
    const clientId = process.env.JOBBER_CLIENT_ID;
    const clientSecret = process.env.JOBBER_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error("Missing JOBBER_CLIENT_ID or JOBBER_CLIENT_SECRET");
    }

    const response = await fetch("https://api.getjobber.com/api/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: account.refreshToken,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${text}`);
    }

    const tokenData = await response.json();
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await db
      .update(jobberAccounts)
      .set({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || account.refreshToken,
        tokenExpiresAt: newExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(jobberAccounts.id, account.id));

    console.log(`[Jobber] Token refreshed for account ${this.accountId}`);
    return tokenData.access_token;
  }

  async query<T>(queryString: string, variables?: Record<string, any>): Promise<T> {
    const accessToken = await this.refreshTokenIfNeeded();
    
    let attempt = 0;
    const maxAttempts = 3;
    
    while (attempt < maxAttempts) {
      attempt++;
      
      const response = await fetch(JOBBER_GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "X-JOBBER-GRAPHQL-VERSION": "2024-06-24",
        },
        body: JSON.stringify({ query: queryString, variables }),
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
        const backoffMs = Math.min(retryAfter * 1000 * Math.pow(2, attempt - 1), 30000);
        console.log(`[Jobber] Rate limited, waiting ${backoffMs}ms before retry ${attempt}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`GraphQL request failed: ${response.status} ${text}`);
      }

      const result: GraphQLResponse<T> = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(", ")}`);
      }

      return result.data as T;
    }

    throw new Error(`Max retry attempts (${maxAttempts}) exceeded for GraphQL query`);
  }

  async getClient(clientId: string) {
    const query = `
      query GetClient($id: EncodedId!) {
        client(id: $id) {
          id
          name
          firstName
          lastName
          companyName
          emails { address primary }
          phones { number primary friendly }
          billingAddress { street city province postalCode country }
          properties { nodes { id street city province postalCode } }
        }
      }
    `;
    return this.query<{ client: any }>(query, { id: clientId });
  }

  async getProperty(propertyId: string) {
    const query = `
      query GetProperty($id: EncodedId!) {
        property(id: $id) {
          id
          street
          city
          province
          postalCode
          country
          routingAddress
          mapAddress
          client { id name }
        }
      }
    `;
    return this.query<{ property: any }>(query, { id: propertyId });
  }

  async getQuote(quoteId: string) {
    const query = `
      query GetQuote($id: EncodedId!) {
        quote(id: $id) {
          id
          quoteNumber
          title
          quoteStatus
          client { id name }
          property { id street city province postalCode }
          lineItems { nodes { name description quantity unitPrice total } }
          amounts { total depositAmount discountAmount subtotal outstanding }
        }
      }
    `;
    return this.query<{ quote: any }>(query, { id: quoteId });
  }

  async getClientWithCustomFields(clientId: string) {
    const query = `
      query GetClientWithCustomFields($id: EncodedId!) {
        client(id: $id) {
          id
          name
          firstName
          lastName
          companyName
          emails { address primary }
          phones { number primary friendly }
          billingAddress { street city province postalCode country }
          properties { 
            nodes { 
              id 
              street 
              city 
              province 
              postalCode
              customFields { nodes { label value } }
            } 
          }
          customFields { nodes { label value } }
        }
      }
    `;
    return this.query<{ client: any }>(query, { id: clientId });
  }

  async getClientCustomField(clientId: string, fieldLabel: string): Promise<string | null> {
    try {
      const result = await this.getClientWithCustomFields(clientId);
      if (!result.client?.customFields?.nodes) {
        return null;
      }
      const field = result.client.customFields.nodes.find(
        (f: { label: string; value: string }) => f.label === fieldLabel
      );
      return field?.value || null;
    } catch (error) {
      console.error(`[Jobber] Error getting custom field ${fieldLabel} for client ${clientId}:`, error);
      return null;
    }
  }

  async createQuote(input: {
    clientId: string;
    propertyId?: string;
    title: string;
    message?: string;
    lineItems: Array<{
      name: string;
      description?: string;
      quantity: number;
      unitPrice: number;
    }>;
  }) {
    const mutation = `
      mutation CreateQuote($input: QuoteCreateInput!) {
        quoteCreate(input: $input) {
          quote {
            id
            quoteNumber
            quoteStatus
            title
            client { id name }
            amounts { total }
          }
          userErrors { message path }
        }
      }
    `;
    
    const lineItems = input.lineItems.map(li => ({
      name: li.name,
      description: li.description || '',
      quantity: li.quantity,
      unitCost: li.unitPrice / 100,
    }));

    const variables: any = {
      input: {
        clientId: input.clientId,
        title: input.title,
        lineItems,
      },
    };

    if (input.propertyId) {
      variables.input.propertyId = input.propertyId;
    }
    if (input.message) {
      variables.input.message = input.message;
    }

    return this.query<{ quoteCreate: { quote: any; userErrors: Array<{ message: string; path: string[] }> } }>(
      mutation,
      variables
    );
  }

  async getCompletedJobsForClient(clientId: string, limit: number = 50) {
    const query = `
      query GetClientJobs($clientId: EncodedId!, $first: Int!) {
        client(id: $clientId) {
          id
          name
          jobs(first: $first, filter: { status: COMPLETED }) {
            nodes {
              id
              title
              jobNumber
              jobStatus
              jobType { name }
              completedAt
              property { id }
              lineItems { nodes { name } }
              amounts { total }
            }
          }
        }
      }
    `;
    return this.query<{ client: { jobs: { nodes: any[] } } }>(query, { clientId, first: limit });
  }

  async getClientsWithRecentCompletedJobs(daysBack: number = 60, limit: number = 100) {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);
    
    const query = `
      query GetRecentCompletedJobs($first: Int!) {
        jobs(first: $first, filter: { status: COMPLETED }) {
          nodes {
            id
            title
            jobNumber
            jobStatus
            jobType { name }
            completedAt
            client { 
              id 
              name
              customFields { nodes { label value } }
            }
            property { 
              id
              customFields { nodes { label value } }
            }
            lineItems { nodes { name } }
            amounts { total }
          }
        }
      }
    `;
    
    const result = await this.query<{ jobs: { nodes: any[] } }>(query, { first: limit });
    
    const filteredJobs = result.jobs.nodes.filter(job => {
      if (!job.completedAt) return false;
      const completedDate = new Date(job.completedAt);
      return completedDate >= sinceDate;
    });
    
    return { jobs: { nodes: filteredJobs } };
  }

  private customFieldCache: Map<string, string> = new Map();

  async getCustomFieldConfigurations() {
    const query = `
      query GetCustomFieldConfigs {
        customFieldConfigurations(first: 100) {
          nodes {
            id
            label
            type
            applicableTo
          }
        }
      }
    `;
    return this.query<{
      customFieldConfigurations: {
        nodes: Array<{ id: string; label: string; type: string; applicableTo: string }>;
      };
    }>(query, {});
  }

  async getCustomFieldIdByLabel(label: string): Promise<string | null> {
    if (this.customFieldCache.has(label)) {
      return this.customFieldCache.get(label) || null;
    }

    try {
      const result = await this.getCustomFieldConfigurations();
      const configs = result.customFieldConfigurations?.nodes || [];
      
      for (const config of configs) {
        this.customFieldCache.set(config.label, config.id);
      }

      return this.customFieldCache.get(label) || null;
    } catch (error) {
      console.error(`[Jobber] Error fetching custom field configs:`, error);
      return null;
    }
  }

  async updateClientCustomFields(clientId: string, customFields: Array<{ name: string; value: string }>) {
    const mutation = `
      mutation UpdateClientCustomFields($clientId: EncodedId!, $customFieldValues: [CustomFieldValueInput!]!) {
        clientUpdate(clientId: $clientId, customFieldValues: $customFieldValues) {
          client { id }
          userErrors { message path }
        }
      }
    `;
    return this.query<{ clientUpdate: any }>(mutation, {
      clientId,
      customFieldValues: customFields.map(cf => ({
        customFieldId: cf.name,
        valueText: cf.value,
      })),
    });
  }

  async updateClientCustomFieldByLabel(clientId: string, label: string, value: string): Promise<{ success: boolean; error?: string }> {
    const fieldId = await this.getCustomFieldIdByLabel(label);
    if (!fieldId) {
      return { success: false, error: `Custom field "${label}" not found in Jobber. Please create it manually.` };
    }

    try {
      const result = await this.updateClientCustomFields(clientId, [{ name: fieldId, value }]);
      if (result.clientUpdate?.userErrors?.length > 0) {
        return { 
          success: false, 
          error: result.clientUpdate.userErrors.map((e: any) => e.message).join(', ') 
        };
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async updatePropertyCustomFields(propertyId: string, customFields: Array<{ name: string; value: string }>) {
    const mutation = `
      mutation UpdatePropertyCustomFields($propertyId: EncodedId!, $customFieldValues: [CustomFieldValueInput!]!) {
        propertyUpdate(propertyId: $propertyId, customFieldValues: $customFieldValues) {
          property { id }
          userErrors { message path }
        }
      }
    `;
    return this.query<{ propertyUpdate: any }>(mutation, {
      propertyId,
      customFieldValues: customFields.map(cf => ({
        customFieldId: cf.name,
        valueText: cf.value,
      })),
    });
  }

  async getJob(jobId: string) {
    const query = `
      query GetJob($id: EncodedId!) {
        job(id: $id) {
          id
          title
          jobNumber
          jobStatus
          createdAt
          client { id name }
          property { 
            id 
            street 
            city 
            province 
            postalCode
            customFields { nodes { label value } }
          }
          jobType { name }
          quote { id }
          assignedUsers { nodes { id name } }
          lineItems { nodes { id name description quantity unitPrice total } }
          amounts { total depositAmount discountAmount subtotal outstanding }
          customFields { nodes { label value } }
        }
      }
    `;
    return this.query<{ job: any }>(query, { id: jobId });
  }

  async getVisit(visitId: string) {
    const query = `
      query GetVisit($id: EncodedId!) {
        visit(id: $id) {
          id
          title
          status
          startAt
          endAt
          duration
          completedAt
          job { 
            id 
            title 
            jobType { name }
          }
          assignedUsers { nodes { id name } }
          timeEntries {
            nodes {
              id
              duration
              startAt
              endAt
              user { id name }
            }
          }
        }
      }
    `;
    return this.query<{ visit: any }>(query, { id: visitId });
  }

  async getClientJobs(clientId: string, first: number = 10) {
    const query = `
      query GetClientJobs($clientId: EncodedId!, $first: Int!) {
        client(id: $clientId) {
          id
          jobs(first: $first, sortBy: { field: CREATED_AT, direction: DESC }) {
            nodes {
              id
              title
              jobNumber
              jobStatus
              createdAt
            }
          }
        }
      }
    `;
    return this.query<{ client: { jobs: { nodes: any[] } } }>(query, { 
      clientId, 
      first,
    });
  }

  async updateJobLineItems(jobId: string, lineItems: Array<{ name: string; description?: string; quantity: number; unitPrice: number }>) {
    const mutation = `
      mutation UpdateJobLineItems($jobId: EncodedId!, $lineItems: [LineItemInput!]!) {
        jobEdit(jobId: $jobId, lineItems: $lineItems) {
          job { id }
          userErrors { message path }
        }
      }
    `;
    return this.query<{ jobEdit: any }>(mutation, {
      jobId,
      lineItems: lineItems.map(li => ({
        name: li.name,
        description: li.description || "",
        quantity: li.quantity.toString(),
        unitCost: li.unitPrice.toString(),
      })),
    });
  }

  async setJobCustomField(jobId: string, fieldName: string, value: string) {
    const mutation = `
      mutation SetJobCustomField($jobId: EncodedId!, $customFieldValues: [CustomFieldValueInput!]!) {
        jobEdit(jobId: $jobId, customFieldValues: $customFieldValues) {
          job { id }
          userErrors { message path }
        }
      }
    `;
    return this.query<{ jobEdit: any }>(mutation, {
      jobId,
      customFieldValues: [{
        customFieldId: fieldName,
        valueText: value,
      }],
    });
  }

  async addJobNote(jobId: string, noteText: string) {
    const mutation = `
      mutation AddJobNote($input: NoteCreateInput!) {
        noteCreate(input: $input) {
          note { id }
          userErrors { message path }
        }
      }
    `;
    return this.query<{ noteCreate: any }>(mutation, {
      input: {
        linkedToId: jobId,
        message: noteText,
      },
    });
  }

  async createInvoice(jobId: string, lineItems: Array<{ name: string; description?: string; quantity: number; unitCost: number }>) {
    const mutation = `
      mutation CreateInvoice($input: InvoiceCreateInput!) {
        invoiceCreate(input: $input) {
          invoice { 
            id 
            invoiceNumber
            amounts { total outstanding }
          }
          userErrors { message path }
        }
      }
    `;
    return this.query<{ invoiceCreate: { invoice: any; userErrors: any[] } }>(mutation, {
      input: {
        jobId,
        lineItems: lineItems.map(li => ({
          name: li.name,
          description: li.description || "",
          quantity: li.quantity.toString(),
          unitCost: li.unitCost.toString(),
        })),
      },
    });
  }

  async sendInvoice(invoiceId: string, deliveryMethod: "EMAIL" | "SMS" = "EMAIL") {
    const mutation = `
      mutation SendInvoice($invoiceId: EncodedId!, $deliveryMethod: InvoiceDeliveryMethod!) {
        invoiceSend(invoiceId: $invoiceId, deliveryMethod: $deliveryMethod) {
          invoice { 
            id 
            sentStatus 
          }
          userErrors { message path }
        }
      }
    `;
    return this.query<{ invoiceSend: { invoice: any; userErrors: any[] } }>(mutation, {
      invoiceId,
      deliveryMethod,
    });
  }

  async getInvoice(invoiceId: string) {
    const query = `
      query GetInvoice($id: EncodedId!) {
        invoice(id: $id) {
          id
          invoiceNumber
          subject
          sentStatus
          paymentStatus
          dueDate
          issuedDate
          amounts { total outstanding subtotal paid }
          job { id title }
          client { id name }
        }
      }
    `;
    return this.query<{ invoice: any }>(query, { id: invoiceId });
  }

  async getInvoicePayments(invoiceId: string) {
    const query = `
      query GetInvoicePayments($id: EncodedId!) {
        invoice(id: $id) {
          id
          payments {
            nodes {
              id
              amount
              paymentMethod
              paymentDate
              note
              createdAt
            }
          }
        }
      }
    `;
    return this.query<{ invoice: { payments: { nodes: any[] } } }>(query, { id: invoiceId });
  }

  async getPayment(paymentId: string) {
    const query = `
      query GetPayment($id: EncodedId!) {
        payment(id: $id) {
          id
          amount
          paymentMethod
          paymentDate
          note
          invoice { id invoiceNumber }
          createdAt
        }
      }
    `;
    return this.query<{ payment: any }>(query, { id: paymentId });
  }

  async getJobInvoices(jobId: string) {
    const query = `
      query GetJobInvoices($jobId: EncodedId!) {
        job(id: $jobId) {
          id
          invoices {
            nodes {
              id
              invoiceNumber
              subject
              sentStatus
              paymentStatus
              amounts { total outstanding }
            }
          }
        }
      }
    `;
    return this.query<{ job: { invoices: { nodes: any[] } } }>(query, { jobId });
  }
}

export async function getJobberClient(accountId: string): Promise<JobberClient> {
  return new JobberClient(accountId);
}

export async function saveJobberAccount(data: {
  jobberAccountId: string;
  jobberUserId?: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes?: string[];
  businessId?: number;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + data.expiresIn * 1000);
  
  const existing = await db
    .select()
    .from(jobberAccounts)
    .where(eq(jobberAccounts.jobberAccountId, data.jobberAccountId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(jobberAccounts)
      .set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: expiresAt,
        scopes: data.scopes,
        updatedAt: new Date(),
      })
      .where(eq(jobberAccounts.jobberAccountId, data.jobberAccountId));
  } else {
    await db.insert(jobberAccounts).values({
      jobberAccountId: data.jobberAccountId,
      jobberUserId: data.jobberUserId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenExpiresAt: expiresAt,
      scopes: data.scopes,
      businessId: data.businessId,
    });
  }
}
