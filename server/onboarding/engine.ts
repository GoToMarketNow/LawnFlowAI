import { storage } from "../storage";
import type {
  OnboardingFlow,
  OnboardingSession,
  OnboardingAnswer,
  InsertOnboardingSession,
  InsertOnboardingAnswer,
  OnboardingSessionWithAnswers,
} from "@shared/schema";

// Types for the parsed flow definition
export interface FlowDefinition {
  flow: {
    id: string;
    name: string;
    version: string;
    maxQuestions: number;
    startNodeId: string;
    personas: string[];
  };
  nodes: FlowNode[];
  configMappings: ConfigMapping[];
}

export interface FlowNode {
  id: string;
  type: "message" | "question" | "terminal";
  text: string;
  inputType?: "MULTI_SELECT" | "SINGLE_SELECT" | "TEXT" | "NUMBER" | "ZIP_LIST";
  options?: FlowOption[];
  validation?: {
    required?: boolean;
    minSelections?: number;
    maxSelections?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  nextNodeId?: string;
  transitions?: FlowTransition[];
  branchKey?: string;
}

export interface FlowOption {
  value: string;
  label: string;
  hint?: string;
}

export interface FlowTransition {
  condition: string;
  nextNodeId: string;
}

export interface ConfigMapping {
  targetPath: string;
  sourceNodeId: string;
  transform: string;
  transformParams?: Record<string, unknown>;
}

// Derived configuration structure
export interface DerivedConfig {
  automationThresholds: {
    quoteApprovalLimit: number;
    scheduleApprovalRequired: boolean;
    commsAutoSend: boolean;
  };
  enabledAgents: string[];
  approvalRules: {
    quoteApproval: "auto" | "manual" | "threshold";
    scheduleApproval: "auto" | "manual";
    dispatchApproval: "auto" | "manual";
  };
  coverageRules: {
    mode: "ZIP_CODES" | "RADIUS" | "NOT_SURE";
    zipCodes?: string[];
    radiusMiles?: number;
    centerAddress?: string;
  };
  notificationRules: {
    customerChannels: string[];
    crewChannels: string[];
    ownerAlerts: string[];
  };
  businessProfile: {
    services: string[];
    customerMix: string;
    jobsPerWeek: number;
    crewCount: number;
    hasCrewLeads: boolean;
  };
}

export class OnboardingEngine {
  private flowCache: Map<string, FlowDefinition> = new Map();

