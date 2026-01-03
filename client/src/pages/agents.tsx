import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  Route,
  Users,
  MapPin,
  BarChart3,
  Target,
  Gauge,
  CheckCircle,
  Star,
  RefreshCw,
  Gift,
  UserPlus,
  X,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AgentRegistryEntry } from "@shared/schema";
import { agentPhases, agentRegistry, type AgentPhase } from "@/lib/ui/tokens";

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
    dispatch: number;
    ops: number;
    finance: number;
    comms: number;
  };
}

const PHASE_ICONS: Record<AgentPhase, typeof Bot> = {
  lead: UserPlus,
  quote: DollarSign,
  confirm: MessageSquare,
  schedule: Clock,
  assign: Users,
  book: CheckCircle,
  postjob: Gift,
};

const AGENT_ICONS: Record<string, typeof Bot> = {
  orchestration_engine: Bot,
  margin_worker: TrendingUp,
  reconciliation_worker: FileText,
  dispatch_worker: Truck,
  comms_worker: MessageSquare,
  upsell_worker: DollarSign,
  billing_worker: Calculator,
  crew_intelligence: Users,
  job_feasibility: CheckCircle,
  route_cost: MapPin,
  simulation_ranking: BarChart3,
  optimizer_orchestrator: Target,
  margin_burn: Gauge,
  intake_agent: UserPlus,
  quoting_agent: DollarSign,
  scheduling_agent: Clock,
  reviews_agent: Star,
  inbound_engagement: MessageSquare,
  renewal_upsell: Gift,
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

function getStatusDot(status: string) {
  switch (status) {
    case "active":
      return "bg-green-500";
    case "paused":
      return "bg-yellow-500";
    case "error":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

interface AgentCardProps {
  agent: AgentRegistryEntry;
  onViewDetails: (agent: AgentRegistryEntry) => void;
}

function AgentCard({ agent, onViewDetails }: AgentCardProps) {
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

  const healthScore = agent.healthScore || 100;
  const totalRuns = agent.totalRuns || 0;

  return (
    <Card 
      className="hover-elevate cursor-pointer group" 
      data-testid={`card-agent-${agent.id}`}
      onClick={() => onViewDetails(agent)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium truncate">{agent.displayName}</h3>
                <div className={`h-2 w-2 rounded-full ${getStatusDot(agent.status)}`} />
              </div>
              <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
            </div>
          </div>
          <Button 
            size="icon" 
            variant="ghost"
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              toggleStatus();
            }}
            disabled={statusMutation.isPending}
            data-testid={`button-toggle-${agent.id}`}
          >
            {agent.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>
        
        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {healthScore}%
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {totalRuns} runs
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

interface AgentDetailDrawerProps {
  agent: AgentRegistryEntry | null;
  onClose: () => void;
}

function AgentDetailDrawer({ agent, onClose }: AgentDetailDrawerProps) {
  const { toast } = useToast();
  const agentKey = agent?.agentKey ?? '';
  const displayName = agent?.displayName ?? '';
  const Icon = agent ? (AGENT_ICONS[agentKey] || Bot) : Bot;
  
  const registryEntry = agent ? agentRegistry.find(a => 
    a.id === agentKey || 
    agentKey.includes(a.id.replace('_agent', '')) ||
    (displayName && a.name.toLowerCase().includes(displayName.toLowerCase().split(' ')[0]))
  ) : null;
  
  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!agent) return;
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

  if (!agent) return null;

  const timeSaved = agent.timeSavedMinutes || 0;
  const cashAccel = agent.cashAcceleratedCents || 0;
  const revProtected = agent.revenueProtectedCents || 0;
  const healthScore = agent.healthScore || 100;

  return (
    <Sheet open={!!agent} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
              <Icon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <SheetTitle className="text-lg">{agent.displayName || 'Agent'}</SheetTitle>
              <SheetDescription>{agent.description || 'No description available'}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Badge 
              variant={agent.status === "active" ? "default" : agent.status === "paused" ? "secondary" : "outline"}
            >
              <div className={`h-2 w-2 rounded-full mr-1 ${getStatusDot(agent.status)}`} />
              {agent.status === "active" ? "Active" : agent.status === "paused" ? "Paused" : "Disabled"}
            </Badge>
            <Badge variant={getHealthBadgeVariant(healthScore)}>
              <Activity className="h-3 w-3 mr-1" />
              {healthScore}% {getHealthLabel(healthScore)}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-3 text-center">
                <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-lg font-semibold">{formatDuration(timeSaved)}</p>
                <p className="text-xs text-muted-foreground">Time Saved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-lg font-semibold">{formatCurrency(cashAccel)}</p>
                <p className="text-xs text-muted-foreground">Cash Accel.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Shield className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-lg font-semibold">{formatCurrency(revProtected)}</p>
                <p className="text-xs text-muted-foreground">Rev. Protected</p>
              </CardContent>
            </Card>
          </div>

          {registryEntry && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Purpose</h4>
                <p className="text-sm text-muted-foreground">{registryEntry.purpose}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2">Triggers</h4>
                <div className="flex flex-wrap gap-2">
                  {registryEntry.triggers.map((trigger, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{trigger}</Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" /> Inputs
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {registryEntry.inputs.map((input, i) => (
                      <li key={i}>{input}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> Outputs
                  </h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {registryEntry.outputs.map((output, i) => (
                      <li key={i}>{output}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-4 border-t">
            <Button 
              onClick={() => statusMutation.mutate(agent.status === "active" ? "paused" : "active")}
              disabled={statusMutation.isPending}
              variant={agent.status === "active" ? "outline" : "default"}
              data-testid="button-drawer-toggle"
            >
              {agent.status === "active" ? (
                <>
                  <Pause className="h-4 w-4 mr-2" /> Pause Agent
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" /> Activate Agent
                </>
              )}
            </Button>
            <Button variant="outline" disabled data-testid="button-drawer-settings">
              <Settings2 className="h-4 w-4 mr-2" /> Configure
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
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

function LifecyclePhaseBanner() {
  const phaseOrder: AgentPhase[] = ['lead', 'quote', 'confirm', 'schedule', 'assign', 'book', 'postjob'];
  
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-4">
      {phaseOrder.map((phase, index) => {
        const Icon = PHASE_ICONS[phase];
        const phaseInfo = agentPhases[phase];
        return (
          <div key={phase} className="flex items-center">
            <div className="flex items-center gap-1 px-3 py-1 rounded-md bg-muted text-sm whitespace-nowrap">
              <Icon className="h-4 w-4" />
              <span>{phaseInfo.label}</span>
            </div>
            {index < phaseOrder.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentRegistryEntry | null>(null);
  
  const { data: agents, isLoading: loadingAgents } = useQuery<AgentRegistryEntry[]>({
    queryKey: ["/api/agents"],
  });

  const { data: summary, isLoading: loadingSummary } = useQuery<AgentSummary>({
    queryKey: ["/api/agents/summary"],
  });

  const phaseOrder: AgentPhase[] = ['lead', 'quote', 'confirm', 'schedule', 'assign', 'book', 'postjob'];
  
  const groupedByPhase = agents?.reduce((acc, agent) => {
    const displayName = agent.displayName ?? '';
    const agentKey = agent.agentKey ?? '';
    const registryMatch = agentRegistry.find(a => 
      a.id === agentKey || 
      agentKey.includes(a.id.replace('_agent', '')) ||
      (displayName && a.name.toLowerCase().includes(displayName.toLowerCase().split(' ')[0]))
    );
    const phase = registryMatch?.phase || 'lead';
    if (!acc[phase]) acc[phase] = [];
    acc[phase].push(agent);
    return acc;
  }, {} as Record<AgentPhase, AgentRegistryEntry[]>) || {};

  return (
    <div className="space-y-6 p-6" data-testid="page-agents">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="text-muted-foreground">AI-powered automation across the lead-to-cash lifecycle</p>
        </div>
      </div>

      <SummaryCard summary={summary} isLoading={loadingSummary} />

      <LifecyclePhaseBanner />

      {loadingAgents ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <div className="flex gap-3 mt-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {phaseOrder.map(phase => {
            const phaseAgents = groupedByPhase[phase];
            if (!phaseAgents?.length) return null;

            const PhaseIcon = PHASE_ICONS[phase];
            const phaseInfo = agentPhases[phase];

            return (
              <div key={phase} className="space-y-3" data-testid={`section-phase-${phase}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <PhaseIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-medium flex items-center gap-2">
                      {phaseInfo.label}
                      <Badge variant="outline">{phaseAgents.length}</Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground">{phaseInfo.description}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {phaseAgents.map(agent => (
                    <AgentCard 
                      key={agent.id} 
                      agent={agent} 
                      onViewDetails={setSelectedAgent}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AgentDetailDrawer 
        agent={selectedAgent} 
        onClose={() => setSelectedAgent(null)} 
      />
    </div>
  );
}
