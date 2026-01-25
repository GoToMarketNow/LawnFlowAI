// ============================================
// Weather Monitoring Workflow
// Long-running workflow that monitors weather and triggers child workflows
// ============================================

import {
  proxyActivities,
  sleep,
  continueAsNew,
  defineSignal,
  defineQuery,
  setHandler,
  workflowInfo,
  condition
} from '@temporalio/workflow';
import type * as activities from '../activities/weather';

// Proxy activities with appropriate timeouts
const {
  fetchWeatherForServiceAreaActivity,
  scoreJobsRiskActivity,
  checkWinterEventsActivity,
  recordMonitoringRunActivity
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    initialInterval: '5s',
    maximumAttempts: 3,
    backoffCoefficient: 2
  }
});

// Workflow input
export interface WeatherMonitoringInput {
  operatorId: number;
  serviceAreaId: number;
  config?: {
    dailySweepHour?: number;      // Hour for daily sweep (default: 6 AM)
    nearTermIntervalMin?: number;  // Minutes between near-term sweeps (default: 30)
    riskThresholdForPlan?: number; // Risk score to trigger planning (default: 70)
    maxIterationsBeforeContinue?: number; // Iterations before continue-as-new
  };
}

// Workflow state
interface MonitoringState {
  lastDailySweep: string | null;
  lastNearTermSweep: string | null;
  lastAlertCheck: string | null;
  plansTriggered: number;
  winterEventsDetected: number;
  totalJobsScanned: number;
  iterationCount: number;
  isRunning: boolean;
}

// Signals
export const pauseSignal = defineSignal('pause');
export const resumeSignal = defineSignal('resume');
export const forceCheckSignal = defineSignal<[{ checkType: 'daily' | 'near_term' | 'alerts' }]>('forceCheck');

// Queries
export const getStatusQuery = defineQuery<MonitoringState>('getStatus');

/**
 * Weather Monitoring Workflow
 * 
 * Continuously monitors weather conditions for a service area and triggers
 * child workflows when risk thresholds are crossed or winter events are detected.
 * 
 * Schedule:
 * - Daily sweep (7-10 day outlook): Once per day
 * - Near-term sweep (48h): Every 30-60 minutes (adaptive)
 * - Alert check: Event-driven when forced or on schedule
 * 
 * Uses continue-as-new to prevent history bloat.
 */
