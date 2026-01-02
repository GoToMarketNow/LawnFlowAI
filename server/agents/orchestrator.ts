/**
 * Optimizer Orchestrator Agent
 * 
 * Manages the end-to-end decision workflow for job assignments:
 * - Creates decisions from selected simulations
 * - Enforces RBAC for decision creation and approval
 * - Handles status transitions
 * - Triggers writeback to external systems (Jobber)
 */

import { storage } from "../storage";
import type { AssignmentDecision, AssignmentSimulation, User } from "@shared/schema";

export type UserRole = "owner" | "admin" | "crew_lead" | "staff";

export interface OrchestratorConfig {
  allowCrewLeadApprove?: boolean;
}

export interface DecisionReasoning {
  selectedCrew: {
    id: number;
    name: string;
  };
  proposedDate: string;
  scoring: {
    totalScore: number;
    marginScore: number;
    riskScore: number;
    travelMinutes: number;
  };
  selectionRationale: string;
  alternativesConsidered: number;
  createdBy: {
    userId: number;
    role: UserRole;
  };
  approvedBy?: {
    userId: number;
    role: UserRole;
    timestamp: string;
  };
  writebackStatus?: {
    attempted: boolean;
    success: boolean;
    externalId?: string;
    error?: string;
    timestamp?: string;
  };
}

export interface CreateDecisionResult {
  success: boolean;
  decision?: AssignmentDecision;
  error?: string;
  reasoningJson?: DecisionReasoning;
}

export interface ApproveDecisionResult {
  success: boolean;
  decision?: AssignmentDecision;
  writebackTriggered: boolean;
  error?: string;
}

const APPROVAL_ROLES: UserRole[] = ["owner", "admin"];
const CREATE_ROLES: UserRole[] = ["owner", "admin", "crew_lead"];

/**
 * Check if a user role can create decisions
 */
export function canCreateDecision(role: UserRole): boolean {
  return CREATE_ROLES.includes(role);
}

/**
 * Check if a user role can approve decisions
 */
export function canApproveDecision(role: UserRole, config: OrchestratorConfig = {}): boolean {
  if (APPROVAL_ROLES.includes(role)) {
    return true;
  }
  if (role === "crew_lead" && config.allowCrewLeadApprove) {
    return true;
  }
  return false;
}

/**
 * Generate a human-readable selection rationale
 */
function generateSelectionRationale(
  simulation: AssignmentSimulation,
  alternativesCount: number
): string {
  const parts: string[] = [];
  
  parts.push(`Selected based on total score of ${simulation.totalScore}/200`);
  
  if (simulation.marginScore >= 80) {
    parts.push("high margin potential");
  } else if (simulation.marginScore >= 50) {
    parts.push("moderate margin");
  }
  
  if (simulation.travelMinutesDelta <= 15) {
    parts.push("short travel time");
  } else if (simulation.travelMinutesDelta <= 30) {
    parts.push("reasonable travel distance");
  }
  
  if (simulation.riskScore === 0) {
    parts.push("no risk flags");
  } else if (simulation.riskScore <= 20) {
    parts.push("low risk");
  }
  
  if (alternativesCount > 1) {
    parts.push(`evaluated ${alternativesCount} alternatives`);
  }
  
  return parts.join("; ");
}

/**
 * Create a decision from a selected simulation
 * Enforces RBAC: CREW_LEAD can create draft, OWNER/ADMIN can create and approve
 */
export async function createDecision(
  businessId: number,
  jobRequestId: number,
  simulationId: number,
  userId: number
): Promise<CreateDecisionResult> {
  const user = await storage.getUserById(userId);
  if (!user) {
    return { success: false, error: "User not found" };
  }

  const userRole = (user.role || "staff") as UserRole;
  if (!canCreateDecision(userRole)) {
    return { 
      success: false, 
      error: `Role '${userRole}' is not authorized to create decisions` 
    };
  }

  const jobRequest = await storage.getJobRequest(jobRequestId);
  if (!jobRequest) {
    return { success: false, error: "Job request not found" };
  }

  if (jobRequest.businessId !== businessId) {
    return { success: false, error: "Job request does not belong to this business" };
  }

  const simulation = await storage.getSimulation(simulationId);
  if (!simulation) {
    return { success: false, error: "Simulation not found" };
  }

  if (simulation.jobRequestId !== jobRequestId) {
    return { success: false, error: "Simulation does not belong to this job request" };
  }

  const crew = await storage.getCrew(simulation.crewId);
  if (!crew) {
    return { success: false, error: "Crew not found" };
  }

  const allSimulations = await storage.getSimulationsForJobRequest(jobRequestId);
  const alternativesCount = allSimulations.length;

  const reasoningJson: DecisionReasoning = {
    selectedCrew: {
      id: crew.id,
      name: crew.name,
    },
    proposedDate: simulation.proposedDate,
    scoring: {
      totalScore: simulation.totalScore,
      marginScore: simulation.marginScore,
      riskScore: simulation.riskScore,
      travelMinutes: simulation.travelMinutesDelta,
    },
    selectionRationale: generateSelectionRationale(simulation, alternativesCount),
    alternativesConsidered: alternativesCount,
    createdBy: {
      userId: user.id,
      role: userRole,
    },
  };

  const decision = await storage.createDecision({
    businessId,
    jobRequestId,
    selectedSimulationId: simulationId,
    mode: "recommend_only",
    status: "draft",
    reasoningJson,
  });

  await storage.updateJobRequest(jobRequestId, { status: "recommended" });

  console.log(`[Orchestrator] Decision ${decision.id} created by user ${userId} (${userRole}) for job ${jobRequestId}`);

  return {
    success: true,
    decision,
    reasoningJson,
  };
}

