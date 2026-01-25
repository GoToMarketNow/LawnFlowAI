export interface AgentConfig {
  agentKey: string;
  businessId: number;
  configJson: Record<string, any>;
  isActive: boolean;
}

export interface AgentContext {
  businessId: number;
  // Add other common context data that agents might need
  // e.g., userId, logger, metricsClient, etc.
}

export interface AgentResult {
  success: boolean;
  message: string;
  payload?: Record<string, any>;
  confidence?: number;
  // Add common fields for all agent outputs
}

export interface Agent {
  /**
   * Unique identifier for the agent (e.g., "billing_agent", "quoting_agent").
   */
  readonly agentKey: string;

  /**
   * Initializes the agent with its configuration.
   * @param config The configuration for this agent instance.
   */
  initialize(config: AgentConfig): Promise<void>;

  /**
   * Executes the agent's primary logic.
   * @param input The specific input payload for this agent's run.
   * @param context Additional context for the agent's execution.
   * @returns A promise that resolves to the result of the agent's execution.
   */
  execute(input: Record<string, any>, context: AgentContext): Promise<AgentResult>;

  /**
   * Retrieves the current configuration of the agent.
   */
  getConfig(): AgentConfig;

  /**
   * Updates the agent's configuration at runtime.
   * @param newConfig The new configuration to apply.
   */
  updateConfig(newConfig: AgentConfig): Promise<void>;

  /**
   * Provides a human-readable description of the agent's purpose.
   */
  getDescription(): string;
}
