import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  Search,
  FlaskConical,
  Cog,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AgentRegistryEntry } from "@shared/schema";

type AgentStage = 
  | 'lead_intake' 
  | 'quoting' 
  | 'confirmation' 
  | 'scheduling' 
  | 'crew_assignment' 
  | 'booking' 
  | 'retention_insights' 
  | 'integrations'
  | 'core';

const stageInfo: Record<AgentStage, { label: string; order: number; description: string }> = {
  lead_intake: {
    label: 'Lead Intake',
    order: 1,
    description: 'Capture and parse incoming leads from calls, SMS, and web forms',
  },
  quoting: {
    label: 'Quote Build',
    order: 2,
    description: 'Generate pricing based on services, lot size, and frequency',
  },
  confirmation: {
    label: 'Quote Confirm',
    order: 3,
    description: 'Parse customer responses: accept, decline, modify, or question',
  },
  scheduling: {
    label: 'Schedule',
    order: 4,
    description: 'Generate time windows and handle customer selection',
  },
  crew_assignment: {
    label: 'Crew Assign',
    order: 5,
    description: 'Run simulations, check feasibility, and lock crew assignments',
  },
  booking: {
    label: 'Job Booking',
    order: 6,
    description: 'Create dispatch tasks and sync with Jobber',
  },
  retention_insights: {
    label: 'Retention & Insights',
    order: 7,
    description: 'Handle renewals, upsells, and customer memory',
  },
  integrations: {
    label: 'Integrations',
    order: 8,
    description: 'Sync with external systems and handle webhooks',
  },
  core: {
    label: 'Core Orchestrators',
    order: 99,
    description: 'Central orchestration and supervision agents',
  },
};

const STAGE_ICONS: Record<AgentStage, typeof Bot> = {
  lead_intake: UserPlus,
  quoting: DollarSign,
  confirmation: MessageSquare,
  scheduling: Clock,
  crew_assignment: Users,
  booking: CheckCircle,
  retention_insights: Gift,
  integrations: Cog,
  core: Bot,
};

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

