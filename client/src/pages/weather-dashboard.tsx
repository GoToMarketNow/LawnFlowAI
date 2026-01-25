// ============================================
// Weather Dashboard Page
// Overview of weather conditions, forecasts, and risk heatmap
// ============================================

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  Wind,
  Droplets,
  Thermometer,
  AlertTriangle,
  Calendar,
  MapPin,
  RefreshCw,
  Loader2,
  TrendingUp,
  Clock
} from 'lucide-react';
import { ForecastStrip } from '@/components/weather/ForecastCard';
import { WeatherRiskBadge, type RiskTier } from '@/components/weather/WeatherRiskBadge';

// Types
interface ServiceArea {
  id: number;
  name: string;
  centerLat?: number;
  centerLon?: number;
}

interface ForecastData {
  serviceAreaId: number;
  forecast: {
    lat: number;
    lon: number;
    timezone: string;
    current?: {
      temp: number;
      humidity: number;
      windSpeed: number;
      weather: Array<{ main: string; description: string }>;
    };
    hourly: any[];
    daily: any[];
    alerts?: any[];
  };
  budgetStatus: {
    dailyCalls: number;
    dailyLimit: number;
    remainingToday: number;
  };
}

interface RiskAssessment {
  id: number;
  jobId: number;
  riskScore: number;
  riskTier: RiskTier;
  drivers: any[];
  jobStart: string;
  job?: {
    id: number;
    customerId: number;
    serviceType: string;
  };
}

interface RiskSummary {
  assessments: RiskAssessment[];
  summary: {
    total: number;
    byTier: {
      STOP: number;
      HIGH: number;
      MED: number;
      LOW: number;
    };
  };
}

// API functions
async function fetchServiceAreas(): Promise<ServiceArea[]> {
  // In production, would fetch from API
  return [
    { id: 1, name: 'North District', centerLat: 33.7756, centerLon: -84.3963 },
    { id: 2, name: 'South District', centerLat: 33.6845, centerLon: -84.4085 },
    { id: 3, name: 'East District', centerLat: 33.7490, centerLon: -84.3298 }
  ];
}

