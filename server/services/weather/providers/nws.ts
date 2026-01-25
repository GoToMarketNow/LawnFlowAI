// ============================================
// National Weather Service (NWS) Alerts Provider
// Free US weather alerts API
// ============================================

import type { ForecastBundle, WeatherAlertSchema } from '../../../../shared/schema-weather';
import { encodeGeohash } from '../geohash';
import { z } from 'zod';

const NWS_BASE_URL = 'https://api.weather.gov';
const DEFAULT_TIMEOUT = 15000; // 15 seconds (NWS can be slow)
const USER_AGENT = 'LawnFlow/1.0 (contact@lawnflow.ai)';

// NWS Alert Response Types
interface NWSAlertProperties {
  id: string;
  areaDesc: string;
  sent: string;
  effective: string;
  onset: string;
  expires: string;
  ends: string;
  status: string;
  messageType: string;
  category: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  certainty: string;
  urgency: string;
  event: string;
  senderName: string;
  headline: string;
  description: string;
  instruction: string;
  response: string;
  parameters: Record<string, string[]>;
}

interface NWSAlertFeature {
  id: string;
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[][][] | null;
  } | null;
  properties: NWSAlertProperties;
}

interface NWSAlertsResponse {
  type: 'FeatureCollection';
  features: NWSAlertFeature[];
  title: string;
  updated: string;
}

interface NWSPointsResponse {
  properties: {
    gridId: string;
    gridX: number;
    gridY: number;
    forecast: string;
    forecastHourly: string;
    forecastGridData: string;
    observationStations: string;
    relativeLocation: {
      properties: {
        city: string;
        state: string;
      };
    };
    forecastZone: string;
    county: string;
    fireWeatherZone: string;
    timeZone: string;
  };
}

export interface NWSConfig {
  timeout?: number;
  userAgent?: string;
}

/**
 * National Weather Service API client for alerts and forecasts
 * Free to use, no API key required, but has rate limits
 */
export class NWSProvider {
  private timeout: number;
  private userAgent: string;
  private callCount: number = 0;

  constructor(config: NWSConfig = {}) {
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.userAgent = config.userAgent || USER_AGENT;
  }

  /**
   * Fetch active alerts for a location
   * @param lat Latitude
   * @param lon Longitude
   */
  async fetchAlerts(lat: number, lon: number): Promise<z.infer<typeof WeatherAlertSchema>[]> {
    // NWS expects point format for alerts
    const url = `${NWS_BASE_URL}/alerts/active?point=${lat},${lon}`;
    
    console.log(`[NWS] Fetching alerts for (${lat}, ${lon})`);
    this.callCount++;

    try {
      const response = await this.makeRequest(url);
      const data: NWSAlertsResponse = await response.json();

      return this.transformAlerts(data.features);
    } catch (error: any) {
      console.error(`[NWS] Error fetching alerts:`, error);
      return [];
    }
  }

  /**
   * Fetch active alerts for a state
   * @param state Two-letter state code (e.g., 'TX', 'CA')
   */
  async fetchStateAlerts(state: string): Promise<z.infer<typeof WeatherAlertSchema>[]> {
    const url = `${NWS_BASE_URL}/alerts/active/area/${state.toUpperCase()}`;
    
    console.log(`[NWS] Fetching alerts for state ${state}`);
    this.callCount++;

    try {
      const response = await this.makeRequest(url);
      const data: NWSAlertsResponse = await response.json();

      return this.transformAlerts(data.features);
    } catch (error: any) {
      console.error(`[NWS] Error fetching state alerts:`, error);
      return [];
    }
  }

  /**
   * Fetch active alerts for specific event types
   * @param eventTypes Array of event types (e.g., 'Winter Storm Warning', 'Tornado Warning')
   */
  async fetchAlertsByType(eventTypes: string[]): Promise<z.infer<typeof WeatherAlertSchema>[]> {
    const url = `${NWS_BASE_URL}/alerts/active?event=${eventTypes.join(',')}`;
    
    console.log(`[NWS] Fetching alerts for events: ${eventTypes.join(', ')}`);
    this.callCount++;

    try {
      const response = await this.makeRequest(url);
      const data: NWSAlertsResponse = await response.json();

      return this.transformAlerts(data.features);
    } catch (error: any) {
      console.error(`[NWS] Error fetching alerts by type:`, error);
      return [];
    }
  }

  /**
   * Get NWS grid point information for a location
   * This is needed to fetch detailed forecasts
   */
  async getGridPoint(lat: number, lon: number): Promise<NWSPointsResponse['properties'] | null> {
    const url = `${NWS_BASE_URL}/points/${lat},${lon}`;
    
    console.log(`[NWS] Getting grid point for (${lat}, ${lon})`);
    this.callCount++;

    try {
      const response = await this.makeRequest(url);
      const data: NWSPointsResponse = await response.json();
      return data.properties;
    } catch (error: any) {
      console.error(`[NWS] Error getting grid point:`, error);
      return null;
    }
  }

