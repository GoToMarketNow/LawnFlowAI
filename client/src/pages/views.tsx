import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  DollarSign, 
  ShieldCheck, 
  Activity,
  Cog,
  Wallet,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import type { AgentRegistryEntry } from "@shared/schema";

type ViewType = "operations" | "finance" | "growth";

interface ViewConfig {
  key: ViewType;
  label: string;
  icon: React.ReactNode;
  description: string;
  categories: string[];
}

const VIEW_CONFIGS: ViewConfig[] = [
  {
    key: "operations",
    label: "Operations",
    icon: <Cog className="h-5 w-5" />,
    description: "Dispatch, routing, and job execution agents",
    categories: ["core", "ops"],
  },
  {
    key: "finance",
    label: "Finance",
    icon: <Wallet className="h-5 w-5" />,
    description: "Billing, reconciliation, and margin tracking agents",
    categories: ["finance"],
  },
  {
    key: "growth",
    label: "Growth",
    icon: <MessageSquare className="h-5 w-5" />,
    description: "Customer communications and upsell agents",
    categories: ["comms"],
  },
];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function getStatusIcon(status: string) {
  switch (status) {
    case "active":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "paused":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

function getHealthColor(score: number): string {
  if (score >= 90) return "text-emerald-500";
  if (score >= 70) return "text-amber-500";
  return "text-red-500";
}

function HealthOverviewStrip({ agents }: { agents: AgentRegistryEntry[] }) {
  const avgHealth = agents.length > 0
    ? Math.round(agents.reduce((sum, a) => sum + (a.healthScore || 100), 0) / agents.length)
    : 100;

  const activeCount = agents.filter(a => a.status === "active").length;
  const issueCount = agents.filter(a => (a.healthScore || 100) < 70).length;

  return (
    <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg" data-testid="strip-health-overview">
      <div className="flex items-center gap-2">
        <Activity className={`h-5 w-5 ${getHealthColor(avgHealth)}`} />
        <div>
          <p className="text-sm text-muted-foreground">Avg Health</p>
          <p className={`text-lg font-semibold ${getHealthColor(avgHealth)}`}>{avgHealth}%</p>
        </div>
      </div>
      <div className="h-8 w-px bg-border" />
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <div>
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-lg font-semibold">{activeCount}/{agents.length}</p>
        </div>
      </div>
      <div className="h-8 w-px bg-border" />
      <div className="flex items-center gap-2">
        <AlertTriangle className={`h-5 w-5 ${issueCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
        <div>
          <p className="text-sm text-muted-foreground">Issues</p>
          <p className={`text-lg font-semibold ${issueCount > 0 ? 'text-red-500' : ''}`}>{issueCount}</p>
        </div>
      </div>
    </div>
  );
}

function ValueOverviewStrip({ agents }: { agents: AgentRegistryEntry[] }) {
  const totalTimeSaved = agents.reduce((sum, a) => sum + (a.timeSavedMinutes || 0), 0);
  const totalCashAccelerated = agents.reduce((sum, a) => sum + (a.cashAcceleratedCents || 0), 0);
  const totalRevenueProtected = agents.reduce((sum, a) => sum + (a.revenueProtectedCents || 0), 0);

  return (
    <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg" data-testid="strip-value-overview">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-blue-500" />
        <div>
          <p className="text-sm text-muted-foreground">Time Saved</p>
          <p className="text-lg font-semibold">{formatDuration(totalTimeSaved)}</p>
        </div>
      </div>
      <div className="h-8 w-px bg-border" />
      <div className="flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-emerald-500" />
        <div>
          <p className="text-sm text-muted-foreground">Cash Accelerated</p>
          <p className="text-lg font-semibold">{formatCurrency(totalCashAccelerated)}</p>
        </div>
      </div>
      <div className="h-8 w-px bg-border" />
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-purple-500" />
        <div>
          <p className="text-sm text-muted-foreground">Revenue Protected</p>
          <p className="text-lg font-semibold">{formatCurrency(totalRevenueProtected)}</p>
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentRegistryEntry }) {
  const healthScore = agent.healthScore || 100;

  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="hover-elevate cursor-pointer" data-testid={`card-agent-${agent.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {getStatusIcon(agent.status)}
                <h3 className="font-medium truncate">{agent.displayName}</h3>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge 
                variant={healthScore >= 90 ? "outline" : healthScore >= 70 ? "secondary" : "destructive"}
                className="text-xs"
                data-testid={`badge-health-${agent.id}`}
              >
                {healthScore}%
              </Badge>
              {agent.totalRuns && agent.totalRuns > 0 && (
                <span className="text-xs text-muted-foreground">{agent.totalRuns} runs</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
            {(agent.timeSavedMinutes || 0) > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(agent.timeSavedMinutes || 0)}
              </span>
            )}
            {(agent.cashAcceleratedCents || 0) > 0 && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(agent.cashAcceleratedCents || 0)}
              </span>
            )}
            {(agent.revenueProtectedCents || 0) > 0 && (
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                {formatCurrency(agent.revenueProtectedCents || 0)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ViewPanel({ view, agents }: { view: ViewConfig; agents: AgentRegistryEntry[] }) {
  const filteredAgents = agents.filter(a => view.categories.includes(a.category));

  if (filteredAgents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No agents in this view yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <HealthOverviewStrip agents={filteredAgents} />
        <ValueOverviewStrip agents={filteredAgents} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAgents.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}

export default function ViewsPage() {
  const { data: agents = [], isLoading } = useQuery<AgentRegistryEntry[]>({
    queryKey: ["/api/agents"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6" data-testid="page-views">
      <div>
        <h1 className="text-2xl font-semibold">Views</h1>
        <p className="text-muted-foreground">Role-based views of your automation agents</p>
      </div>

      <Tabs defaultValue="operations">
        <TabsList data-testid="tabs-views">
          {VIEW_CONFIGS.map(view => (
            <TabsTrigger 
              key={view.key} 
              value={view.key}
              className="flex items-center gap-2"
              data-testid={`tab-${view.key}`}
            >
              {view.icon}
              {view.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {VIEW_CONFIGS.map(view => (
          <TabsContent key={view.key} value={view.key} className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-muted">
                    {view.icon}
                  </div>
                  <div>
                    <CardTitle>{view.label} View</CardTitle>
                    <CardDescription>{view.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ViewPanel view={view} agents={agents} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>All Agents Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <HealthOverviewStrip agents={agents} />
            <ValueOverviewStrip agents={agents} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
