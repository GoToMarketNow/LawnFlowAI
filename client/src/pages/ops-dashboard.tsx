import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { JobQueue } from "@/components/ops/job-queue";
import { SimulationCards } from "@/components/ops/simulation-cards";
import { OpsMap } from "@/components/ops/ops-map";
import {
  useJobRequests,
  useCrews,
  useSimulate,
  useCreateDecision,
  useApproveDecision,
  type SimulationResult,
} from "@/hooks/use-optimizer";
import type { JobRequest, AssignmentSimulation, AssignmentDecision } from "@shared/schema";

export default function OpsDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = (user?.role as string) || "staff";
  
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<JobRequest | null>(null);
  const [selectedSimulation, setSelectedSimulation] = useState<AssignmentSimulation | null>(null);
  const [simulations, setSimulations] = useState<AssignmentSimulation[]>([]);
  const [currentDecision, setCurrentDecision] = useState<AssignmentDecision | null>(null);
  
  const { data: jobs = [], isLoading: jobsLoading } = useJobRequests();
  const { data: crews = [] } = useCrews();
  
  const simulateMutation = useSimulate();
  const createDecisionMutation = useCreateDecision();
  const approveMutation = useApproveDecision();
  
  const handleSelectJob = (job: JobRequest) => {
    setSelectedJob(job);
    setSelectedSimulation(null);
    setSimulations([]);
    setCurrentDecision(null);
  };
  
  const handleRunSimulation = async (jobId: number) => {
    try {
      const result = await simulateMutation.mutateAsync({ jobRequestId: jobId, returnTopN: 3 });
      setSimulations(result.simulations);
      setCurrentDecision(null);
      
      if (result.simulations.length > 0) {
        toast({
          title: "Simulation Complete",
          description: `Generated ${result.candidatesGenerated} candidates, showing top ${result.simulations.length}`,
        });
      } else {
        toast({
          title: "No Options Available",
          description: "No eligible crews found for this job",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Simulation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  const handleSelectSimulation = (sim: AssignmentSimulation) => {
    setSelectedSimulation(sim);
  };
  
  const handleCreateDecision = async (simulationId: number) => {
    if (!selectedJob) return;
    
    try {
      const result = await createDecisionMutation.mutateAsync({
        jobRequestId: selectedJob.id,
        simulationId,
      });
      setCurrentDecision(result.decision);
      
      toast({
        title: "Decision Created",
        description: "Draft decision created. Ready for approval.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to Create Decision",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  const handleApprove = async (decisionId: number) => {
    try {
      const result = await approveMutation.mutateAsync({ decisionId });
      setCurrentDecision(result.decision);
      
      toast({
        title: "Assignment Approved",
        description: result.writebackTriggered 
          ? "Job assigned and synced to external system" 
          : "Job assigned successfully",
      });
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="h-full flex flex-col" data-testid="page-ops-dashboard">
      <div className="p-4 border-b" data-testid="header-ops-dashboard">
        <h1 className="text-2xl font-semibold" data-testid="text-title-ops">Ops Dashboard</h1>
        <p className="text-sm text-muted-foreground" data-testid="text-subtitle-ops">
          Manage job assignments with AI-powered crew optimization
        </p>
      </div>
      
      <div className="flex-1 p-4 overflow-hidden" data-testid="content-ops-dashboard">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
          <div className="lg:col-span-4 h-full overflow-hidden" data-testid="panel-jobs-queue">
            <JobQueue
              jobs={jobs}
              isLoading={jobsLoading}
              selectedJobId={selectedJob?.id ?? null}
              onSelectJob={handleSelectJob}
              onRunSimulation={handleRunSimulation}
              isSimulating={simulateMutation.isPending}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />
          </div>
          
          <div className="lg:col-span-8 flex flex-col gap-4 h-full overflow-hidden" data-testid="panel-right">
            <div className="h-1/2 min-h-[200px]" data-testid="panel-map">
              <OpsMap
                crews={crews}
                selectedJob={selectedJob}
              />
            </div>
            
            <div className="h-1/2 min-h-[200px] overflow-hidden" data-testid="panel-simulations">
              <SimulationCards
                simulations={simulations}
                isLoading={simulateMutation.isPending}
                selectedSimulationId={selectedSimulation?.id ?? null}
                onSelectSimulation={handleSelectSimulation}
                onCreateDecision={handleCreateDecision}
                onApprove={handleApprove}
                isCreatingDecision={createDecisionMutation.isPending}
                isApproving={approveMutation.isPending}
                currentDecision={currentDecision}
                userRole={userRole}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
