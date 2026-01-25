/**
 * Marketing Performance Dashboard
 * 
 * KPIs, funnel visualization, revenue attribution, and pre-qual metrics
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  TrendingUp, 
  Users,
  MessageSquare,
  CheckCircle,
  DollarSign,
  Target,
  Filter,
  Calendar
} from 'lucide-react';

export default function MarketingPerformancePage() {
  const [dateRange, setDateRange] = useState('30');

  // Calculate date range
  const dateFrom = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000);
  const dateTo = new Date();

  // Fetch metrics
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['marketing-metrics', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        businessId: '1',
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      });
      const response = await fetch(`/api/marketing/metrics?${params}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
  });

  // Fetch funnel
  const { data: funnelData } = useQuery({
    queryKey: ['marketing-funnel', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        businessId: '1',
        dateFrom: dateFrom.toISOString(),
      });
      const response = await fetch(`/api/marketing/metrics/funnel?${params}`);
      if (!response.ok) throw new Error('Failed to fetch funnel');
      return response.json();
    },
  });

  const metrics = metricsData || {};
  const funnel = funnelData?.funnel || {};
  const totals = metrics.totals || {};
  const outreachMetrics = metrics.outreachMetrics || {};

  // Calculate conversion rates
  const identifiedToEngaged = totals.engaged && totals.identified 
    ? ((totals.engaged / totals.identified) * 100).toFixed(1)
    : '0';
  const engagedToConverted = totals.converted && totals.engaged
    ? ((totals.converted / totals.engaged) * 100).toFixed(1)
    : '0';
  const overallConversion = totals.converted && totals.identified
    ? ((totals.converted / totals.identified) * 100).toFixed(1)
    : '0';

  // Pre-qual metrics
  const serviceabilityBreakdown = metrics.serviceabilityBreakdown || [];
  const serviceable = serviceabilityBreakdown.find((s: any) => s.status === 'serviceable')?.count || 0;
  const maybeServiceable = serviceabilityBreakdown.find((s: any) => s.status === 'maybe_serviceable')?.count || 0;
  const notServiceable = serviceabilityBreakdown.find((s: any) => s.status === 'not_serviceable')?.count || 0;
  const totalPreQual = serviceable + maybeServiceable + notServiceable;
  const preQualAccuracy = totalPreQual > 0 ? ((serviceable / totalPreQual) * 100).toFixed(1) : '0';

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketing Performance</h1>
          <p className="text-gray-600 mt-1">Track ROI and optimize growth channels</p>
        </div>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Prospects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.identified || 0}</div>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <Users className="h-3 w-3" />
              Identified
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pre-Qualified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{serviceable}</div>
            <p className="text-xs text-gray-500 mt-1">
              {preQualAccuracy}% accuracy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Engaged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.engaged || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              {identifiedToEngaged}% conversion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Converted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{totals.converted || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              {overallConversion}% overall
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>From discovery to lead handoff</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <FunnelStage 
              label="Identified" 
              count={funnel.totalIdentified || 0} 
              total={funnel.totalIdentified || 1}
              color="bg-blue-500"
            />
            <FunnelStage 
              label="Pre-Qualified" 
              count={funnel.prequalified || 0} 
              total={funnel.totalIdentified || 1}
              color="bg-purple-500"
            />
            <FunnelStage 
              label="Contacted" 
              count={funnel.contacted || 0} 
              total={funnel.totalIdentified || 1}
              color="bg-yellow-500"
            />
            <FunnelStage 
              label="Responded" 
              count={funnel.responded || 0} 
              total={funnel.totalIdentified || 1}
              color="bg-orange-500"
            />
            <FunnelStage 
              label="Handed Off" 
              count={funnel.handedOff || 0} 
              total={funnel.totalIdentified || 1}
              color="bg-green-500"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Pre-Qualification Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Pre-Qualification Results</CardTitle>
            <CardDescription>Serviceability gate effectiveness</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm">Serviceable</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{serviceable}</span>
                <Badge variant="secondary">
                  {totalPreQual > 0 ? ((serviceable / totalPreQual) * 100).toFixed(0) : 0}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <span className="text-sm">Needs Info</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{maybeServiceable}</span>
                <Badge variant="secondary">
                  {totalPreQual > 0 ? ((maybeServiceable / totalPreQual) * 100).toFixed(0) : 0}%
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-sm">Not Serviceable</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{notServiceable}</span>
                <Badge variant="secondary">
                  {totalPreQual > 0 ? ((notServiceable / totalPreQual) * 100).toFixed(0) : 0}%
                </Badge>
              </div>
            </div>

            <div className="pt-3 border-t mt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cost Savings</span>
                <span className="text-lg font-bold text-green-600">
                  ${((notServiceable * 0.50) / 100).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Prevented {notServiceable} wasted outreaches (~$0.50 each)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Prospects by Source</CardTitle>
            <CardDescription>Channel performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(metrics.bySource || []).map((source: any) => (
                <div key={source.source} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={source.source === 'social' ? 'default' : 'secondary'}>
                      {source.source === 'social' ? '🌐 Social' : '🤝 Referral'}
                    </Badge>
                  </div>
                  <span className="text-2xl font-bold">{source.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outreach Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Outreach Metrics</CardTitle>
          <CardDescription>Message volume and costs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Sent</p>
              <p className="text-3xl font-bold">{outreachMetrics.totalSent || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Cost/Message</p>
              <p className="text-3xl font-bold">
                ${((outreachMetrics.avgCostCents || 0) / 100).toFixed(3)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Spend</p>
              <p className="text-3xl font-bold text-green-600">
                ${(((outreachMetrics.totalSent || 0) * (outreachMetrics.avgCostCents || 0)) / 100).toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FunnelStage({ label, count, total, color }: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-gray-600">
          {count} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
        <div
          className={`h-full ${color} flex items-center px-3 text-white text-sm font-medium transition-all`}
          style={{ width: `${Math.max(percentage, 5)}%` }}
        >
          {percentage >= 10 && `${percentage.toFixed(0)}%`}
        </div>
      </div>
    </div>
  );
}