async function fetchForecast(serviceAreaId: number): Promise<ForecastData | null> {
  try {
    const response = await fetch(`/api/weather/forecast/${serviceAreaId}`, {
      headers: { 'x-operator-id': '1' }
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchRiskAssessments(serviceAreaId?: number): Promise<RiskSummary> {
  const url = serviceAreaId 
    ? `/api/weather/risk/jobs?serviceAreaId=${serviceAreaId}`
    : '/api/weather/risk/jobs';
  const response = await fetch(url, {
    headers: { 'x-operator-id': '1' }
  });
  if (!response.ok) throw new Error('Failed to fetch risk assessments');
  return response.json();
}

async function fetchAlerts(serviceAreaId?: number): Promise<any[]> {
  const url = serviceAreaId 
    ? `/api/weather/alerts?serviceAreaId=${serviceAreaId}`
    : '/api/weather/alerts';
  const response = await fetch(url, {
    headers: { 'x-operator-id': '1' }
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.alerts || [];
}

function getWeatherIcon(main: string) {
  switch (main?.toLowerCase()) {
    case 'clear': return Sun;
    case 'clouds': return Cloud;
    case 'rain':
    case 'drizzle': return CloudRain;
    case 'snow': return CloudSnow;
    default: return Cloud;
  }
}

export default function WeatherDashboardPage() {
  const [selectedArea, setSelectedArea] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Queries
  const { data: serviceAreas = [] } = useQuery({
    queryKey: ['service-areas'],
    queryFn: fetchServiceAreas
  });

  const { data: forecast, isLoading: forecastLoading, refetch: refetchForecast } = useQuery({
    queryKey: ['weather-forecast', selectedArea],
    queryFn: () => selectedArea ? fetchForecast(selectedArea) : null,
    enabled: !!selectedArea,
    refetchInterval: 5 * 60 * 1000 // Refresh every 5 minutes
  });

  const { data: riskData, isLoading: riskLoading, refetch: refetchRisk } = useQuery({
    queryKey: ['weather-risk', selectedArea],
    queryFn: () => fetchRiskAssessments(selectedArea || undefined),
    refetchInterval: 5 * 60 * 1000
  });

  const { data: alerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ['weather-alerts', selectedArea],
    queryFn: () => fetchAlerts(selectedArea || undefined),
    refetchInterval: 2 * 60 * 1000 // More frequent for alerts
  });

  // Set default selected area
  React.useEffect(() => {
    if (serviceAreas.length > 0 && !selectedArea) {
      setSelectedArea(serviceAreas[0].id);
    }
  }, [serviceAreas, selectedArea]);

  const isLoading = forecastLoading || riskLoading;
  const currentWeather = forecast?.forecast?.current;
  const CurrentIcon = getWeatherIcon(currentWeather?.weather?.[0]?.main || '');

  const handleRefresh = () => {
    refetchForecast();
    refetchRisk();
    refetchAlerts();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cloud className="h-6 w-6 text-blue-500" />
            Weather Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor weather conditions and job risk across service areas
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={selectedArea?.toString() || ''}
            onValueChange={(v) => setSelectedArea(Number(v))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select service area" />
            </SelectTrigger>
            <SelectContent>
              {serviceAreas.map((area) => (
                <SelectItem key={area.id} value={area.id.toString()}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Active Alerts Banner */}
      {alerts.length > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="py-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-800 dark:text-red-200">
                  {alerts.length} Active Weather Alert{alerts.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-1 mt-1">
                  {alerts.slice(0, 3).map((alert, i) => (
                    <p key={i} className="text-sm text-red-700 dark:text-red-300">
                      {alert.event}: {alert.description?.slice(0, 100)}...
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="forecast">7-Day Forecast</TabsTrigger>
          <TabsTrigger value="risk">Risk Heatmap</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current Conditions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CurrentIcon className="h-5 w-5" />
                  Current Conditions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {forecastLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : currentWeather ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-4xl font-bold">{Math.round(currentWeather.temp)}°</p>
                        <p className="text-muted-foreground capitalize">
                          {currentWeather.weather[0]?.description}
                        </p>
                      </div>
                      <CurrentIcon className="h-16 w-16 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-blue-500" />
                        <span>{currentWeather.humidity}% humidity</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wind className="h-4 w-4 text-gray-500" />
                        <span>{Math.round(currentWeather.windSpeed)} mph</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No weather data available
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Risk Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Job Risk Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {riskLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : riskData ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                        <p className="text-2xl font-bold text-red-600">{riskData.summary.byTier.STOP}</p>
                        <p className="text-xs text-red-600">Stop Work</p>
                      </div>
                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
                        <p className="text-2xl font-bold text-orange-600">{riskData.summary.byTier.HIGH}</p>
                        <p className="text-xs text-orange-600">High Risk</p>
                      </div>
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                        <p className="text-2xl font-bold text-yellow-600">{riskData.summary.byTier.MED}</p>
                        <p className="text-xs text-yellow-600">Medium Risk</p>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-600">{riskData.summary.byTier.LOW}</p>
                        <p className="text-xs text-green-600">Low Risk</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {riskData.summary.total} jobs assessed
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No risk data available
                  </p>
                )}
              </CardContent>
            </Card>

            {/* API Budget */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  API Budget
                </CardTitle>
              </CardHeader>
              <CardContent>
                {forecast?.budgetStatus ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Daily Usage</span>
                        <span>{forecast.budgetStatus.dailyCalls} / {forecast.budgetStatus.dailyLimit}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${(forecast.budgetStatus.dailyCalls / forecast.budgetStatus.dailyLimit) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {forecast.budgetStatus.remainingToday}
                      </p>
                      <p className="text-xs text-muted-foreground">calls remaining today</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Budget data unavailable
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Today's Hourly Forecast */}
          {forecast?.forecast?.hourly && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Today's Hourly Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <ForecastStrip 
                  forecasts={forecast.forecast.hourly.slice(0, 12)} 
                  type="hourly" 
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>7-Day Forecast</CardTitle>
              <CardDescription>
                Extended forecast for {serviceAreas.find(a => a.id === selectedArea)?.name || 'selected area'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {forecastLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : forecast?.forecast?.daily ? (
                <ForecastStrip forecasts={forecast.forecast.daily} type="daily" />
              ) : (
                <p className="text-muted-foreground text-center py-12">
                  No forecast data available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Heatmap Tab */}
        <TabsContent value="risk" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Risk by Day</CardTitle>
              <CardDescription>
                Weather risk assessment for scheduled jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {riskLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : riskData?.assessments && riskData.assessments.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {riskData.assessments.map((assessment) => (
                      <div
                        key={assessment.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">
                              Job #{assessment.jobId}
                              {assessment.job?.serviceType && (
                                <span className="text-muted-foreground font-normal ml-2">
                                  ({assessment.job.serviceType})
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(assessment.jobStart).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <WeatherRiskBadge
                          riskTier={assessment.riskTier}
                          riskScore={assessment.riskScore}
                          drivers={assessment.drivers}
                          showScore
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-muted-foreground text-center py-12">
                  No risk assessments available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
