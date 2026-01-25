import { db } from '../../db';
import { eq, and, desc, gte } from 'drizzle-orm';
import { getJobberClient } from '../../connectors/jobber-client';
import { jobberAccounts } from '@shared/schema';
import {
  findMatchingOffers,
  ClientProfile,
  CompletedJob,
  RankedOffer,
  normalizeServiceType,
  generateQuoteLineItems,
  formatPrice,
  UpsellRulesConfig,
} from './rulesEngine';
import { ServiceType, getCurrentSeason, Offer } from './offerCatalog';

const UPSELL_OPT_IN_FIELD = 'UPSELL_OPT_IN';
const LAWNFLOW_OFFER_ID_FIELD = 'LAWNFLOW_LAST_OFFER';

export interface UpsellScanResult {
  clientId: string;
  clientName: string;
  offers: RankedOffer[];
  quoteCreated?: {
    quoteId: string;
    quoteNumber: string;
    total: number;
  };
  skipped?: string;
  error?: string;
}

export interface UpsellScanSummary {
  scannedAt: Date;
  totalClientsScanned: number;
  eligibleClients: number;
  offersGenerated: number;
  quotesCreated: number;
  errors: number;
  results: UpsellScanResult[];
}

function isOptedIn(customFields: Array<{ label: string; value: string }> | undefined): boolean {
  if (!customFields) return false;
  const optInField = customFields.find(f => f.label === UPSELL_OPT_IN_FIELD);
  if (!optInField) return false;
  const value = optInField.value?.toLowerCase().trim();
  return value === 'true' || value === 'yes' || value === '1';
}

function extractLotSize(customFields: Array<{ label: string; value: string }> | undefined): number | undefined {
  if (!customFields) return undefined;
  const lotField = customFields.find(f => 
    f.label.toLowerCase().includes('lot') && 
    (f.label.toLowerCase().includes('size') || f.label.toLowerCase().includes('sqft'))
  );
  if (!lotField?.value) return undefined;
  const parsed = parseInt(lotField.value.replace(/[^0-9]/g, ''), 10);
  return isNaN(parsed) ? undefined : parsed;
}

function extractPreviousOffers(customFields: Array<{ label: string; value: string }> | undefined): string[] {
  if (!customFields) return [];
  const offersField = customFields.find(f => f.label === LAWNFLOW_OFFER_ID_FIELD);
  if (!offersField?.value) return [];
  return offersField.value.split(',').map(s => s.trim()).filter(Boolean);
}

