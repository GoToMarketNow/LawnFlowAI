// ============================================
// Weather API Service for Mobile
// React Query hooks for weather data
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// Types
export interface WeatherForecast {
  lat: number;
  lon: number;
  timezone: string;
  current?: {
    temp: number;
    humidity: number;
    windSpeed: number;
    feelsLike?: number;
    uvIndex?: number;
    visibility?: number;
    weather: Array<{ main: string; description: string }>;
  };
  hourly: Array<{
    dt: number;
    temp: number;
    pop: number;
    rain?: number;
    snow?: number;
    windSpeed: number;
    weather: Array<{ main: string; description: string }>;
  }>;
  daily: Array<{
    dt: number;
    temp: { min: number; max: number; day: number };
    pop: number;
    rain?: number;
    snow?: number;
    weather: Array<{ main: string; description: string }>;
  }>;
  alerts?: Array<{
    event: string;
    severity: string;
    start: number;
    end: number;
    description: string;
  }>;
}

export interface WeatherRiskAssessment {
  id: number;
  jobId: number;
  riskScore: number;
  riskTier: 'LOW' | 'MED' | 'HIGH' | 'STOP';
  drivers: Array<{
    type: string;
    value: number;
    threshold: number;
    description?: string;
  }>;
  confidence: number;
  jobStart: string;
  jobEnd: string;
}

export interface ScheduleChangeNotification {
  id: string;
  jobId: number;
  customerName?: string;
  originalStart: string;
  originalEnd: string;
  newStart: string;
  newEnd: string;
  reason: string;
  weatherSummary?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
}

export interface WinterServiceOffer {
  id: string;
  eventType: string;
  serviceType: string;
  price: number;
  windowStart: string;
  windowEnd: string;
  description: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  createdAt: string;
}

// API functions
async function fetchWeatherForecast(serviceAreaId: number): Promise<WeatherForecast | null> {
  try {
    const response = await apiClient.get(`/weather/forecast/${serviceAreaId}`);
    return response.data.forecast;
  } catch (error) {
    console.error('Failed to fetch weather forecast:', error);
    return null;
  }
}

async function fetchJobRiskAssessments(params?: {
  serviceAreaId?: number;
  riskTier?: string;
}): Promise<{ assessments: WeatherRiskAssessment[]; summary: any }> {
  const queryParams = new URLSearchParams();
  if (params?.serviceAreaId) queryParams.set('serviceAreaId', params.serviceAreaId.toString());
  if (params?.riskTier) queryParams.set('riskTier', params.riskTier);

  const response = await apiClient.get(`/weather/risk/jobs?${queryParams.toString()}`);
  return response.data;
}

async function fetchWeatherAlerts(serviceAreaId?: number): Promise<any[]> {
  const url = serviceAreaId 
    ? `/weather/alerts?serviceAreaId=${serviceAreaId}`
    : '/weather/alerts';
  const response = await apiClient.get(url);
  return response.data.alerts || [];
}

async function fetchScheduleChangeNotifications(): Promise<ScheduleChangeNotification[]> {
  // In production, this would fetch from API
  // For now, return from local storage or mock
  return [];
}

async function respondToScheduleChange(
  changeId: string,
  response: 'ACCEPT' | 'DECLINE',
  reason?: string
): Promise<void> {
  await apiClient.post(`/weather/schedule-changes/${changeId}/respond`, {
    response,
    reason
  });
}

async function fetchWinterServiceOffers(): Promise<WinterServiceOffer[]> {
  // In production, this would fetch from API
  return [];
}

async function respondToWinterOffer(
  offerId: string,
  response: 'ACCEPT' | 'DECLINE',
  preferredWindow?: { start: string; end: string }
): Promise<void> {
  await apiClient.post(`/weather/winter-offers/${offerId}/respond`, {
    response,
    preferredWindow
  });
}

// ============================================
// React Query Hooks
// ============================================

/**
 * Hook to fetch weather forecast for a service area
 */
