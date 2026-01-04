export interface JsonDiffResult {
  changed: Array<{ path: string; from: unknown; to: unknown }>;
  added: Array<{ path: string; value: unknown }>;
  removed: Array<{ path: string; value: unknown }>;
}

const RELEVANT_KEYS_BY_DECISION_TYPE: Record<string, string[]> = {
  quote_range: ["rangeLow", "rangeHigh", "services", "assumptions", "frequency", "lotSize", "pricePerVisit"],
  crew_assignment: ["crewId", "crewName", "estimatedTravelMinutes", "reason", "startTime", "endTime"],
  schedule_windows: ["windows", "preferredDate", "preferredTimeSlot", "availableDates"],
  channel_choice: ["channel", "reason"],
  next_question: ["question", "context"],
  feasibility_gate: ["feasible", "reason", "blockers"],
  escalate_human: ["reason", "urgency", "suggestedAction"],
};

export function computeJsonDiff(
  recommended: Record<string, unknown>,
  final: Record<string, unknown>,
  decisionType?: string
): JsonDiffResult {
  const result: JsonDiffResult = {
    changed: [],
    added: [],
    removed: [],
  };
  
  const relevantKeys = decisionType ? RELEVANT_KEYS_BY_DECISION_TYPE[decisionType] : null;
  const allKeys = Array.from(new Set([...Object.keys(recommended), ...Object.keys(final)]));
  
  for (const key of allKeys) {
    if (relevantKeys && !relevantKeys.includes(key)) {
      continue;
    }
    
    const recommendedValue = recommended[key];
    const finalValue = final[key];
    
    if (recommendedValue === undefined && finalValue !== undefined) {
      result.added.push({ path: key, value: finalValue });
    } else if (recommendedValue !== undefined && finalValue === undefined) {
      result.removed.push({ path: key, value: recommendedValue });
    } else if (!deepEqual(recommendedValue, finalValue)) {
      result.changed.push({ path: key, from: recommendedValue, to: finalValue });
    }
  }
  
  return result;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    
    if (aKeys.length !== bKeys.length) return false;
    
    for (const key of aKeys) {
      if (!bKeys.includes(key)) return false;
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    
    return true;
  }
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  return false;
}

export function hasMeaningfulChanges(diff: JsonDiffResult): boolean {
  return diff.changed.length > 0 || diff.added.length > 0 || diff.removed.length > 0;
}

export function calculateDiffMagnitude(diff: JsonDiffResult): number {
  let magnitude = 0;
  
  for (const change of diff.changed) {
    if (typeof change.from === "number" && typeof change.to === "number") {
      const percentChange = Math.abs((change.to - change.from) / change.from) * 100;
      magnitude += percentChange;
    } else {
      magnitude += 10;
    }
  }
  
  magnitude += diff.added.length * 5;
  magnitude += diff.removed.length * 5;
  
  return magnitude;
}
