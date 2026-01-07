import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, CrewNotificationResult } from '../types';
import OpenAI from 'openai';

export class CrewNotificationAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('crew_notification', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const jobId = context.event.payload?.job_id;
      const crewId = context.event.payload?.crew_id;
      const instructions = context.event.payload?.instructions;

      if (!jobId || !crewId) {
        return this.createEnvelope(
          'needs_input',
          'Missing job ID or crew ID for notification',
          null,
          [this.createUserAsk('Please provide job and crew information')]
        );
      }

      // Get crew details
      const crew = await this.getCrewDetails(crewId, context);

      // Generate personalized notification
      const notification = await this.generateNotification(jobId, crew, instructions, context);

      // Send notification (in real implementation, this would use actual notification service)
      const sent = await this.sendNotification(notification, context);

      // Schedule follow-up if needed
      const followUp = this.scheduleFollowUp(jobId, crew, context);

      const result: CrewNotificationResult = {
        job_id: jobId,
        crew_id: crewId,
        notification_sent: sent,
        notification_content: notification,
        follow_up_scheduled: followUp.scheduled,
        follow_up_time: followUp.time
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [];
      if (followUp.scheduled) {
        nextActions.push(this.createHandoff('job_monitoring', {
          job_id: jobId,
          follow_up_time: followUp.time
        }));
      }

      return this.createEnvelope(
        'ok',
        `Notification sent to crew ${crew.name} for job ${jobId}`,
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
        'Crew notification failed',
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

  private async getCrewDetails(crewId: string, context: AgentContext): Promise<any> {
    // In a real implementation, this would query the crew database
    const crew = (context.business_config.crews || []).find((c: any) => c.id === crewId);
    if (!crew) {
      throw new Error(`Crew ${crewId} not found`);
    }
    return crew;
  }

  private async generateNotification(jobId: string, crew: any, instructions: any, context: AgentContext): Promise<any> {
    const systemPrompt = `You are generating personalized notifications for lawn care crew members.

Notification should include:
- Job details and timing
- Customer information
- Work instructions summary
- Required equipment
- Safety reminders
- Contact information for questions

Keep it concise but comprehensive, using a professional, friendly tone.`;

    const userPrompt = `Generate notification for:
Job ID: ${jobId}
Crew: ${JSON.stringify(crew)}
Instructions: ${JSON.stringify(instructions)}
Business Config: ${JSON.stringify(context.business_config.notification_settings)}`;

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

  private async sendNotification(notification: any, context: AgentContext): Promise<boolean> {
    // In a real implementation, this would integrate with SMS, email, or app notification services
    console.log('Sending notification:', notification);

    // Simulate sending
    return true;
  }

  private scheduleFollowUp(jobId: string, crew: any, context: AgentContext): any {
    // Schedule a follow-up check 2 hours before job start
    const jobStart = new Date(context.event.payload?.scheduled_date || Date.now());
    const followUpTime = new Date(jobStart.getTime() - 2 * 60 * 60 * 1000); // 2 hours before

    return {
      scheduled: true,
      time: followUpTime.toISOString(),
      type: 'pre_job_check'
    };
  }
}