import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Sparkles, 
  Users, 
  Calendar, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Zap,
  ChevronRight,
} from "lucide-react";
import type { AssignmentSimulation, AssignmentDecision } from "@shared/schema";

interface SimulationExplanation {
  whyThisCrew?: string;
  whyThisDate?: string;
  travelImpact?: {
    minutes: number;
    source: string;
    distanceFromHomeKm: number | null;
  };
  loadRemaining?: {
    beforeJob: number;
    afterJob: number;
    percentUsed: number;
  };
  riskFlags?: string[];
  scoring?: {
    travelComponent: number;
    marginComponent: number;
    riskComponent: number;
    clampedTotal: number;
  };
  marginBurn?: {
    burnMinutes: number;
    estLaborCost: number;
    estTotalCost: number;
    revenueEstimate: number | null;
  };
}

interface SimulationCardsProps {
  simulations: AssignmentSimulation[];
  isLoading: boolean;
  selectedSimulationId: number | null;
  onSelectSimulation: (sim: AssignmentSimulation) => void;
  onCreateDecision: (simulationId: number) => void;
  onApprove: (decisionId: number) => void;
  isCreatingDecision: boolean;
  isApproving: boolean;
  currentDecision: AssignmentDecision | null;
  userRole: string;
}

function getRiskBadgeVariant(flags: string[]): "default" | "secondary" | "destructive" | "outline" {
  if (flags.length === 0) return "secondary";
  if (flags.some(f => f.includes("risk") || f.includes("capacity"))) return "destructive";
  return "outline";
}

function SimulationCard({
  simulation,
  isSelected,
  onSelect,
  onCreateDecision,
  onApprove,
  isCreatingDecision,
  isApproving,
  currentDecision,
  userRole,
  rank,
}: {
  simulation: AssignmentSimulation;
  isSelected: boolean;
  onSelect: () => void;
  onCreateDecision: () => void;
  onApprove: () => void;
  isCreatingDecision: boolean;
  isApproving: boolean;
  currentDecision: AssignmentDecision | null;
  userRole: string;
  rank: number;
}) {
  const explanation = (simulation.explanationJson || {}) as SimulationExplanation;
  const riskFlags = explanation.riskFlags || [];
  const scoring = explanation.scoring;
  const marginBurn = explanation.marginBurn;
  
  const canApprove = userRole === "owner" || userRole === "admin";
  const isThisDecision = currentDecision?.selectedSimulationId === simulation.id;
  const decisionApproved = isThisDecision && currentDecision?.status === "approved";
  
  return (
    <div
      className={`p-3 rounded-md border cursor-pointer transition-colors ${
        isSelected 
          ? "border-primary bg-primary/5" 
          : "border-border hover-elevate"
      }`}
      onClick={onSelect}
      data-testid={`card-simulation-${simulation.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
            rank === 1 ? "bg-amber-500 text-white" :
            rank === 2 ? "bg-slate-400 text-white" :
            "bg-orange-700 text-white"
          }`}>
            {rank}
          </div>
          <div>
            <span className="font-medium text-sm">
              {explanation.whyThisCrew?.split(":")[0] || `Crew #${simulation.crewId}`}
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {simulation.proposedDate}
            </div>
          </div>
        </div>
        
        <Badge variant="secondary" className="text-xs">
          Score: {simulation.totalScore}
        </Badge>
      </div>
      
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 p-1.5 rounded bg-muted">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span>{simulation.travelMinutesDelta}m</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Travel time: {simulation.travelMinutesDelta} minutes</p>
            {explanation.travelImpact && (
              <p className="text-xs text-muted-foreground">
                Source: {explanation.travelImpact.source}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 p-1.5 rounded bg-muted">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span>{simulation.marginScore}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Margin score: {simulation.marginScore}/100</p>
            {marginBurn && (
              <>
                <p className="text-xs">Est. cost: ${marginBurn.estTotalCost}</p>
                {marginBurn.revenueEstimate && (
                  <p className="text-xs">Est. revenue: ${marginBurn.revenueEstimate}</p>
                )}
              </>
            )}
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 p-1.5 rounded bg-muted">
              <AlertTriangle className={`h-3 w-3 ${
                simulation.riskScore === 0 ? "text-green-600" :
                simulation.riskScore <= 20 ? "text-yellow-600" :
                "text-red-600"
              }`} />
              <span>{simulation.riskScore}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Risk score: {simulation.riskScore}</p>
            {riskFlags.length > 0 && (
              <ul className="text-xs mt-1">
                {riskFlags.map((f, i) => (
                  <li key={i}>{f.replace(/_/g, " ")}</li>
                ))}
              </ul>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
      
      {riskFlags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {riskFlags.slice(0, 3).map((flag, i) => (
            <Badge 
              key={i} 
              variant={getRiskBadgeVariant([flag])}
              className="text-xs"
            >
              {flag.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      )}
      
      {explanation.whyThisCrew && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
          {explanation.whyThisCrew}
        </p>
      )}
      
      {isSelected && (
        <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
          {!currentDecision && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCreateDecision();
              }}
              disabled={isCreatingDecision}
              data-testid={`button-select-${simulation.id}`}
            >
              <Zap className="h-3 w-3 mr-1" />
              {isCreatingDecision ? "Creating..." : "Select & Create Decision"}
            </Button>
          )}
          
          {isThisDecision && currentDecision?.status === "draft" && canApprove && (
            <Button
              size="sm"
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                onApprove();
              }}
              disabled={isApproving}
              data-testid={`button-approve-${simulation.id}`}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              {isApproving ? "Approving..." : "Approve & Assign"}
            </Button>
          )}
          
          {isThisDecision && currentDecision?.status === "draft" && !canApprove && (
            <Badge variant="outline" className="text-xs">
              Awaiting approval (requires Owner/Admin)
            </Badge>
          )}
          
          {decisionApproved && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Approved
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export function SimulationCards({
  simulations,
  isLoading,
  selectedSimulationId,
  onSelectSimulation,
  onCreateDecision,
  onApprove,
  isCreatingDecision,
  isApproving,
  currentDecision,
  userRole,
}: SimulationCardsProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Top Simulations
          {simulations.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {simulations.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 p-2 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : simulations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Sparkles className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No simulations yet</p>
              <p className="text-xs">Select a job and run simulation</p>
            </div>
          ) : (
            <div className="space-y-2">
              {simulations.map((sim, i) => (
                <SimulationCard
                  key={sim.id}
                  simulation={sim}
                  isSelected={selectedSimulationId === sim.id}
                  onSelect={() => onSelectSimulation(sim)}
                  onCreateDecision={() => onCreateDecision(sim.id)}
                  onApprove={() => currentDecision && onApprove(currentDecision.id)}
                  isCreatingDecision={isCreatingDecision}
                  isApproving={isApproving}
                  currentDecision={currentDecision}
                  userRole={userRole}
                  rank={i + 1}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
