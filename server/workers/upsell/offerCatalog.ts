export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type LotSizeTier = 'small' | 'medium' | 'large' | 'estate';
export type ServiceType = 
  | 'mowing' 
  | 'cleanup' 
  | 'mulch' 
  | 'landscaping' 
  | 'irrigation' 
  | 'fertilization'
  | 'aeration'
  | 'overseeding'
  | 'leaf_removal'
  | 'snow_removal'
  | 'hardscape';

export interface Offer {
  id: string;
  name: string;
  description: string;
  serviceType: ServiceType;
  applicableSeasons: Season[];
  lotSizeTiers: LotSizeTier[];
  basePrice: number;
  pricePerSqFt?: number;
  minLotSqFt?: number;
  maxLotSqFt?: number;
  priority: number;
  triggerServices: ServiceType[];
  daysAfterCompletion: { min: number; max: number };
  tags: string[];
}

export const LOT_SIZE_TIERS: Record<LotSizeTier, { minSqFt: number; maxSqFt: number }> = {
  small: { minSqFt: 0, maxSqFt: 5000 },
  medium: { minSqFt: 5001, maxSqFt: 15000 },
  large: { minSqFt: 15001, maxSqFt: 43560 },
  estate: { minSqFt: 43561, maxSqFt: Infinity },
};

export function getLotSizeTier(sqFt: number): LotSizeTier {
  if (sqFt <= 5000) return 'small';
  if (sqFt <= 15000) return 'medium';
  if (sqFt <= 43560) return 'large';
  return 'estate';
}

