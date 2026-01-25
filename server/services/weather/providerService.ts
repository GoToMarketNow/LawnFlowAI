// ============================================
// Weather Provider Service
// Orchestrates providers with caching, deduplication, and failover
// ============================================

import { OpenWeatherProvider, createOpenWeatherProvider } from './providers/openweather';
import { NWSProvider, createNWSProvider, isUSLocation } from './providers/nws';
import { WeatherCache, getWeatherCache } from './cache';
import { encodeGeohash, deduplicateForecastRequests } from './geohash';
import type { ForecastBundle, WeatherAlertSchema } from '../../../shared/schema-weather';
import { z } from 'zod';

export interface ProviderServiceConfig {
  // Budget controls
  dailyBudget?: number;        // Max API calls per day
  operatorBudget?: number;     // Max calls per operator per hour
  
  // Provider preferences
  primaryProvider?: 'openweather' | 'nws';
  enableNWSFallback?: boolean;
  
  // Deduplication
  geohashPrecision?: number;   // Default: 6 (~1.2km)
  
  // Rate limiting
  minRequestIntervalMs?: number;
}

export interface ForecastRequest {
  lat: number;
  lon: number;
  jobId?: number;
  serviceAreaId?: number;
  operatorId?: number;
}

export interface BudgetStatus {
  dailyCalls: number;
  dailyLimit: number;
  remainingToday: number;
  operatorCalls: Map<number, number>;
}

/**
 * Weather Provider Service
 * Provides unified access to weather data with caching, deduplication, and budget controls
 */
export class WeatherProviderService {
  private openWeather: OpenWeatherProvider | null = null;
  private nws: NWSProvider;
  private cache: WeatherCache;
  private config: Required<ProviderServiceConfig>;
  
  // Budget tracking
  private dailyCalls: number = 0;
  private dailyResetTime: Date;
  private operatorCalls: Map<number, { count: number; resetTime: Date }> = new Map();

  constructor(config: ProviderServiceConfig = {}) {
    this.config = {
      dailyBudget: config.dailyBudget ?? parseInt(process.env.WEATHER_API_DAILY_BUDGET || '1000', 10),
      operatorBudget: config.operatorBudget ?? 100,
      primaryProvider: config.primaryProvider ?? 'openweather',
      enableNWSFallback: config.enableNWSFallback ?? true,
      geohashPrecision: config.geohashPrecision ?? 6,
      minRequestIntervalMs: config.minRequestIntervalMs ?? 100
    };

    // Initialize providers
    try {
      this.openWeather = createOpenWeatherProvider();
    } catch (error) {
      console.warn('[WeatherService] OpenWeather not configured:', error);
    }

    this.nws = createNWSProvider();
    this.cache = getWeatherCache();
    
    // Set daily reset time to midnight
    this.dailyResetTime = this.getNextMidnight();
  }

  /**
   * Fetch forecast for a single location
   */
  async fetchForecast(request: ForecastRequest): Promise<ForecastBundle | null> {
    const geohash = encodeGeohash(request.lat, request.lon, this.config.geohashPrecision);
    
    // Check budget
    if (!this.checkBudget(request.operatorId)) {
      console.warn(`[WeatherService] Budget exceeded for operator ${request.operatorId}`);
      return null;
    }

    // Check cache first
    const cached = await this.cache.get(geohash, this.config.primaryProvider);
    if (cached) {
      console.log(`[WeatherService] Cache hit for ${geohash}`);
      return cached;
    }

    // Fetch from provider
    const forecast = await this.fetchFromProvider(request.lat, request.lon, request.operatorId);
    
    if (forecast) {
      // Cache the result
      await this.cache.set(forecast, 48); // Default to 48h horizon
    }

    return forecast;
  }

  /**
   * Fetch forecasts for multiple locations with deduplication
   */
  async fetchBatch(requests: ForecastRequest[]): Promise<Map<string, ForecastBundle>> {
    const results = new Map<string, ForecastBundle>();
    
    if (requests.length === 0) return results;

    // Deduplicate by geohash
    const deduplicated = deduplicateForecastRequests(requests, this.config.geohashPrecision);
    console.log(`[WeatherService] Deduped ${requests.length} requests to ${deduplicated.length}`);

    // Check cache for all geohashes
    const geohashes = deduplicated.map(d => d.geohash);
    const cached = await this.cache.bulkGet(geohashes, this.config.primaryProvider);
    
    // Copy cached results
    for (const [geohash, forecast] of cached) {
      results.set(geohash, forecast);
    }

    // Fetch missing forecasts
    const missing = deduplicated.filter(d => !cached.has(d.geohash));
    console.log(`[WeatherService] Cache miss for ${missing.length} locations`);

    // Get operator ID from first request (assume same operator for batch)
    const operatorId = requests[0]?.operatorId;

    for (const loc of missing) {
      // Check budget
      if (!this.checkBudget(operatorId)) {
        console.warn(`[WeatherService] Budget exceeded, stopping batch`);
        break;
      }

      const forecast = await this.fetchFromProvider(loc.lat, loc.lon, operatorId);
      
      if (forecast) {
        results.set(loc.geohash, forecast);
        await this.cache.set(forecast, 48);
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, this.config.minRequestIntervalMs));
    }

