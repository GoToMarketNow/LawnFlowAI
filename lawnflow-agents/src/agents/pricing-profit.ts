import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, PricingResult } from '../types';
import OpenAI from 'openai';

export class PricingProfitAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('pricing_profit', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const services = context.event.payload?.services || [];
      if (!services.length) {
        return this.createEnvelope(
          'needs_input',
          'No services specified for pricing',
          null,
          [this.createUserAsk('Please specify which services need pricing')]
        );
      }

      // Calculate pricing with profit protection
      const pricing = await this.calculatePricing(services, context);

      // Apply business rules and margin protection
      const protectedPricing = this.applyProfitProtection(pricing, context.business_config.pricing_rules);

      const result: PricingResult = {
        quotes: protectedPricing.quotes,
        total_estimate: protectedPricing.total,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        requires_approval: protectedPricing.requiresApproval,
        approval_reason: protectedPricing.approvalReason
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [];
      if (result.requires_approval) {
        nextActions.push(this.createUserAsk(`Pricing requires approval: ${result.approval_reason}`));
      } else {
        nextActions.push(this.createHandoff('scheduling_dispatch', {
          customer_id: context.state.customer_id,
          quotes: result.quotes
        }));
      }

      return this.createEnvelope(
        'ok',
        `Generated pricing with ${result.quotes.length} quotes`,
        result,
        nextActions,
        [],
        {
          estimated_tokens_in: 200,
          estimated_tokens_out: 300,
          tool_calls: 1,
          metadata: {
            execution_time_ms: executionTime,
            agent_version: this.version
          }
        }
      );

    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.createEnvelope(
        'error',
        'Pricing calculation failed',
        null,
        [],
        [{ code: 'PRICING_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
        {
          estimated_tokens_in: 0,
          estimated_tokens_out: 0,
          tool_calls: 0,
          metadata: {
            execution_time_ms: executionTime,
            agent_version: this.version
          }
        }
      );
    }
  }

  private async calculatePricing(services: any[], context: AgentContext): Promise<any> {
    const systemPrompt = `You are a pricing agent for a lawn care business. Calculate fair, profitable prices based on:

Business Rules:
- Minimum margin: ${context.business_config.pricing_rules.min_margin}%
- Maximum discount: ${context.business_config.pricing_rules.max_discount}%
- Frequency multipliers: ${JSON.stringify(context.business_config.pricing_rules.frequency_multipliers)}
- Complexity multipliers: ${JSON.stringify(context.business_config.pricing_rules.complexity_multipliers)}

Services: ${JSON.stringify(context.business_config.services)}

Return JSON with quotes array containing service pricing.`;

    const userPrompt = `Calculate pricing for these services: ${JSON.stringify(services)}
Property details: ${JSON.stringify(context.event.payload?.property_details || {})}
Urgency: ${context.event.payload?.urgency || 'medium'}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.1
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(rawResponse);
  }

  private applyProfitProtection(pricing: any, rules: any): any {
    const protectedQuotes = pricing.quotes.map((quote: any) => {
      const margin = ((quote.final_price - quote.cost) / quote.final_price) * 100;

      if (margin < rules.min_margin) {
        // Increase price to meet minimum margin
        const requiredPrice = quote.cost / (1 - rules.min_margin / 100);
        return {
          ...quote,
          final_price: requiredPrice,
          margin: rules.min_margin,
          adjustment_reason: 'Profit protection applied'
        };
      }

      return {
        ...quote,
        margin: margin
      };
    });

    const total = protectedQuotes.reduce((sum: number, quote: any) => sum + quote.final_price, 0);
    const requiresApproval = protectedQuotes.some((q: any) => q.adjustment_reason);

    return {
      quotes: protectedQuotes,
      total,
      requiresApproval,
      approvalReason: requiresApproval ? 'Price adjustments made for profit protection' : undefined
    };
  }
}