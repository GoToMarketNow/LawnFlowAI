/**
 * Duration Estimation Model
 * 
 * Provides expected_duration(job_type, lot_size, crew_size) with safe defaults.
 * Based on industry averages for landscaping/lawn care services.
 */

// Base durations by service type (minutes for 5,000 sqft lot with 1-person crew)
const BASE_DURATIONS: Record<string, number> = {
  mowing: 30,
  lawn_mowing: 30,
  grass_cutting: 30,
  edging: 15,
  trimming: 20,
  hedge_trimming: 45,
  bush_trimming: 40,
  leaf_removal: 45,
  leaf_cleanup: 45,
  aeration: 40,
  overseeding: 25,
  fertilization: 20,
  fertilizing: 20,
  weed_control: 25,
  mulching: 60,
  mulch_installation: 60,
  bed_maintenance: 45,
  flower_bed: 50,
  spring_cleanup: 90,
  fall_cleanup: 120,
  seasonal_cleanup: 100,
  irrigation_check: 30,
  irrigation_repair: 60,
  sprinkler: 45,
  landscape_design: 180,
  landscaping: 120,
  hardscape: 240,
  paver: 300,
  sod_installation: 90,
  sod: 90,
  tree_trimming: 60,
  tree_removal: 180,
  stump_grinding: 60,
  snow_removal: 45,
  snow_plowing: 30,
  ice_treatment: 20,
  gutter_cleaning: 45,
  pressure_washing: 60,
  power_washing: 60,
  general: 60,
  maintenance: 45,
  default: 45,
};

// Lot size scaling factors (base is 5000 sqft)
const LOT_SIZE_BRACKETS: Array<{ maxSqft: number; multiplier: number }> = [
  { maxSqft: 2500, multiplier: 0.6 },
  { maxSqft: 5000, multiplier: 1.0 },
  { maxSqft: 7500, multiplier: 1.3 },
  { maxSqft: 10000, multiplier: 1.6 },
  { maxSqft: 15000, multiplier: 2.0 },
  { maxSqft: 20000, multiplier: 2.4 },
  { maxSqft: 30000, multiplier: 3.0 },
  { maxSqft: 50000, multiplier: 4.0 },
  { maxSqft: Infinity, multiplier: 5.0 },
];

// Crew size efficiency factors (diminishing returns)
const CREW_EFFICIENCY: Record<number, number> = {
  1: 1.0,
  2: 0.55,  // 2 people = 1.8x speed, not 2x
  3: 0.40,  // 3 people = 2.5x speed
  4: 0.30,  // 4 people = 3.3x speed
  5: 0.25,  // 5 people = 4x speed
};

// Safe defaults
const SAFE_DEFAULTS = {
  lotSizeSqft: 5000,
  crewSize: 1,
  minDurationMins: 15,
  maxDurationMins: 480,  // 8 hours max
};

/**
 * Normalize job type to match lookup keys
 */
function normalizeJobType(jobType: string): string {
  return jobType
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Get lot size multiplier
 */
function getLotSizeMultiplier(sqft: number): number {
  for (const bracket of LOT_SIZE_BRACKETS) {
    if (sqft <= bracket.maxSqft) {
      return bracket.multiplier;
    }
  }
  return 5.0; // Very large properties
}

/**
 * Get crew efficiency factor
 */
function getCrewEfficiency(crewSize: number): number {
  if (crewSize in CREW_EFFICIENCY) {
    return CREW_EFFICIENCY[crewSize];
  }
  // For larger crews, continue diminishing returns
  return Math.max(0.15, 1 / crewSize);
}

/**
 * Find base duration by matching job type keywords
 */
function findBaseDuration(jobType: string): number {
  const normalized = normalizeJobType(jobType);
  
  // Direct match
  if (normalized in BASE_DURATIONS) {
    return BASE_DURATIONS[normalized];
  }
  
  // Partial match - check if any key is contained in the job type
  for (const [key, duration] of Object.entries(BASE_DURATIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return duration;
    }
  }
  
  // No match - return default
  return BASE_DURATIONS.default;
}

export interface DurationModelInput {
  jobType: string;
  lotSizeSqft?: number | null;
  crewSize?: number | null;
}

export interface DurationModelOutput {
  expectedDurationMins: number;
  baseDurationMins: number;
  lotSizeMultiplier: number;
  crewEfficiencyFactor: number;
  usedDefaults: string[];
}

/**
 * Calculate expected duration for a job
 * 
 * @param input - Job type, lot size, and crew size
 * @returns Expected duration in minutes with calculation details
 */
export function expected_duration(input: DurationModelInput): DurationModelOutput {
  const usedDefaults: string[] = [];
  
  // Get base duration from job type
  const baseDuration = findBaseDuration(input.jobType);
  
  // Apply lot size (use default if missing)
  let lotSizeSqft = input.lotSizeSqft;
  if (!lotSizeSqft || lotSizeSqft <= 0) {
    lotSizeSqft = SAFE_DEFAULTS.lotSizeSqft;
    usedDefaults.push('lot_size');
  }
  const lotSizeMultiplier = getLotSizeMultiplier(lotSizeSqft);
  
  // Apply crew size (use default if missing)
  let crewSize = input.crewSize;
  if (!crewSize || crewSize < 1) {
    crewSize = SAFE_DEFAULTS.crewSize;
    usedDefaults.push('crew_size');
  }
  const crewEfficiencyFactor = getCrewEfficiency(crewSize);
  
  // Calculate final duration
  let duration = baseDuration * lotSizeMultiplier * crewEfficiencyFactor;
  
  // Clamp to safe bounds
  duration = Math.max(SAFE_DEFAULTS.minDurationMins, Math.min(SAFE_DEFAULTS.maxDurationMins, duration));
  
  // Round to nearest 5 minutes for practical scheduling
  duration = Math.round(duration / 5) * 5;
  
  return {
    expectedDurationMins: duration,
    baseDurationMins: baseDuration,
    lotSizeMultiplier,
    crewEfficiencyFactor,
    usedDefaults,
  };
}

/**
 * Get variance thresholds for alerting
 */
export const VARIANCE_THRESHOLDS = {
  // Duration variance thresholds (percentage over expected)
  duration: {
    low: 15,      // 15% over = low risk
    medium: 30,   // 30% over = medium risk
    high: 50,     // 50% over = high risk
  },
  
  // Visit count variance thresholds
  visits: {
    low: 1,       // 1 extra visit = low risk
    medium: 2,    // 2 extra visits = medium risk
    high: 3,      // 3+ extra visits = high risk
  },
  
  // Margin erosion thresholds (percentage points below baseline)
  margin: {
    low: 5,       // 5pp below = low risk
    medium: 10,   // 10pp below = medium risk
    high: 20,     // 20pp below = high risk
  },
};

/**
 * Determine risk level based on variance
 */
export function getRiskLevel(
  varianceType: 'duration' | 'visits' | 'margin',
  variance: number
): 'normal' | 'low' | 'medium' | 'high' {
  const thresholds = VARIANCE_THRESHOLDS[varianceType];
  
  if (variance >= thresholds.high) return 'high';
  if (variance >= thresholds.medium) return 'medium';
  if (variance >= thresholds.low) return 'low';
  return 'normal';
}
