// ============================================
// Weather Cache - TTL-based caching with geohash dedupe
// ============================================

import { db } from '../../db';
import { weatherForecasts } from '../../../shared/schema-weather';
import { eq, and, gt, lt } from 'drizzle-orm';
import type { ForecastBundle } from '../../../shared/schema-weather';

// TTL configuration by forecast horizon (in seconds)
export const CACHE_TTL = {
  // 0-6 hours: refresh every 15 minutes
  SHORT: 15 * 60,
  // 6-48 hours: refresh every 60 minutes
  MEDIUM: 60 * 60,
  // 2-8 days: refresh every 6 hours
  LONG: 6 * 60 * 60
};

export interface CacheConfig {
  shortTtl?: number;   // 0-6h forecast TTL in seconds
  mediumTtl?: number;  // 6-48h forecast TTL in seconds
  longTtl?: number;    // 2-8d forecast TTL in seconds
}

export interface CacheStats {
  hits: number;
  misses: number;
  expired: number;
  stored: number;
}

/**
 * Weather forecast cache with TTL-based expiration and geohash deduplication
 */
export class WeatherCache {
  private config: Required<CacheConfig>;
  private stats: CacheStats = { hits: 0, misses: 0, expired: 0, stored: 0 };

  constructor(config: CacheConfig = {}) {
    this.config = {
      shortTtl: config.shortTtl ?? CACHE_TTL.SHORT,
      mediumTtl: config.mediumTtl ?? CACHE_TTL.MEDIUM,
      longTtl: config.longTtl ?? CACHE_TTL.LONG
    };
  }

  /**
   * Get cached forecast for a geohash and provider
   * @param geohash Location geohash
   * @param provider Provider name (openweather, nws)
   * @returns Cached forecast or null if not found/expired
   */
  async get(geohash: string, provider: string): Promise<ForecastBundle | null> {
    try {
      const now = new Date();
      
      const [cached] = await db
        .select()
        .from(weatherForecasts)
        .where(
          and(
            eq(weatherForecasts.geohash, geohash),
            eq(weatherForecasts.provider, provider),
            gt(weatherForecasts.expiresAt, now)
          )
        )
        .limit(1);

      if (cached) {
        this.stats.hits++;
        return {
          ...(cached.forecastData as Omit<ForecastBundle, 'alerts'>),
          alerts: cached.alertsData as ForecastBundle['alerts'],
          geohash,
          fetchedAt: cached.fetchedAt.toISOString()
        } as ForecastBundle;
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('[WeatherCache] Error getting cached forecast:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Store forecast in cache with appropriate TTL
   * @param forecast Forecast data to cache
   * @param horizonHours How far out is the forecast (affects TTL)
   */
  async set(forecast: ForecastBundle, horizonHours: number = 48): Promise<void> {
    try {
      const ttl = this.getTtlForHorizon(horizonHours);
      const expiresAt = new Date(Date.now() + ttl * 1000);

      // Upsert - delete existing and insert new
      await db.transaction(async (tx) => {
        // Delete existing cache for this geohash/provider
        await tx
          .delete(weatherForecasts)
          .where(
            and(
              eq(weatherForecasts.geohash, forecast.geohash),
              eq(weatherForecasts.provider, forecast.provider)
            )
          );

        // Insert new cache entry
        await tx.insert(weatherForecasts).values({
          geohash: forecast.geohash,
          provider: forecast.provider,
          lat: forecast.lat,
          lon: forecast.lon,
          forecastData: {
            lat: forecast.lat,
            lon: forecast.lon,
            timezone: forecast.timezone,
            current: forecast.current,
            hourly: forecast.hourly,
            daily: forecast.daily,
            provider: forecast.provider
          },
          alertsData: forecast.alerts || null,
          fetchedAt: new Date(forecast.fetchedAt),
          expiresAt
        });
      });

      this.stats.stored++;
    } catch (error) {
      console.error('[WeatherCache] Error storing forecast:', error);
    }
  }

  /**
   * Bulk get cached forecasts for multiple geohashes
   * @param geohashes Array of geohashes to fetch
   * @param provider Provider name
   * @returns Map of geohash -> forecast (only includes hits)
   */
  async bulkGet(
    geohashes: string[],
    provider: string
  ): Promise<Map<string, ForecastBundle>> {
    const results = new Map<string, ForecastBundle>();
    
    if (geohashes.length === 0) return results;

    try {
      const now = new Date();
      
      const cached = await db
        .select()
        .from(weatherForecasts)
        .where(
          and(
            eq(weatherForecasts.provider, provider),
            gt(weatherForecasts.expiresAt, now)
          )
        );

      // Filter to requested geohashes
      const geohashSet = new Set(geohashes);
      for (const entry of cached) {
        if (geohashSet.has(entry.geohash)) {
          this.stats.hits++;
          results.set(entry.geohash, {
            ...(entry.forecastData as Omit<ForecastBundle, 'alerts'>),
            alerts: entry.alertsData as ForecastBundle['alerts'],
            geohash: entry.geohash,
            fetchedAt: entry.fetchedAt.toISOString()
          } as ForecastBundle);
        }
      }

      // Count misses
      this.stats.misses += geohashes.length - results.size;
    } catch (error) {
      console.error('[WeatherCache] Error in bulk get:', error);
      this.stats.misses += geohashes.length;
    }

    return results;
  }

  /**
   * Invalidate cached forecasts for a geohash or all forecasts for a provider
   */
  async invalidate(geohash?: string, provider?: string): Promise<number> {
    try {
      const conditions = [];
      if (geohash) conditions.push(eq(weatherForecasts.geohash, geohash));
      if (provider) conditions.push(eq(weatherForecasts.provider, provider));

      if (conditions.length === 0) {
        // Invalidate all
        const result = await db.delete(weatherForecasts);
        return 0; // Drizzle doesn't return count easily
      }

      await db
        .delete(weatherForecasts)
        .where(and(...conditions));

      return 0;
    } catch (error) {
      console.error('[WeatherCache] Error invalidating cache:', error);
      return 0;
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanup(): Promise<number> {
    try {
      const now = new Date();
      await db
        .delete(weatherForecasts)
        .where(lt(weatherForecasts.expiresAt, now));

      return 0;
    } catch (error) {
      console.error('[WeatherCache] Error cleaning up cache:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, expired: 0, stored: 0 };
  }

  /**
   * Determine TTL based on forecast horizon
   */
  private getTtlForHorizon(horizonHours: number): number {
    if (horizonHours <= 6) return this.config.shortTtl;
    if (horizonHours <= 48) return this.config.mediumTtl;
    return this.config.longTtl;
  }
}

// Singleton instance
let cacheInstance: WeatherCache | null = null;

export function getWeatherCache(config?: CacheConfig): WeatherCache {
  if (!cacheInstance) {
    cacheInstance = new WeatherCache(config);
  }
  return cacheInstance;
}
