/**
 * Seed script for Service Catalog MVP
 * Seeds 10 core services + 4 promotions for demo/testing
 * 
 * Run with: npx tsx server/seed-services.ts
 */
import { db } from "./db";
import { 
  services, 
  servicePricing, 
  serviceFrequencyOptions, 
  promotionRules, 
  snowServicePolicies 
} from "@shared/schema";

const ACCOUNT_ID = 1; // Default business account

async function seedServices() {
  console.log("[Seed] Starting service catalog seed...");

  // 1. Lawn Maintenance (Recurring)
  const [lawnMaintenance] = await db.insert(services).values({
    accountId: ACCOUNT_ID,
    name: "Lawn Maintenance",
    category: "LAWN",
    description: "Regular lawn care including mowing, edging, and blowing. Keeps your lawn looking great all season.",
    isActive: true,
    serviceType: "RECURRING",
    requiresManualQuote: false,
    defaultDurationMinutes: 45,
    requiresLeadTime: false,
    includesMaterials: false,
    requiresQualifiedCrew: false,
  }).returning();

  await db.insert(servicePricing).values({
    serviceId: lawnMaintenance.id,
    pricingModel: "RANGE",
    minPrice: 3500, // $35
    targetPrice: 5500, // $55
    maxPrice: 12500, // $125
    unitLabel: "per visit",
    appliesToFrequency: "BOTH",
    materialCostIncluded: false,
  });

  await db.insert(serviceFrequencyOptions).values([
    { serviceId: lawnMaintenance.id, frequency: "WEEKLY", priceModifierPercent: -10, isDefault: true },
    { serviceId: lawnMaintenance.id, frequency: "BIWEEKLY", priceModifierPercent: 0, isDefault: false },
    { serviceId: lawnMaintenance.id, frequency: "MONTHLY", priceModifierPercent: 10, isDefault: false },
  ]);

  console.log("[Seed] Created: Lawn Maintenance");

  // 2. One-Time Lawn Mowing
  const [oneTimeMowing] = await db.insert(services).values({
    accountId: ACCOUNT_ID,
    name: "One-Time Lawn Mowing",
    category: "LAWN",
    description: "Single visit lawn mowing service. Perfect for vacation coverage or one-time cleanups.",
    isActive: true,
    serviceType: "ONE_TIME",
    requiresManualQuote: false,
    defaultDurationMinutes: 60,
    requiresLeadTime: false,
    includesMaterials: false,
    requiresQualifiedCrew: false,
  }).returning();

  await db.insert(servicePricing).values({
    serviceId: oneTimeMowing.id,
    pricingModel: "RANGE",
    minPrice: 5000, // $50
    targetPrice: 7500, // $75
    maxPrice: 15000, // $150
    unitLabel: "per visit",
    appliesToFrequency: "ONE_TIME",
    materialCostIncluded: false,
  });

  console.log("[Seed] Created: One-Time Lawn Mowing");

  // 3. Tree & Brush Trimming
  const [treeTrimming] = await db.insert(services).values({
    accountId: ACCOUNT_ID,
    name: "Tree & Brush Trimming",
    category: "TREE",
    description: "Professional trimming of trees, shrubs, and hedges. Maintains shape and promotes healthy growth.",
    isActive: true,
    serviceType: "SEASONAL",
    requiresManualQuote: true,
    defaultDurationMinutes: 120,
    requiresLeadTime: true,
    defaultLeadTimeDays: 3,
    includesMaterials: false,
    requiresQualifiedCrew: true,
  }).returning();

  await db.insert(servicePricing).values({
    serviceId: treeTrimming.id,
    pricingModel: "RANGE",
    minPrice: 15000, // $150
    targetPrice: 30000, // $300
    maxPrice: 75000, // $750
    unitLabel: "per job",
    appliesToFrequency: "BOTH",
    materialCostIncluded: false,
  });

  console.log("[Seed] Created: Tree & Brush Trimming");

  // 4. Seasonal Cleanup
  const [seasonalCleanup] = await db.insert(services).values({
    accountId: ACCOUNT_ID,
    name: "Seasonal Cleanup",
    category: "CLEANUP",
    description: "Spring or fall cleanup including leaf removal, bed cleanup, and debris removal.",
    isActive: true,
    serviceType: "SEASONAL",
    requiresManualQuote: false,
    defaultDurationMinutes: 180,
    requiresLeadTime: true,
    defaultLeadTimeDays: 2,
    includesMaterials: false,
    requiresQualifiedCrew: false,
  }).returning();

  await db.insert(servicePricing).values({
    serviceId: seasonalCleanup.id,
    pricingModel: "RANGE",
    minPrice: 20000, // $200
    targetPrice: 35000, // $350
    maxPrice: 80000, // $800
    unitLabel: "per cleanup",
    appliesToFrequency: "SEASONAL",
    materialCostIncluded: false,
  });

  console.log("[Seed] Created: Seasonal Cleanup");

  // 5. Snow Removal (Rotation)
  const [snowRotation] = await db.insert(services).values({
    accountId: ACCOUNT_ID,
    name: "Snow Removal - Rotation",
    category: "SNOW",
    description: "Seasonal snow removal on rotation schedule. Automatic service when snowfall exceeds trigger amount.",
    isActive: true,
    serviceType: "SEASONAL",
    requiresManualQuote: false,
    defaultDurationMinutes: 30,
    requiresLeadTime: false,
    includesMaterials: true,
    requiresQualifiedCrew: false,
  }).returning();

  await db.insert(servicePricing).values({
    serviceId: snowRotation.id,
    pricingModel: "FLAT",
    minPrice: 4500, // $45
    targetPrice: 6500, // $65
    maxPrice: 12500, // $125
    unitLabel: "per push",
    appliesToFrequency: "SEASONAL",
    materialCostIncluded: true,
    materialCostEstimate: 500, // $5 for salt
  });

  await db.insert(snowServicePolicies).values({
    serviceId: snowRotation.id,
    mode: "ROTATION",
    priceModifierPercent: 0,
    priorityLevel: "NORMAL",
    notes: "Trigger at 2\" accumulation. Salt included.",
  });

  console.log("[Seed] Created: Snow Removal - Rotation");

  // 6. Snow Removal (On-Demand)
  const [snowOnDemand] = await db.insert(services).values({
    accountId: ACCOUNT_ID,
    name: "Snow Removal - On Demand",
    category: "SNOW",
    description: "On-demand snow removal by request. Premium pricing for priority service.",
    isActive: true,
    serviceType: "EVENT_BASED",
    requiresManualQuote: false,
    defaultDurationMinutes: 30,
    requiresLeadTime: false,
    includesMaterials: true,
    requiresQualifiedCrew: false,
  }).returning();

  await db.insert(servicePricing).values({
    serviceId: snowOnDemand.id,
    pricingModel: "FLAT",
    minPrice: 7500, // $75
    targetPrice: 9500, // $95
    maxPrice: 17500, // $175
    unitLabel: "per push",
    appliesToFrequency: "ONE_TIME",
    materialCostIncluded: true,
    materialCostEstimate: 500, // $5 for salt
  });

  await db.insert(snowServicePolicies).values({
    serviceId: snowOnDemand.id,
    mode: "ON_DEMAND",
    priceModifierPercent: 20,
    priorityLevel: "HIGH",
    notes: "Priority service within 4 hours of request.",
  });

  console.log("[Seed] Created: Snow Removal - On Demand");

  // 7. Custom Project (Manual Quote)
  const [customProject] = await db.insert(services).values({
    accountId: ACCOUNT_ID,
    name: "Custom Project",
    category: "CUSTOM",
    description: "Custom landscaping projects requiring on-site estimate. Includes hardscaping, planting, and design services.",
    isActive: true,
    serviceType: "ONE_TIME",
    requiresManualQuote: true,
    defaultDurationMinutes: null,
    requiresLeadTime: true,
    defaultLeadTimeDays: 7,
    includesMaterials: true,
    requiresQualifiedCrew: true,
  }).returning();

  await db.insert(servicePricing).values({
    serviceId: customProject.id,
    pricingModel: "RANGE",
    minPrice: 50000, // $500
    targetPrice: 200000, // $2,000
    maxPrice: 1000000, // $10,000
    unitLabel: "per project",
    appliesToFrequency: "ONE_TIME",
    materialCostIncluded: true,
  });

  console.log("[Seed] Created: Custom Project");

  // 8. Mulch Delivery (extension service)
  const [mulchDelivery] = await db.insert(services).values({
    accountId: ACCOUNT_ID,
    name: "Mulch Delivery",
    category: "CLEANUP",
    description: "Mulch delivery only. Customer spreads mulch themselves.",
    isActive: true,
    serviceType: "ONE_TIME",
    requiresManualQuote: false,
    defaultDurationMinutes: 30,
    requiresLeadTime: true,
    defaultLeadTimeDays: 2,
    includesMaterials: true,
    requiresQualifiedCrew: false,
  }).returning();

  await db.insert(servicePricing).values({
    serviceId: mulchDelivery.id,
    pricingModel: "PER_SQFT",
    minPrice: 4500, // $45 per yard
    targetPrice: 5500, // $55 per yard
    maxPrice: 7500, // $75 per yard
    unitLabel: "per cubic yard",
    appliesToFrequency: "ONE_TIME",
    materialCostIncluded: true,
    materialCostEstimate: 3000, // $30 material cost per yard
  });

  console.log("[Seed] Created: Mulch Delivery");

  // 9. Mulch Installation
  const [mulchInstall] = await db.insert(services).values({
    accountId: ACCOUNT_ID,
    name: "Mulch Installation",
    category: "CLEANUP",
    description: "Full service mulch delivery and installation. Includes bed prep and professional spreading.",
    isActive: true,
    serviceType: "SEASONAL",
    requiresManualQuote: false,
    defaultDurationMinutes: 120,
    requiresLeadTime: true,
    defaultLeadTimeDays: 3,
    includesMaterials: true,
    requiresQualifiedCrew: true,
  }).returning();

  await db.insert(servicePricing).values({
    serviceId: mulchInstall.id,
    pricingModel: "PER_SQFT",
    minPrice: 8500, // $85 per yard
    targetPrice: 11000, // $110 per yard
    maxPrice: 15000, // $150 per yard
    unitLabel: "per cubic yard",
    appliesToFrequency: "BOTH",
    materialCostIncluded: true,
    materialCostEstimate: 3000, // $30 material cost per yard
  });

  await db.insert(serviceFrequencyOptions).values([
    { serviceId: mulchInstall.id, frequency: "SEASONAL", priceModifierPercent: 0, isDefault: true },
    { serviceId: mulchInstall.id, frequency: "ON_DEMAND", priceModifierPercent: 10, isDefault: false },
  ]);

  console.log("[Seed] Created: Mulch Installation");

  // 10. Firewood Delivery
  const [firewood] = await db.insert(services).values({
    accountId: ACCOUNT_ID,
    name: "Firewood Delivery",
    category: "CUSTOM",
    description: "Seasoned firewood delivery. Stacking available for additional fee.",
    isActive: true,
    serviceType: "SEASONAL",
    requiresManualQuote: false,
    defaultDurationMinutes: 30,
    requiresLeadTime: true,
    defaultLeadTimeDays: 3,
    includesMaterials: true,
    requiresQualifiedCrew: false,
  }).returning();

  await db.insert(servicePricing).values({
    serviceId: firewood.id,
    pricingModel: "FLAT",
    minPrice: 25000, // $250 per cord
    targetPrice: 30000, // $300 per cord
    maxPrice: 40000, // $400 per cord
    unitLabel: "per full cord",
    appliesToFrequency: "BOTH",
    materialCostIncluded: true,
    materialCostEstimate: 15000, // $150 material cost
  });

  await db.insert(serviceFrequencyOptions).values([
    { serviceId: firewood.id, frequency: "ONE_TIME", priceModifierPercent: 0, isDefault: true },
    { serviceId: firewood.id, frequency: "SEASONAL", priceModifierPercent: -5, isDefault: false },
    { serviceId: firewood.id, frequency: "MONTHLY", priceModifierPercent: -10, isDefault: false },
  ]);

  console.log("[Seed] Created: Firewood Delivery");

  // =====================================================
  // PROMOTION RULES
  // =====================================================

  // Promotion 1: 15% off first recurring service
  await db.insert(promotionRules).values({
    accountId: ACCOUNT_ID,
    name: "New Customer - 15% Off First Recurring Service",
    appliesToServiceId: null,
    appliesToCategory: null,
    condition: "FIRST_TIME_CUSTOMER",
    discountType: "PERCENT",
    discountValue: 15,
    requiresFrequency: "WEEKLY",
    isActive: true,
  });

  console.log("[Seed] Created: New Customer Promotion");

  // Promotion 2: Recurring plan saves 10% per visit
  await db.insert(promotionRules).values({
    accountId: ACCOUNT_ID,
    name: "Recurring Commitment - 10% Off",
    appliesToServiceId: lawnMaintenance.id,
    appliesToCategory: null,
    condition: "RECURRING_COMMITMENT",
    discountType: "PERCENT",
    discountValue: 10,
    requiresFrequency: "WEEKLY",
    isActive: true,
  });

  console.log("[Seed] Created: Recurring Commitment Promotion");

  // Promotion 3: On-demand snow +20% (already applied via snow policy, this is for display)
  await db.insert(promotionRules).values({
    accountId: ACCOUNT_ID,
    name: "On-Demand Snow Premium",
    appliesToServiceId: snowOnDemand.id,
    appliesToCategory: "SNOW",
    condition: "SEASONAL",
    discountType: "PERCENT",
    discountValue: -20, // Negative = surcharge
    requiresFrequency: null,
    isActive: true,
  });

  console.log("[Seed] Created: On-Demand Snow Premium");

  // Promotion 4: Bundle discount
  await db.insert(promotionRules).values({
    accountId: ACCOUNT_ID,
    name: "Bundle & Save - Lawn + Cleanup",
    appliesToServiceId: null,
    appliesToCategory: null,
    condition: "BUNDLE",
    discountType: "PERCENT",
    discountValue: 15,
    requiresFrequency: null,
    isActive: true,
  });

  console.log("[Seed] Created: Bundle Discount");

  console.log("\n[Seed] Service Catalog seed complete!");
  console.log("- 10 services created");
  console.log("- 2 snow policies created");
  console.log("- 4 promotion rules created");
  
  process.exit(0);
}

seedServices().catch((error) => {
  console.error("[Seed] Error:", error);
  process.exit(1);
});