  /**
   * Load a flow definition from the database
   */
  async loadFlow(flowId: number): Promise<FlowDefinition> {
    const flow = await storage.getOnboardingFlow(flowId);
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`);
    }
    return flow.definitionJson as FlowDefinition;
  }

  /**
   * Load the active flow from the database
   */
  async loadActiveFlow(): Promise<{ flow: OnboardingFlow; definition: FlowDefinition } | null> {
    const flow = await storage.getActiveOnboardingFlow();
    if (!flow) {
      return null;
    }
    return {
      flow,
      definition: flow.definitionJson as FlowDefinition,
    };
  }

  /**
   * Start a new onboarding session for a user
   */
  async startSession(userId: number, accountId: number): Promise<OnboardingSession> {
    // Check for existing incomplete session
    const existing = await storage.getOnboardingSessionByUser(userId);
    if (existing && existing.status !== "completed" && existing.status !== "abandoned") {
      return existing;
    }

    // Load active flow
    const activeFlow = await this.loadActiveFlow();
    if (!activeFlow) {
      throw new Error("No active onboarding flow available");
    }

    const { flow, definition } = activeFlow;

    // Create new session
    const session: InsertOnboardingSession = {
      accountId,
      userId,
      flowId: flow.id,
      status: "in_progress",
      currentNodeId: definition.flow.startNodeId,
      derivedConfigJson: {},
      flagsJson: { questionsAsked: 0 },
    };

    return storage.createOnboardingSession(session);
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId: number): Promise<OnboardingSessionWithAnswers | null> {
    return storage.getOnboardingSessionWithAnswers(sessionId);
  }

  /**
   * Get the current node for a session
   */
  async getCurrentNode(sessionId: number): Promise<{ node: FlowNode; progress: number } | null> {
    const session = await storage.getOnboardingSession(sessionId);
    if (!session || !session.currentNodeId) {
      return null;
    }

    const definition = await this.loadFlow(session.flowId);
    const node = definition.nodes.find((n) => n.id === session.currentNodeId);
    if (!node) {
      return null;
    }

    // Calculate progress
    const questionNodes = definition.nodes.filter((n) => n.type === "question");
    const answeredCount = (session.flagsJson as { questionsAsked?: number })?.questionsAsked || 0;
    const progress = Math.round((answeredCount / questionNodes.length) * 100);

    return { node, progress };
  }

  /**
   * Submit an answer and advance to the next node
   */
  async submitAnswer(
    sessionId: number,
    nodeId: string,
    answer: unknown
  ): Promise<{ nextNode: FlowNode | null; session: OnboardingSession }> {
    const session = await storage.getOnboardingSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.currentNodeId !== nodeId) {
      throw new Error(`Node mismatch: expected ${session.currentNodeId}, got ${nodeId}`);
    }

    const definition = await this.loadFlow(session.flowId);
    const currentNode = definition.nodes.find((n) => n.id === nodeId);
    if (!currentNode) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Validate answer
    this.validateAnswer(currentNode, answer);

    // Store the answer (cast to Json-compatible type)
    const answerJson = answer as Record<string, unknown> | string | number | boolean | null;
    const existingAnswer = await storage.getOnboardingAnswerByNode(sessionId, nodeId);
    if (existingAnswer) {
      await storage.updateOnboardingAnswer(existingAnswer.id, {
        answerValueJson: answerJson,
        confidence: "high",
      });
    } else {
      const answerRecord: InsertOnboardingAnswer = {
        sessionId,
        nodeId,
        questionText: currentNode.text,
        answerValueJson: answerJson,
        confidence: "high",
        assumptionMade: false,
        revisitLater: false,
      };
      await storage.createOnboardingAnswer(answerRecord);
    }

    // Determine next node
    const nextNodeId = this.evaluateTransitions(currentNode, answer, definition);
    const nextNode = nextNodeId ? definition.nodes.find((n) => n.id === nextNodeId) || null : null;

    // Update session
    const flags = session.flagsJson as { questionsAsked?: number };
    const questionsAsked = (flags.questionsAsked || 0) + (currentNode.type === "question" ? 1 : 0);

    const updatedSession = await storage.updateOnboardingSession(sessionId, {
      currentNodeId: nextNodeId || null,
      status: nextNode?.type === "terminal" ? "pending_review" : "in_progress",
      flagsJson: { ...flags, questionsAsked } as Record<string, unknown>,
    });

    if (!updatedSession) {
      throw new Error(`Failed to update session: ${sessionId}`);
    }

    return { nextNode, session: updatedSession };
  }

  /**
   * Validate an answer against node validation rules
   */
  private validateAnswer(node: FlowNode, answer: unknown): void {
    const v = node.validation;
    if (!v) return;

    if (v.required && (answer === null || answer === undefined || answer === "")) {
      throw new Error("Answer is required");
    }

    if (node.inputType === "MULTI_SELECT" && Array.isArray(answer)) {
      if (v.minSelections && answer.length < v.minSelections) {
        throw new Error(`Please select at least ${v.minSelections} option(s)`);
      }
      if (v.maxSelections && answer.length > v.maxSelections) {
        throw new Error(`Please select at most ${v.maxSelections} option(s)`);
      }
    }

    if (node.inputType === "NUMBER" && typeof answer === "number") {
      if (v.min !== undefined && answer < v.min) {
        throw new Error(`Value must be at least ${v.min}`);
      }
      if (v.max !== undefined && answer > v.max) {
        throw new Error(`Value must be at most ${v.max}`);
      }
    }
  }

  /**
   * Evaluate transitions to determine the next node
   */
  private evaluateTransitions(
    node: FlowNode,
    answer: unknown,
    definition: FlowDefinition
  ): string | null {
    // Simple next node
    if (node.nextNodeId) {
      return node.nextNodeId;
    }

    // Branching transitions
    if (node.transitions && node.transitions.length > 0) {
      for (const transition of node.transitions) {
        if (this.evaluateCondition(transition.condition, answer, node.branchKey)) {
          return transition.nextNodeId;
        }
      }
    }

    // Terminal node
    if (node.type === "terminal") {
      return null;
    }

    return null;
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string, answer: unknown, branchKey?: string): boolean {
    // Handle "else" / "default" conditions
    if (condition === "else" || condition === "default" || condition === "true") {
      return true;
    }

    // Parse condition like "answer == 'ZIP_CODES'" or "answer == 'RADIUS'"
    const match = condition.match(/^answer\s*==\s*['"](.+)['"]$/);
    if (match) {
      const expectedValue = match[1];
      if (typeof answer === "string") {
        return answer === expectedValue;
      }
      if (Array.isArray(answer)) {
        return answer.includes(expectedValue);
      }
    }

    // Handle contains check
    const containsMatch = condition.match(/^answer\.includes\(['"](.+)['"]\)$/);
    if (containsMatch && Array.isArray(answer)) {
      return answer.includes(containsMatch[1]);
    }

    return false;
  }

  /**
   * Complete the onboarding session and derive configuration
   */
  async completeSession(sessionId: number): Promise<DerivedConfig> {
    const sessionWithAnswers = await storage.getOnboardingSessionWithAnswers(sessionId);
    if (!sessionWithAnswers) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const definition = await this.loadFlow(sessionWithAnswers.flowId);
    const config = this.deriveConfig(sessionWithAnswers.answers, definition);

    // Update session with derived config
    await storage.updateOnboardingSession(sessionId, {
      status: "completed",
      derivedConfigJson: config,
    });

    return config;
  }

  /**
   * Derive configuration from answers using configMappings
   */
  private deriveConfig(answers: OnboardingAnswer[], definition: FlowDefinition): DerivedConfig {
    const answerMap = new Map<string, unknown>();
    for (const a of answers) {
      answerMap.set(a.nodeId, a.answerValueJson);
    }

    // Default config
    const config: DerivedConfig = {
      automationThresholds: {
        quoteApprovalLimit: 500,
        scheduleApprovalRequired: true,
        commsAutoSend: false,
      },
      enabledAgents: ["intake"],
      approvalRules: {
        quoteApproval: "manual",
        scheduleApproval: "manual",
        dispatchApproval: "manual",
      },
      coverageRules: {
        mode: "NOT_SURE",
      },
      notificationRules: {
        customerChannels: ["sms"],
        crewChannels: ["in_app"],
        ownerAlerts: ["email"],
      },
      businessProfile: {
        services: [],
        customerMix: "mixed",
        jobsPerWeek: 0,
        crewCount: 1,
        hasCrewLeads: false,
      },
    };

    // Apply configMappings
    for (const mapping of definition.configMappings) {
      const sourceValue = answerMap.get(mapping.sourceNodeId);
      if (sourceValue === undefined) continue;

      const transformedValue = this.applyTransform(
        sourceValue,
        mapping.transform,
        mapping.transformParams
      );

      this.setNestedValue(config as unknown as Record<string, unknown>, mapping.targetPath, transformedValue);
    }

    // Derive enabled agents based on autonomy level
    const autonomyLevel = answerMap.get("q14_autonomy") as string;
    if (autonomyLevel === "HIGH") {
      config.enabledAgents = ["intake", "quoting", "scheduling", "dispatch", "comms"];
      config.approvalRules = {
        quoteApproval: "auto",
        scheduleApproval: "auto",
        dispatchApproval: "auto",
      };
      config.automationThresholds.commsAutoSend = true;
    } else if (autonomyLevel === "MEDIUM") {
      config.enabledAgents = ["intake", "quoting", "scheduling", "comms"];
      config.approvalRules = {
        quoteApproval: "threshold",
        scheduleApproval: "auto",
        dispatchApproval: "manual",
      };
    } else {
      config.enabledAgents = ["intake"];
      config.approvalRules = {
        quoteApproval: "manual",
        scheduleApproval: "manual",
        dispatchApproval: "manual",
      };
    }

    return config;
  }

  /**
   * Apply a transform function to a value
   */
  private applyTransform(
    value: unknown,
    transform: string,
    params?: Record<string, unknown>
  ): unknown {
    switch (transform) {
      case "direct":
        return value;

      case "parseNumber":
        if (typeof value === "number") return value;
        if (typeof value === "string") return parseInt(value, 10) || 0;
        return 0;

      case "parseBoolean":
        if (typeof value === "boolean") return value;
        if (typeof value === "string") return value.toLowerCase() === "true" || value === "YES";
        return false;

      case "mapToThreshold":
        // Map comfort level to dollar threshold
        const thresholdMap: Record<string, number> = {
          LOW: 100,
          MEDIUM: 500,
          HIGH: 2000,
          VERY_HIGH: 10000,
        };
        return thresholdMap[value as string] || 500;

      case "splitZips":
        if (typeof value === "string") {
          return value.split(",").map((z) => z.trim()).filter(Boolean);
        }
        return [];

      case "arrayContains":
        if (Array.isArray(value) && params?.checkValue) {
          return value.includes(params.checkValue);
        }
        return false;

      default:
        return value;
    }
  }

  /**
   * Set a nested value in an object using dot notation path
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split(".");
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Get a summary of the session for review
   */
  async getSessionSummary(
    sessionId: number
  ): Promise<{ answers: Array<{ question: string; answer: unknown }>; progress: number }> {
    const sessionWithAnswers = await storage.getOnboardingSessionWithAnswers(sessionId);
    if (!sessionWithAnswers) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const definition = await this.loadFlow(sessionWithAnswers.flowId);
    const questionNodes = definition.nodes.filter((n) => n.type === "question");

    const answers = sessionWithAnswers.answers.map((a) => ({
      nodeId: a.nodeId,
      question: a.questionText,
      answer: a.answerValueJson,
    }));

    const progress = Math.round((answers.length / questionNodes.length) * 100);

    return { answers, progress };
  }

  /**
   * Update an existing answer (for review/edit flow)
   */
  async updateAnswer(sessionId: number, nodeId: string, newAnswer: unknown): Promise<void> {
    const existingAnswer = await storage.getOnboardingAnswerByNode(sessionId, nodeId);
    if (!existingAnswer) {
      throw new Error(`Answer not found for node: ${nodeId}`);
    }

    await storage.updateOnboardingAnswer(existingAnswer.id, {
      answerValueJson: newAnswer,
    });
  }
}

// Export singleton instance
export const onboardingEngine = new OnboardingEngine();
