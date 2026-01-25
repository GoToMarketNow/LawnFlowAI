// ============================================
// Impact Preview Component
// Shows before/after diff for schedule changes
// ============================================

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowRight,
  Clock,
  Users,
  Route,
  AlertTriangle,
  DollarSign,
  Calendar,
  MapPin
} from 'lucide-react';

export interface JobChange {
  jobId: number;
  customerName?: string;
  address?: string;
  before: {
    start: string;
    end: string;
    crewId: number | null;
  };
  after: {
    start: string;
    end: string;
    crewId: number | null;
  };
  reason: string;
}

export interface ImpactMetrics {
  disruptionMinutes: number;
  addedDriveMinutes: number;
  overtimeRisk: number;
  slaImpactScore: number;
  marginImpactEstimate: number;
  affectedCustomers: number;
  affectedCrews: number;
}

interface ImpactPreviewProps {
  changes: JobChange[];
  metrics: ImpactMetrics;
  weatherSummary?: string;
  className?: string;
}

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  };
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  variant = 'default'
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  subValue?: string;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}) {
  const variantClasses = {
    default: 'text-muted-foreground',
    warning: 'text-yellow-600 dark:text-yellow-400',
    danger: 'text-red-600 dark:text-red-400',
    success: 'text-green-600 dark:text-green-400'
  };

  return (
    <div className="flex items-start gap-2">
      <Icon className={cn('h-4 w-4 mt-0.5', variantClasses[variant])} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
        {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
      </div>
    </div>
  );
}

export function ImpactPreview({ changes, metrics, weatherSummary, className }: ImpactPreviewProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Weather Summary */}
      {weatherSummary && (
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Weather Impact</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">{weatherSummary}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Impact Metrics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Impact Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Users}
              label="Affected Customers"
              value={metrics.affectedCustomers}
              variant={metrics.affectedCustomers > 10 ? 'warning' : 'default'}
            />
            <MetricCard
              icon={Clock}
              label="Disruption"
              value={`${metrics.disruptionMinutes} min`}
              variant={metrics.disruptionMinutes > 120 ? 'warning' : 'default'}
            />
            <MetricCard
              icon={Route}
              label="Added Drive Time"
              value={`${metrics.addedDriveMinutes} min`}
              variant={metrics.addedDriveMinutes > 60 ? 'warning' : 'default'}
            />
            <MetricCard
              icon={DollarSign}
              label="Margin Impact"
              value={`$${Math.abs(metrics.marginImpactEstimate)}`}
              subValue={metrics.marginImpactEstimate < 0 ? 'loss' : 'gain'}
              variant={metrics.marginImpactEstimate < -100 ? 'danger' : 'default'}
            />
          </div>

          {metrics.overtimeRisk > 0 && (
            <div className="mt-4 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-md">
              <p className="text-sm text-orange-700 dark:text-orange-300 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Overtime risk: {metrics.overtimeRisk}% of crews may exceed hours
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Changes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Schedule Changes</span>
            <Badge variant="secondary">{changes.length} jobs</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {changes.slice(0, 5).map((change) => {
              const before = formatDateTime(change.before.start);
              const after = formatDateTime(change.after.start);
              const dateChanged = before.date !== after.date;

              return (
                <div key={change.jobId} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">
                        {change.customerName || `Job #${change.jobId}`}
                      </p>
                      {change.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {change.address}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {change.reason}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    {/* Before */}
                    <div className="flex-1 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                      <div className="flex items-center gap-1 text-red-700 dark:text-red-300">
                        <Calendar className="h-3 w-3" />
                        <span className={dateChanged ? 'line-through' : ''}>
                          {before.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                        <Clock className="h-3 w-3" />
                        <span className="line-through">{before.time}</span>
                      </div>
                    </div>

                    <ArrowRight className="h-4 w-4 text-muted-foreground" />

                    {/* After */}
                    <div className="flex-1 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <div className="flex items-center gap-1 text-green-700 dark:text-green-300">
                        <Calendar className="h-3 w-3" />
                        <span className={dateChanged ? 'font-medium' : ''}>
                          {after.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <Clock className="h-3 w-3" />
                        <span className="font-medium">{after.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {changes.length > 5 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                And {changes.length - 5} more changes...
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Compact summary for list views
export function ImpactSummaryBadge({
  metrics,
  className
}: {
  metrics: ImpactMetrics;
  className?: string;
}) {
  const severity = 
    metrics.affectedCustomers > 20 || metrics.disruptionMinutes > 180 ? 'high' :
    metrics.affectedCustomers > 10 || metrics.disruptionMinutes > 60 ? 'medium' : 'low';

  const colors = {
    low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  };

  return (
    <Badge className={cn(colors[severity], 'font-normal', className)}>
      {metrics.affectedCustomers} customers · {metrics.disruptionMinutes} min disruption
    </Badge>
  );
}
