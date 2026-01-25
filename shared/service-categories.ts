/**
 * Service Categories for LawnFlow Onboarding
 * 
 * Category-first approach to reduce onboarding fatigue.
 * Users enable categories during onboarding, then refine to subtypes later.
 */

export const ServiceCategories = [
  "LAWN_MAINTENANCE",
  "LAWN_TREATMENTS",
  "CLEANUP_SEASONAL",
  "MULCH_PLANT_BEDS",
  "PLANTING_GARDEN_REFRESH",
  "SHRUB_TREE_CARE",
  "HARDSCAPING",
  "IRRIGATION_DRAINAGE",
  "PRESSURE_WASHING",
  "SNOW_ICE",
  "SPECIALTY_OTHER",
] as const;

export type ServiceCategory = typeof ServiceCategories[number];

export interface ServiceCategoryDefinition {
  id: ServiceCategory;
  name: string;
  description: string;
  subtypes: string[];
  defaultPricingMin: number; // in cents
  defaultPricingMax: number; // in cents
  defaultDurationMinutes: number;
  requiresApproval: boolean;
  seasonalityFlags?: string[]; // "spring", "summer", "fall", "winter"
  geographyRestricted?: boolean; // e.g., snow only in certain regions
}

export const SERVICE_CATEGORY_DEFINITIONS: Record<ServiceCategory, ServiceCategoryDefinition> = {
  LAWN_MAINTENANCE: {
    id: "LAWN_MAINTENANCE",
    name: "Lawn Maintenance",
    description: "Regular mowing, edging, and basic lawn care",
    subtypes: [
      "Mowing",
      "Edging",
      "Trimming",
      "Blowing/Cleanup",
      "Line Trimming",
      "String Trimming",
    ],
    defaultPricingMin: 3500, // $35
    defaultPricingMax: 8000, // $80
    defaultDurationMinutes: 45,
    requiresApproval: false,
    seasonalityFlags: ["spring", "summer", "fall"],
  },
  LAWN_TREATMENTS: {
    id: "LAWN_TREATMENTS",
    name: "Lawn Treatments",
    description: "Fertilization, weed control, and lawn health treatments",
    subtypes: [
      "Fertilization",
      "Weed Control",
      "Pre-Emergent",
      "Post-Emergent",
      "Grub Control",
      "Aeration",
      "Overseeding",
      "Lime Application",
    ],
    defaultPricingMin: 5000, // $50
    defaultPricingMax: 15000, // $150
    defaultDurationMinutes: 30,
    requiresApproval: true,
    seasonalityFlags: ["spring", "summer", "fall"],
  },
  CLEANUP_SEASONAL: {
    id: "CLEANUP_SEASONAL",
    name: "Cleanup & Seasonal",
    description: "Spring cleanups, fall leaf removal, and seasonal maintenance",
    subtypes: [
      "Spring Cleanup",
      "Fall Cleanup",
      "Leaf Removal",
      "Debris Removal",
      "Gutter Cleaning",
      "Bed Cleanup",
    ],
    defaultPricingMin: 10000, // $100
    defaultPricingMax: 40000, // $400
    defaultDurationMinutes: 180,
    requiresApproval: true,
    seasonalityFlags: ["spring", "fall"],
  },
  MULCH_PLANT_BEDS: {
    id: "MULCH_PLANT_BEDS",
    name: "Mulch & Plant Beds",
    description: "Mulch installation, bed edging, and bed maintenance",
    subtypes: [
      "Mulch Installation",
      "Mulch Refresh",
      "Bed Edging",
      "Bed Weeding",
      "Bed Preparation",
      "Rock/Stone Installation",
    ],
    defaultPricingMin: 15000, // $150
    defaultPricingMax: 60000, // $600
    defaultDurationMinutes: 240,
    requiresApproval: true,
    seasonalityFlags: ["spring", "summer"],
  },
  PLANTING_GARDEN_REFRESH: {
    id: "PLANTING_GARDEN_REFRESH",
    name: "Planting & Garden Refresh",
    description: "Annual planting, perennial installation, and garden design",
    subtypes: [
      "Annual Planting",
      "Perennial Installation",
      "Container Planting",
      "Garden Design",
      "Seasonal Color",
      "Bulb Planting",
    ],
    defaultPricingMin: 20000, // $200
    defaultPricingMax: 100000, // $1000
    defaultDurationMinutes: 180,
    requiresApproval: true,
    seasonalityFlags: ["spring", "fall"],
  },
  SHRUB_TREE_CARE: {
    id: "SHRUB_TREE_CARE",
    name: "Shrub & Tree Care",
    description: "Pruning, trimming, and ornamental tree/shrub maintenance",
    subtypes: [
      "Shrub Pruning",
      "Shrub Trimming",
      "Tree Pruning",
      "Hedge Trimming",
      "Tree Removal (small)",
      "Stump Grinding",
    ],
    defaultPricingMin: 15000, // $150
    defaultPricingMax: 75000, // $750
    defaultDurationMinutes: 120,
    requiresApproval: true,
    seasonalityFlags: ["spring", "summer", "fall"],
  },
  HARDSCAPING: {
    id: "HARDSCAPING",
    name: "Hardscaping",
    description: "Patios, walkways, retaining walls, and hardscape features",
    subtypes: [
      "Patio Installation",
      "Walkway Installation",
      "Retaining Wall",
      "Stone Work",
      "Paver Installation",
      "Concrete Work",
    ],
    defaultPricingMin: 100000, // $1000
    defaultPricingMax: 1000000, // $10,000
    defaultDurationMinutes: 480,
    requiresApproval: true,
  },
  IRRIGATION_DRAINAGE: {
    id: "IRRIGATION_DRAINAGE",
    name: "Irrigation & Drainage",
    description: "Sprinkler systems, drainage solutions, and water management",
    subtypes: [
      "Sprinkler Installation",
      "Sprinkler Repair",
      "System Winterization",
      "Spring Startup",
      "Drainage Installation",
      "French Drain",
    ],
    defaultPricingMin: 10000, // $100
    defaultPricingMax: 200000, // $2000
    defaultDurationMinutes: 180,
    requiresApproval: true,
    seasonalityFlags: ["spring", "summer", "fall"],
  },
  PRESSURE_WASHING: {
    id: "PRESSURE_WASHING",
    name: "Pressure Washing",
    description: "House washing, driveway cleaning, and surface cleaning",
    subtypes: [
      "House Washing",
      "Driveway Cleaning",
      "Patio Cleaning",
      "Deck Cleaning",
      "Fence Cleaning",
      "Concrete Cleaning",
    ],
    defaultPricingMin: 15000, // $150
    defaultPricingMax: 50000, // $500
    defaultDurationMinutes: 120,
    requiresApproval: true,
    seasonalityFlags: ["spring", "summer", "fall"],
  },
  SNOW_ICE: {
    id: "SNOW_ICE",
    name: "Snow & Ice Management",
    description: "Snow plowing, shoveling, and ice management",
    subtypes: [
      "Snow Plowing",
      "Snow Shoveling",
      "Ice Management",
      "Salt/Sand Application",
      "Roof Snow Removal",
    ],
    defaultPricingMin: 5000, // $50
    defaultPricingMax: 30000, // $300
    defaultDurationMinutes: 60,
    requiresApproval: true,
    seasonalityFlags: ["winter"],
    geographyRestricted: true,
  },
  SPECIALTY_OTHER: {
    id: "SPECIALTY_OTHER",
    name: "Specialty / Other",
    description: "Custom services and specialty work",
    subtypes: [
      "Custom Service",
      "Specialty Work",
      "Consultation",
      "Property Assessment",
    ],
    defaultPricingMin: 10000, // $100
    defaultPricingMax: 100000, // $1000
    defaultDurationMinutes: 120,
    requiresApproval: true,
  },
};

