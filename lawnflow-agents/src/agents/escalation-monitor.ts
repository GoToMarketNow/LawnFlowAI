import { BaseAgent } from '../core/interfaces';
import { AgentContext, Envelope, EscalationMonitorResult } from '../types';
import OpenAI from 'openai';

export class EscalationMonitorAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('escalation_monitor', '1.0.0');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async execute(context: AgentContext): Promise<Envelope> {
    const startTime = Date.now();

    try {
      const escalationId = context.event.payload?.escalation_id;
      const managerId = context.event.payload?.manager_id;
      const deadline = context.event.payload?.deadline;

      if (!escalationId) {
        return this.createEnvelope(
          'needs_input',
          'Missing escalation ID for monitoring',
          null,
          [this.createUserAsk('Please provide escalation details')]
        );
      }

      // Check escalation status
      const status = await this.checkEscalationStatus(escalationId, context);

      // Assess progress and risks
      const assessment = await this.assessEscalationProgress(status, deadline, context);

      // Generate monitoring actions
      const actions = this.generateMonitoringActions(assessment, context);

      const result: EscalationMonitorResult = {
        escalation_id: escalationId,
        current_status: status.status,
        time_elapsed: assessment.time_elapsed,
        time_to_deadline: assessment.time_to_deadline,
        progress_assessment: assessment,
        risk_level: assessment.risk_level,
        recommended_actions: actions,
        next_check_time: this.calculateNextCheck(assessment)
      };

      const executionTime = Date.now() - startTime;

      // Determine next actions
      const nextActions = [];
      if (actions.length > 0) {
        nextActions.push(...actions.map(action => this.createHandoff(action.agent, action.payload)));
      }

      // Schedule next monitoring check
      if (result.next_check_time) {
        nextActions.push(this.createHandoff('escalation_monitor', {
          escalation_id: escalationId,
          manager_id: managerId,
          deadline: deadline
        }));
      }

      return this.createEnvelope(
        'ok',
        `Escalation ${escalationId} monitoring complete - ${status.status}`,
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
        'Escalation monitoring failed',
        null,
        [],
        [{ code: 'MONITOR_ERROR', message: error instanceof Error ? error.message : 'Unknown error', recoverable: true }],
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

  private async checkEscalationStatus(escalationId: string, context: AgentContext): Promise<any> {
    // In a real implementation, this would query escalation tracking system
    return {
      status: 'in_progress',
      assigned_manager: 'Sarah Johnson',
      started_at: '2024-01-15T10:00:00Z',
      last_update: '2024-01-15T11:30:00Z',
      progress_notes: 'Manager reviewing customer history and preparing response'
    };
  }

  private async assessEscalationProgress(status: any, deadline: string, context: AgentContext): Promise<any> {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const startedDate = new Date(status.started_at);

    const timeElapsed = now.getTime() - startedDate.getTime();
    const timeToDeadline = deadlineDate.getTime() - now.getTime();

    const systemPrompt = `You are assessing escalation progress for management review.

Evaluate:
- Time management and deadlines
- Progress toward resolution
- Risk of deadline breach
- Need for additional support
- Communication effectiveness
- Resolution quality indicators

Provide risk assessment and recommendations.`;

    const userPrompt = `Assess escalation progress:
Status: ${JSON.stringify(status)}
Time Elapsed: ${Math.floor(timeElapsed / (1000 * 60 * 60))} hours
Time to Deadline: ${Math.floor(timeToDeadline / (1000 * 60 * 60))} hours
Business Policies: ${JSON.stringify(context.business_config.escalation_policies)}`;

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

    const assessment = JSON.parse(rawResponse);
    return {
      ...assessment,
      time_elapsed: `${Math.floor(timeElapsed / (1000 * 60 * 60))} hours`,
      time_to_deadline: `${Math.floor(timeToDeadline / (1000 * 60 * 60))} hours`
    };
  }

  private generateMonitoringActions(assessment: any, context: AgentContext): any[] {
    const actions = [];

    if (assessment.risk_level === 'high') {
      actions.push({
        agent: 'manager_escalation',
        payload: {
          escalation_id: context.event.payload.escalation_id,
          additional_support: true,
          reason: 'deadline_at_risk'
        }
      });
    }

    if (assessment.needs_follow_up) {
      actions.push({
        agent: 'customer_notification',
        payload: {
          customer_id: context.event.payload.customer_id,
          type: 'escalation_update',
          message: assessment.status_message
        }
      });
    }

    return actions;
  }

  private calculateNextCheck(assessment: any): string | null {
    if (assessment.status === 'resolved' || assessment.status === 'closed') {
      return null; // No more monitoring needed
    }

    // Schedule next check in 2 hours for high risk, 4 hours for others
    const interval = assessment.risk_level === 'high' ? 2 : 4;
    const nextCheck = new Date(Date.now() + interval * 60 * 60 * 1000);
    return nextCheck.toISOString();
  }
}