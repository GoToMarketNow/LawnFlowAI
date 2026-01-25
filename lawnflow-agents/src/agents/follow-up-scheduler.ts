import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, FollowUpSchedulerResult } from '../types';
import OpenAI from 'openai';

export class FollowUpSchedulerAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('follow_up_scheduler', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const customerId = context.event.payload?.customer_id;
      const followUpDate = context.event.payload?.follow_up_date;
      const serviceType = context.event.payload?.service_type;

      if (!customerId || !followUpDate) {
        return this.createEnvelope(
          'needs_input',
          'Missing customer ID or follow-up date',
          null,
          [this.createUserAsk('Please provide customer and follow-up information')]
        );
      }

      // Analyze customer history and preferences
      const customerAnalysis = await this.analyzeCustomerHistory(customerId, context);

      // Determine optimal follow-up strategy
      const strategy = await this.determineFollowUpStrategy(customerAnalysis, serviceType, context);

      // Schedule follow-up activities
      const schedule = this.scheduleFollowUpActivities(strategy, followUpDate, context);

      // Set up automated reminders
      const reminders = this.setupAutomatedReminders(schedule, context);

      const result: FollowUpSchedulerResult = {
        customer_id: customerId,
        follow_up_strategy: strategy,
        scheduled_activities: schedule.activities,
        reminder_sequence: reminders,
        next_contact_date: schedule.next_contact,
        expected_response_rate: strategy.expected_response_rate,
        business_value: strategy.projected_value
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [
        this.createHandoff('customer_notification', {
          customer_id: customerId,
          message: schedule.initial_message,
          type: 'follow_up'
        })
      ];

      return this.createEnvelope(
        'ok',
        `Follow-up scheduled for customer ${customerId}`,
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
        'Follow-up scheduling failed',
        null,
        [],
        [{ code: 'SCHEDULER_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async analyzeCustomerHistory(customerId: string, context: AgentContext): Promise<any> {
    // In a real implementation, this would query customer history database
    return {
      total_jobs: 5,
      average_rating: 4.8,
      last_service_date: '2024-01-01',
      preferred_services: ['lawn_mowing', 'fertilizing'],
      response_patterns: {
        email_open_rate: 0.85,
        response_time_avg: 2, // days
        booking_rate: 0.6
      },
      lifetime_value: 2500,
      churn_risk: 'low'
    };
  }

  private async determineFollowUpStrategy(analysis: any, serviceType: string, context: AgentContext): Promise<any> {
    const systemPrompt = `You are determining optimal follow-up strategies for lawn care customers.

Consider:
- Customer history and preferences
- Service type and timing
- Response patterns and engagement
- Business objectives and seasonality
- Competitive positioning

Create a strategy that maximizes response rates and booking conversions.`;

    const userPrompt = `Determine follow-up strategy:
Customer Analysis: ${JSON.stringify(analysis)}
Service Type: ${serviceType}
Business Goals: ${JSON.stringify(context.business_config.follow_up_goals)}
Current Season: ${new Date().toLocaleDateString('en-US', { month: 'long' })}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 600,
      temperature: 0.2
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(rawResponse);
  }

  private scheduleFollowUpActivities(strategy: any, followUpDate: string, context: AgentContext): any {
    const activities: any[] = [];
    const baseDate = new Date(followUpDate);

    strategy.touchpoints.forEach((touchpoint: any, index: number) => {
      const activityDate = new Date(baseDate);
      activityDate.setDate(activityDate.getDate() + touchpoint.days_delay);

      activities.push({
        id: `followup-${index + 1}`,
        type: touchpoint.type,
        date: activityDate.toISOString(),
        channel: touchpoint.channel,
        message: touchpoint.message,
        purpose: touchpoint.purpose
      });
    });

    return {
      activities,
      next_contact: activities[0]?.date,
      initial_message: activities[0]?.message
    };
  }

  private setupAutomatedReminders(schedule: any, context: AgentContext): any[] {
    return schedule.activities.map((activity: any) => ({
      activity_id: activity.id,
      trigger_date: activity.date,
      channel: activity.channel,
      template: activity.message,
      automated: true
    }));
  }
}