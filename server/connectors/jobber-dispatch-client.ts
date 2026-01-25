import { JobberClient } from "./jobber-client";

interface JobForDispatch {
  id: string;
  title: string;
  scheduledAt: string;
  estimatedDurationMins: number;
  propertyId: string;
  propertyAddress: string;
  lat: number | null;
  lng: number | null;
  clientId: string;
  clientName: string;
  serviceType: string;
  assignedCrewId: string | null;
  customFields: Record<string, string>;
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

const JOBS_QUERY = `
  query GetScheduledJobs($after: String, $first: Int!, $filter: JobFilterAttributes) {
    jobs(after: $after, first: $first, filter: $filter) {
      nodes {
        id
        title
        startAt
        endAt
        property {
          id
          street
          city
          province
          postalCode
          mapAddress
        }
        client {
          id
          name
        }
        jobType {
          name
        }
        assignedUsers {
          nodes {
            id
            name
          }
        }
        customFields {
          nodes {
            label
            value
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const JOB_UPDATE_MUTATION = `
  mutation JobEdit($input: JobEditInput!) {
    jobEdit(input: $input) {
      job {
        id
        startAt
        assignedUsers { nodes { id name } }
      }
      userErrors {
        message
        path
      }
    }
  }
`;

const CUSTOM_FIELD_SET_MUTATION = `
  mutation CustomFieldValueSet($input: CustomFieldValueSetInput!) {
    customFieldValueSet(input: $input) {
      customFieldValue {
        value
      }
      userErrors {
        message
        path
      }
    }
  }
`;

export class JobberDispatchClient {
  private client: JobberClient;

  constructor(accountId: string) {
    this.client = new JobberClient(accountId);
  }

  async getScheduledJobsForDate(date: Date): Promise<JobForDispatch[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const allJobs: JobForDispatch[] = [];
    let cursor: string | null = null;
    let hasMore = true;
    const pageSize = 50;

    while (hasMore) {
      const variables: Record<string, any> = {
        first: pageSize,
        filter: {
          startAt: {
            gte: startOfDay.toISOString(),
            lte: endOfDay.toISOString(),
          },
          status: ["REQUIRES_INVOICING", "ACTIVE", "TODAY", "UPCOMING"],
        },
      };

      if (cursor) {
        variables.after = cursor;
      }

      try {
        const result = await this.client.query<{
          jobs: {
            nodes: any[];
            pageInfo: PageInfo;
          };
        }>(JOBS_QUERY, variables);

        for (const job of result.jobs.nodes) {
          const customFields: Record<string, string> = {};
          for (const cf of job.customFields?.nodes || []) {
            customFields[cf.label] = cf.value;
          }

          const property = job.property || {};
          const address = [
            property.street,
            property.city,
            property.province,
            property.postalCode,
          ].filter(Boolean).join(", ");

          const coords = this.parseMapAddress(property.mapAddress);

          allJobs.push({
            id: job.id,
            title: job.title || "Untitled Job",
            scheduledAt: job.startAt,
            estimatedDurationMins: this.calculateDurationMins(job.startAt, job.endAt),
            propertyId: property.id || "",
            propertyAddress: address,
            lat: coords.lat,
            lng: coords.lng,
            clientId: job.client?.id || "",
            clientName: job.client?.name || "Unknown",
            serviceType: job.jobType?.name || "general",
            assignedCrewId: job.assignedUsers?.nodes?.[0]?.id || null,
            customFields,
          });
        }

        hasMore = result.jobs.pageInfo.hasNextPage;
        cursor = result.jobs.pageInfo.endCursor;

        if (allJobs.length >= 500) {
          console.log(`[DispatchClient] Reached 500 job limit, stopping pagination`);
          break;
        }
      } catch (error) {
        console.error(`[DispatchClient] Error fetching jobs:`, error);
        throw error;
      }
    }

    console.log(`[DispatchClient] Fetched ${allJobs.length} jobs for ${date.toDateString()}`);
    return allJobs;
  }

  private parseMapAddress(mapAddress: string | null): { lat: number | null; lng: number | null } {
    if (!mapAddress) return { lat: null, lng: null };
    
    const match = mapAddress.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (match) {
      return {
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2]),
      };
    }
    return { lat: null, lng: null };
  }

  private calculateDurationMins(startAt: string, endAt: string): number {
    if (!startAt || !endAt) return 60;
    const start = new Date(startAt);
    const end = new Date(endAt);
    const diffMs = end.getTime() - start.getTime();
    return Math.max(15, Math.round(diffMs / (1000 * 60)));
  }

  async updateJobAssignment(jobId: string, crewUserId: string, startTime?: string): Promise<any> {
    const input: Record<string, any> = {
      id: jobId,
    };

    if (crewUserId) {
      input.assignedUserIds = [crewUserId];
    }

    if (startTime) {
      input.startAt = startTime;
    }

    const result = await this.client.query<{
      jobEdit: {
        job: any;
        userErrors: Array<{ message: string; path: string[] }>;
      };
    }>(JOB_UPDATE_MUTATION, { input });

    if (result.jobEdit.userErrors?.length > 0) {
      const errors = result.jobEdit.userErrors.map(e => e.message).join("; ");
      throw new Error(`Failed to update job: ${errors}`);
    }

    return result.jobEdit.job;
  }

  async setRoutePlanUrl(jobId: string, routeUrl: string): Promise<void> {
    const input = {
      linkedObjectId: jobId,
      customFieldConfigurationId: await this.getOrCreateRoutePlanFieldId(),
      valueLink: routeUrl,
    };

    const result = await this.client.query<{
      customFieldValueSet: {
        customFieldValue: any;
        userErrors: Array<{ message: string; path: string[] }>;
      };
    }>(CUSTOM_FIELD_SET_MUTATION, { input });

    if (result.customFieldValueSet.userErrors?.length > 0) {
      console.warn(`[DispatchClient] Warning setting route URL:`, result.customFieldValueSet.userErrors);
    }
  }

  private routePlanFieldId: string | null = null;

  private async getOrCreateRoutePlanFieldId(): Promise<string> {
    if (this.routePlanFieldId) return this.routePlanFieldId;
    
    const query = `
      query GetCustomFieldConfigs {
        customFieldConfigurations(first: 100) {
          nodes {
            id
            label
            type
          }
        }
      }
    `;

    try {
      const result = await this.client.query<{
        customFieldConfigurations: {
          nodes: Array<{ id: string; label: string; type: string }>;
        };
      }>(query, {});

      const routePlanField = result.customFieldConfigurations.nodes.find(
        f => f.label === "LawnFlow Route Plan"
      );

      if (routePlanField) {
        this.routePlanFieldId = routePlanField.id;
        return this.routePlanFieldId;
      }

      console.warn(`[DispatchClient] LawnFlow Route Plan custom field not found. Create it manually in Jobber.`);
      return "";
    } catch (error) {
      console.error(`[DispatchClient] Error fetching custom field configs:`, error);
      return "";
    }
  }

  async checkAutoDispatchEnabled(): Promise<boolean> {
    try {
      const query = `
        query GetAccountCustomFields {
          account {
            id
          }
        }
      `;
      
      await this.client.query(query, {});
      return false;
    } catch {
      return false;
    }
  }
}

export type { JobForDispatch };