    return results;
  }

  /**
   * Fetch alerts for a location
   */
  async fetchAlerts(lat: number, lon: number): Promise<z.infer<typeof WeatherAlertSchema>[]> {
    const alerts: z.infer<typeof WeatherAlertSchema>[] = [];

    // Try OpenWeather alerts first (if available)
    if (this.openWeather) {
      try {
        const forecast = await this.fetchForecast({ lat, lon });
        if (forecast?.alerts) {
          alerts.push(...forecast.alerts);
        }
      } catch (error) {
        console.error('[WeatherService] Error fetching OpenWeather alerts:', error);
      }
    }

    // Try NWS for US locations
    if (isUSLocation(lat, lon)) {
      try {
        const nwsAlerts = await this.nws.fetchAlerts(lat, lon);
        
        // Merge and deduplicate alerts by event name
        for (const alert of nwsAlerts) {
          const isDuplicate = alerts.some(
            a => a.event === alert.event && 
                 Math.abs(a.start - alert.start) < 3600 // Within 1 hour
          );
          if (!isDuplicate) {
            alerts.push(alert);
          }
        }
      } catch (error) {
        console.error('[WeatherService] Error fetching NWS alerts:', error);
      }
    }

    return alerts;
  }

  /**
   * Fetch winter-specific alerts for campaign detection
   */
  async fetchWinterAlerts(states?: string[]): Promise<z.infer<typeof WeatherAlertSchema>[]> {
    return this.nws.fetchWinterAlerts(states);
  }

  /**
   * Get budget status
   */
  getBudgetStatus(): BudgetStatus {
    this.resetBudgetsIfNeeded();
    
    return {
      dailyCalls: this.dailyCalls,
      dailyLimit: this.config.dailyBudget,
      remainingToday: Math.max(0, this.config.dailyBudget - this.dailyCalls),
      operatorCalls: new Map(
        Array.from(this.operatorCalls.entries()).map(([id, data]) => [id, data.count])
      )
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Fetch from provider with failover
   */
  private async fetchFromProvider(
    lat: number, 
    lon: number, 
    operatorId?: number
  ): Promise<ForecastBundle | null> {
    // Track the call
    this.trackCall(operatorId);

    // Try primary provider
    if (this.config.primaryProvider === 'openweather' && this.openWeather) {
      try {
        return await this.openWeather.fetchForecast(lat, lon);
      } catch (error) {
        console.error('[WeatherService] OpenWeather error:', error);
        
        // Fallback to NWS if enabled and in US
        if (this.config.enableNWSFallback && isUSLocation(lat, lon)) {
          console.log('[WeatherService] Falling back to NWS');
          return await this.fetchFromNWS(lat, lon);
        }
      }
    }

    // Try NWS for US locations
    if (isUSLocation(lat, lon)) {
      try {
        return await this.fetchFromNWS(lat, lon);
      } catch (error) {
        console.error('[WeatherService] NWS error:', error);
      }
    }

    return null;
  }

  /**
   * Fetch from NWS and transform to ForecastBundle
   */
  private async fetchFromNWS(lat: number, lon: number): Promise<ForecastBundle | null> {
    const geohash = encodeGeohash(lat, lon, this.config.geohashPrecision);
    
    // NWS doesn't provide the same hourly data structure as OpenWeather
    // Get alerts at minimum
    const alerts = await this.nws.fetchAlerts(lat, lon);
    const gridPoint = await this.nws.getGridPoint(lat, lon);

    if (!gridPoint) {
      return null;
    }

    // Return a minimal forecast bundle with alerts
    return {
      lat,
      lon,
      geohash,
      timezone: gridPoint.timeZone,
      hourly: [],
      daily: [],
      alerts,
      provider: 'nws',
      fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Check if request is within budget
   */
  private checkBudget(operatorId?: number): boolean {
    this.resetBudgetsIfNeeded();

    // Check daily budget
    if (this.dailyCalls >= this.config.dailyBudget) {
      return false;
    }

    // Check operator budget if applicable
    if (operatorId !== undefined) {
      const opData = this.operatorCalls.get(operatorId);
      if (opData && opData.count >= this.config.operatorBudget) {
        return false;
      }
    }

    return true;
  }

  /**
   * Track an API call for budget purposes
   */
  private trackCall(operatorId?: number): void {
    this.dailyCalls++;

    if (operatorId !== undefined) {
      const opData = this.operatorCalls.get(operatorId);
      if (opData) {
        opData.count++;
      } else {
        this.operatorCalls.set(operatorId, {
          count: 1,
          resetTime: new Date(Date.now() + 60 * 60 * 1000) // Reset in 1 hour
        });
      }
    }
  }

  /**
   * Reset budgets if time has passed
   */
  private resetBudgetsIfNeeded(): void {
    const now = new Date();

    // Reset daily budget
    if (now >= this.dailyResetTime) {
      this.dailyCalls = 0;
      this.dailyResetTime = this.getNextMidnight();
    }

    // Reset operator budgets
    for (const [operatorId, data] of this.operatorCalls) {
      if (now >= data.resetTime) {
        data.count = 0;
        data.resetTime = new Date(Date.now() + 60 * 60 * 1000);
      }
    }
  }

  /**
   * Get next midnight for daily reset
   */
  private getNextMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }
}

// Singleton instance
let serviceInstance: WeatherProviderService | null = null;

export function getWeatherProviderService(config?: ProviderServiceConfig): WeatherProviderService {
  if (!serviceInstance) {
    serviceInstance = new WeatherProviderService(config);
  }
  return serviceInstance;
}
