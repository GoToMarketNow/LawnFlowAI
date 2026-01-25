import type { JobRequest } from "@shared/schema";
import { 
  type ScheduleProposeResult, 
  ScheduleProposeResultSchema,
  type OrchestrationContext,
  type TimeWindow,
  validateAgentResult,
} from "@shared/orchestrator/contracts";
import { log } from "../logger";
import { getWeatherProviderService } from "../../../services/weather/providerService";
import { RiskScorer } from "../../../services/weather/riskScorer";
import type { RiskTier, ForecastBundle } from "../../../../shared/schema-weather";

// Extended TimeWindow with weather risk info
export interface TimeWindowWithRisk extends TimeWindow {
  weatherRisk?: {
    riskTier: RiskTier;
    riskScore: number;
    primaryDriver?: string;
  };
}

function generateTimeWindows(count: number = 3): TimeWindow[] {
  const windows: TimeWindow[] = [];
  const now = new Date();
  
  // Start from tomorrow
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(8, 0, 0, 0); // 8 AM

  let daysAdded = 0;
  let windowsCreated = 0;

  while (windowsCreated < count && daysAdded < 14) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + daysAdded);
    
    const dayOfWeek = checkDate.getDay();
    
    // Skip Sundays (day 0)
    if (dayOfWeek !== 0) {
      // Morning window (8 AM - 12 PM)
      if (windowsCreated < count) {
        const morningStart = new Date(checkDate);
        morningStart.setHours(8, 0, 0, 0);
        
        const morningEnd = new Date(checkDate);
        morningEnd.setHours(12, 0, 0, 0);
        
        windows.push({
          startISO: morningStart.toISOString(),
          endISO: morningEnd.toISOString(),
        });
        windowsCreated++;
      }
      
      // Afternoon window (1 PM - 5 PM) - only if we need more
      if (windowsCreated < count && daysAdded < 3) {
        const afternoonStart = new Date(checkDate);
        afternoonStart.setHours(13, 0, 0, 0);
        
        const afternoonEnd = new Date(checkDate);
        afternoonEnd.setHours(17, 0, 0, 0);
        
        windows.push({
          startISO: afternoonStart.toISOString(),
          endISO: afternoonEnd.toISOString(),
        });
        windowsCreated++;
      }
    }
    
    daysAdded++;
  }

  return windows.slice(0, count);
}

/**
 * Assess weather risk for proposed time windows
 */
async function assessWeatherRiskForWindows(
  windows: TimeWindow[],
  lat: number | null,
  lon: number | null,
  operatorId?: number
): Promise<TimeWindowWithRisk[]> {
  // If no location, return windows without risk assessment
  if (!lat || !lon) {
    return windows;
  }

  try {
    const weatherService = getWeatherProviderService();
    const forecast = await weatherService.fetchForecast({
      lat,
      lon,
      operatorId
    });

    if (!forecast) {
      log("warn", "Could not fetch weather forecast for risk assessment");
      return windows;
    }

    const scorer = new RiskScorer();
    const windowsWithRisk: TimeWindowWithRisk[] = [];

    for (const window of windows) {
      const startDate = new Date(window.startISO);
      const endDate = new Date(window.endISO);

      // Create a job-like object for scoring
      const jobInfo = {
        id: 0, // Placeholder for proposed window
        scheduledStart: startDate,
        scheduledEnd: endDate,
        lat,
        lon
      };

      // Create forecast map for scorer
      const forecastMap = new Map<string, ForecastBundle>();
      forecastMap.set(forecast.geohash, forecast);

      const assessments = scorer.scoreJobs([jobInfo], forecastMap);
      const assessment = assessments[0];

      if (assessment) {
        windowsWithRisk.push({
          ...window,
          weatherRisk: {
            riskTier: assessment.riskTier,
            riskScore: assessment.riskScore,
            primaryDriver: assessment.drivers[0]?.type
          }
        });
      } else {
        windowsWithRisk.push(window);
      }
    }

    return windowsWithRisk;
  } catch (error) {
    log("error", "Error assessing weather risk for windows", { error });
    return windows;
  }
}

/**
 * Filter and sort windows by weather risk
 * Prioritize low-risk windows, flag high-risk ones
 */
