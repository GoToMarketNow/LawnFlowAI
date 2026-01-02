import type { 
  PricingPolicy, 
  ServiceConfig, 
  PropertyTypeBandConfig, 
  PricingGuardrails,
  PropertyTypeBandType 
} from "@shared/schema";

export interface PropertySignals {
  lotAreaSqft: number;
  confidence: number; // 0-1
  propertyType?: PropertyTypeBandType;
  source: string; // e.g., "arcgis", "user_input", "estimated"
}

export interface ServiceRequest {
  serviceType: string;
  frequency?: string; // "one_time" | "weekly" | "biweekly" | "monthly"
  notes?: string;
}

export interface QuoteAssumption {
  key: string;
  value: string;
  reason: string;
}

export interface CalculationBreakdown {
  basePrice: number;
  propertyMultiplier: number;
  globalMultiplier: number;
  serviceMultipliers: Record<string, number>;
  adjustments: Array<{ name: string; amount: number; reason: string }>;
}

export interface QuoteRaterResult {
  rangeLow: number; // cents
  rangeHigh: number; // cents
  assumptions: QuoteAssumption[];
  calculationBreakdown: CalculationBreakdown;
  needsReview: boolean;
  reviewReasons: string[];
  propertyTypeBand: PropertyTypeBandType;
}

const DEFAULT_SERVICE_CONFIGS: Record<string, ServiceConfig> = {
  mowing: { enabled: true, minPrice: 3500, baseRate: 15, rateType: "per_sqft", multiplier: 1.0 },
  cleanup: { enabled: true, minPrice: 15000, baseRate: 25, rateType: "per_sqft", multiplier: 1.0 },
  mulch: { enabled: true, minPrice: 20000, baseRate: 8, rateType: "per_sqft", multiplier: 1.0 },
  landscaping: { enabled: true, minPrice: 50000, baseRate: 0, rateType: "flat", multiplier: 1.0 },
  irrigation: { enabled: true, minPrice: 10000, baseRate: 0, rateType: "flat", multiplier: 1.0 },
  fertilization: { enabled: true, minPrice: 5000, baseRate: 12, rateType: "per_sqft", multiplier: 1.0 },
  aeration: { enabled: true, minPrice: 7500, baseRate: 10, rateType: "per_sqft", multiplier: 1.0 },
  overseeding: { enabled: true, minPrice: 10000, baseRate: 15, rateType: "per_sqft", multiplier: 1.0 },
};

const DEFAULT_PROPERTY_TYPE_CONFIGS: Record<PropertyTypeBandType, PropertyTypeBandConfig> = {
  townhome: { minSqft: 0, maxSqft: 3000, baseMultiplier: 0.85 },
  small: { minSqft: 3001, maxSqft: 8000, baseMultiplier: 1.0 },
  medium: { minSqft: 8001, maxSqft: 15000, baseMultiplier: 1.15 },
  large: { minSqft: 15001, maxSqft: 43560, baseMultiplier: 1.3 },
  multi_acre: { minSqft: 43561, maxSqft: Infinity, baseMultiplier: 1.5 },
};

const DEFAULT_GUARDRAILS: PricingGuardrails = {
  floorPrice: 3500, // $35 minimum
  ceilingPrice: 500000, // $5,000 maximum
  lowConfidenceThreshold: 0.7,
  reviewAboveAmount: 100000, // $1,000 threshold
};

const GLOBAL_MULTIPLIERS: Record<string, number> = {
  aggressive: 0.85,
  balanced: 1.0,
  premium: 1.15,
};

const FREQUENCY_DISCOUNTS: Record<string, number> = {
  one_time: 1.0,
  monthly: 0.95,
  biweekly: 0.90,
  weekly: 0.85,
};

export function classifyPropertyType(
  lotAreaSqft: number,
  configs: Record<PropertyTypeBandType, PropertyTypeBandConfig>
): PropertyTypeBandType {
  for (const [band, config] of Object.entries(configs) as [PropertyTypeBandType, PropertyTypeBandConfig][]) {
    if (lotAreaSqft >= config.minSqft && lotAreaSqft <= config.maxSqft) {
      return band;
    }
  }
  return lotAreaSqft > 43560 ? "multi_acre" : "medium";
}

