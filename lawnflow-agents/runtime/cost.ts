export class CostEstimator {
  estimateTokens(text: string): number {
    // OpenAI token estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  estimateToolCallCost(toolName: string): number {
    // Estimated token costs for different tool calls
    const costs: Record<string, number> = {
      'state.get': 10,
      'state.search': 20,
      'state.upsert': 15,
      'comms.send_sms': 15,
      'comms.send_email': 25,
      'ops.route_optimize': 50,
      'ops.schedule': 20,
      'billing.create_quote': 25,
      'billing.create_invoice': 20,
      'analytics.log': 10
    };
    return costs[toolName] || 10;
  }

  calculateEnvelopeCost(envelope: any): { tokens_in: number, tokens_out: number, tool_calls: number } {
    const tokensOut = this.estimateTokens(JSON.stringify(envelope));
    const toolCalls = envelope.next_actions?.filter((a: any) => a.type === 'tool_call').length || 0;

    return {
      tokens_in: 0, // Would need input tracking
      tokens_out: tokensOut,
      tool_calls: toolCalls
    };
  }

  checkBudget(currentUsage: number, budget: number): boolean {
    return currentUsage <= budget;
  }
}