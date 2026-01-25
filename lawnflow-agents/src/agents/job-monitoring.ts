import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, JobMonitoringResult } from '../types';
import OpenAI from 'openai';

export class JobMonitoringAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('job_monitoring', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const jobId = context.event.payload?.job_id;
      const followUpTime = context.event.payload?.follow_up_time;

      if (!jobId) {
        return this.createEnvelope(
          'needs_input',
          'Missing job ID for monitoring',
          null,
          [this.createUserAsk('Please provide job ID to monitor')]
        );
      }

      // Check job status
      const jobStatus = await this.checkJobStatus(jobId, context);

      // Analyze progress and risks
      const analysis = await this.analyzeJobProgress(jobStatus, context);

      // Generate monitoring actions
      const actions = this.generateMonitoringActions(analysis, context);

      const result: JobMonitoringResult = {
        job_id: jobId,
        current_status: jobStatus.status,
        progress_percentage: analysis.progress,
        issues_detected: analysis.issues,
        recommended_actions: actions,
        next_check_time: this.calculateNextCheck(jobStatus, analysis)
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [];
      if (actions.length > 0) {
        nextActions.push(...actions.map(action => this.createHandoff(action.agent, action.payload)));
      }

      // Schedule next monitoring check
      if (result.next_check_time) {
        nextActions.push(this.createHandoff('job_monitoring', {
          job_id: jobId,
          follow_up_time: result.next_check_time
        }));
      }

      return this.createEnvelope(
        'ok',
        `Job ${jobId} monitoring complete - ${jobStatus.status}`,
        result,
        nextActions,
        [],
        {
          estimated_tokens_in: 150,
          estimated_tokens_out: 200,
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
        'Job monitoring failed',
        null,
        [],
        [{ code: 'MONITORING_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async checkJobStatus(jobId: string, context: AgentContext): Promise<any> {
    // In a real implementation, this would query the job database
    // For now, return mock status based on time
    const now = new Date();
    const scheduledTime = new Date(context.event.payload?.scheduled_date || now);

    let status = 'scheduled';
    if (now > scheduledTime) {
      status = Math.random() > 0.5 ? 'in_progress' : 'scheduled';
    }

    return {
      id: jobId,
      status,
      started_at: status === 'in_progress' ? scheduledTime.toISOString() : null,
      crew_location: status === 'in_progress' ? 'en_route' : null,
      last_update: now.toISOString()
    };
  }

  private async analyzeJobProgress(jobStatus: any, context: AgentContext): Promise<any> {
    const systemPrompt = `You are analyzing job progress for a lawn care business.

Analyze the current job status and determine:
- Progress percentage (0-100)
- Potential issues or risks
- Quality concerns
- Timeline adherence
- Resource utilization

Consider business standards and typical job workflows.`;

    const userPrompt = `Analyze job progress:
Job Status: ${JSON.stringify(jobStatus)}
Business Standards: ${JSON.stringify(context.business_config.service_standards)}
Current Time: ${new Date().toISOString()}`;

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

  private generateMonitoringActions(analysis: any, context: AgentContext): any[] {
    const actions = [];

    if (analysis.progress < 50 && analysis.issues.length > 0) {
      actions.push({
        agent: 'crew_support',
        payload: {
          job_id: context.event.payload.job_id,
          issues: analysis.issues,
          support_type: 'progress_assistance'
        }
      });
    }

    if (analysis.progress > 90) {
      actions.push({
        agent: 'quality_assurance',
        payload: {
          job_id: context.event.payload.job_id,
          final_check: true
        }
      });
    }

    return actions;
  }

  private calculateNextCheck(jobStatus: any, analysis: any): string | null {
    if (jobStatus.status === 'completed') {
      return null; // No more monitoring needed
    }

    // Schedule next check in 30 minutes
    const nextCheck = new Date(Date.now() + 30 * 60 * 1000);
    return nextCheck.toISOString();
  }
}