// ============================================
// Forecast Card Component
// Display weather forecast for a day or hour
// ============================================

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Sun, 
  Cloud, 
  CloudRain, 
  CloudSnow, 
  CloudLightning,
  Wind,
  Droplets,
  Thermometer
} from 'lucide-react';

export interface HourlyForecast {
  dt: number;
  temp: number;
  humidity: number;
  windSpeed: number;
  windGust?: number;
  pop: number;
  rain?: number;
  snow?: number;
  weather: Array<{
    main: string;
    description: string;
    icon?: string;
  }>;
}

export interface DailyForecast {
  dt: number;
  temp: {
    min: number;
    max: number;
    day: number;
  };
  humidity: number;
  windSpeed: number;
  pop: number;
  rain?: number;
  snow?: number;
  weather: Array<{
    main: string;
    description: string;
  }>;
}

interface ForecastCardProps {
  forecast: DailyForecast | HourlyForecast;
  type: 'daily' | 'hourly';
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

function getWeatherIcon(main: string) {
  switch (main.toLowerCase()) {
    case 'clear':
      return Sun;
    case 'clouds':
      return Cloud;
    case 'rain':
    case 'drizzle':
      return CloudRain;
    case 'snow':
      return CloudSnow;
    case 'thunderstorm':
      return CloudLightning;
    default:
      return Cloud;
  }
}

function formatTime(timestamp: number, type: 'daily' | 'hourly'): string {
  const date = new Date(timestamp * 1000);
  if (type === 'hourly') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  }
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function ForecastCard({ forecast, type, isSelected, onClick, className }: ForecastCardProps) {
  const weather = forecast.weather[0];
  const WeatherIcon = getWeatherIcon(weather?.main || 'clear');
  
  const temp = 'day' in forecast.temp 
    ? forecast.temp 
    : { min: (forecast as HourlyForecast).temp, max: (forecast as HourlyForecast).temp, day: (forecast as HourlyForecast).temp };

  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm font-medium text-center">
          {formatTime(forecast.dt, type)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="flex flex-col items-center gap-2">
          {/* Weather icon */}
          <div className="text-muted-foreground">
            <WeatherIcon className="h-8 w-8" />
          </div>
          
          {/* Temperature */}
          <div className="text-center">
            {type === 'daily' ? (
              <div className="flex items-center gap-1">
                <span className="font-semibold">{Math.round(temp.max)}°</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">{Math.round(temp.min)}°</span>
              </div>
            ) : (
              <span className="font-semibold text-lg">{Math.round(temp.day)}°</span>
            )}
          </div>
          
          {/* Condition */}
          <p className="text-xs text-muted-foreground capitalize text-center">
            {weather?.description || weather?.main || 'Unknown'}
          </p>
          
          {/* Details */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Droplets className="h-3 w-3" />
              <span>{Math.round(forecast.pop * 100)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <Wind className="h-3 w-3" />
              <span>{Math.round(forecast.windSpeed)} mph</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact horizontal forecast strip
export function ForecastStrip({
  forecasts,
  type,
  className
}: {
  forecasts: (DailyForecast | HourlyForecast)[];
  type: 'daily' | 'hourly';
  className?: string;
}) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-2', className)}>
      {forecasts.map((forecast, i) => (
        <ForecastCard
          key={forecast.dt}
          forecast={forecast}
          type={type}
          className="min-w-[100px] flex-shrink-0"
        />
      ))}
    </div>
  );
}

// Mini forecast badge for inline use
export function ForecastBadge({
  forecast,
  className
}: {
  forecast: HourlyForecast;
  className?: string;
}) {
  const weather = forecast.weather[0];
  const WeatherIcon = getWeatherIcon(weather?.main || 'clear');

  return (
    <div className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
      <WeatherIcon className="h-4 w-4 text-muted-foreground" />
      <span>{Math.round(forecast.temp)}°</span>
      {forecast.pop > 0.3 && (
        <span className="text-blue-500 flex items-center gap-0.5">
          <Droplets className="h-3 w-3" />
          {Math.round(forecast.pop * 100)}%
        </span>
      )}
    </div>
  );
}