export function calculateQuote(
  policy: PricingPolicy | null,
  propertySignals: PropertySignals,
  servicesRequested: ServiceRequest[]
): QuoteRaterResult {
  const assumptions: QuoteAssumption[] = [];
  const reviewReasons: string[] = [];
  let needsReview = false;

  const serviceConfigs = {
    ...DEFAULT_SERVICE_CONFIGS,
    ...(policy?.serviceConfigs as Record<string, ServiceConfig> || {}),
  };
  
  const propertyTypeConfigs = {
    ...DEFAULT_PROPERTY_TYPE_CONFIGS,
    ...(policy?.propertyTypeConfigs as Record<PropertyTypeBandType, PropertyTypeBandConfig> || {}),
  };
  
  const guardrails = {
    ...DEFAULT_GUARDRAILS,
    ...(policy?.guardrails as PricingGuardrails || {}),
  };

  const globalPositioning = (policy?.globalPositioning || "balanced") as keyof typeof GLOBAL_MULTIPLIERS;
  const globalMultiplier = policy?.globalMultiplier || GLOBAL_MULTIPLIERS[globalPositioning] || 1.0;

  const propertyTypeBand = propertySignals.propertyType || 
    classifyPropertyType(propertySignals.lotAreaSqft, propertyTypeConfigs);
  
  const propertyConfig = propertyTypeConfigs[propertyTypeBand] || DEFAULT_PROPERTY_TYPE_CONFIGS.medium;
  const propertyMultiplier = propertyConfig.baseMultiplier;

  if (propertySignals.confidence < guardrails.lowConfidenceThreshold) {
    needsReview = true;
    reviewReasons.push(`Low lot size confidence (${(propertySignals.confidence * 100).toFixed(0)}%)`);
    assumptions.push({
      key: "lot_confidence",
      value: `${(propertySignals.confidence * 100).toFixed(0)}%`,
      reason: "Property data confidence is below threshold - manual verification recommended",
    });
  }

  if (propertySignals.source === "estimated") {
    assumptions.push({
      key: "lot_source",
      value: "estimated",
      reason: "Lot size was estimated based on property type averages",
    });
  }

  let totalBaseLow = 0;
  let totalBaseHigh = 0;
  const serviceMultipliers: Record<string, number> = {};
  const adjustments: Array<{ name: string; amount: number; reason: string }> = [];

  for (const service of servicesRequested) {
    const config = serviceConfigs[service.serviceType];
    if (!config || !config.enabled) {
      assumptions.push({
        key: `service_${service.serviceType}`,
        value: "unavailable",
        reason: `Service "${service.serviceType}" is not configured or enabled`,
      });
      continue;
    }

    let servicePrice: number;
    if (config.rateType === "per_sqft") {
      servicePrice = Math.max(
        config.minPrice,
        (propertySignals.lotAreaSqft / 1000) * config.baseRate
      );
    } else {
      servicePrice = config.minPrice;
    }

    const frequencyMultiplier = FREQUENCY_DISCOUNTS[service.frequency || "one_time"] || 1.0;
    servicePrice *= config.multiplier * frequencyMultiplier;

    serviceMultipliers[service.serviceType] = config.multiplier * frequencyMultiplier;
    
    totalBaseLow += servicePrice;
    totalBaseHigh += servicePrice;

    if (service.frequency && service.frequency !== "one_time") {
      adjustments.push({
        name: `${service.serviceType}_recurring_discount`,
        amount: -(servicePrice * (1 - frequencyMultiplier)),
        reason: `${service.frequency} recurring discount applied`,
      });
    }
  }

  let finalLow = totalBaseLow * propertyMultiplier * globalMultiplier;
  let finalHigh = totalBaseHigh * propertyMultiplier * globalMultiplier;

  const rangeVariance = 0.10;
  finalLow = Math.floor(finalLow * (1 - rangeVariance));
  finalHigh = Math.ceil(finalHigh * (1 + rangeVariance));

  finalLow = Math.max(guardrails.floorPrice, Math.min(finalLow, guardrails.ceilingPrice));
  finalHigh = Math.max(guardrails.floorPrice, Math.min(finalHigh, guardrails.ceilingPrice));

  if (finalLow === guardrails.floorPrice) {
    assumptions.push({
      key: "floor_applied",
      value: `$${(guardrails.floorPrice / 100).toFixed(2)}`,
      reason: "Quote was raised to meet minimum pricing floor",
    });
  }

  if (finalHigh === guardrails.ceilingPrice) {
    assumptions.push({
      key: "ceiling_applied",
      value: `$${(guardrails.ceilingPrice / 100).toFixed(2)}`,
      reason: "Quote was capped at maximum pricing ceiling",
    });
  }

  if (finalHigh > guardrails.reviewAboveAmount) {
    needsReview = true;
    reviewReasons.push(`Quote exceeds review threshold ($${(guardrails.reviewAboveAmount / 100).toFixed(2)})`);
  }

  const calculationBreakdown: CalculationBreakdown = {
    basePrice: totalBaseLow,
    propertyMultiplier,
    globalMultiplier,
    serviceMultipliers,
    adjustments,
  };

  return {
    rangeLow: Math.round(finalLow),
    rangeHigh: Math.round(finalHigh),
    assumptions,
    calculationBreakdown,
    needsReview,
    reviewReasons,
    propertyTypeBand,
  };
}

export function getDefaultPricingPolicy(): Partial<PricingPolicy> {
  return {
    name: "Default Policy",
    version: 1,
    isActive: true,
    globalPositioning: "balanced",
    globalMultiplier: 1.0,
    serviceConfigs: DEFAULT_SERVICE_CONFIGS,
    propertyTypeConfigs: DEFAULT_PROPERTY_TYPE_CONFIGS,
    guardrails: DEFAULT_GUARDRAILS,
  };
}

export function formatPriceRange(rangeLow: number, rangeHigh: number): string {
  const low = (rangeLow / 100).toFixed(0);
  const high = (rangeHigh / 100).toFixed(0);
  return `$${low} - $${high}`;
}
