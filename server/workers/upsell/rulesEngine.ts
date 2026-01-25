import {
  OFFER_CATALOG,
  Offer,
  Season,
  LotSizeTier,
  ServiceType,
  getCurrentSeason,
  getLotSizeTier,
  LOT_SIZE_TIERS,
} from './offerCatalog';

export interface CompletedJob {
  jobId: string;
  clientId: string;
  propertyId?: string;
  serviceType: ServiceType;
  completedAt: Date;
  totalAmount?: number;
}

export interface ClientProfile {
  clientId: string;
  propertyId?: string;
  lotSizeSqFt?: number;
  recentJobs: CompletedJob[];
  upsellOptIn: boolean;
  previousOffers?: string[];
}

export interface RankedOffer {
  offer: Offer;
  score: number;
  computedPrice: number;
  reason: string;
  triggeredBy: CompletedJob;
}

export interface UpsellRulesConfig {
  maxDaysLookback: number;
  maxOffersPerClient: number;
  minDaysBetweenOffers: number;
  excludeRecentOfferIds?: string[];
}

const DEFAULT_CONFIG: UpsellRulesConfig = {
  maxDaysLookback: 60,
  maxOffersPerClient: 3,
  minDaysBetweenOffers: 14,
};

export function computeOfferPrice(offer: Offer, lotSizeSqFt: number): number {
  let price = offer.basePrice;
  
  if (offer.pricePerSqFt && lotSizeSqFt > 0) {
    price += Math.round(offer.pricePerSqFt * lotSizeSqFt);
  }
  
  return price;
}

function daysSince(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function normalizeServiceType(jobType: string): ServiceType {
  const normalized = jobType.toLowerCase().trim();
  
  const mappings: Record<string, ServiceType> = {
    'mow': 'mowing',
    'mowing': 'mowing',
    'lawn mowing': 'mowing',
    'lawn maintenance': 'mowing',
    'clean up': 'cleanup',
    'cleanup': 'cleanup',
    'spring cleanup': 'cleanup',
    'fall cleanup': 'cleanup',
    'mulch': 'mulch',
    'mulching': 'mulch',
    'landscape': 'landscaping',
    'landscaping': 'landscaping',
    'planting': 'landscaping',
    'irrigation': 'irrigation',
    'sprinkler': 'irrigation',
    'fertilizer': 'fertilization',
    'fertilization': 'fertilization',
    'fert': 'fertilization',
    'aerate': 'aeration',
    'aeration': 'aeration',
    'core aeration': 'aeration',
    'overseed': 'overseeding',
    'overseeding': 'overseeding',
    'seed': 'overseeding',
    'leaf': 'leaf_removal',
    'leaf removal': 'leaf_removal',
    'leaves': 'leaf_removal',
    'snow': 'snow_removal',
    'snow removal': 'snow_removal',
    'plow': 'snow_removal',
    'hardscape': 'hardscape',
    'patio': 'hardscape',
    'paver': 'hardscape',
    'retaining wall': 'hardscape',
  };
  
  for (const [key, value] of Object.entries(mappings)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  
  return 'landscaping';
}

export function findMatchingOffers(
  profile: ClientProfile,
  config: UpsellRulesConfig = DEFAULT_CONFIG
): RankedOffer[] {
  if (!profile.upsellOptIn) {
    return [];
  }

  const currentSeason = getCurrentSeason();
  const lotTier = profile.lotSizeSqFt ? getLotSizeTier(profile.lotSizeSqFt) : 'medium';
  const lotSqFt = profile.lotSizeSqFt || LOT_SIZE_TIERS[lotTier].maxSqFt;
  
  const eligibleJobs = profile.recentJobs.filter(job => {
    const daysAgo = daysSince(job.completedAt);
    return daysAgo <= config.maxDaysLookback;
  });

  if (eligibleJobs.length === 0) {
    return [];
  }

  const serviceTypesCompleted = new Set(eligibleJobs.map(j => j.serviceType));
  const recentlyOfferedIds = new Set(profile.previousOffers || []);
  const excludedIds = new Set(config.excludeRecentOfferIds || []);

  const rankedOffers: RankedOffer[] = [];

  for (const offer of OFFER_CATALOG) {
    if (recentlyOfferedIds.has(offer.id) || excludedIds.has(offer.id)) {
      continue;
    }

    if (!offer.applicableSeasons.includes(currentSeason)) {
      continue;
    }

    if (!offer.lotSizeTiers.includes(lotTier)) {
      continue;
    }

    const triggeringJob = eligibleJobs.find(job => {
      if (!offer.triggerServices.includes(job.serviceType)) {
        return false;
      }
      
      const daysAgo = daysSince(job.completedAt);
      return daysAgo >= offer.daysAfterCompletion.min && 
             daysAgo <= offer.daysAfterCompletion.max;
    });

    if (!triggeringJob) {
      continue;
    }

    if (serviceTypesCompleted.has(offer.serviceType)) {
      continue;
    }

    const computedPrice = computeOfferPrice(offer, lotSqFt);
    
    let score = offer.priority;
    
    const daysSinceJob = daysSince(triggeringJob.completedAt);
    const timelinessBonus = Math.max(0, 20 - daysSinceJob);
    score += timelinessBonus;
    
    if (offer.tags.includes('seasonal')) {
      score += 15;
    }
    if (offer.tags.includes('popular')) {
      score += 10;
    }
    
    const reason = `Based on your recent ${triggeringJob.serviceType.replace('_', ' ')} service, ` +
                   `we recommend ${offer.name} for the ${currentSeason} season.`;

    rankedOffers.push({
      offer,
      score,
      computedPrice,
      reason,
      triggeredBy: triggeringJob,
    });
  }

  rankedOffers.sort((a, b) => b.score - a.score);

  return rankedOffers.slice(0, config.maxOffersPerClient);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function generateQuoteLineItems(
  offer: Offer,
  lotSizeSqFt: number
): Array<{ name: string; description: string; quantity: number; unitPrice: number }> {
  const items: Array<{ name: string; description: string; quantity: number; unitPrice: number }> = [];
  
  items.push({
    name: offer.name,
    description: offer.description,
    quantity: 1,
    unitPrice: offer.basePrice,
  });
  
  if (offer.pricePerSqFt && lotSizeSqFt > 0) {
    const sqFtCharge = Math.round(offer.pricePerSqFt * lotSizeSqFt);
    if (sqFtCharge > 0) {
      items.push({
        name: `Lot Size Adjustment (${lotSizeSqFt.toLocaleString()} sq ft)`,
        description: `Additional charge based on property size`,
        quantity: 1,
        unitPrice: sqFtCharge,
      });
    }
  }
  
  return items;
}

export { normalizeServiceType };
