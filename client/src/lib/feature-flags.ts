/**
 * LawnFlow AI - Feature Flags
 * 
 * Centralized feature flag management for gradual rollouts.
 */

export const featureFlags = {
  UI_REFACTOR_V1: import.meta.env.VITE_UI_REFACTOR_V1 === 'true',
  UI_REDESIGN_V2: import.meta.env.VITE_UI_REDESIGN_V2 === 'true',
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag] ?? false;
}

export function useFeatureFlag(flag: FeatureFlag): boolean {
  return isFeatureEnabled(flag);
}
