import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, CustomerNotificationResult } from '../types';
import OpenAI from 'openai';

export class CustomerNotificationAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('customer_notification', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const jobId = context.event.payload?.job_id;
      const message = context.event.payload?.message;
      const type = context.event.payload?.type || 'general';

      if (!message || !jobId) {
        return this.createEnvelope(
          'needs_input',
          'Missing message or job ID for customer notification',
          null,
          [this.createUserAsk('Please provide message and job information')]
        );
      }

      // Get customer contact information
      const customer = await this.getCustomerContact(jobId, context);

      // Personalize the message
      const personalizedMessage = await this.personalizeMessage(message, customer, context);

      // Send notification through appropriate channels
      const delivery = await this.sendNotification(personalizedMessage, customer, type, context);

      // Log the communication
      const logEntry = this.logCommunication(jobId, customer, delivery, context);

      const result: CustomerNotificationResult = {
        job_id: jobId,
        customer_id: customer.id,
        notification_type: type,
        message_sent: personalizedMessage,
        delivery_channels: delivery.channels,
        delivery_status: delivery.status,
        logged: true,
        follow_up_required: this.checkFollowUpRequired(type, delivery)
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [];
      if (result.follow_up_required) {
        nextActions.push(this.createHandoff('customer_follow_up', {
          job_id: jobId,
          customer_id: customer.id,
          reason: 'notification_response_check'
        }));
      }

      return this.createEnvelope(
        'ok',
        `Customer notification sent for job ${jobId}`,
        result,
        nextActions,
        [],
        {
          estimated_tokens_in: 200,
          estimated_tokens_out: 250,
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
        'Customer notification failed',
        null,
        [],
        [{ code: 'NOTIFICATION_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async getCustomerContact(jobId: string, context: AgentContext): Promise<any> {
    // In a real implementation, this would query customer database
    return {
      id: context.state.customer_id || 'cust-001',
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '+1-555-0123',
      preferred_contact: 'email',
      notification_preferences: {
        email: true,
        sms: true,
        app: false
      }
    };
  }

  private async personalizeMessage(message: any, customer: any, context: AgentContext): Promise<any> {
    const systemPrompt = `You are personalizing customer communications for a lawn care business.

Personalize the message by:
- Using the customer's name
- Referencing specific services or job details
- Adapting tone to customer preferences
- Including relevant business information
- Adding personalized recommendations

Maintain professional, friendly tone appropriate for the business.`;

    const userPrompt = `Personalize this message:
Original Message: ${JSON.stringify(message)}
Customer: ${JSON.stringify(customer)}
Business Context: ${JSON.stringify(context.business_config.business_info)}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.2
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(rawResponse);
  }

  private async sendNotification(message: any, customer: any, type: string, context: AgentContext): Promise<any> {
    // In a real implementation, this would integrate with email/SMS services
    const channels = [];

    if (customer.notification_preferences.email) {
      channels.push('email');
    }
    if (customer.notification_preferences.sms) {
      channels.push('sms');
    }

    return {
      channels,
      status: 'sent',
      sent_at: new Date().toISOString(),
      message_id: `msg-${Date.now()}`
    };
  }

  private logCommunication(jobId: string, customer: any, delivery: any, context: AgentContext): any {
    return {
      job_id: jobId,
      customer_id: customer.id,
      type: 'outbound',
      channels: delivery.channels,
      status: delivery.status,
      timestamp: delivery.sent_at,
      logged_by: 'customer_notification_agent'
    };
  }

  private checkFollowUpRequired(type: string, delivery: any): boolean {
    // Follow up required for completion notifications and important updates
    return ['completion', 'issue', 'reschedule'].includes(type);
  }
}