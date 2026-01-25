import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, CompletionFinalizationResult } from '../types';
import OpenAI from 'openai';

export class CompletionFinalizationAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('completion_finalization', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const jobId = context.event.payload?.job_id;
      const qualityReport = context.event.payload?.quality_report;

      if (!jobId) {
        return this.createEnvelope(
          'needs_input',
          'Missing job ID for completion finalization',
          null,
          [this.createUserAsk('Please provide job ID for finalization')]
        );
      }

      // Update job status to completed
      const completion = await this.finalizeJob(jobId, qualityReport, context);

      // Generate customer communication
      const customerComm = await this.generateCustomerCommunication(completion, context);

      // Process payment if applicable
      const payment = await this.processPayment(completion, context);

      // Schedule follow-up
      const followUp = this.scheduleFollowUp(completion, context);

      const result: CompletionFinalizationResult = {
        job_id: jobId,
        final_status: 'completed',
        completion_details: completion,
        customer_notification: customerComm,
        payment_processed: payment.processed,
        payment_amount: payment.amount,
        follow_up_scheduled: followUp.scheduled,
        next_service_suggestion: followUp.nextService
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [
        this.createHandoff('customer_notification', {
          job_id: jobId,
          message: customerComm,
          type: 'completion'
        })
      ];

      if (followUp.scheduled) {
        nextActions.push(this.createHandoff('follow_up_scheduler', {
          customer_id: completion.customer_id,
          follow_up_date: followUp.date,
          service_type: followUp.nextService
        }));
      }

      return this.createEnvelope(
        'ok',
        `Job ${jobId} completed successfully`,
        result,
        nextActions,
        [],
        {
          estimated_tokens_in: 250,
          estimated_tokens_out: 350,
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
        'Completion finalization failed',
        null,
        [],
        [{ code: 'FINALIZATION_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async finalizeJob(jobId: string, qualityReport: any, context: AgentContext): Promise<any> {
    // In a real implementation, this would update the job database
    return {
      job_id: jobId,
      completed_at: new Date().toISOString(),
      quality_score: qualityReport?.overall_score || 95,
      final_cost: context.event.payload?.final_cost || 150.00,
      customer_id: context.state.customer_id,
      crew_id: context.event.payload?.crew_id,
      services_performed: context.event.payload?.services || ['lawn_mowing', 'edging']
    };
  }

  private async generateCustomerCommunication(completion: any, context: AgentContext): Promise<any> {
    const systemPrompt = `You are generating customer completion notifications for lawn care services.

Create a professional, friendly message that includes:
- Service completion confirmation
- Quality highlights
- Next service recommendations
- Payment information
- Contact information for questions
- Satisfaction survey invitation

Keep the tone appreciative and customer-focused.`;

    const userPrompt = `Generate completion message:
Job Details: ${JSON.stringify(completion)}
Business Info: ${JSON.stringify(context.business_config.business_info)}
Quality Report: ${JSON.stringify(context.event.payload?.quality_report)}`;

    const completion_response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 600,
      temperature: 0.3
    });

    const rawResponse = completion_response.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(rawResponse);
  }

  private async processPayment(completion: any, context: AgentContext): Promise<any> {
    // In a real implementation, this would integrate with payment processing
    return {
      processed: true,
      amount: completion.final_cost,
      method: 'invoice',
      status: 'pending'
    };
  }

  private scheduleFollowUp(completion: any, context: AgentContext): any {
    // Schedule next service based on typical lawn care cycles
    const nextServiceDate = new Date();
    nextServiceDate.setDate(nextServiceDate.getDate() + 14); // 2 weeks for regular maintenance

    return {
      scheduled: true,
      date: nextServiceDate.toISOString(),
      nextService: 'lawn_maintenance'
    };
  }
}