export async function WeatherMonitoringWorkflow(input: WeatherMonitoringInput): Promise<void> {
  const config = {
    dailySweepHour: input.config?.dailySweepHour ?? 6,
    nearTermIntervalMin: input.config?.nearTermIntervalMin ?? 30,
    riskThresholdForPlan: input.config?.riskThresholdForPlan ?? 70,
    maxIterationsBeforeContinue: input.config?.maxIterationsBeforeContinue ?? 100
  };

  // Initialize state
  const state: MonitoringState = {
    lastDailySweep: null,
    lastNearTermSweep: null,
    lastAlertCheck: null,
    plansTriggered: 0,
    winterEventsDetected: 0,
    totalJobsScanned: 0,
    iterationCount: 0,
    isRunning: true
  };

  // Force check request
  let forceCheckType: 'daily' | 'near_term' | 'alerts' | null = null;

  // Set up signal handlers
  setHandler(pauseSignal, () => {
    state.isRunning = false;
  });

  setHandler(resumeSignal, () => {
    state.isRunning = true;
  });

  setHandler(forceCheckSignal, ({ checkType }) => {
    forceCheckType = checkType;
  });

  // Set up query handler
  setHandler(getStatusQuery, () => state);

  // Main monitoring loop
  while (state.iterationCount < config.maxIterationsBeforeContinue) {
    // Wait if paused
    await condition(() => state.isRunning, '24 hours');

    const now = new Date();
    const currentHour = now.getUTCHours();
    const runStartTime = Date.now();

    let runType: 'DAILY' | 'NEAR_TERM' | 'ALERT' = 'NEAR_TERM';
    let jobsScanned = 0;
    let highRiskJobs = 0;
    let newPlans = 0;
    let newWinterEvents = 0;

    try {
      // Check if daily sweep is needed
      const needsDailySweep = forceCheckType === 'daily' || 
        (currentHour === config.dailySweepHour && 
         (!state.lastDailySweep || 
          new Date(state.lastDailySweep).getUTCDate() !== now.getUTCDate()));

      // Check if near-term sweep is needed
      const needsNearTermSweep = forceCheckType === 'near_term' ||
        !state.lastNearTermSweep ||
        (Date.now() - new Date(state.lastNearTermSweep).getTime()) > config.nearTermIntervalMin * 60 * 1000;

      // Check for alerts
      const needsAlertCheck = forceCheckType === 'alerts' ||
        !state.lastAlertCheck ||
        (Date.now() - new Date(state.lastAlertCheck).getTime()) > 15 * 60 * 1000; // Every 15 min

      // Reset force check
      forceCheckType = null;

      if (needsDailySweep) {
        // Daily sweep - 7-10 day outlook
        runType = 'DAILY';
        console.log(`[WeatherMonitoring] Running daily sweep for operator ${input.operatorId}`);

        const result = await fetchWeatherForServiceAreaActivity({
          operatorId: input.operatorId,
          serviceAreaId: input.serviceAreaId,
          horizonDays: 10
        });

        if (result.forecasts.length > 0) {
          const riskResult = await scoreJobsRiskActivity({
            operatorId: input.operatorId,
            serviceAreaId: input.serviceAreaId,
            forecasts: result.forecasts,
            horizonDays: 10
          });

          jobsScanned = riskResult.jobsScored;
          highRiskJobs = riskResult.highRiskJobs.length;
          state.totalJobsScanned += jobsScanned;

          // Check for winter events
          const winterResult = await checkWinterEventsActivity({
            operatorId: input.operatorId,
            serviceAreaId: input.serviceAreaId,
            forecasts: result.forecasts,
            alerts: result.alerts
          });

          newWinterEvents = winterResult.eventsDetected;
          state.winterEventsDetected += newWinterEvents;

          // Trigger planning workflow if high-risk jobs found
          if (riskResult.highRiskJobs.length > 0) {
            // Child workflow will be started by activity
            newPlans = 1;
            state.plansTriggered++;
          }
        }

        state.lastDailySweep = now.toISOString();

      } else if (needsNearTermSweep) {
        // Near-term sweep - 48h outlook
        runType = 'NEAR_TERM';
        console.log(`[WeatherMonitoring] Running near-term sweep for operator ${input.operatorId}`);

        const result = await fetchWeatherForServiceAreaActivity({
          operatorId: input.operatorId,
          serviceAreaId: input.serviceAreaId,
          horizonDays: 2
        });

        if (result.forecasts.length > 0) {
          const riskResult = await scoreJobsRiskActivity({
            operatorId: input.operatorId,
            serviceAreaId: input.serviceAreaId,
            forecasts: result.forecasts,
            horizonDays: 2
          });

          jobsScanned = riskResult.jobsScored;
          highRiskJobs = riskResult.highRiskJobs.length;
          state.totalJobsScanned += jobsScanned;

          // Trigger planning if needed
          if (riskResult.highRiskJobs.length > 0) {
            newPlans = 1;
            state.plansTriggered++;
          }
        }

        state.lastNearTermSweep = now.toISOString();

      } else if (needsAlertCheck) {
        // Alert check only
        runType = 'ALERT';
        console.log(`[WeatherMonitoring] Checking alerts for operator ${input.operatorId}`);

        const result = await fetchWeatherForServiceAreaActivity({
          operatorId: input.operatorId,
          serviceAreaId: input.serviceAreaId,
          horizonDays: 2,
          alertsOnly: true
        });

        if (result.alerts.length > 0) {
          const winterResult = await checkWinterEventsActivity({
            operatorId: input.operatorId,
            serviceAreaId: input.serviceAreaId,
            forecasts: [],
            alerts: result.alerts
          });

          newWinterEvents = winterResult.eventsDetected;
          state.winterEventsDetected += newWinterEvents;
        }

        state.lastAlertCheck = now.toISOString();
      }

      // Record the monitoring run
      await recordMonitoringRunActivity({
        operatorId: input.operatorId,
        serviceAreaId: input.serviceAreaId,
        runType,
        jobsScanned,
        highRiskJobs,
        plansTriggered: newPlans,
        winterEventsDetected: newWinterEvents,
        durationMs: Date.now() - runStartTime
      });

    } catch (error) {
      console.error(`[WeatherMonitoring] Error in monitoring loop:`, error);
      
      // Record failed run
      await recordMonitoringRunActivity({
        operatorId: input.operatorId,
        serviceAreaId: input.serviceAreaId,
        runType,
        jobsScanned: 0,
        highRiskJobs: 0,
        plansTriggered: 0,
        winterEventsDetected: 0,
        durationMs: Date.now() - runStartTime,
        error: String(error)
      });
    }

    state.iterationCount++;

    // Sleep until next check (adaptive based on risk level)
    const sleepMinutes = highRiskJobs > 0 ? 
      Math.max(10, config.nearTermIntervalMin / 2) : // More frequent if high risk
      config.nearTermIntervalMin;

    await sleep(`${sleepMinutes} minutes`);
  }

  // Continue as new to prevent history bloat
  console.log(`[WeatherMonitoring] Continuing as new after ${state.iterationCount} iterations`);
  await continueAsNew<typeof WeatherMonitoringWorkflow>({
    ...input,
    config
  });
}

// Workflow ID helper
export function getWeatherMonitoringWorkflowId(operatorId: number, serviceAreaId: number): string {
  return `WeatherMonitoringWorkflow:${operatorId}:${serviceAreaId}`;
}