export function getCurrentSeason(): Season {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

export const OFFER_CATALOG: Offer[] = [
  {
    id: 'spring_cleanup_upsell',
    name: 'Spring Cleanup Package',
    description: 'Complete spring yard cleanup including debris removal, bed edging, and first mowing of the season.',
    serviceType: 'cleanup',
    applicableSeasons: ['spring'],
    lotSizeTiers: ['small', 'medium', 'large', 'estate'],
    basePrice: 15000,
    pricePerSqFt: 0.005,
    priority: 100,
    triggerServices: ['mowing'],
    daysAfterCompletion: { min: 7, max: 90 },
    tags: ['seasonal', 'popular'],
  },
  {
    id: 'fall_cleanup_upsell',
    name: 'Fall Cleanup Package',
    description: 'Comprehensive fall cleanup with leaf removal, bed preparation, and winterization.',
    serviceType: 'leaf_removal',
    applicableSeasons: ['fall'],
    lotSizeTiers: ['small', 'medium', 'large', 'estate'],
    basePrice: 17500,
    pricePerSqFt: 0.006,
    priority: 100,
    triggerServices: ['mowing', 'cleanup'],
    daysAfterCompletion: { min: 7, max: 60 },
    tags: ['seasonal', 'popular'],
  },
  {
    id: 'mulching_spring',
    name: 'Spring Mulch Refresh',
    description: 'Fresh mulch application to all beds for weed suppression and moisture retention.',
    serviceType: 'mulch',
    applicableSeasons: ['spring'],
    lotSizeTiers: ['small', 'medium', 'large', 'estate'],
    basePrice: 20000,
    pricePerSqFt: 0.008,
    priority: 90,
    triggerServices: ['cleanup', 'landscaping'],
    daysAfterCompletion: { min: 14, max: 120 },
    tags: ['enhancement'],
  },
  {
    id: 'mulching_fall',
    name: 'Fall Mulch Refresh',
    description: 'Protective mulch application before winter to insulate plants and prevent frost heaving.',
    serviceType: 'mulch',
    applicableSeasons: ['fall'],
    lotSizeTiers: ['small', 'medium', 'large', 'estate'],
    basePrice: 20000,
    pricePerSqFt: 0.008,
    priority: 85,
    triggerServices: ['cleanup', 'leaf_removal'],
    daysAfterCompletion: { min: 7, max: 60 },
    tags: ['enhancement', 'winterization'],
  },
  {
    id: 'aeration_spring',
    name: 'Spring Core Aeration',
    description: 'Core aeration to relieve soil compaction and promote healthy root growth.',
    serviceType: 'aeration',
    applicableSeasons: ['spring'],
    lotSizeTiers: ['medium', 'large', 'estate'],
    basePrice: 12500,
    pricePerSqFt: 0.004,
    priority: 80,
    triggerServices: ['mowing', 'fertilization'],
    daysAfterCompletion: { min: 30, max: 365 },
    tags: ['lawn_health'],
  },
  {
    id: 'aeration_fall',
    name: 'Fall Core Aeration',
    description: 'Fall aeration for optimal recovery and preparation for winter dormancy.',
    serviceType: 'aeration',
    applicableSeasons: ['fall'],
    lotSizeTiers: ['medium', 'large', 'estate'],
    basePrice: 12500,
    pricePerSqFt: 0.004,
    priority: 85,
    triggerServices: ['mowing'],
    daysAfterCompletion: { min: 30, max: 365 },
    tags: ['lawn_health', 'popular'],
  },
  {
    id: 'overseeding_fall',
    name: 'Fall Overseeding',
    description: 'Overseeding with premium grass seed blend to thicken lawn and fill bare spots.',
    serviceType: 'overseeding',
    applicableSeasons: ['fall'],
    lotSizeTiers: ['small', 'medium', 'large', 'estate'],
    basePrice: 15000,
    pricePerSqFt: 0.005,
    priority: 75,
    triggerServices: ['aeration', 'mowing'],
    daysAfterCompletion: { min: 0, max: 30 },
    tags: ['lawn_health'],
  },
  {
    id: 'fertilization_spring',
    name: 'Spring Fertilization',
    description: 'Balanced spring fertilizer application for lush green growth.',
    serviceType: 'fertilization',
    applicableSeasons: ['spring'],
    lotSizeTiers: ['small', 'medium', 'large', 'estate'],
    basePrice: 7500,
    pricePerSqFt: 0.002,
    priority: 70,
    triggerServices: ['mowing', 'aeration'],
    daysAfterCompletion: { min: 14, max: 90 },
    tags: ['lawn_health'],
  },
  {
    id: 'fertilization_fall',
    name: 'Fall Winterizer',
    description: 'Winterizer fertilizer to strengthen roots and prepare lawn for winter.',
    serviceType: 'fertilization',
    applicableSeasons: ['fall'],
    lotSizeTiers: ['small', 'medium', 'large', 'estate'],
    basePrice: 8500,
    pricePerSqFt: 0.002,
    priority: 75,
    triggerServices: ['mowing', 'aeration'],
    daysAfterCompletion: { min: 14, max: 90 },
    tags: ['lawn_health', 'winterization'],
  },
  {
    id: 'irrigation_spring_startup',
    name: 'Irrigation System Startup',
    description: 'Spring startup and inspection of irrigation system including head adjustment and leak check.',
    serviceType: 'irrigation',
    applicableSeasons: ['spring'],
    lotSizeTiers: ['small', 'medium', 'large', 'estate'],
    basePrice: 12500,
    priority: 95,
    triggerServices: ['mowing', 'cleanup', 'irrigation'],
    daysAfterCompletion: { min: 150, max: 400 },
    tags: ['maintenance', 'seasonal'],
  },
  {
    id: 'irrigation_winterization',
    name: 'Irrigation Winterization',
    description: 'Complete blowout and winterization of irrigation system to prevent freeze damage.',
    serviceType: 'irrigation',
    applicableSeasons: ['fall'],
    lotSizeTiers: ['small', 'medium', 'large', 'estate'],
    basePrice: 9500,
    priority: 100,
    triggerServices: ['mowing', 'irrigation'],
    daysAfterCompletion: { min: 150, max: 400 },
    tags: ['maintenance', 'seasonal', 'popular'],
  },
  {
    id: 'snow_removal_contract',
    name: 'Snow Removal Season Contract',
    description: 'Priority snow removal service for the winter season. Per-visit or seasonal contract available.',
    serviceType: 'snow_removal',
    applicableSeasons: ['fall', 'winter'],
    lotSizeTiers: ['small', 'medium', 'large', 'estate'],
    basePrice: 50000,
    priority: 90,
    triggerServices: ['mowing', 'cleanup', 'irrigation'],
    daysAfterCompletion: { min: 30, max: 180 },
    tags: ['seasonal', 'contract'],
  },
  {
    id: 'mowing_recurring',
    name: 'Weekly Mowing Service',
    description: 'Recurring weekly mowing service including edging and blowing.',
    serviceType: 'mowing',
    applicableSeasons: ['spring', 'summer', 'fall'],
    lotSizeTiers: ['small', 'medium', 'large', 'estate'],
    basePrice: 4500,
    pricePerSqFt: 0.001,
    priority: 60,
    triggerServices: ['cleanup', 'landscaping'],
    daysAfterCompletion: { min: 7, max: 60 },
    tags: ['recurring', 'core'],
  },
  {
    id: 'hardscape_patio',
    name: 'Patio Installation',
    description: 'Custom paver patio design and installation. Free consultation and 3D design included.',
    serviceType: 'hardscape',
    applicableSeasons: ['spring', 'summer', 'fall'],
    lotSizeTiers: ['medium', 'large', 'estate'],
    basePrice: 500000,
    priority: 50,
    triggerServices: ['landscaping', 'cleanup'],
    daysAfterCompletion: { min: 30, max: 365 },
    tags: ['premium', 'consultation'],
  },
  {
    id: 'landscaping_enhancement',
    name: 'Landscape Enhancement',
    description: 'Seasonal plantings and bed enhancements to refresh your property\'s curb appeal.',
    serviceType: 'landscaping',
    applicableSeasons: ['spring', 'fall'],
    lotSizeTiers: ['small', 'medium', 'large', 'estate'],
    basePrice: 35000,
    priority: 65,
    triggerServices: ['cleanup', 'mulch'],
    daysAfterCompletion: { min: 60, max: 365 },
    tags: ['enhancement'],
  },
];

export function getOfferById(id: string): Offer | undefined {
  return OFFER_CATALOG.find(o => o.id === id);
}

export function getOffersByServiceType(serviceType: ServiceType): Offer[] {
  return OFFER_CATALOG.filter(o => o.serviceType === serviceType);
}

export function getOffersBySeason(season: Season): Offer[] {
  return OFFER_CATALOG.filter(o => o.applicableSeasons.includes(season));
}
