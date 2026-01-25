// ============================================
// Weather Risk Scorer
// Assess job risk based on weather conditions
// ============================================

import type { 
  WeatherRisk, 
  WeatherDriver, 
  RiskTier, 
  ForecastBundle,
  HourlyForecastSchema 
} from '../../../shared/schema-weather';
import { z } from 'zod';

// Risk thresholds (configurable via environment)
export interface RiskThresholds {
  // Precipitation
  rainLightMm: number;      // Light rain threshold (mm/h)
  rainModerateMm: number;   // Moderate rain threshold
  rainHeavyMm: number;      // Heavy rain threshold
  
  // Snow
  snowLightMm: number;      // Light snow threshold
  snowModerateMm: number;   // Moderate snow threshold
  snowHeavyMm: number;      // Heavy snow threshold
  
  // Wind
  windModerateMph: number;  // Moderate wind
  windHighMph: number;      // High wind
  windDangerousMph: number; // Dangerous wind
  
  // Temperature
  heatIndexHigh: number;    // High heat index (°F)
  heatIndexDangerous: number;
  coldTemp: number;         // Cold temperature (°F)
  freezeTemp: number;       // Freezing
  
  // Probability thresholds
  popMedium: number;        // Probability of precipitation - medium
  popHigh: number;          // Probability of precipitation - high
  
  // Lightning risk (based on weather codes)
  lightningCodes: number[]; // OpenWeather codes indicating thunderstorms
  
  // Overall risk tier thresholds
  riskMedThreshold: number;  // Score above this = MED
  riskHighThreshold: number; // Score above this = HIGH
  riskStopThreshold: number; // Score above this = STOP
}

const DEFAULT_THRESHOLDS: RiskThresholds = {
  // Precipitation (mm/h)
  rainLightMm: 2.5,
  rainModerateMm: 7.5,
  rainHeavyMm: 15,
  
  // Snow (mm/h)
  snowLightMm: 2,
  snowModerateMm: 5,
  snowHeavyMm: 10,
  
  // Wind (mph)
  windModerateMph: 15,
  windHighMph: 25,
  windDangerousMph: 40,
  
  // Temperature (°F)
  heatIndexHigh: 95,
  heatIndexDangerous: 105,
  coldTemp: 35,
  freezeTemp: 32,
  
  // Probability
  popMedium: 0.4,
  popHigh: 0.7,
  
  // Lightning codes (OpenWeather)
  lightningCodes: [200, 201, 202, 210, 211, 212, 221, 230, 231, 232],
  
  // Risk tiers
  riskMedThreshold: parseInt(process.env.WEATHER_RISK_THRESHOLD_MED || '40', 10),
  riskHighThreshold: parseInt(process.env.WEATHER_RISK_THRESHOLD_HIGH || '70', 10),
  riskStopThreshold: parseInt(process.env.WEATHER_RISK_THRESHOLD_STOP || '90', 10)
};

export interface JobInfo {
  id: number;
  scheduledStart: Date;
  scheduledEnd: Date;
  serviceType?: string;
  lat: number;
  lon: number;
  operatorId?: number;
  serviceAreaId?: number;
}

export interface ScoringContext {
  operatorPolicies?: {
    rainTolerance?: 'low' | 'medium' | 'high';
    windTolerance?: 'low' | 'medium' | 'high';
    allowWinterWork?: boolean;
  };
  serviceRequirements?: {
    requiresDryGround?: boolean;
    requiresMinTemp?: number;
    requiresMaxTemp?: number;
  };
}

/**
 * Weather Risk Scorer
 * Analyzes forecast data and produces risk assessments for jobs
 */
export class RiskScorer {
  private thresholds: RiskThresholds;

