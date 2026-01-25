// ============================================
// Weather Service - Main Export
// ============================================

export { WeatherProviderService } from './providerService';
export { WeatherCache } from './cache';
export { RiskScorer } from './riskScorer';
export { encodeGeohash, decodeGeohash, getGeohashNeighbors } from './geohash';

export * from './providers/openweather';
export * from './providers/nws';

// Re-export types from schema
export type {
  WeatherRisk,
  ForecastBundle,
  WeatherDriver,
  RiskTier,
  WinterEvent,
  ChangeSet,
  CampaignProposal,
  ApprovalPacket
} from '../../../shared/schema-weather';
