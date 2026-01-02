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
          property { id street city province postalCode }
          lineItems { nodes { id name description quantity unitPrice total } }
          amounts { total depositAmount discountAmount subtotal outstanding }
        }
      }
    `;
    return this.query<{ job: any }>(query, { id: jobId });
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