  constructor(thresholds: Partial<RiskThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Score risk for a job given forecast data
   */
  scoreJob(
    job: JobInfo,
    forecast: ForecastBundle,
    context: ScoringContext = {}
  ): WeatherRisk {
    const drivers: WeatherDriver[] = [];
    let totalScore = 0;

    // Get relevant forecast hours for job window
    const relevantHours = this.getRelevantHours(
      forecast.hourly,
      job.scheduledStart,
      job.scheduledEnd
    );

    if (relevantHours.length === 0) {
      // No forecast data for job window - medium confidence warning
      return this.createRiskAssessment(job, 30, drivers, 0.3, forecast);
    }

    // Analyze each weather factor
    const rainScore = this.scoreRain(relevantHours, drivers, context);
    const snowScore = this.scoreSnow(relevantHours, drivers, context);
    const windScore = this.scoreWind(relevantHours, drivers, context);
    const tempScore = this.scoreTemperature(relevantHours, drivers, context);
    const lightningScore = this.scoreLightning(relevantHours, drivers);
    const alertScore = this.scoreAlerts(forecast.alerts || [], job, drivers);

    // Calculate weighted total
    totalScore = Math.min(100, Math.round(
      rainScore * 0.25 +
      snowScore * 0.20 +
      windScore * 0.20 +
      tempScore * 0.10 +
      lightningScore * 0.15 +
      alertScore * 0.10
    ));

    // Calculate confidence based on forecast age and horizon
    const confidence = this.calculateConfidence(forecast, job.scheduledStart);

    return this.createRiskAssessment(job, totalScore, drivers, confidence, forecast);
  }

  /**
   * Batch score multiple jobs
   */
  scoreJobs(
    jobs: JobInfo[],
    forecastMap: Map<string, ForecastBundle>,
    context: ScoringContext = {}
  ): WeatherRisk[] {
    const results: WeatherRisk[] = [];

    for (const job of jobs) {
      // Find matching forecast by geohash
      const geohash = this.getGeohashForLocation(job.lat, job.lon);
      const forecast = forecastMap.get(geohash);

      if (forecast) {
        results.push(this.scoreJob(job, forecast, context));
      } else {
        // No forecast available - return unknown risk
        results.push({
          jobId: job.id,
          start: job.scheduledStart.toISOString(),
          end: job.scheduledEnd.toISOString(),
          riskScore: 50,
          riskTier: 'MED',
          drivers: [{ type: 'RAIN', value: 0, threshold: 0, description: 'No forecast data available' }],
          confidence: 0,
          forecastVersion: 'unknown',
          assessedAt: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * Score rain risk
   */
  private scoreRain(
    hours: z.infer<typeof HourlyForecastSchema>[],
    drivers: WeatherDriver[],
    context: ScoringContext
  ): number {
    let maxRain = 0;
    let avgPop = 0;

    for (const hour of hours) {
      if (hour.rain && hour.rain > maxRain) maxRain = hour.rain;
      avgPop += hour.pop;
    }
    avgPop = avgPop / hours.length;

    // Adjust thresholds based on operator tolerance
    let thresholdMultiplier = 1;
    if (context.operatorPolicies?.rainTolerance === 'high') thresholdMultiplier = 1.5;
    if (context.operatorPolicies?.rainTolerance === 'low') thresholdMultiplier = 0.7;

    let score = 0;

    // Score based on rain amount
    if (maxRain >= this.thresholds.rainHeavyMm * thresholdMultiplier) {
      score += 80;
      drivers.push({
        type: 'RAIN',
        value: maxRain,
        threshold: this.thresholds.rainHeavyMm,
        unit: 'mm/h',
        description: 'Heavy rain expected'
      });
    } else if (maxRain >= this.thresholds.rainModerateMm * thresholdMultiplier) {
      score += 50;
      drivers.push({
        type: 'RAIN',
        value: maxRain,
        threshold: this.thresholds.rainModerateMm,
        unit: 'mm/h',
        description: 'Moderate rain expected'
      });
    } else if (maxRain >= this.thresholds.rainLightMm * thresholdMultiplier) {
      score += 20;
      drivers.push({
        type: 'RAIN',
        value: maxRain,
        threshold: this.thresholds.rainLightMm,
        unit: 'mm/h',
        description: 'Light rain possible'
      });
    }

    // Add probability factor
    if (avgPop >= this.thresholds.popHigh) {
      score += 20;
    } else if (avgPop >= this.thresholds.popMedium) {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Score snow risk
   */
  private scoreSnow(
    hours: z.infer<typeof HourlyForecastSchema>[],
    drivers: WeatherDriver[],
    context: ScoringContext
  ): number {
    let maxSnow = 0;

    for (const hour of hours) {
      if (hour.snow && hour.snow > maxSnow) maxSnow = hour.snow;
    }

    if (maxSnow === 0) return 0;

    // Check if operator allows winter work
    if (context.operatorPolicies?.allowWinterWork === false) {
      drivers.push({
        type: 'SNOW',
        value: maxSnow,
        threshold: 0,
        unit: 'mm/h',
        description: 'Snow conditions - winter work disabled'
      });
      return 100;
    }

    let score = 0;

    if (maxSnow >= this.thresholds.snowHeavyMm) {
      score = 100;
      drivers.push({
        type: 'SNOW',
        value: maxSnow,
        threshold: this.thresholds.snowHeavyMm,
        unit: 'mm/h',
        description: 'Heavy snow expected'
      });
    } else if (maxSnow >= this.thresholds.snowModerateMm) {
      score = 70;
      drivers.push({
        type: 'SNOW',
        value: maxSnow,
        threshold: this.thresholds.snowModerateMm,
        unit: 'mm/h',
        description: 'Moderate snow expected'
      });
    } else if (maxSnow >= this.thresholds.snowLightMm) {
      score = 40;
      drivers.push({
        type: 'SNOW',
        value: maxSnow,
        threshold: this.thresholds.snowLightMm,
        unit: 'mm/h',
        description: 'Light snow possible'
      });
    }

    return score;
  }

  /**
   * Score wind risk
   */
  private scoreWind(
    hours: z.infer<typeof HourlyForecastSchema>[],
    drivers: WeatherDriver[],
    context: ScoringContext
  ): number {
    let maxWind = 0;
    let maxGust = 0;

    for (const hour of hours) {
      if (hour.windSpeed > maxWind) maxWind = hour.windSpeed;
      if (hour.windGust && hour.windGust > maxGust) maxGust = hour.windGust;
    }

    const effectiveWind = Math.max(maxWind, maxGust);

    // Adjust for tolerance
    let thresholdMultiplier = 1;
    if (context.operatorPolicies?.windTolerance === 'high') thresholdMultiplier = 1.3;
    if (context.operatorPolicies?.windTolerance === 'low') thresholdMultiplier = 0.8;

    let score = 0;

    if (effectiveWind >= this.thresholds.windDangerousMph * thresholdMultiplier) {
      score = 100;
      drivers.push({
        type: 'WIND',
        value: effectiveWind,
        threshold: this.thresholds.windDangerousMph,
        unit: 'mph',
        description: 'Dangerous wind conditions'
      });
    } else if (effectiveWind >= this.thresholds.windHighMph * thresholdMultiplier) {
      score = 60;
      drivers.push({
        type: 'WIND',
        value: effectiveWind,
        threshold: this.thresholds.windHighMph,
        unit: 'mph',
        description: 'High wind expected'
      });
    } else if (effectiveWind >= this.thresholds.windModerateMph * thresholdMultiplier) {
      score = 25;
      drivers.push({
        type: 'WIND',
        value: effectiveWind,
        threshold: this.thresholds.windModerateMph,
        unit: 'mph',
        description: 'Moderate wind expected'
      });
    }

    return score;
  }

  /**
   * Score temperature risk
   */
  private scoreTemperature(
    hours: z.infer<typeof HourlyForecastSchema>[],
    drivers: WeatherDriver[],
    context: ScoringContext
  ): number {
    let minTemp = Infinity;
    let maxTemp = -Infinity;

    for (const hour of hours) {
      if (hour.temp < minTemp) minTemp = hour.temp;
      if (hour.temp > maxTemp) maxTemp = hour.temp;
    }

    let score = 0;

    // Check for dangerous heat
    if (maxTemp >= this.thresholds.heatIndexDangerous) {
      score += 80;
      drivers.push({
        type: 'HEAT',
        value: maxTemp,
        threshold: this.thresholds.heatIndexDangerous,
        unit: '°F',
        description: 'Dangerous heat conditions'
      });
    } else if (maxTemp >= this.thresholds.heatIndexHigh) {
      score += 40;
      drivers.push({
        type: 'HEAT',
        value: maxTemp,
        threshold: this.thresholds.heatIndexHigh,
        unit: '°F',
        description: 'High heat advisory'
      });
    }

    // Check for freezing conditions
    if (minTemp <= this.thresholds.freezeTemp) {
      score += 60;
      drivers.push({
        type: 'FREEZE',
        value: minTemp,
        threshold: this.thresholds.freezeTemp,
        unit: '°F',
        description: 'Freezing conditions'
      });
    } else if (minTemp <= this.thresholds.coldTemp) {
      score += 20;
    }

    // Check service requirements
    if (context.serviceRequirements?.requiresMinTemp && minTemp < context.serviceRequirements.requiresMinTemp) {
      score += 30;
    }
    if (context.serviceRequirements?.requiresMaxTemp && maxTemp > context.serviceRequirements.requiresMaxTemp) {
      score += 30;
    }

    return Math.min(100, score);
  }

  /**
   * Score lightning risk
   */
  private scoreLightning(
    hours: z.infer<typeof HourlyForecastSchema>[],
    drivers: WeatherDriver[]
  ): number {
    let hasLightning = false;

    for (const hour of hours) {
      for (const w of hour.weather) {
        if (this.thresholds.lightningCodes.includes(w.id)) {
          hasLightning = true;
          break;
        }
      }
      if (hasLightning) break;
    }

    if (hasLightning) {
      drivers.push({
        type: 'LIGHTNING',
        value: 1,
        threshold: 0,
        description: 'Thunderstorm risk - outdoor work unsafe'
      });
      return 100;
    }

    return 0;
  }

  /**
   * Score based on active alerts
   */
  private scoreAlerts(
    alerts: NonNullable<ForecastBundle['alerts']>,
    job: JobInfo,
    drivers: WeatherDriver[]
  ): number {
    let score = 0;
    const jobStart = job.scheduledStart.getTime() / 1000;
    const jobEnd = job.scheduledEnd.getTime() / 1000;

    for (const alert of alerts) {
      // Check if alert overlaps with job window
      if (alert.start <= jobEnd && alert.end >= jobStart) {
        switch (alert.severity) {
          case 'Extreme':
            score = 100;
            break;
          case 'Severe':
            score = Math.max(score, 80);
            break;
          case 'Moderate':
            score = Math.max(score, 50);
            break;
          case 'Minor':
            score = Math.max(score, 25);
            break;
        }

        // Add driver for the alert
        const alertType = this.getDriverTypeFromAlert(alert.event);
        if (alertType) {
          drivers.push({
            type: alertType,
            value: 1,
            threshold: 0,
            description: alert.event
          });
        }
      }
    }

    return score;
  }

  /**
   * Get relevant forecast hours for job window
   */
  private getRelevantHours(
    hourly: z.infer<typeof HourlyForecastSchema>[],
    start: Date,
    end: Date
  ): z.infer<typeof HourlyForecastSchema>[] {
    const startTs = start.getTime() / 1000;
    const endTs = end.getTime() / 1000;

    return hourly.filter(h => h.dt >= startTs && h.dt <= endTs);
  }

  /**
   * Calculate confidence based on forecast freshness and horizon
   */
  private calculateConfidence(forecast: ForecastBundle, jobStart: Date): number {
    const fetchedAt = new Date(forecast.fetchedAt).getTime();
    const now = Date.now();
    const jobTime = jobStart.getTime();

    // Age penalty: -0.1 per hour since fetch
    const ageHours = (now - fetchedAt) / (1000 * 60 * 60);
    const agePenalty = Math.min(0.3, ageHours * 0.05);

    // Horizon penalty: -0.1 per day out
    const horizonDays = (jobTime - now) / (1000 * 60 * 60 * 24);
    const horizonPenalty = Math.min(0.4, horizonDays * 0.05);

    return Math.max(0.2, 1 - agePenalty - horizonPenalty);
  }

  /**
   * Create the final risk assessment
   */
  private createRiskAssessment(
    job: JobInfo,
    score: number,
    drivers: WeatherDriver[],
    confidence: number,
    forecast: ForecastBundle
  ): WeatherRisk {
    let tier: RiskTier;
    
    if (score >= this.thresholds.riskStopThreshold) {
      tier = 'STOP';
    } else if (score >= this.thresholds.riskHighThreshold) {
      tier = 'HIGH';
    } else if (score >= this.thresholds.riskMedThreshold) {
      tier = 'MED';
    } else {
      tier = 'LOW';
    }

    return {
      jobId: job.id,
      start: job.scheduledStart.toISOString(),
      end: job.scheduledEnd.toISOString(),
      riskScore: score,
      riskTier: tier,
      drivers,
      confidence,
      forecastVersion: `${forecast.provider}:${forecast.fetchedAt}`,
      assessedAt: new Date().toISOString()
    };
  }

  /**
   * Get driver type from alert event name
   */
  private getDriverTypeFromAlert(event: string): WeatherDriver['type'] | null {
    const eventLower = event.toLowerCase();
    
    if (eventLower.includes('snow') || eventLower.includes('blizzard')) return 'SNOW';
    if (eventLower.includes('ice') || eventLower.includes('sleet')) return 'ICE';
    if (eventLower.includes('freeze') || eventLower.includes('frost')) return 'FREEZE';
    if (eventLower.includes('rain') || eventLower.includes('flood')) return 'RAIN';
    if (eventLower.includes('wind')) return 'WIND';
    if (eventLower.includes('thunder') || eventLower.includes('lightning')) return 'LIGHTNING';
    if (eventLower.includes('heat')) return 'HEAT';
    
    return null;
  }

  /**
   * Simple geohash encoding (uses external function in real implementation)
   */
  private getGeohashForLocation(lat: number, lon: number): string {
    // Import from geohash module in real implementation
    const { encodeGeohash } = require('./geohash');
    return encodeGeohash(lat, lon, 6);
  }
}

// Export singleton factory
export function createRiskScorer(thresholds?: Partial<RiskThresholds>): RiskScorer {
  return new RiskScorer(thresholds);
}
