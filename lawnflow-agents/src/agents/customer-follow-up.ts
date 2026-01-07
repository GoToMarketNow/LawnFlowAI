import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, CustomerFollowUpResult } from '../types';
import OpenAI from 'openai';

export class CustomerFollowUpAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('customer_follow_up', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const jobId = context.event.payload?.job_id;
      const customerId = context.event.payload?.customer_id;
      const reason = context.event.payload?.reason || 'general';

      if (!customerId) {
        return this.createEnvelope(
          'needs_input',
          'Missing customer ID for follow-up',
          null,
          [this.createUserAsk('Please provide customer information')]
        );
      }

      // Check for customer responses
      const responses = await this.checkCustomerResponses(customerId, jobId, context);

      // Analyze response patterns
      const analysis = await this.analyzeResponsePatterns(responses, context);

      // Generate follow-up actions
      const actions = this.generateFollowUpActions(analysis, reason, context);

      const result: CustomerFollowUpResult = {
        customer_id: customerId,
        job_id: jobId,
        follow_up_reason: reason,
        responses_checked: responses,
        response_analysis: analysis,
        recommended_actions: actions,
        urgency_level: analysis.urgency,
        next_steps: actions.slice(0, 1) // Primary action
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = actions.map(action => this.createHandoff(action.agent, action.payload));

      return this.createEnvelope(
        'ok',
        `Customer follow-up analysis complete for ${customerId}`,
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
        'Customer follow-up failed',
        null,
        [],
        [{ code: 'FOLLOWUP_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async checkCustomerResponses(customerId: string, jobId: string | undefined, context: AgentContext): Promise<any[]> {
    // In a real implementation, this would query communication logs and response tracking
    return [
      {
        type: 'completion_notification',
        sent: '2024-01-15T10:00:00Z',
        opened: true,
        responded: false,
        response_time: null
      },
      {
        type: 'satisfaction_survey',
        sent: '2024-01-16T14:00:00Z',
        opened: false,
        responded: false,
        response_time: null
      }
    ];
  }

  private async analyzeResponsePatterns(responses: any[], context: AgentContext): Promise<any> {
    const systemPrompt = `You are analyzing customer response patterns for follow-up optimization.

Evaluate:
- Response rates and timing
- Engagement levels
- Communication preferences
- Potential issues or concerns
- Optimal follow-up timing
- Urgency indicators

Provide insights for improving customer communication and satisfaction.`;

    const userPrompt = `Analyze response patterns:
Responses: ${JSON.stringify(responses)}
Customer History: ${JSON.stringify(await this.getCustomerHistory(context.event.payload?.customer_id, context))}
Business Benchmarks: ${JSON.stringify(context.business_config.response_benchmarks)}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(rawResponse);
  }

  private async getCustomerHistory(customerId: string, context: AgentContext): Promise<any> {
    // Mock customer history
    return {
      total_interactions: 8,
      average_response_time: 1.5, // days
      satisfaction_score: 4.7,
      preferred_channel: 'email',
      last_contact: '2024-01-10'
    };
  }

  private generateFollowUpActions(analysis: any, reason: string, context: AgentContext): any[] {
    const actions = [];

    if (analysis.needs_immediate_attention) {
      actions.push({
        agent: 'customer_service',
        payload: {
          customer_id: context.event.payload.customer_id,
          priority: 'high',
          reason: analysis.concern_type
        }
      });
    }

    if (analysis.recommend_additional_contact) {
      actions.push({
        agent: 'customer_notification',
        payload: {
          customer_id: context.event.payload.customer_id,
          type: 'follow_up',
          message: analysis.suggested_message
        }
      });
    }

    if (analysis.schedule_next_service) {
      actions.push({
        agent: 'follow_up_scheduler',
        payload: {
          customer_id: context.event.payload.customer_id,
          service_type: analysis.recommended_service,
          follow_up_date: analysis.optimal_contact_date
        }
      });
    }

    return actions;
  }
}