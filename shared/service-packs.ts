/**
 * Service Packs for LawnFlow Onboarding
 * 
 * Pre-configured service bundles that help users get started quickly.
 * Each pack includes multiple service categories with smart defaults.
 */

import { ServiceCategory, SERVICE_CATEGORY_DEFINITIONS } from "./service-categories";

export const ServicePackIds = [
  "STARTER_LAWN",
  "SEASONAL_CLEANUP",
  "LAWN_TREATMENTS",
  "GARDEN_BEDS",
  "SNOW_ICE",
  "HARDSCAPE_BASICS",
] as const;

export type ServicePackId = typeof ServicePackIds[number];

export interface ServicePack {
  id: ServicePackId;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  categories: ServiceCategory[];
  isRecommended: boolean;
  preselected: boolean;
  requiresSnowRisk?: boolean; // Only show in snow-risk regions
  targetCustomerType: "residential" | "commercial" | "both";
  estimatedMonthlyRevenue?: {
    min: number; // in cents
    max: number; // in cents
  };
}

export const SERVICE_PACKS: Record<ServicePackId, ServicePack> = {
  STARTER_LAWN: {
    id: "STARTER_LAWN",
    name: "⭐ Starter Lawn Pack",
    description: "Perfect for getting started with basic lawn care services",
    icon: "Grass",
    categories: [
      "LAWN_MAINTENANCE",
      "CLEANUP_SEASONAL",
    ],
    isRecommended: true,
    preselected: true,
    targetCustomerType: "both",
    estimatedMonthlyRevenue: {
      min: 150000, // $1,500
      max: 500000, // $5,000
    },
  },
  SEASONAL_CLEANUP: {
    id: "SEASONAL_CLEANUP",
    name: "Seasonal Cleanup Pack",
    description: "Spring cleanups, fall leaf removal, and seasonal services",
    icon: "Leaf",
    categories: [
      "CLEANUP_SEASONAL",
      "MULCH_PLANT_BEDS",
    ],
    isRecommended: true,
    preselected: false,
    targetCustomerType: "both",
    estimatedMonthlyRevenue: {
      min: 200000, // $2,000
      max: 800000, // $8,000
    },
  },
  LAWN_TREATMENTS: {
    id: "LAWN_TREATMENTS",
    name: "Lawn Treatments Pack",
    description: "Fertilization, weed control, and lawn health programs",
    icon: "Sprout",
    categories: [
      "LAWN_TREATMENTS",
      "LAWN_MAINTENANCE",
    ],
    isRecommended: true,
    preselected: false,
    targetCustomerType: "both",
    estimatedMonthlyRevenue: {
      min: 300000, // $3,000
      max: 1000000, // $10,000
    },
  },
  GARDEN_BEDS: {
    id: "GARDEN_BEDS",
    name: "Garden & Beds Pack",
    description: "Mulching, planting, and ornamental garden services",
    icon: "Flower2",
    categories: [
      "MULCH_PLANT_BEDS",
      "PLANTING_GARDEN_REFRESH",
      "SHRUB_TREE_CARE",
    ],
    isRecommended: false,
    preselected: false,
    targetCustomerType: "residential",
    estimatedMonthlyRevenue: {
      min: 250000, // $2,500
      max: 1500000, // $15,000
    },
  },
  SNOW_ICE: {
    id: "SNOW_ICE",
    name: "Snow & Ice Pack",
    description: "Winter snow removal and ice management services",
    icon: "Snowflake",
    categories: [
      "SNOW_ICE",
    ],
    isRecommended: true,
    preselected: false,
    requiresSnowRisk: true,
    targetCustomerType: "both",
    estimatedMonthlyRevenue: {
      min: 200000, // $2,000 (seasonal)
      max: 2000000, // $20,000 (seasonal)
    },
  },
  HARDSCAPE_BASICS: {
    id: "HARDSCAPE_BASICS",
    name: "Hardscape Basics Pack",
    description: "Patios, walkways, and pressure washing services",
    icon: "Square",
    categories: [
      "HARDSCAPING",
      "PRESSURE_WASHING",
    ],
    isRecommended: false,
    preselected: false,
    targetCustomerType: "both",
    estimatedMonthlyRevenue: {
      min: 500000, // $5,000
      max: 5000000, // $50,000
    },
  },
};

