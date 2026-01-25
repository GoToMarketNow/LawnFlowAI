import { z } from "zod";
import { AreaBands, type AreaBandKey } from "@shared/schema";

export const complexityLevelSchema = z.enum(["none", "few", "many", "unknown"]);
export const slopeLevelSchema = z.enum(["flat", "moderate", "steep", "unknown"]);
export const accessLevelSchema = z.enum(["easy", "moderate", "difficult", "unknown"]);
export const frequencySchema = z.enum(["weekly", "biweekly", "monthly", "one_time"]);
export const serviceTypeSchema = z.enum(["mowing", "cleanup", "mulch", "landscaping", "irrigation", "trimming", "other"]);

export type ComplexityLevel = z.infer<typeof complexityLevelSchema>;
export type SlopeLevel = z.infer<typeof slopeLevelSchema>;
export type AccessLevel = z.infer<typeof accessLevelSchema>;
export type Frequency = z.infer<typeof frequencySchema>;
export type ServiceType = z.infer<typeof serviceTypeSchema>;

export interface QuoteCalculatorInput {
  services: ServiceType[];
  frequency: Frequency;
  areaBand: AreaBandKey;
  complexityTrees: ComplexityLevel;
  complexityShrubs: ComplexityLevel;
  complexityBeds: ComplexityLevel;
  complexitySlope: SlopeLevel;
  complexityAccess: AccessLevel;
}

export interface PricingConfig {
  minimumPrice: number;
  hourlyRate: number;
  baseMinutesPerService: Record<ServiceType, Record<AreaBandKey, number>>;
  frequencyMultipliers: Record<Frequency, { low: number; high: number }>;
  complexityMultipliers: {
    trees: Record<ComplexityLevel, number>;
    shrubs: Record<ComplexityLevel, number>;
    beds: Record<ComplexityLevel, number>;
    slope: Record<SlopeLevel, number>;
    access: Record<AccessLevel, number>;
  };
}

export interface LineItem {
  name: string;
  qty: number;
  unit: string;
  unitPriceUsd: number;
  totalUsd: number;
}

export interface QuoteCalculatorResult {
  low: number;
  high: number;
  lineItems: LineItem[];
  confidence: "high" | "medium" | "low";
  assumptions: string[];
  minutesLow: number;
  minutesHigh: number;
}

const DEFAULT_PRICING_CONFIG: PricingConfig = {
  minimumPrice: 50,
  hourlyRate: 60,
  
  baseMinutesPerService: {
    mowing: {
      xs: 15,
      small: 25,
      medium: 40,
      large: 60,
      xl: 90,
      xxl: 150,
    },
    cleanup: {
      xs: 30,
      small: 45,
      medium: 75,
      large: 120,
      xl: 180,
      xxl: 300,
    },
    mulch: {
      xs: 45,
      small: 75,
      medium: 120,
      large: 180,
      xl: 270,
      xxl: 420,
    },
    landscaping: {
      xs: 120,
      small: 180,
      medium: 300,
      large: 480,
      xl: 720,
      xxl: 1200,
    },
    irrigation: {
      xs: 60,
      small: 90,
      medium: 120,
      large: 180,
      xl: 240,
      xxl: 360,
    },
    trimming: {
      xs: 20,
      small: 30,
      medium: 45,
      large: 75,
      xl: 105,
      xxl: 150,
    },
    other: {
      xs: 30,
      small: 45,
      medium: 60,
      large: 90,
      xl: 120,
      xxl: 180,
    },
  },
  
  frequencyMultipliers: {
    weekly: { low: 0.9, high: 1.0 },
    biweekly: { low: 1.15, high: 1.35 },
    monthly: { low: 1.5, high: 2.0 },
    one_time: { low: 1.2, high: 1.5 },
  },
  
  complexityMultipliers: {
    trees: {
      none: 1.0,
      few: 1.1,
      many: 1.3,
      unknown: 1.15,
    },
    shrubs: {
      none: 1.0,
      few: 1.08,
      many: 1.2,
      unknown: 1.1,
    },
    beds: {
      none: 1.0,
      few: 1.05,
      many: 1.2,
      unknown: 1.1,
    },
    slope: {
      flat: 1.0,
      moderate: 1.1,
      steep: 1.25,
      unknown: 1.1,
    },
    access: {
      easy: 1.0,
      moderate: 1.05,
      difficult: 1.15,
      unknown: 1.05,
    },
  },
};

function countUnknowns(input: QuoteCalculatorInput): number {
  let count = 0;
  if (input.complexityTrees === "unknown") count++;
  if (input.complexityShrubs === "unknown") count++;
  if (input.complexityBeds === "unknown") count++;
  if (input.complexitySlope === "unknown") count++;
  if (input.complexityAccess === "unknown") count++;
  return count;
}

