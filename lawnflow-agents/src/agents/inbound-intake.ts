import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, IntakeResult } from '../types';
import OpenAI from 'openai';

export class InboundIntakeAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('inbound_intake', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const message = context.event.payload?.message || context.event.payload?.content;
      if (!message) {
        return this.createEnvelope(
          'needs_input',
          'No message content provided',
          null,
          [this.createUserAsk('Please provide the customer message to process')]
        );
      }

      // Use OpenAI to analyze the message
      const analysis = await this.analyzeMessage(message, context.business_config);

      // Extract entities and determine intent
      const result: IntakeResult = {
        is_qualified: analysis.isQualified,
        customer_name: analysis.customerName,
        service_type: analysis.serviceType,
        address: analysis.address,
        urgency: analysis.urgency,
        notes: analysis.notes,
        suggested_response: analysis.suggestedResponse,
        extracted_entities: analysis.extractedEntities
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions based on qualification
      const nextActions = [];
      if (result.is_qualified) {
        if (result.service_type && result.urgency === 'high') {
          nextActions.push(this.createHandoff('pricing_profit', {
            customer_id: context.state.customer_id,
            service_type: result.service_type,
            urgency: result.urgency
          }));
        } else {
          nextActions.push(this.createHandoff('qualification', {
            customer_id: context.state.customer_id,
            intake_result: result
          }));
        }
      }

      return this.createEnvelope(
        'ok',
        `Processed inbound ${context.event.channel} message`,
        result,
        nextActions,
        [],
        {
          estimated_tokens_in: 150,
          estimated_tokens_out: 200,
          tool_calls: 0,
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
        'Failed to process inbound message',
        null,
        [],
        [{ code: 'ANALYSIS_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async analyzeMessage(
    message: string,
    businessConfig: any
  ): Promise<any> {
    const systemPrompt = `You are an AI intake agent for ${businessConfig.business_name}, a landscaping/lawn care company.

Your job is to:
1. Determine if the customer needs landscaping services
2. Extract key information (name, service needed, address, urgency)
3. Assess qualification based on service area and offerings
4. Generate a professional response

Services offered: ${businessConfig.services.map((s: any) => s.name).join(', ')}
Service area: ${businessConfig.service_area}

Respond in JSON format with:
{
  "isQualified": boolean,
  "customerName": string or null,
  "serviceType": string or null,
  "address": string or null,
  "urgency": "low" | "medium" | "high",
  "notes": string,
  "suggestedResponse": string,
  "extractedEntities": object
}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Customer message: ${message}` }
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
}