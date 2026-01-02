import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Play, 
  Pause, 
  Settings2, 
  Clock, 
  DollarSign, 
  Shield, 
  Activity,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Calendar,
  Loader2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { formatDistanceToNow, format } from "date-fns";
import type { AgentRegistryEntry, AgentRunEntry } from "@shared/schema";

interface AgentDetailResponse {
  agent: AgentRegistryEntry;
  recentRuns: AgentRunEntry[];
}

function getHealthBadgeVariant(score: number): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "destructive";
}

function getHealthLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Healthy";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Poor";
  return "Critical";
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 100) / 10;
  return `${seconds}s`;
}

function RunStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    case "timeout":
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

function RunRow({ run }: { run: AgentRunEntry }) {
  const startedAt = new Date(run.startedAt);
  
  return (
    <div 
      className="flex items-center justify-between py-3 border-b last:border-0"
      data-testid={`row-run-${run.id}`}
    >
      <div className="flex items-center gap-3">
        <RunStatusIcon status={run.status} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{run.runId.slice(0, 8)}</span>
            <Badge variant="outline" className="text-xs">{run.triggeredBy}</Badge>
            {run.eventType && (
              <Badge variant="secondary" className="text-xs">{run.eventType}</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(startedAt, "MMM d, h:mm a")} ({formatDistanceToNow(startedAt, { addSuffix: true })})
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {run.durationMs && (
          <span className="text-muted-foreground">{formatMs(run.durationMs)}</span>
        )}
        {run.itemsProcessed != null && run.itemsProcessed > 0 && (
          <span className="text-muted-foreground">{run.itemsProcessed} items</span>
        )}
        {run.status === "failed" && run.error && (
          <span className="text-destructive text-xs max-w-[200px] truncate" title={run.error}>
            {run.error}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();

  const { data, isLoading } = useQuery<AgentDetailResponse>({
    queryKey: ["/api/agents", id],
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      await apiRequest("PATCH", `/api/agents/${id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/summary"] });
      toast({ title: "Agent status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update agent status", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data?.agent) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Agent not found</p>
            <Link href="/agents">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Agents
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { agent, recentRuns } = data;
  const healthScore = agent.healthScore || 100;
  const successRuns = recentRuns.filter(r => r.status === "success").length;
  const failedRuns = recentRuns.filter(r => r.status === "failed").length;

  return (
    <div className="space-y-6 p-6" data-testid="page-agent-detail">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/agents">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{agent.displayName}</h1>
              <Badge 
                variant={agent.status === "active" ? "default" : agent.status === "paused" ? "secondary" : "outline"}
                data-testid="badge-agent-status"
              >
                {agent.status === "active" ? "Active" : agent.status === "paused" ? "Paused" : "Disabled"}
              </Badge>
            </div>
            <p className="text-muted-foreground">{agent.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={agent.status === "active" ? "outline" : "default"}
            onClick={() => statusMutation.mutate(agent.status === "active" ? "paused" : "active")}
            disabled={statusMutation.isPending}
            data-testid="button-toggle-status"
          >
            {agent.status === "active" ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause Agent
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume Agent
              </>
            )}
          </Button>
          <Button variant="outline" disabled data-testid="button-configure">
            <Settings2 className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-health">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Health Score</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-3xl font-semibold">{healthScore}%</span>
              <Badge variant={getHealthBadgeVariant(healthScore)}>{getHealthLabel(healthScore)}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-time-saved">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Time Saved</span>
            </div>
            <div className="mt-2">
              <span className="text-3xl font-semibold">{formatDuration(agent.timeSavedMinutes || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-cash-accel">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cash Accelerated</span>
            </div>
            <div className="mt-2">
              <span className="text-3xl font-semibold">{formatCurrency(agent.cashAcceleratedCents || 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-rev-protected">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Revenue Protected</span>
            </div>
            <div className="mt-2">
              <span className="text-3xl font-semibold">{formatCurrency(agent.revenueProtectedCents || 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs" data-testid="tab-runs">
            <Zap className="h-4 w-4 mr-2" />
            Run History
          </TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-config">
            <Settings2 className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="errors" data-testid="tab-errors">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Errors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div>
                <CardTitle className="text-lg">Recent Runs</CardTitle>
                <CardDescription>Last 20 executions of this agent</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {successRuns} Success
                </span>
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-4 w-4" />
                  {failedRuns} Failed
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No runs recorded yet. This agent will log runs when triggered.
                </div>
              ) : (
                <div className="divide-y">
                  {recentRuns.map(run => (
                    <RunRow key={run.id} run={run} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Agent Configuration</CardTitle>
              <CardDescription>Current settings for this agent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Category</span>
                  <p className="font-medium capitalize">{agent.category}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Schedule</span>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {agent.schedule === "event-driven" ? "Event-Driven" : agent.schedule || "Not set"}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Total Runs</span>
                  <p className="font-medium">{agent.totalRuns || 0}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Failure Streak</span>
                  <p className="font-medium">{agent.failureStreak || 0}</p>
                </div>
              </div>
              {agent.lastRunAt && (
                <div>
                  <span className="text-sm text-muted-foreground">Last Run</span>
                  <p className="font-medium">
                    {format(new Date(agent.lastRunAt), "MMM d, yyyy h:mm a")}
                    ({formatDistanceToNow(new Date(agent.lastRunAt), { addSuffix: true })})
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Error Log</CardTitle>
              <CardDescription>Recent errors and failures</CardDescription>
            </CardHeader>
            <CardContent>
              {agent.lastError ? (
                <div className="space-y-4">
                  <div className="p-4 bg-destructive/10 rounded-md border border-destructive/20">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <XCircle className="h-4 w-4" />
                      <span className="font-medium">Last Error</span>
                      {agent.lastErrorAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(agent.lastErrorAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <pre className="text-sm whitespace-pre-wrap break-words">{agent.lastError}</pre>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600 opacity-50" />
                  <p>No recent errors. This agent is running smoothly.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
