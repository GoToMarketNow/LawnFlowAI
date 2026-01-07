# Agent Development Guidelines

## Objective
These guidelines define a standard interface and best practices for developing new agents within the LawnFlow system, ensuring consistency, maintainability, and ease of integration. Adhering to these guidelines facilitates collaboration and accelerates the development of robust, agent-driven features.

## The Agent Interface (`Agent`)

All new agents **must** implement the `Agent` interface defined in `agent-service/src/agents/agent-interface.ts`. This interface enforces a common contract for agent lifecycle and interaction.

```typescript
export interface AgentConfig {
  agentKey: string;
  businessId: number;
  configJson: Record<string, any>;
  isActive: boolean;
}

export interface AgentContext {
  businessId: number;
  // Add other common context data that agents might need
  // e.g., userId (if user-triggered), logger instance, metricsClient, etc.
}

export interface AgentResult {
  success: boolean;
  message: string;
  payload?: Record<string, any>;
  confidence?: number; // Agent's self-reported confidence in its decision/action
  // Add common fields for all agent outputs (e.g., status, nextAction, errors)
}

export interface Agent {
  /**
   * A unique identifier for the agent (e.g., "billing_agent", "quoting_agent").
   * This key is used to fetch the agent's configuration from the Configuration Service.
   */
  readonly agentKey: string;

  /**
   * Initializes the agent with its specific configuration.
   * This method should be called once after the agent is instantiated.
   * It's responsible for setting up any internal state or dependencies based on the config.
   * @param config The configuration object loaded for this agent instance.
   */
  initialize(config: AgentConfig): Promise<void>;

  /**
   * Executes the agent's primary business logic.
   * This is the main entry point for an agent to perform its designated task.
   * The input and output payloads should be clearly defined and validated (e.g., using Zod).
   * @param input The specific input payload for this agent's run (e.g., an EventPayload, JobRequest data).
   * @param context Additional runtime context relevant for the agent's execution (e.g., current user, request ID).
   * @returns A promise that resolves to the result of the agent's execution.
   */
  execute(input: Record<string, any>, context: AgentContext): Promise<AgentResult>;

  /**
   * Retrieves the current configuration of the agent.
   * @returns The current configuration object of the agent.
   */
  getConfig(): AgentConfig;

  /**
   * Updates the agent's configuration at runtime.
   * This method allows for dynamic updates to agent behavior without redeploying the agent.
   * The agent should re-initialize any internal states affected by the new configuration.
   * @param newConfig The new configuration object to apply.
   */
  updateConfig(newConfig: AgentConfig): Promise<void>;

  /**
   * Provides a concise, human-readable description of the agent's purpose.
   * This is useful for UI displays and documentation.
   * @returns A string describing the agent's function.
   */
  getDescription(): string;
}
```

## Best Practices for Agent Development

1.  **Configuration-Driven:** All agent-specific business logic parameters (thresholds, messaging templates, API keys, etc.) **must** be externalized into the `AgentConfig.configJson` and fetched via the `Configuration` service. Avoid hardcoding values.
2.  **Clear Input/Output Contracts:** Define Zod schemas for `execute` method's `input` and `AgentResult.payload` to ensure strong typing, validation, and clear communication contracts.
3.  **Idempotency:** Agents should be designed to handle being called multiple times with the same input without causing unintended side effects.
4.  **Error Handling:** Implement robust error handling. Agents should gracefully handle failures (e.g., external API outages, invalid input) and return meaningful error messages in `AgentResult`.
5.  **Logging & Metrics:** Utilize a standardized logging framework and report key metrics (e.g., confidence, latency, cost) for each execution. This is crucial for evaluation and monitoring.
6.  **Modularity:** Keep agent logic focused on a single responsibility. If an agent becomes too complex, consider breaking it down into smaller, collaborating agents or services.
7.  **Testability:** Design agents for easy unit and integration testing. Leverage mock services and golden datasets to ensure consistent behavior.
8.  **Security:** Be mindful of sensitive data. Agents should never log credentials or expose confidential information. Ensure proper authorization when accessing resources.
9.  **External Dependencies:** Access external services (databases, APIs, other microservices) only through well-defined service interfaces (e.g., `storage`, `geoService`, `fsmConnector`) to maintain separation of concerns.

## Onboarding a New Agent

1.  **Define Agent's Purpose:** Clearly articulate what problem the agent solves and its intended behavior.
2.  **Implement `Agent` Interface:** Create a new class that implements the `Agent` interface.
3.  **Define Configuration Schema:** Create a Zod schema for the agent's specific configuration data (to be stored in `AgentConfig.configJson`).
4.  **Integrate with Configuration Service:** Ensure the agent fetches its configuration during `initialize` and handles `updateConfig`.
5.  **Develop Test Cases:** Create a golden dataset and automated tests to verify the agent's behavior and performance metrics.
6.  **Register Agent:** (Future step, likely in an Agent Registry Service) Register the agent with the system so it can be discovered and configured via the UI.

By following these guidelines, we can build a resilient, scalable, and easily manageable agent-driven platform.
