import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { JobRequest, AssignmentSimulation, Crew, AssignmentDecision } from "@shared/schema";

export interface EligibleCrew {
  crewId: number;
  name: string;
  skillsMatchPct: number;
  equipmentMatchPct: number;
  capacityRemainingByDay: { date: string; minutes: number }[];
  distanceFromHomeEstimate: number | null;
  memberCount: number;
  flags: string[];
}

export interface SimulationResult {
  simulations: AssignmentSimulation[];
  eligibleCrews: EligibleCrew[];
  thresholdsUsed: {
    skillMatchMinPct: number;
    equipmentMatchMinPct: number;
  };
  candidatesGenerated: number;
  candidatesPersisted: number;
}

export interface DecisionResult {
  decision: AssignmentDecision;
  reasoningJson: Record<string, unknown>;
}

export interface ApprovalResult {
  decision: AssignmentDecision;
  writebackTriggered: boolean;
  message: string;
}

export function useJobRequests(status?: string) {
  return useQuery<JobRequest[]>({
    queryKey: ["/api/ops/jobs", status || "all"],
    queryFn: async () => {
      const url = status && status !== "all" 
        ? `/api/ops/jobs?status=${status}` 
        : "/api/ops/jobs";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch job requests");
      return res.json();
    },
  });
}

export function useCrews() {
  return useQuery<Crew[]>({
    queryKey: ["/api/ops/crews"],
  });
}

export function useSimulate() {
  return useMutation<SimulationResult, Error, { jobRequestId: number; returnTopN?: number }>({
    mutationFn: async ({ jobRequestId, returnTopN = 3 }) => {
      const res = await apiRequest("POST", "/api/optimizer/simulate", {
        jobRequestId,
        returnTopN,
        persistTopN: 10,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ops/simulations", variables.jobRequestId] });
    },
  });
}

export function useCreateDecision() {
  return useMutation<DecisionResult, Error, { jobRequestId: number; simulationId: number }>({
    mutationFn: async ({ jobRequestId, simulationId }) => {
      const res = await apiRequest("POST", "/api/optimizer/decide", {
        jobRequestId,
        simulationId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/jobs"] });
    },
  });
}

export function useApproveDecision() {
  return useMutation<ApprovalResult, Error, { decisionId: number; allowCrewLeadApprove?: boolean }>({
    mutationFn: async ({ decisionId, allowCrewLeadApprove = false }) => {
      const res = await apiRequest("POST", "/api/optimizer/approve", {
        decisionId,
        allowCrewLeadApprove,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ops/simulations"] });
    },
  });
}
