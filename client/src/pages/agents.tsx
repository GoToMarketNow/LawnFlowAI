import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Play, 
  Pause, 
  Settings2, 
  Clock, 
  DollarSign, 
  Shield, 
  Activity,
  Bot,
  Zap,
  Calculator,
  MessageSquare,
  Truck,
  FileText,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { AgentRegistryEntry } from "@shared/schema";

interface AgentSummary {
  totalAgents: number;
  activeAgents: number;
  pausedAgents: number;
  disabledAgents: number;
  avgHealthScore: number;
  totalTimeSavedMinutes: number;
  totalCashAcceleratedCents: number;
  totalRevenueProtectedCents: number;
  byCategory: {
    core: number;
    ops: number;
    finance: number;
    comms: number;
  };
}

const CATEGORY_ICONS: Record<string, typeof Bot> = {
  core: Bot,
  ops: Truck,
  finance: Calculator,
  comms: MessageSquare,
};

const CATEGORY_LABELS: Record<string, string> = {
  core: "Core",
  ops: "Operations",
  finance: "Finance",
  comms: "Communications",
};

const AGENT_ICONS: Record<string, typeof Bot> = {
  orchestration_engine: Bot,
  margin_worker: TrendingUp,
  reconciliation_worker: FileText,
  dispatch_worker: Truck,
  comms_worker: MessageSquare,
  upsell_worker: DollarSign,
  billing_worker: Calculator,
};

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

function AgentCard({ agent }: { agent: AgentRegistryEntry }) {
  const { toast } = useToast();
  const Icon = AGENT_ICONS[agent.agentKey] || Bot;
  
  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      await apiRequest("PATCH", `/api/agents/${agent.id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/summary"] });
      toast({ title: "Agent status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update agent status", variant: "destructive" });
    },
  });

  const toggleStatus = () => {
    const newStatus = agent.status === "active" ? "paused" : "active";
    statusMutation.mutate(newStatus);
  };

  const timeSaved = agent.timeSavedMinutes || 0;
  const cashAccel = agent.cashAcceleratedCents || 0;
  const revProtected = agent.revenueProtectedCents || 0;
  const healthScore = agent.healthScore || 100;

  return (
    <Card className="hover-elevate group" data-testid={`card-agent-${agent.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base font-medium">{agent.displayName}</CardTitle>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={agent.status === "active" ? "default" : agent.status === "paused" ? "secondary" : "outline"}
            data-testid={`badge-status-${agent.id}`}
          >
            {agent.status === "active" ? "Active" : agent.status === "paused" ? "Paused" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm">
          <Badge variant={getHealthBadgeVariant(healthScore)} className="gap-1" data-testid={`badge-health-${agent.id}`}>
            <Activity className="h-3 w-3" />
            {healthScore}% {getHealthLabel(healthScore)}
          </Badge>
          <span className="text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {agent.totalRuns || 0} runs
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="flex flex-col" data-testid={`value-time-${agent.id}`}>
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Time Saved
            </span>
            <span className="font-medium">{formatDuration(timeSaved)}</span>
          </div>
          <div className="flex flex-col" data-testid={`value-cash-${agent.id}`}>
            <span className="text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Cash Accel.
            </span>
            <span className="font-medium">{formatCurrency(cashAccel)}</span>
          </div>
          <div className="flex flex-col" data-testid={`value-revenue-${agent.id}`}>
            <span className="text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Rev. Protected
            </span>
            <span className="font-medium">{formatCurrency(revProtected)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            <Button 
              size="icon" 
              variant="ghost"
              onClick={toggleStatus}
              disabled={statusMutation.isPending}
              data-testid={`button-toggle-${agent.id}`}
            >
              {agent.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" disabled data-testid={`button-settings-${agent.id}`}>
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
          <Link href={`/agents/${agent.id}`}>
            <Button variant="ghost" size="sm" className="gap-1" data-testid={`button-view-${agent.id}`}>
              View Details
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ summary, isLoading }: { summary?: AgentSummary; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card data-testid="card-agent-summary">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-lg">Agent Overview</CardTitle>
        <Badge variant={summary.avgHealthScore >= 80 ? "default" : "secondary"} className="gap-1">
          <Activity className="h-3 w-3" />
          {summary.avgHealthScore}% Avg Health
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col">
            <span className="text-2xl font-semibold" data-testid="text-active-agents">{summary.activeAgents}</span>
            <span className="text-sm text-muted-foreground">Active Agents</span>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-semibold" data-testid="text-time-saved">{formatDuration(summary.totalTimeSavedMinutes)}</span>
            <span className="text-sm text-muted-foreground">Time Saved</span>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-semibold" data-testid="text-cash-accel">{formatCurrency(summary.totalCashAcceleratedCents)}</span>
            <span className="text-sm text-muted-foreground">Cash Accelerated</span>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-semibold" data-testid="text-rev-protected">{formatCurrency(summary.totalRevenueProtectedCents)}</span>
            <span className="text-sm text-muted-foreground">Revenue Protected</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentsPage() {
  const { data: agents, isLoading: loadingAgents } = useQuery<AgentRegistryEntry[]>({
    queryKey: ["/api/agents"],
  });

  const { data: summary, isLoading: loadingSummary } = useQuery<AgentSummary>({
    queryKey: ["/api/agents/summary"],
  });

  const groupedAgents = agents?.reduce((acc, agent) => {
    const category = agent.category || "core";
    if (!acc[category]) acc[category] = [];
    acc[category].push(agent);
    return acc;
  }, {} as Record<string, AgentRegistryEntry[]>) || {};

  const categoryOrder = ["core", "ops", "finance", "comms"];

  return (
    <div className="space-y-6 p-6" data-testid="page-agents">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="text-muted-foreground">Manage your AI-powered automation workers</p>
        </div>
      </div>

      <SummaryCard summary={summary} isLoading={loadingSummary} />

      {loadingAgents ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-60" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map(j => (
                      <Skeleton key={j} className="h-12" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {categoryOrder.map(category => {
            const categoryAgents = groupedAgents[category];
            if (!categoryAgents?.length) return null;

            const CategoryIcon = CATEGORY_ICONS[category];

            return (
              <div key={category} className="space-y-3" data-testid={`section-category-${category}`}>
                <div className="flex items-center gap-2">
                  <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-lg font-medium">{CATEGORY_LABELS[category]}</h2>
                  <Badge variant="outline" className="ml-2">{categoryAgents.length}</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {categoryAgents.map(agent => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
