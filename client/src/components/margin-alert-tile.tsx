import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertTriangle, TrendingDown, DollarSign, ChevronRight, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MarginSummary {
  openAlertCount: number;
  highRiskJobCount: number;
  alertsBySeverity: {
    high: number;
    medium: number;
    low: number;
  };
  recentSnapshots: JobSnapshot[];
}

interface JobSnapshot {
  id: number;
  jobberJobId: string;
  jobberAccountId: string;
  businessId: number;
  jobTitle: string;
  clientName: string | null;
  serviceType: string | null;
  quotedPrice: number;
  expectedDurationMin: number;
  actualDurationMin: number;
  visitCount: number;
  expectedVisits: number;
  marginRisk: string;
  createdAt: string;
  updatedAt: string;
}

interface MarginAlert {
  id: number;
  businessId: number;
  snapshotId: number;
  jobberJobId: string;
  alertType: string;
  severity: string;
  status: string;
  message: string;
  varianceData: {
    durationVariancePercent?: number;
    visitVariance?: number;
    marginImpactPercent?: number;
    expectedDuration?: number;
    actualDuration?: number;
  };
  recommendedActions: string[];
  createdAt: string;
}

function SeverityIcon({ severity }: { severity: string }) {
  const colors = {
    high: "text-red-500",
    medium: "text-amber-500",
    low: "text-yellow-500",
  };
  return <AlertTriangle className={`h-4 w-4 ${colors[severity as keyof typeof colors] || "text-muted-foreground"}`} />;
}