  /**
   * Fetch hourly forecast for a location
   * Note: NWS forecasts are only available for US locations
   */
  async fetchHourlyForecast(lat: number, lon: number): Promise<any | null> {
    const gridPoint = await this.getGridPoint(lat, lon);
    if (!gridPoint) return null;

    console.log(`[NWS] Fetching hourly forecast from ${gridPoint.forecastHourly}`);
    this.callCount++;

    try {
      const response = await this.makeRequest(gridPoint.forecastHourly);
      return await response.json();
    } catch (error: any) {
      console.error(`[NWS] Error fetching hourly forecast:`, error);
      return null;
    }
  }

  /**
   * Get specific winter weather alerts
   * Useful for winter campaign detection
   */
  async fetchWinterAlerts(states?: string[]): Promise<z.infer<typeof WeatherAlertSchema>[]> {
    const winterEvents = [
      'Winter Storm Warning',
      'Winter Storm Watch',
      'Winter Weather Advisory',
      'Ice Storm Warning',
      'Blizzard Warning',
      'Blizzard Watch',
      'Freezing Rain Advisory',
      'Freeze Warning',
      'Freeze Watch',
      'Frost Advisory',
      'Wind Chill Warning',
      'Wind Chill Watch',
      'Wind Chill Advisory'
    ];

    let url = `${NWS_BASE_URL}/alerts/active?event=${winterEvents.map(e => encodeURIComponent(e)).join(',')}`;
    
    if (states && states.length > 0) {
      url += `&area=${states.join(',')}`;
    }

    console.log(`[NWS] Fetching winter alerts`);
    this.callCount++;

    try {
      const response = await this.makeRequest(url);
      const data: NWSAlertsResponse = await response.json();

      return this.transformAlerts(data.features);
    } catch (error: any) {
      console.error(`[NWS] Error fetching winter alerts:`, error);
      return [];
    }
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
   * Make HTTP request with proper headers and timeout
   */
  private async makeRequest(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/geo+json',
          'User-Agent': this.userAgent
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`NWS API error ${response.status}`);
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`NWS API timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Transform NWS alert features to our schema
   */
  private transformAlerts(features: NWSAlertFeature[]): z.infer<typeof WeatherAlertSchema>[] {
    return features.map(f => ({
      senderName: f.properties.senderName,
      event: f.properties.event,
      start: new Date(f.properties.onset || f.properties.effective).getTime() / 1000,
      end: new Date(f.properties.ends || f.properties.expires).getTime() / 1000,
      description: f.properties.description,
      tags: this.extractTags(f.properties),
      severity: f.properties.severity === 'Unknown' ? 'Minor' : f.properties.severity
    }));
  }

  /**
   * Extract relevant tags from alert properties
   */
  private extractTags(props: NWSAlertProperties): string[] {
    const tags: string[] = [];
    
    // Add event category
    if (props.category) tags.push(props.category);
    
    // Add urgency
    if (props.urgency) tags.push(props.urgency);
    
    // Add certainty
    if (props.certainty) tags.push(props.certainty);

    // Extract weather types from event name
    const event = props.event.toLowerCase();
    if (event.includes('snow') || event.includes('blizzard')) tags.push('SNOW');
    if (event.includes('ice')) tags.push('ICE');
    if (event.includes('freeze') || event.includes('frost')) tags.push('FREEZE');
    if (event.includes('rain')) tags.push('RAIN');
    if (event.includes('wind')) tags.push('WIND');
    if (event.includes('tornado')) tags.push('TORNADO');
    if (event.includes('thunder') || event.includes('lightning')) tags.push('LIGHTNING');
    if (event.includes('flood')) tags.push('FLOOD');
    if (event.includes('heat')) tags.push('HEAT');

    return [...new Set(tags)];
  }
}

/**
 * Create an NWS provider instance
 */
export function createNWSProvider(): NWSProvider {
  return new NWSProvider({
    timeout: parseInt(process.env.NWS_TIMEOUT || '15000', 10),
    userAgent: process.env.NWS_USER_AGENT || USER_AGENT
  });
}

/**
 * Check if a location is in the US (NWS only works for US)
 */
export function isUSLocation(lat: number, lon: number): boolean {
  // Rough bounding box for continental US + Alaska + Hawaii
  const continentalUS = lat >= 24.5 && lat <= 49.5 && lon >= -125 && lon <= -66.5;
  const alaska = lat >= 51 && lat <= 72 && lon >= -180 && lon <= -130;
  const hawaii = lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154;
  
  return continentalUS || alaska || hawaii;
}
