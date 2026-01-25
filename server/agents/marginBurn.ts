/**
 * Margin & Burn Agent
 * 
 * Computes burn estimates and margin scores for candidate job assignments.
 * Uses labor estimates, travel time, crew size, and cost models to calculate
 * profitability indicators.
 */

export interface MarginBurnInput {
  laborLowMinutes: number | null;
  laborHighMinutes: number | null;
  travelMinutesDelta: number;
  crewSizeMin: number;
  lotAreaSqft: number | null;
  priceLowCents?: number | null;
  priceHighCents?: number | null;
  requiredEquipment?: string[];
}

export interface MarginBurnResult {
  burnMinutes: number;
  estLaborCost: number;
  estEquipmentCost: number;
  estTotalCost: number;
  marginScore: number;
  revenueEstimate: number | null;
  notes: string[];
}

export interface CostModel {
  laborCostPerHour: number;
  equipmentCostPerJob: Record<string, number>;
  baseRatePerThousandSqft: number;
}

const DEFAULT_COST_MODEL: CostModel = {
  laborCostPerHour: 30,
  equipmentCostPerJob: {
    mower_ztr: 5,
    mower_push: 2,
    trimmer: 1,
    blower: 1,
    edger: 1,
    trailer: 3,
    truck: 5,
    chainsaw: 3,
    hedge_trimmer: 2,
    aerator: 10,
    dethatcher: 8,
    spreader: 3,
    sprayer: 5,
  },
  baseRatePerThousandSqft: 45,
};

const DEFAULT_LABOR_MINUTES = 60;
const MAX_BURN_MINUTES_FOR_SCORE = 480;

/**
 * Compute margin score and burn estimates for a candidate assignment
 */
export function computeMarginScore(
  input: MarginBurnInput,
  costModel: CostModel = DEFAULT_COST_MODEL
): MarginBurnResult {
  const notes: string[] = [];

  const laborHigh = input.laborHighMinutes ?? input.laborLowMinutes ?? DEFAULT_LABOR_MINUTES;
  const laborLow = input.laborLowMinutes ?? laborHigh;
  
  if (input.laborHighMinutes == null && input.laborLowMinutes == null) {
    notes.push(`Using default labor estimate: ${DEFAULT_LABOR_MINUTES} min`);
  }

  const burnMinutes = laborHigh + input.travelMinutesDelta;
  const crewSize = Math.max(1, input.crewSizeMin);
  const burnHours = burnMinutes / 60;
  const estLaborCost = burnHours * costModel.laborCostPerHour * crewSize;

  let estEquipmentCost = 0;
  if (input.requiredEquipment && input.requiredEquipment.length > 0) {
    for (const equip of input.requiredEquipment) {
      const equipKey = equip.toLowerCase().replace(/\s+/g, '_');
      estEquipmentCost += costModel.equipmentCostPerJob[equipKey] ?? 0;
    }
  }

  const estTotalCost = estLaborCost + estEquipmentCost;

  let revenueEstimate: number | null = null;
  let marginScore: number;

  const hasHighPrice = input.priceHighCents != null && input.priceHighCents > 0;
  const hasLowPrice = input.priceLowCents != null && input.priceLowCents > 0;

  if (hasHighPrice || hasLowPrice) {
    if (hasHighPrice && hasLowPrice) {
      revenueEstimate = (input.priceHighCents! + input.priceLowCents!) / 2 / 100;
      notes.push(`Using price midpoint for margin: $${revenueEstimate.toFixed(2)} revenue`);
    } else if (hasHighPrice) {
      revenueEstimate = input.priceHighCents! / 100;
      notes.push(`Using price high for margin: $${revenueEstimate.toFixed(2)} revenue`);
    } else {
      revenueEstimate = input.priceLowCents! / 100;
      notes.push(`Using price low for margin: $${revenueEstimate.toFixed(2)} revenue`);
    }
    const profit = revenueEstimate - estTotalCost;
    const profitMargin = revenueEstimate > 0 ? profit / revenueEstimate : 0;
    marginScore = Math.round(Math.max(0, Math.min(100, (profitMargin + 0.2) * 100)));
  } else if (input.lotAreaSqft != null && input.lotAreaSqft > 0) {
    const lotThousandSqft = input.lotAreaSqft / 1000;
    revenueEstimate = lotThousandSqft * costModel.baseRatePerThousandSqft;
    const profit = revenueEstimate - estTotalCost;
    const profitMargin = revenueEstimate > 0 ? profit / revenueEstimate : 0;
    marginScore = Math.round(Math.max(0, Math.min(100, (profitMargin + 0.2) * 100)));
    notes.push(`Using lot area proxy for margin: ${input.lotAreaSqft} sqft @ $${costModel.baseRatePerThousandSqft}/1000sqft`);
  } else {
    const burnRatio = burnMinutes / MAX_BURN_MINUTES_FOR_SCORE;
    marginScore = Math.round(Math.max(0, Math.min(100, (1 - burnRatio) * 100)));
    notes.push(`Using inverse burn heuristic: no price or lot area available`);
  }

  return {
    burnMinutes,
    estLaborCost: Math.round(estLaborCost * 100) / 100,
    estEquipmentCost: Math.round(estEquipmentCost * 100) / 100,
    estTotalCost: Math.round(estTotalCost * 100) / 100,
    marginScore,
    revenueEstimate: revenueEstimate != null ? Math.round(revenueEstimate * 100) / 100 : null,
    notes,
  };
}

/**
 * Get the default cost model for configuration display
 */
export function getDefaultCostModel(): CostModel {
  return { ...DEFAULT_COST_MODEL };
}

/**
 * Calculate simple burn minutes without full margin analysis
 */
export function calculateBurnMinutes(
  laborHighMinutes: number | null,
  travelMinutesDelta: number
): number {
  const labor = laborHighMinutes ?? DEFAULT_LABOR_MINUTES;
  return labor + travelMinutesDelta;
}
