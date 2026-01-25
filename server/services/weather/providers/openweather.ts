// ============================================
// OpenWeather One Call 3.0 Provider
// ============================================

import { z } from 'zod';
import type { ForecastBundle, HourlyForecastSchema, DailyForecastSchema, WeatherAlertSchema } from '../../../../shared/schema-weather';
import { encodeGeohash } from '../geohash';

// OpenWeather API configuration
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const DEFAULT_TIMEOUT = 10000; // 10 seconds

export interface OpenWeatherConfig {
  apiKey: string;
  units?: 'metric' | 'imperial' | 'standard';
  timeout?: number;
}

export interface OpenWeatherResponse {
  lat: number;
  lon: number;
  timezone: string;
  timezone_offset: number;
  current?: {
    dt: number;
    sunrise?: number;
    sunset?: number;
    temp: number;
    feels_like: number;
    pressure: number;
    humidity: number;
    dew_point: number;
    uvi: number;
    clouds: number;
    visibility: number;
    wind_speed: number;
    wind_deg: number;
    wind_gust?: number;
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    rain?: { '1h': number };
    snow?: { '1h': number };
  };
  hourly: Array<{
    dt: number;
    temp: number;
    feels_like: number;
    pressure: number;
    humidity: number;
    dew_point: number;
    uvi: number;
    clouds: number;
    visibility: number;
    wind_speed: number;
    wind_deg: number;
    wind_gust?: number;
    pop: number;
    rain?: { '1h': number };
    snow?: { '1h': number };
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
  }>;
  daily: Array<{
    dt: number;
    sunrise: number;
    sunset: number;
    moonrise: number;
    moonset: number;
    moon_phase: number;
    summary?: string;
    temp: {
      day: number;
      min: number;
      max: number;
      night: number;
      eve: number;
      morn: number;
    };
    feels_like: {
      day: number;
      night: number;
      eve: number;
      morn: number;
    };
    pressure: number;
    humidity: number;
    dew_point: number;
    wind_speed: number;
    wind_deg: number;
    wind_gust?: number;
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    clouds: number;
    pop: number;
    rain?: number;
    snow?: number;
    uvi: number;
  }>;
  alerts?: Array<{
    sender_name: string;
    event: string;
    start: number;
    end: number;
    description: string;
    tags: string[];
  }>;
}

/**
 * OpenWeather One Call 3.0 API client
 */
export class OpenWeatherProvider {
  private apiKey: string;
  private units: string;
  private timeout: number;
  private callCount: number = 0;

  constructor(config: OpenWeatherConfig) {
    if (!config.apiKey) {
      throw new Error('OpenWeather API key is required');
    }
    this.apiKey = config.apiKey;
    this.units = config.units || 'imperial'; // US units by default
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Fetch forecast for a location
   * @param lat Latitude
   * @param lon Longitude
   * @param exclude Optional: exclude data parts (current, minutely, hourly, daily, alerts)
   */
  async fetchForecast(
    lat: number,
    lon: number,
    exclude?: string[]
  ): Promise<ForecastBundle> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      appid: this.apiKey,
      units: this.units
    });

    if (exclude && exclude.length > 0) {
      params.set('exclude', exclude.join(','));
    }

    const url = `${OPENWEATHER_BASE_URL}?${params.toString()}`;
    
    console.log(`[OpenWeather] Fetching forecast for (${lat}, ${lon})`);
    this.callCount++;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenWeather API error ${response.status}: ${errorText}`);
      }

      const data: OpenWeatherResponse = await response.json();
      return this.transformResponse(data);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`OpenWeather API timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Fetch forecasts for multiple locations (with rate limiting)
   * @param locations Array of {lat, lon} objects
   * @param delayMs Delay between requests in milliseconds
   */
  async fetchBatch(
    locations: Array<{ lat: number; lon: number; geohash?: string }>,
    delayMs: number = 100
  ): Promise<Map<string, ForecastBundle>> {
    const results = new Map<string, ForecastBundle>();

    for (const loc of locations) {
      try {
        const forecast = await this.fetchForecast(loc.lat, loc.lon);
        const geohash = loc.geohash || encodeGeohash(loc.lat, loc.lon, 6);
        results.set(geohash, forecast);

        // Rate limiting delay
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.error(`[OpenWeather] Error fetching (${loc.lat}, ${loc.lon}):`, error);
        // Continue with other locations
      }
    }

    return results;
  }

  /**
   * Get the number of API calls made
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Reset the call counter
   */
  resetCallCount(): void {
    this.callCount = 0;
  }

  /**
   * Transform OpenWeather response to our ForecastBundle format
   */
  private transformResponse(data: OpenWeatherResponse): ForecastBundle {
    const geohash = encodeGeohash(data.lat, data.lon, 6);

    return {
      lat: data.lat,
      lon: data.lon,
      geohash,
      timezone: data.timezone,
      current: data.current ? {
        dt: data.current.dt,
        temp: data.current.temp,
        humidity: data.current.humidity,
        windSpeed: data.current.wind_speed,
        weather: data.current.weather.map(w => ({
          main: w.main,
          description: w.description
        }))
      } : undefined,
      hourly: data.hourly.map(h => ({
        dt: h.dt,
        temp: h.temp,
        feelsLike: h.feels_like,
        humidity: h.humidity,
        windSpeed: h.wind_speed,
        windGust: h.wind_gust,
        windDeg: h.wind_deg,
        clouds: h.clouds,
        pop: h.pop,
        rain: h.rain?.['1h'],
        snow: h.snow?.['1h'],
        weather: h.weather,
        visibility: h.visibility
      })),
      daily: data.daily.map(d => ({
        dt: d.dt,
        sunrise: d.sunrise,
        sunset: d.sunset,
        temp: {
          min: d.temp.min,
          max: d.temp.max,
          day: d.temp.day,
          night: d.temp.night
        },
        humidity: d.humidity,
        windSpeed: d.wind_speed,
        windGust: d.wind_gust,
        pop: d.pop,
        rain: d.rain,
        snow: d.snow,
        weather: d.weather
      })),
      alerts: data.alerts?.map(a => ({
        senderName: a.sender_name,
        event: a.event,
        start: a.start,
        end: a.end,
        description: a.description,
        tags: a.tags,
        severity: this.inferSeverity(a.event)
      })),
      provider: 'openweather',
      fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Infer alert severity from event name
   */
  private inferSeverity(event: string): 'Minor' | 'Moderate' | 'Severe' | 'Extreme' {
    const eventLower = event.toLowerCase();
    
    if (eventLower.includes('extreme') || eventLower.includes('emergency') || 
        eventLower.includes('tornado') || eventLower.includes('hurricane')) {
      return 'Extreme';
    }
    if (eventLower.includes('severe') || eventLower.includes('warning')) {
      return 'Severe';
    }
    if (eventLower.includes('watch') || eventLower.includes('advisory')) {
      return 'Moderate';
    }
    return 'Minor';
  }
}

/**
 * Create an OpenWeather provider instance from environment variables
 */
export function createOpenWeatherProvider(): OpenWeatherProvider {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENWEATHER_API_KEY environment variable is required');
  }

  return new OpenWeatherProvider({
    apiKey,
    units: 'imperial', // Fahrenheit, mph
    timeout: parseInt(process.env.OPENWEATHER_TIMEOUT || '10000', 10)
  });
}