const AGENT_ICONS: Record<string, typeof Bot> = {
  lead_intake_agent: UserPlus,
  quote_builder_agent: DollarSign,
  lot_size_resolver: MapPin,
  quote_confirm_agent: MessageSquare,
  schedule_propose_agent: Clock,
  crew_simulation_agent: BarChart3,
  feasibility_check_agent: CheckCircle,
  margin_validate_agent: TrendingUp,
  crew_lock_agent: Users,
  dispatch_agent: Truck,
  customer_memory_agent: Target,
  renewal_upsell_agent: Gift,
  jobber_sync_agent: RefreshCw,
  customer_comms_agent: MessageSquare,
  reconciliation_agent: FileText,
  lead_to_cash_orchestrator: Bot,
  optimizer_orchestrator: Target,
  supervisor_agent: Shield,
  dlq_processor: Gauge,
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
  const Icon = agent ? (AGENT_ICONS[agentKey] || Bot) : Bot;
  
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

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!agent) return;
      return await apiRequest("POST", `/api/agents/${agent.id}/test`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agent?.id, "runs"] });
      toast({ title: "Test run started" });
    },
    onError: () => {
      toast({ title: "Failed to start test run", variant: "destructive" });
    },
  });

  if (!agent) return null;

  const timeSaved = agent.timeSavedMinutes || 0;
  const cashAccel = agent.cashAcceleratedCents || 0;
  const revProtected = agent.revenueProtectedCents || 0;
  const healthScore = agent.healthScore || 100;
  const triggers = (agent.triggers as string[] | null) || [];
  const domains = (agent.domains as string[] | null) || [];
  const inputSchema = agent.inputSchema as Record<string, unknown> | null;
  const outputSchema = agent.outputSchema as Record<string, unknown> | null;
  const stage = agent.stage as AgentStage | null;

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

          <div className="space-y-4">
            {agent.purpose && (
              <div>
                <h4 className="text-sm font-medium mb-2">Purpose</h4>
                <p className="text-sm text-muted-foreground">{agent.purpose}</p>
              </div>
            )}
            
            {stage && stageInfo[stage] && (
              <div>
                <h4 className="text-sm font-medium mb-2">Stage</h4>
                <Badge variant="secondary" className="gap-1">
                  {(() => { const I = STAGE_ICONS[stage]; return <I className="h-3 w-3" />; })()}
                  {stageInfo[stage].label}
                </Badge>
              </div>
            )}

            {domains.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Domains</h4>
                <div className="flex flex-wrap gap-2">
                  {domains.map((domain, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{domain}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {triggers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Triggers</h4>
                <div className="flex flex-wrap gap-2">
                  {triggers.map((trigger, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{trigger}</Badge>
                  ))}
                </div>
              </div>
            )}

            {(inputSchema || outputSchema) && (
              <div className="grid grid-cols-2 gap-4">
                {inputSchema && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" /> Input Schema
                    </h4>
                    <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded-md overflow-auto max-h-32">
                      {Object.keys((inputSchema as { properties?: Record<string, unknown> }).properties || {}).map((key, i) => (
                        <div key={i}>{key}</div>
                      ))}
                    </div>
                  </div>
                )}
                {outputSchema && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <ArrowLeft className="h-3 w-3" /> Output Schema
                    </h4>
                    <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded-md overflow-auto max-h-32">
                      {Object.keys((outputSchema as { properties?: Record<string, unknown> }).properties || {}).map((key, i) => (
                        <div key={i}>{key}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-4 border-t flex-wrap">
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
            <Button 
              variant="outline" 
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              data-testid="button-drawer-test"
            >
              <FlaskConical className="h-4 w-4 mr-2" /> 
              {testMutation.isPending ? "Starting..." : "Run Test"}
            </Button>
            <Button variant="ghost" disabled data-testid="button-drawer-settings">
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

const STAGE_ORDER: AgentStage[] = [
  'lead_intake',
  'quoting',
  'confirmation',
  'scheduling',
  'crew_assignment',
  'booking',
  'retention_insights',
  'integrations',
];

function LifecyclePhaseBanner() {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-4">
      {STAGE_ORDER.map((stage, index) => {
        const Icon = STAGE_ICONS[stage];
        const info = stageInfo[stage];
        return (
          <div key={stage} className="flex items-center">
            <div className="flex items-center gap-1 px-3 py-1 rounded-md bg-muted text-sm whitespace-nowrap">
              <Icon className="h-4 w-4" />
              <span>{info.label}</span>
            </div>
            {index < STAGE_ORDER.length - 1 && (
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
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: agents, isLoading: loadingAgents } = useQuery<AgentRegistryEntry[]>({
    queryKey: ["/api/agents"],
  });

  const { data: summary, isLoading: loadingSummary } = useQuery<AgentSummary>({
    queryKey: ["/api/agents/summary"],
  });

  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    if (!searchQuery.trim()) return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter(agent => 
      agent.displayName?.toLowerCase().includes(query) ||
      agent.description?.toLowerCase().includes(query) ||
      agent.agentKey?.toLowerCase().includes(query) ||
      agent.stage?.toLowerCase().includes(query) ||
      (agent.domains as string[] | null)?.some(d => d.toLowerCase().includes(query))
    );
  }, [agents, searchQuery]);

  const groupedByStage = useMemo(() => {
    const groups: Record<AgentStage, AgentRegistryEntry[]> = {
      lead_intake: [],
      quoting: [],
      confirmation: [],
      scheduling: [],
      crew_assignment: [],
      booking: [],
      retention_insights: [],
      integrations: [],
      core: [],
    };
    
    for (const agent of filteredAgents) {
      const stage = (agent.stage as AgentStage) || 'lead_intake';
      if (groups[stage]) {
        groups[stage].push(agent);
      }
    }
    
    return groups;
  }, [filteredAgents]);

  const showCoreAgents = searchQuery.trim().length > 0 && groupedByStage.core.length > 0;

  return (
    <div className="space-y-6 p-6" data-testid="page-agents">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="text-muted-foreground">AI-powered automation across the lead-to-cash lifecycle</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-agent-search"
          />
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
          {STAGE_ORDER.map(stage => {
            const stageAgents = groupedByStage[stage];
            if (!stageAgents?.length) return null;

            const StageIcon = STAGE_ICONS[stage];
            const info = stageInfo[stage];

            return (
              <div key={stage} className="space-y-3" data-testid={`section-stage-${stage}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <StageIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-medium flex items-center gap-2">
                      {info.label}
                      <Badge variant="outline">{stageAgents.length}</Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {stageAgents.map((agent: AgentRegistryEntry) => (
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
          
          {showCoreAgents && (
            <div className="space-y-3" data-testid="section-stage-core">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-medium flex items-center gap-2">
                    {stageInfo.core.label}
                    <Badge variant="outline">{groupedByStage.core.length}</Badge>
                  </h2>
                  <p className="text-xs text-muted-foreground">{stageInfo.core.description}</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {groupedByStage.core.map((agent: AgentRegistryEntry) => (
                  <AgentCard 
                    key={agent.id} 
                    agent={agent} 
                    onViewDetails={setSelectedAgent}
                  />
                ))}
              </div>
            </div>
          )}
          
          {filteredAgents.length === 0 && !loadingAgents && (
            <Card className="p-8 text-center">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? `No agents found matching "${searchQuery}"` : "No agents found. Seed agents to get started."}
              </p>
            </Card>
          )}
        </div>
      )}

      <AgentDetailDrawer 
        agent={selectedAgent} 
        onClose={() => setSelectedAgent(null)} 
      />
    </div>
  );
}
