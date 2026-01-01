import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  AlertTriangle, 
  Zap, 
  ChevronRight,
  Package,
  BarChart3,
} from "lucide-react";

interface UsageStats {
  today: { actionsUsed: number };
  last7Days: { actionsUsed: number };
  last30Days: { actionsUsed: number };
  monthToDate: { 
    actionsUsed: number; 
    daysElapsed: number; 
    daysInMonth: number;
  };
  breakdown: {
    inboundQualification: number;
    supervisorOrchestration: number;
    quoteGeneration: number;
    schedulingProposal: number;
    billingFollowup: number;
    reviewRequest: number;
  };
}

interface CostAnalysis {
  currentSituation: {
    projectedOverageActions: number;
    packsNeededToCover: number;
    packCostUsd: number;
  };
  upgradeValue?: {
    upgradePriceUsd: number;
    additionalActionsIncluded: number;
    costPer1000Actions: number;
  };
}

interface Recommendation {
  type: "upgrade" | "pack" | "monitor" | "seasonal_boost";
  packageRecommended?: string;
  urgency: "low" | "moderate" | "high";
  reasoning: string;
  costAnalysis: CostAnalysis;
  alternative?: {
    type: string;
    quantity: number;
    costUsd: number;
    note: string;
  };
  confidenceScore: number;
  cta: {
    primary: string;
    secondary?: string;
  };
  rationale: {
    ruleTrigger: string;
    overagePercentage: number;
    daysUntilHardCap: number | null;
    cooldownOverrideReason?: string;
    seasonalNote?: string;
  };
}

interface AccountPackage {
  id: number;
  businessId: number;
  packageName: string;
  monthlyActionsIncluded: number;
  hardCapActions: number;
  packSizeActions: number;
  packPriceUsd: number;
  peakMonths: number[] | null;
}

function UsageProgressBar({ 
  used, 
  allowance, 
  hardCap 
}: { 
  used: number; 
  allowance: number; 
  hardCap: number; 
}) {
  const allowancePercent = Math.min(100, (used / allowance) * 100);
  const hardCapPercent = Math.min(100, (used / hardCap) * 100);
  
  let barColor = "bg-green-500";
  if (allowancePercent >= 80) barColor = "bg-yellow-500";
  if (allowancePercent >= 100) barColor = "bg-red-500";
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          {used.toLocaleString()} / {allowance.toLocaleString()} actions
        </span>
        <span className="font-medium">{Math.round(allowancePercent)}%</span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`absolute inset-y-0 left-0 ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(100, hardCapPercent)}%` }}
        />
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-border"
          style={{ left: `${(allowance / hardCap) * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span>Allowance</span>
        <span>Hard Cap ({hardCap.toLocaleString()})</span>
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const urgencyStyles = {
    low: "border-border",
    moderate: "border-yellow-500/50 bg-yellow-500/5",
    high: "border-red-500/50 bg-red-500/5",
  };
  
  const urgencyBadge = {
    low: <Badge variant="secondary">Good Standing</Badge>,
    moderate: <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">Action Recommended</Badge>,
    high: <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">Urgent</Badge>,
  };
  
  const typeIcon = {
    upgrade: <TrendingUp className="h-5 w-5" />,
    pack: <Package className="h-5 w-5" />,
    monitor: <BarChart3 className="h-5 w-5" />,
    seasonal_boost: <Zap className="h-5 w-5" />,
  };
  
  return (
    <Card className={`${urgencyStyles[recommendation.urgency]}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
              {typeIcon[recommendation.type]}
            </div>
            <div>
              <CardTitle className="text-base">
                {recommendation.type === "upgrade" && "Upgrade Recommended"}
                {recommendation.type === "pack" && "Action Pack Suggested"}
                {recommendation.type === "monitor" && "Usage On Track"}
                {recommendation.type === "seasonal_boost" && "Seasonal Boost"}
              </CardTitle>
              <CardDescription className="text-xs">
                Confidence: {Math.round(recommendation.confidenceScore * 100)}%
              </CardDescription>
            </div>
          </div>
          {urgencyBadge[recommendation.urgency]}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{recommendation.reasoning}</p>
        
        {recommendation.rationale.daysUntilHardCap !== null && recommendation.rationale.daysUntilHardCap <= 14 && (
          <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {recommendation.rationale.daysUntilHardCap} days until hard cap
            </span>
          </div>
        )}
        
        {recommendation.type !== "monitor" && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" data-testid="button-growth-primary-cta">
              {recommendation.cta.primary}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            {recommendation.cta.secondary && (
              <Button size="sm" variant="outline" data-testid="button-growth-secondary-cta">
                {recommendation.cta.secondary}
              </Button>
            )}
          </div>
        )}
        
        {recommendation.rationale.seasonalNote && (
          <p className="text-xs text-muted-foreground">
            {recommendation.rationale.seasonalNote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch ${url}`);
  }
  return res.json();
}

export function GrowthAdvisorWidget({ businessId = 1 }: { businessId?: number }) {
  const { data: usage, isLoading: loadingUsage } = useQuery<UsageStats | null>({
    queryKey: ["/api/growth-advisor/usage", businessId],
    queryFn: () => fetchJson<UsageStats>(`/api/growth-advisor/usage?businessId=${businessId}`),
  });
  
  const { data: recommendation, isLoading: loadingRec } = useQuery<Recommendation | null>({
    queryKey: ["/api/growth-advisor/recommendation", businessId],
    queryFn: () => fetchJson<Recommendation>(`/api/growth-advisor/recommendation?businessId=${businessId}`),
  });
  
  const { data: accountPackage, isLoading: loadingPkg } = useQuery<AccountPackage | null>({
    queryKey: ["/api/growth-advisor/package", businessId],
    queryFn: () => fetchJson<AccountPackage>(`/api/growth-advisor/package?businessId=${businessId}`),
  });
  
  const isLoading = loadingUsage || loadingRec || loadingPkg;
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (!accountPackage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Growth Advisor
          </CardTitle>
          <CardDescription>
            Set up your account package to enable usage tracking and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            The Growth Advisor helps you stay ahead of your usage and avoid service interruptions.
          </p>
          <Button size="sm" data-testid="button-setup-package">
            Set Up Package
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Growth Advisor
            </CardTitle>
            <CardDescription>
              {accountPackage.packageName.charAt(0).toUpperCase() + accountPackage.packageName.slice(1)} Plan
            </CardDescription>
          </div>
          <Badge variant="outline" className="capitalize">
            {accountPackage.packageName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {usage && (
          <UsageProgressBar
            used={usage.monthToDate.actionsUsed}
            allowance={accountPackage.monthlyActionsIncluded}
            hardCap={accountPackage.hardCapActions}
          />
        )}
        
        {usage && (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold" data-testid="metric-today-usage">
                {usage.today.actionsUsed}
              </p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="metric-7day-usage">
                {usage.last7Days.actionsUsed}
              </p>
              <p className="text-xs text-muted-foreground">Last 7 Days</p>
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="metric-mtd-usage">
                {usage.monthToDate.actionsUsed}
              </p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </div>
          </div>
        )}
        
        {recommendation && <RecommendationCard recommendation={recommendation} />}
      </CardContent>
    </Card>
  );
}