/**
 * Get service packs available for a business type and region
 */
export function getAvailablePacks(
  customerType: "residential" | "commercial" | "both",
  hasSnowRisk: boolean
): ServicePack[] {
  return ServicePackIds
    .map(id => SERVICE_PACKS[id])
    .filter(pack => {
      // Filter by customer type
      if (pack.targetCustomerType !== "both" && pack.targetCustomerType !== customerType) {
        return false;
      }
      
      // Filter by snow risk
      if (pack.requiresSnowRisk && !hasSnowRisk) {
        return false;
      }
      
      return true;
    });
}

/**
 * Get all unique categories from selected packs
 */
export function getCategoriesFromPacks(packIds: ServicePackId[]): ServiceCategory[] {
  const categories = new Set<ServiceCategory>();
  
  packIds.forEach(packId => {
    const pack = SERVICE_PACKS[packId];
    pack.categories.forEach(cat => categories.add(cat));
  });
  
  return Array.from(categories);
}

/**
 * Get recommended packs for a business type
 */
export function getRecommendedPacks(
  customerType: "residential" | "commercial" | "both",
  hasSnowRisk: boolean
): ServicePack[] {
  return getAvailablePacks(customerType, hasSnowRisk)
    .filter(pack => pack.isRecommended);
}

/**
 * Get default/preselected packs
 */
export function getPreselectedPacks(
  customerType: "residential" | "commercial" | "both",
  hasSnowRisk: boolean
): ServicePack[] {
  return getAvailablePacks(customerType, hasSnowRisk)
    .filter(pack => pack.preselected);
}

/**
 * Calculate estimated category counts for a pack selection
 */
export function getPackStatistics(packIds: ServicePackId[]): {
  totalCategories: number;
  totalSubtypes: number;
  requiresApproval: number;
  avgDurationMinutes: number;
} {
  const categories = getCategoriesFromPacks(packIds);
  
  let totalSubtypes = 0;
  let requiresApprovalCount = 0;
  let totalDuration = 0;
  
  categories.forEach(cat => {
    const def = SERVICE_CATEGORY_DEFINITIONS[cat];
    totalSubtypes += def.subtypes.length;
    if (def.requiresApproval) requiresApprovalCount++;
    totalDuration += def.defaultDurationMinutes;
  });
  
  return {
    totalCategories: categories.length,
    totalSubtypes,
    requiresApproval: requiresApprovalCount,
    avgDurationMinutes: categories.length > 0 ? Math.round(totalDuration / categories.length) : 0,
  };
}

/**
 * Generate service configuration from selected packs and categories
 */
export function generateServiceConfig(
  packIds: ServicePackId[],
  additionalCategories: ServiceCategory[] = []
): {
  category: ServiceCategory;
  enabled: true;
  abstractionLevel: "CATEGORY_ONLY";
  defaultPricingMin: number;
  defaultPricingMax: number;
  defaultDurationMinutes: number;
  requiresApproval: boolean;
}[] {
  const allCategories = [
    ...getCategoriesFromPacks(packIds),
    ...additionalCategories,
  ];
  
  // Deduplicate
  const uniqueCategories = Array.from(new Set(allCategories));
  
  return uniqueCategories.map(cat => {
    const def = SERVICE_CATEGORY_DEFINITIONS[cat];
    return {
      category: cat,
      enabled: true,
      abstractionLevel: "CATEGORY_ONLY" as const,
      defaultPricingMin: def.defaultPricingMin,
      defaultPricingMax: def.defaultPricingMax,
      defaultDurationMinutes: def.defaultDurationMinutes,
      requiresApproval: def.requiresApproval,
    };
  });
}
