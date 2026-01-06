import OpenAI from 'openai';
import { PromptLoader } from './promptLoader';
import { ToolRouter } from './toolRouter';
import { CostEstimator } from './cost';
import { Envelope, Event, StateSummary, FinOpsConfig } from './types';
import { validateEnvelope } from './schemas';

export class AgentRunner {
  private openai: OpenAI;
  private promptLoader: PromptLoader;
  private toolRouter: ToolRouter;
  private costEstimator: CostEstimator;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.promptLoader = new PromptLoader();
    this.toolRouter = new ToolRouter();
    this.costEstimator = new CostEstimator();
  }

  async runAgent(
    agentName: string,
    event: Event,
    stateSummary: StateSummary,
    finops: FinOpsConfig,
    isSubagent: boolean = false
  ): Promise<Envelope> {
    try {
      // Compose the full prompt
      const prompt = this.promptLoader.composePrompt(agentName, isSubagent);

      // Prepare input
      const input = {
        event,
        state_summary: stateSummary,
        constraints: finops
      };

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `INPUT:\n${JSON.stringify(input, null, 2)}\n\nOUTPUT:`
        }
      ];

      // Check token budget
      const estimatedInputTokens = this.costEstimator.estimateTokens(JSON.stringify(messages));
      if (!this.costEstimator.checkBudget(estimatedInputTokens, finops.token_budget)) {
        return this.createErrorEnvelope('TOKEN_BUDGET_EXCEEDED', 'Input exceeds token budget');
      }

      // Call OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4', // or 'gpt-3.5-turbo' for cost optimization
        messages,
        max_tokens: Math.min(1000, finops.token_budget - estimatedInputTokens),
        temperature: 0.1, // Low temperature for deterministic responses
      });

      const rawOutput = completion.choices[0]?.message?.content || '';

      // Parse and validate output
      const envelope = this.parseOutput(rawOutput);

      // Execute tool calls if any
      if (envelope.next_actions.some(action => action.type === 'tool_call')) {
        await this.executeToolCalls(envelope);
      }

      // Update cost estimates
      envelope.cost.estimated_tokens_in = estimatedInputTokens;
      envelope.cost.estimated_tokens_out = this.costEstimator.estimateTokens(rawOutput);

      return envelope;

    } catch (error) {
      console.error('Agent execution error:', error);
      return this.createErrorEnvelope('EXECUTION_ERROR', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private parseOutput(rawOutput: string): Envelope {
    try {
      const parsed = JSON.parse(rawOutput);
      if (validateEnvelope(parsed)) {
        return parsed;
      } else {
        return this.createErrorEnvelope('INVALID_ENVELOPE', 'Output does not match envelope schema');
      }
    } catch (error) {
      return this.createErrorEnvelope('PARSE_ERROR', 'Failed to parse JSON output');
    }
  }

  private async executeToolCalls(envelope: Envelope): Promise<void> {
    const toolActions = envelope.next_actions.filter(action => action.type === 'tool_call');

    for (const action of toolActions) {
      try {
        // Parse tool call from detail
        const toolCall = JSON.parse(action.detail);
        if (this.toolRouter.validateToolCall(toolCall)) {
          const result = await this.toolRouter.executeTool(toolCall);
          // In a real implementation, you'd pass results back to the agent
          console.log(`Tool ${toolCall.name} executed:`, result);
        }
      } catch (error) {
        console.error('Tool execution error:', error);
        envelope.errors.push({
          code: 'TOOL_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown tool error'
        });
      }
    }
  }

  private createErrorEnvelope(code: string, message: string): Envelope {
    return {
      status: 'error',
      agent: 'system',
      summary: 'Agent execution failed',
      cost: {
        estimated_tokens_in: 0,
        estimated_tokens_out: 0,
        tool_calls: 0
      },
      data: null,
      next_actions: [],
      errors: [{ code, message }]
    };
  }
}