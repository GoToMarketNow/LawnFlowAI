import { AgentContext, Envelope, NextAction, ToolCall } from '../types';

export abstract class BaseAgent {
  protected name: string;
  protected version: string;

  constructor(name: string, version: string = '1.0.0') {
    this.name = name;
    this.version = version;
  }

  get agentName(): string {
    return this.name;
  }

  abstract execute(context: AgentContext): Promise<Envelope>;

  protected createEnvelope(
    status: Envelope['status'],
    summary: string,
    data: any,
    nextActions: NextAction[] = [],
    errors: any[] = [],
    cost: any = { estimated_tokens_in: 0, estimated_tokens_out: 0, tool_calls: 0 }
  ): Envelope {
    return {
      status,
      agent: this.name,
      summary,
      cost,
      data,
      next_actions: nextActions,
      errors,
      metadata: {
        execution_time_ms: 0,
        agent_version: this.version
      }
    };
  }

  protected createToolCall(name: string, args: Record<string, any>): NextAction {
    return {
      type: 'tool_call',
      detail: JSON.stringify({ name, args }),
      priority: 'medium'
    };
  }

  protected createHandoff(agentName: string, context: any): NextAction {
    return {
      type: 'handoff',
      detail: JSON.stringify({ agent: agentName, context }),
      priority: 'high'
    };
  }

  protected createUserAsk(question: string): NextAction {
    return {
      type: 'ask_user',
      detail: question,
      priority: 'high'
    };
  }

  protected validateContext(context: AgentContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!context.event) {
      errors.push('Missing event in context');
    }

    if (!context.state) {
      errors.push('Missing state in context');
    }

    if (!context.business_config) {
      errors.push('Missing business configuration');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export interface AgentFactory {
  createAgent(type: string, config?: any): BaseAgent;
}

export interface AgentRegistry {
  register(agent: BaseAgent): void;
  getAgent(name: string): BaseAgent | undefined;
  listAgents(): string[];
  getAgentByCapability(capability: string): BaseAgent[];
}

export interface ToolExecutor {
  executeTool(call: ToolCall): Promise<any>;
  validateTool(name: string, args: any): boolean;
  getAvailableTools(): string[];
}

export interface PromptManager {
  loadPrompt(agentName: string): string;
  composePrompt(agentName: string, context: AgentContext): string;
  validatePrompt(prompt: string): boolean;
}

export interface CostTracker {
  estimateTokens(text: string): number;
  trackUsage(agent: string, tokens: number, tools: number): void;
  checkBudget(context: AgentContext): boolean;
  getUsageReport(): any;
}