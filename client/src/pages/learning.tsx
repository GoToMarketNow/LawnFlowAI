import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Brain, 
  TrendingUp, 
  CheckCircle, 
  Edit, 
  XCircle, 
  Clock, 
  FileText, 
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Activity,
  Loader2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { EmptyState } from "@/components/ui/empty-state";

interface LearningMetrics {
  period: { days: number; cutoff: string };
  decisions: {
    total: number;
    byConfidence: { high: number; medium: number; low: number };
  };
  humanActions: {
    total: number;
    approved: number;
    edited: number;
    rejected: number;
    overrideRate: number;
    avgTimeToActionSeconds: number;
  };
  outcomes: Record<string, number>;
  topReasonCodes: Array<{ code: string; count: number }>;
}

interface PolicyVersion {
  id: number;
  businessId: number;
  version: string;
  policyJson: Record<string, unknown>;
  status: string;
  parentVersionId: number | null;
  createdAt: string;
}

interface Suggestion {
  id: number;
  businessId: number;
  policyChangeType: string;
  target: string;
  currentValueJson: unknown;
  proposedValueJson: unknown;
  evidenceJson: Record<string, unknown>;
  status: string;
  reviewedByUserId: number | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface KillSwitch {
  id: number;
  businessId: number;
  scope: string;
  scopeValue: string;
  isEnabled: boolean;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

function MetricsCard({ title, value, subtitle, icon: Icon, trend }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof Brain;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card data-testid={`metric-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ConfidenceBreakdown({ high, medium, low }: { high: number; medium: number; low: number }) {
  const total = high + medium + low;
  if (total === 0) return <span className="text-muted-foreground">No data</span>;
  
  return (
    <div className="flex gap-2 items-center" data-testid="confidence-breakdown">
      <Badge variant="default" className="bg-green-600" data-testid="badge-confidence-high">{high} high</Badge>
      <Badge variant="secondary" data-testid="badge-confidence-medium">{medium} med</Badge>
      <Badge variant="outline" data-testid="badge-confidence-low">{low} low</Badge>
    </div>
  );
}

function MetricsOverview() {
  const { data: metrics, isLoading, error } = useQuery<LearningMetrics>({
    queryKey: ["/api/learning/metrics"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Failed to load metrics</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Decisions"
          value={metrics.decisions.total}
          subtitle="Last 30 days"
          icon={Brain}
        />
        <MetricsCard
          title="Human Actions"
          value={metrics.humanActions.total}
          subtitle={`${metrics.humanActions.approved} approved, ${metrics.humanActions.edited} edited`}
          icon={Activity}
        />
        <MetricsCard
          title="Override Rate"
          value={`${metrics.humanActions.overrideRate}%`}
          subtitle="Edits + Rejections"
          icon={TrendingUp}
        />
        <MetricsCard
          title="Avg Response Time"
          value={metrics.humanActions.avgTimeToActionSeconds > 0 
            ? `${Math.round(metrics.humanActions.avgTimeToActionSeconds / 60)} min` 
            : "N/A"}
          subtitle="Time to action"
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confidence Distribution</CardTitle>
            <CardDescription>AI decision confidence levels</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfidenceBreakdown 
              high={metrics.decisions.byConfidence.high}
              medium={metrics.decisions.byConfidence.medium}
              low={metrics.decisions.byConfidence.low}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Override Reasons</CardTitle>
            <CardDescription>Most common reasons for edits/rejections</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.topReasonCodes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No overrides recorded yet</p>
            ) : (
              <div className="space-y-2">
                {metrics.topReasonCodes.slice(0, 5).map((rc) => (
                  <div key={rc.code} className="flex justify-between items-center">
                    <span className="text-sm font-mono">{rc.code}</span>
                    <Badge variant="secondary">{rc.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PolicyVersionsTab() {
  const { data: versions = [], isLoading } = useQuery<PolicyVersion[]>({
    queryKey: ["/api/learning/policy-versions"],
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (versions.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No Policy Versions"
        description="No policy versions have been created yet. Seed the learning system to create the initial policy."
        action={{
          label: "Seed Learning System",
          onClick: async () => {
            await apiRequest("POST", "/api/learning/seed");
            queryClient.invalidateQueries({ queryKey: ["/api/learning/policy-versions"] });
          },
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {versions.map((version) => (
        <Card key={version.id} data-testid={`policy-version-${version.id}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-mono">{version.version}</CardTitle>
              <CardDescription>
                Created {format(new Date(version.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </CardDescription>
            </div>
            <Badge 
              variant={version.status === "active" ? "default" : "secondary"}
              data-testid={`badge-policy-status-${version.id}`}
            >
              {version.status}
            </Badge>
          </CardHeader>
          <CardContent>
            <details className="cursor-pointer">
              <summary className="text-sm text-muted-foreground">View Policy JSON</summary>
              <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto max-h-64">
                {JSON.stringify(version.policyJson, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SuggestionsTab() {
  const { toast } = useToast();
  const { data: suggestions = [], isLoading } = useQuery<Suggestion[]>({
    queryKey: ["/api/learning/suggestions"],
  });

  const updateSuggestion = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/learning/suggestions/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning/suggestions"] });
      toast({
        title: "Suggestion Updated",
        description: "The suggestion status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateSuggestions = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/learning/suggestions/generate");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning/suggestions"] });
      toast({
        title: "Analysis Complete",
        description: `Created ${data.created} suggestions, skipped ${data.skipped}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (suggestions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            onClick={() => generateSuggestions.mutate()}
            disabled={generateSuggestions.isPending}
            data-testid="button-generate-suggestions"
          >
            {generateSuggestions.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Analyze Decisions
          </Button>
        </div>
        <EmptyState
          icon={TrendingUp}
          title="No Tuning Suggestions"
          description="The learning system will propose policy adjustments based on human override patterns. Click 'Analyze Decisions' to generate suggestions from recent activity."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => generateSuggestions.mutate()}
          disabled={generateSuggestions.isPending}
          data-testid="button-generate-suggestions"
        >
          {generateSuggestions.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Re-Analyze Decisions
        </Button>
      </div>
      {suggestions.map((suggestion) => (
        <Card key={suggestion.id} data-testid={`suggestion-${suggestion.id}`}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">{suggestion.policyChangeType}: {suggestion.target}</CardTitle>
              <CardDescription>
                Created {format(new Date(suggestion.createdAt), "MMM d")}
              </CardDescription>
            </div>
            <Badge 
              variant={
                suggestion.status === "proposed" ? "secondary" :
                suggestion.status === "approved" ? "default" :
                suggestion.status === "applied" ? "outline" : "destructive"
              }
              data-testid={`badge-suggestion-status-${suggestion.id}`}
            >
              {suggestion.status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestion.evidenceJson?.rationale && (
              <p className="text-sm text-muted-foreground">{suggestion.evidenceJson.rationale as string}</p>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Current Value</p>
                <pre className="mt-1 p-2 bg-muted rounded text-xs">
                  {JSON.stringify(suggestion.currentValueJson, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-muted-foreground">Proposed Value</p>
                <pre className="mt-1 p-2 bg-muted rounded text-xs">
                  {JSON.stringify(suggestion.proposedValueJson, null, 2)}
                </pre>
              </div>
            </div>
            {suggestion.evidenceJson?.impactEstimate && (
              <p className="text-sm"><span className="text-muted-foreground">Impact:</span> {suggestion.evidenceJson.impactEstimate as string}</p>
            )}
            {suggestion.status === "proposed" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => updateSuggestion.mutate({ id: suggestion.id, status: "approved" })}
                  disabled={updateSuggestion.isPending}
                  data-testid={`button-approve-suggestion-${suggestion.id}`}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateSuggestion.mutate({ id: suggestion.id, status: "rejected" })}
                  disabled={updateSuggestion.isPending}
                  data-testid={`button-reject-suggestion-${suggestion.id}`}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function KillSwitchesTab() {
  const { toast } = useToast();
  const { data: switches = [], isLoading } = useQuery<KillSwitch[]>({
    queryKey: ["/api/learning/kill-switches"],
  });

  const toggleSwitch = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/learning/kill-switches/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning/kill-switches"] });
      toast({
        title: "Kill Switch Updated",
        description: "The kill switch has been toggled.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createSwitch = useMutation({
    mutationFn: async (data: { scope: string; scopeId?: string; reason?: string }) => {
      return apiRequest("POST", "/api/learning/kill-switches", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning/kill-switches"] });
      toast({
        title: "Kill Switch Created",
        description: "New kill switch has been created.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => createSwitch.mutate({ scope: "global", reason: "Manual pause - all automation" })}
          disabled={createSwitch.isPending}
          data-testid="button-create-global-kill-switch"
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Create Global Kill Switch
        </Button>
      </div>

      {switches.length === 0 ? (
        <EmptyState
          icon={ToggleLeft}
          title="No Kill Switches"
          description="Kill switches allow you to pause AI automation at different scopes (global, agent, stage). Create one to temporarily disable automation."
        />
      ) : (
        <div className="space-y-3">
          {switches.map((sw) => (
            <Card key={sw.id} data-testid={`kill-switch-${sw.id}`}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{sw.scope}</span>
                    {sw.scopeValue && sw.scopeValue !== sw.scope && (
                      <Badge variant="outline" className="font-mono text-xs">{sw.scopeValue}</Badge>
                    )}
                    <Badge 
                      variant={sw.isEnabled ? "destructive" : "secondary"}
                      data-testid={`badge-killswitch-status-${sw.id}`}
                    >
                      {sw.isEnabled ? "ACTIVE" : "Inactive"}
                    </Badge>
                  </div>
                  {sw.reason && (
                    <p className="text-sm text-muted-foreground mt-1">{sw.reason}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {format(new Date(sw.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant={sw.isEnabled ? "destructive" : "outline"}
                  onClick={() => toggleSwitch.mutate({ id: sw.id, isActive: !sw.isEnabled })}
                  disabled={toggleSwitch.isPending}
                  data-testid={`button-toggle-kill-switch-${sw.id}`}
                >
                  {sw.isEnabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LearningDashboard() {
  const { toast } = useToast();
  
  const seedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/learning/seed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/learning"] });
      toast({
        title: "Learning System Seeded",
        description: "Reason codes and initial policy have been created.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="page-learning">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Learning System</h1>
          <p className="text-muted-foreground">
            Monitor AI performance, review policy suggestions, and manage automation controls.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          data-testid="button-seed-learning"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${seedMutation.isPending ? "animate-spin" : ""}`} />
          Initialize / Refresh
        </Button>
      </div>

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics" data-testid="tab-metrics">Metrics</TabsTrigger>
          <TabsTrigger value="policies" data-testid="tab-policies">Policy Versions</TabsTrigger>
          <TabsTrigger value="suggestions" data-testid="tab-suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="killswitches" data-testid="tab-killswitches">Kill Switches</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics">
          <MetricsOverview />
        </TabsContent>

        <TabsContent value="policies">
          <PolicyVersionsTab />
        </TabsContent>

        <TabsContent value="suggestions">
          <SuggestionsTab />
        </TabsContent>

        <TabsContent value="killswitches">
          <KillSwitchesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