function prioritizeByWeatherRisk(
  windows: TimeWindowWithRisk[],
  maxCount: number = 3
): { windows: TimeWindowWithRisk[]; hasHighRisk: boolean; allHighRisk: boolean } {
  // Separate by risk level
  const lowRisk = windows.filter(w => !w.weatherRisk || w.weatherRisk.riskTier === 'LOW');
  const medRisk = windows.filter(w => w.weatherRisk?.riskTier === 'MED');
  const highRisk = windows.filter(w => w.weatherRisk?.riskTier === 'HIGH' || w.weatherRisk?.riskTier === 'STOP');

  // Prioritize low risk, then medium, then high (but flag them)
  const prioritized = [...lowRisk, ...medRisk, ...highRisk].slice(0, maxCount);

  const hasHighRisk = prioritized.some(w => w.weatherRisk?.riskTier === 'HIGH' || w.weatherRisk?.riskTier === 'STOP');
  const allHighRisk = prioritized.every(w => w.weatherRisk?.riskTier === 'HIGH' || w.weatherRisk?.riskTier === 'STOP');

  return { windows: prioritized, hasHighRisk, allHighRisk };
}

export async function runScheduleProposeAgent(
  jobRequest: JobRequest,
  context: OrchestrationContext
): Promise<ScheduleProposeResult> {
  log("debug", "Running schedule propose agent", { jobRequestId: jobRequest.id });

  // Generate more windows than needed to allow for filtering
  const candidateWindows = generateTimeWindows(6);

  // Get job location for weather assessment
  const lat = (jobRequest as any).lat || context.jobLat || null;
  const lon = (jobRequest as any).lon || context.jobLon || null;
  const operatorId = jobRequest.operatorId;

  // Assess weather risk for each window
  const windowsWithRisk = await assessWeatherRiskForWindows(
    candidateWindows,
    lat,
    lon,
    operatorId
  );

  // Prioritize by weather risk
  const { windows: proposedWindows, hasHighRisk, allHighRisk } = prioritizeByWeatherRisk(windowsWithRisk, 3);

  // Log weather risk assessment
  if (hasHighRisk) {
    log("info", "Schedule propose: some windows have weather risk", {
      jobRequestId: jobRequest.id,
      windowRisks: proposedWindows.map(w => ({
        start: w.startISO,
        risk: w.weatherRisk
      }))
    });
  }

  // Determine confidence based on weather risk
  let confidence: "high" | "medium" | "low" = proposedWindows.length >= 2 ? "high" : "medium";
  if (allHighRisk) {
    confidence = "low";
  } else if (hasHighRisk) {
    confidence = "medium";
  }

  const result: ScheduleProposeResult = {
    proposedWindows: proposedWindows.map(w => ({
      startISO: w.startISO,
      endISO: w.endISO,
      // Include weather risk metadata in the window if schema supports it
      ...(w.weatherRisk && { weatherRisk: w.weatherRisk })
    })),
    deliveryChannel: "sms",
    confidence,
    // Add weather warning if applicable
    ...(hasHighRisk && {
      weatherWarning: allHighRisk 
        ? "All proposed times have weather risks. Consider waiting for updated forecast."
        : "Some time slots have weather concerns. Low-risk options are listed first."
    })
  };

  return validateAgentResult(ScheduleProposeResultSchema, result, "scheduleProposeAgent");
}

// Helper to parse customer selection
export function parseScheduleSelection(
  message: string,
  proposedWindows: TimeWindow[]
): { selected: boolean; windowIndex?: number } {
  const lowerMessage = message.toLowerCase().trim();

  // Check for option numbers
  if (lowerMessage.includes("1") || lowerMessage.includes("first") || lowerMessage.includes("option 1")) {
    return { selected: true, windowIndex: 0 };
  }
  if (lowerMessage.includes("2") || lowerMessage.includes("second") || lowerMessage.includes("option 2")) {
    return { selected: true, windowIndex: 1 };
  }
  if (lowerMessage.includes("3") || lowerMessage.includes("third") || lowerMessage.includes("option 3")) {
    return { selected: true, windowIndex: 2 };
  }

  // Check for day references
  for (let i = 0; i < proposedWindows.length; i++) {
    const windowDate = new Date(proposedWindows[i].startISO);
    const dayName = windowDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    
    if (lowerMessage.includes(dayName)) {
      return { selected: true, windowIndex: i };
    }
  }

  return { selected: false };
}