/**
 * Approve a decision and trigger writeback
 * Enforces RBAC: Only OWNER/ADMIN can approve (or CREW_LEAD if flag enabled)
 */
export async function approveDecision(
  decisionId: number,
  userId: number,
  config: OrchestratorConfig = {}
): Promise<ApproveDecisionResult> {
  const user = await storage.getUserById(userId);
  if (!user) {
    return { success: false, writebackTriggered: false, error: "User not found" };
  }

  const userRole = (user.role || "staff") as UserRole;
  if (!canApproveDecision(userRole, config)) {
    return { 
      success: false, 
      writebackTriggered: false,
      error: `Role '${userRole}' is not authorized to approve decisions` 
    };
  }

  const decision = await storage.getDecision(decisionId);
  if (!decision) {
    return { success: false, writebackTriggered: false, error: "Decision not found" };
  }

  if (decision.status === "approved" || decision.status === "written_back") {
    return { 
      success: false, 
      writebackTriggered: false, 
      error: `Decision already ${decision.status}` 
    };
  }

  const simulation = await storage.getSimulation(decision.selectedSimulationId);
  if (!simulation) {
    return { success: false, writebackTriggered: false, error: "Simulation not found" };
  }

  const existingReasoning = (decision.reasoningJson || {}) as DecisionReasoning;
  const updatedReasoning: DecisionReasoning = {
    ...existingReasoning,
    approvedBy: {
      userId: user.id,
      role: userRole,
      timestamp: new Date().toISOString(),
    },
  };

  const updatedDecision = await storage.updateDecision(decisionId, {
    status: "approved",
    approvedByUserId: userId,
    reasoningJson: updatedReasoning,
  });

  await storage.updateJobRequest(decision.jobRequestId, {
    status: "assigned",
    assignedCrewId: simulation.crewId,
    assignedDate: new Date(simulation.proposedDate),
  });

  console.log(`[Orchestrator] Decision ${decisionId} approved by user ${userId} (${userRole})`);

  const writebackResult = await writebackDecision(decisionId);

  // Re-fetch decision to get final state after writeback
  const finalDecision = await storage.getDecision(decisionId);

  return {
    success: true,
    decision: finalDecision || updatedDecision,
    writebackTriggered: writebackResult.attempted,
  };
}

/**
 * Writeback decision to external system (Jobber)
 * Currently a stub that logs the action for future implementation
 */
export async function writebackDecision(decisionId: number): Promise<{
  attempted: boolean;
  success: boolean;
  externalId?: string;
  error?: string;
}> {
  const decision = await storage.getDecision(decisionId);
  if (!decision) {
    return { attempted: false, success: false, error: "Decision not found" };
  }

  console.log(`[Orchestrator] WRITEBACK STUB: Would sync decision ${decisionId} to Jobber`);
  console.log(`[Orchestrator] - Business: ${decision.businessId}`);
  console.log(`[Orchestrator] - Job Request: ${decision.jobRequestId}`);
  console.log(`[Orchestrator] - Simulation: ${decision.selectedSimulationId}`);

  const existingReasoning = (decision.reasoningJson || {}) as DecisionReasoning;
  const updatedReasoning: DecisionReasoning = {
    ...existingReasoning,
    writebackStatus: {
      attempted: true,
      success: true,
      timestamp: new Date().toISOString(),
    },
  };

  await storage.updateDecision(decisionId, {
    status: "written_back",
    reasoningJson: updatedReasoning,
  });

  console.log(`[Orchestrator] Decision ${decisionId} marked as written_back (stub)`);

  return {
    attempted: true,
    success: true,
  };
}