function AlertItem({ 
  alert, 
  onAcknowledge, 
  onDismiss,
  isPending 
}: { 
  alert: MarginAlert; 
  onAcknowledge: () => void;
  onDismiss: () => void;
  isPending: boolean;
}) {
  const severityColors: Record<string, string> = {
    high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
    medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    low: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  };

  const variance = alert.varianceData?.durationVariancePercent || 0;
  const formattedVariance = variance > 0 ? `+${variance.toFixed(0)}%` : `${variance.toFixed(0)}%`;

  return (
    <div 
      className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0"
      data-testid={`margin-alert-item-${alert.id}`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
          alert.severity === "high" ? "bg-red-500/10" : 
          alert.severity === "medium" ? "bg-amber-500/10" : "bg-yellow-500/10"
        }`}>
          <SeverityIcon severity={alert.severity} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{alert.message}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge 
              variant="outline" 
              className={`text-xs ${severityColors[alert.severity] || ""}`}
            >
              {alert.severity}
            </Badge>
            {variance !== 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                {formattedVariance} duration
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onAcknowledge}
          disabled={isPending}
          aria-label="Acknowledge alert"
          data-testid={`button-acknowledge-${alert.id}`}
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onDismiss}
          disabled={isPending}
          aria-label="Dismiss alert"
          data-testid={`button-dismiss-${alert.id}`}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

export function MarginAlertTile() {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  const { data: summary, isLoading: loadingSummary } = useQuery<MarginSummary>({
    queryKey: ["/api/margin/summary"],
    refetchInterval: 30000,
  });

  const { data: alerts, isLoading: loadingAlerts } = useQuery<MarginAlert[]>({
    queryKey: ["/api/margin/alerts", { status: "open" }],
    refetchInterval: 30000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: number) => {
      await apiRequest("POST", `/api/margin/alerts/${alertId}/acknowledge`, {
        acknowledgedBy: "dashboard-user",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/margin/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/margin/summary"] });
      toast({ title: "Alert acknowledged" });
    },
    onError: () => {
      toast({ title: "Failed to acknowledge alert", variant: "destructive" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (alertId: number) => {
      await apiRequest("POST", `/api/margin/alerts/${alertId}/dismiss`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/margin/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/margin/summary"] });
      toast({ title: "Alert dismissed" });
    },
    onError: () => {
      toast({ title: "Failed to dismiss alert", variant: "destructive" });
    },
  });

  const isPending = acknowledgeMutation.isPending || dismissMutation.isPending;
  const openAlerts = alerts?.filter(a => a.status === "open") || [];
  const topAlerts = openAlerts.slice(0, 5);

  const totalRiskCount = summary?.openAlertCount || 0;
  const hasHighRisk = (summary?.alertsBySeverity?.high || 0) > 0;

  if (loadingSummary) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-16" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={hasHighRisk ? "border-red-200 dark:border-red-800" : ""}>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-muted-foreground" />
            Margin Variance
          </CardTitle>
          {totalRiskCount > 0 && (
            <Badge 
              variant="secondary" 
              className={hasHighRisk 
                ? "bg-red-500/10 text-red-600 dark:text-red-400" 
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }
              data-testid="badge-open-alerts"
            >
              {totalRiskCount} alert{totalRiskCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 rounded-lg bg-red-500/5 border border-red-200/50 dark:border-red-800/50">
              <p className="text-xl font-bold text-red-600 dark:text-red-400" data-testid="count-high-risk">
                {summary?.alertsBySeverity?.high || 0}
              </p>
              <p className="text-xs text-muted-foreground">High Risk</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-500/5 border border-amber-200/50 dark:border-amber-800/50">
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400" data-testid="count-medium-risk">
                {summary?.alertsBySeverity?.medium || 0}
              </p>
              <p className="text-xs text-muted-foreground">Medium</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-500/5 border border-yellow-200/50 dark:border-yellow-800/50">
              <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="count-low-risk">
                {summary?.alertsBySeverity?.low || 0}
              </p>
              <p className="text-xs text-muted-foreground">Low</p>
            </div>
          </div>

          {loadingAlerts ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : topAlerts.length > 0 ? (
            <div>
              {topAlerts.map(alert => (
                <AlertItem 
                  key={alert.id} 
                  alert={alert} 
                  onAcknowledge={() => acknowledgeMutation.mutate(alert.id)}
                  onDismiss={() => dismissMutation.mutate(alert.id)}
                  isPending={isPending}
                />
              ))}
              {openAlerts.length > 5 && (
                <Button 
                  variant="ghost" 
                  className="w-full mt-2 text-sm"
                  onClick={() => setDetailsOpen(true)}
                  data-testid="button-view-all-alerts"
                >
                  View all {openAlerts.length} alerts
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <DollarSign className="h-10 w-10 mx-auto text-green-500/50 mb-2" />
              <p className="text-sm text-muted-foreground">All margins healthy</p>
              <p className="text-xs text-muted-foreground mt-1">
                No jobs exceeding cost thresholds
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Margin Variance Alerts</DialogTitle>
            <DialogDescription>
              Jobs with duration or cost variances exceeding thresholds
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            {loadingAlerts ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : openAlerts.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-10 w-10 mx-auto text-green-500/50 mb-2" />
                <p className="text-sm text-muted-foreground">No open alerts</p>
              </div>
            ) : (
            <div className="space-y-2">
              {openAlerts.map(alert => (
                <Card key={alert.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${
                        alert.severity === "high" ? "bg-red-500/10" : 
                        alert.severity === "medium" ? "bg-amber-500/10" : "bg-yellow-500/10"
                      }`}>
                        <SeverityIcon severity={alert.severity} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{alert.message}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {alert.alertType.replace(/_/g, " ")}
                          </Badge>
                          {alert.varianceData?.durationVariancePercent && (
                            <span className="text-xs text-muted-foreground">
                              Duration: +{alert.varianceData.durationVariancePercent.toFixed(0)}%
                            </span>
                          )}
                          {alert.varianceData?.visitVariance && (
                            <span className="text-xs text-muted-foreground">
                              Extra visits: {alert.varianceData.visitVariance}
                            </span>
                          )}
                        </div>
                        {alert.recommendedActions?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Recommended Actions:
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {alert.recommendedActions.map((action, i) => (
                                <li key={i} className="flex items-start gap-1">
                                  <span className="text-muted-foreground/50">-</span>
                                  {action}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => acknowledgeMutation.mutate(alert.id)}
                        disabled={isPending}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Acknowledge
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => dismissMutation.mutate(alert.id)}
                        disabled={isPending}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}