function isHighVarianceService(services: ServiceType[]): boolean {
  const highVarianceServices: ServiceType[] = ["cleanup", "mulch", "landscaping"];
  return services.some(s => highVarianceServices.includes(s));
}

export function calculateQuoteRange(
  input: QuoteCalculatorInput,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): QuoteCalculatorResult {
  const assumptions: string[] = [];
  let totalMinutesLow = 0;
  let totalMinutesHigh = 0;
  const lineItems: LineItem[] = [];
  
  const treeMult = config.complexityMultipliers.trees[input.complexityTrees];
  const shrubMult = config.complexityMultipliers.shrubs[input.complexityShrubs];
  const bedMult = config.complexityMultipliers.beds[input.complexityBeds];
  const slopeMult = config.complexityMultipliers.slope[input.complexitySlope];
  const accessMult = config.complexityMultipliers.access[input.complexityAccess];
  
  const complexityMult = treeMult * shrubMult * bedMult * slopeMult * accessMult;
  
  const freqMult = config.frequencyMultipliers[input.frequency];
  
  for (const service of input.services) {
    const baseMinutes = config.baseMinutesPerService[service][input.areaBand];
    
    const adjustedMinutesLow = baseMinutes * complexityMult * freqMult.low;
    const adjustedMinutesHigh = baseMinutes * complexityMult * freqMult.high;
    
    totalMinutesLow += adjustedMinutesLow;
    totalMinutesHigh += adjustedMinutesHigh;
    
    const hoursLow = adjustedMinutesLow / 60;
    const hoursHigh = adjustedMinutesHigh / 60;
    const priceLow = hoursLow * config.hourlyRate;
    const priceHigh = hoursHigh * config.hourlyRate;
    
    const bandLabel = AreaBands[input.areaBand].label;
    lineItems.push({
      name: `${service.charAt(0).toUpperCase() + service.slice(1)} - ${bandLabel}`,
      qty: 1,
      unit: "visit",
      unitPriceUsd: Math.round(((priceLow + priceHigh) / 2) * 100) / 100,
      totalUsd: Math.round(((priceLow + priceHigh) / 2) * 100) / 100,
    });
  }
  
  const hoursLow = totalMinutesLow / 60;
  const hoursHigh = totalMinutesHigh / 60;
  let priceLow = hoursLow * config.hourlyRate;
  let priceHigh = hoursHigh * config.hourlyRate;
  
  priceLow = Math.max(priceLow, config.minimumPrice);
  priceHigh = Math.max(priceHigh, config.minimumPrice);
  
  const unknownCount = countUnknowns(input);
  const hasHighVariance = isHighVarianceService(input.services);
  
  let confidence: "high" | "medium" | "low";
  
  if (unknownCount <= 1 && !hasHighVariance) {
    confidence = "high";
  } else if (unknownCount <= 3 && !hasHighVariance) {
    confidence = "medium";
    priceHigh *= 1.1;
    assumptions.push("Range widened due to incomplete property data");
  } else {
    confidence = "low";
    priceHigh *= 1.3;
    priceLow *= 0.9;
    assumptions.push("Wide range due to unknown complexity factors");
    if (hasHighVariance) {
      assumptions.push("Service type has high pricing variance - photos recommended");
    }
  }
  
  if (input.complexityTrees === "unknown") {
    assumptions.push("Tree count unknown - assumed average");
  }
  if (input.complexityShrubs === "unknown") {
    assumptions.push("Shrub density unknown - assumed average");
  }
  if (input.complexityBeds === "unknown") {
    assumptions.push("Garden bed presence unknown - assumed some");
  }
  if (input.complexitySlope === "unknown") {
    assumptions.push("Terrain slope unknown - assumed moderate");
  }
  if (input.complexityAccess === "unknown") {
    assumptions.push("Property access unknown - assumed standard");
  }
  
  if (input.frequency === "one_time") {
    assumptions.push("One-time service pricing (no recurring discount)");
  }
  
  return {
    low: Math.round(priceLow * 100) / 100,
    high: Math.round(priceHigh * 100) / 100,
    lineItems,
    confidence,
    assumptions,
    minutesLow: Math.round(totalMinutesLow),
    minutesHigh: Math.round(totalMinutesHigh),
  };
}

export function getDefaultPricingConfig(): PricingConfig {
  return { ...DEFAULT_PRICING_CONFIG };
}

export const quoteCalculator = {
  calculateQuoteRange,
  getDefaultPricingConfig,
};