/**
 * Check if a service category is available in a given region
 */
export function isCategoryAvailableInRegion(
  category: ServiceCategory,
  hasSnowRisk: boolean
): boolean {
  const def = SERVICE_CATEGORY_DEFINITIONS[category];
  
  // Snow services only available in snow-risk regions
  if (category === "SNOW_ICE" && !hasSnowRisk) {
    return false;
  }
  
  return true;
}

/**
 * Get categories available for a given season
 */
export function getCategoriesForSeason(season: "spring" | "summer" | "fall" | "winter"): ServiceCategory[] {
  return ServiceCategories.filter(cat => {
    const def = SERVICE_CATEGORY_DEFINITIONS[cat];
    return !def.seasonalityFlags || def.seasonalityFlags.includes(season);
  });
}

/**
 * Map old service type strings to new category IDs
 */
export function mapLegacyServiceToCategory(legacyService: string): ServiceCategory {
  const lower = legacyService.toLowerCase();
  
  if (lower.includes("mow") || lower.includes("lawn maintenance")) {
    return "LAWN_MAINTENANCE";
  }
  if (lower.includes("treatment") || lower.includes("fertiliz") || lower.includes("weed")) {
    return "LAWN_TREATMENTS";
  }
  if (lower.includes("cleanup") || lower.includes("leaf")) {
    return "CLEANUP_SEASONAL";
  }
  if (lower.includes("mulch") || lower.includes("bed")) {
    return "MULCH_PLANT_BEDS";
  }
  if (lower.includes("plant") || lower.includes("garden")) {
    return "PLANTING_GARDEN_REFRESH";
  }
  if (lower.includes("shrub") || lower.includes("tree") || lower.includes("prune")) {
    return "SHRUB_TREE_CARE";
  }
  if (lower.includes("hardscap") || lower.includes("patio") || lower.includes("walkway")) {
    return "HARDSCAPING";
  }
  if (lower.includes("irrigation") || lower.includes("sprinkler") || lower.includes("drain")) {
    return "IRRIGATION_DRAINAGE";
  }
  if (lower.includes("pressure") || lower.includes("wash")) {
    return "PRESSURE_WASHING";
  }
  if (lower.includes("snow") || lower.includes("ice") || lower.includes("plow")) {
    return "SNOW_ICE";
  }
  
  return "SPECIALTY_OTHER";
}