export function useWeatherForecast(serviceAreaId: number) {
  return useQuery({
    queryKey: ['weather-forecast', serviceAreaId],
    queryFn: () => fetchWeatherForecast(serviceAreaId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000 // Refresh every 10 minutes
  });
}

/**
 * Hook to fetch job risk assessments
 */
export function useJobRiskAssessments(params?: {
  serviceAreaId?: number;
  riskTier?: string;
}) {
  return useQuery({
    queryKey: ['job-risk-assessments', params],
    queryFn: () => fetchJobRiskAssessments(params),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000
  });
}

/**
 * Hook to fetch active weather alerts
 */
export function useActiveAlerts(serviceAreaId?: number) {
  return useQuery({
    queryKey: ['weather-alerts', serviceAreaId],
    queryFn: () => fetchWeatherAlerts(serviceAreaId),
    staleTime: 2 * 60 * 1000, // 2 minutes for alerts
    refetchInterval: 5 * 60 * 1000
  });
}

/**
 * Hook to fetch schedule change notifications for customer
 */
export function useScheduleChangeNotifications() {
  return useQuery({
    queryKey: ['schedule-change-notifications'],
    queryFn: fetchScheduleChangeNotifications,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000
  });
}

/**
 * Hook to respond to a schedule change
 */
export function useRespondToScheduleChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      changeId, 
      response, 
      reason 
    }: { 
      changeId: string; 
      response: 'ACCEPT' | 'DECLINE'; 
      reason?: string;
    }) => respondToScheduleChange(changeId, response, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-change-notifications'] });
    }
  });
}

/**
 * Hook to fetch winter service offers for customer
 */
export function useWinterServiceOffers() {
  return useQuery({
    queryKey: ['winter-service-offers'],
    queryFn: fetchWinterServiceOffers,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000
  });
}

/**
 * Hook to respond to a winter service offer
 */
export function useRespondToWinterOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      offerId,
      response,
      preferredWindow
    }: {
      offerId: string;
      response: 'ACCEPT' | 'DECLINE';
      preferredWindow?: { start: string; end: string };
    }) => respondToWinterOffer(offerId, response, preferredWindow),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['winter-service-offers'] });
    }
  });
}

/**
 * Get risk tier display info
 */
export function getRiskTierInfo(tier: WeatherRiskAssessment['riskTier']) {
  switch (tier) {
    case 'LOW':
      return {
        label: 'Low Risk',
        color: '#22C55E',
        bgColor: '#DCFCE7',
        icon: 'check-circle'
      };
    case 'MED':
      return {
        label: 'Medium Risk',
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        icon: 'information'
      };
    case 'HIGH':
      return {
        label: 'High Risk',
        color: '#EF4444',
        bgColor: '#FEE2E2',
        icon: 'alert'
      };
    case 'STOP':
      return {
        label: 'Stop Work',
        color: '#DC2626',
        bgColor: '#FEE2E2',
        icon: 'alert-octagon'
      };
  }
}

/**
 * Format weather conditions for display
 */
export function formatWeatherCondition(main: string): string {
  const conditions: Record<string, string> = {
    clear: 'Clear',
    clouds: 'Cloudy',
    rain: 'Rain',
    drizzle: 'Drizzle',
    snow: 'Snow',
    thunderstorm: 'Thunderstorm',
    mist: 'Mist',
    fog: 'Fog'
  };
  return conditions[main.toLowerCase()] || main;
}

/**
 * Get weather icon name for condition
 */
export function getWeatherIconName(main: string): string {
  const icons: Record<string, string> = {
    clear: 'weather-sunny',
    clouds: 'weather-cloudy',
    rain: 'weather-rainy',
    drizzle: 'weather-rainy',
    snow: 'weather-snowy',
    thunderstorm: 'weather-lightning',
    mist: 'weather-fog',
    fog: 'weather-fog'
  };
  return icons[main.toLowerCase()] || 'weather-cloudy';
}
