// ============================================
// Weather Risk Badge Component
// Visual indicator for job weather risk levels
// ============================================

import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CloudRain, 
  Wind, 
  Snowflake, 
  CloudLightning, 
  Thermometer,
  AlertTriangle,
  AlertOctagon,
  CheckCircle,
  Info
} from 'lucide-react';

export type RiskTier = 'LOW' | 'MED' | 'HIGH' | 'STOP';

export interface WeatherDriver {
  type: string;
  value: number;
  threshold: number;
  unit?: string;
  description?: string;
}

export interface WeatherRiskBadgeProps {
  riskTier: RiskTier;
  riskScore?: number;
  drivers?: WeatherDriver[];
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const tierConfig: Record<RiskTier, { 
  label: string; 
  color: string; 
  bgColor: string;
  icon: React.ComponentType<any>;
  description: string;
}> = {
  LOW: {
    label: 'Low Risk',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    icon: CheckCircle,
    description: 'Weather conditions are favorable for scheduled work'
  },
  MED: {
    label: 'Medium Risk',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    icon: Info,
    description: 'Weather may impact work - monitor conditions'
  },
  HIGH: {
    label: 'High Risk',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
    icon: AlertTriangle,
    description: 'Significant weather risk - consider rescheduling'
  },
  STOP: {
    label: 'Stop Work',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    icon: AlertOctagon,
    description: 'Unsafe conditions - reschedule required'
  }
};

const driverIcons: Record<string, React.ComponentType<any>> = {
  RAIN: CloudRain,
  WIND: Wind,
  SNOW: Snowflake,
  ICE: Snowflake,
  LIGHTNING: CloudLightning,
  FREEZE: Thermometer,
  HEAT: Thermometer,
  REFREEZE: Snowflake,
  HAIL: CloudRain
};

export function WeatherRiskBadge({
  riskTier,
  riskScore,
  drivers = [],
  showScore = false,
  size = 'md',
  className
}: WeatherRiskBadgeProps) {
  const config = tierConfig[riskTier];
  const TierIcon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline"
            className={cn(
              'inline-flex items-center gap-1.5 font-medium border',
              config.bgColor,
              config.color,
              sizeClasses[size],
              className
            )}
          >
            <TierIcon className={iconSizes[size]} />
            <span>{config.label}</span>
            {showScore && riskScore !== undefined && (
              <span className="opacity-75">({riskScore})</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">{config.description}</p>
            {drivers.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Risk drivers:</p>
                <ul className="text-xs space-y-1">
                  {drivers.map((driver, i) => {
                    const DriverIcon = driverIcons[driver.type] || AlertTriangle;
                    return (
                      <li key={i} className="flex items-center gap-1.5">
                        <DriverIcon className="h-3 w-3" />
                        <span>{driver.description || driver.type}</span>
                        {driver.value && driver.unit && (
                          <span className="text-muted-foreground">
                            ({driver.value}{driver.unit})
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact version for inline use
export function WeatherRiskIndicator({
  riskTier,
  className
}: {
  riskTier: RiskTier;
  className?: string;
}) {
  const config = tierConfig[riskTier];
  const TierIcon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex', config.color, className)}>
            <TierIcon className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}: {config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