export async function runUpsellScan(
  accountId: string,
  config: Partial<UpsellRulesConfig> = {}
): Promise<UpsellScanSummary> {
  const fullConfig: UpsellRulesConfig = {
    maxDaysLookback: config.maxDaysLookback ?? 60,
    maxOffersPerClient: config.maxOffersPerClient ?? 3,
    minDaysBetweenOffers: config.minDaysBetweenOffers ?? 14,
    excludeRecentOfferIds: config.excludeRecentOfferIds,
  };

  const client = await getJobberClient(accountId);
  const summary: UpsellScanSummary = {
    scannedAt: new Date(),
    totalClientsScanned: 0,
    eligibleClients: 0,
    offersGenerated: 0,
    quotesCreated: 0,
    errors: 0,
    results: [],
  };

  console.log(`[Upsell] Starting scan for account ${accountId}, lookback ${fullConfig.maxDaysLookback} days`);

  try {
    const jobsResult = await client.getClientsWithRecentCompletedJobs(fullConfig.maxDaysLookback, 200);
    const jobs = jobsResult.jobs.nodes;

    console.log(`[Upsell] Found ${jobs.length} completed jobs in lookback period`);

    const clientJobsMap = new Map<string, {
      clientId: string;
      clientName: string;
      clientCustomFields: Array<{ label: string; value: string }>;
      propertyId?: string;
      propertyCustomFields?: Array<{ label: string; value: string }>;
      jobs: CompletedJob[];
    }>();

    for (const job of jobs) {
      if (!job.client?.id) continue;

      const clientId = job.client.id;
      
      if (!clientJobsMap.has(clientId)) {
        clientJobsMap.set(clientId, {
          clientId,
          clientName: job.client.name || 'Unknown',
          clientCustomFields: job.client.customFields?.nodes || [],
          propertyId: job.property?.id,
          propertyCustomFields: job.property?.customFields?.nodes,
          jobs: [],
        });
      }

      const entry = clientJobsMap.get(clientId)!;
      
      const jobTypeName = job.jobType?.name || job.title || '';
      const lineItemNames = job.lineItems?.nodes?.map((li: any) => li.name) || [];
      const serviceType = normalizeServiceType(jobTypeName + ' ' + lineItemNames.join(' '));

      entry.jobs.push({
        jobId: job.id,
        clientId,
        propertyId: job.property?.id,
        serviceType,
        completedAt: new Date(job.completedAt),
        totalAmount: job.amounts?.total ? Math.round(job.amounts.total * 100) : undefined,
      });
    }

    summary.totalClientsScanned = clientJobsMap.size;
    console.log(`[Upsell] Processing ${clientJobsMap.size} unique clients`);

    const clientEntries = Array.from(clientJobsMap.entries());
    for (const [clientId, clientData] of clientEntries) {
      const result: UpsellScanResult = {
        clientId,
        clientName: clientData.clientName,
        offers: [],
      };

      try {
        if (!isOptedIn(clientData.clientCustomFields)) {
          result.skipped = 'Client not opted in for upsell';
          summary.results.push(result);
          continue;
        }

        summary.eligibleClients++;

        const lotSize = extractLotSize(clientData.propertyCustomFields) || 
                       extractLotSize(clientData.clientCustomFields);
        const previousOffers = extractPreviousOffers(clientData.clientCustomFields);

        const profile: ClientProfile = {
          clientId,
          propertyId: clientData.propertyId,
          lotSizeSqFt: lotSize,
          recentJobs: clientData.jobs,
          upsellOptIn: true,
          previousOffers,
        };

        const offers = findMatchingOffers(profile, fullConfig);
        result.offers = offers;

        if (offers.length > 0) {
          summary.offersGenerated += offers.length;
          
          const topOffer = offers[0];
          const lineItems = generateQuoteLineItems(topOffer.offer, lotSize || 10000);

          try {
            const quoteResult = await client.createQuote({
              clientId,
              propertyId: clientData.propertyId,
              title: `${topOffer.offer.name} - ${getCurrentSeason().charAt(0).toUpperCase() + getCurrentSeason().slice(1)} Recommendation`,
              message: topOffer.reason,
              lineItems,
            });

            if (quoteResult.quoteCreate.userErrors?.length > 0) {
              result.error = `Quote creation errors: ${quoteResult.quoteCreate.userErrors.map(e => e.message).join(', ')}`;
              summary.errors++;
            } else if (quoteResult.quoteCreate.quote) {
              result.quoteCreated = {
                quoteId: quoteResult.quoteCreate.quote.id,
                quoteNumber: quoteResult.quoteCreate.quote.quoteNumber,
                total: Math.round((quoteResult.quoteCreate.quote.amounts?.total || 0) * 100),
              };
              summary.quotesCreated++;

              const updatedOffers = [...previousOffers, topOffer.offer.id].slice(-10);
              const updateResult = await client.updateClientCustomFieldByLabel(
                clientId, 
                LAWNFLOW_OFFER_ID_FIELD, 
                updatedOffers.join(',')
              );
              if (!updateResult.success) {
                console.warn(`[Upsell] Failed to update offer tracking field for ${clientId}: ${updateResult.error}`);
              }
            }
          } catch (quoteError: any) {
            result.error = `Quote creation failed: ${quoteError.message}`;
            summary.errors++;
          }
        }

        summary.results.push(result);

      } catch (clientError: any) {
        result.error = `Processing failed: ${clientError.message}`;
        summary.errors++;
        summary.results.push(result);
      }
    }

    console.log(`[Upsell] Scan complete: ${summary.eligibleClients} eligible, ${summary.quotesCreated} quotes created`);

  } catch (error: any) {
    console.error(`[Upsell] Scan failed:`, error);
    throw error;
  }

  return summary;
}

export async function previewUpsellOffers(
  accountId: string,
  clientId: string,
  lotSizeSqFt?: number
): Promise<RankedOffer[]> {
  const client = await getJobberClient(accountId);
  
  const clientData = await client.getClientWithCustomFields(clientId);
  if (!clientData.client) {
    throw new Error(`Client ${clientId} not found`);
  }

  const jobsResult = await client.getCompletedJobsForClient(clientId, 20);
  const jobs = jobsResult.client?.jobs?.nodes || [];

  const recentJobs: CompletedJob[] = jobs.map((job: any) => {
    const jobTypeName = job.jobType?.name || job.title || '';
    const lineItemNames = job.lineItems?.nodes?.map((li: any) => li.name) || [];
    const serviceType = normalizeServiceType(jobTypeName + ' ' + lineItemNames.join(' '));

    return {
      jobId: job.id,
      clientId,
      propertyId: job.property?.id,
      serviceType,
      completedAt: new Date(job.completedAt),
      totalAmount: job.amounts?.total ? Math.round(job.amounts.total * 100) : undefined,
    };
  });

  const previousOffers = extractPreviousOffers(clientData.client.customFields?.nodes);

  const profile: ClientProfile = {
    clientId,
    lotSizeSqFt: lotSizeSqFt || extractLotSize(clientData.client.customFields?.nodes),
    recentJobs,
    upsellOptIn: true,
    previousOffers,
  };

  return findMatchingOffers(profile);
}

export async function getJobberAccountForBusiness(businessId: number): Promise<string | null> {
  const accounts = await db
    .select()
    .from(jobberAccounts)
    .where(eq(jobberAccounts.businessId, businessId))
    .limit(1);

  return accounts[0]?.jobberAccountId || null;
}

export { UPSELL_OPT_IN_FIELD, LAWNFLOW_OFFER_ID_FIELD };
